import React from "react";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  ListChecks,
  MapPin,
  Plus,
  Search,
  Settings,
  Users,
  X,
} from "lucide-react";
import {
  canManageBookings,
  employeeDisplayName,
  moveWeek,
  startOfWeek,
  weekDays,
} from "../utils/bookings.js";
import {
  bi,
  BookingEmpty,
  BookingPageShell,
  formatDateRange,
  SelectControl,
  UnsupportedDialog,
} from "./AdminBookingShared.jsx";

const hours = Array.from({ length: 16 }, (_, index) => index + 5);
const filterSections = [
  ["catalog", "Catalog items", "عناصر الكتالوج", CalendarDays],
  ["staff", "Staff", "الموظفون", Users],
  ["location", "Location", "الموقع", MapPin],
  ["availability", "Session availability", "توفر الجلسات", Clock3],
];

function MiniCalendar({ language, onSelect, selectedDate, visibleDate }) {
  const first = new Date(visibleDate.getFullYear(), visibleDate.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - ((first.getDay() - (language === "ar" ? 6 : 0) + 7) % 7));
  const cells = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
  const dayNames = weekDays(start, language).map((date) => date.toLocaleDateString(language === "ar" ? "ar" : "en-US", { weekday: "narrow" }));
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  return (
    <div className="booking-mini-calendar">
      <div className="booking-mini-weekdays">{dayNames.map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
      <div className="booking-mini-days">
        {cells.map((date) => <button className={`${date.getMonth() !== visibleDate.getMonth() ? "muted" : ""} ${sameDay(date, selectedDate) ? "selected" : ""}`} key={date.toISOString()} onClick={() => onSelect(date)} type="button">{date.getDate()}</button>)}
      </div>
    </div>
  );
}

function CalendarSidebar({ language, onUnsupported, selectedDate, setSelectedDate, visibleDate, setVisibleDate }) {
  const monthName = visibleDate.toLocaleDateString(language === "ar" ? "ar" : "en-US", { month: "long", year: "numeric" });
  const moveMonth = (amount) => setVisibleDate(new Date(visibleDate.getFullYear(), visibleDate.getMonth() + amount, 1));
  return (
    <aside className="booking-calendar-sidebar">
      <header><h1>{bi(language, "Calendar", "التقويم")}</h1></header>
      <div className="booking-mini-header"><button aria-label={bi(language, "Previous month", "الشهر السابق")} onClick={() => moveMonth(-1)} type="button"><ChevronLeft size={17} /></button><strong>{monthName}</strong><button aria-label={bi(language, "Next month", "الشهر التالي")} onClick={() => moveMonth(1)} type="button"><ChevronRight size={17} /></button></div>
      <MiniCalendar language={language} onSelect={setSelectedDate} selectedDate={selectedDate} visibleDate={visibleDate} />
      <button className="booking-sync-card" onClick={onUnsupported} type="button"><span><CalendarDays size={23} /></span><div><strong>{bi(language, "Sync your personal calendar", "مزامنة تقويمك الشخصي")}</strong><small>{bi(language, "Not connected", "غير متصل")}</small></div><ChevronRight size={17} /></button>
      <section className="booking-activity-panel"><h2>{bi(language, "Activity", "النشاط")}</h2><div className="booking-activity-title"><span>{bi(language, "Upcoming session", "الجلسة القادمة")}</span><ChevronDown size={15} /></div><BookingEmpty description={bi(language, "Once a supported booking is created, it will appear here.", "ستظهر هنا الحجوزات المدعومة بعد إنشائها.")} title={bi(language, "No sessions added", "لم تتم إضافة جلسات")} /></section>
      <button className="booking-waitlist-row" onClick={onUnsupported} type="button"><ListChecks size={17} />{bi(language, "Appointment waitlist", "قائمة انتظار المواعيد")}<ChevronDown size={15} /></button>
    </aside>
  );
}

function FilterDrawer({ employees, language, onClose }) {
  const [open, setOpen] = React.useState({ catalog: true, staff: true, location: false, availability: false });
  const [selectedStaff, setSelectedStaff] = React.useState(() => new Set(employees.map((employee) => String(employee.id))));
  const toggleStaff = (id) => setSelectedStaff((current) => {
    const next = new Set(current);
    if (next.has(String(id))) next.delete(String(id)); else next.add(String(id));
    return next;
  });
  return (
    <aside className="booking-filter-drawer" aria-label={bi(language, "Filter calendar", "تصفية التقويم")}>
      <header><h2>{bi(language, "Filter by", "تصفية حسب")}</h2><button aria-label={bi(language, "Close filters", "إغلاق عوامل التصفية")} onClick={onClose} type="button"><X size={22} /></button></header>
      {filterSections.map(([key, en, ar, Icon]) => <section className={open[key] ? "open" : ""} key={key}><button onClick={() => setOpen((value) => ({ ...value, [key]: !value[key] }))} type="button"><span><Icon size={17} />{bi(language, en, ar)}</span><ChevronDown size={16} /></button>{open[key] && <div className="booking-filter-options">{key === "catalog" && <p>{bi(language, "No booking services configured.", "لم يتم إعداد خدمات حجز.")}</p>}{key === "staff" && (employees.length ? <><label><input checked={selectedStaff.size === employees.length} onChange={() => setSelectedStaff(selectedStaff.size === employees.length ? new Set() : new Set(employees.map((employee) => String(employee.id))))} type="checkbox" />{bi(language, "Select all", "تحديد الكل")}</label>{employees.map((employee) => <label key={employee.id}><input checked={selectedStaff.has(String(employee.id))} onChange={() => toggleStaff(employee.id)} type="checkbox" />{employeeDisplayName(employee, language)}</label>)}</> : <p>{bi(language, "No staff records available.", "لا توجد سجلات موظفين متاحة.")}</p>)}{["location", "availability"].includes(key) && <p>{bi(language, "No verified options available.", "لا توجد خيارات موثقة متاحة.")}</p>}</div>}</section>)}
      <footer>{bi(language, "No booking events are currently available to filter.", "لا توجد أحداث حجز متاحة للتصفية حالياً.")}</footer>
    </aside>
  );
}

function ActionMenu({ language, onCreateService, onUnsupported, slot = false }) {
  const actions = [
    ["Appointment", "موعد"],
    ["Blocked staff time", "وقت محجوب للموظف"],
    ["Class session", "جلسة صفية"],
  ];
  return <div className={`booking-action-menu ${slot ? "slot" : ""}`} role="menu">{actions.map(([en, ar]) => <button key={en} onClick={onUnsupported} role="menuitem" type="button">{bi(language, en, ar)}</button>)}<hr /><button onClick={onCreateService} role="menuitem" type="button"><Plus size={16} />{bi(language, "Create New Service", "إنشاء خدمة جديدة")}</button>{slot && <button onClick={onUnsupported} role="menuitem" type="button">{bi(language, "Share services", "مشاركة الخدمات")}</button>}</div>;
}

export default function AdminBookingCalendarPage({ activePage = "admin-bookings-calendar", currentUser, employees = [], language = "en", onNavigate, t, ...layout }) {
  const today = React.useMemo(() => new Date(), []);
  const [week, setWeek] = React.useState(() => startOfWeek(today, language === "ar" ? 6 : 0));
  const [selectedDate, setSelectedDate] = React.useState(today);
  const [visibleDate, setVisibleDate] = React.useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);
  const [manageOpen, setManageOpen] = React.useState(false);
  const [viewOpen, setViewOpen] = React.useState(false);
  const [unsupported, setUnsupported] = React.useState(false);
  const [selectedSlot, setSelectedSlot] = React.useState(null);
  const days = weekDays(week, language);
  const canManage = canManageBookings(currentUser);
  const createService = () => onNavigate?.("admin-tenant-placeholder-catalog-booking-services");
  const chooseDate = (date) => { setSelectedDate(date); setWeek(startOfWeek(date, language === "ar" ? 6 : 0)); };
  const dayFormatter = new Intl.DateTimeFormat(language === "ar" ? "ar" : "en-US", { weekday: "short", day: "2-digit" });
  return (
    <BookingPageShell activePage={activePage} className="booking-calendar-page" currentUser={currentUser} language={language} onNavigate={onNavigate} {...layout}>
      <div className="booking-calendar-layout">
        <CalendarSidebar language={language} onUnsupported={() => setUnsupported(true)} selectedDate={selectedDate} setSelectedDate={chooseDate} setVisibleDate={setVisibleDate} visibleDate={visibleDate} />
        <main className="booking-calendar-main">
          <header className="booking-calendar-toolbar">
            <div><button className="booking-today-button" onClick={() => { setWeek(startOfWeek(today, language === "ar" ? 6 : 0)); setSelectedDate(today); }} type="button">{bi(language, "Today", "اليوم")}</button><strong>{formatDateRange(week, language, true)}</strong><button aria-label={bi(language, "Previous week", "الأسبوع السابق")} onClick={() => setWeek(moveWeek(week, -1))} type="button"><ChevronLeft size={18} /></button><button aria-label={bi(language, "Next week", "الأسبوع التالي")} onClick={() => setWeek(moveWeek(week, 1))} type="button"><ChevronRight size={18} /></button></div>
            <div className="booking-toolbar-actions"><button aria-label={bi(language, "Search", "بحث")} onClick={() => setUnsupported(true)} type="button"><Search size={19} /></button><div className="booking-menu-root"><SelectControl aria-expanded={viewOpen} onClick={() => setViewOpen((value) => !value)}>{bi(language, "Weekly", "أسبوعي")}</SelectControl>{viewOpen && <div className="booking-action-menu view"><button onClick={() => setViewOpen(false)} type="button"><Check size={15} />{bi(language, "Weekly", "أسبوعي")}</button><button onClick={() => setUnsupported(true)} type="button">{bi(language, "Daily", "يومي")}</button><button onClick={() => setUnsupported(true)} type="button">{bi(language, "Monthly", "شهري")}</button></div>}</div><button className={filterOpen ? "active" : ""} aria-label={bi(language, "Filter", "تصفية")} onClick={() => setFilterOpen((value) => !value)} type="button"><Filter size={18} /></button>{canManage && <><button aria-label={bi(language, "Settings", "الإعدادات")} onClick={() => setUnsupported(true)} type="button"><Settings size={18} /></button><div className="booking-menu-root"><SelectControl aria-expanded={manageOpen} onClick={() => setManageOpen((value) => !value)}>{bi(language, "Manage", "إدارة")}</SelectControl>{manageOpen && <div className="booking-action-menu manage"><button onClick={() => setUnsupported(true)} type="button">{bi(language, "Sync calendars", "مزامنة التقويمات")}</button><button onClick={() => setUnsupported(true)} type="button">{bi(language, "Booking settings", "إعدادات الحجز")}</button></div>}</div><div className="booking-menu-root"><button aria-expanded={addOpen} className="booking-add-button" onClick={() => setAddOpen((value) => !value)} type="button">{bi(language, "Add", "إضافة")}<ChevronDown size={16} /></button>{addOpen && <ActionMenu language={language} onCreateService={createService} onUnsupported={() => setUnsupported(true)} />}</div></>}</div>
          </header>
          <div className="booking-week-grid-wrap">
            <div className="booking-week-grid-head"><span />{days.map((day) => <div className={day.toDateString() === today.toDateString() ? "today" : ""} key={day.toISOString()}>{dayFormatter.format(day)}</div>)}</div>
            <div className="booking-week-grid-body">
              {hours.map((hour) => <React.Fragment key={hour}><div className="booking-hour-label">{new Date(2020, 0, 1, hour).toLocaleTimeString(language === "ar" ? "ar" : "en-US", { hour: "numeric" })}</div>{days.map((day) => { const key = `${day.toISOString()}-${hour}`; return <button aria-label={`${dayFormatter.format(day)} ${hour}:00`} className={`booking-time-cell ${selectedSlot === key ? "selected" : ""}`} key={key} onClick={() => { if (!canManage) return; setSelectedSlot(key); setSelectedDate(day); setAddOpen(false); }} type="button">{selectedSlot === key && <span>{new Date(2020, 0, 1, hour).toLocaleTimeString(language === "ar" ? "ar" : "en-US", { hour: "numeric", minute: "2-digit" })}</span>}</button>; })}</React.Fragment>)}
              {canManage && selectedSlot && <ActionMenu language={language} onCreateService={createService} onUnsupported={() => setUnsupported(true)} slot />}
            </div>
          </div>
        </main>
        {filterOpen && <FilterDrawer employees={employees} language={language} onClose={() => setFilterOpen(false)} />}
      </div>
      {unsupported && <UnsupportedDialog language={language} onClose={() => setUnsupported(false)} t={t} />}
    </BookingPageShell>
  );
}
