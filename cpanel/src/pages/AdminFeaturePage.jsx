import React from "react";
import AdminLayout from "../components/AdminLayout.jsx";
import { apiRequest } from "../utils/api.js";

const features = {
  "admin-website-texts": { title: "Website texts", endpoint: "/admin/website-texts" },
  "admin-invoices": { title: "Invoices", endpoint: "/admin/invoices" },
  "admin-delivery": { title: "Delivery zones", endpoint: "/admin/delivery-zones" },
  "admin-product-settings": { title: "Product settings", endpoint: "/admin/product-schema" },
  "admin-reports": { title: "Reports", endpoint: "/admin/reports/summary" },
  "admin-activity-log": { title: "Activity log", endpoint: "/admin/activity-log" },
  "admin-unit-creator": { title: "Unit creator", endpoint: "/admin/custom-modules" },
};

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
  React.useEffect(() => {
    let active = true;
    setData(null); setError("");
    apiRequest(feature.endpoint).then((result) => active && setData(result)).catch((requestError) => active && setError(requestError.message));
    return () => { active = false; };
  }, [feature.endpoint]);
  const rows = rowsFrom(data);
  const keys = rows.length ? Object.keys(rows[0]).filter((key) => typeof rows[0][key] !== "object").slice(0, 10) : [];
  return <AdminLayout activePage={activePage} title={feature.title} subtitle="Tenant-scoped company module" {...layout}>
    {error && <div className="message-panel error" role="alert">{error}</div>}
    {data === null && !error && <section className="admin-panel-card">Loading...</section>}
    {data !== null && !rows.length && <div className="admin-empty-state"><strong>No records yet</strong><span>This company has no {feature.title.toLowerCase()} data.</span></div>}
    {rows.length > 0 && <div className="admin-table-wrap"><table className="admin-table"><thead><tr>{keys.map((key) => <th key={key}>{key.replaceAll("_", " ")}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={row.id || index}>{keys.map((key) => <td key={key}>{typeof row[key] === "boolean" ? String(row[key]) : String(row[key] ?? "")}</td>)}</tr>)}</tbody></table></div>}
  </AdminLayout>;
}

export const featurePageKeys = Object.freeze(Object.keys(features));
