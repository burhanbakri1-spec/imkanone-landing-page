import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { bookingsApi } from "../../api/bookingsApi";
import type { BookingService, CalendarEvent, StaffRecord } from "../../types/bookings";
import { paths } from "../paths";
import { ActionMenu, Modal } from "../ui";
import "./calendar-experience.css";

type CalView = "Weekly" | "Daily" | "Staff" | "Schedule";
type CreateKind = "Quick Sale" | "Appointment" | "Blocked staff time" | "Class session";
type Drawer = "filter" | "display" | null;
type AccordionKey =
  | "upcoming"
  | "appointmentWaitlist"
  | "bookingRequests"
  | "classWaitlists"
  | "recent";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function CalendarExperiencePage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [services, setServices] = useState<BookingService[]>([]);
  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [miniMonth, setMiniMonth] = useState(() => startOfMonth(new Date()));
  const [view, setView] = useState<CalView>("Weekly");
  const [search, setSearch] = useState("");
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [syncOpen, setSyncOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [createKind, setCreateKind] = useState<CreateKind | null>(null);
  const [createForm, setCreateForm] = useState({
    title: "",
    staffName: "",
    dayIndex: new Date().getDay(),
    hour: 10,
  });

  const [inviteRole, setInviteRole] = useState("Booking manager");
  const [inviteEmail, setInviteEmail] = useState("");
  const [exportScope, setExportScope] = useState<"All" | "Filtered" | "Selected">("All");

  const [selectedServices, setSelectedServices] = useState<Record<string, boolean>>({});
  const [selectedStaff, setSelectedStaff] = useState<Record<string, boolean>>({});
  const [filterLocation, setFilterLocation] = useState(true);
  const [filterSessionAvail, setFilterSessionAvail] = useState(true);
  const [filterOtherEvents, setFilterOtherEvents] = useState(true);

  const [spacing, setSpacing] = useState<"Compact" | "Wide">("Compact");
  const [eventTitleMode, setEventTitleMode] = useState<"Client name" | "Service name">(
    "Service name",
  );
  const [colorBy, setColorBy] = useState<"Staff" | "Catalog">("Staff");
  const [palette, setPalette] = useState<"Modern" | "Classic">("Modern");
  const [slotGap, setSlotGap] = useState<"30" | "15" | "10" | "5">("30");
  const [showWeekends, setShowWeekends] = useState(true);
  const [dontSendReminders, setDontSendReminders] = useState(false);
  const [timeZone, setTimeZone] = useState("GMT+03:00 Istanbul");
  const [firstWeekday, setFirstWeekday] = useState<"Sunday" | "Monday">("Sunday");

  const [openAcc, setOpenAcc] = useState<Record<AccordionKey, boolean>>({
    upcoming: true,
    appointmentWaitlist: false,
    bookingRequests: false,
    classWaitlists: false,
    recent: false,
  });
  const [waitlistActive, setWaitlistActive] = useState(false);

  useEffect(() => {
    void bookingsApi.load().then((s) => {
      setEvents(s.calendarEvents);
      setServices(s.services);
      setStaff(s.staff);
      setSelectedServices(Object.fromEntries(s.services.map((svc) => [svc.id, true])));
      setSelectedStaff(Object.fromEntries(s.staff.map((m) => [m.id, true])));
      setCreateForm((f) => ({
        ...f,
        staffName: s.staff[0]?.name ?? "Unassigned",
      }));
    });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(t);
  }, [toast]);

  const weekStart = useMemo(() => startOfWeek(cursor), [cursor]);
  const dayDates = useMemo(() => {
    if (view === "Daily") return [cursor];
    const all = DAY_LABELS.map((_, i) => addDays(weekStart, i));
    if (showWeekends) return all;
    return all.filter((d) => {
      const day = d.getDay();
      return day !== 0 && day !== 6;
    });
  }, [view, cursor, weekStart, showWeekends]);

  const monthLabel = cursor.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const miniMonthLabel = miniMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const rangeLabel =
    view === "Daily"
      ? cursor.toLocaleDateString(undefined, {
          weekday: "short",
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : monthLabel;

  const filteredEvents = useMemo(() => {
    const q = search.trim().toLowerCase();
    const staffNames = new Set(
      staff.filter((m) => selectedStaff[m.id]).map((m) => m.name),
    );
    return events.filter((e) => {
      if (q && !e.title.toLowerCase().includes(q) && !e.staffName.toLowerCase().includes(q)) {
        return false;
      }
      if (staff.length && !staffNames.has(e.staffName)) return false;
      if (!filterOtherEvents && /block/i.test(e.title)) return false;
      return true;
    });
  }, [events, search, staff, selectedStaff, filterOtherEvents]);

  const visibleCount = filteredEvents.length;

  const openCreate = (kind: CreateKind) => {
    setCreateKind(kind);
    setCreateForm({
      title: kind === "Blocked staff time" ? "Blocked time" : kind,
      staffName: staff[0]?.name ?? "Unassigned",
      dayIndex: cursor.getDay(),
      hour: 10,
    });
  };

  const saveCreate = async () => {
    if (!createKind) return;
    const row = await bookingsApi.addCalendarEvent({
      title: createForm.title.trim() || createKind,
      dayIndex: createForm.dayIndex,
      hour: createForm.hour,
      staffName: createForm.staffName || "Unassigned",
    });
    setEvents((prev) => [...prev, row]);
    setCreateKind(null);
  };

  const shiftNav = (dir: -1 | 1) => {
    if (view === "Daily") setCursor((d) => addDays(d, dir));
    else setCursor((d) => addDays(d, dir * 7));
  };

  const eventLabel = (e: CalendarEvent) => {
    if (eventTitleMode === "Client name") {
      const parts = e.title.split("·").map((p) => p.trim());
      return parts[1] ?? e.title;
    }
    return e.title;
  };

  const eventStyle = (e: CalendarEvent): CSSProperties | undefined => {
    if (colorBy !== "Staff") return undefined;
    const m = staff.find((s) => s.name === e.staffName);
    if (!m) return undefined;
    return {
      background: `${m.color}22`,
      color: m.color,
      borderLeft: `3px solid ${m.color}`,
    };
  };

  const toggleAcc = (key: AccordionKey) =>
    setOpenAcc((prev) => ({ ...prev, [key]: !prev[key] }));

  const miniDays = useMemo(() => buildMiniMonth(miniMonth), [miniMonth]);

  const renderEvent = (e: CalendarEvent) => (
    <div
      key={e.id}
      className={`cal-exp-event palette-${palette === "Modern" ? "modern" : "classic"}`}
      title={`${e.title} · ${e.staffName}`}
      style={eventStyle(e)}
    >
      {eventLabel(e)}
    </div>
  );

  const renderWeekDayGrid = () => {
    const cols = dayDates.length;
    return (
      <div
        className="bk-calendar-grid"
        style={{ gridTemplateColumns: `72px repeat(${cols}, 1fr)` }}
      >
        <div className="bk-cal-head" />
        {dayDates.map((d) => (
          <div key={d.toISOString()} className="bk-cal-head">
            <div>{DAY_LABELS[d.getDay()]}</div>
            <div>{d.getDate()}</div>
          </div>
        ))}
        {HOURS.flatMap((hour) => [
          <div key={`t-${hour}`} className="bk-cal-time">
            {formatHour(hour)}
          </div>,
          ...dayDates.map((d) => {
            const dayIndex = d.getDay();
            const cellEvents = filteredEvents.filter(
              (e) => e.dayIndex === dayIndex && e.hour === hour,
            );
            return (
              <div key={`${d.toISOString()}-${hour}`} className="bk-cal-cell">
                {cellEvents.map(renderEvent)}
              </div>
            );
          }),
        ])}
      </div>
    );
  };

  const renderStaffGrid = () => {
    const cols = dayDates.length;
    const activeStaff = staff.filter((m) => selectedStaff[m.id]);
    return (
      <div
        className={`cal-exp-staff-grid${view === "Daily" ? " daily" : ""}`}
        style={{ gridTemplateColumns: `140px repeat(${cols}, 1fr)` }}
      >
        <div className="bk-cal-head">Staff</div>
        {dayDates.map((d) => (
          <div key={d.toISOString()} className="bk-cal-head">
            <div>{DAY_LABELS[d.getDay()]}</div>
            <div>{d.getDate()}</div>
          </div>
        ))}
        {activeStaff.map((m) => [
          <div key={`${m.id}-name`} className="bk-cal-time" style={{ fontWeight: 530 }}>
            <span style={{ color: m.color }}>●</span> {m.name}
          </div>,
          ...dayDates.map((d) => {
            const dayIndex = d.getDay();
            const cellEvents = filteredEvents.filter(
              (e) => e.dayIndex === dayIndex && e.staffName === m.name,
            );
            return (
              <div key={`${m.id}-${d.toISOString()}`} className="bk-cal-cell">
                {cellEvents.map(renderEvent)}
              </div>
            );
          }),
        ])}
      </div>
    );
  };

  const renderSchedule = () => {
    const sorted = [...filteredEvents].sort(
      (a, b) => a.dayIndex - b.dayIndex || a.hour - b.hour,
    );
    if (!sorted.length) {
      return (
        <div className="bk-empty">
          <h2>No events</h2>
          <p>Events in this range will appear in the schedule list.</p>
        </div>
      );
    }
    return (
      <div className="cal-exp-schedule-list">
        {sorted.map((e) => (
          <div key={e.id} className="cal-exp-schedule-row">
            <div>
              {DAY_LABELS[e.dayIndex]} · {formatHour(e.hour)}
            </div>
            <div>{eventLabel(e)}</div>
            <div className="bk-help">{e.staffName}</div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={`cal-exp${drawer ? " cal-exp--drawer-open" : ""}`}>
      <aside className="cal-exp-rail" aria-label="Calendar activity">
        <h1 className="cal-exp-rail-title">Calendar</h1>

        <div className="cal-exp-month-nav">
          <button
            type="button"
            className="bk-icon-btn"
            aria-label="Previous month"
            onClick={() => setMiniMonth((d) => addMonths(d, -1))}
          >
            ‹
          </button>
          <strong>{miniMonthLabel}</strong>
          <button
            type="button"
            className="bk-icon-btn"
            aria-label="Next month"
            onClick={() => setMiniMonth((d) => addMonths(d, 1))}
          >
            ›
          </button>
        </div>

        <div className="cal-exp-mini-grid" aria-label="Mini month">
          {DAY_LABELS.map((d) => (
            <div key={d} className="dow">
              {d.charAt(0)}
            </div>
          ))}
          {miniDays.map((cell) => (
            <button
              key={cell.key}
              type="button"
              className={`cal-exp-mini-day${cell.isToday ? " is-today" : ""}${
                cell.otherMonth ? " is-other" : ""
              }`}
              onClick={() => {
                setCursor(cell.date);
                setMiniMonth(startOfMonth(cell.date));
              }}
            >
              {cell.date.getDate()}
            </button>
          ))}
        </div>

        <div className="cal-exp-carousel">
          <h3>Sync your personal calendar</h3>
          <p>Avoid double bookings</p>
          <button
            type="button"
            className="bk-btn bk-btn-secondary"
            style={{ width: "100%" }}
            onClick={() => setSyncOpen(true)}
          >
            Sync Calendars
          </button>
        </div>

        <div className="cal-exp-activity">
          <h3>Activity</h3>

          <div className="cal-exp-acc">
            <button type="button" className="cal-exp-acc-btn" onClick={() => toggleAcc("upcoming")}>
              Upcoming session
              <span className="chev">{openAcc.upcoming ? "▾" : "▸"}</span>
            </button>
            {openAcc.upcoming && (
              <div className="cal-exp-acc-body">No sessions added...</div>
            )}
          </div>

          <div className="cal-exp-acc">
            <button
              type="button"
              className="cal-exp-acc-btn"
              onClick={() => toggleAcc("appointmentWaitlist")}
            >
              Appointment waitlist
              <span className="chev">{openAcc.appointmentWaitlist ? "▾" : "▸"}</span>
            </button>
            {openAcc.appointmentWaitlist && (
              <div className="cal-exp-acc-body">
                {waitlistActive
                  ? "Waitlist is active. Clients can join when no slots are open."
                  : "No one is on the waitlist yet."}
                <div style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="bk-btn bk-btn-secondary"
                    onClick={() => setWaitlistActive((v) => !v)}
                  >
                    {waitlistActive ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="cal-exp-acc">
            <button
              type="button"
              className="cal-exp-acc-btn"
              onClick={() => toggleAcc("bookingRequests")}
            >
              Booking requests
              <span className="chev">{openAcc.bookingRequests ? "▾" : "▸"}</span>
            </button>
            {openAcc.bookingRequests && (
              <div className="cal-exp-acc-body">No booking requests.</div>
            )}
          </div>

          <div className="cal-exp-acc">
            <button
              type="button"
              className="cal-exp-acc-btn"
              onClick={() => toggleAcc("classWaitlists")}
            >
              Class waitlists
              <span className="chev">{openAcc.classWaitlists ? "▾" : "▸"}</span>
            </button>
            {openAcc.classWaitlists && (
              <div className="cal-exp-acc-body">No class waitlists.</div>
            )}
          </div>

          <div className="cal-exp-acc">
            <button type="button" className="cal-exp-acc-btn" onClick={() => toggleAcc("recent")}>
              Recent activity
              <span className="chev">{openAcc.recent ? "▾" : "▸"}</span>
            </button>
            {openAcc.recent && (
              <div className="cal-exp-acc-body">No recent activity.</div>
            )}
          </div>
        </div>
      </aside>

      <div className="cal-exp-main">
        <div className="cal-exp-toolbar">
          <div className="cal-exp-toolbar-left">
            <button
              type="button"
              className="bk-btn bk-btn-ghost"
              onClick={() => {
                const now = new Date();
                setCursor(startOfDay(now));
                setMiniMonth(startOfMonth(now));
              }}
            >
              Today
            </button>
            <strong>{rangeLabel}</strong>
            <button
              type="button"
              className="bk-icon-btn"
              aria-label="Previous"
              onClick={() => shiftNav(-1)}
            >
              ‹
            </button>
            <button
              type="button"
              className="bk-icon-btn"
              aria-label="Next"
              onClick={() => shiftNav(1)}
            >
              ›
            </button>
            <select
              className="bk-select"
              aria-label="View"
              role="combobox"
              value={view}
              onChange={(e) => setView(e.target.value as CalView)}
            >
              <option value="Weekly">Weekly</option>
              <option value="Daily">Daily</option>
              <option value="Staff">Staff</option>
              <option value="Schedule">Schedule</option>
            </select>
          </div>

          <div className="cal-exp-toolbar-right">
            <div className="cal-exp-search">
              <span aria-hidden="true">⌕</span>
              <input
                type="search"
                placeholder="Search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search calendar"
              />
            </div>
            <button
              type="button"
              className="bk-btn bk-btn-ghost"
              aria-pressed={drawer === "filter"}
              onClick={() => setDrawer((d) => (d === "filter" ? null : "filter"))}
            >
              Filters
            </button>
            <button
              type="button"
              className="bk-btn bk-btn-ghost"
              aria-label="Display settings"
              aria-pressed={drawer === "display"}
              onClick={() => setDrawer((d) => (d === "display" ? null : "display"))}
            >
              Settings
            </button>
            <ActionMenu
              label="Manage"
              items={[
                { label: "Edit services", to: paths.services },
                { label: "Go to staff members", to: paths.staff },
                { label: "Resources", to: paths.resources },
                { label: "Default business hours", to: paths.defaultHours },
                { label: "Add booking integrations", to: paths.integrations },
                { label: "Sync personal calendar", onClick: () => setSyncOpen(true) },
                { label: "Invite booking collaborators", onClick: () => setInviteOpen(true) },
                { label: "Export booking data", onClick: () => setExportOpen(true) },
                {
                  label: "Manage on the go",
                  onClick: () => setToast("Opens Wix Owner app (out of scope)"),
                },
                { label: "Update booking settings", to: paths.settings },
                { label: "Calendar apps", onClick: () => undefined },
                { label: "Time Blocker", onClick: () => undefined },
              ]}
            />
            <ActionMenu
              label="Add"
              variant="primary"
              items={[
                { label: "Quick Sale", onClick: () => openCreate("Quick Sale") },
                { label: "Appointment", onClick: () => openCreate("Appointment") },
                {
                  label: "Blocked staff time",
                  onClick: () => openCreate("Blocked staff time"),
                },
                { label: "Class session", onClick: () => openCreate("Class session") },
                { label: "Create New Service", to: paths.serviceTemplates },
              ]}
            />
          </div>
        </div>

        <div
          className={`cal-exp-grid-wrap ${spacing === "Wide" ? "is-wide" : "is-compact"}`}
        >
          {view === "Staff"
            ? renderStaffGrid()
            : view === "Schedule"
              ? renderSchedule()
              : renderWeekDayGrid()}
        </div>

        <div className="cal-exp-footer">{visibleCount} events viewed</div>
      </div>

      {drawer === "filter" && (
        <aside className="cal-exp-drawer" aria-label="Filter by">
          <h2>Filter by</h2>

          <h3>Catalog items</h3>
          <label className="cal-exp-check">
            <input
              type="checkbox"
              checked={
                services.length > 0 && services.every((s) => selectedServices[s.id])
              }
              onChange={(e) =>
                setSelectedServices(
                  Object.fromEntries(services.map((s) => [s.id, e.target.checked])),
                )
              }
            />
            Select all
          </label>
          {services.map((s) => (
            <label key={s.id} className="cal-exp-check">
              <input
                type="checkbox"
                checked={!!selectedServices[s.id]}
                onChange={(e) =>
                  setSelectedServices({ ...selectedServices, [s.id]: e.target.checked })
                }
              />
              {s.name}
            </label>
          ))}

          <h3>Staff</h3>
          {staff.map((m) => (
            <label key={m.id} className="cal-exp-check">
              <input
                type="checkbox"
                checked={!!selectedStaff[m.id]}
                onChange={(e) =>
                  setSelectedStaff({ ...selectedStaff, [m.id]: e.target.checked })
                }
              />
              {m.name}
            </label>
          ))}

          <h3>Location</h3>
          <label className="cal-exp-check">
            <input
              type="checkbox"
              checked={filterLocation}
              onChange={(e) => setFilterLocation(e.target.checked)}
            />
            All locations
          </label>

          <h3>Session availability</h3>
          <label className="cal-exp-check">
            <input
              type="checkbox"
              checked={filterSessionAvail}
              onChange={(e) => setFilterSessionAvail(e.target.checked)}
            />
            All sessions
          </label>

          <h3>Other events</h3>
          <label className="cal-exp-check">
            <input
              type="checkbox"
              checked={filterOtherEvents}
              onChange={(e) => setFilterOtherEvents(e.target.checked)}
            />
            Blocked time included
          </label>

          <div className="cal-exp-footer" style={{ marginTop: 24 }}>
            {visibleCount} events viewed
          </div>
        </aside>
      )}

      {drawer === "display" && (
        <aside className="cal-exp-drawer" aria-label="Display settings">
          <h2>Display Settings</h2>

          <h3>Calendar spacing</h3>
          <div className="cal-exp-radio-row">
            {(["Compact", "Wide"] as const).map((opt) => (
              <label key={opt}>
                <input
                  type="radio"
                  name="spacing"
                  checked={spacing === opt}
                  onChange={() => setSpacing(opt)}
                />
                {opt}
              </label>
            ))}
          </div>

          <h3>Event title</h3>
          <div className="cal-exp-radio-row">
            {(["Client name", "Service name"] as const).map((opt) => (
              <label key={opt}>
                <input
                  type="radio"
                  name="eventTitle"
                  checked={eventTitleMode === opt}
                  onChange={() => setEventTitleMode(opt)}
                />
                {opt}
              </label>
            ))}
          </div>

          <h3>Color code by</h3>
          <div className="cal-exp-radio-row">
            {(["Staff", "Catalog"] as const).map((opt) => (
              <label key={opt}>
                <input
                  type="radio"
                  name="colorBy"
                  checked={colorBy === opt}
                  onChange={() => setColorBy(opt)}
                />
                {opt}
              </label>
            ))}
          </div>

          <h3>Color palette</h3>
          <div className="cal-exp-radio-row">
            {(["Modern", "Classic"] as const).map((opt) => (
              <label key={opt}>
                <input
                  type="radio"
                  name="palette"
                  checked={palette === opt}
                  onChange={() => setPalette(opt)}
                />
                {opt}
              </label>
            ))}
          </div>

          <h3>Grid time slot gap</h3>
          <div className="cal-exp-radio-row">
            {(["30", "15", "10", "5"] as const).map((opt) => (
              <label key={opt}>
                <input
                  type="radio"
                  name="slotGap"
                  checked={slotGap === opt}
                  onChange={() => setSlotGap(opt)}
                />
                {opt} min
              </label>
            ))}
          </div>

          <h3>View options</h3>
          <label className="cal-exp-check">
            <input
              type="checkbox"
              checked={showWeekends}
              onChange={(e) => setShowWeekends(e.target.checked)}
            />
            Show weekends
          </label>

          <h3>Notification Settings</h3>
          <label className="cal-exp-check">
            <input
              type="checkbox"
              checked={dontSendReminders}
              onChange={(e) => setDontSendReminders(e.target.checked)}
            />
            Don&apos;t send reminders
          </label>

          <h3>Site calendar time zone</h3>
          <label className="bk-field">
            <span className="bk-label">Time zone</span>
            <select
              className="bk-select"
              value={timeZone}
              onChange={(e) => setTimeZone(e.target.value)}
            >
              <option>GMT+03:00 Istanbul</option>
              <option>GMT+00:00 London</option>
              <option>GMT-05:00 New York</option>
            </select>
          </label>
          <label className="bk-field">
            <span className="bk-label">First weekday</span>
            <select
              className="bk-select"
              value={firstWeekday}
              onChange={(e) =>
                setFirstWeekday(e.target.value as "Sunday" | "Monday")
              }
            >
              <option value="Sunday">Sunday</option>
              <option value="Monday">Monday</option>
            </select>
          </label>

          <div style={{ marginTop: 20 }}>
            <button
              type="button"
              className="bk-btn bk-btn-secondary"
              onClick={() => setDrawer(null)}
            >
              Close
            </button>
          </div>
        </aside>
      )}

      {syncOpen && (
        <Modal
          title="Sync your personal calendar"
          subtitle="Connect an external calendar to avoid double bookings."
          onClose={() => setSyncOpen(false)}
          footer={
            <>
              <button
                type="button"
                className="bk-btn bk-btn-ghost"
                onClick={() => setSyncOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="bk-btn bk-btn-primary"
                onClick={() => setSyncOpen(false)}
              >
                Connect
              </button>
            </>
          }
        >
          <label className="bk-field">
            <span className="bk-label">Provider</span>
            <select className="bk-select" defaultValue="Google Calendar">
              <option>Google Calendar</option>
            </select>
          </label>
        </Modal>
      )}

      {inviteOpen && (
        <Modal
          title="Invite booking collaborators"
          subtitle="Invite teammates to help manage bookings."
          onClose={() => setInviteOpen(false)}
          footer={
            <>
              <button
                type="button"
                className="bk-btn bk-btn-ghost"
                onClick={() => setInviteOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="bk-btn bk-btn-primary"
                onClick={() => {
                  setInviteOpen(false);
                  setInviteEmail("");
                }}
              >
                Send Invite
              </button>
            </>
          }
        >
          <label className="bk-field">
            <span className="bk-label">Role</span>
            <select
              className="bk-select"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
            >
              <option>Booking manager</option>
              <option>Booking staff</option>
              <option>Viewer</option>
            </select>
          </label>
          <label className="bk-field">
            <span className="bk-label">Email</span>
            <input
              className="bk-input"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="name@example.com"
            />
          </label>
          <p className="bk-help" style={{ marginTop: 12 }}>
            Role access is controlled in Roles &amp; Permissions.
          </p>
        </Modal>
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
              <button
                type="button"
                className="bk-btn bk-btn-primary"
                onClick={() => setExportOpen(false)}
              >
                Export
              </button>
            </>
          }
        >
          <div className="cal-exp-radio-row">
            {(["All", "Filtered", "Selected"] as const).map((opt) => (
              <label key={opt}>
                <input
                  type="radio"
                  name="exportScope"
                  checked={exportScope === opt}
                  onChange={() => setExportScope(opt)}
                />
                {opt}
              </label>
            ))}
          </div>
        </Modal>
      )}

      {createKind && (
        <Modal
          title={createKind}
          subtitle="Add an event to the calendar."
          onClose={() => setCreateKind(null)}
          footer={
            <>
              <button
                type="button"
                className="bk-btn bk-btn-ghost"
                onClick={() => setCreateKind(null)}
              >
                Cancel
              </button>
              <button type="button" className="bk-btn bk-btn-primary" onClick={() => void saveCreate()}>
                Save
              </button>
            </>
          }
        >
          <label className="bk-field">
            <span className="bk-label">Title</span>
            <input
              className="bk-input"
              value={createForm.title}
              onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
            />
          </label>
          <label className="bk-field">
            <span className="bk-label">Staff</span>
            <select
              className="bk-select"
              value={createForm.staffName}
              onChange={(e) => setCreateForm({ ...createForm, staffName: e.target.value })}
            >
              {staff.map((m) => (
                <option key={m.id} value={m.name}>
                  {m.name}
                </option>
              ))}
              {!staff.length && <option value="Unassigned">Unassigned</option>}
            </select>
          </label>
          <label className="bk-field">
            <span className="bk-label">Day</span>
            <select
              className="bk-select"
              value={createForm.dayIndex}
              onChange={(e) =>
                setCreateForm({ ...createForm, dayIndex: Number(e.target.value) })
              }
            >
              {DAY_LABELS.map((label, i) => (
                <option key={label} value={i}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="bk-field">
            <span className="bk-label">Hour</span>
            <select
              className="bk-select"
              value={createForm.hour}
              onChange={(e) =>
                setCreateForm({ ...createForm, hour: Number(e.target.value) })
              }
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {formatHour(h)}
                </option>
              ))}
            </select>
          </label>
        </Modal>
      )}

      {toast && (
        <div className="cal-exp-toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfWeek(d: Date) {
  const x = startOfDay(d);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function formatHour(h: number) {
  if (h === 0) return "12 AM";
  if (h === 12) return "12 PM";
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = ((h + 11) % 12) + 1;
  return `${hr} ${ampm}`;
}

function buildMiniMonth(monthStart: Date) {
  const first = startOfMonth(monthStart);
  const start = startOfWeek(first);
  const today = startOfDay(new Date());
  const cells: {
    key: string;
    date: Date;
    otherMonth: boolean;
    isToday: boolean;
  }[] = [];
  for (let i = 0; i < 42; i++) {
    const date = addDays(start, i);
    cells.push({
      key: date.toISOString(),
      date,
      otherMonth: date.getMonth() !== first.getMonth(),
      isToday: date.getTime() === today.getTime(),
    });
  }
  return cells;
}
