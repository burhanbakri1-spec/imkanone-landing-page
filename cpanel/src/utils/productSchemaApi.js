import { apiRequest } from "./api.js";

export function fetchProductSchema() {
  return apiRequest("/admin/product-schema");
}

export function saveProductSchema(schema) {
  return apiRequest("/admin/product-schema", {
    method: "PATCH",
    body: JSON.stringify(schema),
  });
}
