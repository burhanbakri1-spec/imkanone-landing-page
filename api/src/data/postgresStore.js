import {
  DEFAULT_COMPANY_ID,
  companyStoragePath,
  isSafeCompanySlug,
  normalizeCompanyId,
  selectPreferredCompanyDomains,
} from "../tenancy/company.js";
import { Pool } from "pg";
import crypto from "node:crypto";
import { isVariantVisible, withVariantVisibility } from "../products/variantVisibility.js";

let pool;
let siteEditorPool;
const tableColumnCache = new Map();
let companyPersistenceDependenciesForTest = null;

export function setCompanyPersistenceDependenciesForTest(dependencies = null) {
  if (dependencies && process.env.NODE_ENV !== "test") {
    throw new Error("Company persistence dependencies can only be overridden in tests.");
  }
  companyPersistenceDependenciesForTest = dependencies;
}

function databaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
}

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: databaseUrl(),
      ssl: process.env.POSTGRES_SSL === "true"
        ? { rejectUnauthorized: false }
        : undefined,
    });
  }
  return pool;
}

async function query(sql, params = []) {
  if (!isSupabaseConfigured()) {
    throw new Error("PostgreSQL DATABASE_URL is not configured.");
  }
  return getPool().query(sql, params);
}

export function isSupabaseConfigured() {
  return Boolean(databaseUrl());
}

function siteEditorDatabaseUrl() {
  return process.env.SITE_EDITOR_DATABASE_URL || databaseUrl();
}

function getSiteEditorPool() {
  if (!siteEditorPool) {
    const url = siteEditorDatabaseUrl();
    if (!url) {
      throw new Error("Site editor PostgreSQL database URL is not configured.");
    }
    siteEditorPool = new Pool({
      connectionString: url,
      ssl: process.env.POSTGRES_SSL === "true"
        ? { rejectUnauthorized: false }
        : undefined,
    });
  }
  return siteEditorPool;
}

async function siteEditorQuery(sql, params = []) {
  return getSiteEditorPool().query(sql, params);
}

export function isSupabaseStorageConfigured() {
  return false;
}

function encodeStoragePath(storagePath) {
  return storagePath.split("/").map(encodeURIComponent).join("/");
}

const IDENTIFIER_PATTERN = /^[a-z_][a-z0-9_]*$/i;

function quoteIdent(identifier) {
  if (!IDENTIFIER_PATTERN.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }
  return `"${identifier.replace(/"/g, '""')}"`;
}

function tableName(table) {
  return `public.${quoteIdent(table)}`;
}

function toPgValue(value) {
  if (value === undefined) return null;
  if (value && typeof value === "object") return JSON.stringify(value);
  return value;
}

const TIMESTAMP_COLUMNS = new Set([
  "login_time",
  "logout_time",
]);
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})?)?$/;

export function normalizePostgresTimestamp(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (typeof value !== "string") return null;

  const normalized = value.trim();
  if (!ISO_DATE_PATTERN.test(normalized) || Number.isNaN(Date.parse(normalized))) return null;
  const [year, month, day] = normalized.slice(0, 10).split("-").map(Number);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (
    calendarDate.getUTCFullYear() !== year
    || calendarDate.getUTCMonth() !== month - 1
    || calendarDate.getUTCDate() !== day
  ) {
    return null;
  }
  return normalized;
}

function toPgColumnValue(column, value) {
  return column.endsWith("_at") || TIMESTAMP_COLUMNS.has(column)
    ? normalizePostgresTimestamp(value)
    : toPgValue(value);
}

function filterValue(raw) {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null") return null;
  return raw;
}

function addFilterClause(column, expression, clauses, values) {
  if (expression.startsWith("eq.")) {
    values.push(filterValue(expression.slice(3)));
    clauses.push(`${quoteIdent(column)} = $${values.length}`);
    return;
  }

  if (expression === "is.null") {
    clauses.push(`${quoteIdent(column)} is null`);
    return;
  }

  throw new Error(`Unsupported PostgreSQL filter: ${column}=${expression}`);
}

function addOrFilter(expression, clauses, values) {
  const inner = expression.replace(/^\(|\)$/g, "");
  const parts = inner.split(",").map((part) => part.trim()).filter(Boolean);
  const orClauses = [];

  for (const part of parts) {
    const eqMatch = part.match(/^([a-z_][a-z0-9_]*)\.eq\.(.*)$/i);
    if (eqMatch) {
      values.push(filterValue(eqMatch[2]));
      orClauses.push(`${quoteIdent(eqMatch[1])} = $${values.length}`);
      continue;
    }

    const nullMatch = part.match(/^([a-z_][a-z0-9_]*)\.is\.null$/i);
    if (nullMatch) {
      orClauses.push(`${quoteIdent(nullMatch[1])} is null`);
      continue;
    }

    throw new Error(`Unsupported PostgreSQL OR filter: ${part}`);
  }

  if (orClauses.length) {
    clauses.push(`(${orClauses.join(" or ")})`);
  }
}

function whereFromParams(params) {
  const clauses = [];
  const values = [];

  for (const [key, value] of params.entries()) {
    if (key === "select" || key === "on_conflict") continue;

    if (key === "or") {
      addOrFilter(value, clauses, values);
      continue;
    }

    addFilterClause(key, value, clauses, values);
  }

  return {
    clause: clauses.length ? ` where ${clauses.join(" and ")}` : "",
    values,
  };
}

async function selectAll(table, restQuery = "select=*") {
  return selectAllWithQuery(query, table, restQuery);
}

async function selectAllWithQuery(queryRunner, table, restQuery = "select=*") {
  const params = new URLSearchParams(restQuery);
  const where = whereFromParams(params);
  const result = await queryRunner(
    `select * from ${tableName(table)}${where.clause}`,
    where.values,
  );
  return result.rows;
}

export function startupHydrationTimeoutMs(environment = process.env) {
  const parsed = Number(environment.POSTGRES_STARTUP_HYDRATION_TIMEOUT_MS);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 30000;
}

async function upsertRowsSql(table, rows, conflictColumn = "id", ignoreDuplicates = false) {
  if (!rows.length) return;

  const conflictColumns = Array.isArray(conflictColumn) ? conflictColumn : [conflictColumn];
  const validColumns = await tableColumns(table);
  const filteredRows = rows
    .map((row) =>
      Object.fromEntries(
        Object.entries(row).filter(([column]) => validColumns.has(column)),
      ),
    )
    .filter((row) => conflictColumns.every((column) => Object.hasOwn(row, column)));
  if (!filteredRows.length) return;

  const columns = [...new Set(filteredRows.flatMap((row) => Object.keys(row)))];
  const values = [];
  const tuples = filteredRows.map((row) => {
    const placeholders = columns.map((column) => {
      values.push(toPgColumnValue(column, row[column]));
      return `$${values.length}`;
    });
    return `(${placeholders.join(", ")})`;
  });

  const updateColumns = columns.filter((column) => !conflictColumns.includes(column));
  const conflictSql = ignoreDuplicates || !updateColumns.length
    ? "do nothing"
    : `do update set ${updateColumns
        .map((column) => `${quoteIdent(column)} = excluded.${quoteIdent(column)}`)
        .join(", ")}`;

  await query(
    `insert into ${tableName(table)} (${columns.map(quoteIdent).join(", ")})
     values ${tuples.join(", ")}
     on conflict (${conflictColumns.map(quoteIdent).join(", ")}) ${conflictSql}`,
    values,
  );
}

async function upsertRows(table, rows, conflictColumn = "id") {
  await upsertRowsSql(table, rows, conflictColumn, false);
}

async function insertRowsIfMissing(table, rows, conflictColumn = "id") {
  await upsertRowsSql(table, rows, conflictColumn, true);
}

async function tableColumns(table) {
  if (tableColumnCache.has(table)) return tableColumnCache.get(table);

  const result = await query(
    `select column_name
     from information_schema.columns
     where table_schema = 'public' and table_name = $1`,
    [table],
  );
  const columns = new Set(result.rows.map((row) => row.column_name));
  tableColumnCache.set(table, columns);
  return columns;
}

async function deleteRows(table, restQuery = "") {
  const params = new URLSearchParams(restQuery);
  const where = whereFromParams(params);
  await query(`delete from ${tableName(table)}${where.clause}`, where.values);
}

async function supabaseFetch(pathname, options = {}) {
  const method = String(options.method || "GET").toUpperCase();

  if (!pathname.startsWith("/rest/v1/")) {
    throw new Error(`Unsupported PostgreSQL adapter path: ${pathname}`);
  }

  const url = new URL(pathname, "http://postgres.local");
  const table = url.pathname.split("/").filter(Boolean).at(-1);

  if (method === "DELETE") {
    await deleteRows(table, url.searchParams.toString());
    return null;
  }

  if (method === "GET") {
    return selectAll(table, url.searchParams.toString());
  }

  throw new Error(`Unsupported PostgreSQL adapter method: ${method}`);
}

function companyQuery(companyId, select = "*") {
  const company = normalizeCompanyId(companyId);
  const normalized = encodeURIComponent(company);
  return company === DEFAULT_COMPANY_ID
    ? `select=${select}&or=(company_id.eq.${normalized},company_id.is.null)`
    : `select=${select}&company_id=eq.${normalized}`;
}

function companyMutationFilter(companyId) {
  const company = normalizeCompanyId(companyId);
  const normalized = encodeURIComponent(company);
  return company === DEFAULT_COMPANY_ID
    ? `or=(company_id.eq.${normalized},company_id.is.null)`
    : `company_id=eq.${normalized}`;
}

async function selectCompanyRows(table, companyId, select = "*") {
  return selectAll(table, companyQuery(companyId, select));
}

async function deleteCompanyRow(table, id, companyId) {
  await supabaseFetch(
    `/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&${companyMutationFilter(companyId)}`,
    {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
    },
  );
}

async function deleteMissingCompanyRows(table, currentIds, companyId) {
  const existing = await selectCompanyRows(table, companyId, "id,company_id");
  const keep = new Set(currentIds);
  const staleIds = existing.map((row) => row.id).filter((id) => !keep.has(id));
  for (const id of staleIds) {
    await deleteCompanyRow(table, id, companyId);
  }
}

async function assertNoCrossCompanyConflicts(table, rows, companyId) {
  if (!rows.length) return;
  const normalized = normalizeCompanyId(companyId);
  const incomingIds = new Set(rows.map((row) => row.id));
  const existing = await selectAll(table, "select=id,company_id");
  const conflict = existing.find(
    (row) => incomingIds.has(row.id) && normalizeCompanyId(row.company_id) !== normalized,
  );
  if (conflict) {
    throw new Error(
      `Tenant isolation prevented ${table} row ${conflict.id} from being overwritten by ${normalized}.`,
    );
  }
}

async function upsertCompanyRows(table, rows, companyId) {
  await assertNoCrossCompanyConflicts(table, rows, companyId);
  await upsertRows(table, rows);
}

function rowDate(value) {
  return normalizePostgresTimestamp(value) || new Date().toISOString();
}

function categoryRow(category, companyId) {
  return {
    id: category.id,
    company_id: normalizeCompanyId(companyId),
    slug: category.slug,
    name: category.name || {},
    description: category.description || null,
    parent_id: category.parentId || null,
    brand_id: category.brandId || null,
    image_url: category.imageUrl || null,
    hero_video: category.heroVideo || null,
    sort_order: Number(category.sortOrder || 0),
    is_active: category.isActive !== false,
    created_at: rowDate(category.createdAt),
    updated_at: rowDate(category.updatedAt),
  };
}

function brandRow(brand, companyId) {
  return {
    id: brand.id,
    company_id: normalizeCompanyId(companyId),
    slug: brand.slug,
    name: brand.name,
    logo_url: brand.logoUrl || null,
    hero_video: brand.heroVideo || null,
    hero_poster: brand.heroPoster || null,
    country: brand.country || null,
    sort_order: Number(brand.sortOrder || 0),
    is_active: brand.isActive !== false,
    created_at: rowDate(brand.createdAt),
    updated_at: rowDate(brand.updatedAt),
  };
}

function uniqueRowId(baseId, usedIds) {
  let candidate = baseId;
  let suffix = 1;

  while (usedIds.has(candidate)) {
    candidate = `${baseId}-${suffix}`;
    suffix += 1;
  }

  usedIds.add(candidate);
  return candidate;
}

function ensureUniqueRowIds(rows, fallbackIdForRow) {
  const usedIds = new Set();

  return rows.map((row, index) => {
    const preferredId = row.id ? String(row.id) : "";
    const fallbackId = fallbackIdForRow(row, index);
    const needsFallback = !preferredId || usedIds.has(preferredId);
    const id = uniqueRowId(needsFallback ? fallbackId : preferredId, usedIds);

    return {
      ...row,
      id,
      data: row.data
        ? {
            ...row.data,
            id,
          }
        : row.data,
    };
  });
}

function productRow(product, companyId) {
  const firstVariant = Array.isArray(product.variants)
    ? product.variants.find(isVariantVisible) || null
    : null;
  return {
    id: product.id,
    company_id: normalizeCompanyId(companyId),
    slug: product.slug || product.id,
    name: typeof product.name === "object" ? product.name?.en || product.id : product.name || product.id,
    name_ar: typeof product.name === "object" ? product.name?.ar || "" : product.nameAr || product.name_ar || "",
    category: typeof product.category === "object" ? product.category?.en || "" : product.category || "",
    category_ar: typeof product.category === "object" ? product.category?.ar || "" : product.categoryAr || product.category_ar || "",
    brand: product.brand || "",
    category_id: product.categoryId ?? null,
    brand_id: product.brandId ?? null,
    image_url: product.image || "",
    hover_image_url: product.hoverImage || product.secondaryImage || "",
    usage_video: product.usageVideo || null,
    usage_video_poster: product.usageVideoPoster || null,
    price: Number(firstVariant?.price || product.price || product.sizes?.[0]?.price || 0),
    stock_qty: Number(firstVariant?.stock ?? product.stockQty ?? 0),
    is_active: product.isActive !== false,
    is_featured: Boolean(product.isFeatured || product.featured),
    data: product,
    created_at: rowDate(product.createdAt),
    updated_at: rowDate(product.updatedAt),
  };
}

function variantRows(product, companyId) {
  const rows = (product.variants || []).map((variant, index) => {
    const normalizedVariant = withVariantVisibility(variant);
    return {
      id: variant.id || `${product.id}-variant-${index}`,
      company_id: normalizeCompanyId(companyId),
      product_id: product.id,
      color_name: variant.color_name || variant.colorName || "Default",
      color_value: variant.color_value || variant.colorValue || variant.colorHex || "",
      size: variant.size || "500ml",
      price: Number(variant.price || 0),
      stock: Number(variant.stock ?? 0),
      image_url: variant.image_url || variant.imageUrl || variant.image || "",
      sort_order: Number(variant.sort_order ?? variant.sortOrder ?? index),
      data: normalizedVariant,
      created_at: rowDate(variant.createdAt),
      updated_at: rowDate(variant.updatedAt),
    };
  });

  return ensureUniqueRowIds(rows, (row, index) => `${row.product_id}-variant-${index}`);
}

function galleryRows(product, companyId) {
  const source = product.gallery_images || product.galleryImages || [];
  const rows = source
    .map((entry, index) => {
      const imageUrl = typeof entry === "string" ? entry : entry?.image_url || entry?.image || entry?.url;
      if (!imageUrl) return null;
      return {
        id: typeof entry === "object" && entry?.id ? entry.id : `${product.id}-gallery-${index}`,
        company_id: normalizeCompanyId(companyId),
        product_id: product.id,
        image_url: imageUrl,
        sort_order: Number(typeof entry === "object" ? entry?.sort_order ?? entry?.sortOrder ?? index : index),
        data: typeof entry === "object" ? entry : { image_url: imageUrl },
        created_at: rowDate(typeof entry === "object" ? entry.createdAt : null),
        updated_at: rowDate(typeof entry === "object" ? entry.updatedAt : null),
      };
    })
    .filter(Boolean);

  return ensureUniqueRowIds(rows, (row, index) => `${row.product_id}-gallery-${index}`);
}

function userRow(user) {
  const globalRole = user.globalRole || user.role || "customer";
  const globalPermissions = user.globalPermissions || user.permissions || [];
  const {
    companyId: _companyId,
    company_id: _companyIdSnake,
    globalRole: _globalRole,
    globalPermissions: _globalPermissions,
    membershipId: _membershipId,
    membershipRole: _membershipRole,
    ...globalUser
  } = user;
  return {
    id: user.id,
    name: user.name || "",
    email: user.email || "",
    phone: user.phone || "",
    password: user.password || "",
    role: globalRole,
    department: user.department || "",
    permissions: globalPermissions,
    account_type: user.accountType || "retail",
    eb_points: Number(user.ebPoints || 0),
    total_points_earned: Number(user.totalPointsEarned || 0),
    total_points_redeemed: Number(user.totalPointsRedeemed || 0),
    is_active: user.isActive !== false,
    data: { ...globalUser, role: globalRole, permissions: globalPermissions },
    created_at: rowDate(user.createdAt),
    updated_at: rowDate(user.updatedAt),
  };
}

function membershipRow(user, companyId) {
  const normalized = normalizeCompanyId(companyId);
  const role =
    user.role === "super_admin"
      ? "super_admin"
      : user.role === "admin"
      ? "company_admin"
      : ["employee", "staff", "manager"].includes(user.role)
        ? "employee"
        : "customer";
  return {
    id: `${normalized}:${user.id}`,
    company_id: normalized,
    user_id: user.id,
    role,
    permissions: user.permissions || [],
    is_active: user.isActive !== false,
    updated_at: rowDate(user.updatedAt),
  };
}

function explicitMembershipRow(membership) {
  return {
    id: membership.id,
    company_id: normalizeCompanyId(membership.companyId),
    user_id: membership.userId,
    role: membership.role,
    permissions: membership._permissions || [],
    is_active: membership.status === "active",
    created_at: rowDate(membership.createdAt),
    updated_at: rowDate(membership.updatedAt),
  };
}

function orderRow(order, companyId) {
  return {
    id: order.id,
    company_id: normalizeCompanyId(companyId),
    customer_user_id: order.customerUserId || null,
    customer: order.customer || {},
    subtotal: Number(order.subtotal || 0),
    total: Number(order.total || 0),
    points_earned: Number(order.pointsEarned || 0),
    points_redeemed: Number(order.pointsRedeemed || 0),
    discount_from_points: Number(order.discountFromPoints || 0),
    payment_method: order.paymentMethod || "",
    status: order.status || "Pending",
    handled_by_employee_id: order.handledByEmployeeId || "",
    assigned_to_employee_id: order.assignedToEmployeeId || "",
    created_by_employee_id: order.createdByEmployeeId || "",
    created_by_employee_name: order.createdByEmployeeName || "",
    data: order,
    created_at: rowDate(order.createdAt),
    updated_at: rowDate(order.updatedAt),
  };
}

function orderItemRows(order, companyId) {
  return (order.items || []).map((item, index) => ({
    id: item.id || `${order.id}-item-${index}`,
    company_id: normalizeCompanyId(companyId),
    order_id: order.id,
    product_id: item.productId || item.id || "",
    product_name: item.productName || item.name || "",
    variant_id: item.variantId || "",
    color_name: item.colorName || item.selectedColor || "",
    color_value: item.colorValue || "",
    size: item.selectedSize || item.size || "",
    quantity: Number(item.quantity || 1),
    price: Number(item.price || 0),
    line_total: Number(item.lineTotal || Number(item.price || 0) * Number(item.quantity || 1)),
    data: item,
    created_at: rowDate(item.createdAt),
    updated_at: rowDate(item.updatedAt),
  }));
}

function websiteMediaRow(item, index = 0, companyId = DEFAULT_COMPANY_ID) {
  const imageUrl = item.imageUrl ?? item.image_url ?? "";
  const { fallbackImageUrl, fallback_image_url, ...data } = item;
  return {
    id: item.id || `website-media-${index}`,
    company_id: normalizeCompanyId(companyId),
    section_key: item.sectionKey || item.section_key || "",
    section_label: item.sectionLabel || item.section_label || "",
    group_key: item.groupKey || item.group_key || "sections",
    image_url: imageUrl,
    title: item.title || "",
    subtitle: item.subtitle || "",
    link_url: item.linkUrl || item.link_url || "",
    sort_order: Number(item.sortOrder ?? item.sort_order ?? index),
    is_active: item.isActive !== false,
    data: {
      ...data,
      imageUrl,
    },
    created_at: rowDate(item.createdAt),
    updated_at: rowDate(item.updatedAt),
  };
}


function legacySupabaseStorageBucket() {
  return process.env.LEGACY_SUPABASE_BUCKET || process.env.SUPABASE_BUCKET || "eb-chemical-uploads";
}

function publicApiBaseUrl() {
  return process.env.PUBLIC_API_URL?.trim().replace(/\/+$/, "") || "";
}

function rewriteStorageUrls(value) {
  if (typeof value === "string") {
    const match = value.match(/^https?:\/\/[^/]+\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
    if (!match) return value;

    const [, bucket, objectPath] = match;
    if (bucket !== legacySupabaseStorageBucket()) return value;

    const localPath = `/uploads/${objectPath}`;
    const baseUrl = publicApiBaseUrl();
    return baseUrl ? `${baseUrl}${localPath}` : localPath;
  }

  if (Array.isArray(value)) {
    return value.map(rewriteStorageUrls);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, rewriteStorageUrls(entry)]),
    );
  }

  return value;
}

function mergeWebsiteMedia(row) {
  return {
    ...(row.data || {}),
    id: row.id,
    sectionKey: row.section_key,
    sectionLabel: row.section_label,
    groupKey: row.group_key,
    imageUrl: row.image_url,
    title: row.title || "",
    subtitle: row.subtitle || "",
    linkUrl: row.link_url || "",
    sortOrder: Number(row.sort_order || 0),
    isActive: row.is_active !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function websiteTextRow(item, index = 0, companyId = DEFAULT_COMPANY_ID) {
  return {
    id: item.id || `website-text-${index}`,
    company_id: normalizeCompanyId(companyId),
    text_key: item.key || "",
    group_key: item.group || "general",
    label: item.label || "",
    value_json: { ar: item.valueAr || "", en: item.valueEn || "", he: item.valueHe || "" },
    sort_order: Number(item.sortOrder ?? index),
    is_active: item.isActive !== false,
    created_at: rowDate(item.createdAt),
    updated_at: rowDate(item.updatedAt),
    deleted_at: item.deletedAt || null,
  };
}

function mergeWebsiteText(row) {
  let values = { ar: "", en: "", he: "" };
  try { values = typeof row.value_json === 'string' ? JSON.parse(row.value_json) : (row.value_json || values); } catch {}
  return {
    id: row.id,
    key: row.text_key,
    group: row.group_key,
    label: row.label || "",
    valueAr: values.ar || "",
    valueEn: values.en || "",
    valueHe: values.he || "",
    sortOrder: Number(row.sort_order || 0),
    isActive: row.is_active !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mergeUser(row) {
  return {
    ...(row.data || {}),
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    password: row.password,
    role: row.role,
    department: row.department,
    permissions: row.permissions || [],
    accountType: row.account_type || "retail",
    ebPoints: Number(row.eb_points || 0),
    totalPointsEarned: Number(row.total_points_earned || 0),
    totalPointsRedeemed: Number(row.total_points_redeemed || 0),
    isActive: row.is_active !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mergeProduct(row, variants, galleryImages) {
  const productVariants = variants
    .filter((variant) => variant.product_id === row.id)
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
    .map((variant) => ({
      ...(variant.data || {}),
      id: variant.id,
      color_name: variant.color_name,
      color_value: variant.color_value,
      size: variant.size,
      price: Number(variant.price || 0),
      stock: Number(variant.stock || 0),
      image_url: variant.image_url || "",
      sort_order: Number(variant.sort_order || 0),
      isVisible: isVariantVisible(variant.data || {}),
    }));
  const productGallery = galleryImages
    .filter((entry) => entry.product_id === row.id)
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
    .map((entry) => ({
      ...(entry.data || {}),
      id: entry.id,
      image_url: entry.image_url,
      sort_order: Number(entry.sort_order || 0),
    }));

  return {
    ...(row.data || {}),
    id: row.id,
    slug: row.slug,
    categoryId: row.category_id || null,
    brandId: row.brand_id || null,
    image: row.image_url || row.data?.image || "",
    hoverImage: row.hover_image_url || row.data?.hoverImage || "",
    usageVideo: row.usage_video || row.data?.usageVideo || "",
    usageVideoPoster: row.usage_video_poster || row.data?.usageVideoPoster || "",
    variants: productVariants,
    gallery_images: productGallery,
    galleryImages: productGallery.map((entry) => entry.image_url),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mergeOrder(row, orderItems) {
  const items = orderItems
    .filter((item) => item.order_id === row.id)
    .map((item) => ({
      ...(item.data || {}),
      id: item.id,
      productId: item.product_id,
      variantId: item.variant_id,
      colorName: item.color_name,
      colorValue: item.color_value,
      selectedSize: item.size,
      quantity: Number(item.quantity || 1),
      price: Number(item.price || 0),
      lineTotal: Number(item.line_total || 0),
    }));

  return {
    ...(row.data || {}),
    id: row.id,
    customerUserId: row.customer_user_id,
    customer: row.customer || {},
    items,
    subtotal: Number(row.subtotal || 0),
    total: Number(row.total || 0),
    pointsEarned: Number(row.points_earned || 0),
    pointsRedeemed: Number(row.points_redeemed || 0),
    discountFromPoints: Number(row.discount_from_points || 0),
    paymentMethod: row.payment_method,
    status: row.status,
    handledByEmployeeId: row.handled_by_employee_id,
    assignedToEmployeeId: row.assigned_to_employee_id,
    createdByEmployeeId: row.created_by_employee_id,
    createdByEmployeeName: row.created_by_employee_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findUsersByEmailFromSupabase(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  // Bootstrap runs rarely and must match login's case-insensitive semantics.
  // Reading then filtering avoids ilike wildcard behavior for valid-but-special
  // email characters until normalized_email is available as a database column.
  const rows = await selectAll("users", "select=*");
  return rows
    .filter((row) => String(row.email || "").trim().toLowerCase() === normalizedEmail)
    .map(mergeUser);
}

function mergeCustomAdminModule(row) {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    description: row.description || "",
    icon: row.icon || "folder",
    sidebarOrder: Number(row.sidebar_order || 0),
    enabled: row.enabled !== false,
    fieldsSchema: row.fields_schema || [],
    listConfig: row.list_config || {},
    formConfig: row.form_config || {},
    permissions: row.permissions || {},
    createdBy: row.created_by || "",
    updatedBy: row.updated_by || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at || null,
  };
}

function websiteMediaHiddenKeyRow(item, index = 0, companyId = DEFAULT_COMPANY_ID) {
  return {
    id: item.id || `hidden-media-${index}`,
    company_id: normalizeCompanyId(companyId),
    section_key: item.sectionKey || "",
    created_at: rowDate(item.createdAt),
    updated_at: rowDate(item.updatedAt),
  };
}

function mergeWebsiteMediaHiddenKey(row) {
  return {
    id: row.id,
    sectionKey: row.section_key,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mergeCustomAdminModuleEntry(row) {
  return {
    id: row.id,
    moduleId: row.module_id,
    data: row.data || {},
    status: row.status || "active",
    createdBy: row.created_by || "",
    updatedBy: row.updated_by || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mergeCompanyProductSchema(row) {
  return {
    id: row.id,
    schema: row.schema_json || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listPlatformUsersFromSupabase() {
  const rows = await selectAll("users", "select=*");
  return rows.map(mergeUser);
}

export async function findPlatformUserByIdFromSupabase(userId) {
  const rows = await selectAll(
    "users",
    `select=*&id=eq.${encodeURIComponent(String(userId || ""))}`,
  );
  return rows.length === 1 ? mergeUser(rows[0]) : null;
}

export async function savePlatformUserToSupabase(user) {
  await upsertRows("users", [userRow(user)]);
  return user;
}

export async function listCompanyMembershipsFromSupabase(companyId) {
  const normalizedCompanyId = normalizeCompanyId(companyId);
  const [memberships, allUsers] = await Promise.all([
    selectAll(
      "company_memberships",
      `select=*&company_id=eq.${encodeURIComponent(normalizedCompanyId)}`,
    ),
    selectAll("users", "select=*"),
  ]);
  const usersById = new Map(allUsers.map((row) => [row.id, mergeUser(row)]));
  return memberships.map((membership) => ({
    id: membership.id,
    companyId: membership.company_id,
    userId: membership.user_id,
    role: membership.role,
    status: membership.is_active === false ? "inactive" : "active",
    _permissions: membership.permissions || [],
    createdAt: membership.created_at,
    updatedAt: membership.updated_at,
    user: usersById.get(membership.user_id) || null,
  }));
}

export async function saveCompanyMembershipToSupabase({ membership, user, createUser = false }) {
  let userCreated = false;
  try {
    if (createUser) {
      await upsertRows("users", [userRow(user)]);
      userCreated = true;
    }
    await upsertRows("company_memberships", [explicitMembershipRow(membership)]);
    return membership;
  } catch (error) {
    if (userCreated) {
      try {
        await supabaseFetch(
          `/rest/v1/users?id=eq.${encodeURIComponent(user.id)}`
            + `&email=eq.${encodeURIComponent(user.email)}`
            + "&role=eq.customer&is_active=eq.false&password=eq.",
          { method: "DELETE", headers: { Prefer: "return=minimal" } },
        );
      } catch (compensationError) {
        error.compensationFailed = true;
      }
    }
    throw error;
  }
}

function mergeCompany(row, domains, settingsRows) {
  const companyDomains = domains.filter((entry) => entry.company_id === row.id);
  const activeDomains = companyDomains.filter((entry) => entry.is_active !== false);
  const preferredDomains = selectPreferredCompanyDomains(
    activeDomains.length ? activeDomains : companyDomains,
  );
  const domain = preferredDomains[0];
  const settings = settingsRows.find((entry) => entry.company_id === row.id);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    isDefault: row.is_default === true,
    domain: domain?.domain || "",
    domains: preferredDomains.map((entry) => entry.domain),
    settings: settings?.settings || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    _domainId: domain?.id || "",
  };
}

function mergeDeliveryZone(row) {
  return {
    id: row.id,
    company_id: row.company_id,
    city_key: row.city_key,
    city_name: row.city_name,
    region: row.region || "",
    delivery_price: Number(row.delivery_price || 0),
    currency: row.currency || "ILS",
    enabled: row.enabled !== false,
    display_order: Number(row.display_order || 0),
    created_by: row.created_by || "",
    updated_by: row.updated_by || "",
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}

function mergeActivityLog(row) {
  return {
    id: row.id,
    company_id: row.company_id,
    actor_user_id: row.actor_user_id,
    actor_email: row.actor_email || "",
    actor_name: row.actor_name || "",
    actor_role: row.actor_role || "",
    action: row.action,
    entity_type: row.entity_type || "",
    entity_id: row.entity_id || "",
    entity_label: row.entity_label || "",
    summary: row.summary || "",
    before_data: row.before_data || null,
    after_data: row.after_data || null,
    metadata: row.metadata || null,
    ip_address: row.ip_address || null,
    user_agent: row.user_agent || null,
    created_at: row.created_at,
  };
}

function mergeCompanyInvoice(row) {
  return {
    id: row.id,
    company_id: row.company_id,
    invoice_number: row.invoice_number,
    customer_name: row.customer_name,
    customer_email: row.customer_email,
    customer_phone: row.customer_phone,
    order_id: row.order_id,
    status: row.status,
    currency: row.currency,
    issue_date: row.issue_date,
    due_date: row.due_date,
    notes: row.notes,
    line_items: row.line_items || [],
    subtotal: Number(row.subtotal || 0),
    discount_total: Number(row.discount_total || 0),
    tax_total: Number(row.tax_total || 0),
    total: Number(row.total || 0),
    created_by: row.created_by,
    updated_by: row.updated_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}

const LOADED_TENANT_COLLECTIONS = [
  "memberships",
  "products",
  "orders",
  "offers",
  "categoryCards",
  "categories",
  "brands",
  "reviews",
  "workSessions",
  "websiteMedia",
  "websiteMediaHiddenKeys",
  "websiteTexts",
  "customAdminModules",
  "customAdminModuleEntries",
  "companyProductSchemas",
  "invoices",
  "deliveryZones",
  "activityLogs",
  "inboxConversations",
  "inboxMessages",
  "inboxConversationReads",
];

function tagLoadedRecord(record, companyId) {
  if (!record || typeof record !== "object") return record;
  const {
    company_id: _companyId,
    companyId: _camelCompanyId,
    ...data
  } = record;
  return {
    ...data,
    company_id: normalizeCompanyId(companyId || _companyId || _camelCompanyId),
  };
}

export async function deleteCompanyMembershipWithClient(client, companyId, userId, membershipId = null) {
  const normalizedCompanyId = normalizeCompanyId(companyId);
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) throw new Error("A user ID is required to delete a company membership.");
  const normalizedMembershipId = String(membershipId || "").trim();
  const result = await client.query(
    `delete from public.company_memberships
     where company_id = $1 and user_id = $2${normalizedMembershipId ? " and id = $3" : ""}
     returning id`,
    normalizedMembershipId
      ? [normalizedCompanyId, normalizedUserId, normalizedMembershipId]
      : [normalizedCompanyId, normalizedUserId],
  );
  return result.rows || [];
}

export async function deleteCompanyMembershipFromSupabase(companyId, userId, membershipId = null) {
  if (!isSupabaseConfigured()) {
    throw new Error("PostgreSQL DATABASE_URL is not configured.");
  }
  return deleteCompanyMembershipWithClient(getPool(), companyId, userId, membershipId);
}

function tagLoadedTenantStore(store, companyId) {
  const normalizedCompanyId = normalizeCompanyId(companyId);
  const tagged = { ...store };

  for (const key of LOADED_TENANT_COLLECTIONS) {
    tagged[key] = (store[key] || []).map((record) => tagLoadedRecord(record, normalizedCompanyId));
  }

  tagged.products = tagged.products.map((product) => ({
    ...product,
    variants: (product.variants || []).map((variant) => tagLoadedRecord(variant, normalizedCompanyId)),
    gallery_images: (product.gallery_images || []).map((entry) => tagLoadedRecord(entry, normalizedCompanyId)),
    galleryImages: product.galleryImages || [],
  }));
  tagged.orders = tagged.orders.map((order) => ({
    ...order,
    items: (order.items || []).map((item) => tagLoadedRecord(item, normalizedCompanyId)),
  }));
  tagged.companyCarts = { [normalizedCompanyId]: store.carts || {} };
  return tagged;
}

function uniqueRecords(records, identity) {
  const byIdentity = new Map();
  records.forEach((record, index) => {
    const key = identity(record, index);
    if (!byIdentity.has(key)) byIdentity.set(key, record);
  });
  return [...byIdentity.values()];
}

export async function loadStoreFromSupabase(companyId = DEFAULT_COMPANY_ID, dependencies = {}) {
  const normalizedCompanyId = normalizeCompanyId(companyId);
  const selectAllRows = dependencies.selectAllRows || selectAll;
  const selectTenantRows = dependencies.selectTenantRows || selectCompanyRows;
  const [
    allUsers,
    memberships,
    products,
    variants,
    galleryImages,
    orders,
    orderItems,
    carts,
    offers,
    categoryCards,
    categories,
    brands,
    reviews,
    workSessions,
    websiteMedia,
    websiteMediaHiddenKeys,
    websiteTexts,
    customAdminModules,
    customAdminModuleEntries,
    companyProductSchemas,
    companyInvoices,
    deliveryZoneRows,
    activityLogRows,
    inboxConversationRows,
    inboxMessageRows,
    inboxReadRows,
    companies,
    companyDomains,
    companySettings,
  ] = await Promise.all([
    selectAllRows("users", "select=*"),
    selectAllRows(
      "company_memberships",
      `select=*&company_id=eq.${encodeURIComponent(normalizedCompanyId)}`,
    ),
    selectTenantRows("products", normalizedCompanyId),
    selectTenantRows("product_variants", normalizedCompanyId),
    selectTenantRows("product_gallery_images", normalizedCompanyId),
    selectTenantRows("orders", normalizedCompanyId),
    selectTenantRows("order_items", normalizedCompanyId),
    selectTenantRows("carts", normalizedCompanyId),
    selectTenantRows("homepage_offers", normalizedCompanyId),
    selectTenantRows("homepage_category_cards", normalizedCompanyId),
    selectTenantRows("company_categories", normalizedCompanyId),
    selectTenantRows("company_brands", normalizedCompanyId),
    selectTenantRows("reviews", normalizedCompanyId),
    selectTenantRows("work_sessions", normalizedCompanyId),
    selectTenantRows("website_media", normalizedCompanyId),
    selectTenantRows("company_website_media_hidden_keys", normalizedCompanyId),
    selectTenantRows("company_website_texts", normalizedCompanyId),
    selectTenantRows("custom_admin_modules", normalizedCompanyId),
    selectTenantRows("custom_admin_module_entries", normalizedCompanyId),
    selectTenantRows("company_product_schemas", normalizedCompanyId),
    selectTenantRows("company_invoices", normalizedCompanyId),
    selectTenantRows("company_delivery_zones", normalizedCompanyId),
    selectTenantRows("company_activity_logs", normalizedCompanyId),
    selectTenantRows("company_inbox_conversations", normalizedCompanyId),
    selectTenantRows("company_inbox_messages", normalizedCompanyId),
    selectTenantRows("company_inbox_reads", normalizedCompanyId),
    selectAllRows("companies", "select=*"),
    selectAllRows("company_domains", "select=*"),
    selectAllRows("company_settings", "select=*"),
  ]);

  const memberUserIds = new Set(memberships.map((membership) => membership.user_id));
  const users = memberships.length
    ? allUsers.filter((user) => memberUserIds.has(user.id))
    : normalizedCompanyId === DEFAULT_COMPANY_ID
      ? allUsers
      : [];

  const hasRows = [
    users,
    products,
    variants,
    galleryImages,
    orders,
    orderItems,
    carts,
    offers,
    categoryCards,
    categories,
    brands,
    reviews,
    workSessions,
    websiteMedia,
    websiteMediaHiddenKeys,
    websiteTexts,
    customAdminModules,
    customAdminModuleEntries,
    companyProductSchemas,
    companyInvoices,
    deliveryZoneRows,
    activityLogRows,
    inboxConversationRows,
    inboxMessageRows,
    inboxReadRows,
  ].some((rows) => rows.length);

  const store = tagLoadedTenantStore(rewriteStorageUrls({
    version: 1,
    savedAt: new Date().toISOString(),
    users: users.map(mergeUser),
    memberships: memberships.map((membership) => ({
      id: membership.id,
      companyId: membership.company_id,
      userId: membership.user_id,
      role: membership.role,
      status: membership.is_active === false ? "inactive" : "active",
      _permissions: Array.isArray(membership.permissions) ? membership.permissions : [],
      createdAt: membership.created_at,
      updatedAt: membership.updated_at,
    })),
    products: products.map((product) => mergeProduct(product, variants, galleryImages)),
    orders: orders.map((order) => mergeOrder(order, orderItems)),
    carts: Object.fromEntries(carts.map((cart) => [cart.user_id, cart.items || []])),
    offers: offers.map((offer) => offer.data || offer),
    categoryCards: categoryCards.map((card) => card.data || card),
    categories: categories.map(mergeCategory),
    brands: brands.map(mergeBrand),
    reviews: reviews.map((review) => review.data || review),
    websiteMedia: websiteMedia.map(mergeWebsiteMedia),
    websiteMediaHiddenKeys: websiteMediaHiddenKeys.map(mergeWebsiteMediaHiddenKey),
    websiteTexts: websiteTexts.map(mergeWebsiteText),
    workSessions: workSessions.map((session) => session.data || session),
    customAdminModules: customAdminModules.map(mergeCustomAdminModule),
    customAdminModuleEntries: customAdminModuleEntries.map(mergeCustomAdminModuleEntry),
    companyProductSchemas: companyProductSchemas.map(mergeCompanyProductSchema),
    invoices: companyInvoices.map(mergeCompanyInvoice),
    deliveryZones: deliveryZoneRows.map(mergeDeliveryZone),
    activityLogs: activityLogRows.map(mergeActivityLog),
    inboxConversations: inboxConversationRows.map((row) => ({
      id: row.id,
      contactId: row.contact_user_id,
      subject: row.subject || "",
      channel: row.channel,
      status: row.status,
      assignedEmployeeId: row.assigned_user_id || null,
      createdByUserId: row.created_by_user_id,
      lastMessageAt: row.last_message_at || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      closedAt: row.closed_at || null,
      archivedAt: row.archived_at || null,
    })),
    inboxMessages: inboxMessageRows.map((row) => ({
      id: row.id,
      conversationId: row.conversation_id,
      senderType: row.sender_type,
      senderUserId: row.sender_user_id || null,
      body: row.body,
      createdAt: row.created_at,
    })),
    inboxConversationReads: inboxReadRows.map((row) => ({
      id: `${row.conversation_id}:${row.user_id}`,
      conversationId: row.conversation_id,
      userId: row.user_id,
      lastReadAt: row.last_read_at,
    })),
    companies: companies.map((company) =>
      mergeCompany(company, companyDomains, companySettings),
    ),
  }), normalizedCompanyId);

  return {
    isEmpty: !hasRows,
    store,
  };
}

const PLATFORM_TENANT_TABLES = [
  "company_memberships",
  "products",
  "product_variants",
  "product_gallery_images",
  "orders",
  "order_items",
  "carts",
  "homepage_offers",
  "homepage_category_cards",
  "company_categories",
  "company_brands",
  "reviews",
  "work_sessions",
  "website_media",
  "company_website_media_hidden_keys",
  "company_website_texts",
  "custom_admin_modules",
  "custom_admin_module_entries",
  "company_product_schemas",
  "company_invoices",
  "company_delivery_zones",
  "company_activity_logs",
  "company_inbox_conversations",
  "company_inbox_messages",
  "company_inbox_reads",
];

let platformLoadDependenciesForTest = null;

export function setPlatformLoadDependenciesForTest(dependencies = null) {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Platform load dependency injection is test-only.");
  }
  platformLoadDependenciesForTest = dependencies;
}

function knownPlatformCompanies(companyRows) {
  const known = new Set([DEFAULT_COMPANY_ID]);
  for (const company of companyRows) {
    if (!isSafeCompanySlug(company?.id)) {
      throw new Error("Platform startup found an unsafe company identifier.");
    }
    known.add(company.id);
  }
  return known;
}

function validatePlatformCompanyRows(table, rows, knownCompanies) {
  return rows.map((row) => {
    const supplied = row?.company_id ?? row?.companyId;
    const companyId = supplied == null || String(supplied).trim() === ""
      ? DEFAULT_COMPANY_ID
      : String(supplied).trim();
    if (!isSafeCompanySlug(companyId) || !knownCompanies.has(companyId)) {
      throw new Error(`Platform startup rejected ${table} row with an unknown or unsafe company.`);
    }
    return { ...row, company_id: companyId };
  });
}

function tenantRecordIdentity(record, index) {
  const companyId = record.company_id || record.companyId;
  const recordId = record.id || record.key || record.sectionKey || record.userId;
  return `${companyId}:${recordId || `row-${index}`}`;
}

function deduplicateEquivalentTenantRows(table, rows, identity = tenantRecordIdentity) {
  const byIdentity = new Map();
  rows.forEach((row, index) => {
    const key = identity(row, index);
    const existing = byIdentity.get(key);
    if (!existing) {
      byIdentity.set(key, row);
      return;
    }
    if (JSON.stringify(existing) !== JSON.stringify(row)) {
      throw new Error(`Platform startup rejected conflicting duplicate ${table} row ${key}.`);
    }
  });
  return [...byIdentity.values()];
}

function assertTenantParents(table, rows, parentTable, parents, parentColumn) {
  const parentKeys = new Set(parents.map((parent, index) => tenantRecordIdentity(parent, index)));
  for (const row of rows) {
    const parentId = String(row?.[parentColumn] || "").trim();
    if (!parentId || !parentKeys.has(`${row.company_id}:${parentId}`)) {
      throw new Error(`Platform startup rejected ${table} row with a missing cross-tenant-safe ${parentTable} parent.`);
    }
  }
}

function mergeGlobalUser(row) {
  const {
    company_id: _companyId,
    companyId: _camelCompanyId,
    ...user
  } = mergeUser(row);
  return user;
}

function tagPlatformProduct(row, variants, galleryImages) {
  const companyVariants = variants.filter((variant) => variant.company_id === row.company_id);
  const companyGallery = galleryImages.filter((entry) => entry.company_id === row.company_id);
  const product = tagLoadedRecord(mergeProduct(row, companyVariants, companyGallery), row.company_id);
  return {
    ...product,
    variants: product.variants.map((variant) => tagLoadedRecord(variant, row.company_id)),
    gallery_images: product.gallery_images.map((entry) => tagLoadedRecord(entry, row.company_id)),
  };
}

function tagPlatformOrder(row, orderItems) {
  const companyItems = orderItems.filter((item) => item.company_id === row.company_id);
  const order = tagLoadedRecord(mergeOrder(row, companyItems), row.company_id);
  return {
    ...order,
    items: order.items.map((item) => tagLoadedRecord(item, row.company_id)),
  };
}

export async function loadPlatformStoreFromSupabase(dependencies = null) {
  const resolvedDependencies = dependencies || platformLoadDependenciesForTest || {};
  const tableNames = [
    "users",
    "companies",
    "company_domains",
    "company_settings",
    ...PLATFORM_TENANT_TABLES,
  ];
  let queryResults;
  if (resolvedDependencies.selectAllRows) {
    queryResults = [];
    for (const table of tableNames) {
      queryResults.push(await resolvedDependencies.selectAllRows(table, "select=*"));
    }
  } else {
    const client = await getPool().connect();
    let transactionStarted = false;
    try {
      await client.query("begin isolation level repeatable read read only");
      transactionStarted = true;
      const timeoutMs = startupHydrationTimeoutMs();
      await client.query(`set local statement_timeout = '${timeoutMs}ms'`);
      queryResults = [];
      for (const table of tableNames) {
        queryResults.push(await selectAllWithQuery(
          client.query.bind(client), table, "select=*",
        ));
      }
      await client.query("commit");
      transactionStarted = false;
    } catch (error) {
      if (transactionStarted) {
        try { await client.query("rollback"); } catch {}
      }
      throw error;
    } finally {
      client.release();
    }
  }
  const rowsByTable = Object.fromEntries(
    tableNames.map((table, index) => [table, queryResults[index]]),
  );
  const companyRows = rowsByTable.companies || [];
  const knownCompanies = knownPlatformCompanies(companyRows);
  const companyDomains = validatePlatformCompanyRows(
    "company_domains", rowsByTable.company_domains || [], knownCompanies,
  );
  const companySettings = validatePlatformCompanyRows(
    "company_settings", rowsByTable.company_settings || [], knownCompanies,
  );
  for (const table of PLATFORM_TENANT_TABLES) {
    rowsByTable[table] = validatePlatformCompanyRows(
      table, rowsByTable[table] || [], knownCompanies,
    );
  }

  const productRows = deduplicateEquivalentTenantRows("products", rowsByTable.products);
  const orderRows = deduplicateEquivalentTenantRows("orders", rowsByTable.orders);
  const variants = deduplicateEquivalentTenantRows(
    "product_variants", rowsByTable.product_variants,
  );
  const galleryImages = deduplicateEquivalentTenantRows(
    "product_gallery_images", rowsByTable.product_gallery_images,
  );
  const orderItems = deduplicateEquivalentTenantRows("order_items", rowsByTable.order_items);
  const carts = deduplicateEquivalentTenantRows("carts", rowsByTable.carts);
  assertTenantParents("product_variants", variants, "product", productRows, "product_id");
  assertTenantParents("product_gallery_images", galleryImages, "product", productRows, "product_id");
  assertTenantParents("order_items", orderItems, "order", orderRows, "order_id");
  const companyCarts = Object.fromEntries([...knownCompanies].map((companyId) => [companyId, {}]));
  const cartsByTenantUser = new Map();
  for (const cart of carts) {
    const logicalKey = `${cart.company_id}:${cart.user_id}`;
    const existing = cartsByTenantUser.get(logicalKey);
    if (existing && JSON.stringify(existing) !== JSON.stringify(cart)) {
      throw new Error(`Platform startup rejected conflicting duplicate carts row ${logicalKey}.`);
    }
    cartsByTenantUser.set(logicalKey, cart);
  }
  for (const cart of cartsByTenantUser.values()) {
    companyCarts[cart.company_id][cart.user_id] = cart.items || [];
  }

  const tenantRows = (table, mergeRow) => uniqueRecords(
    rowsByTable[table].map((row, index) =>
      tagLoadedRecord(mergeRow ? mergeRow(row, index) : row, row.company_id)),
    tenantRecordIdentity,
  );
  const users = uniqueRecords(
    (rowsByTable.users || []).map(mergeGlobalUser),
    (user) => user.id,
  );
  const memberships = uniqueRecords(
    rowsByTable.company_memberships.map((membership) => ({
      id: membership.id,
      companyId: membership.company_id,
      userId: membership.user_id,
      role: membership.role,
      status: membership.is_active === false ? "inactive" : "active",
      _permissions: Array.isArray(membership.permissions) ? membership.permissions : [],
      createdAt: membership.created_at,
      updatedAt: membership.updated_at,
    })),
    (membership) => membership.id || `${membership.companyId}:${membership.userId}`,
  );
  const store = rewriteStorageUrls({
    version: 1,
    savedAt: new Date().toISOString(),
    users,
    memberships,
    products: uniqueRecords(
      productRows.map((row) => tagPlatformProduct(row, variants, galleryImages)),
      tenantRecordIdentity,
    ),
    orders: uniqueRecords(
      orderRows.map((row) => tagPlatformOrder(row, orderItems)),
      tenantRecordIdentity,
    ),
    companyCarts,
    carts: companyCarts[DEFAULT_COMPANY_ID] || {},
    offers: tenantRows("homepage_offers", (row) => row.data || row),
    categoryCards: tenantRows("homepage_category_cards", (row) => row.data || row),
    categories: tenantRows("company_categories", mergeCategory),
    brands: tenantRows("company_brands", mergeBrand),
    reviews: tenantRows("reviews", (row) => row.data || row),
    workSessions: tenantRows("work_sessions", (row) => row.data || row),
    websiteMedia: tenantRows("website_media", mergeWebsiteMedia),
    websiteMediaHiddenKeys: tenantRows(
      "company_website_media_hidden_keys", mergeWebsiteMediaHiddenKey,
    ),
    websiteTexts: tenantRows("company_website_texts", mergeWebsiteText),
    customAdminModules: tenantRows("custom_admin_modules", mergeCustomAdminModule),
    customAdminModuleEntries: tenantRows(
      "custom_admin_module_entries", mergeCustomAdminModuleEntry,
    ),
    companyProductSchemas: tenantRows("company_product_schemas", mergeCompanyProductSchema),
    invoices: tenantRows("company_invoices", mergeCompanyInvoice),
    deliveryZones: tenantRows("company_delivery_zones", mergeDeliveryZone),
    activityLogs: tenantRows("company_activity_logs", mergeActivityLog),
    inboxConversations: tenantRows("company_inbox_conversations", (row) => ({
      id: row.id,
      contactId: row.contact_user_id,
      subject: row.subject || "",
      channel: row.channel,
      status: row.status,
      assignedEmployeeId: row.assigned_user_id || null,
      createdByUserId: row.created_by_user_id,
      lastMessageAt: row.last_message_at || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      closedAt: row.closed_at || null,
      archivedAt: row.archived_at || null,
    })),
    inboxMessages: tenantRows("company_inbox_messages", (row) => ({
      id: row.id,
      conversationId: row.conversation_id,
      senderType: row.sender_type,
      senderUserId: row.sender_user_id || null,
      body: row.body,
      createdAt: row.created_at,
    })),
    inboxConversationReads: tenantRows("company_inbox_reads", (row) => ({
      id: `${row.conversation_id}:${row.user_id}`,
      conversationId: row.conversation_id,
      userId: row.user_id,
      lastReadAt: row.last_read_at,
    })),
    companies: companyRows.map((company) =>
      mergeCompany(company, companyDomains, companySettings)),
  });
  const hasRows = users.length > 0
    || memberships.length > 0
    || LOADED_TENANT_COLLECTIONS
      .filter((key) => key !== "memberships")
      .some((key) => Array.isArray(store[key]) && store[key].length > 0);

  return { isEmpty: !hasRows, store, rawDomains: rowsByTable.company_domains || [] };
}

export async function saveStoreToSupabase(store, options = {}) {
  const companyId = normalizeCompanyId(options.companyId);
  const pruneMissing = options.pruneMissing === true;
  const includeProducts = options.includeProducts === true;
  const products = store.products || [];
  const orders = store.orders || [];
  const users = store.users || [];
  const offers = store.offers || [];
  const categoryCards = store.categoryCards || [];
  const reviews = store.reviews || [];
  const workSessions = store.workSessions || [];
  const websiteMedia = store.websiteMedia || [];
  const websiteMediaHiddenKeys = store.websiteMediaHiddenKeys || [];
  const websiteTexts = store.websiteTexts || [];
  const customAdminModules = store.customAdminModules || [];
  const customAdminModuleEntries = store.customAdminModuleEntries || [];
  const companyProductSchemas = store.companyProductSchemas || [];
  const carts = Object.entries(store.carts || {});
  const inboxConversations = store.inboxConversations || [];
  const inboxMessages = store.inboxMessages || [];
  const inboxConversationReads = store.inboxConversationReads || [];

  const productRows = products.map((product) => productRow(product, companyId));
  const productVariantRows = ensureUniqueRowIds(
    products.flatMap((product) => variantRows(product, companyId)),
    (row, index) => `${row.product_id}-variant-${index}`
  );
  const productGalleryRows = ensureUniqueRowIds(
    products.flatMap((product) => galleryRows(product, companyId)),
    (row, index) => `${row.product_id}-gallery-${index}`
  );
  const orderRows = orders.map((order) => orderRow(order, companyId));
  const itemRows = orders.flatMap((order) => orderItemRows(order, companyId));
  const userRows = users.map(userRow);
  const membershipRows = users.map((user) => membershipRow(user, companyId));
  const offerRows = offers.map((offer, index) => ({
    id: offer.id,
    company_id: companyId,
    display_order: Number(offer.displayOrder || index + 1),
    is_active: offer.isActive !== false,
    data: offer,
    created_at: rowDate(offer.createdAt),
    updated_at: rowDate(offer.updatedAt),
  }));
  const cardRows = categoryCards.map((card, index) => ({
    id: card.key || card.id || `card-${index}`,
    company_id: companyId,
    card_key: card.key || card.id || `card-${index}`,
    display_order: Number(card.displayOrder || index + 1),
    is_active: card.isActive !== false,
    data: card,
    created_at: rowDate(card.createdAt),
    updated_at: rowDate(card.updatedAt),
  }));
  const reviewRows = reviews.map((review) => ({
    id: review.id,
    company_id: companyId,
    type: review.type || "store",
    rating: Number(review.rating || 5),
    status: review.status || "approved",
    is_active: review.isActive !== false,
    data: review,
    created_at: rowDate(review.createdAt),
    updated_at: rowDate(review.updatedAt),
  }));
  const workSessionRows = workSessions.map((session) => ({
    id: session.id,
    company_id: companyId,
    employee_id: session.employeeId,
    date: session.date,
    login_time: normalizePostgresTimestamp(session.loginTime),
    logout_time: normalizePostgresTimestamp(session.logoutTime),
    data: session,
    created_at: rowDate(session.createdAt),
    updated_at: rowDate(session.updatedAt),
  }));
  const cartRows = carts.map(([userId, items]) => ({
    id: userId,
    company_id: companyId,
    user_id: userId,
    items,
    updated_at: new Date().toISOString(),
  }));
  const websiteMediaRows = websiteMedia.map((item, index) =>
    websiteMediaRow(item, index, companyId),
  );
  const websiteMediaHiddenKeyRows = websiteMediaHiddenKeys.map((item, index) =>
    websiteMediaHiddenKeyRow(item, index, companyId),
  );
  const websiteTextRows = websiteTexts.map((item, index) =>
    websiteTextRow(item, index, companyId),
  );
  const customAdminModuleRows = customAdminModules.map((module) => ({
    id: module.id,
    company_id: companyId,
    key: module.key,
    label: module.label,
    description: module.description || "",
    icon: module.icon || "folder",
    sidebar_order: Number(module.sidebarOrder || 0),
    enabled: module.enabled !== false,
    fields_schema: module.fieldsSchema || [],
    list_config: module.listConfig || {},
    form_config: module.formConfig || {},
    permissions: module.permissions || {},
    created_by: module.createdBy || null,
    updated_by: module.updatedBy || null,
    created_at: rowDate(module.createdAt),
    updated_at: rowDate(module.updatedAt),
  }));
  const invoiceRows = (store.invoices || []).map((inv) => ({
    id: inv.id,
    company_id: companyId,
    invoice_number: inv.invoice_number,
    customer_name: inv.customer_name,
    customer_email: inv.customer_email || null,
    customer_phone: inv.customer_phone || null,
    order_id: inv.order_id || null,
    status: inv.status || "draft",
    currency: inv.currency || "ILS",
    issue_date: inv.issue_date,
    due_date: inv.due_date || null,
    notes: inv.notes || null,
    line_items: inv.line_items || [],
    subtotal: Number(inv.subtotal || 0),
    discount_total: Number(inv.discount_total || 0),
    tax_total: Number(inv.tax_total || 0),
    total: Number(inv.total || 0),
    created_by: inv.created_by || "",
    updated_by: inv.updated_by || "",
    created_at: rowDate(inv.created_at),
    updated_at: rowDate(inv.updated_at),
    deleted_at: inv.deleted_at ? rowDate(inv.deleted_at) : null,
  }));
  const customAdminModuleEntryRows = customAdminModuleEntries.map((entry) => ({
    id: entry.id,
    company_id: companyId,
    module_id: entry.moduleId,
    data: entry.data || {},
    status: entry.status || "active",
    created_by: entry.createdBy || null,
    updated_by: entry.updatedBy || null,
    created_at: rowDate(entry.createdAt),
    updated_at: rowDate(entry.updatedAt),
  }));
  const companyProductSchemaRows = companyProductSchemas.map((record) => ({
    id: record.id,
    company_id: companyId,
    schema_json: record.schema || {},
    created_at: rowDate(record.createdAt),
    updated_at: rowDate(record.updatedAt),
  }));

  const deliveryZoneRows = (store.deliveryZones || []).map((z) => ({
    id: z.id,
    company_id: companyId,
    city_key: z.city_key,
    city_name: z.city_name,
    region: z.region || "",
    delivery_price: Number(z.delivery_price || 0),
    currency: z.currency || "ILS",
    enabled: z.enabled !== false,
    display_order: Number(z.display_order || 0),
    created_by: z.created_by || "",
    updated_by: z.updated_by || "",
    created_at: rowDate(z.created_at),
    updated_at: rowDate(z.updated_at),
    deleted_at: z.deleted_at ? rowDate(z.deleted_at) : null,
  }));

  const activityLogRows = (store.activityLogs || []).map((log) => ({
    id: log.id,
    company_id: companyId,
    actor_user_id: log.actor_user_id || "",
    actor_email: log.actor_email || "",
    actor_name: log.actor_name || "",
    actor_role: log.actor_role || "",
    action: log.action || "",
    entity_type: log.entity_type || "",
    entity_id: log.entity_id || "",
    entity_label: log.entity_label || "",
    summary: log.summary || "",
    before_data: log.before_data || null,
    after_data: log.after_data || null,
    metadata: log.metadata || null,
    ip_address: log.ip_address || null,
    user_agent: log.user_agent || null,
    created_at: rowDate(log.created_at),
  }));
  const inboxConversationRows = inboxConversations.map((conversation) => ({
    id: conversation.id,
    company_id: companyId,
    contact_user_id: conversation.contactId,
    subject: conversation.subject || "",
    channel: "internal",
    status: conversation.status || "open",
    assigned_user_id: conversation.assignedEmployeeId || null,
    created_by_user_id: conversation.createdByUserId,
    last_message_at: conversation.lastMessageAt ? rowDate(conversation.lastMessageAt) : null,
    created_at: rowDate(conversation.createdAt),
    updated_at: rowDate(conversation.updatedAt),
    closed_at: conversation.closedAt ? rowDate(conversation.closedAt) : null,
    archived_at: conversation.archivedAt ? rowDate(conversation.archivedAt) : null,
  }));
  const inboxMessageRows = inboxMessages.map((message) => ({
    id: message.id,
    company_id: companyId,
    conversation_id: message.conversationId,
    sender_type: message.senderType,
    sender_user_id: message.senderUserId || null,
    body: message.body,
    created_at: rowDate(message.createdAt),
  }));
  const inboxReadRows = inboxConversationReads.map((read) => ({
    company_id: companyId,
    conversation_id: read.conversationId,
    user_id: read.userId,
    last_read_at: rowDate(read.lastReadAt),
  }));

  await upsertRows("users", userRows);
  // Runtime store saves may seed missing memberships, but must never overwrite
  // explicit cPanel membership roles/statuses managed by the platform API.
  await insertRowsIfMissing("company_memberships", membershipRows);
  if (includeProducts) {
    await upsertCompanyRows("products", productRows, companyId);
    const productVariantProductIds = [...new Set(productVariantRows.map((row) => row.product_id))];
    for (const pid of productVariantProductIds) {
      await supabaseFetch(
        `/rest/v1/product_variants?product_id=eq.${encodeURIComponent(pid)}&${companyMutationFilter(companyId)}`,
        { method: "DELETE", headers: { Prefer: "return=minimal" } },
      );
    }
    await upsertCompanyRows("product_variants", productVariantRows, companyId);
    const productGalleryProductIds = [...new Set(productGalleryRows.map((row) => row.product_id))];
    for (const pid of productGalleryProductIds) {
      await supabaseFetch(
        `/rest/v1/product_gallery_images?product_id=eq.${encodeURIComponent(pid)}&${companyMutationFilter(companyId)}`,
        { method: "DELETE", headers: { Prefer: "return=minimal" } },
      );
    }
    await upsertCompanyRows("product_gallery_images", productGalleryRows, companyId);
  }
  await upsertCompanyRows("orders", orderRows, companyId);
  await upsertCompanyRows("order_items", itemRows, companyId);
  await upsertCompanyRows("carts", cartRows, companyId);
  await upsertCompanyRows("homepage_offers", offerRows, companyId);
  await upsertCompanyRows("homepage_category_cards", cardRows, companyId);
  await upsertCompanyRows("reviews", reviewRows, companyId);
  await upsertCompanyRows("work_sessions", workSessionRows, companyId);
  await upsertCompanyRows("website_media", websiteMediaRows, companyId);
  await upsertCompanyRows("company_website_media_hidden_keys", websiteMediaHiddenKeyRows, companyId);
  await upsertCompanyRows("company_website_texts", websiteTextRows, companyId);
  await upsertCompanyRows("custom_admin_modules", customAdminModuleRows, companyId);
  await upsertCompanyRows("custom_admin_module_entries", customAdminModuleEntryRows, companyId);
  await upsertCompanyRows("company_product_schemas", companyProductSchemaRows, companyId);
  await upsertCompanyRows("company_invoices", invoiceRows, companyId);
  await upsertCompanyRows("company_delivery_zones", deliveryZoneRows, companyId);
  await upsertCompanyRows("company_activity_logs", activityLogRows, companyId);
  await upsertCompanyRows("company_inbox_conversations", inboxConversationRows, companyId);
  await upsertCompanyRows("company_inbox_messages", inboxMessageRows, companyId);
  await upsertRows(
    "company_inbox_reads",
    inboxReadRows,
    ["company_id", "conversation_id", "user_id"],
  );

  if (pruneMissing) {
    if (includeProducts) {
      await deleteMissingCompanyRows("products", productRows.map((row) => row.id), companyId);
      await deleteMissingCompanyRows("product_variants", productVariantRows.map((row) => row.id), companyId);
      await deleteMissingCompanyRows("product_gallery_images", productGalleryRows.map((row) => row.id), companyId);
    }
    await deleteMissingCompanyRows("orders", orderRows.map((row) => row.id), companyId);
    await deleteMissingCompanyRows("order_items", itemRows.map((row) => row.id), companyId);
    await deleteMissingCompanyRows("carts", cartRows.map((row) => row.id), companyId);
    await deleteMissingCompanyRows("homepage_offers", offerRows.map((row) => row.id), companyId);
    await deleteMissingCompanyRows("homepage_category_cards", cardRows.map((row) => row.id), companyId);
    await deleteMissingCompanyRows("reviews", reviewRows.map((row) => row.id), companyId);
    await deleteMissingCompanyRows("work_sessions", workSessionRows.map((row) => row.id), companyId);
    await deleteMissingCompanyRows("website_media", websiteMediaRows.map((row) => row.id), companyId);
    await deleteMissingCompanyRows("company_website_media_hidden_keys", websiteMediaHiddenKeyRows.map((row) => row.id), companyId);
    await deleteMissingCompanyRows("company_website_texts", websiteTextRows.map((row) => row.id), companyId);
    await deleteMissingCompanyRows("custom_admin_modules", customAdminModuleRows.map((row) => row.id), companyId);
    await deleteMissingCompanyRows("custom_admin_module_entries", customAdminModuleEntryRows.map((row) => row.id), companyId);
    await deleteMissingCompanyRows("company_product_schemas", companyProductSchemaRows.map((row) => row.id), companyId);
    await deleteMissingCompanyRows("company_invoices", invoiceRows.map((row) => row.id), companyId);
    await deleteMissingCompanyRows("company_delivery_zones", deliveryZoneRows.map((row) => row.id), companyId);
    await deleteMissingCompanyRows("company_activity_logs", activityLogRows.map((row) => row.id), companyId);
  }
}

export async function saveInboxStateToSupabase(store, companyId) {
  if (!isSupabaseConfigured()) throw new Error("PostgreSQL DATABASE_URL is not configured.");
  const normalizedCompanyId = normalizeCompanyId(companyId);
  const client = await getPool().connect();
  let transactionStarted = false;
  try {
    await client.query("begin");
    transactionStarted = true;
    for (const conversation of store.inboxConversations || []) {
      await client.query(
        `insert into public.company_inbox_conversations
          (id, company_id, contact_user_id, subject, channel, status, assigned_user_id,
           created_by_user_id, last_message_at, created_at, updated_at, closed_at, archived_at)
         values ($1,$2,$3,$4,'internal',$5,$6,$7,$8,$9,$10,$11,$12)
         on conflict (id) do update set
           subject = excluded.subject,
           status = excluded.status,
           assigned_user_id = excluded.assigned_user_id,
           last_message_at = excluded.last_message_at,
           updated_at = excluded.updated_at,
           closed_at = excluded.closed_at,
           archived_at = excluded.archived_at
         where company_inbox_conversations.company_id = excluded.company_id`,
        [
          conversation.id,
          normalizedCompanyId,
          conversation.contactId,
          conversation.subject || "",
          conversation.status || "open",
          conversation.assignedEmployeeId || null,
          conversation.createdByUserId,
          conversation.lastMessageAt || null,
          conversation.createdAt,
          conversation.updatedAt,
          conversation.closedAt || null,
          conversation.archivedAt || null,
        ],
      );
    }
    for (const message of store.inboxMessages || []) {
      await client.query(
        `insert into public.company_inbox_messages
          (id, company_id, conversation_id, sender_type, sender_user_id, body, created_at)
         values ($1,$2,$3,$4,$5,$6,$7)
         on conflict (id) do nothing`,
        [message.id, normalizedCompanyId, message.conversationId, message.senderType,
          message.senderUserId || null, message.body, message.createdAt],
      );
    }
    for (const read of store.inboxConversationReads || []) {
      await client.query(
        `insert into public.company_inbox_reads
          (company_id, conversation_id, user_id, last_read_at)
         values ($1,$2,$3,$4)
         on conflict (company_id, conversation_id, user_id)
         do update set last_read_at = excluded.last_read_at`,
        [normalizedCompanyId, read.conversationId, read.userId, read.lastReadAt],
      );
    }
    await client.query("commit");
    transactionStarted = false;
    return store;
  } catch (error) {
    if (transactionStarted) {
      try { await client.query("rollback"); } catch {}
    }
    throw error;
  } finally {
    client.release();
  }
}

function mergeCategory(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name || {},
    description: row.description || null,
    parentId: row.parent_id || null,
    brandId: row.brand_id || null,
    imageUrl: row.image_url || null,
    heroVideo: row.hero_video || null,
    sortOrder: Number(row.sort_order || 0),
    isActive: row.is_active !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseStoredBrandName(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && (parsed.en != null || parsed.ar != null)) {
        return parsed;
      }
    } catch {
      // Keep the original plain-text brand name.
    }
  }
  return trimmed;
}

function brandLegacyNameValues(brand) {
  const name = brand?.name;
  const names = name && typeof name === "object" && !Array.isArray(name)
    ? [name.en, name.ar]
    : [name];
  return [brand?.slug, ...names]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase());
}

function mergeBrand(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: parseStoredBrandName(row.name),
    logoUrl: row.logo_url || null,
    heroVideo: row.hero_video || null,
    heroPoster: row.hero_poster || null,
    country: row.country || null,
    sortOrder: Number(row.sort_order || 0),
    isActive: row.is_active !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function catalogPatch(patch, mapping) {
  return Object.entries(mapping)
    .filter(([key]) => Object.prototype.hasOwnProperty.call(patch, key))
    .map(([key, column]) => [column, patch[key]]);
}

async function updateCatalogRow(table, companyId, id, patch, mapping, mergeRow) {
  const normalized = normalizeCompanyId(companyId);
  const entries = catalogPatch(patch, mapping);
  if (!entries.length) return null;
  const values = [normalized, id];
  const assignments = entries.map(([column, value]) => {
    values.push(toPgColumnValue(column, value));
    return `${quoteIdent(column)} = $${values.length}`;
  });
  const result = await query(
    `update ${tableName(table)} set ${assignments.join(", ")}
     where company_id = $1 and id = $2 returning *`,
    values,
  );
  return result.rows[0] ? mergeRow(result.rows[0]) : null;
}

const categoryPatchColumns = Object.freeze({
  slug: "slug",
  name: "name",
  description: "description",
  parentId: "parent_id",
  brandId: "brand_id",
  imageUrl: "image_url",
  heroVideo: "hero_video",
  sortOrder: "sort_order",
  isActive: "is_active",
  updatedAt: "updated_at",
});

const brandPatchColumns = Object.freeze({
  slug: "slug",
  name: "name",
  logoUrl: "logo_url",
  heroVideo: "hero_video",
  heroPoster: "hero_poster",
  country: "country",
  sortOrder: "sort_order",
  isActive: "is_active",
  updatedAt: "updated_at",
});

export async function listCategoriesByCompanyFromSupabase(companyId) {
  const rows = await selectCompanyRows("company_categories", normalizeCompanyId(companyId));
  return rows.map(mergeCategory).sort((a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug));
}

export async function findCategoryByCompanyFromSupabase(companyId, id) {
  const result = await query(
    `select * from public.company_categories where company_id = $1 and id = $2 limit 1`,
    [normalizeCompanyId(companyId), id],
  );
  return result.rows[0] ? mergeCategory(result.rows[0]) : null;
}

export async function findCategoryBySlugFromSupabase(companyId, slug) {
  const result = await query(
    `select * from public.company_categories where company_id = $1 and slug = $2 limit 1`,
    [normalizeCompanyId(companyId), slug],
  );
  return result.rows[0] ? mergeCategory(result.rows[0]) : null;
}

export async function createCategoryForCompanyInSupabase(companyId, data) {
  const row = categoryRow(data, normalizeCompanyId(companyId));
  const result = await query(
    `insert into public.company_categories
      (id, company_id, slug, name, description, parent_id, brand_id, image_url, hero_video, sort_order, is_active, created_at, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning *`,
    [row.id, row.company_id, row.slug, row.name, row.description, row.parent_id, row.brand_id, row.image_url,
      row.hero_video, row.sort_order, row.is_active, row.created_at, row.updated_at].map(toPgValue),
  );
  return mergeCategory(result.rows[0]);
}

export function updateCategoryForCompanyInSupabase(companyId, id, patch) {
  return updateCatalogRow("company_categories", companyId, id, patch, categoryPatchColumns, mergeCategory);
}

export function updateCategoryStatusForCompanyInSupabase(companyId, id, isActive) {
  return updateCategoryForCompanyInSupabase(companyId, id, {
    isActive,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteCategoryForCompanyInSupabase(companyId, id) {
  const result = await query(
    `delete from public.company_categories where company_id = $1 and id = $2 returning *`,
    [normalizeCompanyId(companyId), id],
  );
  return result.rows[0] ? mergeCategory(result.rows[0]) : null;
}

export async function countCategoryChildrenFromSupabase(companyId, id) {
  const result = await query(
    `select count(*)::integer as count from public.company_categories
     where company_id = $1 and parent_id = $2`,
    [normalizeCompanyId(companyId), id],
  );
  return Number(result.rows[0]?.count || 0);
}

export async function categoryParentWouldCycleInSupabase(companyId, categoryId, parentId) {
  if (!parentId) return false;
  const seen = new Set(categoryId ? [categoryId] : []);
  let cursorId = parentId;
  while (cursorId) {
    if (seen.has(cursorId)) return true;
    seen.add(cursorId);
    const cursor = await findCategoryByCompanyFromSupabase(companyId, cursorId);
    if (!cursor) return false;
    cursorId = cursor.parentId;
  }
  return false;
}

function tenantCatalogError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export async function runTenantCatalogWriteTransaction(client, companyId, callback) {
  const normalized = normalizeCompanyId(companyId);
  try {
    await client.query("begin");
    const company = await client.query(
      `select id from public.companies where id = $1 for update`,
      [normalized],
    );
    if (!company.rows[0]) throw tenantCatalogError("Company not found.", 404);
    const result = await callback(client, normalized);
    await client.query("commit");
    return result;
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {
      // Preserve the original transaction failure.
    }
    throw error;
  }
}

export async function withTenantCatalogWriteLock(companyId, callback) {
  const client = await getPool().connect();
  try {
    return await runTenantCatalogWriteTransaction(client, companyId, callback);
  } finally {
    client.release();
  }
}

async function findCategoryWithClient(client, companyId, id) {
  const result = await client.query(
    `select * from public.company_categories where company_id = $1 and id = $2 limit 1`,
    [companyId, id],
  );
  return result.rows[0] ? mergeCategory(result.rows[0]) : null;
}

async function validateCategoryParentWithClient(client, companyId, categoryId, parentId) {
  if (!parentId) return;
  const result = await client.query(
    `with recursive ancestry as (
       select id, parent_id, array[id]::text[] as visited, false as corrupt_cycle
       from public.company_categories
       where company_id = $1 and id = $2
       union all
       select parent.id, parent.parent_id, ancestry.visited || parent.id,
              parent.id = any(ancestry.visited)
       from ancestry
       join public.company_categories parent
         on parent.company_id = $1 and parent.id = ancestry.parent_id
       where not ancestry.corrupt_cycle
         and not parent.id = any(ancestry.visited)
     )
     select exists(select 1 from ancestry) as parent_exists,
            exists(select 1 from ancestry where id = $3) as creates_cycle`,
    [companyId, parentId, categoryId],
  );
  if (!result.rows[0]?.parent_exists) throw tenantCatalogError("Parent category not found.", 404);
  if (parentId === categoryId || result.rows[0]?.creates_cycle) {
    throw tenantCatalogError("Category parent would create a cycle.");
  }
}

export function createCategoryWithTenantLockInSupabase(companyId, data) {
  return withTenantCatalogWriteLock(companyId, async (client, normalized) => {
    await validateCategoryParentWithClient(client, normalized, data.id, data.parentId || null);
    const row = categoryRow(data, normalized);
    const result = await client.query(
      `insert into public.company_categories
        (id, company_id, slug, name, description, parent_id, brand_id, image_url, hero_video, sort_order, is_active, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning *`,
      [row.id, row.company_id, row.slug, row.name, row.description, row.parent_id, row.brand_id, row.image_url,
        row.hero_video, row.sort_order, row.is_active, row.created_at, row.updated_at].map(toPgValue),
    );
    return mergeCategory(result.rows[0]);
  });
}

export function updateCategoryWithTenantLockInSupabase(companyId, id, patch) {
  return withTenantCatalogWriteLock(companyId, async (client, normalized) => {
    const current = await findCategoryWithClient(client, normalized, id);
    if (!current) return null;
    if (Object.prototype.hasOwnProperty.call(patch, "parentId")) {
      await validateCategoryParentWithClient(client, normalized, id, patch.parentId);
    }
    const entries = catalogPatch(patch, categoryPatchColumns);
    const values = [normalized, id];
    const assignments = entries.map(([column, value]) => {
      values.push(toPgColumnValue(column, value));
      return `${quoteIdent(column)} = $${values.length}`;
    });
    const result = await client.query(
      `update public.company_categories set ${assignments.join(", ")}
       where company_id = $1 and id = $2 returning *`,
      values,
    );
    return result.rows[0] ? mergeCategory(result.rows[0]) : null;
  });
}

export function deleteCategoryWithTenantLockInSupabase(companyId, id) {
  return withTenantCatalogWriteLock(companyId, async (client, normalized) => {
    const category = await findCategoryWithClient(client, normalized, id);
    if (!category) return null;
    const children = await client.query(
      `select count(*)::integer as count from public.company_categories
       where company_id = $1 and parent_id = $2`,
      [normalized, id],
    );
    if (Number(children.rows[0]?.count || 0)) {
      throw tenantCatalogError("Category has child categories and cannot be deleted.", 409);
    }
    const legacyValues = [category.slug, category.name?.en, category.name?.ar]
      .filter(Boolean).map((value) => String(value).trim().toLowerCase());
    const references = await client.query(
      `select count(*)::integer as count from public.products
       where company_id = $1 and (
         category_id = $2
         or (category_id is null and lower(btrim(category)) = any($3::text[]))
         or (category_id is null and lower(btrim(category_ar)) = any($3::text[]))
       )`,
      [normalized, id, legacyValues],
    );
    if (Number(references.rows[0]?.count || 0)) {
      throw tenantCatalogError("Category is referenced by products and cannot be deleted.", 409);
    }
    const removed = await client.query(
      `delete from public.company_categories where company_id = $1 and id = $2 returning *`,
      [normalized, id],
    );
    return removed.rows[0] ? mergeCategory(removed.rows[0]) : null;
  });
}

export function deleteBrandWithTenantLockInSupabase(companyId, id) {
  return withTenantCatalogWriteLock(companyId, async (client, normalized) => {
    const brandResult = await client.query(
      `select * from public.company_brands where company_id = $1 and id = $2 limit 1`,
      [normalized, id],
    );
    if (!brandResult.rows[0]) return null;
    const brand = mergeBrand(brandResult.rows[0]);
    const legacyValues = brandLegacyNameValues(brand);
    const references = await client.query(
      `select count(*)::integer as count from public.products
       where company_id = $1 and (
         brand_id = $2 or (brand_id is null and lower(btrim(brand)) = any($3::text[]))
       )`,
      [normalized, id, legacyValues],
    );
    if (Number(references.rows[0]?.count || 0)) {
      throw tenantCatalogError("Brand is referenced by products and cannot be deleted.", 409);
    }
    const removed = await client.query(
      `delete from public.company_brands where company_id = $1 and id = $2 returning *`,
      [normalized, id],
    );
    return removed.rows[0] ? mergeBrand(removed.rows[0]) : null;
  });
}

async function insertTenantRowWithClient(client, table, row, { upsert = false } = {}) {
  const columns = Object.keys(row);
  const values = columns.map((column) => toPgColumnValue(column, row[column]));
  const placeholders = columns.map((_, index) => `$${index + 1}`);
  const updateColumns = columns.filter((column) => column !== "id" && column !== "company_id");
  const conflict = upsert
    ? `on conflict (id) do update set ${updateColumns.map((column) => `${quoteIdent(column)}=excluded.${quoteIdent(column)}`).join(", ")}
       where ${quoteIdent(table)}.company_id = excluded.company_id returning *`
    : "returning *";
  return client.query(
    `insert into ${tableName(table)} (${columns.map(quoteIdent).join(", ")})
     values (${placeholders.join(", ")}) ${conflict}`,
    values,
  );
}

function siteEditorDraftRecord(row) {
  if (!row) return null;
  return {
    id: row.id,
    companyId: row.company_id,
    siteId: row.site_id,
    pageId: row.page_id,
    locale: row.locale,
    status: row.status,
    revision: Number(row.revision || 0),
    document: row.document,
    audit: {
      createdAt: row.created_at,
      createdBy: row.created_by || "",
      updatedAt: row.updated_at,
      updatedBy: row.updated_by || "",
      updatedByEmail: row.updated_by_email || "",
    },
  };
}

export async function getSiteEditorDraftFromSupabase(companyId, pageId, locale = "en", siteId = "") {
  const result = await siteEditorQuery(
    `select * from public.company_site_editor_drafts
     where company_id = $1 and site_id = $2 and page_id = $3 and locale = $4
     limit 1`,
    [normalizeCompanyId(companyId), String(siteId || "").trim(), pageId, locale],
  );
  return siteEditorDraftRecord(result.rows[0]);
}

export async function saveSiteEditorDraftToSupabase({
  id,
  companyId,
  siteId,
  pageId,
  locale = "en",
  expectedRevision,
  document,
  actor,
}) {
  const normalizedCompanyId = normalizeCompanyId(companyId);
  const normalizedSiteId = String(siteId || "").trim();
  const revision = Number(expectedRevision);
  const values = [
    id,
    normalizedCompanyId,
    normalizedSiteId,
    pageId,
    locale,
    JSON.stringify(document),
    actor?.id || null,
    actor?.email || null,
  ];
  let result;

  if (revision === 0) {
    result = await siteEditorQuery(
      `insert into public.company_site_editor_drafts
        (id, company_id, site_id, page_id, locale, document, status, revision,
         created_by, updated_by, updated_by_email)
       values ($1, $2, $3, $4, $5, $6::jsonb, 'draft', 1, $7, $7, $8)
       on conflict (company_id, site_id, page_id, locale) do nothing
       returning *`,
      values,
    );
  } else {
    const updateValues = [
      normalizedCompanyId,
      normalizedSiteId,
      pageId,
      locale,
      JSON.stringify(document),
      actor?.id || null,
      actor?.email || null,
      revision,
    ];
    result = await siteEditorQuery(
      `update public.company_site_editor_drafts
       set document = $5::jsonb,
           revision = revision + 1,
           updated_at = now(),
           updated_by = $6,
           updated_by_email = $7
       where company_id = $1 and site_id = $2 and page_id = $3 and locale = $4
         and status = 'draft' and revision = $8
       returning *`,
      updateValues,
    );
  }

  if (result.rows[0]) return siteEditorDraftRecord(result.rows[0]);

  const current = await getSiteEditorDraftFromSupabase(normalizedCompanyId, pageId, locale, normalizedSiteId);
  const error = new Error("The draft changed in another session. Reload before saving again.");
  error.statusCode = 409;
  error.code = "REVISION_CONFLICT";
  error.currentRevision = current?.revision || 0;
  throw error;
}

export async function reconcileProductVariantsWithClient(client, companyId, product, { isCreate = false, trustedNewIds = false } = {}) {
  const existingResult = await client.query(
    `select id from public.product_variants
     where company_id = $1 and product_id = $2 for update`,
    [companyId, product.id],
  );
  const existingIds = new Set(existingResult.rows.map((row) => String(row.id)));
  const persistedVariants = (product.variants || []).map((variant) => {
    const requestedId = variant?.id ? String(variant.id) : "";
    const id = requestedId && (trustedNewIds || (!isCreate && existingIds.has(requestedId)))
      ? requestedId
      : crypto.randomUUID();
    return { ...variant, id };
  });
  const rows = variantRows({ ...product, variants: persistedVariants }, companyId);

  for (const row of rows) {
    if (existingIds.has(row.id)) {
      const columns = Object.keys(row).filter((column) => !["id", "company_id", "product_id"].includes(column));
      const values = [companyId, product.id, row.id];
      const assignments = columns.map((column) => {
        values.push(toPgColumnValue(column, row[column]));
        return `${quoteIdent(column)}=$${values.length}`;
      });
      await client.query(
        `update public.product_variants set ${assignments.join(", ")}
         where company_id=$1 and product_id=$2 and id=$3`,
        values,
      );
    } else {
      await insertTenantRowWithClient(client, "product_variants", row);
    }
  }

  const retainedIds = rows.map((row) => row.id);
  if (retainedIds.length) {
    await client.query(
      `delete from public.product_variants
       where company_id=$1 and product_id=$2 and not (id=any($3::text[]))`,
      [companyId, product.id, retainedIds],
    );
  } else {
    await client.query(
      "delete from public.product_variants where company_id=$1 and product_id=$2",
      [companyId, product.id],
    );
  }
  return { ...product, variants: persistedVariants };
}

async function validateProductCatalogReferencesWithClient(client, companyId, product) {
  for (const [field, table, label] of [
    ["categoryId", "company_categories", "Category"],
    ["brandId", "company_brands", "Brand"],
  ]) {
    const id = product[field];
    if (!id) continue;
    const result = await client.query(
      `select id, is_active from ${tableName(table)} where company_id = $1 and id = $2 limit 1`,
      [companyId, id],
    );
    if (!result.rows[0]) throw tenantCatalogError(`${label} not found.`, 404);
    if (result.rows[0].is_active === false) throw tenantCatalogError(`${label} is inactive.`);
  }
}

export function saveProductWithTenantCatalogLockInSupabase(companyId, product, { isCreate = false } = {}) {
  return withTenantCatalogWriteLock(companyId, async (client, normalized) => {
    await validateProductCatalogReferencesWithClient(client, normalized, product);
    const existingVariants = await client.query(
      "select id from public.product_variants where company_id=$1 and product_id=$2",
      [normalized, product.id],
    );
    const existingIds = new Set(existingVariants.rows.map((row) => String(row.id)));
    const persistedProduct = {
      ...product,
      variants: (product.variants || []).map((variant) => ({
        ...variant,
        id: !isCreate && variant?.id && existingIds.has(String(variant.id))
          ? String(variant.id)
          : crypto.randomUUID(),
      })),
    };
    const row = productRow(persistedProduct, normalized);
    let persisted;
    if (isCreate) {
      persisted = await insertTenantRowWithClient(client, "products", row);
    } else {
      const columns = Object.keys(row).filter((column) => !["id", "company_id"].includes(column));
      const values = [normalized, product.id];
      const assignments = columns.map((column) => {
        values.push(toPgColumnValue(column, row[column]));
        return `${quoteIdent(column)}=$${values.length}`;
      });
      persisted = await client.query(
        `update public.products set ${assignments.join(", ")}
         where company_id = $1 and id = $2 returning *`,
        values,
      );
    }
    if (!persisted.rows[0]) throw tenantCatalogError("Product not found.", 404);
    await client.query(
      `delete from public.product_gallery_images where company_id = $1 and product_id = $2`,
      [normalized, product.id],
    );
    const reconciledProduct = await reconcileProductVariantsWithClient(client, normalized, persistedProduct, { isCreate: false, trustedNewIds: true });
    for (const row of galleryRows(reconciledProduct, normalized)) {
      await insertTenantRowWithClient(client, "product_gallery_images", row);
    }
    return reconciledProduct;
  });
}

export function deleteProductWithTenantCatalogLockInSupabase(companyId, id) {
  return withTenantCatalogWriteLock(companyId, async (client, normalized) => {
    const removed = await client.query(
      `delete from public.products where company_id = $1 and id = $2 returning *`,
      [normalized, id],
    );
    return removed.rows[0] ? mergeProduct(removed.rows[0], [], []) : null;
  });
}

export async function saveActivityLogEntryToSupabase(companyId, log) {
  const normalized = normalizeCompanyId(companyId);
  await upsertCompanyRows("company_activity_logs", [{
    id: log.id,
    company_id: normalized,
    actor_user_id: log.actor_user_id || "",
    actor_email: log.actor_email || "",
    actor_name: log.actor_name || "",
    actor_role: log.actor_role || "",
    action: log.action || "",
    entity_type: log.entity_type || "",
    entity_id: log.entity_id || "",
    entity_label: log.entity_label || "",
    summary: log.summary || "",
    before_data: log.before_data || null,
    after_data: log.after_data || null,
    metadata: log.metadata || null,
    ip_address: log.ip_address || "",
    user_agent: log.user_agent || "",
    created_at: rowDate(log.created_at),
  }], normalized);
}

export async function listBrandsByCompanyFromSupabase(companyId) {
  const rows = await selectCompanyRows("company_brands", normalizeCompanyId(companyId));
  return rows.map(mergeBrand).sort((a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug));
}

export async function findBrandByCompanyFromSupabase(companyId, id) {
  const result = await query(
    `select * from public.company_brands where company_id = $1 and id = $2 limit 1`,
    [normalizeCompanyId(companyId), id],
  );
  return result.rows[0] ? mergeBrand(result.rows[0]) : null;
}

export async function findBrandBySlugFromSupabase(companyId, slug) {
  const result = await query(
    `select * from public.company_brands where company_id = $1 and slug = $2 limit 1`,
    [normalizeCompanyId(companyId), slug],
  );
  return result.rows[0] ? mergeBrand(result.rows[0]) : null;
}

export async function createBrandForCompanyInSupabase(companyId, data) {
  const row = brandRow(data, normalizeCompanyId(companyId));
  const result = await query(
    `insert into public.company_brands
      (id, company_id, slug, name, logo_url, hero_video, hero_poster, country, sort_order, is_active, created_at, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning *`,
    [row.id, row.company_id, row.slug, row.name, row.logo_url, row.hero_video, row.hero_poster,
      row.country, row.sort_order, row.is_active, row.created_at, row.updated_at].map(toPgValue),
  );
  return mergeBrand(result.rows[0]);
}

export function updateBrandForCompanyInSupabase(companyId, id, patch) {
  return updateCatalogRow("company_brands", companyId, id, patch, brandPatchColumns, mergeBrand);
}

export function updateBrandStatusForCompanyInSupabase(companyId, id, isActive) {
  return updateBrandForCompanyInSupabase(companyId, id, {
    isActive,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteBrandForCompanyInSupabase(companyId, id) {
  const result = await query(
    `delete from public.company_brands where company_id = $1 and id = $2 returning *`,
    [normalizeCompanyId(companyId), id],
  );
  return result.rows[0] ? mergeBrand(result.rows[0]) : null;
}

export async function countCategoryProductReferencesFromSupabase(companyId, category) {
  const normalized = normalizeCompanyId(companyId);
  const legacyValues = [category.slug, category.name?.en, category.name?.ar]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase());
  const result = await query(
    `select count(*)::integer as count
     from public.products
     where company_id = $1
       and (
         category_id = $2
         or (category_id is null and lower(btrim(category)) = any($3::text[]))
         or (category_id is null and lower(btrim(category_ar)) = any($3::text[]))
       )`,
    [normalized, category.id, legacyValues],
  );
  return Number(result.rows[0]?.count || 0);
}

export async function countBrandProductReferencesFromSupabase(companyId, brand) {
  const normalized = normalizeCompanyId(companyId);
  const legacyValues = brandLegacyNameValues(brand);
  const result = await query(
    `select count(*)::integer as count
     from public.products
     where company_id = $1
       and (
         brand_id = $2
         or (brand_id is null and lower(btrim(brand)) = any($3::text[]))
       )`,
    [normalized, brand.id, legacyValues],
  );
  return Number(result.rows[0]?.count || 0);
}

export async function listUserMembershipsFromSupabase(userId) {
  const normalizedUserId = String(userId || "").trim();
  const [memberships, matchingUsers] = await Promise.all([
    selectAll(
      "company_memberships",
      `select=*&user_id=eq.${encodeURIComponent(normalizedUserId)}`,
    ),
    selectAll(
      "users",
      `select=*&id=eq.${encodeURIComponent(normalizedUserId)}`,
    ),
  ]);
  const user = matchingUsers.length === 1 ? mergeUser(matchingUsers[0]) : null;
  return memberships.map((membership) => ({
    id: membership.id,
    companyId: membership.company_id,
    userId: membership.user_id,
    role: membership.role,
    status: membership.is_active === false ? "inactive" : "active",
    _permissions: membership.permissions || [],
    createdAt: membership.created_at,
    updatedAt: membership.updated_at,
    user,
  }));
}

export async function saveCompanyToSupabase(company) {
  const persistenceDependencies = companyPersistenceDependenciesForTest || {};
  const persistRows = persistenceDependencies.upsertRows || upsertRows;
  const deleteCompanyDomain = persistenceDependencies.deleteCompanyDomain || (async (domainId) => {
    await supabaseFetch(
      `/rest/v1/company_domains?id=eq.${encodeURIComponent(domainId)}`,
      { method: "DELETE", headers: { Prefer: "return=minimal" } },
    );
  });
  const companyId = normalizeCompanyId(company.id);
  const createdAt = rowDate(company.createdAt);
  const updatedAt = rowDate(company.updatedAt);

  await persistRows("companies", [{
    id: companyId,
    slug: company.slug,
    name: company.name,
    status: company.status,
    is_default: companyId === DEFAULT_COMPANY_ID,
    created_at: createdAt,
    updated_at: updatedAt,
  }]);

  await persistRows("company_settings", [{
    company_id: companyId,
    settings: company.settings || {},
    created_at: createdAt,
    updated_at: updatedAt,
  }], "company_id");

  if (!company.domain) {
    if (company._domainId) {
      await deleteCompanyDomain(company._domainId);
    }
    return { domainId: "" };
  }

  const domainId = company._domainId || `company-domain-${companyId}`;
  await persistRows("company_domains", [{
    id: domainId,
    company_id: companyId,
    domain: company.domain,
    is_primary: true,
    // Non-default company domains remain inactive until domain resolution is enabled later.
    is_active: companyId === DEFAULT_COMPANY_ID,
    created_at: createdAt,
    updated_at: updatedAt,
  }]);

  return { domainId };
}

export async function runCompanyBrandingSettingsTransaction(client, companyId, input = {}) {
  const normalized = normalizeCompanyId(companyId);
  const settingsPatch = input.settingsPatch && typeof input.settingsPatch === "object"
    ? input.settingsPatch
    : {};
  try {
    await client.query("begin");
    const companyResult = await client.query(
      `select id, name from public.companies where id = $1 for update`,
      [normalized],
    );
    if (!companyResult.rows[0]) {
      const error = new Error("Company not found.");
      error.statusCode = 404;
      throw error;
    }
    const settingsResult = await client.query(
      `select settings from public.company_settings where company_id = $1 for update`,
      [normalized],
    );
    const currentSettings = settingsResult.rows[0]?.settings || {};
    const settings = { ...currentSettings, ...settingsPatch };
    if (settingsPatch.theme) {
      settings.theme = { ...(currentSettings.theme || {}), ...settingsPatch.theme };
    }
    if (settingsPatch.socialLinks) {
      settings.socialLinks = { ...(currentSettings.socialLinks || {}), ...settingsPatch.socialLinks };
    }
    if (settingsPatch.websiteContent) {
      settings.websiteContent = {
        ...(currentSettings.websiteContent || {}),
        ...settingsPatch.websiteContent,
      };
    }
    const updatedAt = new Date().toISOString();
    const name = input.name === undefined ? companyResult.rows[0].name : input.name;
    if (input.name !== undefined) {
      await client.query(
        `update public.companies set name = $2, updated_at = $3 where id = $1`,
        [normalized, name, updatedAt],
      );
    }
    await client.query(
      `insert into public.company_settings (company_id, settings, created_at, updated_at)
       values ($1, $2, $3, $3)
       on conflict (company_id) do update
       set settings = excluded.settings, updated_at = excluded.updated_at`,
      [normalized, JSON.stringify(settings), updatedAt],
    );
    await client.query("commit");
    return { name, settings, updatedAt };
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {
      // Preserve the original persistence failure.
    }
    throw error;
  }
}

export async function updateCompanyBrandingAndSettingsInSupabase(companyId, input) {
  const client = await getPool().connect();
  try {
    return await runCompanyBrandingSettingsTransaction(client, companyId, input);
  } finally {
    client.release();
  }
}

export async function saveSuperAdminUserToSupabase(
  user,
  companyId = DEFAULT_COMPANY_ID,
  options = {},
) {
  const normalizedCompanyId = normalizeCompanyId(companyId);
  const previousUser = options.previousUser || null;
  const membershipId = `${normalizedCompanyId}:${user.id}`;
  const existingMemberships = await selectAll(
    "company_memberships",
    `select=*&company_id=eq.${encodeURIComponent(normalizedCompanyId)}&user_id=eq.${encodeURIComponent(user.id)}`,
  );
  if (existingMemberships.length > 1) {
    throw new Error("Ambiguous company memberships prevent Super Admin provisioning.");
  }

  const previousMembership = existingMemberships[0] || null;
  const pendingUser = previousUser || {
    ...user,
    role: "customer",
    isActive: false,
  };
  let pendingUserWritten = false;
  let membershipAttempted = false;
  let promotionAttempted = false;

  try {
    if (!previousUser) {
      await upsertRows("users", [userRow(pendingUser)]);
      pendingUserWritten = true;
    }

    membershipAttempted = true;
    await upsertRows("company_memberships", [membershipRow(user, normalizedCompanyId)]);

    // This is deliberately the final privileged write. Membership alone does
    // not satisfy requireSuperAdmin; users.role remains authoritative.
    promotionAttempted = true;
    await upsertRows("users", [userRow(user)]);
    return user;
  } catch (error) {
    const compensationErrors = [];

    // A failed response can be ambiguous, so first attempt to restore the
    // authoritative user role even when the promotion call reported failure.
    if (promotionAttempted) {
      try {
        await upsertRows("users", [userRow(pendingUser)]);
      } catch (compensationError) {
        compensationErrors.push(compensationError);
      }
    }

    if (membershipAttempted) {
      try {
        if (previousMembership) {
          await upsertRows("company_memberships", [previousMembership]);
        } else {
          await supabaseFetch(
            `/rest/v1/company_memberships?id=eq.${encodeURIComponent(membershipId)}`,
            { method: "DELETE", headers: { Prefer: "return=minimal" } },
          );
        }
      } catch (compensationError) {
        compensationErrors.push(compensationError);
      }
    }

    if (pendingUserWritten) {
      try {
        await supabaseFetch(
          `/rest/v1/users?id=eq.${encodeURIComponent(user.id)}&role=eq.customer&is_active=eq.false`,
          { method: "DELETE", headers: { Prefer: "return=minimal" } },
        );
      } catch (compensationError) {
        compensationErrors.push(compensationError);
      }
    }

    if (compensationErrors.length) error.compensationFailed = true;
    throw error;
  }
}

export async function uploadImageToSupabaseStorage({
  companyId = DEFAULT_COMPANY_ID,
  filename,
  contentType,
  data,
}) {
  if (!isSupabaseStorageConfigured()) {
    throw new Error("Supabase Storage is not configured.");
  }

  const bucket = process.env.SUPABASE_BUCKET;
  const storagePath = companyStoragePath(
    companyId,
    "uploads",
    new Date().toISOString().slice(0, 10),
    filename,
  );
  const encodedPath = encodeStoragePath(storagePath);
  await supabaseFetch(`/storage/v1/object/${encodeURIComponent(bucket)}/${encodedPath}`, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: data,
  });

  const publicUrl = `${supabaseUrl()}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodedPath}`;
  return {
    path: publicUrl,
    url: publicUrl,
    storagePath,
  };
}

