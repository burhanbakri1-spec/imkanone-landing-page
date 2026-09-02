export function slugifyCityKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function defaultZoneCurrency(company) {
  const configured = String(company?.settings?.currency || company?.currency || "ILS").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(configured) ? configured : "ILS";
}

export function emptyZoneDraft(company) {
  return {
    city_name: "",
    city_key: "",
    region: "",
    delivery_price: "0",
    currency: defaultZoneCurrency(company),
    enabled: true,
    display_order: "0",
  };
}

export function zoneDraftFromRecord(zone) {
  return {
    city_name: zone.city_name || zone.cityName || "",
    city_key: zone.city_key || zone.cityKey || "",
    region: zone.region || "",
    delivery_price: String(zone.delivery_price ?? zone.deliveryPrice ?? 0),
    currency: zone.currency || "ILS",
    enabled: zone.enabled !== false,
    display_order: String(zone.display_order ?? zone.displayOrder ?? 0),
  };
}

export function zonePayloadFromDraft(draft, { includeKey = true } = {}) {
  const cityName = String(draft.city_name || "").trim();
  const payload = {
    city_name: cityName,
    region: String(draft.region || "").trim(),
    delivery_price: Number(draft.delivery_price || 0),
    currency: String(draft.currency || "ILS").trim().toUpperCase(),
    enabled: draft.enabled !== false,
    display_order: Math.max(0, Number(draft.display_order || 0)),
  };
  if (includeKey) {
    payload.city_key = slugifyCityKey(draft.city_key || cityName);
  }
  return payload;
}
