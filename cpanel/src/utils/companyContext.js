import { resolveApiAssetUrl } from "./api.js";

const companyStorageKey = "cpanelActiveCompany";
const tenantCachePrefixes = [
  "ebAdmin",
  "cpanelTenant:",
  "websiteMedia",
  "website_media",
  "epWebsiteMedia",
  "epChemicalWebsiteMedia",
];

function safeUrl(value) {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (/^\/(?!\/)/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

export function sanitizeCompanyContext(company) {
  if (!company || typeof company !== "object") return null;
  const settings = company.settings && typeof company.settings === "object"
    ? company.settings
    : {};
  const id = String(company.id || "").trim().toLowerCase();
  const slug = String(company.slug || "").trim().toLowerCase();
  if (!id || !slug) return null;

  const modules = Array.isArray(company.modules)
    ? company.modules.filter((module) => module && typeof module === "object" && module.enabled !== false).map((module) => ({
      module_key: String(module.module_key || ""),
      group_key: String(module.group_key || ""),
      label_en: String(module.label_en || ""),
      label_ar: String(module.label_ar || ""),
      description_en: String(module.description_en || ""),
      description_ar: String(module.description_ar || ""),
      icon_key: String(module.icon_key || ""),
      route: String(module.route || ""),
      sort_order: Number(module.sort_order || 0),
      enabled: true,
      configuration: module.configuration && typeof module.configuration === "object"
        ? module.configuration
        : {},
    })).filter((module) => module.module_key && module.route)
    : [];

  return {
    id,
    slug,
    name: String(company.name || slug).trim(),
    isDefault: company.isDefault === true,
    logoUrl: resolveApiAssetUrl(safeUrl(company.logoUrl ?? settings.logoUrl)),
    faviconUrl: resolveApiAssetUrl(safeUrl(company.faviconUrl ?? settings.faviconUrl)),
    storefrontUrl: safeUrl(company.storefrontUrl ?? settings.storefrontUrl),
    storefrontPath: String(company.storefrontPath ?? settings.storefrontPath ?? ""),
    modules,
    settings: {
      currency: typeof settings.currency === "string" ? settings.currency : null,
      direction: ["ltr", "rtl"].includes(settings.direction) ? settings.direction : null,
      language: typeof settings.language === "string" ? settings.language : null,
      locale: typeof settings.locale === "string" ? settings.locale : null,
      theme: settings.theme && typeof settings.theme === "object" ? settings.theme : {},
    },
  };
}

export function getStoredCompanyContext() {
  try {
    return sanitizeCompanyContext(JSON.parse(localStorage.getItem(companyStorageKey) || "null"));
  } catch {
    return null;
  }
}

export function setStoredCompanyContext(company) {
  const safeCompany = sanitizeCompanyContext(company);
  if (safeCompany) {
    localStorage.setItem(companyStorageKey, JSON.stringify(safeCompany));
  } else {
    localStorage.removeItem(companyStorageKey);
  }
  return safeCompany;
}

export function clearTenantCaches() {
  if (typeof localStorage === "undefined") return;
  for (const key of Object.keys(localStorage)) {
    if (tenantCachePrefixes.some((prefix) => key.startsWith(prefix))) {
      localStorage.removeItem(key);
    }
  }
  if (typeof sessionStorage !== "undefined") {
    for (const key of Object.keys(sessionStorage)) {
      if (tenantCachePrefixes.some((prefix) => key.startsWith(prefix))) {
        sessionStorage.removeItem(key);
      }
    }
  }
}

export function tenantStorageKey(companyId, key) {
  const safeCompanyId = String(companyId || "").trim().toLowerCase();
  return safeCompanyId ? `cpanelTenant:${safeCompanyId}:${key}` : "";
}

export function applyCompanyDocumentBranding(company) {
  if (typeof document === "undefined") return;
  const safeCompany = sanitizeCompanyContext(company);
  document.title = safeCompany?.name
    ? `${safeCompany.name} CPanel`
    : "Company CPanel";
  const description = safeCompany?.name
    ? `${safeCompany.name} administration portal.`
    : "Company administration portal.";
  let descriptionMeta = document.querySelector('meta[name="description"]');
  if (!descriptionMeta) {
    descriptionMeta = document.createElement("meta");
    descriptionMeta.name = "description";
    document.head.appendChild(descriptionMeta);
  }
  descriptionMeta.content = description;

  let favicon = document.querySelector('link[data-cpanel-favicon="true"]');
  if (!safeCompany?.faviconUrl) {
    favicon?.remove();
    return;
  }
  if (!favicon) {
    favicon = document.createElement("link");
    favicon.rel = "icon";
    favicon.dataset.cpanelFavicon = "true";
    document.head.appendChild(favicon);
  }
  favicon.href = safeCompany.faviconUrl;
}
