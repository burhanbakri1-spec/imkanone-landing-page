import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  ABOUT_SECTIONS,
  NEWS_ITEMS,
  PARENT_BRAND,
  SITE_MEDIA_SLOTS,
  SITE_LOGO_SLOT,
  aboutImageSlotKeys,
  aboutImageSlots,
  newsImageSlotKeys,
  newsImageSlots,
  resolveMediaSlot,
  siteLogoSlotKey,
  siteMediaSlotKeys,
} from "../src/data/mediaSlots.js";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const managerSource = read("../src/components/MediaSlotsManager.jsx");
const editorSource = read("../src/components/WebsiteMediaManager.jsx");
const slotsSource = read("../src/data/mediaSlots.js");

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

test("parent brand identity is the real VELVET group and uses site.logo", () => {
  assert.equal(PARENT_BRAND.slug, "velvet");
  assert.equal(PARENT_BRAND.name.en, "VELVET");
  assert.equal(SITE_LOGO_SLOT.key, "site.logo");
  assert.equal(siteLogoSlotKey(), "site.logo");
  assert.match(managerSource, /groupLabels = \{[\s\S]*identity: \{ en: "VELVET"/);
});

test("about image slots use real i-play section titles as labels", () => {
  assert.deepEqual(aboutImageSlotKeys(), [
    "about.0.image",
    "about.1.image",
    "about.2.image",
    "about.3.image",
  ]);
  assert.equal(ABOUT_SECTIONS.length, 4);
  assert.equal(aboutImageSlots()[0].labelEn, "Let's Reimagine");
  assert.equal(aboutImageSlots()[0].labelAr, "لنتخيّل من جديد");
  assert.equal(aboutImageSlots()[3].labelEn, "Taking a Stand");
});

test("news image slots use real i-play news titles as labels", () => {
  assert.deepEqual(newsImageSlotKeys(), [
    "news.0.image",
    "news.1.image",
    "news.2.image",
    "news.3.image",
    "news.4.image",
  ]);
  assert.equal(NEWS_ITEMS.length, 5);
  assert.equal(newsImageSlots()[0].labelEn, "A first look inside our new Pocket Worlds studio");
  assert.equal(newsImageSlots()[4].labelEn, "Meet the color team behind Cloud Dough");
});

test("resolveMediaSlot picks the newest matching item by sectionKey", () => {
  const items = [
    { id: "old", sectionKey: "home.hero.poster", imageUrl: "/old.jpg", updatedAt: "2026-01-01T00:00:00.000Z", sortOrder: 1 },
    { id: "new", sectionKey: "home.hero.poster", imageUrl: "/new.jpg", updatedAt: "2026-08-01T00:00:00.000Z", sortOrder: 2 },
  ];
  assert.equal(resolveMediaSlot(items, "home.hero.poster").id, "new");
  assert.equal(resolveMediaSlot(items, "missing"), null);
});

test("slot manager renders only the final site/home/about/news/contact groups collapsed by default", () => {
  for (const group of ["VELVET", "About", "News", "Contact"]) {
    assert.match(managerSource, new RegExp(group.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(managerSource, /function Accordion\(\{ summary, count, defaultOpen = false/);
  assert.match(managerSource, /defaultOpen = false/);
  assert.match(managerSource, /website-media-accordion/);
  assert.match(managerSource, /import \{ MediaEditor \}/);
});

test("Website Media no longer owns Brand/Category/Product media editors", () => {
  assert.doesNotMatch(managerSource, /VELVET_BRANCHES/);
  assert.doesNotMatch(managerSource, /brandMediaSlots|brand\.\$\{group\.key\}\.logo/);
  assert.doesNotMatch(managerSource, /CategoryImageEditor/);
  assert.doesNotMatch(managerSource, /categoryHeroMediaSlots/);
  assert.doesNotMatch(managerSource, /productMediaSlots|productQuery|filteredProducts/);
  assert.doesNotMatch(managerSource, /groupLabels = \{[\s\S]*brands: \{ en: "VELVET Branches"/);
  assert.doesNotMatch(managerSource, /groupLabels = \{[\s\S]*products: \{ en: "Products"/);
});

test("media slot model exposes only site/home/about/news/contact keys", () => {
  assert.doesNotMatch(slotsSource, /VELVET_BRANCHES/);
  assert.doesNotMatch(slotsSource, /brand\.\$\{/);
  assert.doesNotMatch(slotsSource, /category\.\$\{/);
  assert.doesNotMatch(slotsSource, /product\.\$\{/);
  assert.doesNotMatch(slotsSource, /export function brandMediaSlots/);
  assert.doesNotMatch(slotsSource, /export function categoryHeroMediaSlots/);
  assert.doesNotMatch(slotsSource, /export function productMediaSlots/);
});

test("site logo editor supports preview, upload, replace and remove", () => {
  assert.match(managerSource, /Upload \/ Replace|رفع \/ استبدال/);
  assert.match(managerSource, /Remove logo|إزالة الشعار/);
  assert.match(managerSource, /uploadImage/);
  assert.match(managerSource, /withWebsiteMediaVersion/);
  assert.match(managerSource, /SITE_LOGO_SLOT/);
});

test("about and news image slots render in the About and News groups with real labels", () => {
  assert.match(managerSource, /aboutImageSlots\(\)/);
  assert.match(managerSource, /newsImageSlots\(\)/);
  assert.match(slotsSource, /ABOUT_SECTIONS/);
  assert.match(slotsSource, /NEWS_ITEMS/);
});

test("slot manager reuses the existing video preview / replace / remove editor", () => {
  assert.match(editorSource, /export function MediaEditor/);
  assert.match(editorSource, /readOnly=\{lockSectionKey\}/);
  assert.match(editorSource, /uploadWebsiteVideo/);
  assert.match(editorSource, /"Remove video"|"إزالة الفيديو"/);
});