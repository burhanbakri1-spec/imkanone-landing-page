export const platformRoles = Object.freeze({
  SUPER_ADMIN: "super_admin",
  COMPANY_ADMIN: "company_admin",
  EMPLOYEE: "employee",
  CUSTOMER: "customer",
});

export const legacyRoles = Object.freeze({
  ADMIN: "admin",
  MANAGER: "manager",
  STAFF: "staff",
});

export function hasRole(user, role) {
  return Boolean(user && typeof user.role === "string" && user.role === role);
}

export function isSuperAdmin(user) {
  return hasRole(user, platformRoles.SUPER_ADMIN);
}

export function isCompanyAdmin(user) {
  return hasRole(user, platformRoles.COMPANY_ADMIN) || hasRole(user, legacyRoles.ADMIN);
}
