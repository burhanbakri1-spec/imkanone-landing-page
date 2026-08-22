import { useEffect, useMemo, useState } from "react";
import { bookingsApi } from "../../api/bookingsApi";
import type { ResourceRoom } from "../../types/bookings";
import { paths } from "../paths";
import { Modal, PageHeader, PlusIcon } from "../ui";

export function ResourcesPage() {
  const [resources, setResources] = useState<ResourceRoom[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    type: "room" as ResourceRoom["type"],
    capacity: 1,
    locationName: "Main Studio",
  });

  const refresh = async () => {
    const snap = await bookingsApi.load();
    setResources(snap.resources);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return resources;
    return resources.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.type.toLowerCase().includes(q) ||
        r.locationName.toLowerCase().includes(q),
    );
  }, [resources, query]);

  return (
    <div className="bk-page">
      <PageHeader
        title="Resources"
        subtitle={
          <>
            Organize your items and spaces into categories and link them to offerings in your catalog.{" "}
            <a
              href="https://support.wix.com/en/article/wix-bookings-creating-resources"
              target="_blank"
              rel="noreferrer"
            >
              Learn more
            </a>
          </>
        }
        breadcrumb={[
          { label: "Booking Settings", to: paths.settings },
          { label: "Resources & rooms" },
        ]}
        actions={
          <button
            type="button"
            className="bk-btn bk-btn-primary"
            onClick={() => setOpen(true)}
          >
            <PlusIcon />
            Create Resource Category
          </button>
        }
      />

      <div className="bk-card">
        <div className="bk-toolbar">
          <div className="bk-toolbar-left">
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

        {filtered.length === 0 ? (
          <div className="bk-empty">
            <h2>Add your first item</h2>
            <p>Once you have items, they&apos;ll appear here.</p>
            <p className="bk-help" role="status">
              No results found
            </p>
            <button
              type="button"
              className="bk-btn bk-btn-primary"
              onClick={() => setOpen(true)}
            >
              Create Resource Category
            </button>
          </div>
        ) : (
          <div className="bk-table-wrap">
            <table className="bk-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Capacity</th>
                  <th>Location</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td>
                      <span className="bk-chip">{r.type}</span>
                    </td>
                    <td>{r.capacity}</td>
                    <td>{r.locationName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {open && (
        <Modal
          title="Create Resource Category"
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
                  await bookingsApi.saveResource({
                    id: `res_${Date.now()}`,
                    ...draft,
                    name: draft.name || "New resource",
                  });
                  setOpen(false);
                  setDraft({
                    name: "",
                    type: "room",
                    capacity: 1,
                    locationName: "Main Studio",
                  });
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
            <span className="bk-label">Type</span>
            <select
              className="bk-select"
              value={draft.type}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  type: e.target.value as ResourceRoom["type"],
                })
              }
            >
              <option value="room">room</option>
              <option value="equipment">equipment</option>
            </select>
          </label>
          <label className="bk-field">
            <span className="bk-label">Capacity</span>
            <input
              className="bk-input"
              type="number"
              min={1}
              value={draft.capacity}
              onChange={(e) =>
                setDraft({ ...draft, capacity: Number(e.target.value) || 1 })
              }
            />
          </label>
          <label className="bk-field">
            <span className="bk-label">Location</span>
            <input
              className="bk-input"
              value={draft.locationName}
              onChange={(e) =>
                setDraft({ ...draft, locationName: e.target.value })
              }
            />
          </label>
        </Modal>
      )}
    </div>
  );
}
