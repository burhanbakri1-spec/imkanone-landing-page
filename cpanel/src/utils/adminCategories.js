export const adminCategoriesStorageKey = "ebAdminCategories";
export const defaultAdminCategories = [];

export function readAdminCategories() {
  return [];
}

export function getSelectableAdminCategories(categoryList, selectedCategoryId = "") {
  const source = Array.isArray(categoryList) ? categoryList : [];
  return source.filter(
    (category) => category
      && (category.isActive !== false && category.active !== false || category.id === selectedCategoryId),
  );
}

// ── Generic catalog hierarchy helpers ────────────────────────────────────────
// Main Categories are top-level categories (no parent); Subcategories are the
// child categories whose parentId points to a Main Category.

function categoryParentId(category) {
  return category?.parentId || category?.parent_id || null;
}

export function isMainCategory(category) {
  return Boolean(category) && !categoryParentId(category);
}

export function getMainCategories(categoryList) {
  const source = Array.isArray(categoryList) ? categoryList : [];
  return source.filter((category) => isMainCategory(category));
}

export function getSubcategoriesForMain(categoryList, mainCategoryId) {
  const source = Array.isArray(categoryList) ? categoryList : [];
  if (!mainCategoryId) return [];
  return source.filter((category) => categoryParentId(category) === mainCategoryId);
}

// Resolves the current Main Category for a product edit. Prefers the explicit
// mainCategoryId, otherwise derives it from the selected subcategory's parent.
export function resolveMainCategoryFor(categoryList, mainCategoryId, subcategoryId) {
  const source = Array.isArray(categoryList) ? categoryList : [];
  if (mainCategoryId) return mainCategoryId;
  const subcategory = subcategoryId && source.find((category) => category.id === subcategoryId);
  return subcategory ? categoryParentId(subcategory) || "" : "";
}
