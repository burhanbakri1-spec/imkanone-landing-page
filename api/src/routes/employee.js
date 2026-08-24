import { Router } from "express";
import {
  persistCompanyStore,
  userRepository,
  workSessionRepository,
} from "../data/store.js";
import { publicUser, requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, requireAdmin, (req, res) => {
  res.json(userRepository.getByCompany(req.companyId).filter((user) => user.role === "employee").map(publicUser));
});

router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const employee = {
    ...req.body,
    id: req.body.id || `employee-${Date.now()}`,
    role: "employee",
    password: req.body.password || "employee123",
    permissions: req.body.permissions || ["dashboard.view", "products.view", "orders.view"],
    isActive: req.body.isActive !== false,
  };
  userRepository.createForCompany(req.companyId, employee);
  await persistCompanyStore(req.companyId);
  res.status(201).json(publicUser(employee));
});

router.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  const employee = userRepository.findByCompany(
    req.companyId,
    (user) => user.id === req.params.id && user.role === "employee",
  );
  if (!employee) return res.status(404).json({ message: "Employee not found." });

  Object.assign(employee, req.body, { id: employee.id, role: "employee" });
  await persistCompanyStore(req.companyId);
  return res.json(publicUser(employee));
});

router.put("/:id/permissions", requireAuth, requireAdmin, async (req, res) => {
  const employee = userRepository.findByCompany(
    req.companyId,
    (user) => user.id === req.params.id && user.role === "employee",
  );
  if (!employee) return res.status(404).json({ message: "Employee not found." });

  employee.permissions = req.body.permissions || [];
  await persistCompanyStore(req.companyId);
  return res.json(publicUser(employee));
});

router.put("/:id/status", requireAuth, requireAdmin, async (req, res) => {
  const employee = userRepository.findByCompany(
    req.companyId,
    (user) => user.id === req.params.id && user.role === "employee",
  );
  if (!employee) return res.status(404).json({ message: "Employee not found." });

  employee.isActive = Boolean(req.body.isActive);
  await persistCompanyStore(req.companyId);
  return res.json(publicUser(employee));
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const employee = userRepository.findByCompany(
    req.companyId,
    (user) => user.id === req.params.id && user.role === "employee",
  );
  if (!employee) return res.status(404).json({ message: "Employee not found." });

  userRepository.deleteForCompany(req.companyId, employee.id);
  await persistCompanyStore(req.companyId, { pruneMissing: true });
  return res.status(204).end();
});

router.get("/work-sessions", requireAuth, requireAdmin, (req, res) => {
  res.json(workSessionRepository.getByCompany(req.companyId));
});

export default router;
