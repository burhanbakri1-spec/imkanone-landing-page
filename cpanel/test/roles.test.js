import assert from "node:assert/strict";
import test from "node:test";

import { hasPermission } from "../src/data/permissions.js";
import { createApiHeaders } from "../src/utils/api.js";
import { fetchBrands, fetchCategories } from "../src/utils/catalogApi.js";
import {
  clearTenantCaches,
  sanitizeCompanyContext,
  tenantStorageKey,
} from "../src/utils/companyContext.js";
import { getSelectableAdminCategories } from "../src/utils/adminCategories.js";
import { getOrders } from "../src/utils/orders.js";
import {
  fetchAllWebsiteMedia,
  normalizeWebsiteMediaResponse,
} from "../src/utils/websiteMediaApi.js";
import {
  adminDashboardPath,
  canAccessAdminPage,
  isAdminPortalRole,
  isCompanyAdmin,
  isPlatformAdmin,
  landingPageForRole,
  resolveAdminPage,
  tenantAccessNotice,
} from "../src/utils/roles.js";

const pagePaths = {
  "admin-login": "/admin/login",
  admin: adminDashboardPath,
  "admin-platform-companies": "/admin/platform/companies",
  "admin-products": "/admin/products",
};

test("company_admin is accepted and lands on the tenant dashboard", () => {
  assert.equal(isAdminPortalRole("company_admin"), true);
  assert.equal(isCompanyAdmin("company_admin"), true);
  assert.equal(landingPageForRole("company_admin"), "admin");
  assert.equal(resolveAdminPage("/admin/login", "company_admin", pagePaths), "admin");
  assert.equal(pagePaths[landingPageForRole("company_admin")], "/admin/dashboard");
  assert.equal(hasPermission({ role: "company_admin" }, "website_media.manage"), true);
  assert.equal(tenantAccessNotice("company_admin"), null);
});

test("authenticated company summaries drive iCare and EB branding without hardcoding", () => {
  const icare = sanitizeCompanyContext({
    id: "icare",
    slug: "icare",
    name: "iCare",
    settings: {
      faviconUrl: "/uploads/icare-favicon.png",
      logoUrl: "/uploads/icare-logo.png",
    },
  });
  const eb = sanitizeCompanyContext({
    id: "eb-chemical",
    slug: "eb-chemical",
    name: "EB Chemical",
    settings: { logoUrl: "/images/brand/ep-chemical-logo.png" },
  });

  assert.equal(icare.name, "iCare");
  assert.equal(icare.logoUrl, "http://localhost:5000/uploads/icare-logo.png");
  assert.equal(icare.faviconUrl, "http://localhost:5000/uploads/icare-favicon.png");
  assert.equal(eb.name, "EB Chemical");
  assert.equal(eb.logoUrl, "http://localhost:5000/images/brand/ep-chemical-logo.png");
});

test("empty tenant category and brand responses remain empty", async () => {
  const originalFetch = globalThis.fetch;
  const originalLocalStorage = globalThis.localStorage;
  globalThis.localStorage = { getItem: () => "tenant-token" };
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    async json() {
      return [];
    },
  });

  try {
    assert.deepEqual(await fetchCategories(), []);
    assert.deepEqual(await fetchBrands(), []);
    assert.deepEqual(getSelectableAdminCategories([]), []);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalLocalStorage;
  }
});

test("switching companies clears prior tenant cache keys", () => {
  const values = new Map([
    [tenantStorageKey("eb-chemical", "brands"), "[{\"id\":\"eb\"}]"],
    [tenantStorageKey("icare", "brands"), "[]"],
    ["epChemicalLanguage", "en"],
  ]);
  const storage = {
    get length() {
      return values.size;
    },
    getItem(key) {
      return values.get(key) ?? null;
    },
    key(index) {
      return [...values.keys()][index] ?? null;
    },
    removeItem(key) {
      values.delete(key);
      delete this[key];
    },
  };
  for (const key of values.keys()) storage[key] = values.get(key);
  const originalLocalStorage = globalThis.localStorage;
  const originalSessionStorage = globalThis.sessionStorage;
  globalThis.localStorage = storage;
  globalThis.sessionStorage = { ...storage };

  try {
    clearTenantCaches();
    assert.equal(values.has(tenantStorageKey("eb-chemical", "brands")), false);
    assert.equal(values.has(tenantStorageKey("icare", "brands")), false);
    assert.equal(values.get("epChemicalLanguage"), "en");
  } finally {
    globalThis.localStorage = originalLocalStorage;
    globalThis.sessionStorage = originalSessionStorage;
  }
});

test("company_admin cannot navigate to platform company management", () => {
  assert.equal(isPlatformAdmin("company_admin"), false);
  assert.equal(canAccessAdminPage("company_admin", "admin-platform-companies"), false);
  assert.equal(
    resolveAdminPage("/admin/platform/companies", "company_admin", pagePaths),
    "admin",
  );
});

test("super_admin remains restricted to the platform landing area", () => {
  assert.equal(isPlatformAdmin("super_admin"), true);
  assert.equal(landingPageForRole("super_admin"), "admin-platform-companies");
  assert.equal(resolveAdminPage("/admin/products", "super_admin", pagePaths), "admin-platform-companies");
});

test("customer and employee roles remain rejected from the admin portal", () => {
  for (const role of ["customer", "employee", "staff"]) {
    assert.equal(isAdminPortalRole(role), false);
    assert.equal(resolveAdminPage("/admin/dashboard", role, pagePaths), "admin-login");
  }
});

test("tenant API headers use only the authenticated token for company context", () => {
  const headers = createApiHeaders("icare-membership-token", {
    "X-Company-Id": "eb-chemical",
  });
  assert.equal(headers.Authorization, "Bearer icare-membership-token");
  assert.equal(headers["X-Company-Id"], undefined);
  assert.equal(headers["x-company-id"], undefined);
});

test("iCare company_admin loads tenant orders without an EB fallback or company override", async () => {
  const originalFetch = globalThis.fetch;
  const originalLocalStorage = globalThis.localStorage;
  let request;

  globalThis.localStorage = {
    getItem(key) {
      return key === "epChemicalJwt" ? "icare-membership-token" : null;
    },
  };
  globalThis.fetch = async (url, options) => {
    request = { options, url: String(url) };
    return {
      ok: true,
      status: 200,
      async json() {
        return { orders: [] };
      },
    };
  };

  try {
    await getOrders({
      activeCompany: { id: "icare" },
      role: "company_admin",
    });
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalLocalStorage;
  }

  assert.equal(request.url, "http://localhost:5000/api/orders");
  assert.equal(request.options.headers.Authorization, "Bearer icare-membership-token");
  assert.equal(request.options.headers["X-Company-Id"], undefined);
  assert.equal(request.url.includes("eb-chemical"), false);
});

test("website media array responses remain arrays and empty responses remain empty", () => {
  const media = [{ id: "icare-media", sectionKey: "hero" }];
  assert.equal(normalizeWebsiteMediaResponse(media), media);
  assert.deepEqual(normalizeWebsiteMediaResponse([]), []);
  assert.deepEqual(
    normalizeWebsiteMediaResponse({ items: [], hiddenSectionKeys: [] }),
    [],
  );
});

test("authenticated website media object responses are normalized before rendering", async () => {
  const originalFetch = globalThis.fetch;
  const originalLocalStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem(key) {
      return key === "epChemicalJwt" ? "icare-membership-token" : null;
    },
    removeItem() {},
  };
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    async json() {
      return {
        items: [{ id: "icare-media", sectionKey: "hero", imageUrl: "/icare.jpg" }],
        hiddenSectionKeys: ["legacy-eb-section"],
      };
    },
  });

  try {
    assert.deepEqual(await fetchAllWebsiteMedia(), [
      { id: "icare-media", sectionKey: "hero", imageUrl: "/icare.jpg" },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalLocalStorage;
  }
});

test("malformed website media responses fail visibly instead of crashing array rendering", () => {
  assert.throws(
    () => normalizeWebsiteMediaResponse({ items: { id: "not-an-array" } }),
    /invalid response/i,
  );
  assert.throws(
    () => normalizeWebsiteMediaResponse(null),
    /invalid response/i,
  );
});
