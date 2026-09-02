/**
 * Canonical product filter attribute vocabulary.
 *
 * Single source of truth for product-level catalog filters (age, gender, skill,
 * occasion). Persisted product values MUST be stable machine IDs from this
 * module — never localized display labels.
 *
 * Age is multi-value and persists as a canonical ID array.
 *
 * Browser-safe (no Node-only APIs).
 */

export const PRODUCT_FILTER_ATTRIBUTE_GROUPS = Object.freeze(["age", "gender", "skill", "occasion"]);

function option(id, en, ar) {
  return Object.freeze({ id, label: Object.freeze({ en, ar }) });
}

/** @type {Readonly<Record<string, readonly { id: string, label: { en: string, ar: string } }[]>>} */
export const PRODUCT_FILTER_ATTRIBUTE_OPTIONS = Object.freeze({
  age: Object.freeze([
    option("0-12m", "0–12 Months", "0–12 شهر"),
    option("1-2y", "1–2 Years", "1–2 سنة"),
    option("3-4y", "3–4 Years", "3–4 سنوات"),
    option("5-6y", "5–6 Years", "5–6 سنوات"),
    option("7-9y", "7–9 Years", "7–9 سنوات"),
    option("10-12y", "10–12 Years", "10–12 سنة"),
    option("13-17y", "13–17 Years", "13–17 سنة"),
    option("adults", "Adults", "البالغون"),
    option("0-3y", "0–3 Years", "من 0 ل 3 سنوات"),
    option("3-6y", "3–6 Years", "من 3 ل 6 سنوات"),
    option("6-10y", "6–10 Years", "من 6 ل 10 سنوات"),
    option("10+y", "10+ Years", "من 10 سنوات فما فوق"),
  ]),
  gender: Object.freeze([
    option("boys", "Boys", "أولاد"),
    option("girls", "Girls", "بنات"),
    option("unisex", "Unisex", "للجميع"),
  ]),
  skill: Object.freeze([
    option("creativity", "Creativity", "الإبداع"),
    option("imagination", "Imagination", "الخيال"),
    option("fine-motor", "Fine Motor", "مهارات دقيقة"),
    option("gross-motor", "Gross Motor", "مهارات كبرى"),
    option("problem", "Problem Solving", "حل المشكلات"),
    option("logic", "Logic", "المنطق"),
    option("memory", "Memory", "الذاكرة"),
    option("stem", "STEM", "STEM"),
    option("social", "Social Skills", "اجتماعية"),
    option("language", "Language", "اللغة"),
    option("emotional", "Emotional", "عاطفي"),
    option("beginner", "Beginner", "مبتدئ"),
    option("intermediate", "Intermediate", "متوسط"),
    option("advanced", "Advanced", "متقدم"),
  ]),
  occasion: Object.freeze([
    option("birthday", "Birthday", "عيد ميلاد"),
    option("everyday", "Everyday", "يومي"),
    option("eid", "Eid", "عيد"),
    option("ramadan", "Ramadan", "رمضان"),
    option("christmas", "Christmas", "كريسماس"),
    option("school", "Back to School", "عودة للمدرسة"),
    option("newbaby", "New Baby", "مولود جديد"),
    option("gift", "Gift", "هدية"),
    option("festive", "Festive", "احتفالي"),
  ]),
});

/** Velvet workbook-native age IDs in display order. */
export const VELVET_WORKBOOK_AGE_IDS = Object.freeze(["0-3y", "3-6y", "6-10y", "10+y"]);

/** Overlapping age IDs retired from the active vocabulary (still recognized as ambiguous legacy). */
export const RETIRED_OVERLAPPING_AGE_IDS = Object.freeze(["1-3y", "6-9y", "9-12y", "13+"]);

export const AMBIGUOUS_LEGACY_AGE_ALIASES = Object.freeze([
  "1-3 years",
  "3-6 years",
  "6-9 years",
  "9-12 years",
  "3-6",
  "12+ years",
  "12+",
  ...RETIRED_OVERLAPPING_AGE_IDS,
]);

const canonicalIdsByGroup = Object.fromEntries(
  PRODUCT_FILTER_ATTRIBUTE_GROUPS.map((group) => [
    group,
    new Set(PRODUCT_FILTER_ATTRIBUTE_OPTIONS[group].map((entry) => entry.id)),
  ]),
);

const ambiguousLegacyAgeKeys = new Set(AMBIGUOUS_LEGACY_AGE_ALIASES.map(normalizeLookupKey));

const exactLegacyAgeAliases = buildExactLegacyAgeAliasMap();

const legacyAliasesByGroup = Object.fromEntries(
  PRODUCT_FILTER_ATTRIBUTE_GROUPS.map((group) => [group, buildLegacyAliasMap(group)]),
);

const ageSortOrder = new Map(
  PRODUCT_FILTER_ATTRIBUTE_OPTIONS.age.map((entry, index) => [entry.id, index]),
);

function normalizeLookupKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\u2013/g, "-")
    .replace(/\s+/g, " ");
}

function buildExactLegacyAgeAliasMap() {
  /** @type {Map<string, string>} */
  const map = new Map();
  const add = (aliases, canonicalId) => {
    for (const alias of aliases) {
      map.set(normalizeLookupKey(alias), canonicalId);
    }
  };
  add(["0-12 months", "0–12 months"], "0-12m");
  add(["من 0 ل 3 سنوات", "من 0 إلى 3 سنوات"], "0-3y");
  add(["من 3 ل 6 سنوات", "من 3 إلى 6 سنوات"], "3-6y");
  add(["من6 ل 10 سنوات", "من 6 ل 10 سنوات", "من 6 إلى 10 سنوات"], "6-10y");
  add(["من 10 سنوات فما فوق"], "10+y");
  return map;
}

function buildLegacyAliasMap(group) {
  /** @type {Map<string, string>} */
  const map = new Map();

  const add = (aliases, canonicalId) => {
    for (const alias of aliases) {
      map.set(normalizeLookupKey(alias), canonicalId);
    }
  };

  if (group === "gender") {
    add(["boys", "boy"], "boys");
    add(["girls", "girl"], "girls");
    add(["unisex"], "unisex");
  }

  if (group === "skill") {
    add(["beginner"], "beginner");
    add(["intermediate"], "intermediate");
    add(["advanced"], "advanced");
    add(["problem solving"], "problem");
    add(["fine motor"], "fine-motor");
    add(["gross motor"], "gross-motor");
    add(["social skills"], "social");
  }

  if (group === "occasion") {
    add(["birthday"], "birthday");
    add(["everyday"], "everyday");
    add(["gift"], "gift");
    add(["school", "back to school"], "school");
    add(["festive"], "festive");
    add(["eid"], "eid");
    add(["ramadan"], "ramadan");
    add(["christmas"], "christmas");
    add(["new baby"], "newbaby");
  }

  for (const entry of PRODUCT_FILTER_ATTRIBUTE_OPTIONS[group]) {
    map.set(normalizeLookupKey(entry.id), entry.id);
    map.set(normalizeLookupKey(entry.label.en), entry.id);
    map.set(normalizeLookupKey(entry.label.ar), entry.id);
  }

  return map;
}

export function isProductFilterAttributeGroup(group) {
  return PRODUCT_FILTER_ATTRIBUTE_GROUPS.includes(group);
}

export function getProductFilterAttributeOptions(group) {
  if (!isProductFilterAttributeGroup(group)) return [];
  return PRODUCT_FILTER_ATTRIBUTE_OPTIONS[group];
}

export function getProductFilterAttributeLabel(group, id, locale = "en") {
  const entry = getProductFilterAttributeOptions(group).find((item) => item.id === id);
  if (!entry) return String(id || "");
  return entry.label[locale] || entry.label.en || entry.id;
}

export function isAmbiguousLegacyAgeValue(value) {
  if (value === null || value === undefined || value === "") return false;
  if (Array.isArray(value)) {
    return value.some((entry) => isAmbiguousLegacyAgeValue(entry));
  }
  return ambiguousLegacyAgeKeys.has(normalizeLookupKey(value));
}

export function isExactLegacyAgeMapping(value) {
  if (value === null || value === undefined || value === "") return false;
  return exactLegacyAgeAliases.has(normalizeLookupKey(value));
}

function resolveExactLegacyAge(value) {
  return exactLegacyAgeAliases.get(normalizeLookupKey(value)) || null;
}

function resolveLegacyAlias(group, value) {
  return legacyAliasesByGroup[group].get(normalizeLookupKey(value)) || null;
}

function isPipeSeparatedAgeValue(value) {
  return typeof value === "string" && value.includes("|");
}

export function isMultiValueAge(value) {
  if (Array.isArray(value)) return value.length > 1;
  return isPipeSeparatedAgeValue(value);
}

function coerceAgeInputParts(value) {
  if (value === null || value === undefined || value === "") return [];
  if (Array.isArray(value)) {
    return value.flatMap((entry) => coerceAgeInputParts(entry));
  }
  if (typeof value !== "string" || !value.trim()) return [];
  const trimmed = value.trim();
  if (isPipeSeparatedAgeValue(trimmed)) {
    return trimmed.split("|").map((part) => part.trim()).filter(Boolean);
  }
  return [trimmed];
}

function normalizeSingleAgePart(part, { strict = true } = {}) {
  if (canonicalIdsByGroup.age.has(part)) return part;

  if (isAmbiguousLegacyAgeValue(part)) {
    if (strict) throw new Error("age contains an invalid value.");
    return part;
  }

  const exactAge = resolveExactLegacyAge(part);
  if (exactAge) return exactAge;

  const mapped = resolveLegacyAlias("age", part);
  if (mapped && canonicalIdsByGroup.age.has(mapped)) return mapped;

  if (strict) throw new Error("age contains an invalid value.");
  return part;
}

function sortAgeIds(ids = []) {
  return [...ids].sort((left, right) => (ageSortOrder.get(left) ?? 999) - (ageSortOrder.get(right) ?? 999));
}

export function normalizeAgeArray(value, { strict = true } = {}) {
  const parts = coerceAgeInputParts(value);
  if (!parts.length) return [];

  const normalized = [];
  for (const part of parts) {
    const resolved = normalizeSingleAgePart(part, { strict });
    if (resolved && !normalized.includes(resolved)) normalized.push(resolved);
  }

  return sortAgeIds(normalized);
}

export function ageValuesEqual(left, right) {
  return JSON.stringify(normalizeAgeArray(left, { strict: false }))
    === JSON.stringify(normalizeAgeArray(right, { strict: false }));
}

/**
 * Normalize a stored or incoming filter value for writes.
 * Age returns a canonical ID array; other groups return a string or null.
 */
export function normalizeProductFilterAttributeValue(group, value, { strict = true } = {}) {
  if (!isProductFilterAttributeGroup(group)) {
    throw new Error(`Unknown product filter attribute group: ${group}`);
  }

  if (group === "age") {
    if (value === null || value === undefined || value === "") return [];
    if (Array.isArray(value) && value.length === 0) return [];
    return normalizeAgeArray(value, { strict });
  }

  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !value.trim()) {
    if (strict) throw new Error(`${group} must be a non-empty string or empty.`);
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length > 240) {
    if (strict) throw new Error(`${group} must be 240 characters or fewer.`);
    return trimmed;
  }

  if (canonicalIdsByGroup[group].has(trimmed)) return trimmed;

  const mapped = resolveLegacyAlias(group, trimmed);
  if (mapped && canonicalIdsByGroup[group].has(mapped)) return mapped;

  if (strict) throw new Error(`${group} contains an invalid value.`);
  return trimmed;
}

/** Read path: age returns a canonical ID array; other groups return a string. */
export function normalizeProductFilterAttributeForRead(group, value) {
  if (group === "age") {
    if (value === null || value === undefined || value === "") return [];
    return normalizeAgeArray(value, { strict: false });
  }

  if (value === null || value === undefined || value === "") return "";
  if (typeof value !== "string" || !value.trim()) return "";

  const trimmed = value.trim();
  if (canonicalIdsByGroup[group].has(trimmed)) return trimmed;

  const mapped = resolveLegacyAlias(group, trimmed);
  if (mapped && canonicalIdsByGroup[group].has(mapped)) return mapped;

  return trimmed;
}

/** Resolve a stored product value for CPanel controls. */
export function resolveProductFilterAttributeForForm(group, value) {
  if (group === "age") {
    return normalizeProductFilterAttributeForRead("age", value);
  }
  return normalizeProductFilterAttributeForRead(group, value) || "";
}

export function requiresCanonicalAgeSelection(value) {
  return isAmbiguousLegacyAgeValue(value);
}

export function listUnmappedProductFilterAttributeValues(group, values = []) {
  const unknown = new Set();
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    try {
      normalizeProductFilterAttributeValue(group, value, { strict: true });
    } catch {
      unknown.add(Array.isArray(value) ? JSON.stringify(value) : String(value));
    }
  }
  return [...unknown];
}

function resolveCanonicalFilterAttributeId(group, rawValue) {
  if (rawValue === null || rawValue === undefined || rawValue === "") return null;
  if (typeof rawValue !== "string" || !rawValue.trim()) return null;

  const trimmed = rawValue.trim();
  if (canonicalIdsByGroup[group].has(trimmed)) return trimmed;

  if (group === "age") {
    if (isAmbiguousLegacyAgeValue(trimmed)) return null;
    const exactAge = resolveExactLegacyAge(trimmed);
    if (exactAge) return exactAge;
  }

  const mapped = resolveLegacyAlias(group, trimmed);
  if (mapped && canonicalIdsByGroup[group].has(mapped)) return mapped;

  return null;
}

function serializePublicAgeFilterAttributes(rawValue) {
  const ids = normalizeAgeArray(rawValue, { strict: false }).filter((id) => canonicalIdsByGroup.age.has(id));
  return ids.map((id) => {
    const entry = getProductFilterAttributeOptions("age").find((item) => item.id === id);
    return {
      id: entry.id,
      label: {
        en: entry.label.en,
        ar: entry.label.ar,
      },
    };
  });
}

/** Structured public storefront attribute(s) with canonical id + localized labels. */
export function serializePublicProductFilterAttribute(group, rawValue) {
  if (!isProductFilterAttributeGroup(group)) return group === "age" ? [] : null;

  if (group === "age") {
    return serializePublicAgeFilterAttributes(rawValue);
  }

  const canonicalId = resolveCanonicalFilterAttributeId(group, rawValue);
  if (!canonicalId) return null;

  const entry = getProductFilterAttributeOptions(group).find((item) => item.id === canonicalId);
  if (!entry) return null;

  return {
    id: entry.id,
    label: {
      en: entry.label.en,
      ar: entry.label.ar,
    },
  };
}

/** Reusable storefront filter vocabulary metadata for all canonical options. */
export function serializePublicProductFilterDefinitions() {
  return Object.fromEntries(
    PRODUCT_FILTER_ATTRIBUTE_GROUPS.map((group) => [
      group,
      getProductFilterAttributeOptions(group).map((entry) => ({
        id: entry.id,
        label: {
          en: entry.label.en,
          ar: entry.label.ar,
        },
      })),
    ]),
  );
}

export function serializePublicProductFilterAttributes(product = {}) {
  return {
    age: serializePublicAgeFilterAttributes(product.age),
    gender: serializePublicProductFilterAttribute("gender", product.gender),
    skill: serializePublicProductFilterAttribute("skill", product.skill),
    occasion: serializePublicProductFilterAttribute("occasion", product.occasion),
  };
}
