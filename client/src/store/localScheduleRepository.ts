import type {
  AddWorkingHoursInput,
  DayOfWeek,
  DefaultDayHours,
  ScheduleSnapshot,
  StaffHoursBlock,
  StaffMember,
  UpdateStaffHoursInput,
} from "../types/schedule";
import type { ScheduleRepository } from "./scheduleRepository";
import {
  addDays,
  isValidRange,
  newId,
  parseDateKey,
  rangesOverlap,
  startOfWeekSunday,
  toDateKey,
} from "../utils/time";

const STORAGE_KEY = "booking-calender.work-schedule.v2";

function defaultWeekHours(): DefaultDayHours[] {
  return ([0, 1, 2, 3, 4, 5, 6] as DayOfWeek[]).map((day) => ({
    day,
    enabled: day >= 1 && day <= 5,
    start: "09:00",
    end: "17:00",
  }));
}

function seedSnapshot(): ScheduleSnapshot {
  const weekStart = startOfWeekSunday(new Date());
  const d = (offset: number) => toDateKey(addDays(weekStart, offset));

  const locations = [
    { id: "loc_main", name: "Main location" },
    { id: "loc_downtown", name: "Downtown" },
  ];

  const staff: StaffMember[] = [
    { id: "staff_burhan", name: "burhan", locationId: "loc_main", color: "#3899EC" },
    { id: "staff_ruba", name: "ruba", locationId: "loc_main", color: "#3AA99E" },
    { id: "staff_shren", name: "shren", locationId: "loc_downtown", color: "#F5A623" },
  ];

  const blocks: StaffHoursBlock[] = [
    {
      id: newId("blk"),
      staffId: "staff_burhan",
      date: d(0),
      start: "09:00",
      end: "12:00",
      locationId: "loc_main",
      repeat: "weekly",
      endDate: null,
    },
    {
      id: newId("blk"),
      staffId: "staff_burhan",
      date: d(1),
      start: "10:00",
      end: "17:00",
      locationId: "loc_main",
      repeat: "weekly",
      endDate: null,
    },
    {
      id: newId("blk"),
      staffId: "staff_ruba",
      date: d(1),
      start: "09:00",
      end: "15:00",
      locationId: "loc_main",
      repeat: "does-not-repeat",
      endDate: null,
    },
    {
      id: newId("blk"),
      staffId: "staff_shren",
      date: d(2),
      start: "11:00",
      end: "18:00",
      locationId: "loc_downtown",
      repeat: "weekly",
      endDate: null,
    },
  ];

  return {
    locations,
    staff,
    blocks,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    defaultHours: defaultWeekHours(),
  };
}

function readStore(): ScheduleSnapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as ScheduleSnapshot;
  } catch {
    /* fall through */
  }
  const seeded = seedSnapshot();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  return seeded;
}

function writeStore(snap: ScheduleSnapshot): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snap));
}

function assertNoOverlap(
  blocks: StaffHoursBlock[],
  staffId: string,
  date: string,
  start: string,
  end: string,
  exceptId?: string,
): void {
  if (!isValidRange(start, end)) {
    throw new Error("End time must be after start time.");
  }
  const conflict = blocks.find(
    (b) =>
      b.staffId === staffId &&
      b.date === date &&
      b.id !== exceptId &&
      rangesOverlap(b.start, b.end, start, end),
  );
  if (conflict) {
    throw new Error("This time overlaps an existing block for that staff member.");
  }
}

/** Expand add-working-hours into concrete dated blocks for the next ~12 weeks or until endDate. */
function expandDates(input: AddWorkingHoursInput): string[] {
  const start = parseDateKey(input.startDate);
  const hardEnd = input.endDate
    ? parseDateKey(input.endDate)
    : addDays(start, input.repeat === "does-not-repeat" ? 0 : 7 * 12);

  const dates: string[] = [];
  for (let d = new Date(start); d <= hardEnd; d = addDays(d, 1)) {
    const key = toDateKey(d);
    const dow = d.getDay() as DayOfWeek;
    if (input.repeat === "does-not-repeat") {
      if (key === input.startDate) dates.push(key);
      break;
    }
    if (input.repeat === "daily") {
      dates.push(key);
      continue;
    }
    // weekly
    if (input.days.includes(dow)) dates.push(key);
  }
  return dates;
}

export const localScheduleRepository: ScheduleRepository = {
  async load() {
    return readStore();
  },

  async listStaff() {
    return readStore().staff;
  },

  async listBlocksInRange(fromDate, toDate) {
    return readStore().blocks.filter(
      (b) => b.date >= fromDate && b.date <= toDate,
    );
  },

  async addWorkingHours(input) {
    if (!input.staffIds.length) throw new Error("Select at least one staff member.");
    if (!isValidRange(input.start, input.end)) {
      throw new Error("End time must be after start time.");
    }
    if (input.repeat === "weekly" && !input.days.length) {
      throw new Error("Select at least one day.");
    }

    const snap = readStore();
    const dates = expandDates(input);
    const created: StaffHoursBlock[] = [];

    for (const staffId of input.staffIds) {
      for (const date of dates) {
        assertNoOverlap(
          [...snap.blocks, ...created],
          staffId,
          date,
          input.start,
          input.end,
        );
        created.push({
          id: newId("blk"),
          staffId,
          date,
          start: input.start,
          end: input.end,
          locationId: input.locationId,
          repeat: input.repeat,
          endDate: input.endDate,
        });
      }
    }

    snap.blocks.push(...created);
    writeStore(snap);
    return created;
  },

  async updateHours(id, patch: UpdateStaffHoursInput) {
    const snap = readStore();
    const idx = snap.blocks.findIndex((b) => b.id === id);
    if (idx < 0) throw new Error("Block not found.");
    const current = snap.blocks[idx];
    const next = { ...current, ...patch };
    assertNoOverlap(
      snap.blocks,
      next.staffId,
      next.date,
      next.start,
      next.end,
      id,
    );
    snap.blocks[idx] = next;
    writeStore(snap);
    return next;
  },

  async removeHours(id) {
    const snap = readStore();
    snap.blocks = snap.blocks.filter((b) => b.id !== id);
    writeStore(snap);
  },

  async saveDefaultHours(hours) {
    const snap = readStore();
    snap.defaultHours = hours;
    writeStore(snap);
    return hours;
  },
};
