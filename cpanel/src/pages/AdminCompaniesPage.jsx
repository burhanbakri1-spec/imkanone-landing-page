import React from "react";
import { Building2, ExternalLink, Pencil, Plus, Settings, ShieldAlert, Users } from "lucide-react";
import AdminLayout from "../components/AdminLayout.jsx";
import CompanyMembershipsPanel from "../components/CompanyMembershipsPanel.jsx";

import {
  createPlatformCompany,
  disablePlatformCompany,
  fetchCompanyModules,
  fetchPlatformCompanies,
  restoreCompanyModules,
  updateCompanyModules,
  updatePlatformCompany,
} from "../utils/platformCompaniesApi.js";

const emptyForm = {
  name: "",
  slug: "",
  domain: "",
  storefrontUrl: "",
  storefrontPath: "",
  status: "draft",
  settings: {
    currency: "",
    language: "",
    supportEmail: "",
    supportPhone: "",
  },
};

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function CompanyModulesPanel({ company, onClose, onError, onSuccess }) {
  const [modules, setModules] = React.useState([]);
  const [busy, setBusy] = React.useState(true);
  React.useEffect(() => {
    let active = true;
    setBusy(true);
    fetchCompanyModules(company.id)
      .then((response) => active && setModules((response.modules || []).map((module) => ({ ...module, configurationText: JSON.stringify(module.configuration_override || module.configuration || {}) }))))
      .catch(onError)
      .finally(() => active && setBusy(false));
    return () => { active = false; };
  }, [company.id]);

  async function save() {
    setBusy(true);
    try {
      const normalized = modules.map((module) => {
        let configuration;
        try { configuration = JSON.parse(module.configurationText || "{}"); }
        catch { throw new Error(`${module.label_en} configuration must be valid JSON.`); }
        if (!configuration || typeof configuration !== "object" || Array.isArray(configuration)) throw new Error(`${module.label_en} configuration must be a JSON object.`);
        return {
          module_key: module.module_key,
          enabled: module.enabled !== false,
          sort_order: Number(module.sort_order || 0),
          label_en_override: module.label_en_override || null,
          label_ar_override: module.label_ar_override || null,
          configuration_override: configuration,
        };
      });
      const response = await updateCompanyModules(company.id, normalized);
      setModules((response.modules || []).map((module) => ({ ...module, configurationText: JSON.stringify(module.configuration_override || module.configuration || {}) })));
      onSuccess("Company modules updated.");
    } catch (error) { onError(error); } finally { setBusy(false); }
  }

  async function restore() {
    if (!window.confirm(`Restore the default module set for ${company.name}?`)) return;
    setBusy(true);
    try {
      const response = await restoreCompanyModules(company.id);
      setModules((response.modules || []).map((module) => ({ ...module, configurationText: JSON.stringify(module.configuration_override || module.configuration || {}) })));
      onSuccess("Default modules restored.");
    } catch (error) { onError(error); } finally { setBusy(false); }
  }

  return (
    <section className="admin-panel-card">
      <div className="admin-section-head">
        <div><h2>Manage modules — {company.name}</h2><p>Disabled modules disappear from navigation and are blocked by server-side API guards.</p></div>
        <button className="secondary-action" onClick={onClose} type="button">Close</button>
      </div>
      {busy && !modules.length ? <p>Loading modules...</p> : (
        <div className="admin-table-wrap"><table className="admin-table">
          <thead><tr><th>Enabled</th><th>Group</th><th>Module</th><th>Route</th><th>Order</th><th>Company configuration</th></tr></thead>
          <tbody>{modules.map((module, index) => (
            <tr key={module.module_key}>
              <td><input aria-label={`Enable ${module.label_en}`} checked={module.enabled !== false} onChange={(event) => setModules((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, enabled: event.target.checked } : item))} type="checkbox" /></td>
              <td>{module.group_key}</td><td><strong>{module.label_en}</strong><br /><small>{module.label_ar}</small></td><td><code>{module.route}</code></td>
              <td><input aria-label={`Order ${module.label_en}`} min="0" onChange={(event) => setModules((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, sort_order: Number(event.target.value) } : item))} type="number" value={module.sort_order} /></td>
              <td><textarea aria-label={`Configuration ${module.label_en}`} onChange={(event) => setModules((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, configurationText: event.target.value } : item))} rows="2" value={module.configurationText || "{}"} /></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      <div className="form-actions"><button className="secondary-action" disabled={busy} onClick={restore} type="button">Restore defaults</button><button className="admin-primary-button" disabled={busy} onClick={save} type="button">{busy ? "Saving..." : "Save modules"}</button></div>
    </section>
  );
}

function cloneForm(company = emptyForm) {
  return {
    name: company.name || "",
    slug: company.slug || "",
    domain: company.domain || "",
    storefrontUrl: company.storefrontUrl || "",
    storefrontPath: company.storefrontPath || "",
    status: company.status || "draft",
    settings: {
      currency: company.settings?.currency || "",
      language: company.settings?.language || "",
      supportEmail: company.settings?.supportEmail || "",
      supportPhone: company.settings?.supportPhone || "",
    },
  };
}

function validateCompany(form) {
  if (!form.name.trim()) return "Company name is required.";
  if (form.slug && !slugPattern.test(form.slug)) {
    return "Slug must use lowercase letters, numbers, and single hyphens only.";
  }
  if (!["draft", "inactive", "active"].includes(form.status)) {
    return "Select a valid company status.";
  }
  if (form.storefrontUrl) {
    try {
      if (new URL(form.storefrontUrl).protocol !== "https:") {
        return "Storefront URL must use HTTPS.";
      }
    } catch {
      return "Storefront URL must be a valid HTTPS URL.";
    }
  }
  if (form.storefrontPath) {
    const isSafePath = /^\/(?!\/)(?:[A-Za-z0-9._~-]+\/?)*$/.test(form.storefrontPath)
      && !form.storefrontPath.split("/").some((segment) => segment === "." || segment === "..");
    if (!isSafePath) return "Storefront path must be a safe path beginning with /.";
  }
  return "";
}

function CompanyForm({ company, form, isSaving, onCancel, onChange, onSubmit }) {
  const isEditing = Boolean(company);

  return (
    <section className="admin-panel-card company-editor-card">
      <div className="admin-section-head">
        <div>
          <h2>{isEditing ? `Edit ${company.name}` : "Create company draft"}</h2>
          <p>Storefront metadata does not assign DNS ownership or change tenant routing.</p>
        </div>
      </div>
      <form className="admin-form company-form" onSubmit={onSubmit}>
        <label>
          Company name
          <input
            autoComplete="organization"
            name="name"
            onChange={onChange}
            required
            value={form.name}
          />
        </label>
        <label>
          Slug
          <input
            disabled={company?.isDefault}
            name="slug"
            onChange={onChange}
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            placeholder="new-company"
            value={form.slug}
          />
        </label>
        <label>
          Domain
          <input
            autoCapitalize="none"
            name="domain"
            onChange={onChange}
            placeholder="company.example.com"
            value={form.domain}
          />
        </label>
        <label>
          Storefront URL
          <input
            autoCapitalize="none"
            name="storefrontUrl"
            onChange={onChange}
            placeholder="https://example.com/company"
            type="url"
            value={form.storefrontUrl}
          />
        </label>
        <label>
          Storefront path
          <input
            autoCapitalize="none"
            name="storefrontPath"
            onChange={onChange}
            placeholder="/company"
            value={form.storefrontPath}
          />
        </label>
        <label>
          Status
          <select
            disabled={company?.isDefault}
            name="status"
            onChange={onChange}
            value={form.status}
          >
            <option value="draft">Draft</option>
            <option value="inactive">Inactive</option>
            <option value="active">Active</option>
          </select>
        </label>
        <label>
          Currency
          <input
            name="settings.currency"
            onChange={onChange}
            placeholder="USD"
            value={form.settings.currency}
          />
        </label>
        <label>
          Language
          <input
            name="settings.language"
            onChange={onChange}
            placeholder="en"
            value={form.settings.language}
          />
        </label>
        <label>
          Support email
          <input
            name="settings.supportEmail"
            onChange={onChange}
            type="email"
            value={form.settings.supportEmail}
          />
        </label>
        <label>
          Support phone
          <input
            name="settings.supportPhone"
            onChange={onChange}
            value={form.settings.supportPhone}
          />
        </label>
        <div className="form-actions full-field">
          <button className="secondary-action" disabled={isSaving} onClick={onCancel} type="button">
            Cancel
          </button>
          <button className="admin-primary-button" disabled={isSaving} type="submit">
            {isSaving ? "Saving..." : isEditing ? "Save changes" : "Create draft"}
          </button>
        </div>
      </form>
    </section>
  );
}

function AddCompanyDialog({ open, onOpenChange, onCreated, onError }) {
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [status, setStatus] = React.useState("draft");
  const [currency, setCurrency] = React.useState("");
  const [language, setLanguage] = React.useState("");
  const [storefrontUrl, setStorefrontUrl] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState("");

  function close() {
    setName("");
    setSlug("");
    setStatus("draft");
    setCurrency("");
    setLanguage("");
    setStorefrontUrl("");
    setErrorMessage("");
    setSaving(false);
    onOpenChange(false);
  }

  function validate() {
    if (!name.trim()) { setErrorMessage("Company name is required."); return false; }
    if (slug && !slugPattern.test(slug)) { setErrorMessage("Slug must use lowercase letters, numbers, and hyphens only."); return false; }
    if (!["draft", "inactive", "active"].includes(status)) { setErrorMessage("Select a valid company status."); return false; }
    if (storefrontUrl) {
      try {
        if (new URL(storefrontUrl).protocol !== "https:") { setErrorMessage("Storefront URL must use HTTPS."); return false; }
      } catch {
        setErrorMessage("Storefront URL must be a valid HTTPS URL.");
        return false;
      }
    }
    if (currency && !/^[A-Z]{3}$/.test(currency)) { setErrorMessage("Currency must be a 3-letter code (e.g. USD)."); return false; }
    if (language && !/^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(language)) { setErrorMessage("Language must be a locale code (e.g. en)."); return false; }
    return true;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage("");
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        slug: slug.trim() || undefined,
        status,
        storefrontUrl: storefrontUrl.trim() || undefined,
        settings: Object.fromEntries(
          Object.entries({ currency: currency.trim(), language: language.trim() })
            .filter(([, v]) => v),
        ),
      };
      const company = await createPlatformCompany(payload);
      onCreated(company);
      close();
    } catch (requestError) {
      setErrorMessage(requestError.message || "Unable to create company.");
      if (onError) onError(requestError);
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="admin-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <section className="admin-modal">
        <div className="admin-section-head">
          <div>
            <h2>Add Company</h2>
            <p>Create a new company record. You can configure modules and members after creation.</p>
          </div>
          <button className="text-action" onClick={close} type="button">
            Close
          </button>
        </div>
        {errorMessage && (
          <div className="message-panel error" role="alert">{errorMessage}</div>
        )}
        <form className="admin-form company-form" onSubmit={handleSubmit}>
          <label>
            Company name
            <input
              autoComplete="organization"
              onChange={(e) => setName(e.target.value)}
              required
              value={name}
            />
          </label>
          <label>
            Company slug / ID
            <input
              onChange={(e) => setSlug(e.target.value)}
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              placeholder="new-company"
              value={slug}
            />
            <small>Auto-generated from name if left blank.</small>
          </label>
          <label>
            Status
            <select onChange={(e) => setStatus(e.target.value)} value={status}>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <label>
            Currency
            <input
              onChange={(e) => setCurrency(e.target.value)}
              placeholder="USD"
              value={currency}
            />
          </label>
          <label>
            Language
            <input
              onChange={(e) => setLanguage(e.target.value)}
              placeholder="en"
              value={language}
            />
          </label>
          <label>
            Storefront URL
            <input
              onChange={(e) => setStorefrontUrl(e.target.value)}
              placeholder="https://example.com/company"
              type="url"
              value={storefrontUrl}
            />
          </label>
          <div className="form-actions full-field">
            <button className="secondary-action" disabled={saving} onClick={close} type="button">
              Cancel
            </button>
            <button className="admin-primary-button" disabled={saving} type="submit">
              {saving ? "Creating..." : "Create company"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function AccessDenied() {
  return (
    <section className="admin-panel-card company-access-denied" role="alert">
      <ShieldAlert size={28} />
      <div>
        <h2>Access denied</h2>
        <p>Only an explicitly provisioned Super Admin can manage platform companies.</p>
      </div>
    </section>
  );
}

function AdminCompaniesPage({
  currentUser,
  isDarkMode,
  language,
  onLanguageChange,
  onLogout,
  onNavigate,
  onSwitchCompany,
  onToggleDarkMode,
}) {
  const [companies, setCompanies] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(currentUser?.role === "super_admin");
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [accessDenied, setAccessDenied] = React.useState(currentUser?.role !== "super_admin");
  const [editorCompany, setEditorCompany] = React.useState(null);
  const [selectedCompanyId, setSelectedCompanyId] = React.useState("");
  const [modulesCompany, setModulesCompany] = React.useState(null);
  const [form, setForm] = React.useState(cloneForm());
  const [addDialogOpen, setAddDialogOpen] = React.useState(false);
  const onLogoutRef = React.useRef(onLogout);

  React.useEffect(() => {
    onLogoutRef.current = onLogout;
  }, [onLogout]);

  React.useEffect(() => {
    let active = true;

    if (currentUser?.role !== "super_admin") {
      setAccessDenied(true);
      setIsLoading(false);
      return () => {
        active = false;
      };
    }

    setAccessDenied(false);

    async function load() {
      try {
        const result = await fetchPlatformCompanies();
        if (active) {
          setCompanies(result);
          setSelectedCompanyId((current) =>
            result.some((company) => company.id === current) ? current : result[0]?.id || "",
          );
        }
      } catch (requestError) {
        if (!active) return;
        if (requestError.status === 401) {
          void onLogoutRef.current();
        } else if (requestError.status === 403) {
          setAccessDenied(true);
        } else {
          setError(requestError.message || "Unable to load companies.");
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [currentUser?.role]);

  function beginCreate() {
    setEditorCompany(null);
    setForm(cloneForm());
    setError("");
    setSuccess("");
  }

  function beginEdit(company) {
    setEditorCompany(company);
    setForm(cloneForm(company));
    setError("");
    setSuccess("");
  }

  function changeForm(event) {
    const { name, value } = event.target;
    if (name.startsWith("settings.")) {
      const settingName = name.slice("settings.".length);
      setForm((current) => ({
        ...current,
        settings: { ...current.settings, [settingName]: value },
      }));
      return;
    }
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submitCompany(event) {
    event.preventDefault();
    const validationError = validateCompany(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      domain: form.domain.trim(),
      storefrontUrl: form.storefrontUrl.trim(),
      storefrontPath: form.storefrontPath.trim(),
      status: form.status,
      settings: Object.fromEntries(
        Object.entries(form.settings).filter(([, value]) => String(value).trim()),
      ),
    };

    setIsSaving(true);
    setError("");
    setSuccess("");
    try {
      const saved = editorCompany
        ? await updatePlatformCompany(editorCompany.id, payload)
        : await createPlatformCompany(payload);
      setCompanies((current) => {
        const exists = current.some((company) => company.id === saved.id);
        return exists
          ? current.map((company) => (company.id === saved.id ? saved : company))
          : [...current, saved];
      });
      setSuccess(editorCompany ? "Company updated." : "Company draft created.");
      setSelectedCompanyId(saved.id);
      setEditorCompany(null);
      setForm(cloneForm());
    } catch (requestError) {
      if (requestError.status === 401) void onLogout();
      else if (requestError.status === 403) setAccessDenied(true);
      else setError(requestError.message || "Unable to save company.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleDialogCreated(company) {
    setCompanies((current) => {
      const exists = current.some((c) => c.id === company.id);
      return exists ? current.map((c) => (c.id === company.id ? company : c)) : [...current, company];
    });
    setSelectedCompanyId(company.id);
    setSuccess("Company created.");
    setError("");
  }

  async function disableCompany(company) {
    if (company.isDefault) return;
    if (!window.confirm(`Disable ${company.name}? Its public resolution remains unavailable.`)) {
      return;
    }

    setIsSaving(true);
    setError("");
    setSuccess("");
    try {
      const saved = await disablePlatformCompany(company.id);
      setCompanies((current) => current.map((item) => (item.id === saved.id ? saved : item)));
      setSuccess(`${company.name} disabled.`);
      if (editorCompany?.id === company.id) {
        setEditorCompany(saved);
        setForm(cloneForm(saved));
      }
    } catch (requestError) {
      if (requestError.status === 401) void onLogout();
      else if (requestError.status === 403) setAccessDenied(true);
      else setError(requestError.message || "Unable to disable company.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AdminLayout
      activePage="admin-platform-companies"
      currentUser={currentUser}
      isDarkMode={isDarkMode}
      language={language}
      onLanguageChange={onLanguageChange}
      onLogout={onLogout}
      onNavigate={onNavigate}
      onToggleDarkMode={onToggleDarkMode}
      subtitle="Manage company records without enabling public tenant switching."
      title="Companies"
    >
      {accessDenied ? (
        <AccessDenied />
      ) : (
        <div className="company-management-page">
          <div className="admin-toolbar company-toolbar">
            <div>
              <strong>Platform companies</strong>
              <span>{companies.length} total</span>
            </div>
            <button className="admin-primary-button" onClick={() => setAddDialogOpen(true)} type="button">
              <Plus size={15} />
              Add Company
            </button>
          </div>

          {error && (
            <div className="message-panel error" role="alert">
              {error}
            </div>
          )}
          {success && (
            <div className="message-panel success" role="status">
              {success}
            </div>
          )}

          {isLoading ? (
            <section className="admin-panel-card company-loading" aria-busy="true">
              Loading companies...
            </section>
          ) : companies.length ? (
            <div className="admin-table-wrap">
              <table className="admin-table company-table">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>ID</th>
                    <th>Slug</th>
                    <th>Status</th>
                    <th>Domain</th>
                    <th>Storefront</th>
                    <th>Default</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((company) => (
                    <tr key={company.id}>
                      <td>
                        <strong>{company.name}</strong>
                      </td>
                      <td>
                        <code>{company.id}</code>
                      </td>
                      <td>{company.slug || "-"}</td>
                      <td>
                        <span
                          className={`admin-status-pill ${company.status === "active" ? "active" : company.status === "draft" ? "warning" : "neutral"}`}
                        >
                          {company.status}
                        </span>
                      </td>
                      <td>{company.domain || "Not assigned"}</td>
                      <td>
                        {company.storefrontUrl ? (
                          <a href={company.storefrontUrl} rel="noreferrer" target="_blank">
                            {company.storefrontPath || company.storefrontUrl}
                          </a>
                        ) : (
                          "Not assigned"
                        )}
                      </td>
                      <td>
                        {company.isDefault ? (
                          <span className="admin-status-pill active">Default</span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td>
                        <div className="company-row-actions">
                          <button className="text-action" disabled={company.status !== "active"} onClick={() => onSwitchCompany(company.id)} type="button">
                            <ExternalLink size={14} /> Open CPanel
                          </button>
                          <button className="text-action" onClick={() => setModulesCompany(company)} type="button">
                            <Settings size={14} /> Manage Modules
                          </button>
                          <button
                            className="text-action"
                            onClick={() => beginEdit(company)}
                            type="button"
                          >
                            <Pencil size={14} /> Edit
                          </button>
                          <button
                            className="text-action"
                            onClick={() => setSelectedCompanyId(company.id)}
                            type="button"
                          >
                            <Users size={14} /> Members
                          </button>
                          {!company.isDefault && company.status !== "inactive" && (
                            <button
                              className="text-action company-disable-button"
                              disabled={isSaving}
                              onClick={() => disableCompany(company)}
                              type="button"
                            >
                              Disable
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="admin-empty-state">
              <Building2 size={24} />
              <strong>No companies found</strong>
              <span>Create a draft company to begin configuration.</span>
            </div>
          )}

          <CompanyMembershipsPanel
            companies={companies}
            onForbidden={() => setAccessDenied(true)}
            onSelectCompany={setSelectedCompanyId}
            onUnauthorized={() => void onLogout()}
            selectedCompanyId={selectedCompanyId}
          />

          {modulesCompany && <CompanyModulesPanel
            company={modulesCompany}
            onClose={() => setModulesCompany(null)}
            onError={(requestError) => setError(requestError.message || "Unable to manage modules.")}
            onSuccess={(message) => { setError(""); setSuccess(message); }}
          />}

          {editorCompany && (
            <CompanyForm
              company={editorCompany}
              form={form}
              isSaving={isSaving}
              onCancel={beginCreate}
              onChange={changeForm}
              onSubmit={submitCompany}
            />
          )}
          <AddCompanyDialog
            onCreated={handleDialogCreated}
            onError={(requestError) => {
              if (requestError.status === 401) void onLogout();
              else if (requestError.status === 403) setAccessDenied(true);
              else setError(requestError.message || "Unable to create company.");
            }}
            onOpenChange={setAddDialogOpen}
            open={addDialogOpen}
          />
        </div>
      )}
    </AdminLayout>
  );
}

export default AdminCompaniesPage;
