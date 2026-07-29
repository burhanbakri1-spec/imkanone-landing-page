import React from "react";
import {
  CalendarCheck,
  ChevronDown,
  Download,
  Filter,
  MoreHorizontal,
  Settings2,
  Sparkles,
  X,
} from "lucide-react";
import { buildBookingSummary, filterRealBookings } from "../utils/bookings.js";
import { formatCompanyCurrency } from "../utils/sales.js";
import {
  bi,
  BookingEmpty,
  BookingPageShell,
  SelectControl,
  UnsupportedDialog,
} from "./AdminBookingShared.jsx";

function PromotionCard({ language, secondary = false, onDismiss, onUnsupported }) {
  return <article className="booking-promo-card"><span className="booking-new-badge">{bi(language, "NEW", "جديد")}</span>{onDismiss && <button aria-label={bi(language, "Dismiss", "إخفاء")} onClick={onDismiss} type="button"><X size={18} /></button>}<div><h2>{secondary ? bi(language, "Organize services from one booking view", "نظّم الخدمات من عرض حجوزات واحد") : bi(language, "Keep booking work clear and connected", "حافظ على وضوح وترابط عمل الحجوزات")}</h2><p>{secondary ? bi(language, "Use supported service tools as they become available for this company.", "استخدم أدوات الخدمات المدعومة عند توفرها لهذه الشركة.") : bi(language, "Review real appointments, payment states, and staff assignments from one place.", "راجع المواعيد الحقيقية وحالات الدفع وتعيينات الموظفين من مكان واحد.")}</p><button onClick={onUnsupported} type="button">{bi(language, "Learn More", "معرفة المزيد")}</button></div><span className="booking-promo-visual"><CalendarCheck size={42} /><i /><i /></span></article>;
}

function BookingTable({ bookings, company, language, onUnsupported }) {
  if (!bookings.length) return <BookingEmpty description={bi(language, "Bookings will appear after a supported tenant booking source is connected.", "ستظهر الحجوزات بعد ربط مصدر حجوزات مدعوم للمستأجر.")} title={bi(language, "No bookings yet", "لا توجد حجوزات بعد")} />;
  return <div className="booking-list-table-wrap"><table className="booking-list-table"><thead><tr><th>{bi(language, "Booking date", "تاريخ الحجز")}</th><th>{bi(language, "Customer", "العميل")}</th><th>{bi(language, "Service", "الخدمة")}</th><th>{bi(language, "Staff member", "الموظف")}</th><th>{bi(language, "Session", "الجلسة")}</th><th>{bi(language, "Status", "الحالة")}</th><th>{bi(language, "Payment", "الدفع")}</th><th>{bi(language, "Total", "الإجمالي")}</th><th /></tr></thead><tbody>{bookings.map((booking) => <tr key={booking.id}><td>{booking.createdAt ? new Date(booking.createdAt).toLocaleDateString(language === "ar" ? "ar" : "en-US") : "—"}</td><td>{booking.customerName || booking.customer?.name || "—"}</td><td>{booking.serviceName || "—"}</td><td>{booking.staffName || "—"}</td><td>{booking.sessionAt ? new Date(booking.sessionAt).toLocaleString(language === "ar" ? "ar" : "en-US") : "—"}</td><td>{booking.status || "—"}</td><td>{booking.paymentStatus || "—"}</td><td>{Number.isFinite(Number(booking.total)) ? formatCompanyCurrency(Number(booking.total), company, language) : "—"}</td><td><button aria-label={bi(language, "Actions", "الإجراءات")} onClick={onUnsupported} type="button"><MoreHorizontal size={17} /></button></td></tr>)}</tbody></table></div>;
}

export default function AdminBookingListPage({ activePage = "admin-bookings-list", bookings = null, company, language = "en", t, ...layout }) {
  const [tab, setTab] = React.useState("appointments");
  const [filters, setFilters] = React.useState(["confirmed", "period"]);
  const [unsupported, setUnsupported] = React.useState(false);
  const [showFirstPromo, setShowFirstPromo] = React.useState(true);
  const realBookings = filterRealBookings(bookings, tab === "courses" ? { kind: "course" } : {});
  const summary = buildBookingSummary(bookings);
  const money = (value) => formatCompanyCurrency(value, company, language);
  return (
    <BookingPageShell activePage={activePage} className="booking-list-page" company={company} language={language} {...layout}>
      <div className="booking-page-content">
        <div className="booking-breadcrumb"><button onClick={() => layout.onNavigate?.("admin-bookings-calendar")} type="button">{bi(language, "Calendar", "التقويم")}</button><span>/</span><span>{bi(language, "Booking List", "قائمة الحجوزات")}</span></div>
        <header className="booking-page-header"><div><h1>{bi(language, "Booking List", "قائمة الحجوزات")}</h1><p>{bi(language, "Review real tenant bookings and supported payment information.", "راجع حجوزات المستأجر الحقيقية ومعلومات الدفع المدعومة.")}</p></div></header>
        <div className="booking-promo-grid">{showFirstPromo && <PromotionCard language={language} onDismiss={() => setShowFirstPromo(false)} onUnsupported={() => setUnsupported(true)} />}<PromotionCard language={language} onUnsupported={() => setUnsupported(true)} secondary /></div>
        <section className="booking-financial-strip"><div><span>{bi(language, "Total bookings", "إجمالي الحجوزات")}</span><strong>{summary.available ? summary.bookings : 0}</strong></div><div><span>{bi(language, "Unpaid bookings", "الحجوزات غير المدفوعة")}</span><strong>{summary.available ? summary.unpaid : 0}</strong></div><div><span>{bi(language, "Paid bookings", "الحجوزات المدفوعة")}</span><strong>{summary.available ? summary.paid : 0}</strong></div><div><span>{bi(language, "Booking sales", "مبيعات الحجوزات")}</span><strong>{summary.available ? money(summary.revenue) : money(0)}</strong></div><SelectControl onClick={() => setUnsupported(true)}>{bi(language, "Last 7 days", "آخر 7 أيام")}</SelectControl></section>
        <section className="booking-list-card">
          <header className="booking-list-toolbar"><div className="booking-list-tabs" role="tablist"><button aria-selected={tab === "appointments"} onClick={() => setTab("appointments")} role="tab" type="button">{bi(language, "Appointments & Classes", "المواعيد والصفوف")}</button><button aria-selected={tab === "courses"} onClick={() => setTab("courses")} role="tab" type="button">{bi(language, "Courses", "الدورات")}</button></div><div><SelectControl onClick={() => setUnsupported(true)}>{bi(language, "Default view", "العرض الافتراضي")} ({realBookings.length})</SelectControl><button onClick={() => setUnsupported(true)} type="button">{bi(language, "Manage View", "إدارة العرض")}<ChevronDown size={14} /></button><button onClick={() => setUnsupported(true)} type="button"><Filter size={16} />{bi(language, "Filter", "تصفية")}</button><button aria-label={bi(language, "Export", "تصدير")} onClick={() => setUnsupported(true)} type="button"><Download size={16} /></button><button aria-label={bi(language, "Table settings", "إعدادات الجدول")} onClick={() => setUnsupported(true)} type="button"><Settings2 size={16} /></button></div></header>
          {filters.length > 0 && <div className="booking-filter-chips">{filters.includes("confirmed") && <button onClick={() => setFilters((value) => value.filter((item) => item !== "confirmed"))} type="button"><b>{bi(language, "Booking status:", "حالة الحجز:")}</b>{bi(language, "Confirmed", "مؤكد")}<X size={13} /></button>}{filters.includes("period") && <button onClick={() => setFilters((value) => value.filter((item) => item !== "period"))} type="button"><b>{bi(language, "Session date:", "تاريخ الجلسة:")}</b>{bi(language, "Selected period", "الفترة المحددة")}<X size={13} /></button>}<button className="clear" onClick={() => setFilters([])} type="button">{bi(language, "Clear", "مسح")}</button></div>}
          {!summary.available && <div className="booking-source-notice"><Sparkles size={16} />{bi(language, "No verified booking data source is connected.", "لا يوجد مصدر بيانات حجوزات موثّق متصل.")}</div>}
          <BookingTable bookings={realBookings} company={company} language={language} onUnsupported={() => setUnsupported(true)} />
        </section>
      </div>
      {unsupported && <UnsupportedDialog language={language} onClose={() => setUnsupported(false)} t={t} />}
    </BookingPageShell>
  );
}
