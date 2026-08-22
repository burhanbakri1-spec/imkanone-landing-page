import type {
  AddonItem,
  BookingFormDef,
  BookingRow,
  BookingService,
  BookingsSnapshot,
  BookflowStep,
  CalendarEvent,
  IntegrationCard,
  Policy,
  ReminderChannel,
  ResourceRoom,
  ServiceCategory,
  ShareableLink,
  StaffRecord,
} from "../types/bookings";

const STORAGE_KEY = "bookings.v2";

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function seed(): BookingsSnapshot {
  const staff: StaffRecord[] = [
    {
      id: "st_1",
      name: "Alex Rivera",
      email: "alex@example.com",
      phone: "+1 555 0101",
      role: "Owner",
      locationName: "Main Studio",
      color: "#116dff",
      active: true,
    },
    {
      id: "st_2",
      name: "Jordan Lee",
      email: "jordan@example.com",
      phone: "+1 555 0102",
      role: "Staff",
      locationName: "Main Studio",
      color: "#0e7c3a",
      active: true,
    },
    {
      id: "st_3",
      name: "Sam Patel",
      email: "sam@example.com",
      phone: "+1 555 0103",
      role: "Staff",
      locationName: "Downtown",
      color: "#c45c16",
      active: true,
    },
  ];

  const categories: ServiceCategory[] = [
    { id: "cat_1", name: "Hair" },
    { id: "cat_2", name: "Wellness" },
    { id: "cat_3", name: "Classes" },
  ];

  const services: BookingService[] = [
    {
      id: "svc_1",
      name: "Consultation",
      type: "APPOINTMENT",
      category: "Hair",
      durationMinutes: 30,
      price: 0,
      currency: "USD",
      staffIds: ["st_1", "st_2"],
      locationName: "Main Studio",
    },
    {
      id: "svc_2",
      name: "Haircut",
      type: "APPOINTMENT",
      category: "Hair",
      durationMinutes: 45,
      price: 45,
      currency: "USD",
      staffIds: ["st_1", "st_2"],
      locationName: "Main Studio",
    },
    {
      id: "svc_3",
      name: "Color treatment",
      type: "APPOINTMENT",
      category: "Hair",
      durationMinutes: 90,
      price: 120,
      currency: "USD",
      staffIds: ["st_2"],
      locationName: "Main Studio",
    },
    {
      id: "svc_4",
      name: "Yoga flow",
      type: "CLASS",
      category: "Classes",
      durationMinutes: 60,
      price: 20,
      currency: "USD",
      staffIds: ["st_3"],
      locationName: "Downtown",
    },
    {
      id: "svc_5",
      name: "6-week wellness",
      type: "COURSE",
      category: "Wellness",
      durationMinutes: 60,
      price: 199,
      currency: "USD",
      staffIds: ["st_1", "st_3"],
      locationName: "Downtown",
    },
  ];

  const now = new Date();
  const iso = (d: Date) => d.toISOString();
  const bookings: BookingRow[] = [
    {
      id: "bk_1",
      clientName: "Casey Morgan",
      serviceName: "Haircut",
      staffName: "Alex Rivera",
      startAt: iso(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0)),
      endAt: iso(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 45)),
      status: "confirmed",
      kind: "appointment",
      locationName: "Main Studio",
      payment: "Paid",
    },
    {
      id: "bk_2",
      clientName: "Riley Quinn",
      serviceName: "Consultation",
      staffName: "Jordan Lee",
      startAt: iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 14, 0)),
      endAt: iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 14, 30)),
      status: "pending",
      kind: "appointment",
      locationName: "Main Studio",
      payment: "Unpaid",
    },
    {
      id: "bk_3",
      clientName: "Group class",
      serviceName: "Yoga flow",
      staffName: "Sam Patel",
      startAt: iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 9, 0)),
      endAt: iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 10, 0)),
      status: "confirmed",
      kind: "class",
      locationName: "Downtown",
      payment: "—",
    },
    {
      id: "bk_4",
      clientName: "Taylor Brooks",
      serviceName: "6-week wellness",
      staffName: "Alex Rivera",
      startAt: iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3, 11, 0)),
      endAt: iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3, 12, 0)),
      status: "confirmed",
      kind: "course",
      locationName: "Downtown",
      payment: "Paid",
    },
  ];

  const resources: ResourceRoom[] = [];

  const addons: AddonItem[] = [];

  const policies: Policy[] = [
    {
      id: "pol_1",
      name: "Default policy",
      cancellationHours: 24,
      noShowFeePercent: 50,
      isDefault: true,
    },
  ];

  const forms: BookingFormDef[] = [
    {
      id: "form_1",
      name: "Default booking form",
      fields: ["Name", "Email", "Phone", "Notes"],
      isDefault: true,
    },
  ];

  const links: ShareableLink[] = [
    {
      id: "link_1",
      label: "All services",
      kind: "service-list",
      url: "https://example.com/book/services",
    },
    {
      id: "link_2",
      label: "Booking calendar",
      kind: "calendar",
      url: "https://example.com/book/calendar",
    },
  ];

  const integrations: IntegrationCard[] = [
    {
      id: "int_fb",
      name: "Facebook",
      description: "Let clients book services from your Facebook page.",
      tab: "Booking channels",
      connected: false,
    },
    {
      id: "int_ig",
      name: "Instagram",
      description: "Add booking to your Instagram profile.",
      tab: "Booking channels",
      connected: false,
    },
    {
      id: "int_google",
      name: "Google",
      description: "Show up in Google Search and Maps with online booking.",
      tab: "Booking channels",
      connected: false,
    },
    {
      id: "int_hopp",
      name: "Hopp",
      description: "Reach more clients through the Hopp marketplace.",
      tab: "Booking channels",
      connected: false,
    },
    {
      id: "int_3",
      name: "WhatsApp",
      description: "Send booking updates on WhatsApp.",
      tab: "Communications",
      connected: true,
    },
    {
      id: "int_4",
      name: "Zapier",
      description: "Connect Bookings to thousands of apps.",
      tab: "Business management",
      connected: false,
    },
    {
      id: "int_5",
      name: "QuickBooks",
      description: "Sync invoices and payments.",
      tab: "Payroll & invoice",
      connected: false,
    },
    {
      id: "int_6",
      name: "Mailchimp",
      description: "Add bookers to marketing lists.",
      tab: "Marketing",
      connected: false,
    },
    {
      id: "int_7",
      name: "Bookings widget",
      description: "Embed a booking widget on any site.",
      tab: "Website widgets",
      connected: true,
    },
    {
      id: "int_8",
      name: "Wix Owner app",
      description: "Manage bookings on mobile.",
      tab: "Mobile apps",
      connected: true,
    },
  ];

  const remindersSend: ReminderChannel[] = [
    {
      id: "rs_1",
      name: "when they book",
      enabled: false,
      description: "Session booked",
    },
    {
      id: "rs_2",
      name: "booking canceled",
      enabled: false,
      description: "Booking canceled",
    },
    {
      id: "rs_3",
      name: "change to appointment or class",
      enabled: false,
      description: "Appointment or class updated",
    },
    {
      id: "rs_4",
      name: "change to a course",
      enabled: false,
      description: "Course updated",
    },
    {
      id: "rs_5",
      name: "pending confirmation",
      enabled: false,
      description: "Appointment requested",
    },
    {
      id: "rs_6",
      name: "approved",
      enabled: false,
      description: "Appointment request approved",
    },
    {
      id: "rs_7",
      name: "declined",
      enabled: false,
      description: "Appointment request declined",
    },
    {
      id: "rs_8",
      name: "a day before session",
      enabled: false,
      description: "Session starts",
    },
  ];

  const remindersGet: ReminderChannel[] = [
    {
      id: "rg_1",
      name: "Notify me when someone books one of my services",
      enabled: true,
      description: "Session booked",
    },
    {
      id: "rg_2",
      name: "cancels their request to book",
      enabled: true,
      description: "Booking canceled",
    },
    {
      id: "rg_3",
      name: "cancels their booking",
      enabled: true,
      description: "Booking canceled",
    },
    {
      id: "rg_4",
      name: "reschedules their booking",
      enabled: true,
      description: "Appointment or class updated",
    },
    {
      id: "rg_5",
      name: "I need to review a booking request",
      enabled: true,
      description: "Appointment requested",
    },
  ];

  const bookflow: BookflowStep[] = [
    {
      id: "bf_service",
      title: "Service selection",
      description: "one",
      enabled: true,
    },
    {
      id: "bf_staff",
      title: "Staff selection",
      description: "clients|any|calendar",
      enabled: true,
    },
    {
      id: "bf_location",
      title: "Location selection",
      description: "calendar",
      enabled: true,
    },
    {
      id: "bf_slots",
      title: "Available time slots",
      description: "interval|30",
      enabled: true,
    },
    {
      id: "bf_tz",
      title: "Time zone",
      description: "client|choose",
      enabled: true,
    },
    {
      id: "bf_form",
      title: "Booking Form",
      description: "manage",
      enabled: true,
    },
    {
      id: "bf_checkout",
      title: "Checkout settings",
      description: "cart",
      enabled: true,
    },
  ];

  const calendarEvents: CalendarEvent[] = [
    {
      id: "ce_1",
      title: "Haircut · Casey",
      dayIndex: 1,
      hour: 10,
      staffName: "Alex Rivera",
    },
    {
      id: "ce_2",
      title: "Yoga flow",
      dayIndex: 3,
      hour: 9,
      staffName: "Sam Patel",
    },
    {
      id: "ce_3",
      title: "Consultation · Riley",
      dayIndex: 4,
      hour: 14,
      staffName: "Jordan Lee",
    },
  ];

  return {
    services,
    categories,
    staff,
    bookings,
    resources,
    addons,
    policies,
    forms,
    links,
    integrations,
    remindersSend,
    remindersGet,
    bookflow,
    calendarEvents,
    analytics: {
      appointments: [
        { label: "Spots filled", value: 0 },
        { label: "Predicted occupancy", value: 0 },
        { label: "Bookings", value: 0 },
        { label: "Booking sales", value: 0 },
        { label: "Top clients", value: 0 },
        { label: "Staff performance", value: 0 },
      ],
      classes: [
        { label: "Spots filled", value: 0 },
        { label: "Predicted occupancy", value: 0 },
        { label: "Top class sessions", value: 0 },
        { label: "Bookings", value: 0 },
        { label: "Booking sales", value: 0 },
        { label: "Top clients", value: 0 },
        { label: "Staff performance", value: 0 },
      ],
    },
  };
}

function read(): BookingsSnapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const s = seed();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
      return s;
    }
    return JSON.parse(raw) as BookingsSnapshot;
  } catch {
    const s = seed();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    return s;
  }
}

function write(snap: BookingsSnapshot) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snap));
}

export const localBookingsRepository = {
  async load(): Promise<BookingsSnapshot> {
    return read();
  },

  async saveService(service: BookingService): Promise<BookingService> {
    const snap = read();
    const idx = snap.services.findIndex((s) => s.id === service.id);
    if (idx >= 0) snap.services[idx] = service;
    else snap.services.push(service);
    write(snap);
    return service;
  },

  async createService(partial: Omit<BookingService, "id">): Promise<BookingService> {
    const service = { ...partial, id: uid("svc") };
    const snap = read();
    snap.services.push(service);
    write(snap);
    return service;
  },

  async saveCategories(categories: ServiceCategory[]): Promise<ServiceCategory[]> {
    const snap = read();
    snap.categories = categories;
    write(snap);
    return categories;
  },

  async saveStaff(member: StaffRecord): Promise<StaffRecord> {
    const snap = read();
    const idx = snap.staff.findIndex((s) => s.id === member.id);
    if (idx >= 0) snap.staff[idx] = member;
    else snap.staff.push(member);
    write(snap);
    return member;
  },

  async createStaff(partial: Omit<StaffRecord, "id">): Promise<StaffRecord> {
    const member = { ...partial, id: uid("st") };
    const snap = read();
    snap.staff.push(member);
    write(snap);
    return member;
  },

  async saveAddon(addon: AddonItem): Promise<AddonItem> {
    const snap = read();
    const idx = snap.addons.findIndex((a) => a.id === addon.id);
    if (idx >= 0) snap.addons[idx] = addon;
    else snap.addons.push(addon);
    write(snap);
    return addon;
  },

  async saveResource(resource: ResourceRoom): Promise<ResourceRoom> {
    const snap = read();
    const idx = snap.resources.findIndex((r) => r.id === resource.id);
    if (idx >= 0) snap.resources[idx] = resource;
    else snap.resources.push(resource);
    write(snap);
    return resource;
  },

  async savePolicy(policy: Policy): Promise<Policy> {
    const snap = read();
    const idx = snap.policies.findIndex((p) => p.id === policy.id);
    if (idx >= 0) snap.policies[idx] = policy;
    else snap.policies.push(policy);
    write(snap);
    return policy;
  },

  async saveForm(form: BookingFormDef): Promise<BookingFormDef> {
    const snap = read();
    const idx = snap.forms.findIndex((f) => f.id === form.id);
    if (idx >= 0) snap.forms[idx] = form;
    else snap.forms.push(form);
    write(snap);
    return form;
  },

  async saveLink(link: ShareableLink): Promise<ShareableLink> {
    const snap = read();
    snap.links.push(link);
    write(snap);
    return link;
  },

  async setIntegrationConnected(id: string, connected: boolean): Promise<void> {
    const snap = read();
    const item = snap.integrations.find((i) => i.id === id);
    if (item) item.connected = connected;
    write(snap);
  },

  async setReminderSend(channels: ReminderChannel[]): Promise<void> {
    const snap = read();
    snap.remindersSend = channels;
    write(snap);
  },

  async setReminderGet(channels: ReminderChannel[]): Promise<void> {
    const snap = read();
    snap.remindersGet = channels;
    write(snap);
  },

  async setBookflow(steps: BookflowStep[]): Promise<void> {
    const snap = read();
    snap.bookflow = steps;
    write(snap);
  },

  async addCalendarEvent(event: Omit<CalendarEvent, "id">): Promise<CalendarEvent> {
    const snap = read();
    const row = { ...event, id: uid("ce") };
    snap.calendarEvents.push(row);
    write(snap);
    return row;
  },
};
