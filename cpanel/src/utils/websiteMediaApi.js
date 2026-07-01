import { defaultWebsiteMedia } from "../data/websiteMedia.js";
import { apiRequest } from "./api.js";

const websiteMediaCacheKeys = [
  "websiteMedia",
  "website_media",
  "epWebsiteMedia",
  "epChemicalWebsiteMedia",
  "epChemicalWebsiteMediaCache",
];

function stripFallbackImage(item) {
  return {
    ...item,
    fallbackImageUrl: item.fallbackImageUrl || item.imageUrl || "",
    imageUrl: "",
  };
}

function defaultWebsiteMediaDefinitions() {
  return defaultWebsiteMedia.map(stripFallbackImage);
}

export function clearWebsiteMediaCache() {
  if (typeof window === "undefined") return;

  websiteMediaCacheKeys.forEach((key) => {
    window.localStorage?.removeItem(key);
    window.sessionStorage?.removeItem(key);
  });
}

export async function fetchWebsiteMedia() {
  try {
    clearWebsiteMediaCache();
    return await apiRequest("/website-media", { cache: "no-store" });
  } catch {
    return defaultWebsiteMediaDefinitions();
  }
}

export function fetchAllWebsiteMedia() {
  clearWebsiteMediaCache();
  return apiRequest("/website-media/all", { cache: "no-store" });
}

export function fetchWebsiteMediaSection(sectionKey) {
  clearWebsiteMediaCache();
  return apiRequest(`/website-media/${encodeURIComponent(sectionKey)}`, { cache: "no-store" });
}

export async function saveWebsiteMedia(item) {
  const saved = await apiRequest(item.id ? `/website-media/${item.id}` : "/website-media", {
    method: item.id ? "PUT" : "POST",
    body: JSON.stringify(item),
  });
  clearWebsiteMediaCache();
  return saved;
}

export async function deleteWebsiteMedia(id) {
  const result = await apiRequest(`/website-media/${id}`, { method: "DELETE" });
  clearWebsiteMediaCache();
  return result;
}
