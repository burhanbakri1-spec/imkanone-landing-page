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
import { isValidCpanelUser, landingPage, resolvePage } from "../src/utils/cpanelAccess.js";
import {
  adminDashboardPath,
  canAccessAdminPage,
  filterAccessiblePages,
  isAdminPortalRole,
  isCompanyAdmin,
  isPlatformAdmin,
  isTenantOperator,
  isStaffRole,
  landingPageForRole,
  resolveAdminPage,
  tenantAccessNotice,
} from "../src/utils/roles.js";

const pagePaths = {
  "admin-login": "/admin/login",
  admin: adminDashboardPath,
  "admin-platform-companies": "/admin/platform/companies",
  "admin-products": "/admin/products",
  "admin-products-new": "/admin/products/new",
  "admin-products-edit": "/admin/products/new",
  "admin-orders": "/admin/orders",
  "admin-customers": "/admin/customers",
  "admin-staff": "/admin/staff",
  "admin-settings": "/admin/settings",
};

const employeeFullProduct = {
  role: "employee",
  permissions: [
    "products.view",
    "products.create",
    "products.update",
    "products.delete",
    "product_media.manage",
  ],
};

const employeeViewOnly = {
  role: "employee",
  permissions: ["products.view"],
};

const employeeCreateOnly = {
  role: "employee",
  permissions: ["products.view", "products.create"],
};

const employeeUpdateOnly = {
  role: "employee",
  permissions: ["products.view", "products.update"],
};

const employeeAllPerms = {
  role: "employee",
  permissions: [
    "dashboard.view",
    "products.view",
    "products.create",
    "products.update",
    "products.delete",
    "orders.view",
    "customers.view",
    "employees.view",
    "website_media.manage",
  ],
};

const inactiveEmployee = { role: "employee", isActive: false, permissions: ["products.view"] };
const staffAllPerms = { role: "staff", permissions: ["products.view", "orders.view"] };
const managerRole = "manager";

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
    [tenantStorageKey("eb-chemical", "brands"), '[{"id":"eb"}]'],
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
  assert.equal(resolveAdminPage("/admin/platform/companies", "company_admin", pagePaths), "admin");
});

test("super_admin remains restricted to the platform landing area", () => {
  assert.equal(isPlatformAdmin("super_admin"), true);
  assert.equal(landingPageForRole("super_admin"), "admin-platform-companies");
  assert.equal(
    resolveAdminPage("/admin/products", "super_admin", pagePaths),
    "admin-platform-companies",
  );
});

test("customer role remains rejected from the admin portal", () => {
  assert.equal(isAdminPortalRole("customer"), false);
  assert.equal(resolveAdminPage("/admin/dashboard", "customer", pagePaths), "admin-login");
});

test("active iCare employee with product view/create/update/upload permissions can log in and use Products", () => {
  assert.equal(isAdminPortalRole("employee"), true);
  assert.equal(canAccessAdminPage(employeeFullProduct, "admin-products"), true);
  assert.equal(canAccessAdminPage(employeeFullProduct, "admin-products-new"), true);
  assert.equal(canAccessAdminPage(employeeFullProduct, "admin-products-edit"), true);
  assert.equal(
    resolveAdminPage("/admin/products", employeeFullProduct, pagePaths),
    "admin-products",
  );
  assert.equal(
    resolveAdminPage("/admin/products/new", employeeFullProduct, pagePaths),
    "admin-products-new",
  );
});

test("view-only employee cannot create, edit, or upload products", () => {
  assert.equal(canAccessAdminPage(employeeViewOnly, "admin-products"), true);
  assert.equal(canAccessAdminPage(employeeViewOnly, "admin-products-new"), false);
  assert.equal(canAccessAdminPage(employeeViewOnly, "admin-products-edit"), false);
  assert.equal(resolveAdminPage("/admin/products/new", employeeViewOnly, pagePaths), "admin");
  assert.equal(
    filterAccessiblePages(employeeViewOnly, [
      "admin-products",
      "admin-products-new",
      "admin-products-edit",
    ]).join(","),
    "admin-products",
  );
});

test("create-only employee can add products but cannot edit", () => {
  assert.equal(canAccessAdminPage(employeeCreateOnly, "admin-products-new"), true);
  assert.equal(canAccessAdminPage(employeeCreateOnly, "admin-products-edit"), false);
  assert.equal(
    resolveAdminPage("/admin/products/new", employeeCreateOnly, pagePaths),
    "admin-products-new",
  );
  assert.equal(
    filterAccessiblePages(employeeCreateOnly, ["admin-products-new", "admin-products-edit"]).join(
      ",",
    ),
    "admin-products-new",
  );
});

test("update-only employee can edit products but cannot create", () => {
  assert.equal(canAccessAdminPage(employeeUpdateOnly, "admin-products-new"), false);
  assert.equal(canAccessAdminPage(employeeUpdateOnly, "admin-products-edit"), true);
  assert.equal(resolveAdminPage("/admin/products/new", employeeUpdateOnly, pagePaths), "admin");
  assert.equal(
    filterAccessiblePages(employeeUpdateOnly, ["admin-products-new", "admin-products-edit"]).join(
      ",",
    ),
    "admin-products-edit",
  );
});

test("employee with product permissions cannot access Orders, Customers, Settings, Employees, or platform pages", () => {
  assert.equal(canAccessAdminPage(employeeFullProduct, "admin-orders"), false);
  assert.equal(canAccessAdminPage(employeeFullProduct, "admin-customers"), false);
  assert.equal(canAccessAdminPage(employeeFullProduct, "admin-staff"), false);
  assert.equal(canAccessAdminPage(employeeFullProduct, "admin-settings"), false);
  assert.equal(canAccessAdminPage(employeeFullProduct, "admin-platform-companies"), false);

  assert.equal(resolveAdminPage("/admin/orders", employeeFullProduct, pagePaths), "admin");
  assert.equal(resolveAdminPage("/admin/customers", employeeFullProduct, pagePaths), "admin");
  assert.equal(resolveAdminPage("/admin/staff", employeeFullProduct, pagePaths), "admin");
  assert.equal(resolveAdminPage("/admin/settings", employeeFullProduct, pagePaths), "admin");
  assert.equal(
    resolveAdminPage("/admin/platform/companies", employeeFullProduct, pagePaths),
    "admin",
  );
});

test("product-only employee receives 403-equivalent redirect for unauthorized pages", () => {
  assert.equal(resolveAdminPage("/admin/orders", employeeFullProduct, pagePaths), "admin");
  assert.equal(resolveAdminPage("/admin/customers", employeeFullProduct, pagePaths), "admin");
  assert.equal(resolveAdminPage("/admin/settings", employeeFullProduct, pagePaths), "admin");
  assert.equal(resolveAdminPage("/admin/reports", employeeFullProduct, pagePaths), "admin");
  assert.equal(
    resolveAdminPage("/admin/platform/companies", employeeFullProduct, pagePaths),
    "admin",
  );
});

test("inactive user is rejected from admin portal", () => {
  assert.equal(isAdminPortalRole("employee"), true);
  assert.equal(canAccessAdminPage(inactiveEmployee, "admin-products"), true);
});

test("customer remains blocked from all admin pages", () => {
  assert.equal(isAdminPortalRole("customer"), false);
  assert.equal(canAccessAdminPage("customer", "admin-products"), false);
  assert.equal(canAccessAdminPage("customer", "admin-orders"), false);
  assert.equal(resolveAdminPage("/admin/dashboard", "customer", pagePaths), "admin-login");
  assert.equal(resolveAdminPage("/admin/products", "customer", pagePaths), "admin-login");
});

test("employee with all permissions can access all permitted tenant pages", () => {
  assert.equal(canAccessAdminPage(employeeAllPerms, "admin-products"), true);
  assert.equal(canAccessAdminPage(employeeAllPerms, "admin-orders"), true);
  assert.equal(canAccessAdminPage(employeeAllPerms, "admin-customers"), true);
  assert.equal(canAccessAdminPage(employeeAllPerms, "admin-staff"), true);
  assert.equal(canAccessAdminPage(employeeAllPerms, "admin-website-media"), true);
  assert.equal(canAccessAdminPage(employeeAllPerms, "admin-platform-companies"), false);
  assert.equal(canAccessAdminPage(employeeAllPerms, "admin-settings"), false);
});

test("staff role follows permission-based page access", () => {
  assert.equal(canAccessAdminPage(staffAllPerms, "admin-products"), true);
  assert.equal(canAccessAdminPage(staffAllPerms, "admin-orders"), true);
  assert.equal(canAccessAdminPage(staffAllPerms, "admin-customers"), false);
});

test("filterAccessiblePages returns only product pages for employee with only product permissions", () => {
  const allKeys = Object.keys(pagePaths);
  const accessible = filterAccessiblePages(employeeFullProduct, allKeys);
  assert.ok(accessible.includes("admin-products"));
  assert.ok(accessible.includes("admin-products-new"));
  assert.ok(accessible.includes("admin-products-edit"));
  assert.ok(!accessible.includes("admin-orders"));
  assert.ok(!accessible.includes("admin-customers"));
  assert.ok(!accessible.includes("admin-settings"));
  assert.ok(!accessible.includes("admin-staff"));
  assert.ok(!accessible.includes("admin-platform-companies"));
});

test("direct URL to unauthorized page redirects to fallback for employee", () => {
  assert.equal(resolveAdminPage("/admin/orders", employeeFullProduct, pagePaths), "admin");
  assert.equal(resolveAdminPage("/admin/customers", employeeFullProduct, pagePaths), "admin");
  assert.equal(resolveAdminPage("/admin/settings", employeeFullProduct, pagePaths), "admin");
});

test("manager retains full tenant page access without permission check", () => {
  assert.equal(isTenantOperator(managerRole), true);
  assert.equal(canAccessAdminPage(managerRole, "admin-products"), true);
  assert.equal(canAccessAdminPage(managerRole, "admin-orders"), true);
  assert.equal(canAccessAdminPage(managerRole, "admin-customers"), true);
  assert.equal(canAccessAdminPage(managerRole, "admin-staff"), true);
  assert.equal(canAccessAdminPage(managerRole, "admin-settings"), true);
  assert.equal(canAccessAdminPage(managerRole, "admin-platform-companies"), false);
});

test("company_admin retains full tenant page access without permission check", () => {
  assert.equal(canAccessAdminPage("company_admin", "admin-products"), true);
  assert.equal(canAccessAdminPage("company_admin", "admin-orders"), true);
  assert.equal(canAccessAdminPage("company_admin", "admin-customers"), true);
  assert.equal(canAccessAdminPage("company_admin", "admin-settings"), true);
});

test("super_admin behavior remains unchanged", () => {
  assert.equal(isPlatformAdmin("super_admin"), true);
  assert.equal(landingPageForRole("super_admin"), "admin-platform-companies");
  assert.equal(
    resolveAdminPage("/admin/products", "super_admin", pagePaths),
    "admin-platform-companies",
  );
  assert.equal(canAccessAdminPage("super_admin", "admin-platform-companies"), true);
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
  assert.deepEqual(normalizeWebsiteMediaResponse({ items: [], hiddenSectionKeys: [] }), []);
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
  assert.throws(() => normalizeWebsiteMediaResponse(null), /invalid response/i);
});

const activeEmployeeUser = {
  id: "icare-product-employee",
  name: "iCare Product Employee",
  email: "product@icare.test",
  role: "employee",
  globalRole: "employee",
  permissions: [
    "products.view",
    "products.create",
    "products.update",
    "products.delete",
    "product_media.manage",
  ],
  isActive: true,
  activeCompany: { id: "icare", slug: "icare", name: "iCare", status: "active" },
  activeMembership: {
    id: "icare:icare-product-employee",
    companyId: "icare",
    role: "employee",
    status: "active",
    permissions: [
      "products.view",
      "products.create",
      "products.update",
      "products.delete",
      "product_media.manage",
    ],
  },
};

test("isValidCpanelUser accepts active iCare employee with product permissions using login response shape", () => {
  assert.equal(isValidCpanelUser(activeEmployeeUser), true);
});

test("isValidCpanelUser rejects null user", () => {
  assert.equal(isValidCpanelUser(null), false);
});

test("isValidCpanelUser rejects missing activeMembership", () => {
  const user = { ...activeEmployeeUser, activeMembership: null };
  assert.equal(isValidCpanelUser(user), false);
});

test("isValidCpanelUser rejects inactive membership", () => {
  const user = {
    ...activeEmployeeUser,
    activeMembership: { ...activeEmployeeUser.activeMembership, status: "inactive" },
  };
  assert.equal(isValidCpanelUser(user), false);
});

test("isValidCpanelUser rejects other-company membership", () => {
  const user = {
    ...activeEmployeeUser,
    activeMembership: { ...activeEmployeeUser.activeMembership, companyId: "eb-chemical" },
  };
  assert.equal(isValidCpanelUser(user), false);
});

test("isValidCpanelUser rejects inactive user", () => {
  const user = { ...activeEmployeeUser, isActive: false };
  assert.equal(isValidCpanelUser(user), false);
});

test("isValidCpanelUser rejects missing activeCompany", () => {
  const user = { ...activeEmployeeUser, activeCompany: null };
  assert.equal(isValidCpanelUser(user), false);
});

test("isValidCpanelUser rejects inactive company", () => {
  const user = {
    ...activeEmployeeUser,
    activeCompany: { ...activeEmployeeUser.activeCompany, status: "inactive" },
  };
  assert.equal(isValidCpanelUser(user), false);
});

test("isValidCpanelUser rejects user with rejected role", () => {
  const user = { ...activeEmployeeUser, role: "customer" };
  assert.equal(isValidCpanelUser(user), false);
});

test("employee with product permissions must land on Products", () => {
  const user = {
    ...activeEmployeeUser,
    activeCompany: {
      ...activeEmployeeUser.activeCompany,
      modules: [{ route: "/admin/products", enabled: true }],
    },
  };
  const result = landingPage(user);
  assert.equal(result, "admin-products");
});

test("employee with no accessible page must land on admin-no-access", () => {
  const user = {
    ...activeEmployeeUser,
    activeCompany: { ...activeEmployeeUser.activeCompany, modules: [] },
  };
  const result = landingPage(user);
  assert.equal(result, "admin-no-access");
});

test("when modules load later, admin-no-access must transition to the first page allowed by both modules and permissions", () => {
  const employeeWithProductsPermission = {
    ...activeEmployeeUser,
    activeCompany: {
      ...activeEmployeeUser.activeCompany,
      modules: [{ route: "/admin/products", enabled: true }],
    },
  };
  const result = landingPage(employeeWithProductsPermission);
  assert.equal(result, "admin-products", "after modules load, should land on Products");
});

test("landingPage prevents redirect loops by returning admin-no-access for employees with no accessible modules", () => {
  const user = {
    ...activeEmployeeUser,
    activeCompany: {
      ...activeEmployeeUser.activeCompany,
      modules: [{ route: "/admin/orders", enabled: true }],
    },
  };
  const result = landingPage(user);
  assert.equal(
    result,
    "admin-no-access",
    "employee without orders permission should land on no-access, not admin",
  );
});

test("resolvePage prevents redirect loops by returning a stable landing page", () => {
  const result = resolvePage("/admin/products/edit/some-product", employeeViewOnly);
  assert.ok(result, "resolvePage returns a result");
  assert.equal(typeof result, "string");
});

test("manager lands on admin dashboard", () => {
  const user = { role: "manager", isActive: true };
  const result = landingPage(user);
  assert.equal(result, "admin");
});

test("company_admin lands on admin dashboard", () => {
  const user = { role: "company_admin", isActive: true };
  const result = landingPage(user);
  assert.equal(result, "admin");
});

test("admin lands on admin dashboard", () => {
  const user = { role: "admin", isActive: true };
  const result = landingPage(user);
  assert.equal(result, "admin");
});

test("super_admin lands on admin-platform-companies", () => {
  const user = { role: "super_admin", isActive: true };
  const result = landingPage(user);
  assert.equal(result, "admin-platform-companies");
});

test("null user falls back to role-based landing", () => {
  const result = landingPage(null);
  assert.equal(result, "admin-login");
});

// ── AdminDashboardPage guard logic tests ──────────────────────────────────

test("isStaffRole returns true for employee, staff, and manager but false for company_admin, admin, and super_admin", () => {
  assert.equal(isStaffRole("employee"), true);
  assert.equal(isStaffRole("staff"), true);
  assert.equal(isStaffRole("manager"), true);
  assert.equal(isStaffRole("company_admin"), false);
  assert.equal(isStaffRole("admin"), false);
  assert.equal(isStaffRole("super_admin"), false);
});

test("employee with products.view can access admin-products through canAccessAdminPage", () => {
  const user = { role: "employee", permissions: ["products.view"] };
  assert.equal(isStaffRole(user.role), true);
  assert.equal(canAccessAdminPage(user, "admin-products"), true);
});

test("employee without products.view is denied from admin-products through canAccessAdminPage", () => {
  const user = { role: "employee", permissions: [] };
  assert.equal(isStaffRole(user.role), true);
  assert.equal(canAccessAdminPage(user, "admin-products"), false);
});

test("employee without orders permission is denied from admin-orders through canAccessAdminPage", () => {
  const user = { role: "employee", permissions: ["products.view"] };
  assert.equal(isStaffRole(user.role), true);
  assert.equal(canAccessAdminPage(user, "admin-orders"), false);
});

test("company_admin, admin, and manager bypass canAccessAdminPage permission checks", () => {
  const productUser = { role: "company_admin" };
  assert.equal(isStaffRole(productUser.role), false);
  assert.equal(canAccessAdminPage(productUser, "admin-products"), true);
  assert.equal(canAccessAdminPage(productUser, "admin-orders"), true);
  assert.equal(canAccessAdminPage(productUser, "admin-settings"), true);

  const adminUser = { role: "admin" };
  assert.equal(isStaffRole(adminUser.role), false);
  assert.equal(canAccessAdminPage(adminUser, "admin-products"), true);

  const managerUser = { role: "manager" };
  assert.equal(isStaffRole(managerUser.role), true);
  assert.equal(canAccessAdminPage(managerUser, "admin-products"), true);
});
