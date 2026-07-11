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

async function persistReviewsSafely(companyId, options = {}) {
  let timer;
  try {
    await Promise.race([
      persistCompanyStore(companyId, options),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("Review persistence timed out.")), 5000);
      }),
    ]);
  } catch (error) {
    console.error("Review persistence failed:", error);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

router.get("/", (req, res) => {
  const typeFilter = req.query.type || "website";
  res.json(visibleReviews(reviewRepository.getByCompany(req.companyId)).filter((review) => review.type === typeFilter));
});

router.get("/product/:productId", (req, res) => {
  res.json(
    visibleReviews(reviewRepository.getByCompany(req.companyId)).filter(
      (review) => review.type === "product" && review.productId === req.params.productId,
    ),
  );
});

router.get("/employee/:employeeId", (req, res) => {
  res.json(
    visibleReviews(reviewRepository.getByCompany(req.companyId)).filter(
      (review) => review.type === "employee" && review.employeeId === req.params.employeeId,
    ),
  );
});

router.get("/all", requireAuth, (req, res) => {
  const reviews = reviewRepository.getByCompany(req.companyId);
  if (isStaffRole(req.user.role)) {
    return res.json(reviews.filter((review) => review.employeeId === req.user.id));
  }
  return res.json(reviews);
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const type = req.body.type || "website";
    const allowedTypes = ["product", "website", "order", "employee"];
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({ message: "Invalid review type." });
    }

    let order = null;
    if (req.body.orderId) {
      const orders = orderRepository.getByCompany(req.companyId);
      order = orders.find((entry) => entry.id === req.body.orderId);
    }

    if (
      req.user.role === "customer" &&
      type !== "website" &&
      (!order || order.customerUserId !== req.user.id)
    ) {
      return res.status(403).json({ message: "A completed interaction is required before reviewing." });
    }

    const now = new Date().toISOString();
    const review = {
      ...req.body,
      id: req.body.id || `review-${Date.now()}`,
      type,
      customerName: req.body.customerName || req.user.name || "Customer",
      productId: type === "product" ? req.body.productId || "" : "",
      orderId: req.body.orderId || order?.id || "",
      employeeId: type === "employee" ? req.body.employeeId || order?.handledByEmployeeId || order?.assignedToEmployeeId || "" : "",
      employeeName: type === "employee" ? req.body.employeeName || order?.createdByEmployeeName || "" : "",
      createdAt: req.body.createdAt || now,
      updatedAt: now,
      status: req.user.role === "customer" ? "pending" : req.body.status || "approved",
      isApproved: req.user.role === "customer" ? false : req.body.status !== "rejected",
      isActive: req.user.role === "customer" ? false : req.body.isActive !== false,
    };
    reviewRepository.createForCompany(req.companyId, review, { prepend: true });
    await persistReviewsSafely(req.companyId);
    return res.status(201).json(review);
  } catch (error) {
    console.error("Review creation failed:", error);
    return res.status(500).json({ message: "Unable to submit review. Please try again." });
  }
});

router.put("/:id/status", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required." });
    }

    const review = reviewRepository.findByCompany(req.companyId, req.params.id);
    if (!review) return res.status(404).json({ message: "Review not found." });

    const allowedStatuses = new Set(["approved", "rejected", "hidden", "pending"]);
    const status = allowedStatuses.has(req.body.status) ? req.body.status : review.status || "approved";
    review.status = status;
    review.isApproved = status === "approved";
    review.isActive = status === "approved" ? req.body.isActive !== false : false;
    review.updatedAt = new Date().toISOString();
    await persistReviewsSafely(req.companyId);
    return res.json(review);
  } catch (error) {
    console.error("Review status update failed:", error);
    return res.status(500).json({ message: "Unable to update review. Please try again." });
  }
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
    type: req.body.type === "employee" || req.body.employeeId ? "employee" : req.body.type || "website",
    status,
    isApproved: status === "approved",
  });
  await persistCompanyStore(req.companyId);
  return res.json(updated);
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required." });
    }

    const removed = reviewRepository.deleteForCompany(req.companyId, req.params.id);
    if (!removed) return res.status(404).json({ message: "Review not found." });

    await persistReviewsSafely(req.companyId, { pruneMissing: true });
    return res.status(204).end();
  } catch (error) {
    console.error("Review delete failed:", error);
    return res.status(500).json({ message: "Unable to delete review. Please try again." });
  }
});

export default router;
