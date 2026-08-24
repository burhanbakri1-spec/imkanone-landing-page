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

  const user = {
    id: `customer-${Date.now()}`,
    name,
    email: normalizedEmail,
    phone,
    password: await hashPassword(password),
    role: "customer",
    permissions: [],
    ebPoints: 0,
    totalPointsEarned: 0,
    totalPointsRedeemed: 0,
    isActive: true,
  };
  userRepository.createForCompany(req.companyId, user);
  await persistCompanyStore(req.companyId);
  const token = signToken(user);
  return res.status(201).json({ token, user: publicUser(user) });
});

router.get("/me", requireAuth, (req, res) => {
  res.json(publicUser(req.user));
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
