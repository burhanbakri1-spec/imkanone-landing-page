import React from "react";
import {
  Activity,
  Bell,
  Blocks,
  Bot,
  Building2,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ExternalLink,
  Film,
  FolderTree,
  Globe2,
  Inbox,
  Languages,
  LayoutDashboard,
  Menu,
  MessageCircle,
  Moon,
  Newspaper,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Store,
  Sun,
  Tags,
  UserCircle,
  Users,
  X,
  Zap,
} from "lucide-react";
import CompanySwitcher from "./CompanySwitcher.jsx";
import {
  navigationContainsPage,
  platformNavigation,
  tenantNavigation,
  toggleExclusiveGroup,
  toggleExclusivePopover,
} from "../data/adminNavigation.js";
import { groupCompanyModules, normalizedModulePage } from "../utils/moduleRegistry.js";
import { canAccessAdminPage } from "../utils/roles.js";

const iconMap = {
  activity: Activity,
  blocks: Blocks,
  bot: Bot,
  building: Building2,
  calendar: CalendarDays,
  calendarDays: CalendarDays,
  chartColumn: ChartNoAxesCombined,
  chartNoAxesCombined: ChartNoAxesCombined,
  chartSpline: ChartNoAxesCombined,
  contact: Users,
  contactRound: Users,
  database: Blocks,
  film: Film,
  folderTree: FolderTree,
  globe: Globe2,
  globe2: Globe2,
  house: LayoutDashboard,
  images: Package,
  inbox: Inbox,
  layoutDashboard: LayoutDashboard,
  megaphone: Sparkles,
  monitorSmartphone: Globe2,
  package: Package,
  panelsTopLeft: LayoutDashboard,
  settings: Settings,
  settings2: Settings,
  shoppingBag: ShoppingBag,
  shoppingCart: ShoppingCart,
  smartphone: Globe2,
  sparkles: Sparkles,
  store: Store,
  tags: Tags,
  users: Users,
  walletCards: ShoppingBag,
};

const localized = (value, language) => value?.[language] || value?.en || "";

function iconFor(key) {
  return iconMap[key] || Blocks;
}

function filterNavigation(items, { currentUser, modulePages, modulesConfigured }) {
  return items.flatMap((item) => {
    if (item.children) {
      const children = filterNavigation(item.children, { currentUser, modulePages, modulesConfigured });
      return children.length ? [{ ...item, children }] : [];
    }
    if (!item.pageKey || !canAccessAdminPage(currentUser, item.pageKey)) return [];
    if (item.requiresModule && modulesConfigured && !modulePages.has(normalizedModulePage(item.pageKey))) {
      return [];
    }
    return [item];
  });
}

function ShellPopover({ active, companyScoped, language, onClose, onLogout, onNavigate, quickActions = [], user }) {
  const ar = language === "ar";
  const scope = companyScoped ? "tenant" : "platform";
  const navigateUtility = (suffix) => {
    onClose();
    onNavigate(`admin-${scope}-placeholder-${suffix.replaceAll("/", "-")}`);
  };

  if (!active) return null;

  if (active === "quickActions") {
    return <div className="admin-quick-actions-popover" role="dialog" aria-label={ar ? "إجراءات سريعة" : "Quick Actions"}>
      <header><div><span>{ar ? "مساحة العمل" : "Workspace"}</span><h2>{ar ? "إجراءات سريعة" : "Quick Actions"}</h2></div><button type="button" onClick={onClose} aria-label={ar ? "إغلاق" : "Close"}><X size={18} /></button></header>
      <div className="admin-quick-actions-grid">
        {quickActions.map((action) => {
          const ActionIcon = iconFor(action.icon);
          return <button key={action.pageKey} type="button" onClick={() => { onClose(); onNavigate(action.pageKey); }}><span><ActionIcon size={21} /></span><div><strong>{localized(action.label, language)}</strong><small>{localized(action.description, language)}</small></div><ChevronRight size={16} /></button>;
        })}
      </div>
    </div>;
  }

  if (active === "resources") {
    const groups = [
      [ar ? "تعلّم" : "Learn", [ar ? "دروس وأدلة" : "Tutorials & guides", ar ? "دورات المنصة" : "Platform courses"]],
      [ar ? "أصول مفيدة" : "Useful Assets", [ar ? "أدوات الأعمال" : "Business tools", ar ? "مكتبة التصميم" : "Design library"]],
      [ar ? "استلهم" : "Get Inspired", [ar ? "نماذج مميزة" : "Featured examples", ar ? "قصص العملاء" : "Customer stories"]],
      [ar ? "للمطورين" : "For Developers", [ar ? "التوثيق" : "Documentation", ar ? "واجهات البرمجة" : "APIs & integrations"]],
    ];
    return <div className="admin-shell-dropdown admin-resources-menu" role="dialog" aria-label={ar ? "المصادر" : "Resources"}>
      {groups.map(([heading, links]) => <section key={heading}><strong>{heading}</strong>{links.map((item) => <button key={item} type="button" onClick={() => navigateUtility("help/chat")}>{item}</button>)}</section>)}
    </div>;
  }

  if (active === "community") {
    return <div className="admin-shell-dropdown" role="dialog" aria-label={ar ? "المجتمع" : "Community"}>
      <strong>{ar ? "مجتمع iGroup" : "iGroup Community"}</strong>
      {[ar ? "منتدى المحترفين" : "Professionals forum", ar ? "الفعاليات القادمة" : "Upcoming events", ar ? "الشركاء والخبراء" : "Partners & experts"].map((item) => <button key={item} type="button" onClick={() => navigateUtility("help/chat")}>{item}</button>)}
    </div>;
  }

  if (active === "profile") {
    return <div className="admin-shell-dropdown admin-profile-menu" role="dialog" aria-label={ar ? "الملف الشخصي" : "Profile"}>
      <div className="admin-popover-profile"><span>{user?.name?.charAt(0) || "A"}</span><div><strong>{user?.name || "Admin"}</strong><small>{user?.email || user?.role || "admin"}</small></div></div>
      <button type="button" onClick={() => { onClose(); onNavigate(companyScoped ? "admin-settings" : "admin-platform-placeholder-settings-workspace"); }}><UserCircle size={16} />{ar ? "إعدادات الحساب" : "Account Settings"}</button>
      <button type="button" onClick={onLogout}><ExternalLink size={16} />{ar ? "تسجيل الخروج" : "Log Out"}</button>
    </div>;
  }

  const panelTitles = {
    help: ar ? "مركز المساعدة" : "Help Center",
    inbox: ar ? "البريد الوارد" : "Inbox",
    notifications: ar ? "الإشعارات" : "Notifications",
    news: ar ? "آخر الأخبار" : "Latest news",
  };

  return <aside className="admin-shell-panel" role="dialog" aria-modal="false" aria-label={panelTitles[active]}>
    <header><h2>{panelTitles[active]}</h2><button type="button" onClick={onClose} aria-label={ar ? "إغلاق" : "Close"}><X size={18} /></button></header>
    <div className="admin-shell-panel-body">
    {active === "help" && <>
      <label className="admin-panel-search"><Search size={16} /><input placeholder={ar ? "ابحث في مركز المساعدة" : "Search Help Center"} /></label>
      <div className="admin-panel-list">{[ar ? "كيف أبدأ؟" : "How do I get started?", ar ? "إدارة الموقع والحساب" : "Managing your site and account", ar ? "المدفوعات والفوترة" : "Payments and billing"].map((row) => <button key={row} type="button"><span>{row}</span><ChevronRight size={15} /></button>)}</div>
      <div className="admin-assistant-card"><Sparkles size={20} /><div><strong>{ar ? "مساعد iGroup" : "iGroup Assistant"}</strong><p>{ar ? "احصل على إجابات سريعة حول مساحة العمل." : "Get quick answers about your workspace."}</p></div></div>
      <button className="admin-panel-primary" type="button" onClick={() => navigateUtility("help/chat")}><MessageCircle size={16} />{ar ? "ابدأ محادثة" : "Start a chat"}</button>
    </>}
    {(active === "inbox" || active === "notifications") && <>
      <div className="admin-panel-tabs"><button className="active" type="button">{ar ? "هذا الموقع" : "This Site"}<span>3</span></button><button type="button">{ar ? "كل المواقع" : "All Sites"}</button></div>
      <div className="admin-panel-action-row"><strong>{active === "inbox" ? (ar ? "الرسائل الحديثة" : "Recent messages") : (ar ? "النشاط الحديث" : "Recent activity")}</strong><button type="button">{active === "inbox" ? (ar ? "تحديد الكل كمقروء" : "Mark All as Read") : (ar ? "التفضيلات" : "Preferences")}</button></div>
      <div className="admin-panel-feed">{[1, 2, 3].map((number) => <article key={number}><span className="admin-feed-dot" /><div><strong>{active === "inbox" ? (ar ? "رسالة عميل جديدة" : "New customer message") : (ar ? "تحديث في مساحة العمل" : "Workspace update")}</strong><p>{ar ? "راجع آخر التفاصيل والإجراءات المتاحة." : "Review the latest details and available actions."}</p></div></article>)}</div>
      {active === "inbox" && <button className="admin-panel-primary admin-panel-sticky-action" type="button" onClick={() => { onClose(); onNavigate("admin-tenant-placeholder-inbox"); }}>{ar ? "الانتقال إلى البريد" : "Go to Inbox"}</button>}
    </>}
    {active === "news" && <>
      <div className="admin-news-filter">{[ar ? "إصدارات جديدة" : "New Releases", ar ? "تجريبي" : "Betas", ar ? "تحديثات" : "Updates"].map((item, index) => <button className={index === 0 ? "active" : ""} key={item} type="button">{item}</button>)}</div>
      <div className="admin-panel-feed">{[ar ? "تحسينات إدارة المواقع" : "Site management improvements", ar ? "تجربة تنقل أسرع" : "A faster navigation experience", ar ? "أدوات تحليل جديدة" : "New analytics tools"].map((item, index) => <article key={item}><span className="admin-news-badge">{index ? "UPDATE" : "NEW"}</span><div><strong>{item}</strong><p>{ar ? "تعرّف على أحدث تحسينات المنصة." : "Explore the latest platform improvements."}</p></div></article>)}</div>
      <div className="admin-panel-footer-actions"><button type="button" onClick={() => navigateUtility("news/all")}>{ar ? "عرض الكل" : "View All"}</button><button type="button" onClick={() => navigateUtility("news/roadmap")}>{ar ? "خارطة طريق المنتج" : "Product roadmap"}</button></div>
    </>}
    </div>
  </aside>;
}

function AdminLayout({
  activePage,
  children,
  company,
  currentUser,
  language = "en",
  modules = [],
  onLogout,
  onNavigate,
  onLanguageChange,
  onReturnToPlatform,
  onSwitchCompany,
  subtitle,
  title,
  hideHeader = false,
  isDarkMode = false,
  onToggleDarkMode,
}) {
  const ar = language === "ar";
  const companyName = company?.name || "iGroup Platform";
  const companyMark = companyName.slice(0, 2).toUpperCase();
  const activeKey = normalizedModulePage(activePage);
  const isSuperAdmin = (currentUser?.globalRole || currentUser?.role) === "super_admin";
  const isTenant = Boolean(company);
  const modulePages = React.useMemo(() => new Set(groupCompanyModules(modules).flatMap((section) => section.items.map((item) => item.pageKey))), [modules]);
  const configuredPageKeys = React.useMemo(() => {
    const collect = (items) => items.flatMap((item) => [item.pageKey, ...(item.children ? collect(item.children) : [])]).filter(Boolean);
    return new Set(collect(tenantNavigation));
  }, []);
  const sections = React.useMemo(() => {
    const base = !isTenant && isSuperAdmin ? platformNavigation : tenantNavigation;
    const filtered = filterNavigation(base, { currentUser, modulePages, modulesConfigured: modules.length > 0 });
    if (!isTenant) return filtered;
    const customItems = groupCompanyModules(modules).flatMap((section) => section.items).filter((item) => !configuredPageKeys.has(item.pageKey) && canAccessAdminPage(currentUser, item.pageKey)).map((item) => ({
      id: item.module_key || item.pageKey,
      pageKey: item.pageKey,
      label: { en: item.label_en, ar: item.label_ar || item.label_en },
      icon: item.icon_key,
      existing: true,
    }));
    return customItems.length ? [...filtered, { id: "tenant-custom", label: { en: "Custom", ar: "مخصص" }, icon: "blocks", children: customItems }] : filtered;
  }, [configuredPageKeys, currentUser, isSuperAdmin, isTenant, modulePages, modules]);
  const quickActions = React.useMemo(() => [
    { pageKey: "admin-products-new", label: { en: "Add product", ar: "إضافة منتج" }, description: { en: "Create a catalog product", ar: "إنشاء منتج في الكتالوج" }, icon: "package" },
    { pageKey: "admin-products", label: { en: "Manage products", ar: "إدارة المنتجات" }, description: { en: "Review the current catalog", ar: "مراجعة الكتالوج الحالي" }, icon: "package" },
    { pageKey: "admin-orders", label: { en: "View orders", ar: "عرض الطلبات" }, description: { en: "Open order management", ar: "فتح إدارة الطلبات" }, icon: "shoppingCart" },
    { pageKey: "admin-categories", label: { en: "Categories", ar: "التصنيفات" }, description: { en: "Organize catalog categories", ar: "تنظيم تصنيفات الكتالوج" }, icon: "folderTree" },
    { pageKey: "admin-staff", label: { en: "Employees", ar: "الموظفون" }, description: { en: "Manage team access", ar: "إدارة وصول الفريق" }, icon: "users" },
    { pageKey: "admin-settings", label: { en: "Company settings", ar: "إعدادات الشركة" }, description: { en: "Update workspace settings", ar: "تحديث إعدادات مساحة العمل" }, icon: "settings" },
  ].filter((action) => {
    if (!canAccessAdminPage(currentUser, action.pageKey)) return false;
    if (!modules.length) return true;
    return modulePages.has(normalizedModulePage(action.pageKey));
  }), [currentUser, modulePages, modules]);
  const activeMain = sections.find((item) => navigationContainsPage(item, activeKey))?.id || null;
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [openMain, setOpenMain] = React.useState(activeMain);
  const [openNested, setOpenNested] = React.useState({});
  const [activePopover, setActivePopover] = React.useState(null);

  React.useEffect(() => {
    if (activeMain) setOpenMain(activeMain);
  }, [activeMain]);

  React.useEffect(() => {
    const closeOnEscape = (event) => event.key === "Escape" && setActivePopover(null);
    const closeOutside = (event) => {
      if (activePopover && !event.target.closest("[data-admin-popover-root]")) setActivePopover(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOutside);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOutside);
    };
  }, [activePopover]);

  const activatePopover = (name) => setActivePopover((current) => toggleExclusivePopover(current, name));
  const labels = {
    allSites: ar ? "كل المواقع" : "All Sites",
    resources: ar ? "المصادر" : "Resources",
    community: ar ? "المجتمع" : "Community",
    help: ar ? "المساعدة" : "Help",
    upgrade: ar ? "ترقية" : "Upgrade",
    search: ar ? "بحث..." : "Search...",
    inbox: ar ? "البريد الوارد" : "Inbox",
    notifications: ar ? "الإشعارات" : "Notifications",
    news: ar ? "آخر الأخبار" : "Latest news",
    profile: ar ? "الملف الشخصي" : "Profile",
    ai: ar ? "الذكاء الاصطناعي" : "AI",
    quickActions: ar ? "إجراءات سريعة" : "Quick Actions",
    menu: ar ? "القائمة" : "Menu",
    collapse: ar ? "طي القائمة" : "Collapse sidebar",
    expand: ar ? "توسيع القائمة" : "Expand sidebar",
    storefront: ar ? "واجهة المتجر" : "Storefront",
    backToPlatform: ar ? "العودة إلى المنصة" : "Back to Platform",
  };

  const go = (pageKey) => {
    onNavigate(pageKey);
    setMobileOpen(false);
  };

  const renderNode = (item, level = 0) => {
    const Icon = iconFor(item.icon);
    const active = item.pageKey === activeKey;
    const branchActive = navigationContainsPage(item, activeKey);
    if (!item.children) return <button className={`admin-nav-button ${active ? "active" : ""}`} key={item.id} onClick={() => go(item.pageKey)} type="button" title={sidebarCollapsed ? localized(item.label, language) : undefined} style={{ "--nav-depth": level }}><Icon size={16} /><span>{localized(item.label, language)}</span>{item.placeholder && <small>{ar ? "قريباً" : "Soon"}</small>}</button>;
    const open = level === 0 ? openMain === item.id : Boolean(openNested[item.id] || branchActive);
    return <div className={`admin-nav-group admin-nav-depth-${level}`} key={item.id}>
      <button className={`admin-nav-section ${branchActive ? "active" : ""}`} onClick={() => {
        if (sidebarCollapsed) setSidebarCollapsed(false);
        if (level === 0) setOpenMain((current) => toggleExclusiveGroup(current, item.id));
        else setOpenNested((current) => ({ ...current, [item.id]: !current[item.id] }));
      }} type="button" aria-expanded={open}><span><Icon size={16} /><b>{localized(item.label, language)}</b></span><ChevronDown className={`admin-nav-chevron-icon ${open ? "open" : ""}`} size={14} /></button>
      {open && <div className="admin-nav-items">{item.children.map((child) => renderNode(child, level + 1))}</div>}
    </div>;
  };

  return <section className={`admin-layout admin-studio-shell ${isDarkMode ? "admin-dark" : ""} ${isTenant ? "admin-tenant" : "admin-platform"} ${sidebarCollapsed ? "sidebar-collapsed" : ""}`} dir={ar ? "rtl" : "ltr"}>
    <header className="admin-topnav">
      <div className="admin-topnav-left">
        <div className="admin-platform-logo" aria-label="iGroup"><span>iG</span><strong>iGroup</strong></div>
        <CompanySwitcher company={company} currentUser={currentUser} language={language} onSwitchCompany={onSwitchCompany} onReturnToPlatform={onReturnToPlatform} />
        {!isTenant && <button className="admin-topnav-btn" onClick={() => go("admin-platform-companies")} type="button"><Globe2 size={16} /><span>{labels.allSites}</span></button>}
      </div>
      <div className="admin-topnav-right" data-admin-popover-root>
        <div className="admin-topnav-menu-anchor">
          <button className={`admin-topnav-btn admin-topnav-text-btn ${activePopover === "resources" ? "active" : ""}`} onClick={() => activatePopover("resources")} type="button" aria-haspopup="dialog" aria-expanded={activePopover === "resources"}><span>{labels.resources}</span><ChevronDown size={13} /></button>
          {activePopover === "resources" && <ShellPopover active="resources" companyScoped={isTenant} language={language} onClose={() => setActivePopover(null)} onLogout={onLogout} onNavigate={go} user={currentUser} />}
        </div>
        <div className="admin-topnav-menu-anchor">
          <button className={`admin-topnav-btn admin-topnav-text-btn ${activePopover === "community" ? "active" : ""}`} onClick={() => activatePopover("community")} type="button" aria-haspopup="dialog" aria-expanded={activePopover === "community"}><span>{labels.community}</span><ChevronDown size={13} /></button>
          {activePopover === "community" && <ShellPopover active="community" companyScoped={isTenant} language={language} onClose={() => setActivePopover(null)} onLogout={onLogout} onNavigate={go} user={currentUser} />}
        </div>
        <button className={`admin-topnav-btn ${activePopover === "help" ? "active" : ""}`} aria-label={labels.help} onClick={() => activatePopover("help")} type="button"><CircleHelp size={17} /><span className="admin-topnav-optional-label">{labels.help}</span></button>
        {isTenant && <button className="admin-upgrade-button" onClick={() => go("admin-tenant-placeholder-upgrade")} type="button"><Zap size={15} />{labels.upgrade}</button>}
        {isTenant && <label className="admin-global-search"><Search size={15} /><input aria-label={labels.search} placeholder={labels.search} /></label>}
        {isTenant && <button className={`admin-topnav-btn admin-icon-only ${activePopover === "inbox" ? "active" : ""}`} aria-label={labels.inbox} onClick={() => activatePopover("inbox")} type="button"><Inbox size={17} /><i>3</i></button>}
        <button className={`admin-topnav-btn admin-icon-only ${activePopover === "notifications" ? "active" : ""}`} aria-label={labels.notifications} onClick={() => activatePopover("notifications")} type="button"><Bell size={17} /><i>2</i></button>
        <button className={`admin-topnav-btn admin-icon-only ${activePopover === "news" ? "active" : ""}`} aria-label={labels.news} onClick={() => activatePopover("news")} type="button"><Newspaper size={17} /></button>
        <div className="admin-topnav-menu-anchor admin-profile-anchor">
          <button className={`admin-topnav-btn admin-profile-trigger ${activePopover === "profile" ? "active" : ""}`} aria-label={labels.profile} aria-haspopup="dialog" aria-expanded={activePopover === "profile"} onClick={() => activatePopover("profile")} type="button"><span className="admin-topnav-avatar">{currentUser?.name?.charAt(0) || "A"}</span><ChevronDown size={13} /></button>
          {activePopover === "profile" && <ShellPopover active="profile" companyScoped={isTenant} language={language} onClose={() => setActivePopover(null)} onLogout={onLogout} onNavigate={go} user={currentUser} />}
        </div>
        {isTenant && <button className="admin-ai-button" onClick={() => go("admin-tenant-placeholder-ai")} type="button"><Sparkles size={15} />{labels.ai}</button>}
        <button className="admin-topnav-btn admin-icon-only" aria-label={isDarkMode ? (ar ? "الوضع الفاتح" : "Light mode") : (ar ? "الوضع الداكن" : "Dark mode")} onClick={onToggleDarkMode} type="button">{isDarkMode ? <Sun size={17} /> : <Moon size={17} />}</button>
        <button className="admin-topnav-btn admin-icon-only" aria-label={ar ? "English" : "العربية"} onClick={onLanguageChange} type="button"><Languages size={17} /></button>
        {["help", "inbox", "notifications", "news", "quickActions"].includes(activePopover) && <ShellPopover active={activePopover} companyScoped={isTenant} language={language} onClose={() => setActivePopover(null)} onLogout={onLogout} onNavigate={go} quickActions={quickActions} user={currentUser} />}
      </div>
    </header>
    <div className="admin-body">
      <button className="admin-mobile-menu" onClick={() => setMobileOpen(true)} type="button"><Menu size={17} />{labels.menu}</button>
      <aside className={`admin-sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="admin-sidebar-brand">
          {company?.logoUrl ? <img className="admin-logo-mark" src={company.logoUrl} alt={`${companyName} logo`} /> : <span className="admin-logo-mark">{companyMark}</span>}
          <div className="admin-sidebar-brand-copy"><strong>{companyName}</strong>{isSuperAdmin && isTenant && <small className="admin-sidebar-scope-badge">Scoped</small>}</div>
          <button className="admin-sidebar-collapse" type="button" aria-label={sidebarCollapsed ? labels.expand : labels.collapse} onClick={() => setSidebarCollapsed((value) => !value)}>{sidebarCollapsed ? (ar ? <ChevronLeft size={16} /> : <ChevronRight size={16} />) : <PanelLeftClose size={16} />}</button>
        </div>
        {isTenant && <button className={`admin-sidebar-quick-actions ${activePopover === "quickActions" ? "active" : ""}`} data-admin-popover-root type="button" onClick={() => activatePopover("quickActions")} aria-expanded={activePopover === "quickActions"}><span><Plus size={18} /></span><b>{labels.quickActions}</b><ChevronRight className="admin-sidebar-quick-chevron" size={15} /></button>}
        <nav className="admin-nav" aria-label={ar ? "تنقل لوحة الإدارة" : "Admin navigation"}>{sections.map((item) => renderNode(item))}</nav>
        {isTenant && <div className="admin-sidebar-footer">
          {company?.storefrontUrl && <a className="admin-sidebar-storefront-link" href={company.storefrontUrl} rel="noreferrer" target="_blank"><ExternalLink size={15} /><span>{labels.storefront}</span></a>}
          {isSuperAdmin && onReturnToPlatform && <button className="admin-sidebar-platform-link" onClick={onReturnToPlatform} type="button"><Building2 size={15} /><span>{labels.backToPlatform}</span></button>}
        </div>}
      </aside>
      {mobileOpen && <button aria-label={ar ? "إغلاق القائمة" : "Close menu"} className="admin-sidebar-backdrop" onClick={() => setMobileOpen(false)} type="button" />}
      <div className="admin-workspace">
        {!hideHeader && <div className="admin-page-header"><div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div></div>}
        <main className="admin-content">{children}</main>
      </div>
    </div>
  </section>;
}

export default AdminLayout;
