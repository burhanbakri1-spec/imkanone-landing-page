import { products } from "./products.js";
import { homepageCategoryCards, homepageOffers, reviews as initialReviews } from "./seeds/homeContent.js";
import { defaultWebsiteMedia } from "./seeds/websiteMedia.js";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  findUsersByEmailFromSupabase,
  isSupabaseConfigured,
  listPlatformUsersFromSupabase,
  listCompanyMembershipsFromSupabase,
  loadStoreFromSupabase,
  saveCompanyToSupabase,
  saveCompanyMembershipToSupabase,
  savePlatformUserToSupabase,
  saveStoreToSupabase,
  saveSuperAdminUserToSupabase,
} from "./postgresStore.js";
import {
  COMPANY_STATUSES,
  DEFAULT_COMPANY_DOMAIN,
  DEFAULT_COMPANY_ID,
  defaultCompany,
  isSafeCompanySlug,
  normalizeCompanyHost,
  normalizeCompanyId,
  selectPreferredCompanyDomains,
} from "../tenancy/company.js";
import { hashPassword, isPasswordHash } from "../auth/passwords.js";
import { isVariantVisible, withVariantVisibility } from "../products/variantVisibility.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_STORE_DIR
  ? path.resolve(process.env.DATA_STORE_DIR)
  : path.resolve(__dirname, "../data-store");
const dataFile = path.join(dataDir, "store.json");

export const allPermissions = [
  "dashboard.view",
  "products.view",
  "products.create",
  "products.update",
  "products.delete",
  "orders.view",
  "orders.create",
  "orders.update",
  "orders.delete",
  "orders.updateStatus",
  "customers.view",
  "employees.view",
  "website_media.manage",
  "invoices.view",
  "delivery.view",
  "activity_log.view",
  "reports.view",
];

const seedUsers = [
  {
    id: "admin-demo",
    name: "EB Chemical Admin",
    email: "admin@epchemical.com",
    phone: "+970599000000",
    password: "admin123",
    role: "admin",
    permissions: allPermissions,
    isActive: true,
  },
  {
    id: "employee-demo",
    name: "EB Chemical Employee",
    email: "employee@epchemical.com",
    phone: "+970599000001",
    password: "employee123",
    role: "employee",
    department: "Sales",
    permissions: [
      "dashboard.view",
      "products.view",
      "orders.view",
      "orders.create",
      "orders.updateStatus",
    ],
    isActive: true,
  },
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const recordCompanies = new WeakMap();

function inputCompanyId(record) {
  return normalizeCompanyId(record?.company_id || record?.companyId);
}

function withoutCompanyFields(record) {
  if (!record || typeof record !== "object") return record;
  const { company_id: _companyId, companyId: _camelCompanyId, ...data } = record;
  return data;
}

function tagRecord(record, companyId = DEFAULT_COMPANY_ID) {
  if (record && typeof record === "object") {
    recordCompanies.set(record, normalizeCompanyId(companyId));
  }
  return record;
}

function normalizeTenantRecords(source, fallback, normalizer) {
  return ensureArray(source, fallback).map((record, index) => {
    const companyId = inputCompanyId(record);
    return tagRecord(normalizer(withoutCompanyFields(record), index), companyId);
  });
}

export function getRecordCompanyId(record) {
  return normalizeCompanyId(
    recordCompanies.get(record) || record?.company_id || record?.companyId,
  );
}

function readPersistedStore() {
  try {
    if (!fs.existsSync(dataFile)) return null;
    return JSON.parse(fs.readFileSync(dataFile, "utf8"));
  } catch (error) {
    console.warn("Could not read persistent store, using safe defaults.", error.message);
    return null;
  }
}

function ensureArray(value, fallback) {
  return Array.isArray(value) ? value : clone(fallback);
}

function normalizeGalleryImages(product) {
  const source = product.gallery_images || product.galleryImages || [];
  return source
    .map((entry, index) => {
      const imageUrl = typeof entry === "string" ? entry : entry?.image_url || entry?.image || entry?.url;
      if (!imageUrl) return null;
      return {
        id: typeof entry === "object" && entry?.id ? entry.id : `gallery-${index}-${Date.now()}`,
        image_url: imageUrl,
        sort_order: Number(typeof entry === "object" ? entry?.sort_order ?? entry?.sortOrder ?? index : index),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.sort_order - b.sort_order);
}

function normalizeVariants(product) {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  if (variants.length) {
    return variants
      .map((variant, index) => withVariantVisibility({
        ...variant,
        id: variant.id || `${product.id || "product"}-variant-${index}-${Date.now()}`,
        color_name: variant.color_name || variant.colorName || "Default",
        color_value: variant.color_value || variant.colorValue || variant.colorHex || "",
        size: variant.size || "500ml",
        price: Number(variant.price || 0),
        stock: Math.max(0, Number(variant.stock ?? variant.stockQty ?? product.stockQty ?? 0)),
        image_url: variant.image_url || variant.imageUrl || variant.image || "",
        sort_order: Number(variant.sort_order ?? variant.sortOrder ?? index),
      }))
      .sort((a, b) => a.sort_order - b.sort_order);
  }

  return (product.sizes || []).map((sizeOption, index) => withVariantVisibility({
    id: `${product.id || "product"}-variant-${index}`,
    color_name: "Default",
    color_value: "",
    size: sizeOption.size || "500ml",
    price: Number(sizeOption.price || 0),
    stock: Math.max(0, Number(product.stockQty ?? 24)),
    image_url: product.image || "",
    sort_order: index,
  }));
}

function sizesFromVariants(variants, fallbackSizes = []) {
  const bySize = new Map();
  variants.filter(isVariantVisible).forEach((variant) => {
    const current = bySize.get(variant.size);
    if (!current || Number(variant.price) < Number(current.price)) {
      bySize.set(variant.size, { size: variant.size, price: Number(variant.price || 0) });
    }
  });
  if (bySize.size) return Array.from(bySize.values());
  return variants.length ? [] : fallbackSizes;
}

function normalizeProduct(product, index = 0) {
  const image = product.image || "/images/products/product-placeholder.svg";
  const galleryImages = normalizeGalleryImages(product);
  const variants = normalizeVariants({ ...product, image });
  return {
    ...product,
    id: product.id || `product-${index}-${Date.now()}`,
    image,
    hoverImage:
      product.hoverImage ||
      product.secondaryImage ||
      product.gallery?.[1] ||
      "",
    variants,
    sizes: sizesFromVariants(variants, product.sizes || []),
    gallery_images: galleryImages,
    galleryImages: galleryImages.map((entry) => entry.image_url),
    fallbackImage: product.fallbackImage || "/images/products/product-placeholder.svg",
  };
}

function normalizeUser(user) {
  const previousBrand = [String.fromCharCode(69, 80), "Chemical"].join(" ");
  const name = user.name?.replace?.(previousBrand, "EB Chemical") || user.name;
  const ebPoints = Math.max(0, Number(user.ebPoints || 0));
  const totalPointsEarned = Math.max(0, Number(user.totalPointsEarned || 0));
  const totalPointsRedeemed = Math.max(0, Number(user.totalPointsRedeemed || 0));
  return {
    ...user,
    name,
    role: user.role || "customer",
    permissions: user.permissions || [],
    ebPoints,
    totalPointsEarned,
    totalPointsRedeemed,
    isActive: user.isActive !== false,
  };
}

function normalizeOrder(order) {
  const createdByEmployeeId = order.createdByEmployeeId || "";
  const handledByEmployeeId = order.handledByEmployeeId || order.assignedToEmployeeId || "";
  return {
    ...order,
    id: order.id || `ORD-${Date.now()}`,
    customer: order.customer || {},
    items: order.items || [],
    subtotal: Number(order.subtotal || order.total || 0),
    total: Number(order.total || order.subtotal || 0),
    pointsEarned: Math.max(0, Number(order.pointsEarned || 0)),
    pointsRedeemed: Math.max(0, Number(order.pointsRedeemed || 0)),
    discountFromPoints: Math.max(0, Number(order.discountFromPoints || 0)),
    status: order.status || "Pending",
    handledByEmployeeId,
    assignedToEmployeeId: order.assignedToEmployeeId || handledByEmployeeId,
    createdByEmployeeId,
    createdByEmployeeName: order.createdByEmployeeName || "",
    createdAt: order.createdAt || new Date().toISOString(),
    updatedAt: order.updatedAt || order.createdAt || new Date().toISOString(),
  };
}

function normalizeOffer(offer, index = 0) {
  return {
    ...offer,
    id: offer.id || `offer-${index}-${Date.now()}`,
    title: offer.title || { en: "", ar: "" },
    description: offer.description || { en: "", ar: "" },
    ctaText: offer.ctaText || { en: "Shop now", ar: "تسوق الآن" },
    ctaLink: offer.ctaLink || "products",
    displayOrder: Number(offer.displayOrder || index + 1),
    isActive: offer.isActive !== false,
  };
}

function normalizeCategoryCard(card, index = 0) {
  return {
    ...card,
    key: card.key || `card-${index}`,
    image: card.image || "/images/products/product-placeholder.svg",
    label: card.label || { en: "", ar: "" },
    title: card.title || { en: "", ar: "" },
    displayOrder: Number(card.displayOrder || index + 1),
    isActive: card.isActive !== false,
  };
}

function normalizeReview(review, index = 0) {
  const type = review.type === "employee" || review.employeeId ? "employee" : "store";
  const status = review.status || (review.isApproved === false ? "rejected" : "approved");
  return {
    ...review,
    id: review.id || `review-${index}-${Date.now()}`,
    type,
    rating: Math.max(1, Math.min(5, Number(review.rating || 5))),
    customerName: review.customerName || "Customer",
    comment: review.comment || { en: "", ar: "" },
    employeeId: review.employeeId || "",
    employeeName: review.employeeName || "",
    orderId: review.orderId || "",
    status,
    isApproved: status === "approved",
    createdAt: review.createdAt || new Date().toISOString(),
    isActive: review.isActive !== false && status !== "rejected",
  };
}

function normalizeWebsiteMedia(item, index = 0) {
  return {
    ...item,
    id: item.id || `website-media-${index}`,
    sectionKey: item.sectionKey || item.section_key || `custom_section_${index}`,
    sectionLabel: item.sectionLabel || item.section_label || item.sectionKey || "Website image",
    groupKey: item.groupKey || item.group_key || "sections",
    fallbackImageUrl: item.fallbackImageUrl || item.fallback_image_url || "",
    imageUrl: item.imageUrl ?? item.image_url ?? "",
    title: item.title || "",
    subtitle: item.subtitle || "",
    linkUrl: item.linkUrl || item.link_url || "",
    sortOrder: Number(item.sortOrder ?? item.sort_order ?? index),
    isActive: item.isActive !== false && item.is_active !== false,
  };
}

function defaultWebsiteMediaDefinition(item) {
  return {
    ...item,
    fallbackImageUrl: item.fallbackImageUrl || item.imageUrl || "",
    imageUrl: "",
  };
}

function mediaTimestamp(item) {
  const timestamp = new Date(item?.updatedAt || item?.updated_at || item?.createdAt || item?.created_at || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function preferWebsiteMediaItem(current, next) {
  if (!current) return next;

  const currentHasImage = Boolean(current.imageUrl || current.image_url);
  const nextHasImage = Boolean(next.imageUrl || next.image_url);

  const preferred =
    nextHasImage && !currentHasImage
      ? next
      : !nextHasImage && currentHasImage
        ? current
        : mediaTimestamp(next) >= mediaTimestamp(current)
          ? next
          : current;

  return {
    ...current,
    ...preferred,
    id: preferred.id || current.id,
    sectionKey: preferred.sectionKey || preferred.section_key || current.sectionKey || current.section_key,
    sectionLabel: preferred.sectionLabel || preferred.section_label || current.sectionLabel || current.section_label,
    groupKey: preferred.groupKey || preferred.group_key || current.groupKey || current.group_key,
    fallbackImageUrl: current.fallbackImageUrl || current.fallback_image_url || preferred.fallbackImageUrl || "",
    imageUrl: preferred.imageUrl ?? preferred.image_url ?? "",
  };
}

const allowedCompanyStatuses = new Set(COMPANY_STATUSES);

function normalizeCompanyRecord(company = {}, index = 0) {
  const id = String(company.id || company.slug || `company-${index}`).trim().toLowerCase();
  const isDefault = id === DEFAULT_COMPANY_ID;
  const now = new Date().toISOString();
  const settings = company.settings && typeof company.settings === "object" && !Array.isArray(company.settings)
    ? clone(company.settings)
    : company.publicSettings && typeof company.publicSettings === "object"
      ? clone(company.publicSettings)
      : {};
  const preferredDomains = selectPreferredCompanyDomains([
    ...(Array.isArray(company.domains) ? company.domains : []),
    company.domain,
    ...(isDefault ? [DEFAULT_COMPANY_DOMAIN] : []),
  ]);
  return {
    id,
    slug: isDefault ? DEFAULT_COMPANY_ID : String(company.slug || id).trim().toLowerCase(),
    name: String(company.name || (isDefault ? defaultCompany.name : "Unnamed company")).trim(),
    status: isDefault
      ? "active"
      : allowedCompanyStatuses.has(company.status)
        ? company.status
        : "inactive",
    isDefault,
    domain: preferredDomains[0]?.domain || (isDefault ? DEFAULT_COMPANY_DOMAIN : ""),
    domains: preferredDomains.map((entry) => entry.domain),
    settings,
    createdAt: company.createdAt || company.created_at || now,
    updatedAt: company.updatedAt || company.updated_at || company.createdAt || now,
    _domainId: company._domainId || "",
  };
}

function membershipRoleForUser(user) {
  if (user?.role === "super_admin") return "super_admin";
  if (user?.role === "admin") return "company_admin";
  if (["employee", "staff", "manager"].includes(user?.role)) return "employee";
  return "customer";
}

function normalizeMembership(membership = {}, index = 0) {
  const companyId = normalizeCompanyId(membership.companyId || membership.company_id);
  const userId = String(membership.userId || membership.user_id || "").trim();
  const now = new Date().toISOString();
  return {
    id: String(membership.id || `${companyId}:${userId || index}`),
    companyId,
    userId,
    role: String(membership.role || "customer"),
    status: membership.status === "inactive" || membership.is_active === false
      ? "inactive"
      : "active",
    _permissions: Array.isArray(membership._permissions)
      ? clone(membership._permissions)
      : Array.isArray(membership.permissions)
        ? clone(membership.permissions)
        : [],
    createdAt: membership.createdAt || membership.created_at || now,
    updatedAt: membership.updatedAt || membership.updated_at || membership.createdAt || now,
  };
}

function initializeCompanies(source) {
  const byId = new Map();
  ensureArray(source, []).forEach((company, index) => {
    const normalized = normalizeCompanyRecord(company, index);
    if (isSafeCompanySlug(normalized.id)) byId.set(normalized.id, normalized);
  });

  const persistedDefault = byId.get(DEFAULT_COMPANY_ID) || {};
  byId.set(DEFAULT_COMPANY_ID, normalizeCompanyRecord({
    ...defaultCompany,
    ...persistedDefault,
    id: DEFAULT_COMPANY_ID,
    slug: DEFAULT_COMPANY_ID,
    status: "active",
    isDefault: true,
    domain: DEFAULT_COMPANY_DOMAIN,
  }));

  return [
    byId.get(DEFAULT_COMPANY_ID),
    ...[...byId.values()].filter((company) => company.id !== DEFAULT_COMPANY_ID),
  ];
}

function serializeCompany(company) {
  const { _domainId: _internalDomainId, ...record } = company;
  return clone(record);
}

async function readInitialStore(companyId = DEFAULT_COMPANY_ID) {
  if (!isSupabaseConfigured()) {
    return { persisted: readPersistedStore(), canPersistToSupabase: false };
  }

  try {
    const result = await loadStoreFromSupabase(companyId);
    const localFallback = readPersistedStore();
    return {
      persisted: result.isEmpty
        ? { ...(localFallback || {}), companies: result.store.companies || [] }
        : result.store,
      canPersistToSupabase: true,
    };
  } catch (error) {
    console.warn("Could not read Supabase store, using local fallback without remote writes.", error.message);
    return { persisted: readPersistedStore(), canPersistToSupabase: false };
  }
}

const initialStore = await readInitialStore();
const persisted = initialStore.persisted;
let canPersistToSupabase = initialStore.canPersistToSupabase;

export const companies = initializeCompanies(persisted?.companies);
export const users = normalizeTenantRecords(persisted?.users, seedUsers, normalizeUser);
const membershipSource = Array.isArray(persisted?.memberships)
  ? persisted.memberships
  : users.map((user) => ({
      id: `${getRecordCompanyId(user)}:${user.id}`,
      companyId: getRecordCompanyId(user),
      userId: user.id,
      role: membershipRoleForUser(user),
      status: user.isActive === false ? "inactive" : "active",
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));
export const companyMemberships = membershipSource
  .map(normalizeMembership)
  .filter((membership) => membership.userId);
export const orders = normalizeTenantRecords(persisted?.orders, [], normalizeOrder);
export const sessions = new Map();
export const carts = new Map();
export const workSessions = normalizeTenantRecords(
  persisted?.workSessions,
  [],
  (session) => session,
);
export const productCatalog = normalizeTenantRecords(
  persisted?.products,
  products,
  normalizeProduct,
);
export const offers = normalizeTenantRecords(persisted?.offers, homepageOffers, normalizeOffer);
export const categoryCards = normalizeTenantRecords(
  persisted?.categoryCards,
  homepageCategoryCards,
  normalizeCategoryCard,
);
export const reviews = normalizeTenantRecords(persisted?.reviews, initialReviews, normalizeReview);
const persistedWebsiteMedia = Array.isArray(persisted?.websiteMedia) ? persisted.websiteMedia : [];
const websiteMediaBySection = new Map(
  clone(defaultWebsiteMedia).map((item) => {
    const definition = defaultWebsiteMediaDefinition(item);
    return [definition.sectionKey || definition.id, definition];
  }),
);
persistedWebsiteMedia
  .filter((item) => inputCompanyId(item) === DEFAULT_COMPANY_ID)
  .forEach((item, index) => {
  const sectionKey = item.sectionKey || item.section_key || item.id || `persisted-website-media-${index}`;
  websiteMediaBySection.set(sectionKey, preferWebsiteMediaItem(websiteMediaBySection.get(sectionKey), item));
});
export const websiteMedia = [...websiteMediaBySection.values()].map((item, index) =>
  tagRecord(normalizeWebsiteMedia(withoutCompanyFields(item), index), DEFAULT_COMPANY_ID),
);
export const customAdminModules = normalizeTenantRecords(
  persisted?.customAdminModules,
  [],
  normalizeCustomAdminModule,
);
export const customAdminModuleEntries = normalizeTenantRecords(
  persisted?.customAdminModuleEntries,
  [],
  normalizeCustomAdminModuleEntry,
);

export const invoices = normalizeTenantRecords(
  persisted?.invoices,
  [],
  (inv) => inv,
);

export const deliveryZones = normalizeTenantRecords(
  persisted?.deliveryZones,
  [],
  (z) => z,
);

export const activityLogs = normalizeTenantRecords(
  persisted?.activityLogs,
  [],
  (log) => log,
);

class TenantRepository {
  constructor(collection, idKey = "id") {
    this.collection = collection;
    this.idKey = idKey;
  }

  getByCompany(companyId) {
    const normalized = normalizeCompanyId(companyId);
    return this.collection.filter((record) => getRecordCompanyId(record) === normalized);
  }

  findByCompany(companyId, predicateOrId) {
    const predicate =
      typeof predicateOrId === "function"
        ? predicateOrId
        : (record) => record?.[this.idKey] === predicateOrId;
    return this.getByCompany(companyId).find(predicate) || null;
  }

  createForCompany(companyId, record, options = {}) {
    tagRecord(record, companyId);
    if (options.prepend) this.collection.unshift(record);
    else this.collection.push(record);
    return record;
  }

  updateForCompany(companyId, id, update) {
    const normalized = normalizeCompanyId(companyId);
    const index = this.collection.findIndex(
      (record) => getRecordCompanyId(record) === normalized && record?.[this.idKey] === id,
    );
    if (index === -1) return null;

    const current = this.collection[index];
    const next = typeof update === "function" ? update(current) : { ...current, ...update };
    tagRecord(next, normalized);
    this.collection[index] = next;
    return next;
  }

  deleteForCompany(companyId, id) {
    const normalized = normalizeCompanyId(companyId);
    const index = this.collection.findIndex(
      (record) => getRecordCompanyId(record) === normalized && record?.[this.idKey] === id,
    );
    if (index === -1) return null;
    return this.collection.splice(index, 1)[0];
  }
}

function cartKey(companyId, userId) {
  return `${normalizeCompanyId(companyId)}:${userId}`;
}

const initialCarts =
  persisted?.companyCarts?.[DEFAULT_COMPANY_ID] || persisted?.carts || {};
Object.entries(initialCarts).forEach(([userId, items]) => {
  carts.set(cartKey(DEFAULT_COMPANY_ID, userId), items);
});

export const cartRepository = {
  getByCompany(companyId) {
    const prefix = `${normalizeCompanyId(companyId)}:`;
    return [...carts.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, items]) => ({ userId: key.slice(prefix.length), items }));
  },
  findByCompany(companyId, userId) {
    return carts.get(cartKey(companyId, userId)) || null;
  },
  createForCompany(companyId, { userId, items = [] }) {
    carts.set(cartKey(companyId, userId), items);
    return items;
  },
  updateForCompany(companyId, userId, items = []) {
    carts.set(cartKey(companyId, userId), items);
    return items;
  },
  deleteForCompany(companyId, userId) {
    return carts.delete(cartKey(companyId, userId));
  },
};

export const userRepository = new TenantRepository(users);
export const orderRepository = new TenantRepository(orders);
export const workSessionRepository = new TenantRepository(workSessions);
export const productRepository = new TenantRepository(productCatalog);
export const offerRepository = new TenantRepository(offers);
export const categoryCardRepository = new TenantRepository(categoryCards, "key");
export const reviewRepository = new TenantRepository(reviews);
export const websiteMediaRepository = new TenantRepository(websiteMedia);
export const customAdminModuleRepository = new TenantRepository(customAdminModules);
export const customAdminModuleEntryRepository = new TenantRepository(customAdminModuleEntries);
export const invoiceRepository = new TenantRepository(invoices);
export const deliveryZoneRepository = new TenantRepository(deliveryZones);
export const activityLogRepository = new TenantRepository(activityLogs);

function platformDirectoryError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeCustomAdminModule(module, index = 0) {
  const now = new Date().toISOString();
  return {
    ...module,
    id: String(module.id || `custom-module-${index}-${Date.now()}`),
    key: String(module.key || `custom_module_${index}`),
    label: String(module.label || "Custom Module"),
    description: String(module.description || ""),
    icon: String(module.icon || "folder"),
    sidebarOrder: Number(module.sidebarOrder ?? module.sidebar_order ?? 100),
    enabled: module.enabled !== false,
    fieldsSchema: Array.isArray(module.fieldsSchema ?? module.fields_schema)
      ? clone(module.fieldsSchema ?? module.fields_schema)
      : [],
    listConfig: clone(module.listConfig ?? module.list_config ?? {}),
    formConfig: clone(module.formConfig ?? module.form_config ?? {}),
    permissions: clone(module.permissions || {}),
    createdBy: module.createdBy || module.created_by || "",
    updatedBy: module.updatedBy || module.updated_by || "",
    createdAt: module.createdAt || module.created_at || now,
    updatedAt: module.updatedAt || module.updated_at || module.createdAt || now,
  };
}

function normalizeCustomAdminModuleEntry(entry, index = 0) {
  const now = new Date().toISOString();
  return {
    ...entry,
    id: String(entry.id || `custom-entry-${index}-${Date.now()}`),
    moduleId: String(entry.moduleId || entry.module_id || ""),
    data: entry.data && typeof entry.data === "object" && !Array.isArray(entry.data)
      ? clone(entry.data)
      : {},
    status: entry.status === "deleted" ? "deleted" : "active",
    createdBy: entry.createdBy || entry.created_by || "",
    updatedBy: entry.updatedBy || entry.updated_by || "",
    createdAt: entry.createdAt || entry.created_at || now,
    updatedAt: entry.updatedAt || entry.updated_at || entry.createdAt || now,
  };
}

function superAdminProvisioningError(message, code) {
  const error = new Error(message);
  error.code = code;
  error.safeForCli = true;
  return error;
}

export async function provisionSuperAdmin({
  email,
  name,
  passwordHash,
  allowUpdate = false,
}) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail || !isPasswordHash(passwordHash)) {
    throw superAdminProvisioningError(
      "Validated email and hashed password are required.",
      "INVALID_SUPER_ADMIN_INPUT",
    );
  }

  if (isSupabaseConfigured() && !canPersistToSupabase) {
    throw superAdminProvisioningError(
      "Supabase company tables are unavailable. Apply and validate the Phase 1 migration in staging first.",
      "SUPER_ADMIN_SUPABASE_NOT_READY",
    );
  }

  let candidates = new Map(
    userRepository
      .getByCompany(DEFAULT_COMPANY_ID)
      .filter((user) => String(user.email || "").trim().toLowerCase() === normalizedEmail)
      .map((user) => [user.id, user]),
  );

  if (isSupabaseConfigured()) {
    const remoteUsers = await findUsersByEmailFromSupabase(normalizedEmail);
    candidates = new Map(remoteUsers.map((user) => [user.id, user]));
  }

  if (candidates.size > 1) {
    throw superAdminProvisioningError(
      "Multiple users have the requested email. Resolve duplicate identities before provisioning.",
      "SUPER_ADMIN_EMAIL_AMBIGUOUS",
    );
  }

  const existing = [...candidates.values()][0] || null;
  if (existing && allowUpdate !== true) {
    throw superAdminProvisioningError(
      "A user with this email already exists. Set SUPER_ADMIN_ALLOW_UPDATE=true to promote and update it.",
      "SUPER_ADMIN_UPDATE_NOT_ALLOWED",
    );
  }

  const now = new Date().toISOString();
  const id = existing?.id || `super-admin-${crypto
    .createHash("sha256")
    .update(normalizedEmail)
    .digest("hex")
    .slice(0, 24)}`;
  const next = normalizeUser({
    ...(existing || {}),
    id,
    name: String(name || "").trim() || existing?.name || "Super Admin",
    email: normalizedEmail,
    password: passwordHash,
    role: "super_admin",
    permissions: existing?.permissions || [],
    isActive: true,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  });

  const repositoryCurrent = userRepository.findByCompany(DEFAULT_COMPANY_ID, id);
  const previous = repositoryCurrent ? clone(repositoryCurrent) : null;
  if (repositoryCurrent) userRepository.updateForCompany(DEFAULT_COMPANY_ID, id, next);
  else userRepository.createForCompany(DEFAULT_COMPANY_ID, next);

  try {
    await persistSuperAdminUser(next, existing);
  } catch (error) {
    if (previous) userRepository.updateForCompany(DEFAULT_COMPANY_ID, id, previous);
    else userRepository.deleteForCompany(DEFAULT_COMPANY_ID, id);
    throw error;
  }

  return {
    created: !existing,
    user: {
      id: next.id,
      email: next.email,
      name: next.name,
      role: next.role,
    },
  };
}

function companyRepositoryError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function companyByIdInternal(id) {
  const normalized = String(id || "").trim().toLowerCase();
  return companies.find((company) => company.id === normalized) || null;
}

function assertUniqueCompanyFields(candidate, currentId = "") {
  const duplicateSlug = companies.find(
    (company) => company.id !== currentId && company.slug === candidate.slug,
  );
  if (duplicateSlug) throw companyRepositoryError("Company slug already exists.", 409);

  if (candidate.domain) {
    const duplicateDomain = companies.find(
      (company) => company.id !== currentId && company.domain === candidate.domain,
    );
    if (duplicateDomain) throw companyRepositoryError("Company domain already exists.", 409);
  }
}

export const companyRepository = {
  listCompanies() {
    return companies.map(serializeCompany);
  },

  getCompanyById(id) {
    const company = companyByIdInternal(id);
    return company ? serializeCompany(company) : null;
  },

  getCompanyBySlug(slug) {
    const normalized = String(slug || "").trim().toLowerCase();
    const company = companies.find((entry) => entry.slug === normalized);
    return company ? serializeCompany(company) : null;
  },

  async createCompanyDraft(input) {
    const slug = String(input?.slug || "").trim().toLowerCase();
    const name = String(input?.name || "").trim();
    const status = input?.status || "draft";
    if (!name) throw companyRepositoryError("Company name is required.");
    if (!isSafeCompanySlug(slug)) throw companyRepositoryError("Company slug is invalid.");
    if (!allowedCompanyStatuses.has(status)) throw companyRepositoryError("Company status is invalid.");
    if (companyByIdInternal(slug)) throw companyRepositoryError("Company ID already exists.", 409);

    const now = new Date().toISOString();
    const company = normalizeCompanyRecord({
      id: slug,
      slug,
      name,
      status,
      isDefault: false,
      domain: normalizeCompanyHost(input?.domain),
      settings: input?.settings || {},
      createdAt: now,
      updatedAt: now,
    });
    assertUniqueCompanyFields(company);
    companies.push(company);

    try {
      await persistCompanyDirectory(company);
    } catch (error) {
      companies.splice(companies.indexOf(company), 1);
      throw error;
    }

    return serializeCompany(company);
  },

  async updateCompanyDraft(id, changes) {
    const current = companyByIdInternal(id);
    if (!current) throw companyRepositoryError("Company not found.", 404);
    if (changes?.id !== undefined && changes.id !== current.id) {
      throw companyRepositoryError("Company ID cannot be changed.");
    }

    if (current.id === DEFAULT_COMPANY_ID) {
      if (changes?.slug !== undefined && changes.slug !== DEFAULT_COMPANY_ID) {
        throw companyRepositoryError("EB Chemical slug cannot be changed.");
      }
      if (changes?.status !== undefined && changes.status !== "active") {
        throw companyRepositoryError("EB Chemical must remain active.");
      }
      if (
        changes?.domain !== undefined
        && normalizeCompanyHost(changes.domain) !== DEFAULT_COMPANY_DOMAIN
      ) {
        throw companyRepositoryError("EB Chemical domain cannot be changed in this phase.");
      }
      if (changes?.isDefault === false) {
        throw companyRepositoryError("EB Chemical must remain the default company.");
      }
    }

    const next = normalizeCompanyRecord({
      ...current,
      ...changes,
      id: current.id,
      isDefault: current.id === DEFAULT_COMPANY_ID,
      updatedAt: new Date().toISOString(),
    });
    if (!next.name) throw companyRepositoryError("Company name cannot be empty.");
    if (!isSafeCompanySlug(next.slug)) throw companyRepositoryError("Company slug is invalid.");
    if (!allowedCompanyStatuses.has(next.status)) throw companyRepositoryError("Company status is invalid.");
    assertUniqueCompanyFields(next, current.id);

    const index = companies.indexOf(current);
    companies[index] = next;
    try {
      await persistCompanyDirectory(next);
    } catch (error) {
      companies[index] = current;
      throw error;
    }

    return serializeCompany(next);
  },

  async disableCompany(id) {
    const current = companyByIdInternal(id);
    if (!current) throw companyRepositoryError("Company not found.", 404);
    if (current.id === DEFAULT_COMPANY_ID) {
      throw companyRepositoryError("EB Chemical cannot be disabled.");
    }
    return this.updateCompanyDraft(current.id, { status: "inactive" });
  },
};

const allowedMembershipRoles = new Set([
  "admin",
  "manager",
  "company_admin",
  "employee",
  "staff",
  "customer",
]);
const allowedMembershipStatuses = new Set(["active", "inactive"]);

function membershipRepositoryError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function assertMembershipCompany(companyId) {
  const company = companyByIdInternal(companyId);
  if (!company) throw membershipRepositoryError("Company not found.", 404);
  return company;
}

function validateMembershipValues(role, status) {
  if (!allowedMembershipRoles.has(role)) {
    throw membershipRepositoryError("Membership role is invalid.");
  }
  if (!allowedMembershipStatuses.has(status)) {
    throw membershipRepositoryError("Membership status is invalid.");
  }
}

function localMembershipsForCompany(companyId) {
  const normalized = normalizeCompanyId(companyId);
  const usersById = new Map(
    userRepository.getByCompany(normalized).map((user) => [user.id, user]),
  );
  const membershipsByUser = new Map(
    companyMemberships
      .filter((membership) => membership.companyId === normalized)
      .map((membership) => [membership.userId, membership]),
  );

  for (const user of usersById.values()) {
    if (membershipsByUser.has(user.id)) continue;
    membershipsByUser.set(user.id, normalizeMembership({
      id: `${normalized}:${user.id}`,
      companyId: normalized,
      userId: user.id,
      role: membershipRoleForUser(user),
      status: user.isActive === false ? "inactive" : "active",
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));
  }

  return [...membershipsByUser.values()].map((membership) => ({
    ...clone(membership),
    user: usersById.get(membership.userId) || users.find((user) => user.id === membership.userId) || null,
  }));
}

async function membershipsForCompany(companyId) {
  const normalized = normalizeCompanyId(companyId);
  if (isSupabaseConfigured()) {
    if (!canPersistToSupabase) {
      throw membershipRepositoryError(
        "Supabase membership tables are unavailable. Validate the Phase 1 migration in staging first.",
        503,
      );
    }
    return listCompanyMembershipsFromSupabase(normalized);
  }
  return localMembershipsForCompany(normalized);
}

function assertMutableMembership(membership, user) {
  if (membership?.role === "super_admin" || user?.role === "super_admin") {
    throw membershipRepositoryError(
      "Super Admin identities and memberships remain CLI-managed.",
      403,
    );
  }
}

function assertLastEbAdmin(companyId, current, next, memberships) {
  if (normalizeCompanyId(companyId) !== DEFAULT_COMPANY_ID) return;
  const removesAdmin = current?.role === "company_admin"
    && current?.status === "active"
    && (next.role !== "company_admin" || next.status !== "active");
  if (!removesAdmin) return;
  const activeAdmins = memberships.filter(
    (membership) => membership.role === "company_admin"
      && membership.status === "active"
      && Boolean(membership.user)
      && membership.user?.isActive !== false,
  );
  if (activeAdmins.length <= 1) {
    throw membershipRepositoryError("The last active EB Chemical company admin cannot be disabled.", 409);
  }
}

function globalUsersByEmail(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  return new Map(
    users
      .filter((user) => String(user.email || "").trim().toLowerCase() === normalizedEmail)
      .map((user) => [user.id, user]),
  );
}

function createInactiveUserShell(email, name, companyId) {
  const id = `user-${crypto.randomUUID()}`;
  return tagRecord(normalizeUser({
    id,
    name: String(name || "").trim() || email.split("@")[0],
    email,
    phone: "",
    password: "",
    role: "customer",
    permissions: [],
    isActive: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }), companyId);
}

async function persistMembershipRecord(membership, user, createUser, previousMembership = null) {
  if (isSupabaseConfigured()) {
    await saveCompanyMembershipToSupabase({ membership, user, createUser });
    return;
  }

  const currentIndex = companyMemberships.findIndex((entry) => entry.id === membership.id);
  const addedUser = createUser ? userRepository.createForCompany(membership.companyId, user) : null;
  if (currentIndex === -1) companyMemberships.push(membership);
  else companyMemberships[currentIndex] = membership;

  try {
    persistLocalMembershipDirectory();
  } catch (error) {
    if (currentIndex === -1) {
      companyMemberships.splice(companyMemberships.indexOf(membership), 1);
    } else {
      companyMemberships[currentIndex] = previousMembership;
    }
    if (addedUser) userRepository.deleteForCompany(membership.companyId, addedUser.id);
    throw error;
  }
}

export const companyMembershipRepository = {
  async listAllMemberships() {
    const allMemberships = await Promise.all(
      companies.map(async (company) => {
        const memberships = await membershipsForCompany(company.id);
        return memberships.map((membership) => ({
          ...membership,
          company: serializeCompany(company),
        }));
      }),
    );
    return allMemberships.flat();
  },

  async listUsersForCompany(companyId) {
    assertMembershipCompany(companyId);
    return membershipsForCompany(companyId);
  },

  async getMembershipByCompanyAndUser(companyId, userId) {
    assertMembershipCompany(companyId);
    const memberships = await membershipsForCompany(companyId);
    return memberships.find((membership) => membership.userId === userId) || null;
  },

  async createOrUpdateMembership(companyId, input) {
    const company = assertMembershipCompany(companyId);
    const normalizedCompanyId = company.id;
    const email = String(input?.email || "").trim().toLowerCase();
    const role = input?.role;
    const status = input?.status || "active";
    validateMembershipValues(role, status);

    let candidates = globalUsersByEmail(email);
    if (isSupabaseConfigured()) {
      const remoteUsers = await findUsersByEmailFromSupabase(email);
      candidates = new Map(remoteUsers.map((user) => [user.id, user]));
    }
    if (candidates.size > 1) {
      throw membershipRepositoryError(
        "Multiple users match this email. Resolve duplicate identities first.",
        409,
      );
    }

    const existingUser = [...candidates.values()][0] || null;
    const user = existingUser || createInactiveUserShell(email, input?.name, normalizedCompanyId);
    const memberships = await membershipsForCompany(normalizedCompanyId);
    const current = memberships.find((membership) => membership.userId === user.id) || null;
    assertMutableMembership(current, user);

    const now = new Date().toISOString();
    const membership = normalizeMembership({
      ...(current || {}),
      id: `${normalizedCompanyId}:${user.id}`,
      companyId: normalizedCompanyId,
      userId: user.id,
      role,
      status,
      createdAt: current?.createdAt || now,
      updatedAt: now,
    });
    assertLastEbAdmin(normalizedCompanyId, current, membership, memberships);
    await persistMembershipRecord(
      membership,
      user,
      !existingUser,
      current ? normalizeMembership(current) : null,
    );
    return { ...clone(membership), user };
  },

  async updateMembership(companyId, userId, changes) {
    const company = assertMembershipCompany(companyId);
    const memberships = await membershipsForCompany(company.id);
    const current = memberships.find((membership) => membership.userId === userId);
    if (!current) throw membershipRepositoryError("Membership not found.", 404);
    assertMutableMembership(current, current.user);

    const role = changes?.role || current.role;
    const status = changes?.status || current.status;
    validateMembershipValues(role, status);
    const membership = normalizeMembership({
      ...current,
      companyId: company.id,
      role,
      status,
      updatedAt: new Date().toISOString(),
    });
    assertLastEbAdmin(company.id, current, membership, memberships);
    await persistMembershipRecord(membership, current.user, false, normalizeMembership(current));
    return { ...clone(membership), user: current.user };
  },

  async disableMembership(companyId, userId) {
    return this.updateMembership(companyId, userId, { status: "inactive" });
  },

  async updateMembershipById(id, changes) {
    const memberships = await this.listAllMemberships();
    const matches = memberships.filter((membership) => membership.id === id);
    if (matches.length > 1) {
      throw membershipRepositoryError("Membership ID is ambiguous.", 409);
    }
    const current = matches[0];
    if (!current) throw membershipRepositoryError("Membership not found.", 404);
    return this.updateMembership(current.companyId, current.userId, changes);
  },
};

async function assertPlatformUserStatusChangeSafe(user, isActive) {
  if (user.role === "super_admin") {
    throw platformDirectoryError("Super Admin identities remain CLI-managed.", 403);
  }
  if (isActive !== false || user.isActive === false) return;

  for (const company of companies) {
    const memberships = await membershipsForCompany(company.id);
    const membership = memberships.find(
      (entry) => entry.userId === user.id
        && entry.role === "company_admin"
        && entry.status === "active",
    );
    if (!membership) continue;
    assertLastEbAdmin(
      company.id,
      membership,
      { ...membership, status: "inactive" },
      memberships,
    );
  }
}

function assertPlatformUserCreateSafe(input) {
  if (!input || typeof input !== "object") {
    throw platformDirectoryError("Request body must be an object.");
  }
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw platformDirectoryError("email must be a valid email address.");
  }
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) throw platformDirectoryError("name is required.");
  if (name.length > 120) throw platformDirectoryError("name must be 120 characters or fewer.");
  const role = typeof input.role === "string" ? input.role.trim() : "customer";
  const allowedCreateRoles = new Set(["admin", "manager", "company_admin", "employee", "staff", "customer"]);
  if (!allowedCreateRoles.has(role)) {
    throw platformDirectoryError("role must be one of: admin, manager, company_admin, employee, staff, customer.");
  }
  const password = typeof input.password === "string" && input.password.length ? input.password : "";
  if (!password) throw platformDirectoryError("password is required.");
  const existing = users.find((u) => String(u.email || "").trim().toLowerCase() === email);
  if (existing) throw platformDirectoryError("A user with this email already exists.", 409);
  return { email, name, role, password };
}

export const platformUserRepository = {
  async listUsers() {
    if (isSupabaseConfigured()) {
      if (!canPersistToSupabase) {
        throw platformDirectoryError("Platform users are unavailable until PostgreSQL validation succeeds.", 503);
      }
      return listPlatformUsersFromSupabase();
    }
    return users.map(clone);
  },

  async createUser(input) {
    const safe = assertPlatformUserCreateSafe(input);
    const passwordHash = await hashPassword(safe.password);
    const now = new Date().toISOString();
    const id = `user-${crypto.randomUUID()}`;
    const user = normalizeUser({
      id,
      name: safe.name,
      email: safe.email,
      phone: typeof input.phone === "string" ? input.phone.trim() : "",
      department: typeof input.department === "string" ? input.department.trim() : "",
      password: passwordHash,
      role: safe.role,
      permissions: [],
      isActive: input.isActive !== false,
      createdAt: now,
      updatedAt: now,
    });
    tagRecord(user, DEFAULT_COMPANY_ID);
    users.push(user);
    try {
      if (isSupabaseConfigured()) {
        await savePlatformUserToSupabase(user);
      } else {
        persistLocalMembershipDirectory();
      }
    } catch (error) {
      users.pop();
      throw error;
    }
    return clone(user);
  },

  async updateUser(id, changes) {
    const platformUsers = await this.listUsers();
    const matches = platformUsers.filter((user) => user.id === id);
    if (matches.length > 1) throw platformDirectoryError("User ID is ambiguous.", 409);
    const current = matches[0];
    if (!current) throw platformDirectoryError("User not found.", 404);

    if (current.role === "super_admin") {
      if (changes.role !== undefined && changes.role !== "super_admin") {
        throw platformDirectoryError("Super Admin role cannot be demoted.", 403);
      }
      if (changes.isActive === false) {
        throw platformDirectoryError("Super Admin cannot be disabled.", 403);
      }
    }

    if (changes.email !== undefined) {
      const email = String(changes.email || "").trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw platformDirectoryError("email must be a valid email address.");
      }
      const duplicate = users.find((u) => u.id !== id && String(u.email || "").trim().toLowerCase() === email);
      if (duplicate) throw platformDirectoryError("A user with this email already exists.", 409);
      changes.email = email;
    }

    if (changes.isActive === false) {
      await assertPlatformUserStatusChangeSafe(current, false);
    }

    const next = normalizeUser({
      ...current,
      ...changes,
      updatedAt: new Date().toISOString(),
    });

    if (isSupabaseConfigured()) {
      await savePlatformUserToSupabase(next);
      const local = users.find((user) => user.id === id);
      if (local) Object.assign(local, next);
      return clone(next);
    }

    const index = users.findIndex((user) => user.id === id);
    const previousCompanyId = getRecordCompanyId(users[index]);
    const previous = clone(users[index]);
    users[index] = tagRecord(next, previousCompanyId);
    try {
      persistLocalMembershipDirectory();
      return clone(users[index]);
    } catch (error) {
      users[index] = tagRecord(previous, previousCompanyId);
      throw error;
    }
  },

  async updateUserStatus(id, isActive) {
    return this.updateUser(id, { isActive });
  },
};

export function currentStoreSnapshot(companyId = DEFAULT_COMPANY_ID) {
  const normalized = normalizeCompanyId(companyId);
  const store = {
    version: 1,
    savedAt: new Date().toISOString(),
    users: userRepository.getByCompany(normalized),
    orders: orderRepository.getByCompany(normalized),
    products: productRepository.getByCompany(normalized),
    offers: offerRepository.getByCompany(normalized),
    categoryCards: categoryCardRepository.getByCompany(normalized),
    reviews: reviewRepository.getByCompany(normalized),
    websiteMedia: websiteMediaRepository.getByCompany(normalized),
    workSessions: workSessionRepository.getByCompany(normalized),
    customAdminModules: customAdminModuleRepository.getByCompany(normalized),
    customAdminModuleEntries: customAdminModuleEntryRepository.getByCompany(normalized),
    invoices: invoiceRepository.getByCompany(normalized),
    deliveryZones: deliveryZoneRepository.getByCompany(normalized),
    activityLogs: activityLogRepository.getByCompany(normalized),
    carts: Object.fromEntries(
      cartRepository.getByCompany(normalized).map(({ userId, items }) => [userId, items]),
    ),
  };
  return store;
}

function persistLocalStore(store) {
  fs.mkdirSync(dataDir, { recursive: true });
  const tempFile = `${dataFile}.tmp`;
  fs.writeFileSync(tempFile, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  fs.renameSync(tempFile, dataFile);
  return store;
}

function serializeTenantRecords(records, companyId) {
  return records.map((record) => ({ ...record, company_id: normalizeCompanyId(companyId) }));
}

function serializeAllTenantRecords(records) {
  return records.map((record) => ({
    ...record,
    company_id: getRecordCompanyId(record),
  }));
}

function persistLocalMembershipDirectory() {
  const existing = readPersistedStore() || {};
  return persistLocalStore({
    ...existing,
    version: Math.max(2, Number(existing.version || 1)),
    savedAt: new Date().toISOString(),
    users: serializeAllTenantRecords(users),
    memberships: companyMemberships.map((membership) => ({
      ...membership,
      company_id: membership.companyId,
      user_id: membership.userId,
    })),
  });
}

function mergeLocalTenantRecords(existing, records, companyId) {
  const normalized = normalizeCompanyId(companyId);
  const otherCompanies = (Array.isArray(existing) ? existing : []).filter(
    (record) => inputCompanyId(record) !== normalized,
  );
  return [...serializeTenantRecords(records, normalized), ...otherCompanies];
}

function persistLocalCompanyStore(companyId, store) {
  const normalized = normalizeCompanyId(companyId);
  const existing = readPersistedStore() || {};
  const merged = {
    ...existing,
    version: Math.max(2, Number(existing.version || store.version || 1)),
    savedAt: store.savedAt,
  };

  for (const key of [
    "users",
    "orders",
    "products",
    "offers",
    "categoryCards",
    "reviews",
    "websiteMedia",
    "workSessions",
    "customAdminModules",
    "customAdminModuleEntries",
    "invoices",
    "deliveryZones",
    "activityLogs",
  ]) {
    merged[key] = mergeLocalTenantRecords(existing[key], store[key], normalized);
  }

  merged.companyCarts = {
    ...(existing.companyCarts || {}),
    [normalized]: store.carts,
  };
  if (normalized === DEFAULT_COMPANY_ID) {
    merged.carts = store.carts;
  }
  merged.companies = companies.map(serializeCompany);

  return persistLocalStore(merged);
}

async function persistCompanyDirectory(company) {
  if (isSupabaseConfigured()) {
    if (!canPersistToSupabase) {
      throw new Error("Supabase persistence is configured but unavailable. Refusing local fallback for company data.");
    }

    const result = await saveCompanyToSupabase(company);
    company._domainId = result.domainId;
    return serializeCompany(company);
  }

  const existing = readPersistedStore() || {};
  return persistLocalStore({
    ...existing,
    version: Math.max(2, Number(existing.version || 1)),
    savedAt: new Date().toISOString(),
    companies: companies.map(serializeCompany),
  });
}

async function persistSuperAdminUser(user, previousUser = null) {
  if (isSupabaseConfigured()) {
    await saveSuperAdminUserToSupabase(user, DEFAULT_COMPANY_ID, { previousUser });
    return user;
  }

  const existing = readPersistedStore() || {};
  return persistLocalStore({
    ...existing,
    version: Math.max(2, Number(existing.version || 1)),
    savedAt: new Date().toISOString(),
    users: mergeLocalTenantRecords(
      existing.users,
      userRepository.getByCompany(DEFAULT_COMPANY_ID),
      DEFAULT_COMPANY_ID,
    ),
  });
}

export async function persistCompanyStore(companyId, options = {}) {
  const normalized = normalizeCompanyId(companyId);
  const store = currentStoreSnapshot(normalized);

  if (isSupabaseConfigured()) {
    if (!canPersistToSupabase) {
      throw new Error("Supabase persistence is configured but unavailable. Refusing local fallback for persistent data.");
    }

    await saveStoreToSupabase(store, {
      companyId: normalized,
      pruneMissing: options.pruneMissing === true,
    });
    return store;
  }

  return persistLocalCompanyStore(normalized, store);
}

export async function persistStore(options = {}) {
  return persistCompanyStore(DEFAULT_COMPANY_ID, options);
}

if (!isSupabaseConfigured() && !fs.existsSync(dataFile)) {
  await persistStore();
}
