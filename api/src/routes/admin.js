import { Router } from "express";
import {
  currentStoreSnapshot,
  orderRepository,
  productRepository,
  userRepository,
  workSessionRepository,
} from "../data/store.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth, requireAdmin);

router.get("/summary", (req, res) => {
  const users = userRepository.getByCompany(req.companyId);
  res.json({
    products: productRepository.getByCompany(req.companyId).length,
    orders: orderRepository.getByCompany(req.companyId).length,
    employees: users.filter((user) => user.role === "employee").length,
    customers: users.filter((user) => user.role === "customer").length,
    workSessions: workSessionRepository.getByCompany(req.companyId).length,
  });
});

router.get("/export-store", (req, res) => {
  res.json(currentStoreSnapshot(req.companyId));
});

export default router;
