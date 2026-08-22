import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { bookingsApi } from "../../api/bookingsApi";
import type { BookingService, ServiceCategory, ServiceType } from "../../types/bookings";
import { paths } from "../paths";
import { ActionMenu, Modal, PageHeader, PlusIcon } from "../ui";

type TypeFilter = "ALL" | ServiceType;

export function ServicesPage() {
  const navigate = useNavigate();
  const [services, setServices] = useState<BookingService[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [filterOpen, setFilterOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [infoModal, setInfoModal] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState("");
  const [shareTarget, setShareTarget] = useState<"staff" | "services">("services");

  const refresh = async () => {
    const snap = await bookingsApi.load();
    setServices(snap.services);
    setCategories(snap.categories);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return services.filter((s) => {
      if (typeFilter !== "ALL" && s.type !== typeFilter) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.type.toLowerCase().includes(q)
      );
    });
  }, [services, query, typeFilter]);

  return (
    <div className="bk-page">
      <PageHeader
        title="Booking Services"
        count={services.length}
        subtitle="Create and edit courses, classes or appointments."
        actions={
          <>
            <button
              type="button"
              className="bk-btn bk-btn-secondary"
              onClick={() => setShareOpen(true)}
            >
              Share Services
            </button>
            <ActionMenu
              label="More Actions"
              items={[
                { label: "Manage Categories", onClick: () => setCategoriesOpen(true) },
                { label: "Customize booking experience", to: paths.bookflow },
                { label: "Update booking settings", to: paths.settings },
                {
                  label: "Accept payments",
                  onClick: () =>
                    setInfoModal(
                      "Connect a payment method in site payments to accept online bookings.",
                    ),
                },
                { label: "Manage staff", to: paths.staff },
                { label: "Manage resources", to: paths.resources },
                {
                  label: "Create discount",
                  onClick: () =>
                    setInfoModal("Create automatic discounts from Marketing → Coupons & Discounts."),
                },
                {
                  label: "Create coupon",
                  onClick: () =>
                    setInfoModal("Create a coupon code from Marketing → Coupons & Discounts."),
                },
                { label: "Manage Booking Integrations", to: paths.integrations },
                {
                  label: "Give feedback",
                  onClick: () => setInfoModal("Thanks — feedback helps improve Bookings."),
                },
              ]}
            />
            <button
              type="button"
              className="bk-btn bk-btn-primary"
              onClick={() => navigate(paths.serviceTemplates)}
            >
              <PlusIcon />
              Add a New Service
            </button>
          </>
        }
      />

      <div className="bk-card">
        <div className="bk-toolbar">
          <div className="bk-toolbar-left">
            <button
              type="button"
              className="bk-btn bk-btn-link"
              onClick={() => setCategoriesOpen(true)}
            >
              Manage Categories
            </button>
            <div className="bk-menu-wrap">
              <button
                type="button"
                className="bk-btn bk-btn-ghost"
                aria-expanded={filterOpen}
                onClick={() => setFilterOpen((v) => !v)}
              >
                Filter
              </button>
              {filterOpen && (
                <div className="bk-menu" role="menu" style={{ left: 0, right: "auto" }}>
                  {(
                    [
                      ["ALL", "All types"],
                      ["APPOINTMENT", "Appointments"],
                      ["CLASS", "Classes"],
                      ["COURSE", "Courses"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setTypeFilter(value);
                        setFilterOpen(false);
                      }}
                    >
                      {label}
                      {typeFilter === value ? " ✓" : ""}
                    </button>
                  ))}
                </div>
              )}
            </div>
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
                <th style={{ width: 40 }}>
                  <span className="bk-help"> </span>
                </th>
                <th>Service</th>
                <th>Price</th>
                <th>Schedule</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id}>
                  <td>
                    <input type="checkbox" aria-label={`Select ${s.name}`} />
                  </td>
                  <td>
                    <strong>{s.name}</strong>
                    <div className="bk-help">
                      {s.type} · {s.category}
                    </div>
                  </td>
                  <td>
                    {s.price === 0
                      ? "Free"
                      : `${s.currency} ${s.price.toFixed(2)}`}
                  </td>
                  <td>No upcoming sessions</td>
                  <td>
                    <div className="bk-row-actions">
                      <Link
                        className="bk-btn bk-btn-link"
                        to={paths.serviceFormEdit(s.id)}
                      >
                        Edit
                      </Link>
                      <Link
                        className="bk-btn bk-btn-link"
                        to={`${paths.serviceFormEdit(s.id)}?section=availability`}
                      >
                        Add Sessions
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="bk-card-pad" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="bk-help" role="status">
              {filtered.length} result{filtered.length === 1 ? "" : "s"} found
            </span>
            <button
              type="button"
              className="bk-btn bk-btn-primary"
              onClick={() => navigate(paths.serviceTemplates)}
            >
              Add New Service
            </button>
          </div>
          {filtered.length === 0 && (
            <div className="bk-empty">
              <h2>No services found</h2>
              <p>Try another search or add a new service.</p>
              <button
                type="button"
                className="bk-btn bk-btn-primary"
                onClick={() => navigate(paths.serviceTemplates)}
              >
                Add a New Service
              </button>
            </div>
          )}
        </div>
      </div>

      {categoriesOpen && (
        <Modal
          title="Manage Categories"
          subtitle="Edit names or add a new category for your services."
          onClose={() => setCategoriesOpen(false)}
          footer={
            <button
              type="button"
              className="bk-btn bk-btn-primary"
              onClick={() => setCategoriesOpen(false)}
            >
              Done
            </button>
          }
        >
          <ul className="bk-toggle-list">
            {categories.map((c, idx) => (
              <li key={c.id} className="bk-toggle-row">
                <input
                  className="bk-input"
                  value={c.name}
                  onChange={(e) => {
                    const next = categories.map((row, i) =>
                      i === idx ? { ...row, name: e.target.value } : row,
                    );
                    setCategories(next);
                  }}
                  onBlur={async () => {
                    await bookingsApi.saveCategories(categories);
                  }}
                  aria-label="Edit Name"
                />
              </li>
            ))}
          </ul>
          <div className="bk-field" style={{ marginTop: 16 }}>
            <span className="bk-label">Add New Category</span>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="bk-input"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Category name"
              />
              <button
                type="button"
                className="bk-btn bk-btn-secondary"
                onClick={async () => {
                  const name = newCategory.trim();
                  if (!name) return;
                  const next = [
                    ...categories,
                    { id: `cat_${Date.now()}`, name },
                  ];
                  setCategories(next);
                  setNewCategory("");
                  await bookingsApi.saveCategories(next);
                }}
              >
                Add
              </button>
            </div>
          </div>
        </Modal>
      )}

      {shareOpen && (
        <Modal
          title="Customize your shareable link"
          subtitle="Choose what clients see when they open your link."
          onClose={() => setShareOpen(false)}
          footer={
            <>
              <button
                type="button"
                className="bk-btn bk-btn-ghost"
                onClick={() => setShareOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="bk-btn bk-btn-primary"
                onClick={() => {
                  setShareOpen(false);
                  navigate(paths.shareableLinks);
                }}
              >
                Continue
              </button>
            </>
          }
        >
          <label className="bk-field">
            <span className="bk-label">Link type</span>
            <select
              className="bk-select"
              value={shareTarget}
              onChange={(e) =>
                setShareTarget(e.target.value as "staff" | "services")
              }
            >
              <option value="staff">Staff member</option>
              <option value="services">Our services</option>
            </select>
          </label>
        </Modal>
      )}

      {infoModal && (
        <Modal
          title="Bookings"
          onClose={() => setInfoModal(null)}
          footer={
            <button
              type="button"
              className="bk-btn bk-btn-primary"
              onClick={() => setInfoModal(null)}
            >
              OK
            </button>
          }
        >
          <p style={{ margin: 0 }}>{infoModal}</p>
        </Modal>
      )}
    </div>
  );
}
