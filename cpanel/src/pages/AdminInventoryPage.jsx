import React from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import AdminLayout from "../components/AdminLayout.jsx";
import { hasPermission } from "../data/permissions.js";
import { isCompanyAdmin } from "../utils/roles.js";
import { fetchInventory, updateInventory } from "../utils/inventoryApi.js";

const text = (value, language) => value && typeof value === "object"
  ? value[language] || value.en || value.ar || ""
  : String(value || "");

const statusFor = (stock) => stock <= 0 ? "out" : stock <= 5 ? "low" : "in";
const labels = {
  en: { title: "Inventory", subtitle: "Track and update real product and variant stock.", total: "Total Products", in: "In Stock", low: "Low Stock", out: "Out of Stock", product: "Product", brand: "Brand", main: "Main Category", sub: "Subcategory", sku: "SKU", stock: "Current Stock", status: "Status", updated: "Last Updated", actions: "Actions", save: "Save", empty: "No inventory matches these filters.", all: "All", search: "Search product or SKU", variants: "variants" },
  ar: { title: "المخزون", subtitle: "تتبع وتحديث مخزون المنتجات والمتغيرات الفعلي.", total: "إجمالي المنتجات", in: "متوفر", low: "مخزون منخفض", out: "غير متوفر", product: "المنتج", brand: "العلامة", main: "الفئة الرئيسية", sub: "الفئة الفرعية", sku: "SKU", stock: "المخزون الحالي", status: "الحالة", updated: "آخر تحديث", actions: "الإجراءات", save: "حفظ", empty: "لا توجد نتائج مطابقة.", all: "الكل", search: "ابحث عن منتج أو SKU", variants: "متغيرات" },
};

export default function AdminInventoryPage({ brands = [], categories = [], company, currentUser, language = "en", ...layoutProps }) {
  const copy = labels[language] || labels.en;
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [brandId, setBrandId] = React.useState("");
  const [mainId, setMainId] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [expanded, setExpanded] = React.useState(new Set());
  const [drafts, setDrafts] = React.useState({});
  const [saving, setSaving] = React.useState("");
  const canManage = isCompanyAdmin(currentUser?.role) || ["inventory.manage", "products.manage", "products.update"].some((permission) => hasPermission(currentUser, permission));

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try { setRows(await fetchInventory()); }
    catch (loadError) { setError(loadError.message); }
    finally { setLoading(false); }
  }, []);

  React.useEffect(() => { load(); }, [load, company?.id]);

  const categoryById = React.useMemo(() => new Map(categories.map((item) => [String(item.id), item])), [categories]);
  const brandById = React.useMemo(() => new Map(brands.map((item) => [String(item.id), item])), [brands]);
  const mainCategories = React.useMemo(() => categories.filter((item) => !item.parentId && item.brandId), [categories]);
  const filtered = rows.filter((row) => {
    const haystack = `${text(row.name, language)} ${row.sku || ""}`.toLowerCase();
    return (!query || haystack.includes(query.toLowerCase()))
      && (!brandId || String(row.brandId) === brandId)
      && (!mainId || String(row.mainCategoryId) === mainId)
      && (!status || statusFor(row.stock) === status);
  });
  const summary = rows.reduce((result, row) => ({ ...result, [statusFor(row.stock)]: result[statusFor(row.stock)] + 1 }), { in: 0, low: 0, out: 0 });

  const setDraft = (key, value) => setDrafts((current) => ({ ...current, [key]: value }));
  async function saveRow(row) {
    const variants = row.variants || [];
    const body = variants.length
      ? { variants: variants.map((variant) => ({ id: variant.id, stock: drafts[`${row.id}:${variant.id}`] ?? variant.stock })) }
      : { stock: drafts[row.id] ?? row.stock };
    setSaving(row.id);
    setError("");
    try { await updateInventory(row.id, body); await load(); }
    catch (saveError) { setError(saveError.message); }
    finally { setSaving(""); }
  }

  return (
    <AdminLayout company={company} currentUser={currentUser} language={language} title={copy.title} subtitle={copy.subtitle} {...layoutProps}>
      <div className="inventory-page">
        <section className="inventory-summary" aria-label={copy.title}>
          {[[copy.total, rows.length, "total"], [copy.in, summary.in, "in"], [copy.low, summary.low, "low"], [copy.out, summary.out, "out"]].map(([label, value, tone]) => <article className={`inventory-summary__card is-${tone}`} key={tone}><span>{label}</span><strong>{value}</strong></article>)}
        </section>
        <section className="inventory-panel">
          <div className="inventory-toolbar">
            <label className="inventory-search"><Search size={18} /><input aria-label={copy.search} placeholder={copy.search} value={query} onChange={(event) => setQuery(event.target.value)} /></label>
            <select aria-label={copy.brand} value={brandId} onChange={(event) => { setBrandId(event.target.value); setMainId(""); }}><option value="">{copy.all} {copy.brand}</option>{brands.map((brand) => <option value={brand.id} key={brand.id}>{text(brand.name, language)}</option>)}</select>
            <select aria-label={copy.main} value={mainId} onChange={(event) => setMainId(event.target.value)}><option value="">{copy.all} {copy.main}</option>{mainCategories.filter((item) => !brandId || String(item.brandId) === brandId).map((item) => <option value={item.id} key={item.id}>{text(item.name, language)}</option>)}</select>
            <select aria-label={copy.status} value={status} onChange={(event) => setStatus(event.target.value)}><option value="">{copy.all} {copy.status}</option><option value="in">{copy.in}</option><option value="low">{copy.low}</option><option value="out">{copy.out}</option></select>
          </div>
          {error && <div className="inventory-error" role="alert">{error}</div>}
          <div className="inventory-table-wrap">
            <table className="inventory-table"><thead><tr><th>{copy.product}</th><th>{copy.brand}</th><th>{copy.main}</th><th>{copy.sub}</th><th>{copy.sku}</th><th>{copy.stock}</th><th>{copy.status}</th><th>{copy.updated}</th><th>{copy.actions}</th></tr></thead>
              <tbody>{loading ? <tr><td colSpan="9">Loading…</td></tr> : filtered.length ? filtered.map((row) => {
                const hasVariants = row.variants?.length > 0;
                const open = expanded.has(row.id);
                const tone = statusFor(row.stock);
                return <React.Fragment key={row.id}><tr>
                  <td><button className="inventory-product" disabled={!hasVariants} onClick={() => setExpanded((current) => { const next = new Set(current); next.has(row.id) ? next.delete(row.id) : next.add(row.id); return next; })} type="button">{hasVariants ? open ? <ChevronDown size={17} /> : <ChevronRight size={17} /> : <span className="inventory-product__spacer" />}<span><strong>{text(row.name, language)}</strong>{hasVariants && <small>{row.variants.length} {copy.variants}</small>}</span></button></td>
                  <td>{text(brandById.get(String(row.brandId))?.name, language) || "—"}</td><td>{text(categoryById.get(String(row.mainCategoryId))?.name, language) || "—"}</td><td>{text(categoryById.get(String(row.subcategoryId))?.name, language) || "—"}</td><td>{row.sku || "—"}</td>
                  <td>{hasVariants ? row.stock : <input className="inventory-stock-input" min="0" type="number" disabled={!canManage} value={drafts[row.id] ?? row.stock} onChange={(event) => setDraft(row.id, event.target.value)} />}</td>
                  <td><span className={`inventory-status is-${tone}`}>{copy[tone]}</span></td><td>{row.updatedAt ? new Intl.DateTimeFormat(language === "ar" ? "ar" : "en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(row.updatedAt)) : "—"}</td>
                  <td><button className="admin-primary-button inventory-save" disabled={!canManage || saving === row.id} onClick={() => saveRow(row)} type="button">{saving === row.id ? "…" : copy.save}</button></td>
                </tr>{open && row.variants.map((variant) => { const key = `${row.id}:${variant.id}`; const variantTone = statusFor(Number(drafts[key] ?? variant.stock)); return <tr className="inventory-variant-row" key={variant.id}><td colSpan="4"><span>{text(variant.colorName, language)}{text(variant.size, language) ? ` · ${text(variant.size, language)}` : ""}</span></td><td>{variant.sku || row.sku || "—"}</td><td><input className="inventory-stock-input" min="0" type="number" disabled={!canManage} value={drafts[key] ?? variant.stock} onChange={(event) => setDraft(key, event.target.value)} /></td><td><span className={`inventory-status is-${variantTone}`}>{copy[variantTone]}</span></td><td colSpan="2" /></tr>; })}</React.Fragment>;
              }) : <tr><td colSpan="9">{copy.empty}</td></tr>}</tbody></table>
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
