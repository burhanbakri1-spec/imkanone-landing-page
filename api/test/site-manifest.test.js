import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
const unitStoreDir = fs.mkdtempSync(path.join(os.tmpdir(), "igroup-site-manifest-unit-"));
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "";
process.env.POSTGRES_URL = "";
process.env.SUPABASE_URL = "";
process.env.SUPABASE_SERVICE_ROLE_KEY = "";
process.env.DATA_STORE_DIR = unitStoreDir;
process.env.SITE_EDITOR_DRAFT_STORE_DIR = path.join(unitStoreDir, "editor-drafts");

const { buildLegacyIcareManifest } = await import("../src/siteEditor/icareLegacyManifestProvider.js");
const {
  buildEditorPageDescriptor,
  manifestPageToDocument,
  validateSiteManifest,
} = await import("../src/siteEditor/siteManifest.js");
const { validatePageDocument } = await import("../src/siteEditor/schema.js");
const { assertManifestMatchesCompany, validateConnectionUrl } = await import("../src/siteEditor/websiteConnection.js");

const now = "2026-07-30T00:00:00.000Z";

function validManifest(overrides = {}) {
  return {
    schemaVersion: "1.0",
    companyId: "mock-brand",
    siteId: "mock-brand-storefront",
    siteName: "Mock Brand",
    baseUrl: "https://mock-brand.example",
    routePrefix: "/",
    defaultLocale: "en",
    supportedLocales: ["en", "ar"],
    generatedAt: now,
    pages: [
      {
        id: "home",
        route: "/",
        pageType: "standard",
        title: { en: "Home", ar: "الرئيسية" },
        navigationVisible: true,
        parentId: null,
        order: 0,
        editable: true,
        sections: [
          {
            id: "hero",
            sectionType: "hero",
            order: 0,
            editable: true,
            layout: { sourceComponent: "app/mock/components/Hero.tsx" },
            responsive: {},
            elements: [
              { id: "hero-heading", elementType: "heading", order: 0, editable: true, content: { en: { text: "Hello" }, ar: { text: "مرحبا" } }, source: null, styles: { alignment: "start" }, responsive: {}, validation: {}, editableProperties: ["content"], children: [] },
            ],
          },
        ],
      },
    ],
    ...overrides,
  };
}

test("site manifest schema validation", async (t) => {
  await t.test("accepts a well-formed manifest", () => {
    const result = validateSiteManifest(validManifest());
    assert.equal(result.schemaVersion, "1.0");
    assert.equal(result.companyId, "mock-brand");
    assert.equal(result.pages.length, 1);
  });

  await t.test("rejects invalid schema versions, missing identity, and unsupported page types", () => {
    assert.throws(() => validateSiteManifest(validManifest({ schemaVersion: "0.9" })), /schema/i);
    assert.throws(() => validateSiteManifest(validManifest({ companyId: "" })), /companyId/i);
    assert.throws(() => validateSiteManifest(validManifest({ siteId: "" })), /siteId/i);
    assert.throws(() => validateSiteManifest(validManifest({
      pages: [{ ...validManifest().pages[0], pageType: "bogus" }],
    })), /page/i);
  });

  await t.test("rejects duplicate page and section ids", () => {
    const duplicate = validManifest();
    duplicate.pages.push(duplicate.pages[0]);
    assert.throws(() => validateSiteManifest(duplicate), /duplicate/i);
    const duplicateSection = validManifest();
    duplicateSection.pages[0].sections.push(duplicateSection.pages[0].sections[0]);
    assert.throws(() => validateSiteManifest(duplicateSection), /duplicate/i);
  });

  await t.test("rejects cross-origin routes and missing localized titles", () => {
    assert.throws(() => validateSiteManifest(validManifest({
      pages: [{ ...validManifest().pages[0], route: "//evil.example" }],
    })), /route/i);
    assert.throws(() => validateSiteManifest(validManifest({
      pages: [{ ...validManifest().pages[0], title: { en: "" } }],
    })), /title/i);
  });
});

test("manifest company identity assertion", async (t) => {
  const company = { id: "mock-brand", slug: "mock-brand", name: "Mock Brand" };
  await t.test("accepts a manifest that matches the company", () => {
    assert.equal(assertManifestMatchesCompany(validManifest(), company), true);
  });
  await t.test("rejects a manifest for a different company", () => {
    assert.throws(() => assertManifestMatchesCompany(validManifest({ companyId: "someone-else" }), company), /company/i);
  });
  await t.test("rejects a manifest claiming another company's siteId", () => {
    assert.throws(() => assertManifestMatchesCompany(validManifest({ siteId: "another-brand-storefront" }), company), /site/i);
  });
  await t.test("rejects a remote manifest URL that does not match the authenticated company", () => {
    const companyA = { id: "a", slug: "a", name: "A" };
    const companyB = { id: "b", slug: "b", name: "B" };
    assert.throws(() => assertManifestMatchesCompany(validManifest({ companyId: "b", siteId: "b-storefront" }), companyA), /company/i);
  });
});

test("manifest URL validation", async () => {
  assert.equal(validateConnectionUrl("https://brand.example/site-manifest.json", "siteManifestUrl"), "https://brand.example/site-manifest.json");
  assert.throws(() => validateConnectionUrl("http://brand.example/site-manifest.json", "siteManifestUrl"), /https/i);
  assert.throws(() => validateConnectionUrl("javascript:alert(1)", "siteManifestUrl"), /https/i);
  assert.equal(validateConnectionUrl("", "siteManifestUrl"), "");
});

test("manifest URL local connection mode", async (t) => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousFlag = process.env.SITE_EDITOR_ALLOW_LOCAL_CONNECTIONS;
  t.after(() => {
    process.env.NODE_ENV = previousNodeEnv;
    if (previousFlag === undefined) delete process.env.SITE_EDITOR_ALLOW_LOCAL_CONNECTIONS;
    else process.env.SITE_EDITOR_ALLOW_LOCAL_CONNECTIONS = previousFlag;
  });
  const setMode = (env, flag) => {
    process.env.NODE_ENV = env;
    if (flag === undefined) delete process.env.SITE_EDITOR_ALLOW_LOCAL_CONNECTIONS;
    else process.env.SITE_EDITOR_ALLOW_LOCAL_CONNECTIONS = flag;
  };

  await t.test("localhost HTTP is rejected without the flag", () => {
    setMode("development", undefined);
    assert.throws(() => validateConnectionUrl("http://localhost:3000/api/site-manifest", "siteManifestUrl"), /https/i);
  });

  await t.test("localhost HTTP is rejected when the flag is not exactly true", () => {
    setMode("development", "1");
    assert.throws(() => validateConnectionUrl("http://127.0.0.1:3000/api/site-manifest", "siteManifestUrl"), /https/i);
  });

  await t.test("localhost HTTP is accepted in development with the flag", () => {
    setMode("development", "true");
    assert.equal(validateConnectionUrl("http://localhost:3000/api/site-manifest", "siteManifestUrl"), "http://localhost:3000/api/site-manifest");
    assert.equal(validateConnectionUrl("http://127.0.0.1:3000/api/site-manifest", "siteManifestUrl"), "http://127.0.0.1:3000/api/site-manifest");
    assert.equal(validateConnectionUrl("http://[::1]:3000/api/site-manifest", "siteManifestUrl"), "http://[::1]:3000/api/site-manifest");
    assert.equal(validateConnectionUrl("http://localhost:3000/", "siteManifestUrl"), "http://localhost:3000");
    assert.equal(validateConnectionUrl("http://localhost:3000", "storefrontBaseUrl"), "http://localhost:3000");
  });

  await t.test("local HTTP with credentials is rejected even with the flag", () => {
    setMode("development", "true");
    assert.throws(() => validateConnectionUrl("http://user:pass@localhost:3000/api/site-manifest", "siteManifestUrl"), /https/i);
    assert.throws(() => validateConnectionUrl("https://user:pass@localhost:3000/api/site-manifest", "siteManifestUrl"), /https/i);
  });

  await t.test("non-local HTTP remains rejected even with the flag", () => {
    setMode("development", "true");
    assert.throws(() => validateConnectionUrl("http://brand.example/site-manifest.json", "siteManifestUrl"), /https/i);
    assert.throws(() => validateConnectionUrl("http://127.0.0.1.evil.example/site-manifest.json", "siteManifestUrl"), /https/i);
  });

  await t.test("HTTPS remains accepted everywhere", () => {
    setMode("production", "true");
    assert.equal(validateConnectionUrl("https://brand.example/site-manifest.json", "siteManifestUrl"), "https://brand.example/site-manifest.json");
    assert.equal(validateConnectionUrl("https://localhost/site-manifest.json", "siteManifestUrl"), "https://localhost/site-manifest.json");
    setMode("development", "true");
    assert.equal(validateConnectionUrl("https://127.0.0.1/site-manifest.json", "siteManifestUrl"), "https://127.0.0.1/site-manifest.json");
  });

  await t.test("production rejects localhost even when the flag is present", () => {
    setMode("production", "true");
    assert.throws(() => validateConnectionUrl("http://localhost:3000/api/site-manifest", "siteManifestUrl"), /https/i);
    assert.throws(() => validateConnectionUrl("http://127.0.0.1:3000/api/site-manifest", "siteManifestUrl"), /https/i);
    assert.throws(() => validateConnectionUrl("http://[::1]:3000/api/site-manifest", "siteManifestUrl"), /https/i);
  });

  await t.test("test environment rejects localhost even when the flag is present", () => {
    setMode("test", "true");
    assert.throws(() => validateConnectionUrl("http://localhost:3000/api/site-manifest", "siteManifestUrl"), /https/i);
  });
});

test("manifest baseUrl local connection mode", async (t) => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousFlag = process.env.SITE_EDITOR_ALLOW_LOCAL_CONNECTIONS;
  t.after(() => {
    process.env.NODE_ENV = previousNodeEnv;
    if (previousFlag === undefined) delete process.env.SITE_EDITOR_ALLOW_LOCAL_CONNECTIONS;
    else process.env.SITE_EDITOR_ALLOW_LOCAL_CONNECTIONS = previousFlag;
  });
  const setMode = (env, flag) => {
    process.env.NODE_ENV = env;
    if (flag === undefined) delete process.env.SITE_EDITOR_ALLOW_LOCAL_CONNECTIONS;
    else process.env.SITE_EDITOR_ALLOW_LOCAL_CONNECTIONS = flag;
  };
  const manifestWithBaseUrl = (baseUrl) => validManifest({ baseUrl });

  await t.test("localhost HTTP baseUrl is rejected without the flag", () => {
    setMode("development", undefined);
    assert.throws(() => validateSiteManifest(manifestWithBaseUrl("http://localhost:3000")), /https/i);
  });

  await t.test("localhost HTTP baseUrl is accepted in development with the flag", () => {
    setMode("development", "true");
    const normalized = validateSiteManifest(manifestWithBaseUrl("http://localhost:3000"));
    assert.equal(normalized.baseUrl, "http://localhost:3000");
    const ipv4 = validateSiteManifest(manifestWithBaseUrl("http://127.0.0.1:3000"));
    assert.equal(ipv4.baseUrl, "http://127.0.0.1:3000");
    const ipv6 = validateSiteManifest(manifestWithBaseUrl("http://[::1]:3000"));
    assert.equal(ipv6.baseUrl, "http://[::1]:3000");
  });

  await t.test("production rejects localhost HTTP baseUrl even with the flag", () => {
    setMode("production", "true");
    assert.throws(() => validateSiteManifest(manifestWithBaseUrl("http://localhost:3000")), /https/i);
  });

  await t.test("test environment rejects localhost HTTP baseUrl even with the flag", () => {
    setMode("test", "true");
    assert.throws(() => validateSiteManifest(manifestWithBaseUrl("http://127.0.0.1:3000")), /https/i);
  });

  await t.test("non-local HTTP baseUrl is rejected even with the flag", () => {
    setMode("development", "true");
    assert.throws(() => validateSiteManifest(manifestWithBaseUrl("http://brand.example")), /https/i);
  });

  await t.test("HTTPS baseUrl remains accepted everywhere", () => {
    setMode("production", "true");
    assert.equal(validateSiteManifest(manifestWithBaseUrl("https://brand.example/")).baseUrl, "https://brand.example");
    setMode("development", "true");
    assert.equal(validateSiteManifest(manifestWithBaseUrl("https://localhost/")).baseUrl, "https://localhost");
  });

  await t.test("credentials are rejected in baseUrl even with the flag", () => {
    setMode("development", "true");
    assert.throws(() => validateSiteManifest(manifestWithBaseUrl("http://user:pass@localhost:3000")), /https/i);
    assert.throws(() => validateSiteManifest(manifestWithBaseUrl("https://user:pass@brand.example")), /https/i);
  });

  await t.test("companyId and siteId validation is unchanged", () => {
    setMode("development", "true");
    assert.throws(() => validateSiteManifest(validManifest({ baseUrl: "http://localhost:3000", companyId: "" })), /companyId/i);
    assert.throws(() => validateSiteManifest(validManifest({ baseUrl: "http://localhost:3000", siteId: "" })), /siteId/i);
    const normalized = validateSiteManifest(validManifest({ baseUrl: "http://localhost:3000" }));
    assert.equal(normalized.companyId, "mock-brand");
    assert.equal(normalized.siteId, "mock-brand-storefront");
  });
});

test("adding a page or section to a manifest is reflected without registry changes", async (t) => {
  await t.test("a newly added manifest page appears in the editor page list", () => {
    const manifest = validManifest();
    manifest.pages.push({
      id: "vlog",
      route: "/vlog",
      pageType: "standard",
      title: { en: "Vlog", ar: "مدونة" },
      navigationVisible: true,
      parentId: null,
      order: 1,
      editable: true,
      sections: [],
    });
    const normalized = validateSiteManifest(manifest);
    const page = normalized.pages.find((entry) => entry.id === "vlog");
    const descriptor = buildEditorPageDescriptor(page, normalized, { companyId: "mock-brand", locale: "en" });
    assert.equal(descriptor.id, "vlog");
    assert.equal(descriptor.routePattern, "/vlog");
    assert.equal(descriptor.isEditable, true);
    const document = manifestPageToDocument(page, normalized, { companyId: "mock-brand", locale: "en" });
    assert.equal(document.pageId, "vlog");
    assert.equal(document.previewPath, "/vlog");
  });

  await t.test("a newly added section to an existing page appears in the document", () => {
    const manifest = validManifest();
    manifest.pages[0].sections.push({
      id: "reviews",
      sectionType: "reviews",
      order: 1,
      editable: true,
      layout: { sourceComponent: "app/mock/components/Reviews.tsx" },
      responsive: {},
      elements: [],
    });
    const normalized = validateSiteManifest(manifest);
    const document = manifestPageToDocument(normalized.pages[0], normalized, { companyId: "mock-brand", locale: "en" });
    assert.equal(document.sections.length, 2);
    assert.equal(document.sections[1].id, "reviews");
    assert.equal(document.sections[1].type, "reviews");
    assert.equal(document.sections[1].settings.sourceComponent, "app/mock/components/Reviews.tsx");
  });

  await t.test("same page id across two tenants produces isolated documents", () => {
    const first = validateSiteManifest(validManifest());
    const second = validateSiteManifest(validManifest({
      companyId: "second-brand",
      siteId: "second-brand-storefront",
      baseUrl: "https://second-brand.example",
      pages: [{
        ...validManifest().pages[0],
        title: { en: "Second Home", ar: "الرئيسية الثانية" },
        sections: [{
          id: "hero",
          sectionType: "hero",
          order: 0,
          editable: true,
          layout: { sourceComponent: "app/second/components/Hero.tsx" },
          responsive: {},
          elements: [],
        }],
      }],
    }));
    const firstDocument = manifestPageToDocument(first.pages[0], first, { companyId: "mock-brand", locale: "en" });
    const secondDocument = manifestPageToDocument(second.pages[0], second, { companyId: "second-brand", locale: "en" });
    assert.equal(firstDocument.pageId, "home");
    assert.equal(secondDocument.pageId, "home");
    assert.equal(firstDocument.companyId, "mock-brand");
    assert.equal(secondDocument.companyId, "second-brand");
    assert.equal(firstDocument.title, "Home");
    assert.equal(secondDocument.title, "Second Home");
    assert.notEqual(firstDocument.sections[0].settings.sourceComponent, secondDocument.sections[0].settings.sourceComponent);
  });
});

test("legacy iCare provider only serves the legacy tenant", async (t) => {
  await t.test("builds a manifest for the icare company with all pages and home sections", () => {
    const manifest = buildLegacyIcareManifest({ id: "icare", slug: "icare", name: "iCare" });
    assert.equal(manifest.siteId, "icare-storefront");
    assert.equal(manifest.routePrefix, "/icare");
    assert.deepEqual(manifest.pages.map((page) => page.id), ["home", "shop", "story", "find-us", "faq", "contact", "shipping", "privacy", "terms", "accessibility"]);
    assert.equal(manifest.pages[0].sections.length, 7);
    assert.deepEqual(manifest.pages[0].sections.map((section) => section.sectionType), ["hero", "productCollection", "promo", "philosophy", "productCollection", "social", "commitment"]);
  });
  await t.test("does not build for a non-icare company and never when a manifest URL is configured", () => {
    assert.equal(buildLegacyIcareManifest({ id: "eb-chemical", slug: "eb-chemical", name: "EB" }), null);
    assert.equal(buildLegacyIcareManifest({ id: "icare", slug: "icare", name: "iCare", settings: { websiteConnection: { siteManifestUrl: "https://x.example/m.json" } } }), null);
  });
});

test("manifest editability survives into the editor document", async (t) => {
  const manifest = validManifest();
  manifest.pages[0].sections[0].elements.push({
    id: "nested-card",
    elementType: "container",
    order: 1,
    editable: true,
    content: { en: {}, ar: {} },
    source: null,
    styles: {},
    responsive: {},
    validation: {},
    editableProperties: [],
    children: [
      { id: "nested-text", elementType: "text", order: 0, editable: false, content: { en: { text: "Locked" }, ar: { text: "مقفل" } }, source: null, styles: {}, responsive: {}, validation: {}, editableProperties: ["content"], children: [] },
    ],
  });
  const normalized = validateSiteManifest(manifest);
  const document = manifestPageToDocument(normalized.pages[0], normalized, { companyId: "mock-brand", locale: "en" });

  await t.test("section and element editability flags are preserved", () => {
    assert.equal(document.sections[0].editable, true);
    assert.equal(document.sections[0].elements[0].editable, true);
    assert.equal(document.sections[0].elements[0].settings.editableProperties[0], "content");
  });

  await t.test("empty editableProperties survive as an explicit array", () => {
    assert.deepEqual(document.sections[0].elements[1].settings.editableProperties, []);
  });

  await t.test("a non-editable section disables every descendant", () => {
    const locked = validManifest();
    locked.pages[0].sections[0].editable = false;
    locked.pages[0].sections[0].elements[0].editable = true;
    const normalizedLocked = validateSiteManifest(locked);
    const lockedDocument = manifestPageToDocument(normalizedLocked.pages[0], normalizedLocked, { companyId: "mock-brand", locale: "en" });
    assert.equal(lockedDocument.sections[0].editable, false);
    assert.equal(lockedDocument.sections[0].elements[0].editable, false);
  });

  await t.test("an element editable: false stays locked even in an editable section", () => {
    assert.equal(document.sections[0].elements[1].editable, true);
    assert.equal(document.sections[0].elements[1].children[0].editable, false);
  });

  await t.test("validatePageDocument round-trips the editable flags", () => {
    const roundTripped = validatePageDocument(document, {
      companyId: "mock-brand",
      pageId: document.pageId,
      previewPath: document.previewPath,
      routePattern: document.routePattern,
    });
    assert.equal(roundTripped.sections[0].editable, true);
    assert.equal(roundTripped.sections[0].elements[1].children[0].editable, false);
  });
});

test("migration 017 additively scopes editor drafts by site", () => {
  const base = path.resolve(import.meta.dirname, "../supabase/migrations");
  const migration016 = fs.readFileSync(path.join(base, "016_company_site_editor_drafts.sql"), "utf8");
  const migration017 = fs.readFileSync(path.join(base, "017_site_editor_drafts_site_scope.sql"), "utf8");
  assert.match(migration016, /unique \(company_id, page_id, locale\)/);
  assert.match(migration017, /add constraint company_site_editor_drafts_site_scope_key\s+unique \(company_id, site_id, page_id, locale\)/);
  assert.match(migration017, /drop constraint if exists company_site_editor_drafts_company_id_page_id_locale_key/);
  assert.match(migration017, /create index if not exists idx_company_site_editor_drafts_site_lookup/);
  assert.doesNotMatch(migration017, /drop table|truncate|delete from|create table/i);
});

function validSectionLibrary() {
  return {
    version: "1",
    blankSection: { enabled: true, sectionType: "content" },
    categories: [
      { id: "welcome", title: { en: "Welcome", ar: "ترحيب" }, icon: "home", order: 0 },
      { id: "store", title: { en: "Store", ar: "المتجر" }, order: 1 },
    ],
    templates: [
      {
        templateId: "hero-overlay",
        categoryId: "welcome",
        sectionType: "hero",
        layoutVariant: "overlay",
        title: { en: "Hero with Image Overlay", ar: "ترحيب بصورة خلفية" },
        description: { en: "Full-bleed image with centered copy", ar: "صورة بعرض كامل" },
        thumbnail: "https://mock-brand.example/media/hero-overlay.jpg",
        pageTypes: ["standard"],
        capabilities: { requiresMedia: true },
        defaultSectionDocument: {
          id: "hero-overlay-section",
          sectionType: "hero",
          order: 0,
          editable: true,
          layout: { sourceComponent: "app/mock/components/Hero.tsx", contentAlignment: "center" },
          responsive: {},
          elements: [
            { id: "hero-overlay-heading", elementType: "heading", order: 0, editable: true, content: { en: { text: "Hello" }, ar: { text: "مرحبا" } }, source: null, styles: { alignment: "center" }, responsive: {}, validation: {}, editableProperties: ["content"], children: [] },
          ],
        },
      },
      {
        templateId: "store-grid",
        categoryId: "store",
        sectionType: "productCollection",
        layoutVariant: "grid",
        title: { en: "Product Grid", ar: "شبكة المنتجات" },
        thumbnail: "https://mock-brand.example/media/store-grid.jpg",
        pageTypes: ["standard", "dynamic"],
        capabilities: { requiresProducts: true },
        defaultSectionDocument: {
          id: "store-grid-section",
          sectionType: "productCollection",
          order: 0,
          editable: true,
          layout: { sourceComponent: "app/mock/components/Grid.tsx" },
          responsive: {},
          elements: [
            { id: "store-grid-collection", elementType: "productCollection", order: 0, editable: false, content: { source: "featured", limit: 8, columns: 4 }, source: { type: "collection", key: "featured" }, styles: {}, responsive: {}, validation: {}, editableProperties: [], children: [] },
          ],
        },
      },
    ],
  };
}

test("site manifest section library", async (t) => {
  await t.test("accepts a well-formed sectionLibrary and normalizes it", () => {
    const result = validateSiteManifest(validManifest({ sectionLibrary: validSectionLibrary() }));
    assert.equal(result.sectionLibrary.version, "1");
    assert.deepEqual(result.sectionLibrary.categories.map((category) => category.id), ["welcome", "store"]);
    assert.equal(result.sectionLibrary.blankSection.enabled, true);
    assert.equal(result.sectionLibrary.blankSection.sectionType, "content");
    assert.equal(result.sectionLibrary.templates[0].sectionType, "hero");
    assert.equal(result.sectionLibrary.templates[0].defaultSectionDocument.elements[0].content.en.text, "Hello");
  });

  await t.test("remains backward compatible when sectionLibrary is absent", () => {
    const result = validateSiteManifest(validManifest());
    assert.equal(result.sectionLibrary, null);
  });

  await t.test("rejects a template that references an unknown category", () => {
    const library = validSectionLibrary();
    library.templates[0].categoryId = "missing";
    assert.throws(() => validateSiteManifest(validManifest({ sectionLibrary: library })), /category/i);
  });

  await t.test("rejects a template whose section type differs from its defaultSectionDocument", () => {
    const library = validSectionLibrary();
    library.templates[0].sectionType = "promo";
    assert.throws(() => validateSiteManifest(validManifest({ sectionLibrary: library })), /match/i);
  });

  await t.test("rejects a thumbnail that is not a safe HTTPS URL", () => {
    const library = validSectionLibrary();
    library.templates[0].thumbnail = "http://mock-brand.example/media/hero-overlay.jpg";
    assert.throws(() => validateSiteManifest(validManifest({ sectionLibrary: library })), /https/i);
  });

  await t.test("filters template pageTypes to supported editable page types", () => {
    const library = validSectionLibrary();
    library.templates[0].pageTypes = ["standard", "system", "bogus"];
    const result = validateSiteManifest(validManifest({ sectionLibrary: library }));
    assert.deepEqual(result.sectionLibrary.templates[0].pageTypes, ["standard", "system"]);
  });

  await t.test("defaults blankSection to disabled when omitted", () => {
    const library = validSectionLibrary();
    delete library.blankSection;
    const result = validateSiteManifest(validManifest({ sectionLibrary: library }));
    assert.deepEqual(result.sectionLibrary.blankSection, { enabled: false });
  });

  await t.test("keeps product template content as configuration only", () => {
    const result = validateSiteManifest(validManifest({ sectionLibrary: validSectionLibrary() }));
    const collection = result.sectionLibrary.templates[1].defaultSectionDocument.elements[0];
    assert.equal(collection.elementType, "productCollection");
    assert.deepEqual(collection.content, { source: "featured", limit: 8, columns: 4 });
  });

  await t.test("product template configuration survives a draft round-trip", () => {
    const document = {
      id: "home:draft", companyId: "mock-brand", siteId: "mock-brand-storefront", pageId: "home",
      pageType: "standard", title: "Home", slug: "home", routePattern: "/", previewPath: "/",
      locale: "en", status: "draft", revision: 0,
      sections: [
        { id: "store-grid-section", type: "productCollection", order: 0, editable: true, settings: {}, styles: {}, responsive: {}, elements: [
          { id: "collection", type: "productCollection", content: { source: "featured", limit: 8, columns: 4, showPrice: true }, settings: {}, styles: {}, responsive: {}, children: [] },
        ] },
      ],
    };
    const roundTripped = validatePageDocument(document, { companyId: "mock-brand", pageId: "home", previewPath: "/", routePattern: "/" });
    assert.deepEqual(roundTripped.sections[0].elements[0].content, { source: "featured", limit: 8, columns: 4, showPrice: true });
  });
});
