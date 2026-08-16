import { apiRequest } from "./api.js";
import { isCompanyAdmin } from "./roles.js";

export async function getOrders(currentUser) {
  if (!currentUser) {
    return [];
  }

  return isCompanyAdmin(currentUser.role) ||
    currentUser.permissions?.includes("orders.view")
    ? apiRequest("/orders")
    : apiRequest("/orders/my-orders");
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

function newIdempotencyKey() {
  return globalThis.crypto?.randomUUID?.()
    || `order-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createOrderSubmissionTracker() {
  let current = null;
  return {
    keyFor(payload) {
      const fingerprint = JSON.stringify(stableValue(payload));
      if (!current || current.fingerprint !== fingerprint) {
        current = { fingerprint, key: newIdempotencyKey() };
      }
      return current.key;
    },
    confirm() {
      current = null;
    },
  };
}

export async function createOrder({
  cartItems = [],
  customer,
  items,
  total,
  idempotencyKey: requestedIdempotencyKey,
  createdByEmployeeId,
  createdByEmployeeName,
}) {
  const idempotencyKey = String(requestedIdempotencyKey || "").trim();
  if (!idempotencyKey) {
    throw new Error("A stable Idempotency-Key is required for order creation.");
  }
  const orderItems = (items || cartItems).map((item) => ({
    productId: item.productId,
    productName: item.productName || item.label || item.slug || "",
    slug: item.slug || item.productId,
    selectedSize: item.selectedSize || item.size,
    size: item.size || item.selectedSize,
    variantId: item.variantId || "",
    selectedColor: item.selectedColor || item.colorName || "",
    colorName: item.colorName || item.selectedColor || "",
    colorValue: item.colorValue || "",
    quantity: Number(item.quantity || 1),
    price: Number(item.price || 0),
    lineTotal:
      item.lineTotal ?? Number(item.price || 0) * Number(item.quantity || 1),
  }));

  return apiRequest("/orders", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({
      customer,
      items: orderItems,
      subtotal: total,
      total,
      paymentMethod: "Cash on delivery",
      createdByEmployeeId,
      createdByEmployeeName,
    }),
  });
}

export async function updateOrderStatus(orderId, status) {
  return apiRequest(`/orders/${orderId}/status`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
}

export async function assignOrderEmployee(orderId, employeeId) {
  return apiRequest(`/orders/${orderId}/assign-employee`, {
    method: "PUT",
    body: JSON.stringify({ employeeId }),
  });
}

export async function deleteOrder(orderId) {
  return apiRequest(`/orders/${orderId}`, {
    method: "DELETE",
  });
}
