const label = (en, ar) => ({ en, ar });

const existing = (pageKey, en, ar, icon, options = {}) => ({
  id: pageKey,
  pageKey,
  label: label(en, ar),
  icon,
  existing: true,
  ...options,
});

const placeholder = (scope, slug, en, ar, icon) => ({
  id: `${scope}-${slug}`,
  pageKey: `admin-${scope}-placeholder-${slug.replaceAll("/", "-")}`,
  path: scope === "platform"
    ? `/admin/platform/coming-soon/${slug}`
    : `/admin/coming-soon/${slug}`,
  label: label(en, ar),
  icon,
  placeholder: true,
  scope,
});

const group = (id, en, ar, icon, children) => ({
  id,
  label: label(en, ar),
  icon,
  children,
});

export const platformNavigation = Object.freeze([
  existing("admin-platform-overview", "Overview", "نظرة عامة", "layoutDashboard"),
  existing("admin-platform-companies", "Companies", "الشركات", "building"),
  existing("admin-platform-domains", "Domains", "النطاقات", "globe"),
  placeholder("platform", "sites", "Sites", "المواقع", "panelsTopLeft"),
  placeholder("platform", "mobile-apps", "Mobile Apps", "تطبيقات الجوال", "smartphone"),
  group("platform-templates", "Templates", "القوالب", "layoutTemplate", [
    placeholder("platform", "templates/studio-editor", "Studio Editor Templates", "قوالب محرر الاستوديو", "palette"),
    placeholder("platform", "templates/wix-editor", "Website Editor Templates", "قوالب محرر المواقع", "panelTop"),
    placeholder("platform", "templates/yours", "Your Templates", "قوالبك", "folderHeart"),
  ]),
  placeholder("platform", "custom-apps", "Custom Apps", "التطبيقات المخصصة", "blocks"),
  group("platform-client-experience", "Client Experience", "تجربة العملاء", "briefcaseBusiness", [
    placeholder("platform", "client-experience/feedback", "Client Feedback", "ملاحظات العملاء", "messageSquareText"),
    placeholder("platform", "client-experience/kits", "Client Kits", "حزم العملاء", "packageOpen"),
    placeholder("platform", "client-experience/reports", "Client Reports", "تقارير العملاء", "chartNoAxesCombined"),
    placeholder("platform", "client-experience/crm-billing", "CRM & Client Billing", "إدارة وفوترة العملاء", "badgeDollarSign"),
  ]),
  placeholder("platform", "customer-care-tickets", "Customer Care Tickets", "تذاكر خدمة العملاء", "lifeBuoy"),
  placeholder("platform", "team", "Team", "الفريق", "users"),
  group("platform-settings", "Settings", "الإعدادات", "settings", [
    placeholder("platform", "settings/workspace", "Workspace Settings", "إعدادات مساحة العمل", "settings2"),
    placeholder("platform", "settings/business-info", "Business Info", "معلومات النشاط", "landmark"),
    placeholder("platform", "settings/notifications", "Notifications Preferences", "تفضيلات الإشعارات", "bellRing"),
    placeholder("platform", "settings/webhooks", "Webhooks", "خطافات الويب", "webhook"),
  ]),
]);

export const tenantNavigation = Object.freeze([
  existing("admin", "Home", "الرئيسية", "house", { requiresModule: true }),
  group("tenant-ai-agents", "AI Agents", "وكلاء الذكاء الاصطناعي", "sparkles", [
    placeholder("tenant", "ai-agents/personal-assistant", "Personal Assistant", "المساعد الشخصي", "bot"),
    placeholder("tenant", "ai-agents/marketing", "Marketing Agent", "وكيل التسويق", "megaphone"),
    placeholder("tenant", "ai-agents/design", "Design Agent", "وكيل التصميم", "palette"),
    placeholder("tenant", "ai-agents/front-desk", "Front Desk Agent", "وكيل الاستقبال", "conciergeBell"),
    placeholder("tenant", "ai-agents/smart-chat", "Smart Chat", "الدردشة الذكية", "messagesSquare"),
  ]),
  group("tenant-booking", "Booking Calendar", "تقويم الحجوزات", "calendarDays", [
    existing("admin-bookings-calendar", "Calendar", "التقويم", "calendar", { requiresModule: true }),
    existing("admin-bookings-list", "Booking List", "قائمة الحجوزات", "listChecks", { requiresModule: true }),
    existing("admin-bookings-work-schedule", "Work Schedule", "جدول العمل", "clock3", { requiresModule: true }),
    existing("admin-bookings-analytics", "Bookings Analytics", "تحليلات الحجوزات", "chartSpline", { requiresModule: true }),
  ]),
  group("tenant-sales", "Sales", "المبيعات", "shoppingBag", [
    existing("admin-orders", "Orders", "الطلبات", "shoppingCart", { requiresModule: true }),
    placeholder("tenant", "sales/subscriptions", "Subscriptions", "الاشتراكات", "refreshCcw"),
    placeholder("tenant", "sales/gift-card-sales", "Gift Card Sales", "مبيعات بطاقات الهدايا", "gift"),
    group("tenant-payments-finance", "Payments & Finances", "المدفوعات والشؤون المالية", "walletCards", [
      placeholder("tenant", "sales/payments/all", "All Payments", "كل المدفوعات", "creditCard"),
      placeholder("tenant", "sales/payments/receipts", "Receipts", "الإيصالات", "receiptText"),
    ]),
    group("tenant-sales-analytics", "Analytics", "التحليلات", "chartColumn", [
      placeholder("tenant", "sales/analytics/overview", "Sales Overview", "نظرة عامة على المبيعات", "chartNoAxesCombined"),
      placeholder("tenant", "sales/analytics/subscriptions", "Subscriptions", "الاشتراكات", "chartSpline"),
    ]),
    placeholder("tenant", "sales/abandoned-carts", "Abandoned Carts", "السلات المتروكة", "shoppingCart"),
  ]),
  group("tenant-catalog", "Catalog", "الكتالوج", "package", [
    existing("admin-products", "Products", "المنتجات", "package", { requiresModule: true }),
    existing("admin-categories", "Categories", "التصنيفات", "folderTree", { requiresModule: true }),
    existing("admin-brands", "Brands", "العلامات التجارية", "tags", { requiresModule: true }),
    existing("admin-product-settings", "Product Settings", "إعدادات المنتجات", "slidersHorizontal", { requiresModule: true }),
    existing("admin-inventory", "Inventory", "المخزون", "boxes", { requiresModule: true }),
    placeholder("tenant", "catalog/booking-services", "Booking Services", "خدمات الحجز", "calendarCheck"),
    placeholder("tenant", "catalog/gift-cards", "Gift Cards", "بطاقات الهدايا", "gift"),
    group("tenant-discounts", "Discounts", "الخصومات", "badgePercent", [
      placeholder("tenant", "catalog/discounts/coupons", "Coupons", "القسائم", "ticketPercent"),
      placeholder("tenant", "catalog/discounts/automatic", "Automatic Discounts", "الخصومات التلقائية", "wandSparkles"),
    ]),
    group("tenant-booking-channels", "Booking Channels", "قنوات الحجز", "waypoints", [
      placeholder("tenant", "catalog/booking-channels/integrations", "Booking Integrations", "تكاملات الحجز", "plugZap"),
      placeholder("tenant", "catalog/booking-channels/links", "Shareable Links", "روابط قابلة للمشاركة", "link"),
    ]),
  ]),
  group("tenant-video", "Video Library", "مكتبة الفيديو", "film", [
    existing("admin-vlogs", "Videos", "الفيديوهات", "video", { requiresModule: true }),
    placeholder("tenant", "video/live-stream", "Live Stream", "البث المباشر", "radioTower"),
    placeholder("tenant", "video/channels", "Channels", "القنوات", "galleryVerticalEnd"),
  ]),
  group("tenant-apps", "Apps", "التطبيقات", "blocks", [
    placeholder("tenant", "apps/manage", "Manage Apps", "إدارة التطبيقات", "appWindow"),
    placeholder("tenant", "apps/market", "App Market", "سوق التطبيقات", "store"),
  ]),
  group("tenant-site-mobile", "Site & Mobile App", "الموقع وتطبيق الجوال", "monitorSmartphone", [
    placeholder("tenant", "site/overview", "Website Overview", "نظرة عامة على الموقع", "panelsTopLeft"),
    placeholder("tenant", "site/website", "Website", "الموقع", "globe2"),
    placeholder("tenant", "site/speed", "Site Speed", "سرعة الموقع", "gauge"),
    placeholder("tenant", "site/security", "Uptime & Security", "التوفر والأمان", "shieldCheck"),
    placeholder("tenant", "site/mobile-app", "Mobile App", "تطبيق الجوال", "smartphone"),
    placeholder("tenant", "site/logo-brand", "Logo & Brand", "الشعار والهوية", "badgeCheck"),
    placeholder("tenant", "site/link-in-bio", "Link in Bio", "رابط السيرة", "link2"),
    existing("admin-store-locator", "Store Locator", "مواقع الفروع", "mapPin", { requiresModule: true }),
  ]),
  group("tenant-marketing", "Marketing", "التسويق", "megaphone", [
    placeholder("tenant", "marketing/seo-geo", "SEO & GEO", "تحسين البحث والظهور", "searchCheck"),
    placeholder("tenant", "marketing/google-ads", "Google Ads", "إعلانات Google", "badgeCent"),
    placeholder("tenant", "marketing/meta-ads", "Facebook & Instagram Ads", "إعلانات فيسبوك وإنستغرام", "badgeCent"),
    placeholder("tenant", "marketing/email", "Email Marketing", "التسويق بالبريد", "mail"),
    placeholder("tenant", "marketing/social", "Social Media Marketing", "التسويق الاجتماعي", "share2"),
    placeholder("tenant", "marketing/referrals", "Referral Program", "برنامج الإحالة", "usersRound"),
    placeholder("tenant", "marketing/google-business", "Google Business Profile", "ملف النشاط على Google", "mapPinned"),
  ]),
  group("tenant-getting-paid", "Getting Paid", "استلام المدفوعات", "circleDollarSign", [
    placeholder("tenant", "getting-paid/setup", "Connect & Setup", "الربط والإعداد", "cable"),
    placeholder("tenant", "getting-paid/pay-links", "Pay Links", "روابط الدفع", "link"),
    existing("admin-invoices", "Invoices", "الفواتير", "fileText", { requiresModule: true }),
    placeholder("tenant", "getting-paid/quotes", "Price Quotes", "عروض الأسعار", "notebookTabs"),
    placeholder("tenant", "getting-paid/proposals", "Proposals", "المقترحات", "files"),
    placeholder("tenant", "getting-paid/pos", "POS Checkout", "نقطة البيع", "scanLine"),
  ]),
  existing("admin-inbox", "Inbox", "البريد الوارد", "inbox", { requiresModule: true }),
  group("tenant-customers-leads", "Customers & Leads", "العملاء والعملاء المحتملون", "contactRound", [
    existing("admin-customers", "Contacts", "جهات الاتصال", "contact", { requiresModule: true }),
    existing("admin-forms", "Forms & Submissions", "النماذج والطلبات", "listTodo", { requiresModule: true }),
    existing("admin-meetings", "Meetings", "الاجتماعات", "video", { requiresModule: true }),
    existing("admin-pipelines", "Pipelines", "مسارات العملاء", "gitBranch", { requiresModule: true }),
    existing("admin-community", "Community", "المجتمع", "users", { requiresModule: true }),
    existing("admin-loyalty", "Loyalty Program", "برنامج الولاء", "heartHandshake", { requiresModule: true }),
    existing("admin-reviews", "Reviews", "المراجعات", "star", { requiresModule: true }),
    existing("admin-staff", "Employees", "الموظفون", "users", { requiresModule: true }),
  ]),
  group("tenant-analytics", "Analytics", "التحليلات", "chartNoAxesCombined", [
    existing("admin-analytics-highlights", "Highlights", "أبرز النتائج", "sparkles", { requiresModule: true }),
    existing("admin-analytics-realtime", "Real-time", "الوقت الفعلي", "radio", { requiresModule: true }),
    existing("admin-analytics-traffic", "Traffic", "الزيارات", "mousePointerClick", { requiresModule: true }),
    existing("admin-analytics-behavior", "Behavior", "السلوك", "route", { requiresModule: true }),
    existing("admin-analytics-marketing", "Marketing", "التسويق", "megaphone", { requiresModule: true }),
    existing("admin-analytics-session-recordings", "Session Recordings", "تسجيلات الجلسات", "screenShare", { requiresModule: true }),
    existing("admin-analytics-insights", "Insights", "الرؤى", "lightbulb", { requiresModule: true }),
    existing("admin-analytics-benchmarks", "Benchmarks", "المعايير", "scale", { requiresModule: true }),
    existing("admin-analytics-reports", "All Reports", "كل التقارير", "files", { requiresModule: true }),
  ]),
  existing("admin-automations", "Automations", "الأتمتة", "workflow", { requiresModule: true }),
  existing("admin-settings", "Settings", "الإعدادات", "settings", { requiresModule: true }),
  group("tenant-website-content", "Website Content", "محتوى الموقع", "panelsTopLeft", [
    existing("admin-website-content-cms", "CMS", "نظام إدارة المحتوى", "database", { requiresModule: true }),
    existing("admin-website-content-multilingual", "Multilingual", "متعدد اللغات", "languages", { requiresModule: true }),
  ]),
  group("tenant-developer-tools", "Developer Tools", "أدوات المطور", "codeXml", [
    group("tenant-logging-tools", "Logging Tools", "أدوات التسجيل", "activity", [
      existing("admin-developer-site-logs", "Wix Logs", "سجلات الموقع", "activity", { requiresModule: true }),
      existing("admin-developer-advanced-log-tools", "Advanced Log Tools", "أدوات السجل المتقدمة", "settings", { requiresModule: true }),
    ]),
    existing("admin-developer-monitoring", "Monitoring", "المراقبة", "chartNoAxesCombined", { requiresModule: true }),
    existing("admin-developer-secrets-manager", "Secrets Manager", "مدير الأسرار", "blocks", { requiresModule: true }),
    existing("admin-developer-triggered-emails", "Triggered Emails", "رسائل البريد المشغلة", "inbox", { requiresModule: true }),
  ]),
  existing("admin-site-editor", "Edit Site", "تحرير الموقع", "pencil", {
    newTab: true,
    path: "/admin/site-editor",
  }),
]);

export const utilityNavigation = Object.freeze([
  placeholder("tenant", "upgrade", "Upgrade", "ترقية", "zap"),
  placeholder("tenant", "ai", "AI", "الذكاء الاصطناعي", "sparkles"),
  placeholder("tenant", "help/chat", "Support Chat", "دردشة الدعم", "messageCircle"),
  placeholder("tenant", "news/all", "All Updates", "كل التحديثات", "newspaper"),
  placeholder("tenant", "news/roadmap", "Product Roadmap", "خارطة طريق المنتج", "route"),
  placeholder("platform", "help/chat", "Support Chat", "دردشة الدعم", "messageCircle"),
  placeholder("platform", "news/all", "All Updates", "كل التحديثات", "newspaper"),
  placeholder("platform", "news/roadmap", "Product Roadmap", "خارطة طريق المنتج", "route"),
]);

const routedTenantItems = Object.freeze([
  existing("admin-website-media", "Media", "الوسائط", "images", { requiresModule: true }),
  existing("admin-activity-log", "Activity Log", "سجل النشاط", "activity", { requiresModule: true }),
  existing("admin-unit-creator", "Unit Creator", "منشئ الوحدات", "cuboid", { requiresModule: true }),
]);

function flatten(items) {
  return items.flatMap((item) => [item, ...(item.children ? flatten(item.children) : [])]);
}

export const allNavigationItems = Object.freeze([
  ...flatten(platformNavigation),
  ...flatten(tenantNavigation),
  ...routedTenantItems,
  ...utilityNavigation,
]);

export const placeholderItems = Object.freeze(allNavigationItems.filter((item) => item.placeholder));
export const placeholderPageKeys = Object.freeze(placeholderItems.map((item) => item.pageKey));
export const placeholderPagePaths = Object.freeze(Object.fromEntries(
  placeholderItems.map((item) => [item.pageKey, item.path]),
));

export function getNavigationItem(pageKey) {
  return allNavigationItems.find((item) => item.pageKey === pageKey) || null;
}

export function isNavigationPlaceholderPage(pageKey) {
  return placeholderPageKeys.includes(pageKey);
}

export function isPlatformPlaceholderPage(pageKey) {
  return getNavigationItem(pageKey)?.scope === "platform";
}

export function navigationContainsPage(item, pageKey) {
  if (item.pageKey === pageKey) return true;
  return Boolean(item.children?.some((child) => navigationContainsPage(child, pageKey)));
}

export function toggleExclusiveGroup(currentId, requestedId) {
  return currentId === requestedId ? null : requestedId;
}

export function toggleExclusivePopover(currentId, requestedId) {
  return currentId === requestedId ? null : requestedId;
}
