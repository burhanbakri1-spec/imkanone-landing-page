import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { getNavigationItem } from "../src/data/adminNavigation.js";
import { hasPermission } from "../src/data/permissions.js";
import { resolvePage } from "../src/utils/cpanelAccess.js";
import { canAccessAdminPage } from "../src/utils/roles.js";
import {
  createSiteEditorState, currentSiteEditorDocument, normalizeSiteEditorPage,
  siteEditorCapabilities, siteEditorDirection, siteEditorReducer, siteEditorTools,
  trustedPagePreview, trustedSitePreview,
} from "../src/utils/siteEditor.js";
import {
  editorNodeStyles, findEditorNode, moveEditorSection, plainEditorText, replaceEditorImage,
  safeEditorLink, sectionMoveAvailability, updateEditorImageSettings, updateEditorLink,
  updateEditorStyle, updateEditorText,
} from "../src/utils/siteEditorDocument.js";

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
    { id: "content", type: "content", order: 1, settings: {}, styles: {}, responsive: {}, elements: [] },
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
  assert.equal(trustedPagePreview(company, { ...page, tenantId: "eb-chemical" }), trustedSitePreview(company));
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
