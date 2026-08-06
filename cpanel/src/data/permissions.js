import { isCompanyAdmin } from "../utils/roles.js";

export const permissionGroups = [
  {
    titleKey: "admin.dashboard",
    permissions: [{ key: "dashboard.view", labelKey: "permissions.dashboardView" }],
  },
  {
    titleKey: "admin.productsManagement",
    permissions: [
      { key: "products.view", labelKey: "permissions.productsView" },
      { key: "products.create", labelKey: "permissions.productsCreate" },
      { key: "products.update", labelKey: "permissions.productsUpdate" },
      { key: "products.delete", labelKey: "permissions.productsDelete" },
      { key: "products.read", labelKey: "Products: read tenant fields" },
      { key: "products.manage", labelKey: "Products: manage tenant fields" },
      { key: "product_media.manage", labelKey: "Product media: manage" },
      { key: "product_content.manage", labelKey: "Product content: manage" },
    ],
  },
  {
    titleKey: "admin.ordersManagement",
    permissions: [
      { key: "orders.view", labelKey: "permissions.ordersView" },
      { key: "orders.create", labelKey: "permissions.ordersCreate" },
      { key: "orders.update", labelKey: "permissions.ordersUpdate" },
      { key: "orders.delete", labelKey: "permissions.ordersDelete" },
      { key: "orders.updateStatus", labelKey: "permissions.ordersUpdateStatus" },
    ],
  },
  {
    titleKey: "admin.employeesManagement",
    permissions: [
      { key: "customers.view", labelKey: "permissions.customersView" },
      { key: "customers.create", labelKey: "Customers: create contacts" },
      { key: "customers.update", labelKey: "Customers: update contacts" },
      { key: "customers.archive", labelKey: "Customers: archive and restore contacts" },
      { key: "customers.manage", labelKey: "Customers and bookings: manage" },
      { key: "employees.view", labelKey: "permissions.employeesView" },
    ],
  },
  {
    titleKey: "admin.storefront",
    permissions: [
      { key: "website_media.manage", labelKey: "permissions.websiteMediaManage" },
      { key: "site_editor.access", labelKey: "Website editor: access" },
      { key: "site_editor.edit", labelKey: "Website editor: edit drafts" },
      { key: "site_editor.save", labelKey: "Website editor: save drafts" },
    ],
  },
  {
    titleKey: "admin.analytics",
    permissions: [{ key: "reports.view", labelKey: "Analytics and reports: view" }],
  },
  {
    titleKey: "Dropshipping",
    permissions: [
      "marketers", "products", "orders", "earnings", "withdrawals",
    ].flatMap((area) => [
      { key: `dropshipping.${area}.read`, labelKey: `Dropshipping ${area}: read` },
      { key: `dropshipping.${area}.manage`, labelKey: `Dropshipping ${area}: manage` },
    ]).concat([
      { key: "dropshipping.reports.read", labelKey: "Dropshipping reports" },
      { key: "dropshipping.settings.manage", labelKey: "Dropshipping settings" },
    ]),
  },
];

export function hasPermission(user, permission) {
  if (isCompanyAdmin(user?.role)) {
    return true;
  }

  return ["employee", "staff", "manager"].includes(user?.role) && user.permissions?.includes(permission);
}
