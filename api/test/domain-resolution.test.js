import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { hashPassword } from "../src/auth/passwords.js";

const dataStoreDir = fs.mkdtempSync(path.join(os.tmpdir(), "eb-domain-test-"));
const now = "2026-07-22T00:00:00.000Z";
const password = "Test-password-123!";
const passwordHash = await hashPassword(password);

const companies = [
  { id: "eb-chemical", slug: "eb-chemical", name: "EB Chemical", status: "active", isDefault: true, domain: "ebchemi.com" },
  { id: "idesign", slug: "idesign", name: "I Design", status: "active", isDefault: false, domain: "" },
  { id: "ioutfit", slug: "ioutfit", name: "I Outfit", status: "active", isDefault: false, domain: "" },
  { id: "kids-velvet", slug: "kids-velvet", name: "Kids Velvet", status: "active", isDefault: false, domain: "" },
  { id: "imarketing", slug: "imarketing", name: "I Marketing", status: "active", isDefault: false, domain: "" },
  { id: "disabled-co", slug: "disabled-co", name: "Disabled Co", status: "inactive", isDefault: false, domain: "" },
];

const domains = [
  { id: "domain-eb-vercel", company_id: "eb-chemical", domain: "eb-chemical-full.vercel.app", is_primary: true, is_active: true, is_verified: true, created_at: now, updated_at: now },
  { id: "domain-idesign", company_id: "idesign", domain: "i-design-eta.vercel.app", is_primary: true, is_active: true, is_verified: true, created_at: now, updated_at: now },
  { id: "domain-ioutfit", company_id: "ioutfit", domain: "family-spirit.vercel.app", is_primary: true, is_active: true, is_verified: true, created_at: now, updated_at: now },
  { id: "domain-kids-velvet", company_id: "kids-velvet", domain: "iplay-web.vercel.app", is_primary: true, is_active: true, is_verified: true, created_at: now, updated_at: now },
  { id: "domain-inactive", company_id: "ioutfit", domain: "inactive-test.vercel.app", is_primary: false, is_active: false, is_verified: true, created_at: now, updated_at: now },
  { id: "domain-unverified", company_id: "idesign", domain: "unverified-test.vercel.app", is_primary: false, is_active: true, is_verified: false, created_at: now, updated_at: now },
];

const users = [
  { id: "super-user", name: "Super Admin", email: "super@test.local", password: passwordHash, role: "super_admin", permissions: [], isActive: true, company_id: "", createdAt: now, updatedAt: now },
  { id: "domain-admin", name: "Domain Admin", email: "admin@eb.test", password: passwordHash, role: "admin", permissions: [], isActive: true, company_id: "eb-chemical", createdAt: now, updatedAt: now },
  { id: "idesign-admin", name: "I Design Admin", email: "admin@idesign.test", password: passwordHash, role: "company_admin", permissions: [], isActive: true, company_id: "idesign", createdAt: now, updatedAt: now },
].map((u) => ({ ...u, company_id: u.company_id }));

const memberships = [
  { id: "eb-chemical:domain-admin", companyId: "eb-chemical", userId: "domain-admin", role: "admin", status: "active", permissions: [], createdAt: now, updatedAt: now },
  { id: "idesign:idesign-admin", companyId: "idesign", userId: "idesign-admin", role: "company_admin", status: "active", permissions: [], createdAt: now, updatedAt: now },
];

fs.writeFileSync(path.join(dataStoreDir, "store.json"), JSON.stringify({
  version: 2,
  companies,
  domains,
  users,
  memberships,
  orders: [],
  products: [],
  websiteMedia: [],
  websiteTexts: [],
  workSessions: [],
}, null, 2));

process.env.DATA_STORE_DIR = dataStoreDir;
process.env.DATABASE_URL = "";
process.env.POSTGRES_URL = "";
process.env.SUPABASE_URL = "";
process.env.SUPABASE_SERVICE_ROLE_KEY = "";
process.env.JWT_SECRET = "domain-test-secret";
process.env.NODE_ENV = "test";
const uploadTestDir = path.join(dataStoreDir, "uploads");
fs.mkdirSync(uploadTestDir, { recursive: true });
process.env.UPLOADS_DIR = uploadTestDir;

const { app } = await import("../src/server.js");
const { signToken } = await import("../src/middleware/auth.js");

const server = app.listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
after(() => server.close());
const baseUrl = `http://127.0.0.1:${server.address().port}/api`;

async function api(pathname, { token, body, headers = {}, method = body ? "POST" : "GET" } = {}) {
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

function token(userId, membershipId = null) {
  const user = users.find((u) => u.id === userId);
  if (!user) return "";
  const membership = membershipId ? memberships.find((m) => m.id === membershipId) : null;
  return signToken(user, membership);
}

const superToken = token("super-user");

test("i-design-eta Origin resolves to idesign company", async () => {
  const { response, body } = await api("/company/resolve", {
    headers: { origin: "https://i-design-eta.vercel.app" },
  });
  assert.equal(response.status, 200);
  assert.equal(body.company?.id, "idesign");
});

test("family-spirit Origin resolves to ioutfit company", async () => {
  const { response, body } = await api("/company/resolve", {
    headers: { origin: "https://family-spirit.vercel.app" },
  });
  assert.equal(response.status, 200);
  assert.equal(body.company?.id, "ioutfit");
});

test("iplay-web Origin resolves to kids-velvet company", async () => {
  const { response, body } = await api("/company/resolve", {
    headers: { origin: "https://iplay-web.vercel.app" },
  });
  assert.equal(response.status, 200);
  assert.equal(body.company?.id, "kids-velvet");
});

test("i-design-eta Origin does not see ioutfit or kids-velvet data", async () => {
  const { response, body } = await api("/company/resolve", {
    headers: { origin: "https://i-design-eta.vercel.app" },
  });
  assert.equal(response.status, 200);
  assert.equal(body.company?.id, "idesign");
  assert.notEqual(body.company?.id, "ioutfit");
  assert.notEqual(body.company?.id, "kids-velvet");
});

test("inactive domain is rejected (falls back to null company)", async () => {
  const { response, body } = await api("/company/resolve", {
    headers: { origin: "https://inactive-test.vercel.app" },
  });
  assert.equal(response.status, 200);
  assert.equal(body.company, null);
});

test("unverified domain is rejected (falls back to null company)", async () => {
  const { response, body } = await api("/company/resolve", {
    headers: { origin: "https://unverified-test.vercel.app" },
  });
  assert.equal(response.status, 200);
  assert.equal(body.company, null);
});

test("unknown Origin does not fall back to EB Chemical", async () => {
  const { response, body } = await api("/company/resolve", {
    headers: { origin: "https://unknown-malicious-site.com" },
  });
  assert.equal(response.status, 200);
  assert.equal(body.company, null);
});

test("no Origin header does not fall back to default company", async () => {
  const { response, body } = await api("/company/resolve");
  assert.equal(response.status, 200);
  assert.equal(body.company, null);
});

test("authenticated domain admin retains company from membership", async () => {
  const { response, body } = await api("/company/resolve-auth", {
    token: token("domain-admin", "eb-chemical:domain-admin"),
  });
  assert.equal(response.status, 200);
  assert.equal(body.company?.id, "eb-chemical");
});

test("duplicate domain POST is rejected with 409", async () => {
  const { response, body } = await api("/platform/domains", {
    method: "POST",
    token: superToken,
    body: { company_id: "ioutfit", domain: "i-design-eta.vercel.app", is_verified: true },
  });
  assert.equal(response.status, 409);
  assert.ok(body.message?.toLowerCase().includes("already belongs"));
});

test("non-super-admin cannot manage domains", async () => {
  const idesignToken = token("idesign-admin", "idesign:idesign-admin");
  const { response } = await api("/platform/domains", { token: idesignToken });
  assert.equal(response.status, 403);
});

test("super admin can list all domains", async () => {
  const { response, body } = await api("/platform/domains", { token: superToken });
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(body));
  assert.ok(body.length >= 4);
  const ide = body.find((d) => d.domain === "i-design-eta.vercel.app");
  assert.ok(ide);
  assert.equal(ide.company_id, "idesign");
});

test("super admin can create, update, and delete a domain", async () => {
  const { response: createRes, body: created } = await api("/platform/domains", {
    method: "POST",
    token: superToken,
    body: { company_id: "imarketing", domain: "imarketing-test.vercel.app", is_verified: true, is_active: true },
  });
  assert.equal(createRes.status, 201);
  assert.equal(created.company_id, "imarketing");

  const { response: updateRes, body: updated } = await api(`/platform/domains/${encodeURIComponent(created.id)}`, {
    method: "PATCH",
    token: superToken,
    body: { is_verified: false },
  });
  assert.equal(updateRes.status, 200);
  assert.equal(updated.is_verified, false);

  const { response: delRes } = await api(`/platform/domains/${encodeURIComponent(created.id)}`, {
    method: "DELETE",
    token: superToken,
  });
  assert.equal(delRes.status, 204);
});

test("Platform /api/health responds with ok", async () => {
  const { response, body } = await api("/health");
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
});

test("CPanel authenticated company resolution unchanged for idesign admin", async () => {
  const idesignToken = token("idesign-admin", "idesign:idesign-admin");
  const { response, body } = await api("/company/resolve-auth", { token: idesignToken });
  assert.equal(response.status, 200);
  assert.equal(body.company?.id, "idesign");
});

test("X-Forwarded-Host resolves to correct company when no Origin", async () => {
  const { response, body } = await api("/company/resolve", {
    headers: { "x-forwarded-host": "i-design-eta.vercel.app" },
  });
  assert.equal(response.status, 200);
  assert.equal(body.company?.id, "idesign");
});

test("http Origin is rejected (null company)", async () => {
  const { response, body } = await api("/company/resolve", {
    headers: { origin: "http://i-design-eta.vercel.app" },
  });
  assert.equal(response.status, 200);
  assert.equal(body.company, null);
});

test("X-Company-Id is not trusted for public tenant resolution", async () => {
  const { response, body } = await api("/company/resolve", {
    headers: { "x-company-id": "idesign" },
  });
  assert.equal(response.status, 200);
  assert.equal(body.company, null);
});

test("company_id in body is not trusted for public tenant resolution", async () => {
  const { response, body } = await api("/company/resolve", {
    method: "POST",
    body: { company_id: "idesign" },
  });
  assert.equal(response.status, 200);
  assert.equal(body.company, null);
});

test("companyId in query is not trusted for public tenant resolution", async () => {
  const { response, body } = await api("/company/resolve?companyId=idesign");
  assert.equal(response.status, 200);
  assert.equal(body.company, null);
});

test("setting primary domain clears prior primary for same company", async () => {
  const { response: createRes, body: created } = await api("/platform/domains", {
    method: "POST",
    token: superToken,
    body: { company_id: "idesign", domain: "new-primary-idesign.vercel.app", is_verified: true, is_active: true, is_primary: true },
  });
  assert.equal(createRes.status, 201);
  assert.equal(created.is_primary, true);

  const { body: listAfter } = await api("/platform/domains", { token: superToken });
  const priorPrimary = listAfter.find((d) => d.domain === "i-design-eta.vercel.app");
  assert.equal(priorPrimary.is_primary, false, "prior primary was cleared");

  const { response: delRes } = await api(`/platform/domains/${encodeURIComponent(created.id)}`, {
    method: "DELETE",
    token: superToken,
  });
  assert.equal(delRes.status, 204);
});

test("setting primary via PATCH clears prior primary for same company", async () => {
  const { response: createRes, body: created } = await api("/platform/domains", {
    method: "POST",
    token: superToken,
    body: { company_id: "ioutfit", domain: "alt-ioutfit.vercel.app", is_verified: true, is_active: true },
  });
  assert.equal(createRes.status, 201);

  const { response: patchRes, body: patched } = await api(`/platform/domains/${encodeURIComponent(created.id)}`, {
    method: "PATCH",
    token: superToken,
    body: { is_primary: true },
  });
  assert.equal(patchRes.status, 200);
  assert.equal(patched.is_primary, true);

  const { body: listAfter } = await api("/platform/domains", { token: superToken });
  const familySpirit = listAfter.find((d) => d.domain === "family-spirit.vercel.app");
  assert.equal(familySpirit.is_primary, false, "prior primary was cleared on PATCH");

  await api(`/platform/domains/${encodeURIComponent(created.id)}`, { method: "DELETE", token: superToken });
});

test("setting primary with inactive or unverified domain is rejected", async () => {
  const { response: res1 } = await api("/platform/domains", {
    method: "POST",
    token: superToken,
    body: { company_id: "idesign", domain: "inactive-primary.vercel.app", is_verified: true, is_active: false, is_primary: true },
  });
  assert.equal(res1.status, 400);

  const { response: res2 } = await api("/platform/domains", {
    method: "POST",
    token: superToken,
    body: { company_id: "idesign", domain: "unverified-primary.vercel.app", is_verified: false, is_active: true, is_primary: true },
  });
  assert.equal(res2.status, 400);
});

test("PATCH with invalid hostname fields returns 400", async () => {
  const { body: list } = await api("/platform/domains", { token: superToken });
  const target = list.find((d) => d.domain === "family-spirit.vercel.app");
  assert.ok(target);

  for (const bad of ["http://evil.com", "evil.com/path", "evil.com?query", "evil.com#hash", "evil.com:8080", "evil.*.com", "evil..com", " evil.com", ".evil.com", "evil.com.", ""]) {
    const { response } = await api(`/platform/domains/${encodeURIComponent(target.id)}`, {
      method: "PATCH",
      token: superToken,
      body: { domain: bad },
    });
    assert.equal(response.status, 400, `hostname ${JSON.stringify(bad)} must be rejected`);
  }
});

test("POST with invalid hostname fields returns 400", async () => {
  for (const bad of ["http://bad.com", "bad.com/path", "bad..com"]) {
    const { response } = await api("/platform/domains", {
      method: "POST",
      token: superToken,
      body: { company_id: "imarketing", domain: bad, is_verified: true },
    });
    assert.equal(response.status, 400, `hostname ${JSON.stringify(bad)} must be rejected`);
  }
});

test("Origin: null header does not fall back to a valid Host", async () => {
  const { response, body } = await api("/company/resolve", {
    headers: { origin: "null", host: "i-design-eta.vercel.app" },
  });
  assert.equal(response.status, 200);
  assert.equal(body.company, null);
});

test("malformed Origin does not fall back to Host", async () => {
  const { response, body } = await api("/company/resolve", {
    headers: { origin: "not-a-url", "x-forwarded-host": "i-design-eta.vercel.app" },
  });
  assert.equal(response.status, 200);
  assert.equal(body.company, null);
});

test("unknown HTTPS Origin with a mapped Host still does not resolve", async () => {
  const { response, body } = await api("/company/resolve", {
    headers: { origin: "https://evil-rival-store.vercel.app", "x-forwarded-host": "i-design-eta.vercel.app" },
  });
  assert.equal(response.status, 200);
  assert.equal(body.company, null);
});

test("missing Origin with mapped X-Forwarded-Host resolves correctly", async () => {
  const { response, body } = await api("/company/resolve", {
    headers: { "x-forwarded-host": "i-design-eta.vercel.app" },
  });
  assert.equal(response.status, 200);
  assert.equal(body.company?.id, "idesign");
});

test("PATCH SQL placeholders are distinct: SET, updated_at, and WHERE id use unique $N", async () => {
  const { buildDomainUpdateQuery } = await import("../src/routes/platform.js");

  const changes = { domain: "verified-test.com", is_active: true };
  const domainId = "domain-test-id";
  const { text, params } = buildDomainUpdateQuery(changes, domainId);

  assert.ok(text, "SQL text produced");
  assert.ok(Array.isArray(params), "params is an array");

  const placeholders = [...text.matchAll(/\$(\d+)/g)].map((m) => parseInt(m[1], 10));
  const unique = [...new Set(placeholders)];
  assert.equal(unique.length, placeholders.length, "every placeholder must be distinct");
  assert.ok(text.includes("domain = $1"), "first SET field uses $1");
  assert.ok(text.includes("is_active = $2"), "second SET field uses $2");
  assert.ok(text.includes("updated_at = $3"), "updated_at uses $3");
  const whereMatch = text.match(/where id = \$(\d+)/i);
  assert.ok(whereMatch, "WHERE id has its own placeholder");
  assert.equal(parseInt(whereMatch[1], 10), 4, "WHERE id uses $4 with 2 SET fields");
  assert.equal(Math.max(...placeholders), params.length, "highest placeholder equals params.length");
  assert.equal(params[params.length - 1], domainId, "last param is the domain id");
  assert.ok(typeof params[params.length - 2] === "string", "second-to-last param is updated_at string");
});

test("PATCH SQL with single SET field still uses distinct placeholders", async () => {
  const { buildDomainUpdateQuery } = await import("../src/routes/platform.js");
  const { text, params } = buildDomainUpdateQuery({ is_verified: false }, "dom-single");

  assert.ok(text.includes("is_verified = $1"), "SET field uses $1");
  assert.ok(text.includes("updated_at = $2"), "updated_at uses $2");
  assert.ok(text.includes("where id = $3"), "WHERE id uses $3");
  assert.equal(params.length, 3, "exactly 3 params (field, updated_at, id)");
  const numbers = [...text.matchAll(/\$(\d+)/g)].map((m) => parseInt(m[1], 10));
  assert.deepEqual(numbers, [1, 2, 3], "sequential 1, 2, 3");
  assert.equal(Math.max(...numbers), params.length, "highest equals param count");
});
