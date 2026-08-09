import { Router } from "express";
import {
  getCompanyDomainsByCompany,
  productRepository,
  tenantCategoryRepository,
  websiteMediaHiddenKeysRepository,
  websiteMediaRepository,
  websiteTextsRepository,
} from "../data/store.js";
import { normalizeCompanyHost } from "../tenancy/company.js";
import { websiteConnectionDefaults, websiteConnectionSettings } from "../siteEditor/websiteConnection.js";
import {
  serializePublicCategory,
  serializePublicProduct,
  serializePublicWebsiteMedia,
  serializePublicWebsiteText,
} from "../storefront/publicContent.js";

const router = Router();
const localePattern = /^[a-z]{2}(?:-[a-z]{2})?$/i;

function requestSiteId(req) {
  const header = req.headers["x-site-id"];
  if (Array.isArray(header) || String(header || "").includes(",")) return "";
  return String(header || req.query.siteId || "").trim();
}

function storefrontContext(req, res, next) {
  if (!req.company || !req.companyId) return res.status(404).json({ message: "Storefront not found." });
  const connection = websiteConnectionSettings(req.company) || websiteConnectionDefaults(req.company);
  const siteId = requestSiteId(req);
  if (!siteId || siteId !== connection.siteId) return res.status(404).json({ message: "Storefront not found." });

  const origin = String(req.headers.origin || "").trim();
  if (origin) {
    let originHost = "";
    try { originHost = normalizeCompanyHost(new URL(origin).hostname); } catch {}
    let connectedStorefrontHost = "";
    try { connectedStorefrontHost = normalizeCompanyHost(new URL(connection.storefrontBaseUrl || "").hostname); } catch {}
    const ownsVerifiedDomain = getCompanyDomainsByCompany(req.companyId).some(
      (entry) => entry.is_active === true && entry.is_verified === true && normalizeCompanyHost(entry.domain) === originHost,
    );
    if (!originHost || (!ownsVerifiedDomain && originHost !== connectedStorefrontHost)) {
      return res.status(404).json({ message: "Storefront not found." });
    }
  }

  const supportedLocales = [...new Set((connection.supportedLocales || [connection.defaultLocale || "en"])
    .map((locale) => String(locale || "").trim().toLowerCase())
    .filter((locale) => localePattern.test(locale)))];
  const defaultLocale = supportedLocales.includes(String(connection.defaultLocale || "").toLowerCase())
    ? String(connection.defaultLocale).toLowerCase()
    : supportedLocales[0] || "en";
  const requestedLocale = String(req.query.locale || "").trim().toLowerCase();
  req.storefront = {
    connection,
    siteId,
    supportedLocales: supportedLocales.length ? supportedLocales : [defaultLocale],
    defaultLocale,
    locale: supportedLocales.includes(requestedLocale) ? requestedLocale : defaultLocale,
  };
  res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
  return next();
}

function publicProducts(companyId) {
  return productRepository.getByCompany(companyId)
    .filter((product) => product.isActive !== false && product.active !== false && product.visible !== false)
    .map(serializePublicProduct)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug));
}

router.use(storefrontContext);

router.get("/content", async (req, res, next) => {
  try {
    const hiddenMedia = new Set(websiteMediaHiddenKeysRepository.getByCompany(req.companyId).map((item) => item.sectionKey));
    const [categories] = await Promise.all([tenantCategoryRepository.listByCompany(req.companyId)]);
    const products = publicProducts(req.companyId);
    const texts = websiteTextsRepository.getByCompany(req.companyId)
      .filter((item) => item.isActive !== false && !item.deletedAt)
      .map((item) => serializePublicWebsiteText(item, req.storefront.locale));
    const media = websiteMediaRepository.getByCompany(req.companyId)
      .filter((item) => item.isActive !== false && !hiddenMedia.has(item.sectionKey))
      .map(serializePublicWebsiteMedia);

    return res.json({
      site: {
        id: req.storefront.siteId,
        companyId: req.companyId,
        name: String(req.company.name || ""),
        slug: String(req.company.slug || req.companyId),
        defaultLocale: req.storefront.defaultLocale,
        supportedLocales: req.storefront.supportedLocales,
        locale: req.storefront.locale,
        currency: String(req.company.settings?.currency || req.company.currency || "USD"),
        logo: String(req.company.logo || req.company.logoUrl || ""),
      },
      categories: categories.filter((category) => category.isActive !== false).map(serializePublicCategory),
      products,
      texts,
      media,
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/products/:slug", (req, res) => {
  const product = publicProducts(req.companyId).find((item) => item.slug === req.params.slug);
  if (!product) return res.status(404).json({ message: "Product not found." });
  return res.json(product);
});

export default router;
