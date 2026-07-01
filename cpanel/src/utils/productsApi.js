import { apiRequest } from "./api.js";

export function fetchProducts() {
  return apiRequest("/products");
}

export function createProduct(product) {
  return apiRequest("/products", {
    method: "POST",
    body: JSON.stringify(product),
  });
}

export function updateProduct(product) {
  return apiRequest(`/products/${product.id}`, {
    method: "PUT",
    body: JSON.stringify(product),
  });
}

export function deleteProduct(productId) {
  return apiRequest(`/products/${productId}`, {
    method: "DELETE",
  });
}
