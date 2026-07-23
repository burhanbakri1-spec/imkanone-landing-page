import React from "react";
import {
  Activity,
  Archive,
  Boxes,
  Building2,
  ChevronDown,
  ClipboardList,
  Cuboid,
  ExternalLink,
  FileText,
  Film,
  FolderTree,
  Globe,
  Grid3X3,
  HandCoins,
  Images,
  Languages,
  MapPin,
  Moon,
  Package,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Star,
  Store,
  Sun,
  Tag,
  UserCircle,
  Users,
  WalletCards,
} from "lucide-react";
import CompanySwitcher from "./CompanySwitcher.jsx";
import { groupCompanyModules, normalizedModulePage } from "../utils/moduleRegistry.js";
import { canAccessAdminPage } from "../utils/roles.js";

const icons = {
  activity: Activity,
  brands: Tag,
  categories: FolderTree,
  companies: Building2,
  dashboard: Grid3X3,
  delivery: ShoppingCart,
  earnings: HandCoins,
  employees: Users,
  globe: Globe,
  inventory: Boxes,
  invoices: FileText,
  locations: MapPin,
  media: Images,
  orders: ClipboardList,
  products: Package,
  reports: ClipboardList,
  settings: Settings,
  texts: FileText,
  units: Cuboid,
  videos: Film,
  withdrawals: WalletCards,
};
const groupIcons = {
  catalog: Package,
  dashboard: Grid3X3,
  dropshipping: HandCoins,
  operations: ClipboardList,
  people: Users,
  settings: Settings,
  storefront: Store,
};
const groupLabels = {
  catalog: { en: "Catalog", ar: "الكتالوج" },
  dashboard: { en: "Main", ar: "الرئيسية" },
  dropshipping: { en: "Dropshipping", ar: "الدروبشيبينغ" },
  operations: { en: "Operations", ar: "العمليات" },
  people: { en: "People", ar: "الأشخاص" },
  settings: { en: "Configuration", ar: "الإعدادات" },
  storefront: { en: "Storefront", ar: "واجهة المتجر" },
};

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
  const companyName = company?.name || "Platform";
  const companyMark = companyName.slice(0, 2).toUpperCase();
  const activeKey = normalizedModulePage(activePage);
  const isSuperAdmin = (currentUser?.globalRole || currentUser?.role) === "super_admin";
  const isTenant = Boolean(company);
  const sections = React.useMemo(() => {
    if (!company && isSuperAdmin)
      return [
        {
          id: "platform",
          items: [
            { pageKey: "admin-platform-overview", label_en: "Overview", label_ar: "نظرة عامة", icon_key: "activity" },
            { pageKey: "admin-platform-companies", label_en: "Companies", label_ar: "الشركات", icon_key: "companies" },
            { pageKey: "admin-platform-domains", label_en: "Domains", label_ar: "النطاقات", icon_key: "globe" },
          ],
        },
      ];
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

  React.useEffect(() => {
    setOpenSections((current) => {
      let changed = false;
      const next = { ...current };
      sections.forEach((section) => {
        if (
          (section.items.some((item) => item.pageKey === activeKey) ||
            section.id === "dashboard") &&
          !next[section.id]
        ) {
          next[section.id] = true;
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [activeKey, sections]);

  const labels = {
    admin: language === "ar" ? "الإدارة" : "Admin",
    menu: language === "ar" ? "القائمة" : "Menu",
    signOut: language === "ar" ? "تسجيل الخروج" : "Sign Out",
    language: language === "ar" ? "English" : "العربية",
    darkMode: language === "ar" ? "الوضع الليلي" : "Dark mode",
    lightMode: language === "ar" ? "الوضع الفاتح" : "Light mode",
    storefront: language === "ar" ? "واجهة المتجر" : "Storefront",
    backToPlatform: language === "ar" ? "العودة إلى المنصة" : "Back to Platform",
  };

  const renderItem = (item) => {
    const ItemIcon = item.icon_key === "companies" ? Building2 : icons[item.icon_key] || Settings;
    return (
      <button
        className={`admin-nav-button ${activeKey === item.pageKey ? "active" : ""}`}
        key={item.module_key || item.pageKey}
        onClick={() => {
          onNavigate(item.pageKey);
          setMobileOpen(false);
        }}
        type="button"
      >
        <ItemIcon size={15} />
        {language === "ar" ? item.label_ar || item.label_en : item.label_en}
      </button>
    );
  };

  return (
    <section
      className={`admin-layout ${isDarkMode ? "admin-dark" : ""} ${isTenant ? "admin-tenant" : ""}`}
      dir={language === "ar" ? "rtl" : "ltr"}
    >
      <header className="admin-topnav">
        <div className="admin-topnav-left">
          <CompanySwitcher
            company={company}
            currentUser={currentUser}
            language={language}
            onSwitchCompany={onSwitchCompany}
            onReturnToPlatform={onReturnToPlatform}
          />
        </div>
        <div className="admin-topnav-right">
          <button
            className="admin-topnav-btn"
            aria-label={labels.language}
            onClick={onLanguageChange}
            type="button"
          >
            <Languages size={15} />
            <span>{language === "ar" ? "EN" : "AR"}</span>
          </button>
          <button
            className="admin-topnav-btn"
            aria-label={isDarkMode ? labels.lightMode : labels.darkMode}
            onClick={onToggleDarkMode}
            type="button"
          >
            {isDarkMode ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <div className="admin-topnav-user">
            <span className="admin-topnav-avatar">{currentUser?.name?.charAt(0) || "A"}</span>
            <div className="admin-topnav-user-info">
              <strong>{currentUser?.name || "admin"}</strong>
              <small>{currentUser?.role || "admin"}</small>
            </div>
          </div>
          <button className="admin-topnav-signout" onClick={onLogout} type="button">
            {labels.signOut}
          </button>
        </div>
      </header>

      <div className="admin-body">
        <button className="admin-mobile-menu" onClick={() => setMobileOpen(true)} type="button">
          <Archive size={16} />
          {labels.menu}
        </button>
        <aside className={`admin-sidebar ${mobileOpen ? "open" : ""}`}>
          <div className="admin-sidebar-brand">
            {company?.logoUrl ? (
              <img className="admin-logo-mark" src={company.logoUrl} alt={`${companyName} logo`} />
            ) : (
              <span className="admin-logo-mark">{companyMark}</span>
            )}
            <div>
              <strong>{companyName}</strong>
              {isSuperAdmin && isTenant && (
                <small className="admin-sidebar-scope-badge">Scoped</small>
              )}
            </div>
          </div>
          <nav className="admin-nav" aria-label="Admin navigation">
            {sections.map((section) => {
              const SectionIcon =
                section.id === "platform" ? Building2 : groupIcons[section.id] || Settings;
              const sectionActive = section.items.some((item) => item.pageKey === activeKey);
              const isOpen = openSections[section.id];
              const isSingle = section.items.length === 1 && section.id === "dashboard";
              const sectionLabel =
                section.id === "platform"
                  ? { en: "Platform", ar: "المنصة" }
                  : groupLabels[section.id] || { en: section.id, ar: section.id };
              return (
                <div className="admin-nav-group" key={section.id}>
                  {isSingle ? (
                    renderItem(section.items[0])
                  ) : (
                    <>
                      <button
                        className={`admin-nav-section ${sectionActive ? "active" : ""}`}
                        onClick={() =>
                          setOpenSections((current) => ({
                            ...current,
                            [section.id]: !current[section.id],
                          }))
                        }
                        type="button"
                      >
                        <span>
                          <SectionIcon size={15} />
                          {sectionLabel[language] || sectionLabel.en}
                        </span>
                        <ChevronDown className={`admin-nav-chevron-icon ${isOpen ? "open" : ""}`} size={13} />
                      </button>
                      {isOpen && (
                        <div className="admin-nav-items">{section.items.map(renderItem)}</div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </nav>

          {isTenant && company?.storefrontUrl && (
            <div className="admin-sidebar-footer">
              <a
                className="admin-sidebar-storefront-link"
                href={company.storefrontUrl}
                rel="noreferrer"
                target="_blank"
              >
                <ExternalLink size={14} />
                {labels.storefront}
              </a>
            </div>
          )}

          {isTenant && isSuperAdmin && onReturnToPlatform && (
            <div className="admin-sidebar-footer">
              <button className="admin-sidebar-platform-link" onClick={onReturnToPlatform} type="button">
                <Building2 size={14} />
                {labels.backToPlatform}
              </button>
            </div>
          )}
        </aside>
        {mobileOpen && (
          <button
            aria-label="Close menu"
            className="admin-sidebar-backdrop"
            onClick={() => setMobileOpen(false)}
            type="button"
          />
        )}
        <div className="admin-workspace">
          {!hideHeader && (
            <div className="admin-page-header">
              <div>
                <h1>{title}</h1>
                {subtitle && <p>{subtitle}</p>}
              </div>
            </div>
          )}
          <main className="admin-content">{children}</main>
        </div>
      </div>
    </section>
  );
}

export default AdminLayout;
