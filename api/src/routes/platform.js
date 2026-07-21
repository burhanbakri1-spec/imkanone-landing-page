import crypto from "node:crypto";
import { Router } from "express";
import { platformRoles } from "../auth/roles.js";
import { hashPassword } from "../auth/passwords.js";
import { isSupabaseConfigured } from "../data/postgresStore.js";
import { dropshippingQuery, withDropshippingTransaction } from "../dropshipping/database.js";
import {
  companies,
  companyMemberships,
  companyMembershipRepository,
  companyRepository,
  platformUserRepository,
  users,
} from "../data/store.js";
import {
  COMPANY_SCOPE_EXPIRY_SECONDS,
  publicUser,
  requireAuth,
  requireSuperAdmin,
  signCompanyScopeToken,
} from "../middleware/auth.js";
import { recordActivityLog } from "../activityLog/logger.js";
import {
  CPANEL_MODULE_DEFINITIONS,
  inMemoryModuleStore,
  listCompanyModules,
  modulesVisibleToUser,
  replaceCompanyModules,
  restoreCompanyModuleDefaults,
} from "../moduleRegistry.js";
import {
  ADMIN_MODULE_KEYS,
  COMPANY_STATUSES,
  createPlatformCompanySummary,
  isSafeCompanySlug,
  normalizeCompanyHost,
  normalizeCompanySlug,
  normalizeCompanyStorefrontPath,
  normalizeCompanyStorefrontUrl,
  sanitizePublicCompanySettings,
} from "../tenancy/company.js";

const router = Router();
const allowedStatuses = new Set(COMPANY_STATUSES);
const allowedMembershipRoles = new Set([
  "admin",
  "manager",
  platformRoles.COMPANY_ADMIN,
  platformRoles.EMPLOYEE,
  "staff",
  platformRoles.CUSTOMER,
]);
const allowedMembershipStatuses = new Set(["active", "inactive"]);

router.use(requireAuth, requireSuperAdmin);

function hasOwn(source, key) {
  return Object.prototype.hasOwnProperty.call(source, key);
}

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function validateSettings(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw validationError("settings must be an object.");
  }
  if (hasOwn(value, "adminModules")) {
    const modules = value.adminModules;
    if (!modules || typeof modules !== "object" || Array.isArray(modules)) {
      throw validationError("settings.adminModules must be an object.");
    }
    const allowedModuleKeys = new Set(ADMIN_MODULE_KEYS);
    for (const [moduleKey, enabled] of Object.entries(modules)) {
      if (!allowedModuleKeys.has(moduleKey)) {
        throw validationError(`Unknown admin module: ${moduleKey}.`);
      }
      if (typeof enabled !== "boolean") {
        throw validationError(`settings.adminModules.${moduleKey} must be a boolean.`);
      }
    }
  }
  return sanitizePublicCompanySettings(value);
}

function validateDomain(value) {
  if (value === null || value === "") return "";
  if (typeof value !== "string") throw validationError("domain must be a string.");
  const normalized = normalizeCompanyHost(value);
  const labels = normalized.split(".");
  const isSafeDomain = normalized.length <= 253 && labels.every(
    (label) => label.length > 0
      && label.length <= 63
      && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label),
  );
  if (!isSafeDomain) throw validationError("domain is invalid.");
  return normalized;
}

function validateStorefrontUrl(value) {
  if (value === null || value === "") return "";
  if (typeof value !== "string") throw validationError("storefrontUrl must be a string.");
  const normalized = normalizeCompanyStorefrontUrl(value);
  if (!normalized) throw validationError("storefrontUrl must be a valid HTTPS URL.");
  return normalized;
}

function validateStorefrontPath(value) {
  if (value === null || value === "") return "";
  if (typeof value !== "string") throw validationError("storefrontPath must be a string.");
  const normalized = normalizeCompanyStorefrontPath(value);
  if (!normalized) throw validationError("storefrontPath must be a safe path beginning with /.");
  return normalized;
}

function validateStatus(value) {
  if (!allowedStatuses.has(value)) {
    throw validationError(`status must be one of: ${COMPANY_STATUSES.join(", ")}.`);
  }
  return value;
}

function rejectManagedFields(body) {
  if (hasOwn(body, "id")) throw validationError("Company ID is managed by the server.");
  if (hasOwn(body, "isDefault") || hasOwn(body, "is_default")) {
    throw validationError("Default company ownership cannot be changed.");
  }
}

function validateCreateBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw validationError("Request body must be an object.");
  }
  rejectManagedFields(body);

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) throw validationError("name is required.");
  if (name.length > 120) throw validationError("name must be 120 characters or fewer.");

  const slug = hasOwn(body, "slug") ? String(body.slug || "").trim() : normalizeCompanySlug(name);
  if (!isSafeCompanySlug(slug)) {
    throw validationError("slug must be a safe lowercase slug using letters, numbers, and hyphens.");
  }

  return {
    name,
    slug,
    status: hasOwn(body, "status") ? validateStatus(body.status) : "draft",
    domain: hasOwn(body, "domain") ? validateDomain(body.domain) : "",
    storefrontUrl: hasOwn(body, "storefrontUrl") ? validateStorefrontUrl(body.storefrontUrl) : "",
    storefrontPath: hasOwn(body, "storefrontPath") ? validateStorefrontPath(body.storefrontPath) : "",
    settings: hasOwn(body, "settings") ? validateSettings(body.settings) : {},
  };
}

function validateUpdateBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw validationError("Request body must be an object.");
  }
  rejectManagedFields(body);

  const changes = {};
  if (hasOwn(body, "name")) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      throw validationError("name cannot be empty.");
    }
    if (body.name.trim().length > 120) {
      throw validationError("name must be 120 characters or fewer.");
    }
    changes.name = body.name.trim();
  }
  if (hasOwn(body, "slug")) {
    const slug = String(body.slug || "").trim();
    if (!isSafeCompanySlug(slug)) {
      throw validationError("slug must be a safe lowercase slug using letters, numbers, and hyphens.");
    }
    changes.slug = slug;
  }
  if (hasOwn(body, "status")) changes.status = validateStatus(body.status);
  if (hasOwn(body, "domain")) changes.domain = validateDomain(body.domain);
  if (hasOwn(body, "storefrontUrl")) changes.storefrontUrl = validateStorefrontUrl(body.storefrontUrl);
  if (hasOwn(body, "storefrontPath")) changes.storefrontPath = validateStorefrontPath(body.storefrontPath);
  if (hasOwn(body, "settings")) changes.settings = validateSettings(body.settings);

  if (!Object.keys(changes).length) {
    throw validationError("No supported company fields were provided.");
  }
  return changes;
}

function sendCompanyError(res, error) {
  const statusCode = Number(error?.statusCode || 500);
  if (statusCode >= 500) {
    console.error("Company management operation failed.", error?.message || error);
    return res.status(500).json({ message: "Company management operation failed." });
  }
  return res.status(statusCode).json({ message: error.message });
}

function rejectMembershipSecrets(body) {
  for (const field of ["passwordHash", "password_hash", "token", "permissions"]) {
    if (hasOwn(body, field)) {
      throw validationError(`${field} is not accepted by membership endpoints.`);
    }
  }
  if (hasOwn(body, "id") || hasOwn(body, "userId") || hasOwn(body, "user_id")) {
    throw validationError("Membership and user IDs are managed by the server.");
  }
}

function validateMembershipRole(value) {
  if (!allowedMembershipRoles.has(value)) {
    throw validationError("role must be one of: admin, manager, company_admin, employee, staff, customer.");
  }
  return value;
}

function validatePlatformUserUpdateBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw validationError("Request body must be an object.");
  }
  rejectMembershipSecrets(body);
  const changes = {};
  if (hasOwn(body, "name")) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      throw validationError("name cannot be empty.");
    }
    if (body.name.trim().length > 120) {
      throw validationError("name must be 120 characters or fewer.");
    }
    changes.name = body.name.trim();
  }
  if (hasOwn(body, "email")) {
    if (typeof body.email !== "string" || !body.email.trim()) {
      throw validationError("email cannot be empty.");
    }
    if (body.email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
      throw validationError("email must be a valid email address.");
    }
    changes.email = body.email.trim().toLowerCase();
  }
  if (hasOwn(body, "phone")) {
    if (typeof body.phone !== "string") throw validationError("phone must be a string.");
    changes.phone = body.phone.trim();
  }
  if (hasOwn(body, "department")) {
    if (typeof body.department !== "string") throw validationError("department must be a string.");
    changes.department = body.department.trim();
  }
  if (hasOwn(body, "role")) {
    const role = String(body.role).trim();
    const allowedRoles = new Set(["admin", "manager", "company_admin", "employee", "staff", "customer"]);
    if (!allowedRoles.has(role)) {
      throw validationError("role must be one of: admin, manager, company_admin, employee, staff, customer.");
    }
    changes.role = role;
  }
  if (hasOwn(body, "isActive")) {
    if (typeof body.isActive !== "boolean") throw validationError("isActive must be a boolean.");
    changes.isActive = body.isActive;
  }
  if (hasOwn(body, "accountType")) {
    const allowedTypes = new Set(["retail", "trader"]);
    if (!allowedTypes.has(body.accountType)) {
      throw validationError("accountType must be retail or trader.");
    }
    changes.accountType = body.accountType;
  }
  if (!Object.keys(changes).length) {
    throw validationError("No supported user fields were provided.");
  }
  return changes;
}

function validatePlatformUserCreateBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw validationError("Request body must be an object.");
  }
  if (hasOwn(body, "id")) throw validationError("User ID is managed by the server.");
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) throw validationError("name is required.");
  if (name.length > 120) throw validationError("name must be 120 characters or fewer.");
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw validationError("email must be a valid email address.");
  }
  const password = typeof body.password === "string" && body.password.length ? body.password : "";
  if (!password) throw validationError("password is required for new users.");
  const role = hasOwn(body, "role") ? String(body.role).trim() : "customer";
  const allowedRoles = new Set(["admin", "manager", "company_admin", "employee", "staff", "customer"]);
  if (!allowedRoles.has(role)) {
    throw validationError("role must be one of: admin, manager, company_admin, employee, staff, customer.");
  }
  const allowedAccountTypes = new Set(["retail", "trader"]);
  return {
    name,
    email,
    password,
    role,
    accountType: hasOwn(body, "accountType") && allowedAccountTypes.has(body.accountType) ? body.accountType : "retail",
    phone: hasOwn(body, "phone") ? String(body.phone || "").trim() : "",
    department: hasOwn(body, "department") ? String(body.department || "").trim() : "",
    isActive: hasOwn(body, "isActive") ? body.isActive === true : true,
  };
}

function createPlatformUserSummary(user) {
  const allowedAccountTypes = new Set(["retail", "trader", "wholesale"]);
  return {
    id: String(user?.id || ""),
    name: String(user?.name || ""),
    email: String(user?.email || "").trim().toLowerCase(),
    role: String(user?.role || "customer"),
    accountType: allowedAccountTypes.has(user?.accountType) ? user.accountType : "retail",
    phone: String(user?.phone || ""),
    department: String(user?.department || ""),
    isActive: user?.isActive !== false,
    createdAt: user?.createdAt || null,
    updatedAt: user?.updatedAt || null,
  };
}

function createPlatformMembershipSummary(record) {
  return {
    id: record.id,
    companyId: record.companyId,
    companyName: record.company?.name || "",
    userId: record.userId,
    userName: record.user?.name || "",
    userEmail: String(record.user?.email || "").trim().toLowerCase(),
    userRole: record.user?.role || "customer",
    role: record.role,
    isActive: record.status === "active",
    createdAt: record.createdAt || null,
    updatedAt: record.updatedAt || null,
  };
}

function validateMembershipStatus(value) {
  if (!allowedMembershipStatuses.has(value)) {
    throw validationError("status must be one of: active, inactive.");
  }
  return value;
}

function validateMembershipEmail(value) {
  if (typeof value !== "string") throw validationError("email is required.");
  const email = value.trim().toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw validationError("email must be a valid email address.");
  }
  return email;
}

function validateMembershipCreateBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw validationError("Request body must be an object.");
  }
  rejectMembershipSecrets(body);
  if (hasOwn(body, "name") && typeof body.name !== "string") {
    throw validationError("name must be a string.");
  }
  const name = hasOwn(body, "name") ? body.name.trim() : "";
  if (name.length > 120) throw validationError("name must be 120 characters or fewer.");
  const password = hasOwn(body, "password") ? String(body.password || "") : "";
  if (password && password.length < 8) {
    throw validationError("Temporary password must be at least 8 characters.");
  }
  return {
    email: validateMembershipEmail(body.email),
    name,
    role: validateMembershipRole(body.role),
    status: hasOwn(body, "status") ? validateMembershipStatus(body.status) : "active",
    ...(password ? { password } : {}),
  };
}

function validateMembershipUpdateBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw validationError("Request body must be an object.");
  }
  rejectMembershipSecrets(body);
  if (hasOwn(body, "password")) {
    throw validationError("password cannot be changed by membership endpoints.");
  }
  if (hasOwn(body, "email") || hasOwn(body, "name")) {
    throw validationError("User identity fields cannot be changed by membership endpoints.");
  }
  const changes = {};
  if (hasOwn(body, "role")) changes.role = validateMembershipRole(body.role);
  if (hasOwn(body, "status")) changes.status = validateMembershipStatus(body.status);
  if (!Object.keys(changes).length) {
    throw validationError("No supported membership fields were provided.");
  }
  return changes;
}

function createMembershipSummary(record, company) {
  return {
    userId: record.userId,
    email: String(record.user?.email || "").trim().toLowerCase(),
    name: record.user?.name || "",
    role: record.role,
    status: record.status,
    companyId: company.id,
    companySlug: company.slug,
    createdAt: record.createdAt || null,
    updatedAt: record.updatedAt || null,
  };
}

function membershipCompanyOr404(companyId) {
  const company = companyRepository.getCompanyById(companyId);
  if (!company) throw Object.assign(new Error("Company not found."), { statusCode: 404 });
  return company;
}

function moduleAudit(req, company, action, beforeData, afterData, summary) {
  return recordActivityLog({
    req,
    companyId: company.id,
    action,
    entityType: "company_modules",
    entityId: company.id,
    entityLabel: company.name,
    summary,
    beforeData,
    afterData,
  });
}

router.get("/users", async (_req, res) => {
  try {
    const users = await platformUserRepository.listUsers();
    return res.json({ users: users.map(createPlatformUserSummary) });
  } catch (error) {
    return sendCompanyError(res, error);
  }
});

router.post("/users", async (req, res) => {
  try {
    const input = validatePlatformUserCreateBody(req.body);
    const user = await platformUserRepository.createUser(input);
    return res.status(201).json(createPlatformUserSummary(user));
  } catch (error) {
    return sendCompanyError(res, error);
  }
});

router.patch("/users/:id", async (req, res) => {
  try {
    const changes = validatePlatformUserUpdateBody(req.body);
    const user = await platformUserRepository.updateUser(req.params.id, changes);
    return res.json(createPlatformUserSummary(user));
  } catch (error) {
    return sendCompanyError(res, error);
  }
});

router.get("/memberships", async (_req, res) => {
  try {
    const memberships = await companyMembershipRepository.listAllMemberships();
    return res.json({ memberships: memberships.map(createPlatformMembershipSummary) });
  } catch (error) {
    return sendCompanyError(res, error);
  }
});

router.patch("/memberships/:id", async (req, res) => {
  try {
    const changes = validateMembershipUpdateBody(req.body);
    const membership = await companyMembershipRepository.updateMembershipById(
      req.params.id,
      changes,
    );
    const company = membershipCompanyOr404(membership.companyId);
    return res.json(createPlatformMembershipSummary({ ...membership, company }));
  } catch (error) {
    return sendCompanyError(res, error);
  }
});

router.post("/memberships", async (req, res) => {
  try {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      throw validationError("Request body must be an object.");
    }
    const companyId = String(req.body.companyId || req.body.company_id || "").trim().toLowerCase();
    if (!companyId) throw validationError("companyId is required.");
    const company = membershipCompanyOr404(companyId);
    const membership = await companyMembershipRepository.createOrUpdateMembership(
      company.id,
      req.body,
    );
    return res.status(201).json(createPlatformMembershipSummary({ ...membership, company }));
  } catch (error) {
    return sendCompanyError(res, error);
  }
});

router.get("/companies/:companyId/memberships", async (req, res) => {
  try {
    const company = membershipCompanyOr404(req.params.companyId);
    const memberships = await companyMembershipRepository.listUsersForCompany(company.id);
    return res.json(memberships.map((membership) => createMembershipSummary(membership, company)));
  } catch (error) {
    return sendCompanyError(res, error);
  }
});

router.post("/companies/:companyId/memberships", async (req, res) => {
  try {
    const company = membershipCompanyOr404(req.params.companyId);
    const membership = await companyMembershipRepository.createOrUpdateMembership(
      company.id,
      validateMembershipCreateBody(req.body),
    );
    return res.status(201).json(createMembershipSummary(membership, company));
  } catch (error) {
    return sendCompanyError(res, error);
  }
});

router.patch("/companies/:companyId/memberships/:userId", async (req, res) => {
  try {
    const company = membershipCompanyOr404(req.params.companyId);
    const membership = await companyMembershipRepository.updateMembership(
      company.id,
      req.params.userId,
      validateMembershipUpdateBody(req.body),
    );
    return res.json(createMembershipSummary(membership, company));
  } catch (error) {
    return sendCompanyError(res, error);
  }
});

router.patch("/companies/:companyId/memberships/:userId/disable", async (req, res) => {
  try {
    const company = membershipCompanyOr404(req.params.companyId);
    const membership = await companyMembershipRepository.disableMembership(
      company.id,
      req.params.userId,
    );
    return res.json(createMembershipSummary(membership, company));
  } catch (error) {
    return sendCompanyError(res, error);
  }
});

router.get("/companies", (_req, res) => {
  res.json(companyRepository.listCompanies().map(createPlatformCompanySummary));
});

router.get("/companies/:companyId/modules", async (req, res) => {
  try {
    const company = membershipCompanyOr404(req.params.companyId);
    return res.json({ company: createPlatformCompanySummary(company), modules: await listCompanyModules(company.id) });
  } catch (error) {
    return sendCompanyError(res, error);
  }
});

router.put("/companies/:companyId/modules", async (req, res) => {
  try {
    const company = membershipCompanyOr404(req.params.companyId);
    const before = await listCompanyModules(company.id);
    await replaceCompanyModules(company.id, req.body?.modules);
    const modules = await listCompanyModules(company.id);
    const beforeByKey = new Map(before.map((item) => [item.module_key, item]));
    const changed = modules.filter((item) => {
      const previous = beforeByKey.get(item.module_key);
      return !previous || previous.enabled !== item.enabled || previous.sort_order !== item.sort_order
        || previous.label_en !== item.label_en || previous.label_ar !== item.label_ar
        || JSON.stringify(previous.configuration || {}) !== JSON.stringify(item.configuration || {});
    });
    for (const item of changed) {
      const previous = beforeByKey.get(item.module_key);
      const action = previous?.enabled !== item.enabled
        ? `platform.company_module.${item.enabled ? "enabled" : "disabled"}`
        : previous?.sort_order !== item.sort_order
          ? "platform.company_module.reordered"
          : "platform.company_module.configured";
      await moduleAudit(req, company, action, previous, item, `Updated ${item.label_en} for ${company.name}.`);
    }
    return res.json({ company: createPlatformCompanySummary(company), modules });
  } catch (error) {
    return sendCompanyError(res, error);
  }
});

router.post("/companies/:companyId/modules/restore-defaults", async (req, res) => {
  try {
    const company = membershipCompanyOr404(req.params.companyId);
    const before = await listCompanyModules(company.id);
    await restoreCompanyModuleDefaults(company.id);
    const modules = await listCompanyModules(company.id);
    await moduleAudit(req, company, "platform.company_modules.defaults_restored", before, modules, "Restored default company modules.");
    return res.json({ company: createPlatformCompanySummary(company), modules });
  } catch (error) {
    return sendCompanyError(res, error);
  }
});

router.post("/companies/:companyId/scope", async (req, res) => {
  try {
    const company = membershipCompanyOr404(req.params.companyId);
    if (company.status !== "active") throw Object.assign(new Error("Only active companies can be opened."), { statusCode: 409 });
    const previousCompanyId = req.tenantScope?.companyId || null;
    const modules = modulesVisibleToUser(await listCompanyModules(company.id), req.user);
    const action = previousCompanyId && previousCompanyId !== company.id
      ? "platform.company_scope.switched"
      : "platform.company_scope.entered";
    if (previousCompanyId && previousCompanyId !== company.id) {
      const previousCompany = companyRepository.getCompanyById(previousCompanyId);
      await recordActivityLog({
        req,
        companyId: previousCompanyId,
        action: "platform.company_scope.exited",
        entityType: "company_scope",
        entityId: previousCompanyId,
        entityLabel: previousCompany?.name || previousCompanyId,
        summary: `Exited company scope to switch to ${company.name}.`,
        metadata: { nextCompanyId: company.id },
      });
    }
    await recordActivityLog({
      req,
      companyId: company.id,
      action,
      entityType: "company_scope",
      entityId: company.id,
      entityLabel: company.name,
      summary: previousCompanyId ? `Switched company scope from ${previousCompanyId}.` : "Entered company scope.",
      metadata: { previousCompanyId, scopeExpiresInSeconds: COMPANY_SCOPE_EXPIRY_SECONDS },
    });
    return res.json({
      token: signCompanyScopeToken(req.user, company),
      user: { ...publicUser(req.user), role: "company_admin", globalRole: "super_admin", isCompanyScope: true },
      activeCompany: createPlatformCompanySummary(company),
      activeMembership: null,
      modules,
      scope: { expiresInSeconds: COMPANY_SCOPE_EXPIRY_SECONDS },
    });
  } catch (error) {
    return sendCompanyError(res, error);
  }
});

router.post("/company-scope/exit", async (req, res) => {
  if (req.tenantScope?.companyId) {
    const company = companyRepository.getCompanyById(req.tenantScope.companyId);
    await recordActivityLog({
      req,
      companyId: req.tenantScope.companyId,
      action: "platform.company_scope.exited",
      entityType: "company_scope",
      entityId: req.tenantScope.companyId,
      entityLabel: company?.name || req.tenantScope.companyId,
      summary: "Exited company scope.",
    });
  }
  return res.status(204).end();
});

router.get("/companies/:id", (req, res) => {
  const company = companyRepository.getCompanyById(req.params.id);
  if (!company) return res.status(404).json({ message: "Company not found." });
  return res.json(createPlatformCompanySummary(company));
});

router.post("/companies", async (req, res) => {
  try {
    const company = await companyRepository.createCompanyDraft(validateCreateBody(req.body));
    return res.status(201).json(createPlatformCompanySummary(company));
  } catch (error) {
    return sendCompanyError(res, error);
  }
});

router.patch("/companies/:id", async (req, res) => {
  try {
    const company = await companyRepository.updateCompanyDraft(
      req.params.id,
      validateUpdateBody(req.body),
    );
    return res.json(createPlatformCompanySummary(company));
  } catch (error) {
    return sendCompanyError(res, error);
  }
});

router.patch("/companies/:id/disable", async (req, res) => {
  try {
    const company = await companyRepository.disableCompany(req.params.id);
    return res.json(createPlatformCompanySummary(company));
  } catch (error) {
    return sendCompanyError(res, error);
  }
});

// ── Super Admin company onboarding ──────────────────────────────────────────

const validOnboardModuleKeys = new Set(
  CPANEL_MODULE_DEFINITIONS.map((entry) => entry.module_key),
);

function validateOnboardBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw validationError("Request body must be an object.");
  }

  const companySection = body.company;
  if (!companySection || typeof companySection !== "object" || Array.isArray(companySection)) {
    throw validationError("company is required and must be an object.");
  }

  const adminSection = body.administrator;
  if (!adminSection || typeof adminSection !== "object" || Array.isArray(adminSection)) {
    throw validationError("administrator is required and must be an object.");
  }

  const companyPayload = { name: companySection.name, status: companySection.status };
  if (hasOwn(companySection, "slug") && companySection.slug) companyPayload.slug = companySection.slug;
  if (hasOwn(companySection, "domain")) companyPayload.domain = companySection.domain;
  if (hasOwn(companySection, "storefrontUrl")) companyPayload.storefrontUrl = companySection.storefrontUrl;
  if (hasOwn(companySection, "storefrontPath")) companyPayload.storefrontPath = companySection.storefrontPath;
  if (hasOwn(companySection, "currency") || hasOwn(companySection, "language")) {
    const settings = {};
    if (hasOwn(companySection, "currency")) settings.currency = companySection.currency;
    if (hasOwn(companySection, "language")) settings.language = companySection.language;
    companyPayload.settings = settings;
  }
  const companyInput = validateCreateBody(companyPayload);

  const adminName = typeof adminSection.name === "string" ? adminSection.name.trim() : "";
  if (!adminName) throw validationError("administrator.name is required.");
  if (adminName.length > 120) throw validationError("administrator.name must be 120 characters or fewer.");

  const adminEmail = typeof adminSection.email === "string" ? adminSection.email.trim().toLowerCase() : "";
  if (!adminEmail || adminEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
    throw validationError("administrator.email must be a valid email address.");
  }

  const adminPassword = typeof adminSection.password === "string" ? adminSection.password : "";
  if (adminPassword && adminPassword.length < 8) {
    throw validationError("Temporary password must be at least 8 characters.");
  }

  const providedModules = Array.isArray(body.modules) ? body.modules : [];
  const providedByKey = new Map();
  for (const item of providedModules) {
    if (!item || typeof item !== "object" || !item.module_key) {
      throw validationError("Each module entry must have a module_key.");
    }
    if (!validOnboardModuleKeys.has(item.module_key)) {
      throw validationError(`Unknown module: ${item.module_key}.`);
    }
    if (providedByKey.has(item.module_key)) {
      throw validationError(`Duplicate module: ${item.module_key}.`);
    }
    if (typeof item.enabled !== "boolean") {
      throw validationError(`${item.module_key}.enabled must be a boolean.`);
    }
    providedByKey.set(item.module_key, { module_key: item.module_key, enabled: item.enabled, sort_order: 0 });
  }

  const normalizedModules = CPANEL_MODULE_DEFINITIONS.map((def) => {
    const override = providedByKey.get(def.module_key);
    return override || { module_key: def.module_key, enabled: false, sort_order: 0 };
  });

  return {
    company: companyInput,
    administrator: {
      name: adminName,
      email: adminEmail,
      password: adminPassword,
      role: "company_admin",
      status: "active",
    },
    modules: normalizedModules,
  };
}

async function assertExistingUserNotProhibited(email) {
  const existingUser = await platformUserRepository.findByEmail(email);
  if (!existingUser) return;
  if (existingUser.role === "super_admin") {
    const err = new Error("A Super Admin cannot be assigned as a company administrator.");
    err.statusCode = 422;
    throw err;
  }
}

async function compensateOnboarding(companyId, adminUserId, createdUserId) {
  if (isSupabaseConfigured()) {
    try {
      await withDropshippingTransaction(async (client) => {
        await client.query(
          "delete from public.company_cpanel_modules where company_id = $1",
          [companyId],
        );
        if (adminUserId) {
          await client.query(
            "delete from public.company_memberships where company_id = $1 and user_id = $2",
            [companyId, adminUserId],
          );
        }
        if (createdUserId) {
          await client.query(
            "delete from public.users where id = $1",
            [createdUserId],
          );
        }
        await client.query(
          "delete from public.company_domains where company_id = $1",
          [companyId],
        );
        await client.query(
          "delete from public.company_settings where company_id = $1",
          [companyId],
        );
        await client.query(
          "delete from public.companies where id = $1",
          [companyId],
        );
      });
    } catch {}
  }

  if (createdUserId) {
    try {
      const userIdx = users.findIndex((u) => u.id === createdUserId);
      if (userIdx !== -1) users.splice(userIdx, 1);
    } catch {}
  }

  if (adminUserId) {
    try {
      const membershipIdx = companyMemberships.findIndex(
        (m) => m.companyId === companyId && m.userId === adminUserId,
      );
      if (membershipIdx !== -1) companyMemberships.splice(membershipIdx, 1);
    } catch {}
  }

  try {
    const companyIdx = companies.findIndex((c) => c.id === companyId);
    if (companyIdx !== -1) companies.splice(companyIdx, 1);
  } catch {}

  inMemoryModuleStore.delete(companyId);
}

async function executeOnboardingAtomic(input, options = {}) {
  const transaction = options.transaction || withDropshippingTransaction;
  return transaction(async (client) => {
    const slug = input.company.slug;
    const now = new Date().toISOString();

    const slugCheck = await client.query(
      "SELECT id FROM public.companies WHERE slug = $1",
      [slug],
    );
    if (slugCheck.rows.length) {
      const err = new Error("Company ID already exists.");
      err.statusCode = 409;
      throw err;
    }

    const storefrontUrl = input.company.storefrontUrl;
    if (storefrontUrl) {
      const urlCheck = await client.query(
        "SELECT c.id FROM public.companies c JOIN public.company_settings s ON s.company_id = c.id WHERE s.settings->>'storefrontUrl' = $1",
        [storefrontUrl],
      );
      if (urlCheck.rows.length) {
        const err = new Error("Storefront URL already belongs to another company.");
        err.statusCode = 409;
        throw err;
      }
    }

    const email = input.administrator.email;
    const userCheck = await client.query(
      "SELECT id, role FROM public.users WHERE LOWER(email) = LOWER($1)",
      [email],
    );
    if (userCheck.rows.length && userCheck.rows[0].role === "super_admin") {
      const err = new Error("A Super Admin cannot be assigned as a company administrator.");
      err.statusCode = 422;
      throw err;
    }

    await client.query(
      "INSERT INTO public.companies (id, slug, name, status, is_default, created_at, updated_at) VALUES ($1, $2, $3, $4, false, $5, $5)",
      [slug, slug, input.company.name, input.company.status, now],
    );

    await client.query(
      "INSERT INTO public.company_settings (company_id, settings, created_at, updated_at) VALUES ($1, $2, $3, $3)",
      [slug, JSON.stringify(input.company.settings || {}), now],
    );

    if (input.company.domain) {
      await client.query(
        "INSERT INTO public.company_domains (id, company_id, domain, is_primary, is_active, created_at, updated_at) VALUES ($1, $2, $3, true, false, $4, $4)",
        [`company-domain-${slug}`, slug, input.company.domain, now],
      );
    }

    let userId;
    let isNewUser = false;
    if (userCheck.rows.length) {
      userId = userCheck.rows[0].id;
    } else {
      const passwordHash = await hashPassword(input.administrator.password);
      userId = `user-${crypto.randomUUID()}`;
      await client.query(
        "INSERT INTO public.users (id, name, email, phone, password, role, department, permissions, account_type, eb_points, total_points_earned, total_points_redeemed, is_active, data, created_at, updated_at) VALUES ($1, $2, $3, '', $4, 'company_admin', '', '[]'::jsonb, 'retail', 0, 0, 0, true, '{}'::jsonb, $5, $5)",
        [userId, input.administrator.name, email, passwordHash, now],
      );
      isNewUser = true;
    }

    const membershipId = `${slug}:${userId}`;
    await client.query(
      "INSERT INTO public.company_memberships (id, company_id, user_id, role, permissions, is_active, created_at, updated_at) VALUES ($1, $2, $3, 'company_admin', '[]'::jsonb, true, $4, $4) ON CONFLICT (id) DO UPDATE SET role = 'company_admin', updated_at = $4",
      [membershipId, slug, userId, now],
    );

    for (const mod of input.modules) {
      await client.query(
        "INSERT INTO public.company_cpanel_modules (company_id, module_key, enabled, sort_order, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $5) ON CONFLICT (company_id, module_key) DO UPDATE SET enabled = excluded.enabled, sort_order = excluded.sort_order, updated_at = excluded.updated_at",
        [slug, mod.module_key, mod.enabled, mod.sort_order, now],
      );
    }

    return { companyId: slug, userId, isNewUser };
  });
}

async function executeOnboardingInMemory(input, options = {}) {
  const saveModules = options.saveModules || replaceCompanyModules;
  const company = await companyRepository.createCompanyDraft(input.company);
  let membership;
  let createdUserId = null;

  try {
    await assertExistingUserNotProhibited(input.administrator.email);

    const userExistedBefore = !!(await platformUserRepository.findByEmail(input.administrator.email));

    membership = await companyMembershipRepository.createOrUpdateMembership(
      company.id,
      {
        email: input.administrator.email,
        name: input.administrator.name,
        role: input.administrator.role,
        status: input.administrator.status,
        ...(input.administrator.password ? { password: input.administrator.password } : {}),
      },
    );

    if (!userExistedBefore) {
      createdUserId = membership.userId;
    }
  } catch (membershipError) {
    await compensateOnboarding(company.id, null, null);
    throw membershipError;
  }

  try {
    if (input.modules.length) {
      await saveModules(company.id, input.modules);
    }
  } catch (modulesError) {
    await compensateOnboarding(company.id, membership.userId, createdUserId);
    throw modulesError;
  }

  const modules = await listCompanyModules(company.id);
  const adminUser = await platformUserRepository.getUserById(membership.userId);

  return {
    company: createPlatformCompanySummary(company),
    administrator: {
      id: membership.userId,
      name: adminUser?.name || input.administrator.name,
      email: input.administrator.email,
      role: "company_admin",
    },
    modules,
  };
}

async function executeOnboarding(input, options = {}) {
  if (isSupabaseConfigured()) {
    const result = await executeOnboardingAtomic(input, options);

    const companyRows = await dropshippingQuery(
      `SELECT c.id, c.slug, c.name, c.status, c.is_default, c.created_at, c.updated_at,
              s.settings,
              d.id AS domain_id, d.domain AS domain_name, d.is_active AS domain_active
       FROM public.companies c
       LEFT JOIN public.company_settings s ON s.company_id = c.id
       LEFT JOIN public.company_domains d ON d.company_id = c.id AND d.is_primary = true
       WHERE c.id = $1`,
      [result.companyId],
    );
    if (!companyRows.rows.length) {
      throw Object.assign(new Error("Company was created but could not be reloaded from database."), { statusCode: 500 });
    }
    const row = companyRows.rows[0];
    const settings = row.settings || {};
    const company = {
      id: row.id,
      slug: row.slug,
      name: row.name,
      status: row.status,
      isDefault: row.is_default === true,
      domain: row.domain_name || "",
      domains: row.domain_name ? [row.domain_name] : [],
      storefrontUrl: settings.storefrontUrl || "",
      storefrontPath: settings.storefrontPath || "",
      settings,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      _domainId: row.domain_id || "",
    };

    const adminUser = result.isNewUser
      ? await platformUserRepository.getUserById(result.userId)
      : await platformUserRepository.findByEmail(input.administrator.email);

    const modules = await listCompanyModules(result.companyId);

    return {
      company: createPlatformCompanySummary(company),
      administrator: {
        id: result.userId,
        name: adminUser?.name || input.administrator.name,
        email: input.administrator.email,
        role: "company_admin",
      },
      modules,
    };
  }

  return executeOnboardingInMemory(input, options);
}

router.post("/onboard", async (req, res) => {
  try {
    const input = validateOnboardBody(req.body);
    const result = await executeOnboarding(input);
    return res.status(201).json(result);
  } catch (error) {
    return sendCompanyError(res, error);
  }
});

export default router;

export { executeOnboarding, executeOnboardingAtomic, validateOnboardBody };
