import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  SITE_MEDIA_SLOTS,
  SITE_LOGO_SLOT,
  aboutImageSlotKeys,
  brandMediaSlotKeys,
  brandMediaSlots,
  categoryHeroMediaSlotKeys,
  categoryHeroMediaSlots,
  newsImageSlotKeys,
  productMediaSlotKeys,
  productMediaSlots,
  resolveMediaSlot,
  siteLogoSlotKey,
  siteMediaSlotKeys,
} from "../src/data/mediaSlots.js";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const managerSource = read("../src/components/MediaSlotsManager.jsx");
const editorSource = read("../src/components/WebsiteMediaManager.jsx");

test("site media slots use the exact dotted keys the storefront consumes", () => {
  assert.deepEqual(siteMediaSlotKeys(), [
    "home.hero.video",
    "home.hero.poster",
    "about.hero.video",
    "about.hero.poster",
    "contact.hero.poster",
  ]);
  const video = SITE_MEDIA_SLOTS.find((slot) => slot.key === "home.hero.video");
  assert.equal(video.kind, "video");
  assert.equal(video.groupKey, "home");
});

test("site logo slot uses the exact site.logo key the header consumes", () => {
  assert.equal(SITE_LOGO_SLOT.key, "site.logo");
  assert.equal(SITE_LOGO_SLOT.kind, "image");
  assert.equal(siteLogoSlotKey(), "site.logo");
});

test("about image slots use about.{index}.image keys for every i-play section", () => {
  assert.deepEqual(aboutImageSlotKeys(), [
    "about.0.image",
    "about.1.image",
    "about.2.image",
    "about.3.image",
  ]);
});

test("news image slots use news.{index}.image keys for every i-play item", () => {
  assert.deepEqual(newsImageSlotKeys(), [
    "news.0.image",
    "news.1.image",
    "news.2.image",
    "news.3.image",
    "news.4.image",
  ]);
});

test("brand media slots use brand.{slug}.video / brand.{slug}.poster", () => {
  const slots = brandMediaSlots("baby");
  assert.deepEqual(brandMediaSlotKeys("baby"), ["brand.baby.video", "brand.baby.poster"]);
  assert.equal(slots[0].kind, "video");
  assert.equal(slots[1].kind, "image");
});

test("category hero slots use category.{slug}.heroVideo", () => {
  assert.deepEqual(categoryHeroMediaSlotKeys("toys"), ["category.toys.heroVideo"]);
  assert.equal(categoryHeroMediaSlots("toys")[0].kind, "video");
});

test("product usage slots use product.{slug}.usageVideo and usageVideoPoster", () => {
  assert.deepEqual(productMediaSlotKeys("toy"), ["product.toy.usageVideo", "product.toy.usageVideoPoster"]);
  assert.equal(productMediaSlots("toy")[0].kind, "video");
  assert.equal(productMediaSlots("toy")[1].kind, "image");
});

test("resolveMediaSlot picks the newest matching item by sectionKey", () => {
  const items = [
    { id: "old", sectionKey: "home.hero.poster", imageUrl: "/old.jpg", updatedAt: "2026-01-01T00:00:00.000Z", sortOrder: 1 },
    { id: "new", sectionKey: "home.hero.poster", imageUrl: "/new.jpg", updatedAt: "2026-08-01T00:00:00.000Z", sortOrder: 2 },
  ];
  assert.equal(resolveMediaSlot(items, "home.hero.poster").id, "new");
  assert.equal(resolveMediaSlot(items, "missing"), null);
});

test("slot manager renders collapsed accordion groups matching the storefront", () => {
  for (const group of ["Site Identity", "Home", "Brands", "Categories", "Products", "About", "News", "Contact"]) {
    assert.match(managerSource, new RegExp(group));
  }
  assert.match(managerSource, /website-media-accordion/);
  assert.match(managerSource, /lockSectionKey/);
  assert.match(managerSource, /import \{ MediaEditor \}/);
  assert.match(managerSource, /resolveMediaSlot/);
});

test("slot manager shows actual brand and category names instead of section keys", () => {
  assert.match(managerSource, /entityName\(brand, language\)/);
  assert.match(managerSource, /entityName\(category, language\)/);
  assert.match(managerSource, /entityName\(product, language\)/);
  assert.match(managerSource, /summary=\{group\.label\}/);
});

test("products group is searchable and opens a product to show its usage media", () => {
  assert.match(managerSource, /productQuery/);
  assert.match(managerSource, /Search products|ابحث عن منتج/);
  assert.match(managerSource, /filteredProducts/);
});

test("site logo editor supports preview, upload, replace and remove", () => {
  assert.match(managerSource, /Upload \/ Replace|رفع \/ استبدال/);
  assert.match(managerSource, /Remove logo|إزالة الشعار/);
  assert.match(managerSource, /uploadImage/);
  assert.match(managerSource, /withWebsiteMediaVersion/);
  assert.match(managerSource, /SITE_LOGO_SLOT/);
  assert.match(managerSource, /SiteIdentityGroup/);
});

test("about and news image slots render in the About and News groups", () => {
  assert.match(managerSource, /aboutImageSlots\(\)/);
  assert.match(managerSource, /newsImageSlots\(\)/);
});

test("slot manager reuses the existing video preview / replace / remove editor", () => {
  assert.match(editorSource, /export function MediaEditor/);
  assert.match(editorSource, /readOnly=\{lockSectionKey\}/);
  assert.match(editorSource, /uploadWebsiteVideo/);
  assert.match(editorSource, /"Remove video"|"إزالة الفيديو"/);
});
