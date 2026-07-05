import { Router } from "express";
import { persistCompanyStore, productRepository } from "../data/store.js";
import { isVariantVisible, withVariantVisibility } from "../products/variantVisibility.js";
import { recordActivityLog } from "../activityLog/logger.js";

const router = Router();
const placeholderImage = "/images/products/product-placeholder.svg";

function isRealImageUrl(value) {
  return typeof value === "string" && value.trim() && value.trim() !== placeholderImage;
}

function preserveImageUrl(existingValue, incomingValue) {
  return isRealImageUrl(incomingValue) ? incomingValue.trim() : existingValue || incomingValue || "";
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
        stock: Math.max(0, Number(variant.stock ?? variant.stockQty ?? product.stockQty ?? 0)),
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
    stock: Math.max(0, Number(product.stockQty ?? 24)),
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
  const image = product.image || placeholderImage;
  const hoverImage =
    product.hoverImage ||
    product.secondaryImage ||
    product.gallery?.[1] ||
    "";

  const galleryImages = normalizeGalleryImages(product);
  const variants = normalizeVariants({ ...product, image });

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

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
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
    const incomingImage = variant.image_url || variant.imageUrl || variant.image || "";
    if (isRealImageUrl(incomingImage)) {
      return variant;
    }

    const existing =
      existingById.get(variant.id) ||
      existingBySignature.get(variantSignature(variant));
    const existingImage = existing?.image_url || existing?.imageUrl || existing?.image || "";

    return existingImage ? { ...variant, image_url: existingImage } : variant;
  });
}

function mergeProductUpdate(existingProduct, incomingProduct) {
  const merged = {
    ...existingProduct,
    ...incomingProduct,
    image: preserveImageUrl(existingProduct.image, incomingProduct.image),
    hoverImage: preserveImageUrl(
      existingProduct.hoverImage || existingProduct.secondaryImage,
      incomingProduct.hoverImage || incomingProduct.secondaryImage,
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

router.get("/", (_req, res) => {
  res.json(productRepository.getByCompany(_req.companyId).map(normalizeProduct));
});

router.post("/", async (req, res) => {
  const product = normalizeProduct({
    ...req.body,
    id: req.body.id || `product-${Date.now()}`,
    slug: req.body.slug || `product-${Date.now()}`,
  });
  productRepository.createForCompany(req.companyId, product, { prepend: true });
  await persistCompanyStore(req.companyId);
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

router.put("/:id", async (req, res) => {
  const existing = productRepository.findByCompany(req.companyId, req.params.id);
  if (!existing) {
    return res.status(404).json({ message: "Product not found." });
  }
  const updated = productRepository.updateForCompany(req.companyId, req.params.id, normalizeProduct(mergeProductUpdate(existing, {
    ...req.body,
    id: req.params.id,
  })));
  await persistCompanyStore(req.companyId);
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

router.delete("/:id", async (req, res) => {
  const removed = productRepository.deleteForCompany(req.companyId, req.params.id);
  if (!removed) {
    return res.status(404).json({ message: "Product not found." });
  }
  await persistCompanyStore(req.companyId, { pruneMissing: true });
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
});

export default router;
