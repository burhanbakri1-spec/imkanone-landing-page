import React from "react";
import { ChevronDown, Globe, MessageCircle, MessagesSquare, Search, Settings, SquarePen, X } from "lucide-react";
import AdminLayout from "../components/AdminLayout.jsx";
import { AdminUnderDevelopmentContent } from "./AdminPlaceholderPage.jsx";

const LABELS = {
  en: {
    all: "All conversations",
    banner: "Connect Meta to receive Facebook and Instagram messages. No Meta account is currently connected.",
    connect: "Connect Meta",
    description: "Facebook and Instagram conversations will appear here after a real Meta integration is connected.",
    emptyList: "No conversations yet",
    emptyListDescription: "Real customer conversations from Facebook and Instagram will appear after a Meta Business account is connected.",
    facebook: "Facebook",
    instagram: "Instagram",
    newMessage: "New Message",
    search: "Search conversations",
    settings: "Settings",
    subtitle: "Manage Facebook and Instagram conversations from one workspace",
    title: "Inbox",
    workspaceTitle: "Connect Meta to manage conversations",
  },
  ar: {
    all: "كل المحادثات",
    banner: "اربط ميتا لاستقبال رسائل فيسبوك وإنستغرام. لا يوجد حساب ميتا متصل حالياً.",
    connect: "ربط ميتا",
    description: "ستظهر محادثات فيسبوك وإنستغرام هنا بعد ربط حساب ميتا للأعمال.",
    emptyList: "لا توجد محادثات بعد",
    emptyListDescription: "ستظهر محادثات العملاء الحقيقية من فيسبوك وإنستغرام بعد ربط حساب ميتا للأعمال.",
    facebook: "فيسبوك",
    instagram: "إنستغرام",
    newMessage: "رسالة جديدة",
    search: "البحث في المحادثات",
    settings: "الإعدادات",
    subtitle: "إدارة محادثات فيسبوك وإنستغرام من مساحة عمل واحدة",
    title: "البريد الوارد",
    workspaceTitle: "اربط ميتا لإدارة المحادثات",
  },
};

function InboxUnsupported({ onClose, t }) {
  return <div className="customers-modal-backdrop" onMouseDown={onClose} role="presentation"><div aria-modal="true" className="customers-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog"><button aria-label="Close" onClick={onClose} type="button"><X size={18}/></button><AdminUnderDevelopmentContent t={t}/></div></div>;
}

export default function AdminInboxPage({ language = "en", t: translate, ...layout }) {
  const [showUnsupported, setShowUnsupported] = React.useState(false);
  const [channelFilter, setChannelFilter] = React.useState("all");
  const labels = LABELS[language] || LABELS.en;
  const ar = language === "ar";

  return (
    <AdminLayout activePage="admin-inbox" hideHeader language={language} t={translate} {...layout}>
      <div className="admin-inbox-page" dir={ar ? "rtl" : "ltr"}>
        <header className="admin-inbox-page-header">
          <div><h1>{labels.title}</h1><p>{labels.subtitle}</p></div>
          <div className="admin-inbox-header-actions">
            <button className="customers-primary-button" onClick={() => setShowUnsupported(true)} type="button"><Globe size={16}/>{labels.connect}</button>
            <button className="customers-secondary-button" onClick={() => setShowUnsupported(true)} type="button"><Settings size={16}/>{labels.settings}<ChevronDown size={14}/></button>
            <button className="customers-secondary-button" onClick={() => setShowUnsupported(true)} type="button"><SquarePen size={16}/>{labels.newMessage}</button>
          </div>
        </header>

        <section className="admin-inbox-setup-banner"><MessageCircle size={18}/><span>{labels.banner}</span><button onClick={() => setShowUnsupported(true)} type="button">{labels.connect}</button></section>

        <section className="admin-inbox-workspace">
          <aside className="admin-inbox-conversations" aria-label={labels.all}>
            <div className="inbox-channel-picker">
              <button className={channelFilter === "all" ? "active" : ""} onClick={() => setChannelFilter("all")} type="button"><MessagesSquare size={15}/>{labels.all}</button>
              <button className="inbox-channel-option" onClick={() => setShowUnsupported(true)} type="button"><MessageCircle size={15}/>{labels.facebook}</button>
              <button className="inbox-channel-option" onClick={() => setShowUnsupported(true)} type="button"><MessageCircle size={15}/>{labels.instagram}</button>
            </div>
            <div className="admin-inbox-list-toolbar">
              <button type="button"><span className="admin-inbox-check"/>{labels.all}<ChevronDown size={14}/></button>
              <button aria-label={labels.search} type="button"><Search size={19}/></button>
            </div>
            <div className="admin-inbox-list-empty">
              <span className="admin-inbox-mini-visual"><MessagesSquare size={27}/></span>
              <strong>{labels.emptyList}</strong>
              <p>{labels.emptyListDescription}</p>
            </div>
          </aside>

          <div className="admin-inbox-conversation-empty">
            <div className="admin-inbox-hero-visual" aria-hidden="true"><span/><span/><MessagesSquare size={52}/></div>
            <h2>{labels.workspaceTitle}</h2>
            <p>{labels.description}</p>
            <button className="customers-primary-button" onClick={() => setShowUnsupported(true)} type="button">{labels.connect}</button>
          </div>
        </section>
      </div>
      {showUnsupported && <InboxUnsupported onClose={() => setShowUnsupported(false)} t={translate}/>} 
    </AdminLayout>
  );
}
