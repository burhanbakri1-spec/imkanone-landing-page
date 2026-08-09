import React from "react";
import AdminLayout from "../components/AdminLayout.jsx";
import { apiRequest } from "../utils/api.js";

const features = {
  "admin-website-texts": { title: "Website Content", endpoint: "/admin/website-texts" },
  "admin-invoices": { title: "Invoices", endpoint: "/admin/invoices" },
  "admin-delivery": { title: "Delivery zones", endpoint: "/admin/delivery-zones" },
  "admin-product-settings": { title: "Product settings", endpoint: "/admin/product-schema" },
  "admin-reports": { title: "Reports", endpoint: "/admin/reports/summary" },
  "admin-activity-log": { title: "Activity log", endpoint: "/admin/activity-log" },
  "admin-unit-creator": { title: "Unit creator", endpoint: "/admin/custom-modules" },
};

const textValue = (value) => value == null ? "" : String(value);

function websiteTextLocation(row) {
  const parts = textValue(row.key).split(".").filter(Boolean);
  return {
    page: parts[0] || textValue(row.group) || "—",
    section: parts.length > 2 ? parts.slice(1, -1).join(" · ") : textValue(row.group) || parts[1] || "—",
    field: textValue(row.label) || parts.at(-1) || "—",
  };
}

function WebsiteTextsPanel({ language = "en", rows, onReload }) {
  const ar = language === "ar";
  const [query, setQuery] = React.useState("");
  const [group, setGroup] = React.useState("all");
  const [editingId, setEditingId] = React.useState("");
  const [draft, setDraft] = React.useState(null);
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");
  const groups = React.useMemo(() => [...new Set(rows.map((row) => textValue(row.group)).filter(Boolean))].sort(), [rows]);
  const visibleRows = rows.filter((row) => {
    const matchesGroup = group === "all" || row.group === group;
    const haystack = [row.key, row.group, row.label, row.valueEn, row.valueAr].map(textValue).join(" ").toLowerCase();
    return matchesGroup && haystack.includes(query.trim().toLowerCase());
  });

  function beginEdit(row) {
    setEditingId(row.id);
    setDraft({ valueEn: textValue(row.valueEn), valueAr: textValue(row.valueAr), isActive: row.isActive !== false });
    setError(""); setMessage("");
  }

  async function save() {
    setError(""); setMessage("");
    try {
      await apiRequest(`/admin/website-texts/${encodeURIComponent(editingId)}`, {
        method: "PATCH",
        body: JSON.stringify(draft),
      });
      setEditingId(""); setDraft(null); setMessage(ar ? "تم حفظ نص الموقع." : "Website text saved.");
      onReload();
    } catch (requestError) {
      setError(requestError.message || (ar ? "تعذر حفظ نص الموقع." : "Website text could not be saved."));
    }
  }

  return <section className="admin-panel-card">
    <div className="admin-toolbar">
      <input aria-label="Search website texts" placeholder={ar ? "ابحث بالمفتاح أو العنوان أو القيمة..." : "Search key, label, or value..."} value={query} onChange={(event) => setQuery(event.target.value)} />
      <select aria-label="Filter website texts by group" value={group} onChange={(event) => setGroup(event.target.value)}>
        <option value="all">{ar ? "كل المجموعات" : "All groups"}</option>
        {groups.map((value) => <option key={value} value={value}>{value}</option>)}
      </select>
    </div>
    {message && <div className="message-panel success" role="status">{message}</div>}
    {error && <div className="message-panel error" role="alert">{error}</div>}
    {!visibleRows.length ? <div className="admin-empty-state"><strong>{ar ? "لا توجد نصوص مطابقة" : "No matching website texts"}</strong><span>{ar ? "غيّر البحث أو عامل تصفية المجموعة." : "Change the search or group filter."}</span></div> :
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>{ar ? "الصفحة" : "Page"}</th><th>{ar ? "القسم" : "Section"}</th><th>{ar ? "الحقل" : "Field"}</th><th>{ar ? "الإنجليزية" : "English"}</th><th>{ar ? "العربية" : "Arabic"}</th><th>{ar ? "الحالة" : "Status"}</th><th>{ar ? "الإجراءات" : "Actions"}</th></tr></thead><tbody>
        {visibleRows.map((row) => {
          const location = websiteTextLocation(row);
          return <tr key={row.id}>
          <td><span>{location.page}</span><code className="website-text-key">{textValue(row.key)}</code></td><td>{location.section}</td><td>{location.field}</td>
          <td>{editingId === row.id ? <textarea aria-label={`English value for ${row.key}`} value={draft.valueEn} onChange={(event) => setDraft((current) => ({ ...current, valueEn: event.target.value }))} /> : textValue(row.valueEn) || "—"}</td>
          <td dir="rtl">{editingId === row.id ? <textarea aria-label={`Arabic value for ${row.key}`} value={draft.valueAr} onChange={(event) => setDraft((current) => ({ ...current, valueAr: event.target.value }))} /> : textValue(row.valueAr) || "—"}</td>
          <td>{editingId === row.id ? <label className="checkbox-line"><input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft((current) => ({ ...current, isActive: event.target.checked }))} />{ar ? "نشط" : "Active"}</label> : row.isActive === false ? (ar ? "غير نشط" : "Inactive") : (ar ? "نشط" : "Active")}</td>
          <td>{editingId === row.id ? <div className="row-actions"><button className="text-action" type="button" onClick={save}>{ar ? "حفظ التغييرات" : "Save changes"}</button><button className="text-action" type="button" onClick={() => { setEditingId(""); setDraft(null); }}>{ar ? "إلغاء" : "Cancel"}</button></div> : <button className="text-action" type="button" onClick={() => beginEdit(row)}>{ar ? "تعديل" : "Edit"}</button>}</td>
        </tr>;
        })}
      </tbody></table></div>}
  </section>;
}

function rowsFrom(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.logs)) return data.logs;
  if (data && typeof data === "object") {
    const nestedRows = Object.values(data).find(Array.isArray);
    if (nestedRows) return nestedRows;
    if (data.summary && typeof data.summary === "object") return [data.summary];
  }
  return data && typeof data === "object" ? [data] : [];
}

export default function AdminFeaturePage({ activePage, ...layout }) {
  const feature = features[activePage];
  const [data, setData] = React.useState(null);
  const [error, setError] = React.useState("");
  const [reloadVersion, setReloadVersion] = React.useState(0);
  React.useEffect(() => {
    let active = true;
    setData(null); setError("");
    apiRequest(feature.endpoint).then((result) => active && setData(result)).catch((requestError) => active && setError(requestError.message));
    return () => { active = false; };
  }, [feature.endpoint, reloadVersion]);
  const rows = rowsFrom(data);
  const keys = rows.length ? Object.keys(rows[0]).filter((key) => typeof rows[0][key] !== "object").slice(0, 10) : [];
  return <AdminLayout activePage={activePage} title={feature.title} subtitle="Tenant-scoped company module" {...layout}>
    {error && <div className="message-panel error" role="alert">{error}</div>}
    {data === null && !error && <section className="admin-panel-card">Loading...</section>}
    {data !== null && !rows.length && <div className="admin-empty-state"><strong>No records yet</strong><span>This company has no {feature.title.toLowerCase()} data.</span></div>}
    {rows.length > 0 && activePage === "admin-website-texts" && <WebsiteTextsPanel language={layout.language} rows={rows} onReload={() => setReloadVersion((value) => value + 1)} />}
    {rows.length > 0 && activePage !== "admin-website-texts" && <div className="admin-table-wrap"><table className="admin-table"><thead><tr>{keys.map((key) => <th key={key}>{key.replaceAll("_", " ")}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={row.id || index}>{keys.map((key) => <td key={key}>{typeof row[key] === "boolean" ? String(row[key]) : textValue(row[key]) || "—"}</td>)}</tr>)}</tbody></table></div>}
  </AdminLayout>;
}

export const featurePageKeys = Object.freeze(Object.keys(features));
