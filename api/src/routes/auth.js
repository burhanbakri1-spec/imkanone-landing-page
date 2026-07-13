import { Router } from "express";
import {
  companyMembershipRepository,
  persistCompanyStore,
  platformUserRepository,
  userRepository,
  workSessionRepository,
} from "../data/store.js";
import { hashPassword, verifyPassword } from "../auth/passwords.js";
import {
  publicUser,
  requireAuth,
  signCompanySelectionChallenge,
  signToken,
  verifyToken,
} from "../middleware/auth.js";

function normalizePhone(phone) {
  if (!phone) return "";
  const digits = String(phone).replace(/[^\d]/g, "");
  if (digits.startsWith("970")) return digits.slice(3);
  if (digits.startsWith("972")) return digits.slice(3);
  return digits.replace(/^0+/, "") || digits;
}

const router = Router();

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function publicCompany(company) {
  if (!company) return null;
  return {
    id: company.id,
    slug: company.slug,
    name: company.name,
    status: company.status,
  };
}

function publicMembership(membership) {
  if (!membership) return null;
  return {
    id: membership.id,
    companyId: membership.companyId,
    role: membership.role,
    status: membership.status,
    permissions: Array.isArray(membership._permissions) ? membership._permissions : [],
    updatedAt: membership.updatedAt || null,
  };
}

function sessionUser(user, membership) {
  if (!membership) return { ...user, globalRole: user.role };
  return {
    ...user,
    globalRole: user.role,
    role: membership.role,
    permissions: Array.isArray(membership._permissions) ? membership._permissions : [],
  };
}

function availableCompanies(memberships) {
  return memberships.map((membership) => ({
    ...publicCompany(membership.company),
    membership: publicMembership(membership),
  }));
}

async function createSessionResponse(user, membership, memberships = []) {
  const effectiveUser = sessionUser(user, membership);
  return {
    token: signToken(user, membership),
    user: publicUser(effectiveUser),
    activeCompany: publicCompany(membership?.company),
    activeMembership: publicMembership(membership),
    availableCompanies: availableCompanies(memberships),
    workSession: membership
      ? await startEmployeeSession(effectiveUser, membership.companyId)
      : null,
  };
}

function isStaffRole(role) {
  return role === "employee" || role === "staff";
}

async function startEmployeeSession(user, companyId) {
  if (!isStaffRole(user.role)) return null;
  const today = new Date().toISOString().slice(0, 10);
  let session = workSessionRepository.findByCompany(
    companyId,
    (entry) => entry.employeeId === user.id && entry.date === today && !entry.logoutTime,
  );
  if (!session) {
    session = {
      id: `session-${Date.now()}`,
      employeeId: user.id,
      employeeName: user.name,
      date: today,
      loginTime: new Date().toISOString(),
      logoutTime: null,
    };
    workSessionRepository.createForCompany(companyId, session, { prepend: true });
    await persistCompanyStore(companyId);
  }
  return session;
}

router.post("/login", asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const user = await platformUserRepository.findByEmail(normalizedEmail);

  if (!user || user.isActive === false || !(await verifyPassword(password, user.password))) {
    return res.status(401).json({ message: "Invalid email or password." });
  }

  if (user.role === "super_admin") {
    return res.json(await createSessionResponse(user, null));
  }

  const memberships = await companyMembershipRepository.listActiveMembershipsForUser(user.id);
  if (!memberships.length) {
    return res.status(403).json({ message: "No active company membership is available for this account." });
  }
  if (memberships.length > 1) {
    return res.json({
      companySelectionRequired: true,
      selectionChallenge: signCompanySelectionChallenge(user),
      availableCompanies: availableCompanies(memberships),
    });
  }
  return res.json(await createSessionResponse(user, memberships[0], memberships));
}));

router.post("/select-company", asyncHandler(async (req, res) => {
  const selectionChallenge = String(req.body?.selectionChallenge || "");
  const companyId = String(req.body?.companyId || "").trim().toLowerCase();
  const challenge = verifyToken(selectionChallenge);
  if (!challenge || challenge.tokenType !== "company_selection" || !challenge.id) {
    return res.status(401).json({ message: "Invalid or expired company selection challenge." });
  }
  const user = await platformUserRepository.getUserById(challenge.id);
  if (!user || user.isActive === false || user.role !== challenge.role || user.role === "super_admin") {
    return res.status(401).json({ message: "Invalid or expired company selection challenge." });
  }
  const memberships = await companyMembershipRepository.listActiveMembershipsForUser(user.id);
  const membership = memberships.find((entry) => entry.companyId === companyId);
  if (!membership) {
    return res.status(403).json({ message: "Active membership for the selected company is required." });
  }
  return res.json(await createSessionResponse(user, membership, memberships));
}));

router.post("/register", asyncHandler(async (req, res) => {
  const { name, email, phone: rawPhone, password } = req.body;
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const phone = normalizePhone(rawPhone);
  if (userRepository.getByCompany(req.companyId).some(
    (user) => String(user.email || "").trim().toLowerCase() === normalizedEmail,
  )) {
    return res.status(409).json({ message: "Email already exists." });
  }

  const validAccountTypes = new Set(["retail", "trader", "wholesale"]);
  const accountType = validAccountTypes.has(req.body.accountType) ? req.body.accountType : "retail";

  // Check if a phone-linked points user already exists and inherit their balance
  let existingPoints = 0;
  let existingEarned = 0;
  let existingRedeemed = 0;
  if (phone) {
    const phoneUser = userRepository.findByCompany(req.companyId, (u) => normalizePhone(u.phone) === phone && u.id.startsWith("points-"));
    if (phoneUser) {
      existingPoints = Math.max(0, Number(phoneUser.ebPoints || 0));
      existingEarned = Math.max(0, Number(phoneUser.totalPointsEarned || 0));
      existingRedeemed = Math.max(0, Number(phoneUser.totalPointsRedeemed || 0));
      userRepository.deleteForCompany(req.companyId, phoneUser.id);
    }
  }

  const user = {
    id: `customer-${Date.now()}`,
    name,
    email: normalizedEmail,
    phone,
    password: await hashPassword(password),
    role: "customer",
    permissions: [],
    accountType,
    ebPoints: existingPoints,
    totalPointsEarned: existingEarned,
    totalPointsRedeemed: existingRedeemed,
    isActive: true,
  };
  userRepository.createForCompany(req.companyId, user);
  await persistCompanyStore(req.companyId);
  const membership = await companyMembershipRepository.getMembershipByCompanyAndUser(
    req.companyId,
    user.id,
  );
  return res.status(201).json(await createSessionResponse(user, membership, membership ? [membership] : []));
}));

router.get("/me", requireAuth, asyncHandler(async (req, res) => {
  const user = { ...req.user };
  const userPhone = normalizePhone(user.phone);
  if (userPhone && user.globalRole !== "super_admin") {
    const phoneUser = userRepository.findByCompany(
      req.companyId,
      (u) => u.id !== user.id && normalizePhone(u.phone) === userPhone,
    );
    if (phoneUser) {
      user.ebPoints = Math.max(0, Number(user.ebPoints || 0)) + Math.max(0, Number(phoneUser.ebPoints || 0));
      user.totalPointsEarned = Math.max(0, Number(user.totalPointsEarned || 0)) + Math.max(0, Number(phoneUser.totalPointsEarned || 0));
      user.totalPointsRedeemed = Math.max(0, Number(user.totalPointsRedeemed || 0)) + Math.max(0, Number(phoneUser.totalPointsRedeemed || 0));
    }
  }
  const memberships = user.globalRole === "super_admin"
    ? []
    : await companyMembershipRepository.listActiveMembershipsForUser(user.id);
  const safeUser = publicUser(user);
  res.json({
    ...safeUser,
    user: safeUser,
    activeCompany: publicCompany(req.company),
    activeMembership: publicMembership(req.membership),
    availableCompanies: availableCompanies(memberships),
  });
}));

router.patch("/me", requireAuth, asyncHandler(async (req, res) => {
  try {
    if (!req.companyId || !req.membership) {
      return res.status(403).json({ message: "An active company membership is required." });
    }
    const allowed = ["name", "email", "phone", "city", "address", "avatarUrl"];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (updates.phone) updates.phone = normalizePhone(updates.phone);
    if (
      updates.name === undefined &&
      updates.email === undefined &&
      updates.phone === undefined &&
      updates.city === undefined &&
      updates.address === undefined &&
      updates.avatarUrl === undefined
    ) {
      return res.status(400).json({ message: "No valid fields to update." });
    }
    const updated = userRepository.updateForCompany(req.companyId, req.user.id, updates);
    if (!updated) return res.status(404).json({ message: "User not found." });

    let persistTimer;
    try {
      await Promise.race([
        persistCompanyStore(req.companyId),
        new Promise((_, reject) => {
          persistTimer = setTimeout(() => reject(new Error("Profile persistence timed out.")), 5000);
        }),
      ]);
    } catch (persistError) {
      console.error("Profile update persistence failed:", persistError);
    } finally {
      if (persistTimer) clearTimeout(persistTimer);
    }

    return res.json(publicUser(updated));
  } catch (error) {
    console.error("Profile update failed:", error);
    return res.status(500).json({ message: "Unable to update profile. Please try again." });
  }
}));

router.post("/logout", requireAuth, asyncHandler(async (req, res) => {
  const user = req.user;

  let workSession = null;
  if (isStaffRole(user?.role)) {
    workSession = workSessionRepository.findByCompany(
      req.companyId,
      (entry) => entry.employeeId === user.id && !entry.logoutTime,
    );
    if (workSession) {
      workSession.logoutTime = new Date().toISOString();
      await persistCompanyStore(req.companyId);
    }
  }

  res.json({ workSession });
}));

export default router;
