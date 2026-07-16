const platformPageKeys = new Set(["admin-platform-companies"]);
export const adminDashboardPath = "/admin/dashboard";

export function isPlatformAdmin(role) {
  return role === "super_admin";
}

export function isCompanyAdmin(role) {
  return role === "admin" || role === "company_admin";
}

export function isStaffRole(role) {
  return role === "employee" || role === "staff" || role === "manager";
}

export function isTenantOperator(role) {
  return isCompanyAdmin(role) || role === "manager";
}

export function isAdminPortalRole(role) {
  return isPlatformAdmin(role) || isTenantOperator(role);
}

export function isPlatformPage(page) {
  return platformPageKeys.has(page);
}

export function landingPageForRole(role) {
  if (isPlatformAdmin(role)) return "admin-platform-companies";
  if (isTenantOperator(role)) return "admin";
  return "admin-login";
}

export function canAccessAdminPage(role, page) {
  if (page === "admin-login") return !isAdminPortalRole(role);
  if (isPlatformPage(page)) return isPlatformAdmin(role);
  return isTenantOperator(role);
}

export function resolveAdminPage(pathname, role, pagePaths) {
  if (pathname === "/" || pathname === "/admin" || pathname === adminDashboardPath) {
    return landingPageForRole(role);
  }

  const match = Object.entries(pagePaths).find(([, path]) => path === pathname);
  if (!match) return landingPageForRole(role);
  if (match[0] === "admin-login") {
    return isAdminPortalRole(role) ? landingPageForRole(role) : match[0];
  }

  return canAccessAdminPage(role, match[0])
    ? match[0]
    : landingPageForRole(role);
}

export function tenantAccessNotice(role) {
  if (isCompanyAdmin(role)) return null;
  if (role === "manager") {
    return "Manager access: content, catalog, orders, customers, and reviews can be managed. Staff and settings are restricted.";
  }
  return "Employee access: admin sections are available in view-only mode.";
}
