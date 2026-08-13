// Storefront media slot model.
//
// The storefront ("i-play") reads managed media through the dotted sectionKey
// convention exposed by `/api/storefront/content`. Every key in this file is a
// key the storefront already consumes, so the CPanel writes website media under
// those exact keys and the storefront override wins over its local fallback. Do
// not invent new keys here: match the storefront exactly.
//
// Canonical VELVET identity. VELVET is the parent group; the storefront renders
// the platform-managed parent logo (`site.logo`) when present and falls back to
// its own local logo otherwise.
export const PARENT_BRAND = {
  slug: "velvet",
  name: { en: "VELVET", ar: "VELVET" },
};

export const SITE_LOGO_SLOT = {
  key: "site.logo",
  kind: "image",
  groupKey: "identity",
  labelEn: "Main Website / Parent Logo",
  labelAr: "الشعار الرئيسي للموقع",
};

// Canonical VELVET branches, detected from the i-play storefront catalog
// (`src/data/velvetCatalog.js` RAW_BRANDS). These are the real VELVET families;
// the CPanel must render every one of them regardless of what brand rows happen
// to exist in the CPanel brands array.
export const VELVET_BRANCHES = [
  { slug: "baby", name: { en: "VELVET BABY", ar: "VELVET BABY" } },
  { slug: "kids", name: { en: "VELVET KIDS", ar: "VELVET KIDS" } },
  { slug: "play", name: { en: "VELVET PLAY", ar: "VELVET PLAY" } },
  { slug: "build", name: { en: "VELVET BUILD", ar: "VELVET BUILD" } },
  { slug: "learn", name: { en: "VELVET LEARN", ar: "VELVET LEARN" } },
  { slug: "create", name: { en: "VELVET CREATE", ar: "VELVET CREATE" } },
  { slug: "games", name: { en: "VELVET GAMES", ar: "VELVET GAMES" } },
  { slug: "move", name: { en: "VELVET MOVE", ar: "VELVET MOVE" } },
  { slug: "collect", name: { en: "VELVET COLLECT", ar: "VELVET COLLECT" } },
  { slug: "plush", name: { en: "VELVET PLUSH", ar: "VELVET PLUSH" } },
  { slug: "books", name: { en: "VELVET BOOKS", ar: "VELVET BOOKS" } },
  { slug: "muslim", name: { en: "VELVET MUSLIM", ar: "VELVET MUSLIM" } },
];

export function velvetBranchSlugs() {
  return VELVET_BRANCHES.map((branch) => branch.slug);
}

// About section image slots (`about.{index}.image`) - matches i-play aboutSections
// and uses the real section titles as labels.
export const ABOUT_SECTIONS = [
  { titleEn: "Let's Reimagine", titleAr: "لنتخيّل من جديد" },
  { titleEn: "Our Team and Culture", titleAr: "فريقنا وثقافتنا" },
  { titleEn: "Sustainability", titleAr: "الاستدامة" },
  { titleEn: "Taking a Stand", titleAr: "موقفنا" },
];
export const ABOUT_IMAGE_COUNT = ABOUT_SECTIONS.length;
export function aboutImageSlots() {
  return ABOUT_SECTIONS.map((section, index) => ({
    key: `about.${index}.image`,
    kind: "image",
    groupKey: "about",
    labelEn: section.titleEn,
    labelAr: section.titleAr,
  }));
}

// News item image slots (`news.{index}.image`) - matches i-play newsItems and
// uses the real news titles as labels.
export const NEWS_ITEMS = [
  { titleEn: "A first look inside our new Pocket Worlds studio", titleAr: "نظرة أولى داخل استوديو Pocket Worlds الجديد" },
  { titleEn: "Odd Pals wins a place in the summer play edit", titleAr: "Odd Pals ضمن اختيارات ألعاب الصيف" },
  { titleEn: "How our designers turn tiny ideas into big stories", titleAr: "كيف يحوّل مصممونا الأفكار الصغيرة إلى قصص كبيرة" },
  { titleEn: "VELVET opens a new community maker space", titleAr: "VELVET تفتتح مساحة مجتمعية جديدة للصنّاع" },
  { titleEn: "Meet the color team behind Cloud Dough", titleAr: "تعرّف إلى فريق الألوان وراء Cloud Dough" },
];
export const NEWS_IMAGE_COUNT = NEWS_ITEMS.length;
export function newsImageSlots() {
  return NEWS_ITEMS.map((item, index) => ({
    key: `news.${index}.image`,
    kind: "image",
    groupKey: "news",
    labelEn: item.titleEn,
    labelAr: item.titleAr,
  }));
}

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

// Branch media (consumed via `brand.{slug}.logo` / `brand.{slug}.video` /
// `brand.{slug}.poster`). The logo is the branch wordmark/logo shown on the
// brand page hero; the storefront falls back to its local static branch logo.
export function brandMediaSlots(slug) {
  const safeSlug = String(slug || "").trim();
  return [
    {
      key: `brand.${safeSlug}.logo`,
      kind: "image",
      groupKey: "brands",
      labelEn: "Branch logo",
      labelAr: "شعار الفرع",
    },
    {
      key: `brand.${safeSlug}.video`,
      kind: "video",
      groupKey: "brands",
      labelEn: "Branch hero video",
      labelAr: "فيديو الواجهة",
    },
    {
      key: `brand.${safeSlug}.poster`,
      kind: "image",
      groupKey: "brands",
      labelEn: "Branch hero poster",
      labelAr: "صورة الواجهة",
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
      labelEn: "Category hero video",
      labelAr: "فيديو القسم",
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

export function siteLogoSlotKey() {
  return SITE_LOGO_SLOT.key;
}

export function aboutImageSlotKeys() {
  return aboutImageSlots().map((slot) => slot.key);
}

export function newsImageSlotKeys() {
  return newsImageSlots().map((slot) => slot.key);
}

export function brandMediaSlotKeys(slug) {
  return brandMediaSlots(slug).map((slot) => slot.key);
}

export function brandLogoSlotKey(slug) {
  return `brand.${String(slug || "").trim()}.logo`;
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
