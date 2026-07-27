import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  getNavigationItem,
  navigationContainsPage,
  placeholderPagePaths,
  platformNavigation,
  tenantNavigation,
  toggleExclusiveGroup,
  toggleExclusivePopover,
} from "../src/data/adminNavigation.js";
import { createTranslator } from "../src/data/translations.js";
import { canAccessAdminPage } from "../src/utils/roles.js";
import { resolvePage } from "../src/utils/cpanelAccess.js";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("main navigation groups expand exclusively and can collapse", () => {
  assert.equal(toggleExclusiveGroup(null, "catalog"), "catalog");
  assert.equal(toggleExclusiveGroup("catalog", "sales"), "sales");
  assert.equal(toggleExclusiveGroup("sales", "sales"), null);
});

test("top-bar popovers are mutually exclusive", () => {
  assert.equal(toggleExclusivePopover(null, "resources"), "resources");
  assert.equal(toggleExclusivePopover("resources", "notifications"), "notifications");
  assert.equal(toggleExclusivePopover("notifications", "notifications"), null);
});

test("placeholder routes are bilingual frontend-only destinations", () => {
  const tenantItem = getNavigationItem("admin-tenant-placeholder-ai-agents-personal-assistant");
  const platformItem = getNavigationItem("admin-platform-placeholder-mobile-apps");
  assert.equal(tenantItem.placeholder, true);
  assert.equal(platformItem.placeholder, true);
  assert.equal(placeholderPagePaths[tenantItem.pageKey], "/admin/coming-soon/ai-agents/personal-assistant");
  assert.equal(placeholderPagePaths[platformItem.pageKey], "/admin/platform/coming-soon/mobile-apps");
  assert.equal(createTranslator("en")("adminShell.underDevelopment"), "This page is under development");
  assert.equal(createTranslator("ar")("adminShell.underDevelopment"), "هذه الصفحة قيد التطوير");
});

test("placeholder role visibility preserves platform and tenant isolation", () => {
  assert.equal(canAccessAdminPage("super_admin", "admin-platform-placeholder-mobile-apps"), true);
  assert.equal(canAccessAdminPage("company_admin", "admin-platform-placeholder-mobile-apps"), false);
  assert.equal(canAccessAdminPage("company_admin", "admin-tenant-placeholder-ai-agents-personal-assistant"), true);
  assert.equal(canAccessAdminPage({ role: "employee", permissions: ["products.view"] }, "admin-tenant-placeholder-ai-agents-personal-assistant"), false);
});

test("placeholder routes resolve on direct refresh without crossing scopes", () => {
  assert.equal(
    resolvePage("/admin/coming-soon/ai-agents/personal-assistant", { role: "company_admin" }),
    "admin-tenant-placeholder-ai-agents-personal-assistant",
  );
  assert.equal(
    resolvePage("/admin/platform/coming-soon/mobile-apps", { role: "super_admin" }),
    "admin-platform-placeholder-mobile-apps",
  );
  assert.equal(
    resolvePage("/admin/platform/coming-soon/mobile-apps", { role: "company_admin" }),
    "admin",
  );
});

test("active navigation recognizes nested destinations", () => {
  const catalog = tenantNavigation.find((item) => item.id === "tenant-catalog");
  const templates = platformNavigation.find((item) => item.id === "platform-templates");
  assert.equal(navigationContainsPage(catalog, "admin-products"), true);
  assert.equal(navigationContainsPage(catalog, "admin-orders"), false);
  assert.equal(navigationContainsPage(templates, "admin-platform-placeholder-templates-studio-editor"), true);
});

test("existing functional destinations remain in the centralized navigation", () => {
  for (const pageKey of [
    "admin",
    "admin-products",
    "admin-categories",
    "admin-brands",
    "admin-orders",
    "admin-customers",
    "admin-staff",
    "admin-settings",
    "admin-platform-companies",
    "admin-platform-domains",
  ]) {
    assert.ok(getNavigationItem(pageKey), `${pageKey} should remain navigable`);
  }
});

test("tenant shell uses the enlarged sidebar and real Quick Actions popover", () => {
  const layout = read("src/components/AdminLayout.jsx");
  const css = read("src/styles/global.css");
  assert.match(layout, /admin-sidebar-quick-actions/);
  assert.match(layout, /activePopover === "quickActions"/);
  assert.match(layout, /admin-quick-actions-popover/);
  assert.match(css, /--studio-sidebar-width:\s*300px/);
  assert.match(css, /\.admin-studio-shell \.admin-nav-button[\s\S]*?font-size:\s*14px/);
  assert.match(css, /\.admin-studio-shell\.admin-tenant \.dashboard[\s\S]*?max-width:\s*none/);
  assert.match(css, /width:\s*min\(100%, 1500px\)/);
});

test("platform shell has a separately scoped light sidebar and larger company cards", () => {
  const css = read("src/styles/global.css");
  assert.match(css, /\.admin-studio-shell\.admin-platform \.admin-sidebar[\s\S]*?width:\s*304px[\s\S]*?background:\s*#fff/);
  assert.match(css, /\.admin-platform \.company-cards-grid[\s\S]*?minmax\(400px, 1fr\)/);
  assert.match(css, /\.admin-platform \.company-card-preview-img[\s\S]*?object-fit:\s*contain/);
});

test("CPanel shell fixes the viewport and isolates sidebar and workspace scrolling", () => {
  const css = read("src/styles/global.css");
  assert.match(css, /\.admin-studio-shell \{[\s\S]*?position:\s*fixed;[\s\S]*?height:\s*100vh;[\s\S]*?overflow:\s*hidden/);
  assert.match(css, /\.admin-studio-shell \.admin-sidebar,[\s\S]*?position:\s*fixed;[\s\S]*?height:\s*calc\(100vh - var\(--admin-topnav-h\)\);[\s\S]*?overflow-y:\s*auto/);
  assert.match(css, /\.admin-studio-shell \.admin-workspace \{[\s\S]*?position:\s*fixed;[\s\S]*?overflow-y:\s*auto/);
  assert.match(css, /@media \(max-width: 980px\)[\s\S]*?\.admin-studio-shell \.admin-sidebar[\s\S]*?z-index:\s*1200/);
});

test("header renders anchored dropdowns and fixed right-side panels", () => {
  const layout = read("src/components/AdminLayout.jsx");
  const css = read("src/styles/global.css");
  assert.match(layout, /admin-topnav-menu-anchor[\s\S]*?active="resources"/);
  assert.match(layout, /admin-topnav-menu-anchor[\s\S]*?active="community"/);
  assert.match(layout, /admin-profile-anchor[\s\S]*?active="profile"/);
  assert.match(layout, /\["help", "inbox", "notifications", "news", "quickActions"\]\.includes\(activePopover\)/);
  assert.match(css, /\.admin-topnav-menu-anchor > \.admin-shell-dropdown \{[\s\S]*?position:\s*absolute/);
  assert.match(css, /\.admin-studio-shell \.admin-shell-panel \{[\s\S]*?position:\s*fixed;[\s\S]*?height:\s*calc\(100vh - var\(--admin-topnav-h\)\)/);
});

test("Escape and outside pointer interactions close the active popover", () => {
  const layout = read("src/components/AdminLayout.jsx");
  assert.match(layout, /event\.key === "Escape" && setActivePopover\(null\)/);
  assert.match(layout, /!event\.target\.closest\("\[data-admin-popover-root\]"\)/);
  assert.match(layout, /document\.addEventListener\("keydown", closeOnEscape\)/);
  assert.match(layout, /document\.addEventListener\("pointerdown", closeOutside\)/);
});
