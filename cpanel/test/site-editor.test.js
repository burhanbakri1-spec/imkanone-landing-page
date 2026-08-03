import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { getNavigationItem } from "../src/data/adminNavigation.js";
import { hasPermission } from "../src/data/permissions.js";
import { resolvePage } from "../src/utils/cpanelAccess.js";
import { canAccessAdminPage } from "../src/utils/roles.js";
import {
  createSiteEditorState, currentSiteEditorDocument, normalizeSiteEditorPage,
  siteEditorCapabilities, siteEditorDirection, siteEditorReducer, siteEditorText, siteEditorTools,
  trustedPagePreview, trustedSitePreview,
} from "../src/utils/siteEditor.js";
import {
  editorNodeStyles, findEditorNode, moveEditorSection, plainEditorText, replaceEditorImage,
  safeEditorLink, sectionMoveAvailability, updateEditorContentList, updateEditorImageSettings,
  updateEditorLink, updateEditorStyle, updateEditorText,
} from "../src/utils/siteEditorDocument.js";
import {
  quickEditNodeEditable, quickEditPropertyEditable, quickEditSectionFields,
} from "../src/utils/siteEditorQuickEdit.js";
import {
  blankSectionTemplate, insertSectionAtTarget, sectionLibraryBlank, sectionLibraryCategories,
  sectionLibraryCategoryKey, sectionTemplatesForCategory, templateDescription, templateLabel,
  validSectionInsertPosition,
} from "../src/utils/siteEditorSectionLibrary.js";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const appSource = read("../src/CPanelApp.jsx");
const pageSource = read("../src/pages/SiteEditorPage.jsx");
const topbarSource = read("../src/components/site-editor/SiteEditorTopBar.jsx");
const toolbarSource = read("../src/components/site-editor/SiteEditorToolbar.jsx");
const pagesSource = read("../src/components/site-editor/SiteEditorPagesPanel.jsx");
const treeSource = read("../src/components/site-editor/PageTreeItem.jsx");
const canvasSource = read("../src/components/site-editor/SiteEditorCanvas.jsx");
const editableSource = read("../src/components/site-editor/EditableElement.jsx");
const apiSource = read("../src/utils/siteEditorApi.js");
const cssSource = read("../src/styles/site-editor.css");

const company = { id: "icare", slug: "icare", name: "iCare", storefrontUrl: "https://igroup.website/icare" };
const admin = { id: "u1", role: "company_admin", activeCompany: company };
const page = { id: "icare:home", tenantId: "icare", title: "Home", pageType: "page", previewPath: "/icare", routePattern: "/icare", status: "source", isEditable: true };
const document = {
  id: "doc:home", companyId: "icare", siteId: "icare", pageId: "icare:home", pageType: "page", title: "Home", slug: "home",
  routePattern: "/icare", previewPath: "/icare", locale: "en", status: "draft", revision: 0,
  sections: [
    { id: "hero", type: "hero", order: 0, settings: {}, styles: { backgroundColor: "#fff" }, responsive: {}, elements: [
      { id: "heading", type: "heading", content: { text: "iCare" }, settings: {}, styles: { fontSize: 64 }, responsive: {}, children: [] },
      { id: "copy", type: "text", content: { text: "Care made clear" }, settings: {}, styles: {}, responsive: {}, children: [] },
      { id: "image", type: "image", content: { src: "/uploads/hero.jpg", alt: "iCare products" }, settings: {}, styles: { width: 80 }, responsive: {}, children: [] },
      { id: "button", type: "button", content: { label: "Shop", link: "/icare/shop" }, settings: {}, styles: {}, responsive: {}, children: [] },
    ] },
    { id: "content", type: "content", order: 1, settings: {}, styles: {}, responsive: {}, elements: [
      { id: "list", type: "list", content: { items: ["mission", "philanthropy"] }, settings: {}, styles: {}, responsive: {}, children: [] },
    ] },
  ],
};

function loadedState() {
  let state = createSiteEditorState("en");
  state = siteEditorReducer(state, { type: "pages-success", pages: [page], currentPageId: page.id });
  return siteEditorReducer(state, { type: "document-success", pageId: page.id, document });
}

test("1 Home appears in Pages & Menu", () => {
  assert.equal(normalizeSiteEditorPage(page, "icare")?.title, "Home");
  assert.match(pagesSource, /pages\.map|PageTree/);
});
test("2 dropdown and Pages panel share currentPageId", () => {
  assert.match(pageSource, /currentPage = state\.pages\.find\(\(page\) => page\.id === state\.currentPageId\)/);
  assert.match(pageSource, /<SiteEditorToolbar currentPage=\{currentPage\}/);
  assert.match(treeSource, /onSelectPage\(page\.id\)/);
  assert.match(pagesSource, /currentPageId=\{state\.currentPageId\}/);
});
test("3 selecting Home loads its document without route reload", () => {
  assert.match(pageSource, /loadDocument\(pageId, activeLanguage\)/);
  assert.match(apiSource, /`\/site-editor\/pages\/\$\{encodeURIComponent\(pageId\)\}/);
  assert.doesNotMatch(treeSource, /location\.href|window\.location/);
});
test("4 structured sections render in the internal canvas", () => {
  assert.match(canvasSource, /EditablePageCanvas/);
  assert.doesNotMatch(canvasSource, /iframe/);
  assert.match(cssSource, /site-editor-editable-section/);
});
test("5 heading selection is represented in shared reducer state", () => {
  const state = siteEditorReducer(loadedState(), { type: "select-node", nodeId: "heading", sectionId: "hero", inspector: "style" });
  assert.equal(state.selectedNodeId, "heading");
});
test("6 text selection resolves the real node", () => assert.equal(findEditorNode(document, "copy")?.node.type, "text"));
test("7 image selection resolves the real node", () => assert.equal(findEditorNode(document, "image")?.node.type, "image"));
test("8 button selection resolves the real node", () => assert.equal(findEditorNode(document, "button")?.node.type, "button"));
test("9 empty canvas clears selection", () => assert.match(canvasSource, /onSelect=\{onSelect\}/));
test("10 Escape exits editing or clears selection", () => assert.match(pageSource, /event\.key === "Escape"[\s\S]*?clear-selection/));
test("11 text editing updates only selected node", () => {
  const next = updateEditorText(document, "heading", "New heading");
  assert.equal(findEditorNode(next, "heading").node.content.text, "New heading");
  assert.equal(findEditorNode(next, "copy").node.content.text, "Care made clear");
});
test("12 unsafe HTML and scripts are rejected", () => {
  assert.throws(() => plainEditorText("<script>alert(1)</script>"));
  assert.throws(() => safeEditorLink("javascript:alert(1)"));
});
test("13 active current-tenant media can replace an image", () => {
  const next = replaceEditorImage(document, "image", { id: "m1", company_id: "icare", is_active: true, image_url: "/uploads/new.jpg" }, "icare");
  assert.equal(findEditorNode(next, "image").node.content.src, "/uploads/new.jpg");
});
test("14 cross-tenant or inactive media is rejected", () => {
  assert.throws(() => replaceEditorImage(document, "image", { id: "m1", company_id: "eb-chemical", image_url: "/uploads/x.jpg" }, "icare"));
  assert.throws(() => replaceEditorImage(document, "image", { id: "m2", company_id: "icare", is_active: false, image_url: "/uploads/x.jpg" }, "icare"));
});
test("15 style changes affect only the selected node", () => {
  const next = updateEditorStyle(document, "heading", "fontSize", 72);
  assert.equal(findEditorNode(next, "heading").node.styles.fontSize, 72);
  assert.deepEqual(findEditorNode(next, "copy").node.styles, {});
});
test("16 desktop and mobile styles remain separate", () => {
  const next = updateEditorStyle(document, "heading", "fontSize", 34, "mobile");
  const node = findEditorNode(next, "heading").node;
  assert.equal(node.styles.fontSize, 64);
  assert.equal(node.responsive.mobile.fontSize, 34);
  assert.equal(editorNodeStyles(node, "mobile").fontSize, 34);
});
test("17 Move Down changes section order and preserves IDs", () => {
  const next = moveEditorSection(document, "hero", "down");
  assert.deepEqual(next.sections.map((section) => section.id), ["content", "hero"]);
  assert.deepEqual(next.sections.map((section) => section.order), [0, 1]);
});
test("18 section movement boundaries are disabled", () => {
  assert.deepEqual(sectionMoveAvailability(document, "hero"), { canMoveUp: false, canMoveDown: true });
  assert.deepEqual(sectionMoveAvailability(document, "content"), { canMoveUp: true, canMoveDown: false });
});
test("19 undo restores previous document", () => {
  let state = loadedState();
  state = siteEditorReducer(state, { type: "mutate-document", document: updateEditorText(document, "heading", "Changed") });
  state = siteEditorReducer(state, { type: "undo" });
  assert.equal(findEditorNode(currentSiteEditorDocument(state), "heading").node.content.text, "iCare");
});
test("20 redo restores reverted mutation", () => {
  let state = loadedState();
  state = siteEditorReducer(state, { type: "mutate-document", document: updateEditorText(document, "heading", "Changed") });
  state = siteEditorReducer(siteEditorReducer(state, { type: "undo" }), { type: "redo" });
  assert.equal(findEditorNode(currentSiteEditorDocument(state), "heading").node.content.text, "Changed");
});
test("21 new edits clear redo history", () => {
  let state = loadedState();
  state = siteEditorReducer(state, { type: "mutate-document", document: updateEditorText(document, "heading", "One") });
  state = siteEditorReducer(state, { type: "undo" });
  state = siteEditorReducer(state, { type: "mutate-document", document: updateEditorText(document, "heading", "Two") });
  assert.equal(state.history.future.length, 0);
});
test("22 Save is disabled while clean", () => assert.match(topbarSource, /state\.isDirty[\s\S]*?saveEnabled/));
test("23 a mutation marks the document dirty", () => {
  const state = siteEditorReducer(loadedState(), { type: "mutate-document", document: updateEditorText(document, "heading", "Changed") });
  assert.equal(state.isDirty, true);
});
test("24 successful save updates revision and clears dirty", () => {
  let state = siteEditorReducer(loadedState(), { type: "mutate-document", document: updateEditorText(document, "heading", "Changed") });
  state = siteEditorReducer(state, { type: "save-success", document: { ...currentSiteEditorDocument(state), revision: 1 }, revision: 1 });
  assert.equal(state.isDirty, false); assert.equal(state.currentRevision, 1); assert.equal(state.saveStatus, "saved");
});
test("25 failed save keeps dirty state", () => {
  let state = siteEditorReducer(loadedState(), { type: "mutate-document", document: updateEditorText(document, "heading", "Changed") });
  state = siteEditorReducer(state, { type: "save-failure", error: "offline" });
  assert.equal(state.isDirty, true); assert.equal(state.saveStatus, "error");
});
test("26 revision conflict is explicit", () => {
  const state = siteEditorReducer(loadedState(), { type: "save-failure", conflict: true, error: "conflict" });
  assert.equal(state.saveStatus, "conflict");
});
test("27 dirty page switch requires confirmation", () => assert.match(pageSource, /unsaved changes[\s\S]*?confirm/i));
test("28 beforeunload is attached only while dirty", () => assert.match(pageSource, /if \(!state\.isDirty\) return;[\s\S]*?beforeunload/));
test("29 Publish remains disabled", () => assert.match(topbarSource, /site-editor-publish[\s\S]*?disabled/));
test("30 cross-tenant pages and platform context are rejected", () => {
  assert.equal(normalizeSiteEditorPage({ ...page, tenantId: "eb-chemical" }, "icare"), null);
  assert.equal(siteEditorCapabilities({ role: "super_admin" }, null).canEdit, false);
});
test("31 arbitrary company and domain inputs are not API inputs", () => {
  assert.doesNotMatch(apiSource, /companyId|company_id|X-Company-Id/);
  assert.equal(trustedSitePreview({ ...company, storefrontUrl: "javascript:alert(1)" }), null);
  assert.equal(trustedPagePreview(company, { ...page, tenantId: "eb-chemical" }), null);
});
test("32 existing protected routing and localization remain intact", () => {
  assert.equal(getNavigationItem("admin-site-editor")?.path, "/admin/site-editor");
  assert.equal(canAccessAdminPage(admin, "admin-site-editor"), true);
  assert.equal(hasPermission(admin, "site_editor.access"), true);
  assert.equal(resolvePage("/admin/site-editor", admin), "admin-site-editor");
  assert.equal(siteEditorDirection("ar"), "rtl");
  assert.equal(siteEditorTools.length, 11);
  assert.match(appSource, /activePage === "admin-site-editor"[\s\S]*?<SiteEditorPage/);
  assert.match(editableSource, /ElementContextToolbar/);
});

test("safe image settings and button links update only content", () => {
  const image = updateEditorImageSettings(document, "image", { alt: "Updated alt", link: "https://igroup.website/icare" });
  assert.equal(findEditorNode(image, "image").node.content.alt, "Updated alt");
  const button = updateEditorLink(document, "button", "/icare/shop");
  assert.equal(findEditorNode(button, "button").node.content.link, "/icare/shop");
});

test("33 any connected tenant can edit without iCare hardcoding", () => {
  const brandCompany = { id: "another-brand", slug: "another-brand", name: "Another Brand", storefrontUrl: "https://another-brand.example" };
  const brandPage = { id: "catalog", tenantId: "another-brand", title: "Catalog", pageType: "standard", previewPath: "/catalog", routePattern: "/catalog", status: "source", isEditable: true };
  assert.equal(normalizeSiteEditorPage(brandPage, "another-brand")?.id, "catalog");
  assert.equal(normalizeSiteEditorPage({ ...brandPage, tenantId: "icare" }, "another-brand"), null);
  const brandAdmin = { role: "company_admin", permissions: [] };
  assert.deepEqual(siteEditorCapabilities(brandAdmin, brandCompany), { canAccess: true, canEdit: true, canSave: true });
  assert.equal(trustedSitePreview(brandCompany), "https://another-brand.example/");
  assert.equal(trustedPagePreview(brandCompany, brandPage), "https://another-brand.example/");
  assert.equal(trustedSitePreview({ ...brandCompany, id: "icare" }), "https://another-brand.example/");
});

test("34 editor copy no longer names a specific tenant", () => {
  assert.equal(siteEditorText("pages.description", "en"), "Choose a page to edit in the canvas.");
  assert.doesNotMatch(pageSource, /iCare|icare/);
  assert.doesNotMatch(pagesSource, /iCare|icare/);
});

const connectionSource = read("../src/components/site-editor/WebsiteConnectionScreen.jsx");

test("35 connection screen appears when the company has no connected website", () => {
  assert.match(pageSource, /fetchSiteEditorConnection/);
  assert.match(pageSource, /connectionStatus !== "ready"/);
  assert.match(pageSource, /connectionStatus === "ready" && !connected[\s\S]*?WebsiteConnectionScreen/);
  assert.match(pageSource, /connection\?\.hasManifest === true/);
});

test("36 connection screen uses only the generic connection endpoints", () => {
  assert.match(apiSource, /"\/site-editor\/connection", { cache: "no-store" }/);
  assert.match(apiSource, /"\/site-editor\/connection", \{\s*method: "PUT"/);
  assert.match(apiSource, /"\/site-editor\/connection\/validate", \{\s*method: "POST"/);
  assert.match(apiSource, /"\/site-editor\/manifest\/sync", \{\s*method: "POST"/);
  assert.doesNotMatch(apiSource, /companyId|company_id|X-Company-Id/);
  assert.doesNotMatch(connectionSource, /companyId|company_id/);
});

test("37 connection form exposes the generic website fields", () => {
  for (const marker of ["storefrontBaseUrl", "siteManifestUrl", "siteId", "defaultLocale", "supportedLocales"]) {
    assert.match(connectionSource, new RegExp(marker));
  }
  assert.match(connectionSource, /\/api\/site-manifest/);
  assert.match(connectionSource, /validateSiteEditorConnection\(url\)/);
  assert.match(connectionSource, /syncSiteEditorManifest\(url\)/);
  assert.match(connectionSource, /updateSiteEditorConnection\(/);
});

test("38 connection actions are the generic validate, connect, and resync flow", () => {
  for (const marker of ["connection.validate", "connection.connectSync", "connection.resync"]) {
    assert.match(connectionSource, new RegExp(marker));
  }
  assert.match(connectionSource, /type="submit"/);
  assert.match(connectionSource, /busy === "validate"/);
  assert.match(connectionSource, /busy === "connect"/);
  assert.match(connectionSource, /busy === "resync"/);
});

test("39 connection screen shows status, last sync, and validation outcome", () => {
  for (const marker of ["connection.lastSync", "connection.pending", "site-editor-connection-status", "site-editor-connection-notice"]) {
    assert.match(connectionSource, new RegExp(marker));
  }
  assert.match(connectionSource, /lastManifestSyncAt/);
  assert.match(connectionSource, /connectionError/);
});

test("40 connection CSS is scoped and responsive", () => {
  assert.match(cssSource, /\.site-editor-connection /);
  assert.match(cssSource, /site-editor-connection-card/);
  assert.match(cssSource, /@media \(max-width: 820px\)/);
});

test("41 connection copy is localized for English and Arabic", () => {
  assert.equal(siteEditorText("connection.title", "en"), "Connect your website");
  assert.equal(siteEditorText("connection.title", "ar"), "اربط موقعك");
  assert.equal(siteEditorText("connection.connectSync", "en"), "Connect and Sync");
  assert.equal(siteEditorText("connection.resync", "ar"), "أعد مزامنة البيان");
  assert.equal(siteEditorText("connection.siteManifestUrlHint", "en"), "Defaults to {url}");
});

const quickEditSectionSource = read("../src/components/site-editor/EditableSection.jsx");
const quickEditPanelSource = read("../src/components/site-editor/QuickEditPanel.jsx");
const quickEditSource = read("../src/utils/siteEditorQuickEdit.js");

const quickSection = {
  id: "hero", type: "hero", order: 0,
  settings: { contentAlignment: "end", sourceComponent: "app/icare/components/Hero.tsx" },
  styles: { backgroundColor: "#f4f1eb", paddingBlock: 48, paddingInline: 40, contentAlignment: "start" },
  responsive: {},
  elements: [
    { id: "heading", type: "heading", content: { text: "iCare" }, settings: { editableProperties: ["content", "styles", "responsive"] }, styles: { alignment: "start" }, responsive: {}, children: [] },
    { id: "btn", type: "button", content: { label: "Shop", link: "/icare/shop" }, settings: { editableProperties: ["content"] }, styles: {}, responsive: {}, children: [] },
    { id: "img", type: "image", content: { src: "/uploads/hero.jpg", alt: "hero", link: "" }, settings: { editableProperties: ["content", "styles"] }, styles: {}, responsive: {}, children: [] },
    { id: "collection", type: "productCollection", content: { source: "featured", limit: 10 }, settings: { editableProperties: [] }, styles: {}, responsive: {}, children: [] },
    { id: "list", type: "list", content: { items: ["mission", "philanthropy"] }, settings: { editableProperties: [] }, styles: {}, responsive: {}, children: [] },
    { id: "wrap", type: "container", content: {}, settings: { editableProperties: ["styles"] }, styles: { backgroundColor: "#fff", width: 46 }, responsive: {}, children: [] },
  ],
};

function fieldOf(fields, nodeId, labelKey) {
  return fields.find((field) => field.nodeId === nodeId && field.labelKey === labelKey);
}

test("42 quick edit honors editableProperties and read-only mode", () => {
  assert.equal(quickEditNodeEditable({ settings: { editableProperties: ["content"] } }), true);
  assert.equal(quickEditNodeEditable({ settings: { editableProperties: [] } }), false);
  assert.equal(quickEditNodeEditable({ editable: false, settings: {} }), false);
  assert.equal(quickEditNodeEditable({ settings: {} }), true);
  assert.equal(quickEditPropertyEditable({ settings: { editableProperties: ["content"] } }, "styles"), false);
  assert.equal(quickEditPropertyEditable({ settings: { editableProperties: ["content"] } }, "content", true), false);
});

test("43 quick edit field generation covers section styling", () => {
  const fields = quickEditSectionFields(quickSection);
  const background = fieldOf(fields, "hero", "quickEdit.sectionBackground");
  assert.equal(background.kind, "color");
  assert.equal(background.styleKey, "backgroundColor");
  assert.equal(background.nodeType, "section");
  assert.equal(background.value, "#f4f1eb");
  const spacing = fieldOf(fields, "hero", "quickEdit.spacingVertical");
  assert.equal(spacing.styleKey, "paddingBlock");
  assert.equal(spacing.value, 48);
  const alignment = fieldOf(fields, "hero", "quickEdit.contentAlignment");
  assert.equal(alignment.styleKey, "contentAlignment");
  assert.equal(alignment.value, "start");
});

test("44 quick edit covers heading, button, and image content", () => {
  const fields = quickEditSectionFields(quickSection);
  const heading = fieldOf(fields, "heading", "quickEdit.title");
  assert.equal(heading.kind, "textarea");
  assert.equal(heading.contentKey, "text");
  assert.equal(heading.value, "iCare");
  const label = fieldOf(fields, "btn", "quickEdit.button");
  assert.equal(label.kind, "text");
  assert.equal(label.contentKey, "label");
  const link = fieldOf(fields, "btn", "quickEdit.link");
  assert.equal(link.kind, "link");
  assert.equal(link.contentKey, "link");
  const image = fieldOf(fields, "img", "quickEdit.image");
  assert.equal(image.kind, "image");
  assert.equal(image.value, "/uploads/hero.jpg");
  assert.equal(fieldOf(fields, "img", "quickEdit.alt").contentKey, "alt");
  assert.equal(fieldOf(fields, "img", "quickEdit.link").nodeType, "image");
});

test("45 quick edit never copies collection or list content into the document", () => {
  const fields = quickEditSectionFields(quickSection);
  const collection = fieldOf(fields, "collection", "quickEdit.products");
  assert.equal(collection.kind, "collection");
  assert.equal(collection.editable, false);
  assert.equal(collection.source, "featured");
  assert.equal(collection.limit, 10);
  assert.equal(collection.contentKey, undefined);
  assert.equal(collection.styleKey, undefined);
  const list = fieldOf(fields, "list", "quickEdit.list");
  assert.deepEqual(list.items, ["mission", "philanthropy"]);
  assert.equal(list.contentKey, "items");
  assert.equal(list.editable, false);
});

test("46 read-only mode disables every editable quick field", () => {
  const fields = quickEditSectionFields(quickSection, { readOnly: true });
  assert.equal(fieldOf(fields, "hero", "quickEdit.sectionBackground").editable, false);
  assert.equal(fieldOf(fields, "heading", "quickEdit.title").editable, false);
  assert.equal(fieldOf(fields, "btn", "quickEdit.button").editable, false);
  assert.equal(fieldOf(fields, "img", "quickEdit.alt").editable, false);
});

test("47 restricted properties and container fields are respected", () => {
  const fields = quickEditSectionFields(quickSection);
  assert.equal(fieldOf(fields, "btn", "quickEdit.alignment"), undefined);
  assert.equal(fieldOf(fields, "wrap", "quickEdit.background").styleKey, "backgroundColor");
  assert.equal(fieldOf(fields, "wrap", "quickEdit.width").value, 46);
});

test("48 open quick edit selects the section and clears the inspector", () => {
  let state = loadedState();
  state = siteEditorReducer(state, { type: "open-quick-edit", sectionId: "hero" });
  assert.equal(state.quickEdit, "hero");
  assert.equal(state.selectedSectionId, "hero");
  assert.equal(state.selectedNodeId, "hero");
  assert.equal(state.activeInspector, null);
});

test("49 closing quick edit keeps the section selection", () => {
  let state = siteEditorReducer(loadedState(), { type: "open-quick-edit", sectionId: "hero" });
  state = siteEditorReducer(state, { type: "close-quick-edit" });
  assert.equal(state.quickEdit, null);
  assert.equal(state.selectedSectionId, "hero");
});

test("50 inspector and clear-selection close quick edit (mutex)", () => {
  let state = siteEditorReducer(loadedState(), { type: "open-quick-edit", sectionId: "hero" });
  state = siteEditorReducer(state, { type: "set-inspector", inspector: "heading" });
  assert.equal(state.quickEdit, null);
  assert.equal(state.activeInspector, "heading");
  state = siteEditorReducer(loadedState(), { type: "open-quick-edit", sectionId: "hero" });
  state = siteEditorReducer(state, { type: "clear-selection" });
  assert.equal(state.quickEdit, null);
  assert.equal(state.selectedSectionId, null);
});

test("51 selection while quick edit is open follows the section without reopening the inspector", () => {
  let state = siteEditorReducer(loadedState(), { type: "open-quick-edit", sectionId: "hero" });
  state = siteEditorReducer(state, { type: "select-node", nodeId: "heading", sectionId: "hero", inspector: null });
  assert.equal(state.quickEdit, "hero");
  assert.equal(state.selectedNodeId, "heading");
  assert.equal(state.activeInspector, null);
  state = siteEditorReducer(state, { type: "select-node", nodeId: "heading", sectionId: "hero", inspector: "style" });
  assert.equal(state.quickEdit, null);
  assert.equal(state.activeInspector, "style");
});

test("52 sections render a Quick Edit trigger that opens the panel", () => {
  assert.match(quickEditSectionSource, /site-editor-quick-edit-trigger/);
  assert.match(quickEditSectionSource, /onAction\("quick-edit", section\)/);
  assert.match(quickEditSectionSource, /event\.stopPropagation\(\)[\s\S]*?onAction\("quick-edit", section\)/);
  assert.match(pageSource, /open-quick-edit[\s\S]*?sectionId: node\.id/);
});

test("53 Escape ordering closes quick edit before clearing selection", () => {
  assert.match(pageSource, /if \(state\.editingNodeId\) dispatch\(\{ type: "set-editing-node", nodeId: null \}\)/);
  assert.match(pageSource, /else if \(state\.quickEdit\) dispatch\(\{ type: "close-quick-edit" \}\)/);
  assert.match(pageSource, /else dispatch\(\{ type: "clear-selection" \}\)/);
});

test("54 the quick edit panel renders per-field attributes and read-only badges", () => {
  assert.match(quickEditPanelSource, /data-quick-edit-node-id=\{field\.nodeId\}/);
  assert.match(quickEditPanelSource, /quickEdit\.panelTitle/);
  assert.match(quickEditPanelSource, /quickEdit\.readOnly/);
  assert.match(quickEditPanelSource, /quickEdit\.change/);
  assert.match(quickEditPanelSource, /scrollIntoView/);
  assert.match(quickEditPanelSource, /quickEditSectionFields/);
});

test("55 the page renders the quick edit panel in the resizing workspace column", () => {
  assert.match(pageSource, /<QuickEditPanel/);
  assert.match(pageSource, /quickEditSection && quickEditSection\.kind === "section"/);
  assert.match(pageSource, /quick-edit-open/);
  assert.match(cssSource, /\.site-editor-workspace\.quick-edit-open/);
  assert.match(cssSource, /\.site-editor-quick-edit-panel/);
  assert.match(cssSource, /\.site-editor-editable-section:hover/);
  assert.match(cssSource, /\.site-editor-quick-edit-trigger/);
});

test("56 quick edit copy is bilingual", () => {
  assert.equal(siteEditorText("quickEdit.panelTitle", "en"), "Quick Edit");
  assert.equal(siteEditorText("quickEdit.panelTitle", "ar"), "تعديل سريع");
  assert.equal(siteEditorText("quickEdit.sectionBackground", "ar"), "خلفية القسم");
  assert.equal(siteEditorText("quickEdit.change", "ar"), "تغيير");
  assert.equal(siteEditorText("quickEdit.title", "en"), "Title");
  assert.equal(siteEditorText("quickEdit.readOnly", "ar"), "للعرض فقط");
});

test("57 real section selection follows a new section when switching", () => {
  let state = loadedState();
  state = siteEditorReducer(state, { type: "open-quick-edit", sectionId: "hero" });
  state = siteEditorReducer(state, { type: "select-node", nodeId: "content", sectionId: "content", inspector: null });
  assert.equal(state.quickEdit, "content");
  assert.equal(state.selectedNodeId, "content");
  assert.equal(state.selectedSectionId, "content");
});

test("58 clicking an element keeps the parent quick edit panel open", () => {
  let state = loadedState();
  state = siteEditorReducer(state, { type: "open-quick-edit", sectionId: "hero" });
  state = siteEditorReducer(state, { type: "select-node", nodeId: "heading", sectionId: "hero", inspector: null });
  assert.equal(state.quickEdit, "hero");
  assert.equal(state.selectedNodeId, "heading");
  assert.equal(state.selectedSectionId, "hero");
  assert.equal(state.activeInspector, null);
});

test("59 a non-editable section disables every descendant field", () => {
  const locked = {
    ...quickSection,
    editable: false,
    elements: quickSection.elements.map((element) => ({ ...element, editable: true })),
  };
  const fields = quickEditSectionFields(locked);
  assert.equal(fieldOf(fields, "hero", "quickEdit.sectionBackground").editable, false);
  assert.equal(fieldOf(fields, "heading", "quickEdit.title").editable, false);
  assert.equal(fieldOf(fields, "btn", "quickEdit.button").editable, false);
  assert.equal(fieldOf(fields, "img", "quickEdit.image").editable, false);
});

test("60 quick edit labels and badges are localized before rendering", () => {
  assert.match(quickEditPanelSource, /siteEditorText\(field\.labelKey, language\)/);
  assert.match(quickEditPanelSource, /siteEditorText\("quickEdit\.readOnly", language\)/);
  assert.match(quickEditPanelSource, /siteEditorText\("quickEdit\.change", language\)/);
  assert.equal(siteEditorText("quickEdit.limit", "ar"), "الحد");
  assert.equal(siteEditorText("quickEdit.order", "ar"), "الترتيب");
  assert.equal(siteEditorText("quickEdit.element", "en"), "Element");
});

test("61 draft fields commit on blur and reset on external value changes", () => {
  assert.match(quickEditPanelSource, /useDraftCommit/);
  assert.match(quickEditPanelSource, /externalValue !== syncedRef\.current/);
  assert.match(quickEditPanelSource, /onBlur=\{commit\}/);
  assert.match(quickEditPanelSource, /DraftText|DraftArea|DraftListItem/);
});

test("62 button label and link remain independent", () => {
  const relabeled = updateEditorText(document, "button", "Buy now");
  assert.equal(findEditorNode(relabeled, "button").node.content.label, "Buy now");
  assert.equal(findEditorNode(relabeled, "button").node.content.link, "/icare/shop");
  const relinked = updateEditorLink(document, "button", "/icare/new");
  assert.equal(findEditorNode(relinked, "button").node.content.link, "/icare/new");
  assert.equal(findEditorNode(relinked, "button").node.content.label, "Shop");
});

test("63 structured list edits stay an array of strings", () => {
  const next = updateEditorContentList(document, "list", ["care", "science", "  "]);
  const items = findEditorNode(next, "list")?.node?.content?.items;
  assert.deepEqual(items, ["care", "science"]);
  const cleared = updateEditorContentList(next, "list", []);
  assert.deepEqual(findEditorNode(cleared, "list").node.content.items, []);
});

test("64 collection summaries surface source, limit, and order", () => {
  const fields = quickEditSectionFields(quickSection);
  const collection = fieldOf(fields, "collection", "quickEdit.products");
  assert.equal(collection.source, "featured");
  assert.equal(collection.limit, 10);
  assert.ok("order" in collection);
  assert.match(quickEditPanelSource, /quickEdit\.limit/);
  assert.match(quickEditPanelSource, /quickEdit\.order/);
});

test("65 hovering a section never opens the panel", () => {
  assert.match(quickEditSectionSource, /onAction\("quick-edit", section\)/);
  assert.doesNotMatch(quickEditSectionSource, /onMouseEnter|onMouseOver/);
});

test("66 hover reveals the section label alongside the quick edit trigger", () => {
  assert.match(quickEditSectionSource, /site-editor-section-label/);
  assert.match(cssSource, /\.site-editor-section-label/);
  assert.match(cssSource, /\.site-editor-editable-section:hover > \.site-editor-section-label/);
});

test("67 quick edit positioning uses logical start properties for LTR and RTL", () => {
  assert.match(cssSource, /\.site-editor-quick-edit-trigger \{[\s\S]*?inset-inline-start: 12px/);
  assert.doesNotMatch(cssSource, /\.site-editor-quick-edit-trigger \{[\s\S]*?(?:left|right): 12px/);
});

test("68 quick edit and the style inspector are mutually exclusive in both directions", () => {
  let state = loadedState();
  state = siteEditorReducer(state, { type: "set-inspector", inspector: "heading" });
  state = siteEditorReducer(state, { type: "open-quick-edit", sectionId: "hero" });
  assert.equal(state.activeInspector, null);
  assert.equal(state.quickEdit, "hero");
  state = siteEditorReducer(state, { type: "set-inspector", inspector: "copy" });
  assert.equal(state.quickEdit, null);
  assert.equal(state.activeInspector, "copy");
});

test("69 quick edit leaves the save and revision flow unchanged", () => {
  let state = loadedState();
  state = siteEditorReducer(state, { type: "open-quick-edit", sectionId: "hero" });
  state = siteEditorReducer(state, { type: "mutate-document", document: updateEditorText(document, "heading", "Changed") });
  state = siteEditorReducer(state, { type: "save-success", document: { ...currentSiteEditorDocument(state), revision: 2 }, revision: 2 });
  assert.equal(state.quickEdit, "hero");
  assert.equal(state.isDirty, false);
  assert.equal(state.currentRevision, 2);
  assert.equal(state.history.past.length, 0);
});

test("70 a section background image is presented read-only until an editable binding exists", () => {
  const withBackground = { ...quickSection, settings: { ...quickSection.settings, backgroundImage: "/uploads/hero-bg.jpg" } };
  const fields = quickEditSectionFields(withBackground);
  const background = fieldOf(fields, "hero", "quickEdit.backgroundImage");
  assert.equal(background.kind, "image");
  assert.equal(background.editable, false);
  assert.equal(background.readOnly, true);
  assert.equal(background.value, "/uploads/hero-bg.jpg");
});

test("71 the page wires list commits through the structured content helper", () => {
  assert.match(pageSource, /updateEditorContentList/);
  assert.match(pageSource, /onList=\{\(nodeId, items\)/);
});

const sectionLibrarySource = read("../src/utils/siteEditorSectionLibrary.js");
const railSource = read("../src/components/site-editor/SiteEditorRail.jsx");
const panelSource = read("../src/components/site-editor/SectionLibraryPanel.jsx");
const templateCardSource = read("../src/components/site-editor/SectionTemplateCard.jsx");
const categoryListSource = read("../src/components/site-editor/SectionCategoryList.jsx");
const insertControlsSource = read("../src/components/site-editor/SectionInsertControls.jsx");

const sectionLibrary = {
  version: "1",
  blankSection: { enabled: true, sectionType: "content" },
  categories: [
    { id: "welcome", title: { en: "Welcome", ar: "ترحيب" }, icon: "home", order: 0 },
    { id: "store", title: { en: "Store", ar: "المتجر" }, icon: "shopping-bag", order: 1 },
  ],
  templates: [
    {
      templateId: "hero-overlay",
      categoryId: "welcome",
      sectionType: "hero",
      layoutVariant: "overlay",
      title: { en: "Hero with Image Overlay", ar: "ترحيب بصورة خلفية" },
      description: { en: "Full-bleed image with centered copy", ar: "صورة بعرض كامل مع نص في المنتصف" },
      thumbnail: "https://igroup.website/media/templates/hero-overlay.jpg",
      pageTypes: ["standard", "dynamic"],
      capabilities: { requiresProducts: false, requiresMedia: true },
      defaultSectionDocument: {
        id: "hero-overlay-section",
        sectionType: "hero",
        order: 0,
        editable: true,
        layout: { sourceComponent: "app/icare/components/Hero.tsx", contentAlignment: "center" },
        responsive: {},
        elements: [
          { id: "hero-overlay-image", elementType: "image", order: 0, editable: false, content: { en: { src: "https://igroup.website/media/icare-hero.jpg", alt: "hero" }, ar: { src: "https://igroup.website/media/icare-hero.jpg", alt: "ترحيب" } }, source: { type: "media", key: "hero" }, styles: { width: 100 }, responsive: {}, validation: {}, editableProperties: [], children: [] },
          { id: "hero-overlay-content", elementType: "container", order: 1, editable: true, content: {}, source: null, styles: {}, responsive: {}, validation: {}, editableProperties: ["styles"], children: [
            { id: "hero-overlay-heading", elementType: "heading", order: 0, editable: true, content: { en: { text: "the barrier butter." }, ar: { text: "زبدة الحاجز." } }, source: null, styles: { alignment: "center" }, responsive: {}, validation: {}, editableProperties: ["content"], children: [] },
          ] },
        ],
      },
    },
    {
      templateId: "store-grid",
      categoryId: "store",
      sectionType: "productCollection",
      layoutVariant: "grid",
      title: { en: "Product Grid", ar: "شبكة المنتجات" },
      description: { en: "A responsive grid of products", ar: "شبكة منتجات متجاوبة" },
      thumbnail: "https://igroup.website/media/templates/store-grid.jpg",
      pageTypes: ["standard"],
      capabilities: { requiresProducts: true, requiresMedia: false },
      defaultSectionDocument: {
        id: "store-grid-section",
        sectionType: "productCollection",
        order: 0,
        editable: true,
        layout: { sourceComponent: "app/icare/components/ProductShowcase.tsx" },
        responsive: {},
        elements: [
          { id: "store-grid-collection", elementType: "productCollection", order: 0, editable: false, content: { source: "featured", limit: 8 }, source: { type: "collection", key: "featured" }, styles: {}, responsive: {}, validation: {}, editableProperties: [], children: [] },
        ],
      },
    },
  ],
};

const standardPage = { ...page, pageType: "standard" };

test("72 section library categories normalize in declared order", () => {
  assert.deepEqual(sectionLibraryCategories(sectionLibrary).map((category) => category.id), ["welcome", "store"]);
  assert.deepEqual(sectionLibraryCategories(null), []);
  assert.equal(sectionLibraryCategoryKey("welcome"), "addSection.category.welcome");
  assert.equal(sectionLibraryCategoryKey("unknown"), null);
});

test("73 templates filter by the current page type", () => {
  assert.deepEqual(sectionTemplatesForCategory(sectionLibrary, standardPage, "welcome").map((template) => template.templateId), ["hero-overlay"]);
  assert.deepEqual(sectionTemplatesForCategory(sectionLibrary, standardPage, "store").map((template) => template.templateId), ["store-grid"]);
  assert.equal(sectionTemplatesForCategory(sectionLibrary, { ...standardPage, pageType: "system" }, "store").length, 0);
  assert.equal(sectionTemplatesForCategory(null, standardPage, "welcome").length, 0);
});

test("74 blank section honors the library blankSection flag", () => {
  assert.deepEqual(sectionLibraryBlank(sectionLibrary), { enabled: true, sectionType: "content" });
  assert.equal(blankSectionTemplate(sectionLibrary).templateId, "blank");
  assert.equal(blankSectionTemplate({ ...sectionLibrary, blankSection: { enabled: false } }), null);
});

test("75 template labels and descriptions are localized", () => {
  const template = sectionLibrary.templates[0];
  assert.equal(templateLabel(template, "en"), "Hero with Image Overlay");
  assert.equal(templateLabel(template, "ar"), "ترحيب بصورة خلفية");
  assert.equal(templateLabel({ ...template, title: { ar: "بدون إنجليزية" } }, "en"), "بدون إنجليزية");
  assert.equal(templateLabel({ templateId: "bare" }, "en"), "bare");
  assert.equal(templateDescription(template, "ar"), "صورة بعرض كامل مع نص في المنتصف");
  assert.equal(templateDescription({ title: {} }, "en"), "");
});

test("76 insert positions are validated", () => {
  assert.equal(validSectionInsertPosition("before"), "before");
  assert.equal(validSectionInsertPosition("end"), "end");
  assert.equal(validSectionInsertPosition("sideways"), "after");
});

test("77 inserting a template creates a new section after the target", () => {
  const result = insertSectionAtTarget(document, sectionLibrary.templates[0], { position: "after", targetSectionId: "hero" });
  const next = result.document;
  assert.equal(next.sections.length, 3);
  assert.deepEqual(next.sections.map((section) => section.id), ["hero", result.sectionId, "content"]);
  assert.deepEqual(next.sections.map((section) => section.order), [0, 1, 2]);
  const inserted = next.sections[1];
  assert.equal(result.sectionId, inserted.id);
  assert.equal(inserted.type, "hero");
  assert.match(inserted.id, /^hero-overlay-[a-z0-9]{4,8}$/);
  assert.equal(inserted.editable, true);
  assert.equal(inserted.settings.sourceComponent, "app/icare/components/Hero.tsx");
  assert.equal(inserted.elements.length, 2);
  assert.equal(inserted.elements[0].type, "image");
  assert.equal(inserted.elements[0].editable, false);
  assert.equal(inserted.elements[0].settings.sourceBinding.key, "hero");
  assert.equal(inserted.elements[1].children[0].type, "heading");
  assert.equal(inserted.elements[1].children[0].content.text, "the barrier butter.");
  assert.match(inserted.elements[1].children[0].id, /^hero-overlay-heading-/);
});

test("78 inserting before and at the end positions correctly", () => {
  const before = insertSectionAtTarget(document, sectionLibrary.templates[0], { position: "before", targetSectionId: "content" });
  assert.deepEqual(before.document.sections.map((section) => section.id).slice(0, 3), ["hero", before.sectionId, "content"]);
  const end = insertSectionAtTarget(document, sectionLibrary.templates[0], { position: "end" });
  assert.equal(end.document.sections.at(-1).type, "hero");
  const fallback = insertSectionAtTarget(document, sectionLibrary.templates[0], { position: "after", targetSectionId: "missing" });
  assert.equal(fallback.document.sections.length, 3);
  assert.equal(fallback.document.sections.at(-1).type, "hero");
});

test("79 repeated inserts never reuse template or element ids", () => {
  const once = insertSectionAtTarget(document, sectionLibrary.templates[0], { position: "end" });
  const twice = insertSectionAtTarget(once.document, sectionLibrary.templates[0], { position: "end" });
  assert.equal(twice.document.sections.length, 4);
  const inserted = twice.document.sections.slice(-2);
  assert.notEqual(inserted[0].id, inserted[1].id);
  assert.notEqual(inserted[0].elements[0].id, inserted[1].elements[0].id);
  const ids = new Set();
  for (const section of twice.document.sections) {
    assert.ok(!ids.has(section.id), `duplicate section id ${section.id}`);
    ids.add(section.id);
    const visit = (node) => {
      assert.ok(!ids.has(node.id), `duplicate node id ${node.id}`);
      ids.add(node.id);
      (node.children || []).forEach(visit);
    };
    (section.elements || []).forEach(visit);
  }
});

test("80 blank insert creates an empty section with a fresh id", () => {
  const result = insertSectionAtTarget(document, blankSectionTemplate(sectionLibrary), { position: "end" });
  const next = result.document;
  const inserted = next.sections.at(-1);
  assert.equal(inserted.type, "content");
  assert.match(inserted.id, /^section-[a-z0-9]{4,8}$/);
  assert.equal(result.sectionId, inserted.id);
  assert.deepEqual(inserted.elements, []);
  assert.equal(next.sections.length, 3);
});

test("81 insert ignores missing documents or templates", () => {
  assert.equal(insertSectionAtTarget(null, sectionLibrary.templates[0], {}), null);
  assert.equal(insertSectionAtTarget(document, null, {}).sectionId, null);
  assert.equal(insertSectionAtTarget(document, undefined, {}).document, document);
});

test("82 inserted elements localize content to the active locale", () => {
  const ar = insertSectionAtTarget(document, sectionLibrary.templates[0], { position: "end", locale: "ar" });
  const inserted = ar.document.sections.at(-1);
  assert.equal(inserted.elements[0].content.alt, "ترحيب");
  assert.equal(inserted.elements[1].children[0].content.text, "زبدة الحاجز.");
  const en = insertSectionAtTarget(document, sectionLibrary.templates[0], { position: "end", locale: "en" });
  assert.equal(en.document.sections.at(-1).elements[0].content.alt, "hero");
});

test("83 inserting a template marks dirty, closes the panel, and opens quick edit", () => {
  let state = loadedState();
  state = siteEditorReducer(state, { type: "open-section-library" });
  state = siteEditorReducer(state, { type: "section-library-success", sectionLibrary });
  state = siteEditorReducer(state, { type: "select-section-category", categoryId: "welcome" });
  state = siteEditorReducer(state, { type: "select-section-template", templateId: "hero-overlay" });
  state = siteEditorReducer(state, { type: "insert-section-template", section: sectionLibrary.templates[0] });
  assert.equal(state.isDirty, true);
  assert.equal(state.activePanel, null);
  assert.equal(state.quickEdit, state.selectedNodeId);
  assert.equal(state.selectedSectionId, state.selectedNodeId);
  const inserted = findEditorNode(currentSiteEditorDocument(state), state.selectedNodeId);
  assert.equal(inserted.node.type, "hero");
  assert.equal(state.history.past.length, 1);
});

test("84 a disabled blank section makes the blank insert a no-op", () => {
  let state = loadedState();
  state = siteEditorReducer(state, { type: "section-library-success", sectionLibrary: { ...sectionLibrary, blankSection: { enabled: false } } });
  const before = currentSiteEditorDocument(state);
  const next = siteEditorReducer(state, { type: "insert-section-template", section: null });
  assert.equal(currentSiteEditorDocument(next), before);
  assert.equal(next.isDirty, false);
});

test("85 opening the add-section panel clears quick edit and inspector; toggling closes it", () => {
  let state = siteEditorReducer(loadedState(), { type: "open-quick-edit", sectionId: "hero" });
  state = siteEditorReducer(state, { type: "toggle-panel", panel: "add-section" });
  assert.equal(state.activePanel, "add-section");
  assert.equal(state.quickEdit, null);
  assert.equal(state.activeInspector, null);
  state = siteEditorReducer(state, { type: "toggle-panel", panel: "add-section" });
  assert.equal(state.activePanel, null);
});

test("86 category and template selection state updates", () => {
  let state = siteEditorReducer(loadedState(), { type: "open-section-library" });
  state = siteEditorReducer(state, { type: "section-library-success", sectionLibrary });
  assert.equal(state.activeSectionCategory, "welcome");
  state = siteEditorReducer(state, { type: "select-section-category", categoryId: "store" });
  assert.equal(state.activeSectionCategory, "store");
  assert.equal(state.selectedSectionTemplate, null);
  state = siteEditorReducer(state, { type: "select-section-template", templateId: "store-grid" });
  assert.equal(state.selectedSectionTemplate, "store-grid");
  state = siteEditorReducer(state, { type: "set-section-insert-position", position: "sideways" });
  assert.equal(state.sectionInsertPosition, "after");
  state = siteEditorReducer(state, { type: "set-section-insert-position", position: "before" });
  assert.equal(state.sectionInsertPosition, "before");
});

test("87 undo restores the pre-insert document and redo reapplies it", () => {
  let state = loadedState();
  state = siteEditorReducer(state, { type: "section-library-success", sectionLibrary });
  state = siteEditorReducer(state, { type: "insert-section-template", section: sectionLibrary.templates[0] });
  const insertedId = state.selectedNodeId;
  state = siteEditorReducer(state, { type: "undo" });
  assert.equal(currentSiteEditorDocument(state).sections.length, 2);
  assert.equal(findEditorNode(currentSiteEditorDocument(state), insertedId), null);
  state = siteEditorReducer(state, { type: "redo" });
  assert.equal(currentSiteEditorDocument(state).sections.length, 3);
  assert.equal(findEditorNode(currentSiteEditorDocument(state), insertedId).node.type, "hero");
});

test("88 the section library panel is wired into the page and rail", () => {
  assert.match(pageSource, /<SectionLibraryPanel/);
  assert.match(pageSource, /sectionLibraryOpen && <SectionLibraryPanel/);
  assert.match(pageSource, /sectionTemplatesForCategory\(state\.sectionLibrary/);
  assert.match(pageSource, /fetchSiteEditorSectionLibrary\(\)/);
  assert.match(pageSource, /section-library-loading/);
  assert.match(railSource, /state\.activePanel === "add-section"\s*\?\s*null/);
  assert.match(panelSource, /id="site-editor-panel-add-section"/);
});

test("89 the panel renders tabs, categories, templates, and insert controls", () => {
  assert.match(panelSource, /addSection\.panelTitle/);
  assert.match(panelSource, /addSection\.templatesTab/);
  assert.match(panelSource, /addSection\.savedSections/);
  assert.match(panelSource, /SectionCategoryList/);
  assert.match(panelSource, /SectionTemplateCard/);
  assert.match(panelSource, /SectionInsertControls/);
  assert.match(panelSource, /insert-section-template/);
  assert.match(panelSource, /selectedSectionTemplate/);
  assert.match(categoryListSource, /blank-section-card/);
  assert.match(categoryListSource, /addSection\.blankSection/);
  assert.match(insertControlsSource, /site-editor-section-insert-position/);
  assert.match(templateCardSource, /template\.templateId/);
  assert.match(templateCardSource, /addSection\.requiresProducts/);
});

test("90 Add Section copy is bilingual and the library is fetched through the generic API", () => {
  assert.equal(siteEditorText("addSection.panelTitle", "en"), "Add Section");
  assert.equal(siteEditorText("addSection.panelTitle", "ar"), "إضافة قسم");
  assert.equal(siteEditorText("addSection.insert", "ar"), "إضافة إلى الصفحة");
  assert.equal(siteEditorText("addSection.category.welcome", "ar"), "ترحيب");
  assert.equal(siteEditorText("addSection.savedSectionsComingSoon", "en"), "Saved sections are coming soon.");
  assert.match(apiSource, /fetchSiteEditorSectionLibrary/);
  assert.match(apiSource, /"\/site-editor\/section-library", \{ cache: "no-store" \}/);
  assert.match(apiSource, /return payload;/);
  assert.doesNotMatch(apiSource, /payload\.sectionLibrary \|\| null/);
});

test("98 a legacy fallback shows a requires-connection message, never a fake connected library", () => {
  assert.equal(siteEditorText("addSection.requiresConnection", "en"), "Reusable section layouts require connecting this storefront's site manifest.");
  assert.equal(siteEditorText("addSection.requiresConnection", "ar"), "تتطلب تنسيقات الأقسام القابلة لإعادة الاستخدام ربط بيان موقع هذا المتجر.");
  let state = siteEditorReducer(loadedState(), {
    type: "section-library-success",
    sectionLibrary: null,
    requiresConnection: true,
  });
  assert.equal(state.sectionLibrary, null);
  assert.equal(state.sectionLibraryRequiresConnection, true);
  assert.equal(state.sectionLibraryStatus, "ready");
  assert.match(panelSource, /addSection\.requiresConnection/);
  assert.match(pageSource, /requiresConnection: result\.requiresConnection === true/);
  state = siteEditorReducer(state, { type: "section-library-reset" });
  assert.equal(state.sectionLibraryRequiresConnection, false);
});

test("98b the requires-connection message closes Add Section and directs the user to the connection flow", () => {
  assert.equal(siteEditorText("addSection.connectWebsite", "en"), "Open website connection");
  assert.equal(siteEditorText("addSection.connectWebsite", "ar"), "فتح إعداد اتصال الموقع");
  assert.match(panelSource, /onRequireConnection/);
  assert.match(panelSource, /addSection\.connectWebsite/);
  assert.match(panelSource, /site-editor-connect-button/);
  assert.match(pageSource, /onRequireConnection=\{\(\) => \{\s*dispatch\(\{ type: "close-section-library" \}\);\s*setConnectionReload/);
});

test("99 a legacy source is never described as a fully connected remote website", () => {
  let state = siteEditorReducer(loadedState(), {
    type: "section-library-success",
    sectionLibrary: { version: "1", categories: [{ id: "welcome", title: { en: "Welcome", ar: "ترحيب" }, order: 0 }], templates: [] },
    requiresConnection: false,
  });
  assert.equal(state.sectionLibraryRequiresConnection, false);
  assert.match(panelSource, /addSection\.noTemplates/);
  assert.match(panelSource, /addSection\.requiresConnection/);
});

test("91 Add Section CSS is scoped and responsive-safe", () => {
  assert.match(cssSource, /\.site-editor-section-library-panel/);
  assert.match(cssSource, /\.site-editor-template-card/);
  assert.match(cssSource, /\.site-editor-category-chip/);
  assert.match(cssSource, /\.site-editor-section-library-body/);
  assert.match(cssSource, /\.site-editor-insert-position/);
});

test("92 the section library effect keeps one active request and never depends on the status it mutates", () => {
  assert.match(pageSource, /\[capabilities\.canAccess, company, connected, connectionStatus, isContextResolving, sectionLibraryOpen, sectionLibraryRetry, siteKey\]/);
  assert.doesNotMatch(pageSource, /sectionLibraryOpen, state\.sectionLibraryStatus\]/);
  assert.match(pageSource, /if \(sectionLibraryRequestRef\.current\) return undefined;/);
  assert.match(pageSource, /sectionLibraryRequestRef\.current = request;/);
});

test("93 idle->loading never cancels the active request; results are only dropped on unmount or a newer request", () => {
  assert.match(pageSource, /let active = true;/);
  assert.match(pageSource, /if \(!active \|\| sectionLibraryRequestRef\.current !== request\) return;/);
  assert.match(pageSource, /active = false;/);
  assert.match(pageSource, /sectionLibraryKeyRef\.current = siteKey;/);
});

test("94 success->ready and failure->error reducer transitions", () => {
  let state = siteEditorReducer(loadedState(), { type: "section-library-loading" });
  assert.equal(state.sectionLibraryStatus, "loading");
  state = siteEditorReducer(state, { type: "section-library-success", sectionLibrary });
  assert.equal(state.sectionLibraryStatus, "ready");
  assert.equal(state.sectionLibrary, sectionLibrary);
  assert.equal(state.sectionLibraryError, "");
  assert.equal(state.activeSectionCategory, "welcome");
  state = siteEditorReducer(state, { type: "section-library-failure", error: "boom" });
  assert.equal(state.sectionLibraryStatus, "error");
  assert.equal(state.sectionLibraryError, "boom");
});

test("95 retry resets the library state to idle, clears the error, and re-triggers a request", () => {
  let state = siteEditorReducer(loadedState(), { type: "section-library-failure", error: "boom" });
  state = siteEditorReducer(state, { type: "section-library-retry" });
  assert.equal(state.sectionLibraryStatus, "idle");
  assert.equal(state.sectionLibraryError, "");
  assert.equal(siteEditorText("addSection.retry", "en"), "Retry");
  assert.equal(siteEditorText("addSection.retry", "ar"), "إعادة المحاولة");
  assert.match(pageSource, /section-library-retry/);
  assert.match(pageSource, /handleSectionLibraryRetry/);
  assert.match(pageSource, /sectionLibraryRetry/);
  assert.match(panelSource, /site-editor-retry-button/);
  assert.match(panelSource, /onRetry/);
});

test("96 a connected company/site change clears the previous tenant's library state", () => {
  let state = siteEditorReducer(loadedState(), { type: "section-library-success", sectionLibrary });
  state = siteEditorReducer(state, { type: "select-section-category", categoryId: "store" });
  state = siteEditorReducer(state, { type: "select-section-template", templateId: "store-grid" });
  state = siteEditorReducer(state, { type: "section-library-reset" });
  assert.equal(state.sectionLibrary, null);
  assert.equal(state.sectionLibraryStatus, "idle");
  assert.equal(state.sectionLibraryError, "");
  assert.equal(state.activeSectionCategory, null);
  assert.equal(state.selectedSectionTemplate, null);
  assert.match(pageSource, /section-library-reset/);
  assert.match(pageSource, /\[siteKey\]/);
});

test("97 another tenant never sees the previous tenant's templates after a site change", () => {
  const standardPage = { ...page, pageType: "standard" };
  let state = siteEditorReducer(loadedState(), { type: "section-library-success", sectionLibrary });
  assert.ok(sectionTemplatesForCategory(state.sectionLibrary, standardPage, "welcome").length > 0);
  state = siteEditorReducer(state, { type: "section-library-reset" });
  assert.deepEqual(sectionTemplatesForCategory(state.sectionLibrary, standardPage, "welcome"), []);
});
