import React from "react";
import MediaPickerDialog from "../components/site-editor/MediaPickerDialog.jsx";
import SiteEditorCanvas from "../components/site-editor/SiteEditorCanvas.jsx";
import SiteEditorRail from "../components/site-editor/SiteEditorRail.jsx";
import SiteEditorToolbar from "../components/site-editor/SiteEditorToolbar.jsx";
import SiteEditorTopBar from "../components/site-editor/SiteEditorTopBar.jsx";
import StyleInspector from "../components/site-editor/StyleInspector.jsx";
import WebsiteConnectionScreen from "../components/site-editor/WebsiteConnectionScreen.jsx";
import { fetchSiteEditorConnection, fetchSiteEditorDocument, fetchSiteEditorPages, saveSiteEditorDraft } from "../utils/siteEditorApi.js";
import {
  currentSiteEditorDocument, createSiteEditorState, normalizeSiteEditorPage, siteEditorCapabilities,
  siteEditorDirection, siteEditorReducer, siteEditorText, trustedPagePreview, trustedSiteLabel,
} from "../utils/siteEditor.js";
import {
  findEditorNode, moveEditorSection, replaceEditorImage, updateEditorImageSettings,
  updateEditorLink, updateEditorStyle, updateEditorText,
} from "../utils/siteEditorDocument.js";
import "../styles/site-editor.css";

const minimumLoaderTime = 800;

function EditorLoading({ language }) {
  return <section className="site-editor-loading" aria-busy="true" aria-live="polite" dir={language === "ar" ? "rtl" : "ltr"}><div className="site-editor-loader-mark" aria-hidden="true"><i className="site-editor-loader-primary" /><i className="site-editor-loader-secondary" /><i className="site-editor-loader-orbit" /><i className="site-editor-loader-line" /></div><strong>{siteEditorText("editor.loading", language)}</strong><p>{siteEditorText("editor.loadingDetail", language)}</p></section>;
}

function EditorAccessState({ language, missingCompany = false }) {
  const ar = language === "ar";
  return <section className="site-editor-access-state" role="alert">
    <strong>{missingCompany ? (ar ? "يلزم تحديد شركة موثوقة" : "Trusted company scope required") : (ar ? "ليس لديك صلاحية الوصول إلى المحرر" : "Site editor access required")}</strong>
    <p>{missingCompany ? (ar ? "ارجع إلى المنصة وادخل من خلال تبديل الشركة الآمن." : "Return to the platform and enter through the secure company switcher.") : (ar ? "اطلب صلاحية محرر الموقع من مسؤول الشركة." : "Ask a company administrator for site editor access.")}</p>
    <a href="/admin/dashboard">{ar ? "العودة إلى لوحة التحكم" : "Back to CPanel"}</a>
  </section>;
}

export default function SiteEditorPage({ company, currentUser, isContextResolving = false, language = "en" }) {
  const [state, dispatch] = React.useReducer(siteEditorReducer, language, createSiteEditorState);
  const [minimumElapsed, setMinimumElapsed] = React.useState(false);
  const [mediaNodeId, setMediaNodeId] = React.useState(null);
  const [notice, setNotice] = React.useState("");
  const [connection, setConnection] = React.useState(null);
  const [connectionStatus, setConnectionStatus] = React.useState("idle");
  const [connectionReload, setConnectionReload] = React.useState(0);
  const capabilities = siteEditorCapabilities(currentUser, company);
  const activeLanguage = state.activeLocale;
  const direction = siteEditorDirection(activeLanguage);
  const currentPage = state.pages.find((page) => page.id === state.currentPageId) || null;
  const currentDocument = currentSiteEditorDocument(state);
  const selectedRecord = findEditorNode(currentDocument, state.selectedNodeId);
  const previewUrl = trustedPagePreview(company, currentPage);
  const previewLabel = trustedSiteLabel(company);

  const loadDocument = React.useCallback(async (pageId, locale) => {
    dispatch({ type: "document-loading" });
    try {
      const document = await fetchSiteEditorDocument(pageId, locale);
      if (document.companyId !== company?.id || document.pageId !== pageId) throw new Error("The editor API returned a cross-tenant or mismatched page document.");
      dispatch({ type: "document-success", document, pageId });
    } catch (error) {
      dispatch({ type: "document-failure", error: error.message });
    }
  }, [company?.id]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setMinimumElapsed(true), minimumLoaderTime);
    return () => window.clearTimeout(timer);
  }, []);

  React.useEffect(() => {
    if (isContextResolving || !company || !capabilities.canAccess) return undefined;
    let cancelled = false;
    setConnectionStatus("loading");
    fetchSiteEditorConnection().then((result) => {
      if (cancelled) return;
      setConnection(result);
      setConnectionStatus("ready");
    }).catch((error) => {
      if (cancelled) return;
      setConnection(null);
      setConnectionStatus("error");
      setNotice(error.message || (activeLanguage === "ar" ? "تعذر تحميل اتصال الموقع." : "The website connection could not be loaded."));
    });
    return () => { cancelled = true; };
  }, [capabilities.canAccess, company, connectionReload, isContextResolving, activeLanguage]);

  const connected = connection?.hasManifest === true;

  React.useEffect(() => {
    if (isContextResolving || !company || !capabilities.canAccess || connectionStatus !== "ready" || !connected) return undefined;
    let cancelled = false;
    dispatch({ type: "pages-loading" });
    fetchSiteEditorPages(language).then(async (items) => {
      if (cancelled) return;
      const pages = items.map((page) => normalizeSiteEditorPage(page, company.id)).filter(Boolean);
      if (!pages.length) throw new Error("No trusted editable pages were returned by the local editor API.");
      dispatch({ type: "pages-success", pages, currentPageId: pages[0].id });
      await loadDocument(pages[0].id, language);
    }).catch((error) => {
      if (!cancelled) dispatch({ type: "pages-failure", error: error.message });
    });
    return () => { cancelled = true; };
  }, [capabilities.canAccess, company, connectionStatus, connected, isContextResolving, language, loadDocument]);

  React.useEffect(() => {
    const beforeUnload = (event) => {
      if (!state.isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [state.isDirty]);

  React.useEffect(() => {
    const onKeyDown = (event) => {
      const editingInput = event.target instanceof HTMLElement && (event.target.matches("input, textarea, select") || event.target.isContentEditable);
      if (event.key === "Escape") {
        dispatch({ type: state.editingNodeId ? "set-editing-node" : "clear-selection", nodeId: null });
        return;
      }
      if (editingInput || !(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === "z" && event.shiftKey) { event.preventDefault(); dispatch({ type: "redo" }); }
      else if (event.key.toLowerCase() === "z") { event.preventDefault(); dispatch({ type: "undo" }); }
      else if (event.key.toLowerCase() === "y") { event.preventDefault(); dispatch({ type: "redo" }); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [state.editingNodeId]);

  function commit(document) { if (capabilities.canEdit) dispatch({ type: "mutate-document", document }); }
  function showError(error) { setNotice(error.message || String(error)); }

  function selectNode(nodeId, sectionId = null, inspector = null) {
    if (!nodeId) dispatch({ type: "clear-selection" });
    else dispatch({ type: "select-node", nodeId, sectionId, inspector });
  }

  function handleAction(action, node) {
    if (action === "cancel-edit") return dispatch({ type: "set-editing-node", nodeId: null });
    if (!capabilities.canEdit) return setNotice(activeLanguage === "ar" ? "لديك صلاحية عرض فقط." : "You have read-only editor access.");
    if (action === "edit-text") return dispatch({ type: "set-editing-node", nodeId: node.id });
    if (["settings", "design"].includes(action)) return dispatch({ type: "set-inspector", inspector: node.id });
    if (action === "change-image") return setMediaNodeId(node.id);
    if (action === "move-up" || action === "move-down") return commit(moveEditorSection(currentDocument, node.id, action === "move-up" ? "up" : "down"));
    return undefined;
  }

  function handleText(nodeId, value) {
    try { commit(updateEditorText(currentDocument, nodeId, value)); dispatch({ type: "set-editing-node", nodeId: null }); }
    catch (error) { showError(error); }
  }

  async function handleSelectPage(pageId) {
    if (!pageId || pageId === state.currentPageId) return;
    if (state.isDirty && !window.confirm(activeLanguage === "ar" ? "توجد تغييرات غير محفوظة. هل تريد تجاهلها؟" : "You have unsaved changes. Discard them and switch pages?")) return;
    dispatch({ type: "select-page", pageId });
    await loadDocument(pageId, activeLanguage);
  }

  async function handleLocaleChange(locale) {
    if (locale === activeLanguage) return;
    if (state.isDirty && !window.confirm(activeLanguage === "ar" ? "توجد تغييرات غير محفوظة. هل تريد تجاهلها وتغيير اللغة؟" : "You have unsaved changes. Discard them and change locale?")) return;
    dispatch({ type: "set-locale", locale });
    if (state.currentPageId) await loadDocument(state.currentPageId, locale);
  }

  async function handleSave() {
    if (!capabilities.canSave || !currentDocument || !state.isDirty || state.saveStatus === "saving") return;
    dispatch({ type: "save-start" });
    try {
      const result = await saveSiteEditorDraft(state.currentPageId, currentDocument, state.currentRevision);
      dispatch({ type: "save-success", document: result.document, revision: result.revision });
    } catch (error) {
      dispatch({ type: "save-failure", conflict: error.status === 409, error: error.message });
    }
  }

  function handleBack(event) {
    if (state.isDirty && !window.confirm(activeLanguage === "ar" ? "توجد تغييرات غير محفوظة. هل تريد المغادرة؟" : "You have unsaved changes. Leave the editor?")) event.preventDefault();
  }

  if (!isContextResolving && minimumElapsed && !company) return <EditorAccessState language={language} missingCompany />;
  if (!isContextResolving && minimumElapsed && company && !capabilities.canAccess) return <EditorAccessState language={language} />;

  const booting = isContextResolving || !minimumElapsed || state.pagesStatus === "idle" || state.pagesStatus === "loading" || state.documentStatus === "loading" || state.pagesStatus === "ready" && state.currentPageId && state.documentStatus === "idle";
  if (booting && connectionStatus !== "ready") return <EditorLoading language={language} />;

  if (connectionStatus === "ready" && !connected) return (
    <WebsiteConnectionScreen
      canEdit={capabilities.canEdit}
      canSave={capabilities.canSave}
      company={company}
      connection={connection || undefined}
      language={activeLanguage}
      onBack={handleBack}
      onConnected={() => { setConnectionReload((reload) => reload + 1); }}
    />
  );

  if (booting) return <EditorLoading language={language} />;

  return <div className="site-editor-root site-editor-enter" data-editor-direction={direction} dir={direction}>
    <SiteEditorTopBar canSave={capabilities.canSave && Boolean(currentDocument)} company={company} direction={direction} language={activeLanguage} onBack={handleBack} onSave={handleSave} previewUrl={previewUrl} state={state} />
    <SiteEditorToolbar currentPage={currentPage} dispatch={dispatch} language={activeLanguage} onLocaleChange={handleLocaleChange} previewLabel={previewLabel} state={state} />
    <div className={`site-editor-workspace ${state.activePanel ? "panel-open" : ""} ${selectedRecord && state.activeInspector ? "inspector-open" : ""}`}>
      <SiteEditorRail company={company} dispatch={dispatch} language={activeLanguage} onSelectPage={handleSelectPage} pages={state.pages} state={state} />
      <SiteEditorCanvas document={currentDocument} language={activeLanguage} onAction={handleAction} onCommitText={handleText} onSelect={selectNode} state={{ ...state, readOnly: !capabilities.canEdit }} />
      {selectedRecord && state.activeInspector && capabilities.canEdit && <StyleInspector isSection={selectedRecord.kind === "section"} language={activeLanguage} node={selectedRecord.node} onClose={() => dispatch({ type: "set-inspector", inspector: null })} onImageSettings={(changes) => { try { commit(updateEditorImageSettings(currentDocument, selectedRecord.node.id, changes)); } catch (error) { showError(error); } }} onLink={(value) => { try { commit(updateEditorLink(currentDocument, selectedRecord.node.id, value)); } catch (error) { showError(error); } }} onStyle={(key, value) => commit(updateEditorStyle(currentDocument, selectedRecord.node.id, key, value, state.viewportMode))} onText={(value) => handleText(selectedRecord.node.id, value)} viewportMode={state.viewportMode} />}
    </div>
    {mediaNodeId && <MediaPickerDialog company={company} language={activeLanguage} onClose={() => setMediaNodeId(null)} onSelect={(asset) => { try { commit(replaceEditorImage(currentDocument, mediaNodeId, asset, company.id)); setMediaNodeId(null); } catch (error) { showError(error); } }} />}
    {notice && <div className="site-editor-notice" role="alert"><span>{notice}</span><button aria-label={activeLanguage === "ar" ? "إغلاق" : "Dismiss"} onClick={() => setNotice("")} type="button">×</button></div>}
    <div className="site-editor-narrow-notice" role="status"><strong>{activeLanguage === "ar" ? "يفضل استخدام سطح المكتب" : "Desktop editing recommended"}</strong><span>{activeLanguage === "ar" ? "استخدم شاشة أكبر للوصول إلى مساحة المحرر كاملة." : "Use a larger screen for the complete editor workspace."}</span></div>
  </div>;
}
