import type { DayOfWeek } from "../types/schedule";

/** Parse "HH:mm" to minutes from midnight. */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Display like Wix: "9:00 AM - 12:00 PM" */
export function formatTimeRange12h(start: string, end: string): string {
  return `${to12h(start)} - ${to12h(end)}`;
}

export function to12h(t: string): string {
  const [hh, mm] = t.split(":").map(Number);
  const period = hh >= 12 ? "PM" : "AM";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${String(mm).padStart(2, "0")} ${period}`;
}

export function rangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  const as = timeToMinutes(aStart);
  const ae = timeToMinutes(aEnd);
  const bs = timeToMinutes(bStart);
  const be = timeToMinutes(bEnd);
  return as < be && bs < ae;
}

export function isValidRange(start: string, end: string): boolean {
  return timeToMinutes(end) > timeToMinutes(start);
}

/** Local YYYY-MM-DD */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Sunday-start week containing `anchor`. */
export function startOfWeekSunday(anchor: Date): Date {
  const d = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  d.setDate(d.getDate() - d.getDay());
  return d;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

export function weekDates(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function dayOfWeekFromDate(d: Date): DayOfWeek {
  return d.getDay() as DayOfWeek;
}

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function formatDayHeader(d: Date): { dayNum: number; weekday: string } {
  return { dayNum: d.getDate(), weekday: DAY_SHORT[d.getDay()] };
}

export function formatWeekRangeLabel(weekStart: Date): string {
  const end = addDays(weekStart, 6);
  const fmt = (x: Date) =>
    x.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  return `${fmt(weekStart)}-${fmt(end)}`;
}

export function newId(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
