import { Router } from "express";
import { orderRepository, persistCompanyStore, reviewRepository } from "../data/store.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

function isStaffRole(role) {
  return role === "employee" || role === "staff";
}

function visibleReviews(items) {
  return items
    .filter((review) => review.isActive && review.isApproved !== false && review.status === "approved")
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

router.get("/", (req, res) => {
  res.json(visibleReviews(reviewRepository.getByCompany(req.companyId)).filter((review) => review.type === "store"));
});

router.get("/all", requireAuth, (req, res) => {
  const reviews = reviewRepository.getByCompany(req.companyId);
  if (isStaffRole(req.user.role)) {
    return res.json(reviews.filter((review) => review.employeeId === req.user.id));
  }
  return res.json(reviews);
});

router.post("/", requireAuth, async (req, res) => {
  const orders = orderRepository.getByCompany(req.companyId);
  const order = req.body.orderId
    ? orders.find((entry) => entry.id === req.body.orderId)
    : orders.find((entry) => entry.customerUserId === req.user.id);

  if (
    req.user.role === "customer" &&
    (!order || order.customerUserId !== req.user.id)
  ) {
    return res.status(403).json({ message: "A completed interaction is required before reviewing." });
  }

  const type =
    req.body.type === "employee" || req.body.employeeId ? "employee" : "store";

  const review = {
    ...req.body,
    id: req.body.id || `review-${Date.now()}`,
    type,
    customerName: req.body.customerName || req.user.name || "Customer",
    employeeId: type === "employee" ? req.body.employeeId || order?.handledByEmployeeId || order?.assignedToEmployeeId || "" : "",
    employeeName: req.body.employeeName || order?.createdByEmployeeName || "",
    orderId: req.body.orderId || order?.id || "",
    createdAt: req.body.createdAt || new Date().toISOString(),
    status: req.user.role === "customer" ? "pending" : req.body.status || "approved",
    isApproved: req.user.role === "customer" ? false : req.body.status !== "rejected",
    isActive: req.user.role === "customer" ? false : req.body.isActive !== false,
  };
  reviewRepository.createForCompany(req.companyId, review, { prepend: true });
  await persistCompanyStore(req.companyId);
  res.status(201).json(review);
});

router.put("/:id/status", requireAuth, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required." });
  }

  const review = reviewRepository.findByCompany(req.companyId, req.params.id);
  if (!review) return res.status(404).json({ message: "Review not found." });

  const status = req.body.status || review.status || "approved";
  review.status = status;
  review.isApproved = status === "approved";
  review.isActive = status === "approved" ? req.body.isActive !== false : false;
  await persistCompanyStore(req.companyId);
  return res.json(review);
});

router.put("/:id", requireAuth, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required." });
  }

  const existing = reviewRepository.findByCompany(req.companyId, req.params.id);
  if (!existing) return res.status(404).json({ message: "Review not found." });

  const status = req.body.status || existing.status || "approved";
  const updated = reviewRepository.updateForCompany(req.companyId, req.params.id, {
    ...existing,
    ...req.body,
    id: req.params.id,
    type: req.body.type === "employee" || req.body.employeeId ? "employee" : "store",
    status,
    isApproved: status === "approved",
  });
  await persistCompanyStore(req.companyId);
  return res.json(updated);
});

router.delete("/:id", requireAuth, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required." });
  }

  const removed = reviewRepository.deleteForCompany(req.companyId, req.params.id);
  if (!removed) return res.status(404).json({ message: "Review not found." });

  await persistCompanyStore(req.companyId, { pruneMissing: true });
  return res.status(204).end();
});

export default router;
