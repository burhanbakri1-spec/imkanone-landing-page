import { Router } from "express";
import { companyRepository, websiteMediaRepository } from "../data/store.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { createIcareHomeDocument, HOME_PAGE_ID, listEditableIcarePages } from "../siteEditor/icareHomeAdapter.js";
import { getSiteEditorDraft, saveSiteEditorDraft, siteEditorDraftStorageKind } from "../siteEditor/draftRepository.js";
import { assertDraftPayloadSize, SiteEditorValidationError, validatePageDocument } from "../siteEditor/schema.js";

const router = Router();

router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  next();
});
router.use(requireAuth, requireTrustedEditorTenant);

function activeLocale(value) {
  return value === "ar" ? "ar" : "en";
}

function requireTrustedEditorTenant(req, res, next) {
  if (!req.companyId || !req.company || (!req.membership && !req.tenantScope)) {
    return res.status(403).json({ message: "A trusted company scope is required.", code: "TENANT_SCOPE_REQUIRED" });
  }
  if (req.companyId !== "icare" || req.company.slug !== "icare") {
    return res.status(404).json({ message: "No editable site is registered for this tenant.", code: "EDITOR_SITE_NOT_FOUND" });
  }
  return next();
}

function requireKnownPage(req, res, next) {
  if (req.params.pageId !== HOME_PAGE_ID) {
    return res.status(404).json({ message: "Editable page not found.", code: "EDITOR_PAGE_NOT_FOUND" });
  }
  return next();
}

function activeMediaUrls(companyId) {
  return new Map(websiteMediaRepository.getByCompany(companyId).filter(
    (asset) => asset.isActive !== false && asset.is_active !== false && !asset.deletedAt && !asset.deleted_at,
  ).flatMap((asset) => {
    const urls = [asset.imageUrl, asset.fallbackImageUrl].filter(Boolean);
    return urls.map((url) => [String(url), asset]);
  }));
}

function imageNodes(document) {
  const images = [];
  const visit = (node) => {
    if (node.type === "image") images.push(node);
    (node.children || []).forEach(visit);
  };
  document.sections.forEach((section) => section.elements.forEach(visit));
  return images;
}

function validateTenantMedia(document, currentDocument, companyId) {
  const mediaByUrl = activeMediaUrls(companyId);
  const currentUrls = new Set(imageNodes(currentDocument).map((node) => node.content.src));
  for (const image of imageNodes(document)) {
    const source = image.content.src;
    if (currentUrls.has(source)) continue;
    const media = mediaByUrl.get(source);
    if (!media) throw new SiteEditorValidationError("Image must reference active media from the current tenant.", 400, "TENANT_MEDIA_REQUIRED");
    if (image.content.assetId && image.content.assetId !== media.id) {
      throw new SiteEditorValidationError("Image asset identity does not match the current tenant media record.", 400, "TENANT_MEDIA_REQUIRED");
    }
    image.content.assetId = media.id;
  }
}

async function currentDocument(companyId, pageId, locale) {
  return (await getSiteEditorDraft(companyId, pageId, locale))?.document
    || createIcareHomeDocument(companyId, locale);
}

router.get("/pages", requirePermission("site_editor.access"), async (req, res) => {
  try {
    const locale = activeLocale(req.query.locale);
    const pages = await Promise.all(listEditableIcarePages(req.companyId, locale).map(async (page) => ({
      ...page,
      draftStatus: await getSiteEditorDraft(req.companyId, page.id, locale) ? "draft" : "published-source",
    })));
    return res.json({ items: pages, source: "tenant-page-adapter", locale });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message || "Unable to load editor pages.", code: error.code || "EDITOR_PAGES_LOAD_FAILED" });
  }
});

router.get("/pages/:pageId", requirePermission("site_editor.access"), requireKnownPage, async (req, res) => {
  try {
    const locale = activeLocale(req.query.locale);
    const draft = await getSiteEditorDraft(req.companyId, req.params.pageId, locale);
    const document = draft?.document || createIcareHomeDocument(req.companyId, locale);
    if (!document) return res.status(404).json({ message: "Editable page document not found." });
    return res.json({ document, source: draft ? `${siteEditorDraftStorageKind()}-draft` : "icare-home-adapter" });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message || "Unable to load the editor document.", code: error.code || "EDITOR_DOCUMENT_LOAD_FAILED" });
  }
});

router.put(
  "/pages/:pageId/draft",
  requirePermission("site_editor.access"),
  requirePermission("site_editor.edit"),
  requirePermission("site_editor.save"),
  requireKnownPage,
  async (req, res) => {
    try {
      const locale = activeLocale(req.body?.document?.locale);
      const expectedRevision = Number(req.body?.revision);
      if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
        throw new SiteEditorValidationError("Expected revision is required.");
      }
      assertDraftPayloadSize(req.body?.document);
      const before = await currentDocument(req.companyId, req.params.pageId, locale);
      const document = validatePageDocument(req.body?.document, {
        companyId: req.companyId,
        pageId: req.params.pageId,
      });
      validateTenantMedia(document, before, req.companyId);
      const saved = await saveSiteEditorDraft({
        companyId: req.companyId,
        pageId: req.params.pageId,
        locale,
        expectedRevision,
        document,
        actor: req.user,
      });
      return res.json({ document: saved.document, revision: saved.document.revision, audit: saved.audit });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        message: error.statusCode ? error.message : "Unable to save the site draft.",
        code: error.code || "DRAFT_SAVE_FAILED",
        ...(error.currentRevision !== undefined ? { currentRevision: error.currentRevision } : {}),
      });
    }
  },
);

router.get("/context", requirePermission("site_editor.access"), (req, res) => {
  const company = companyRepository.getCompanyById(req.companyId);
  return res.json({ company: company ? { id: company.id, slug: company.slug, name: company.name } : null });
});

export default router;
