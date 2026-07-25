import productPlaceholderUrl from "../assets/product-placeholder.svg";
import { resolveApiAssetUrl } from "./api.js";

const legacyPlaceholderPattern = /\/images\/products\/product-placeholder/i;

export function resolveProductImageUrl(value) {
  const source = typeof value === "string" ? value.trim() : "";
  if (!source || legacyPlaceholderPattern.test(source)) return productPlaceholderUrl;
  return resolveApiAssetUrl(source) || productPlaceholderUrl;
}

export function useProductImagePlaceholder(event) {
  if (!event?.currentTarget || event.currentTarget.src === productPlaceholderUrl) return;
  event.currentTarget.onerror = null;
  event.currentTarget.src = productPlaceholderUrl;
}

export { productPlaceholderUrl };
