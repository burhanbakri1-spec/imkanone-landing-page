/** Bookings domain models — Nest/Prisma can mirror later. */

export type ServiceType = "APPOINTMENT" | "CLASS" | "COURSE";

export type BookingService = {
  id: string;
  name: string;
  type: ServiceType;
  category: string;
  durationMinutes: number;
  price: number;
  currency: string;
  staffIds: string[];
  locationName: string;
  imageUrl?: string;
};

export type ServiceCategory = {
  id: string;
  name: string;
};

export type StaffRecord = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  locationName: string;
  color: string;
  active: boolean;
};

export type BookingStatus = "confirmed" | "pending" | "canceled" | "completed";

export type BookingRow = {
  id: string;
  clientName: string;
  serviceName: string;
  staffName: string;
  startAt: string;
  endAt: string;
  status: BookingStatus;
  kind: "appointment" | "class" | "course";
  locationName: string;
  payment: string;
};

export type ResourceRoom = {
  id: string;
  name: string;
  type: "room" | "equipment";
  capacity: number;
  locationName: string;
};

export type AddonItem = {
  id: string;
  name: string;
  price: number;
  durationMinutes: number;
  active: boolean;
};

export type Policy = {
  id: string;
  name: string;
  cancellationHours: number;
  noShowFeePercent: number;
  isDefault: boolean;
};

export type BookingFormDef = {
  id: string;
  name: string;
  fields: string[];
  isDefault: boolean;
};

export type ShareableLink = {
  id: string;
  label: string;
  kind: "service-list" | "calendar" | "page";
  url: string;
};

export type IntegrationTab =
  | "Booking channels"
  | "Communications"
  | "Business management"
  | "Payroll & invoice"
  | "Marketing"
  | "Website widgets"
  | "Mobile apps";

export type IntegrationCard = {
  id: string;
  name: string;
  description: string;
  tab: IntegrationTab;
  connected: boolean;
};

export type ReminderChannel = {
  id: string;
  name: string;
  enabled: boolean;
  description: string;
};

export type BookflowStep = {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
};

export type CalendarEvent = {
  id: string;
  title: string;
  dayIndex: number;
  hour: number;
  staffName: string;
};

export type BookingsSnapshot = {
  services: BookingService[];
  categories: ServiceCategory[];
  staff: StaffRecord[];
  bookings: BookingRow[];
  resources: ResourceRoom[];
  addons: AddonItem[];
  policies: Policy[];
  forms: BookingFormDef[];
  links: ShareableLink[];
  integrations: IntegrationCard[];
  remindersSend: ReminderChannel[];
  remindersGet: ReminderChannel[];
  bookflow: BookflowStep[];
  calendarEvents: CalendarEvent[];
  analytics: {
    appointments: { label: string; value: number }[];
    classes: { label: string; value: number }[];
  };
};
