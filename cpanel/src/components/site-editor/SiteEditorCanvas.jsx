import React from "react";
import EditablePageCanvas from "./EditablePageCanvas.jsx";

export default function SiteEditorCanvas({ document, language, onAction, onCommitText, onSelect, state }) {
  return <section className={`site-editor-canvas viewport-${state.viewportMode}`} aria-label={language === "ar" ? "لوحة تحرير الموقع" : "Editable website canvas"}>
    <div className="site-editor-canvas-scroll"><EditablePageCanvas document={document} language={language} onAction={onAction} onCommitText={onCommitText} onSelect={onSelect} state={state} /></div>
  </section>;
}