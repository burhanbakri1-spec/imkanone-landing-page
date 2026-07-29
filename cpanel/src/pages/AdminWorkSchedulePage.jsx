import React from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  MoreHorizontal,
  Plus,
  UserRound,
} from "lucide-react";
import { canManageBookings, employeeDisplayName, moveWeek, startOfWeek, weekDays } from "../utils/bookings.js";
import {
  bi,
  BookingEmpty,
  BookingPageShell,
  formatDateRange,
  SelectControl,
  UnsupportedDialog,
} from "./AdminBookingShared.jsx";

export default function AdminWorkSchedulePage({ activePage = "admin-bookings-work-schedule", availability = null, currentUser, employees = [], language = "en", t, ...layout }) {
  const today = React.useMemo(() => new Date(), []);
  const [week, setWeek] = React.useState(() => startOfWeek(today, language === "ar" ? 6 : 0));
  const [staffFilter, setStaffFilter] = React.useState("all");
  const [unsupported, setUnsupported] = React.useState(false);
  const [moreOpen, setMoreOpen] = React.useState(false);
  const days = weekDays(week, language);
  const visibleEmployees = staffFilter === "all" ? employees : employees.filter((employee) => String(employee.id) === staffFilter);
  const canManage = canManageBookings(currentUser);
  const dateLocale = language === "ar" ? "ar" : "en-US";
  const getAvailability = (employeeId, day) => Array.isArray(availability)
    ? availability.filter((entry) => String(entry.employeeId) === String(employeeId) && new Date(entry.date).toDateString() === day.toDateString())
    : [];
  return (
    <BookingPageShell activePage={activePage} className="booking-schedule-page" currentUser={currentUser} language={language} {...layout}>
      <div className="booking-page-content">
        <header className="booking-page-header booking-schedule-header"><div><h1>{bi(language, "Work Schedule", "جدول العمل")}</h1><p>{bi(language, "Manage when and where staff members are available for the week.", "أدر أوقات وأماكن توفر الموظفين خلال الأسبوع.")}</p></div>{canManage && <div className="booking-header-actions"><div className="booking-menu-root"><SelectControl aria-expanded={moreOpen} onClick={() => setMoreOpen((value) => !value)}>{bi(language, "More Actions", "إجراءات أخرى")}</SelectControl>{moreOpen && <div className="booking-action-menu manage"><button onClick={() => setUnsupported(true)} type="button">{bi(language, "Availability settings", "إعدادات التوفر")}</button><button onClick={() => setUnsupported(true)} type="button">{bi(language, "Import schedule", "استيراد الجدول")}</button></div>}</div><button className="booking-primary-button" onClick={() => setUnsupported(true)} type="button"><Plus size={17} />{bi(language, "Add Staff Hours", "إضافة ساعات الموظف")}</button></div>}</header>
        <button className="booking-help-link" onClick={() => setUnsupported(true)} type="button"><CircleHelp size={16} />{bi(language, "Get help with availability", "الحصول على مساعدة بشأن التوفر")}</button>
        <section className="booking-schedule-card">
          <header className="booking-schedule-controls"><div><button className="booking-today-button" onClick={() => setWeek(startOfWeek(today, language === "ar" ? 6 : 0))} type="button">{bi(language, "Today", "اليوم")}</button><button aria-label={bi(language, "Previous week", "الأسبوع السابق")} onClick={() => setWeek(moveWeek(week, -1))} type="button"><ChevronLeft size={18} /></button><button aria-label={bi(language, "Next week", "الأسبوع التالي")} onClick={() => setWeek(moveWeek(week, 1))} type="button"><ChevronRight size={18} /></button><span><CalendarDays size={17} />{formatDateRange(week, language, true)}</span></div><div><SelectControl onClick={() => setUnsupported(true)}>{bi(language, "All locations", "كل المواقع")}</SelectControl><select aria-label={bi(language, "Staff member", "الموظف")} onChange={(event) => setStaffFilter(event.target.value)} value={staffFilter}><option value="all">{bi(language, "All staff members", "كل الموظفين")}</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employeeDisplayName(employee, language)}</option>)}</select></div></header>
          {!Array.isArray(availability) && <div className="booking-availability-notice"><Clock3 size={18} /><div><strong>{bi(language, "Availability not configured", "لم يتم إعداد التوفر")}</strong><span>{bi(language, "Real employee rows are shown below. Hours remain empty until a supported availability source is connected.", "تظهر صفوف الموظفين الحقيقية أدناه، وتبقى الساعات فارغة حتى ربط مصدر توفر مدعوم.")}</span></div></div>}
          {visibleEmployees.length ? <div className="booking-schedule-grid-wrap"><div className="booking-schedule-grid booking-schedule-grid-head"><span />{days.map((day) => <span className={day.toDateString() === today.toDateString() ? "today" : ""} key={day.toISOString()}><b>{day.getDate().toString().padStart(2, "0")}</b><small>{day.toLocaleDateString(dateLocale, { weekday: "short" })}</small></span>)}</div>{visibleEmployees.map((employee) => <div className="booking-schedule-grid booking-schedule-row" key={employee.id}><div className="booking-staff-cell"><span><UserRound size={18} /></span><strong>{employeeDisplayName(employee, language)}</strong><button aria-label={bi(language, "Staff actions", "إجراءات الموظف")} onClick={() => setUnsupported(true)} type="button"><MoreHorizontal size={17} /></button></div>{days.map((day) => { const blocks = getAvailability(employee.id, day); return <div className="booking-availability-cell" key={day.toISOString()}>{blocks.map((block) => <span key={block.id || `${block.start}-${block.end}`}>{block.start} – {block.end}</span>)}</div>; })}</div>)}</div> : <BookingEmpty description={bi(language, "Add employees through the existing Employees page before configuring availability.", "أضف الموظفين من صفحة الموظفين الحالية قبل إعداد التوفر.")} icon={UserRound} title={bi(language, "No staff records available", "لا توجد سجلات موظفين")} />}
        </section>
      </div>
      {unsupported && <UnsupportedDialog language={language} onClose={() => setUnsupported(false)} t={t} />}
    </BookingPageShell>
  );
}
