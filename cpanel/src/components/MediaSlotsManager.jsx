import React from "react";
import { ChevronDown, ChevronUp, ImageOff, ImagePlus, Save, Trash2, Upload } from "lucide-react";
import { uploadImage } from "../utils/api.js";
import { withWebsiteMediaVersion } from "../data/websiteMedia.js";
import { MediaEditor } from "./WebsiteMediaManager.jsx";
import {
  PARENT_BRAND,
  SITE_LOGO_SLOT,
  SITE_MEDIA_SLOTS,
  aboutImageSlots,
  newsImageSlots,
} from "../data/mediaSlots.js";

const groupLabels = {
  identity: { en: "VELVET", ar: "VELVET" },
  about: { en: "About", ar: "من نحن" },
  news: { en: "News", ar: "الأخبار" },
  contact: { en: "Contact", ar: "الاتصال" },
};

function groupLabel(groupKey, language) {
  return groupLabels[groupKey]?.[language] || groupKey.replaceAll("_", " ");
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

function MediaSlotsManager({ error = "", items = [], language = "en", onDelete, onSave }) {
  const isArabic = language === "ar";

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

  return (
    <section className="website-media-manager">
      <header className="website-media-head">
        <div>
          <h2>{isArabic ? "وسائط المتجر" : "Storefront Media"}</h2>
          <p>
            {isArabic
              ? "أدر شعار الموقع وصور من نحن والأخبار والاتصال. تُدار وسائط العلامات والأقسام والمنتجات من نماذجها الخاصة."
              : "Manage the VELVET site logo and the about/news/contact visuals. Brand, category and product media is managed from their own forms."}
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

      <Accordion summary={groupLabel("about", language)} count={aboutSlots.length}>
        <SlotCards slots={aboutSlots} entries={entries} language={language} onDelete={onDelete} onSave={onSave} />
      </Accordion>

      <Accordion summary={groupLabel("news", language)} count={newsSlots.length}>
        <SlotCards slots={newsSlots} entries={entries} language={language} onDelete={onDelete} onSave={onSave} />
      </Accordion>

      <Accordion summary={groupLabel("contact", language)} count={contactSlots.length}>
        <SlotCards slots={contactSlots} entries={entries} language={language} onDelete={onDelete} onSave={onSave} />
      </Accordion>

      {!error && SITE_MEDIA_SLOTS.length === 0 && (
        <p className="website-media-message">
          {isArabic ? "لا توجد وسائط متجر محددة بعد." : "No storefront media slots have been configured yet."}
        </p>
      )}
    </section>
  );
}

export default MediaSlotsManager;
