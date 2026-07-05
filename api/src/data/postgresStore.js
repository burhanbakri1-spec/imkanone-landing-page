import {
  DEFAULT_COMPANY_ID,
  companyStoragePath,
  normalizeCompanyId,
  selectPreferredCompanyDomains,
} from "../tenancy/company.js";
import { Pool } from "pg";
import { isVariantVisible, withVariantVisibility } from "../products/variantVisibility.js";

let pool;

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
  const params = new URLSearchParams(restQuery);
  const where = whereFromParams(params);
  const result = await query(`select * from ${tableName(table)}${where.clause}`, where.values);
  return result.rows;
}

async function upsertRowsSql(table, rows, conflictColumn = "id", ignoreDuplicates = false) {
  if (!rows.length) return;

  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const values = [];
  const tuples = rows.map((row) => {
    const placeholders = columns.map((column) => {
      values.push(toPgColumnValue(column, row[column]));
      return `$${values.length}`;
    });
    return `(${placeholders.join(", ")})`;
  });

  const updateColumns = columns.filter((column) => column !== conflictColumn);
  const conflictSql = ignoreDuplicates || !updateColumns.length
    ? "do nothing"
    : `do update set ${updateColumns
        .map((column) => `${quoteIdent(column)} = excluded.${quoteIdent(column)}`)
        .join(", ")}`;

  await query(
    `insert into ${tableName(table)} (${columns.map(quoteIdent).join(", ")})
     values ${tuples.join(", ")}
     on conflict (${quoteIdent(conflictColumn)}) ${conflictSql}`,
    values,
  );
}

async function upsertRows(table, rows, conflictColumn = "id") {
  await upsertRowsSql(table, rows, conflictColumn, false);
}

async function insertRowsIfMissing(table, rows, conflictColumn = "id") {
  await upsertRowsSql(table, rows, conflictColumn, true);
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
    brand: product.brand || "EB Chemical",
    image_url: product.image || "",
    hover_image_url: product.hoverImage || product.secondaryImage || "",
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
  return {
    id: user.id,
    name: user.name || "",
    email: user.email || "",
    phone: user.phone || "",
    password: user.password || "",
    role: user.role || "customer",
    department: user.department || "",
    permissions: user.permissions || [],
    eb_points: Number(user.ebPoints || 0),
    total_points_earned: Number(user.totalPointsEarned || 0),
    total_points_redeemed: Number(user.totalPointsRedeemed || 0),
    is_active: user.isActive !== false,
    data: user,
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
    image: row.image_url || row.data?.image || "",
    hoverImage: row.hover_image_url || row.data?.hoverImage || "",
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

export async function listPlatformUsersFromSupabase() {
  const rows = await selectAll("users", "select=*");
  return rows.map(mergeUser);
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

export async function loadStoreFromSupabase(companyId = DEFAULT_COMPANY_ID) {
  const normalizedCompanyId = normalizeCompanyId(companyId);
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
    reviews,
    workSessions,
    websiteMedia,
    customAdminModules,
    customAdminModuleEntries,
    companyInvoices,
    companies,
    companyDomains,
    companySettings,
  ] = await Promise.all([
    selectAll("users", "select=*"),
    selectAll(
      "company_memberships",
      `select=*&company_id=eq.${encodeURIComponent(normalizedCompanyId)}`,
    ),
    selectCompanyRows("products", normalizedCompanyId),
    selectCompanyRows("product_variants", normalizedCompanyId),
    selectCompanyRows("product_gallery_images", normalizedCompanyId),
    selectCompanyRows("orders", normalizedCompanyId),
    selectCompanyRows("order_items", normalizedCompanyId),
    selectCompanyRows("carts", normalizedCompanyId),
    selectCompanyRows("homepage_offers", normalizedCompanyId),
    selectCompanyRows("homepage_category_cards", normalizedCompanyId),
    selectCompanyRows("reviews", normalizedCompanyId),
    selectCompanyRows("work_sessions", normalizedCompanyId),
    selectCompanyRows("website_media", normalizedCompanyId),
    selectCompanyRows("custom_admin_modules", normalizedCompanyId),
    selectCompanyRows("custom_admin_module_entries", normalizedCompanyId),
    selectCompanyRows("company_invoices", normalizedCompanyId),
    selectAll("companies", "select=*"),
    selectAll("company_domains", "select=*"),
    selectAll("company_settings", "select=*"),
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
    reviews,
    workSessions,
    websiteMedia,
    customAdminModules,
    customAdminModuleEntries,
    companyInvoices,
  ].some((rows) => rows.length);

  return {
    isEmpty: !hasRows,
    store: rewriteStorageUrls({
      version: 1,
      savedAt: new Date().toISOString(),
      users: users.map(mergeUser),
      memberships: memberships.map((membership) => ({
        id: membership.id,
        companyId: membership.company_id,
        userId: membership.user_id,
        role: membership.role,
        status: membership.is_active === false ? "inactive" : "active",
        createdAt: membership.created_at,
        updatedAt: membership.updated_at,
      })),
      products: products.map((product) => mergeProduct(product, variants, galleryImages)),
      orders: orders.map((order) => mergeOrder(order, orderItems)),
      carts: Object.fromEntries(carts.map((cart) => [cart.user_id, cart.items || []])),
      offers: offers.map((offer) => offer.data || offer),
      categoryCards: categoryCards.map((card) => card.data || card),
      reviews: reviews.map((review) => review.data || review),
      websiteMedia: websiteMedia.map(mergeWebsiteMedia),
      workSessions: workSessions.map((session) => session.data || session),
      customAdminModules: customAdminModules.map(mergeCustomAdminModule),
      customAdminModuleEntries: customAdminModuleEntries.map(mergeCustomAdminModuleEntry),
      invoices: companyInvoices.map(mergeCompanyInvoice),
      companies: companies.map((company) =>
        mergeCompany(company, companyDomains, companySettings),
      ),
    }),
  };
}

export async function saveStoreToSupabase(store, options = {}) {
  const companyId = normalizeCompanyId(options.companyId);
  const pruneMissing = options.pruneMissing === true;
  const products = store.products || [];
  const orders = store.orders || [];
  const users = store.users || [];
  const offers = store.offers || [];
  const categoryCards = store.categoryCards || [];
  const reviews = store.reviews || [];
  const workSessions = store.workSessions || [];
  const websiteMedia = store.websiteMedia || [];
  const customAdminModules = store.customAdminModules || [];
  const customAdminModuleEntries = store.customAdminModuleEntries || [];
  const carts = Object.entries(store.carts || {});

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

  await upsertRows("users", userRows);
  // Runtime store saves may seed missing memberships, but must never overwrite
  // explicit cPanel membership roles/statuses managed by the platform API.
  await insertRowsIfMissing("company_memberships", membershipRows);
  await upsertCompanyRows("products", productRows, companyId);
  // Delete orphaned variant rows before re-inserting current set
  const productVariantProductIds = [...new Set(productVariantRows.map((row) => row.product_id))];
  for (const pid of productVariantProductIds) {
    await supabaseFetch(
      `/rest/v1/product_variants?product_id=eq.${encodeURIComponent(pid)}&${companyMutationFilter(companyId)}`,
      {
        method: "DELETE",
        headers: { Prefer: "return=minimal" },
      },
    );
  }
  await upsertCompanyRows("product_variants", productVariantRows, companyId);
  // Delete orphaned gallery rows before re-inserting current set
  const productGalleryProductIds = [...new Set(productGalleryRows.map((row) => row.product_id))];
  for (const pid of productGalleryProductIds) {
    await supabaseFetch(
      `/rest/v1/product_gallery_images?product_id=eq.${encodeURIComponent(pid)}&${companyMutationFilter(companyId)}`,
      {
        method: "DELETE",
        headers: { Prefer: "return=minimal" },
      },
    );
  }
  await upsertCompanyRows("product_gallery_images", productGalleryRows, companyId);
  await upsertCompanyRows("orders", orderRows, companyId);
  await upsertCompanyRows("order_items", itemRows, companyId);
  await upsertCompanyRows("carts", cartRows, companyId);
  await upsertCompanyRows("homepage_offers", offerRows, companyId);
  await upsertCompanyRows("homepage_category_cards", cardRows, companyId);
  await upsertCompanyRows("reviews", reviewRows, companyId);
  await upsertCompanyRows("work_sessions", workSessionRows, companyId);
  await upsertCompanyRows("website_media", websiteMediaRows, companyId);
  await upsertCompanyRows("custom_admin_modules", customAdminModuleRows, companyId);
  await upsertCompanyRows("custom_admin_module_entries", customAdminModuleEntryRows, companyId);
  await upsertCompanyRows("company_invoices", invoiceRows, companyId);

  if (pruneMissing) {
    await deleteMissingCompanyRows("products", productRows.map((row) => row.id), companyId);
    await deleteMissingCompanyRows("product_variants", productVariantRows.map((row) => row.id), companyId);
    await deleteMissingCompanyRows("product_gallery_images", productGalleryRows.map((row) => row.id), companyId);
    await deleteMissingCompanyRows("orders", orderRows.map((row) => row.id), companyId);
    await deleteMissingCompanyRows("order_items", itemRows.map((row) => row.id), companyId);
    await deleteMissingCompanyRows("carts", cartRows.map((row) => row.id), companyId);
    await deleteMissingCompanyRows("homepage_offers", offerRows.map((row) => row.id), companyId);
    await deleteMissingCompanyRows("homepage_category_cards", cardRows.map((row) => row.id), companyId);
    await deleteMissingCompanyRows("reviews", reviewRows.map((row) => row.id), companyId);
    await deleteMissingCompanyRows("work_sessions", workSessionRows.map((row) => row.id), companyId);
    await deleteMissingCompanyRows("website_media", websiteMediaRows.map((row) => row.id), companyId);
    await deleteMissingCompanyRows("custom_admin_modules", customAdminModuleRows.map((row) => row.id), companyId);
    await deleteMissingCompanyRows("custom_admin_module_entries", customAdminModuleEntryRows.map((row) => row.id), companyId);
    await deleteMissingCompanyRows("company_invoices", invoiceRows.map((row) => row.id), companyId);
  }
}

export async function saveCompanyToSupabase(company) {
  const companyId = normalizeCompanyId(company.id);
  const createdAt = rowDate(company.createdAt);
  const updatedAt = rowDate(company.updatedAt);

  await upsertRows("companies", [{
    id: companyId,
    slug: company.slug,
    name: company.name,
    status: company.status,
    is_default: companyId === DEFAULT_COMPANY_ID,
    created_at: createdAt,
    updated_at: updatedAt,
  }]);

  await upsertRows("company_settings", [{
    company_id: companyId,
    settings: company.settings || {},
    created_at: createdAt,
    updated_at: updatedAt,
  }], "company_id");

  if (!company.domain) {
    if (company._domainId) {
      await supabaseFetch(
        `/rest/v1/company_domains?id=eq.${encodeURIComponent(company._domainId)}`,
        { method: "DELETE", headers: { Prefer: "return=minimal" } },
      );
    }
    return { domainId: "" };
  }

  const domainId = company._domainId || `company-domain-${companyId}`;
  await upsertRows("company_domains", [{
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

