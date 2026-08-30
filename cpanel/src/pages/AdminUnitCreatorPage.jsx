import React from "react";
import { LoaderCircle, Plus, Search, Settings2, Trash2, X } from "lucide-react";
import AdminLayout from "../components/AdminLayout.jsx";
import { canAccessAdminPage } from "../utils/roles.js";
import {
  createCustomModule,
  createCustomModuleEntry,
  deleteCustomModuleEntry,
  disableCustomModule,
  fetchCustomModuleEntries,
  fetchCustomModules,
  updateCustomModule,
  updateCustomModuleEntry,
} from "../utils/customModulesApi.js";
import {
  CUSTOM_FIELD_TYPES,
  canBuildCustomModules,
  canManageCustomModuleEntries,
  canViewCustomModule,
  displayEntryValue,
  emptyEntryDraft,
  emptyFieldDraft,
  emptyModuleDraft,
  entryDraftFromEntry,
  filterEntries,
  listColumnsForModule,
  optionsToText,
  textToOptions,
  unitCreatorCopy,
  validateEntryDraft,
  validateModuleDraft,
} from "../utils/customModulesUi.js";

function FieldSchemaDialog({ copy, field, isNew, language, onCancel, onSave, readOnly }) {
  const [draft, setDraft] = React.useState(() => ({ ...field }));
  const [optionsText, setOptionsText] = React.useState(() => optionsToText(field?.options));
  const [error, setError] = React.useState("");

  function handleSubmit(event) {
    event.preventDefault();
    if (readOnly) return;
    try {
      const next = { ...draft };
      if (["select", "multi_select"].includes(next.type)) next.options = textToOptions(optionsText);
      else next.options = [];
      if (!next.key || !/^[a-z][a-z0-9_]{1,49}$/.test(next.key)) {
        setError(language === "ar" ? "مفتاح الحقل غير صالح." : "Field key is invalid.");
        return;
      }
      if (!String(next.label || "").trim()) {
        setError(language === "ar" ? "تسمية الحقل مطلوبة." : "Field label is required.");
        return;
      }
      onSave(next);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <div className="unit-creator-dialog-backdrop" role="presentation">
      <form className="unit-creator-dialog" dir={language === "ar" ? "rtl" : "ltr"} onSubmit={handleSubmit}>
        <header><h2>{isNew ? copy.addField : copy.editField}</h2></header>
        <div className="unit-creator-dialog-body">
          {error && <div className="unit-creator-error" role="alert">{error}</div>}
          <label>{copy.fieldKey}<input disabled={readOnly || !isNew} onChange={(e) => setDraft((c) => ({ ...c, key: e.target.value.trim().toLowerCase() }))} value={draft.key || ""} /></label>
          <label>{copy.fieldLabel}<input disabled={readOnly} onChange={(e) => setDraft((c) => ({ ...c, label: e.target.value }))} value={draft.label || ""} /></label>
          <div className="unit-creator-dialog-row">
            <label>{copy.fieldType}
              <select disabled={readOnly} onChange={(e) => setDraft((c) => ({ ...c, type: e.target.value }))} value={draft.type || "text"}>
                {CUSTOM_FIELD_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
            <label>{copy.sidebarOrder}
              <input disabled={readOnly} min="0" onChange={(e) => setDraft((c) => ({ ...c, order: Number(e.target.value) || 0 }))} type="number" value={draft.order ?? 0} />
            </label>
          </div>
          <label>{copy.placeholder}<input disabled={readOnly} onChange={(e) => setDraft((c) => ({ ...c, placeholder: e.target.value }))} value={draft.placeholder || ""} /></label>
          <div className="unit-creator-checkbox-row">
            <label className="unit-creator-checkbox"><input checked={draft.required === true} disabled={readOnly} onChange={(e) => setDraft((c) => ({ ...c, required: e.target.checked }))} type="checkbox" />{copy.required}</label>
            <label className="unit-creator-checkbox"><input checked={draft.showInList !== false} disabled={readOnly} onChange={(e) => setDraft((c) => ({ ...c, showInList: e.target.checked }))} type="checkbox" />{copy.showInList}</label>
          </div>
          {["select", "multi_select"].includes(draft.type) && (
            <label>{copy.options}<textarea disabled={readOnly} onChange={(e) => setOptionsText(e.target.value)} placeholder={copy.optionsHint} rows={4} value={optionsText} /><span className="unit-creator-hint">{copy.optionsHint}</span></label>
          )}
        </div>
        <footer className="unit-creator-dialog-actions">
          <button className="secondary-action" onClick={onCancel} type="button">{copy.cancel}</button>
          {!readOnly && <button className="admin-primary-button" type="submit">{copy.save}</button>}
        </footer>
      </form>
    </div>
  );
}

function ModuleFormDialog({ copy, module, isNew, language, onCancel, onSave, readOnly }) {
  const [draft, setDraft] = React.useState(() => ({ ...emptyModuleDraft(), ...module }));
  const [fieldEditor, setFieldEditor] = React.useState(null);
  const [errors, setErrors] = React.useState([]);

  function upsertField(field, originalKey = "") {
    setDraft((current) => {
      const fields = [...(current.fieldsSchema || [])];
      const index = fields.findIndex((item) => item.key === (originalKey || field.key));
      if (index >= 0) fields[index] = field;
      else fields.push(field);
      return { ...current, fieldsSchema: fields.sort((a, b) => Number(a.order || 0) - Number(b.order || 0)) };
    });
    setFieldEditor(null);
  }

  function removeField(key) {
    setDraft((current) => ({ ...current, fieldsSchema: (current.fieldsSchema || []).filter((item) => item.key !== key) }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (readOnly) return;
    const validation = validateModuleDraft(draft);
    setErrors(validation.errors);
    if (!validation.valid) return;
    onSave(draft);
  }

  return (
    <>
      <div className="unit-creator-dialog-backdrop" role="presentation">
        <form className="unit-creator-dialog unit-creator-dialog--wide" dir={language === "ar" ? "rtl" : "ltr"} onSubmit={handleSubmit}>
          <header><h2>{isNew ? copy.addModule : copy.editModule}</h2></header>
          <div className="unit-creator-dialog-body">
            {errors.length > 0 && <div className="unit-creator-error" role="alert"><strong>{copy.validationTitle}</strong><ul>{errors.map((item) => <li key={item}>{item}</li>)}</ul></div>}
            <div className="unit-creator-dialog-row">
              <label>{copy.key}<input disabled={readOnly || !isNew} onChange={(e) => setDraft((c) => ({ ...c, key: e.target.value.trim().toLowerCase() }))} value={draft.key || ""} /></label>
              <label>{copy.label}<input disabled={readOnly} onChange={(e) => setDraft((c) => ({ ...c, label: e.target.value }))} value={draft.label || ""} /></label>
            </div>
            <label>{copy.description}<textarea disabled={readOnly} onChange={(e) => setDraft((c) => ({ ...c, description: e.target.value }))} rows={2} value={draft.description || ""} /></label>
            <div className="unit-creator-dialog-row">
              <label>{copy.icon}<input disabled={readOnly} onChange={(e) => setDraft((c) => ({ ...c, icon: e.target.value.trim().toLowerCase() || "folder" }))} value={draft.icon || "folder"} /></label>
              <label>{copy.sidebarOrder}<input disabled={readOnly} min="0" onChange={(e) => setDraft((c) => ({ ...c, sidebarOrder: Number(e.target.value) || 0 }))} type="number" value={draft.sidebarOrder ?? 100} /></label>
            </div>
            <label className="unit-creator-checkbox"><input checked={draft.enabled !== false} disabled={readOnly} onChange={(e) => setDraft((c) => ({ ...c, enabled: e.target.checked }))} type="checkbox" />{copy.enabled}</label>
            <section className="unit-creator-fields-panel">
              <header><strong>{copy.fields}</strong>{!readOnly && <button className="secondary-action" onClick={() => setFieldEditor({ field: emptyFieldDraft(), isNew: true })} type="button"><Plus size={14} /> {copy.addField}</button>}</header>
              {!draft.fieldsSchema?.length ? <p className="unit-creator-hint">{copy.emptyEntriesHint}</p> : (
                <ul className="unit-creator-field-list">
                  {draft.fieldsSchema.map((field) => (
                    <li key={field.key}>
                      <div><strong>{field.label}</strong><code>{field.key}</code><span>{field.type}</span></div>
                      {!readOnly && (
                        <div className="unit-creator-row-actions">
                          <button className="text-action" onClick={() => setFieldEditor({ field, isNew: false })} type="button">{copy.editField}</button>
                          <button className="text-action is-danger" onClick={() => removeField(field.key)} type="button">{copy.removeField}</button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
          <footer className="unit-creator-dialog-actions">
            <button className="secondary-action" onClick={onCancel} type="button">{copy.cancel}</button>
            {!readOnly && <button className="admin-primary-button" type="submit">{copy.save}</button>}
          </footer>
        </form>
      </div>
      {fieldEditor && (
        <FieldSchemaDialog
          copy={copy}
          field={fieldEditor.field}
          isNew={fieldEditor.isNew}
          language={language}
          onCancel={() => setFieldEditor(null)}
          onSave={(field) => upsertField(field, fieldEditor.isNew ? "" : fieldEditor.field.key)}
          readOnly={readOnly}
        />
      )}
    </>
  );
}

function EntryFormDialog({ copy, module, entry, language, onCancel, onSave, readOnly }) {
  const fields = module?.fieldsSchema || [];
  const [draft, setDraft] = React.useState(() => entryDraftFromEntry(entry, fields));
  const [errors, setErrors] = React.useState([]);

  function handleSubmit(event) {
    event.preventDefault();
    if (readOnly) return;
    const validation = validateEntryDraft(draft, fields);
    setErrors(validation.errors);
    if (!validation.valid) return;
    onSave(draft);
  }

  function renderInput(field) {
    const value = draft[field.key];
    const setValue = (next) => setDraft((current) => ({ ...current, [field.key]: next }));
    if (field.type === "boolean") {
      return <label className="unit-creator-checkbox"><input checked={value === true} disabled={readOnly} onChange={(e) => setValue(e.target.checked)} type="checkbox" /><span>{field.label}</span></label>;
    }
    if (field.type === "textarea") {
      return <label>{field.label}<textarea disabled={readOnly} onChange={(e) => setValue(e.target.value)} placeholder={field.placeholder || ""} rows={3} value={value ?? ""} /></label>;
    }
    if (field.type === "select") {
      return <label>{field.label}<select disabled={readOnly} onChange={(e) => setValue(e.target.value)} value={value ?? ""}><option value="">—</option>{(field.options || []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
    }
    if (field.type === "multi_select") {
      const selected = new Set(Array.isArray(value) ? value : []);
      return <fieldset className="unit-creator-multi-select"><legend>{field.label}</legend>{(field.options || []).map((option) => (
        <label className="unit-creator-checkbox" key={option.value}>
          <input checked={selected.has(option.value)} disabled={readOnly} onChange={(e) => {
            const next = new Set(selected);
            if (e.target.checked) next.add(option.value);
            else next.delete(option.value);
            setValue([...next]);
          }} type="checkbox" />
          {option.label}
        </label>
      ))}</fieldset>;
    }
    const inputType = field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "datetime" ? "datetime-local" : "text";
    return <label>{field.label}<input disabled={readOnly} onChange={(e) => setValue(field.type === "number" ? e.target.value : e.target.value)} placeholder={field.placeholder || ""} type={inputType} value={value ?? ""} /></label>;
  }

  return (
    <div className="unit-creator-dialog-backdrop" role="presentation">
      <form className="unit-creator-dialog" dir={language === "ar" ? "rtl" : "ltr"} onSubmit={handleSubmit}>
        <header><h2>{entry?.id ? copy.editEntry : copy.addEntry}</h2><p>{module?.label}</p></header>
        <div className="unit-creator-dialog-body">
          {errors.length > 0 && <div className="unit-creator-error" role="alert"><ul>{errors.map((item) => <li key={item}>{item}</li>)}</ul></div>}
          {fields.map((field) => <div key={field.key}>{renderInput(field)}</div>)}
        </div>
        <footer className="unit-creator-dialog-actions">
          <button className="secondary-action" onClick={onCancel} type="button">{copy.cancel}</button>
          {!readOnly && <button className="admin-primary-button" type="submit">{copy.save}</button>}
        </footer>
      </form>
    </div>
  );
}

export default function AdminUnitCreatorPage({ company, currentUser, language = "en", ...layoutProps }) {
  const copy = unitCreatorCopy(language);
  const dir = language === "ar" ? "rtl" : "ltr";
  const canView = canAccessAdminPage(currentUser, "admin-unit-creator");
  const canBuild = canBuildCustomModules(currentUser);
  const [modules, setModules] = React.useState([]);
  const [selectedId, setSelectedId] = React.useState("");
  const [entries, setEntries] = React.useState([]);
  const [loadingModules, setLoadingModules] = React.useState(true);
  const [loadingEntries, setLoadingEntries] = React.useState(false);
  const [error, setError] = React.useState("");
  const [forbidden, setForbidden] = React.useState(false);
  const [notice, setNotice] = React.useState("");
  const [noticeError, setNoticeError] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [moduleDialog, setModuleDialog] = React.useState(null);
  const [entryDialog, setEntryDialog] = React.useState(null);
  const [saving, setSaving] = React.useState(false);
  const requestRef = React.useRef(0);

  const selected = modules.find((module) => module.id === selectedId) || null;
  const canManageEntries = selected ? canManageCustomModuleEntries(currentUser, selected) : false;
  const visibleModules = modules.filter((module) => canViewCustomModule(currentUser, module));
  const filteredEntries = filterEntries(entries, query, selected);
  const columns = selected ? listColumnsForModule(selected) : [];

  const loadModules = React.useCallback(() => {
    const requestId = ++requestRef.current;
    setLoadingModules(true);
    setError("");
    setForbidden(false);
    return fetchCustomModules()
      .then((data) => {
        if (requestRef.current !== requestId) return [];
        const rows = Array.isArray(data) ? data : [];
        setModules(rows);
        setLoadingModules(false);
        return rows;
      })
      .catch((requestError) => {
        if (requestRef.current !== requestId) return [];
        setModules([]);
        setForbidden(requestError?.status === 403);
        setError(requestError?.status === 403 ? "" : (requestError?.message || copy.loadFailed));
        setLoadingModules(false);
        return [];
      });
  }, [copy.loadFailed]);

  const loadEntries = React.useCallback((moduleId) => {
    if (!moduleId) {
      setEntries([]);
      return Promise.resolve([]);
    }
    setLoadingEntries(true);
    return fetchCustomModuleEntries(moduleId)
      .then((data) => {
        const rows = Array.isArray(data) ? data : [];
        setEntries(rows);
        setLoadingEntries(false);
        return rows;
      })
      .catch((requestError) => {
        setEntries([]);
        setError(requestError?.message || copy.loadFailed);
        setLoadingEntries(false);
        return [];
      });
  }, [copy.loadFailed]);

  React.useEffect(() => {
    if (!canView) return undefined;
    loadModules().then((rows) => {
      const first = rows.find((module) => canViewCustomModule(currentUser, module));
      if (first) setSelectedId(first.id);
    });
    return () => { requestRef.current += 1; };
  }, [canView, company?.id, currentUser, loadModules]);

  React.useEffect(() => {
    if (!selectedId) {
      setEntries([]);
      return undefined;
    }
    loadEntries(selectedId);
    return undefined;
  }, [selectedId, loadEntries]);

  function showNotice(text, isError = false) {
    setNotice(text);
    setNoticeError(isError);
  }

  async function handleSaveModule(moduleDraft, isNew) {
    setSaving(true);
    try {
      if (isNew) await createCustomModule(moduleDraft);
      else await updateCustomModule(moduleDraft.id, moduleDraft);
      setModuleDialog(null);
      showNotice(copy.saved);
      const rows = await loadModules();
      const saved = rows.find((item) => item.key === moduleDraft.key);
      if (saved) setSelectedId(saved.id);
    } catch (requestError) {
      showNotice(requestError?.message || copy.saveFailed, true);
    } finally {
      setSaving(false);
    }
  }

  async function handleDisableModule(module) {
    if (!window.confirm(copy.confirmDisable)) return;
    setSaving(true);
    try {
      await disableCustomModule(module.id);
      showNotice(copy.moduleDisabled);
      const rows = await loadModules();
      const next = rows.find((item) => canViewCustomModule(currentUser, item));
      setSelectedId(next?.id || "");
    } catch (requestError) {
      showNotice(requestError?.message || copy.saveFailed, true);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEntry(data) {
    if (!selected) return;
    setSaving(true);
    try {
      if (entryDialog?.entry?.id) {
        await updateCustomModuleEntry(selected.id, entryDialog.entry.id, data);
      } else {
        await createCustomModuleEntry(selected.id, data);
      }
      setEntryDialog(null);
      showNotice(copy.entrySaved);
      await loadEntries(selected.id);
    } catch (requestError) {
      showNotice(requestError?.message || copy.entrySaveFailed, true);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteEntry(entry) {
    if (!selected || !window.confirm(copy.confirmDeleteEntry)) return;
    setSaving(true);
    try {
      await deleteCustomModuleEntry(selected.id, entry.id);
      showNotice(copy.entryDeleted);
      await loadEntries(selected.id);
    } catch (requestError) {
      showNotice(requestError?.message || copy.entrySaveFailed, true);
    } finally {
      setSaving(false);
    }
  }

  if (!canView) {
    return (
      <AdminLayout activePage="admin-unit-creator" title={copy.title} subtitle={copy.subtitle} {...layoutProps}>
        <div className="unit-creator-forbidden" dir={dir}><strong>{copy.forbidden}</strong></div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout activePage="admin-unit-creator" title={copy.title} subtitle={copy.subtitle} {...layoutProps}>
      <section className="unit-creator-page" dir={dir}>
        {!canBuild && <div className="unit-creator-banner" role="status">{copy.builderReadOnly}</div>}
        {notice && <div className={`unit-creator-banner ${noticeError ? "is-error" : "is-success"}`} role="status">{notice}</div>}

        {loadingModules ? (
          <div className="unit-creator-loading"><LoaderCircle className="spin" size={28} /><span>{copy.loading}</span></div>
        ) : forbidden ? (
          <div className="unit-creator-forbidden"><Settings2 size={28} /><strong>{copy.forbidden}</strong></div>
        ) : error && !modules.length ? (
          <div className="unit-creator-error"><span>{error}</span><button className="secondary-action" onClick={loadModules} type="button">{copy.retry}</button></div>
        ) : (
          <div className="unit-creator-layout">
            <aside className="unit-creator-sidebar">
              <header>
                <strong>{copy.modules}</strong>
                {canBuild && <button className="admin-primary-button" disabled={saving} onClick={() => setModuleDialog({ module: emptyModuleDraft(), isNew: true })} type="button"><Plus size={14} /> {copy.addModule}</button>}
              </header>
              {!visibleModules.length ? (
                <div className="unit-creator-empty"><span>{copy.emptyModules}</span><small>{copy.emptyModulesHint}</small></div>
              ) : (
                <ul className="unit-creator-module-list">
                  {visibleModules.map((module) => (
                    <li key={module.id}>
                      <button className={selectedId === module.id ? "active" : ""} onClick={() => setSelectedId(module.id)} type="button">
                        <strong>{module.label}</strong>
                        <code>{module.key}</code>
                        <span className={`unit-creator-status ${module.enabled !== false ? "is-enabled" : "is-disabled"}`}>{module.enabled !== false ? copy.enabled : copy.disabled}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </aside>

            <main className="unit-creator-main">
              {!selected ? (
                <div className="unit-creator-empty"><strong>{copy.noModuleSelected}</strong></div>
              ) : (
                <>
                  <header className="unit-creator-main-header">
                    <div>
                      <h2>{selected.label}</h2>
                      <p>{selected.description || selected.key}</p>
                    </div>
                    <div className="unit-creator-main-actions">
                      {canBuild && (
                        <>
                          <button className="secondary-action" disabled={saving} onClick={() => setModuleDialog({ module: selected, isNew: false })} type="button">{copy.editModule}</button>
                          <button className="secondary-action is-danger" disabled={saving} onClick={() => handleDisableModule(selected)} type="button"><Trash2 size={14} /> {copy.disableModule}</button>
                        </>
                      )}
                      {canManageEntries && (
                        <button className="admin-primary-button" disabled={saving} onClick={() => setEntryDialog({ entry: { data: emptyEntryDraft(selected.fieldsSchema) } })} type="button"><Plus size={14} /> {copy.addEntry}</button>
                      )}
                    </div>
                  </header>
                  {!canManageEntries && <div className="unit-creator-banner" role="status">{copy.readOnly}</div>}
                  <div className="unit-creator-toolbar">
                    <label className="unit-creator-search"><Search size={16} /><input aria-label={copy.searchEntries} onChange={(e) => setQuery(e.target.value)} placeholder={copy.searchEntries} value={query} /></label>
                  </div>
                  {error && <div className="unit-creator-error" role="alert">{error}</div>}
                  <div className="unit-creator-table-wrap">
                    <table className="unit-creator-table">
                      <thead>
                        <tr>
                          {columns.map((field) => <th key={field.key}>{field.label}</th>)}
                          <th>{copy.updated}</th>
                          <th>{copy.actions}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loadingEntries ? (
                          <tr><td colSpan={columns.length + 2}>{copy.loading}</td></tr>
                        ) : !filteredEntries.length ? (
                          <tr><td colSpan={columns.length + 2}><div className="unit-creator-empty is-inline"><strong>{copy.emptyEntries}</strong><span>{copy.emptyEntriesHint}</span></div></td></tr>
                        ) : filteredEntries.map((entry) => (
                          <tr key={entry.id}>
                            {columns.map((field) => <td key={field.key}>{displayEntryValue(field, entry.data?.[field.key])}</td>)}
                            <td>{entry.updatedAt ? new Date(entry.updatedAt).toLocaleString(language === "ar" ? "ar" : "en") : "—"}</td>
                            <td>
                              <div className="unit-creator-row-actions">
                                <button className="text-action" onClick={() => setEntryDialog({ entry })} type="button">{copy.editEntry}</button>
                                {canManageEntries && <button className="text-action is-danger" disabled={saving} onClick={() => handleDeleteEntry(entry)} type="button">{copy.deleteEntry}</button>}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </main>
          </div>
        )}

        {moduleDialog && (
          <ModuleFormDialog
            copy={copy}
            isNew={moduleDialog.isNew}
            language={language}
            module={moduleDialog.module}
            onCancel={() => setModuleDialog(null)}
            onSave={(moduleDraft) => handleSaveModule({ ...moduleDraft, id: moduleDialog.module?.id }, moduleDialog.isNew)}
            readOnly={!canBuild || saving}
          />
        )}

        {entryDialog && selected && (
          <EntryFormDialog
            copy={copy}
            entry={entryDialog.entry}
            language={language}
            module={selected}
            onCancel={() => setEntryDialog(null)}
            onSave={handleSaveEntry}
            readOnly={!canManageEntries || saving}
          />
        )}
      </section>
    </AdminLayout>
  );
}
