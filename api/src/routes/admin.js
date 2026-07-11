import { Router } from "express";
import {
  currentStoreSnapshot,
  orderRepository,
  persistCompanyStore,
  productRepository,
  userRepository,
  workSessionRepository,
} from "../data/store.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth, requireAdmin);

const VALID_ACCOUNT_TYPES = new Set(["retail", "trader", "wholesale"]);

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

router.get("/customers", (req, res) => {
  const companyId = req.companyId;
  const companyUsers = userRepository.getByCompany(companyId);
  const companyOrders = orderRepository.getByCompany(companyId);

  const orderCounts = {};
  companyOrders.forEach((order) => {
    if (order.customerUserId) {
      orderCounts[order.customerUserId] = (orderCounts[order.customerUserId] || 0) + 1;
    }
  });

  const customers = companyUsers
    .filter((user) => user.role === "customer")
    .map((user) => ({
      id: user.id,
      name: user.name || "",
      email: user.email || "",
      phone: user.phone || "",
      accountType: VALID_ACCOUNT_TYPES.has(user.accountType) ? user.accountType : "retail",
      isActive: user.isActive !== false,
      orderCount: orderCounts[user.id] || 0,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));

  res.json(customers);
});

router.patch("/users/:id/account-type", async (req, res) => {
  try {
    const user = userRepository.findByCompany(req.companyId, req.params.id);
    if (!user) return res.status(404).json({ message: "User not found." });
    if (user.role !== "customer") {
      return res.status(400).json({ message: "Only customer account type can be changed from this page." });
    }

    const accountType = req.body.accountType;
    if (!accountType || !VALID_ACCOUNT_TYPES.has(accountType)) {
      return res.status(400).json({
        message: "Account type must be one of: retail, trader, wholesale.",
      });
    }

    user.accountType = accountType;
    user.updatedAt = new Date().toISOString();

    let persistTimer;
    try {
      await Promise.race([
        persistCompanyStore(req.companyId),
        new Promise((_, reject) => {
          persistTimer = setTimeout(() => reject(new Error("Account type persistence timed out.")), 5000);
        }),
      ]);
    } catch (persistError) {
      console.error("Account type persistence failed:", persistError);
    } finally {
      if (persistTimer) clearTimeout(persistTimer);
    }

    const orderCount = orderRepository
      .getByCompany(req.companyId)
      .filter((order) => order.customerUserId === user.id).length;

    return res.json({
      id: user.id,
      name: user.name || "",
      email: user.email || "",
      phone: user.phone || "",
      accountType: user.accountType,
      isActive: user.isActive !== false,
      orderCount,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (error) {
    console.error("Account type update failed:", error);
    return res.status(500).json({ message: "Unable to update account type." });
  }
});

router.get("/export-store", (req, res) => {
  res.json(currentStoreSnapshot(req.companyId));
});

export default router;
