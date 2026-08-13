import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  getMainCategories,
  getSubcategoriesForMain,
  isMainCategory,
  resolveMainCategoryFor,
} from "../src/utils/adminCategories.js";

const dashboardSource = fs.readFileSync(new URL("../src/pages/AdminDashboardPage.jsx", import.meta.url), "utf8");

const categories = [
  { id: "main-clothing", slug: "clothing", parentId: null, isActive: true, name: { en: "Clothing" } },
  { id: "main-toys", slug: "toys", parentId: null, isActive: true, name: { en: "Toys" } },
  { id: "sub-dresses", slug: "dresses", parentId: "main-clothing", isActive: true, name: { en: "Dresses" } },
  { id: "sub-shirt", slug: "shirt", parentId: "main-clothing", isActive: true, name: { en: "Shirts" } },
  { id: "sub-doll", slug: "doll", parentId: "main-toys", isActive: true, name: { en: "Dolls" } },
];

test("isMainCategory only returns true for parentless categories", () => {
  assert.equal(isMainCategory(categories[0]), true);
  assert.equal(isMainCategory(categories[2]), false);
  assert.equal(isMainCategory(null), false);
});

test("getMainCategories returns top-level categories", () => {
  assert.deepEqual(getMainCategories(categories).map((category) => category.id), ["main-clothing", "main-toys"]);
});

test("getSubcategoriesForMain returns only the children of the given Main Category", () => {
  assert.deepEqual(getSubcategoriesForMain(categories, "main-clothing").map((category) => category.id), ["sub-dresses", "sub-shirt"]);
  assert.deepEqual(getSubcategoriesForMain(categories, "main-toys").map((category) => category.id), ["sub-doll"]);
  assert.deepEqual(getSubcategoriesForMain(categories, ""), []);
});

test("resolveMainCategoryFor prefers explicit main and derives from subcategory parent", () => {
  assert.equal(resolveMainCategoryFor(categories, "main-toys", "sub-dresses"), "main-toys");
  assert.equal(resolveMainCategoryFor(categories, "", "sub-dresses"), "main-clothing");
  assert.equal(resolveMainCategoryFor(categories, "", "missing"), "");
});

test("ProductWizard renders cascading Main/Subcategory selectors, Manufacturer, and filters", () => {
  assert.match(dashboardSource, /name="mainCategoryId"[\s\S]*?onChange=\{changeMainCategory\}/);
  assert.match(dashboardSource, /name="subcategoryId"[\s\S]*?onChange=\{changeSubcategory\}/);
  assert.match(dashboardSource, /name="manufacturer"/);
  for (const key of ["age", "gender", "skill", "occasion", "quickShop"]) {
    assert.match(dashboardSource, new RegExp(`name="${key}"`));
  }
  assert.match(dashboardSource, /getMainCategories\(/);
  assert.match(dashboardSource, /getSubcategoriesForMain\(/);
  // the persisted payload carries the hierarchy + filter fields
  assert.match(dashboardSource, /mainCategoryId: form\.mainCategoryId/);
  assert.match(dashboardSource, /subcategoryId: form\.subcategoryId/);
  assert.match(dashboardSource, /manufacturer: form\.manufacturer/);
});
