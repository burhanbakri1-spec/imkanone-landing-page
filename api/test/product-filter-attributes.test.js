import assert from "node:assert/strict";
import test from "node:test";
import {
  AMBIGUOUS_LEGACY_AGE_ALIASES,
  PRODUCT_FILTER_ATTRIBUTE_OPTIONS,
  RETIRED_OVERLAPPING_AGE_IDS,
  getProductFilterAttributeLabel,
  isAmbiguousLegacyAgeValue,
  isExactLegacyAgeMapping,
  listUnmappedProductFilterAttributeValues,
  normalizeProductFilterAttributeForRead,
  normalizeProductFilterAttributeValue,
  requiresCanonicalAgeSelection,
  resolveProductFilterAttributeForForm,
} from "../../shared/catalog/productFilterAttributes.js";
import { serializePublicProduct } from "../src/storefront/publicContent.js";

test("active age vocabulary is non-overlapping and fully localized", () => {
  const ageIds = PRODUCT_FILTER_ATTRIBUTE_OPTIONS.age.map((entry) => entry.id);
  assert.deepEqual(ageIds, ["0-12m", "1-2y", "3-4y", "5-6y", "7-9y", "10-12y", "13+", "adults"]);
  assert.deepEqual([...RETIRED_OVERLAPPING_AGE_IDS], ["1-3y", "3-6y", "6-9y", "9-12y"]);
  for (const entry of PRODUCT_FILTER_ATTRIBUTE_OPTIONS.age) {
    assert.ok(entry.label.en, `${entry.id} english label`);
    assert.ok(entry.label.ar, `${entry.id} arabic label`);
  }
});

test("exact legacy age mappings normalize safely on read and write", () => {
  assert.equal(normalizeProductFilterAttributeValue("age", "0-12 months"), "0-12m");
  assert.equal(normalizeProductFilterAttributeValue("age", "12+ years"), "13+");
  assert.equal(normalizeProductFilterAttributeForRead("age", "0-12 months"), "0-12m");
  assert.equal(normalizeProductFilterAttributeForRead("age", "12+ years"), "13+");
  assert.ok(isExactLegacyAgeMapping("0-12 months"));
  assert.ok(isExactLegacyAgeMapping("12+ years"));
});

test("ambiguous legacy age values are preserved on read and rejected on write", () => {
  for (const legacy of ["1-3 years", "3-6 years", "6-9 years", "9-12 years", "3-6", "1-3y"]) {
    assert.ok(isAmbiguousLegacyAgeValue(legacy), `${legacy} is ambiguous`);
    assert.equal(normalizeProductFilterAttributeForRead("age", legacy), legacy);
    assert.equal(resolveProductFilterAttributeForForm("age", legacy), legacy);
    assert.throws(() => normalizeProductFilterAttributeValue("age", legacy), /invalid value/i);
    assert.ok(requiresCanonicalAgeSelection(legacy));
  }
});

test("gender skill and occasion vocabularies stay clean with stable IDs", () => {
  for (const group of ["gender", "skill", "occasion"]) {
    const ids = PRODUCT_FILTER_ATTRIBUTE_OPTIONS[group].map((entry) => entry.id);
    assert.equal(new Set(ids).size, ids.length, `${group} has duplicate IDs`);
    for (const entry of PRODUCT_FILTER_ATTRIBUTE_OPTIONS[group]) {
      assert.match(entry.id, /^[a-z0-9+.-]+$/);
      assert.ok(entry.label.en);
      assert.ok(entry.label.ar);
    }
  }
});

test("gender normalization maps legacy display labels to canonical IDs", () => {
  assert.equal(normalizeProductFilterAttributeValue("gender", "Boys"), "boys");
  assert.equal(normalizeProductFilterAttributeValue("gender", "Girls"), "girls");
  assert.equal(normalizeProductFilterAttributeValue("gender", "unisex"), "unisex");
});

test("skill and occasion normalization preserve distinct legacy concepts", () => {
  assert.equal(normalizeProductFilterAttributeValue("skill", "Beginner"), "beginner");
  assert.equal(normalizeProductFilterAttributeValue("occasion", "Birthday"), "birthday");
  assert.equal(normalizeProductFilterAttributeValue("occasion", "Everyday"), "everyday");
});

test("serializePublicProduct preserves ambiguous age and normalizes exact legacy age", () => {
  const ambiguous = serializePublicProduct({
    id: "p1",
    slug: "p1",
    name: { en: "Toy", ar: "لعبة" },
    age: "1-3 years",
  });
  assert.equal(ambiguous.age, "1-3 years");

  const exact = serializePublicProduct({
    id: "p2",
    slug: "p2",
    name: { en: "Toy", ar: "لعبة" },
    age: "0-12 months",
    gender: "Boys",
  });
  assert.equal(exact.age, "0-12m");
  assert.equal(exact.gender, "boys");
});

test("localized labels are available for canonical IDs", () => {
  assert.equal(getProductFilterAttributeLabel("age", "7-9y", "en"), "7–9 Years");
  assert.equal(getProductFilterAttributeLabel("gender", "boys", "ar"), "أولاد");
});

test("listUnmappedProductFilterAttributeValues reports ambiguous legacy age values", () => {
  const unknown = listUnmappedProductFilterAttributeValues("age", ["1-3 years", "0-12m"]);
  assert.deepEqual(unknown, ["1-3 years"]);
});

test("retired overlapping age IDs are not active canonical options", () => {
  const activeIds = new Set(PRODUCT_FILTER_ATTRIBUTE_OPTIONS.age.map((entry) => entry.id));
  for (const retired of RETIRED_OVERLAPPING_AGE_IDS) {
    assert.ok(!activeIds.has(retired));
    assert.ok(AMBIGUOUS_LEGACY_AGE_ALIASES.includes(retired));
  }
});
