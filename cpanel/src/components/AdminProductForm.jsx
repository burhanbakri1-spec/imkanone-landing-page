import React from "react";
import { uploadImage, uploadImages } from "../utils/api.js";
import { getSelectableAdminCategories, readAdminCategories } from "../utils/adminCategories.js";

const placeholderImage = "/images/products/product-placeholder.svg";

const emptyForm = {
  id: "",
  slug: "",
  nameEn: "",
  nameAr: "",
  categoryId: "home-cleaning",
  shortEn: "",
  shortAr: "",
  image: placeholderImage,
  hoverImage: "",
  productsPageImage: "",
  productsPageHoverImage: "",
  galleryImages: [],
  variants: [],
  badgeEn: "Featured",
  badgeAr: "منتج مميز",
  stockStatus: "In stock",
  detailStatements: [],
};

function normalizeVariant(variant = {}, index = 0, product = {}) {
  return {
    id: variant.id || `${product.id || "product"}-variant-${index}`,
    color_name: variant.color_name || variant.colorName || "Default",
    color_value: variant.color_value || variant.colorValue || "",
    size: variant.size || product.sizes?.[0]?.size || "500ml",
    price: Number(variant.price ?? product.sizes?.[0]?.price ?? 0),
    stock: Math.max(0, Number(variant.stock ?? variant.stockQty ?? product.stockQty ?? 0)),
    image_url: variant.image_url || variant.imageUrl || variant.image || "",
    sort_order: Number(variant.sort_order ?? variant.sortOrder ?? index),
  };
}

function cleanupDuplicateVariants(variants) {
  const groups = new Map();

  variants.forEach((variant) => {
    const key = `${(variant.color_name || "").toLowerCase()}|${(variant.color_value || "").toLowerCase()}|${(variant.size || "").toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(variant);
  });

  const result = [];
  groups.forEach((group) => {
    if (group.length === 1) {
      result.push(group[0]);
      return;
    }

    const best = group.reduce((a, b) => {
      const score = (v) =>
        (v.image_url ? 100 : 0) +
        (v.price && Number(v.price) > 0 ? 10 : 0) +
        (v.stock !== undefined && v.stock !== null && Number(v.stock) >= 0 ? 5 : 0) +
        (v.id ? 2 : 0);
      return score(a) >= score(b) ? a : b;
    });

    const bestImage = best.image_url || group.find((v) => v.image_url)?.image_url || "";
    result.push({ ...best, image_url: bestImage });
  });

  return result;
}

function normalizeGalleryImages(product = {}) {
  product = product || {};
  const source = product.gallery_images || product.galleryImages || [];
  return source
    .map((entry, index) => ({
      id: typeof entry === "object" && entry?.id ? entry.id : `gallery-${index}`,
      image_url: typeof entry === "string" ? entry : entry?.image_url || entry?.image || entry?.url || "",
      sort_order: Number(typeof entry === "object" ? entry?.sort_order ?? entry?.sortOrder ?? index : index),
    }))
    .filter((entry) => entry.image_url);
}

function normalizeVariants(product = {}) {
  product = product || {};
  if (Array.isArray(product.variants) && product.variants.length) {
    return product.variants.map((variant, index) => normalizeVariant(variant, index, product));
  }

  return (product.sizes || []).map((sizeOption, index) =>
    normalizeVariant(
      {
        color_name: "Default",
        size: sizeOption.size,
        price: sizeOption.price,
        stock: product.stockQty ?? 24,
        image_url: product.image || "",
      },
      index,
      product,
    ),
  );
}

function createDefaultVariant(product = {}) {
  return normalizeVariant(
    {
      color_name: "Default",
      color_value: "#1db7d8",
      size: product.sizes?.[0]?.size || "500ml",
      price: product.sizes?.[0]?.price ?? 18,
      stock: product.stockQty ?? 24,
      image_url: product.image || "",
    },
    0,
    product,
  );
}

function sizesFromVariants(variants) {
  const bySize = new Map();
  variants.forEach((variant) => {
    if (!variant.size) return;
    const current = bySize.get(variant.size);
    if (!current || Number(variant.price) < Number(current.price)) {
      bySize.set(variant.size, { size: variant.size, price: Number(variant.price || 0) });
    }
  });
  return bySize.size ? Array.from(bySize.values()) : [{ size: "500ml", price: 18 }];
}

function createEmptyForm() {
  return {
    ...emptyForm,
    galleryImages: [],
    variants: [createDefaultVariant(emptyForm)],
  };
}

function getCategoryLabel(category, language = "en") {
  const name = category?.name;
  if (!name) return category?.id || "";
  if (typeof name === "string") return name;
  return name[language] || name.en || name.ar || category.id || "";
}

function createGalleryImageEntry(index = 0, imageUrl = "") {
  return {
    id: `gallery-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    image_url: imageUrl,
    sort_order: index,
  };
}

function parseGeneratorColors(value = "") {
  const seen = new Set();
  const result = [];

  value
    .split(/\n|;/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const [name = "", colorValue = "", imageUrl = ""] = line.split("|").map((part) => part.trim());
      const colorName = name || "Default";
      const hex = (colorValue || "#1db7d8").toLowerCase();
      const key = `${colorName.toLowerCase()}|${hex}`;
      if (seen.has(key)) return;
      seen.add(key);
      result.push({ name: colorName, value: hex, imageUrl });
    });

  return result;
}

function parseGeneratorSizes(value = "") {
  return value
    .split(/\n|,|;/)
    .map((size) => size.trim())
    .filter(Boolean);
}

function productToForm(product) {
  if (!product) {
    return createEmptyForm();
  }

  const dsi = product.detailSectionImages || product.detail_section_images || {};

  return {
    id: product.id,
    slug: product.slug,
    nameEn: product.name.en,
    nameAr: product.name.ar,
    categoryId: product.categoryId,
    shortEn: product.shortDescription.en,
    shortAr: product.shortDescription.ar,
    image: product.image || placeholderImage,
    hoverImage: product.hoverImage || product.secondaryImage || "",
    productsPageImage: product.productsPageImage || "",
    productsPageHoverImage: product.productsPageHoverImage || "",
    galleryImages: normalizeGalleryImages(product),
    variants: normalizeVariants(product).length ? normalizeVariants(product) : [createDefaultVariant(product)],
    badgeEn: product.badge?.en || "Featured",
    badgeAr: product.badge?.ar || "منتج مميز",
    stockStatus: product.stockStatus || "In stock",
    dsiHowItWorks: dsi.howItWorks || "",
    dsiHowItWorks1: dsi.howItWorks1 || "",
    dsiHowItWorks2: dsi.howItWorks2 || "",
    dsiHowItWorks3: dsi.howItWorks3 || "",
    dsiImpact: dsi.impact || "",
    dsiImpact1: dsi.impact1 || "",
    dsiImpact2: dsi.impact2 || "",
    dsiSafeToUse: dsi.safeToUse || "",
    dsiPracticalBanner: dsi.practicalBanner || "",
    dsiIngredients: dsi.ingredients || "",
    dsiFaq: dsi.faq || "",
    dsiMainImage: dsi.mainImage || "",
    detailStatements: product.detailStatements || product.detail_statements || [],
  };
}

function AdminProductForm({ categoryOptions, editingProduct, language, onCancel, onSave, t }) {
  const [form, setForm] = React.useState(() => productToForm(editingProduct));
  const [isSaving, setIsSaving] = React.useState(false);
  const [uploadingField, setUploadingField] = React.useState("");
  const [uploadError, setUploadError] = React.useState("");
  const [uploadingVariantIndex, setUploadingVariantIndex] = React.useState(-1);
  const [uploadingGalleryIndex, setUploadingGalleryIndex] = React.useState(-1);
  const [variantGenerator, setVariantGenerator] = React.useState({
    colorsText: "Default|#1db7d8",
    sizesText: "500ml, 1L, 5L",
    defaultPrice: "18",
    defaultStock: "24",
  });

  React.useEffect(() => {
    setForm(productToForm(editingProduct));
    setUploadError("");
  }, [editingProduct]);

  const availableCategories = getSelectableAdminCategories(
    categoryOptions || readAdminCategories(),
    form.categoryId,
  );

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  async function handleImageUpload(fieldName, event) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setUploadError("");
    setUploadingField(fieldName);

    try {
      const result = await uploadImage(file);
      setForm((currentForm) => ({
        ...currentForm,
        [fieldName]: result.url || result.path || currentForm[fieldName],
      }));
    } catch (error) {
      setUploadError(error.message || "Image upload failed.");
    } finally {
      setUploadingField("");
    }
  }

  async function handleGalleryUpload(event) {
    const files = event.target.files;
    event.target.value = "";

    if (!files?.length) {
      return;
    }

    setUploadError("");
    setUploadingField("galleryImages");

    try {
      const uploaded = await uploadImages(files);
      setForm((currentForm) => {
        const currentImages = currentForm.galleryImages || [];
        const nextImages = uploaded
          .map((item, index) => ({
            id: `gallery-${Date.now()}-${index}`,
            image_url: item.url || item.path,
            sort_order: currentImages.length + index,
          }))
          .filter((item) => item.image_url);
        return {
          ...currentForm,
          galleryImages: [...currentImages, ...nextImages],
        };
      });
    } catch (error) {
      setUploadError(error.message || "Images upload failed.");
    } finally {
      setUploadingField("");
    }
  }

  function removeGalleryImage(index) {
    setForm((currentForm) => ({
      ...currentForm,
      galleryImages: (currentForm.galleryImages || [])
        .filter((_, imageIndex) => imageIndex !== index)
        .map((image, sortIndex) => ({ ...image, sort_order: sortIndex })),
    }));
  }

  function addGalleryImageField() {
    setForm((currentForm) => {
      const currentImages = currentForm.galleryImages || [];
      return {
        ...currentForm,
        galleryImages: [...currentImages, createGalleryImageEntry(currentImages.length)],
      };
    });
  }

  function updateGalleryImage(index, value) {
    setForm((currentForm) => ({
      ...currentForm,
      galleryImages: (currentForm.galleryImages || []).map((image, imageIndex) =>
        imageIndex === index ? { ...image, image_url: value } : image,
      ),
    }));
  }

  async function handleGalleryItemUpload(index, event) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setUploadError("");
    setUploadingGalleryIndex(index);

    try {
      const result = await uploadImage(file);
      updateGalleryImage(index, result.url || result.path || "");
    } catch (error) {
      setUploadError(error.message || "Gallery image upload failed.");
    } finally {
      setUploadingGalleryIndex(-1);
    }
  }

  function addVariant() {
    setForm((currentForm) => ({
      ...currentForm,
      variants: [
        ...(currentForm.variants || []),
        normalizeVariant(
          {
            color_name: "",
            color_value: "#1db7d8",
            size: "",
            price: 0,
            stock: 0,
            image_url: currentForm.image || "",
          },
          currentForm.variants?.length || 0,
          currentForm,
        ),
      ],
    }));
  }

  function updateVariant(index, field, value) {
    setForm((currentForm) => ({
      ...currentForm,
      variants: (currentForm.variants || []).map((variant, variantIndex) =>
        variantIndex === index ? { ...variant, [field]: value } : variant,
      ),
    }));
  }

  function removeVariant(index) {
    setForm((currentForm) => ({
      ...currentForm,
      variants: (currentForm.variants || []).filter((_, variantIndex) => variantIndex !== index),
    }));
  }

  function updateVariantGenerator(field, value) {
    setVariantGenerator((currentGenerator) => ({
      ...currentGenerator,
      [field]: value,
    }));
  }

  function generateVariants() {
    const colors = parseGeneratorColors(variantGenerator.colorsText);
    const sizes = parseGeneratorSizes(variantGenerator.sizesText);

    if (!colors.length || !sizes.length) {
      setUploadError(language === "ar" ? "أضف لونًا وحجمًا واحدًا على الأقل." : "Add at least one color and one size.");
      return;
    }

    setUploadError("");
    setForm((currentForm) => {
      const currentVariants = currentForm.variants || [];
      const existingKeys = new Set(
        currentVariants.map(
          (variant) => `${(variant.color_name || "").toLowerCase()}|${(variant.color_value || "").toLowerCase()}|${(variant.size || "").toLowerCase()}`,
        ),
      );
      const generated = [];
      const batchKeys = new Set();

      colors.forEach((color) => {
        sizes.forEach((size) => {
          const key = `${color.name.toLowerCase()}|${color.value.toLowerCase()}|${size.toLowerCase()}`;
          if (existingKeys.has(key) || batchKeys.has(key)) return;
          batchKeys.add(key);

          generated.push(
            normalizeVariant(
              {
                color_name: color.name,
                color_value: color.value,
                size,
                price: variantGenerator.defaultPrice,
                stock: variantGenerator.defaultStock,
                image_url: color.imageUrl || currentForm.image || "",
              },
              currentVariants.length + generated.length,
              currentForm,
            ),
          );
        });
      });

      return {
        ...currentForm,
        variants: [...currentVariants, ...generated],
      };
    });
  }

  async function handleVariantImageUpload(index, event) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setUploadError("");
    setUploadingVariantIndex(index);

    try {
      const result = await uploadImage(file);
      updateVariant(index, "image_url", result.url || result.path || "");
    } catch (error) {
      setUploadError(error.message || "Variant image upload failed.");
    } finally {
      setUploadingVariantIndex(-1);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSaving(true);
    const slug =
      form.slug.trim() ||
      form.nameEn
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

    let variants = (form.variants || [])
      .filter((variant) => variant.color_name && variant.size)
      .map((variant, index) => ({
        ...normalizeVariant(variant, index, form),
        id: variant.id || `${form.id || slug}-variant-${index}`,
        price: Number(variant.price || 0),
        stock: Math.max(0, Number(variant.stock || 0)),
        sort_order: index,
      }));

    variants = cleanupDuplicateVariants(variants).map((v, i) => ({ ...v, sort_order: i }));
    const galleryImages = (form.galleryImages || [])
      .filter((image) => image.image_url)
      .map((image, index) => ({
        id: image.id || `gallery-${index}`,
        image_url: image.image_url,
        sort_order: index,
      }));

    const result = await onSave({
      id: form.id || `product-${Date.now()}`,
      slug,
      name: {
        en: form.nameEn,
        ar: form.nameAr,
      },
      categoryId: form.categoryId,
      shortDescription: {
        en: form.shortEn,
        ar: form.shortAr,
      },
      longDescription: {
        en: form.shortEn,
        ar: form.shortAr,
      },
      image: form.image || placeholderImage,
      hoverImage: form.hoverImage || "",
      productsPageImage: form.productsPageImage || "",
      productsPageHoverImage: form.productsPageHoverImage || "",
      fallbackImage: placeholderImage,
      variants,
      sizes: sizesFromVariants(variants),
      gallery_images: galleryImages,
      galleryImages: galleryImages.map((image) => image.image_url),
      badge: {
        en: form.badgeEn,
        ar: form.badgeAr,
      },
      stockStatus: form.stockStatus,
      detailSectionImages: {
        howItWorks: form.dsiHowItWorks || "",
        howItWorks1: form.dsiHowItWorks1 || "",
        howItWorks2: form.dsiHowItWorks2 || "",
        howItWorks3: form.dsiHowItWorks3 || "",
        impact: form.dsiImpact || "",
        impact1: form.dsiImpact1 || "",
        impact2: form.dsiImpact2 || "",
        safeToUse: form.dsiSafeToUse || "",
        practicalBanner: form.dsiPracticalBanner || "",
        ingredients: form.dsiIngredients || "",
        faq: form.dsiFaq || "",
        mainImage: form.dsiMainImage || "",
      },
      detailStatements: form.detailStatements || [],
      usageNotes: {
        en: "Product managed from the admin dashboard.",
        ar: "منتج يتم إدارته من لوحة التحكم.",
      },
    });
    setIsSaving(false);

    if (result?.ok && !editingProduct) {
      setForm(createEmptyForm());
    }
  }

  function renderImageField(fieldName, labelKey, uploadLabelKey, previewLabelKey) {
    const isUploading = uploadingField === fieldName;

    return (
      <label>
        {t(labelKey)}
        <span className="image-upload-row">
          <input name={fieldName} onChange={handleChange} value={form[fieldName]} />
          <span className="upload-button-shell">
            <input
              accept="image/*"
              aria-label={t(uploadLabelKey)}
              onChange={(event) => handleImageUpload(fieldName, event)}
              type="file"
            />
            <span>{isUploading ? t("admin.uploading") : t("admin.uploadImage")}</span>
          </span>
        </span>
        {form[fieldName] && (
          <img
            alt={t(previewLabelKey)}
            className="admin-image-preview"
            src={form[fieldName]}
            onError={(event) => {
              event.currentTarget.src = placeholderImage;
            }}
          />
        )}
      </label>
    );
  }

  return (
    <form className="admin-form" onSubmit={handleSubmit}>
      <h3>{editingProduct ? t("admin.editProduct") : t("admin.addProduct")}</h3>
      <label>
        {t("admin.productNameEn")}
        <input name="nameEn" onChange={handleChange} required value={form.nameEn} />
      </label>
      <label>
        {t("admin.productNameAr")}
        <input name="nameAr" onChange={handleChange} required value={form.nameAr} />
      </label>
      <label>
        {t("admin.category")}
        <select name="categoryId" onChange={handleChange} value={form.categoryId}>
          {availableCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {getCategoryLabel(category, language)}
            </option>
          ))}
        </select>
      </label>
      {renderImageField(
        "image",
        "admin.imagePath",
        "admin.uploadMainImage",
        "admin.mainImagePreview",
      )}
      {renderImageField(
        "hoverImage",
        "admin.secondImagePath",
        "admin.uploadHoverImage",
        "admin.hoverImagePreview",
      )}
      {(() => {
        const ppiUp = uploadingField === "productsPageImage";
        const pphiUp = uploadingField === "productsPageHoverImage";
        return (
          <>
            <label>
              {language === "ar" ? "صورة صفحة المنتجات" : "Products Page Image Path"}
              <span className="image-upload-row">
                <input name="productsPageImage" onChange={handleChange} value={form.productsPageImage || ""} />
                <span className="upload-button-shell">
                  <input accept="image/*" aria-label="Products Page Image" onChange={(e) => handleImageUpload("productsPageImage", e)} type="file" />
                  <span>{ppiUp ? t("admin.uploading") : t("admin.uploadImage")}</span>
                </span>
              </span>
              {form.productsPageImage && (
                <img alt="" className="admin-image-preview" src={form.productsPageImage}
                  onError={(e) => { e.currentTarget.src = placeholderImage; }} />
              )}
            </label>
            <label>
              {language === "ar" ? "صورة التمرير لصفحة المنتجات" : "Products Page Hover Image Path"}
              <span className="image-upload-row">
                <input name="productsPageHoverImage" onChange={handleChange} value={form.productsPageHoverImage || ""} />
                <span className="upload-button-shell">
                  <input accept="image/*" aria-label="Products Page Hover Image" onChange={(e) => handleImageUpload("productsPageHoverImage", e)} type="file" />
                  <span>{pphiUp ? t("admin.uploading") : t("admin.uploadImage")}</span>
                </span>
              </span>
              {form.productsPageHoverImage && (
                <img alt="" className="admin-image-preview" src={form.productsPageHoverImage}
                  onError={(e) => { e.currentTarget.src = placeholderImage; }} />
              )}
            </label>
          </>
        );
      })()}
      <div className="full-field">
        <strong>{language === "ar" ? "صور أقسام تفاصيل المنتج" : "Product Details Section Images"}</strong>
        <div className="admin-dsi-grid">
          {[
            { key: "dsiMainImage", label: language === "ar" ? "الصورة الرئيسية لتفاصيل المنتج" : "Product Details Main Image" },
            { key: "dsiHowItWorks1", label: language === "ar" ? "صورة طريقة الاستخدام 1" : "How it Works image 1" },
            { key: "dsiHowItWorks2", label: language === "ar" ? "صورة طريقة الاستخدام 2" : "How it Works image 2" },
            { key: "dsiHowItWorks3", label: language === "ar" ? "صورة طريقة الاستخدام 3" : "How it Works image 3" },
            { key: "dsiImpact1", label: language === "ar" ? "صورة التأثير 1" : "Impact section image 1" },
            { key: "dsiImpact2", label: language === "ar" ? "صورة التأثير 2" : "Impact section image 2" },
            { key: "dsiSafeToUse", label: language === "ar" ? "صورة قسم الأمان" : "Safe to use image" },
            { key: "dsiPracticalBanner", label: language === "ar" ? "صورة البانر" : "Practical banner image" },
            { key: "dsiIngredients", label: language === "ar" ? "صورة قسم المكونات" : "Ingredients section image" },
            { key: "dsiFaq", label: language === "ar" ? "صورة قسم الأسئلة" : "FAQ side image" },
          ].map(({ key, label }) => {
            const isUploading = uploadingField === key;
            return (
              <label key={key}>
                {label}
                <span className="image-upload-row">
                  <input name={key} onChange={handleChange} value={form[key] || ""} />
                  <span className="upload-button-shell">
                    <input
                      accept="image/*"
                      aria-label={label}
                      onChange={(event) => handleImageUpload(key, event)}
                      type="file"
                    />
                    <span>{isUploading ? t("admin.uploading") : t("admin.uploadImage")}</span>
                  </span>
                </span>
                {form[key] && (
                  <img
                    alt=""
                    className="admin-image-preview small-preview"
                    src={form[key]}
                    onError={(event) => { event.currentTarget.src = placeholderImage; }}
                  />
                )}
              </label>
            );
          })}
        </div>
      </div>
      <div className="full-field">
        <strong>{language === "ar" ? "عبارات بانر تفاصيل المنتج" : "Product Details Banner Statements"}</strong>
        <div className="admin-dsi-grid">
          {(form.detailStatements || []).map((statement, index) => (
            <div className="admin-media-field" key={index}>
              <label>
                {language === "ar" ? `البيان ${index + 1} - الإنجليزية` : `Statement ${index + 1} - English`}
                <input
                  value={statement.en || ""}
                  onChange={(event) => {
                    const updated = [...(form.detailStatements || [])];
                    updated[index] = { ...updated[index], en: event.target.value, ar: updated[index]?.ar || "" };
                    setForm((current) => ({ ...current, detailStatements: updated }));
                  }}
                />
              </label>
              <label>
                {language === "ar" ? `البيان ${index + 1} - العربية` : `Statement ${index + 1} - Arabic`}
                <input
                  value={statement.ar || ""}
                  onChange={(event) => {
                    const updated = [...(form.detailStatements || [])];
                    updated[index] = { ...updated[index], ar: event.target.value, en: updated[index]?.en || "" };
                    setForm((current) => ({ ...current, detailStatements: updated }));
                  }}
                />
              </label>
              <button
                className="text-action danger"
                onClick={() => {
                  const updated = (form.detailStatements || []).filter((_, i) => i !== index);
                  setForm((current) => ({ ...current, detailStatements: updated }));
                }}
                type="button"
              >
                {language === "ar" ? "إزالة" : "Remove"}
              </button>
            </div>
          ))}
          <button
            className="secondary-action compact-action"
            onClick={() =>
              setForm((current) => ({
                ...current,
                detailStatements: [...(current.detailStatements || []), { en: "", ar: "" }],
              }))
            }
            type="button"
          >
            {language === "ar" ? "+ إضافة بيان" : "+ Add statement"}
          </button>
        </div>
      </div>
      <div className="full-field admin-gallery-editor">
        <div className="admin-inline-heading">
          <strong>{language === "ar" ? "صور المعرض العمودي" : "Vertical Gallery Images"}</strong>
          <label className="upload-button-shell">
            <input
              accept="image/*"
              aria-label={language === "ar" ? "رفع صور المعرض" : "Upload gallery images"}
              multiple
              onChange={handleGalleryUpload}
              type="file"
            />
            <span>
              {uploadingField === "galleryImages"
                ? t("admin.uploading")
                : language === "ar"
                  ? "رفع صور المعرض"
                  : "Upload Gallery Images"}
            </span>
          </label>
          <button className="secondary-action compact-action" onClick={addGalleryImageField} type="button">
            {language === "ar" ? "+ إضافة خانة صورة" : "+ Add image field"}
          </button>
        </div>
        <div className="admin-gallery-preview-grid">
          {(form.galleryImages || []).map((image, index) => (
            <figure className="admin-gallery-preview" key={`${image.image_url}-${index}`}>
              <label>
                {language === "ar" ? "رابط الصورة" : "Image URL"}
                <span className="image-upload-row">
                  <input
                    value={image.image_url}
                    onChange={(event) => updateGalleryImage(index, event.target.value)}
                  />
                  <span className="upload-button-shell">
                    <input
                      accept="image/*"
                      aria-label={language === "ar" ? "رفع صورة معرض" : "Upload gallery image"}
                      onChange={(event) => handleGalleryItemUpload(index, event)}
                      type="file"
                    />
                    <span>
                      {uploadingGalleryIndex === index
                        ? t("admin.uploading")
                        : language === "ar"
                          ? "رفع"
                          : "Upload"}
                    </span>
                  </span>
                </span>
              </label>
              {image.image_url && (
                <img
                  alt=""
                  src={image.image_url}
                  onError={(event) => {
                    event.currentTarget.src = placeholderImage;
                  }}
                />
              )}
              <button onClick={() => removeGalleryImage(index)} type="button">
                {language === "ar" ? "حذف" : "Remove"}
              </button>
            </figure>
          ))}
        </div>
      </div>
      {uploadError && <div className="message-panel error full-field">{uploadError}</div>}
      <label>
        {t("admin.shortDescriptionEn")}
        <textarea name="shortEn" onChange={handleChange} required value={form.shortEn} />
      </label>
      <label>
        {t("admin.shortDescriptionAr")}
        <textarea name="shortAr" onChange={handleChange} required value={form.shortAr} />
      </label>
      <div className="full-field admin-variants-editor">
        <div className="admin-inline-heading">
          <strong>{language === "ar" ? "ألوان وأحجام المنتج" : "Product Variants"}</strong>
          <button className="secondary-action compact-action" onClick={addVariant} type="button">
            {language === "ar" ? "إضافة خيار" : "Add Variant"}
          </button>
        </div>
        <div className="variant-generator-panel">
          <div>
            <strong>{language === "ar" ? "مولّد الفيرنتس" : "Variant Generator"}</strong>
            <p>
              {language === "ar"
                ? "اكتب كل لون بسطر: الاسم|كود اللون|رابط صورة اختياري. الأحجام افصلها بفواصل."
                : "Enter each color on a new line: name|hex|optional image URL. Separate sizes with commas."}
            </p>
          </div>
          <label>
            {language === "ar" ? "الألوان" : "Colors"}
            <textarea
              value={variantGenerator.colorsText}
              onChange={(event) => updateVariantGenerator("colorsText", event.target.value)}
            />
          </label>
          <label>
            {language === "ar" ? "الأحجام" : "Sizes"}
            <input
              value={variantGenerator.sizesText}
              onChange={(event) => updateVariantGenerator("sizesText", event.target.value)}
            />
          </label>
          <label>
            {language === "ar" ? "السعر الافتراضي" : "Default price"}
            <input
              min="0"
              type="number"
              value={variantGenerator.defaultPrice}
              onChange={(event) => updateVariantGenerator("defaultPrice", event.target.value)}
            />
          </label>
          <label>
            {language === "ar" ? "المخزون الافتراضي" : "Default stock"}
            <input
              min="0"
              type="number"
              value={variantGenerator.defaultStock}
              onChange={(event) => updateVariantGenerator("defaultStock", event.target.value)}
            />
          </label>
          <button className="primary-action compact-action" onClick={generateVariants} type="button">
            {language === "ar" ? "توليد الفيرنتس" : "Generate Variants"}
          </button>
        </div>
        <div className="admin-variant-grid">
          {(form.variants || []).map((variant, index) => (
            <div className="admin-variant-row" key={variant.id || index}>
              <label>
                {language === "ar" ? "اسم اللون" : "Color name"}
                <input
                  required
                  value={variant.color_name}
                  onChange={(event) => updateVariant(index, "color_name", event.target.value)}
                />
              </label>
              <label>
                {language === "ar" ? "قيمة اللون" : "Color value"}
                <input
                  value={variant.color_value}
                  onChange={(event) => updateVariant(index, "color_value", event.target.value)}
                />
              </label>
              <label>
                {language === "ar" ? "الحجم" : "Size"}
                <input
                  required
                  value={variant.size}
                  onChange={(event) => updateVariant(index, "size", event.target.value)}
                />
              </label>
              <label>
                {language === "ar" ? "السعر" : "Price"}
                <input
                  min="0"
                  required
                  type="number"
                  value={variant.price}
                  onChange={(event) => updateVariant(index, "price", event.target.value)}
                />
              </label>
              <label>
                {language === "ar" ? "المخزون" : "Stock"}
                <input
                  min="0"
                  required
                  type="number"
                  value={variant.stock}
                  onChange={(event) => updateVariant(index, "stock", event.target.value)}
                />
              </label>
              <label>
                {language === "ar" ? "صورة الخيار" : "Variant image"}
                <span className="image-upload-row">
                  <input
                    value={variant.image_url}
                    onChange={(event) => updateVariant(index, "image_url", event.target.value)}
                  />
                  <span className="upload-button-shell">
                    <input
                      accept="image/*"
                      aria-label={language === "ar" ? "رفع صورة الخيار" : "Upload variant image"}
                      onChange={(event) => handleVariantImageUpload(index, event)}
                      type="file"
                    />
                    <span>
                      {uploadingVariantIndex === index
                        ? t("admin.uploading")
                        : language === "ar"
                          ? "رفع"
                          : "Upload"}
                    </span>
                  </span>
                </span>
                {variant.image_url && (
                  <img
                    alt=""
                    className="admin-image-preview small-preview"
                    src={variant.image_url}
                    onError={(event) => {
                      event.currentTarget.src = placeholderImage;
                    }}
                  />
                )}
              </label>
              <button className="text-action danger" onClick={() => removeVariant(index)} type="button">
                {language === "ar" ? "حذف" : "Remove"}
              </button>
            </div>
          ))}
        </div>
      </div>
      <label>
        {t("admin.badge")}
        <input name="badgeEn" onChange={handleChange} value={form.badgeEn} />
      </label>
      <label>
        {t("admin.badgeAr")}
        <input name="badgeAr" onChange={handleChange} value={form.badgeAr} />
      </label>
      <label>
        {t("admin.stockStatus")}
        <input name="stockStatus" onChange={handleChange} value={form.stockStatus} />
      </label>
      <div className="form-actions full-field">
        <button className="primary-action" disabled={isSaving || Boolean(uploadingField)} type="submit">
          {isSaving ? t("common.temporaryContent") : t("admin.save")}
        </button>
        <button className="secondary-action" onClick={onCancel} type="button">
          {t("admin.cancel")}
        </button>
      </div>
    </form>
  );
}

export default AdminProductForm;
