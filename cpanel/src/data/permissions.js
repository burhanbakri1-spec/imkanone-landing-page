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
      { key: "employees.view", labelKey: "permissions.employeesView" },
    ],
  },
  {
    titleKey: "admin.storefront",
    permissions: [
      { key: "website_media.manage", labelKey: "permissions.websiteMediaManage" },
    ],
  },
];

export function hasPermission(user, permission) {
  if (user?.role === "admin") {
    return true;
  }

  return ["employee", "staff", "manager"].includes(user?.role) && user.permissions?.includes(permission);
}
