import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import test from "node:test";
import { Pool } from "pg";
import { orderRequestFingerprint } from "../src/orders/inventoryLifecycle.js";

const REQUIRED_DATABASE = "eb_catalog_order_inventory_test";
const forbiddenDatabasePattern = /^(?:eb_catalog_test|postgres|template0|template1)$/i;
const databaseUrl = process.env.ORDER_INVENTORY_TEST_DATABASE_URL;

if (!databaseUrl) {
  throw new Error("ORDER_INVENTORY_TEST_DATABASE_URL is required for the PostgreSQL lifecycle suite.");
}

const control = new Pool({ connectionString: databaseUrl });
const sqlFile = (relative) => fs.readFileSync(new URL(relative, import.meta.url), "utf8");

async function guardDisposableDatabase() {
  const result = await control.query("select current_database() as name");
  const actual = result.rows[0]?.name;
  if (actual !== REQUIRED_DATABASE || forbiddenDatabasePattern.test(actual || "") || /prod/i.test(actual || "")) {
    throw new Error(`Refusing destructive lifecycle tests against database: ${actual || "unknown"}`);
  }
  return actual;
}

async function preparePre022Schema() {
  await guardDisposableDatabase();
  await control.query("drop schema if exists public cascade; create schema public; create extension if not exists pgcrypto");
  await control.query(sqlFile("../supabase/schema.sql"));
  const migrations = fs.readdirSync(new URL("../supabase/migrations/", import.meta.url))
    .filter((name) => /^\d{3}_.+\.sql$/.test(name))
    .filter((name) => Number(name.slice(0, 3)) < 20)
    .sort();
  for (const migration of migrations) {
    await control.query(sqlFile(`../supabase/migrations/${migration}`));
  }
}

async function resetSyntheticState() {
  await control.query(`
    truncate public.order_inventory_allocations, public.order_items, public.orders,
      public.product_gallery_images, public.product_variants, public.products cascade;
    delete from public.company_settings where company_id in ('alpha','beta');
    delete from public.companies where id in ('alpha','beta');
    insert into public.companies (id,slug,name,status,is_default) values
      ('alpha','alpha','Alpha','active',false),
      ('beta','beta','Beta','active',false);
  `);
}

async function product(companyId, id, stock, price = 10) {
  await control.query(
    `insert into public.products (id,company_id,slug,name,price,stock_qty,is_active,data)
     values ($1,$2,$1,$1,$4,$3,true,$5::jsonb)`,
    [id, companyId, stock, price, JSON.stringify({ name: { en: id }, sku: `${id}-sku` })],
  );
}

async function variant(companyId, productId, id, stock, price = 12) {
  await control.query(
    `insert into public.product_variants
      (id,company_id,product_id,color_name,size,price,stock,data)
     values ($1,$2,$3,'Blue','M',$5,$4,$6::jsonb)`,
    [id, companyId, productId, stock, price, JSON.stringify({ sku: `${id}-sku`, isVisible: true })],
  );
}

function input(key, items, marker = "same") {
  const payload = {
    customer: { name: `Buyer ${marker}`, phone: "0500000000", city: "Test", address: "Test" },
    items,
    paymentMethod: "cash",
  };
  return {
    idempotencyKey: key,
    requestFingerprint: orderRequestFingerprint(payload),
    items,
    order: { customer: payload.customer, paymentMethod: "cash" },
  };
}

function expectCode(code) {
  return (error) => error?.code === code;
}

test("real PostgreSQL order inventory lifecycle", { timeout: 120_000 }, async (t) => {
  assert.equal(await guardDisposableDatabase(), REQUIRED_DATABASE);
  await preparePre022Schema();
  await control.query(`
    insert into public.companies (id,slug,name,status,is_default)
      values ('alpha','alpha','Alpha','active',false);
    insert into public.products (id,company_id,slug,name,price,stock_qty,is_active,data)
      values ('legacy-product','alpha','legacy-product','Legacy',5,7,true,'{}');
    insert into public.orders
      (id,company_id,customer,subtotal,total,payment_method,status,data)
      values ('legacy-order','alpha','{}',5,5,'cash','Completed','{}');
  `);
  const beforeMigration = await control.query("select stock_qty from public.products where id='legacy-product'");
  await control.query(sqlFile("../supabase/migrations/022_order_inventory_lifecycle.sql"));

  process.env.DATABASE_URL = databaseUrl;
  process.env.POSTGRES_URL = "";
  process.env.NODE_ENV = "test";
  const repository = await import(`../src/data/postgresStore.js?pg-lifecycle=${Date.now()}`);
  const create = repository.createManagedOrderInSupabase;
  const cancel = repository.updateManagedOrderStatusInSupabase;

  await t.test("01 migration 022 applies", async () => {
    const columns = await control.query("select column_name from information_schema.columns where table_schema='public' and table_name='orders'");
    assert.ok(columns.rows.some((row) => row.column_name === "inventory_managed"));
  });
  await t.test("02 legacy orders remain unmanaged", async () => {
    const row = (await control.query("select inventory_managed,inventory_state from public.orders where id='legacy-order'")).rows[0];
    assert.deepEqual(row, { inventory_managed: false, inventory_state: "unmanaged" });
  });
  await t.test("03 migration changes no existing stock", async () => {
    const after = await control.query("select stock_qty from public.products where id='legacy-product'");
    assert.equal(Number(after.rows[0].stock_qty), Number(beforeMigration.rows[0].stock_qty));
  });

  await t.test("04 non-variant stock deduction", async () => {
    await resetSyntheticState(); await product("alpha", "plain", 3);
    await create("alpha", input("plain-deduct", [{ productId: "plain", quantity: 2 }]));
    assert.equal(Number((await control.query("select stock_qty from public.products where id='plain'")).rows[0].stock_qty), 1);
  });
  await t.test("05 variant deduction and 06 aggregate recalculation", async () => {
    await resetSyntheticState(); await product("alpha", "vp", 99); await variant("alpha", "vp", "red", 2); await variant("alpha", "vp", "blue", 3);
    await create("alpha", input("variant-deduct", [{ productId: "vp", variantId: "red", quantity: 1 }]));
    const stocks = await control.query("select id,stock from public.product_variants where product_id='vp' order by id");
    assert.deepEqual(stocks.rows.map((row) => [row.id, Number(row.stock)]), [["blue", 3], ["red", 1]]);
    assert.equal(Number((await control.query("select stock_qty from public.products where id='vp'")).rows[0].stock_qty), 4);
  });
  await t.test("07 insufficient stock rolls back", async () => {
    await resetSyntheticState(); await product("alpha", "plain", 1);
    await assert.rejects(create("alpha", input("insufficient", [{ productId: "plain", quantity: 2 }])), expectCode("INSUFFICIENT_STOCK"));
    assert.equal(Number((await control.query("select stock_qty from public.products where id='plain'")).rows[0].stock_qty), 1);
    assert.equal(Number((await control.query("select count(*) from public.orders")).rows[0].count), 0);
  });
  await t.test("08 unavailable multi-item order is fully atomic", async () => {
    await resetSyntheticState(); await product("alpha", "available", 2); await product("alpha", "empty", 0);
    await assert.rejects(create("alpha", input("multi-fail", [{ productId: "available", quantity: 1 }, { productId: "empty", quantity: 1 }])), expectCode("INSUFFICIENT_STOCK"));
    const counts = await control.query(`select
      (select count(*) from public.orders) orders,
      (select count(*) from public.order_items) items,
      (select count(*) from public.order_inventory_allocations) allocations,
      (select stock_qty from public.products where id='available') stock`);
    assert.deepEqual({ ...counts.rows[0], orders: Number(counts.rows[0].orders), items: Number(counts.rows[0].items), allocations: Number(counts.rows[0].allocations), stock: Number(counts.rows[0].stock) }, { orders: 0, items: 0, allocations: 0, stock: 2 });
  });
  await t.test("09 duplicate lines aggregate before validation", async () => {
    await resetSyntheticState(); await product("alpha", "plain", 3);
    const result = await create("alpha", input("aggregate", [{ productId: "plain", quantity: 1 }, { productId: "plain", quantity: 2 }]));
    assert.equal(result.order.items.length, 1); assert.equal(result.order.items[0].quantity, 3);
  });
  await t.test("10 same idempotency key replays once", async () => {
    await resetSyntheticState(); await product("alpha", "plain", 2); const request = input("replay", [{ productId: "plain", quantity: 1 }]);
    const first = await create("alpha", request); const replay = await create("alpha", request);
    assert.equal(replay.replayed, true); assert.equal(replay.order.id, first.order.id);
    assert.equal(Number((await control.query("select stock_qty from public.products where id='plain'")).rows[0].stock_qty), 1);
  });
  await t.test("11 same key with different payload conflicts", async () => {
    await resetSyntheticState(); await product("alpha", "plain", 3);
    await create("alpha", input("conflict", [{ productId: "plain", quantity: 1 }], "one"));
    await assert.rejects(create("alpha", input("conflict", [{ productId: "plain", quantity: 2 }], "two")), expectCode("IDEMPOTENCY_CONFLICT"));
  });
  await t.test("12 concurrent same-key requests create one effect", async () => {
    await resetSyntheticState(); await product("alpha", "plain", 2); const request = input("concurrent-key", [{ productId: "plain", quantity: 1 }]);
    const results = await Promise.all([create("alpha", request), create("alpha", request)]);
    assert.equal(new Set(results.map((entry) => entry.order.id)).size, 1);
    assert.equal(Number((await control.query("select count(*) from public.orders")).rows[0].count), 1);
    assert.equal(Number((await control.query("select stock_qty from public.products where id='plain'")).rows[0].stock_qty), 1);
  });
  await t.test("13 two buyers compete for final unit", async () => {
    await resetSyntheticState(); await product("alpha", "last", 1);
    const settled = await Promise.allSettled([
      create("alpha", input("buyer-a", [{ productId: "last", quantity: 1 }], "a")),
      create("alpha", input("buyer-b", [{ productId: "last", quantity: 1 }], "b")),
    ]);
    assert.equal(settled.filter((entry) => entry.status === "fulfilled").length, 1);
    assert.equal(settled.filter((entry) => entry.status === "rejected" && entry.reason?.code === "INSUFFICIENT_STOCK").length, 1);
    assert.equal(Number((await control.query("select stock_qty from public.products where id='last'")).rows[0].stock_qty), 0);
  });

  async function freshOrder(status = "Pending", key = crypto.randomUUID()) {
    await resetSyntheticState(); await product("alpha", "plain", 2);
    const created = await create("alpha", input(key, [{ productId: "plain", quantity: 1 }]));
    if (status !== "Pending") await cancel("alpha", created.order.id, status);
    return created.order.id;
  }
  await t.test("14 Pending cancellation restores exactly once", async () => {
    const id = await freshOrder(); await cancel("alpha", id, "Cancelled");
    assert.equal(Number((await control.query("select stock_qty from public.products where id='plain'")).rows[0].stock_qty), 2);
  });
  await t.test("15 Processing cancellation restores exactly once", async () => {
    const id = await freshOrder("Processing"); await cancel("alpha", id, "Cancelled");
    assert.equal(Number((await control.query("select stock_qty from public.products where id='plain'")).rows[0].stock_qty), 2);
  });
  await t.test("16 repeated cancellation does not restore twice", async () => {
    const id = await freshOrder(); await cancel("alpha", id, "Cancelled"); await cancel("alpha", id, "Cancelled");
    assert.equal(Number((await control.query("select stock_qty from public.products where id='plain'")).rows[0].stock_qty), 2);
  });
  await t.test("17 concurrent cancellation does not restore twice", async () => {
    const id = await freshOrder(); await Promise.all([cancel("alpha", id, "Cancelled"), cancel("alpha", id, "Cancelled")]);
    assert.equal(Number((await control.query("select stock_qty from public.products where id='plain'")).rows[0].stock_qty), 2);
    assert.equal(Number((await control.query("select count(*) from public.order_inventory_allocations where restored_at is not null")).rows[0].count), 1);
  });
  await t.test("18 Completed to Cancelled is rejected", async () => {
    const id = await freshOrder("Completed"); await assert.rejects(cancel("alpha", id, "Cancelled"), expectCode("INVALID_ORDER_TRANSITION"));
  });
  await t.test("19 managed hard-delete guard detects inventory history", async () => {
    const id = await freshOrder(); assert.equal(await repository.managedOrderHasInventoryHistoryInSupabase("alpha", id), true);
  });
  await t.test("20 cross-tenant product is rejected", async () => {
    await resetSyntheticState(); await product("beta", "beta-product", 2);
    await assert.rejects(create("alpha", input("cross-product", [{ productId: "beta-product", quantity: 1 }])), expectCode("INVALID_PRODUCT"));
  });
  await t.test("21 cross-tenant variant is rejected", async () => {
    await resetSyntheticState(); await product("alpha", "alpha-product", 2); await product("beta", "beta-product", 2); await variant("beta", "beta-product", "beta-variant", 2);
    await assert.rejects(create("alpha", input("cross-variant", [{ productId: "alpha-product", variantId: "beta-variant", quantity: 1 }])), expectCode("INVALID_VARIANT"));
  });
  await t.test("22 idempotency keys are tenant-scoped", async () => {
    await resetSyntheticState(); await product("alpha", "alpha-product", 1); await product("beta", "beta-product", 1);
    const [alpha, beta] = await Promise.all([
      create("alpha", input("shared-key", [{ productId: "alpha-product", quantity: 1 }])),
      create("beta", input("shared-key", [{ productId: "beta-product", quantity: 1 }])),
    ]);
    assert.notEqual(alpha.order.id, beta.order.id);
  });
  await t.test("23 persistence survives a new repository instance", async () => {
    await resetSyntheticState(); await product("alpha", "plain", 2); const request = input("reload", [{ productId: "plain", quantity: 1 }]);
    const created = await create("alpha", request); await cancel("alpha", created.order.id, "Cancelled");
    const reloaded = await import(`../src/data/postgresStore.js?pg-reload=${Date.now()}`);
    const replay = await reloaded.createManagedOrderInSupabase("alpha", request);
    assert.equal(replay.replayed, true); assert.equal(replay.order.inventoryState, "restored");
    assert.equal(Number((await control.query("select stock_qty from public.products where id='plain'")).rows[0].stock_qty), 2);
  });
  await t.test("global safety invariants hold", async () => {
    const negative = await control.query("select count(*) from public.products where stock_qty < 0");
    const variants = await control.query("select count(*) from public.product_variants where stock < 0");
    assert.equal(Number(negative.rows[0].count) + Number(variants.rows[0].count), 0);
  });

  await control.end();
});
