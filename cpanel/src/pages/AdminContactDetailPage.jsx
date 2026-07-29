import React from "react";
import { Archive, ArrowLeft, BellRing, CalendarDays, ChevronDown, ClipboardList, Edit3, FileText, Inbox, Mail, MessageSquare, Paperclip, ReceiptText, Send, ShoppingBag, ShoppingCart, Tags, User, Users, Workflow, X } from "lucide-react";
import AdminLayout from "../components/AdminLayout.jsx";
import { fetchCustomers } from "../utils/customersApi.js";
import { invoicesForContact, ordersForContact } from "../utils/contacts.js";
import { apiRequest } from "../utils/api.js";
import { formatCompanyCurrency } from "../utils/sales.js";
import { AdminUnderDevelopmentContent } from "./AdminPlaceholderPage.jsx";

const TAB_KEYS = ["overview", "inbox", "pipelines", "notes", "subscriptions", "bookings", "invoices", "orders"];

const COPY = {
  en: {
    accountType: "Account type", activity: "Timeline", allActivity: "All activities", attachments: "Attachments", back: "Contacts", bookings: "Bookings", contactCreated: "Contact created", contactUnavailable: "Contact details unavailable", contactUnavailableDescription: "Contact details could not be loaded from the company API.", edit: "Edit", email: "Primary email", filter: "Filter", goBooking: "Go to Booking Calendar", goPipelines: "Go to Pipelines", inbox: "Inbox", invoiceEmpty: "No invoices yet", invoiceEmptyDescription: "Real invoices for this contact will appear here.", invoices: "Invoices", labels: "Labels", language: "Language", memberInfo: "Member information", more: "More Actions", newAppointment: "Create New Appointment", newNote: "New Note", noBookings: "No bookings yet", noBookingsDescription: "Bookings will appear here when a supported booking source is available.", noContact: "Contact not found", noContactDescription: "The requested contact could not be found.", noConversation: "No conversation available", noConversationDescription: "No messaging channel is connected for this contact.", noPipelines: "No pipeline boards yet", noPipelinesDescription: "Create a pipeline to organize and track real contact progress.", notes: "Notes", notesEmpty: "No notes yet", notesEmptyDescription: "Notes are private and will appear here when notes storage is available.", orderCreated: "Order placed", orderEmpty: "This contact hasn't placed any orders yet", orderEmptyDescription: "Real orders for this contact will appear here.", orders: "Orders", overview: "Overview", past: "Past", phone: "Primary phone", pipelines: "Pipelines", purchaseStats: "Purchase statistics", purchases: "Purchases", segments: "Segments", send: "Send Message", setup: "Set up", subscriptions: "Subscriptions", subscriptionsEmpty: "Nothing to show yet", subscriptionsEmptyDescription: "Supported plans, subscriptions, or recurring invoices will appear here.", tasks: "Tasks & reminders", tasksEmpty: "No tasks are available for this contact.", totalAmount: "Total amount", upcoming: "Upcoming", unavailable: "Unavailable", workflows: "Workflows",
  },
  ar: {
    accountType: "نوع الحساب", activity: "الخط الزمني", allActivity: "كل الأنشطة", attachments: "المرفقات", back: "جهات الاتصال", bookings: "الحجوزات", contactCreated: "تم إنشاء جهة الاتصال", contactUnavailable: "تفاصيل جهة الاتصال غير متاحة", contactUnavailableDescription: "تعذر تحميل تفاصيل جهة الاتصال من واجهة الشركة.", edit: "تعديل", email: "البريد الأساسي", filter: "تصفية", goBooking: "الانتقال إلى تقويم الحجوزات", goPipelines: "الانتقال إلى المسارات", inbox: "البريد الوارد", invoiceEmpty: "لا توجد فواتير بعد", invoiceEmptyDescription: "ستظهر الفواتير الحقيقية لجهة الاتصال هنا.", invoices: "الفواتير", labels: "التصنيفات", language: "اللغة", memberInfo: "معلومات العضو", more: "إجراءات أخرى", newAppointment: "موعد جديد", newNote: "ملاحظة جديدة", noBookings: "لا توجد حجوزات بعد", noBookingsDescription: "ستظهر الحجوزات عند توفر مصدر حجوزات مدعوم.", noContact: "لم يتم العثور على جهة الاتصال", noContactDescription: "لم يتم العثور على جهة الاتصال المطلوبة.", noConversation: "لا توجد محادثة متاحة", noConversationDescription: "لا توجد قناة مراسلة متصلة لجهة الاتصال هذه.", noPipelines: "لا توجد لوحات مسارات بعد", noPipelinesDescription: "أنشئ مساراً لتنظيم وتتبع تقدم جهات الاتصال الحقيقي.", notes: "ملاحظات", notesEmpty: "لا توجد ملاحظات بعد", notesEmptyDescription: "الملاحظات خاصة وستظهر عند توفر تخزين للملاحظات.", orderCreated: "تم تقديم طلب", orderEmpty: "لم تقدم جهة الاتصال أي طلبات بعد", orderEmptyDescription: "ستظهر الطلبات الحقيقية لجهة الاتصال هنا.", orders: "الطلبات", overview: "نظرة عامة", past: "السابقة", phone: "الهاتف الأساسي", pipelines: "المسارات", purchaseStats: "إحصاءات الشراء", purchases: "المشتريات", segments: "الشرائح", send: "إرسال رسالة", setup: "إعداد", subscriptions: "الاشتراكات", subscriptionsEmpty: "لا يوجد ما يمكن عرضه بعد", subscriptionsEmptyDescription: "ستظهر الخطط أو الاشتراكات أو الفواتير المتكررة المدعومة هنا.", tasks: "المهام والتذكيرات", tasksEmpty: "لا توجد مهام متاحة لجهة الاتصال.", totalAmount: "المبلغ الإجمالي", upcoming: "القادمة", unavailable: "غير متاح", workflows: "سير العمل",
  },
};

const TAB_ICONS = { overview: User, inbox: Inbox, pipelines: Workflow, notes: MessageSquare, subscriptions: Archive, bookings: CalendarDays, invoices: FileText, orders: ShoppingCart };

function formatDate(value, language) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat(language === "ar" ? "ar" : "en", { dateStyle: "medium" }).format(date) : "—";
}

function initials(contact) {
  return String(contact?.name || contact?.email || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function UnsupportedDialog({ onClose, t }) {
  return <div className="customers-modal-backdrop" onMouseDown={onClose} role="presentation"><div aria-modal="true" className="customers-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog"><button aria-label="Close" onClick={onClose} type="button"><X size={18}/></button><AdminUnderDevelopmentContent t={t}/></div></div>;
}

function EmptyVisual({ icon: Icon, tone = "blue" }) {
  return <div aria-hidden="true" className={`contact-empty-visual tone-${tone}`}><span/><span/><Icon size={43}/></div>;
}

function OverviewTab({ contact, language, labels, money, onUnsupported, orders }) {
  const total = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const events = [
    ...orders.slice(0, 5).map((order) => ({ date: order.createdAt, id: order.id, label: `${labels.orderCreated} · ${order.reference || order.id || ""}`, value: money(Number(order.total || 0)) })),
    ...(contact.createdAt ? [{ date: contact.createdAt, id: "contact-created", label: labels.contactCreated, value: "" }] : []),
  ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  return <div className="contact-overview-grid"><div className="contact-overview-main">
    <section className="contact-tasks-card"><header><h2>{labels.tasks}</h2><button onClick={onUnsupported} type="button"><BellRing size={15}/>{labels.setup}</button></header><p>{labels.tasksEmpty}</p></section>
    <section className="contact-timeline-card"><header><h2>{labels.activity}</h2><button onClick={onUnsupported} type="button">{labels.allActivity}<ChevronDown size={14}/></button></header>{events.length ? <div className="contact-timeline-list">{events.map((event) => <article key={event.id}><span className="timeline-icon"><ClipboardList size={17}/></span><div><strong>{event.label}</strong>{event.value && <small>{event.value}</small>}</div><time>{formatDate(event.date, language)}</time></article>)}</div> : <div className="contact-timeline-empty"><ClipboardList size={31}/><p>{labels.unavailable}</p></div>}</section>
  </div><aside className="contact-profile-sidebar">
    <section><h3>{labels.purchaseStats}</h3><div className="contact-purchase-stat"><ShoppingBag size={18}/><span>{labels.purchases}</span><strong>{orders.length}</strong></div><div className="contact-purchase-stat"><ReceiptText size={18}/><span>{labels.totalAmount}</span><strong><bdi dir="ltr">{money(total)}</bdi></strong></div></section>
    <section><h3>{labels.labels}</h3><Tags size={20}/><p>{labels.unavailable}</p><button onClick={onUnsupported} type="button">{labels.setup}</button></section>
    <section><h3>{labels.segments}</h3><Users size={20}/><p>{labels.unavailable}</p><button onClick={onUnsupported} type="button">{labels.setup}</button></section>
    <section><h3>{labels.attachments}</h3><Paperclip size={20}/><p>{labels.unavailable}</p><button onClick={onUnsupported} type="button">{labels.setup}</button></section>
    <section><h3>{labels.memberInfo}</h3><User size={20}/><p>{contact.accountType || labels.unavailable}</p></section>
    <section><h3>{labels.workflows}</h3><Workflow size={20}/><p>{labels.unavailable}</p><button onClick={onUnsupported} type="button">{labels.setup}</button></section>
  </aside></div>;
}

function ContactInboxTab({ labels, onUnsupported }) {
  return <section className="contact-inbox-tab"><div className="contact-inbox-thread"><EmptyVisual icon={Mail}/><h2>{labels.noConversation}</h2><p>{labels.noConversationDescription}</p></div><aside><Mail size={24}/><h3>{labels.inbox}</h3><p>{labels.noConversationDescription}</p><button className="customers-primary-button" onClick={onUnsupported} type="button"><Send size={15}/>{labels.send}</button></aside></section>;
}

function PipelinesTab({ labels, onNavigate }) {
  return <section className="contact-pipelines-tab"><EmptyVisual icon={Workflow} tone="green"/><h2>{labels.noPipelines}</h2><p>{labels.noPipelinesDescription}</p><button onClick={() => onNavigate?.("admin-pipelines")} type="button">{labels.goPipelines}</button></section>;
}

function NotesTab({ labels, onUnsupported }) {
  return <section className="contact-notes-tab"><header><h2>{labels.notes} (0)</h2></header><EmptyVisual icon={MessageSquare} tone="yellow"/><h3>{labels.notesEmpty}</h3><p>{labels.notesEmptyDescription}</p><button className="customers-secondary-button" onClick={onUnsupported} type="button"><MessageSquare size={15}/>{labels.newNote}</button></section>;
}

function SubscriptionsTab({ labels }) {
  return <section className="contact-subscriptions-tab"><header><h2>{labels.subscriptions}</h2></header><div><EmptyVisual icon={Archive} tone="coral"/><h3>{labels.subscriptionsEmpty}</h3><p>{labels.subscriptionsEmptyDescription}</p></div></section>;
}

function BookingsTab({ labels, onNavigate, onUnsupported }) {
  const [view, setView] = React.useState("upcoming");
  return <section className="contact-bookings-tab"><header><h2>{labels.bookings}</h2><div><button className="customers-secondary-button" onClick={() => onNavigate?.("admin-bookings-calendar")} type="button"><CalendarDays size={15}/>{labels.goBooking}</button><button className="customers-secondary-button" onClick={onUnsupported} type="button"><ClipboardList size={15}/>{labels.newAppointment}</button></div></header><div className="contact-booking-filters"><div><button className={view === "upcoming" ? "active" : ""} onClick={() => setView("upcoming")} type="button">{labels.upcoming}</button><button className={view === "past" ? "active" : ""} onClick={() => setView("past")} type="button">{labels.past}</button></div><button className="customers-secondary-button" onClick={onUnsupported} type="button">{labels.filter}</button></div><div className="contact-booking-empty"><EmptyVisual icon={CalendarDays} tone="green"/><h3>{labels.noBookings}</h3><p>{labels.noBookingsDescription}</p></div></section>;
}

function InvoicesTab({ error, invoices, labels, language, money }) {
  return <section className="contact-records-tab"><header><h2>{labels.invoices}</h2></header>{error ? <div className="contact-records-empty" role="alert"><EmptyVisual icon={FileText}/><h3>{labels.contactUnavailable}</h3><p>{error}</p></div> : invoices.length ? <div className="contact-records-scroll"><table><thead><tr><th>#</th><th>{language === "ar" ? "التاريخ" : "Issue date"}</th><th>{language === "ar" ? "الإجمالي" : "Total"}</th><th>{language === "ar" ? "الحالة" : "Status"}</th></tr></thead><tbody>{invoices.map((invoice) => <tr key={invoice.id}><td>{invoice.invoice_number || invoice.id}</td><td>{formatDate(invoice.issue_date || invoice.createdAt, language)}</td><td><bdi dir="ltr">{money(Number(invoice.total || 0))}</bdi></td><td>{invoice.status || "—"}</td></tr>)}</tbody></table></div> : <div className="contact-records-empty"><EmptyVisual icon={FileText} tone="yellow"/><h3>{labels.invoiceEmpty}</h3><p>{labels.invoiceEmptyDescription}</p></div>}</section>;
}

function OrdersTab({ labels, language, money, orders }) {
  return <section className="contact-records-tab"><header><h2>{labels.orders}</h2></header>{orders.length ? <div className="contact-records-scroll"><table><thead><tr><th>{language === "ar" ? "المرجع" : "Reference"}</th><th>{language === "ar" ? "التاريخ" : "Date"}</th><th>{language === "ar" ? "الإجمالي" : "Total"}</th><th>{language === "ar" ? "الحالة" : "Status"}</th><th>{language === "ar" ? "العناصر" : "Items"}</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td>{order.reference || order.id}</td><td>{formatDate(order.createdAt, language)}</td><td><bdi dir="ltr">{money(Number(order.total || 0))}</bdi></td><td>{order.status || "—"}</td><td>{Array.isArray(order.items) ? order.items.length : 0}</td></tr>)}</tbody></table></div> : <div className="contact-records-empty"><EmptyVisual icon={ShoppingCart} tone="green"/><h3>{labels.orderEmpty}</h3><p>{labels.orderEmptyDescription}</p></div>}</section>;
}

export default function AdminContactDetailPage({ language = "en", t: translate, currentUser, company, orders = [], onNavigate, ...layout }) {
  const [activeTab, setActiveTab] = React.useState("overview");
  const [contact, setContact] = React.useState(null);
  const [contactOrders, setContactOrders] = React.useState([]);
  const [invoices, setInvoices] = React.useState([]);
  const [invoiceError, setInvoiceError] = React.useState("");
  const [loadError, setLoadError] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [showUnsupported, setShowUnsupported] = React.useState(false);
  const labels = COPY[language] || COPY.en;
  const contactId = React.useMemo(() => window.location.pathname.match(/\/admin\/customers\/(\d+)/)?.[1] || null, []);

  React.useEffect(() => {
    if (!contactId) { setLoading(false); return; }
    let active = true;
    setLoading(true); setLoadError(""); setInvoiceError("");
    Promise.allSettled([fetchCustomers(), apiRequest("/admin/invoices")]).then(([customersResult, invoicesResult]) => {
      if (!active) return;
      if (customersResult.status === "rejected") {
        setContact(null); setLoadError(customersResult.reason?.message || labels.contactUnavailableDescription); setLoading(false); return;
      }
      const found = (Array.isArray(customersResult.value) ? customersResult.value : []).find((item) => String(item.id) === contactId) || null;
      setContact(found);
      if (invoicesResult.status === "fulfilled") setInvoices(found ? invoicesForContact(Array.isArray(invoicesResult.value) ? invoicesResult.value : [], found) : []);
      else { setInvoices([]); setInvoiceError(invoicesResult.reason?.message || labels.contactUnavailableDescription); }
      setLoading(false);
    });
    return () => { active = false; };
  }, [company?.id, contactId, labels.contactUnavailableDescription]);

  React.useEffect(() => { setContactOrders(contact ? ordersForContact(orders, contact) : []); }, [contact, orders]);
  const money = React.useCallback((value) => formatCompanyCurrency(value, company, language), [company, language]);
  const unsupported = () => setShowUnsupported(true);
  const shell = (content) => <AdminLayout activePage="admin-customers-detail" company={company} currentUser={currentUser} hideHeader language={language} onNavigate={onNavigate} t={translate} {...layout}>{content}</AdminLayout>;

  if (loading) return shell(<div className="admin-contact-detail-loading">{language === "ar" ? "جارٍ التحميل..." : "Loading contact..."}</div>);
  if (loadError) return shell(<div className="admin-empty-state admin-contacts-error" role="alert"><User size={40}/><strong>{labels.contactUnavailable}</strong><span>{labels.contactUnavailableDescription}</span><small>{loadError}</small></div>);
  if (!contact) return shell(<div className="admin-empty-state"><User size={40}/><strong>{labels.noContact}</strong><span>{labels.noContactDescription}</span></div>);

  return shell(<><div className="admin-contact-detail" dir={language === "ar" ? "rtl" : "ltr"}>
    <nav className="contact-breadcrumb"><button onClick={() => onNavigate?.("admin-customers", { path: "/admin/customers" })} type="button">{language === "ar" && <ArrowLeft size={15}/>} {labels.back} {language !== "ar" && <ArrowLeft size={15}/>}</button><span>/</span><strong>{contact.name || "—"}</strong></nav>
    <section className="admin-contact-identity-card"><div className="contact-identity-heading"><span className="admin-contact-avatar-lg">{initials(contact)}</span><div><h1>{contact.name || "—"}</h1><span>{contact.accountType || "—"}</span></div></div><div className="contact-identity-actions"><button aria-label={labels.edit} className="customers-icon-button" onClick={unsupported} type="button"><Edit3 size={17}/></button><button className="customers-secondary-button" onClick={unsupported} type="button">{labels.more}<ChevronDown size={14}/></button><button className="customers-primary-button" onClick={unsupported} type="button"><Send size={16}/>{labels.send}</button></div><div className="contact-identity-fields"><div><span>{labels.email}</span><strong>{contact.email || "—"}</strong></div><div><span>{labels.phone}</span><strong>{contact.phone || "—"}</strong></div><div><span>{labels.accountType}</span><strong>{contact.accountType || "—"}</strong></div>{contact.language && <div><span>{labels.language}</span><strong>{contact.language}</strong></div>}<div><span>{labels.orders}</span><strong>{contactOrders.length}</strong></div></div></section>
    <div className="admin-contact-tabs" role="tablist">{TAB_KEYS.map((key) => { const Icon = TAB_ICONS[key]; return <button aria-selected={activeTab === key} className={activeTab === key ? "active" : ""} key={key} onClick={() => setActiveTab(key)} role="tab" type="button"><Icon size={15}/>{labels[key]}</button>; })}</div>
    <div className="admin-contact-tab-content">{activeTab === "overview" && <OverviewTab contact={contact} labels={labels} language={language} money={money} onUnsupported={unsupported} orders={contactOrders}/>} {activeTab === "inbox" && <ContactInboxTab labels={labels} onUnsupported={unsupported}/>} {activeTab === "pipelines" && <PipelinesTab labels={labels} onNavigate={onNavigate}/>} {activeTab === "notes" && <NotesTab labels={labels} onUnsupported={unsupported}/>} {activeTab === "subscriptions" && <SubscriptionsTab labels={labels}/>} {activeTab === "bookings" && <BookingsTab labels={labels} onNavigate={onNavigate} onUnsupported={unsupported}/>} {activeTab === "invoices" && <InvoicesTab error={invoiceError} invoices={invoices} labels={labels} language={language} money={money}/>} {activeTab === "orders" && <OrdersTab labels={labels} language={language} money={money} orders={contactOrders}/>}</div>
  </div>{showUnsupported && <UnsupportedDialog onClose={() => setShowUnsupported(false)} t={translate}/>}</>);
}
