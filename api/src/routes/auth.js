import { Router } from "express";
import {
  persistCompanyStore,
  userRepository,
  workSessionRepository,
} from "../data/store.js";
import { hashPassword, verifyPassword } from "../auth/passwords.js";
import { getSessionUser, publicUser, requireAuth, signToken } from "../middleware/auth.js";

const router = Router();

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

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const user = userRepository.findByCompany(
    req.companyId,
    (entry) => String(entry.email || "").trim().toLowerCase() === normalizedEmail
      && entry.isActive !== false,
  );

  if (!user || !(await verifyPassword(password, user.password))) {
    return res.status(401).json({ message: "Invalid email or password." });
  }

  const token = signToken(user);
  return res.json({
    token,
    user: publicUser(user),
    workSession: await startEmployeeSession(user, req.companyId),
  });
});

router.post("/register", async (req, res) => {
  const { name, email, phone, password } = req.body;
  const normalizedEmail = String(email || "").trim().toLowerCase();
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
    const phoneUser = userRepository.findByCompany(req.companyId, (u) => u.phone === phone && u.id.startsWith("points-"));
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
  const token = signToken(user);
  return res.status(201).json({ token, user: publicUser(user) });
});

router.get("/me", requireAuth, (req, res) => {
  const user = { ...req.user };
  // Merge points from phone-linked account so points follow the phone number
  if (user.phone) {
    const phoneUser = userRepository.findByCompany(req.companyId, (u) => u.phone === user.phone && u.id !== user.id);
    if (phoneUser) {
      user.ebPoints = Math.max(0, Number(user.ebPoints || 0), Number(phoneUser.ebPoints || 0));
      user.totalPointsEarned = Math.max(0, Number(user.totalPointsEarned || 0), Number(phoneUser.totalPointsEarned || 0));
      user.totalPointsRedeemed = Math.max(0, Number(user.totalPointsRedeemed || 0), Number(phoneUser.totalPointsRedeemed || 0));
    }
  }
  res.json(publicUser(user));
});

router.post("/logout", async (req, res) => {
  const user = getSessionUser(req);

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
});

export default router;
