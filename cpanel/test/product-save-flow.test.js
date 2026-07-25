import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const dashboard = fs.readFileSync(new URL("../src/pages/AdminDashboardPage.jsx", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../src/CPanelApp.jsx", import.meta.url), "utf8");
const apiClient = fs.readFileSync(new URL("../src/utils/api.js", import.meta.url), "utf8");
const productsApi = fs.readFileSync(new URL("../src/utils/productsApi.js", import.meta.url), "utf8");
const stagingEnvironment = fs.readFileSync(new URL("../.env.staging", import.meta.url), "utf8");

test("the staging CPanel build uses VITE_API_URL and no legacy product API host", () => {
  assert.match(stagingEnvironment, /^VITE_API_URL=https:\/\/api-staging\.igroup\.website\s*$/m);
  assert.match(apiClient, /import\.meta\.env\?\.VITE_API_URL/);
  assert.doesNotMatch(apiClient, /backend\.igroup\.website/);
  assert.doesNotMatch(productsApi, /https?:\/\//);
  assert.match(productsApi, /apiRequest\("\/products"/);
  assert.match(productsApi, /apiRequest\(`\/products\/\$\{product\.id\}`/);
});

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

test("card image uploads use independent primary and hover controls", () => {
  assert.match(dashboard, /function CardImageUpload/);
  assert.match(dashboard, /buttonLabel="Upload primary image"/);
  assert.match(dashboard, /buttonLabel="Upload hover image"/);
  assert.match(dashboard, /name="image"/);
  assert.match(dashboard, /name="hoverImage"/);
});

test("card image form bootstrap reads primary and secondary aliases", () => {
  assert.match(dashboard, /image: editingProduct\?\.image \|\| editingProduct\?\.primaryImage/);
  assert.match(dashboard, /hoverImage: editingProduct\?\.hoverImage \|\| editingProduct\?\.secondaryImage/);
});

test("tenant card image uploads require a saved product first", () => {
  assert.match(dashboard, /tenantSpecific=\{usesTenantDefinitions\}/);
  assert.match(dashboard, /uploadBlocked \? "Save product first"/);
  assert.match(dashboard, /disabled=\{isUploading \|\| uploadBlocked\}/);
  assert.match(dashboard, /validateProductMediaFile\(file, \{ allowVideo: false \}\)/);
});
