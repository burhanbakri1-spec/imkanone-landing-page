import { useState, type FormEvent } from "react";
import { scheduleApi } from "../../api/scheduleApi";
import type { DayOfWeek, DefaultDayHours } from "../../types/schedule";

const LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Props = {
  initial: DefaultDayHours[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
};

export function DefaultHoursModal({ initial, onClose, onSaved }: Props) {
  const [hours, setHours] = useState<DefaultDayHours[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const patch = (day: DayOfWeek, next: Partial<DefaultDayHours>) => {
    setHours((prev) =>
      prev.map((h) => (h.day === day ? { ...h, ...next } : h)),
    );
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await scheduleApi.saveDefaultHours(hours);
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ws-modal-backdrop" onClick={onClose}>
      <div
        className="ws-sheet"
        role="dialog"
        aria-labelledby="ws-default-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="ws-sheet-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
        <h2 id="ws-default-title">Edit default hours</h2>
        <p className="ws-sheet-sub">
          Default hours apply to staff unless custom working hours override them.
        </p>
        <form onSubmit={(e) => void submit(e)}>
          <div className="ws-default-list">
            {hours.map((h) => (
              <div key={h.day} className="ws-default-row">
                <label className="ws-check">
                  <input
                    type="checkbox"
                    checked={h.enabled}
                    onChange={(e) => patch(h.day, { enabled: e.target.checked })}
                  />
                  {LABELS[h.day]}
                </label>
                <input
                  className="ws-input"
                  type="time"
                  disabled={!h.enabled}
                  value={h.start}
                  onChange={(e) => patch(h.day, { start: e.target.value })}
                />
                <input
                  className="ws-input"
                  type="time"
                  disabled={!h.enabled}
                  value={h.end}
                  onChange={(e) => patch(h.day, { end: e.target.value })}
                />
              </div>
            ))}
          </div>
          {error && <p className="ws-field-error">{error}</p>}
          <div className="ws-sheet-footer">
            <button type="button" className="ws-btn ws-btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="ws-btn ws-btn-primary" disabled={saving}>
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
