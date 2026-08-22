import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { bookingsApi } from "../../api/bookingsApi";
import type { BookingService, Policy } from "../../types/bookings";
import { paths } from "../paths";
import { Modal, PageHeader, PlusIcon } from "../ui";

export function PoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [services, setServices] = useState<BookingService[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    cancellationHours: 24,
    noShowFeePercent: 50,
  });

  const refresh = async () => {
    const snap = await bookingsApi.load();
    setPolicies(snap.policies);
    setServices(snap.services);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return policies;
    return policies.filter((p) => p.name.toLowerCase().includes(q));
  }, [policies, query]);

  const connectedNames = (policy: Policy) => {
    if (policy.isDefault) return services.map((s) => s.name);
    return [];
  };

  return (
    <div className="bk-page">
      <PageHeader
        title="Booking Policies"
        count={policies.length}
        subtitle={
          <>
            Manage your policies and connect them to different services.{" "}
            <a
              href="https://support.wix.com/en/article/wix-bookings-creating-and-managing-booking-policies"
              target="_blank"
              rel="noreferrer"
            >
              Learn more
            </a>
          </>
        }
        breadcrumb={[
          { label: "Settings", to: paths.settings },
          { label: "Bookings Settings", to: paths.settings },
          { label: "Booking Policies" },
        ]}
        actions={
          <button
            type="button"
            className="bk-btn bk-btn-primary"
            onClick={() => setOpen(true)}
          >
            <PlusIcon />
            Add a New Policy
          </button>
        }
      />

      <div style={{ marginBottom: 8 }}>
        <Link className="bk-btn bk-btn-link" to={paths.settings} style={{ paddingLeft: 0 }}>
          ← Back
        </Link>
      </div>

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
                <th>Policy name</th>
                <th>Connected services</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.name}</strong>
                    {p.isDefault && (
                      <span className="bk-chip bk-chip-blue" style={{ marginLeft: 8 }}>
                        Default
                      </span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {connectedNames(p).map((n) => (
                        <span key={n} className="bk-chip">
                          {n}
                        </span>
                      ))}
                      {connectedNames(p).length === 0 && (
                        <span className="bk-help">No connected services</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="bk-btn bk-btn-link"
                      onClick={() => {
                        setDraft({
                          name: p.name,
                          cancellationHours: p.cancellationHours,
                          noShowFeePercent: p.noShowFeePercent,
                        });
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
                setDraft({ name: "", cancellationHours: 24, noShowFeePercent: 50 });
                setOpen(true);
              }}
            >
              Add a New Policy
            </button>
          </div>
        </div>
      </div>

      {open && (
        <Modal
          title="Add a New Policy"
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
                  await bookingsApi.savePolicy({
                    id: `pol_${Date.now()}`,
                    name: draft.name || "Custom policy",
                    cancellationHours: draft.cancellationHours,
                    noShowFeePercent: draft.noShowFeePercent,
                    isDefault: false,
                  });
                  setOpen(false);
                  await refresh();
                }}
              >
                Save
              </button>
            </>
          }
        >
          <label className="bk-field">
            <span className="bk-label">Name</span>
            <input
              className="bk-input"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label className="bk-field">
            <span className="bk-label">Cancellation hours</span>
            <input
              className="bk-input"
              type="number"
              value={draft.cancellationHours}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  cancellationHours: Number(e.target.value) || 0,
                })
              }
            />
          </label>
          <label className="bk-field">
            <span className="bk-label">No-show fee %</span>
            <input
              className="bk-input"
              type="number"
              value={draft.noShowFeePercent}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  noShowFeePercent: Number(e.target.value) || 0,
                })
              }
            />
          </label>
        </Modal>
      )}
    </div>
  );
}
