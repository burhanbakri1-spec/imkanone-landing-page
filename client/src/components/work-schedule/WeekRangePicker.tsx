import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDays,
  formatWeekRangeLabel,
  startOfWeekSunday,
  toDateKey,
} from "../../utils/time";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

type Props = {
  weekStart: Date;
  onChangeWeekStart: (next: Date) => void;
};

function monthMatrix(view: Date): (Date | null)[][] {
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(
    view.getFullYear(),
    view.getMonth() + 1,
    0,
  ).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(view.getFullYear(), view.getMonth(), d));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

/** Wix-style week range field that opens a month calendar on click. */
export function WeekRangePicker({ weekStart, onChangeWeekStart }: Props) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(
    () => new Date(weekStart.getFullYear(), weekStart.getMonth(), 1),
  );
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setView(new Date(weekStart.getFullYear(), weekStart.getMonth(), 1));
  }, [open, weekStart]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const rows = useMemo(() => monthMatrix(view), [view]);
  const weekEnd = addDays(weekStart, 6);
  const weekStartKey = toDateKey(weekStart);
  const weekEndKey = toDateKey(weekEnd);
  const todayKey = toDateKey(new Date());

  const inSelectedWeek = (d: Date) => {
    const k = toDateKey(d);
    return k >= weekStartKey && k <= weekEndKey;
  };

  return (
    <div className="ws-date-picker" ref={rootRef}>
      <button
        type="button"
        className="ws-date-field"
        aria-label={formatWeekRangeLabel(weekStart)}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        <span>{formatWeekRangeLabel(weekStart)}</span>
        <svg
          className="ws-date-chevron"
          viewBox="0 0 24 24"
          width="18"
          height="18"
          aria-hidden="true"
        >
          <path
            fill="currentColor"
            d="M7 10l5 5 5-5H7z"
          />
        </svg>
      </button>

      {open && (
        <div className="ws-cal" role="dialog" aria-label="Choose week">
          <div className="ws-cal-head">
            <button
              type="button"
              className="ws-cal-nav"
              aria-label="Previous month"
              onClick={() =>
                setView((v) => new Date(v.getFullYear(), v.getMonth() - 1, 1))
              }
            >
              ‹
            </button>
            <div className="ws-cal-title">
              {MONTHS[view.getMonth()]} {view.getFullYear()}
            </div>
            <button
              type="button"
              className="ws-cal-nav"
              aria-label="Next month"
              onClick={() =>
                setView((v) => new Date(v.getFullYear(), v.getMonth() + 1, 1))
              }
            >
              ›
            </button>
          </div>

          <div className="ws-cal-weekdays">
            {WEEKDAYS.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>

          <div className="ws-cal-grid">
            {rows.map((row, ri) => (
              <div key={ri} className="ws-cal-row">
                {row.map((d, di) => {
                  if (!d) return <span key={`e-${di}`} className="ws-cal-cell is-empty" />;
                  const key = toDateKey(d);
                  const selected = inSelectedWeek(d);
                  const isToday = key === todayKey;
                  const isWeekStart = key === weekStartKey;
                  const isWeekEnd = key === weekEndKey;
                  return (
                    <button
                      key={key}
                      type="button"
                      className={[
                        "ws-cal-cell",
                        selected ? "is-in-week" : "",
                        isWeekStart ? "is-week-start" : "",
                        isWeekEnd ? "is-week-end" : "",
                        isToday ? "is-today" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => {
                        onChangeWeekStart(startOfWeekSunday(d));
                        setOpen(false);
                      }}
                    >
                      {d.getDate()}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
