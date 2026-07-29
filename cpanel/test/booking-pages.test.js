import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getNavigationItem, navigationContainsPage, tenantNavigation } from "../src/data/adminNavigation.js";
import { canonicalAdminPageKey, resolvePage } from "../src/utils/cpanelAccess.js";
import { moduleAllowsPage, normalizedModulePage } from "../src/utils/moduleRegistry.js";
import { canAccessAdminPage } from "../src/utils/roles.js";
import {
  bookingPageKeys,
  bookingRoutes,
  buildBookingSummary,
  canManageBookings,
  canonicalBookingPageKey,
  employeeDisplayName,
  filterRealBookings,
  moveWeek,
  weekDays,
} from "../src/utils/bookings.js";

const customersModule = [{ enabled: true, route: "/admin/customers" }];
const companyAdmin = { role: "company_admin", activeCompany: { id: "icare", modules: customersModule } };
const employee = { role: "employee", permissions: ["customers.view"], activeCompany: companyAdmin.activeCompany };

const source = async (path) => readFile(new URL(path, import.meta.url), "utf8");

test("all canonical Booking Calendar routes resolve to their exact page keys", () => {
  for (const [pageKey, route] of Object.entries(bookingRoutes)) {
    assert.equal(resolvePage(route, companyAdmin, customersModule), pageKey);
  }
  assert.deepEqual(bookingPageKeys, Object.keys(bookingRoutes));
});

test("legacy booking paths and page keys canonicalize without Dashboard fallback", () => {
  const aliases = {
    "/admin/coming-soon/booking/calendar": "admin-bookings-calendar",
    "/admin/coming-soon/booking/list": "admin-bookings-list",
    "/admin/coming-soon/booking/work-schedule": "admin-bookings-work-schedule",
    "/admin/coming-soon/booking/analytics": "admin-bookings-analytics",
  };
  for (const [path, pageKey] of Object.entries(aliases)) assert.equal(resolvePage(path, companyAdmin, customersModule), pageKey);
  assert.equal(canonicalAdminPageKey("admin-tenant-placeholder-booking-calendar"), "admin-bookings-calendar");
  assert.equal(canonicalBookingPageKey("admin-tenant-placeholder-booking-list"), "admin-bookings-list");
});

test("Booking Calendar is a separate expanded parent with exactly four real children", () => {
  const parent = tenantNavigation.find((item) => item.id === "tenant-booking");
  assert.ok(parent);
  assert.equal(parent.children.length, 4);
  assert.deepEqual(parent.children.map((item) => item.pageKey), bookingPageKeys);
  for (const child of parent.children) {
    assert.equal(child.existing, true);
    assert.equal(child.placeholder, undefined);
    assert.equal(navigationContainsPage(parent, child.pageKey), true);
    assert.equal(getNavigationItem(child.pageKey)?.id, child.pageKey);
  }
  const customers = tenantNavigation.find((item) => item.id === "tenant-customers-leads");
  assert.equal(navigationContainsPage(customers, "admin-bookings-calendar"), false);
  assert.equal(navigationContainsPage(customers, "admin-bookings-analytics"), false);
});

test("booking pages reuse the established customers module and permission contract", () => {
  for (const pageKey of bookingPageKeys) {
    assert.equal(normalizedModulePage(pageKey), "admin-customers");
    assert.equal(moduleAllowsPage(customersModule, pageKey), true);
    assert.equal(canAccessAdminPage(employee, pageKey), true);
  }
  assert.equal(canManageBookings(employee), false);
  assert.equal(canManageBookings({ ...employee, permissions: ["customers.view", "customers.manage"] }), true);
  assert.equal(canManageBookings({ role: "manager" }), true);
});

test("unauthorized employees receive No Access while scoped tenant operators remain supported", () => {
  const unauthorized = { role: "employee", permissions: ["products.view"], activeCompany: companyAdmin.activeCompany };
  assert.equal(resolvePage("/admin/bookings/calendar", unauthorized, customersModule), "admin-no-access");
  const scoped = { role: "company_admin", globalRole: "super_admin", isCompanyScope: true, activeCompany: companyAdmin.activeCompany };
  assert.equal(resolvePage("/admin/bookings/analytics", scoped, customersModule), "admin-bookings-analytics");
  assert.notEqual(resolvePage("/admin/not-a-real-booking-route", companyAdmin, customersModule), "admin-bookings-calendar");
});

test("booking date helpers support week navigation and locale day order", () => {
  const date = new Date(2026, 6, 29);
  assert.equal(moveWeek(date, 1).getDate(), 5);
  assert.equal(weekDays(date, "en")[0].getDay(), 0);
  assert.equal(weekDays(date, "ar")[0].getDay(), 6);
});

test("booking summaries and filters use only supplied real booking records", () => {
  assert.deepEqual(buildBookingSummary(null), { available: false, bookings: 0, paid: 0, unpaid: 0, revenue: null });
  const rows = [
    { id: "b1", kind: "course", paymentStatus: "paid", staffId: "e1", total: 20 },
    { id: "b2", kind: "appointment", paymentStatus: "unpaid", staffId: "e2", total: 80 },
  ];
  assert.deepEqual(buildBookingSummary(rows), { available: true, bookings: 2, paid: 1, unpaid: 1, revenue: 20 });
  assert.deepEqual(filterRealBookings(rows, { kind: "course" }).map((row) => row.id), ["b1"]);
  assert.equal(employeeDisplayName({ firstName: "Ruba", lastName: "A" }), "Ruba A");
});

test("Calendar implements controls, drawer, Add menu, and slot context menu", async () => {
  const page = await source("../src/pages/AdminBookingCalendarPage.jsx");
  for (const marker of ["booking-mini-calendar", "booking-filter-drawer", "booking-week-grid-body", "booking-add-button", "selectedSlot", "ActionMenu", "Appointment waitlist", "Sync your personal calendar"]) assert.match(page, new RegExp(marker));
  assert.match(page, /onNavigate\?\.\("admin-tenant-placeholder-catalog-booking-services"\)/);
  assert.doesNotMatch(page, /window\.location|history\.pushState|admin-dashboard/);
});

test("Booking List implements tabs, filter chips, table fields, and an honest empty state", async () => {
  const page = await source("../src/pages/AdminBookingListPage.jsx");
  for (const marker of ["booking-list-tabs", "booking-filter-chips", "BookingTable", "Appointments & Classes", "Courses", "No verified booking data source is connected", "No bookings yet"]) assert.match(page, new RegExp(marker));
  for (const field of ["Booking date", "Customer", "Service", "Staff member", "Payment", "Total"]) assert.match(page, new RegExp(field));
  assert.doesNotMatch(page, /window\.location|history\.pushState|admin-dashboard/);
});

test("Work Schedule renders only supplied employees and never invents working hours", async () => {
  const page = await source("../src/pages/AdminWorkSchedulePage.jsx");
  assert.match(page, /employees\.map/);
  assert.match(page, /employeeDisplayName/);
  assert.match(page, /Availability not configured/);
  assert.match(page, /Array\.isArray\(availability\)/);
  assert.doesNotMatch(page, /9:00 AM|10:00 AM|12:00 AM|burhan|ruba|shren/i);
});

test("Bookings Analytics provides the requested composition with no fabricated attribution", async () => {
  const page = await source("../src/pages/AdminBookingsAnalyticsPage.jsx");
  for (const marker of ["Spots filled", "Predicted occupancy", "Top class sessions", "Booking sales", "Top clients", "first-time clients", "returning clients", "Staff performance", "Booking AI is not connected", "No verified booking attribution source"]) assert.match(page, new RegExp(marker, "i"));
  assert.match(page, /setKind\("classes"\)/);
  assert.match(page, /setKind\("appointments"\)/);
  assert.doesNotMatch(page, /Google \(organic\)|Facebook \(paid\)|Wix email|Direct.*\b0\b/);
});

test("all unsupported booking mutations reuse the shared bilingual flow", async () => {
  const files = ["AdminBookingCalendarPage.jsx", "AdminBookingListPage.jsx", "AdminWorkSchedulePage.jsx", "AdminBookingsAnalyticsPage.jsx"];
  for (const file of files) {
    const page = await source(`../src/pages/${file}`);
    assert.match(page, /UnsupportedDialog/);
    assert.doesNotMatch(page, /history\.pushState|history\.replaceState/);
  }
  const shared = await source("../src/pages/AdminBookingShared.jsx");
  assert.match(shared, /AdminUnderDevelopmentContent/);
});

test("CPanelApp owns booking routing and pages do not introduce a second router", async () => {
  const app = await source("../src/CPanelApp.jsx");
  assert.match(app, /\.\.\.bookingRoutes/);
  for (const pageKey of bookingPageKeys) assert.match(app, new RegExp(`activePage === "${pageKey}"`));
  assert.match(app, /onPopState/);
  assert.match(app, /canonicalAdminPageKey\(page\)/);
});

test("booking CSS is narrowly scoped and responsive", async () => {
  const css = await source("../src/styles/global.css");
  assert.match(css, /\/\* Tenant Booking Calendar module \*\//);
  assert.match(css, /\.booking-calendar-layout/);
  assert.match(css, /\.booking-filter-drawer/);
  assert.match(css, /\.booking-schedule-grid/);
  assert.match(css, /\.booking-analytics-feature-row/);
  assert.match(css, /\[dir="rtl"\] \.booking-filter-drawer/);
  assert.match(css, /@media \(max-width: 980px\)/);
});
