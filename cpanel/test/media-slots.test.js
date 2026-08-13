import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  SITE_MEDIA_SLOTS,
  brandMediaSlotKeys,
  brandMediaSlots,
  categoryHeroMediaSlotKeys,
  categoryHeroMediaSlots,
  productMediaSlotKeys,
  productMediaSlots,
  resolveMediaSlot,
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

test("slot manager renders every curated group and locks section keys", () => {
  for (const group of ["Storefront Heroes", "Brand Heroes", "Category Heroes", "Product Usage Media"]) {
    assert.match(managerSource, new RegExp(group));
  }
  assert.match(managerSource, /lockSectionKey/);
  assert.match(managerSource, /import \{ MediaEditor \}/);
  assert.match(managerSource, /resolveMediaSlot/);
});

test("slot manager reuses the existing video preview / replace / remove editor", () => {
  assert.match(editorSource, /export function MediaEditor/);
  assert.match(editorSource, /readOnly=\{lockSectionKey\}/);
  assert.match(editorSource, /uploadWebsiteVideo/);
  assert.match(editorSource, /"Remove video"|"إزالة الفيديو"/);
});
