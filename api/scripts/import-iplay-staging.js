import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const companyId = "kids-velvet";
const siteId = "kids-velvet-storefront";
const apiUrl = String(process.env.PLATFORM_API_URL || "").replace(/\/$/, "");
const seedUrl = String(process.env.IPLAY_SEED_URL || "");
const token = String(process.env.SCOPED_ADMIN_TOKEN || "");
const apply = process.argv.includes("--apply");

function fail(message) { throw new Error(message); }
function decodeJwt(value) {
  try { return JSON.parse(Buffer.from(value.split(".")[1], "base64url").toString("utf8")); } catch { return {}; }
}

if (apiUrl !== "https://api-staging.igroup.website") fail("PLATFORM_API_URL must be the exact staging API origin.");
const parsedSeedUrl = new URL(seedUrl);
if (parsedSeedUrl.protocol !== "https:" || !parsedSeedUrl.hostname.endsWith(".vercel.app") || ["i-play.vercel.app", "iplay-web.vercel.app"].includes(parsedSeedUrl.hostname)) {
  fail("IPLAY_SEED_URL must use an isolated Vercel preview deployment.");
}
if (!token) fail("SCOPED_ADMIN_TOKEN is required.");
const claims = decodeJwt(token);
const scopedCompany = claims.companyId || claims.company_id || claims.activeCompanyId || claims.active_company_id;
if (scopedCompany !== companyId) fail("The supplied token is not scoped to kids-velvet.");
if (apply && process.env.CONFIRM_IPLAY_STAGING_IMPORT !== "kids-velvet@eb_catalog_test") fail("The staging apply confirmation is missing.");

const headers = { Authorization: `Bearer ${token}`, "X-Company-Id": companyId, "Content-Type": "application/json" };
async function request(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  const body = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) fail(`${options.method || "GET"} ${url} failed (${response.status}): ${body?.message || "Unknown error"}`);
  return body;
}

const seedResponse = await fetch(seedUrl, { headers: { Accept: "application/json" } });
if (!seedResponse.ok) fail(`GET ${seedUrl} failed (${seedResponse.status}).`);
const seed = await seedResponse.json();
if (seed.companyId !== companyId || seed.siteId !== siteId) fail("The preview seed identity does not match kids-velvet.");

const current = {
  products: await request(`${apiUrl}/api/products`),
  categories: await request(`${apiUrl}/api/categories`),
  texts: await request(`${apiUrl}/api/admin/website-texts`),
  media: (await request(`${apiUrl}/api/website-media/all`)).items || [],
};

const assertNoUnrelated = (label, existing, incoming, key) => {
  const allowed = new Set(incoming.map((item) => item[key]));
  const unrelated = existing.filter((item) => !allowed.has(item[key]));
  if (unrelated.length) fail(`${label} contains unrelated staging records: ${unrelated.map((item) => item[key]).join(", ")}`);
};
assertNoUnrelated("Products", current.products, seed.products, "slug");
assertNoUnrelated("Categories", current.categories, seed.categories, "slug");
assertNoUnrelated("Website texts", current.texts, seed.texts, "key");
assertNoUnrelated("Website media", current.media, seed.media, "sectionKey");

const summary = {
  mode: apply ? "apply" : "dry-run",
  before: Object.fromEntries(Object.entries(current).map(([key, value]) => [key, value.length])),
  incoming: { products: seed.products.length, categories: seed.categories.length, texts: seed.texts.length, media: seed.media.length },
};
console.log(JSON.stringify(summary, null, 2));
if (!apply) process.exit(0);

const backupFile = path.resolve(String(process.env.IPLAY_BACKUP_FILE || ""));
if (!process.env.IPLAY_BACKUP_FILE || backupFile.includes(`${path.sep}src${path.sep}data-store${path.sep}`)) fail("IPLAY_BACKUP_FILE must be an explicit path outside the repository data store.");
await mkdir(path.dirname(backupFile), { recursive: true });
await writeFile(backupFile, `${JSON.stringify({ exportedAt: new Date().toISOString(), companyId, ...current }, null, 2)}\n`, { flag: "wx" });

for (const category of seed.categories) {
  const existing = current.categories.find((item) => item.slug === category.slug);
  await request(`${apiUrl}/api/categories${existing ? `/${encodeURIComponent(existing.id)}` : ""}`, {
    method: existing ? "PATCH" : "POST",
    body: JSON.stringify(existing ? { ...category, id: undefined } : category),
  });
}
for (const product of seed.products) {
  const existing = current.products.find((item) => item.slug === product.slug);
  await request(`${apiUrl}/api/products${existing ? `/${encodeURIComponent(existing.id)}` : ""}`, {
    method: existing ? "PUT" : "POST",
    body: JSON.stringify({ ...product, ...(existing ? { id: existing.id } : {}) }),
  });
}
for (const item of seed.texts) {
  await request(`${apiUrl}/api/admin/website-texts`, { method: "POST", body: JSON.stringify(item) });
}
for (const item of seed.media) {
  const existing = current.media.find((entry) => entry.sectionKey === item.sectionKey);
  await request(`${apiUrl}/api/website-media${existing ? `/${encodeURIComponent(existing.id)}` : ""}`, {
    method: existing ? "PUT" : "POST",
    body: JSON.stringify({ ...item, ...(existing ? { id: existing.id } : {}) }),
  });
}

console.log(JSON.stringify({ applied: true, companyId, siteId, backupFile }, null, 2));
