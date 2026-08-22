import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { WorkSchedulePage } from "../components/work-schedule";
import { BookingsShell } from "./BookingsShell";
import { paths } from "./paths";
import { AddonsPage } from "./pages/AddonsPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { BookingListPage } from "./pages/BookingListPage";
import { BookflowPage } from "./pages/BookflowPage";
import { CalendarPage } from "./pages/CalendarPage";
import { DefaultHoursPage } from "./pages/DefaultHoursPage";
import { FormsManagerPage } from "./pages/FormsManagerPage";
import { IntegrationsPage } from "./pages/IntegrationsPage";
import { PoliciesPage } from "./pages/PoliciesPage";
import { RemindersYouGetPage, RemindersYouSendPage } from "./pages/RemindersPages";
import { ResourcesPage } from "./pages/ResourcesPage";
import { ServiceFormPage } from "./pages/ServiceFormPage";
import { ServiceTemplatesPage } from "./pages/ServiceTemplatesPage";
import { ServicesPage } from "./pages/ServicesPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ShareableLinksPage } from "./pages/ShareableLinksPage";
import { StaffEditPage } from "./pages/StaffEditPage";
import { StaffPage } from "./pages/StaffPage";

function AvailabilityRoute() {
  const navigate = useNavigate();
  return (
    <WorkSchedulePage onManageStaff={() => navigate(paths.staff)} />
  );
}

/**
 * Content-only Bookings routes (1:1 with navigation inventory).
 * No global Wix sidebar/navbar.
 */
export function BookingsRoutes() {
  return (
    <Routes>
      <Route element={<BookingsShell />}>
        <Route index element={<Navigate to={paths.availability} replace />} />
        <Route path="bookings" element={<Navigate to={paths.services} replace />} />
        <Route path="bookings/availability" element={<AvailabilityRoute />} />
        <Route
          path="bookings/availability/default-hours"
          element={<DefaultHoursPage />}
        />
        <Route path="bookings/bookings/bookings-list" element={<BookingListPage />} />
        <Route path="bookings/overviews/bookings" element={<AnalyticsPage />} />
        <Route path="bookings/services" element={<ServicesPage />} />
        <Route
          path="bookings/services/templates-catalog"
          element={<ServiceTemplatesPage />}
        />
        <Route path="bookings/services/form" element={<ServiceFormPage />} />
        <Route
          path="bookings/services/form/:serviceId"
          element={<ServiceFormPage />}
        />
        <Route path="bookings/integrations" element={<IntegrationsPage />} />
        <Route path="bookings/dashboard" element={<ShareableLinksPage />} />
        <Route path="bookings/staff" element={<StaffPage />} />
        <Route path="bookings/staff/edit" element={<StaffEditPage />} />
        <Route path="bookings/staff/edit/:staffId" element={<StaffEditPage />} />
        <Route path="bookings/settings" element={<SettingsPage />} />
        <Route path="bookings/addons/addons" element={<AddonsPage />} />
        <Route
          path="bookings/settings/reminders/you-send/whatsapp"
          element={<RemindersYouSendPage />}
        />
        <Route
          path="bookings/settings/reminders/you-get"
          element={<RemindersYouGetPage />}
        />
        <Route
          path="bookings/settings/bookflow-settings"
          element={<BookflowPage />}
        />
        <Route
          path="bookings/settings/forms-manager"
          element={<FormsManagerPage />}
        />
        <Route path="bookings/settings/policies" element={<PoliciesPage />} />
        <Route path="wix-calendar" element={<CalendarPage />} />
        <Route
          path="wix-calendar/resource-management/index"
          element={<ResourcesPage />}
        />
        <Route path="*" element={<Navigate to={paths.availability} replace />} />
      </Route>
    </Routes>
  );
}
