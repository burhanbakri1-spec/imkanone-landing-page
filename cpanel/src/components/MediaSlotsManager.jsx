import React from "react";
import { ChevronDown, ChevronUp, ImageOff, ImagePlus, Save, Search, Trash2, Upload } from "lucide-react";
import { uploadImage } from "../utils/api.js";
import { withWebsiteMediaVersion } from "../data/websiteMedia.js";
import { MediaEditor } from "./WebsiteMediaManager.jsx";
import {
  PARENT_BRAND,
  SITE_LOGO_SLOT,
  SITE_MEDIA_SLOTS,
  VELVET_BRANCHES,
  aboutImageSlots,
  brandMediaSlots,
  categoryHeroMediaSlots,
  newsImageSlots,
  productMediaSlots,
} from "../data/mediaSlots.js";

const groupLabels = {
  identity: { en: "VELVET", ar: "VELVET" },
  brands: { en: "VELVET Branches", ar: "فروع VELVET" },
  categories: { en: "Categories", ar: "الأقسام" },
  products: { en: "Products", ar: "المنتجات" },
  about: { en: "About", ar: "من نحن" },
  news: { en: "News", ar: "الأخبار" },
  contact: { en: "Contact", ar: "الاتصال" },
};

function groupLabel(groupKey, language) {
  return groupLabels[groupKey]?.[language] || groupKey.replaceAll("_", " ");
}

function entityName(entity, language) {
  const name = entity?.name;
  if (!name) return entity?.slug || entity?.id || "";
  if (typeof name === "string") return name;
  return name[language] || name.en || name.ar || entity.slug || entity.id || "";
}

function slotDraft(slot) {
  return {
    id: "",
    sectionKey: slot.key,
    sectionLabel: slot.labelEn,
    groupKey: slot.groupKey,
    imageUrl: "",
    videoUrl: "",
    mediaType: slot.kind,
    title: "",
    subtitle: "",
    linkUrl: "",
    sortOrder: 0,
    isActive: true,
  };
}

function matchText(value) {
  return String(value || "").toLowerCase();
}

function productSearchable(product) {
  const name = product?.name || {};
  const nameText = typeof name === "string" ? name : `${name.en || ""} ${name.ar || ""}`;
  return matchText(`${nameText} ${product?.slug || ""} ${product?.sku || ""} ${product?.id || ""}`);
}

function Accordion({ summary, count, defaultOpen = false, children }) {
  const [open, setOpen] = React.useState(defaultOpen);
  const isArabic = document.documentElement.lang === "ar";
  return (
    <section className="website-media-accordion">
      <button
        aria-expanded={open}
        className="website-media-accordion-toggle"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span className="website-media-accordion-summary">{summary}</span>
        {Number(count) > 0 && <span className="website-media-accordion-count">{count}</span>}
        {open ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
        <span className="sr-only">{open ? (isArabic ? "طيّ" : "Collapse") : (isArabic ? "توسيع" : "Expand")}</span>
      </button>
      {open && <div className="website-media-accordion-body">{children}</div>}
    </section>
  );
}

function LogoEditor({ item, language, onSave, label }) {
  const [draft, setDraft] = React.useState(item);
  const [uploading, setUploading] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const isArabic = language === "ar";

  React.useEffect(() => setDraft(item), [item]);

  function update(name, value) {
    setDraft((current) => ({ ...current, [name]: value }));
  }

  async function handleUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      setUploading(true);
      setMessage("");
      const result = await uploadImage(file);
      update("imageUrl", result.url || result.path || "");
      setMessage(isArabic ? "تم رفع الشعار. اضغط حفظ لتطبيق التغيير." : "Logo uploaded. Press Save to apply.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    try {
      setMessage("");
      const saved = await onSave({ ...draft, sortOrder: Number(draft.sortOrder || 0) });
      if (saved) setDraft(saved);
      setMessage(isArabic ? "تم حفظ الشعار." : "Logo saved.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function handleClear() {
    const nextDraft = { ...draft, imageUrl: "" };
    setDraft(nextDraft);
    try {
      setMessage("");
      const saved = await onSave(nextDraft);
      if (saved) setDraft(saved);
      setMessage(isArabic ? "تمت إزالة الشعار." : "Logo removed.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <article className="website-media-card website-media-logo-card">
      <div className="website-media-preview website-media-logo-preview">
        {draft.imageUrl ? (
          <img
            alt={label || draft.sectionLabel || (isArabic ? "الشعار" : "Logo")}
            src={withWebsiteMediaVersion(draft.imageUrl, draft.updatedAt || draft.id)}
          />
        ) : (
          <ImagePlus aria-hidden="true" size={30} />
        )}
        <span>{label || (isArabic ? "الشعار" : "Logo")}</span>
      </div>
      <div className="website-media-fields">
        <label className="full-field">
          {isArabic ? "رابط الشعار" : "Logo URL"}
          <input value={draft.imageUrl} onChange={(event) => update("imageUrl", event.target.value)} />
        </label>
      </div>
      <div className="website-media-actions">
        <label className="admin-upload-button">
          <Upload size={15} />
          {uploading ? (isArabic ? "جاري الرفع..." : "Uploading...") : (isArabic ? "رفع / استبدال" : "Upload / Replace")}
          <input accept="image/*" disabled={uploading} hidden onChange={handleUpload} type="file" />
        </label>
        <button className="website-media-clear" disabled={!draft.imageUrl} onClick={handleClear} type="button">
          <ImageOff size={15} />
          {isArabic ? "إزالة الشعار" : "Remove logo"}
        </button>
        <button className="admin-primary-button" onClick={handleSave} type="button">
          <Save size={15} />
          {isArabic ? "حفظ" : "Save"}
        </button>
        {draft.id && (
          <button className="website-media-delete" onClick={() => onSave({ ...draft, imageUrl: "" })} type="button">
            <Trash2 size={15} />
            {isArabic ? "حذف" : "Delete"}
          </button>
        )}
      </div>
      {message && <p className="website-media-message">{message}</p>}
    </article>
  );
}

function ParentBrandGroup({ logoItem, homeSlots, entries, language, onDelete, onSave }) {
  return (
    <div className="website-media-group-inner">
      <p className="website-media-group-hint">
        {language === "ar"
          ? `الشعار المعروض في ترويسة الموقع (${PARENT_BRAND.name.ar}). عند عدم رفعه يظهر شعار الموقع الافتراضي.`
          : `The logo shown in the storefront header (${PARENT_BRAND.name.en}). When empty the storefront falls back to its own logo.`}
      </p>
      <LogoEditor item={logoItem} language={language} onSave={onSave} label={PARENT_BRAND.name[language]} />
      <SlotCards slots={homeSlots} entries={entries} language={language} onDelete={onDelete} onSave={onSave} />
    </div>
  );
}

function CategoryImageEditor({ category, language, onSaveCategory }) {
  const [draft, setDraft] = React.useState(category);
  const [uploading, setUploading] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const isArabic = language === "ar";

  React.useEffect(() => setDraft(category), [category]);

  async function handleUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      setUploading(true);
      setMessage("");
      const result = await uploadImage(file);
      setDraft((current) => ({ ...current, imageUrl: result.url || result.path || "" }));
      setMessage(isArabic ? "تم رفع الصورة. اضغط حفظ لتطبيق التغيير." : "Image uploaded. Press Save to apply.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    try {
      setMessage("");
      const saved = await onSaveCategory(draft);
      if (saved) setDraft(saved);
      setMessage(isArabic ? "تم حفظ صورة القسم." : "Category image saved.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  const previewUrl = draft?.imageUrl
    ? withWebsiteMediaVersion(draft.imageUrl, draft?.updatedAt || draft?.id)
    : "";

  return (
    <article className="website-media-card website-media-logo-card">
      <div className="website-media-preview website-media-logo-preview">
        {previewUrl ? <img alt={entityName(category, language)} src={previewUrl} /> : <ImagePlus aria-hidden="true" size={30} />}
        <span>{isArabic ? "صورة القسم" : "Category image"}</span>
      </div>
      <div className="website-media-fields">
        <label className="full-field">
          {isArabic ? "رابط الصورة" : "Image URL"}
          <input value={draft?.imageUrl || ""} onChange={(event) => setDraft((current) => ({ ...current, imageUrl: event.target.value }))} />
        </label>
      </div>
      <div className="website-media-actions">
        <label className="admin-upload-button">
          <Upload size={15} />
          {uploading ? (isArabic ? "جاري الرفع..." : "Uploading...") : (isArabic ? "رفع / استبدال" : "Upload / Replace")}
          <input accept="image/*" disabled={uploading} hidden onChange={handleUpload} type="file" />
        </label>
        <button className="admin-primary-button" onClick={handleSave} type="button">
          <Save size={15} />
          {isArabic ? "حفظ" : "Save"}
        </button>
      </div>
      {message && <p className="website-media-message">{message}</p>}
    </article>
  );
}

function SlotCards({ slots, entries, language, onDelete, onSave }) {
  const rendered = slots.map((slot) => {
    const entry = entries[slot.key] || slotDraft(slot);
    return (
      <MediaEditor
        item={entry}
        key={slot.key}
        language={language}
        lockSectionKey
        onDelete={onDelete}
        onSave={onSave}
      />
    );
  });
  return <div className="website-media-grid">{rendered}</div>;
}

function MediaSlotsManager({ brands = [], categories = [], error = "", items = [], language = "en", onDelete, onSave, onSaveCategory, products = [] }) {
  const isArabic = language === "ar";
  const [productQuery, setProductQuery] = React.useState("");

  const registeredItems = React.useMemo(() => (Array.isArray(items) ? items : []), [items]);

  const entries = React.useMemo(() => {
    const map = {};
    for (const item of registeredItems) {
      if (!item?.sectionKey) continue;
      const current = map[item.sectionKey];
      if (!current || new Date(item.updatedAt || 0).getTime() >= new Date(current.updatedAt || 0).getTime()) {
        map[item.sectionKey] = item;
      }
    }
    return map;
  }, [registeredItems]);

  function entryFor(slot) {
    return entries[slot.key] || slotDraft(slot);
  }

  const siteSlots = SITE_MEDIA_SLOTS;
  const homeSlots = siteSlots.filter((slot) => slot.groupKey === "home");
  const aboutHeroSlots = siteSlots.filter((slot) => slot.groupKey === "about");
  const contactSlots = siteSlots.filter((slot) => slot.groupKey === "contact");
  const aboutSlots = [...aboutHeroSlots, ...aboutImageSlots()];
  const newsSlots = newsImageSlots();

  // Render EVERY actual VELVET branch from the canonical i-play catalog, plus
  // any extra brand rows the CPanel knows about that are not in the catalog.
  const branchGroups = VELVET_BRANCHES.map((branch) => ({
    key: branch.slug,
    label: branch.name[language] || branch.name.en || branch.slug,
    slots: brandMediaSlots(branch.slug),
  }));
  for (const brand of brands) {
    const slug = String(brand.slug || brand.id || "").trim();
    if (!slug) continue;
    if (branchGroups.some((group) => group.key === slug)) continue;
    branchGroups.push({
      key: slug,
      label: entityName(brand, language),
      slots: brandMediaSlots(slug),
    });
  }

  const categoryGroups = categories.map((category) => ({
    key: category.id || category.slug || category.name,
    label: entityName(category, language),
    category,
    slots: categoryHeroMediaSlots(category.slug || category.id),
  }));
  const productGroups = products.map((product) => ({
    key: product.id || product.slug || product.name,
    label: entityName(product, language),
    slots: productMediaSlots(product.slug || product.id),
    searchable: productSearchable(product),
  }));

  const trimmedQuery = productQuery.trim().toLowerCase();
  const filteredProducts = trimmedQuery
    ? productGroups.filter((group) => group.searchable.includes(trimmedQuery))
    : productGroups;

  return (
    <section className="website-media-manager">
      <header className="website-media-head">
        <div>
          <h2>{isArabic ? "وسائط المتجر" : "Storefront Media"}</h2>
          <p>
            {isArabic
              ? "أدر شعار الموقع، فروع VELVET، صور الأقسام، فيديوهات استخدام المنتجات، وصور من نحن والأخبار."
              : "Manage the VELVET site logo, branches, category visuals, product usage videos, and about/news images."}
          </p>
        </div>
      </header>

      {error && (
        <p className="website-media-message" role="alert">
          {error}
        </p>
      )}

      <Accordion summary={groupLabel("identity", language)} count={1 + homeSlots.length}>
        <ParentBrandGroup
          entries={entries}
          homeSlots={homeSlots}
          language={language}
          logoItem={entryFor(SITE_LOGO_SLOT)}
          onDelete={onDelete}
          onSave={onSave}
        />
      </Accordion>

      <Accordion summary={groupLabel("brands", language)} count={branchGroups.length}>
        <div className="website-media-accordion-nested">
          {branchGroups.map((group) => (
            <Accordion key={group.key} summary={group.label} count={group.slots.length}>
              <div className="website-media-accordion-nested">
                <LogoEditor
                  item={entryFor({ key: `brand.${group.key}.logo`, kind: "image", groupKey: "brands" })}
                  language={language}
                  onSave={onSave}
                  label={group.label}
                />
              </div>
              <SlotCards slots={group.slots.slice(1)} entries={entries} language={language} onDelete={onDelete} onSave={onSave} />
            </Accordion>
          ))}
        </div>
      </Accordion>

      <Accordion summary={groupLabel("categories", language)} count={categoryGroups.length}>
        <div className="website-media-accordion-nested">
          {categoryGroups.map((group) => (
            <Accordion key={group.key} summary={group.label} count={group.slots.length + 1}>
              <div className="website-media-accordion-nested">
                <CategoryImageEditor
                  category={group.category}
                  language={language}
                  onSaveCategory={onSaveCategory}
                />
                <SlotCards slots={group.slots} entries={entries} language={language} onDelete={onDelete} onSave={onSave} />
              </div>
            </Accordion>
          ))}
        </div>
      </Accordion>

      <Accordion summary={groupLabel("products", language)} count={filteredProducts.length}>
        <div className="website-media-search">
          <Search size={16} aria-hidden="true" />
          <input
            aria-label={isArabic ? "ابحث عن منتج" : "Search products"}
            onChange={(event) => setProductQuery(event.target.value)}
            placeholder={isArabic ? "ابحث عن منتج..." : "Search products..."}
            type="search"
            value={productQuery}
          />
        </div>
        <div className="website-media-accordion-nested">
          {filteredProducts.map((group) => (
            <Accordion key={group.key} summary={group.label} count={group.slots.length}>
              <SlotCards slots={group.slots} entries={entries} language={language} onDelete={onDelete} onSave={onSave} />
            </Accordion>
          ))}
          {filteredProducts.length === 0 && (
            <p className="website-media-message">
              {isArabic ? "لا توجد منتجات مطابقة." : "No products match your search."}
            </p>
          )}
        </div>
      </Accordion>

      <Accordion summary={groupLabel("about", language)} count={aboutSlots.length}>
        <SlotCards slots={aboutSlots} entries={entries} language={language} onDelete={onDelete} onSave={onSave} />
      </Accordion>

      <Accordion summary={groupLabel("news", language)} count={newsSlots.length}>
        <SlotCards slots={newsSlots} entries={entries} language={language} onDelete={onDelete} onSave={onSave} />
      </Accordion>

      <Accordion summary={groupLabel("contact", language)} count={contactSlots.length}>
        <SlotCards slots={contactSlots} entries={entries} language={language} onDelete={onDelete} onSave={onSave} />
      </Accordion>

      {!error && SITE_MEDIA_SLOTS.length + VELVET_BRANCHES.length + categories.length + products.length === 0 && (
        <p className="website-media-message">
          {isArabic ? "لا توجد وسائط متجر محددة بعد." : "No storefront media slots have been configured yet."}
        </p>
      )}
    </section>
  );
}

export default MediaSlotsManager;
