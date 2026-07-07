import { Router } from "express";
import {
  deliveryZoneRepository,
  orderRepository,
  persistCompanyStore,
  productRepository,
  userRepository,
} from "../data/store.js";
import { optionalAuth, publicUser, requireAuth } from "../middleware/auth.js";
import { findEnabledZone } from "../delivery/schema.js";
import { isVariantVisible } from "../products/variantVisibility.js";
import { recordActivityLog } from "../activityLog/logger.js";

const router = Router();

function isStaffRole(role) {
  return role === "employee" || role === "staff";
}

function cleanText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const completedStatuses = new Set(["completed", "confirmed", "paid"]);
const cancelledStatuses = new Set(["cancelled", "canceled", "refunded", "void", "voided"]);

function normalizedStatus(value) {
  return String(value || "").trim().toLowerCase();
}

function productSubtotal(items) {
  return items.reduce(
    (sum, item) => sum + Math.max(0, safeNumber(item.lineTotal, item.price * item.quantity)),
    0,
  );
}

function redemptionForOrder(user, requestedPoints, subtotal) {
  const requested = Math.max(0, Math.floor(safeNumber(requestedPoints)));
  if (requested % 100 !== 0) {
    const error = new Error("EB Points must be redeemed in increments of 100.");
    error.statusCode = 400;
    throw error;
  }
  const available = Math.max(0, Math.floor(safeNumber(user?.ebPoints)));
  const maxByBalance = Math.floor(available / 100) * 100;
  const maxBySubtotal = Math.floor(Math.max(0, subtotal) / 5) * 100;
  const maximum = Math.min(maxByBalance, maxBySubtotal);
  if (requested > maximum) {
    const error = new Error("The requested EB Points exceed the available balance or product subtotal.");
    error.statusCode = 400;
    throw error;
  }
  return {
    points: requested,
    discount: requested / 20,
  };
}

function orderCustomer(companyId, order) {
  if (!order.customerUserId) return null;
  return userRepository.findByCompany(companyId, order.customerUserId);
}

function applyLoyaltyForStatus(companyId, order, nextStatus) {
  const customer = orderCustomer(companyId, order);
  if (!customer) return;
  const status = normalizedStatus(nextStatus);
  const now = new Date().toISOString();

  if (completedStatuses.has(status) && !order.pointsAwardedAt) {
    const earned = Math.max(0, Math.floor(safeNumber(order.pointsEarned)));
    customer.ebPoints = Math.max(0, safeNumber(customer.ebPoints)) + earned;
    customer.totalPointsEarned = Math.max(0, safeNumber(customer.totalPointsEarned)) + earned;
    order.pointsAwardedAt = now;
    order.pointsReversedAt = null;
  }

  if (cancelledStatuses.has(status)) {
    if (order.pointsAwardedAt && !order.pointsReversedAt) {
      const earned = Math.max(0, Math.floor(safeNumber(order.pointsEarned)));
      customer.ebPoints = Math.max(0, safeNumber(customer.ebPoints) - earned);
      customer.totalPointsEarned = Math.max(0, safeNumber(customer.totalPointsEarned) - earned);
      order.pointsReversedAt = now;
    }
    if (order.pointsRedeemed > 0 && order.pointsRedemptionAppliedAt && !order.pointsRedemptionRestoredAt) {
      const redeemed = Math.max(0, Math.floor(safeNumber(order.pointsRedeemed)));
      customer.ebPoints = Math.max(0, safeNumber(customer.ebPoints)) + redeemed;
      customer.totalPointsRedeemed = Math.max(0, safeNumber(customer.totalPointsRedeemed) - redeemed);
      order.pointsRedemptionRestoredAt = now;
    }
  }
}

function guestOrderCustomer(input) {
  return {
    name: cleanText(input?.name, 120),
    phone: cleanText(input?.phone, 40),
    city: cleanText(input?.city, 120),
    address: cleanText(input?.address, 300),
    notes: cleanText(input?.notes, 1000),
  };
}

function orderItems(input) {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 100).map((item) => {
    const quantity = Math.max(1, safeNumber(item?.quantity, 1));
    const price = Math.max(0, safeNumber(item?.price));
    return {
      productId: cleanText(item?.productId, 160),
      productName: cleanText(item?.productName, 240),
      slug: cleanText(item?.slug, 240),
      selectedSize: cleanText(item?.selectedSize || item?.size, 120),
      size: cleanText(item?.size || item?.selectedSize, 120),
      variantId: cleanText(item?.variantId, 160),
      selectedColor: cleanText(item?.selectedColor || item?.colorName, 120),
      colorName: cleanText(item?.colorName || item?.selectedColor, 120),
      colorValue: cleanText(item?.colorValue, 80),
      quantity,
      price,
      lineTotal: Math.max(0, safeNumber(item?.lineTotal, price * quantity)),
    };
  }).filter((item) => item.productId || item.slug);
}

function hasUnavailableVariant(items, companyId) {
  const products = productRepository.getByCompany(companyId);
  return items.some((item) => {
    const product = products.find(
      (candidate) => candidate.id === item.productId || candidate.slug === item.slug,
    );
    if (!product) return true;

    const variants = Array.isArray(product.variants) ? product.variants : [];
    if (!variants.length) return false;

    const matchingVariant = item.variantId
      ? variants.find((variant) => variant.id === item.variantId)
      : variants.find((variant) => {
          const sameSize = String(variant.size || "") === String(item.selectedSize || item.size || "");
          const selectedColor = item.colorName || item.selectedColor || "";
          const variantColor = variant.color_name || variant.colorName || "";
          return sameSize && (!selectedColor || selectedColor === variantColor);
        });

    return !matchingVariant || !isVariantVisible(matchingVariant);
  });
}

function matchingVariantForItem(item, products) {
  const product = products.find(
    (candidate) => candidate.id === item.productId || candidate.slug === item.slug,
  );
  if (!product) return null;
  const variants = Array.isArray(product.variants) ? product.variants : [];
  if (!variants.length) return null;
  const match = item.variantId
    ? variants.find((variant) => variant.id === item.variantId)
    : variants.find((variant) => {
        const sameSize = String(variant.size || "") === String(item.selectedSize || item.size || "");
        const selectedColor = item.colorName || item.selectedColor || "";
        const variantColor = variant.color_name || variant.colorName || "";
        return sameSize && (!selectedColor || selectedColor === variantColor);
      });
  return match || null;
}

function enforceItemPrices(items, user, companyId) {
  const isTrader = user?.accountType === "trader" || user?.accountType === "wholesale";
  const products = productRepository.getByCompany(companyId);
  return items.map((item) => {
    const variant = matchingVariantForItem(item, products);
    if (!variant) return item;
    const correctPrice = isTrader && Number(variant.wholesalePrice || 0) > 0
      ? Number(variant.wholesalePrice)
      : Number(variant.price || 0);
    return {
      ...item,
      price: correctPrice,
      lineTotal: correctPrice * item.quantity,
    };
  });
}

async function safeRecordActivityLog(params) {
  try {
    await recordActivityLog(params);
  } catch (error) {
    console.error("Activity log failed (non-fatal):", error.message);
  }
}

async function safePersist(companyId) {
  try {
    await persistCompanyStore(companyId);
  } catch (error) {
    console.error("Store persistence failed (non-fatal):", error.message);
  }
}

router.get("/", requireAuth, (req, res) => {
  const orders = orderRepository.getByCompany(req.companyId);
  if (req.user.role === "admin" || req.user.permissions?.includes("orders.view")) {
    const isRestrictedStaff = isStaffRole(req.user.role) && !req.user.permissions?.includes("orders.view");
    if (isRestrictedStaff) {
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

router.get("/my-orders", requireAuth, (req, res) => {
  res.json(
    orderRepository
      .getByCompany(req.companyId)
      .filter((order) => order.customerUserId === req.user.id),
  );
});

router.post("/", optionalAuth, async (req, res) => {
  try {
    const user = req.user;
    const customer = guestOrderCustomer(req.body.customer);
    let items = orderItems(req.body.items);
    if (!customer.name || !customer.phone || !customer.city || !customer.address) {
      return res.status(400).json({ message: "Name, phone, city, and address are required." });
    }
    if (!items.length) {
      return res.status(400).json({ message: "At least one order item is required." });
    }
    if (hasUnavailableVariant(items, req.companyId)) {
      return res.status(409).json({ message: "One or more selected product variants are unavailable." });
    }

    // Enforce server-side pricing (wholesale for traders, retail for others)
    items = enforceItemPrices(items, user, req.companyId);

    // Delivery zone lookup
    const allZones = deliveryZoneRepository.getByCompany(req.companyId).filter((z) => !z.deleted_at);
    let deliveryPrice = 0;
    let deliveryZone = null;
    if (allZones.length > 0) {
      const deliveryZoneId = cleanText(req.body.delivery_zone_id || req.body.deliveryZoneId, 160);
      const cityKey = cleanText(req.body.delivery_city_key || req.body.deliveryCityKey, 120);
      deliveryZone = findEnabledZone(allZones, deliveryZoneId, cityKey);
      if (!deliveryZone) {
        return res.status(400).json({ message: "Selected delivery city is not available." });
      }
      deliveryPrice = deliveryZone.delivery_price;
    }

    const subtotal = productSubtotal(items);
    const freeDeliveryThreshold = 500;
    const isFreeDelivery = subtotal >= freeDeliveryThreshold;
    if (isFreeDelivery) {
      deliveryPrice = 0;
    }
    const isCustomer = user?.role === "customer";
    const isStaff = isStaffRole(user?.role);
    const isPortalOperator = user?.role === "admin" || user?.role === "manager";
    let redemption = { points: 0, discount: 0 };
    try {
      if (isCustomer) redemption = redemptionForOrder(user, req.body.pointsRedeemed, subtotal);
    } catch (error) {
      console.warn("EB Points redemption skipped during order creation:", error.message);
      redemption = { points: 0, discount: 0 };
    }
    const pointsRedeemed = redemption.points;
    const discountFromPoints = redemption.discount;
    const paidProductSubtotal = Math.max(0, subtotal - discountFromPoints);
    const pointsEarned = isCustomer ? Math.floor(paidProductSubtotal) : 0;
    const orderTotal = paidProductSubtotal + deliveryPrice;
    const now = new Date().toISOString();
    const order = {
      id: `ORD-${Date.now()}`,
      customer,
      customerUserId: isCustomer
        ? user.id
        : isPortalOperator
          ? cleanText(req.body.customerUserId, 160) || null
          : null,
      items,
      subtotal,
      total: orderTotal,
      pointsEarned,
      pointsRedeemed,
      discountFromPoints,
      pointsAwardedAt: null,
      pointsReversedAt: null,
      pointsRedemptionAppliedAt: pointsRedeemed > 0 ? now : null,
      pointsRedemptionRestoredAt: null,
      delivery_city_key: deliveryZone ? deliveryZone.city_key : "",
      delivery_city_name: deliveryZone ? deliveryZone.city_name : "",
      delivery_region: deliveryZone ? deliveryZone.region : "",
      delivery_price: deliveryPrice,
      delivery_currency: deliveryZone ? deliveryZone.currency : "",
      paymentMethod: cleanText(req.body.paymentMethod, 80) || "Cash on delivery",
      status: "Pending",
      handledByEmployeeId: isStaff ? user.id : "",
      assignedToEmployeeId: isStaff ? user.id : "",
      createdByEmployeeId:
        isStaff ? user.id : isPortalOperator ? cleanText(req.body.createdByEmployeeId, 160) : "",
      createdByEmployeeName:
        isStaff ? user.name : isPortalOperator ? cleanText(req.body.createdByEmployeeName, 120) : "",
      createdBy: publicUser(user),
      lastUpdatedBy: publicUser(user),
      createdAt: now,
      updatedAt: now,
    };

    if (isCustomer && pointsRedeemed > 0) {
      user.ebPoints = Math.max(0, Number(user.ebPoints || 0) - pointsRedeemed);
      user.totalPointsRedeemed = Math.max(0, Number(user.totalPointsRedeemed || 0)) + pointsRedeemed;
    }

    orderRepository.createForCompany(req.companyId, order, { prepend: true });

    // Persist main data — non-fatal; order is already saved in memory
    await safePersist(req.companyId);

    // Fire activity log — never throws
    safeRecordActivityLog({
      req,
      companyId: req.companyId,
      action: "order.created",
      entityType: "order",
      entityId: order.id,
      entityLabel: order.id || "",
      summary: `Order ${order.id} created for ${customer.name}`,
      afterData: { customer_name: customer.name, total: orderTotal, item_count: items.length },
    });

    return res.status(201).json(order);
  } catch (error) {
    console.error("Order creation failed:", error);
    return res.status(error.statusCode || 500).json({
      message: error.statusCode ? error.message : "Unable to create order. Please try again.",
    });
  }
});

router.put("/:id/status", requireAuth, async (req, res) => {
  try {
    if (!["admin", "company_admin"].includes(req.user.role) && !req.user.permissions?.includes("orders.updateStatus")) {
      return res.status(403).json({ message: "Order status permission required." });
    }
    const order = orderRepository.findByCompany(req.companyId, req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found." });

    const prevStatus = order.status;
    const nextStatus = cleanText(req.body.status, 40) || order.status;
    applyLoyaltyForStatus(req.companyId, order, nextStatus);
    order.status = nextStatus;
    order.lastUpdatedBy = publicUser(req.user);
    order.updatedAt = new Date().toISOString();

    // Persist main data — non-fatal; update is already applied in memory
    await safePersist(req.companyId);

    safeRecordActivityLog({
      req,
      companyId: req.companyId,
      action: "order.status_updated",
      entityType: "order",
      entityId: order.id,
      entityLabel: order.id || "",
      summary: `Order ${order.id} status changed from ${prevStatus} to ${order.status}`,
      beforeData: { status: prevStatus },
      afterData: { status: order.status },
    });
    return res.json(order);
  } catch (error) {
    console.error("Order status update failed:", error);
    return res.status(error.statusCode || 500).json({
      message: error.statusCode ? error.message : "Unable to update order status. Please try again.",
    });
  }
});

router.put("/:id/assign-employee", requireAuth, async (req, res) => {
  try {
    const order = orderRepository.findByCompany(req.companyId, req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found." });

    order.handledByEmployeeId = req.body.employeeId || "";
    order.assignedToEmployeeId = req.body.employeeId || "";
    order.lastUpdatedBy = publicUser(req.user);
    order.updatedAt = new Date().toISOString();

    // Persist main data — non-fatal; update is already applied in memory
    await safePersist(req.companyId);

    safeRecordActivityLog({
      req,
      companyId: req.companyId,
      action: "order.employee_assigned",
      entityType: "order",
      entityId: order.id,
      entityLabel: order.id || "",
      summary: `Employee assigned to order ${order.id}`,
      beforeData: { handledByEmployeeId: order.handledByEmployeeId },
      afterData: { handledByEmployeeId: req.body.employeeId || "" },
    });
    return res.json(order);
  } catch (error) {
    console.error("Order assign employee failed:", error);
    return res.status(error.statusCode || 500).json({
      message: error.statusCode ? error.message : "Unable to assign employee. Please try again.",
    });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const existing = orderRepository.findByCompany(req.companyId, req.params.id);
    if (existing) applyLoyaltyForStatus(req.companyId, existing, "Cancelled");
    const removed = orderRepository.deleteForCompany(req.companyId, req.params.id);
    if (!removed) return res.status(404).json({ message: "Order not found." });

    await persistCompanyStore(req.companyId, { pruneMissing: true });
    return res.status(204).end();
  } catch (error) {
    console.error("Order delete failed:", error);
    return res.status(error.statusCode || 500).json({
      message: error.statusCode ? error.message : "Unable to delete order. Please try again.",
    });
  }
});

export default router;
