import React from "react";
import {
  Activity, Archive, Boxes, Building2, ChevronDown, ClipboardList, Cuboid,
  FileText, Film, FolderTree, Grid3X3, HandCoins, Images, Languages, MapPin,
  Moon, Package, Settings, ShieldCheck, ShoppingCart, Star, Store, Sun, Tag,
  UserCircle, Users, WalletCards,
} from "lucide-react";
import { fetchPlatformCompanies } from "../utils/platformCompaniesApi.js";
import { groupCompanyModules, normalizedModulePage } from "../utils/moduleRegistry.js";
import { canAccessAdminPage } from "../utils/roles.js";

const icons = {
  activity: Activity, brands: Tag, categories: FolderTree, dashboard: Grid3X3,
  delivery: ShoppingCart, earnings: HandCoins, employees: Users, inventory: Boxes,
  invoices: FileText, locations: MapPin, media: Images, orders: ClipboardList,
  products: Package, reports: ClipboardList, settings: Settings, texts: FileText,
  units: Cuboid, videos: Film, withdrawals: WalletCards,
};
const groupIcons = { catalog: Cuboid, dashboard: Grid3X3, dropshipping: HandCoins, operations: ClipboardList, people: Users, settings: Settings, storefront: Store };
const groupLabels = {
  catalog: { en: "Catalog", ar: "الكتالوج" }, dashboard: { en: "Dashboard", ar: "لوحة التحكم" },
  dropshipping: { en: "Dropshipping", ar: "الدروبشيبينغ" }, operations: { en: "Operations", ar: "العمليات" },
  people: { en: "People", ar: "الأشخاص" }, settings: { en: "Configuration", ar: "الإعدادات" },
  storefront: { en: "Storefront", ar: "واجهة المتجر" },
};

function AdminLayout({
  activePage, children, company, currentUser, language = "en", modules = [], onLogout,
  onNavigate, onLanguageChange, onReturnToPlatform, onSwitchCompany, subtitle, title,
  isDarkMode = false, onToggleDarkMode,
}) {
  const companyName = company?.name || "Platform";
  const companyMark = companyName.slice(0, 2).toUpperCase();
  const activeKey = normalizedModulePage(activePage);
  const isSuperAdmin = (currentUser?.globalRole || currentUser?.role) === "super_admin";
  const sections = React.useMemo(() => {
    if (!company && isSuperAdmin) return [{ id: "platform", items: [{ pageKey: "admin-platform-companies", label_en: "Companies", label_ar: "الشركات", icon_key: "companies" }] }];
    const grouped = groupCompanyModules(modules);
    return grouped
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => canAccessAdminPage(currentUser, item.pageKey)),
      }))
      .filter((section) => section.items.length > 0);
  }, [company, currentUser, isSuperAdmin, modules]);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [openSections, setOpenSections] = React.useState({});
  const [companies, setCompanies] = React.useState([]);

  React.useEffect(() => {
    setOpenSections((current) => {
      let changed = false;
      const next = { ...current };
      sections.forEach((section) => {
        if ((section.items.some((item) => item.pageKey === activeKey) || section.id === "dashboard") && !next[section.id]) {
          next[section.id] = true;
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [activeKey, sections]);

  React.useEffect(() => {
    if (!isSuperAdmin || !company || !onSwitchCompany) return;
    fetchPlatformCompanies().then(setCompanies).catch(() => setCompanies([]));
  }, [company?.id, isSuperAdmin, onSwitchCompany]);

  const labels = {
    admin: language === "ar" ? "الإدارة" : "Admin",
    menu: language === "ar" ? "القائمة" : "Menu",
    signOut: language === "ar" ? "تسجيل الخروج" : "Sign Out",
    returnPlatform: language === "ar" ? "العودة للمنصة" : "Return to platform",
    switchCompany: language === "ar" ? "تبديل الشركة" : "Switch company",
    language: language === "ar" ? "English" : "العربية",
    darkMode: language === "ar" ? "الوضع الليلي" : "Dark mode",
    lightMode: language === "ar" ? "الوضع الفاتح" : "Light mode",
  };

  return (
    <section className={`admin-layout ${isDarkMode ? "admin-dark" : ""}`} dir={language === "ar" ? "rtl" : "ltr"}>
      <button className="admin-mobile-menu" onClick={() => setMobileOpen(true)} type="button"><Archive size={16} />{labels.menu}</button>
      <aside className={`admin-sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="admin-sidebar-brand">
          {company?.logoUrl ? <img className="admin-logo-mark" src={company.logoUrl} alt={`${companyName} logo`} /> : <span className="admin-logo-mark">{companyMark}</span>}
          <div><strong>{companyName}</strong><small>{labels.admin}</small></div>
        </div>
        <nav className="admin-nav" aria-label="Admin navigation">
          {sections.map((section) => {
            const SectionIcon = section.id === "platform" ? Building2 : groupIcons[section.id] || Settings;
            const sectionActive = section.items.some((item) => item.pageKey === activeKey);
            const isOpen = openSections[section.id];
            const single = section.items.length === 1 && ["dashboard", "platform"].includes(section.id);
            const sectionLabel = section.id === "platform" ? { en: "Platform", ar: "المنصة" } : groupLabels[section.id] || { en: section.id, ar: section.id };
            const renderItem = (item) => {
              const ItemIcon = item.icon_key === "companies" ? Building2 : icons[item.icon_key] || Settings;
              return <button className={`admin-nav-button ${activeKey === item.pageKey ? "active" : ""}`} key={item.module_key || item.pageKey} onClick={() => { onNavigate(item.pageKey); setMobileOpen(false); }} type="button"><ItemIcon size={15} />{language === "ar" ? item.label_ar || item.label_en : item.label_en}</button>;
            };
            return <div className="admin-nav-group" key={section.id}>
              {single ? renderItem(section.items[0]) : <><button className={`admin-nav-section ${sectionActive ? "active" : ""}`} onClick={() => setOpenSections((current) => ({ ...current, [section.id]: !current[section.id] }))} type="button"><span><SectionIcon size={16} />{sectionLabel[language] || sectionLabel.en}</span><ChevronDown className={isOpen ? "open" : ""} size={15} /></button>{isOpen && <div className="admin-nav-items">{section.items.map(renderItem)}</div>}</>}
            </div>;
          })}
        </nav>
      </aside>
      {mobileOpen && <button aria-label="Close menu" className="admin-sidebar-backdrop" onClick={() => setMobileOpen(false)} type="button" />}
      <div className="admin-workspace">
        <header className="admin-topbar">
          <div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
          <div className="admin-userbar">
            {isSuperAdmin && company && <>
              <select aria-label={labels.switchCompany} onChange={(event) => event.target.value && onSwitchCompany?.(event.target.value)} value={company.id}>
                {companies.length ? companies.filter((item) => item.status === "active").map((item) => <option key={item.id} value={item.id}>{item.name}</option>) : <option value={company.id}>{company.name}</option>}
              </select>
              <button className="text-action" onClick={onReturnToPlatform} type="button">{labels.returnPlatform}</button>
            </>}
            <button className="admin-icon-button admin-language-button" aria-label={labels.language} onClick={onLanguageChange} type="button"><Languages size={15} /><span>{language === "ar" ? "EN" : "AR"}</span></button>
            <button className="admin-icon-button" aria-label={isDarkMode ? labels.lightMode : labels.darkMode} onClick={onToggleDarkMode} type="button">{isDarkMode ? <Sun size={15} /> : <Moon size={15} />}</button>
            <span className="admin-user-avatar">{currentUser?.name?.charAt(0) || "A"}</span>
            <div><strong>{currentUser?.name || "admin"}</strong><small>{currentUser?.role || "admin"}</small></div>
            <button className="admin-signout-button" onClick={onLogout} type="button">{labels.signOut}</button>
          </div>
        </header>
        <main className="admin-content">{children}</main>
      </div>
    </section>
  );
}

export default AdminLayout;
