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
