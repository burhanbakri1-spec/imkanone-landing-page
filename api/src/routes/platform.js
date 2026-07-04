import { Router } from "express";
import { platformRoles } from "../auth/roles.js";
import { hashPassword } from "../auth/passwords.js";
import {
  companyMembershipRepository,
  companyRepository,
  platformUserRepository,
} from "../data/store.js";
import { requireAuth, requireSuperAdmin } from "../middleware/auth.js";
import {
  COMPANY_STATUSES,
  createPlatformCompanySummary,
  isSafeCompanySlug,
  normalizeCompanyHost,
  normalizeCompanySlug,
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
  for (const field of ["password", "passwordHash", "password_hash", "token", "permissions"]) {
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
  return {
    name,
    email,
    password,
    role,
    phone: hasOwn(body, "phone") ? String(body.phone || "").trim() : "",
    department: hasOwn(body, "department") ? String(body.department || "").trim() : "",
    isActive: hasOwn(body, "isActive") ? body.isActive === true : true,
  };
}

function createPlatformUserSummary(user) {
  return {
    id: String(user?.id || ""),
    name: String(user?.name || ""),
    email: String(user?.email || "").trim().toLowerCase(),
    role: String(user?.role || "customer"),
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
  return {
    email: validateMembershipEmail(body.email),
    name,
    role: validateMembershipRole(body.role),
    status: hasOwn(body, "status") ? validateMembershipStatus(body.status) : "active",
  };
}

function validateMembershipUpdateBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw validationError("Request body must be an object.");
  }
  rejectMembershipSecrets(body);
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

export default router;
