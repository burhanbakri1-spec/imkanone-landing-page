import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { hashPassword } from "../src/auth/passwords.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const dataStoreDir = fs.mkdtempSync(path.join(os.tmpdir(), "tenant-catalog-settings-"));
const now = "2026-07-13T00:00:00.000Z";
const password = "Test-password-123!";
const passwordHash = await hashPassword(password);

const users = [
  ["icare-admin", "admin@icare.test", "company_admin", "icare"],
  ["eb-admin", "admin@eb.test", "admin", "eb-chemical"],
  ["icare-customer", "customer@icare.test", "customer", "icare"],
  ["revoked-admin", "revoked@icare.test", "company_admin", "icare"],
  ["super-user", "super@test.local", "super_admin", "eb-chemical"],
].map(([id, email, role, companyId]) => ({
  id,
  name: id,
  email,
  password: passwordHash,
  role,
  permissions: [],
  isActive: true,
  company_id: companyId,
  createdAt: now,
  updatedAt: now,
}));

const memberships = [
  ["icare:icare-admin", "icare", "icare-admin", "company_admin"],
  ["eb-chemical:eb-admin", "eb-chemical", "eb-admin", "company_admin"],
  ["icare:icare-customer", "icare", "icare-customer", "customer"],
  ["icare:revoked-admin", "icare", "revoked-admin", "company_admin"],
].map(([id, companyId, userId, role]) => ({
  id,
  companyId,
  userId,
  role,
  status: "active",
  permissions: [],
  createdAt: now,
  updatedAt: now,
}));

fs.writeFileSync(path.join(dataStoreDir, "store.json"), JSON.stringify({
  version: 2,
  companies: [
    {
      id: "eb-chemical",
      slug: "eb-chemical",
      name: "EB Chemical",
      status: "active",
      isDefault: true,
      settings: { language: "en", currency: "ILS", logoUrl: "/eb-logo.png" },
    },
    {
      id: "icare",
      slug: "icare",
      name: "iCare",
      status: "active",
      isDefault: false,
      settings: { language: "ar", locale: "ar-PS", direction: "rtl", currency: "ILS" },
    },
  ],
  users,
  memberships,
  categories: [
    {
      id: "eb-category",
      company_id: "eb-chemical",
      slug: "eb-only",
      name: { en: "EB Only", ar: "إي بي" },
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "icare-referenced-category",
      company_id: "icare",
      slug: "referenced-category",
      name: { en: "Referenced Category", ar: "فئة مرتبطة" },
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  ],
  brands: [
    {
      id: "eb-brand",
      company_id: "eb-chemical",
      slug: "eb-only",
      name: "EB Only",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "icare-referenced-brand",
      company_id: "icare",
      slug: "referenced-brand",
      name: "Referenced Brand",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  ],
  products: [
    {
      id: "icare-product",
      slug: "icare-product",
      name: { en: "iCare Product", ar: "منتج" },
      categoryId: "icare-referenced-category",
      brandId: "icare-referenced-brand",
      category: "Referenced Category",
      brand: "Referenced Brand",
      company_id: "icare",
    },
    {
      id: "eb-product",
      slug: "eb-product",
      name: { en: "EB Product", ar: "منتج" },
      category: "EB Only",
      brand: "EB Only",
      company_id: "eb-chemical",
    },
  ],
}, null, 2));

process.env.DATA_STORE_DIR = dataStoreDir;
process.env.DATABASE_URL = "";
process.env.POSTGRES_URL = "";
process.env.JWT_SECRET = "catalog-settings-test-secret";
process.env.NODE_ENV = "test";

const { app } = await import("../src/server.js");
const { companyMembershipRepository } = await import("../src/data/store.js");
const {
  runCompanyBrandingSettingsTransaction,
  runTenantCatalogWriteTransaction,
} = await import("../src/data/postgresStore.js");
const { sendCatalogError } = await import("../src/routes/catalogValidation.js");
const server = app.listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}/api`;

async function request(pathname, { token, body, headers = {}, method = body ? "POST" : "GET" } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { response, body: await response.json().catch(() => null) };
}

async function login(email) {
  const result = await request("/auth/login", { body: { email, password } });
  assert.equal(result.response.status, 200);
  return result.body;
}

test("tenant catalog and company settings contracts", async (t) => {
  const icare = await login("admin@icare.test");
  const eb = await login("admin@eb.test");
  const customer = await login("customer@icare.test");
  const superAdmin = await login("super@test.local");

  let createdCategory;
  let overrideCategory;
  await t.test("iCare company_admin creates and reads an iCare category", async () => {
    const created = await request("/categories", {
      token: icare.token,
      body: { slug: "shared-slug", name: { en: "iCare Category", ar: "فئة آي كير" } },
    });
    assert.equal(created.response.status, 201);
    createdCategory = created.body;
    const read = await request(`/categories/${createdCategory.id}`, { token: icare.token });
    assert.equal(read.response.status, 200);
    assert.equal(read.body.name.ar, "فئة آي كير");
  });

  await t.test("category IDs are tenant-safe for reads and mutations", async () => {
    assert.equal((await request(`/categories/${createdCategory.id}`, { token: eb.token })).response.status, 404);
    assert.equal((await request(`/categories/${createdCategory.id}`, {
      token: eb.token,
      body: { name: { en: "Changed", ar: "" } },
      method: "PATCH",
    })).response.status, 404);
    assert.equal((await request(`/categories/${createdCategory.id}`, {
      token: eb.token,
      method: "DELETE",
    })).response.status, 404);
    assert.equal((await request("/categories/eb-category", { token: icare.token })).response.status, 404);
    assert.equal((await request("/categories/eb-category", {
      token: icare.token,
      body: { isActive: false },
      method: "PATCH",
    })).response.status, 404);
    assert.equal((await request("/categories/eb-category", {
      token: icare.token,
      method: "DELETE",
    })).response.status, 404);
  });

  await t.test("category authorization, uniqueness, parents, references, and overrides", async () => {
    assert.equal((await request("/categories", {
      token: customer.token,
      body: { slug: "customer-category", name: { en: "Denied", ar: "" } },
    })).response.status, 403);
    assert.equal((await request("/categories", {
      token: icare.token,
      body: { slug: "shared-slug", name: { en: "Duplicate", ar: "" } },
    })).response.status, 409);
    assert.equal((await request("/categories", {
      token: eb.token,
      body: { slug: "shared-slug", name: { en: "Allowed in EB", ar: "" } },
    })).response.status, 201);
    assert.equal((await request("/categories", {
      token: icare.token,
      body: { slug: "cross-parent", name: { en: "Cross Parent", ar: "" }, parentId: "eb-category" },
    })).response.status, 404);
    assert.equal((await request("/categories/icare-referenced-category", {
      token: icare.token,
      method: "DELETE",
    })).response.status, 409);
    const root = await request("/categories", {
      token: icare.token,
      body: { slug: "cycle-root", name: { en: "Cycle Root", ar: "" } },
    });
    const child = await request("/categories", {
      token: icare.token,
      body: { slug: "cycle-child", name: { en: "Cycle Child", ar: "" }, parentId: root.body.id },
    });
    assert.equal(root.response.status, 201);
    assert.equal(child.response.status, 201);
    assert.equal((await request(`/categories/${root.body.id}`, {
      token: icare.token,
      body: { parentId: child.body.id },
      method: "PATCH",
    })).response.status, 400);
    const status = await request(`/categories/${createdCategory.id}/status`, {
      token: icare.token,
      body: { isActive: false },
      method: "PATCH",
    });
    assert.equal(status.response.status, 200);
    assert.equal(status.body.isActive, false);
    const overridden = await request("/categories?companyId=eb-chemical", {
      token: icare.token,
      headers: { "X-Company-Id": "eb-chemical" },
      body: {
        companyId: "eb-chemical",
        slug: "override-category",
        name: { en: "Override Attempt", ar: "" },
      },
    });
    assert.equal(overridden.response.status, 201);
    overrideCategory = overridden.body;
    assert.equal((await request(`/categories/${overrideCategory.id}`, { token: eb.token })).response.status, 404);
  });

  let createdBrand;
  await t.test("brand CRUD is authorized and tenant-isolated", async () => {
    const created = await request("/brands", {
      token: icare.token,
      body: { slug: "shared-brand", name: "iCare Brand" },
    });
    assert.equal(created.response.status, 201);
    createdBrand = created.body;
    assert.equal((await request(`/brands/${createdBrand.id}`, { token: icare.token })).response.status, 200);
    assert.equal((await request(`/brands/${createdBrand.id}`, { token: eb.token })).response.status, 404);
    assert.equal((await request("/brands/eb-brand", { token: icare.token })).response.status, 404);
    assert.equal((await request("/brands/eb-brand", {
      token: icare.token,
      body: { name: "Changed" },
      method: "PATCH",
    })).response.status, 404);
    assert.equal((await request("/brands/eb-brand", {
      token: icare.token,
      method: "DELETE",
    })).response.status, 404);
    assert.equal((await request(`/brands/${createdBrand.id}`, {
      token: eb.token,
      body: { name: "Changed" },
      method: "PATCH",
    })).response.status, 404);
    assert.equal((await request(`/brands/${createdBrand.id}`, {
      token: eb.token,
      method: "DELETE",
    })).response.status, 404);
    assert.equal((await request("/brands", {
      token: customer.token,
      body: { slug: "customer-brand", name: "Denied" },
    })).response.status, 403);
    const status = await request(`/brands/${createdBrand.id}/status`, {
      token: icare.token,
      body: { isActive: false },
      method: "PATCH",
    });
    assert.equal(status.response.status, 200);
    assert.equal(status.body.isActive, false);
  });

  await t.test("brand uniqueness, references, and overrides are tenant-safe", async () => {
    assert.equal((await request("/brands", {
      token: icare.token,
      body: { slug: "shared-brand", name: "Duplicate" },
    })).response.status, 409);
    assert.equal((await request("/brands", {
      token: eb.token,
      body: { slug: "shared-brand", name: "Allowed in EB" },
    })).response.status, 201);
    assert.equal((await request("/brands/icare-referenced-brand", {
      token: icare.token,
      method: "DELETE",
    })).response.status, 409);
    const overridden = await request("/brands?companyId=eb-chemical", {
      token: icare.token,
      headers: { "X-Company-Id": "eb-chemical" },
      body: { companyId: "eb-chemical", slug: "override-brand", name: "Override Attempt" },
    });
    assert.equal(overridden.response.status, 201);
    assert.equal((await request(`/brands/${overridden.body.id}`, { token: eb.token })).response.status, 404);
  });

  await t.test("iCare settings and context expose only safe active-company branding", async () => {
    const initial = await request("/company/settings", { token: icare.token });
    assert.equal(initial.response.status, 200);
    assert.equal(initial.body.name, "iCare");
    assert.equal(initial.body.language, "ar");
    assert.equal(initial.body.logoUrl, null);
    assert.equal(JSON.stringify(initial.body).includes("EB Chemical"), false);

    const updated = await request("/company/settings?companyId=eb-chemical", {
      token: icare.token,
      headers: { "X-Company-Id": "eb-chemical" },
      body: {
        companyId: "eb-chemical",
        name: "iCare Updated",
        logoUrl: "/uploads/icare-logo.png",
        language: "ar",
        locale: "ar-PS",
        direction: "rtl",
        currency: "ILS",
        supportEmail: "support@icare.test",
        theme: { primary: "#123456", accent: "#abc" },
      },
      method: "PATCH",
    });
    assert.equal(updated.response.status, 200);
    assert.equal(updated.body.name, "iCare Updated");
    assert.equal(updated.body.theme.primary, "#123456");

    const context = await request("/company/context", { token: icare.token });
    assert.equal(context.response.status, 200);
    assert.equal(context.body.id, "icare");
    assert.equal(context.body.slug, "icare");
    assert.equal(context.body.domain, null);
    assert.equal(context.body.settings.logoUrl, "/uploads/icare-logo.png");
    assert.equal(context.body.settings.theme.secondary, null);
    assert.equal(JSON.stringify(context.body).includes("EB Chemical"), false);

    const ebSettings = await request("/company/settings", { token: eb.token });
    assert.equal(ebSettings.response.status, 200);
    assert.equal(ebSettings.body.name, "EB Chemical");
    assert.equal(ebSettings.body.logoUrl, "/eb-logo.png");
  });

  await t.test("settings reject forbidden, unknown, and unsafe fields", async () => {
    for (const body of [
      { slug: "changed" },
      { secret: "nope" },
      { adminModules: { products: true } },
      { direction: "sideways" },
      { currency: "ils" },
      { theme: { primary: "url(javascript:alert(1))" } },
    ]) {
      const result = await request("/company/settings", {
        token: icare.token,
        body,
        method: "PATCH",
      });
      assert.equal(result.response.status, 400);
    }
  });

  await t.test("strict catalog PATCH validation rejects coercion and unsafe keys", async () => {
    assert.equal((await request(`/categories/${createdCategory.id}`, {
      token: icare.token, body: {}, method: "PATCH",
    })).response.status, 400);
    assert.equal((await request(`/brands/${createdBrand.id}`, {
      token: icare.token, body: {}, method: "PATCH",
    })).response.status, 400);

    for (const sortOrder of ["", " ", true, false, [], {}, null, 1.5, "1.5", "+2", "01"]) {
      const result = await request(`/categories/${createdCategory.id}`, {
        token: icare.token, body: { sortOrder }, method: "PATCH",
      });
      assert.equal(result.response.status, 400, `sortOrder ${JSON.stringify(sortOrder)} must fail`);
    }
    for (const sortOrder of [0, -2, 15, "0", "-2", "15"]) {
      const result = await request(`/categories/${createdCategory.id}`, {
        token: icare.token, body: { sortOrder }, method: "PATCH",
      });
      assert.equal(result.response.status, 200, `sortOrder ${JSON.stringify(sortOrder)} must pass`);
    }
    for (const unsafeBody of [
      JSON.parse('{"__proto__":{"polluted":true}}'),
      { prototype: "unsafe" },
      { constructor: "unsafe" },
    ]) {
      assert.equal((await request(`/categories/${createdCategory.id}`, {
        token: icare.token, body: unsafeBody, method: "PATCH",
      })).response.status, 400);
    }
  });

  await t.test("theme colors accept only 3, 4, 6, or 8 hex digits", async () => {
    for (const color of ["#abc", "#abcd", "#112233", "#11223344"]) {
      assert.equal((await request("/company/settings", {
        token: icare.token, body: { theme: { primary: color } }, method: "PATCH",
      })).response.status, 200);
    }
    for (const color of ["#12", "#12345", "#1234567", "#123456789", "rgb(0,0,0)"]) {
      assert.equal((await request("/company/settings", {
        token: icare.token, body: { theme: { primary: color } }, method: "PATCH",
      })).response.status, 400);
    }
  });

  await t.test("normalized product references are optional, tenant-safe, and authoritative", async () => {
    const accepted = await request("/products", {
      token: icare.token,
      body: {
        id: "icare-normalized-product",
        slug: "icare-normalized-product",
        name: { en: "Normalized", ar: "" },
        categoryId: "icare-referenced-category",
        brandId: "icare-referenced-brand",
        category: "Legacy category disagreement",
        brand: "Legacy brand disagreement",
      },
    });
    assert.equal(accepted.response.status, 201);
    assert.equal(accepted.body.categoryId, "icare-referenced-category");
    assert.equal(accepted.body.brandId, "icare-referenced-brand");
    assert.equal(accepted.body.category, "Legacy category disagreement");
    assert.equal(accepted.body.brand, "Legacy brand disagreement");

    const updated = await request("/products/icare-normalized-product", {
      token: icare.token,
      method: "PUT",
      body: { categoryId: "icare-referenced-category", brandId: "icare-referenced-brand" },
    });
    assert.equal(updated.response.status, 200);
    assert.equal(updated.body.categoryId, "icare-referenced-category");
    assert.equal(updated.body.brandId, "icare-referenced-brand");
    assert.equal((await request("/products/icare-normalized-product", {
      token: icare.token, method: "PUT", body: { categoryId: "eb-category" },
    })).response.status, 404);

    assert.equal((await request("/products", {
      token: icare.token,
      body: { id: "bad-category", slug: "bad-category", categoryId: "eb-category" },
    })).response.status, 404);
    assert.equal((await request("/products", {
      token: icare.token,
      body: { id: "bad-brand", slug: "bad-brand", brandId: "eb-brand" },
    })).response.status, 404);
    assert.equal((await request("/products", {
      token: icare.token,
      body: { id: "inactive-category", slug: "inactive-category", categoryId: createdCategory.id },
    })).response.status, 400);
    assert.equal((await request("/products", {
      token: icare.token,
      body: { id: "inactive-brand", slug: "inactive-brand", brandId: createdBrand.id },
    })).response.status, 400);
    const legacy = await request("/products", {
      token: icare.token,
      body: { id: "legacy-only", slug: "legacy-only", category: "Legacy", brand: "Legacy" },
    });
    assert.equal(legacy.response.status, 201);

    for (const body of [
      { id: "snake-category", slug: "snake-category", category_id: "eb-category" },
      { id: "snake-brand", slug: "snake-brand", brand_id: "eb-brand" },
      {
        id: "mixed-reference",
        slug: "mixed-reference",
        categoryId: "icare-referenced-category",
        category_id: "eb-category",
      },
    ]) {
      assert.equal((await request("/products", { token: icare.token, body })).response.status, 400);
    }
  });

  await t.test("tenant catalog transaction locks company and rolls back callback failures", async () => {
    const statements = [];
    const client = {
      async query(sql) {
        statements.push(sql.trim().toLowerCase());
        if (sql.includes("from public.companies")) return { rows: [{ id: "icare" }] };
        return { rows: [] };
      },
    };
    await assert.rejects(
      runTenantCatalogWriteTransaction(client, "icare", async (callbackClient, companyId) => {
        assert.equal(callbackClient, client);
        assert.equal(companyId, "icare");
        throw new Error("simulated locked mutation failure");
      }),
      /simulated locked mutation failure/,
    );
    assert.equal(statements[0], "begin");
    assert.match(statements[1], /for update/);
    assert.equal(statements.at(-1), "rollback");
    assert.equal(statements.includes("commit"), false);
  });

  await t.test("catalog storage fails closed outside test without PostgreSQL", () => {
    const script = 'import("./src/data/store.js")';
    for (const nodeEnv of ["production", ""]) {
      const result = spawnSync(process.execPath, ["--input-type=module", "--eval", script], {
        cwd: path.resolve(testDir, ".."),
        encoding: "utf8",
        env: {
          ...process.env,
          NODE_ENV: nodeEnv,
          DATABASE_URL: "",
          POSTGRES_URL: "",
          ALLOW_LOCAL_CATALOG_STORAGE: "",
        },
      });
      assert.notEqual(result.status, 0);
      assert.match(`${result.stderr}${result.stdout}`, /PostgreSQL catalog storage is required/);
    }
    assert.equal(process.env.NODE_ENV, "test");
  });

  await t.test("company branding transaction rolls back both writes on failure", async () => {
    const statements = [];
    const client = {
      async query(sql) {
        statements.push(sql.trim().toLowerCase());
        if (sql.includes("from public.companies")) return { rows: [{ id: "icare", name: "iCare" }] };
        if (sql.includes("from public.company_settings")) return { rows: [{ settings: { currency: "ILS" } }] };
        if (sql.includes("insert into public.company_settings")) throw new Error("simulated settings failure");
        return { rows: [] };
      },
    };
    await assert.rejects(
      runCompanyBrandingSettingsTransaction(client, "icare", {
        name: "Changed", settingsPatch: { language: "ar" },
      }),
      /simulated settings failure/,
    );
    assert.equal(statements[0], "begin");
    assert.equal(statements.at(-1), "rollback");
    assert.equal(statements.includes("commit"), false);
  });

  await t.test("database conflicts are mapped by constraint without leaking details", () => {
    function capture(error, context) {
      const result = { statusCode: 0, payload: null };
      const response = {
        status(code) { result.statusCode = code; return this; },
        json(payload) { result.payload = payload; return result; },
      };
      return sendCatalogError(response, error, context);
    }
    assert.match(capture({ code: "23505", constraint: "company_categories_company_id_slug_key" }).payload.message, /Category slug/);
    assert.match(capture({ code: "23505", constraint: "company_brands_company_id_slug_key" }).payload.message, /Brand slug/);
    assert.equal(capture({ code: "23505", constraint: "unexpected_unique" }).payload.message, "Database conflict.");
    assert.match(capture({ code: "23503", constraint: "fk_products_company_category" }, { operation: "delete" }).payload.message, /referenced by products/);
    assert.equal(capture({ code: "23503", constraint: "fk_company_categories_parent" }, { operation: "update" }).statusCode, 400);
  });

  await t.test("revoked membership and platform-only Super Admin cannot use tenant settings", async () => {
    const revoked = await login("revoked@icare.test");
    await companyMembershipRepository.disableMembership("icare", "revoked-admin");
    assert.equal((await request("/company/settings", { token: revoked.token })).response.status, 401);
    assert.equal((await request("/company/context", { token: "invalid-token" })).response.status, 401);
    assert.equal((await request("/company/settings", { token: superAdmin.token })).response.status, 403);
  });

  await t.test("migration statically contains normalized tenant-safe schema", () => {
    const sql = fs.readFileSync(
      path.resolve(testDir, "../supabase/migrations/009_tenant_catalog_entities.sql"),
      "utf8",
    );
    for (const required of [
      "create table public.company_categories",
      "create table public.company_brands",
      "incompatible schema",
      "company_categories_pkey",
      "company_brands_pkey",
      "company_categories_name_check",
      "company_categories_description_check",
      "not c.condeferrable",
      "foreign key (company_id, parent_id)",
      "fk_products_company_category",
      "fk_products_company_brand",
      "unique (company_id, slug)",
      "idx_company_categories_active_sort",
      "idx_company_brands_active_sort",
      "idx_products_company_category",
      "idx_products_company_brand",
      "on delete restrict not valid",
      "RLS is intentionally deferred",
      "pg_am",
      "indoption",
      "opcdefault",
      "with ordinality",
    ]) {
      assert.equal(sql.includes(required), true, `Missing migration fragment: ${required}`);
    }
    assert.equal(sql.includes("enable row level security"), false);
    assert.equal(sql.includes("idx_company_categories_slug"), false);
    assert.equal(sql.includes("idx_company_brands_slug"), false);
    assert.equal(/validate\s+constraint/i.test(sql), false);
    assert.equal(/update\s+public\.products/i.test(sql), false);

    const postgresStore = fs.readFileSync(
      path.resolve(testDir, "../src/data/postgresStore.js"),
      "utf8",
    );
    for (const required of [
      "where company_id = $1 and id = $2",
      "insert into public.company_categories",
      "insert into public.company_brands",
      "delete from public.company_categories where company_id = $1 and id = $2",
      "delete from public.company_brands where company_id = $1 and id = $2",
      "where company_id = $1",
      "category_id = $2",
      "brand_id = $2",
      "withTenantCatalogWriteLock(companyId",
      "createCategoryWithTenantLockInSupabase",
      "updateCategoryWithTenantLockInSupabase",
      "deleteCategoryWithTenantLockInSupabase",
      "deleteBrandWithTenantLockInSupabase",
      "saveProductWithTenantCatalogLockInSupabase",
      "with recursive ancestry",
      "parent.company_id = $1",
    ]) {
      assert.equal(postgresStore.includes(required), true, `Missing tenant SQL fragment: ${required}`);
    }
    assert.equal(postgresStore.includes("saveCompanyCatalogToSupabase"), false);
    assert.equal(postgresStore.includes('deleteMissingCompanyRows("company_categories"'), false);
    assert.equal(postgresStore.includes('deleteMissingCompanyRows("company_brands"'), false);
    assert.equal(postgresStore.includes("const includeProducts = options.includeProducts === true"), true);
    const productRoutes = fs.readFileSync(path.resolve(testDir, "../src/routes/products.js"), "utf8");
    assert.equal(productRoutes.includes("persistCompanyStore"), false);
    assert.equal(productRoutes.includes("category_id and brand_id are not accepted"), true);
  });
});

test.after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  fs.rmSync(dataStoreDir, { recursive: true, force: true });
});
