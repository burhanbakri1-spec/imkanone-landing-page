import React from "react";
import { ImagePlus } from "lucide-react";
import { MediaEditor } from "./WebsiteMediaManager.jsx";
import {
  SITE_MEDIA_SLOTS,
  brandMediaSlots,
  categoryHeroMediaSlots,
  productMediaSlots,
  resolveMediaSlot,
} from "../data/mediaSlots.js";

const groupLabels = {
  site: { en: "Storefront Heroes", ar: "واجهات الموقع" },
  brands: { en: "Brand Heroes", ar: "واجهات العلامات" },
  categories: { en: "Category Heroes", ar: "أقسام الصفحة" },
  products: { en: "Product Usage Media", ar: "وسائط استخدام المنتجات" },
};

function buildSlots({ brands = [], categories = [], products = [] }) {
  const site = SITE_MEDIA_SLOTS.map((slot) => ({ ...slot, scope: "site", scopeLabel: "" }));
  const brandSlots = brands.flatMap((brand) =>
    brandMediaSlots(brand.slug || brand.id).map((slot) => ({
      ...slot,
      scope: "brands",
      scopeLabel: brand.name || brand.slug || brand.id,
    })),
  );
  const categorySlots = categories.flatMap((category) =>
    categoryHeroMediaSlots(category.slug || category.id).map((slot) => ({
      ...slot,
      scope: "categories",
      scopeLabel: category.name?.en || category.name || category.slug || category.id,
    })),
  );
  const productSlots = products.flatMap((product) =>
    productMediaSlots(product.slug || product.id).map((slot) => ({
      ...slot,
      scope: "products",
      scopeLabel: product.name?.en || product.name || product.slug || product.id,
    })),
  );
  return { site, brands: brandSlots, categories: categorySlots, products: productSlots };
}

function slotDraft(slot) {
  return {
    id: "",
    sectionKey: slot.key,
    sectionLabel: slot.scopeLabel ? `${slot.labelEn} (${slot.scopeLabel})` : slot.labelEn,
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

function SlotGroup({ groupKey, entries, language, onDelete, onSave }) {
  const isArabic = language === "ar";
  if (!entries.length) return null;
  return (
    <section className="website-media-group">
      <h3>{groupLabels[groupKey]?.[language] || groupKey.replaceAll("_", " ")}</h3>
      <div className="website-media-grid">
        {entries.map(({ slot, item }) => (
          <MediaEditor
            item={item}
            key={slot.key}
            language={language}
            lockSectionKey
            onDelete={onDelete}
            onSave={onSave}
          />
        ))}
      </div>
    </section>
  );
}

function MediaSlotsManager({ brands = [], categories = [], error = "", items = [], language = "en", onDelete, onSave, products = [] }) {
  const isArabic = language === "ar";
  const registeredItems = React.useMemo(() => (Array.isArray(items) ? items : []), [items]);
  const slots = React.useMemo(() => buildSlots({ brands, categories, products }), [brands, categories, products]);

  function entryFor(slot) {
    return {
      slot,
      item: resolveMediaSlot(registeredItems, slot.key) || slotDraft(slot),
    };
  }

  return (
    <section className="website-media-manager">
      <header className="website-media-head">
        <div>
          <h2>{isArabic ? "وسائط المتجر" : "Storefront Media"}</h2>
          <p>
            {isArabic
              ? "أدر واجهات الموقع، العلامات، الأقسام، وفيديوهات استخدام المنتجات."
              : "Manage storefront heroes, brand visuals, category heroes, and product usage videos."}
          </p>
        </div>
      </header>

      {error && (
        <p className="website-media-message" role="alert">
          {error}
        </p>
      )}

      <SlotGroup groupKey="site" entries={slots.site.map(entryFor)} language={language} onDelete={onDelete} onSave={onSave} />
      <SlotGroup groupKey="brands" entries={slots.brands.map(entryFor)} language={language} onDelete={onDelete} onSave={onSave} />
      <SlotGroup groupKey="categories" entries={slots.categories.map(entryFor)} language={language} onDelete={onDelete} onSave={onSave} />
      <SlotGroup groupKey="products" entries={slots.products.map(entryFor)} language={language} onDelete={onDelete} onSave={onSave} />

      {!error && slots.site.length + slots.brands.length + slots.categories.length + slots.products.length === 0 && (
        <p className="website-media-message">
          {isArabic ? "لا توجد وسائط متجر محددة بعد." : "No storefront media slots have been configured yet."}
        </p>
      )}
    </section>
  );
}

export default MediaSlotsManager;
