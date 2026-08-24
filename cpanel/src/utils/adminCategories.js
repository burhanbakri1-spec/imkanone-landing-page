import { categories as defaultCategories } from "../data/categories.js";

export const adminCategoriesStorageKey = "ebAdminCategories";
export const defaultAdminCategories = defaultCategories;

export function readAdminCategories() {
  if (typeof localStorage === "undefined") {
    return defaultAdminCategories;
  }

  try {
    const stored = localStorage.getItem(adminCategoriesStorageKey);
    const parsed = stored ? JSON.parse(stored) : null;
    return Array.isArray(parsed) && parsed.length ? parsed : defaultAdminCategories;
  } catch {
    return defaultAdminCategories;
  }
}

export function getSelectableAdminCategories(categoryList, selectedCategoryId = "") {
  const source = Array.isArray(categoryList) && categoryList.length ? categoryList : defaultAdminCategories;
  return source.filter((category) => category && (category.active !== false || category.id === selectedCategoryId));
}
