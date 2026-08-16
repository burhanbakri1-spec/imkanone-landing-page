import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { hashPassword } from "../src/auth/passwords.js";
import {
  canonicalOrderLines,
  orderRequestFingerprint,
  requireIdempotencyKey,
  serverOrderItem,
  validateOrderTransition,
} from "../src/orders/inventoryLifecycle.js";

const migration = fs.readFileSync(new URL("../supabase/migrations/022_order_inventory_lifecycle.sql", import.meta.url), "utf8");
const postgresSource = fs.readFileSync(new URL("../src/data/postgresStore.js", import.meta.url), "utf8");

test("migration 022 is additive, tenant-scoped, and does not infer historical stock effects", () => {
  assert.match(migration, /add column if not exists inventory_managed boolean not null default false/i);
  assert.match(migration, /inventory_state in \('unmanaged', 'deducted', 'restored'\)/i);
  assert.match(migration, /uq_orders_company_idempotency_key[\s\S]*where idempotency_key is not null/i);
  assert.match(migration, /create table if not exists public\.order_inventory_allocations/i);
  assert.match(migration, /unique \(company_id, order_item_id\)/i);
  assert.match(migration, /quantity integer not null check \(quantity > 0\)/i);
  assert.match(migration, /conname = 'orders_inventory_state_check'[\s\S]*conrelid = 'public\.orders'::regclass/i);
  assert.match(migration, /conname = 'order_items_tenant_order_fk'[\s\S]*conrelid = 'public\.order_items'::regclass/i);
  assert.doesNotMatch(migration, /update public\.products[\s\S]*(stock|stock_qty)/i);
  assert.doesNotMatch(migration, /delete from/i);
});

test("canonical order lines reject bad quantities and aggregate duplicates deterministically", () => {
  assert.deepEqual(canonicalOrderLines([
    { productId: "b", quantity: 1 },
    { productId: "a", variantId: "v", quantity: 2 },
    { productId: "a", variantId: "v", quantity: 3 },
  ]), [
    { productId: "a", variantId: "v", quantity: 5 },
    { productId: "b", variantId: null, quantity: 1 },
  ]);
  assert.throws(() => canonicalOrderLines([{ productId: "a", quantity: 0 }]), (error) => error.code === "INVALID_QUANTITY");
  assert.throws(() => canonicalOrderLines([{ productId: "a", quantity: 1.5 }]), (error) => error.code === "INVALID_QUANTITY");
});

test("idempotency and transition helpers implement the approved contract", () => {
  assert.throws(() => requireIdempotencyKey(""), (error) => error.code === "IDEMPOTENCY_KEY_REQUIRED");
  const payload = { customer: { name: "A" }, items: [{ productId: "p", quantity: 1 }], paymentMethod: "cash" };
  assert.equal(orderRequestFingerprint(payload), orderRequestFingerprint({ ...payload, items: [{ quantity: 1, productId: "p" }] }));
  assert.deepEqual(validateOrderTransition("Pending", "Processing"), { status: "Processing", changed: true });
  assert.deepEqual(validateOrderTransition("Cancelled", "Cancelled"), { status: "Cancelled", changed: false });
  assert.throws(() => validateOrderTransition("Completed", "Cancelled"), (error) => error.code === "INVALID_ORDER_TRANSITION");
});

test("server snapshots ignore browser prices and preserve product/variant identity", () => {
  const product = { id: "p", sku: "P-SKU", name: { en: "Product" }, price: 7, variants: [{ id: "v", sku: "V-SKU", size: "M", colorName: "Blue", price: 12, stock: 3 }] };
  const item = serverOrderItem(product, product.variants[0], 2);
  assert.equal(item.price, 12);
  assert.equal(item.lineTotal, 24);
  assert.equal(item.productSku, "P-SKU");
  assert.equal(item.variantSku, "V-SKU");
  assert.equal(item.variantName, "Blue / M");
  assert.equal(item.inventoryManaged, true);
});

test("PostgreSQL implementation locks idempotency before inventory and uses deterministic row locks", () => {
  const advisory = postgresSource.indexOf("pg_advisory_xact_lock");
  const existing = postgresSource.indexOf("idempotency_key=$2", advisory);
  const products = postgresSource.indexOf("order by id for update", existing);
  const variants = postgresSource.indexOf("order by product_id,id for update", products);
  assert.ok(advisory >= 0 && existing > advisory && products > existing && variants > products);
  assert.match(postgresSource, /update public\.order_inventory_allocations set restored_at=now\(\)[\s\S]*restored_at is null/i);
});

test("local API deducts atomically, replays safely, restores once, and protects tenants", async (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "order-inventory-"));
  const password = "Order-test-123!";
  const passwordHash = await hashPassword(password);
  const company = (id) => ({ id, slug: id, name: id, status: "active", settings: { language: "en", currency: "USD" } });
  const user = (id, companyId) => ({ id, email: `${id}@test.local`, password: passwordHash, role: "company_admin", company_id: companyId, permissions: [], isActive: true });
  fs.writeFileSync(path.join(dataDir, "store.json"), JSON.stringify({
    version: 2,
    companies: [company("alpha"), company("beta")],
    users: [user("alpha-admin", "alpha"), user("beta-admin", "beta")],
    memberships: [
      { id: "alpha-membership", companyId: "alpha", userId: "alpha-admin", role: "company_admin", status: "active", permissions: [] },
      { id: "beta-membership", companyId: "beta", userId: "beta-admin", role: "company_admin", status: "active", permissions: [] },
    ],
    products: [
      { id: "plain", company_id: "alpha", name: { en: "Plain" }, sku: "PLAIN", price: 10, stockQty: 2, variants: [], isActive: true },
      { id: "variant", company_id: "alpha", name: { en: "Variant" }, sku: "VAR", stockQty: 2, variants: [{ id: "red", sku: "RED", price: 15, stock: 2, isVisible: true }], isActive: true },
      { id: "unused", company_id: "alpha", name: { en: "Unused" }, sku: "UNUSED", price: 3, stockQty: 1, variants: [], isActive: true },
      { id: "plain", company_id: "beta", name: { en: "Other" }, sku: "OTHER", price: 99, stockQty: 9, variants: [], isActive: true },
    ],
  }));
  process.env.DATA_STORE_DIR = dataDir;
  process.env.DATABASE_URL = "";
  process.env.POSTGRES_URL = "";
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "order-inventory-secret";
  const { app } = await import(`../src/server.js?order-inventory=${Date.now()}`);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const request = async (url, { token, body, method = body ? "POST" : "GET", key } = {}) => {
    const response = await fetch(`${base}${url}`, {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}), ...(key ? { "Idempotency-Key": key } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, body: await response.json().catch(() => null) };
  };
  const token = (await request("/auth/login", { body: { email: "alpha-admin@test.local", password } })).body.token;
  const betaToken = (await request("/auth/login", { body: { email: "beta-admin@test.local", password } })).body.token;
  const body = { customer: { name: "Buyer", phone: "0599000000", city: "City", address: "Street" }, items: [{ productId: "plain", quantity: 1, price: 0 }], paymentMethod: "cash" };

  assert.equal((await request("/orders", { token, body })).body.code, "IDEMPOTENCY_KEY_REQUIRED");
  const [first, duplicate] = await Promise.all([
    request("/orders", { token, body, key: "same-key" }),
    request("/orders", { token, body, key: "same-key" }),
  ]);
  assert.deepEqual([first.status, duplicate.status].sort(), [200, 201]);
  assert.equal(first.body.id, duplicate.body.id);
  assert.equal(first.body.items[0].price, 10);
  assert.equal((await request("/orders", { token, body: { ...body, items: [{ productId: "plain", quantity: 2 }] }, key: "same-key" })).body.code, "IDEMPOTENCY_CONFLICT");
  assert.equal((await request(`/orders/${first.body.id}/status`, { token: betaToken, method: "PUT", body: { status: "Cancelled" } })).body.code, "ORDER_NOT_FOUND");
  assert.equal((await request(`/orders/${first.body.id}/status`, { token, method: "PUT", body: { status: "Cancelled" } })).status, 200);
  assert.equal((await request(`/orders/${first.body.id}/status`, { token, method: "PUT", body: { status: "Cancelled" } })).status, 200);
  assert.equal((await request(`/orders/${first.body.id}`, { token, method: "DELETE" })).body.code, "MANAGED_ORDER_DELETE_FORBIDDEN");
  assert.equal((await request("/products/plain", { token, method: "DELETE" })).body.code, "MANAGED_CATALOG_DELETE_FORBIDDEN");
  assert.equal((await request("/products/plain", { token: betaToken, method: "DELETE" })).status, 204);
  assert.equal((await request("/products/unused", { token, method: "DELETE" })).status, 204);
  const inventory = await request("/admin/inventory", { token });
  assert.equal(inventory.body.find((product) => product.id === "plain").stock, 2);

  const insufficient = await request("/orders", { token, key: "insufficient", body: { ...body, items: [{ productId: "plain", quantity: 3 }, { productId: "variant", variantId: "red", quantity: 1 }] } });
  assert.equal(insufficient.body.code, "INSUFFICIENT_STOCK");
  const afterFailure = await request("/admin/inventory", { token });
  assert.equal(afterFailure.body.find((product) => product.id === "variant").variants[0].stock, 2);

  assert.equal((await request("/orders", { token, key: "bad-product", body: { ...body, items: [{ productId: "missing", quantity: 1 }] } })).body.code, "INVALID_PRODUCT");
  assert.equal((await request("/orders", { token, key: "bad-variant", body: { ...body, items: [{ productId: "variant", variantId: "missing", quantity: 1 }] } })).body.code, "INVALID_VARIANT");

  const multi = await request("/orders", { token, key: "multi", body: { ...body, items: [
    { productId: "plain", quantity: 1 },
    { productId: "plain", quantity: 1 },
    { productId: "variant", variantId: "red", quantity: 1 },
  ] } });
  assert.equal(multi.status, 201);
  assert.equal(multi.body.items.length, 2);
  assert.equal(multi.body.items.find((item) => item.productId === "plain").quantity, 2);
  const { productRepository, saveProductWithTenantCatalogLock } = await import("../src/data/store.js");
  const variantProduct = productRepository.findByCompany("alpha", "variant");
  await assert.rejects(
    saveProductWithTenantCatalogLock("alpha", { ...variantProduct, variants: [] }),
    (error) => error.code === "MANAGED_CATALOG_DELETE_FORBIDDEN" && error.statusCode === 409,
  );
  let inventoryAfterMulti = await request("/admin/inventory", { token });
  assert.equal(inventoryAfterMulti.body.find((product) => product.id === "plain").stock, 0);
  assert.equal(inventoryAfterMulti.body.find((product) => product.id === "variant").stock, 1);
  assert.equal((await request(`/orders/${multi.body.id}/status`, { token, method: "PUT", body: { status: "Processing" } })).status, 200);
  assert.equal((await request(`/orders/${multi.body.id}/status`, { token, method: "PUT", body: { status: "Cancelled" } })).status, 200);

  const contenders = await Promise.all([
    request("/orders", { token, key: "buyer-a", body: { ...body, items: [{ productId: "variant", variantId: "red", quantity: 2 }] } }),
    request("/orders", { token, key: "buyer-b", body: { ...body, items: [{ productId: "variant", variantId: "red", quantity: 2 }] } }),
  ]);
  assert.deepEqual(contenders.map((entry) => entry.status).sort(), [201, 409]);
  const winner = contenders.find((entry) => entry.status === 201);
  assert.equal((await request(`/orders/${winner.body.id}/status`, { token, method: "PUT", body: { status: "Completed" } })).status, 200);
  assert.equal((await request(`/orders/${winner.body.id}/status`, { token, method: "PUT", body: { status: "Cancelled" } })).body.code, "INVALID_ORDER_TRANSITION");
});
