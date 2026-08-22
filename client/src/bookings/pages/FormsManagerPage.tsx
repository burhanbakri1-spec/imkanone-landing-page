import { useEffect, useMemo, useState } from "react";
import { bookingsApi } from "../../api/bookingsApi";
import type { BookingFormDef, BookingService } from "../../types/bookings";
import { paths } from "../paths";
import { Modal, PageHeader, PlusIcon } from "../ui";

export function FormsManagerPage() {
  const [forms, setForms] = useState<BookingFormDef[]>([]);
  const [services, setServices] = useState<BookingService[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const refresh = async () => {
    const snap = await bookingsApi.load();
    setForms(snap.forms);
    setServices(snap.services);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return forms;
    return forms.filter((f) => f.name.toLowerCase().includes(q));
  }, [forms, query]);

  const connectedNames = (form: BookingFormDef) => {
    if (form.isDefault) return services.map((s) => s.name);
    return [];
  };

  return (
    <div className="bk-page">
      <PageHeader
        title="Booking Form"
        count={forms.length}
        subtitle={
          <>
            Customize and manage the form that clients fill out when booking online. You can
            create new forms tailored to specific service needs.{" "}
            <a
              href="https://support.wix.com/en/article/wix-bookings-customizing-your-booking-form"
              target="_blank"
              rel="noreferrer"
            >
              Learn more
            </a>
          </>
        }
        breadcrumb={[
          { label: "Settings", to: paths.settings },
          { label: "Booking Settings", to: paths.settings },
          { label: "Booking Form" },
        ]}
        actions={
          <button
            type="button"
            className="bk-btn bk-btn-primary"
            onClick={() => setOpen(true)}
          >
            <PlusIcon />
            Create New Form
          </button>
        }
      />

      <div className="bk-card">
        <div className="bk-toolbar">
          <div className="bk-toolbar-right" style={{ marginLeft: "auto" }}>
            <div className="bk-search">
              <input
                className="bk-input"
                placeholder="Search..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="bk-table-wrap">
          <table className="bk-table">
            <thead>
              <tr>
                <th>Form</th>
                <th>Connected services</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => (
                <tr key={f.id}>
                  <td>
                    <strong>{f.name}</strong>
                    {f.isDefault && (
                      <span className="bk-chip bk-chip-blue" style={{ marginLeft: 8 }}>
                        DEFAULT
                      </span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {connectedNames(f).map((n) => (
                        <span key={n} className="bk-chip">
                          {n}
                        </span>
                      ))}
                      {connectedNames(f).length === 0 && (
                        <span className="bk-help">No connected services</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="bk-btn bk-btn-link"
                      onClick={() => {
                        setName(f.name);
                        setOpen(true);
                      }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="bk-card-pad" style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="bk-help" role="status">
              {filtered.length} result{filtered.length === 1 ? "" : "s"} found
            </span>
            <button
              type="button"
              className="bk-btn bk-btn-primary"
              onClick={() => {
                setName("");
                setOpen(true);
              }}
            >
              Create New Form
            </button>
          </div>
        </div>
      </div>

      {open && (
        <Modal
          title="Create New Form"
          onClose={() => setOpen(false)}
          footer={
            <>
              <button type="button" className="bk-btn bk-btn-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="bk-btn bk-btn-primary"
                onClick={async () => {
                  await bookingsApi.saveForm({
                    id: `form_${Date.now()}`,
                    name: name || "Custom form",
                    fields: ["Name", "Email", "Phone"],
                    isDefault: false,
                  });
                  setOpen(false);
                  setName("");
                  await refresh();
                }}
              >
                Save
              </button>
            </>
          }
        >
          <label className="bk-field">
            <span className="bk-label">Form name</span>
            <input
              className="bk-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        </Modal>
      )}
    </div>
  );
}
