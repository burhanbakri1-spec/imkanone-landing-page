import { apiRequest } from "./api.js";

export function fetchInventory() {
  return apiRequest("/admin/inventory");
}

export function updateInventory(productId, body) {
  return apiRequest(`/admin/inventory/${encodeURIComponent(productId)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
