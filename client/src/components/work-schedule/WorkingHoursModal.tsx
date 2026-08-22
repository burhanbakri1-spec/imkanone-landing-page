import { useMemo, useState, type FormEvent } from "react";
import { scheduleApi } from "../../api/scheduleApi";
import type {
  DayOfWeek,
  Location,
  RepeatRule,
  StaffHoursBlock,
  StaffMember,
} from "../../types/schedule";
import { to12h, toDateKey } from "../../utils/time";

const DAY_META: { day: DayOfWeek; label: string; aria: string }[] = [
  { day: 0, label: "Su", aria: "Sunday" },
  { day: 1, label: "Mo", aria: "Monday" },
  { day: 2, label: "Tu", aria: "Tuesday" },
  { day: 3, label: "We", aria: "Wednesday" },
  { day: 4, label: "Th", aria: "Thursday" },
  { day: 5, label: "Fr", aria: "Friday" },
  { day: 6, label: "Sa", aria: "Saturday" },
];

function toInputDate(iso: string): string {
  // YYYY-MM-DD stays
  return iso;
}

function fromDisplayTime(t: string): string {
  // accept HH:mm from type=time
  return t;
}

type Props = {
  mode: "add" | "edit";
  staff: StaffMember[];
  locations: Location[];
  /** Preselect staff when opened from a cell */
  defaultStaffIds?: string[];
  defaultDate?: string;
  editingBlock?: StaffHoursBlock | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
};

export function WorkingHoursModal({
  mode,
  staff,
  locations,
  defaultStaffIds,
  defaultDate,
  editingBlock,
  onClose,
  onSaved,
}: Props) {
  const today = toDateKey(new Date());
  const [staffQuery, setStaffQuery] = useState("");
  const [staffIds, setStaffIds] = useState<string[]>(
    editingBlock
      ? [editingBlock.staffId]
      : defaultStaffIds?.length
        ? defaultStaffIds
        : staff.map((s) => s.id),
  );
  const [startDate, setStartDate] = useState(
    editingBlock?.date ?? defaultDate ?? today,
  );
  const [endDateEnabled, setEndDateEnabled] = useState(!!editingBlock?.endDate);
  const [endDate, setEndDate] = useState(editingBlock?.endDate ?? "");
  const [repeat, setRepeat] = useState<RepeatRule>(
    editingBlock?.repeat ?? "weekly",
  );
  const [days, setDays] = useState<DayOfWeek[]>(() => {
    if (editingBlock) {
      const d = new Date(editingBlock.date + "T12:00:00").getDay() as DayOfWeek;
      return [d];
    }
    if (defaultDate) {
      return [new Date(defaultDate + "T12:00:00").getDay() as DayOfWeek];
    }
    return [new Date().getDay() as DayOfWeek];
  });
  const [start, setStart] = useState(editingBlock?.start ?? "17:30");
  const [end, setEnd] = useState(editingBlock?.end ?? "18:30");
  const [locationId, setLocationId] = useState<string>(
    editingBlock?.locationId ?? "all",
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const filteredStaff = useMemo(() => {
    const q = staffQuery.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter((s) => s.name.toLowerCase().includes(q));
  }, [staff, staffQuery]);

  const toggleStaff = (id: string) => {
    if (mode === "edit") {
      setStaffIds([id]);
      return;
    }
    setStaffIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleDay = (day: DayOfWeek) => {
    setDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (mode === "edit" && editingBlock) {
        await scheduleApi.updateHours(editingBlock.id, {
          date: startDate,
          start: fromDisplayTime(start),
          end: fromDisplayTime(end),
          locationId: locationId === "all" ? null : locationId,
        });
      } else {
        await scheduleApi.addWorkingHours({
          staffIds,
          startDate: toInputDate(startDate),
          endDate: endDateEnabled && endDate ? endDate : null,
          repeat,
          days: repeat === "weekly" ? days : [],
          start: fromDisplayTime(start),
          end: fromDisplayTime(end),
          locationId: locationId === "all" ? null : locationId,
        });
      }
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ws-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="ws-sheet"
        role="dialog"
        aria-labelledby="ws-hours-title"
        onClick={(ev) => ev.stopPropagation()}
      >
        <button
          type="button"
          className="ws-sheet-close"
          aria-label="Close"
          onClick={onClose}
        >
          ×
        </button>

        <h2 id="ws-hours-title">
          {mode === "edit" ? "Edit working hours" : "Add working hours"}
        </h2>
        <p className="ws-sheet-sub">
          Set when and where your staff members are available to take bookings.
        </p>

        <form className="ws-sheet-form" onSubmit={(e) => void submit(e)}>
          <div className="ws-field">
            <span className="ws-label">Staff members</span>
            <input
              className="ws-input"
              placeholder="Search staff members"
              value={staffQuery}
              onChange={(e) => setStaffQuery(e.target.value)}
            />
            <div className="ws-staff-pick">
              {filteredStaff.map((s) => {
                const checked = staffIds.includes(s.id);
                return (
                  <label key={s.id} className="ws-staff-chip">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleStaff(s.id)}
                      disabled={mode === "edit"}
                    />
                    <span
                      className="ws-avatar sm"
                      style={{ background: s.color }}
                    >
                      {s.name.slice(0, 1).toUpperCase()}
                    </span>
                    {s.name}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="ws-field-row">
            <label className="ws-field">
              <span className="ws-label">Start date</span>
              <input
                className="ws-input"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </label>
            <div className="ws-field">
              <span className="ws-label">&nbsp;</span>
              {!endDateEnabled ? (
                <button
                  type="button"
                  className="ws-link-btn"
                  onClick={() => setEndDateEnabled(true)}
                >
                  Set end date
                </button>
              ) : (
                <input
                  className="ws-input"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  aria-label="End date"
                />
              )}
            </div>
          </div>

          {mode === "add" && (
            <>
              <label className="ws-field">
                <span className="ws-label">Repeats</span>
                <select
                  className="ws-input"
                  value={repeat}
                  onChange={(e) => setRepeat(e.target.value as RepeatRule)}
                >
                  <option value="does-not-repeat">Does not repeat</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </label>

              {repeat === "weekly" && (
                <div className="ws-field">
                  <span className="ws-label">Days</span>
                  <div className="ws-day-toggles">
                    {DAY_META.map((d) => {
                      const on = days.includes(d.day);
                      return (
                        <button
                          key={d.day}
                          type="button"
                          className={`ws-day-toggle${on ? " is-on" : ""}`}
                          aria-label={d.aria}
                          aria-pressed={on}
                          onClick={() => toggleDay(d.day)}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="ws-field">
            <span className="ws-label">Time</span>
            <div className="ws-field-row">
              <input
                className="ws-input"
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                required
                aria-label={`Start ${to12h(start)}`}
              />
              <input
                className="ws-input"
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                required
                aria-label={`End ${to12h(end)}`}
              />
            </div>
          </div>

          <label className="ws-field">
            <span className="ws-label">Location</span>
            <select
              className="ws-input"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
            >
              <option value="all">All locations</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>

          {error && <p className="ws-field-error">{error}</p>}

          <div className="ws-sheet-footer">
            <button type="button" className="ws-btn ws-btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="ws-btn ws-btn-primary"
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
