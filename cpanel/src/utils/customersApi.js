import { apiRequest } from "./api.js";

export const customerEditableFields = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "type",
  "source",
  "labels",
  "notes",
];

function customerPath(customerId, suffix = "") {
  return `/admin/customers/${encodeURIComponent(customerId)}${suffix}`;
}

export function buildCustomerQuery(filters = {}) {
  const params = new URLSearchParams();
  for (const key of ["q", "type", "archived", "page", "limit"]) {
    const value = filters[key];
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function sanitizeCustomerPayload(values = {}, initial = null) {
  const payload = {};
  for (const field of customerEditableFields) {
    if (!Object.prototype.hasOwnProperty.call(values, field)) continue;
    const value = field === "labels"
      ? (Array.isArray(values.labels) ? values.labels : String(values.labels || "").split(","))
        .map((label) => String(label).trim()).filter(Boolean)
      : String(values[field] ?? "").trim();
    const previous = field === "labels"
      ? (Array.isArray(initial?.labels) ? initial.labels : [])
      : String(initial?.[field] ?? "").trim();
    if (!initial || JSON.stringify(value) !== JSON.stringify(previous)) payload[field] = value;
  }
  return payload;
}

export function fetchCustomers(filters = {}, options = {}) {
  return apiRequest(`/admin/customers${buildCustomerQuery(filters)}`, { signal: options.signal });
}

export function fetchCustomer(customerId, options = {}) {
  return apiRequest(customerPath(customerId), { signal: options.signal });
}

export function createCustomer(values) {
  return apiRequest("/admin/customers", {
    method: "POST",
    body: JSON.stringify(sanitizeCustomerPayload(values)),
  });
}

export function updateCustomer(customerId, values, initial) {
  const payload = sanitizeCustomerPayload(values, initial);
  if (!Object.keys(payload).length) return Promise.resolve(initial);
  return apiRequest(customerPath(customerId), {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function archiveCustomer(customerId) {
  return apiRequest(customerPath(customerId, "/archive"), { method: "POST" });
}

export function restoreCustomer(customerId) {
  return apiRequest(customerPath(customerId, "/restore"), { method: "POST" });
}
