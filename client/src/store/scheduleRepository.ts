import type {
  AddWorkingHoursInput,
  DefaultDayHours,
  ScheduleSnapshot,
  StaffHoursBlock,
  StaffMember,
  UpdateStaffHoursInput,
} from "../types/schedule";

/**
 * Repository interface — swap local implementation for Nest HTTP later.
 */
export interface ScheduleRepository {
  load(): Promise<ScheduleSnapshot>;
  listStaff(): Promise<StaffMember[]>;
  listBlocksInRange(fromDate: string, toDate: string): Promise<StaffHoursBlock[]>;
  addWorkingHours(input: AddWorkingHoursInput): Promise<StaffHoursBlock[]>;
  updateHours(id: string, patch: UpdateStaffHoursInput): Promise<StaffHoursBlock>;
  removeHours(id: string): Promise<void>;
  saveDefaultHours(hours: DefaultDayHours[]): Promise<DefaultDayHours[]>;
}
