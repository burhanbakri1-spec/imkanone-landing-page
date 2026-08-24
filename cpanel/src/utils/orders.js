import { apiRequest } from "./api.js";

export async function getOrders(currentUser) {
  if (!currentUser) {
    return [];
  }

  return currentUser.role === "admin" ||
    currentUser.permissions?.includes("orders.view")
    ? apiRequest("/orders")
    : apiRequest("/orders/my-orders");
}

export async function createOrder({
  cartItems = [],
  customer,
  items,
  total,
  createdByEmployeeId,
  createdByEmployeeName,
}) {
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
