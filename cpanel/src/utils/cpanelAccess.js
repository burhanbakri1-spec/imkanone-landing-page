import {
  canAccessAdminPage,
  filterAccessiblePages,
  isAdminPortalRole,
  isPlatformAdmin,
  landingPageForRole,
  resolveAdminPage,
} from "./roles.js";
import { pageKeyForModule } from "./moduleRegistry.js";

export function isValidCpanelUser(user) {
  if (!user) return false;
  if (!isAdminPortalRole(user.role)) return false;
  if (user.isActive === false) return false;
  if (!user.activeCompany) return false;
  if (user.activeCompany.status === "inactive") return false;
  if (user.companyId && user.activeCompany.id !== user.companyId) return false;
  const membership = user.activeMembership;
  if (!membership) return false;
  if (membership.status !== "active") return false;
  if (membership.companyId !== user.activeCompany.id) return false;
  return true;
}

export function landingPage(user, overrideModules) {
  if (!user) return landingPageForRole();
  const role = user.role;
  if (isPlatformAdmin(role)) return "admin-platform-companies";
  if (["company_admin", "admin"].includes(role)) return "admin";
  if (role === "manager") return "admin";
  const moduleList =
    overrideModules && overrideModules.length ? overrideModules : user.activeCompany?.modules || [];
  if (moduleList.length) {
    const accessible = filterAccessiblePages(
      user,
      moduleList.map((m) => pageKeyForModule(m)).filter(Boolean),
    );
    if (accessible.length) return accessible[0];
  }
  return "admin-no-access";
}

export function resolvePage(pathname, user, navigationModules) {
  if (/^\/admin\/products\/[^/]+\/edit$/.test(pathname)) {
    return canAccessAdminPage(user, "admin-products-edit")
      ? "admin-products-edit"
      : landingPage(user, navigationModules);
  }
  const resolved = resolveAdminPage(pathname, user, pagePaths);
  if (resolved === "admin" && !["company_admin", "admin"].includes(user?.role)) {
    return landingPage(user, navigationModules);
  }
  if (resolved === "admin" && user?.role === "manager") return resolved;
  return resolved;
}

const pagePaths = {
  "admin-login": "/admin/login",
  admin: "/admin/dashboard",
  "admin-platform-companies": "/admin/platform/companies",
  "admin-products": "/admin/products",
  "admin-products-new": "/admin/products/new",
  "admin-products-edit": "/admin/products/new",
  "admin-categories": "/admin/categories",
  "admin-categories-new": "/admin/categories/new",
  "admin-brands": "/admin/brands",
  "admin-brands-new": "/admin/brands/new",
  "admin-vlogs": "/admin/vlogs",
  "admin-vlogs-new": "/admin/vlogs/new",
  "admin-store-locator": "/admin/store-locator",
  "admin-store-locator-new": "/admin/store-locator/new",
  "admin-website-media": "/admin/website-media",
  "admin-website-texts": "/admin/website-texts",
  "admin-orders": "/admin/orders",
  "admin-reviews": "/admin/reviews",
  "admin-inventory": "/admin/inventory",
  "admin-customers": "/admin/customers",
  "admin-staff": "/admin/staff",
  "admin-staff-new": "/admin/staff/new",
  "admin-employees": "/admin/staff",
  "admin-settings": "/admin/settings",
  "admin-product-settings": "/admin/product-settings",
  "admin-invoices": "/admin/invoices",
  "admin-delivery": "/admin/delivery",
  "admin-reports": "/admin/reports",
  "admin-activity-log": "/admin/activity-log",
  "admin-unit-creator": "/admin/unit-creator",
  "admin-dropshipping": "/admin/dropshipping",
  "admin-dropshipping-marketers": "/admin/dropshipping/marketers",
  "admin-dropshipping-products": "/admin/dropshipping/products",
  "admin-dropshipping-orders": "/admin/dropshipping/orders",
  "admin-dropshipping-earnings": "/admin/dropshipping/earnings",
  "admin-dropshipping-withdrawals": "/admin/dropshipping/withdrawals",
  "admin-dropshipping-reports": "/admin/dropshipping/reports",
  "admin-dropshipping-settings": "/admin/dropshipping/settings",
  "admin-no-access": "/admin/no-access",
};
