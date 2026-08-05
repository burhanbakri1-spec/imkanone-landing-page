import { SiteEditorValidationError } from "./schema.js";

/**
 * siteDesignManifest.js — Phase 1 manifest validation for the generic
 * multi-tenant Site Design feature.
 *
 * This module is intentionally limited to themes and colors. Typography,
 * page backgrounds, page transitions, font upload, and arbitrary CSS remain
 * unsupported. The schema mirrors the CPanel's allowlist of design color
 * tokens so the validated payload maps 1:1 to the editor preview variables.
 *
 * The function is fully backward compatible: when `siteDesign` is absent from
 * the storefront manifest, `normalizeSiteDesign` returns null.
 */

export const SITE_DESIGN_VERSION = "1";
export const MAX_THEMES = 20;
export const MAX_PREVIEW_SWATCHES = 8;
export const SITE_DESIGN_COLOR_GROUPS = Object.freeze({
  base: Object.freeze(["primaryBackground", "secondaryBackground"]),
  general: Object.freeze(["linesAndDividers"]),
  accent: Object.freeze(["primary", "secondary", "tertiary", "quaternary"]),
  text: Object.freeze(["titles", "subtitles", "body", "secondary", "linksAndActions"]),
});
export const SITE_DESIGN_BUTTON_KEYS = Object.freeze(["background", "border", "text"]);
export const SITE_DESIGN_CAPABILITIES = Object.freeze([
  "themes",
  "colors",
  "typography",
  "pageBackgrounds",
  "pageTransitions",
]);
export const SITE_DESIGN_TOP_LEVEL_KEYS = Object.freeze([
  "version",
  "capabilities",
  "defaultThemeId",
  "themePresets",
]);
export const SITE_DESIGN_PRESET_KEYS = Object.freeze([
  "themeId",
  "name",
  "description",
  "previewSwatches",
  "colorTheme",
]);
export const SITE_DESIGN_BUTTON_GROUPS = Object.freeze(["primary", "secondary"]);

const THEME_ID_PATTERN = /^[a-z0-9][a-z0-9:_-]{0,159}$/i;
const VERSION_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,31}$/i;
const HEX_PATTERN = /^#[0-9a-f]{6}$/i;
const UNSAFE_MARKUP = /<\s*\/?\s*(?:script|iframe|object|embed|style|link|meta)|\bon\w+\s*=|javascript\s*:|data\s*:\s*text\/html/i;

function designError(message, code = "SITE_DESIGN_INVALID", statusCode = 400) {
  return new SiteEditorValidationError(message, statusCode, code);
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function rejectUnknownKeys(object, allowedKeys, field) {
  for (const key of Object.keys(object)) {
    if (!allowedKeys.includes(key)) throw designError(`Unknown ${field} property: ${key}.`);
  }
}

function safeThemeId(value, field) {
  const result = String(value ?? "").trim();
  if (!THEME_ID_PATTERN.test(result)) throw designError(`${field} is invalid.`);
  return result;
}

function localizedDesignText(value, field) {
  if (!isRecord(value)) throw designError(`${field} must be a localized object.`);
  const en = String(value.en ?? "").replace(/\u0000/g, "").trim().slice(0, 500);
  const ar = String(value.ar ?? "").replace(/\u0000/g, "").trim().slice(0, 500);
  if (!en && !ar) throw designError(`${field} must contain at least one non-empty language value.`);
  if (UNSAFE_MARKUP.test(`${en} ${ar}`) || /<[^>]+>/.test(`${en} ${ar}`)) {
    throw designError(`${field} must contain plain text only.`);
  }
  return { en, ar };
}

function normalizeHexColor(value, field) {
  if (typeof value !== "string") throw designError(`${field} must be a valid six-digit hex color.`);
  const candidate = value.trim().toLowerCase();
  if (!HEX_PATTERN.test(candidate)) throw designError(`${field} must be a valid six-digit hex color.`);
  return candidate;
}

function normalizeColorGroup(group, allowedKeys, field) {
  if (!isRecord(group)) throw designError(`${field} must be a color object.`);
  rejectUnknownKeys(group, allowedKeys, field);
  const normalized = {};
  for (const key of allowedKeys) {
    if (!Object.hasOwn(group, key)) throw designError(`${field}.${key} is required.`);
    normalized[key] = normalizeHexColor(group[key], `${field}.${key}`);
  }
  return normalized;
}

function normalizeButtonColors(button, field) {
  if (!isRecord(button)) throw designError(`${field} must be a button color object.`);
  return normalizeColorGroup(button, SITE_DESIGN_BUTTON_KEYS, field);
}

function normalizeColorTheme(colorTheme) {
  if (!isRecord(colorTheme)) throw designError("colorTheme must be an object.");
  const groups = Object.keys(SITE_DESIGN_COLOR_GROUPS);
  rejectUnknownKeys(colorTheme, [...groups, "buttons"], "colorTheme");
  const normalized = {};
  for (const [group, keys] of Object.entries(SITE_DESIGN_COLOR_GROUPS)) {
    normalized[group] = normalizeColorGroup(colorTheme[group], keys, `colorTheme.${group}`);
  }
  if (!isRecord(colorTheme.buttons)) throw designError("colorTheme.buttons must be an object.");
  rejectUnknownKeys(colorTheme.buttons, SITE_DESIGN_BUTTON_GROUPS, "colorTheme.buttons");
  normalized.buttons = {
    primary: normalizeButtonColors(colorTheme.buttons.primary, "colorTheme.buttons.primary"),
    secondary: normalizeButtonColors(colorTheme.buttons.secondary, "colorTheme.buttons.secondary"),
  };
  return normalized;
}

function normalizeCapabilities(capabilities) {
  const normalized = {
    themes: false,
    colors: false,
    typography: false,
    pageBackgrounds: false,
    pageTransitions: false,
  };
  if (capabilities == null) return normalized;
  if (!isRecord(capabilities)) throw designError("capabilities must be an object.");
  for (const key of Object.keys(capabilities)) {
    if (!SITE_DESIGN_CAPABILITIES.includes(key)) throw designError(`Unknown capability: ${key}.`);
  }
  for (const key of SITE_DESIGN_CAPABILITIES) {
    if (Object.hasOwn(capabilities, key)) {
      if (typeof capabilities[key] !== "boolean") throw designError(`capabilities.${key} must be a boolean.`);
      normalized[key] = capabilities[key];
    }
  }
  return normalized;
}

function normalizeThemePreset(preset, index) {
  if (!isRecord(preset)) throw designError(`themePresets[${index}] must be an object.`);
  rejectUnknownKeys(preset, SITE_DESIGN_PRESET_KEYS, `themePresets[${index}]`);
  const themeId = safeThemeId(preset.themeId, `themePresets[${index}].themeId`);
  const name = localizedDesignText(preset.name, `themePresets[${index}].name`);
  const description = preset.description != null
    ? localizedDesignText(preset.description, `themePresets[${index}].description`)
    : { en: "", ar: "" };
  let previewSwatches = [];
  if (preset.previewSwatches != null) {
    if (!Array.isArray(preset.previewSwatches)) throw designError(`themePresets[${index}].previewSwatches must be an array.`);
    if (preset.previewSwatches.length > MAX_PREVIEW_SWATCHES) {
      throw designError(`themePresets[${index}] declares too many preview swatches.`);
    }
    previewSwatches = preset.previewSwatches.map((swatch, swatchIndex) =>
      normalizeHexColor(swatch, `themePresets[${index}].previewSwatches[${swatchIndex}]`));
  }
  const colorTheme = normalizeColorTheme(preset.colorTheme);
  return { themeId, name, description, previewSwatches, colorTheme };
}

/**
 * Normalize and validate the Phase 1 `siteDesign` manifest section.
 * Returns null when the section is absent. Throws SiteEditorValidationError
 * on any unknown, unsafe, or malformed value.
 */
export function normalizeSiteDesign(input) {
  if (input == null) return null;
  if (!isRecord(input)) throw designError("siteDesign must be a JSON object.");
  rejectUnknownKeys(input, SITE_DESIGN_TOP_LEVEL_KEYS, "siteDesign");

  const version = String(input.version ?? "").trim();
  if (!version) throw designError("siteDesign.version is required.");
  if (!VERSION_PATTERN.test(version)) throw designError("siteDesign.version is invalid.");

  const capabilities = normalizeCapabilities(input.capabilities);

  const rawPresets = Array.isArray(input.themePresets) ? input.themePresets : [];
  if (rawPresets.length > MAX_THEMES) throw designError("siteDesign declares too many theme presets.");
  const themePresets = rawPresets.map((preset, index) => normalizeThemePreset(preset, index));

  const seenIds = new Set();
  for (const preset of themePresets) {
    if (seenIds.has(preset.themeId)) throw designError(`Duplicate theme id: ${preset.themeId}.`);
    seenIds.add(preset.themeId);
  }

  let defaultThemeId = "";
  if (input.defaultThemeId != null) {
    defaultThemeId = safeThemeId(input.defaultThemeId, "defaultThemeId");
    if (!seenIds.has(defaultThemeId)) throw designError(`defaultThemeId references an unknown theme: ${defaultThemeId}.`);
  } else if (themePresets.length > 0) {
    throw designError("defaultThemeId is required when theme presets are declared.");
  }

  return { version, capabilities, defaultThemeId, themePresets };
}