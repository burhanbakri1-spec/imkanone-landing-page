import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { hashPassword } from "../src/auth/passwords.js";

const dataStoreDir = fs.mkdtempSync(path.join(os.tmpdir(), "igroup-reviews-"));
const now = "2026-08-06T00:00:00.000Z";
const password = "Reviews-test-2026!";
const passwordHash = await hashPassword(password);
const userRows = [
  ["icare-admin", "admin@icare.test", "company_admin", []],
  ["icare-viewer", "viewer@icare.test", "employee", ["reviews.view"]],
  ["icare-manager", "manager@icare.test", "employee", ["reviews.manage"]],
  ["other-admin", "admin@other.test", "company_admin", []],
].map(([id, email, role, permissions]) => ({
  id, name: id, email, phone: "", password: passwordHash, role, permissions, isActive: true, createdAt: now, updatedAt: now,
}));
const membershipRows = [
  ["icare", "icare-admin", "company_admin", []],
  ["icare", "icare-viewer", "employee", ["reviews.view"]],
  ["icare", "icare-manager", "employee", ["reviews.manage"]],
  ["other-company", "other-admin", "company_admin", []],
].map(([companyId, userId, role, permissions]) => ({
  id: `${companyId}:${userId}`, companyId, userId, role, status: "active", permissions, createdAt: now, updatedAt: now,
}));

fs.writeFileSync(path.join(dataStoreDir, "store.json"), `${JSON.stringify({
  version: 2,
  companies: [
    { id: "icare", slug: "icare", name: "iCare", status: "active" },
    { id: "other-company", slug: "other-company", name: "Other", status: "active" },
  ],
  users: userRows,
  memberships: membershipRows,
  reviews: [],
  orders: [],
}, null, 2)}\n`, "utf8");

process.env.DATA_STORE_DIR = dataStoreDir;
process.env.DATABASE_URL = "";
process.env.POSTGRES_URL = "";
process.env.SUPABASE_URL = "";
process.env.SUPABASE_SERVICE_ROLE_KEY = "";
process.env.JWT_SECRET = "focused-reviews-test-secret";
process.env.NODE_ENV = "test";
process.env.ALLOW_LOCAL_CATALOG_STORAGE = "true";
process.env.UPLOADS_DIR = path.join(dataStoreDir, "uploads");
fs.mkdirSync(process.env.UPLOADS_DIR, { recursive: true });

const { app } = await import("../src/server.js");
const { inMemoryModuleStore } = await import("../src/moduleRegistry.js");
inMemoryModuleStore.set("icare", [{
  module_key: "operations.reviews",
  enabled: true,
  active: true,
  allowed_roles: ["super_admin", "company_admin", "admin", "manager", "employee", "staff"],
  required_permissions: ["reviews.view", "reviews.manage"],
  sort_order: 330,
}]);
inMemoryModuleStore.set("other-company", [{
  module_key: "operations.reviews",
  enabled: true,
  active: true,
  allowed_roles: ["super_admin", "company_admin", "admin", "manager", "employee", "staff"],
  required_permissions: ["reviews.view", "reviews.manage"],
  sort_order: 330,
}]);

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
  const text = await response.text();
  let parsed = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text || null; }
  return { response, body: parsed };
}

async function login(email) {
  const result = await request("/auth/login", { body: { email, password } });
  assert.equal(result.response.status, 200);
  return result.body.token;
}

test.after(() => {
  server.close();
  fs.rmSync(dataStoreDir, { recursive: true, force: true });
});

test("reviews admin API", async (t) => {
  const adminToken = await login("admin@icare.test");
  const viewerToken = await login("viewer@icare.test");
  const managerToken = await login("manager@icare.test");
  const otherToken = await login("admin@other.test");

  await t.test("unauthenticated /all is rejected", async () => {
    assert.equal((await request("/reviews/all")).response.status, 401);
  });

  await t.test("viewer can list but cannot moderate", async () => {
    const list = await request("/reviews/all", { token: viewerToken });
    assert.equal(list.response.status, 200);
    assert.deepEqual(list.body, []);
  });

  let reviewId;
  await t.test("manager can create and list tenant reviews", async () => {
    const create = await request("/reviews", {
      token: managerToken,
      body: {
        type: "website",
        rating: 4,
        customerName: "Jane Doe",
        comment: { en: "Clean floors", ar: "أرضيات نظيفة" },
        status: "pending",
      },
    });
    assert.equal(create.response.status, 201);
    reviewId = create.body.id;
    const list = await request("/reviews/all", { token: adminToken });
    assert.equal(list.response.status, 200);
    assert.equal(list.body.length, 1);
    assert.equal(list.body[0].customerName, "Jane Doe");
  });

  await t.test("tenant isolation hides reviews from other companies", async () => {
    const otherList = await request("/reviews/all", { token: otherToken });
    assert.equal(otherList.response.status, 200);
    assert.equal(otherList.body.length, 0);
  });

  await t.test("manager can approve and reject via status endpoint", async () => {
    const approved = await request(`/reviews/${reviewId}/status`, {
      token: managerToken,
      method: "PUT",
      body: { status: "approved", isActive: true },
    });
    assert.equal(approved.response.status, 200);
    assert.equal(approved.body.status, "approved");
    const rejected = await request(`/reviews/${reviewId}/status`, {
      token: managerToken,
      method: "PUT",
      body: { status: "rejected" },
    });
    assert.equal(rejected.response.status, 200);
    assert.equal(rejected.body.status, "rejected");
    assert.equal(rejected.body.isActive, false);
  });

  await t.test("viewer cannot update or delete reviews", async () => {
    const patch = await request(`/reviews/${reviewId}/status`, {
      token: viewerToken,
      method: "PUT",
      body: { status: "approved" },
    });
    assert.equal(patch.response.status, 403);
    const removed = await request(`/reviews/${reviewId}`, { token: viewerToken, method: "DELETE" });
    assert.equal(removed.response.status, 403);
  });

  await t.test("manager can delete a review", async () => {
    const removed = await request(`/reviews/${reviewId}`, { token: managerToken, method: "DELETE" });
    assert.equal(removed.response.status, 204);
    const list = await request("/reviews/all", { token: adminToken });
    assert.equal(list.body.length, 0);
  });
});
