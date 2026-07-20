import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const productRoutes = fs.readFileSync(new URL("../src/routes/products.js", import.meta.url), "utf8");
const store = fs.readFileSync(new URL("../src/data/store.js", import.meta.url), "utf8");

const placeholderImage = "/images/products/product-placeholder.svg";

function isRealImageUrl(value) {
  return typeof value === "string"
    && value.trim()
    && !value.trim().includes("/images/products/product-placeholder");
}

function preserveImageUrl(existingValue, incomingValue) {
  if (incomingValue === null || incomingValue === "") return "";
  if (isRealImageUrl(incomingValue)) return incomingValue.trim();
  const existing = isRealImageUrl(existingValue) ? existingValue : "";
  return existing || incomingValue || "";
}

function normalizeCardImages(product) {
  const primarySource = product.image || product.primaryImage || product.primary_image || "";
  const hoverSource = product.hoverImage || product.secondaryImage || product.secondary_image || "";
  return {
    image: isRealImageUrl(primarySource) ? primarySource.trim() : "",
    hoverImage: isRealImageUrl(hoverSource) ? hoverSource.trim() : "",
  };
}

test("product routes resolve primary and hover image aliases", () => {
  assert.match(productRoutes, /product\.image \|\| product\.primaryImage \|\| product\.primary_image/);
  assert.match(productRoutes, /product\.hoverImage \|\| product\.secondaryImage \|\| product\.secondary_image/);
  assert.match(productRoutes, /incomingProduct\.primaryImage \|\| incomingProduct\.primary_image/);
  assert.match(productRoutes, /incomingProduct\.secondaryImage \|\| incomingProduct\.secondary_image/);
});

test("placeholder detection rejects legacy-cleared placeholder variants", () => {
  assert.match(productRoutes, /includes\("\/images\/products\/product-placeholder"\)/);
  assert.doesNotMatch(productRoutes, /function isEmptyOrPlaceholder/);
  assert.equal(isRealImageUrl(placeholderImage), false);
  assert.equal(isRealImageUrl(`${placeholderImage}?legacy-cleared=1`), false);
  assert.equal(isRealImageUrl("/uploads/icare/products/product-1/card.jpg"), true);
});

test("preserveImageUrl keeps existing URL when incoming is undefined", () => {
  const existing = "/uploads/icare/products/product-1/primary.jpg";
  assert.equal(preserveImageUrl(existing, undefined), existing);
});

test("preserveImageUrl clears on explicit empty string", () => {
  assert.equal(preserveImageUrl("/uploads/icare/products/product-1/primary.jpg", ""), "");
  assert.equal(preserveImageUrl("/uploads/icare/products/product-1/hover.jpg", null), "");
});

test("normalizeProduct card images map placeholders to empty strings", () => {
  assert.deepEqual(normalizeCardImages({
    image: placeholderImage,
    hoverImage: `${placeholderImage}?legacy-cleared=1`,
  }), { image: "", hoverImage: "" });
  assert.deepEqual(normalizeCardImages({
    primaryImage: "/uploads/icare/products/product-1/primary.jpg",
    secondaryImage: "/uploads/icare/products/product-1/hover.jpg",
  }), {
    image: "/uploads/icare/products/product-1/primary.jpg",
    hoverImage: "/uploads/icare/products/product-1/hover.jpg",
  });
});

test("file store normalization mirrors card image alias support", () => {
  assert.match(store, /product\.image \|\| product\.primaryImage \|\| product\.primary_image/);
  assert.match(store, /product\.hoverImage \|\| product\.secondaryImage \|\| product\.secondary_image/);
  assert.match(store, /includes\("\/images\/products\/product-placeholder"\)/);
});
