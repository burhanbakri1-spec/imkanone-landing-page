import React from "react";
import { Minus, Plus, Search, Upload } from "lucide-react";
import AdminLayout from "../components/AdminLayout.jsx";
import AdminOrdersTable from "../components/AdminOrdersTable.jsx";
import WebsiteMediaManager from "../components/WebsiteMediaManager.jsx";
import TenantProductFields from "../components/TenantProductFields.jsx";
import { deleteProductMedia, uploadImage, uploadImages, uploadProductMedia } from "../utils/api.js";
import { fieldStateToValues, productFieldApi, valuesToFieldState } from "../utils/productFields.js";
import {
  getSelectableAdminCategories,
} from "../utils/adminCategories.js";
import { tenantStorageKey } from "../utils/companyContext.js";
import { isCompanyAdmin, isTenantOperator, tenantAccessNotice } from "../utils/roles.js";
import { hasPermission } from "../data/permissions.js";

const storageKeys = {
  inventory: "inventory",
  movements: "stockMovements",
  settings: "settings",
  stores: "stores",
  vlogHero: "vlogHero",
  vlogs: "vlogs",
};

const pageMeta = {
  admin: ["Dashboard", "Overview of your store performance"],
  "admin-products": ["Products", "Manage your product catalog"],
  "admin-products-new": ["New Product", "Create or update product catalog details"],
  "admin-categories": ["Categories", "Organize your product hierarchy"],
  "admin-categories-new": ["New Category", "Create a storefront category"],
  "admin-brands": ["Brands", "Manage brand manufacturers and lines"],
  "admin-brands-new": ["New Brand", "Create a brand profile"],
  "admin-vlogs": ["Vlogs", "Manage storefront vlog entries"],
  "admin-vlogs-new": ["New Vlog", "Create a storefront vlog entry"],
  "admin-store-locator": ["Store Locator", "Manage physical store locations"],
  "admin-store-locator-new": ["New Store", "Create a retail location"],
  "admin-website-media": ["Website Media", "Manage images used across storefront sections"],
  "admin-orders": ["Orders", "Manage and track customer orders"],
  "admin-reviews": ["Reviews", "Moderate customer reviews and ratings"],
  "admin-inventory": ["Inventory Management", "Monitor stock levels, adjust quantities, and review movement history"],
  "admin-customers": ["Customers", "Manage customer accounts and view order history"],
  "admin-settings": ["Settings", "Manage site identity, metadata, social links, and shipping rules from one page."],
};

function readStorage(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local admin drafts are optional; failing storage should not break the panel.
  }
}

function getText(value, language = "en") {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value[language] || value.en || value.ar || "";
}

function makeSlug(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function getProductSku(product) {
  return product.sku || product.id || product.slug || "-";
}

function getProductPrice(product) {
  const prices = (product.sizes || []).map((size) => Number(size.price || 0)).filter(Boolean);
  if (prices.length === 0) return 0;
  return Math.min(...prices);
}

function getStockQty(product) {
  if (Number.isFinite(Number(product.stockQty))) return Number(product.stockQty);
  if ((product.stockStatus || "").toLowerCase().includes("out")) return 0;
  return 24;
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString();
}

function uniqueCustomersFromOrders(orders) {
  const customers = new Map();
  orders.forEach((order) => {
    const key = order.customer?.email || order.customer?.phone || order.customer?.name || order.id;
    const current = customers.get(key) || {
      createdAt: order.createdAt,
      email: order.customer?.email || "-",
      name: order.customer?.name || "-",
      orders: 0,
      phone: order.customer?.phone || "-",
      status: "Active",
      updatedAt: order.updatedAt || order.createdAt,
    };
    current.orders += 1;
    current.updatedAt = order.updatedAt || current.updatedAt;
    customers.set(key, current);
  });
  return Array.from(customers.values());
}

function createLocalizedCopy(en, ar) {
  return { en, ar };
}

function normalizeFormVariant(variant = {}, index = 0, product = {}) {
  return {
    id: variant.id || `${product.id || "product"}-variant-${index}`,
    color_name: variant.color_name || variant.colorName || "Default",
    color_value: variant.color_value || variant.colorValue || "",
    size: variant.size || product.size || "500ml",
    price: Number(variant.price ?? product.price ?? 0),
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

function normalizeProductVariantsForForm(product = {}) {
  product = product || {};
  if (Array.isArray(product.variants) && product.variants.length) {
    return product.variants.map((variant, index) => normalizeFormVariant(variant, index, product));
  }

  const variants = (product.sizes || []).map((sizeOption, index) =>
    normalizeFormVariant(
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

  return variants.length
    ? variants
    : [
        normalizeFormVariant(
          {
            color_name: "Default",
            color_value: "#1db7d8",
            size: "500ml",
            price: 18,
            stock: 24,
            image_url: product.image || "",
          },
          0,
          product,
        ),
      ];
}

function normalizeGalleryImagesForForm(product = {}) {
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

function createGalleryImageEntry(index = 0, imageUrl = "") {
  return {
    id: `gallery-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    image_url: imageUrl,
    sort_order: index,
  };
}

function parseVariantGeneratorColors(value = "") {
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

function parseVariantGeneratorSizes(value = "") {
  return value
    .split(/\n|,|;/)
    .map((size) => size.trim())
    .filter(Boolean);
}

function sizesFromFormVariants(variants, fallbackSize, fallbackPrice) {
  const bySize = new Map();
  variants.forEach((variant) => {
    if (!variant.size) return;
    const current = bySize.get(variant.size);
    if (!current || Number(variant.price) < Number(current.price)) {
      bySize.set(variant.size, { size: variant.size, price: Number(variant.price || 0) });
    }
  });
  return bySize.size
    ? Array.from(bySize.values())
    : [{ size: fallbackSize || "500ml", price: Number(fallbackPrice || 0) || 0 }];
}

function createProductFromForm(form) {
  const id = form.id || `product-${Date.now()}`;
  const slug = form.slug || makeSlug(form.nameEn);
  let variants = (form.variants || [])
    .filter((variant) => variant.color_name && variant.size)
    .map((variant, index) => ({
      ...normalizeFormVariant(variant, index, form),
      id: variant.id || `${id}-variant-${index}`,
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
  const parsedSizes = sizesFromFormVariants(variants, form.size, form.price);

  return {
    id,
    slug,
    sku: form.sku || slug.toUpperCase(),
    name: createLocalizedCopy(form.nameEn, form.nameAr || form.nameEn),
    categoryId: form.categoryId,
    brandId: form.brandId || null,
    shortDescription: createLocalizedCopy(form.shortDescription, form.shortDescriptionAr || form.shortDescription),
    longDescription: createLocalizedCopy(form.fullDescription, form.fullDescriptionAr || form.fullDescription || form.shortDescription),
    howToUse: form.howToUse,
    ingredients: form.ingredients,
    benefits: form.benefits,
    skinTypes: form.skinTypes,
    concerns: form.concerns,
    image: form.image || "/images/products/product-placeholder.svg",
    hoverImage: form.hoverImage || form.image || "/images/products/product-placeholder.svg",
    productsPageImage: form.productsPageImage || "",
    productsPageHoverImage: form.productsPageHoverImage || "",
    fallbackImage: "/images/products/product-placeholder.svg",
    variants,
    gallery_images: galleryImages,
    galleryImages: galleryImages.map((image) => image.image_url),
    videoUrl: form.videoUrl || "",
    sizes: parsedSizes,
    badge: createLocalizedCopy(form.label || "Featured", form.labelAr || "مميز"),
    status: form.active ? "Active" : "Inactive",
    isActive: form.active,
    isFeatured: form.featured,
    isNewArrival: form.newArrival,
    isBestseller: form.bestseller,
    stockQty: variants.length
      ? variants.reduce((sum, variant) => sum + Number(variant.stock || 0), 0)
      : Number(form.stockQty || 0) || 0,
    stockStatus:
      (variants.length
        ? variants.reduce((sum, variant) => sum + Number(variant.stock || 0), 0)
        : Number(form.stockQty || 0)) > 0
        ? "In Stock"
        : "Out of Stock",
    metaTitle: form.metaTitle,
    metaDescription: form.metaDescription,
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
    createdAt: form.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function AdminMetricCard({ label, value, icon }) {
  return (
    <article className="admin-metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{icon || "+0% vs prev 30d"}</small>
    </article>
  );
}

function Toolbar({ children, onAdd, addLabel }) {
  return (
    <div className="admin-toolbar">
      <div className="admin-toolbar-main">{children}</div>
      {onAdd && (
        <button className="admin-primary-button" onClick={onAdd} type="button">
          {addLabel}
        </button>
      )}
    </div>
  );
}

function SearchField({ placeholder, value, onChange }) {
  return (
    <label className="admin-search-field">
      <Search size={15} />
      <input placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function AdminTable({ children }) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">{children}</table>
    </div>
  );
}

function Badge({ tone = "active", children }) {
  return <span className={`admin-status-pill ${tone}`}>{children}</span>;
}

function MediaField({ label, name, value, onChange, productId, tenantSpecific = false }) {
  const [isUploading, setIsUploading] = React.useState(false);

  async function handleUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const uploaded = productId ? await uploadProductMedia(file, productId) : await uploadImage(file);
      onChange({ target: { name, value: uploaded.url || uploaded.path } });
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  }

  return (
    <div className="admin-media-field">
      <label>
        {label}
        <input name={name} placeholder="https://..." value={value || ""} onChange={onChange} />
      </label>
      <label className="admin-upload-button">
        <Upload size={14} />
        {isUploading ? "Uploading..." : tenantSpecific && !productId ? "Save product first" : "Upload"}
        <input accept="image/*" disabled={tenantSpecific && !productId} hidden type="file" onChange={handleUpload} />
      </label>
      {value && (
        <div className="admin-media-preview">
          <img alt="" src={value} />
        </div>
      )}
    </div>
  );
}

function PermissionNotice({ role }) {
  const notice = tenantAccessNotice(role);
  if (!notice) return null;
  return (
    <div className="message-panel warning">
      {notice}
    </div>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="admin-empty-state">
      <strong>{title}</strong>
      {description && <span>{description}</span>}
    </div>
  );
}

function DashboardHome({ customers, language, orders, products, t }) {
  const revenue = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  return (
    <>
      <div className="admin-range-row">
        <div className="admin-range-toggle">
          <button type="button">7d</button>
          <button className="active" type="button">30d</button>
          <button type="button">90d</button>
        </div>
        <div className="admin-date-filter">
          <span>or custom:</span>
          <input type="date" />
          <span>to</span>
          <input type="date" />
        </div>
      </div>
      <div className="admin-metric-grid">
        <AdminMetricCard label="Sales" value={`${revenue} ${t("common.ils")}`} />
        <AdminMetricCard label="Orders" value={orders.length} />
        <AdminMetricCard label="Customers" value={customers.length} />
      </div>
      <div className="admin-dashboard-grid">
        <section className="admin-panel-card">
          <h2>Revenue over time</h2>
          <p>Orders and revenue across the last 30 days</p>
          <div className="admin-empty-chart">{orders.length ? `${revenue} ${t("common.ils")}` : "No revenue for this date range"}</div>
        </section>
        <section className="admin-panel-card">
          <h2>Order status distribution</h2>
          <p>Current order mix for the selected range</p>
          <div className="admin-empty-chart">{orders.length ? `${orders.length} orders` : "No orders for this date range"}</div>
        </section>
        <section className="admin-panel-card">
          <h2>Top selling products</h2>
          <p>Ranked by units sold</p>
          <div className="admin-empty-chart">{products.length ? `${products.length} products available` : "No product sales for this date range"}</div>
        </section>
        <section className="admin-panel-card">
          <h2>Customer growth</h2>
          <p>New customer trend</p>
          <div className="admin-empty-chart">{customers.length ? `${customers.length} customers` : "No customers for this date range"}</div>
        </section>
      </div>
      <section className="admin-panel-card">
        <h2>Recent Orders</h2>
        {orders.length ? (
          <AdminOrdersTable canAssign={false} canDelete={false} canUpdateStatus={false} language={language} orders={orders.slice(0, 5)} products={products} t={t} />
        ) : (
          <EmptyState title="No recent orders" />
        )}
      </section>
    </>
  );
}

function ProductsListPage({ brands, canCreate = true, canDelete = true, canUpdate = true, categories, filters, onAdd, onDeleteProduct, onEdit, products, setFilters }) {
  const filtered = products.filter((product) => {
    const name = getText(product.name).toLowerCase();
    const sku = getProductSku(product).toLowerCase();
    const matchesSearch = !filters.search || name.includes(filters.search.toLowerCase()) || sku.includes(filters.search.toLowerCase());
    const matchesBrand = filters.brand === "all" || product.brandId === filters.brand;
    const matchesCategory = filters.category === "all" || product.categoryId === filters.category;
    const matchesStatus = filters.status === "all" || (filters.status === "active" ? product.isActive !== false : product.isActive === false);
    return matchesSearch && matchesBrand && matchesCategory && matchesStatus;
  });

  return (
    <section className="admin-panel-card">
      <Toolbar addLabel="Add Product" onAdd={canCreate ? onAdd : null}>
        <SearchField placeholder="Search by name, SKU..." value={filters.search} onChange={(value) => setFilters((current) => ({ ...current, search: value }))} />
        <select value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}>
          <option value="all">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>{getText(category.name)}</option>
          ))}
        </select>
        <select value={filters.brand} onChange={(event) => setFilters((current) => ({ ...current, brand: event.target.value }))}>
          <option value="all">All brands</option>
          {brands.map((brand) => (
            <option key={brand.id} value={brand.id}>{brand.name}</option>
          ))}
        </select>
        <div className="admin-segmented">
          {["all", "active", "inactive"].map((status) => (
            <button className={filters.status === status ? "active" : ""} key={status} onClick={() => setFilters((current) => ({ ...current, status }))} type="button">
              {status[0].toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </Toolbar>
      <AdminTable>
        <thead>
          <tr>
            <th>Image</th>
            <th>Name</th>
            <th>Category</th>
            <th>Brand</th>
            <th>Variants</th>
            <th>Price</th>
            <th>Stock</th>
            <th>Status</th>
            <th>Created</th>
            <th>Updated</th>
            {(canUpdate || canDelete) && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {filtered.map((product) => {
            const category = categories.find((entry) => entry.id === product.categoryId);
            const stock = getStockQty(product);
            return (
              <tr key={product.id}>
                <td><img className="admin-thumb" alt="" src={product.image || product.fallbackImage} /></td>
                <td><strong>{getText(product.name)}</strong><span className="table-muted">{getProductSku(product)}</span></td>
                <td>{getText(category?.name) || "-"}</td>
                <td>{brands.find((brand) => brand.id === product.brandId)?.name || product.brand || "-"}</td>
                <td>{product.sizes?.length || 1}</td>
                <td><strong>{getProductPrice(product)} ILS</strong></td>
                <td>{stock}</td>
                <td>
                  <div className="admin-badge-stack">
                    <Badge tone={product.isActive === false ? "neutral" : "active"}>{product.isActive === false ? "Inactive" : "Active"}</Badge>
                    {product.isFeatured && <Badge>Featured</Badge>}
                    {stock <= 0 && <Badge tone="danger">Out of stock</Badge>}
                  </div>
                </td>
                <td>{formatDate(product.createdAt)}</td>
                <td>{formatDate(product.updatedAt)}</td>
                {(canUpdate || canDelete) && (
                  <td>
                    <div className="row-actions">
                      {canUpdate && <button className="text-action" onClick={() => onEdit(product)} type="button">Edit</button>}
                      {canDelete && <button className="text-action danger" onClick={() => onDeleteProduct(product.id)} type="button">Delete</button>}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </AdminTable>
    </section>
  );
}

export function ProductWizard({ brands = [], categories = [], editingProduct, onCancel, onSave, canManageContent = true, canManageMedia = true }) {
  const [step, setStep] = React.useState("basic");
  const initialCategoryOptions = getSelectableAdminCategories(categories, editingProduct?.categoryId);
  const [uploadError, setUploadError] = React.useState("");
  const [uploadingField, setUploadingField] = React.useState("");
  const [uploadingVariantIndex, setUploadingVariantIndex] = React.useState(-1);
  const [uploadingGalleryIndex, setUploadingGalleryIndex] = React.useState(-1);
  const [videoProgress, setVideoProgress] = React.useState(0);
  const [tenantDefinitions, setTenantDefinitions] = React.useState([]);
  const [tenantValues, setTenantValues] = React.useState({});
  const [variantGenerator, setVariantGenerator] = React.useState({
    colorsText: "Default|#1db7d8",
    sizesText: "500ml, 1L, 5L",
    defaultPrice: "18",
    defaultStock: "24",
  });
  const [form, setForm] = React.useState(() => ({
    id: editingProduct?.id || "",
    nameEn: getText(editingProduct?.name) || "",
    nameAr: editingProduct?.name?.ar || "",
    slug: editingProduct?.slug || "",
    sku: editingProduct?.sku || "",
    categoryId: editingProduct?.categoryId || initialCategoryOptions[0]?.id || "",
    brandId: editingProduct?.brandId || "",
    size: editingProduct?.sizes?.[0]?.size || "500ml",
    price: editingProduct?.sizes?.[0]?.price || "",
    stockQty: getStockQty(editingProduct || {}),
    shortDescription: getText(editingProduct?.shortDescription),
    shortDescriptionAr: editingProduct?.shortDescription?.ar || "",
    fullDescription: getText(editingProduct?.longDescription),
    fullDescriptionAr: editingProduct?.longDescription?.ar || "",
    howToUse: editingProduct?.howToUse || "",
    ingredients: editingProduct?.ingredients || "",
    benefits: editingProduct?.benefits || "",
    skinTypes: editingProduct?.skinTypes || "",
    concerns: editingProduct?.concerns || "",
    image: editingProduct?.image || "",
    hoverImage: editingProduct?.hoverImage || "",
    productsPageImage: editingProduct?.productsPageImage || "",
    productsPageHoverImage: editingProduct?.productsPageHoverImage || "",
    galleryImages: normalizeGalleryImagesForForm(editingProduct),
    variants: normalizeProductVariantsForForm(editingProduct),
    videoUrl: editingProduct?.videoUrl || "",
    metaTitle: editingProduct?.metaTitle || "",
    metaDescription: editingProduct?.metaDescription || "",
    dsiHowItWorks: (editingProduct?.detailSectionImages || editingProduct?.detail_section_images || {}).howItWorks || "",
    dsiHowItWorks1: (editingProduct?.detailSectionImages || editingProduct?.detail_section_images || {}).howItWorks1 || "",
    dsiHowItWorks2: (editingProduct?.detailSectionImages || editingProduct?.detail_section_images || {}).howItWorks2 || "",
    dsiHowItWorks3: (editingProduct?.detailSectionImages || editingProduct?.detail_section_images || {}).howItWorks3 || "",
    dsiImpact: (editingProduct?.detailSectionImages || editingProduct?.detail_section_images || {}).impact || "",
    dsiImpact1: (editingProduct?.detailSectionImages || editingProduct?.detail_section_images || {}).impact1 || "",
    dsiImpact2: (editingProduct?.detailSectionImages || editingProduct?.detail_section_images || {}).impact2 || "",
    dsiSafeToUse: (editingProduct?.detailSectionImages || editingProduct?.detail_section_images || {}).safeToUse || "",
    dsiPracticalBanner: (editingProduct?.detailSectionImages || editingProduct?.detail_section_images || {}).practicalBanner || "",
    dsiIngredients: (editingProduct?.detailSectionImages || editingProduct?.detail_section_images || {}).ingredients || "",
    dsiFaq: (editingProduct?.detailSectionImages || editingProduct?.detail_section_images || {}).faq || "",
    dsiMainImage: (editingProduct?.detailSectionImages || editingProduct?.detail_section_images || {}).mainImage || "",
    label: editingProduct?.badge?.en || "",
    labelAr: editingProduct?.badge?.ar || "",
    active: editingProduct?.isActive !== false,
    featured: Boolean(editingProduct?.isFeatured),
    bestseller: Boolean(editingProduct?.isBestseller),
    detailStatements: editingProduct?.detailStatements || editingProduct?.detail_statements || [],
  }));

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([
      productFieldApi.definitions(),
      editingProduct?.id ? productFieldApi.values(editingProduct.id) : Promise.resolve([]),
    ]).then(([definitions, values]) => {
      if (cancelled) return;
      setTenantDefinitions(Array.isArray(definitions) ? definitions : []);
      const fieldState = valuesToFieldState(values);
      setTenantValues(fieldState);
      if (fieldState.product_video) setForm((current) => ({ ...current, videoUrl: fieldState.product_video }));
      if (Array.isArray(definitions) && definitions.length) {
        setVariantGenerator({ colorsText: "", sizesText: "", defaultPrice: "", defaultStock: "" });
        if (!editingProduct?.id || !(editingProduct?.variants?.length || editingProduct?.sizes?.length)) setForm((current) => ({ ...current, size: "", price: "", variants: [] }));
      }
    }).catch((error) => setUploadError(error.message || "Unable to load product fields."));
    return () => { cancelled = true; };
  }, [editingProduct?.id]);

  const usesTenantDefinitions = tenantDefinitions.length > 0;
  const additionalMediaDefinitions = tenantDefinitions.filter((definition) => !["gallery_images", "product_video"].includes(definition.field_key));
  const updateTenantValue = (key, value) => setTenantValues((current) => ({ ...current, [key]: value }));

  const allTabs = ["basic", "pricing", "variants", "media", "details", "marketing", "preview"];
  const tabName = { basic: "Basic", pricing: "Pricing and stock", variants: "Variants", media: "Media", details: "Product details", marketing: "Marketing and SEO", preview: "Preview" };
  const tabs = allTabs.filter((tab) => (tab !== "media" || canManageMedia) && (!["details", "marketing"].includes(tab) || canManageContent));
  const selectableCategories = getSelectableAdminCategories(categories, form.categoryId);

  function change(event) {
    const { checked, name, type, value } = event.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  }

  function addVariant() {
    setForm((current) => ({
      ...current,
      variants: [
        ...(current.variants || []),
        normalizeFormVariant(
          {
            color_name: "",
            color_value: "#1db7d8",
            size: "",
            price: 0,
            stock: 0,
            image_url: current.image || "",
          },
          current.variants?.length || 0,
          current,
        ),
      ],
    }));
  }

  function updateVariant(index, field, value) {
    setForm((current) => ({
      ...current,
      variants: (current.variants || []).map((variant, variantIndex) =>
        variantIndex === index ? { ...variant, [field]: value } : variant,
      ),
    }));
  }

  function removeVariant(index) {
    setForm((current) => ({
      ...current,
      variants: (current.variants || []).filter((_, variantIndex) => variantIndex !== index),
    }));
  }

  function updateVariantGenerator(field, value) {
    setVariantGenerator((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function generateVariants() {
    const colors = parseVariantGeneratorColors(variantGenerator.colorsText);
    const sizes = parseVariantGeneratorSizes(variantGenerator.sizesText);

    if (!colors.length || !sizes.length) {
      setUploadError("Add at least one color and one size.");
      return;
    }

    setUploadError("");
    setForm((current) => {
      const currentVariants = current.variants || [];
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
            normalizeFormVariant(
              {
                color_name: color.name,
                color_value: color.value,
                size,
                price: variantGenerator.defaultPrice,
                stock: variantGenerator.defaultStock,
                image_url: color.imageUrl || current.image || "",
              },
              currentVariants.length + generated.length,
              current,
            ),
          );
        });
      });

      return {
        ...current,
        variants: [...currentVariants, ...generated],
      };
    });
  }

  async function uploadVariantImage(index, event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploadError("");
    setUploadingVariantIndex(index);
    try {
      const uploaded = usesTenantDefinitions && editingProduct?.id
        ? await uploadProductMedia(file, editingProduct.id)
        : await uploadImage(file);
      updateVariant(index, "image_url", uploaded.url || uploaded.path || "");
    } catch (error) {
      setUploadError(error.message || "Variant image upload failed.");
    } finally {
      setUploadingVariantIndex(-1);
    }
  }

  async function uploadGallery(event) {
    const files = event.target.files;
    event.target.value = "";
    if (!files?.length) return;

    setUploadError("");
    setUploadingField("galleryImages");
    try {
      if (usesTenantDefinitions && !editingProduct?.id) throw new Error("Save the product before uploading gallery media.");
      const uploaded = usesTenantDefinitions
        ? await Promise.all(Array.from(files).map((file) => uploadProductMedia(file, editingProduct.id)))
        : await uploadImages(files);
      setForm((current) => {
        const currentImages = current.galleryImages || [];
        return {
          ...current,
          galleryImages: [
            ...currentImages,
            ...uploaded
              .map((item, index) => ({
                id: `gallery-${Date.now()}-${index}`,
                image_url: item.url || item.path,
                sort_order: currentImages.length + index,
              }))
              .filter((item) => item.image_url),
          ],
        };
      });
    } catch (error) {
      setUploadError(error.message || "Gallery images upload failed.");
    } finally {
      setUploadingField("");
    }
  }

  async function removeGalleryImage(index) {
    const removed = form.galleryImages?.[index];
    if (usesTenantDefinitions && editingProduct?.id && removed?.image_url?.includes(`/products/${editingProduct.id}/`)) {
      try { await deleteProductMedia(editingProduct.id, removed.image_url); }
      catch (error) { setUploadError(error.message || "Gallery image could not be deleted."); return; }
    }
    setForm((current) => ({
      ...current,
      galleryImages: (current.galleryImages || [])
        .filter((_, imageIndex) => imageIndex !== index)
        .map((image, sortIndex) => ({ ...image, sort_order: sortIndex })),
    }));
  }

  function addGalleryImageField() {
    setForm((current) => {
      const currentImages = current.galleryImages || [];
      return {
        ...current,
        galleryImages: [...currentImages, createGalleryImageEntry(currentImages.length)],
      };
    });
  }

  function updateGalleryImage(index, value) {
    setForm((current) => ({
      ...current,
      galleryImages: (current.galleryImages || []).map((image, imageIndex) =>
        imageIndex === index ? { ...image, image_url: value } : image,
      ),
    }));
  }

  async function uploadGalleryItem(index, event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploadError("");
    setUploadingGalleryIndex(index);
    try {
      const uploaded = usesTenantDefinitions && editingProduct?.id
        ? await uploadProductMedia(file, editingProduct.id)
        : await uploadImage(file);
      updateGalleryImage(index, uploaded.url || uploaded.path || "");
    } catch (error) {
      setUploadError(error.message || "Gallery image upload failed.");
    } finally {
      setUploadingGalleryIndex(-1);
    }
  }

  async function submit(event) {
    event.preventDefault();
    const result = await onSave(createProductFromForm(form));
    if (result?.ok && usesTenantDefinitions && canManageContent) {
      try {
        await productFieldApi.saveValues(result.product.id, fieldStateToValues(tenantDefinitions, tenantValues));
      } catch (error) {
        setUploadError(error.message || "Product content could not be saved.");
        return;
      }
    }
    if (result?.ok) onCancel();
  }

  async function uploadVideo(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!editingProduct?.id) { setUploadError("Save the product before uploading a video."); return; }
    setUploadError("");
    setUploadingField("videoUrl");
    setVideoProgress(0);
    try {
      const uploaded = await uploadProductMedia(file, editingProduct.id, setVideoProgress);
      const url = uploaded.url || uploaded.path || "";
      setForm((current) => ({ ...current, videoUrl: url }));
      setTenantValues((current) => ({ ...current, product_video: url }));
    } catch (error) { setUploadError(error.message || "Video upload failed."); }
    finally { setUploadingField(""); }
  }

  async function removeVideo() {
    try {
      if (editingProduct?.id && form.videoUrl?.includes(`/products/${editingProduct.id}/`)) await deleteProductMedia(editingProduct.id, form.videoUrl);
      setForm((current) => ({ ...current, videoUrl: "" }));
      setTenantValues((current) => ({ ...current, product_video: "" }));
      setVideoProgress(0);
    } catch (error) { setUploadError(error.message || "Video could not be removed."); }
  }

  function moveGalleryImage(from, to) {
    setForm((current) => {
      const images = [...(current.galleryImages || [])];
      if (from < 0 || to < 0 || from >= images.length || to >= images.length || from === to) return current;
      const [moved] = images.splice(from, 1);
      images.splice(to, 0, moved);
      return { ...current, galleryImages: images.map((image, sortIndex) => ({ ...image, sort_order: sortIndex })) };
    });
  }

  return (
    <section className="admin-panel-card">
      <div className="admin-tabs">
        {tabs.map((tab, index) => (
          <button className={step === tab ? "active" : ""} key={tab} onClick={() => setStep(tab)} type="button">
            {index + 1}. {tabName[tab]}
          </button>
        ))}
      </div>
      <form className="admin-form admin-wizard-form" onSubmit={submit}>
        {step === "basic" && (
          <>
            <label>Product Name *<input name="nameEn" required value={form.nameEn} onChange={change} /></label>
            <label>Arabic Product Name<input name="nameAr" value={form.nameAr} onChange={change} /></label>
            <label>Slug<input name="slug" value={form.slug} onChange={change} /></label>
            <label>SKU<input name="sku" value={form.sku} onChange={change} /></label>
            <label>Category *<select name="categoryId" required value={form.categoryId} onChange={change}>{selectableCategories.map((category) => <option key={category.id} value={category.id}>{getText(category.name)}</option>)}</select></label>
            <label>
              Brand
              <select name="brandId" value={form.brandId} onChange={change}>
                <option value="">No brand</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>{brand.name}</option>
                ))}
              </select>
            </label>
            <label>Short Description<textarea name="shortDescription" value={form.shortDescription} onChange={change} /></label>
            <label>Full Description<textarea name="fullDescription" value={form.fullDescription} onChange={change} /></label>
            <div className="admin-checkbox-grid full-field">
              {["active", "featured", "newArrival", "bestseller"].map((field) => (
                <label className="checkbox-line" key={field}><input name={field} type="checkbox" checked={form[field]} onChange={change} />{field.replace(/([A-Z])/g, " $1")}</label>
              ))}
            </div>
            <label>Label<input name="label" value={form.label} onChange={change} /></label>
            <label>Label Arabic<input name="labelAr" value={form.labelAr} onChange={change} /></label>
          </>
        )}
        {step === "pricing" && <div className="full-field">
          <h3>Pricing and stock</h3>
          <p className="admin-note">Pricing and stock are managed per variant so each shade, size, or volume can be controlled independently.</p>
          <p><strong>{form.variants?.length || 0}</strong> variants · <strong>{(form.variants || []).reduce((sum, variant) => sum + Number(variant.stock || 0), 0)}</strong> units in stock</p>
          <button className="secondary-action" onClick={() => setStep("variants")} type="button">Manage variant pricing</button>
        </div>}
        {step === "variants" && (
          <div className="full-field admin-variants-editor">
            <div className="admin-inline-heading">
              <strong>{usesTenantDefinitions ? "Shade / color, size or volume, price and stock" : "Color, size, price, and stock combinations"}</strong>
              <button className="secondary-action compact-action" onClick={addVariant} type="button">
                Add Variant
              </button>
            </div>
            {!usesTenantDefinitions && <div className="variant-generator-panel">
              <div>
                <strong>Variant Generator</strong>
                <p>Enter each color on a new line: name|hex|optional image URL. Separate sizes with commas.</p>
              </div>
              <label>
                Colors
                <textarea
                  value={variantGenerator.colorsText}
                  onChange={(event) => updateVariantGenerator("colorsText", event.target.value)}
                />
              </label>
              <label>
                Sizes
                <input
                  value={variantGenerator.sizesText}
                  onChange={(event) => updateVariantGenerator("sizesText", event.target.value)}
                />
              </label>
              <label>
                Default price
                <input
                  min="0"
                  type="number"
                  value={variantGenerator.defaultPrice}
                  onChange={(event) => updateVariantGenerator("defaultPrice", event.target.value)}
                />
              </label>
              <label>
                Default stock
                <input
                  min="0"
                  type="number"
                  value={variantGenerator.defaultStock}
                  onChange={(event) => updateVariantGenerator("defaultStock", event.target.value)}
                />
              </label>
              <button className="admin-primary-button compact-action" onClick={generateVariants} type="button">
                Generate Variants
              </button>
            </div>}
            <div className="admin-variant-grid">
              {(form.variants || []).map((variant, index) => (
                <div className="admin-variant-row" key={variant.id || index}>
                  <label>{usesTenantDefinitions ? "Variant / shade name" : "Color name"}<input required value={variant.color_name} onChange={(event) => updateVariant(index, "color_name", event.target.value)} /></label>
                  <label>{usesTenantDefinitions ? "Swatch / color value" : "Color value"}<input value={variant.color_value} onChange={(event) => updateVariant(index, "color_value", event.target.value)} /></label>
                  <label>{usesTenantDefinitions ? "Size or volume" : "Size"}<input required value={variant.size} onChange={(event) => updateVariant(index, "size", event.target.value)} /></label>
                  <label>Price<input min="0" required type="number" value={variant.price} onChange={(event) => updateVariant(index, "price", event.target.value)} /></label>
                  <label>Stock<input min="0" required type="number" value={variant.stock} onChange={(event) => updateVariant(index, "stock", event.target.value)} /></label>
                  <label>
                    Variant image
                    <span className="image-upload-row">
                      <input value={variant.image_url} onChange={(event) => updateVariant(index, "image_url", event.target.value)} />
                      <span className="upload-button-shell">
                        <input accept="image/*" type="file" onChange={(event) => uploadVariantImage(index, event)} />
                        <span>{uploadingVariantIndex === index ? "Uploading..." : "Upload"}</span>
                      </span>
                    </span>
                    {variant.image_url && <img className="admin-image-preview small-preview" alt="" src={variant.image_url} />}
                  </label>
                  <button className="text-action danger" onClick={() => removeVariant(index)} type="button">Remove</button>
                </div>
              ))}
            </div>
            {uploadError && <div className="message-panel error full-field">{uploadError}</div>}
          </div>
        )}
        {step === "media" && (
          <>
            <MediaField label="Featured Image" name="image" productId={usesTenantDefinitions ? editingProduct?.id : undefined} tenantSpecific={usesTenantDefinitions} value={form.image} onChange={change} />
            <MediaField label="Second / Hover Image" name="hoverImage" productId={usesTenantDefinitions ? editingProduct?.id : undefined} tenantSpecific={usesTenantDefinitions} value={form.hoverImage} onChange={change} />
            <div className="admin-media-field">
              <label>Product video URL<input name="videoUrl" value={form.videoUrl} onChange={change} /></label>
              {usesTenantDefinitions && <label className="admin-upload-button"><Upload size={14} />{uploadingField === "videoUrl" ? `Uploading ${videoProgress}%` : editingProduct?.id ? "Upload MP4/WebM" : "Save product first"}<input accept="video/mp4,video/webm" disabled={!editingProduct?.id} hidden type="file" onChange={uploadVideo} /></label>}
              {form.videoUrl && <div className="admin-media-preview"><video controls preload="metadata" src={form.videoUrl} /><button className="text-action danger" onClick={removeVideo} type="button">Remove video</button></div>}
            </div>
            <div className="full-field admin-gallery-editor">
              <div className="admin-inline-heading">
                <strong>Vertical Gallery Images</strong>
                <label className="admin-upload-button">
                  <Upload size={14} />
                  {uploadingField === "galleryImages" ? "Uploading..." : "Upload Gallery Images"}
                  <input accept="image/*" hidden multiple type="file" onChange={uploadGallery} />
                </label>
                <button className="secondary-action compact-action" onClick={addGalleryImageField} type="button">
                  + Add image field
                </button>
              </div>
              <div className="admin-gallery-preview-grid">
                {(form.galleryImages || []).map((image, index) => (
                  <figure className="admin-gallery-preview" draggable onDragStart={(event) => event.dataTransfer.setData("text/plain", String(index))} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); moveGalleryImage(Number(event.dataTransfer.getData("text/plain")), index); }} key={image.id || `${image.image_url}-${index}`}>
                    <label>
                      Image URL
                      <span className="image-upload-row">
                        <input
                          value={image.image_url}
                          onChange={(event) => updateGalleryImage(index, event.target.value)}
                        />
                        <span className="upload-button-shell">
                          <input
                            accept="image/*"
                            aria-label="Upload gallery image"
                            onChange={(event) => uploadGalleryItem(index, event)}
                            type="file"
                          />
                          <span>{uploadingGalleryIndex === index ? "Uploading..." : "Upload"}</span>
                        </span>
                      </span>
                    </label>
                    {image.image_url && <img alt="" src={image.image_url} />}
                    <div className="structured-row-actions"><button disabled={index === 0} onClick={() => moveGalleryImage(index, index - 1)} type="button">↑</button><button disabled={index === form.galleryImages.length - 1} onClick={() => moveGalleryImage(index, index + 1)} type="button">↓</button><button onClick={() => removeGalleryImage(index)} type="button">Remove</button></div>
                  </figure>
                ))}
              </div>
              {uploadError && <div className="message-panel error full-field">{uploadError}</div>}
            </div>
            {usesTenantDefinitions && <TenantProductFields definitions={additionalMediaDefinitions} section="media" value={tenantValues} onChange={updateTenantValue} />}
            {!usesTenantDefinitions && <>
            <div className="full-field">
              <strong>Product Details Section Images</strong>
              <div className="admin-dsi-grid">
                {[
                  { key: "dsiHowItWorks1", label: "How it Works image 1" },
                  { key: "dsiHowItWorks2", label: "How it Works image 2" },
                  { key: "dsiHowItWorks3", label: "How it Works image 3" },
                  { key: "dsiImpact1", label: "Impact section image 1" },
                  { key: "dsiImpact2", label: "Impact section image 2" },
                  { key: "dsiSafeToUse", label: "Safe to use image" },
                  { key: "dsiPracticalBanner", label: "Practical banner image" },
                  { key: "dsiIngredients", label: "Ingredients section image" },
                  { key: "dsiFaq", label: "FAQ side image" },
                ].map(({ key, label }) => (
                  <MediaField key={key} label={label} name={key} value={form[key] || ""} onChange={change} />
                ))}
              </div>
            </div>
            <div className="full-field">
              <strong>Product Details Banner Statements</strong>
              <div className="admin-dsi-grid">
                {(form.detailStatements || []).map((statement, index) => (
                  <div className="admin-media-field" key={index}>
                    <label>
                      Statement {index + 1} - English
                      <input
                        value={statement.en || ""}
                        onChange={(event) =>
                          setForm((current) => {
                            const updated = [...(current.detailStatements || [])];
                            updated[index] = { ...updated[index], en: event.target.value, ar: updated[index]?.ar || "" };
                            return { ...current, detailStatements: updated };
                          })
                        }
                      />
                    </label>
                    <label>
                      Statement {index + 1} - Arabic
                      <input
                        value={statement.ar || ""}
                        onChange={(event) =>
                          setForm((current) => {
                            const updated = [...(current.detailStatements || [])];
                            updated[index] = { ...updated[index], ar: event.target.value, en: updated[index]?.en || "" };
                            return { ...current, detailStatements: updated };
                          })
                        }
                      />
                    </label>
                    <button
                      className="text-action danger"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          detailStatements: (current.detailStatements || []).filter((_, i) => i !== index),
                        }))
                      }
                      type="button"
                    >
                      Remove
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
                  + Add statement
                </button>
              </div>
            </div>
            </>}
          </>
        )}
        {step === "details" && <>
          {!usesTenantDefinitions && <>
            <label>How to Use<textarea name="howToUse" value={form.howToUse} onChange={change} /></label>
            <label>Ingredients<textarea name="ingredients" value={form.ingredients} onChange={change} /></label>
            <label>Benefits<textarea name="benefits" value={form.benefits} onChange={change} /></label>
            <label>Skin Types<input name="skinTypes" value={form.skinTypes} onChange={change} /></label>
            <label>Concerns<input name="concerns" value={form.concerns} onChange={change} /></label>
          </>}
          {usesTenantDefinitions && <><TenantProductFields definitions={tenantDefinitions} section="details" value={tenantValues} onChange={updateTenantValue} /><TenantProductFields definitions={tenantDefinitions} section="showcase" value={tenantValues} onChange={updateTenantValue} /></>}
        </>}
        {step === "marketing" && (
          <>
            {!usesTenantDefinitions && <><label>Meta Title<input name="metaTitle" value={form.metaTitle} onChange={change} /></label><label>Meta Description<textarea name="metaDescription" value={form.metaDescription} onChange={change} /></label></>}
            {usesTenantDefinitions && <><TenantProductFields definitions={tenantDefinitions} section="marketing" value={tenantValues} onChange={updateTenantValue} /><TenantProductFields definitions={tenantDefinitions} section="seo" value={tenantValues} onChange={updateTenantValue} /></>}
          </>
        )}
        {step === "preview" && <article className="full-field admin-product-preview">
          {form.image && <img className="admin-image-preview" alt="" src={form.image} />}
          <h2>{form.nameEn || "Untitled product"}</h2>
          {form.nameAr && <h3 dir="rtl">{form.nameAr}</h3>}
          <p>{form.shortDescription}</p>
          <p><strong>{form.variants?.length || 0}</strong> variants · <strong>{(form.variants || []).reduce((sum, variant) => sum + Number(variant.stock || 0), 0)}</strong> in stock</p>
          {form.videoUrl && <video controls preload="metadata" src={form.videoUrl} />}
          {(tenantValues.product_faqs || []).filter((item) => item.is_active !== false).length > 0 && <p>{tenantValues.product_faqs.filter((item) => item.is_active !== false).length} active FAQ items</p>}
        </article>}
        <div className="form-actions full-field">
          <button className="secondary-action" disabled={tabs.indexOf(step) === 0} onClick={() => setStep(tabs[tabs.indexOf(step) - 1])} type="button">Previous</button>
          <button className="secondary-action" disabled={tabs.indexOf(step) === tabs.length - 1} onClick={() => setStep(tabs[tabs.indexOf(step) + 1])} type="button">Next</button>
          <button className="secondary-action" onClick={onCancel} type="button">Cancel</button>
          <button className="admin-primary-button" type="submit">{editingProduct ? "Save Product" : "Create Product"}</button>
        </div>
      </form>
    </section>
  );
}

function GenericEntityForm({ fields, initial, onCancel, onSave, title }) {
  const [form, setForm] = React.useState(initial);
  function change(event) {
    const { checked, name, type, value } = event.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  }
  return (
    <section className="admin-panel-card">
      <h2>{title}</h2>
      <form className="admin-form" onSubmit={(event) => { event.preventDefault(); onSave(form); }}>
        {fields.map((field) => {
          if (field.type === "textarea") return <label key={field.name}>{field.label}<textarea name={field.name} value={form[field.name] || ""} onChange={change} /></label>;
          if (field.type === "checkbox") return <label className="checkbox-line" key={field.name}><input name={field.name} type="checkbox" checked={Boolean(form[field.name])} onChange={change} />{field.label}</label>;
          if (field.type === "media") return <MediaField key={field.name} label={field.label} name={field.name} value={form[field.name]} onChange={change} />;
          if (field.type === "select") return <label key={field.name}>{field.label}<select name={field.name} value={form[field.name] || ""} onChange={change}>{field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
          return <label key={field.name}>{field.label}<input name={field.name} required={field.required} value={form[field.name] || ""} onChange={change} /></label>;
        })}
        <div className="form-actions full-field">
          <button className="secondary-action" onClick={onCancel} type="button">Cancel</button>
          <button className="admin-primary-button" type="submit">Create</button>
        </div>
      </form>
    </section>
  );
}

function SettingsPage({ company, onSave }) {
  const [settings, setSettings] = React.useState(() => ({
    currency: company?.settings?.currency || "",
    direction: company?.settings?.direction || "",
    faviconUrl: company?.faviconUrl || "",
    language: company?.settings?.language || "",
    locale: company?.settings?.locale || "",
    logoUrl: company?.logoUrl || "",
    name: company?.name || "",
  }));
  const [message, setMessage] = React.useState("");

  React.useEffect(() => {
    setSettings({
      currency: company?.settings?.currency || "",
      direction: company?.settings?.direction || "",
      faviconUrl: company?.faviconUrl || "",
      language: company?.settings?.language || "",
      locale: company?.settings?.locale || "",
      logoUrl: company?.logoUrl || "",
      name: company?.name || "",
    });
  }, [company]);

  async function save() {
    await onSave(Object.fromEntries(
      Object.entries(settings).map(([key, value]) => [key, value || null]),
    ));
    setMessage("Company settings saved.");
  }

  return (
    <section className="admin-panel-card">
      {message && <div className="message-panel success">{message}</div>}
      <form className="admin-form settings-form" onSubmit={(event) => { event.preventDefault(); save(); }}>
        <label>Company Name<input required value={settings.name} onChange={(event) => setSettings((current) => ({ ...current, name: event.target.value }))} /></label>
        <MediaField label="Company Logo" name="logoUrl" value={settings.logoUrl} onChange={(event) => setSettings((current) => ({ ...current, logoUrl: event.target.value }))} />
        <MediaField label="Favicon" name="faviconUrl" value={settings.faviconUrl} onChange={(event) => setSettings((current) => ({ ...current, faviconUrl: event.target.value }))} />
        <label>Language<input value={settings.language} onChange={(event) => setSettings((current) => ({ ...current, language: event.target.value }))} /></label>
        <label>Locale<input value={settings.locale} onChange={(event) => setSettings((current) => ({ ...current, locale: event.target.value }))} /></label>
        <label>Direction<select value={settings.direction} onChange={(event) => setSettings((current) => ({ ...current, direction: event.target.value }))}><option value="">Automatic</option><option value="ltr">LTR</option><option value="rtl">RTL</option></select></label>
        <label>Currency<input maxLength="3" value={settings.currency} onChange={(event) => setSettings((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} /></label>
        <div className="form-actions full-field">
          <button className="admin-primary-button" type="submit">Save Company Settings</button>
        </div>
      </form>
    </section>
  );
}

function InventoryPage({ inventoryRows, movements, onAdjust, onOpenModal, products }) {
  return (
    <>
      <section className="admin-panel-card">
        <Toolbar addLabel="Stock Update" onAdd={onOpenModal}>
          <SearchField placeholder="Search by product name, SKU..." value="" onChange={() => {}} />
        </Toolbar>
        <AdminTable>
          <thead><tr><th>Product Name</th><th>Variant</th><th>SKU</th><th>Stock Qty</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {products.map((product) => {
              const stock = inventoryRows[product.id] ?? getStockQty(product);
              return (
                <tr key={product.id}>
                  <td>{getText(product.name)}</td>
                  <td>{product.sizes?.[0]?.size || "Default"}</td>
                  <td>{getProductSku(product)}</td>
                  <td>{stock}</td>
                  <td><Badge tone={stock <= 0 ? "danger" : stock < 5 ? "warning" : "active"}>{stock <= 0 ? "Out of Stock" : stock < 5 ? "Low Stock" : "In Stock"}</Badge></td>
                  <td><button className="icon-action" onClick={() => onAdjust(product.id, 1)} type="button"><Plus size={14} /></button><button className="icon-action" onClick={() => onAdjust(product.id, -1)} type="button"><Minus size={14} /></button></td>
                </tr>
              );
            })}
          </tbody>
        </AdminTable>
      </section>
      <section className="admin-panel-card">
        <h2>Stock Movement History</h2>
        <p>Last 50 stock movements across all products</p>
        <AdminTable>
          <thead><tr><th>Date</th><th>Product</th><th>Variant</th><th>Delta</th><th>Reason</th><th>Operator / Order</th></tr></thead>
          <tbody>
            {movements.length ? movements.slice(0, 50).map((move) => <tr key={move.id}><td>{formatDate(move.date)}</td><td>{move.product}</td><td>{move.variant}</td><td>{move.delta}</td><td>{move.reason}</td><td>{move.operator}</td></tr>) : <tr><td colSpan="6">No stock movements yet.</td></tr>}
          </tbody>
        </AdminTable>
      </section>
    </>
  );
}

function StockUpdateModal({ inventoryRows, onApply, onClose, products }) {
  const [reason, setReason] = React.useState("Adjustment");
  const [note, setNote] = React.useState("");
  const [deltas, setDeltas] = React.useState({});
  const pending = Object.values(deltas).filter((value) => Number(value) !== 0).length;
  return (
    <div className="admin-modal-backdrop">
      <section className="admin-modal">
        <div className="admin-section-head"><div><h2>Stock Update</h2><p>Sync database stock with physical counts.</p></div><button className="text-action" onClick={onClose} type="button">Close</button></div>
        <div className="admin-toolbar">
          <SearchField placeholder="Search inventory" value="" onChange={() => {}} />
          <select value={reason} onChange={(event) => setReason(event.target.value)}>
            {["Adjustment", "Restock", "Correction", "Damaged", "Return"].map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
        <div className="admin-inventory-list">
          {products.map((product) => (
            <label className="admin-inventory-row" key={product.id}>
              <input type="checkbox" checked={Number(deltas[product.id] || 0) !== 0} readOnly />
              <span><strong>{getText(product.name)}</strong><small>{getProductSku(product)} · current {inventoryRows[product.id] ?? getStockQty(product)}</small></span>
              <input type="number" value={deltas[product.id] || ""} onChange={(event) => setDeltas((current) => ({ ...current, [product.id]: event.target.value }))} />
            </label>
          ))}
        </div>
        <label>Note optional<textarea value={note} onChange={(event) => setNote(event.target.value)} /></label>
        <div className="form-actions">
          <span>{pending} pending non-zero updates</span>
          <button className="admin-primary-button" onClick={() => onApply(deltas, reason, note)} type="button">Apply Stock Updates</button>
        </div>
      </section>
    </div>
  );
}

function AdminDashboardPage({
  activePage = "admin",
  brands = [],
  categories = [],
  company,
  currentUser,
  employees,
  homepageCategoryCards,
  language,
  modules,
  homepageOffers,
  onDeleteProduct,
  onDeleteBrand,
  onDeleteCategory,
  onDeleteOffer,
  onAssignEmployee,
  onDeleteOrder,
  onLogout,
  onLanguageChange,
  onNavigate,
  onReturnToPlatform,
  onSwitchCompany,
  onSaveCategoryCard,
  onSaveOffer,
  onSaveProduct,
  onSaveBrand,
  onSaveCategory,
  onSaveCompanySettings,
  onSaveWebsiteMedia,
  onDeleteWebsiteMedia,
  onModerateReview,
  onDeleteReview,
  onStatusChange,
  isDarkMode,
  onToggleDarkMode,
  orders,
  products,
  reviews,
  statusMessage,
  t,
  websiteMedia = [],
  websiteMediaError = "",
}) {
  const [editingProduct, setEditingProduct] = React.useState(null);
  const [editingCategory, setEditingCategory] = React.useState(null);
  const [editingBrand, setEditingBrand] = React.useState(null);
  const [filters, setFilters] = React.useState({ brand: "all", category: "all", search: "", status: "all" });
  const adminCategories = categories;
  const companyId = company?.id || "";
  const storageKey = React.useCallback(
    (key) => tenantStorageKey(companyId, storageKeys[key]),
    [companyId],
  );
  const [vlogs, setVlogs] = React.useState([]);
  const [vlogHero, setVlogHero] = React.useState({ image: "", title: "" });
  const [stores, setStores] = React.useState([]);
  const [inventoryRows, setInventoryRows] = React.useState({});
  const [movements, setMovements] = React.useState([]);
  const [stockModalOpen, setStockModalOpen] = React.useState(false);

  React.useEffect(() => {
    if (!companyId) {
      setVlogs([]);
      setVlogHero({ image: "", title: "" });
      setStores([]);
      setInventoryRows({});
      setMovements([]);
      return;
    }
    setVlogs(readStorage(storageKey("vlogs"), []));
    setVlogHero(readStorage(storageKey("vlogHero"), { image: "", title: `${company.name} care stories` }));
    setStores(readStorage(storageKey("stores"), []));
    setInventoryRows(readStorage(storageKey("inventory"), {}));
    setMovements(readStorage(storageKey("movements"), []));
  }, [companyId, company?.name, storageKey]);

  const role = currentUser?.role;
  const canEdit = isTenantOperator(role);
  const canManageSensitive = isCompanyAdmin(role);
  const canManageProductContent = isCompanyAdmin(role) || ["product_content.manage", "products.manage", "products.update"].some((permission) => hasPermission(currentUser, permission));
  const canManageProductMedia = isCompanyAdmin(role) || ["product_media.manage", "products.manage", "products.update"].some((permission) => hasPermission(currentUser, permission));
  const canCreateProducts = isCompanyAdmin(role) || ["products.create", "products.manage"].some((permission) => hasPermission(currentUser, permission));
  const canUpdateProducts = isCompanyAdmin(role) || ["products.update", "products.manage"].some((permission) => hasPermission(currentUser, permission));
  const canDeleteProducts = isCompanyAdmin(role) || ["products.delete", "products.manage"].some((permission) => hasPermission(currentUser, permission));
  const readOnly = !canEdit;
  const customers = uniqueCustomersFromOrders(orders);
  const [title, subtitle] = pageMeta[activePage] || pageMeta.admin;

  if (!isTenantOperator(role)) {
    return (
      <AdminLayout
        activePage={activePage}
        company={company}
        currentUser={currentUser}
        isDarkMode={isDarkMode}
        language={language}
        modules={modules}
        onLanguageChange={onLanguageChange}
        onLogout={onLogout}
        onNavigate={onNavigate}
        onReturnToPlatform={onReturnToPlatform}
        onSwitchCompany={onSwitchCompany}
        onToggleDarkMode={onToggleDarkMode}
        subtitle="Admin access is required"
        title="Access denied"
      >
        <EmptyState title="Access denied" description="This portal is for admin and staff only." />
      </AdminLayout>
    );
  }

  function saveVlogs(next) { setVlogs(next); writeStorage(storageKey("vlogs"), next); }
  function saveStores(next) { setStores(next); writeStorage(storageKey("stores"), next); }
  function saveInventory(next) { setInventoryRows(next); writeStorage(storageKey("inventory"), next); }
  function saveMovements(next) { setMovements(next); writeStorage(storageKey("movements"), next); }

  function renderSimpleTable(kind) {
    const config = {
      categories: { rows: adminCategories, add: "admin-categories-new", search: "Search by name...", title: "Add Category" },
      brands: { rows: brands, add: "admin-brands-new", search: "Search by name...", title: "Add Brand" },
      vlogs: { rows: vlogs, add: "admin-vlogs-new", search: "Search by title...", title: "Add Vlog" },
      stores: { rows: stores, add: "admin-store-locator-new", search: "Search by name, city...", title: "Add Store" },
    }[kind];
    return (
      <section className="admin-panel-card">
        {kind === "vlogs" && (
          <div className="admin-vlog-hero">
            <MediaField label="Hero Image" name="image" value={vlogHero.image} onChange={(event) => setVlogHero((current) => ({ ...current, image: event.target.value }))} />
            <label>Hero Title<input value={vlogHero.title} onChange={(event) => setVlogHero((current) => ({ ...current, title: event.target.value }))} /></label>
            <button className="admin-primary-button" onClick={() => writeStorage(storageKey("vlogHero"), vlogHero)} type="button">Save Hero</button>
          </div>
        )}
        <Toolbar addLabel={config.title} onAdd={readOnly ? null : () => {
          if (kind === "categories") setEditingCategory(null);
          if (kind === "brands") setEditingBrand(null);
          onNavigate(config.add);
        }}>
          <SearchField placeholder={config.search} value="" onChange={() => {}} />
          <div className="admin-segmented"><button className="active" type="button">All</button><button type="button">Active</button><button type="button">Inactive</button></div>
          {kind === "vlogs" && <div className="admin-segmented"><button className="active" type="button">All</button><button type="button">Featured</button><button type="button">Standard</button></div>}
        </Toolbar>
        <AdminTable>
          <thead>
            {kind === "stores" ? <tr><th>Name</th><th>City</th><th>Country</th><th>Phone</th><th>Status</th><th>Sort</th><th>Actions</th></tr> :
              kind === "brands" ? <tr><th>Icon / Logo</th><th>Name</th><th>Country</th><th>Status</th><th>Created</th><th>Updated</th><th>Actions</th></tr> :
                kind === "vlogs" ? <tr><th>Thumbnail</th><th>Title</th><th>Type</th><th>Status</th><th>Created</th><th>Actions</th></tr> :
                  <tr><th>Icon</th><th>Name</th><th>Parent</th><th>Status</th><th>Created</th><th>Updated</th><th>Actions</th></tr>}
          </thead>
          <tbody>
            {config.rows.length ? config.rows.map((row, index) => (
              <tr key={row.id || index}>
                {kind === "stores" ? (
                  <><td>{row.name}</td><td>{row.city}</td><td>{row.country}</td><td>{row.phone || "-"}</td><td><Badge>{row.active === false ? "Inactive" : "Active"}</Badge></td><td>{row.sort || index + 1}</td><td>-</td></>
                ) : kind === "brands" ? (
                  <><td>{row.logoUrl ? <img className="admin-thumb" src={row.logoUrl} alt="" /> : <span className="admin-logo-mini">{row.name?.charAt(0)}</span>}</td><td>{row.name}</td><td>{row.country}</td><td><Badge>{row.isActive === false ? "Inactive" : "Active"}</Badge></td><td>{formatDate(row.createdAt)}</td><td>{formatDate(row.updatedAt)}</td><td>{!readOnly && <div className="row-actions"><button className="text-action" onClick={() => { setEditingBrand(row); onNavigate("admin-brands-new"); }} type="button">Edit</button><button className="text-action danger" onClick={() => onDeleteBrand(row.id)} type="button">Delete</button></div>}</td></>
                ) : kind === "vlogs" ? (
                  <><td>{row.thumbnail ? <img className="admin-thumb" src={row.thumbnail} alt="" /> : "-"}</td><td>{row.title}</td><td>{row.featured ? "Featured" : "Standard"}</td><td><Badge>{row.active === false ? "Inactive" : "Active"}</Badge></td><td>{formatDate(row.createdAt)}</td><td>-</td></>
                ) : (
                  <><td>{row.imageUrl ? <img className="admin-thumb" src={row.imageUrl} alt="" /> : <span className="admin-logo-mini">C</span>}</td><td>{getText(row.name)}</td><td>{row.parentId || "None"}</td><td><Badge>{row.isActive === false ? "Inactive" : "Active"}</Badge></td><td>{formatDate(row.createdAt)}</td><td>{formatDate(row.updatedAt)}</td><td>{!readOnly && <div className="row-actions"><button className="text-action" onClick={() => { setEditingCategory(row); onNavigate("admin-categories-new"); }} type="button">Edit</button><button className="text-action danger" onClick={() => onDeleteCategory(row.id)} type="button">Delete</button></div>}</td></>
                )}
              </tr>
            )) : <tr><td colSpan="7"><EmptyState title={kind === "vlogs" ? "No vlogs yet" : "No records yet"} description={kind === "vlogs" ? "Create your first vlog entry for the storefront." : ""} /></td></tr>}
          </tbody>
        </AdminTable>
      </section>
    );
  }

  function renderEntityForm(kind) {
    if (!canEdit) return <EmptyState title="View-only access" description="You do not have permission to create records." />;
    if (kind === "category") {
      const current = editingCategory;
      return <GenericEntityForm title={current ? "Edit Category" : "New Category"} initial={{ active: current?.isActive !== false, description: getText(current?.description), image: current?.imageUrl || "", name: getText(current?.name), parentId: current?.parentId || "", slug: current?.slug || "" }} fields={[
        { name: "name", label: "Category Name *", required: true }, { name: "slug", label: "Slug" }, { name: "description", label: "Description", type: "textarea" }, { name: "image", label: "Category Image", type: "media" }, { name: "parentId", label: "Parent Category", type: "select", options: [{ value: "", label: "None (top-level)" }, ...adminCategories.map((category) => ({ value: category.id, label: getText(category.name) }))] }, { name: "active", label: "Active", type: "checkbox" }, { name: "metaTitle", label: "Meta Title" }, { name: "metaDescription", label: "Meta Description", type: "textarea" },
      ]} onCancel={() => { setEditingCategory(null); onNavigate("admin-categories"); }} onSave={async (form) => { await onSaveCategory({ ...(current?.id ? { id: current.id } : {}), slug: form.slug || makeSlug(form.name), name: createLocalizedCopy(form.name, form.name), description: form.description ? createLocalizedCopy(form.description, form.description) : null, imageUrl: form.image || null, parentId: form.parentId || null, isActive: form.active }); setEditingCategory(null); onNavigate("admin-categories"); }} />;
    }
    if (kind === "brand") {
      const current = editingBrand;
      return <GenericEntityForm title={current ? "Edit Brand" : "New Brand"} initial={{ active: current?.isActive !== false, country: current?.country || "", logo: current?.logoUrl || "", name: current?.name || "", slug: current?.slug || "" }} fields={[
        { name: "name", label: "Brand Name *", required: true }, { name: "slug", label: "Slug" }, { name: "description", label: "Description", type: "textarea" }, { name: "country", label: "Country" }, { name: "website", label: "Website" }, { name: "logo", label: "Brand Logo", type: "media" }, { name: "active", label: "Active", type: "checkbox" }, { name: "metaTitle", label: "Meta Title" }, { name: "metaDescription", label: "Meta Description", type: "textarea" },
      ]} onCancel={() => { setEditingBrand(null); onNavigate("admin-brands"); }} onSave={async (form) => { await onSaveBrand({ ...(current?.id ? { id: current.id } : {}), slug: form.slug || makeSlug(form.name), name: form.name, country: form.country || null, logoUrl: form.logo || null, isActive: form.active }); setEditingBrand(null); onNavigate("admin-brands"); }} />;
    }
    if (kind === "vlog") {
      return <GenericEntityForm title="New Vlog" initial={{ active: true, featured: false }} fields={[
        { name: "title", label: "Title *", required: true }, { name: "slug", label: "Slug" }, { name: "description", label: "Description", type: "textarea" }, { name: "videoUrl", label: "Video URL *", required: true }, { name: "thumbnail", label: "Thumbnail", type: "media" }, { name: "active", label: "Active", type: "checkbox" }, { name: "featured", label: "Featured", type: "checkbox" },
      ]} onCancel={() => onNavigate("admin-vlogs")} onSave={(form) => { saveVlogs([{ id: form.slug || makeSlug(form.title), ...form, createdAt: new Date().toISOString() }, ...vlogs]); onNavigate("admin-vlogs"); }} />;
    }
    return <GenericEntityForm title="New Store" initial={{ active: true, country: "Palestine" }} fields={[
      { name: "name", label: "Name *", required: true }, { name: "address", label: "Address *", required: true }, { name: "city", label: "City *", required: true }, { name: "country", label: "Country *", required: true }, { name: "phone", label: "Phone" }, { name: "hours", label: "Hours" }, { name: "latitude", label: "Latitude" }, { name: "longitude", label: "Longitude" }, { name: "active", label: "Active", type: "checkbox" },
    ]} onCancel={() => onNavigate("admin-store-locator")} onSave={(form) => { saveStores([{ id: makeSlug(form.name) || `store-${Date.now()}`, ...form, sort: stores.length + 1 }, ...stores]); onNavigate("admin-store-locator"); }} />;
  }

  function renderReviews() {
    return (
      <section className="admin-panel-card">
        <Toolbar><select><option>Status</option><option>Pending</option><option>Approved</option><option>Rejected</option></select><select><option>Rating</option><option>5 Stars</option><option>4 Stars</option></select></Toolbar>
        <AdminTable>
          <thead><tr><th><input type="checkbox" /></th><th>Rating</th><th>Review</th><th>Product</th><th>Reviewer</th><th>Status</th><th>Created</th><th>Updated</th><th>Actions</th></tr></thead>
          <tbody>
            {reviews.length ? reviews.map((review) => <tr key={review.id}><td><input type="checkbox" /></td><td>{"★".repeat(Number(review.rating || 0))}</td><td>{getText(review.comment, language)}</td><td>{review.productName || "-"}</td><td>{review.customerName || "-"}</td><td><Badge tone={review.status === "rejected" ? "danger" : review.status === "approved" ? "active" : "warning"}>{review.status || "Pending"}</Badge></td><td>{formatDate(review.createdAt)}</td><td>{formatDate(review.updatedAt)}</td><td><div className="row-actions"><button className="text-action" onClick={() => onModerateReview(review.id, "approved", true)} type="button">Approve</button><button className="text-action danger" onClick={() => onDeleteReview?.(review.id)} type="button">Delete</button></div></td></tr>) : <tr><td colSpan="9">No reviews yet.</td></tr>}
          </tbody>
        </AdminTable>
      </section>
    );
  }

  function adjustStock(productId, delta, reason = "Adjustment", note = "") {
    const product = products.find((item) => item.id === productId);
    const next = { ...inventoryRows, [productId]: Math.max(0, (inventoryRows[productId] ?? getStockQty(product)) + Number(delta || 0)) };
    const move = { id: `move-${Date.now()}-${productId}`, date: new Date().toISOString(), product: getText(product?.name), variant: product?.sizes?.[0]?.size || "Default", delta: Number(delta || 0), reason, operator: currentUser?.name || currentUser?.role || "Admin", note };
    saveInventory(next);
    saveMovements([move, ...movements]);
  }

  function applyStockUpdates(deltas, reason, note) {
    Object.entries(deltas).forEach(([productId, delta]) => {
      if (Number(delta) !== 0) adjustStock(productId, Number(delta), reason, note);
    });
    setStockModalOpen(false);
  }

  function renderCustomers() {
    return (
      <section className="admin-panel-card">
        <Toolbar><SearchField placeholder="Search name, email, or phone..." value="" onChange={() => {}} /><select><option>Status</option></select><select><option>10 / page</option><option>25 / page</option><option>50 / page</option><option>100 / page</option></select></Toolbar>
        <AdminTable>
          <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Status</th><th>Orders</th><th>Created</th><th>Updated</th><th>Actions</th></tr></thead>
          <tbody>{customers.length ? customers.map((customer) => <tr key={`${customer.email}-${customer.phone}`}><td>{customer.name}</td><td>{customer.email}</td><td>{customer.phone}</td><td><Badge>{customer.status}</Badge></td><td>{customer.orders}</td><td>{formatDate(customer.createdAt)}</td><td>{formatDate(customer.updatedAt)}</td><td>-</td></tr>) : <tr><td colSpan="8">No customers yet.</td></tr>}</tbody>
        </AdminTable>
      </section>
    );
  }

  function renderActivePage() {
    switch (activePage) {
      case "admin-products":
        return <ProductsListPage brands={brands} canCreate={canCreateProducts} canDelete={canDeleteProducts} canUpdate={canUpdateProducts} categories={adminCategories} filters={filters} onAdd={() => { setEditingProduct(null); onNavigate("admin-products-new"); }} onDeleteProduct={onDeleteProduct} onEdit={(product) => { setEditingProduct(product); onNavigate("admin-products-new"); }} products={products} setFilters={setFilters} />;
      case "admin-products-new":
        if ((editingProduct && !canUpdateProducts) || (!editingProduct && !canCreateProducts)) return <EmptyState title="View-only access" description="You do not have permission to save products." />;
        return <ProductWizard brands={brands} categories={adminCategories} canManageContent={canManageProductContent} canManageMedia={canManageProductMedia} editingProduct={editingProduct} onCancel={() => onNavigate("admin-products")} onSave={onSaveProduct} />;
      case "admin-categories":
        return renderSimpleTable("categories");
      case "admin-categories-new":
        return renderEntityForm("category");
      case "admin-brands":
        return renderSimpleTable("brands");
      case "admin-brands-new":
        return renderEntityForm("brand");
      case "admin-vlogs":
        return renderSimpleTable("vlogs");
      case "admin-vlogs-new":
        return renderEntityForm("vlog");
      case "admin-store-locator":
        return renderSimpleTable("stores");
      case "admin-store-locator-new":
        return renderEntityForm("store");
      case "admin-website-media":
        return <WebsiteMediaManager error={websiteMediaError} items={websiteMedia} language={language} onDelete={onDeleteWebsiteMedia} onSave={onSaveWebsiteMedia} />;
      case "admin-orders":
        return <section className="admin-panel-card"><Toolbar><SearchField placeholder="Search order #, customer..." value="" onChange={() => {}} /><select><option>Status</option></select><select><option>Payment</option></select></Toolbar>{orders.length ? <AdminOrdersTable employees={employees} canDelete={canManageSensitive} language={language} onAssignEmployee={onAssignEmployee} onDeleteOrder={onDeleteOrder} onStatusChange={onStatusChange} orders={orders} products={products} t={t} /> : <EmptyState title="No orders found" description="No orders have been placed yet. Orders will appear here once customers complete their purchases." />}</section>;
      case "admin-reviews":
        return renderReviews();
      case "admin-inventory":
        return <><InventoryPage inventoryRows={inventoryRows} movements={movements} onAdjust={adjustStock} onOpenModal={() => setStockModalOpen(true)} products={products} />{stockModalOpen && <StockUpdateModal inventoryRows={inventoryRows} onApply={applyStockUpdates} onClose={() => setStockModalOpen(false)} products={products} />}</>;
      case "admin-customers":
        return renderCustomers();
      case "admin-settings":
        return canManageSensitive ? <SettingsPage company={company} onSave={onSaveCompanySettings} /> : <EmptyState title="Settings are restricted" description="Only admins can manage configuration." />;
      case "admin":
      default:
        return <DashboardHome customers={customers} language={language} orders={orders} products={products} t={t} />;
    }
  }

  return (
    <AdminLayout
      activePage={activePage}
      company={company}
      currentUser={currentUser}
      isDarkMode={isDarkMode}
      language={language}
      modules={modules}
      onLanguageChange={onLanguageChange}
      onLogout={onLogout}
      onNavigate={onNavigate}
      onReturnToPlatform={onReturnToPlatform}
      onSwitchCompany={onSwitchCompany}
      onToggleDarkMode={onToggleDarkMode}
      subtitle={subtitle}
      title={title}
    >
      <PermissionNotice role={role} />
      {statusMessage && <div className="message-panel success">{statusMessage}</div>}
      {renderActivePage()}
    </AdminLayout>
  );
}

export default AdminDashboardPage;
