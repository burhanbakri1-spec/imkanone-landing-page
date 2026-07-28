import React from "react";
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  Bookmark,
  CalendarDays,
  ChevronDown,
  Clock3,
  FileBarChart,
  Globe2,
  Lightbulb,
  Mail,
  Map,
  Megaphone,
  MonitorSmartphone,
  MousePointerClick,
  PlayCircle,
  Radio,
  Search,
  ShieldQuestion,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import AdminLayout from "../components/AdminLayout.jsx";
import { AdminUnderDevelopmentContent } from "./AdminPlaceholderPage.jsx";
import {
  analyticsDirection,
  buildVerifiedOperationalSummary,
  reportCatalog,
} from "../utils/analytics.js";
import { fetchCustomers } from "../utils/customersApi.js";

const COPY = {
  en: {
    unavailable: "Unavailable",
    unavailableDetail: "No verified analytics source is connected for this metric.",
    setup: "Setup required",
    notConnected: "Not connected",
    noVerified: "No verified data",
    dateRange: "All available time",
    ask: "Ask a question about your stats",
    askDetail: "An analytics assistant is not available for this company.",
    reports: "Reports",
    alerts: "Set alerts",
    learnMore: "Learn More",
    enable: "Enable analytics",
    showMore: "Show more reports",
    showLess: "Show fewer reports",
    openReport: "Open report",
  },
  ar: {
    unavailable: "غير متاح",
    unavailableDetail: "لا يوجد مصدر تحليلات موثّق متصل بهذا المؤشر.",
    setup: "يتطلب الإعداد",
    notConnected: "غير متصل",
    noVerified: "لا توجد بيانات موثّقة",
    dateRange: "كل الوقت المتاح",
    ask: "اطرح سؤالاً حول إحصاءاتك",
    askDetail: "مساعد التحليلات غير متاح لهذه الشركة.",
    reports: "التقارير",
    alerts: "إعداد التنبيهات",
    learnMore: "معرفة المزيد",
    enable: "تفعيل التحليلات",
    showMore: "عرض المزيد من التقارير",
    showLess: "عرض تقارير أقل",
    openReport: "فتح التقرير",
  },
};

const PAGE_COPY = {
  "admin-analytics-highlights": ["Analytics Highlights", "A clear view of verified company activity and analytics setup.", "أبرز التحليلات", "نظرة واضحة على نشاط الشركة الموثّق وإعداد التحليلات."],
  "admin-analytics-realtime": ["Real-time Analytics", "Monitor live visitor activity when a verified tracking source is connected.", "تحليلات الوقت الفعلي", "راقب نشاط الزوار المباشر عند ربط مصدر تتبع موثّق."],
  "admin-analytics-traffic": ["Traffic Overview", "Understand how visitors reach and use your site when traffic data is available.", "نظرة عامة على الزيارات", "افهم كيفية وصول الزوار إلى موقعك واستخدامه عند توفر بيانات الزيارات."],
  "admin-analytics-behavior": ["Behavior Overview", "Explore verified engagement and navigation events.", "نظرة عامة على السلوك", "استكشف أحداث التفاعل والتنقل الموثّقة."],
  "admin-analytics-marketing": ["Marketing Overview", "Compare verified marketing sources without mixing them with campaign-management tools.", "نظرة عامة على التسويق", "قارن مصادر التسويق الموثّقة دون خلطها بأدوات إدارة الحملات."],
  "admin-analytics-session-recordings": ["Understand every visitor journey", "Session recordings can reveal friction only after consented recording is configured.", "افهم رحلة كل زائر", "يمكن لتسجيلات الجلسات إظهار نقاط التعثر بعد إعداد التسجيل الموافق عليه."],
  "admin-analytics-insights": ["Insights", "Recommended findings appear only after significant verified patterns are available.", "الرؤى", "تظهر النتائج المقترحة فقط بعد توفر أنماط موثّقة وذات دلالة."],
  "admin-analytics-benchmarks": ["Benchmarks", "Compare performance only when a verified and eligible benchmark dataset exists.", "المعايير", "قارن الأداء فقط عند توفر مجموعة بيانات معيارية موثّقة ومؤهلة."],
  "admin-analytics-reports": ["All Reports", "Browse available report templates. Results open only when supported data exists.", "كل التقارير", "استعرض قوالب التقارير المتاحة. لا تفتح النتائج إلا عند توفر بيانات مدعومة."],
};

function PageHeader({ activePage, ar, labels, onUnsupported }) {
  const copy = PAGE_COPY[activePage] || PAGE_COPY["admin-analytics-highlights"];
  return <header className="tenant-analytics-header"><div><h1>{ar ? copy[2] : copy[0]}</h1><p>{ar ? copy[3] : copy[1]}</p></div><div className="tenant-analytics-header-actions"><button onClick={onUnsupported} type="button"><AlertCircle size={16}/>{labels.alerts}</button><button onClick={onUnsupported} type="button"><FileBarChart size={16}/>{labels.reports}</button></div></header>;
}

function RangeControl({ labels }) {
  return <button className="tenant-analytics-range" type="button"><CalendarDays size={16}/>{labels.dateRange}<ChevronDown size={15}/></button>;
}

function QuestionPanel({ labels }) {
  return <section className="tenant-analytics-question"><span><Sparkles size={21}/></span><div><strong>{labels.ask}</strong><p>{labels.askDetail}</p></div><button disabled type="button">{labels.unavailable}</button></section>;
}

function MetricCard({ icon: Icon = BarChart3, label, value, status }) {
  return <article className="tenant-analytics-metric"><div><span>{label}</span><strong>{value ?? "—"}</strong><small>{status}</small></div><i><Icon size={21}/></i></article>;
}

function EmptyChart({ icon: Icon = BarChart3, label, detail, variant = "line" }) {
  return <div className={`tenant-analytics-empty-chart ${variant}`}><div className="tenant-analytics-chart-grid"><span/><span/><span/><span/></div><Icon size={38}/><strong>{label}</strong><p>{detail}</p></div>;
}

function DataPanel({ children, className = "", title, action }) {
  return <section className={`tenant-analytics-panel ${className}`}><header><h2>{title}</h2>{action}</header>{children}</section>;
}

function StatusRows({ items, labels }) {
  return <div className="tenant-analytics-status-rows">{items.map(([name, icon]) => { const Icon = icon; return <div key={name}><span><Icon size={17}/>{name}</span><b>{labels.noVerified}</b></div>; })}</div>;
}

function HighlightsPage({ customerCount, labels, summary }) {
  return <div className="analytics-highlights-page">
    <div className="tenant-analytics-top-grid"><DataPanel className="analytics-live-card" title="Live visitors"><div className="analytics-live-value"><Radio size={27}/><strong>0</strong><span>{labels.noVerified}</span></div></DataPanel><QuestionPanel labels={labels}/></div>
    <div className="tenant-analytics-section-heading"><div><h2>Key statistics</h2><p>Operational counters are labeled separately from unavailable visitor analytics.</p></div><RangeControl labels={labels}/></div>
    <div className="tenant-analytics-metrics four"><MetricCard icon={Globe2} label="Site sessions" status={labels.unavailable}/><MetricCard icon={Users} label="Unique visitors" status={labels.unavailable}/><MetricCard icon={BarChart3} label="Orders" value={summary.orders} status="Verified order records"/><MetricCard icon={Users} label="Customers" value={customerCount ?? "—"} status={customerCount == null ? labels.unavailable : "Verified customer records"}/></div>
    <div className="tenant-analytics-section-heading"><div><h2>Get to know your visitors</h2><p>Visitor trends remain empty until a verified event source is connected.</p></div></div>
    <div className="tenant-analytics-grid three"><DataPanel title="Sessions over time"><EmptyChart label={labels.noVerified} detail={labels.unavailableDetail}/></DataPanel><DataPanel title="Top traffic sources"><StatusRows labels={labels} items={[["Direct", Globe2],["Search", Search],["Referrals", ArrowUpRight]]}/></DataPanel><DataPanel title="Sessions by location"><EmptyChart icon={Map} label={labels.noVerified} detail={labels.unavailableDetail} variant="map"/></DataPanel></div>
    <div className="tenant-analytics-section-heading"><div><h2>Explore visitor engagement</h2><p>Engagement and click tracking have not been verified.</p></div></div>
    <div className="tenant-analytics-grid three"><DataPanel title="Most visited pages"><EmptyChart label={labels.noVerified} detail={labels.unavailableDetail}/></DataPanel><DataPanel title="Engagement statistics"><StatusRows labels={labels} items={[["Session duration", Clock3],["Pages per session", FileBarChart],["Bounce rate", Activity]]}/></DataPanel><DataPanel title="Click tracking"><EmptyChart icon={MousePointerClick} label={labels.setup} detail="Configure a supported event source before click data appears."/></DataPanel></div>
    <DataPanel title="Analyze marketing performance"><StatusRows labels={labels} items={[["Organic search", Search],["Email marketing", Mail],["Paid advertising", Megaphone]]}/></DataPanel>
  </div>;
}

function RealtimePage({ labels }) {
  return <div className="analytics-realtime-page"><div className="tenant-analytics-metrics two"><MetricCard icon={Clock3} label="Visitors in the last 30 minutes" value="0" status={labels.noVerified}/><MetricCard icon={Radio} label="Live visitors" value="0" status={labels.noVerified}/></div><div className="analytics-realtime-layout"><DataPanel className="analytics-map-panel" title="Live visitor map"><EmptyChart icon={Map} label="No live visitor source" detail={labels.unavailableDetail} variant="map"/><div className="tenant-analytics-grid three compact"><StatusRows labels={labels} items={[["Page views", FileBarChart]]}/><StatusRows labels={labels} items={[["Traffic source", Globe2]]}/><StatusRows labels={labels} items={[["Devices", MonitorSmartphone]]}/></div></DataPanel><aside><DataPanel title="Recent visitors"><EmptyChart icon={Users} label="No verified visitors" detail="Recent visitor identities are not available."/></DataPanel><DataPanel title="Live activity"><EmptyChart icon={Activity} label="No live activity" detail="A verified event stream is required."/></DataPanel></aside></div></div>;
}

function TrafficPage({ labels }) {
  return <div className="analytics-traffic-page"><div className="tenant-analytics-control-row"><RangeControl labels={labels}/></div><QuestionPanel labels={labels}/><div className="tenant-analytics-metrics two"><MetricCard label="Site sessions" status={labels.unavailable}/><MetricCard icon={Users} label="Unique visitors" status={labels.unavailable}/></div><DataPanel title="Sessions over time"><EmptyChart label="Historical traffic unavailable" detail="No verified time-series dataset is connected."/></DataPanel><div className="tenant-analytics-grid three"><DataPanel title="Sessions by source and category"><StatusRows labels={labels} items={[["Source", Globe2],["Category", BarChart3]]}/></DataPanel><DataPanel title="New vs returning visitors"><EmptyChart icon={Users} label={labels.noVerified} detail={labels.unavailableDetail}/></DataPanel><DataPanel title="Sessions by device"><EmptyChart icon={MonitorSmartphone} label={labels.noVerified} detail={labels.unavailableDetail}/></DataPanel></div><div className="tenant-analytics-grid two"><DataPanel title="Average sessions by day"><EmptyChart icon={CalendarDays} label={labels.unavailable} detail={labels.unavailableDetail}/></DataPanel><DataPanel title="Sessions by location and state"><EmptyChart icon={Map} label={labels.noVerified} detail={labels.unavailableDetail}/></DataPanel></div><DataPanel title="Traffic insights"><EmptyChart icon={Lightbulb} label="No traffic insights yet" detail="Insights appear after verified traffic patterns are available."/></DataPanel></div>;
}

function BehaviorPage({ labels }) {
  return <div className="analytics-behavior-page"><div className="tenant-analytics-control-row"><RangeControl labels={labels}/></div><QuestionPanel labels={labels}/><div className="tenant-analytics-metrics three"><MetricCard icon={Clock3} label="Average session duration" status={labels.unavailable}/><MetricCard icon={FileBarChart} label="Average pages per session" status={labels.unavailable}/><MetricCard icon={Activity} label="Bounce rate" status={labels.unavailable}/></div><div className="tenant-analytics-grid two"><DataPanel title="Top pages"><EmptyChart label={labels.noVerified} detail={labels.unavailableDetail}/></DataPanel><DataPanel title="Top clicks"><EmptyChart icon={MousePointerClick} label="Click tracking is not configured" detail="No click events are collected by a verified source."/></DataPanel></div><DataPanel title="Top navigation flows"><EmptyChart icon={Activity} label="No navigation paths available" detail="Navigation events have not been verified."/></DataPanel><DataPanel title="Form submissions"><EmptyChart icon={FileBarChart} label="No verified submission analytics" detail="Form submission analytics are not connected."/></DataPanel></div>;
}

function MarketingPage({ labels }) {
  return <div className="analytics-marketing-page"><div className="tenant-analytics-control-row"><RangeControl labels={labels}/></div><QuestionPanel labels={labels}/><DataPanel title="Performance by"><div className="analytics-performance-tabs"><button className="active" type="button">Sessions</button><button type="button">Leads</button></div><div className="analytics-performance-columns"><StatusRows labels={labels} items={[["Traffic source", Globe2]]}/><StatusRows labels={labels} items={[["Traffic category", BarChart3]]}/></div></DataPanel><DataPanel title="Sessions over time"><EmptyChart label="No verified marketing timeline" detail="Historical marketing sessions are unavailable."/></DataPanel><div className="tenant-analytics-grid three"><DataPanel title="Organic Search"><EmptyChart icon={Search} label={labels.notConnected} detail="No verified Search Console connection."/></DataPanel><DataPanel title="AI platforms visibility"><EmptyChart icon={Sparkles} label={labels.noVerified} detail="No verified AI visibility source is connected."/></DataPanel><DataPanel title="Email marketing"><EmptyChart icon={Mail} label={labels.notConnected} detail="No verified sender or campaign source is connected."/></DataPanel></div></div>;
}

function RecordingsPage({ labels, onUnsupported }) {
  const benefits = [[PlayCircle,"See journeys clearly"],[MousePointerClick,"Understand interaction friction"],[ShieldQuestion,"Use consent-aware setup"]];
  return <section className="analytics-recordings-page"><div className="analytics-recordings-copy"><span className="tenant-analytics-eyebrow">Session recordings</span><h2>Turn visitor journeys into clear improvements</h2><p>No verified recording source is enabled. The preview is decorative and contains no tenant sessions.</p><div>{benefits.map(([Icon,text])=><article key={text}><i><Icon size={20}/></i><div><strong>{text}</strong><p>Available after a supported recording integration is configured.</p></div></article>)}</div><div className="analytics-recordings-actions"><button onClick={onUnsupported} type="button">{labels.enable}</button><button onClick={onUnsupported} type="button">{labels.learnMore}</button></div></div><div className="analytics-recordings-visual" aria-label="Decorative session recording preview"><div className="recording-browser"><header><i/><i/><i/></header><aside/><main><span/><span/><span/><div className="recording-cursor"><MousePointerClick size={25}/></div></main><footer><PlayCircle size={20}/><b/><small>Decorative preview</small></footer></div></div></section>;
}

function InsightsPage({ labels, onUnsupported }) {
  return <div className="analytics-insights-page"><div className="tenant-analytics-control-row"><button className="tenant-analytics-primary" onClick={onUnsupported} type="button"><Sparkles size={16}/>Recommended Actions</button></div><section className="analytics-insights-empty"><div className="analytics-insights-illustration"><Lightbulb size={54}/><span/><span/></div><h2>No insights at the moment</h2><p>Insights will appear after significant patterns are confirmed by a verified analytics source.</p><button onClick={onUnsupported} type="button">{labels.learnMore}</button></section></div>;
}

function BenchmarksPage({ labels }) {
  const metrics=["Site sessions","Unique visitors","Conversion rate","Average order value","Returning visitors"];
  return <div className="analytics-benchmarks-page"><div className="analytics-period-note"><CalendarDays size={18}/><div><strong>Current period</strong><p>No eligible comparison period is available.</p></div></div><div className="analytics-benchmark-layout"><DataPanel title="Benchmark metrics"><div className="analytics-benchmark-table"><header><span>Metric</span><span>Your business</span><span>Benchmark</span></header>{metrics.map(metric=><div key={metric}><strong>{metric}</strong><span>{labels.unavailable}</span><span>{labels.unavailable}</span></div>)}</div></DataPanel><DataPanel title="Competition radar"><div className="analytics-radar"><span/><span/><span/><span/><i>{labels.noVerified}</i></div><p className="analytics-panel-note">No claim is made about competitor performance because an eligible benchmark dataset is unavailable.</p></DataPanel></div></div>;
}

function ReportsPage({ labels, onUnsupported }) {
  const [expanded, setExpanded] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const visible = reportCatalog.filter(([category, description, reports]) => `${category} ${description} ${reports.join(" ")}`.toLowerCase().includes(query.toLowerCase()));
  const rows = expanded ? visible : visible.slice(0, 7);
  return <div className="analytics-reports-page"><div className="analytics-report-search"><Search size={17}/><input aria-label="Search reports" onChange={(event)=>setQuery(event.target.value)} placeholder="Search reports" value={query}/></div><div className="analytics-report-catalog">{rows.map(([category,description,reports])=><section className="analytics-report-category" key={category}><div><h2>{category}</h2><p>{description}</p></div><div>{reports.map(report=><button key={report} onClick={onUnsupported} type="button"><span><FileBarChart size={18}/><b>{report}</b></span><span><Bookmark size={17}/><ArrowUpRight size={16}/></span><small>{labels.openReport}</small></button>)}</div></section>)}</div>{visible.length>7&&<button className="analytics-report-more" onClick={()=>setExpanded(value=>!value)} type="button">{expanded?labels.showLess:labels.showMore}<ChevronDown className={expanded?"open":""} size={16}/></button>}</div>;
}

export default function AdminAnalyticsPage({ activePage, company, currentUser, employees = [], language = "en", modules = [], onNavigate, orders = [], products = [], t, ...layout }) {
  const ar = language === "ar";
  const labels = COPY[ar ? "ar" : "en"];
  const [customers, setCustomers] = React.useState(null);
  const [unsupported, setUnsupported] = React.useState(false);
  React.useEffect(() => {
    let active = true;
    fetchCustomers().then((data) => { if (active) setCustomers(Array.isArray(data) ? data : []); }).catch(() => { if (active) setCustomers(null); });
    return () => { active = false; };
  }, [company?.id]);
  const summary = React.useMemo(() => buildVerifiedOperationalSummary({ customers: customers || [], employees, orders, products }), [customers, employees, orders, products]);
  const common = { labels, onUnsupported: () => setUnsupported(true) };
  let content;
  switch (activePage) {
    case "admin-analytics-realtime": content = <RealtimePage labels={labels}/>; break;
    case "admin-analytics-traffic": content = <TrafficPage labels={labels}/>; break;
    case "admin-analytics-behavior": content = <BehaviorPage labels={labels}/>; break;
    case "admin-analytics-marketing": content = <MarketingPage labels={labels}/>; break;
    case "admin-analytics-session-recordings": content = <RecordingsPage {...common}/>; break;
    case "admin-analytics-insights": content = <InsightsPage {...common}/>; break;
    case "admin-analytics-benchmarks": content = <BenchmarksPage labels={labels}/>; break;
    case "admin-analytics-reports": content = <ReportsPage {...common}/>; break;
    default: content = <HighlightsPage customerCount={customers?.length ?? null} labels={labels} summary={summary}/>;
  }
  return <AdminLayout activePage={activePage} company={company} currentUser={currentUser} hideHeader language={language} modules={modules} onNavigate={onNavigate} t={t} {...layout}><div className="tenant-analytics-page" dir={analyticsDirection(language)}><PageHeader activePage={activePage} ar={ar} labels={labels} onUnsupported={() => setUnsupported(true)}/>{content}{unsupported&&<div className="tenant-analytics-modal" role="dialog" aria-modal="true"><button aria-label="Close" onClick={()=>setUnsupported(false)} type="button"><X size={18}/></button><AdminUnderDevelopmentContent language={language} title={ar?"الميزة غير متاحة":"Feature unavailable"}/></div>}</div></AdminLayout>;
}
