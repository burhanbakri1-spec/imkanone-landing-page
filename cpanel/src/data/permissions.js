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
      { key: "inventory.view", labelKey: "Inventory: view" },
      { key: "inventory.manage", labelKey: "Inventory: manage stock" },
      { key: "categories.view", labelKey: "Categories: view" },
      { key: "categories.create", labelKey: "Categories: create" },
      { key: "categories.update", labelKey: "Categories: update" },
      { key: "categories.delete", labelKey: "Categories: delete" },
      { key: "categories.manage", labelKey: "Categories: manage" },
      { key: "brands.view", labelKey: "Brands: view" },
      { key: "brands.create", labelKey: "Brands: create" },
      { key: "brands.update", labelKey: "Brands: update" },
      { key: "brands.delete", labelKey: "Brands: delete" },
      { key: "brands.manage", labelKey: "Brands: manage" },
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
      { key: "delivery.view", labelKey: "Delivery zones: view" },
      { key: "delivery.manage", labelKey: "Delivery zones: manage" },
      { key: "invoices.view", labelKey: "Invoices: view" },
      { key: "invoices.manage", labelKey: "Invoices: manage" },
      { key: "reviews.view", labelKey: "Reviews: view" },
      { key: "reviews.manage", labelKey: "Reviews: moderate" },
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
      { key: "inbox.view", labelKey: "Inbox: view" },
      { key: "inbox.create", labelKey: "Inbox: create conversations" },
      { key: "inbox.reply", labelKey: "Inbox: reply to conversations" },
      { key: "inbox.assign", labelKey: "Inbox: assign conversations" },
      { key: "inbox.update", labelKey: "Inbox: update conversations" },
      { key: "inbox.archive", labelKey: "Inbox: archive conversations" },
      { key: "inbox.manage", labelKey: "Inbox: manage" },
      { key: "employees.view", labelKey: "permissions.employeesView" },
    ],
  },
  {
    titleKey: "admin.storefront",
    permissions: [
      { key: "website_media.manage", labelKey: "permissions.websiteMediaManage" },
      { key: "website_texts.manage", labelKey: "permissions.websiteTextsManage" },
      { key: "site_editor.access", labelKey: "Website editor: access" },
      { key: "site_editor.edit", labelKey: "Website editor: edit drafts" },
      { key: "site_editor.save", labelKey: "Website editor: save drafts" },
      { key: "site_editor.connection.manage", labelKey: "Website editor: manage storefront connection" },
      { key: "site_editor.manifest.sync", labelKey: "Website editor: sync site manifest" },
    ],
  },
  {
    titleKey: "admin.analytics",
    permissions: [
      { key: "reports.view", labelKey: "Analytics and reports: view" },
      { key: "activity_log.view", labelKey: "Activity log: view" },
    ],
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
