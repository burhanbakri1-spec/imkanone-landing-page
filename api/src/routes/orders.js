import { Router } from "express";
import { deliveryZoneRepository, orderRepository, persistCompanyStore, productRepository } from "../data/store.js";
import { optionalAuth, publicUser, requireAuth } from "../middleware/auth.js";
import { findEnabledZone } from "../delivery/schema.js";
import { isVariantVisible } from "../products/variantVisibility.js";

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

router.get("/", requireAuth, (req, res) => {
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

router.get("/my-orders", requireAuth, (req, res) => {
  res.json(
    orderRepository
      .getByCompany(req.companyId)
      .filter((order) => order.customerUserId === req.user.id),
  );
});

router.post("/", optionalAuth, async (req, res) => {
  const user = req.user;
  const customer = guestOrderCustomer(req.body.customer);
  const items = orderItems(req.body.items);
  if (!customer.name || !customer.phone || !customer.city || !customer.address) {
    return res.status(400).json({ message: "Name, phone, city, and address are required." });
  }
  if (!items.length) {
    return res.status(400).json({ message: "At least one order item is required." });
  }
  if (hasUnavailableVariant(items, req.companyId)) {
    return res.status(409).json({ message: "One or more selected product variants are unavailable." });
  }

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

  const subtotal = Math.max(0, safeNumber(req.body.subtotal || req.body.total));
  const orderTotal = subtotal + deliveryPrice;
  const isCustomer = user?.role === "customer";
  const isStaff = isStaffRole(user?.role);
  const isPortalOperator = user?.role === "admin" || user?.role === "manager";
  const pointsRedeemed = isCustomer ? Math.max(0, safeNumber(req.body.pointsRedeemed)) : 0;
  const discountFromPoints = isCustomer
    ? Math.max(0, safeNumber(req.body.discountFromPoints))
    : 0;
  const pointsEarned = isCustomer ? Math.max(0, Math.floor(orderTotal)) : 0;
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (isCustomer) {
    user.ebPoints = Math.max(0, Number(user.ebPoints || 0) - pointsRedeemed) + pointsEarned;
    user.totalPointsEarned = Math.max(0, Number(user.totalPointsEarned || 0)) + pointsEarned;
    user.totalPointsRedeemed = Math.max(0, Number(user.totalPointsRedeemed || 0)) + pointsRedeemed;
  }

  orderRepository.createForCompany(req.companyId, order, { prepend: true });
  await persistCompanyStore(req.companyId);
  res.status(201).json(order);
});

router.put("/:id/status", requireAuth, async (req, res) => {
  const order = orderRepository.findByCompany(req.companyId, req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found." });

  order.status = req.body.status || order.status;
  order.lastUpdatedBy = publicUser(req.user);
  order.updatedAt = new Date().toISOString();
  await persistCompanyStore(req.companyId);
  return res.json(order);
});

router.put("/:id/assign-employee", requireAuth, async (req, res) => {
  const order = orderRepository.findByCompany(req.companyId, req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found." });

  order.handledByEmployeeId = req.body.employeeId || "";
  order.assignedToEmployeeId = req.body.employeeId || "";
  order.lastUpdatedBy = publicUser(req.user);
  order.updatedAt = new Date().toISOString();
  await persistCompanyStore(req.companyId);
  return res.json(order);
});

router.delete("/:id", requireAuth, async (req, res) => {
  const removed = orderRepository.deleteForCompany(req.companyId, req.params.id);
  if (!removed) return res.status(404).json({ message: "Order not found." });

  await persistCompanyStore(req.companyId, { pruneMissing: true });
  return res.status(204).end();
});

export default router;
