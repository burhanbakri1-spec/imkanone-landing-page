import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";

const dataStoreDir = fs.mkdtempSync(path.join(os.tmpdir(), "storefront-content-test-"));
const now = "2026-08-09T00:00:00.000Z";
fs.writeFileSync(path.join(dataStoreDir, "store.json"), JSON.stringify({
  version: 2,
  companies: [
    { id: "kids-velvet", slug: "kids-velvet", name: "i-play", status: "active", domain: "", settings: { currency: "USD", websiteConnection: { siteId: "kids-velvet-storefront", storefrontBaseUrl: "https://feature-preview.vercel.app", defaultLocale: "ar", supportedLocales: ["ar", "en"] }, websiteContent: { vlogs: [{ id: "v1", slug: "first-story", title: { en: "First story", ar: "القصة الأولى" }, description: { en: "Intro", ar: "مقدمة" }, videoUrl: "https://cdn.example/v1.mp4", posterUrl: "https://cdn.example/v1.jpg", mediaType: "video", sortOrder: 1, isActive: true, featured: true, createdAt: now }], vlogHero: { title: { en: "Care stories", ar: "قصص العناية" }, imageUrl: "https://cdn.example/vlog-hero.jpg" } } } },
    { id: "other-shop", slug: "other-shop", name: "Other", status: "active", domain: "", settings: { websiteConnection: { siteId: "other-shop-storefront", defaultLocale: "en", supportedLocales: ["en"] } } },
  ],
  domains: [
    { id: "kids-domain", company_id: "kids-velvet", domain: "i-play-preview.vercel.app", is_primary: true, is_active: true, is_verified: true, created_at: now, updated_at: now },
    { id: "other-domain", company_id: "other-shop", domain: "other-shop.example", is_primary: true, is_active: true, is_verified: true, created_at: now, updated_at: now },
  ],
  users: [], memberships: [], orders: [],
  products: [
    { id: "play-1", company_id: "kids-velvet", slug: "play-one", sku: "PLAY-1", name: { en: "Play One", ar: "اللعبة الأولى" }, shortDescription: { en: "Short", ar: "قصير" }, fullDescription: "Full", fullDescriptionAr: "كامل", price: 25, categoryId: "toys", brandId: "velvet", image: "https://cdn.example/play-one.png", visible: true, isActive: true, usageVideo: "https://cdn.example/play-one-usage.mp4", usageVideoPoster: "https://cdn.example/play-one-usage-poster.jpg", variants: [{ id: "v1", size: "Standard", price: 25, stock: 3, wholesalePrice: 4, visible: true }] },
    { id: "play-hidden", company_id: "kids-velvet", slug: "hidden", name: { en: "Hidden", ar: "مخفي" }, isActive: false },
    { id: "other-1", company_id: "other-shop", slug: "other-product", name: { en: "Other product", ar: "منتج آخر" }, isActive: true, visible: true },
  ],
  categories: [
    { id: "toys", company_id: "kids-velvet", slug: "toys", name: { en: "Toys", ar: "ألعاب" }, description: { en: "Play", ar: "لعب" }, imageUrl: "https://cdn.example/toys.jpg", brandId: "velvet", heroVideo: "https://cdn.example/toys-hero.mp4", isActive: true, sortOrder: 1 },
    { id: "hidden-category", company_id: "kids-velvet", slug: "hidden-category", name: { en: "Hidden", ar: "مخفي" }, isActive: false },
    { id: "other-category", company_id: "other-shop", slug: "other-category", name: { en: "Other", ar: "آخر" }, isActive: true },
  ],
  brands: [
    { id: "velvet", company_id: "kids-velvet", slug: "velvet", name: "VELVET", logoUrl: "https://cdn.example/velvet-logo.png", heroVideo: "https://cdn.example/velvet-hero.mp4", heroPoster: "https://cdn.example/velvet-poster.jpg", isActive: true, sortOrder: 1 },
    { id: "hidden-brand", company_id: "kids-velvet", slug: "hidden-brand", name: "Hidden", isActive: false },
    { id: "other-brand", company_id: "other-shop", slug: "other-brand", name: "Other", isActive: true },
  ],
  websiteTexts: [
    { id: "hero-title", company_id: "kids-velvet", key: "home.hero.title", group: "home.hero", label: "Hero title", valueEn: "Play more", valueAr: "العب أكثر", isActive: true },
    { id: "hidden-text", company_id: "kids-velvet", key: "hidden", valueEn: "Hidden", isActive: false },
  ],
  websiteMedia: [
    { id: "hero", company_id: "kids-velvet", sectionKey: "home.hero", sectionLabel: "Home hero", groupKey: "home", imageUrl: "https://cdn.example/hero.jpg", isActive: true },
  ],
  websiteMediaHiddenKeys: [], workSessions: [],
}, null, 2));

process.env.DATA_STORE_DIR = dataStoreDir;
process.env.DATABASE_URL = "";
process.env.POSTGRES_URL = "";
process.env.SUPABASE_URL = "";
process.env.SUPABASE_SERVICE_ROLE_KEY = "";
process.env.JWT_SECRET = "storefront-content-test-secret";
process.env.NODE_ENV = "test";
process.env.UPLOADS_DIR = path.join(dataStoreDir, "uploads");
fs.mkdirSync(process.env.UPLOADS_DIR, { recursive: true });

const { app } = await import("../src/server.js");
const server = app.listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
after(() => server.close());
const baseUrl = `http://127.0.0.1:${server.address().port}/api/storefront`;

async function request(pathname, { companyId = "kids-velvet", siteId = "kids-velvet-storefront", origin } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    headers: {
      "X-Company-Id": companyId,
      "X-Site-Id": siteId,
      ...(origin ? { Origin: origin } : {}),
    },
  });
  return { response, body: await response.json().catch(() => null) };
}

test("tenant-scoped storefront content returns safe active records", async () => {
  const { response, body } = await request("/content?locale=ar");
  assert.equal(response.status, 200);
  assert.equal(body.site.companyId, "kids-velvet");
  assert.equal(body.site.locale, "ar");
  assert.deepEqual(body.products.map((item) => item.slug), ["play-one"]);
  assert.deepEqual(body.products[0].shortDescription, { en: "Short", ar: "قصير" });
  assert.deepEqual(body.categories.map((item) => item.slug), ["toys"]);
  assert.equal(body.texts[0].value, "العب أكثر");
  assert.equal(body.media[0].sectionKey, "home.hero");
  assert.equal("company_id" in body.products[0], false);
  assert.equal("wholesalePrice" in body.products[0].variants[0], false);
});

test("storefront content exposes entity-owned media directly on the entity", async () => {
  const { response, body } = await request("/content?locale=en");
  assert.equal(response.status, 200);

  assert.deepEqual(body.brands.map((item) => item.slug), ["velvet"]);
  assert.deepEqual(body.brands[0].name, { en: "VELVET", ar: "VELVET" });
  assert.equal(body.brands[0].logoUrl, "https://cdn.example/velvet-logo.png");
  assert.equal(body.brands[0].heroVideo, "https://cdn.example/velvet-hero.mp4");
  assert.equal(body.brands[0].heroPoster, "https://cdn.example/velvet-poster.jpg");
  assert.equal("company_id" in body.brands[0], false);

  assert.equal(body.categories[0].brandId, "velvet");
  assert.equal(body.categories[0].heroVideo, "https://cdn.example/toys-hero.mp4");
  assert.equal(body.categories[0].image, "https://cdn.example/toys.jpg");

  assert.equal(body.products[0].usageVideo, "https://cdn.example/play-one-usage.mp4");
  assert.equal(body.products[0].usageVideoPoster, "https://cdn.example/play-one-usage-poster.jpg");
});

test("storefront content exposes managed vlogs from company website content settings", async () => {
  const { response, body } = await request("/content?locale=ar");
  assert.equal(response.status, 200);
  assert.equal(body.vlogHero.label, "قصص العناية");
  assert.equal(body.vlogHero.imageUrl, "https://cdn.example/vlog-hero.jpg");
  assert.deepEqual(body.vlogs.map((item) => item.slug), ["first-story"]);
  assert.equal(body.vlogs[0].title.ar, "القصة الأولى");
  assert.equal(body.vlogs[0].videoUrl, "https://cdn.example/v1.mp4");
  assert.equal(body.vlogs[0].featured, true);
});

test("product detail is slug-compatible and tenant scoped", async () => {
  const { response, body } = await request("/products/play-one");
  assert.equal(response.status, 200);
  assert.equal(body.slug, "play-one");
  const missing = await request("/products/other-product");
  assert.equal(missing.response.status, 404);
});

test("site identity is required and cannot select another tenant accidentally", async () => {
  assert.equal((await request("/content", { siteId: "wrong-site" })).response.status, 404);
  assert.equal((await request("/content", { companyId: "other-shop", siteId: "kids-velvet-storefront" })).response.status, 404);
});

test("a verified origin belonging to another tenant cannot read kids-velvet content", async () => {
  const denied = await request("/content", { origin: "https://other-shop.example" });
  assert.equal(denied.response.status, 404);
  const allowed = await request("/content", { origin: "https://i-play-preview.vercel.app" });
  assert.equal(allowed.response.status, 200);
});

test("the exact connected storefront origin is allowed without weakening tenant isolation", async () => {
  const allowed = await request("/content", { origin: "https://feature-preview.vercel.app" });
  assert.equal(allowed.response.status, 200);
  assert.equal(allowed.response.headers.get("access-control-allow-origin"), "https://feature-preview.vercel.app");
  const denied = await request("/content", { origin: "https://unregistered-preview.vercel.app" });
  assert.equal(denied.response.status, 404);
  assert.equal(denied.response.headers.get("access-control-allow-origin"), null);
});
