import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  PRODUCT_FILTER_KEYS,
  normalizeCatalogHierarchyInput,
  validateCatalogHierarchy,
} from "../src/routes/catalogHierarchy.js";

const productsSource = fs.readFileSync(new URL("../src/routes/products.js", import.meta.url), "utf8");
const storefrontSource = fs.readFileSync(new URL("../src/storefront/publicContent.js", import.meta.url), "utf8");

const brands = [{ id: "velvet", slug: "velvet", isActive: true, name: "VELVET" }];
const categories = [
  { id: "main-clothing", slug: "clothing", parentId: null, brandId: "velvet", isActive: true, name: { en: "Clothing" } },
  { id: "sub-dresses", slug: "dresses", parentId: "main-clothing", isActive: true, name: { en: "Dresses" } },
  { id: "flat-category", slug: "flat", parentId: null, isActive: true, name: { en: "Flat" } },
  { id: "inactive", slug: "inactive", parentId: null, isActive: false, name: { en: "Inactive" } },
];

test("normalizeCatalogHierarchyInput trims strings and coerces quickShop", () => {
  const out = normalizeCatalogHierarchyInput({
    mainCategoryId: " main ", subcategoryId: "", manufacturer: "  Acme  ", age: "3-6",
    gender: "", quickShop: true,
  });
  assert.deepEqual(out, { mainCategoryId: "main", subcategoryId: null, manufacturer: "Acme", age: "3-6", gender: null, quickShop: true });
  assert.throws(() => normalizeCatalogHierarchyInput({ quickShop: "yes" }), /quickShop must be a boolean/);
});

test("validateCatalogHierarchy accepts a valid Brand -> Main -> Subcategory product", () => {
  const result = validateCatalogHierarchy({
    brands,
    categories,
    product: {
      brandId: "velvet",
      mainCategoryId: "main-clothing",
      subcategoryId: "sub-dresses",
      manufacturer: "Acme",
      age: "3-6",
      quickShop: true,
    },
  });
  assert.deepEqual(result, {
    brandId: "velvet",
    mainCategoryId: "main-clothing",
    subcategoryId: "sub-dresses",
    manufacturer: "Acme",
    age: "3-6",
    gender: null,
    skill: null,
    occasion: null,
    quickShop: true,
  });
});

test("validateCatalogHierarchy rejects using a Subcategory as a Main Category", () => {
  assert.throws(
    () => validateCatalogHierarchy({ brands, categories, product: { mainCategoryId: "sub-dresses" } }),
    (error) => error.statusCode === 400 && /Subcategory, not a Main Category/.test(error.message),
  );
});

test("validateCatalogHierarchy rejects a Subcategory that does not belong to the Main Category", () => {
  assert.throws(
    () => validateCatalogHierarchy({ brands, categories, product: { mainCategoryId: "main-clothing", subcategoryId: "flat-category" } }),
    /does not belong/,
  );
});

test("validateCatalogHierarchy rejects a Main Category that does not belong to the selected Brand", () => {
  const foreignBrands = [{ id: "other-brand", slug: "other", isActive: true, name: "Other" }];
  assert.throws(
    () => validateCatalogHierarchy({ brands: foreignBrands, categories, product: { brandId: "other-brand", mainCategoryId: "main-clothing" } }),
    /does not belong to the selected Brand/,
  );
  const result = validateCatalogHierarchy({ brands, categories, product: { brandId: "velvet", mainCategoryId: "main-clothing", subcategoryId: "sub-dresses" } });
  assert.equal(result.brandId, "velvet");
});

test("validateCatalogHierarchy rejects unknown/inactive brand and category references", () => {
  assert.throws(
    () => validateCatalogHierarchy({ brands, categories, product: { brandId: "nope" } }),
    (error) => error.statusCode === 404 && /Brand not found/.test(error.message),
  );
  assert.throws(() => validateCatalogHierarchy({ brands, categories, product: { subcategoryId: "inactive" } }), /inactive/);
  assert.throws(
    () => validateCatalogHierarchy({ brands, categories, product: {}, requireMainCategory: true }),
    /Main Category is required/,
  );
});

test("backward compatible: a lone legacy categoryId validates without a Main Category", () => {
  const result = validateCatalogHierarchy({ brands, categories, product: { categoryId: "flat-category" } });
  assert.equal(result.subcategoryId, "flat-category");
  assert.equal(result.mainCategoryId, null);
});

test("PRODUCT_FILTER_KEYS exposes the Kids Velvet filters", () => {
  assert.deepEqual([...PRODUCT_FILTER_KEYS], ["age", "gender", "skill", "occasion", "quickShop"]);
});

test("products route wires hierarchy normalization and validation into create/update", () => {
  assert.match(productsSource, /normalizeCatalogHierarchyInput\(req\.body\)/);
  assert.match(productsSource, /applyCatalogHierarchyAndFilters\(req\.companyId/);
  assert.match(productsSource, /requirePermission\("products\.create"\)/);
  assert.match(productsSource, /requirePermission\("products\.update"\)/);
  assert.match(productsSource, /category_id and brand_id are not accepted/);
});

test("storefront product serialization exposes hierarchy, manufacturer, and filters", () => {
  assert.match(storefrontSource, /mainCategoryId: product\.mainCategoryId/);
  assert.match(storefrontSource, /subcategoryId:/);
  assert.match(storefrontSource, /manufacturer: String\(product\.manufacturer/);
  for (const key of ["age", "gender", "skill", "occasion"]) {
    assert.match(storefrontSource, new RegExp(`${key}: String\\(product\\.${key}`));
  }
  assert.match(storefrontSource, /quickShop: product\.quickShop === true/);
});
