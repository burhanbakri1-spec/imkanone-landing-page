import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { scheduleApi } from "../../api/scheduleApi";
import type { DefaultDayHours } from "../../types/schedule";
import { paths } from "../paths";
import { PageHeader } from "../ui";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function endsNextDay(start: string, end: string) {
  if (!start || !end) return false;
  return end <= start || end === "00:00" || end === "24:00";
}

export function DefaultHoursPage() {
  const [hours, setHours] = useState<DefaultDayHours[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void scheduleApi.load().then((s) => setHours(s.defaultHours));
  }, []);

  const update = (day: number, patch: Partial<DefaultDayHours>) => {
    setHours((prev) =>
      prev.map((h) => (h.day === day ? { ...h, ...patch } : h)),
    );
  };

  const save = async () => {
    setSaving(true);
    try {
      const next = await scheduleApi.saveDefaultHours(hours);
      setHours(next);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bk-page">
      <PageHeader
        title="Default Hours"
        subtitle="Set the default hours you and your staff are available for bookings."
        breadcrumb={[
          { label: "Settings", to: paths.settings },
          { label: "Booking Settings", to: paths.settings },
          { label: "Default Hours" },
        ]}
        actions={
          <>
            <Link className="bk-btn bk-btn-secondary" to={paths.settings}>
              Cancel
            </Link>
            <button
              type="button"
              className="bk-btn bk-btn-primary"
              disabled={saving}
              onClick={() => void save()}
            >
              Save
            </button>
          </>
        }
      />

      <section className="bk-card bk-card-pad" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Set default hours</h2>
          <a
            className="bk-btn bk-btn-link"
            href="https://support.wix.com/en/article/wix-bookings-setting-your-availability"
            target="_blank"
            rel="noreferrer"
          >
            Get help with availability
          </a>
        </div>
        {hours.map((h) => (
          <div key={h.day} className="bk-day-row">
            <label style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 120 }}>
              <input
                type="checkbox"
                checked={h.enabled}
                onChange={(e) => update(h.day, { enabled: e.target.checked })}
              />
              {DAY_NAMES[h.day]}
            </label>
            <div className="bk-time-pair">
              <input
                className="bk-input"
                type="time"
                disabled={!h.enabled}
                value={h.start}
                onChange={(e) => update(h.day, { start: e.target.value })}
              />
              <span>–</span>
              <input
                className="bk-input"
                type="time"
                disabled={!h.enabled}
                value={h.end}
                onChange={(e) => update(h.day, { end: e.target.value })}
              />
            </div>
            <span className="bk-help">
              {!h.enabled
                ? "Closed"
                : endsNextDay(h.start, h.end)
                  ? "Ends on the next day"
                  : "Open"}
            </span>
          </div>
        ))}
      </section>

      <section className="bk-card bk-card-pad">
        <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700 }}>
          More scheduling tools
        </h2>
        <div className="bk-toggle-list">
          <div className="bk-toggle-row">
            <div>
              <strong>Work Schedule</strong>
              <div className="bk-help">Set staff hours on the weekly schedule.</div>
            </div>
            <Link className="bk-btn bk-btn-secondary" to={paths.availability}>
              Go to Work Schedule
            </Link>
          </div>
          <div className="bk-toggle-row">
            <div>
              <strong>Staff working hours</strong>
              <div className="bk-help">Manage staff and their individual hours.</div>
            </div>
            <Link className="bk-btn bk-btn-secondary" to={paths.staff}>
              Go to Staff
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
