import { Router } from "express";
import { persistCompanyStore, workSessionRepository } from "../data/store.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function isStaffRole(role) {
  return role === "employee" || role === "staff";
}

function findOpenSession(companyId, user) {
  return workSessionRepository.findByCompany(
    companyId,
    (session) => session.employeeId === user.id && session.date === todayKey() && !session.logoutTime,
  );
}

router.post("/start", async (req, res) => {
  if (!isStaffRole(req.user.role)) {
    return res.status(403).json({ message: "Only employees can start work sessions." });
  }

  let session = findOpenSession(req.companyId, req.user);
  if (!session) {
    session = {
      id: `session-${Date.now()}`,
      employeeId: req.user.id,
      employeeName: req.user.name,
      date: todayKey(),
      loginTime: new Date().toISOString(),
      logoutTime: null,
    };
    workSessionRepository.createForCompany(req.companyId, session, { prepend: true });
    await persistCompanyStore(req.companyId);
  }
  return res.json(session);
});

router.post("/end", async (req, res) => {
  const session = findOpenSession(req.companyId, req.user);
  if (!session) return res.status(404).json({ message: "No open work session." });

  session.logoutTime = new Date().toISOString();
  await persistCompanyStore(req.companyId);
  return res.json(session);
});

router.get("/my-today", (req, res) => {
  if (!isStaffRole(req.user.role)) return res.json(null);
  return res.json(findOpenSession(req.companyId, req.user) || null);
});

router.get("/employees", (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required." });
  }
  return res.json(workSessionRepository.getByCompany(req.companyId));
});

router.get("/employees/:employeeId", (req, res) => {
  if (req.user.role !== "admin" && req.user.id !== req.params.employeeId) {
    return res.status(403).json({ message: "Work session access denied." });
  }
  return res.json(
    workSessionRepository
      .getByCompany(req.companyId)
      .filter((session) => session.employeeId === req.params.employeeId),
  );
});

export default router;
