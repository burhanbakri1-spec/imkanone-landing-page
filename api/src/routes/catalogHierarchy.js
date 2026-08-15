// Generic catalog hierarchy support.
//
// The Kids Velvet catalog is expressed through the existing shared catalog
// entities, so the whole feature stays generic:
//   - Brand         -> existing company_brands row
//   - Main Category -> existing company_categories row with parentId === null
//   - Subcategory   -> existing company_categories row whose parentId points to
//                      a Main Category
//   - Product       -> existing products row (new optional fields live in the
//                      product JSONB `data` payload; no schema migration)
//   - Manufacturer + filters (Age, Gender, Skill, Occasion, Quick Shop) ->
//     optional product attributes accepted by the shared product payload.
//
// This module is a pure helper over brand/category lists so it can be unit
// tested without a database and reused by in-memory and Postgres runtimes.

const FILTER_KEYS = ["age", "gender", "skill", "occasion"];
const BOOLEAN_FILTER_KEYS = ["quickShop"];

export const PRODUCT_FILTER_KEYS = Object.freeze([...FILTER_KEYS, ...BOOLEAN_FILTER_KEYS]);

export function catalogHierarchyError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function normalizeOptionalString(incoming, value, field) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !value.trim()) {
    throw catalogHierarchyError(`${field} must be a non-empty string or empty.`);
  }
  const normalized = value.trim();
  if (normalized.length > 240) {
    throw catalogHierarchyError(`${field} must be 240 characters or fewer.`);
  }
  return normalized;
}

// Normalizes the hierarchy/filter inputs from a product create/update body.
// Returns an object containing only recognized keys; safe to spread into the
// normalized product before persistence.
export function normalizeCatalogHierarchyInput(incoming = {}) {
  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
    throw catalogHierarchyError("Product body must be an object.");
  }
  const normalized = {};
  for (const field of ["mainCategoryId", "subcategoryId", "manufacturer", ...FILTER_KEYS]) {
    if (hasOwn(incoming, field)) {
      normalized[field] = normalizeOptionalString(incoming, incoming[field], field);
    }
  }
  if (hasOwn(incoming, "quickShop")) {
    if (typeof incoming.quickShop !== "boolean") {
      throw catalogHierarchyError("quickShop must be a boolean.");
    }
    normalized.quickShop = incoming.quickShop;
  }
  return normalized;
}

function nullOrTrimmed(value) {
  if (value === null || value === undefined || value === "") return null;
  return typeof value === "string" ? value.trim() || null : value;
}

// Validates the catalog hierarchy and filter attributes of a product against
// the company's brand/category lists.
//
//   brands     - array of the company's brand rows
//   categories - array of the company's category rows
//   product    - the normalized product (or body) to validate
//   options.requireMainCategory - when true the product must carry a Main
//     Category (used by the Kids Velvet CPanel flow). Defaults to false for
//     backward compatibility with flat legacy catalogs.
export function validateCatalogHierarchy({ brands = [], categories = [], product = {}, requireMainCategory = false }) {
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const brandById = new Map(brands.map((brand) => [brand.id, brand]));

  const brandId = nullOrTrimmed(product.brandId ?? product.brand_id);
  if (brandId) {
    const brand = brandById.get(brandId);
    if (!brand) throw catalogHierarchyError("Brand not found.", 404);
    if (brand.isActive === false) throw catalogHierarchyError("Brand is inactive.");
  }

  const mainCategoryId = nullOrTrimmed(product.mainCategoryId);
  const subcategoryId = nullOrTrimmed(product.subcategoryId ?? product.categoryId ?? product.category_id);

  if (requireMainCategory && !mainCategoryId) {
    throw catalogHierarchyError("A Main Category is required.");
  }

  if (mainCategoryId) {
    const main = categoryById.get(mainCategoryId);
    if (!main) throw catalogHierarchyError("Main Category not found.", 404);
    if (main.isActive === false) throw catalogHierarchyError("Main Category is inactive.");
    // A Main Category is a category with no parent.
    if (main.parentId) {
      throw catalogHierarchyError("Selected category is a Subcategory, not a Main Category.");
    }
    // Kids Velvet: a Main Category belongs directly to a Brand. When the Main
    // Category carries a brandId, the product's Brand must match it.
    if (main.brandId && brandId && main.brandId !== brandId) {
      throw catalogHierarchyError("Main Category does not belong to the selected Brand.");
    }
  }

  if (subcategoryId) {
    const sub = categoryById.get(subcategoryId);
    if (!sub) throw catalogHierarchyError("Subcategory not found.", 404);
    if (sub.isActive === false) throw catalogHierarchyError("Subcategory is inactive.");
    // When both are supplied the Subcategory must belong to the Main Category.
    if (mainCategoryId && sub.parentId !== mainCategoryId) {
      throw catalogHierarchyError("Subcategory does not belong to the selected Main Category.");
    }
  }

  // Attribute/filter validation (defensive; the route already normalizes).
  if (product.manufacturer != null && typeof product.manufacturer !== "string") {
    throw catalogHierarchyError("manufacturer must be a string.");
  }
  for (const key of FILTER_KEYS) {
    if (product[key] != null && typeof product[key] !== "string") {
      throw catalogHierarchyError(`${key} must be a string.`);
    }
  }
  if (product.quickShop != null && typeof product.quickShop !== "boolean") {
    throw catalogHierarchyError("quickShop must be a boolean.");
  }

  return {
    brandId: brandId || null,
    mainCategoryId: mainCategoryId || null,
    subcategoryId: subcategoryId || null,
    manufacturer: nullOrTrimmed(product.manufacturer) || null,
    age: nullOrTrimmed(product.age) || null,
    gender: nullOrTrimmed(product.gender) || null,
    skill: nullOrTrimmed(product.skill) || null,
    occasion: nullOrTrimmed(product.occasion) || null,
    quickShop: product.quickShop === true,
  };
}

