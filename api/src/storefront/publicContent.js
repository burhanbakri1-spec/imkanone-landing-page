const localized = (value, fallback = "") => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return {
      en: String(value.en ?? value.english ?? fallback ?? ""),
      ar: String(value.ar ?? value.arabic ?? value.en ?? fallback ?? ""),
    };
  }
  const text = String(value ?? fallback ?? "");
  return { en: text, ar: text };
};

const localizedWithLegacyArabic = (value, arabicValue, fallback = "") => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return localized({
      ...value,
      ar: arabicValue ?? value.ar ?? value.arabic ?? value.en ?? value.english ?? fallback,
    }, fallback);
  }
  return localized({ en: value ?? fallback, ar: arabicValue ?? value ?? fallback }, fallback);
};

const finiteNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const safeUrl = (value) => {
  const url = String(value || "").trim();
  if (!url) return "";
  if (url.startsWith("/uploads/")) return url;
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : "";
  } catch {
    return "";
  }
};

const safeOption = (option = {}) => ({
  name: localized(option.name || { en: option.nameEn, ar: option.nameAr }),
  values: (Array.isArray(option.values) ? option.values : []).map((value) => ({
    label: localized(value.label || { en: value.labelEn, ar: value.labelAr }),
    color: String(value.color || "").slice(0, 32),
    priceDelta: finiteNumber(value.priceDelta, 0),
    image: safeUrl(value.image),
  })),
});

export function serializePublicProduct(product = {}) {
  const gallery = Array.isArray(product.gallery_images)
    ? product.gallery_images.map((item) => safeUrl(item?.image_url || item?.url || item)).filter(Boolean)
    : (Array.isArray(product.galleryImages) ? product.galleryImages.map(safeUrl).filter(Boolean) : []);
  const variants = (Array.isArray(product.variants) ? product.variants : [])
    .filter((variant) => variant?.isActive !== false && variant?.visible !== false)
    .map((variant) => ({
      id: String(variant.id || ""),
      colorName: localized(variant.colorName || variant.color_name || ""),
      colorValue: String(variant.colorValue || variant.color_value || "").slice(0, 32),
      size: localized(variant.size || ""),
      price: finiteNumber(variant.price, 0),
      stock: Math.max(0, finiteNumber(variant.stock, 0)),
      image: safeUrl(variant.image_url || variant.imageUrl || variant.image),
      sortOrder: finiteNumber(variant.sort_order ?? variant.sortOrder, 0),
    }));

  return {
    id: String(product.id || ""),
    slug: String(product.slug || ""),
    sku: String(product.sku || ""),
    name: localized(product.name || { en: product.nameEn, ar: product.nameAr }),
    shortDescription: localizedWithLegacyArabic(product.shortDescription, product.shortDescriptionAr),
    description: localizedWithLegacyArabic(
      product.fullDescription || product.description,
      product.fullDescriptionAr || product.descriptionAr,
    ),
    price: finiteNumber(product.price ?? product.basePrice, variants[0]?.price || 0),
    originalPrice: product.originalPrice == null ? null : finiteNumber(product.originalPrice, 0),
    categoryId: String(product.categoryId || ""),
    brandId: String(product.brandId || ""),
    brand: String(product.brand || ""),
    // Catalog hierarchy + manufacturer (backward-compatible additions).
    mainCategoryId: product.mainCategoryId ? String(product.mainCategoryId) : null,
    subcategoryId: product.subcategoryId ? String(product.subcategoryId) : (product.categoryId ? String(product.categoryId) : null),
    manufacturer: String(product.manufacturer || ""),
    // Kids Velvet product filters.
    age: String(product.age || ""),
    gender: String(product.gender || ""),
    skill: String(product.skill || ""),
    occasion: String(product.occasion || ""),
    quickShop: product.quickShop === true,
    image: safeUrl(product.image || product.primaryImage),
    hoverImage: safeUrl(product.hoverImage || product.secondaryImage),
    gallery,
    variants,
    options: (Array.isArray(product.options) ? product.options : []).map(safeOption),
    badge: localizedWithLegacyArabic(product.label || product.badge, product.labelAr || product.badgeAr),
    availability: localizedWithLegacyArabic(product.availability, product.availabilityAr),
    featured: product.featured === true,
    sortOrder: finiteNumber(product.sortOrder, 0),
  };
}

export function serializePublicCategory(category = {}) {
  return {
    id: String(category.id || ""),
    slug: String(category.slug || ""),
    name: localized(category.name),
    description: localized(category.description),
    image: safeUrl(category.imageUrl),
    parentId: category.parentId ? String(category.parentId) : null,
    sortOrder: finiteNumber(category.sortOrder, 0),
  };
}

export function serializePublicWebsiteText(item = {}, locale = "en") {
  const values = { en: String(item.valueEn || ""), ar: String(item.valueAr || item.valueEn || "") };
  return {
    key: String(item.key || ""),
    group: String(item.group || ""),
    label: String(item.label || ""),
    values,
    value: values[locale] || values.en,
    sortOrder: finiteNumber(item.sortOrder, 0),
  };
}

export function serializePublicWebsiteMedia(item = {}) {
  return {
    sectionKey: String(item.sectionKey || ""),
    sectionLabel: String(item.sectionLabel || ""),
    groupKey: String(item.groupKey || ""),
    mediaType: String(item.mediaType || item.media_type || (item.videoUrl ? "video" : "image")),
    image: safeUrl(item.imageUrl),
    fallbackImage: safeUrl(item.fallbackImageUrl),
    video: safeUrl(item.videoUrl),
    title: String(item.title || ""),
    subtitle: String(item.subtitle || ""),
    linkUrl: safeUrl(item.linkUrl),
    sortOrder: finiteNumber(item.sortOrder, 0),
  };
}
