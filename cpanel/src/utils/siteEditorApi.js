import { apiRequest } from "./api.js";

export async function fetchSiteEditorConnection() {
  const payload = await apiRequest("/site-editor/connection", { cache: "no-store" });
  if (!payload || typeof payload !== "object") throw new TypeError("Site editor connection is invalid.");
  return payload;
}

export async function updateSiteEditorConnection(patch) {
  return apiRequest("/site-editor/connection", {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

export async function validateSiteEditorConnection(siteManifestUrl) {
  return apiRequest("/site-editor/connection/validate", {
    method: "POST",
    body: JSON.stringify({ siteManifestUrl }),
  });
}

export async function syncSiteEditorManifest(siteManifestUrl) {
  return apiRequest("/site-editor/manifest/sync", {
    method: "POST",
    body: JSON.stringify({ siteManifestUrl }),
  });
}

export async function fetchSiteEditorPages(locale = "en") {
  const payload = await apiRequest(`/site-editor/pages?locale=${encodeURIComponent(locale)}`, { cache: "no-store" });
  if (!payload || !Array.isArray(payload.items)) throw new TypeError("Site editor page list is invalid.");
  return payload.items;
}

export async function fetchSiteEditorDocument(pageId, locale = "en") {
  const payload = await apiRequest(`/site-editor/pages/${encodeURIComponent(pageId)}?locale=${encodeURIComponent(locale)}`, { cache: "no-store" });
  if (!payload?.document) throw new TypeError("Site editor page document is invalid.");
  return payload.document;
}

export async function saveSiteEditorDraft(pageId, document, revision) {
  return apiRequest(`/site-editor/pages/${encodeURIComponent(pageId)}/draft`, {
    method: "PUT",
    body: JSON.stringify({ document, revision }),
  });
}
