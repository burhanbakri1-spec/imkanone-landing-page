import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { getNavigationItem } from "../src/data/adminNavigation.js";
import {
  canViewMarketing,
  confirmedMarketingContext,
  isMarketingPage,
  marketingDirection,
  marketingPageKeys,
  metaSalesAvailable,
  resolveMarketingDestination,
} from "../src/utils/marketing.js";

const pageSource = fs.readFileSync(new URL("../src/pages/AdminMarketingPage.jsx", import.meta.url), "utf8");
const appSource = fs.readFileSync(new URL("../src/CPanelApp.jsx", import.meta.url), "utf8");
const cssSource = fs.readFileSync(new URL("../src/styles/global.css", import.meta.url), "utf8");

const company = { id: "icare", name: "iCare", slug: "icare", storefrontUrl: "https://igroup.website/icare" };
const companyAdmin = { activeCompany: company, role: "company_admin" };

test("all seven Marketing routes use the dedicated tenant page", () => {
  assert.equal(marketingPageKeys.length, 7);
  for (const pageKey of marketingPageKeys) {
    assert.equal(isMarketingPage(pageKey), true);
    assert.ok(getNavigationItem(pageKey)?.path);
  }
  assert.equal(isMarketingPage("admin-products"), false);
  assert.match(appSource, /marketingPageKeys\.includes\(activePage\)[\s\S]*?<AdminMarketingPage/);
});

test("Marketing access requires an authenticated company scope and tenant operator role", () => {
  assert.equal(canViewMarketing(companyAdmin, company), true);
  assert.equal(canViewMarketing({ role: "manager" }, company), true);
  assert.equal(canViewMarketing({ role: "super_admin" }, company), true);
  assert.equal(canViewMarketing({ role: "super_admin" }), false);
  assert.equal(canViewMarketing({ role: "employee", permissions: [] }, company), false);
});

test("safe Marketing destinations retain existing permission and module guards", () => {
  const modules = [{ enabled: true, route: "/admin/settings" }, { enabled: true, route: "/admin/website-media" }];
  assert.equal(resolveMarketingDestination("companySettings", { currentUser: companyAdmin, modules }), "admin-settings");
  assert.equal(resolveMarketingDestination("websiteContent", { currentUser: companyAdmin, modules }), "admin-website-media");
  assert.equal(resolveMarketingDestination("siteOverview", { currentUser: companyAdmin, modules }), "admin-tenant-placeholder-site-overview");
  assert.equal(resolveMarketingDestination("companySettings", { currentUser: companyAdmin, modules: [] }), null);
});

test("Marketing context never fabricates records or connection states", () => {
  const context = confirmedMarketingContext(company);
  assert.equal(context.companyName, "iCare");
  assert.equal(context.storefrontUrl, "https://igroup.website/icare");
  assert.deepEqual(context.campaigns, []);
  assert.deepEqual(context.socialPosts, []);
  assert.deepEqual(context.connectedAccounts, []);
  assert.deepEqual(context.integrations, []);
  assert.equal(context.referralProgram, null);
  assert.equal(metaSalesAvailable(), false);
});

test("SEO page includes assistant, Search Console, AI visibility, learning, and full tool grid", () => {
  assert.match(pageSource, /marketing-seo-assistant/);
  assert.match(pageSource, /marketing-search-console/);
  assert.match(pageSource, /marketing-ai-visibility/);
  assert.match(pageSource, /ChatGPT[\s\S]*?Gemini[\s\S]*?Perplexity[\s\S]*?Claude/);
  assert.match(pageSource, /marketing-learning-panel/);
  assert.match(pageSource, /marketing-tools-grid/);
  assert.match(pageSource, /"SEO checklist"[\s\S]*?"robots\.txt"[\s\S]*?"llms\.txt"[\s\S]*?"Google Business Profile"/);
});

test("Google and Meta Ads use distinct onboarding and honest connection states", () => {
  assert.match(pageSource, /marketing-google-ads-hero/);
  assert.match(pageSource, /marketing-ad-preview/);
  assert.match(pageSource, /marketing-meta-hero/);
  assert.match(pageSource, /marketing-meta-goals/);
  assert.match(pageSource, /disabled=\{!sales\}/);
  assert.match(pageSource, /No Facebook account, Instagram account, pixel, catalog, or payment method is confirmed/);
});

test("Email Marketing uses templates as examples and renders a real-record empty state", () => {
  assert.match(pageSource, /marketing-email-banner/);
  assert.match(pageSource, /These examples are not saved campaigns/);
  assert.match(pageSource, /marketing-email-campaigns/);
  assert.match(pageSource, /No email campaigns/);
  assert.match(pageSource, /Monthly balance[\s\S]*?Sender details[\s\S]*?Automated emails[\s\S]*?AI email help/);
});

test("Social Marketing keeps two tabs, account states, planner, table, and empty state", () => {
  assert.match(pageSource, /role="tablist"/);
  assert.match(pageSource, /"Create & Publish"/);
  assert.match(pageSource, /"Your Social Posts"/);
  assert.match(pageSource, /marketing-social-accounts/);
  assert.match(pageSource, /marketing-planner-calendar/);
  assert.match(pageSource, /marketing-posts-table-head/);
  assert.match(pageSource, /No social posts/);
});

test("Referral and Google Business pages preserve setup-only split heroes", () => {
  assert.match(pageSource, /marketing-referral-banner/);
  assert.match(pageSource, /marketing-referral-hero/);
  assert.match(pageSource, /marketing-business-hero/);
  assert.match(pageSource, /No Google account, profile, Maps listing, location, or reviews are currently confirmed/);
});

test("unsupported Marketing actions use the shared bilingual flow", () => {
  assert.match(pageSource, /AdminUnderDevelopmentContent/);
  assert.match(pageSource, /const unsupported = \(\) => setShowUnsupported\(true\)/);
  assert.match(pageSource, /else fallback\(\)/);
});

test("Marketing pages render one title and support RTL, LTR, and responsive layouts", () => {
  assert.match(pageSource, /<AdminLayout[\s\S]*?hideHeader/);
  assert.equal((pageSource.match(/data-marketing-page-header/g) || []).length, 1);
  assert.equal(marketingDirection("ar"), "rtl");
  assert.equal(marketingDirection("en"), "ltr");
  assert.match(pageSource, /data-marketing-direction=\{marketingDirection\(language\)\}/);
  assert.match(cssSource, /\[dir="rtl"\] \.marketing-page-header/);
  assert.match(cssSource, /@media \(max-width: 620px\)[\s\S]*?\.marketing-page-header/);
});

test("Marketing CSS is contained in one named scoped section", () => {
  assert.equal((cssSource.match(/\/\* Tenant Marketing pages \*\//g) || []).length, 1);
  assert.match(cssSource, /\.tenant-marketing-page/);
  assert.match(cssSource, /\.marketing-google-ads-hero/);
  assert.match(cssSource, /\.marketing-business-hero/);
});
