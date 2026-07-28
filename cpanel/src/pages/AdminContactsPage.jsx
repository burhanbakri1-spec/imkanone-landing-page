import React from "react";
import { ChevronDown, Eye, Filter, MoreHorizontal, RefreshCw, Search, SlidersHorizontal, UserPlus, Users, X } from "lucide-react";
import AdminLayout from "../components/AdminLayout.jsx";
import { fetchCustomers } from "../utils/customersApi.js";
import { AdminUnderDevelopmentContent } from "./AdminPlaceholderPage.jsx";

const LABELS = {
  en: {
    accountType: "Account type", allContacts: "All contacts", audience: "Pinned audiences", created: "Date created", create: "Create New", customers: "Customers", email: "Email", emptyDescription: "Customer accounts will appear here after registration or an order.", emptyTitle: "No contacts yet", filter: "Filter", grow: "Grow contacts list", importExport: "Import / Export", lastActivity: "Last activity", loading: "Loading contacts...", manageSegments: "Manage Segments", manageView: "Manage View", name: "Name", newCustomers: "New customers", noResults: "No contacts match your search.", orders: "Orders", overview: "Overview", phone: "Phone", recent: "Recent activity", searchPlaceholder: "Search contacts...", select: "Select contact", subtitle: "Manage and track your customers, leads and site members.", title: "Contacts", total: "customers", unavailableDescription: "Contacts could not be loaded from the company API. Please try again later.", unavailableTitle: "Contacts unavailable", view: "View",
  },
  ar: {
    accountType: "نوع الحساب", allContacts: "كل جهات الاتصال", audience: "الجماهير المثبتة", created: "تاريخ الإنشاء", create: "إنشاء جديد", customers: "العملاء", email: "البريد الإلكتروني", emptyDescription: "ستظهر حسابات العملاء هنا بعد التسجيل أو تقديم طلب.", emptyTitle: "لا توجد جهات اتصال بعد", filter: "تصفية", grow: "تنمية قائمة جهات الاتصال", importExport: "استيراد / تصدير", lastActivity: "آخر نشاط", loading: "جارٍ تحميل جهات الاتصال...", manageSegments: "إدارة الشرائح", manageView: "إدارة العرض", name: "الاسم", newCustomers: "عملاء جدد", noResults: "لا توجد جهات اتصال تطابق بحثك.", orders: "الطلبات", overview: "نظرة عامة", phone: "الهاتف", recent: "النشاط الحديث", searchPlaceholder: "البحث في جهات الاتصال...", select: "تحديد جهة اتصال", subtitle: "إدارة وتتبع العملاء والعملاء المحتملين وأعضاء الموقع.", title: "جهات الاتصال", total: "عملاء", unavailableDescription: "تعذر تحميل جهات الاتصال من واجهة الشركة. يرجى المحاولة لاحقاً.", unavailableTitle: "جهات الاتصال غير متاحة", view: "عرض",
  },
};

function validDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function formatDate(value, language) {
  const date = validDate(value);
  return date ? new Intl.DateTimeFormat(language === "ar" ? "ar" : "en", { dateStyle: "medium" }).format(date) : "—";
}

function initials(contact) {
  return String(contact?.name || contact?.email || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function recentCount(customers, field) {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return customers.filter((contact) => {
    const date = validDate(contact?.[field]);
    return date ? date.getTime() >= cutoff : false;
  }).length;
}

function ContactsUnsupported({ onClose, t }) {
  return <div className="customers-modal-backdrop" onMouseDown={onClose} role="presentation"><div aria-modal="true" className="customers-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog"><button aria-label="Close" onClick={onClose} type="button"><X size={18}/></button><AdminUnderDevelopmentContent t={t}/></div></div>;
}

export default function AdminContactsPage({ language = "en", t: translate, company, onNavigate, ...layout }) {
  const [search, setSearch] = React.useState("");
  const [customers, setCustomers] = React.useState([]);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [showUnsupported, setShowUnsupported] = React.useState(false);
  const labels = LABELS[language] || LABELS.en;

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    fetchCustomers().then((data) => {
      if (!active) return;
      setCustomers(Array.isArray(data) ? data : []);
      setLoading(false);
    }).catch((requestError) => {
      if (!active) return;
      setCustomers([]);
      setError(requestError?.message || labels.unavailableDescription);
      setLoading(false);
    });
    return () => { active = false; };
  }, [company?.id, labels.unavailableDescription]);

  const filtered = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return customers;
    return customers.filter((contact) => [contact.name, contact.email, contact.phone].some((value) => String(value || "").toLowerCase().includes(query)));
  }, [customers, search]);

  const audiences = [
    { label: labels.allContacts, value: customers.length },
    { label: labels.customers, value: customers.length },
    { label: labels.recent, value: recentCount(customers, "updatedAt") },
    { label: labels.newCustomers, value: recentCount(customers, "createdAt") },
  ];

  function openContact(contact) {
    if (typeof onNavigate === "function") onNavigate("admin-customers-detail", { path: `/admin/customers/${contact.id}` });
  }

  return (
    <AdminLayout activePage="admin-customers" company={company} hideHeader language={language} onNavigate={onNavigate} t={translate} {...layout}>
      <div className="admin-contacts-page" dir={language === "ar" ? "rtl" : "ltr"}>
        <header className="admin-contacts-header">
          <div><h1>{labels.title}</h1><p>{labels.subtitle}</p></div>
          <div className="admin-contacts-header-actions"><button aria-label="More" className="customers-icon-button" onClick={() => setShowUnsupported(true)} type="button"><MoreHorizontal size={18}/></button><button className="customers-secondary-button" onClick={() => setShowUnsupported(true)} type="button">{labels.manageSegments}</button><button className="customers-primary-button" onClick={() => setShowUnsupported(true)} type="button"><UserPlus size={16}/>{labels.create}<ChevronDown size={14}/></button></div>
        </header>

        <section className="admin-contacts-summary-strip"><span><Users size={18}/><strong>{error ? "—" : customers.length}</strong> {labels.total}</span><button onClick={() => setShowUnsupported(true)} type="button">{labels.manageSegments}</button></section>

        <section className="admin-contacts-overview">
          <header><h2>{labels.overview}</h2><button aria-label="More" className="customers-icon-button" onClick={() => setShowUnsupported(true)} type="button"><MoreHorizontal size={17}/></button></header>
          <div className="admin-contacts-audience-controls"><button onClick={() => setShowUnsupported(true)} type="button">{labels.grow}</button><button className="active" onClick={() => setShowUnsupported(true)} type="button">{labels.audience}</button><button aria-label="Refresh" onClick={() => setShowUnsupported(true)} type="button"><RefreshCw size={15}/></button></div>
          <div className="admin-contacts-audience-grid">{audiences.map((audience, index) => <article key={audience.label}><div><span>{audience.label}</span><strong>{error ? "—" : audience.value}</strong></div><span className={`audience-mark mark-${index + 1}`} aria-hidden="true"/></article>)}</div>
        </section>

        <section className="admin-contacts-table-card">
          <div className="admin-contacts-toolbar"><button className="contacts-view-select" type="button">{labels.allContacts}<span>({error ? "—" : customers.length})</span><ChevronDown size={14}/></button><button className="contacts-manage-view" onClick={() => setShowUnsupported(true)} type="button">{labels.manageView}<ChevronDown size={13}/></button><div className="contacts-toolbar-spacer"/><button className="customers-secondary-button" onClick={() => setShowUnsupported(true)} type="button"><Filter size={15}/>{labels.filter}</button><button aria-label="View settings" className="customers-icon-button" onClick={() => setShowUnsupported(true)} type="button"><SlidersHorizontal size={16}/></button><label className="contacts-search"><Search size={16}/><input aria-label={labels.searchPlaceholder} onChange={(event) => setSearch(event.target.value)} placeholder={labels.searchPlaceholder} value={search}/>{search && <button aria-label="Clear" onClick={() => setSearch("")} type="button"><X size={14}/></button>}</label><button className="customers-secondary-button" onClick={() => setShowUnsupported(true)} type="button">{labels.importExport}<ChevronDown size={13}/></button></div>
          <div className="admin-contacts-table-scroll">
            <table className="admin-contacts-table"><thead><tr><th><input aria-label={labels.select} type="checkbox"/></th><th>{labels.name}</th><th>{labels.email}</th><th>{labels.phone}</th><th>{labels.accountType}</th><th>{labels.orders}</th><th>{labels.lastActivity}</th><th>{labels.created}</th><th/></tr></thead>
              <tbody>{loading ? <tr><td className="admin-contacts-loading" colSpan={9}>{labels.loading}</td></tr> : error ? <tr><td colSpan={9}><div className="contacts-table-empty admin-contacts-error" role="alert"><Users size={35}/><strong>{labels.unavailableTitle}</strong><p>{labels.unavailableDescription}</p><small>{error}</small></div></td></tr> : filtered.length ? filtered.map((contact) => <tr className="admin-contacts-row" key={contact.id} onClick={() => openContact(contact)}><td onClick={(event) => event.stopPropagation()}><input aria-label={`${labels.select} ${contact.name || contact.id}`} type="checkbox"/></td><td><button className="admin-contact-name-cell" onClick={() => openContact(contact)} type="button"><span className="admin-contact-avatar-sm">{initials(contact)}</span><strong>{contact.name || "—"}</strong></button></td><td>{contact.email || "—"}</td><td>{contact.phone || "—"}</td><td>{contact.accountType || "—"}</td><td>{contact.orderCount ?? 0}</td><td>{formatDate(contact.updatedAt, language)}</td><td>{formatDate(contact.createdAt, language)}</td><td><div className="contacts-row-actions"><button className="contacts-view-button" onClick={(event) => { event.stopPropagation(); openContact(contact); }} type="button"><Eye size={15}/>{labels.view}</button><button aria-label="More" className="customers-icon-button" onClick={(event) => { event.stopPropagation(); setShowUnsupported(true); }} type="button"><MoreHorizontal size={16}/></button></div></td></tr>) : <tr><td colSpan={9}><div className="contacts-table-empty"><Users size={38}/><strong>{search ? labels.noResults : labels.emptyTitle}</strong>{!search && <p>{labels.emptyDescription}</p>}</div></td></tr>}</tbody>
            </table>
          </div>
        </section>
      </div>
      {showUnsupported && <ContactsUnsupported onClose={() => setShowUnsupported(false)} t={translate}/>} 
    </AdminLayout>
  );
}
