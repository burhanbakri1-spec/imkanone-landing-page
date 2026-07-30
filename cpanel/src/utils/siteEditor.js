import { documentFingerprint } from "./siteEditorDocument.js";

export const siteEditorPath = "/admin/site-editor";

const copy = Object.freeze({
  "tool.add-elements": { en: "Add Elements", ar: "إضافة عناصر" },
  "tool.add-section": { en: "Add Section", ar: "إضافة قسم" },
  "tool.pages-menu": { en: "Pages & Menu", ar: "الصفحات والقائمة" },
  "tool.site-design": { en: "Site Design", ar: "تصميم الموقع" },
  "tool.add-apps": { en: "Add Apps", ar: "إضافة تطبيقات" },
  "tool.my-business": { en: "My Business", ar: "نشاطي التجاري" },
  "tool.media": { en: "Media", ar: "الوسائط" },
  "tool.cms": { en: "CMS", ar: "إدارة المحتوى" },
  "tool.marketing-seo": { en: "Marketing & SEO", ar: "التسويق وتحسين البحث" },
  "tool.ai-tools": { en: "AI Tools", ar: "أدوات الذكاء الاصطناعي" },
  "tool.layers": { en: "Layers", ar: "الطبقات" },
  "pages.title": { en: "Pages & Menu", ar: "الصفحات والقائمة" },
  "pages.description": { en: "Choose the iCare page to edit in the canvas.", ar: "اختر صفحة iCare لتحريرها في اللوحة." },
  "pages.sitePages": { en: "Site pages", ar: "صفحات الموقع" },
  "pages.search": { en: "Search pages", ar: "البحث في الصفحات" },
  "pages.empty": { en: "No editable pages are available for this tenant.", ar: "لا توجد صفحات قابلة للتحرير لهذا المستأجر." },
  "pages.loadError": { en: "Pages could not be loaded from the local editor API.", ar: "تعذر تحميل الصفحات من واجهة المحرر المحلية." },
  "pages.actions": { en: "Page actions", ar: "إجراءات الصفحة" },
  "pages.open": { en: "Open trusted preview", ar: "فتح المعاينة الموثوقة" },
  "pages.closeActions": { en: "Close actions", ar: "إغلاق الإجراءات" },
  "pages.current": { en: "Current page", ar: "الصفحة الحالية" },
  "pages.draft": { en: "Draft", ar: "مسودة" },
  "pages.publishedSource": { en: "Published source", ar: "المصدر المنشور" },
  "editor.loading": { en: "Loading site editor…", ar: "جارٍ تحميل محرر الموقع…" },
  "editor.loadingDetail": { en: "Loading pages and the editable Home document…", ar: "جارٍ تحميل الصفحات ومستند الصفحة الرئيسية…" },
  "editor.unsaved": { en: "Unsaved changes", ar: "تغييرات غير محفوظة" },
  "editor.saving": { en: "Saving…", ar: "جارٍ الحفظ…" },
  "editor.saved": { en: "Saved", ar: "تم الحفظ" },
  "editor.loaded": { en: "Draft loaded", ar: "تم تحميل المسودة" },
  "editor.saveFailed": { en: "Save failed", ar: "فشل الحفظ" },
  "editor.conflict": { en: "Conflict detected", ar: "تم اكتشاف تعارض" },
});

export function siteEditorText(key, language = "en") {
  const value = copy[key];
  if (!value) return key;
  return language === "ar" ? value.ar : value.en;
}

export const siteEditorTools = Object.freeze([
  { id: "add-elements", icon: "plus", labelKey: "tool.add-elements", accent: "blue" },
  { id: "add-section", icon: "sections", labelKey: "tool.add-section", accent: "violet" },
  { id: "pages-menu", icon: "pages", labelKey: "tool.pages-menu", accent: "green" },
  { id: "site-design", icon: "design", labelKey: "tool.site-design", accent: "amber" },
  { id: "add-apps", icon: "apps", labelKey: "tool.add-apps", accent: "pink" },
  { id: "my-business", icon: "business", labelKey: "tool.my-business", accent: "indigo" },
  { id: "media", icon: "media", labelKey: "tool.media", accent: "orange" },
  { id: "cms", icon: "cms", labelKey: "tool.cms", accent: "teal" },
  { id: "marketing-seo", icon: "marketing", labelKey: "tool.marketing-seo", accent: "slate" },
  { id: "ai-tools", icon: "ai", labelKey: "tool.ai-tools", accent: "aqua" },
  { id: "layers", icon: "layers", labelKey: "tool.layers", accent: "blue" },
]);

export function normalizeSiteEditorPage(page, companyId) {
  if (!page || page.tenantId !== companyId || page.id !== `${companyId}:home`) return null;
  if (page.previewPath !== "/icare" || page.routePattern !== "/icare") return null;
  return { ...page, tenantId: companyId, isEditable: page.isEditable === true };
}

export function createSiteEditorState(language = "en") {
  return {
    pages: [], pagesStatus: "idle", pagesError: "", currentPageId: null,
    pageDocuments: {}, documentStatus: "idle", documentError: "",
    selectedNodeId: null, selectedSectionId: null, editingNodeId: null,
    viewportMode: "desktop", activeLocale: language === "ar" ? "ar" : "en", zoom: "fit",
    isDirty: false, saveStatus: "idle", saveError: "", currentRevision: 0,
    history: { past: [], future: [] }, savedFingerprints: {},
    activePanel: null, activeInspector: null,
  };
}

export function currentSiteEditorDocument(state) {
  return state.currentPageId ? state.pageDocuments[state.currentPageId] || null : null;
}

function dirtyFor(state, document) {
  if (!state.currentPageId || !document) return false;
  return documentFingerprint(document) !== state.savedFingerprints[state.currentPageId];
}

export function siteEditorReducer(state, action) {
  switch (action.type) {
    case "toggle-panel": return { ...state, activePanel: state.activePanel === action.panel ? null : action.panel };
    case "close-panel": return { ...state, activePanel: null };
    case "pages-loading": return { ...state, pagesStatus: "loading", pagesError: "" };
    case "pages-success": return { ...state, pages: action.pages, pagesStatus: "ready", pagesError: "", currentPageId: action.currentPageId || action.pages[0]?.id || null };
    case "pages-failure": return { ...state, pages: [], pagesStatus: "error", pagesError: action.error || "Unable to load pages." };
    case "select-page": return action.pageId === state.currentPageId ? state : {
      ...state, currentPageId: action.pageId || null, selectedNodeId: null, selectedSectionId: null,
      editingNodeId: null, activeInspector: null, documentStatus: "idle", documentError: "",
      history: { past: [], future: [] }, isDirty: false, saveStatus: "idle", saveError: "",
    };
    case "document-loading": return { ...state, documentStatus: "loading", documentError: "" };
    case "document-success": {
      const document = action.document;
      return {
        ...state, documentStatus: "ready", documentError: "", currentRevision: Number(document.revision || 0),
        pageDocuments: { ...state.pageDocuments, [action.pageId]: document },
        savedFingerprints: { ...state.savedFingerprints, [action.pageId]: documentFingerprint(document) },
        selectedNodeId: null, selectedSectionId: null, editingNodeId: null, activeInspector: null,
        history: { past: [], future: [] }, isDirty: false, saveStatus: "idle", saveError: "",
      };
    }
    case "document-failure": return { ...state, documentStatus: "error", documentError: action.error || "Unable to load page document." };
    case "select-node": return { ...state, selectedNodeId: action.nodeId || null, selectedSectionId: action.sectionId || null, editingNodeId: null, activeInspector: action.inspector || null };
    case "clear-selection": return { ...state, selectedNodeId: null, selectedSectionId: null, editingNodeId: null, activeInspector: null };
    case "set-editing-node": return { ...state, editingNodeId: action.nodeId || null };
    case "set-inspector": return { ...state, activeInspector: action.inspector || null };
    case "mutate-document": {
      const current = currentSiteEditorDocument(state);
      if (!current || !action.document || documentFingerprint(current) === documentFingerprint(action.document)) return state;
      const past = [...state.history.past, current].slice(-50);
      return {
        ...state, pageDocuments: { ...state.pageDocuments, [state.currentPageId]: action.document },
        history: { past, future: [] }, isDirty: dirtyFor(state, action.document),
        saveStatus: "idle", saveError: "",
      };
    }
    case "undo": {
      const current = currentSiteEditorDocument(state);
      const previous = state.history.past.at(-1);
      if (!current || !previous) return state;
      return {
        ...state, pageDocuments: { ...state.pageDocuments, [state.currentPageId]: previous },
        history: { past: state.history.past.slice(0, -1), future: [current, ...state.history.future].slice(0, 50) },
        isDirty: dirtyFor(state, previous), editingNodeId: null,
      };
    }
    case "redo": {
      const current = currentSiteEditorDocument(state);
      const next = state.history.future[0];
      if (!current || !next) return state;
      return {
        ...state, pageDocuments: { ...state.pageDocuments, [state.currentPageId]: next },
        history: { past: [...state.history.past, current].slice(-50), future: state.history.future.slice(1) },
        isDirty: dirtyFor(state, next), editingNodeId: null,
      };
    }
    case "save-start": return { ...state, saveStatus: "saving", saveError: "" };
    case "save-success": {
      const document = action.document;
      return {
        ...state, pageDocuments: { ...state.pageDocuments, [state.currentPageId]: document },
        savedFingerprints: { ...state.savedFingerprints, [state.currentPageId]: documentFingerprint(document) },
        currentRevision: Number(action.revision ?? document.revision ?? state.currentRevision), isDirty: false,
        saveStatus: "saved", saveError: "", history: { past: [], future: [] },
      };
    }
    case "save-failure": return { ...state, saveStatus: action.conflict ? "conflict" : "error", saveError: action.error || "Save failed.", isDirty: true };
    case "set-locale": return { ...state, activeLocale: action.locale === "ar" ? "ar" : "en" };
    case "set-viewport": return { ...state, viewportMode: action.viewport === "mobile" ? "mobile" : "desktop" };
    case "set-zoom": return { ...state, zoom: ["50", "75", "100", "fit"].includes(action.zoom) ? action.zoom : state.zoom };
    default: return state;
  }
}

export function siteEditorCapabilities(user, company) {
  const trustedTenant = company?.id === "icare" && (!company?.slug || company.slug === "icare");
  const role = user?.role;
  const admin = ["admin", "company_admin"].includes(role) || role === "super_admin" && trustedTenant;
  const permissions = new Set(user?.permissions || []);
  return {
    canAccess: trustedTenant && (admin || permissions.has("site_editor.access")),
    canEdit: trustedTenant && (admin || permissions.has("site_editor.edit")),
    canSave: trustedTenant && (admin || permissions.has("site_editor.save")),
  };
}

export function siteEditorDirection(locale) { return locale === "ar" ? "rtl" : "ltr"; }
export function siteEditorZoomScale(zoom) { return zoom === "50" ? 0.5 : zoom === "75" ? 0.75 : zoom === "100" ? 1 : 0.82; }

export function trustedSitePreview(company) {
  if (!company || typeof company !== "object" || company.id !== "icare" || company.slug !== "icare") return null;
  const configured = company.storefrontUrl || company.settings?.storefrontUrl;
  if (!configured || typeof configured !== "string") return null;
  try {
    const url = new URL(configured.trim());
    if (!["http:", "https:"].includes(url.protocol) || url.pathname.replace(/\/$/, "") !== "/icare") return null;
    return url.toString();
  } catch { return null; }
}

export function trustedSiteLabel(company) {
  const previewUrl = trustedSitePreview(company);
  if (!previewUrl) return null;
  const url = new URL(previewUrl);
  return `${url.host}${url.pathname.replace(/\/$/, "")}`;
}

export function trustedPagePreview(company, page) {
  const storefront = trustedSitePreview(company);
  if (!storefront || page?.tenantId !== company.id || page?.previewPath !== "/icare") return storefront;
  return storefront;
}
