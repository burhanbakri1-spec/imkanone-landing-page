import path from "node:path";
import { pathToFileURL } from "node:url";
import { Pool } from "pg";

const EXTERNAL_TARGET_URL = "https://cg8hv00dppir2hu99ds4p75h.187.55.225.56.sslip.io";
const EXTERNAL_TARGET_HOST = "cg8hv00dppir2hu99ds4p75h.187.55.225.56.sslip.io";
const CONTAINER_TARGET_URL = "http://127.0.0.1:5000";
const CONTAINER_TARGET_HOST = "127.0.0.1";
const CONTAINER_DATABASE = "eb_catalog_test";
const CONTAINER_DATABASE_USER = "eb_catalog_test_user";
const args = new Set(process.argv.slice(2));
const containerLocal = args.has("--container-local");
const verifyBoundaryOnly = args.has("--verify-boundary");
const supportedArgs = new Set(["--container-local", "--verify-boundary"]);
const unsupportedArgs = [...args].filter((argument) => !supportedArgs.has(argument));
if (unsupportedArgs.length) {
  throw new Error(`Unsupported argument: ${unsupportedArgs[0]}`);
}
if (verifyBoundaryOnly && !containerLocal) {
  throw new Error("--verify-boundary requires --container-local.");
}
const TARGET_URL = containerLocal ? CONTAINER_TARGET_URL : EXTERNAL_TARGET_URL;
const TARGET_HOST = containerLocal ? CONTAINER_TARGET_HOST : EXTERNAL_TARGET_HOST;
const COMPANY_ID = "icare";
const ADMIN_EMAIL = "icare-admin@igroup.website";
let password = String(process.env.ICARE_STAGING_PASSWORD || "");

delete process.env.ICARE_STAGING_PASSWORD;

const TEST_RECORDS = Object.freeze({
  product: {
    id: "product-1783965814870",
    slug: "icare-integration-product-1783965814764",
    name: "Updated iCare Integration Product",
  },
  category: {
    id: "fe2a6b82-9a30-4a90-8d81-af806f273405",
    slug: "product-test-category-1783965814764",
    name: "Product Test Category",
  },
  brand: {
    id: "02c7e456-3c3e-46d1-895a-7053b4e2140c",
    slug: "product-test-brand-1783965814764",
    name: "iCare Product Test Brand",
  },
});

const EXPECTED_COUNTS = Object.freeze({
  categories: 43,
  brands: 18,
  products: 20,
  websiteTexts: 173,
  websiteMedia: 18,
});

const LEGACY_HOST = "backend.igroup.website";
const LEGACY_PREFIXES = ["/public/uploads/", "/uploads/", "/storage/icare/uploads/"];
const report = {
  cleanup: [],
  images: {
    discovered: 0,
    uploaded: 0,
    reused: 0,
    cleared: 0,
    failed: [],
  },
  updates: {
    products: 0,
    categories: 0,
    brands: 0,
    websiteMedia: 0,
  },
  smoke: {},
  counts: {},
};

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function localizedEnglish(value) {
  if (typeof value === "string") return value;
  return isRecord(value) && typeof value.en === "string" ? value.en : "";
}

export function requireLoginPassword(value) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("ICARE_STAGING_PASSWORD is required.");
  }
  return value;
}

export async function authenticateBeforeMutation({
  passwordValue,
  authenticate,
  mutate,
}) {
  let loginPassword = requireLoginPassword(passwordValue);
  let token = "";
  try {
    token = await authenticate(loginPassword);
    loginPassword = "";
    return await mutate(token);
  } finally {
    loginPassword = "";
    token = "";
  }
}

async function readJson(response, label) {
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${label} returned invalid JSON (HTTP ${response.status}).`);
  }
  if (!response.ok) {
    throw new Error(`${label} failed (HTTP ${response.status}): ${body?.message || response.statusText}`);
  }
  return body;
}

function assertApprovedTarget(url) {
  if (containerLocal) {
    if (
      url.protocol !== "http:"
      || url.hostname !== CONTAINER_TARGET_HOST
      || url.port !== "5000"
      || url.origin !== CONTAINER_TARGET_URL
    ) {
      throw new Error("Container-local mode permits only http://127.0.0.1:5000.");
    }
    return;
  }
  if (
    url.protocol !== "https:"
    || url.hostname !== EXTERNAL_TARGET_HOST
    || url.port
    || url.origin !== EXTERNAL_TARGET_URL
  ) {
    throw new Error("External staging execution requires the fixed trusted HTTPS endpoint.");
  }
}

async function stagingFetch(input, init = {}) {
  const url = input instanceof URL ? input : new URL(input);
  assertApprovedTarget(url);
  const response = await fetch(url, { ...init, redirect: "manual" });
  if (response.status >= 300 && response.status < 400) {
    throw new Error(`Staging API redirect rejected for ${url.pathname}.`);
  }
  return response;
}

async function verifyContainerBoundary() {
  if (!containerLocal) return;
  if (process.env.NODE_ENV !== "production") {
    throw new Error("Container-local mode requires NODE_ENV=production.");
  }
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
  if (!connectionString) {
    throw new Error("Container-local mode requires the staging PostgreSQL connection.");
  }
  const pool = new Pool({
    connectionString,
    ssl: process.env.POSTGRES_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    max: 1,
    connectionTimeoutMillis: 10000,
    statement_timeout: 10000,
    query_timeout: 10000,
  });
  try {
    const result = await pool.query(
      "select current_database() as database_name, current_user as database_user",
    );
    const boundary = result.rows[0];
    if (
      boundary?.database_name !== CONTAINER_DATABASE
      || boundary?.database_user !== CONTAINER_DATABASE_USER
    ) {
      throw new Error("Container database boundary verification failed.");
    }
  } finally {
    await pool.end();
  }

  const healthUrl = new URL("/api/health", TARGET_URL);
  const healthResponse = await stagingFetch(healthUrl, { cache: "no-store" });
  if (healthResponse.status !== 200) {
    throw new Error(`Container-local API health check failed (HTTP ${healthResponse.status}).`);
  }
}

async function resolveStagingCompany() {
  const target = new URL("/api/company/resolve-storefront", TARGET_URL);
  assertApprovedTarget(target);
  target.searchParams.set("host", "igroup.website");
  target.searchParams.set("path", "/icare");
  const company = await readJson(
    await stagingFetch(target, { cache: "no-store" }),
    "Storefront resolver",
  );
  if (
    company?.id !== COMPANY_ID
    || company?.slug !== COMPANY_ID
    || company?.status !== "active"
    || company?.storefrontPath !== "/icare"
  ) {
    throw new Error("The approved staging URL does not resolve to the active iCare storefront.");
  }
  return company;
}

async function login(loginPassword) {
  const response = await stagingFetch(`${TARGET_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Company-Id": COMPANY_ID,
    },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: loginPassword }),
  });
  const session = await readJson(response, "Staging iCare login");
  if (
    typeof session?.token !== "string"
    || session?.activeCompany?.id !== COMPANY_ID
    || session?.activeMembership?.role !== "company_admin"
  ) {
    throw new Error("Login did not return an iCare company_admin session.");
  }
  return session.token;
}

async function api(token, pathname, init = {}) {
  const url = new URL(pathname, TARGET_URL);
  assertApprovedTarget(url);
  if (url.hostname !== TARGET_HOST) throw new Error("Refusing a non-staging API target.");
  const headers = new Headers(init.headers);
  headers.set("X-Company-Id", COMPANY_ID);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await stagingFetch(url, { ...init, headers, cache: "no-store" });
  if (response.status === 204) return null;
  return readJson(response, pathname);
}

function assertExactRecord(actual, expected, type) {
  if (!actual) throw new Error(`Expected staging test ${type} ${expected.id} was not found.`);
  if (actual.id !== expected.id || actual.slug !== expected.slug || localizedEnglish(actual.name) !== expected.name) {
    throw new Error(`The staging test ${type} identity did not match exactly; cleanup aborted.`);
  }
}

async function cleanupTestRecords(token) {
  const [products, categories, brands] = await Promise.all([
    api(token, "/api/products"),
    api(token, "/api/categories"),
    api(token, "/api/brands"),
  ]);
  const product = products.find((entry) => entry.id === TEST_RECORDS.product.id);
  const category = categories.find((entry) => entry.id === TEST_RECORDS.category.id);
  const brand = brands.find((entry) => entry.id === TEST_RECORDS.brand.id);
  if (!product && !category && !brand) {
    report.cleanup.push({ type: "all", status: "already-removed" });
    return;
  }
  if (product) assertExactRecord(product, TEST_RECORDS.product, "product");
  if (category) assertExactRecord(category, TEST_RECORDS.category, "category");
  if (brand) assertExactRecord(brand, TEST_RECORDS.brand, "brand");
  if (product && (!category || !brand || product.categoryId !== category.id || product.brandId !== brand.id)) {
    throw new Error("The staging test product no longer references the expected test category and brand.");
  }
  const otherCategoryReferences = products.filter(
    (entry) => entry.id !== product?.id && entry.categoryId === TEST_RECORDS.category.id,
  );
  const otherBrandReferences = products.filter(
    (entry) => entry.id !== product?.id && entry.brandId === TEST_RECORDS.brand.id,
  );
  if (otherCategoryReferences.length || otherBrandReferences.length) {
    throw new Error("A migrated product references an original test category or brand; cleanup aborted.");
  }

  if (product) {
    await api(token, `/api/products/${encodeURIComponent(product.id)}`, { method: "DELETE" });
    report.cleanup.push({ type: "product", id: product.id });
  }
  if (category) {
    await api(token, `/api/categories/${encodeURIComponent(category.id)}`, { method: "DELETE" });
    report.cleanup.push({ type: "category", id: category.id });
  }
  if (brand) {
    await api(token, `/api/brands/${encodeURIComponent(brand.id)}`, { method: "DELETE" });
    report.cleanup.push({ type: "brand", id: brand.id });
  }
}

function legacyUrl(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value, `https://${LEGACY_HOST}`);
    if (url.hostname.toLowerCase() !== LEGACY_HOST) return "";
    if (!LEGACY_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) return "";
    return url.toString();
  } catch {
    return "";
  }
}

function candidateUrls(source) {
  const url = new URL(source);
  const filename = path.posix.basename(url.pathname);
  const candidates = [
    source,
    `https://${LEGACY_HOST}/uploads/${filename}`,
    `https://${LEGACY_HOST}/public/uploads/${filename}`,
    `https://${LEGACY_HOST}/storage/icare/uploads/${filename}`,
  ];
  return [...new Set(candidates)];
}

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function downloadCandidate(url) {
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: "follow",
        signal: AbortSignal.timeout(45000),
        headers: {
          Accept: "image/avif,image/webp,image/png,image/jpeg,image/gif,*/*;q=0.5",
          "User-Agent": "iCare-Staging-Migration/1.0",
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = String(response.headers.get("content-type") || "").split(";")[0].toLowerCase();
      if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(contentType)) {
        throw new Error(`unsupported content type ${contentType || "unknown"}`);
      }
      const data = Buffer.from(await response.arrayBuffer());
      if (!data.length || data.length > 8 * 1024 * 1024) {
        throw new Error(`invalid image size ${data.length}`);
      }
      return { data, contentType, sourceUrl: url };
    } catch (error) {
      lastError = error;
      if (attempt < 3) await delay(attempt * 1500);
    }
  }
  throw lastError || new Error("download failed");
}

async function recoverImage(source) {
  let lastError = null;
  for (const candidate of candidateUrls(source)) {
    try {
      return await downloadCandidate(candidate);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("No recoverable legacy image candidate.");
}

function extensionFor(contentType) {
  return ({
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
  })[contentType] || ".jpg";
}

async function uploadImage(token, source, recovered) {
  const originalName = path.posix.basename(new URL(source).pathname).replace(/[^a-zA-Z0-9._-]/g, "-");
  const filename = originalName && path.extname(originalName)
    ? originalName
    : `icare-migrated${extensionFor(recovered.contentType)}`;
  const form = new FormData();
  form.append("file", new Blob([recovered.data], { type: recovered.contentType }), filename);
  const uploaded = await api(token, "/api/uploads", { method: "POST", body: form });
  const url = uploaded?.url || uploaded?.path;
  if (typeof url !== "string" || !url) throw new Error("Staging upload returned no URL.");
  if (!url.includes("/icare/")) {
    throw new Error("Staging upload did not return an iCare-specific storage path.");
  }
  return url;
}

async function migrateImages(token) {
  const [products, categories, brands, mediaResponse] = await Promise.all([
    api(token, "/api/products"),
    api(token, "/api/categories"),
    api(token, "/api/brands"),
    api(token, "/api/website-media/all"),
  ]);
  const media = Array.isArray(mediaResponse) ? mediaResponse : mediaResponse?.items || [];
  const migrated = new Map();

  async function migratedUrl(source, entity) {
    const normalized = legacyUrl(source);
    if (!normalized) return source;
    report.images.discovered += 1;
    if (migrated.has(normalized)) {
      report.images.reused += 1;
      return migrated.get(normalized);
    }
    try {
      const recovered = await recoverImage(normalized);
      const uploaded = await uploadImage(token, normalized, recovered);
      migrated.set(normalized, uploaded);
      report.images.uploaded += 1;
      return uploaded;
    } catch (error) {
      migrated.set(normalized, "");
      report.images.failed.push({ entity, sourceUrl: normalized, error: error.message });
      return "";
    }
  }

  for (const category of categories) {
    const current = legacyUrl(category.imageUrl);
    if (!current) continue;
    const imageUrl = await migratedUrl(current, `category:${category.id}`);
    await api(token, `/api/categories/${encodeURIComponent(category.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ imageUrl: imageUrl || null }),
    });
    report.updates.categories += 1;
    if (!imageUrl) report.images.cleared += 1;
  }

  for (const brand of brands) {
    const current = legacyUrl(brand.logoUrl);
    if (!current) continue;
    const logoUrl = await migratedUrl(current, `brand:${brand.id}`);
    await api(token, `/api/brands/${encodeURIComponent(brand.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ logoUrl: logoUrl || null }),
    });
    report.updates.brands += 1;
    if (!logoUrl) report.images.cleared += 1;
  }

  for (const item of media) {
    const current = legacyUrl(item.imageUrl) || legacyUrl(item.fallbackImageUrl);
    if (!current && !/placeholder\.com/i.test(String(item.imageUrl || item.fallbackImageUrl || ""))) continue;
    const imageUrl = current ? await migratedUrl(current, `website-media:${item.id}`) : "";
    await api(token, `/api/website-media/${encodeURIComponent(item.id)}`, {
      method: "PUT",
      body: JSON.stringify({
        ...item,
        imageUrl,
        fallbackImageUrl: "",
      }),
    });
    report.updates.websiteMedia += 1;
    if (!imageUrl) report.images.cleared += 1;
  }

  for (const product of products) {
    let changed = false;
    const gallerySource = Array.isArray(product.gallery_images) ? product.gallery_images : [];
    const nextGallery = [];
    for (const [index, entry] of gallerySource.entries()) {
      const source = legacyUrl(entry?.image_url || entry?.image || entry?.url);
      if (!source) {
        nextGallery.push(entry);
        continue;
      }
      const imageUrl = await migratedUrl(source, `product:${product.id}:gallery:${entry.id || index}`);
      changed = true;
      if (imageUrl) nextGallery.push({ ...entry, image_url: imageUrl });
      else report.images.cleared += 1;
    }

    const variants = Array.isArray(product.variants) ? product.variants : [];
    const nextVariants = [];
    for (const [index, variant] of variants.entries()) {
      const source = legacyUrl(variant?.image_url || variant?.imageUrl || variant?.image);
      if (!source) {
        nextVariants.push(variant);
        continue;
      }
      const imageUrl = await migratedUrl(source, `product:${product.id}:variant:${variant.id || index}`);
      changed = true;
      nextVariants.push({ ...variant, image_url: imageUrl });
      if (!imageUrl) report.images.cleared += 1;
    }

    const primarySource = legacyUrl(product.image || product.primaryImage);
    const hoverSource = legacyUrl(product.hoverImage || product.secondaryImage);
    let primary = primarySource
      ? await migratedUrl(primarySource, `product:${product.id}:primary`)
      : product.image || product.primaryImage || "";
    const hover = hoverSource
      ? await migratedUrl(hoverSource, `product:${product.id}:hover`)
      : product.hoverImage || product.secondaryImage || "";
    changed ||= Boolean(primarySource || hoverSource);
    if (!primary && primarySource) {
      primary = nextGallery[0]?.image_url
        || nextVariants.find((variant) => variant.image_url)?.image_url
        || "";
      if (!primary) {
        report.images.failed.push({
          entity: `product:${product.id}:primary`,
          sourceUrl: primarySource,
          error: "No recovered gallery or variant image was available; product update skipped to avoid retaining or replacing with a placeholder.",
        });
        continue;
      }
      report.images.cleared += 1;
    }
    if (!changed) continue;

    await api(token, `/api/products/${encodeURIComponent(product.id)}`, {
      method: "PUT",
      body: JSON.stringify({
        ...product,
        id: product.id,
        image: primary,
        hoverImage: hover,
        variants: nextVariants,
        gallery_images: nextGallery,
        clearGalleryImages: gallerySource.length > 0 && nextGallery.length === 0,
      }),
    });
    report.updates.products += 1;
  }
}

async function verify(token) {
  const [products, categories, brands, texts, mediaResponse, orders, employees, workSessions] = await Promise.all([
    api(token, "/api/products"),
    api(token, "/api/categories"),
    api(token, "/api/brands"),
    api(token, "/api/admin/website-texts"),
    api(token, "/api/website-media/all"),
    api(token, "/api/orders"),
    api(token, "/api/employees"),
    api(token, "/api/work-sessions/employees"),
  ]);
  const media = Array.isArray(mediaResponse) ? mediaResponse : mediaResponse?.items || [];
  const counts = {
    categories: categories.length,
    brands: brands.length,
    products: products.length,
    websiteTexts: texts.length,
    websiteMedia: media.length,
  };
  for (const [key, expected] of Object.entries(EXPECTED_COUNTS)) {
    if (counts[key] !== expected) throw new Error(`Final ${key} count is ${counts[key]}, expected ${expected}.`);
  }
  if (
    products.some((entry) => entry.id === TEST_RECORDS.product.id)
    || categories.some((entry) => entry.id === TEST_RECORDS.category.id)
    || brands.some((entry) => entry.id === TEST_RECORDS.brand.id)
  ) {
    throw new Error("One or more original staging test records remain.");
  }
  const categoryIds = new Set(categories.map((entry) => entry.id));
  const brandIds = new Set(brands.map((entry) => entry.id));
  for (const product of products) {
    if (product.categoryId && !categoryIds.has(product.categoryId)) {
      throw new Error(`Product ${product.id} has an invalid category link.`);
    }
    if (product.brandId && !brandIds.has(product.brandId)) {
      throw new Error(`Product ${product.id} has an invalid brand link.`);
    }
    if (!Array.isArray(product.variants) || !Array.isArray(product.gallery_images)) {
      throw new Error(`Product ${product.id} lost variant or gallery collections.`);
    }
  }
  const serialized = JSON.stringify({ products, categories, brands, media });
  if (/backend\.igroup\.website|placeholder\.com/i.test(serialized)) {
    throw new Error("Legacy or placeholder image URLs remain after finalization.");
  }
  report.counts = counts;
  report.smoke = {
    cpanelCatalog: true,
    orders: Array.isArray(orders),
    employees: Array.isArray(employees),
    workSessions: Array.isArray(workSessions),
    variantsAndGalleriesLinked: true,
  };

  const forged = await stagingFetch(`${TARGET_URL}/api/products`, {
    headers: {
      "X-Company-Id": "eb-chemical",
      Authorization: `Bearer ${token}`,
    },
  });
  if (forged.status !== 401 && forged.status !== 403) {
    throw new Error(`Cross-tenant JWT/header attempt returned HTTP ${forged.status}.`);
  }
  report.smoke.forgedCompanyHeaderRejected = true;
}

async function main() {
  await verifyContainerBoundary();
  await resolveStagingCompany();
  if (verifyBoundaryOnly) {
    console.log("Container-local staging boundary verified.");
    return;
  }
  await authenticateBeforeMutation({
    passwordValue: password,
    authenticate: async (loginPassword) => {
      const token = await login(loginPassword);
      password = "";
      return token;
    },
    mutate: async (token) => {
      await cleanupTestRecords(token);
      await migrateImages(token);
      await verify(token);
      console.log(JSON.stringify({ ok: true, ...report }, null, 2));
    },
  });
  password = "";
}

const isMain = Boolean(process.argv[1])
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((error) => {
    password = "";
    console.error(JSON.stringify({ ok: false, error: error.message, report }, null, 2));
    process.exitCode = 1;
  });
}
