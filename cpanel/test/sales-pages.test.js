import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  buildOrderMetrics,
  buildPaymentRows,
  buildReceiptRows,
  buildSalesAnalytics,
  canUseSalesAction,
  filterSalesOrders,
  formatCompanyCurrency,
  isSalesPage,
  salesDirection,
  salesPageKeys,
} from "../src/utils/sales.js";

const salesSource = fs.readFileSync(new URL("../src/pages/AdminSalesPage.jsx", import.meta.url), "utf8");
const appSource = fs.readFileSync(new URL("../src/CPanelApp.jsx", import.meta.url), "utf8");
const salesCss = fs.readFileSync(new URL("../src/styles/global.css", import.meta.url), "utf8");

const orders = [
  { id: "o1", createdAt: "2026-07-01T10:00:00Z", customer: { city: "Ramallah", email: "one@example.test", name: "One" }, items: [{ productId: "p1", quantity: 2, price: 10, lineTotal: 20 }], paymentMethod: "Cash", status: "Completed", total: 20 },
  { id: "o2", createdAt: "2026-07-02T10:00:00Z", customer: { city: "Nablus", email: "one@example.test", name: "One" }, items: [{ productId: "p2", quantity: 1, price: 10 }], status: "Pending", total: 10 },
  { id: "o3", createdAt: "2026-07-03T10:00:00Z", customer: { phone: "123", name: "Two" }, items: [], receiptNumber: "r3", status: "Processing", total: 0 },
];

test("all requested tenant Sales routes render through the centralized Sales page", () => {
  assert.equal(salesPageKeys.length, 8);
  assert.equal(isSalesPage("admin-orders"), true);
  assert.equal(isSalesPage("admin-tenant-placeholder-sales-payments-receipts"), true);
  assert.equal(isSalesPage("admin-products"), false);
  assert.match(appSource, /salesPageKeys\.includes\(activePage\)[\s\S]*?<AdminSalesPage/);
});

test("Sales metrics are calculated only from real loaded orders", () => {
  assert.deepEqual(buildOrderMetrics(orders), {
    averageOrderValue: 10,
    customers: 2,
    orders: 3,
    totalSales: 30,
  });
  const analytics = buildSalesAnalytics(orders, [{ id: "p1", name: { en: "Serum" } }, { id: "p2", name: { en: "Cream" } }], "en");
  assert.deepEqual(analytics.topProducts.map((item) => item.key), ["Serum", "Cream"]);
  assert.equal(analytics.customerMix.newCustomers, 2);
  assert.equal(analytics.customerMix.returningOrders, 1);
  assert.deepEqual(analytics.sources, []);
});

test("orders, payments, and receipts expose only existing records", () => {
  assert.deepEqual(filterSalesOrders(orders, { query: "nablus", status: "pending" }).map((item) => item.id), ["o2"]);
  assert.equal(buildPaymentRows(orders).length, 3);
  assert.deepEqual(buildReceiptRows(orders).map((item) => item.id), ["r3"]);
  assert.match(salesSource, /data-sales-empty-state/);
});

test("Sales actions respect tenant order permissions", () => {
  assert.equal(canUseSalesAction({ role: "company_admin" }, "addOrder"), true);
  assert.equal(canUseSalesAction({ role: "employee", permissions: ["orders.view"] }, "addOrder"), false);
  assert.equal(canUseSalesAction({ role: "employee", permissions: ["orders.view", "orders.create"] }, "addOrder"), true);
  assert.equal(canUseSalesAction({ role: "employee", permissions: ["orders.view"] }, "updateOrder"), false);
  assert.match(salesSource, /canUseSalesAction\(currentUser, "addOrder"\)/);
});

test("Sales pages render one page heading and hide the duplicate shell heading", () => {
  assert.match(salesSource, /<AdminLayout[\s\S]*?hideHeader/);
  assert.match(salesSource, /function SalesPageHeader/);
  assert.equal((salesSource.match(/data-sales-page-header/g) || []).length, 1);
});

test("company currency formatting uses locale safely without RTL control artifacts", () => {
  const formatted = formatCompanyCurrency(1234.5, { settings: { currency: "USD", locale: "ar-PS" } }, "ar");
  assert.match(formatted, /USD/);
  assert.match(formatted, /1[,.]234[,.]50/);
  assert.doesNotMatch(formatted, /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/);
  assert.match(formatCompanyCurrency(20, { settings: { currency: "EUR", locale: "en-US" } }, "en"), /€|EUR/);
});

test("Add Order uses the existing scoped createOrder API and refreshes real orders", () => {
  assert.match(appSource, /import \{ assignOrderEmployee, createOrder, deleteOrder, getOrders, updateOrderStatus \}/);
  assert.match(appSource, /async function handleCreateManualOrder\(payload\)[\s\S]*?createOrder\([\s\S]*?await refreshOrders\(\)/);
  assert.match(salesSource, /onCreateOrder\(\{[\s\S]*?customer,[\s\S]*?items:/);
});

test("unsupported Sales actions reuse the shared bilingual under-development content", () => {
  assert.match(salesSource, /AdminUnderDevelopmentContent/);
  assert.match(salesSource, /setShowUnsupported\(true\)/);
  assert.match(salesSource, /role="dialog"/);
});

test("each Sales empty state uses a page-specific original illustration", () => {
  for (const illustration of ["orders", "subscription", "gift", "payment", "receipt", "cart"]) {
    assert.match(salesSource, new RegExp(`type=\\"${illustration}\\"|illustration=\\"${illustration}\\"`));
  }
  assert.match(salesSource, /sales-gift-hero/);
  assert.match(salesSource, /sales-automation-card/);
  assert.match(salesSource, /sales-summary-bar/);
});

test("Sales pages explicitly support English LTR and Arabic RTL", () => {
  assert.equal(salesDirection("en"), "ltr");
  assert.equal(salesDirection("ar"), "rtl");
  assert.match(salesSource, /dir=\{salesDirection\(language\)\}/);
  assert.match(salesCss, /\[dir="rtl"\] \.sales-page-header/);
});

test("Sales layout has responsive Wix-style cards, tables, and empty states", () => {
  const scoped = salesCss.slice(salesCss.indexOf("\/\* Tenant Sales module \*\/"));
  assert.match(scoped, /\.sales-kpi-grid\.four \{ grid-template-columns: repeat\(4, minmax\(0, 1fr\)\); \}/);
  assert.match(scoped, /\.sales-kpi-card,[\s\S]*?\.sales-data-card,[\s\S]*?border-radius: 12px/);
  assert.match(scoped, /@media \(max-width: 760px\)[\s\S]*?\.sales-kpi-grid\.three/);
});
