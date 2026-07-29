export const bookingRoutes = Object.freeze({
  "admin-bookings-calendar": "/admin/bookings/calendar",
  "admin-bookings-list": "/admin/bookings/list",
  "admin-bookings-work-schedule": "/admin/bookings/work-schedule",
  "admin-bookings-analytics": "/admin/bookings/analytics",
});

export const bookingPageKeys = Object.freeze(Object.keys(bookingRoutes));

const legacyPaths = Object.freeze({
  "/admin/coming-soon/booking/calendar": "admin-bookings-calendar",
  "/admin/coming-soon/booking/list": "admin-bookings-list",
  "/admin/coming-soon/booking/work-schedule": "admin-bookings-work-schedule",
  "/admin/coming-soon/booking/analytics": "admin-bookings-analytics",
  "/admin/booking/calendar": "admin-bookings-calendar",
  "/admin/booking/list": "admin-bookings-list",
  "/admin/booking/work-schedule": "admin-bookings-work-schedule",
  "/admin/booking/analytics": "admin-bookings-analytics",
});

const legacyPageKeys = Object.freeze({
  "admin-tenant-placeholder-booking-calendar": "admin-bookings-calendar",
  "admin-tenant-placeholder-booking-list": "admin-bookings-list",
  "admin-tenant-placeholder-booking-work-schedule": "admin-bookings-work-schedule",
  "admin-tenant-placeholder-booking-analytics": "admin-bookings-analytics",
});

export function canonicalBookingPageKey(pageKey) {
  return legacyPageKeys[pageKey] || pageKey;
}

export function resolveBookingPage(pathname) {
  return legacyPaths[pathname]
    || Object.entries(bookingRoutes).find(([, route]) => route === pathname)?.[0]
    || null;
}

export function bookingDirection(language) {
  return language === "ar" ? "rtl" : "ltr";
}

export function startOfWeek(value = new Date(), weekStartsOn = 0) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  const distance = (date.getDay() - weekStartsOn + 7) % 7;
  date.setDate(date.getDate() - distance);
  return date;
}

export function moveWeek(value, amount) {
  const date = new Date(value);
  date.setDate(date.getDate() + (amount * 7));
  return date;
}

export function weekDays(value, language = "en") {
  const first = startOfWeek(value, language === "ar" ? 6 : 0);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(first);
    date.setDate(first.getDate() + index);
    return date;
  });
}

export function buildBookingSummary(bookings) {
  if (!Array.isArray(bookings)) {
    return { available: false, bookings: 0, paid: 0, unpaid: 0, revenue: null };
  }
  const paidRows = bookings.filter((booking) => booking?.paymentStatus === "paid");
  const unpaidRows = bookings.filter((booking) => booking?.paymentStatus === "unpaid");
  const revenue = paidRows.reduce((sum, booking) => {
    const total = Number(booking?.total);
    return sum + (Number.isFinite(total) ? total : 0);
  }, 0);
  return {
    available: true,
    bookings: bookings.length,
    paid: paidRows.length,
    unpaid: unpaidRows.length,
    revenue,
  };
}

export function filterRealBookings(bookings, filters = {}) {
  if (!Array.isArray(bookings)) return [];
  return bookings.filter((booking) => {
    if (filters.kind && booking?.kind !== filters.kind) return false;
    if (filters.staffId && String(booking?.staffId) !== String(filters.staffId)) return false;
    if (filters.serviceId && String(booking?.serviceId) !== String(filters.serviceId)) return false;
    return true;
  });
}

export function employeeDisplayName(employee, language = "en") {
  return employee?.name?.[language]
    || employee?.name?.en
    || employee?.name
    || [employee?.firstName, employee?.lastName].filter(Boolean).join(" ")
    || employee?.email
    || "—";
}

export function canManageBookings(user) {
  if (["company_admin", "admin", "manager"].includes(user?.role)) return true;
  return ["employee", "staff"].includes(user?.role) && user?.permissions?.includes("customers.manage");
}
