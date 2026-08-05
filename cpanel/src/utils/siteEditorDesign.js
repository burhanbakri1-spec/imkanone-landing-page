export const MAX_DESIGN_HISTORY = 30;

export const SITE_DESIGN_CSS_VARIABLES = Object.freeze([
  "--site-bg-primary",
  "--site-bg-secondary",
  "--site-divider",
  "--site-accent-primary",
  "--site-accent-secondary",
  "--site-accent-tertiary",
  "--site-accent-quaternary",
  "--site-title-color",
  "--site-subtitle-color",
  "--site-body-color",
  "--site-text-secondary",
  "--site-link-color",
  "--site-button-primary-bg",
  "--site-button-primary-border",
  "--site-button-primary-text",
  "--site-button-secondary-bg",
  "--site-button-secondary-border",
  "--site-button-secondary-text",
]);

export const SITE_DESIGN_COLOR_GROUPS = Object.freeze([
  { id: "base", label: { en: "Base Backgrounds", ar: "الخلفيات الأساسية" } },
  { id: "general", label: { en: "Lines and Dividers", ar: "الخطوط والفواصل" } },
  { id: "accent", label: { en: "Accent Colors", ar: "الألوان المميزة" } },
  { id: "text", label: { en: "Text Colors", ar: "ألوان النصوص" } },
  { id: "buttons.primary", label: { en: "Primary Button", ar: "الزر الأساسي" } },
  { id: "buttons.secondary", label: { en: "Secondary Button", ar: "الزر الثانوي" } },
]);

export const SITE_DESIGN_COLOR_FIELDS = Object.freeze([
  { id: "base.primaryBackground", group: "base", path: ["base", "primaryBackground"], label: { en: "Primary background", ar: "الخلفية الأساسية" } },
  { id: "base.secondaryBackground", group: "base", path: ["base", "secondaryBackground"], label: { en: "Secondary background", ar: "الخلفية الثانوية" } },
  { id: "general.linesAndDividers", group: "general", path: ["general", "linesAndDividers"], label: { en: "Lines and dividers", ar: "الخطوط والفواصل" } },
  { id: "accent.primary", group: "accent", path: ["accent", "primary"], label: { en: "Primary accent", ar: "اللون المميز الأساسي" } },
  { id: "accent.secondary", group: "accent", path: ["accent", "secondary"], label: { en: "Secondary accent", ar: "اللون المميز الثانوي" } },
  { id: "accent.tertiary", group: "accent", path: ["accent", "tertiary"], label: { en: "Tertiary accent", ar: "اللون المميز الثالث" } },
  { id: "accent.quaternary", group: "accent", path: ["accent", "quaternary"], label: { en: "Quaternary accent", ar: "اللون المميز الرابع" } },
  { id: "text.titles", group: "text", path: ["text", "titles"], label: { en: "Titles", ar: "العناوين" } },
  { id: "text.subtitles", group: "text", path: ["text", "subtitles"], label: { en: "Subtitles", ar: "العناوين الفرعية" } },
  { id: "text.body", group: "text", path: ["text", "body"], label: { en: "Body text", ar: "نص المحتوى" } },
  { id: "text.secondary", group: "text", path: ["text", "secondary"], label: { en: "Secondary text", ar: "النص الثانوي" } },
  { id: "text.linksAndActions", group: "text", path: ["text", "linksAndActions"], label: { en: "Links and actions", ar: "الروابط والإجراءات" } },
  { id: "buttons.primary.background", group: "buttons.primary", path: ["buttons", "primary", "background"], label: { en: "Button background", ar: "خلفية الزر" } },
  { id: "buttons.primary.border", group: "buttons.primary", path: ["buttons", "primary", "border"], label: { en: "Button border", ar: "حدود الزر" } },
  { id: "buttons.primary.text", group: "buttons.primary", path: ["buttons", "primary", "text"], label: { en: "Button text", ar: "نص الزر" } },
  { id: "buttons.secondary.background", group: "buttons.secondary", path: ["buttons", "secondary", "background"], label: { en: "Button background", ar: "خلفية الزر" } },
  { id: "buttons.secondary.border", group: "buttons.secondary", path: ["buttons", "secondary", "border"], label: { en: "Button border", ar: "حدود الزر" } },
  { id: "buttons.secondary.text", group: "buttons.secondary", path: ["buttons", "secondary", "text"], label: { en: "Button text", ar: "نص الزر" } },
]);

const DESIGN_COLOR_PATHS = Object.freeze({
  "--site-bg-primary": ["base", "primaryBackground"],
  "--site-bg-secondary": ["base", "secondaryBackground"],
  "--site-divider": ["general", "linesAndDividers"],
  "--site-accent-primary": ["accent", "primary"],
  "--site-accent-secondary": ["accent", "secondary"],
  "--site-accent-tertiary": ["accent", "tertiary"],
  "--site-accent-quaternary": ["accent", "quaternary"],
  "--site-title-color": ["text", "titles"],
  "--site-subtitle-color": ["text", "subtitles"],
  "--site-body-color": ["text", "body"],
  "--site-text-secondary": ["text", "secondary"],
  "--site-link-color": ["text", "linksAndActions"],
  "--site-button-primary-bg": ["buttons", "primary", "background"],
  "--site-button-primary-border": ["buttons", "primary", "border"],
  "--site-button-primary-text": ["buttons", "primary", "text"],
  "--site-button-secondary-bg": ["buttons", "secondary", "background"],
  "--site-button-secondary-border": ["buttons", "secondary", "border"],
  "--site-button-secondary-text": ["buttons", "secondary", "text"],
});

const HEX6_PATTERN = /^#[0-9a-f]{6}$/i;

export function normalizeHexColor(value) {
  if (typeof value !== "string") return null;
  const candidate = value.trim();
  if (!HEX6_PATTERN.test(candidate)) return null;
  return candidate.toLowerCase();
}

export function cloneColorTheme(theme) {
  if (theme == null || typeof theme !== "object") return null;
  return JSON.parse(JSON.stringify(theme));
}

export function colorThemesEqual(a, b) {
  if (a === b) return true;
  return JSON.stringify(a) === JSON.stringify(b);
}

export function findDefaultTheme(definition) {
  if (!definition || !Array.isArray(definition.themePresets)) return null;
  const defaultThemeId = definition.defaultThemeId;
  return definition.themePresets.find((preset) => preset?.themeId === defaultThemeId) || null;
}

export function createInitialDesignState() {
  return {
    available: false,
    definition: null,
    currentThemeId: "",
    colorTheme: null,
    initialThemeId: "",
    initialColorTheme: null,
    history: { past: [], future: [] },
    isDirty: false,
    activeView: "main",
  };
}

export function applyThemePreset(preset) {
  if (!preset || !preset.colorTheme) return null;
  return { themeId: preset.themeId, colorTheme: cloneColorTheme(preset.colorTheme) };
}

export function pushDesignHistory(history, entry) {
  const past = [...(history?.past || []), entry].slice(-MAX_DESIGN_HISTORY);
  return { past, future: [] };
}

export function createDesignCssVariables(colorTheme) {
  const variables = {};
  if (!colorTheme || typeof colorTheme !== "object") return variables;
  for (const [name, path] of Object.entries(DESIGN_COLOR_PATHS)) {
    const value = path.reduce((acc, key) => (acc && typeof acc === "object" ? acc[key] : undefined), colorTheme);
    const hex = normalizeHexColor(value);
    if (hex) variables[name] = hex;
  }
  return variables;
}

export function findColorField(fieldId) {
  if (typeof fieldId !== "string") return null;
  return SITE_DESIGN_COLOR_FIELDS.find((field) => field.id === fieldId) || null;
}

export function getColorThemeValue(colorTheme, fieldId) {
  const field = findColorField(fieldId);
  if (!field || !colorTheme || typeof colorTheme !== "object") return null;
  const value = field.path.reduce((acc, key) => (acc && typeof acc === "object" ? acc[key] : undefined), colorTheme);
  return normalizeHexColor(value);
}

export function updateColorThemeValue(colorTheme, fieldId, value) {
  const field = findColorField(fieldId);
  const hex = normalizeHexColor(value);
  if (!field || !hex || !colorTheme || typeof colorTheme !== "object") return null;
  const next = cloneColorTheme(colorTheme);
  let target = next;
  for (const key of field.path.slice(0, -1)) {
    if (!target[key] || typeof target[key] !== "object") return null;
    target = target[key];
  }
  target[field.path.at(-1)] = hex;
  return next;
}

export function findCurrentThemePreset(definition, currentThemeId) {
  if (!definition || !Array.isArray(definition.themePresets)) return null;
  return definition.themePresets.find((preset) => preset?.themeId === currentThemeId) || null;
}

export function getPresetColorValue(definition, currentThemeId, fieldId) {
  const preset = findCurrentThemePreset(definition, currentThemeId);
  if (!preset?.colorTheme) return null;
  return getColorThemeValue(preset.colorTheme, fieldId);
}

export function resetColorThemeValue(colorTheme, definition, currentThemeId, fieldId) {
  const presetValue = getPresetColorValue(definition, currentThemeId, fieldId);
  if (presetValue == null) return null;
  return updateColorThemeValue(colorTheme, fieldId, presetValue);
}

export function resetColorThemeToPreset(definition, currentThemeId) {
  const preset = findCurrentThemePreset(definition, currentThemeId);
  if (!preset?.colorTheme) return null;
  return cloneColorTheme(preset.colorTheme);
}

export function colorThemeIsCustomized(definition, currentThemeId, colorTheme) {
  const preset = findCurrentThemePreset(definition, currentThemeId);
  if (!preset?.colorTheme) return false;
  return !colorThemesEqual(colorTheme, preset.colorTheme);
}
