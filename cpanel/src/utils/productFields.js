import { apiRequest } from "./api.js";

export const productFieldApi = {
  definitions: () => apiRequest("/admin/product-field-definitions"),
  values: (productId) => apiRequest(`/admin/products/${encodeURIComponent(productId)}/field-values`),
  saveValues: (productId, values) => apiRequest(`/admin/products/${encodeURIComponent(productId)}/field-values`, {
    method: "PUT",
    body: JSON.stringify({ values }),
  }),
};

export function valuesToFieldState(values = []) {
  const state = {};
  for (const entry of values) {
    if (entry.locale === "neutral") state[entry.field_key] = entry.value;
    else state[entry.field_key] = { ...(state[entry.field_key] || {}), [entry.locale]: entry.value };
  }
  return state;
}

export function fieldStateToValues(definitions = [], state = {}) {
  return definitions.flatMap((definition) => {
    const value = state[definition.field_key];
    if (definition.translatable) return ["en", "ar"].map((locale) => ({ key: definition.field_key, locale, value: value?.[locale] ?? null }));
    return [{ key: definition.field_key, locale: "neutral", value: value ?? null }];
  });
}
