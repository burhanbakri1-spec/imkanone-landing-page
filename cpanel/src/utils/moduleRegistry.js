const routePageKeys = Object.freeze({
  "/admin/dashboard": "admin",
  "/admin/products": "admin-products",
  "/admin/categories": "admin-categories",
  "/admin/brands": "admin-brands",
  "/admin/vlogs": "admin-vlogs",
  "/admin/store-locator": "admin-store-locator",
  "/admin/website-media": "admin-website-media",
  "/admin/website-texts": "admin-website-texts",
  "/admin/orders": "admin-orders",
  "/admin/invoices": "admin-invoices",
  "/admin/delivery": "admin-delivery",
  "/admin/reviews": "admin-reviews",
  "/admin/inventory": "admin-inventory",
  "/admin/customers": "admin-customers",
  "/admin/staff": "admin-staff",
  "/admin/settings": "admin-settings",
  "/admin/product-settings": "admin-product-settings",
  "/admin/reports": "admin-reports",
  "/admin/activity-log": "admin-activity-log",
  "/admin/unit-creator": "admin-unit-creator",
  "/admin/dropshipping": "admin-dropshipping",
  "/admin/dropshipping/marketers": "admin-dropshipping-marketers",
  "/admin/dropshipping/products": "admin-dropshipping-products",
  "/admin/dropshipping/orders": "admin-dropshipping-orders",
  "/admin/dropshipping/earnings": "admin-dropshipping-earnings",
  "/admin/dropshipping/withdrawals": "admin-dropshipping-withdrawals",
  "/admin/dropshipping/reports": "admin-dropshipping-reports",
  "/admin/dropshipping/settings": "admin-dropshipping-settings",
});

const aliases = Object.freeze({
  "admin-products-new": "admin-products",
  "admin-categories-new": "admin-categories",
  "admin-brands-new": "admin-brands",
  "admin-vlogs-new": "admin-vlogs",
  "admin-store-locator-new": "admin-store-locator",
  "admin-staff-new": "admin-staff",
  "admin-employees": "admin-staff",
});

export function pageKeyForModule(module) {
  return routePageKeys[module?.route] || null;
}

export function normalizedModulePage(page) {
  return aliases[page] || page;
}

export function moduleAllowsPage(modules, page) {
  const normalized = normalizedModulePage(page);
  return modules.some((module) => module.enabled !== false && pageKeyForModule(module) === normalized);
}

export function groupCompanyModules(modules) {
  const groups = new Map();
  [...modules].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)).forEach((module) => {
    const pageKey = pageKeyForModule(module);
    if (!pageKey) return;
    const key = module.group_key || "other";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ ...module, pageKey });
  });
  return [...groups.entries()].map(([id, items]) => ({ id, items }));
}
