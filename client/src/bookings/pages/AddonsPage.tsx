import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { bookingsApi } from "../../api/bookingsApi";
import type { AddonItem } from "../../types/bookings";
import { paths } from "../paths";
import { Modal, PageHeader, PlusIcon } from "../ui";

export function AddonsPage() {
  const [addons, setAddons] = useState<AddonItem[]>([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ name: "", price: 0, durationMinutes: 15 });

  const refresh = async () => {
    const snap = await bookingsApi.load();
    setAddons(snap.addons);
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="bk-page">
      <PageHeader
        title="Add-ons"
        count={addons.length}
        subtitle={
          <>
            Create and manage the add-ons you offer for your services.{" "}
            <a
              href="https://support.wix.com/en/article/wix-bookings-creating-and-managing-add-ons"
              target="_blank"
              rel="noreferrer"
            >
              Learn more
            </a>
          </>
        }
        breadcrumb={[
          { label: "Booking Settings", to: paths.settings },
          { label: "Add-ons" },
        ]}
        actions={
          <button
            type="button"
            className="bk-btn bk-btn-primary"
            onClick={() => setOpen(true)}
          >
            <PlusIcon />
            Create Add-on
          </button>
        }
      />

      <div className="bk-card">
        {addons.length === 0 ? (
          <div className="bk-empty">
            <h2>Start offering add-ons with your services</h2>
            <p>
              Let your clients customize their booking with add-ons like products,
              extended time, or extras.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Link className="bk-btn bk-btn-secondary" to={paths.services}>
                Go to Services
              </Link>
              <button
                type="button"
                className="bk-btn bk-btn-primary"
                onClick={() => setOpen(true)}
              >
                Create New Add-On
              </button>
            </div>
          </div>
        ) : (
          <div className="bk-table-wrap">
            <table className="bk-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Duration</th>
                  <th>Price</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {addons.map((a) => (
                  <tr key={a.id}>
                    <td>{a.name}</td>
                    <td>{a.durationMinutes} min</td>
                    <td>${a.price.toFixed(2)}</td>
                    <td>
                      <span className={`bk-chip ${a.active ? "bk-chip-green" : ""}`}>
                        {a.active ? "Active" : "Off"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {open && (
        <Modal
          title="Create Add-on"
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
                  await bookingsApi.saveAddon({
                    id: `addon_${Date.now()}`,
                    name: draft.name || "New add-on",
                    price: draft.price,
                    durationMinutes: draft.durationMinutes,
                    active: true,
                  });
                  setOpen(false);
                  setDraft({ name: "", price: 0, durationMinutes: 15 });
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
            <span className="bk-label">Price</span>
            <input
              className="bk-input"
              type="number"
              value={draft.price}
              onChange={(e) =>
                setDraft({ ...draft, price: Number(e.target.value) || 0 })
              }
            />
          </label>
          <label className="bk-field">
            <span className="bk-label">Duration (minutes)</span>
            <input
              className="bk-input"
              type="number"
              value={draft.durationMinutes}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  durationMinutes: Number(e.target.value) || 0,
                })
              }
            />
          </label>
          <p className="bk-help">
            After saving, attach add-ons on a <Link to={paths.services}>service</Link>.
          </p>
        </Modal>
      )}
    </div>
  );
}
