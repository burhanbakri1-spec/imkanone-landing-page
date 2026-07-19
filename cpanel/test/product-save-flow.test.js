import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const dashboard = fs.readFileSync(new URL("../src/pages/AdminDashboardPage.jsx", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../src/CPanelApp.jsx", import.meta.url), "utf8");

test("new variants do not receive reusable client-generated product variant IDs", () => {
  assert.match(dashboard, /id: variant\.id \|\| ""/);
  assert.match(dashboard, /id: variant\.id \|\| undefined/);
  assert.doesNotMatch(dashboard, /product\.id \|\| "product"\}-variant/);
});

test("structured fields run only after the base product succeeds and retry is content-only", () => {
  const baseSave = dashboard.indexOf("const result = await onSave(productPayload)");
  const fieldSave = dashboard.indexOf("await productFieldApi.saveValues(result.product.id");
  const retry = dashboard.slice(dashboard.indexOf("async function retryContentSave"), dashboard.indexOf("async function uploadVideo"));
  assert.ok(baseSave >= 0 && fieldSave > baseSave);
  assert.match(retry, /productFieldApi\.saveValues/);
  assert.doesNotMatch(retry, /onSave\(/);
});

test("product editing uses a reload-safe id route", () => {
  assert.match(app, /\/admin\\\/products\\\/\[\^\/\]\+\\\/edit/);
  assert.match(dashboard, /\/admin\/products\/\$\{encodeURIComponent\(product\.id\)\}\/edit/);
});
