import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { hashPassword } from "../src/auth/passwords.js";

const dataStoreDir = fs.mkdtempSync(path.join(os.tmpdir(), "eb-auth-membership-"));
const now = "2026-07-13T00:00:00.000Z";
const password = "Test-password-123!";
const passwordHash = await hashPassword(password);
const companies = [
  { id: "eb-chemical", slug: "eb-chemical", name: "EB Chemical", status: "active", isDefault: true },
  {
    id: "icare", slug: "icare", name: "iCare", status: "active", isDefault: false,
    storefrontUrl: "https://igroup.website/icare", storefrontPath: "/icare",
  },
  { id: "other-company", slug: "other-company", name: "Other Company", status: "active", isDefault: false },
];
const users = [
  ["icare-user", "admin@icare.com", "company_admin", "icare"],
  ["eb-user", "admin@eb.test", "admin", "eb-chemical"],
  ["no-membership-user", "none@test.local", "company_admin", "no-company"],
  ["inactive-user", "inactive@test.local", "company_admin", "icare"],
  ["multi-user", "multi@test.local", "company_admin", "icare"],
  ["revoked-user", "revoked@test.local", "company_admin", "icare"],
  ["version-user", "version@test.local", "company_admin", "icare"],
  ["icare-customer", "customer@icare.test", "customer", "icare"],
  ["icare-employee", "employee@icare.test", "employee", "icare"],
  ["eb-employee", "employee@eb.test", "employee", "eb-chemical"],
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
  ["icare:icare-user", "icare", "icare-user", "company_admin", "active"],
  ["eb-chemical:eb-user", "eb-chemical", "eb-user", "company_admin", "active"],
  ["icare:inactive-user", "icare", "inactive-user", "company_admin", "inactive"],
  ["icare:multi-user", "icare", "multi-user", "company_admin", "active"],
  ["eb-chemical:multi-user", "eb-chemical", "multi-user", "company_admin", "active"],
  ["icare:revoked-user", "icare", "revoked-user", "company_admin", "active"],
  ["icare:version-user", "icare", "version-user", "company_admin", "active"],
  ["icare:icare-customer", "icare", "icare-customer", "customer", "active"],
  ["icare:icare-employee", "icare", "icare-employee", "employee", "active"],
  ["eb-chemical:eb-employee", "eb-chemical", "eb-employee", "employee", "active"],
].map(([id, companyId, userId, role, status]) => ({
  id,
  companyId,
  userId,
  role,
  status,
  permissions: [],
  createdAt: now,
  updatedAt: now,
}));

fs.writeFileSync(path.join(dataStoreDir, "store.json"), JSON.stringify({
  version: 2,
  companies,
  users,
  memberships,
  products: [
    { id: "eb-product", slug: "eb-product", name: "EB Product", company_id: "eb-chemical" },
    { id: "icare-product-1", slug: "icare-product-1", name: "iCare Product 1", company_id: "icare" },
    { id: "icare-product-2", slug: "icare-product-2", name: "iCare Product 2", company_id: "icare" },
  ],
  websiteMedia: [
    { id: "eb-media", sectionKey: "tenant-proof", imageUrl: "/eb.jpg", isActive: true, company_id: "eb-chemical" },
    { id: "icare-media", sectionKey: "tenant-proof", imageUrl: "/icare.jpg", isActive: true, company_id: "icare" },
  ],
  websiteTexts: [
    { id: "eb-text", key: "tenant.proof", valueEn: "EB", isActive: true, company_id: "eb-chemical" },
    { id: "icare-text", key: "tenant.proof", valueEn: "iCare", isActive: true, company_id: "icare" },
  ],
  orders: [
    { id: "icare-order-assign", company_id: "icare", status: "Pending", customer: {} },
    { id: "icare-order-delete", company_id: "icare", status: "Pending", customer: {} },
    { id: "icare-order-customer-guard", company_id: "icare", status: "Pending", customer: {} },
    { id: "eb-order-assign", company_id: "eb-chemical", status: "Pending", customer: {} },
    { id: "eb-order-delete", company_id: "eb-chemical", status: "Pending", customer: {} },
  ],
  workSessions: [
    {
      id: "icare-session",
      company_id: "icare",
      employeeId: "icare-employee",
      date: "2026-07-13",
      loginTime: now,
    },
    {
      id: "eb-session",
      company_id: "eb-chemical",
      employeeId: "eb-employee",
      date: "2026-07-13",
      loginTime: now,
    },
  ],
}, null, 2));

process.env.DATA_STORE_DIR = dataStoreDir;
process.env.DATABASE_URL = "";
process.env.POSTGRES_URL = "";
process.env.SUPABASE_URL = "";
process.env.SUPABASE_SERVICE_ROLE_KEY = "";
process.env.JWT_SECRET = "focused-auth-test-secret";
process.env.NODE_ENV = "test";

const { app } = await import("../src/server.js");
const {
  companyMembershipRepository,
  platformUserRepository,
} = await import("../src/data/store.js");
const { signToken } = await import("../src/middleware/auth.js");
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
  return request("/auth/login", {
    body: { email, password },
  });
}

function tokenPayload(token) {
  return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
}

test("membership-aware authentication and authenticated tenant context", async (t) => {
  let icareSession;
  let multiSelection;

  await t.test("iCare user with one active membership is tenant-bound", async () => {
    const result = await login("admin@icare.com");
    assert.equal(result.response.status, 200);
    assert.equal(result.body.activeCompany.id, "icare");
    assert.equal(result.body.activeMembership.companyId, "icare");
    assert.equal(result.body.user.role, "company_admin");
    const payload = tokenPayload(result.body.token);
    assert.equal(payload.tokenType, "access");
    assert.equal(payload.id, "icare-user");
    assert.equal(payload.role, "company_admin");
    assert.equal(payload.companyId, "icare");
    assert.equal(payload.membershipId, "icare:icare-user");
    assert.equal(payload.membershipRole, "company_admin");
    assert.equal(payload.membershipVersion, now);
    icareSession = result.body;
  });

  await t.test("GET /auth/me confirms iCare and returns safe bootstrap data", async () => {
    const result = await request("/auth/me", { token: icareSession.token });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.user.id, "icare-user");
    assert.equal(result.body.activeCompany.id, "icare");
    assert.equal(result.body.activeMembership.companyId, "icare");
    assert.deepEqual(result.body.availableCompanies.map((company) => company.id), ["icare"]);
    assert.equal("password" in result.body.user, false);
  });

  await t.test("authenticated and public product reads use the correct tenant context", async () => {
    const authenticated = await request("/products", { token: icareSession.token });
    assert.equal(authenticated.response.status, 200);
    assert.deepEqual(
      authenticated.body.map((product) => product.id).sort(),
      ["icare-product-1", "icare-product-2"],
    );

    const publicResult = await request("/products");
    assert.equal(publicResult.response.status, 200);
    assert.deepEqual(publicResult.body.map((product) => product.id), ["eb-product"]);

    const publicIcare = await request("/products", {
      headers: { "X-Company-Id": "icare" },
    });
    assert.equal(publicIcare.response.status, 200);
    assert.deepEqual(
      publicIcare.body.map((product) => product.id).sort(),
      ["icare-product-1", "icare-product-2"],
    );

    const unknown = await request("/products", {
      headers: { "X-Company-Id": "unknown-company" },
    });
    assert.equal(unknown.response.status, 404);

    const activeWithoutStorefront = await request("/products", {
      headers: { "X-Company-Id": "other-company" },
    });
    assert.equal(activeWithoutStorefront.response.status, 404);

    const unresolvedSharedHost = await request("/products", {
      headers: { "X-Forwarded-Host": "igroup.website" },
    });
    assert.equal(unresolvedSharedHost.response.status, 404);

    const icareMedia = await request("/website-media", {
      headers: { "X-Company-Id": "icare" },
    });
    assert.equal(icareMedia.response.status, 200);
    assert.equal(icareMedia.body.some((item) => item.id === "icare-media"), true);
    assert.equal(icareMedia.body.some((item) => item.id === "eb-media"), false);

    const icareTexts = await request("/website-texts", {
      headers: { "X-Company-Id": "icare" },
    });
    assert.equal(icareTexts.response.status, 200);
    assert.deepEqual(icareTexts.body.map((item) => item.id), ["icare-text"]);
  });

  await t.test("storefront context selects the matching membership during login", async () => {
    const result = await request("/auth/login", {
      headers: { "X-Company-Id": "icare" },
      body: { email: "multi@test.local", password },
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.companySelectionRequired, undefined);
    assert.equal(result.body.activeCompany.id, "icare");
    assert.equal(result.body.activeMembership.companyId, "icare");
  });

  await t.test("invalid bearer token on a public read is rejected", async () => {
    const result = await request("/products", { token: "invalid-token" });
    assert.equal(result.response.status, 401);
    assert.equal(result.body.message, "Invalid or expired authentication token.");
  });

  await t.test("storefront header constrains auth while query and body cannot override membership", async () => {
    const productsResult = await request("/products?companyId=eb-chemical", {
      token: icareSession.token,
      headers: { "X-Company-Id": "eb-chemical" },
    });
    assert.equal(productsResult.response.status, 401);

    const matchingHeader = await request("/products?companyId=eb-chemical", {
      token: icareSession.token,
      headers: { "X-Company-Id": "icare" },
    });
    assert.equal(matchingHeader.response.status, 200);
    assert.deepEqual(matchingHeader.body.map((product) => product.id).sort(), [
      "icare-product-1", "icare-product-2",
    ]);

    const reviewResult = await request("/reviews", {
      token: icareSession.token,
      body: {
        companyId: "eb-chemical",
        type: "website",
        rating: 5,
        comment: "Tenant override regression test",
      },
    });
    assert.equal(reviewResult.response.status, 201);
    assert.equal("companyId" in reviewResult.body, false);
  });

  await t.test("iCare company_admin reads only iCare orders, employees, work sessions, and media", async () => {
    const ordersResult = await request("/orders", { token: icareSession.token });
    assert.equal(ordersResult.response.status, 200);
    assert.equal(ordersResult.body.length, 3);
    assert.equal(ordersResult.body.every((order) => order.id.startsWith("icare-")), true);

    const employeesResult = await request("/employees", { token: icareSession.token });
    assert.equal(employeesResult.response.status, 200);
    assert.deepEqual(employeesResult.body.map((employee) => employee.id), ["icare-employee"]);
    assert.equal(employeesResult.body.some((employee) => employee.id === "eb-employee"), false);

    const sessionsResult = await request("/work-sessions/employees", {
      token: icareSession.token,
    });
    assert.equal(sessionsResult.response.status, 200);
    assert.deepEqual(sessionsResult.body.map((session) => session.id), ["icare-session"]);

    const mediaResult = await request("/website-media/all", { token: icareSession.token });
    assert.equal(mediaResult.response.status, 200);
    assert.deepEqual(mediaResult.body.items.map((item) => item.id), ["icare-media"]);
    assert.equal(mediaResult.body.items.some((item) => item.id === "eb-media"), false);
  });

  await t.test("customers and employees remain restricted from tenant administration reads", async () => {
    const customerSession = await login("customer@icare.test");
    const employeeSession = await login("employee@icare.test");
    assert.equal(customerSession.response.status, 200);
    assert.equal(employeeSession.response.status, 200);

    for (const token of [customerSession.body.token, employeeSession.body.token]) {
      const ordersResult = await request("/orders", { token });
      assert.equal(ordersResult.response.status, 403);

      const employeesResult = await request("/employees", { token });
      assert.equal(employeesResult.response.status, 403);

      const sessionsResult = await request("/work-sessions/employees", { token });
      assert.equal(sessionsResult.response.status, 403);
    }

    const customerOwnSessions = await request("/work-sessions/employees/icare-customer", {
      token: customerSession.body.token,
    });
    assert.equal(customerOwnSessions.response.status, 403);

    const employeeOtherSessions = await request("/work-sessions/employees/eb-employee", {
      token: employeeSession.body.token,
    });
    assert.equal(employeeOtherSessions.response.status, 403);

    const employeeOwnSessions = await request("/work-sessions/employees/icare-employee", {
      token: employeeSession.body.token,
    });
    assert.equal(employeeOwnSessions.response.status, 200);
    assert.equal(employeeOwnSessions.body.length >= 1, true);
    assert.equal(
      employeeOwnSessions.body.every((session) => session.employeeId === "icare-employee"),
      true,
    );
    assert.equal(employeeOwnSessions.body.some((session) => session.id === "eb-session"), false);
  });

  await t.test("iCare company_admin can assign only an iCare employee to an iCare order", async () => {
    const result = await request("/orders/icare-order-assign/assign-employee?companyId=eb-chemical", {
      token: icareSession.token,
      headers: { "X-Company-Id": "icare" },
      body: { employeeId: "icare-employee", companyId: "eb-chemical" },
      method: "PUT",
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.id, "icare-order-assign");
    assert.equal(result.body.assignedToEmployeeId, "icare-employee");
  });

  await t.test("iCare customer cannot assign employees or delete arbitrary orders", async () => {
    const customerSession = await login("customer@icare.test");
    assert.equal(customerSession.response.status, 200);

    const assignResult = await request("/orders/icare-order-assign/assign-employee", {
      token: customerSession.body.token,
      body: { employeeId: "icare-employee" },
      method: "PUT",
    });
    assert.equal(assignResult.response.status, 403);

    const deleteResult = await request("/orders/icare-order-customer-guard", {
      token: customerSession.body.token,
      method: "DELETE",
    });
    assert.equal(deleteResult.response.status, 403);
  });

  await t.test("iCare company_admin cannot assign a cross-company employee or modify an EB order", async () => {
    const employeeResult = await request("/orders/icare-order-assign/assign-employee", {
      token: icareSession.token,
      body: { employeeId: "eb-employee" },
      method: "PUT",
    });
    assert.equal(employeeResult.response.status, 404);

    const orderResult = await request("/orders/eb-order-assign/assign-employee", {
      token: icareSession.token,
      body: { employeeId: "icare-employee" },
      method: "PUT",
    });
    assert.equal(orderResult.response.status, 404);
  });

  await t.test("iCare company_admin can delete an iCare order", async () => {
    const result = await request("/orders/icare-order-delete", {
      token: icareSession.token,
      method: "DELETE",
    });
    assert.equal(result.response.status, 204);
  });

  await t.test("missing token cannot assign employees or delete orders", async () => {
    const assignResult = await request("/orders/icare-order-assign/assign-employee", {
      body: { employeeId: "icare-employee" },
      method: "PUT",
    });
    assert.equal(assignResult.response.status, 401);

    const deleteResult = await request("/orders/icare-order-customer-guard", { method: "DELETE" });
    assert.equal(deleteResult.response.status, 401);
  });

  await t.test("EB Chemical one-membership login remains compatible", async () => {
    const result = await login("admin@eb.test");
    assert.equal(result.response.status, 200);
    assert.equal(result.body.activeCompany.id, "eb-chemical");
    assert.equal(tokenPayload(result.body.token).companyId, "eb-chemical");
    const productsResult = await request("/products", { token: result.body.token });
    assert.equal(productsResult.response.status, 200);
    assert.deepEqual(productsResult.body.map((product) => product.id), ["eb-product"]);

    const assignResult = await request("/orders/eb-order-assign/assign-employee", {
      token: result.body.token,
      body: { employeeId: "eb-employee" },
      method: "PUT",
    });
    assert.equal(assignResult.response.status, 200);
    assert.equal(assignResult.body.assignedToEmployeeId, "eb-employee");

    const deleteResult = await request("/orders/eb-order-delete", {
      token: result.body.token,
      method: "DELETE",
    });
    assert.equal(deleteResult.response.status, 204);
  });

  await t.test("Super Admin platform login does not inherit EB tenant context", async () => {
    const loginResult = await login("super@test.local");
    assert.equal(loginResult.response.status, 200);
    assert.equal(loginResult.body.activeCompany, null);
    assert.equal(tokenPayload(loginResult.body.token).companyId, null);
    const companiesResult = await request("/platform/companies", { token: loginResult.body.token });
    assert.equal(companiesResult.response.status, 200);
    const tenantResult = await request("/home-offers/all", { token: loginResult.body.token });
    assert.equal(tenantResult.response.status, 403);
    const assignResult = await request("/orders/icare-order-assign/assign-employee", {
      token: loginResult.body.token,
      body: { employeeId: "icare-employee" },
      method: "PUT",
    });
    assert.equal(assignResult.response.status, 403);
    const deleteResult = await request("/orders/icare-order-customer-guard", {
      token: loginResult.body.token,
      method: "DELETE",
    });
    assert.equal(deleteResult.response.status, 403);
  });

  await t.test("Super Admin company scope can administer only the selected tenant", async () => {
    const platform = await login("super@test.local");
    const entered = await request("/platform/companies/icare/scope", {
      token: platform.body.token,
      method: "POST",
    });
    assert.equal(entered.response.status, 200);
    assert.equal(entered.body.activeCompany.id, "icare");
    assert.equal(entered.body.user.role, "company_admin");
    assert.equal(entered.body.user.globalRole, "super_admin");
    const payload = tokenPayload(entered.body.token);
    assert.equal(payload.tokenType, "company_scope");
    assert.equal(payload.companyId, "icare");
    assert.equal("membershipId" in payload, false);

    const media = await request("/website-media/all", { token: entered.body.token });
    assert.equal(media.response.status, 200);
    assert.deepEqual(media.body.items.map((item) => item.id), ["icare-media"]);

    const texts = await request("/admin/website-texts", { token: entered.body.token });
    assert.equal(texts.response.status, 200);
    assert.deepEqual(texts.body.map((item) => item.id), ["icare-text"]);

    const products = await request("/products", { token: entered.body.token });
    assert.equal(products.response.status, 200);
    assert.deepEqual(products.body.map((item) => item.id).sort(), ["icare-product-1", "icare-product-2"]);

    const category = await request("/categories", {
      token: entered.body.token,
      body: { slug: "scoped-qa-category", name: { en: "Scoped QA Category", ar: "" }, isActive: true },
    });
    assert.equal(category.response.status, 201);
    const brand = await request("/brands", {
      token: entered.body.token,
      body: { slug: "scoped-qa-brand", name: "Scoped QA Brand", country: "QA", isActive: true },
    });
    assert.equal(brand.response.status, 201);
    const product = await request("/products", {
      token: entered.body.token,
      body: {
        id: "icare-scoped-qa-product",
        slug: "icare-scoped-qa-product",
        name: { en: "Scoped QA Product", ar: "" },
        categoryId: category.body.id,
        brandId: brand.body.id,
      },
    });
    assert.equal(product.response.status, 201);
    assert.equal((await request(`/products/${product.body.id}`, {
      token: entered.body.token,
      method: "PUT",
      body: { name: { en: "Scoped QA Product Updated", ar: "" } },
    })).response.status, 200);
    assert.equal((await request(`/products/${product.body.id}`, {
      token: entered.body.token,
      method: "DELETE",
    })).response.status, 204);
    assert.equal((await request(`/brands/${brand.body.id}`, {
      token: entered.body.token,
      method: "DELETE",
    })).response.status, 204);
    assert.equal((await request(`/categories/${category.body.id}`, {
      token: entered.body.token,
      method: "DELETE",
    })).response.status, 204);

    const changedOrder = await request("/orders/icare-order-assign/status", {
      token: entered.body.token,
      method: "PUT",
      body: { status: "Processing" },
    });
    assert.equal(changedOrder.response.status, 200);
    assert.equal(changedOrder.body.status, "Processing");
    assert.equal((await request("/orders/eb-order-assign/status", {
      token: entered.body.token,
      method: "PUT",
      body: { status: "Processing" },
    })).response.status, 404);

    const ebScope = await request("/platform/companies/eb-chemical/scope", {
      token: platform.body.token,
      method: "POST",
    });
    assert.equal(ebScope.response.status, 200);
    const review = await request("/reviews", {
      token: ebScope.body.token,
      body: { type: "website", customerName: "Scoped QA", status: "pending", isActive: false },
    });
    assert.equal(review.response.status, 201);
    const moderated = await request(`/reviews/${review.body.id}/status`, {
      token: ebScope.body.token,
      method: "PUT",
      body: { status: "approved", isActive: true },
    });
    assert.equal(moderated.response.status, 200);
    assert.equal(moderated.body.status, "approved");
    assert.equal((await request(`/reviews/${review.body.id}`, {
      token: ebScope.body.token,
      method: "DELETE",
    })).response.status, 204);
  });

  await t.test("zero or inactive memberships are rejected", async () => {
    const noMembership = await login("none@test.local");
    assert.equal(noMembership.response.status, 403);
    const inactive = await login("inactive@test.local");
    assert.equal(inactive.response.status, 403);
  });

  await t.test("two memberships require explicit company selection", async () => {
    const result = await login("multi@test.local");
    assert.equal(result.response.status, 200);
    assert.equal(result.body.companySelectionRequired, true);
    assert.equal(typeof result.body.selectionChallenge, "string");
    assert.equal("token" in result.body, false);
    assert.deepEqual(
      result.body.availableCompanies.map((company) => company.id).sort(),
      ["eb-chemical", "icare"],
    );
    multiSelection = result.body;
  });

  await t.test("valid selection issues a tenant token", async () => {
    const result = await request("/auth/select-company", {
      body: { selectionChallenge: multiSelection.selectionChallenge, companyId: "icare" },
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.activeCompany.id, "icare");
    assert.equal(tokenPayload(result.body.token).companyId, "icare");
  });

  await t.test("selection cannot target a company without membership", async () => {
    const result = await request("/auth/select-company", {
      body: {
        selectionChallenge: multiSelection.selectionChallenge,
        companyId: "other-company",
      },
    });
    assert.equal(result.response.status, 403);
  });

  await t.test("token and membership company mismatch is rejected", async () => {
    const user = await platformUserRepository.getUserById("icare-user");
    const membership = await companyMembershipRepository.getMembershipByCompanyAndUser("icare", user.id);
    const mismatched = signToken(user, { ...membership, companyId: "eb-chemical" });
    const result = await request("/auth/me", { token: mismatched });
    assert.equal(result.response.status, 401);
  });

  await t.test("deactivated membership invalidates an issued token", async () => {
    const loginResult = await login("revoked@test.local");
    assert.equal(loginResult.response.status, 200);
    await companyMembershipRepository.disableMembership("icare", "revoked-user");
    const result = await request("/products", { token: loginResult.body.token });
    assert.equal(result.response.status, 401);
  });

  await t.test("membership versions normalize Date and ISO values and detect changes", async () => {
    const user = await platformUserRepository.getUserById("version-user");
    const membership = await companyMembershipRepository.getMembershipByCompanyAndUser("icare", user.id);
    const dateToken = signToken(user, { ...membership, updatedAt: new Date(membership.updatedAt) });
    const stringToken = signToken(user, membership);

    assert.equal(
      tokenPayload(dateToken).membershipVersion,
      tokenPayload(stringToken).membershipVersion,
    );
    assert.equal(tokenPayload(dateToken).membershipVersion, now);

    const equivalentResult = await request("/products", { token: dateToken });
    assert.equal(equivalentResult.response.status, 200);

    await companyMembershipRepository.updateMembership("icare", user.id, {
      role: membership.role,
      status: "active",
    });
    const changedResult = await request("/products", { token: dateToken });
    assert.equal(changedResult.response.status, 401);
  });

  await t.test("company_admin uses iCare context without EB fallback", async () => {
    const result = await request("/admin/summary", { token: icareSession.token });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.products, 2);
  });
});

test("temporary password support for company member creation", async (t) => {
  let superSession;

  await t.test("Super Admin can log in and create a member with temporary password", async () => {
    const loginResult = await request("/auth/login", {
      body: { email: "super@test.local", password },
    });
    assert.equal(loginResult.response.status, 200);
    superSession = loginResult.body;

    const result = await request("/platform/companies/eb-chemical/memberships", {
      token: superSession.token,
      method: "POST",
      body: {
        email: "new-member-with-password@test.local",
        name: "New Member With Password",
        role: "employee",
        status: "active",
        password: "Temp-password-123!",
      },
    });
    assert.equal(result.response.status, 201);
    assert.equal(result.body.email, "new-member-with-password@test.local");
    assert.equal(result.body.role, "employee");
    assert.equal(result.body.status, "active");
  });

  await t.test("the new member can log in with the temporary password", async () => {
    const loginResult = await request("/auth/login", {
      body: { email: "new-member-with-password@test.local", password: "Temp-password-123!" },
    });
    assert.equal(loginResult.response.status, 200);
    assert.equal(loginResult.body.user.email, "new-member-with-password@test.local");
    assert.equal(loginResult.body.activeCompany.id, "eb-chemical");
    assert.equal(loginResult.body.activeMembership.companyId, "eb-chemical");
    assert.equal("password" in loginResult.body.user, false);
  });

  await t.test("adding an existing user ignores the password and does not change it", async () => {
    const result = await request("/platform/companies/icare/memberships", {
      token: superSession.token,
      method: "POST",
      body: {
        email: "new-member-with-password@test.local",
        name: "Renamed Member",
        role: "customer",
        status: "active",
        password: "Different-password-456!",
      },
    });
    assert.equal(result.response.status, 201);
    assert.equal(result.body.email, "new-member-with-password@test.local");
    assert.equal(result.body.role, "customer");

    const loginResult = await request("/auth/login", {
      body: { email: "new-member-with-password@test.local", password: "Temp-password-123!" },
    });
    assert.equal(loginResult.response.status, 200);

    const wrongPassword = await request("/auth/login", {
      body: { email: "new-member-with-password@test.local", password: "Different-password-456!" },
    });
    assert.equal(wrongPassword.response.status, 401);
  });

  await t.test("creating a new member without a password is rejected", async () => {
    const result = await request("/platform/companies/eb-chemical/memberships", {
      token: superSession.token,
      method: "POST",
      body: {
        email: "no-password-member@test.local",
        name: "No Password Member",
        role: "employee",
        status: "active",
      },
    });
    assert.equal(result.response.status, 400);
    assert.match(result.body.message, /password/i);
  });

  await t.test("existing user membership is created without changing password when no password sent", async () => {
    const result = await request("/platform/companies/eb-chemical/memberships", {
      token: superSession.token,
      method: "POST",
      body: {
        email: "admin@eb.test",
        name: "Admin EB",
        role: "employee",
        status: "active",
      },
    });
    assert.equal(result.response.status, 201);
    assert.equal(result.body.email, "admin@eb.test");

    const loginResult = await request("/auth/login", {
      body: { email: "admin@eb.test", password },
    });
    assert.equal(loginResult.response.status, 200);
  });
});

test.after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  fs.rmSync(dataStoreDir, { recursive: true, force: true });
});
