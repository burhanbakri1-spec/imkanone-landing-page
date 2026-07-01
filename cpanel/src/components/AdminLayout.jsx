import React from "react";
import {
  Archive,
  Building2,
  Boxes,
  ChevronDown,
  ClipboardList,
  Cuboid,
  Film,
  FolderTree,
  Grid3X3,
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
} from "lucide-react";

const navSections = [
  {
    id: "platform",
    icon: Building2,
    label: { en: "Platform", ar: "المنصة" },
    roles: ["super_admin"],
    items: [{ key: "admin-platform-companies", icon: Building2, label: { en: "Companies", ar: "الشركات" } }],
  },
  {
    id: "dashboard",
    icon: Grid3X3,
    label: { en: "Dashboard", ar: "لوحة التحكم" },
    items: [{ key: "admin", icon: Grid3X3, label: { en: "Dashboard", ar: "لوحة التحكم" } }],
  },
  {
    id: "catalog",
    icon: Cuboid,
    label: { en: "Catalog", ar: "الكتالوج" },
    items: [
      { key: "admin-products", icon: Package, label: { en: "Products", ar: "المنتجات" } },
      { key: "admin-categories", icon: FolderTree, label: { en: "Categories", ar: "الأقسام" } },
      { key: "admin-brands", icon: Tag, label: { en: "Brands", ar: "العلامات التجارية" } },
    ],
  },
  {
    id: "storefront",
    icon: Store,
    label: { en: "Storefront", ar: "واجهة المتجر" },
    items: [
      { key: "admin-vlogs", icon: Film, label: { en: "Vlogs", ar: "الفيديوهات" } },
      { key: "admin-store-locator", icon: MapPin, label: { en: "Store Locator", ar: "مواقع المتاجر" } },
      { key: "admin-website-media", icon: Images, label: { en: "Website Media", ar: "صور الموقع" } },
    ],
  },
  {
    id: "operations",
    icon: ClipboardList,
    label: { en: "Operations", ar: "العمليات" },
    items: [
      { key: "admin-orders", icon: ShoppingCart, label: { en: "Orders", ar: "الطلبات" } },
      { key: "admin-reviews", icon: Star, label: { en: "Reviews", ar: "التقييمات" } },
      { key: "admin-inventory", icon: Boxes, label: { en: "Inventory", ar: "المخزون" } },
    ],
  },
  {
    id: "people",
    icon: Users,
    label: { en: "People", ar: "الأشخاص" },
    items: [
      { key: "admin-customers", icon: UserCircle, label: { en: "Customers", ar: "العملاء" } },
      { key: "admin-staff", icon: ShieldCheck, label: { en: "Staff", ar: "الموظفون" } },
    ],
  },
  {
    id: "configuration",
    icon: Settings,
    label: { en: "Configuration", ar: "الإعدادات" },
    items: [{ key: "admin-settings", icon: Settings, label: { en: "Settings", ar: "الإعدادات" } }],
  },
];

const childAliases = {
  "admin-products-new": "admin-products",
  "admin-categories-new": "admin-categories",
  "admin-brands-new": "admin-brands",
  "admin-vlogs-new": "admin-vlogs",
  "admin-store-locator-new": "admin-store-locator",
  "admin-staff-new": "admin-staff",
};

function localize(value, language) {
  return value?.[language] || value?.en || "";
}

function normalizedActive(activePage) {
  return childAliases[activePage] || activePage;
}

function AdminLayout({
  activePage,
  children,
  currentUser,
  language = "en",
  onLogout,
  onNavigate,
  onLanguageChange,
  subtitle,
  title,
  isDarkMode = false,
  onToggleDarkMode,
}) {
  const activeKey = normalizedActive(activePage);
  const visibleNavSections = React.useMemo(
    () => navSections.filter(
      (section) => !section.roles || section.roles.includes(currentUser?.role)
    ),
    [currentUser?.role]
  );
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [openSections, setOpenSections] = React.useState(() => {
    const defaults = {};
    visibleNavSections.forEach((section) => {
      defaults[section.id] = section.items.some((item) => item.key === activeKey) || section.id === "dashboard";
    });
    return defaults;
  });

  React.useEffect(() => {
    setOpenSections((current) => {
      const next = { ...current };
      visibleNavSections.forEach((section) => {
        if (section.items.some((item) => item.key === activeKey)) {
          next[section.id] = true;
        }
      });
      return next;
    });
  }, [activeKey, visibleNavSections]);

  const labels = {
    admin: language === "ar" ? "الإدارة" : "Admin",
    menu: language === "ar" ? "القائمة" : "Menu",
    signOut: language === "ar" ? "تسجيل الخروج" : "Sign Out",
    language: language === "ar" ? "English" : "العربية",
    darkMode: language === "ar" ? "الوضع الليلي" : "Dark mode",
    lightMode: language === "ar" ? "الوضع الفاتح" : "Light mode",
  };

  return (
    <section className={`admin-layout ${isDarkMode ? "admin-dark" : ""}`} dir={language === "ar" ? "rtl" : "ltr"}>
      <button className="admin-mobile-menu" onClick={() => setMobileOpen(true)} type="button">
        <Archive size={16} />
        {labels.menu}
      </button>

      <aside className={`admin-sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="admin-sidebar-brand">
          <span className="admin-logo-mark">EB</span>
          <div>
            <strong>EB Chemical</strong>
            <small>{labels.admin}</small>
          </div>
        </div>

        <nav className="admin-nav" aria-label="Admin navigation">
          {visibleNavSections.map((section) => {
            const SectionIcon = section.icon;
            const isSingle = section.items.length === 1 && section.id === "dashboard";
            const isOpen = openSections[section.id];
            const sectionActive = section.items.some((item) => item.key === activeKey);

            return (
              <div className="admin-nav-group" key={section.id}>
                {isSingle ? (
                  <button
                    className={`admin-nav-button ${sectionActive ? "active" : ""}`}
                    onClick={() => {
                      onNavigate(section.items[0].key);
                      setMobileOpen(false);
                    }}
                    type="button"
                  >
                    <SectionIcon size={16} />
                    {localize(section.label, language)}
                  </button>
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
                        <SectionIcon size={16} />
                        {localize(section.label, language)}
                      </span>
                      <ChevronDown className={isOpen ? "open" : ""} size={15} />
                    </button>
                    {isOpen && (
                      <div className="admin-nav-items">
                        {section.items.map((item) => {
                          const ItemIcon = item.icon;
                          return (
                            <button
                              className={`admin-nav-button ${activeKey === item.key ? "active" : ""}`}
                              key={item.key}
                              onClick={() => {
                                onNavigate(item.key);
                                setMobileOpen(false);
                              }}
                              type="button"
                            >
                              <ItemIcon size={15} />
                              {localize(item.label, language)}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      {mobileOpen && <button aria-label="Close menu" className="admin-sidebar-backdrop" onClick={() => setMobileOpen(false)} type="button" />}

      <div className="admin-workspace">
        <header className="admin-topbar">
          <div>
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <div className="admin-userbar">
            <button className="admin-icon-button admin-language-button" aria-label={labels.language} onClick={onLanguageChange} type="button">
              <Languages size={15} />
              <span>{language === "ar" ? "EN" : "AR"}</span>
            </button>
            <button className="admin-icon-button" aria-label={isDarkMode ? labels.lightMode : labels.darkMode} onClick={onToggleDarkMode} type="button">
              {isDarkMode ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <span className="admin-user-avatar">{currentUser?.name?.charAt(0) || "A"}</span>
            <div>
              <strong>{currentUser?.name || "admin"}</strong>
              <small>{currentUser?.role || "admin"}</small>
            </div>
            <button className="admin-signout-button" onClick={onLogout} type="button">
              {labels.signOut}
            </button>
          </div>
        </header>
        <main className="admin-content">{children}</main>
      </div>
    </section>
  );
}

export default AdminLayout;
