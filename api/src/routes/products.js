import { Router } from "express";
import {
  companyProductSchemaRepository,
  deleteProductWithTenantCatalogLock,
  productRepository,
  saveProductWithTenantCatalogLock,
} from "../data/store.js";
import { isVariantVisible, withVariantVisibility } from "../products/variantVisibility.js";
import { normalizeStockValue, preserveOmittedVariantStock } from "../products/productStock.js";
import { recordActivityLog } from "../activityLog/logger.js";
import { defaultProductSchema, sanitizeProductSchemaData } from "../productSchema/schema.js";
import { effectiveTenantRole, optionalAuth, requireAuth } from "../middleware/auth.js";
import { listTenantProductFieldValues } from "../productSchema/fieldValues.js";

const router = Router();
const placeholderImage = "/images/products/product-placeholder.svg";
const emptyImage = "";

function requireProductPermission(permission) {
  return (req, res, next) => {
    if (
      ["admin", "company_admin", "super_admin"].includes(effectiveTenantRole(req))
      || req.user?.permissions?.includes(permission)
    ) {
      return next();
    }
    return res.status(403).json({ message: "Product permission required." });
  };
}

function isRealImageUrl(value) {
  return typeof value === "string"
    && value.trim()
    && !value.trim().includes("/images/products/product-placeholder");
}

function preserveImageUrl(existingValue, incomingValue) {
  if (incomingValue === null || incomingValue === "") return "";
  if (isRealImageUrl(incomingValue)) return incomingValue.trim();
  const existing = isRealImageUrl(existingValue) ? existingValue : "";
  return existing || incomingValue || "";
}

function normalizeGalleryImages(product) {
  const source = product.gallery_images || product.galleryImages || [];
  return source
    .map((entry, index) => {
      const imageUrl = typeof entry === "string" ? entry : entry?.image_url || entry?.image || entry?.url;
      if (!imageUrl) return null;
      return {
        id: typeof entry === "object" && entry?.id ? entry.id : `gallery-${index}-${Date.now()}`,
        image_url: imageUrl,
        sort_order: Number(typeof entry === "object" ? entry?.sort_order ?? entry?.sortOrder ?? index : index),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.sort_order - b.sort_order);
}

function normalizeVariants(product) {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  if (variants.length) {
    return variants
      .map((variant, index) => withVariantVisibility({
        ...variant,
        id: variant.id || `${product.id || "product"}-variant-${index}-${Date.now()}`,
        color_name: variant.color_name || variant.colorName || "Default",
        color_value: variant.color_value || variant.colorValue || variant.colorHex || "",
        size: variant.size || "500ml",
        price: Number(variant.price || 0),
        wholesalePrice: variant.wholesalePrice != null ? Number(variant.wholesalePrice) : undefined,
        stock: normalizeStockValue(variant.stock ?? variant.stockQty ?? product.stockQty, {
          fallback: 0,
          label: `Variant ${index + 1} stock`,
        }),
        image_url: variant.image_url || variant.imageUrl || variant.image || "",
        sort_order: Number(variant.sort_order ?? variant.sortOrder ?? index),
      }))
      .sort((a, b) => a.sort_order - b.sort_order);
  }

  return (product.sizes || []).map((sizeOption, index) => withVariantVisibility({
    id: `${product.id || "product"}-variant-${index}`,
    color_name: "Default",
    color_value: "",
    size: sizeOption.size || "500ml",
    price: Number(sizeOption.price || 0),
    wholesalePrice: sizeOption.wholesalePrice != null ? Number(sizeOption.wholesalePrice) : undefined,
    stock: normalizeStockValue(product.stockQty, { fallback: 24, label: `Variant ${index + 1} stock` }),
    image_url: product.image || "",
    sort_order: index,
  }));
}

function sizesFromVariants(variants, fallbackSizes = []) {
  const bySize = new Map();
  variants.filter(isVariantVisible).forEach((variant) => {
    const current = bySize.get(variant.size);
    if (!current || Number(variant.price) < Number(current.price)) {
      bySize.set(variant.size, { size: variant.size, price: Number(variant.price || 0) });
    }
  });
  if (bySize.size) return Array.from(bySize.values());
  return variants.length ? [] : fallbackSizes;
}

function normalizeProduct(product) {
  const primarySource = product.image || product.primaryImage || product.primary_image || "";
  const hoverSource = product.hoverImage || product.secondaryImage || product.secondary_image || "";
  const image = isRealImageUrl(primarySource) ? primarySource.trim() : emptyImage;
  const hoverImage = isRealImageUrl(hoverSource) ? hoverSource.trim() : emptyImage;

  const galleryImages = normalizeGalleryImages(product);
  const variants = normalizeVariants({ ...product, image: image || placeholderImage });

  return {
    ...product,
    image,
    hoverImage,
    variants,
    sizes: sizesFromVariants(variants, product.sizes || []),
    gallery_images: galleryImages,
    galleryImages: galleryImages.map((entry) => entry.image_url),
    fallbackImage: product.fallbackImage || placeholderImage,
  };
}

function productSchemaForCompany(companyId) {
  return companyProductSchemaRepository.findByCompany(companyId, () => true)?.schema || defaultProductSchema();
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function sendProductPersistenceError(req, res, error, operation) {
  if (error?.statusCode) return res.status(error.statusCode).json({ message: error.message });
  console.error(`Product ${operation} failed`, {
    code: error?.code || "UNKNOWN",
    constraint: error?.constraint || "",
  });
  const arabic = String(req.headers["accept-language"] || "").toLowerCase().startsWith("ar");
  if (error?.code === "23505") {
    return res.status(409).json({
      code: "PRODUCT_VARIANT_CONFLICT",
      message: arabic
        ? "تعذر حفظ متغيرات المنتج بأمان. أعد تحميل المنتج وحاول مرة أخرى."
        : "Product variants could not be saved safely. Reload the product and try again.",
    });
  }
  return res.status(500).json({
    code: "PRODUCT_SAVE_FAILED",
    message: arabic ? "تعذر حفظ المنتج. يرجى المحاولة مرة أخرى." : "Product could not be saved. Please try again.",
  });
}

function variantSignature(variant = {}) {
  return `${variant.color_name || variant.colorName || ""}__${variant.size || ""}`.toLowerCase();
}

function mergeVariantImageUrls(existingProduct, incomingVariants) {
  if (!Array.isArray(incomingVariants)) {
    return incomingVariants;
  }

  const existingVariants = normalizeVariants(existingProduct);
  const existingById = new Map(existingVariants.map((variant) => [variant.id, variant]));
  const existingBySignature = new Map(existingVariants.map((variant) => [variantSignature(variant), variant]));

  return incomingVariants.map((variant) => {
    const existing =
      existingById.get(variant.id) ||
      existingBySignature.get(variantSignature(variant));
    const withStock = preserveOmittedVariantStock(existing || {}, variant);
    const incomingImage = variant.image_url || variant.imageUrl || variant.image || "";
    if (isRealImageUrl(incomingImage)) {
      return withStock;
    }

    const existingImage = existing?.image_url || existing?.imageUrl || existing?.image || "";
    return existingImage ? { ...withStock, image_url: existingImage } : withStock;
  });
}

function mergeProductUpdate(existingProduct, incomingProduct) {
  const merged = {
    ...existingProduct,
    ...incomingProduct,
    image: preserveImageUrl(
      existingProduct.image || existingProduct.primaryImage || existingProduct.primary_image || "",
      incomingProduct.image || incomingProduct.primaryImage || incomingProduct.primary_image || "",
    ),
    hoverImage: preserveImageUrl(
      existingProduct.hoverImage || existingProduct.secondaryImage || existingProduct.secondary_image || "",
      incomingProduct.hoverImage || incomingProduct.secondaryImage || incomingProduct.secondary_image || "",
    ),
    updatedAt: new Date().toISOString(),
  };

  if (hasOwn(incomingProduct, "variants")) {
    merged.variants = mergeVariantImageUrls(existingProduct, incomingProduct.variants);
  }

  if (hasOwn(incomingProduct, "gallery_images") || hasOwn(incomingProduct, "galleryImages")) {
    const incomingGallery = normalizeGalleryImages(incomingProduct);
    const existingGallery = normalizeGalleryImages(existingProduct);
    const shouldClearGallery = incomingProduct.clearGalleryImages === true;
    const mergedGallery = shouldClearGallery ? [] : incomingGallery.length ? incomingGallery : existingGallery;
    merged.gallery_images = mergedGallery;
    merged.galleryImages = mergedGallery.map((entry) => entry.image_url);
  }

  return merged;
}

function normalizedReferenceValue(value, field) {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !value.trim()) {
    const error = new Error(`${field} must be a non-empty string or null.`);
    error.statusCode = 400;
    throw error;
  }
  return value.trim();
}

function canonicalNormalizedCatalogReferences(incoming) {
  if (hasOwn(incoming, "category_id") || hasOwn(incoming, "brand_id")) {
    const error = new Error("category_id and brand_id are not accepted; use categoryId and brandId.");
    error.statusCode = 400;
    throw error;
  }
  const references = {};
  const hasCategory = hasOwn(incoming, "categoryId");
  const hasBrand = hasOwn(incoming, "brandId");
  if (hasCategory) {
    references.categoryId = normalizedReferenceValue(incoming.categoryId, "categoryId");
  }
  if (hasBrand) {
    references.brandId = normalizedReferenceValue(incoming.brandId, "brandId");
  }
  return references;
}

router.get("/", optionalAuth, (_req, res) => {
  res.json(productRepository.getByCompany(_req.companyId).map(normalizeProduct));
});

router.get("/:id/details", optionalAuth, async (req, res, next) => {
  const product = productRepository.findByCompany(req.companyId, req.params.id);
  if (!product || product.isActive === false) return res.status(404).json({ message: "Product not found." });
  try {
    const values = await listTenantProductFieldValues(req.companyId, req.params.id);
    const fields = {};
    for (const entry of values) {
      const key = entry.storefront_mapping_key || entry.field_key;
      if (entry.locale === "neutral") fields[key] = entry.value;
      else fields[key] = { ...(fields[key] || {}), [entry.locale]: entry.value };
    }
    return res.json({ ...normalizeProduct(product), fields });
  } catch (error) {
    return next(error);
  }
});

router.post("/", requireAuth, requireProductPermission("products.create"), async (req, res) => {
  let product;
  try {
    const normalizedReferences = canonicalNormalizedCatalogReferences(req.body);
    product = normalizeProduct(sanitizeProductSchemaData({
      ...req.body,
      ...normalizedReferences,
      id: req.body.id || `product-${Date.now()}`,
      slug: req.body.slug || `product-${Date.now()}`,
    }, productSchemaForCompany(req.companyId)));
    product = await saveProductWithTenantCatalogLock(req.companyId, product, { isCreate: true });
  } catch (error) {
    return sendProductPersistenceError(req, res, error, "creation");
  }
  recordActivityLog({
    req,
    companyId: req.companyId,
    action: "product.created",
    entityType: "product",
    entityId: product.id,
    entityLabel: product.name?.en || product.slug || "",
    summary: `Product "${product.name?.en || product.slug}" created`,
    afterData: { name: product.name?.en || product.slug, category: product.categoryId },
  });
  res.status(201).json(product);
});

router.put("/:id", requireAuth, requireProductPermission("products.update"), async (req, res) => {
  const existing = productRepository.findByCompany(req.companyId, req.params.id);
  if (!existing) {
    return res.status(404).json({ message: "Product not found." });
  }
  let normalizedUpdate;
  try {
    const normalizedReferences = canonicalNormalizedCatalogReferences(req.body);
    normalizedUpdate = normalizeProduct(sanitizeProductSchemaData(mergeProductUpdate(existing, {
      ...req.body,
      ...normalizedReferences,
      id: req.params.id,
    }), productSchemaForCompany(req.companyId)));
    normalizedUpdate = await saveProductWithTenantCatalogLock(req.companyId, normalizedUpdate);
  } catch (error) {
    return sendProductPersistenceError(req, res, error, "update");
  }
  const updated = normalizedUpdate;
  const updatedName = updated.name?.en || updated.slug || "";
  const wasVisible = existing.visible !== false;
  const nowVisible = updated.visible !== false;
  const visibilityChanged = wasVisible !== nowVisible;
  recordActivityLog({
    req,
    companyId: req.companyId,
    action: visibilityChanged ? "product.visibility_changed" : "product.updated",
    entityType: "product",
    entityId: existing.id,
    entityLabel: updatedName,
    summary: visibilityChanged
      ? `Product "${updatedName}" ${nowVisible ? "shown" : "hidden"}`
      : `Product "${updatedName}" updated`,
    beforeData: { name: existing.name?.en || existing.slug, visible: existing.visible !== false },
    afterData: { name: updatedName, visible: updated.visible !== false },
  });
  return res.json(updated);
});

router.delete("/:id", requireAuth, requireProductPermission("products.delete"), async (req, res) => {
  try {
    const removed = await deleteProductWithTenantCatalogLock(req.companyId, req.params.id);
    if (!removed) return res.status(404).json({ message: "Product not found." });
    const removedName = removed.name?.en || removed.slug || "";
    recordActivityLog({
      req,
      companyId: req.companyId,
      action: "product.deleted",
      entityType: "product",
      entityId: removed.id,
      entityLabel: removedName,
      summary: `Product "${removedName}" deleted`,
      beforeData: { name: removedName, category: removed.categoryId },
    });
    return res.status(204).end();
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.statusCode ? error.message : "Product deletion failed.",
    });
  }
});

export default router;
