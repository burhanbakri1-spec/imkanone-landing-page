import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  ABOUT_SECTIONS,
  NEWS_ITEMS,
  PARENT_BRAND,
  SITE_MEDIA_SLOTS,
  SITE_LOGO_SLOT,
  VELVET_BRANCHES,
  aboutImageSlotKeys,
  aboutImageSlots,
  brandLogoSlotKey,
  brandMediaSlotKeys,
  brandMediaSlots,
  categoryHeroMediaSlotKeys,
  categoryHeroMediaSlots,
  newsImageSlotKeys,
  newsImageSlots,
  productMediaSlotKeys,
  productMediaSlots,
  resolveMediaSlot,
  siteLogoSlotKey,
  siteMediaSlotKeys,
  velvetBranchSlugs,
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

test("parent brand identity is the real VELVET group and uses site.logo", () => {
  assert.equal(PARENT_BRAND.slug, "velvet");
  assert.equal(PARENT_BRAND.name.en, "VELVET");
  assert.equal(SITE_LOGO_SLOT.key, "site.logo");
  assert.equal(siteLogoSlotKey(), "site.logo");
  assert.match(managerSource, /groupLabels = \{[\s\S]*identity: \{ en: "VELVET"/);
});

test("canonical VELVET branches cover every actual i-play branch with exact names", () => {
  assert.deepEqual(velvetBranchSlugs(), ["baby", "kids", "play", "build", "learn", "create", "games", "move", "collect", "plush", "books", "muslim"]);
  for (const branch of VELVET_BRANCHES) {
    assert.equal(branch.name.en, `VELVET ${branch.slug.toUpperCase()}`);
    assert.equal(branch.name.ar, `VELVET ${branch.slug.toUpperCase()}`);
  }
});

test("branch media slots expose logo + video + poster with exact keys", () => {
  const slots = brandMediaSlots("baby");
  assert.deepEqual(brandMediaSlotKeys("baby"), [
    "brand.baby.logo",
    "brand.baby.video",
    "brand.baby.poster",
  ]);
  assert.equal(slots[0].key, "brand.baby.logo");
  assert.equal(slots[0].kind, "image");
  assert.equal(brandLogoSlotKey("baby"), "brand.baby.logo");
  assert.equal(slots[1].kind, "video");
  assert.equal(slots[2].kind, "image");
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

test("slot manager renders the final VELVET hierarchy with all groups collapsed by default", () => {
  for (const group of ["VELVET", "VELVET Branches", "Categories", "Products", "About", "News", "Contact"]) {
    assert.match(managerSource, new RegExp(group.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(managerSource, /function Accordion\(\{ summary, count, defaultOpen = false/);
  assert.match(managerSource, /defaultOpen = false/);
  assert.match(managerSource, /VELVET_BRANCHES\.map/);
  assert.match(managerSource, /website-media-accordion/);
  assert.match(managerSource, /import \{ MediaEditor \}/);
});

test("slot manager loads every VELVET branch from the canonical catalog and renders branch logo", () => {
  assert.match(managerSource, /VELVET_BRANCHES\.map\(\(branch\) =>/);
  assert.match(managerSource, /branch\.name\[language\]/);
  assert.match(managerSource, /brand\.\$\{group\.key\}\.logo/);
  assert.match(managerSource, /LogoEditor/);
});

test("category image edits the existing category imageUrl through onSaveCategory without a website-media key", () => {
  assert.match(managerSource, /CategoryImageEditor/);
  assert.match(managerSource, /onSaveCategory=\{onSaveCategory\}/);
  assert.match(managerSource, /imageUrl: result\.url \|\| result\.path \|\| ""/);
  assert.match(managerSource, /setDraft\(\(current\) => \(\{ \.\.\.current, imageUrl/);
  assert.doesNotMatch(managerSource, /category\.\$\{[^}]*\}\.image/);
});

test("products group is searchable and opens a product to show its usage media", () => {
  assert.match(managerSource, /productQuery/);
  assert.match(managerSource, /Search products|ابحث عن منتج/);
  assert.match(managerSource, /filteredProducts/);
  assert.match(managerSource, /entityName\(product, language\)/);
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
  const slotsSource = read("../src/data/mediaSlots.js");
  assert.match(slotsSource, /ABOUT_SECTIONS/);
  assert.match(slotsSource, /NEWS_ITEMS/);
});

test("slot manager reuses the existing video preview / replace / remove editor", () => {
  assert.match(editorSource, /export function MediaEditor/);
  assert.match(editorSource, /readOnly=\{lockSectionKey\}/);
  assert.match(editorSource, /uploadWebsiteVideo/);
  assert.match(editorSource, /"Remove video"|"إزالة الفيديو"/);
});
