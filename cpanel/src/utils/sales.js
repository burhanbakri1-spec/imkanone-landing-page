import { hasPermission } from "../data/permissions.js";
import { canAccessAdminPage, isTenantOperator } from "./roles.js";

export const salesPageKeys = Object.freeze([
  "admin-orders",
  "admin-tenant-placeholder-sales-subscriptions",
  "admin-tenant-placeholder-sales-gift-card-sales",
  "admin-tenant-placeholder-sales-payments-all",
  "admin-tenant-placeholder-sales-payments-receipts",
  "admin-tenant-placeholder-sales-analytics-overview",
  "admin-tenant-placeholder-sales-analytics-subscriptions",
  "admin-tenant-placeholder-sales-abandoned-carts",
]);

export function isSalesPage(pageKey) {
  return salesPageKeys.includes(pageKey);
}

function amount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function customerKey(customer = {}) {
  return customer.email || customer.phone || customer.id || customer.name || "";
}

export function buildOrderMetrics(orders = []) {
  const totalSales = orders.reduce((sum, order) => sum + amount(order.total), 0);
  const customers = new Set(orders.map((order) => customerKey(order.customer)).filter(Boolean));
  return {
    averageOrderValue: orders.length ? totalSales / orders.length : 0,
    customers: customers.size,
    orders: orders.length,
    totalSales,
  };
}

export function filterSalesOrders(orders = [], filters = {}) {
  const query = String(filters.query || "").trim().toLocaleLowerCase();
  const status = String(filters.status || "all").toLocaleLowerCase();
  const from = filters.from ? new Date(`${filters.from}T00:00:00`).getTime() : null;
  const to = filters.to ? new Date(`${filters.to}T23:59:59.999`).getTime() : null;

  return orders.filter((order) => {
    const orderStatus = String(order.status || "").toLocaleLowerCase();
    const createdAt = order.createdAt ? new Date(order.createdAt).getTime() : null;
    const haystack = [
      order.id,
      order.customer?.name,
      order.customer?.email,
      order.customer?.phone,
      order.customer?.city,
      order.paymentMethod,
    ].filter(Boolean).join(" ").toLocaleLowerCase();

    return (!query || haystack.includes(query))
      && (status === "all" || orderStatus === status)
      && (!from || (createdAt && createdAt >= from))
      && (!to || (createdAt && createdAt <= to));
  });
}

export function buildPaymentRows(orders = []) {
  return orders.map((order) => ({
    amount: amount(order.total),
    customer: order.customer || {},
    date: order.createdAt || null,
    id: order.id,
    method: order.paymentMethod || "",
    orderReference: order.id,
    status: order.paymentStatus || order.status || "",
  }));
}

export function buildReceiptRows(orders = []) {
  return orders.filter((order) => order.receiptId || order.receiptNumber || order.receiptUrl).map((order) => ({
    amount: amount(order.total),
    customer: order.customer || {},
    date: order.createdAt || null,
    id: order.receiptId || order.receiptNumber || order.id,
    orderReference: order.id,
    url: order.receiptUrl || "",
  }));
}

function itemName(item = {}, products = [], language = "en") {
  const product = products.find((entry) => String(entry.id) === String(item.productId));
  const name = product?.name;
  if (typeof name === "string") return name;
  return name?.[language] || name?.en || name?.ar || item.productName || item.name || item.slug || item.productId || "";
}

function groupOrders(orders, keyForOrder) {
  const groups = new Map();
  orders.forEach((order) => {
    const key = keyForOrder(order);
    if (!key) return;
    const current = groups.get(key) || { key, orders: 0, sales: 0 };
    current.orders += 1;
    current.sales += amount(order.total);
    groups.set(key, current);
  });
  return [...groups.values()].sort((a, b) => b.sales - a.sales);
}

export function buildSalesAnalytics(orders = [], products = [], language = "en") {
  const productGroups = new Map();
  orders.forEach((order) => {
    (Array.isArray(order.items) ? order.items : []).forEach((item) => {
      const name = itemName(item, products, language);
      if (!name) return;
      const current = productGroups.get(name) || { key: name, quantity: 0, sales: 0 };
      const quantity = Math.max(0, amount(item.quantity));
      current.quantity += quantity;
      current.sales += amount(item.lineTotal ?? amount(item.price) * quantity);
      productGroups.set(name, current);
    });
  });

  const daily = groupOrders(orders, (order) => order.createdAt ? String(order.createdAt).slice(0, 10) : "");
  const customerGroups = groupOrders(orders, (order) => customerKey(order.customer));
  const sources = groupOrders(orders, (order) => order.source || order.channel || "");
  const locations = groupOrders(orders, (order) => order.customer?.city || order.customer?.country || "");
  const returningOrders = customerGroups.reduce((sum, customer) => sum + Math.max(0, customer.orders - 1), 0);

  return {
    customerMix: {
      newCustomers: customerGroups.length,
      returningOrders,
    },
    daily: daily.sort((a, b) => a.key.localeCompare(b.key)),
    locations: locations.slice(0, 5),
    metrics: buildOrderMetrics(orders),
    sources: sources.slice(0, 5),
    topCustomers: customerGroups.slice(0, 5),
    topProducts: [...productGroups.values()].sort((a, b) => b.sales - a.sales).slice(0, 5),
  };
}

export function salesDirection(language) {
  return language === "ar" ? "rtl" : "ltr";
}

export function formatCompanyCurrency(value, company = {}, language = "en") {
  const configuredCurrency = String(company?.settings?.currency || "ILS").toUpperCase();
  const currency = /^[A-Z]{3}$/.test(configuredCurrency) ? configuredCurrency : "ILS";
  const locale = company?.settings?.locale || (language === "ar" ? "ar-PS" : "en-US");
  try {
    const formatted = new Intl.NumberFormat(locale, {
      currency,
      currencyDisplay: language === "ar" ? "code" : "symbol",
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
      numberingSystem: language === "ar" ? "latn" : undefined,
      style: "currency",
    }).format(Number(value || 0));
    return formatted
      .replace(/[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "")
      .replace(/\s+/g, "\u00a0")
      .trim();
  } catch {
    return `${Number(value || 0).toFixed(2)}\u00a0${currency}`;
  }
}

export function canUseSalesAction(currentUser, action) {
  if (!canAccessAdminPage(currentUser, "admin-orders")) return false;
  if (isTenantOperator(currentUser?.role)) return true;
  const permissions = {
    addOrder: "orders.create",
    deleteOrder: "orders.delete",
    updateOrder: "orders.updateStatus",
  };
  return permissions[action] ? hasPermission(currentUser, permissions[action]) : true;
}
