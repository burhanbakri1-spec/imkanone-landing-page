import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const dashboard = fs.readFileSync(new URL("../src/pages/AdminDashboardPage.jsx", import.meta.url), "utf8");
const utils = fs.readFileSync(new URL("../src/utils/productFilterAttributes.js", import.meta.url), "utf8");
const shared = fs.readFileSync(new URL("../../shared/catalog/productFilterAttributes.js", import.meta.url), "utf8");

test("ProductWizard uses shared canonical filter attribute vocabulary", () => {
  assert.match(dashboard, /from "\.\.\/utils\/productFilterAttributes\.js"/);
  assert.match(dashboard, /getLocalizedFilterAttributeOptionsForSelect\("age"/);
  assert.match(dashboard, /requiresCanonicalAgeSelection\(form\.age\)/);
  assert.doesNotMatch(dashboard, /"1-3 years"/);
  assert.doesNotMatch(dashboard, /\["Boys", "Girls", "Unisex"\]/);
});

test("active age options exclude overlapping retired canonical ranges", () => {
  assert.doesNotMatch(shared, /option\("1-3y"/);
  assert.doesNotMatch(shared, /option\("3-6y"/);
  assert.doesNotMatch(shared, /option\("6-9y"/);
  assert.doesNotMatch(shared, /option\("9-12y"/);
  assert.match(shared, /option\("7-9y"/);
});

test("localized filter attribute options expose canonical IDs only for new products", async () => {
  const {
    getLocalizedFilterAttributeOptions,
    getLocalizedFilterAttributeOptionsForSelect,
    requiresCanonicalAgeSelection,
  } = await import("../src/utils/productFilterAttributes.js");

  const options = getLocalizedFilterAttributeOptions("age", "en");
  assert.deepEqual(options.map((entry) => entry.id), ["0-12m", "1-2y", "3-4y", "5-6y", "7-9y", "10-12y", "13+", "adults"]);

  const legacy = getLocalizedFilterAttributeOptionsForSelect("age", "en", "1-3 years");
  assert.equal(legacy.length, options.length + 1);
  assert.ok(legacy.some((entry) => entry.id === "1-3 years" && /legacy value/i.test(entry.label)));
  assert.ok(requiresCanonicalAgeSelection("1-3 years"));
});

test("exact legacy age resolves to canonical form value for editing", async () => {
  const { resolveProductFilterAttributeForForm } = await import("../src/utils/productFilterAttributes.js");
  assert.equal(resolveProductFilterAttributeForForm("age", "0-12 months"), "0-12m");
  assert.equal(resolveProductFilterAttributeForForm("age", "1-3 years"), "1-3 years");
});
