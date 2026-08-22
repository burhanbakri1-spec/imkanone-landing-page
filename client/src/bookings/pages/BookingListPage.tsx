import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { bookingsApi } from "../../api/bookingsApi";
import type { BookingRow } from "../../types/bookings";
import { paths } from "../paths";
import { ActionMenu, Modal } from "../ui";

type Tab = "booking-list" | "course-list";

type ChipId = "status" | "session";

/** Column fields from inventory / measurements (17 total). */
const COLUMN_FIELDS = [
  { key: "startDate", label: "Start date", defaultOn: true },
  { key: "service", label: "Service", defaultOn: true },
  { key: "client", label: "Client", defaultOn: true },
  { key: "addons", label: "Add-ons", defaultOn: true },
  { key: "createdDate", label: "Created date", defaultOn: true },
  { key: "attendance", label: "Attendance", defaultOn: true },
  { key: "paymentStatus", label: "Payment status", defaultOn: true },
  { key: "charge", label: "Charge", defaultOn: true },
  { key: "phone", label: "Phone", defaultOn: false },
  { key: "staffName", label: "Staff name", defaultOn: false },
  { key: "creatorDetails", label: "Creator details", defaultOn: false },
  { key: "eventNote", label: "Event note", defaultOn: false },
  { key: "resources", label: "Resources", defaultOn: false },
  { key: "location", label: "Location", defaultOn: false },
  { key: "status", label: "Status", defaultOn: false },
  { key: "orderNumber", label: "Order number", defaultOn: false },
  { key: "paymentDetails", label: "Payment details", defaultOn: false },
] as const;

type ColKey = (typeof COLUMN_FIELDS)[number]["key"];

/** Filter list aligned to inventory BL8 (11 filters) + known chips. */
const FILTER_ITEMS = [
  "Booking status",
  "Session date & time",
  "Service",
  "Client name",
  "Staff name",
  "Location",
  "Payment status",
  "Attendance",
  "Created date",
  "Add-ons",
  "Resources",
] as const;

export function BookingListPage() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab | null) ?? "booking-list";
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [period, setPeriod] = useState("Last 7 days");
  const [viewName, setViewName] = useState("Default view");
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportScope, setExportScope] = useState<"All" | "Filtered" | "Selected">("All");
  const [draftFilters, setDraftFilters] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(FILTER_ITEMS.map((f) => [f, f === "Booking status" || f === "Session date & time"])),
  );
  const [chips, setChips] = useState<Record<ChipId, boolean>>({
    status: true,
    session: true,
  });
  const [statusFilter, setStatusFilter] = useState("Confirmed");
  const [visibleCols, setVisibleCols] = useState<Record<ColKey, boolean>>(() =>
    Object.fromEntries(COLUMN_FIELDS.map((c) => [c.key, c.defaultOn])) as Record<ColKey, boolean>,
  );

  useEffect(() => {
    void bookingsApi.load().then((s) => setRows(s.bookings));
  }, []);

  const filtered = useMemo(() => {
    let list =
      tab === "course-list"
        ? rows.filter((r) => r.kind === "course")
        : rows.filter((r) => r.kind !== "course");
    if (chips.status) {
      const want = statusFilter.toLowerCase();
      list = list.filter((r) => r.status === want);
    }
    return list;
  }, [rows, tab, chips.status, statusFilter]);

  const totals = useMemo(() => {
    const paid = rows.filter((r) => r.payment === "Paid").length;
    const unpaid = rows.filter((r) => r.payment === "Unpaid").length;
    return {
      total: `TRY ${(rows.length * 0).toFixed(2)}`,
      unpaid: `TRY ${(unpaid * 0).toFixed(2)}`,
      paid: `TRY ${(paid * 0).toFixed(2)}`,
    };
  }, [rows]);

  const setTab = (next: Tab) => {
    setParams({ tab: next });
  };

  const sessionRangeLabel = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 31);
    const fmt = (d: Date) =>
      `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
    return `${fmt(start)} - ${fmt(end)}`;
  };

  const clearFilters = () => {
    setChips({ status: false, session: false });
    setStatusFilter("Confirmed");
    setPeriod("Last 7 days");
    setDraftFilters(Object.fromEntries(FILTER_ITEMS.map((f) => [f, false])));
  };

  const applyFilters = () => {
    setChips({
      status: !!draftFilters["Booking status"],
      session: !!draftFilters["Session date & time"],
    });
    setFilterOpen(false);
  };

  const activeChipCount = Number(chips.status) + Number(chips.session);

  const formatWhen = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  const runExport = () => {
    const source =
      exportScope === "All" ? rows : exportScope === "Filtered" ? filtered : filtered.slice(0, 1);
    const csv = source
      .map((r) => `${r.clientName},${r.serviceName},${r.staffName},${r.status}`)
      .join("\n");
    const blob = new Blob([`Client,Service,Staff,Status\n${csv}`], {
      type: "text/csv",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bookings.csv";
    a.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
  };

  return (
    <div className="bk-page" style={{ position: "relative" }}>
      <nav className="bk-breadcrumb" aria-label="View">
        <Link to={paths.calendar} className="bk-btn bk-btn-ghost" style={{ padding: "4px 10px" }}>
          Calendar
        </Link>
        <span aria-hidden="true"> | </span>
        <button type="button" className="bk-btn bk-btn-ghost" style={{ padding: "4px 10px" }} disabled>
          Booking List
        </button>
      </nav>

      <header className="bk-header">
        <div className="bk-header-text">
          <h1 className="bk-title">Booking List</h1>
        </div>
        <div className="bk-header-actions">
          <select
            className="bk-select"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            aria-label="Period"
          >
            <option>Last 7 days</option>
            <option>Last 30 days</option>
            <option>This month</option>
          </select>
          <ActionMenu
            label="Manage View"
            items={[
              {
                label: "Save changes",
                onClick: () =>
                  setViewName(`${viewName.replace(/ \(saved\)$/, "")} (saved)`),
              },
              {
                label: "Save as new view",
                onClick: () => setViewName("Custom view"),
              },
              {
                label: "Rename",
                onClick: () => {
                  const name = window.prompt("View name", viewName);
                  if (name) setViewName(name);
                },
              },
              {
                label: "Set as default view",
                onClick: () =>
                  setViewName(`${viewName.replace(/ · default$/, "")} · default`),
              },
              {
                label: "Delete",
                danger: true,
                onClick: () => setViewName("Default view"),
              },
            ]}
          />
          <button
            type="button"
            className="bk-btn bk-btn-ghost"
            onClick={() => setExportOpen(true)}
          >
            Export
          </button>
          <button
            type="button"
            className="bk-btn bk-btn-ghost"
            aria-pressed={columnsOpen}
            onClick={() => setColumnsOpen((v) => !v)}
          >
            Columns
          </button>
        </div>
      </header>

      <div className="bk-stat-row" style={{ marginBottom: 16 }}>
        <div className="bk-stat">
          <div className="label">Total bookings</div>
          <div className="value">{totals.total}</div>
          <div className="bk-help">{period}</div>
        </div>
        <div className="bk-stat">
          <div className="label">Unpaid bookings</div>
          <div className="value">{totals.unpaid}</div>
        </div>
        <div className="bk-stat">
          <div className="label">Paid bookings</div>
          <div className="value">{totals.paid}</div>
        </div>
      </div>

      <div className="bk-card" style={{ position: "relative" }}>
        <div className="bk-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            className="bk-tab"
            aria-selected={tab === "booking-list"}
            onClick={() => setTab("booking-list")}
          >
            Appointments & Classes
          </button>
          <button
            type="button"
            role="tab"
            className="bk-tab"
            aria-selected={tab === "course-list"}
            onClick={() => setTab("course-list")}
          >
            Courses
          </button>
        </div>
        <div className="bk-toolbar">
          <div className="bk-toolbar-left">
            <span className="bk-help">
              {viewName} ({filtered.length})
            </span>
          </div>
          <div className="bk-toolbar-right">
            <button
              type="button"
              className="bk-btn bk-btn-ghost"
              aria-expanded={filterOpen}
              onClick={() => setFilterOpen((v) => !v)}
            >
              Filter
            </button>
          </div>
        </div>

        {activeChipCount > 0 && (
          <div
            className="bk-card-pad"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              alignItems: "center",
              borderBottom: "1px solid var(--bk-border)",
            }}
          >
            {chips.status && (
              <button
                type="button"
                className="bk-chip bk-chip-blue"
                onClick={() => setChips((c) => ({ ...c, status: false }))}
              >
                Booking status: {statusFilter} ×
              </button>
            )}
            {chips.session && (
              <button
                type="button"
                className="bk-chip bk-chip-blue"
                onClick={() => setChips((c) => ({ ...c, session: false }))}
              >
                Session date & time: {sessionRangeLabel()} ×
              </button>
            )}
            <button type="button" className="bk-btn bk-btn-link" onClick={clearFilters}>
              Clear all
            </button>
          </div>
        )}

        {columnsOpen && (
          <div
            className="bk-card-pad"
            style={{
              borderBottom: "1px solid var(--bk-border)",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: 8,
            }}
            aria-label="Manage columns"
          >
            {COLUMN_FIELDS.map((col) => (
              <label key={col.key} style={{ fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={visibleCols[col.key]}
                  onChange={(e) =>
                    setVisibleCols({ ...visibleCols, [col.key]: e.target.checked })
                  }
                />{" "}
                {col.label}
              </label>
            ))}
          </div>
        )}

        <div className="bk-table-wrap">
          {filtered.length > 0 ? (
            <table className="bk-table">
              <thead>
                <tr>
                  {visibleCols.startDate && <th>Start date</th>}
                  {visibleCols.service && <th>Service</th>}
                  {visibleCols.client && <th>Client</th>}
                  {visibleCols.addons && <th>Add-ons</th>}
                  {visibleCols.createdDate && <th>Created</th>}
                  {visibleCols.attendance && <th>Attendance</th>}
                  {visibleCols.paymentStatus && <th>Payment</th>}
                  {visibleCols.charge && <th>Charge</th>}
                  {visibleCols.phone && <th>Phone</th>}
                  {visibleCols.staffName && <th>Staff</th>}
                  {visibleCols.creatorDetails && <th>Creator</th>}
                  {visibleCols.eventNote && <th>Note</th>}
                  {visibleCols.resources && <th>Resources</th>}
                  {visibleCols.location && <th>Location</th>}
                  {visibleCols.status && <th>Status</th>}
                  {visibleCols.orderNumber && <th>Order #</th>}
                  {visibleCols.paymentDetails && <th>Payment details</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    {visibleCols.startDate && <td>{formatWhen(r.startAt)}</td>}
                    {visibleCols.service && <td>{r.serviceName}</td>}
                    {visibleCols.client && <td>{r.clientName}</td>}
                    {visibleCols.addons && <td>—</td>}
                    {visibleCols.createdDate && <td>{formatWhen(r.startAt)}</td>}
                    {visibleCols.attendance && <td>—</td>}
                    {visibleCols.paymentStatus && (
                      <td>
                        <span className="bk-chip bk-chip-blue">{r.payment}</span>
                      </td>
                    )}
                    {visibleCols.charge && <td>TRY 0.00</td>}
                    {visibleCols.phone && <td>—</td>}
                    {visibleCols.staffName && <td>{r.staffName}</td>}
                    {visibleCols.creatorDetails && <td>—</td>}
                    {visibleCols.eventNote && <td>—</td>}
                    {visibleCols.resources && <td>—</td>}
                    {visibleCols.location && <td>{r.locationName}</td>}
                    {visibleCols.status && <td>{r.status}</td>}
                    {visibleCols.orderNumber && <td>—</td>}
                    {visibleCols.paymentDetails && <td>{r.payment}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="bk-empty">
              <h2>No results found</h2>
              <p>Try changing your filters.</p>
              <button
                type="button"
                className="bk-btn bk-btn-secondary"
                onClick={clearFilters}
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {filterOpen && (
        <aside
          className="bk-card bk-card-pad"
          aria-label="Filters"
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            width: 420,
            maxWidth: "100vw",
            height: "100vh",
            zIndex: 40,
            borderRadius: 0,
            boxShadow: "var(--bk-shadow-menu)",
            overflowY: "auto",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 18 }}>Filter</h2>
            <button
              type="button"
              className="bk-icon-btn"
              aria-label="Close filters"
              onClick={() => setFilterOpen(false)}
            >
              ×
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {FILTER_ITEMS.map((label) => (
              <label key={label} style={{ display: "flex", gap: 8, fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={!!draftFilters[label]}
                  onChange={(e) =>
                    setDraftFilters({ ...draftFilters, [label]: e.target.checked })
                  }
                />
                {label}
              </label>
            ))}
          </div>
          {draftFilters["Booking status"] && (
            <label className="bk-field" style={{ marginTop: 16 }}>
              <span className="bk-label">Status value</span>
              <select
                className="bk-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option>Confirmed</option>
                <option>Pending</option>
                <option>Canceled</option>
              </select>
            </label>
          )}
          <div
            style={{
              display: "flex",
              gap: 8,
              marginTop: 24,
              justifyContent: "flex-end",
            }}
          >
            <button type="button" className="bk-btn bk-btn-ghost" onClick={clearFilters}>
              Clear all
            </button>
            <button type="button" className="bk-btn bk-btn-primary" onClick={applyFilters}>
              Apply
            </button>
          </div>
        </aside>
      )}

      {exportOpen && (
        <Modal
          title="Export booking data"
          subtitle="Choose which bookings to export as CSV."
          onClose={() => setExportOpen(false)}
          footer={
            <>
              <button
                type="button"
                className="bk-btn bk-btn-ghost"
                onClick={() => setExportOpen(false)}
              >
                Cancel
              </button>
              <button type="button" className="bk-btn bk-btn-primary" onClick={runExport}>
                Export
              </button>
            </>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(["All", "Filtered", "Selected"] as const).map((opt) => (
              <label key={opt} style={{ display: "flex", gap: 8, fontSize: 14 }}>
                <input
                  type="radio"
                  name="bl-export"
                  checked={exportScope === opt}
                  onChange={() => setExportScope(opt)}
                />
                {opt}
              </label>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
