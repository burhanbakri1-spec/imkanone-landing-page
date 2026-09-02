import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  canUseCatalogAction,
  catalogDirection,
  catalogPlaceholderPageKeys,
  hasShareLinkConfiguration,
  isCatalogPlaceholderPage,
} from "../src/utils/catalog.js";

const catalogSource = fs.readFileSync(new URL("../src/pages/AdminCatalogPage.jsx", import.meta.url), "utf8");
const appSource = fs.readFileSync(new URL("../src/CPanelApp.jsx", import.meta.url), "utf8");
const dashboardSource = fs.readFileSync(new URL("../src/pages/AdminDashboardPage.jsx", import.meta.url), "utf8");
const catalogCss = fs.readFileSync(new URL("../src/styles/global.css", import.meta.url), "utf8");

test("all requested Catalog placeholder routes render through the centralized Catalog page", () => {
  assert.equal(catalogPlaceholderPageKeys.length, 6);
  assert.equal(isCatalogPlaceholderPage("admin-tenant-placeholder-catalog-booking-services"), true);
  assert.equal(isCatalogPlaceholderPage("admin-tenant-placeholder-catalog-booking-channels-links"), true);
  assert.equal(isCatalogPlaceholderPage("admin-products"), false);
  assert.match(appSource, /catalogPlaceholderPageKeys\.includes\(activePage\)[\s\S]*?<AdminCatalogPage/);
});

test("Catalog pages hide the shell heading and render one page header", () => {
  assert.match(catalogSource, /<AdminLayout[\s\S]*?hideHeader/);
  assert.match(catalogSource, /function CatalogHeader/);
  assert.equal((catalogSource.match(/data-catalog-page-header/g) || []).length, 1);
});

test("Products, Categories, and Brands remain on their existing management flows", () => {
  assert.match(dashboardSource, /case "admin-products":[\s\S]*?<ProductsListPage/);
  assert.match(dashboardSource, /case "admin-categories":[\s\S]*?renderSimpleTable\("categories"\)/);
  assert.match(dashboardSource, /case "admin-brands":[\s\S]*?renderSimpleTable\("brands"\)/);
  for (const key of ["admin-products", "admin-categories", "admin-brands"]) {
    assert.equal(catalogPlaceholderPageKeys.includes(key), false);
  }
});

test("Catalog actions respect existing product permissions", () => {
  assert.equal(canUseCatalogAction({ role: "company_admin" }, "manage"), true);
  assert.equal(canUseCatalogAction({ role: "employee", permissions: ["products.view"] }, "view"), true);
  assert.equal(canUseCatalogAction({ role: "employee", permissions: ["products.view"] }, "manage"), false);
  assert.equal(canUseCatalogAction({ role: "employee", permissions: ["products.view", "products.create"] }, "manage"), true);
  assert.match(catalogSource, /if \(!canView \|\| !canManage\) return null/);
});

test("Catalog tables map only supplied real records and expose designed empty states", () => {
  assert.match(catalogSource, /services\.filter[\s\S]*?rows\.map\(\(service\)/);
  assert.match(catalogSource, /coupons\.filter[\s\S]*?rows\.map\(\(coupon\)/);
  assert.match(catalogSource, /discounts\.length[\s\S]*?discounts\.map\(\(discount\)/);
  for (const type of ["service", "coupon", "discount"]) {
    assert.match(catalogSource, new RegExp(`type=\\"${type}\\"`));
  }
});

test("unsupported Catalog mutations reuse the shared bilingual under-development flow", () => {
  assert.match(catalogSource, /AdminUnderDevelopmentContent/);
  assert.match(catalogSource, /const unsupported = \(\) => setShowUnsupported\(true\)/);
  assert.match(catalogSource, /aria-modal="true"/);
  assert.doesNotMatch(catalogSource, /\bConnected\b/);
});

test("share-link warning is derived only from real company storefront configuration", () => {
  assert.equal(hasShareLinkConfiguration({ storefrontUrl: "https://store.example" }), true);
  assert.equal(hasShareLinkConfiguration({ settings: { domain: "store.example" } }), true);
  assert.equal(hasShareLinkConfiguration({ settings: {} }), false);
  assert.match(catalogSource, /!configured && <section className="catalog-warning"/);
});

test("Catalog pages explicitly support English LTR and Arabic RTL", () => {
  assert.equal(catalogDirection("en"), "ltr");
  assert.equal(catalogDirection("ar"), "rtl");
  assert.match(catalogSource, /dir=\{catalogDirection\(language\)\}/);
  assert.match(catalogCss, /\[dir="rtl"\] \.catalog-page-header/);
});

test("Catalog layout is responsive and contains internal table scrolling", () => {
  const scoped = catalogCss.slice(catalogCss.indexOf("/* Tenant Catalog module */"));
  assert.match(scoped, /\.catalog-table-wrap \{ max-width: 100%; overflow-x: auto; \}/);
  assert.match(scoped, /\.catalog-gift-hero \{[\s\S]*?grid-template-columns: 1\.05fr \.95fr/);
  assert.match(scoped, /@media \(max-width: 760px\)[\s\S]*?\.catalog-links-grid \{ grid-template-columns: 1fr; \}/);
});
