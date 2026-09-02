import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { formatInventoryDate } from "../src/utils/inventoryDate.js";

const page = fs.readFileSync(new URL("../src/pages/AdminInventoryPage.jsx", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../src/CPanelApp.jsx", import.meta.url), "utf8");
const api = fs.readFileSync(new URL("../src/utils/inventoryApi.js", import.meta.url), "utf8");

test("inventory page uses real tenant API and replaces the legacy dashboard route", () => {
  assert.match(page, /fetchInventory\(\)/);
  assert.match(page, /updateInventory\(row\.id, body\)/);
  assert.match(app, /activePage === "admin-inventory"/);
  assert.match(api, /\/admin\/inventory/);
});

test("inventory provides summaries, filters, hierarchy columns, and variant expansion", () => {
  for (const value of ["Total Products", "In Stock", "Low Stock", "Out of Stock", "Brand", "Main Category", "Subcategory", "SKU", "Last Updated"]) assert.match(page, new RegExp(value));
  assert.match(page, /setExpanded/);
  assert.match(page, /row\.variants\.map/);
  assert.match(page, /brandId/);
  assert.match(page, /mainId/);
  assert.match(page, /statusFor/);
});

test("inventory write controls respect existing product and inventory permissions", () => {
  assert.match(page, /inventory\.manage/);
  assert.match(page, /products\.update/);
  assert.match(page, /disabled=\{!canManage/);
});

test("inventory page supports Arabic RTL copy through the shared shell", () => {
  assert.match(page, /ar: \{ title: "المخزون"/);
  assert.match(page, /language=\{language\}/);
});

test("inventory dates render safely for valid, missing, empty, and malformed values", () => {
  assert.notEqual(formatInventoryDate("2026-08-16T08:23:08.149Z", "en"), "—");
  assert.equal(formatInventoryDate(null, "en"), "—");
  assert.equal(formatInventoryDate("", "en"), "—");
  assert.equal(formatInventoryDate({}, "en"), "—");
  assert.match(page, /formatInventoryDate\(row\.updatedAt, language\)/);
  assert.doesNotMatch(page, /format\(new Date\(row\.updatedAt\)\)/);
});
