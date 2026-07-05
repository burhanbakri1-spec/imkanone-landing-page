export const DEFAULT_COMPANY_ID = "eb-chemical";
export const DEFAULT_COMPANY_DOMAIN = "ebchemi.com";
export const COMPANY_STATUSES = Object.freeze(["draft", "inactive", "active"]);
export const ADMIN_MODULE_KEYS = Object.freeze([
  "dashboard",
  "products",
  "categories",
  "orders",
  "customers",
  "employees",
  "website_media",
  "homepage_content",
  "settings",
  "custom_modules",
  "reports",
  "activity_log",
  "invoices",
  "delivery",
]);

const adminModuleKeys = new Set(ADMIN_MODULE_KEYS);

const publicSettingKeys = new Set([
  "currency",
  "adminModules",
  "direction",
  "faviconUrl",
  "language",
  "locale",
  "logoUrl",
  "socialLinks",
  "supportEmail",
  "supportPhone",
]);

const privateContextKeys = new Set([
  "accesstoken",
  "apikey",
  "company_id",
  "companyid",
  "databasepassword",
  "databaseurl",
  "memberships",
  "password",
  "permissions",
  "privatekey",
  "refreshtoken",
  "secret",
  "servicekey",
  "service_role_key",
  "servicerolekey",
  "tenant_id",
  "tenantid",
  "token",
  "users",
]);

export const defaultCompany = Object.freeze({
  id: DEFAULT_COMPANY_ID,
  slug: DEFAULT_COMPANY_ID,
  name: "EB Chemical",
  status: "active",
  isDefault: true,
  domain: DEFAULT_COMPANY_DOMAIN,
  publicSettings: Object.freeze({}),
});

export function normalizeCompanyId(companyId) {
  return typeof companyId === "string" && companyId.trim()
    ? companyId.trim()
    : DEFAULT_COMPANY_ID;
}

export function normalizeCompanySlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
}

export function isSafeCompanySlug(value) {
  const input = String(value || "").trim();
  return input === input.toLowerCase() && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input);
}

export function normalizeCompanyHost(value) {
  const firstValue = Array.isArray(value) ? value[0] : String(value || "").split(",")[0];
  const input = String(firstValue || "").trim().slice(0, 2048);
  if (!input) return "";

  let hostname = "";
  try {
    const url = new URL(input.includes("://") ? input : `http://${input}`);
    hostname = url.hostname;
  } catch {
    hostname = input
      .replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
      .split(/[/?#]/, 1)[0]
      .replace(/^\[|\]$/g, "")
      .replace(/:\d+$/, "");
  }

  return hostname
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "")
    .replace(/^www\./, "");
}

function normalizeDisplayDomain(value) {
  const firstValue = Array.isArray(value) ? value[0] : String(value || "").split(",")[0];
  const input = String(firstValue || "").trim().slice(0, 2048);
  if (!input) return "";

  try {
    return new URL(input.includes("://") ? input : `http://${input}`).hostname
      .trim()
      .toLowerCase()
      .replace(/\.$/, "");
  } catch {
    return input
      .replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
      .split(/[/?#]/, 1)[0]
      .replace(/:\d+$/, "")
      .trim()
      .toLowerCase()
      .replace(/\.$/, "");
  }
}

function domainPreference(entry) {
  const domain = normalizeDisplayDomain(typeof entry === "string" ? entry : entry?.domain);
  let score = 20;
  if (domain === "ebchemi.com") score = 0;
  else if (domain === "www.ebchemi.com") score = 1;
  else if (domain.startsWith("www.")) score = 21;
  else if (domain.startsWith("api.")) score = 80;
  else if (domain.endsWith(".vercel.app")) score = 100;

  score *= 100;
  if (typeof entry === "object" && entry?.is_active === false) score += 100000;
  if (typeof entry === "object" && entry?.is_primary === true) score -= 2;
  return score;
}

export function selectPreferredCompanyDomains(entries = []) {
  const unique = new Map();
  for (const entry of Array.isArray(entries) ? entries : []) {
    const domain = normalizeDisplayDomain(typeof entry === "string" ? entry : entry?.domain);
    if (!domain || unique.has(domain)) continue;
    unique.set(domain, typeof entry === "string" ? { domain } : { ...entry, domain });
  }
  return [...unique.values()].sort((a, b) => domainPreference(a) - domainPreference(b));
}

function clonePublicValue(value) {
  if (Array.isArray(value)) return value.map(clonePublicValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !privateContextKeys.has(key.toLowerCase()))
      .map(([key, entry]) => [key, clonePublicValue(entry)]),
  );
}

function publicSettingsFor(company) {
  const source = company?.settings || company?.publicSettings;
  if (!source || typeof source !== "object" || Array.isArray(source)) return {};
  return Object.fromEntries(
    Object.entries(source)
      .filter(([key]) => publicSettingKeys.has(key))
      .map(([key, value]) => [
        key,
        key === "adminModules"
          ? Object.fromEntries(
              Object.entries(value && typeof value === "object" && !Array.isArray(value) ? value : {})
                .filter(([moduleKey, enabled]) => adminModuleKeys.has(moduleKey) && typeof enabled === "boolean"),
            )
          : clonePublicValue(value),
      ]),
  );
}

export function createPublicCompanyContext(company = defaultCompany, options = {}) {
  const source = company && typeof company === "object" ? company : defaultCompany;
  const requestHost = normalizeCompanyHost(options.host);
  return {
    id: String(source.id || DEFAULT_COMPANY_ID),
    slug: String(source.slug || DEFAULT_COMPANY_ID),
    name: String(source.name || defaultCompany.name),
    status: String(source.status || defaultCompany.status),
    isDefault: source.id === DEFAULT_COMPANY_ID || source.isDefault === true,
    domain: requestHost || normalizeCompanyHost(source.domain) || DEFAULT_COMPANY_DOMAIN,
    settings: publicSettingsFor(source),
  };
}

export function createPlatformCompanySummary(company = defaultCompany) {
  const source = company && typeof company === "object" ? company : defaultCompany;
  const context = createPublicCompanyContext(source);
  const preferredDomains = selectPreferredCompanyDomains([
    ...(Array.isArray(source.domains) ? source.domains : []),
    source.domain,
  ]);
  return {
    ...context,
    isDefault: source.id === DEFAULT_COMPANY_ID || source.isDefault === true,
    domain: preferredDomains[0]?.domain || normalizeCompanyHost(source.domain),
    domains: preferredDomains.map((entry) => entry.domain),
    settings: publicSettingsFor(source),
    createdAt: source.createdAt || null,
    updatedAt: source.updatedAt || null,
  };
}

export function sanitizePublicCompanySettings(settings) {
  return publicSettingsFor({ settings });
}

export function companyStorageSegment(companyId) {
  const normalized = normalizeCompanyId(companyId).toLowerCase();
  const segment = normalized
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
  return segment || DEFAULT_COMPANY_ID;
}

export function companyStoragePath(companyId, ...parts) {
  return [companyStorageSegment(companyId), ...parts.filter(Boolean)].join("/");
}
