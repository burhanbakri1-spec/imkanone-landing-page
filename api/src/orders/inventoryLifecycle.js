import crypto from "node:crypto";
import { isVariantVisible } from "../products/variantVisibility.js";

export function orderLifecycleError(code, message, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

export function requireIdempotencyKey(value) {
  const key = String(value || "").trim();
  if (!key) throw orderLifecycleError("IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key header is required.");
  if (key.length > 200) throw orderLifecycleError("IDEMPOTENCY_CONFLICT", "Idempotency-Key is too long.", 409);
  return key;
}

export function canonicalOrderLines(input) {
  if (!Array.isArray(input) || !input.length) {
    throw orderLifecycleError("INVALID_QUANTITY", "At least one order item is required.");
  }
  const aggregated = new Map();
  for (const line of input.slice(0, 100)) {
    const productId = String(line?.productId || "").trim();
    const variantId = String(line?.variantId || "").trim() || null;
    const quantity = Number(line?.quantity);
    if (!productId) throw orderLifecycleError("INVALID_PRODUCT", "Product is required.", 404);
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      throw orderLifecycleError("INVALID_QUANTITY", "Order quantity must be a positive integer.");
    }
    const key = `${productId}\u0000${variantId || ""}`;
    const current = aggregated.get(key);
    aggregated.set(key, current
      ? { ...current, quantity: current.quantity + quantity }
      : { productId, variantId, quantity });
  }
  return [...aggregated.values()].sort((a, b) =>
    a.productId.localeCompare(b.productId) || String(a.variantId || "").localeCompare(String(b.variantId || ""))
  );
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

export function orderRequestFingerprint({ customer, items, paymentMethod, delivery, pointsRedeemed }) {
  return crypto.createHash("sha256").update(JSON.stringify(stableValue({
    customer,
    items: canonicalOrderLines(items),
    paymentMethod: String(paymentMethod || ""),
    delivery: delivery || null,
    pointsRedeemed: Number(pointsRedeemed || 0),
  }))).digest("hex");
}

export function serverOrderItem(product, variant, quantity, { wholesale = false } = {}) {
  if (!product || product.isActive === false || product.is_active === false) {
    throw orderLifecycleError("INVALID_PRODUCT", "Product not found or inactive.", 404);
  }
  const variants = Array.isArray(product.variants) ? product.variants : [];
  if (variants.length && (!variant || !isVariantVisible(variant))) {
    throw orderLifecycleError("INVALID_VARIANT", "Product variant not found or unavailable.");
  }
  if (!variants.length && variant) throw orderLifecycleError("INVALID_VARIANT", "Product has no variants.");
  const price = Number(
    wholesale
      ? variant?.wholesalePrice ?? variant?.wholesale_price ?? product.wholesalePrice ?? product.wholesale_price ?? variant?.price ?? product.price
      : variant?.price ?? product.price
  );
  const unitPrice = Number.isFinite(price) && price >= 0 ? price : 0;
  return {
    productId: product.id,
    productName: typeof product.name === "object" ? product.name.en || product.name.ar || product.id : product.name || product.id,
    productSku: String(product.sku || ""),
    variantId: variant?.id || null,
    variantSku: String(variant?.sku || ""),
    variantName: [variant?.colorName || variant?.color_name, variant?.size].filter(Boolean).join(" / "),
    colorName: variant?.colorName || variant?.color_name || "",
    colorValue: variant?.colorValue || variant?.color_value || "",
    selectedSize: variant?.size || "",
    quantity,
    price: unitPrice,
    lineTotal: unitPrice * quantity,
    inventoryManaged: true,
  };
}

const allowedTransitions = new Map([
  ["Pending", new Set(["Processing", "Completed", "Cancelled"])],
  ["Processing", new Set(["Completed", "Cancelled"])],
  ["Completed", new Set()],
  ["Cancelled", new Set()],
]);

export function validateOrderTransition(current, next) {
  const currentStatus = String(current || "Pending");
  const nextStatus = String(next || "");
  if (currentStatus === nextStatus) return { status: nextStatus, changed: false };
  if (!allowedTransitions.get(currentStatus)?.has(nextStatus)) {
    throw orderLifecycleError("INVALID_ORDER_TRANSITION", `Order cannot move from ${currentStatus} to ${nextStatus}.`, 409);
  }
  return { status: nextStatus, changed: true };
}
