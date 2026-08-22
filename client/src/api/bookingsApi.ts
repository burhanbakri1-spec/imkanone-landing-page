/**
 * Bookings API façade.
 * Today: localStorage. Later: VITE_API_URL → Nest.
 */

import { localBookingsRepository } from "../store/localBookingsRepository";
import type {
  AddonItem,
  BookingFormDef,
  BookingService,
  BookingsSnapshot,
  BookflowStep,
  CalendarEvent,
  Policy,
  ReminderChannel,
  ResourceRoom,
  ServiceCategory,
  ShareableLink,
  StaffRecord,
} from "../types/bookings";

const apiBase = import.meta.env.VITE_API_URL as string | undefined;

function repo() {
  if (apiBase) {
    console.info(
      "[bookingsApi] VITE_API_URL set; HTTP adapter not wired yet — using local repository.",
      apiBase,
    );
  }
  return localBookingsRepository;
}

export const bookingsApi = {
  load(): Promise<BookingsSnapshot> {
    return repo().load();
  },
  saveService(service: BookingService): Promise<BookingService> {
    return repo().saveService(service);
  },
  createService(partial: Omit<BookingService, "id">): Promise<BookingService> {
    return repo().createService(partial);
  },
  saveCategories(categories: ServiceCategory[]): Promise<ServiceCategory[]> {
    return repo().saveCategories(categories);
  },
  saveStaff(member: StaffRecord): Promise<StaffRecord> {
    return repo().saveStaff(member);
  },
  createStaff(partial: Omit<StaffRecord, "id">): Promise<StaffRecord> {
    return repo().createStaff(partial);
  },
  saveAddon(addon: AddonItem): Promise<AddonItem> {
    return repo().saveAddon(addon);
  },
  saveResource(resource: ResourceRoom): Promise<ResourceRoom> {
    return repo().saveResource(resource);
  },
  savePolicy(policy: Policy): Promise<Policy> {
    return repo().savePolicy(policy);
  },
  saveForm(form: BookingFormDef): Promise<BookingFormDef> {
    return repo().saveForm(form);
  },
  saveLink(link: ShareableLink): Promise<ShareableLink> {
    return repo().saveLink(link);
  },
  setIntegrationConnected(id: string, connected: boolean): Promise<void> {
    return repo().setIntegrationConnected(id, connected);
  },
  setReminderSend(channels: ReminderChannel[]): Promise<void> {
    return repo().setReminderSend(channels);
  },
  setReminderGet(channels: ReminderChannel[]): Promise<void> {
    return repo().setReminderGet(channels);
  },
  setBookflow(steps: BookflowStep[]): Promise<void> {
    return repo().setBookflow(steps);
  },
  addCalendarEvent(event: Omit<CalendarEvent, "id">): Promise<CalendarEvent> {
    return repo().addCalendarEvent(event);
  },
};
