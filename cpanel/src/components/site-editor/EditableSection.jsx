import React from "react";
import { editorNodeStyles } from "../../utils/siteEditorDocument.js";
import EditableElement from "./EditableElement.jsx";
import ElementContextToolbar from "./ElementContextToolbar.jsx";

export default function EditableSection({ language, onAction, onCommitText, onSelect, section, sectionMoves, state, viewportMode }) {
  const selected = state.selectedNodeId === section.id;
  const styles = editorNodeStyles(section, viewportMode);
  const sectionStyle = {
    backgroundColor: styles.backgroundColor || "#f4f1eb",
    paddingBlock: `${styles.paddingBlock ?? 48}px`, paddingInline: `${styles.paddingInline ?? 48}px`,
    alignItems: styles.contentAlignment === "start" ? "flex-start" : styles.contentAlignment === "center" ? "center" : "flex-end",
  };
  return <section className={`site-editor-editable-section type-${section.type} ${selected ? "selected" : ""}`} data-section-id={section.id} onClick={(event) => { event.stopPropagation(); onSelect(section.id, section.id, "section"); }} style={sectionStyle}>
    {selected && <><span className="site-editor-element-label">{section.type}</span><ElementContextToolbar disabledAll={state.readOnly} language={language} node={{ ...section, type: "section" }} onAction={(action) => onAction(action, section)} sectionMoves={sectionMoves} /></>}
    {(section.elements || []).map((element) => <EditableElement key={element.id} language={language} node={element} onAction={onAction} onCommitText={onCommitText} onSelect={(nodeId) => onSelect(nodeId, section.id, element.type)} selected={state.selectedNodeId === element.id} state={state} viewportMode={viewportMode} />)}
  </section>;
}
