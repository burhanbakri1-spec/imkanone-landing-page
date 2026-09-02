/**
 * Canonical product filter attribute vocabulary.
 *
 * Single source of truth for product-level catalog filters (age, gender, skill,
 * occasion). Persisted product values MUST be stable machine IDs from this
 * module — never localized display labels.
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
    option("13+", "13+", "13+"),
    option("adults", "Adults", "البالغون"),
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

/** Overlapping age IDs retired from the active vocabulary (still recognized as ambiguous legacy). */
export const RETIRED_OVERLAPPING_AGE_IDS = Object.freeze(["1-3y", "3-6y", "6-9y", "9-12y"]);

export const AMBIGUOUS_LEGACY_AGE_ALIASES = Object.freeze([
  "1-3 years",
  "3-6 years",
  "6-9 years",
  "9-12 years",
  "3-6",
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
  add(["12+ years", "12+ years", "12+"], "13+");
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

/**
 * Normalize a stored or incoming filter value to a canonical ID for writes.
 * Returns null for empty values. Throws when strict and value is not canonical
 * or an exact legacy mapping.
 */
export function normalizeProductFilterAttributeValue(group, value, { strict = true } = {}) {
  if (!isProductFilterAttributeGroup(group)) {
    throw new Error(`Unknown product filter attribute group: ${group}`);
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

  if (group === "age") {
    if (isAmbiguousLegacyAgeValue(trimmed)) {
      if (strict) throw new Error(`${group} contains an invalid value.`);
      return trimmed;
    }
    const exactAge = resolveExactLegacyAge(trimmed);
    if (exactAge) return exactAge;
  }

  const mapped = resolveLegacyAlias(group, trimmed);
  if (mapped && canonicalIdsByGroup[group].has(mapped)) return mapped;

  if (strict) throw new Error(`${group} contains an invalid value.`);
  return trimmed;
}

/** Read/serialize path: exact legacy maps to canonical; ambiguous legacy preserved. */
export function normalizeProductFilterAttributeForRead(group, value) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value !== "string" || !value.trim()) return "";

  const trimmed = value.trim();
  if (canonicalIdsByGroup[group].has(trimmed)) return trimmed;

  if (group === "age") {
    if (isAmbiguousLegacyAgeValue(trimmed)) return trimmed;
    const exactAge = resolveExactLegacyAge(trimmed);
    if (exactAge) return exactAge;
  }

  const mapped = resolveLegacyAlias(group, trimmed);
  if (mapped && canonicalIdsByGroup[group].has(mapped)) return mapped;

  return trimmed;
}

/** Resolve a stored product value for CPanel select controls. */
export function resolveProductFilterAttributeForForm(group, value) {
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
      unknown.add(String(value));
    }
  }
  return [...unknown];
}
