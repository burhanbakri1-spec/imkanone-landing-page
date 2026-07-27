import React from "react";
import {
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  CircleHelp,
  CirclePlus,
  CreditCard,
  FileCheck2,
  FileSignature,
  FileText,
  Globe2,
  HandCoins,
  Laptop,
  Link2,
  Package,
  PenTool,
  ReceiptText,
  ScanLine,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Store,
  Users,
  WandSparkles,
  X,
} from "lucide-react";
import AdminLayout from "../components/AdminLayout.jsx";
import { AdminUnderDevelopmentContent } from "./AdminPlaceholderPage.jsx";
import { apiRequest } from "../utils/api.js";
import {
  canViewGettingPaid,
  confirmedPaymentConfiguration,
  gettingPaidCurrency,
  gettingPaidDirection,
  invoiceView,
  normalizeInvoiceRows,
  resolveGettingPaidDestination,
} from "../utils/gettingPaid.js";

const pageMeta = {
  "admin-tenant-placeholder-getting-paid-setup": ["Connect & Setup", "Choose how this company will accept and request payments.", "الربط والإعداد", "اختر كيف ستقبل هذه الشركة المدفوعات وتطلبها."],
  "admin-tenant-placeholder-getting-paid-pay-links": ["Pay Links", "Request payment through a shareable checkout link.", "روابط الدفع", "اطلب الدفع من خلال رابط دفع قابل للمشاركة."],
  "admin-invoices": ["Invoices", "Manage real tenant invoices or start invoice setup.", "الفواتير", "أدر فواتير المستأجر الحقيقية أو ابدأ الإعداد."],
  "admin-tenant-placeholder-getting-paid-quotes": ["Price Quotes", "Prepare professional quotes for prospective customers.", "عروض الأسعار", "جهّز عروض أسعار احترافية للعملاء المحتملين."],
  "admin-tenant-placeholder-getting-paid-proposals": ["Proposals", "Create structured business proposals when supported.", "المقترحات", "أنشئ مقترحات أعمال منظمة عند توفر الدعم."],
  "admin-tenant-placeholder-getting-paid-pos": ["POS Checkout", "Prepare an in-person checkout experience.", "نقطة البيع", "جهّز تجربة دفع حضورية."],
};

function bi(language, en, ar) {
  return language === "ar" ? ar : en;
}

function labels(language) {
  return language === "ar"
    ? { available: "غير متاح", create: "إنشاء", help: "معرفة المزيد", notConnected: "غير متصل", setup: "بدء الإعداد", unavailable: "هذه الميزة غير متاحة أو غير متصلة حالياً." }
    : { available: "Unavailable", create: "Create", help: "Learn more", notConnected: "Not connected", setup: "Start setup", unavailable: "This feature is currently unavailable or not connected." };
}

function PageHeader({ description, title }) {
  return <header className="getting-paid-page-header" data-getting-paid-page-header><div><h1>{title}</h1><p>{description}</p></div></header>;
}

function StatusPill({ children }) {
  return <span className="getting-paid-status-pill">{children}</span>;
}

function PaymentIllustration({ type }) {
  return <div aria-hidden="true" className={`getting-paid-illustration getting-paid-illustration-${type}`}><span className="getting-paid-illustration-orbit"/><span className="getting-paid-illustration-document"><i/><b/><em/><small/></span><span className="getting-paid-illustration-card"><CreditCard size={24}/><i/><i/></span><span className="getting-paid-illustration-check"><Check size={19}/></span></div>;
}

function UnsupportedDialog({ onClose, t }) {
  React.useEffect(() => {
    const close = (event) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [onClose]);
  return <div className="getting-paid-modal-backdrop" onMouseDown={onClose} role="presentation"><div aria-modal="true" className="getting-paid-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog"><button aria-label="Close" onClick={onClose} type="button"><X size={18}/></button><AdminUnderDevelopmentContent t={t}/></div></div>;
}

function SetupPage({ company, go, language, l, payment, unsupported }) {
  const cards = [
    { actions: [["payLinks", "Pay Links", "روابط الدفع"], ["invoices", "Invoices", "الفواتير"]], description: ["Share payment requests and send invoices.", "شارك طلبات الدفع وأرسل الفواتير."], icon: HandCoins, title: ["Request payments", "طلب المدفوعات"] },
    { actions: [["quotes", "Price Quotes", "عروض الأسعار"], ["proposals", "Proposals", "المقترحات"]], description: ["Prepare quotes and proposals for prospective clients.", "جهّز عروض الأسعار والمقترحات للعملاء المحتملين."], icon: BriefcaseBusiness, title: ["Win more clients", "اكسب المزيد من العملاء"] },
    { actions: [["pos", "POS Checkout", "نقطة البيع"]], description: ["Prepare an in-person checkout when POS support is available.", "جهّز دفعاً حضورياً عند توفر دعم نقطة البيع."], icon: ScanLine, title: ["Sell in person", "البيع حضورياً"] },
    { actions: [["products", "Products", "المنتجات"]], description: ["Manage real products and the connected storefront.", "أدر المنتجات الحقيقية وواجهة المتجر المتصلة."], icon: Store, title: ["Sell on your website", "البيع على موقعك"] },
  ];
  return <div className="getting-paid-setup-page"><section className="getting-paid-setup-hero"><div><span className="getting-paid-platform-label"><CreditCard size={18}/>{payment.configured ? bi(language, "Payment configuration", "إعداد الدفع") : l.notConnected}</span><h2>{bi(language, "Start accepting payments", "ابدأ قبول المدفوعات")}</h2><p>{bi(language, `Set up supported ways for ${company?.name || "your company"} to request and accept payment.`, `أعد طرقاً مدعومة لـ ${company?.name || "شركتك"} لطلب وقبول الدفع.`)}</p><button className="admin-primary-button" onClick={unsupported} type="button">{bi(language, "Connect Payment Method", "ربط وسيلة دفع")}</button><small>{payment.configured ? bi(language, "A payment configuration exists in company settings. Provider capabilities are shown only when verified.", "يوجد إعداد دفع في إعدادات الشركة. تظهر إمكانات المزود عند التحقق منها فقط.") : bi(language, "No payment provider or method is confirmed for this company.", "لا يوجد مزود أو وسيلة دفع مؤكدة لهذه الشركة.")}</small></div><div className="getting-paid-store-visual"><PaymentIllustration type="setup"/><div className="getting-paid-mini-store"><ShoppingBag size={25}/><strong>{company?.name || bi(language, "Your store", "متجرك")}</strong><i/><i/></div></div></section><section className="getting-paid-methods-section"><header><h2>{bi(language, "Choose the ways you want to get paid", "اختر الطرق التي تريد استلام المدفوعات بها")}</h2><p>{bi(language, "Open existing company tools or continue through an honest setup state.", "افتح أدوات الشركة الحالية أو تابع عبر حالة إعداد واضحة.")}</p></header><div>{cards.map((card) => <article key={card.title[0]}><span><card.icon size={25}/></span><h3>{bi(language, ...card.title)}</h3><p>{bi(language, ...card.description)}</p><div>{card.actions.map(([action, en, ar]) => <button key={action} onClick={() => go(action, unsupported)} type="button">{bi(language, en, ar)}<ChevronRight size={15}/></button>)}</div></article>)}</div></section></div>;
}

function PayLinksPage({ company, language, l, payment, unsupported }) {
  const currency = company?.settings?.currency || "—";
  return <div className="getting-paid-paylinks-page"><div className="getting-paid-setup-banner"><ShieldCheck size={20}/><span>{payment.configured ? bi(language, "Payment settings detected. Pay Links still require a supported backend.", "تم اكتشاف إعدادات دفع. ما زالت روابط الدفع تتطلب خدمة مدعومة.") : bi(language, "Payment setup is required before accepting money through links.", "يلزم إعداد الدفع قبل قبول الأموال عبر الروابط.")}</span><StatusPill>{payment.configured ? bi(language, "Configuration detected", "تم اكتشاف إعداد") : l.notConnected}</StatusPill></div><section className="getting-paid-paylinks-hero"><div className="getting-paid-onboarding-copy"><span className="getting-paid-platform-label"><Link2 size={18}/>{bi(language, "Pay Links", "روابط الدفع")}</span><h2>{bi(language, "Get paid with a simple link", "استلم المدفوعات برابط بسيط")}</h2><p>{bi(language, "Create a shareable checkout request after a supported Pay Links service is connected.", "أنشئ طلب دفع قابلاً للمشاركة بعد ربط خدمة روابط دفع مدعومة.")}</p><ul>{[[Smartphone, "Share anywhere", "شارك في أي مكان"], [CreditCard, "Offer supported checkout methods", "قدّم وسائل دفع مدعومة"], [BadgeCheck, `Use company currency: ${currency}`, `استخدم عملة الشركة: ${currency}`]].map(([Icon, en, ar]) => <li key={en}><span><Icon size={18}/></span>{bi(language, en, ar)}</li>)}</ul><div className="getting-paid-dual-actions"><button className="admin-primary-button" onClick={unsupported} type="button">{bi(language, "Create Link", "إنشاء رابط")}</button><button className="getting-paid-help-action" onClick={unsupported} type="button"><CircleHelp size={16}/>{l.help}</button></div></div><div className="getting-paid-paylink-visual"><PaymentIllustration type="link"/><div className="getting-paid-checkout-card"><Link2 size={21}/><strong>{company?.name || bi(language, "Payment request", "طلب دفع")}</strong><small>{currency}</small><i/><i/><button type="button">{bi(language, "Checkout preview", "معاينة الدفع")}</button></div></div></section></div>;
}

function InvoiceOnboarding({ language, l, unsupported }) {
  return <section className="getting-paid-invoice-hero"><div className="getting-paid-onboarding-copy"><span className="getting-paid-platform-label"><FileText size={18}/>{bi(language, "Invoices", "الفواتير")}</span><h2>{bi(language, "Send Invoices & Get Paid", "أرسل الفواتير واستلم المدفوعات")}</h2><p>{bi(language, "Create professional invoices when an existing invoice creation flow becomes available.", "أنشئ فواتير احترافية عند توفر مسار إنشاء فواتير حالي.")}</p><ul>{[[Users, "Keep customer details together", "احتفظ ببيانات العميل معاً"], [ReceiptText, "Present clear totals", "اعرض الإجماليات بوضوح"], [CreditCard, "Connect supported payment options", "اربط خيارات دفع مدعومة"]].map(([Icon, en, ar]) => <li key={en}><span><Icon size={18}/></span>{bi(language, en, ar)}</li>)}</ul><div className="getting-paid-dual-actions"><button className="admin-primary-button" onClick={unsupported} type="button">{bi(language, "Get Started", "ابدأ الآن")}</button><button className="getting-paid-help-action" onClick={unsupported} type="button"><CircleHelp size={16}/>{l.help}</button></div></div><div className="getting-paid-invoice-visual"><PaymentIllustration type="invoice"/><div className="getting-paid-document-preview"><FileText size={25}/><strong>{bi(language, "Invoice preview", "معاينة الفاتورة")}</strong><i/><i/><i/><span>{l.available}</span></div></div></section>;
}

function InvoiceList({ company, language, rows }) {
  const invoices = rows.map(invoiceView);
  return <section className="getting-paid-invoice-list"><header><div><h2>{bi(language, "Invoice records", "سجلات الفواتير")}</h2><p>{bi(language, "Loaded from the existing tenant invoice API.", "تم تحميلها من واجهة فواتير المستأجر الحالية.")}</p></div><StatusPill>{invoices.length}</StatusPill></header><div className="getting-paid-table-wrap"><table><thead><tr><th>{bi(language, "Invoice", "الفاتورة")}</th><th>{bi(language, "Customer", "العميل")}</th><th>{bi(language, "Date", "التاريخ")}</th><th>{bi(language, "Total", "الإجمالي")}</th><th>{bi(language, "Status", "الحالة")}</th></tr></thead><tbody>{invoices.map((invoice, index) => <tr key={invoice.id || index}><td>{invoice.number || "—"}</td><td>{invoice.customer || "—"}</td><td>{invoice.date ? new Date(invoice.date).toLocaleDateString(language) : "—"}</td><td>{gettingPaidCurrency(invoice.total, company, language)}</td><td><StatusPill>{invoice.status || "—"}</StatusPill></td></tr>)}</tbody></table></div></section>;
}

function InvoicesPage({ company, language, l, state, unsupported }) {
  if (state.loading) return <section className="getting-paid-loading">{bi(language, "Loading invoices…", "جارٍ تحميل الفواتير…")}</section>;
  if (state.error) return <section className="getting-paid-error" role="alert"><strong>{bi(language, "Invoices could not be loaded", "تعذر تحميل الفواتير")}</strong><span>{state.error}</span></section>;
  return state.rows.length ? <InvoiceList company={company} language={language} rows={state.rows}/> : <InvoiceOnboarding language={language} l={l} unsupported={unsupported}/>;
}

function QuotesPage({ language, l, unsupported }) {
  return <section className="getting-paid-quotes-hero"><div className="getting-paid-onboarding-copy"><span className="getting-paid-platform-label"><FileCheck2 size={18}/>{bi(language, "Price Quotes", "عروض الأسعار")}</span><h2>{bi(language, "Create quotes that move work forward", "أنشئ عروضاً تدفع العمل إلى الأمام")}</h2><p>{bi(language, "Prepare clear pricing documents after a supported quote workflow is connected.", "جهّز مستندات تسعير واضحة بعد ربط مسار عروض مدعوم.")}</p><ul>{[[Package, "Add real products when supported", "أضف منتجات حقيقية عند الدعم"], [Users, "Use verified customer details", "استخدم بيانات عملاء موثقة"], [FileSignature, "Track acceptance only from real records", "تتبع القبول من سجلات حقيقية فقط"]].map(([Icon, en, ar]) => <li key={en}><span><Icon size={18}/></span>{bi(language, en, ar)}</li>)}</ul><div className="getting-paid-dual-actions"><button className="admin-primary-button" onClick={unsupported} type="button">{bi(language, "Create Price Quote", "إنشاء عرض سعر")}</button><button className="getting-paid-help-action" onClick={unsupported} type="button"><CircleHelp size={16}/>{l.help}</button></div></div><div className="getting-paid-quote-visual"><PaymentIllustration type="quote"/><div className="getting-paid-quote-document"><FileCheck2 size={27}/><strong>{bi(language, "Quote preview", "معاينة العرض")}</strong><i/><i/><i/><span><Check size={15}/>{l.available}</span></div></div></section>;
}

function ProposalsPage({ language, l, unsupported }) {
  return <div className="getting-paid-proposals-page"><div className="getting-paid-setup-banner"><Sparkles size={20}/><span>{bi(language, "Proposal creation and AI assistance are not connected.", "إنشاء المقترحات ومساعدة الذكاء غير متصلين.")}</span><StatusPill>{l.available}</StatusPill></div><section className="getting-paid-proposals-hero"><div className="getting-paid-onboarding-copy"><span className="getting-paid-platform-label"><FileSignature size={18}/>{bi(language, "Proposals", "المقترحات")}</span><h2>{bi(language, "Present your next project beautifully", "قدّم مشروعك القادم بصورة احترافية")}</h2><p>{bi(language, "Build proposals with payment schedules and signatures only when supported services are available.", "أنشئ مقترحات بجداول دفع وتوقيعات فقط عند توفر خدمات مدعومة.")}</p><ul>{[[PenTool, "Flexible document layout", "تخطيط مستند مرن"], [Banknote, "Payment schedule when supported", "جدول دفع عند الدعم"], [FileSignature, "Verified signatures only", "توقيعات موثقة فقط"]].map(([Icon, en, ar]) => <li key={en}><span><Icon size={18}/></span>{bi(language, en, ar)}</li>)}</ul><div className="getting-paid-dual-actions"><button className="admin-primary-button" onClick={unsupported} type="button">{bi(language, "Create Proposal", "إنشاء مقترح")}</button><button className="secondary-action" onClick={unsupported} type="button"><WandSparkles size={16}/>{bi(language, "Create with AI", "إنشاء بالذكاء")}</button><button className="getting-paid-help-action" onClick={unsupported} type="button"><CircleHelp size={16}/>{l.help}</button></div></div><div className="getting-paid-proposal-visual"><div className="getting-paid-proposal-document"><FileSignature size={26}/><strong>{bi(language, "Proposal", "مقترح")}</strong><i/><i/><div><Banknote size={17}/><span>{bi(language, "Payment schedule", "جدول الدفع")}</span><StatusPill>{l.available}</StatusPill></div><div><PenTool size={17}/><span>{bi(language, "Signature", "التوقيع")}</span><StatusPill>{l.available}</StatusPill></div></div></div></section></div>;
}

function PosPage({ company, language, l, products, unsupported }) {
  const currency = company?.settings?.currency || "—";
  return <section className="getting-paid-pos-hero"><div className="getting-paid-onboarding-copy"><span className="getting-paid-platform-label"><ScanLine size={18}/>{bi(language, "Point of Sale", "نقطة البيع")}</span><h2>{bi(language, "Bring checkout to your customers", "قدّم الدفع مباشرة لعملائك")}</h2><p>{bi(language, "Prepare an in-person checkout after a supported POS service and hardware configuration are verified.", "جهّز دفعاً حضورياً بعد التحقق من خدمة نقطة بيع وإعداد أجهزة مدعومين.")}</p><ul>{[[ShoppingBag, `${products.length} real products currently loaded`, `${products.length} منتجاً حقيقياً محملاً حالياً`], [CreditCard, "Payment methods require verification", "وسائل الدفع تتطلب التحقق"], [Store, "Hardware and locations are not connected", "الأجهزة والمواقع غير متصلة"]].map(([Icon, en, ar]) => <li key={en}><span><Icon size={18}/></span>{bi(language, en, ar)}</li>)}</ul><div className="getting-paid-dual-actions"><button className="admin-primary-button" onClick={unsupported} type="button">{bi(language, "Set up Point of Sale", "إعداد نقطة البيع")}</button><button className="getting-paid-help-action" onClick={unsupported} type="button"><CircleHelp size={16}/>{l.help}</button></div></div><div className="getting-paid-pos-visual"><div className="getting-paid-pos-terminal"><header><ShoppingBag size={21}/><strong>{bi(language, "Cart preview", "معاينة السلة")}</strong><StatusPill>{l.available}</StatusPill></header><div className="getting-paid-pos-lines"><i/><i/><i/></div><footer><span>{bi(language, "Currency", "العملة")}</span><strong>{currency}</strong></footer><div className="getting-paid-pos-methods"><button type="button"><CreditCard size={18}/>{bi(language, "Card", "بطاقة")}</button><button type="button"><Banknote size={18}/>{bi(language, "Cash", "نقداً")}</button></div></div><div className="getting-paid-pos-phone"><Smartphone size={48}/><span>{bi(language, "Checkout illustration", "رسم توضيحي للدفع")}</span></div></div></section>;
}

export default function AdminGettingPaidPage({ activePage, company, currentUser, language = "en", modules = [], onNavigate, products = [], t, ...layout }) {
  const [showUnsupported, setShowUnsupported] = React.useState(false);
  const [invoiceState, setInvoiceState] = React.useState({ error: "", loading: activePage === "admin-invoices", rows: [] });
  const l = labels(language);
  const meta = pageMeta[activePage] || pageMeta["admin-tenant-placeholder-getting-paid-setup"];
  const title = language === "ar" ? meta[2] : meta[0];
  const description = language === "ar" ? meta[3] : meta[1];
  const unsupported = () => setShowUnsupported(true);
  const payment = confirmedPaymentConfiguration(company);
  const canView = canViewGettingPaid(currentUser, company, modules, activePage);
  const go = (action, fallback = unsupported) => {
    const page = resolveGettingPaidDestination(action, { currentUser, modules });
    if (page) onNavigate(page); else fallback();
  };

  React.useEffect(() => {
    if (activePage !== "admin-invoices" || !canView) return undefined;
    let active = true;
    setInvoiceState({ error: "", loading: true, rows: [] });
    apiRequest("/admin/invoices").then((data) => active && setInvoiceState({ error: "", loading: false, rows: normalizeInvoiceRows(data) })).catch((error) => active && setInvoiceState({ error: error?.message || "Request failed.", loading: false, rows: [] }));
    return () => { active = false; };
  }, [activePage, canView, company?.id]);

  function content() {
    if (!canView) return <section className="getting-paid-access-denied"><ShieldCheck size={35}/><h2>{bi(language, "Access denied", "الوصول مرفوض")}</h2></section>;
    switch (activePage) {
      case "admin-tenant-placeholder-getting-paid-setup": return <SetupPage company={company} go={go} language={language} l={l} payment={payment} unsupported={unsupported}/>;
      case "admin-tenant-placeholder-getting-paid-pay-links": return <PayLinksPage company={company} language={language} l={l} payment={payment} unsupported={unsupported}/>;
      case "admin-invoices": return <InvoicesPage company={company} language={language} l={l} state={invoiceState} unsupported={unsupported}/>;
      case "admin-tenant-placeholder-getting-paid-quotes": return <QuotesPage language={language} l={l} unsupported={unsupported}/>;
      case "admin-tenant-placeholder-getting-paid-proposals": return <ProposalsPage language={language} l={l} unsupported={unsupported}/>;
      case "admin-tenant-placeholder-getting-paid-pos": return <PosPage company={company} language={language} l={l} products={products} unsupported={unsupported}/>;
      default: return null;
    }
  }

  return <AdminLayout activePage={activePage} company={company} currentUser={currentUser} hideHeader language={language} modules={modules} onNavigate={onNavigate} subtitle={description} t={t} title={title} {...layout}><div className="tenant-getting-paid-page" data-getting-paid-direction={gettingPaidDirection(language)} dir={gettingPaidDirection(language)}><PageHeader description={description} title={title}/>{content()}</div>{showUnsupported && <UnsupportedDialog onClose={() => setShowUnsupported(false)} t={t}/>}</AdminLayout>;
}
