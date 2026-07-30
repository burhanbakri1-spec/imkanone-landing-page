import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import pg from "pg";
import { hashPassword } from "../src/auth/passwords.js";

const dataStoreDir = fs.mkdtempSync(path.join(os.tmpdir(), "igroup-site-editor-"));
const password = "Editor-test-123!";
const passwordHash = await hashPassword(password);
const now = "2026-07-30T00:00:00.000Z";
const companies = [
  { id: "icare", slug: "icare", name: "iCare", status: "active", storefrontUrl: "https://igroup.website/icare", storefrontPath: "/icare" },
  { id: "eb-chemical", slug: "eb-chemical", name: "EB Chemical", status: "active" },
];
const users = [
  { id: "icare-admin", email: "editor@icare.test", name: "iCare editor", password: passwordHash, role: "company_admin", permissions: [], isActive: true, company_id: "icare", createdAt: now, updatedAt: now },
  { id: "icare-reader", email: "reader@icare.test", name: "iCare reader", password: passwordHash, role: "employee", permissions: ["site_editor.access"], isActive: true, company_id: "icare", createdAt: now, updatedAt: now },
  { id: "eb-admin", email: "editor@eb.test", name: "EB editor", password: passwordHash, role: "company_admin", permissions: [], isActive: true, company_id: "eb-chemical", createdAt: now, updatedAt: now },
];
const memberships = [
  { id: "icare:icare-admin", companyId: "icare", userId: "icare-admin", role: "company_admin", status: "active", permissions: [], createdAt: now, updatedAt: now },
  { id: "icare:icare-reader", companyId: "icare", userId: "icare-reader", role: "employee", status: "active", permissions: ["site_editor.access"], createdAt: now, updatedAt: now },
  { id: "eb-chemical:eb-admin", companyId: "eb-chemical", userId: "eb-admin", role: "company_admin", status: "active", permissions: [], createdAt: now, updatedAt: now },
];
fs.writeFileSync(path.join(dataStoreDir, "store.json"), JSON.stringify({
  version: 2, companies, users, memberships,
  websiteTexts: [
    { id: "heading", company_id: "icare", key: "home_hero_headline", valueEn: "Skincare made clear", valueAr: "عناية واضحة", isActive: true },
    { id: "subtitle", company_id: "icare", key: "home_hero_subtitle", valueEn: "Real care for every routine", valueAr: "عناية حقيقية لكل روتين", isActive: true },
    { id: "cta", company_id: "icare", key: "home_hero_cta", valueEn: "Shop iCare", valueAr: "تسوق iCare", isActive: true },
  ],
  websiteMedia: [
    { id: "icare-hero", company_id: "icare", sectionKey: "home_hero", imageUrl: "/uploads/icare-hero.jpg", isActive: true },
    { id: "icare-alt", company_id: "icare", sectionKey: "home_alt", imageUrl: "/uploads/icare-alt.jpg", isActive: true },
    { id: "eb-media", company_id: "eb-chemical", sectionKey: "home_hero", imageUrl: "/uploads/eb.jpg", isActive: true },
  ],
}, null, 2));

process.env.DATA_STORE_DIR = dataStoreDir;
process.env.SITE_EDITOR_DRAFT_STORE_DIR = path.join(dataStoreDir, "editor-drafts");
process.env.DATABASE_URL = "";
process.env.POSTGRES_URL = "";
process.env.SUPABASE_URL = "";
process.env.SUPABASE_SERVICE_ROLE_KEY = "";
process.env.JWT_SECRET = "site-editor-focused-test";
process.env.NODE_ENV = "test";

const { app } = await import("../src/server.js");
const server = app.listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}/api`;

async function request(pathname, { token, body, headers = {}, method = body ? "POST" : "GET" } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

async function login(email) {
  const result = await request("/auth/login", { body: { email, password } });
  assert.equal(result.status, 200);
  return result.body.token;
}

test("site editor API is authenticated, permissioned, tenant-scoped, validated, and revisioned", async (t) => {
  t.after(async () => {
    server.close();
    fs.rmSync(dataStoreDir, { recursive: true, force: true });
    const dbUrl = process.env.SITE_EDITOR_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (dbUrl) {
      const cleanPool = new pg.Pool({ connectionString: dbUrl });
      try {
        await cleanPool.query("delete from public.company_site_editor_drafts where company_id = $1", ["icare"]);
      } catch {}
      await cleanPool.end();
    }
  });
  const noAuth = await request("/site-editor/pages");
  assert.equal(noAuth.status, 401);

  const icareToken = await login("editor@icare.test");
  const readerToken = await login("reader@icare.test");
  const ebToken = await login("editor@eb.test");

  await t.test("page list and page document contain only the authenticated iCare Home", async () => {
    const pages = await request("/site-editor/pages?companyId=eb-chemical", { token: icareToken, headers: { "X-Company-Id": "eb-chemical" } });
    assert.equal(pages.status, 200);
    assert.deepEqual(pages.body.items.map((item) => item.id), ["icare:home"]);
    assert.equal(pages.body.items[0].tenantId, "icare");
    const result = await request("/site-editor/pages/icare%3Ahome", { token: icareToken });
    assert.equal(result.status, 200);
    assert.equal(result.body.document.companyId, "icare");
    assert.equal(result.body.document.previewPath, "/icare");
    assert.equal(result.body.document.sections[0].settings.sourceComponent, "app/icare/components/Hero.tsx");
    assert.equal(result.body.document.sections[0].elements.some((element) => element.type === "container"), true);
    assert.equal(JSON.stringify(result.body.document).includes("EB Chemical"), false);
  });

  await t.test("unknown page and EB tenant cannot access iCare documents", async () => {
    assert.equal((await request("/site-editor/pages/icare%3Aproducts", { token: icareToken })).status, 404);
    assert.equal((await request("/site-editor/pages", { token: ebToken })).status, 404);
  });

  const loaded = await request("/site-editor/pages/icare%3Ahome", { token: icareToken });
  const changed = structuredClone(loaded.body.document);
  changed.sections[0].elements.find((element) => element.type === "container").children[0].content.text = "A safer edited heading";
  changed.companyId = "eb-chemical";

  await t.test("read-only permission cannot save", async () => {
    const result = await request("/site-editor/pages/icare%3Ahome/draft", { token: readerToken, method: "PUT", body: { revision: 0, document: changed } });
    assert.equal(result.status, 403);
  });

  await t.test("expected revision saves locally and server injects tenant and audit metadata", async () => {
    const result = await request("/site-editor/pages/icare%3Ahome/draft", { token: icareToken, method: "PUT", body: { revision: 0, companyId: "eb-chemical", document: changed } });
    assert.equal(result.status, 200);
    assert.equal(result.body.revision, 1);
    assert.equal(result.body.document.companyId, "icare");
    assert.equal(result.body.audit.updatedBy, "icare-admin");
    if (!process.env.SITE_EDITOR_DATABASE_URL) {
      assert.equal(fs.existsSync(path.join(dataStoreDir, "editor-drafts", "site-editor-drafts.json")), true);
    }
  });

  await t.test("stale revision returns a clear conflict", async () => {
    const result = await request("/site-editor/pages/icare%3Ahome/draft", { token: icareToken, method: "PUT", body: { revision: 0, document: changed } });
    assert.equal(result.status, 409);
    assert.equal(result.body.code, "REVISION_CONFLICT");
    assert.equal(result.body.currentRevision, 1);
  });

  await t.test("unsafe markup and script URLs are rejected", async () => {
    const unsafe = structuredClone(changed);
    unsafe.sections[0].elements.find((element) => element.type === "container").children[0].content.text = "<script>alert(1)</script>";
    const result = await request("/site-editor/pages/icare%3Ahome/draft", { token: icareToken, method: "PUT", body: { revision: 1, document: unsafe } });
    assert.equal(result.status, 400);
    assert.equal(result.body.code, "INVALID_DOCUMENT");
  });

  await t.test("cross-tenant media replacement is rejected", async () => {
    const crossTenant = structuredClone(changed);
    crossTenant.sections[0].elements.find((element) => element.type === "image").content = { src: "/uploads/eb.jpg", alt: "wrong", link: "", assetId: "eb-media" };
    const result = await request("/site-editor/pages/icare%3Ahome/draft", { token: icareToken, method: "PUT", body: { revision: 1, document: crossTenant } });
    assert.equal(result.status, 400);
    assert.equal(result.body.code, "TENANT_MEDIA_REQUIRED");
  });

  await t.test("active iCare media replacement succeeds at the current revision", async () => {
    const replacement = structuredClone(changed);
    replacement.sections[0].elements.find((element) => element.type === "image").content = { src: "/uploads/icare-alt.jpg", alt: "alternate", link: "", assetId: "icare-alt" };
    const result = await request("/site-editor/pages/icare%3Ahome/draft", { token: icareToken, method: "PUT", body: { revision: 1, document: replacement } });
    assert.equal(result.status, 200);
    assert.equal(result.body.revision, 2);
  });
});
