/** Domain model for Work Schedule — Nest/Prisma can mirror these later. */

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday

export type RepeatRule = "does-not-repeat" | "daily" | "weekly";

export type StaffMember = {
  id: string;
  name: string;
  locationId: string | null;
  color: string;
};

export type Location = {
  id: string;
  name: string;
};

/** Hours assigned to a staff member on a calendar date (YYYY-MM-DD). */
export type StaffHoursBlock = {
  id: string;
  staffId: string;
  date: string;
  start: string; // HH:mm 24h
  end: string;
  locationId: string | null;
  repeat: RepeatRule;
  endDate: string | null;
};

export type ScheduleSnapshot = {
  locations: Location[];
  staff: StaffMember[];
  blocks: StaffHoursBlock[];
  timezone: string;
  /** Site-wide default weekly hours (Edit default hours). */
  defaultHours: DefaultDayHours[];
};

export type DefaultDayHours = {
  day: DayOfWeek;
  enabled: boolean;
  start: string;
  end: string;
};

export type AddWorkingHoursInput = {
  staffIds: string[];
  startDate: string;
  endDate: string | null;
  repeat: RepeatRule;
  /** Which weekdays to apply when repeat is weekly (0=Sun). */
  days: DayOfWeek[];
  start: string;
  end: string;
  locationId: string | null;
};

export type UpdateStaffHoursInput = {
  start?: string;
  end?: string;
  date?: string;
  locationId?: string | null;
};
