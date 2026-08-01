import { SiteEditorValidationError } from "./schema.js";
import {
  assertManifestMatchesCompany,
  connectionSummary,
  fetchSiteManifest,
  normalizeWebsiteConnectionPatch,
  validateConnectionUrl,
  websiteConnectionDefaults,
  websiteConnectionSettings,
} from "./websiteConnection.js";
import { MANIFEST_SCHEMA_VERSION } from "./siteManifest.js";
import { buildLegacyIcareManifest, supportsLegacyIcare } from "./icareLegacyManifestProvider.js";

function siteConnectionError(message, code = "SITE_NOT_CONNECTED", statusCode = 409) {
  return new SiteEditorValidationError(message, statusCode, code);
}

export function connectedManifest(company) {
  if (!company) return null;
  const connection = websiteConnectionSettings(company);
  if (connection?.connectionStatus === "connected" && connection.lastManifest && connection.lastManifest.pages?.length) {
    return { manifest: connection.lastManifest, source: "remote" };
  }
  return null;
}

export function manifestForCompany(company) {
  if (!company) return null;
  const connected = connectedManifest(company);
  if (connected) return connected;
  if (supportsLegacyIcare(company)) {
    const manifest = buildLegacyIcareManifest(company);
    if (manifest) return { manifest, source: "legacy" };
  }
  return null;
}

export function requireManifestForCompany(company) {
  const resolved = manifestForCompany(company);
  if (!resolved) {
    throw siteConnectionError(
      "This company does not have a connected website. Configure a site manifest before editing.",
      "SITE_NOT_CONNECTED",
      409,
    );
  }
  return resolved;
}

export async function syncManifestForCompany(company, options = {}) {
  if (!company) throw siteConnectionError("A trusted company is required.");
  const connection = websiteConnectionSettings(company) || websiteConnectionDefaults(company);
  const manifestUrl = options.url || connection.siteManifestUrl;

  if (manifestUrl && String(manifestUrl).trim()) {
    const manifest = await fetchSiteManifest(manifestUrl);
    assertManifestMatchesCompany(manifest, company);
    return {
      manifest,
      source: "remote",
      syncedAt: new Date().toISOString(),
      siteManifestUrl: validateConnectionUrl(manifestUrl, "siteManifestUrl"),
    };
  }

  if (supportsLegacyIcare(company)) {
    const manifest = buildLegacyIcareManifest(company);
    if (manifest) {
      return {
        manifest,
        source: "legacy",
        syncedAt: new Date().toISOString(),
        siteManifestUrl: "",
      };
    }
  }

  throw siteConnectionError(
    "No site manifest URL is configured and no legacy manifest provider is available for this company.",
    "SITE_NOT_CONNECTED",
    409,
  );
}

export async function validateManifestForCompany(company, options = {}) {
  if (!company) throw siteConnectionError("A trusted company is required.");
  const connection = websiteConnectionSettings(company) || websiteConnectionDefaults(company);
  const manifestUrl = options.url || connection.siteManifestUrl;
  if (!manifestUrl || !String(manifestUrl).trim()) {
    throw siteConnectionError("A site manifest URL is required to validate the connection.", "MANIFEST_URL_REQUIRED", 400);
  }
  const normalizedUrl = validateConnectionUrl(manifestUrl, "siteManifestUrl");
  const manifest = await fetchSiteManifest(normalizedUrl);
  assertManifestMatchesCompany(manifest, company);
  return {
    valid: true,
    siteManifestUrl: normalizedUrl,
    schemaVersion: manifest.schemaVersion,
    companyId: manifest.companyId,
    siteId: manifest.siteId,
    siteName: manifest.siteName,
    pageCount: manifest.pages.length,
    supportedLocales: manifest.supportedLocales,
    defaultLocale: manifest.defaultLocale,
    generatedAt: manifest.generatedAt,
  };
}

export function manifestRoute(manifest, pageId) {
  return (manifest?.pages || []).find((page) => page.id === pageId) || null;
}

export { connectionSummary, normalizeWebsiteConnectionPatch, MANIFEST_SCHEMA_VERSION };
