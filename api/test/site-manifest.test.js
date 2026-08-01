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
