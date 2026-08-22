import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { scheduleApi } from "../../api/scheduleApi";
import type {
  DefaultDayHours,
  Location,
  StaffHoursBlock,
  StaffMember,
} from "../../types/schedule";
import {
  addDays,
  formatDayHeader,
  formatTimeRange12h,
  startOfWeekSunday,
  toDateKey,
  weekDates,
} from "../../utils/time";
import { DefaultHoursModal } from "./DefaultHoursModal";
import { SlotActionPopover } from "./SlotActionPopover";
import { WeekRangePicker } from "./WeekRangePicker";
import { WorkingHoursModal } from "./WorkingHoursModal";
import "./work-schedule.css";

export type WorkSchedulePageProps = {
  initialStaffId?: string | null;
  onChange?: () => void;
  /** Navigate to Staff (Bookings router / host shell should provide this). */
  onManageStaff?: () => void;
};

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M11 5v5h5v1h-5v5h-1v-5H5v-1h5V5h1z"
      />
    </svg>
  );
}

/**
 * Content-only Work Schedule (no app sidebar).
 * Host shells mount this in their main content area.
 */
export function WorkSchedulePage({
  initialStaffId = null,
  onChange,
  onManageStaff,
}: WorkSchedulePageProps) {
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeekSunday(new Date()),
  );
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [blocks, setBlocks] = useState<StaffHoursBlock[]>([]);
  const [defaultHours, setDefaultHours] = useState<DefaultDayHours[]>([]);
  const [locationFilter, setLocationFilter] = useState("all");
  const [staffFilter, setStaffFilter] = useState(initialStaffId ?? "all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [moreOpen, setMoreOpen] = useState(false);
  const [hoursModal, setHoursModal] = useState<null | {
    mode: "add" | "edit";
    staffIds?: string[];
    date?: string;
    block?: StaffHoursBlock;
  }>(null);
  const [defaultOpen, setDefaultOpen] = useState(false);
  const [manageStaffOpen, setManageStaffOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [slotMenu, setSlotMenu] = useState<null | {
    block: StaffHoursBlock;
    x: number;
    y: number;
  }>(null);

  const days = useMemo(() => weekDates(weekStart), [weekStart]);
  const fromKey = toDateKey(days[0]);
  const toKey = toDateKey(days[6]);

  const refresh = useCallback(async () => {
    setError(null);
    const snap = await scheduleApi.load();
    setStaff(snap.staff);
    setLocations(snap.locations);
    setDefaultHours(snap.defaultHours);
    setBlocks(await scheduleApi.listBlocksInRange(fromKey, toKey));
    setLoading(false);
  }, [fromKey, toKey]);

  useEffect(() => {
    void refresh().catch((e: Error) => {
      setError(e.message);
      setLoading(false);
    });
  }, [refresh]);

  useEffect(() => {
    if (!moreOpen) return;
    const close = () => setMoreOpen(false);
    const t = window.setTimeout(() => {
      document.addEventListener("mousedown", close);
    }, 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", close);
    };
  }, [moreOpen]);

  const visibleStaff = useMemo(() => {
    return staff.filter((s) => {
      if (locationFilter !== "all" && s.locationId !== locationFilter) {
        return false;
      }
      if (staffFilter !== "all" && s.id !== staffFilter) return false;
      return true;
    });
  }, [staff, locationFilter, staffFilter]);

  const notify = () => onChange?.();

  const openAdd = (opts?: { staffIds?: string[]; date?: string }) => {
    setMoreOpen(false);
    setSlotMenu(null);
    setHoursModal({ mode: "add", ...opts });
  };

  return (
    <div className="ws-page" data-work-schedule-root>
      <header className="ws-header">
        <div className="ws-header-text">
          <h1 className="ws-title">Work Schedule</h1>
          <p className="ws-subtitle">
            Manage when and where staff members are available for the week.
          </p>
        </div>
        <div className="ws-header-actions">
          <div className="ws-more-wrap">
            <button
              type="button"
              className="ws-btn ws-btn-more"
              aria-expanded={moreOpen}
              aria-haspopup="menu"
              onClick={(e) => {
                e.stopPropagation();
                setMoreOpen((v) => !v);
              }}
            >
              More Actions
            </button>
            {moreOpen && (
              <div
                className="ws-menu"
                role="menu"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMoreOpen(false);
                    setDefaultOpen(true);
                  }}
                >
                  Edit default hours
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMoreOpen(false);
                    if (onManageStaff) onManageStaff();
                    else setManageStaffOpen(true);
                  }}
                >
                  Manage staff
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMoreOpen(false);
                    setInviteOpen(true);
                  }}
                >
                  Invite booking collaborators
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            className="ws-btn ws-btn-primary ws-btn-add"
            onClick={() => openAdd()}
          >
            <PlusIcon />
            Add Staff Hours
          </button>
        </div>
      </header>

      {error && <div className="ws-banner ws-banner-error">{error}</div>}

      <div className="ws-card">
        <div className="ws-card-toolbar">
          <div className="ws-week-nav">
            <button
              type="button"
              className="ws-btn ws-btn-today"
              onClick={() => setWeekStart(startOfWeekSunday(new Date()))}
            >
              Today
            </button>
            <button
              type="button"
              className="ws-icon-btn"
              aria-label="Previous week"
              onClick={() => setWeekStart((w) => addDays(w, -7))}
            >
              ‹
            </button>
            <button
              type="button"
              className="ws-icon-btn"
              aria-label="Next week"
              onClick={() => setWeekStart((w) => addDays(w, 7))}
            >
              ›
            </button>
            <WeekRangePicker
              weekStart={weekStart}
              onChangeWeekStart={setWeekStart}
            />
          </div>

          <div className="ws-filters">
            <label className="ws-filter-field">
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                aria-label="All locations"
              >
                <option value="all">All locations</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="ws-filter-field">
              <select
                value={staffFilter}
                onChange={(e) => setStaffFilter(e.target.value)}
                aria-label="All staff members"
              >
                <option value="all">All staff members</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {loading ? (
          <div className="ws-loading">Loading schedule…</div>
        ) : (
          <div className="ws-grid-wrap">
            <div className="ws-roster" role="grid" aria-label="Work schedule">
              <div className="ws-roster-head" role="row">
                <div className="ws-roster-corner" role="columnheader" />
                {days.map((d) => {
                  const { dayNum, weekday } = formatDayHeader(d);
                  const isToday = toDateKey(d) === toDateKey(new Date());
                  return (
                    <div
                      key={toDateKey(d)}
                      className={`ws-roster-dayhead${isToday ? " is-today" : ""}`}
                      role="columnheader"
                    >
                      <span className="ws-day-num">{dayNum}</span>
                      <span className="ws-day-name">{weekday}</span>
                    </div>
                  );
                })}
              </div>

              {visibleStaff.length === 0 ? (
                <div className="ws-empty">No staff match these filters.</div>
              ) : (
                visibleStaff.map((s) => (
                  <div key={s.id} className="ws-roster-row" role="row">
                    <div className="ws-roster-staff" role="rowheader">
                      <span
                        className="ws-avatar"
                        style={{ background: s.color }}
                      >
                        {s.name.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="ws-staff-name">{s.name}</span>
                    </div>
                    {days.map((d) => {
                      const date = toDateKey(d);
                      const cellBlocks = blocks.filter(
                        (b) => b.staffId === s.id && b.date === date,
                      );
                      const isToday = date === toDateKey(new Date());
                      return (
                        <div
                          key={date}
                          className={`ws-roster-cell${isToday ? " is-today" : ""}`}
                          role="gridcell"
                          onDoubleClick={() =>
                            openAdd({ staffIds: [s.id], date })
                          }
                        >
                          {cellBlocks.map((b) => (
                            <button
                              key={b.id}
                              type="button"
                              className="ws-block"
                              onClick={(e) => {
                                e.stopPropagation();
                                const rect = (
                                  e.currentTarget as HTMLButtonElement
                                ).getBoundingClientRect();
                                setSlotMenu({
                                  block: b,
                                  x: rect.left,
                                  y: rect.bottom + 4,
                                });
                              }}
                            >
                              {formatTimeRange12h(b.start, b.end)}
                            </button>
                          ))}
                          <button
                            type="button"
                            className="ws-cell-add"
                            title="Add hours"
                            onClick={() =>
                              openAdd({ staffIds: [s.id], date })
                            }
                          >
                            +
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {slotMenu && (
        <SlotActionPopover
          x={slotMenu.x}
          y={slotMenu.y}
          onClose={() => setSlotMenu(null)}
          onEdit={() => {
            const b = slotMenu.block;
            setSlotMenu(null);
            setHoursModal({ mode: "edit", block: b });
          }}
          onRemove={() => {
            const id = slotMenu.block.id;
            setSlotMenu(null);
            void scheduleApi
              .removeHours(id)
              .then(() => refresh())
              .then(() => notify())
              .catch((e: Error) => setError(e.message));
          }}
        />
      )}

      {hoursModal && (
        <WorkingHoursModal
          mode={hoursModal.mode}
          staff={staff}
          locations={locations}
          defaultStaffIds={hoursModal.staffIds}
          defaultDate={hoursModal.date}
          editingBlock={hoursModal.block ?? null}
          onClose={() => setHoursModal(null)}
          onSaved={async () => {
            setHoursModal(null);
            await refresh();
            notify();
          }}
        />
      )}

      {defaultOpen && (
        <DefaultHoursModal
          initial={defaultHours}
          onClose={() => setDefaultOpen(false)}
          onSaved={async () => {
            setDefaultOpen(false);
            await refresh();
            notify();
          }}
        />
      )}

      {manageStaffOpen && (
        <InfoSheet
          title="Manage staff"
          body="Staff listed here come from the schedule store. Pass onManageStaff to open the Staff page."
          onClose={() => setManageStaffOpen(false)}
        >
          <ul className="ws-simple-list">
            {staff.map((s) => (
              <li key={s.id}>
                <span className="ws-avatar sm" style={{ background: s.color }}>
                  {s.name.slice(0, 1).toUpperCase()}
                </span>
                {s.name}
              </li>
            ))}
          </ul>
        </InfoSheet>
      )}

      {inviteOpen && (
        <InfoSheet
          title="Invite booking collaborators"
          body="Send collaborators access to manage bookings. Hook this panel to your invite API when the backend is ready."
          onClose={() => setInviteOpen(false)}
        >
          <label className="ws-field">
            <span className="ws-label">Email</span>
            <input className="ws-input" type="email" placeholder="name@email.com" />
          </label>
          <div className="ws-sheet-footer">
            <button
              type="button"
              className="ws-btn ws-btn-ghost"
              onClick={() => setInviteOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="ws-btn ws-btn-primary"
              onClick={() => setInviteOpen(false)}
            >
              Send invite
            </button>
          </div>
        </InfoSheet>
      )}
    </div>
  );
}

function InfoSheet({
  title,
  body,
  onClose,
  children,
}: {
  title: string;
  body: string;
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="ws-modal-backdrop" onClick={onClose}>
      <div
        className="ws-sheet"
        role="dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="ws-sheet-close"
          aria-label="Close"
          onClick={onClose}
        >
          ×
        </button>
        <h2>{title}</h2>
        <p className="ws-sheet-sub">{body}</p>
        {children}
      </div>
    </div>
  );
}

export default WorkSchedulePage;
