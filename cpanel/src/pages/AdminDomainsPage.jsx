import React from "react";
import { Globe, Plus, ShieldAlert, Trash2 } from "lucide-react";
import AdminLayout from "../components/AdminLayout.jsx";
import { fetchPlatformCompanies } from "../utils/platformCompaniesApi.js";
import { apiRequest } from "../utils/api.js";

const emptyForm = {
  company_id: "",
  domain: "",
  is_primary: false,
  is_active: true,
  is_verified: false,
};

function AdminDomainsPage({
  activePage,
  company,
  currentUser,
  language,
  modules,
  onLogout,
  onNavigate,
  onLanguageChange,
  onReturnToPlatform,
  onSwitchCompany,
  isDarkMode,
  onToggleDarkMode,
}) {
  const [accessDenied, setAccessDenied] = React.useState(false);
  const [domains, setDomains] = React.useState([]);
  const [companies, setCompanies] = React.useState([]);
  const [busy, setBusy] = React.useState(true);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [form, setForm] = React.useState(emptyForm);
  const [editingId, setEditingId] = React.useState(null);
  const [showForm, setShowForm] = React.useState(false);

  React.useEffect(() => {
    if ((currentUser?.globalRole || currentUser?.role) !== "super_admin") {
      setAccessDenied(true);
      return;
    }
    load();
  }, [currentUser]);

  async function load() {
    setBusy(true);
    setError("");
    try {
      const [domainsData, companiesData] = await Promise.all([
        apiRequest("/platform/domains"),
        fetchPlatformCompanies(),
      ]);
      setDomains(Array.isArray(domainsData) ? domainsData : []);
      setCompanies(Array.isArray(companiesData) ? companiesData : []);
    } catch (err) {
      setError(err?.message || "Failed to load domains.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setError("");
    setSuccess("");
    if (!form.company_id) {
      setError("Select a company.");
      return;
    }
    if (!form.domain.trim()) {
      setError("Hostname is required.");
      return;
    }

    setBusy(true);
    try {
      const method = editingId ? "PATCH" : "POST";
      const path = editingId
        ? `/platform/domains/${encodeURIComponent(editingId)}`
        : "/platform/domains";
      await apiRequest(path, { method, body: JSON.stringify(form) });
      setSuccess(editingId ? "Domain updated." : "Domain added.");
      setForm(emptyForm);
      setEditingId(null);
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err?.message || "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    if (!window.confirm("Delete this domain record?")) return;
    setError("");
    setSuccess("");
    setBusy(true);
    try {
      await apiRequest(`/platform/domains/${encodeURIComponent(id)}`, { method: "DELETE" });
      setSuccess("Domain deleted.");
      if (editingId === id) {
        setForm(emptyForm);
        setEditingId(null);
        setShowForm(false);
      }
      await load();
    } catch (err) {
      setError(err?.message || "Delete failed.");
    } finally {
      setBusy(false);
    }
  }

  function edit(entry) {
    setForm({
      company_id: entry.company_id,
      domain: entry.domain,
      is_primary: entry.is_primary,
      is_active: entry.is_active,
      is_verified: entry.is_verified,
    });
    setEditingId(entry.id);
    setShowForm(true);
    setError("");
    setSuccess("");
  }

  function cancel() {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setError("");
  }

  if (accessDenied) {
    return (
      <AdminLayout
        {...{
          activePage,
          company,
          currentUser,
          language,
          modules,
          onLogout,
          onNavigate,
          onLanguageChange,
          onReturnToPlatform,
          onSwitchCompany,
          isDarkMode,
          onToggleDarkMode,
        }}
      >
        <div className="admin-access-denied">
          <ShieldAlert size={48} />
          <h2>Access Denied</h2>
          <p>Super Admin access required.</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      {...{
        activePage,
        company,
        currentUser,
        language,
        modules,
        onLogout,
        onNavigate,
        onLanguageChange,
        onReturnToPlatform,
        onSwitchCompany,
        isDarkMode,
        onToggleDarkMode,
      }}
    >
      <div className="admin-page-header">
        <div>
          <h1>
            <Globe size={24} /> Storefront Domains
          </h1>
          <p>Manage company domain mappings for tenant resolution.</p>
        </div>
        {!showForm && (
          <button
            className="admin-primary-button"
            onClick={() => {
              setForm(emptyForm);
              setEditingId(null);
              setShowForm(true);
            }}
            type="button"
          >
            <Plus size={16} /> Add domain
          </button>
        )}
      </div>

      {error && (
        <div className="admin-message admin-message-error" onClick={() => setError("")}>
          {error}
        </div>
      )}
      {success && (
        <div className="admin-message admin-message-success" onClick={() => setSuccess("")}>
          {success}
        </div>
      )}

      {showForm && (
        <section className="admin-panel-card">
          <div className="admin-section-head">
            <div>
              <h2>{editingId ? "Edit domain" : "Add domain"}</h2>
            </div>
          </div>
          <div className="admin-form-grid">
            <label>
              Company
              <select
                value={form.company_id}
                onChange={(e) => setForm({ ...form, company_id: e.target.value })}
              >
                <option value="">-- Select company --</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.id})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Hostname
              <input
                type="text"
                placeholder="storefront.vercel.app"
                value={form.domain}
                onChange={(e) => setForm({ ...form, domain: e.target.value })}
              />
            </label>
            <label className="admin-checkbox-label">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />{" "}
              Active
            </label>
            <label className="admin-checkbox-label">
              <input
                type="checkbox"
                checked={form.is_verified}
                onChange={(e) => setForm({ ...form, is_verified: e.target.checked })}
              />{" "}
              Verified
            </label>
            <label className="admin-checkbox-label">
              <input
                type="checkbox"
                checked={form.is_primary}
                onChange={(e) => setForm({ ...form, is_primary: e.target.checked })}
              />{" "}
              Primary
            </label>
          </div>
          <div className="form-actions">
            <button className="secondary-action" disabled={busy} onClick={cancel} type="button">
              Cancel
            </button>
            <button className="admin-primary-button" disabled={busy} onClick={save} type="button">
              {busy ? "Saving..." : editingId ? "Update" : "Add domain"}
            </button>
          </div>
        </section>
      )}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Domain</th>
              <th>Company</th>
              <th>Active</th>
              <th>Verified</th>
              <th>Primary</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {busy && !domains.length ? (
              <tr>
                <td colSpan="6">Loading domains...</td>
              </tr>
            ) : !domains.length ? (
              <tr>
                <td colSpan="6">No domain records configured.</td>
              </tr>
            ) : (
              domains.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    <code>{entry.domain}</code>
                  </td>
                  <td>{entry.company_name || entry.company_id}</td>
                  <td>{entry.is_active ? "Yes" : "No"}</td>
                  <td>{entry.is_verified ? "Yes" : "No"}</td>
                  <td>{entry.is_primary ? "Yes" : "No"}</td>
                  <td className="admin-table-actions">
                    <button
                      className="secondary-action"
                      disabled={busy}
                      onClick={() => edit(entry)}
                      type="button"
                    >
                      Edit
                    </button>
                    <button
                      className="danger-action"
                      disabled={busy}
                      onClick={() => remove(entry.id)}
                      type="button"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}

export default AdminDomainsPage;
