// Storefront media slot model.
//
// The storefront storefront ("i-play") reads managed media through the dotted
// sectionKey convention exposed by `/api/storefront/content`. Every key in this
// file is a key the storefront already consumes, so the CPanel writes website
// media under those exact keys and the storefront override wins over its local
// fallback. Do not invent new keys here: match the storefront exactly.
//
// Site-level hero slots (consumed by the home, about and contact pages).
export const SITE_MEDIA_SLOTS = [
  {
    key: "home.hero.video",
    kind: "video",
    groupKey: "home",
    labelEn: "Home hero video",
    labelAr: "فيديو الواجهة الرئيسية",
  },
  {
    key: "home.hero.poster",
    kind: "image",
    groupKey: "home",
    labelEn: "Home hero poster",
    labelAr: "صورة الواجهة الرئيسية",
  },
  {
    key: "about.hero.video",
    kind: "video",
    groupKey: "about",
    labelEn: "About hero video",
    labelAr: "فيديو صفحة من نحن",
  },
  {
    key: "about.hero.poster",
    kind: "image",
    groupKey: "about",
    labelEn: "About hero poster",
    labelAr: "صورة صفحة من نحن",
  },
  {
    key: "contact.hero.poster",
    kind: "image",
    groupKey: "contact",
    labelEn: "Contact hero poster",
    labelAr: "صورة صفحة الاتصال",
  },
];

// Brand hero media (consumed via `brand.{slug}.poster` / `brand.{slug}.video`).
export function brandMediaSlots(slug) {
  const safeSlug = String(slug || "").trim();
  return [
    {
      key: `brand.${safeSlug}.video`,
      kind: "video",
      groupKey: "brands",
      labelEn: `Brand ${safeSlug} hero video`,
      labelAr: `فيديو الواجهة - ${safeSlug}`,
    },
    {
      key: `brand.${safeSlug}.poster`,
      kind: "image",
      groupKey: "brands",
      labelEn: `Brand ${safeSlug} hero poster`,
      labelAr: `صورة الواجهة - ${safeSlug}`,
    },
  ];
}

// Category hero video (the category hero image is the category's own image).
export function categoryHeroMediaSlots(slug) {
  const safeSlug = String(slug || "").trim();
  return [
    {
      key: `category.${safeSlug}.heroVideo`,
      kind: "video",
      groupKey: "categories",
      labelEn: `Category ${safeSlug} hero video`,
      labelAr: `فيديو قسم - ${safeSlug}`,
    },
  ];
}

// Product "how to use" media.
export function productMediaSlots(slug) {
  const safeSlug = String(slug || "").trim();
  return [
    {
      key: `product.${safeSlug}.usageVideo`,
      kind: "video",
      groupKey: "products",
      labelEn: `Product ${safeSlug} usage video`,
      labelAr: `فيديو الاستخدام - ${safeSlug}`,
    },
    {
      key: `product.${safeSlug}.usageVideoPoster`,
      kind: "image",
      groupKey: "products",
      labelEn: `Product ${safeSlug} usage video poster`,
      labelAr: `صورة فيديو الاستخدام - ${safeSlug}`,
    },
  ];
}

export function siteMediaSlotKeys() {
  return SITE_MEDIA_SLOTS.map((slot) => slot.key);
}

export function brandMediaSlotKeys(slug) {
  return brandMediaSlots(slug).map((slot) => slot.key);
}

export function categoryHeroMediaSlotKeys(slug) {
  return categoryHeroMediaSlots(slug).map((slot) => slot.key);
}

export function productMediaSlotKeys(slug) {
  return productMediaSlots(slug).map((slot) => slot.key);
}

export function resolveMediaSlot(items, sectionKey) {
  const item = (items || [])
    .filter((entry) => entry.sectionKey === sectionKey)
    .sort((a, b) => {
      const updatedComparison =
        new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
      return updatedComparison || Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
    })[0];
  return item || null;
}
