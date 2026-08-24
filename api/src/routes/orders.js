import { Router } from "express";
import { orderRepository, persistCompanyStore } from "../data/store.js";
import { publicUser, requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

function isStaffRole(role) {
  return role === "employee" || role === "staff";
}

router.get("/", (req, res) => {
  const orders = orderRepository.getByCompany(req.companyId);
  if (req.user.role === "admin" || req.user.permissions?.includes("orders.view")) {
    if (isStaffRole(req.user.role)) {
      return res.json(
        orders.filter(
          (order) =>
            order.handledByEmployeeId === req.user.id ||
            order.assignedToEmployeeId === req.user.id ||
            order.createdByEmployeeId === req.user.id,
        ),
      );
    }
    return res.json(orders);
  }
  return res.status(403).json({ message: "Orders access denied." });
});

router.get("/my-orders", (req, res) => {
  res.json(
    orderRepository
      .getByCompany(req.companyId)
      .filter((order) => order.customerUserId === req.user.id),
  );
});

router.post("/", async (req, res) => {
  const orderTotal = Number(req.body.total || req.body.subtotal || 0);
  const pointsRedeemed = Math.max(0, Number(req.body.pointsRedeemed || 0));
  const discountFromPoints = Math.max(0, Number(req.body.discountFromPoints || 0));
  const pointsEarned = req.user.role === "customer" ? Math.max(0, Math.floor(orderTotal)) : 0;
  const order = {
    id: `ORD-${Date.now()}`,
    customer: req.body.customer || {},
    customerUserId: req.user.role === "customer" ? req.user.id : req.body.customerUserId || null,
    items: req.body.items || [],
    subtotal: Number(req.body.subtotal || orderTotal || 0),
    total: orderTotal,
    pointsEarned,
    pointsRedeemed,
    discountFromPoints,
    paymentMethod: req.body.paymentMethod || "Cash on delivery",
    status: "Pending",
    handledByEmployeeId: isStaffRole(req.user.role) ? req.user.id : "",
    assignedToEmployeeId: isStaffRole(req.user.role) ? req.user.id : "",
    createdByEmployeeId:
      isStaffRole(req.user.role) ? req.user.id : req.body.createdByEmployeeId || "",
    createdByEmployeeName:
      isStaffRole(req.user.role) ? req.user.name : req.body.createdByEmployeeName || "",
    createdBy: publicUser(req.user),
    lastUpdatedBy: publicUser(req.user),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (req.user.role === "customer") {
    req.user.ebPoints = Math.max(0, Number(req.user.ebPoints || 0) - pointsRedeemed) + pointsEarned;
    req.user.totalPointsEarned = Math.max(0, Number(req.user.totalPointsEarned || 0)) + pointsEarned;
    req.user.totalPointsRedeemed = Math.max(0, Number(req.user.totalPointsRedeemed || 0)) + pointsRedeemed;
  }

  orderRepository.createForCompany(req.companyId, order, { prepend: true });
  await persistCompanyStore(req.companyId);
  res.status(201).json(order);
});

router.put("/:id/status", async (req, res) => {
  const order = orderRepository.findByCompany(req.companyId, req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found." });

  order.status = req.body.status || order.status;
  order.lastUpdatedBy = publicUser(req.user);
  order.updatedAt = new Date().toISOString();
  await persistCompanyStore(req.companyId);
  return res.json(order);
});

router.put("/:id/assign-employee", async (req, res) => {
  const order = orderRepository.findByCompany(req.companyId, req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found." });

  order.handledByEmployeeId = req.body.employeeId || "";
  order.assignedToEmployeeId = req.body.employeeId || "";
  order.lastUpdatedBy = publicUser(req.user);
  order.updatedAt = new Date().toISOString();
  await persistCompanyStore(req.companyId);
  return res.json(order);
});

router.delete("/:id", async (req, res) => {
  const removed = orderRepository.deleteForCompany(req.companyId, req.params.id);
  if (!removed) return res.status(404).json({ message: "Order not found." });

  await persistCompanyStore(req.companyId, { pruneMissing: true });
  return res.status(204).end();
});

export default router;
