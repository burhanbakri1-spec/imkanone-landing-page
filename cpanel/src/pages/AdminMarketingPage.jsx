import React from "react";
import {
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ExternalLink,
  Facebook,
  FileSearch,
  Gift,
  Globe2,
  Image,
  Instagram,
  LayoutTemplate,
  Lightbulb,
  Link2,
  Linkedin,
  ListChecks,
  Mail,
  MapPinned,
  Megaphone,
  MessageCircle,
  MoreHorizontal,
  MousePointerClick,
  Plus,
  Search,
  SearchCheck,
  Send,
  Settings,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Target,
  Users,
  WandSparkles,
  X,
  Youtube,
} from "lucide-react";
import AdminLayout from "../components/AdminLayout.jsx";
import { AdminUnderDevelopmentContent } from "./AdminPlaceholderPage.jsx";
import {
  canViewMarketing,
  confirmedMarketingContext,
  marketingDirection,
  metaSalesAvailable,
  resolveMarketingDestination,
} from "../utils/marketing.js";

const pageMeta = {
  "admin-tenant-placeholder-marketing-seo-geo": ["SEO & GEO", "Improve discoverability when verified search tools are connected.", "تحسين البحث والظهور", "حسّن قابلية الاكتشاف عند ربط أدوات بحث موثقة."],
  "admin-tenant-placeholder-marketing-google-ads": ["Google Ads", "Reach customers through supported Google advertising tools.", "إعلانات Google", "صِل إلى العملاء من خلال أدوات إعلانات Google المدعومة."],
  "admin-tenant-placeholder-marketing-meta-ads": ["Facebook & Instagram Ads", "Prepare campaigns across supported Meta channels.", "إعلانات فيسبوك وإنستغرام", "جهّز الحملات عبر قنوات Meta المدعومة."],
  "admin-tenant-placeholder-marketing-email": ["Email Marketing", "Create and manage verified email campaigns.", "التسويق بالبريد", "أنشئ وأدر حملات البريد الموثقة."],
  "admin-tenant-placeholder-marketing-social": ["Social Media Marketing", "Plan and manage confirmed social content.", "التسويق عبر التواصل الاجتماعي", "خطط وأدر محتوى التواصل المؤكد."],
  "admin-tenant-placeholder-marketing-referrals": ["Referral Program", "Turn customer recommendations into a supported growth channel.", "برنامج الإحالة", "حوّل توصيات العملاء إلى قناة نمو مدعومة."],
  "admin-tenant-placeholder-marketing-google-business": ["Google Business Profile", "Manage business visibility when a verified profile is connected.", "ملف النشاط التجاري على Google", "أدر ظهور النشاط عند ربط ملف موثق."],
};

function bi(language, en, ar) {
  return language === "ar" ? ar : en;
}

function labels(language) {
  return language === "ar"
    ? { available: "غير متاح", connect: "ربط", create: "إنشاء", learn: "معرفة المزيد", notConnected: "غير متصل", setup: "بدء الإعداد", unavailable: "لا تتوفر بيانات موثقة لهذه الميزة حالياً." }
    : { available: "Unavailable", connect: "Connect", create: "Create", learn: "Learn more", notConnected: "Not connected", setup: "Start setup", unavailable: "No verified data is currently available for this feature." };
}

function PageHeader({ actions, description, title }) {
  return <header className="marketing-page-header" data-marketing-page-header><div><h1>{title}</h1><p>{description}</p></div>{actions && <div className="marketing-header-actions">{actions}</div>}</header>;
}

function StatusPill({ children }) {
  return <span className="marketing-status-pill">{children}</span>;
}

function MarketingIllustration({ type }) {
  return <div aria-hidden="true" className={`marketing-illustration marketing-illustration-${type}`}><span className="marketing-illustration-orbit"/><span className="marketing-illustration-window"><i/><b/><em/><small/></span><span className="marketing-illustration-badge"/></div>;
}

function UnsupportedDialog({ onClose, t }) {
  React.useEffect(() => {
    const close = (event) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [onClose]);
  return <div className="marketing-modal-backdrop" onMouseDown={onClose} role="presentation"><div aria-modal="true" className="marketing-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog"><button aria-label="Close" onClick={onClose} type="button"><X size={18}/></button><AdminUnderDevelopmentContent t={t}/></div></div>;
}

function SeoPage({ context, go, language, l, unsupported }) {
  const aiPlatforms = ["ChatGPT", "Gemini", "Perplexity", "Claude"];
  const tools = [
    [ListChecks, "SEO checklist", "قائمة تهيئة البحث"], [Settings, "SEO settings", "إعدادات البحث"], [FileSearch, "Site inspection", "فحص الموقع"], [Link2, "URL redirects", "إعادة توجيه الروابط"], [BadgeCheck, "Site verification", "التحقق من الموقع"], [Globe2, "Sitemaps", "خرائط الموقع"], [ShieldCheck, "robots.txt", "robots.txt"], [Bot, "llms.txt", "llms.txt"], [Sparkles, "AI search visibility", "الظهور في بحث الذكاء"], [MapPinned, "Google Business Profile", "ملف النشاط على Google"],
  ];
  return <div className="marketing-seo-page">
    <section className="marketing-seo-assistant"><header><div><span className="marketing-section-icon"><SearchCheck size={22}/></span><div><h2>{bi(language, "SEO Assistant", "مساعد تحسين البحث")}</h2><p>{context.storefrontUrl || l.unavailable}</p></div></div><button className="admin-primary-button" onClick={unsupported} type="button">{l.setup}</button></header><div className="marketing-seo-summary"><div className="marketing-seo-progress"><strong>—</strong><span>{l.available}</span></div>{[["Issues", "المشكلات"], ["Recommendations", "التوصيات"], ["Completed tasks", "المهام المكتملة"]].map(([en, ar]) => <article key={en}><strong>—</strong><span>{bi(language, en, ar)}</span><StatusPill>{l.available}</StatusPill></article>)}</div></section>
    <div className="marketing-seo-performance-grid"><section className="marketing-search-console"><header><div><h2>Google Search Console</h2><p>{bi(language, "Search performance", "أداء البحث")}</p></div><StatusPill>{l.notConnected}</StatusPill></header><div className="marketing-empty-chart"><BarChart3 size={45}/><strong>{l.unavailable}</strong><p>{bi(language, "Connect a verified Search Console property to view performance.", "اربط موقعاً موثقاً في Search Console لعرض الأداء.")}</p><button onClick={unsupported} type="button">{l.connect}</button></div></section><section className="marketing-ai-visibility"><header><div><h2>{bi(language, "Generative AI visibility", "الظهور في الذكاء التوليدي")}</h2><p>{bi(language, "Monitor verified brand mentions and user queries.", "راقب إشارات العلامة واستعلامات المستخدم الموثقة.")}</p></div><StatusPill>{l.available}</StatusPill></header><div>{aiPlatforms.map((platform) => <span key={platform}><Bot size={17}/><strong>{platform}</strong><small>{l.notConnected}</small></span>)}</div><footer><Search size={17}/><span>{bi(language, "User-query visibility", "الظهور في استعلامات المستخدم")}</span><StatusPill>{l.available}</StatusPill></footer></section></div>
    <section className="marketing-learning-panel"><div><Lightbulb size={28}/><div><h2>{bi(language, "Grow your search knowledge", "طوّر معرفتك بالبحث")}</h2><p>{bi(language, "Explore guidance for search-ready content and site structure.", "استكشف إرشادات المحتوى وبنية الموقع الجاهزة للبحث.")}</p></div></div><button onClick={unsupported} type="button">{l.learn}<ArrowUpRight size={15}/></button></section>
    <section className="marketing-tools-section"><header><h2>{bi(language, "Tools and settings", "الأدوات والإعدادات")}</h2><p>{bi(language, "Open supported website tools or continue through setup.", "افتح أدوات الموقع المدعومة أو تابع الإعداد.")}</p></header><div className="marketing-tools-grid">{tools.map(([Icon, en, ar], index) => <button key={en} onClick={() => index === 1 ? go("companySettings", unsupported) : index === 2 ? go("siteOverview", unsupported) : unsupported()} type="button"><span><Icon size={20}/></span><strong>{bi(language, en, ar)}</strong><small>{index < 2 ? bi(language, "Website tool", "أداة موقع") : l.available}</small><ChevronRight size={17}/></button>)}</div></section>
  </div>;
}

function GoogleAdsPage({ context, language, l, unsupported }) {
  return <section className="marketing-google-ads-hero"><div className="marketing-onboarding-copy"><span className="marketing-platform-label"><strong>G</strong>Google Ads</span><h2>{bi(language, `Grow ${context.companyName || "your business"} with Google Ads`, `نمِّ ${context.companyName || "نشاطك"} باستخدام إعلانات Google`)}</h2><p>{bi(language, "Create supported advertising campaigns that help customers discover your business across Google.", "أنشئ حملات إعلانية مدعومة تساعد العملاء على اكتشاف نشاطك عبر Google.")}</p><ul>{[[Target, "Reach people searching for what you offer", "صِل إلى الباحثين عما تقدمه"], [MousePointerClick, "Guide customers to your website", "وجّه العملاء إلى موقعك"], [BarChart3, "Review verified results when connected", "راجع النتائج الموثقة عند الربط"]].map(([Icon, en, ar]) => <li key={en}><span><Icon size={18}/></span>{bi(language, en, ar)}</li>)}</ul><button className="admin-primary-button" onClick={unsupported} type="button">{l.setup}</button><small>{bi(language, "Account connection and campaign creation require a supported Google Ads setup. No account is currently confirmed.", "يتطلب ربط الحساب وإنشاء الحملات إعداد Google Ads مدعوماً. لا يوجد حساب مؤكد حالياً.")}</small></div><div className="marketing-ad-preview"><MarketingIllustration type="google"/><div className="marketing-ad-card"><span>{bi(language, "Sponsored preview", "معاينة إعلان")}</span><strong>{context.companyName || bi(language, "Your business", "نشاطك")}</strong><p>{context.storefrontUrl || l.unavailable}</p><i/><i/></div></div></section>;
}

function MetaAdsPage({ context, language, l, unsupported }) {
  const sales = metaSalesAvailable();
  return <div className="marketing-meta-page"><section className="marketing-meta-hero"><div><span className="marketing-platform-label"><Facebook size={18}/>Meta Business</span><h2>{bi(language, `Advertise ${context.companyName || "your business"} on Facebook and Instagram`, `أعلن عن ${context.companyName || "نشاطك"} على فيسبوك وإنستغرام`)}</h2><p>{bi(language, "Choose a campaign goal after the required business connections are verified.", "اختر هدف الحملة بعد التحقق من اتصالات النشاط المطلوبة.")}</p></div><MarketingIllustration type="meta"/></section><section className="marketing-meta-goals"><header><h2>{bi(language, "Choose a campaign goal", "اختر هدف الحملة")}</h2><StatusPill>{l.notConnected}</StatusPill></header><div><button onClick={unsupported} type="button"><span><Users size={25}/></span><strong>{bi(language, "Lead generation", "جمع العملاء المحتملين")}</strong><p>{bi(language, "Collect customer interest after connecting a supported Meta account.", "اجمع اهتمام العملاء بعد ربط حساب Meta مدعوم.")}</p><small>{l.setup}</small></button><button aria-disabled={!sales} className={!sales ? "is-disabled" : ""} disabled={!sales} onClick={unsupported} type="button"><span><ShoppingBag size={25}/></span><strong>{bi(language, "Sales", "المبيعات")}</strong><p>{bi(language, "Requires verified store, catalog, payment, pixel, and Meta connections.", "يتطلب متجراً وكتالوجاً ودفعاً وبيكسل واتصال Meta موثقاً.")}</p><small>{l.available}</small></button></div></section><section className="marketing-meta-requirements"><div><ShieldCheck size={25}/><div><h2>{bi(language, "Connection required", "يلزم الربط")}</h2><p>{bi(language, "No Facebook account, Instagram account, pixel, catalog, or payment method is confirmed for this company.", "لا يوجد حساب فيسبوك أو إنستغرام أو بيكسل أو كتالوج أو وسيلة دفع مؤكدة لهذه الشركة.")}</p></div></div><button onClick={unsupported} type="button">{l.connect}</button><footer>{bi(language, "Campaign creation is subject to supported Meta setup and applicable platform terms.", "يخضع إنشاء الحملات لإعداد Meta المدعوم وشروط المنصة السارية.")}</footer></section></div>;
}

function EmailPage({ language, l, unsupported }) {
  const templates = [[Megaphone, "Announcement", "إعلان"], [Gift, "Promotion", "عرض ترويجي"], [Mail, "Newsletter", "نشرة بريدية"], [Sparkles, "Product story", "قصة منتج"]];
  return <div className="marketing-email-page"><section className="marketing-email-banner"><span><WandSparkles size={24}/></span><div><h2>{bi(language, "Set up email marketing", "إعداد التسويق بالبريد")}</h2><p>{bi(language, "Connect a supported sender and campaign service before sending email.", "اربط مرسلاً وخدمة حملات مدعومة قبل إرسال البريد.")}</p></div><button onClick={unsupported} type="button">{l.connect}</button></section><section className="marketing-template-section"><header><div><h2>{bi(language, "Start with a campaign template", "ابدأ بقالب حملة")}</h2><p>{bi(language, "Choose a design direction. These examples are not saved campaigns.", "اختر اتجاهاً للتصميم. هذه الأمثلة ليست حملات محفوظة.")}</p></div><button onClick={unsupported} type="button">{bi(language, "View templates", "عرض القوالب")}</button></header><div>{templates.map(([Icon, en, ar], index) => <button key={en} onClick={unsupported} type="button"><span className={`marketing-template-art art-${index}`}><Icon size={30}/></span><strong>{bi(language, en, ar)}</strong><small>{bi(language, "Template example", "مثال قالب")}</small></button>)}</div></section><section className="marketing-email-campaigns"><header><div><h2>{bi(language, "Your email campaigns", "حملاتك البريدية")}</h2><p>{bi(language, "Campaign records appear here only from a verified tenant source.", "تظهر سجلات الحملات هنا فقط من مصدر مستأجر موثق.")}</p></div><div className="marketing-email-filters"><button type="button"><Search size={16}/>{bi(language, "Search", "بحث")}</button><button type="button">{bi(language, "All statuses", "كل الحالات")}<ChevronDown size={15}/></button></div></header><div className="marketing-email-empty"><Mail size={46}/><h3>{bi(language, "No email campaigns", "لا توجد حملات بريدية")}</h3><p>{l.unavailable}</p><button onClick={unsupported} type="button">{l.create}</button></div></section><div className="marketing-email-info-grid">{[[BarChart3, "Monthly balance", "الرصيد الشهري"], [Send, "Sender details", "بيانات المرسل"], [WandSparkles, "Automated emails", "الرسائل الآلية"], [Bot, "AI email help", "مساعدة البريد بالذكاء"]].map(([Icon, en, ar]) => <article key={en}><span><Icon size={21}/></span><h3>{bi(language, en, ar)}</h3><StatusPill>{l.available}</StatusPill><p>{l.unavailable}</p><button onClick={unsupported} type="button">{l.setup}</button></article>)}</div><section className="marketing-quick-links"><strong>{bi(language, "Quick links", "روابط سريعة")}</strong>{[bi(language, "Sender setup", "إعداد المرسل"), bi(language, "Automation", "الأتمتة"), bi(language, "Email guidance", "إرشادات البريد")].map((item) => <button key={item} onClick={unsupported} type="button">{item}<ArrowUpRight size={14}/></button>)}</section></div>;
}

function SocialPage({ language, l, unsupported }) {
  const [tab, setTab] = React.useState("create");
  const platforms = [[Facebook, "Facebook"], [Instagram, "Instagram"], [Youtube, "YouTube"], [Linkedin, "LinkedIn"], [X, "X"]];
  return <div className="marketing-social-page"><section className="marketing-social-accounts"><div><h2>{bi(language, "Connected accounts", "الحسابات المتصلة")}</h2><p>{bi(language, "Only verified tenant connections appear as connected.", "تظهر اتصالات المستأجر الموثقة فقط كحسابات متصلة.")}</p></div><div>{platforms.map(([Icon, name]) => <span key={name}><Icon size={17}/><strong>{name}</strong><small>{l.notConnected}</small></span>)}</div><button onClick={unsupported} type="button">{l.connect}</button></section><div className="marketing-social-tabs" role="tablist"><button aria-selected={tab === "create"} onClick={() => setTab("create")} role="tab" type="button">{bi(language, "Create & Publish", "إنشاء ونشر")}</button><button aria-selected={tab === "posts"} onClick={() => setTab("posts")} role="tab" type="button">{bi(language, "Your Social Posts", "منشوراتك الاجتماعية")}</button></div>{tab === "create" ? <section className="marketing-social-planner" role="tabpanel"><div><span className="marketing-platform-label"><Share2 size={18}/>{bi(language, "Social planner", "مخطط التواصل")}</span><h2>{bi(language, "Plan content across your channels", "خطط للمحتوى عبر قنواتك")}</h2><p>{bi(language, "Connect a supported account before creating or publishing posts.", "اربط حساباً مدعوماً قبل إنشاء المنشورات أو نشرها.")}</p><button className="admin-primary-button" onClick={unsupported} type="button"><Plus size={16}/>{bi(language, "Create Post", "إنشاء منشور")}</button></div><div className="marketing-planner-visual"><div className="marketing-planner-calendar"><header><i/><i/><i/><i/><i/><i/><i/></header>{Array.from({ length: 28 }, (_, index) => <span key={index}>{index === 10 || index === 18 ? <em/> : null}</span>)}</div></div></section> : <section className="marketing-social-posts" role="tabpanel"><header><div className="marketing-social-filters"><button type="button"><Search size={16}/>{bi(language, "Search posts", "بحث المنشورات")}</button><button type="button">{bi(language, "All channels", "كل القنوات")}<ChevronDown size={15}/></button><button type="button">{bi(language, "All statuses", "كل الحالات")}<ChevronDown size={15}/></button></div></header><div className="marketing-posts-table"><div className="marketing-posts-table-head"><span>{bi(language, "Post", "المنشور")}</span><span>{bi(language, "Channel", "القناة")}</span><span>{bi(language, "Status", "الحالة")}</span><span>{bi(language, "Date", "التاريخ")}</span><span/></div><div className="marketing-social-empty"><Share2 size={46}/><h3>{bi(language, "No social posts", "لا توجد منشورات")}</h3><p>{l.unavailable}</p><button onClick={unsupported} type="button">{bi(language, "Create your first post", "أنشئ منشورك الأول")}</button></div></div></section>}</div>;
}

function ReferralPage({ language, l, unsupported }) {
  return <div className="marketing-referral-page"><div className="marketing-referral-banner"><Sparkles size={20}/><span>{bi(language, "Referral tools are not enabled for this company.", "أدوات الإحالة غير مفعلة لهذه الشركة.")}</span><StatusPill>{l.available}</StatusPill></div><section className="marketing-referral-hero"><div className="marketing-onboarding-copy"><span className="marketing-platform-label"><Users size={18}/>{bi(language, "Referral Program", "برنامج الإحالة")}</span><h2>{bi(language, "Grow through customer recommendations", "نمِّ نشاطك عبر توصيات العملاء")}</h2><p>{bi(language, "Prepare a referral experience that can reward customers after a supported program is connected.", "جهّز تجربة إحالة يمكنها مكافأة العملاء بعد ربط برنامج مدعوم.")}</p><ul>{[[Gift, "Flexible reward setup", "إعداد مكافآت مرن"], [Users, "Customer sharing experience", "تجربة مشاركة العملاء"], [BarChart3, "Verified reporting when supported", "تقارير موثقة عند الدعم"]].map(([Icon, en, ar]) => <li key={en}><span><Icon size={18}/></span>{bi(language, en, ar)}</li>)}</ul><div className="marketing-dual-actions"><button className="admin-primary-button" onClick={unsupported} type="button">{l.setup}</button><button className="secondary-action" onClick={unsupported} type="button">{l.learn}</button></div></div><div className="marketing-referral-preview"><MarketingIllustration type="referral"/><div className="marketing-referral-card"><Gift size={25}/><strong>{bi(language, "Share. Refer. Reward.", "شارك. أحِل. كافئ.")}</strong><i/><i/><button type="button">{bi(language, "Preview", "معاينة")}</button></div></div></section></div>;
}

function GoogleBusinessPage({ context, language, l, unsupported }) {
  return <section className="marketing-business-hero"><div className="marketing-onboarding-copy"><span className="marketing-platform-label"><MapPinned size={18}/>Google Business Profile</span><h2>{bi(language, `Help customers find ${context.companyName || "your business"}`, `ساعد العملاء في العثور على ${context.companyName || "نشاطك"}`)}</h2><p>{bi(language, "Connect a verified business profile to manage supported listing information from this workspace.", "اربط ملف نشاط موثقاً لإدارة معلومات القائمة المدعومة من مساحة العمل.")}</p><ul>{[[Search, "Improve verified search visibility", "حسّن الظهور الموثق في البحث"], [MapPinned, "Manage confirmed business details", "أدر بيانات النشاط المؤكدة"], [MessageCircle, "Respond when review data is connected", "تفاعل عند ربط بيانات المراجعات"]].map(([Icon, en, ar]) => <li key={en}><span><Icon size={18}/></span>{bi(language, en, ar)}</li>)}</ul><button className="admin-primary-button" onClick={unsupported} type="button">{l.connect}</button><small>{bi(language, "No Google account, profile, Maps listing, location, or reviews are currently confirmed.", "لا يوجد حالياً حساب Google أو ملف نشاط أو قائمة خرائط أو موقع أو مراجعات مؤكدة.")}</small></div><div className="marketing-business-preview"><div className="marketing-business-phone"><span/><div className="marketing-business-map"><i/><i/><i/><MapPinned size={34}/></div><div className="marketing-business-card">{context.logoUrl ? <img alt="" src={context.logoUrl}/> : <span>{(context.companyName || "?").slice(0, 2).toUpperCase()}</span>}<strong>{context.companyName || bi(language, "Your business", "نشاطك")}</strong><small>{l.notConnected}</small><i/><i/></div></div></div></section>;
}

export default function AdminMarketingPage({ activePage, company, currentUser, language = "en", modules = [], onNavigate, t, ...layout }) {
  const [showUnsupported, setShowUnsupported] = React.useState(false);
  const l = labels(language);
  const meta = pageMeta[activePage] || pageMeta["admin-tenant-placeholder-marketing-seo-geo"];
  const title = language === "ar" ? meta[2] : meta[0];
  const description = language === "ar" ? meta[3] : meta[1];
  const context = confirmedMarketingContext(company);
  const unsupported = () => setShowUnsupported(true);
  const go = (action, fallback = unsupported) => {
    const page = resolveMarketingDestination(action, { currentUser, modules });
    if (page) onNavigate(page); else fallback();
  };
  const canView = canViewMarketing(currentUser, company);

  function actions() {
    if (activePage === "admin-tenant-placeholder-marketing-email") return <><button className="secondary-action" onClick={unsupported} type="button">{bi(language, "View Plan", "عرض الخطة")}</button><button className="admin-primary-button" onClick={unsupported} type="button"><Plus size={16}/>{bi(language, "Create Email", "إنشاء بريد")}</button></>;
    if (activePage === "admin-tenant-placeholder-marketing-social") return <button className="admin-primary-button" onClick={unsupported} type="button"><Plus size={16}/>{bi(language, "Create Post", "إنشاء منشور")}</button>;
    return null;
  }

  function content() {
    if (!canView) return <section className="marketing-access-denied"><ShieldCheck size={35}/><h2>{bi(language, "Access denied", "الوصول مرفوض")}</h2></section>;
    switch (activePage) {
      case "admin-tenant-placeholder-marketing-seo-geo": return <SeoPage context={context} go={go} language={language} l={l} unsupported={unsupported}/>;
      case "admin-tenant-placeholder-marketing-google-ads": return <GoogleAdsPage context={context} language={language} l={l} unsupported={unsupported}/>;
      case "admin-tenant-placeholder-marketing-meta-ads": return <MetaAdsPage context={context} language={language} l={l} unsupported={unsupported}/>;
      case "admin-tenant-placeholder-marketing-email": return <EmailPage language={language} l={l} unsupported={unsupported}/>;
      case "admin-tenant-placeholder-marketing-social": return <SocialPage language={language} l={l} unsupported={unsupported}/>;
      case "admin-tenant-placeholder-marketing-referrals": return <ReferralPage language={language} l={l} unsupported={unsupported}/>;
      case "admin-tenant-placeholder-marketing-google-business": return <GoogleBusinessPage context={context} language={language} l={l} unsupported={unsupported}/>;
      default: return null;
    }
  }

  return <AdminLayout activePage={activePage} company={company} currentUser={currentUser} hideHeader language={language} modules={modules} onNavigate={onNavigate} subtitle={description} t={t} title={title} {...layout}><div className="tenant-marketing-page" data-marketing-direction={marketingDirection(language)} dir={marketingDirection(language)}><PageHeader actions={actions()} description={description} title={title}/>{content()}</div>{showUnsupported && <UnsupportedDialog onClose={() => setShowUnsupported(false)} t={t}/>}</AdminLayout>;
}
