/**
 * Schedule API façade.
 * Today: localStorage. Later: VITE_API_URL → Nest.
 */

import { localScheduleRepository } from "../store/localScheduleRepository";
import type { ScheduleRepository } from "../store/scheduleRepository";
import type {
  AddWorkingHoursInput,
  DefaultDayHours,
  ScheduleSnapshot,
  StaffHoursBlock,
  StaffMember,
  UpdateStaffHoursInput,
} from "../types/schedule";

const apiBase = import.meta.env.VITE_API_URL as string | undefined;

function activeRepo(): ScheduleRepository {
  if (apiBase) {
    console.info(
      "[scheduleApi] VITE_API_URL set; HTTP adapter not wired yet — using local repository.",
      apiBase,
    );
  }
  return localScheduleRepository;
}

export const scheduleApi = {
  load(): Promise<ScheduleSnapshot> {
    return activeRepo().load();
  },
  listStaff(): Promise<StaffMember[]> {
    return activeRepo().listStaff();
  },
  listBlocksInRange(from: string, to: string): Promise<StaffHoursBlock[]> {
    return activeRepo().listBlocksInRange(from, to);
  },
  addWorkingHours(input: AddWorkingHoursInput): Promise<StaffHoursBlock[]> {
    return activeRepo().addWorkingHours(input);
  },
  updateHours(id: string, patch: UpdateStaffHoursInput): Promise<StaffHoursBlock> {
    return activeRepo().updateHours(id, patch);
  },
  removeHours(id: string): Promise<void> {
    return activeRepo().removeHours(id);
  },
  saveDefaultHours(hours: DefaultDayHours[]): Promise<DefaultDayHours[]> {
    return activeRepo().saveDefaultHours(hours);
  },
};
