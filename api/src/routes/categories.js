import crypto from "node:crypto";
import { Router } from "express";
import { tenantCategoryRepository } from "../data/store.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";
import {
  assertAllowedFields,
  catalogError,
  requireTenantPermission,
  sendCatalogError,
  validateLocalized,
  validateOptionalUrl,
  validateSlug,
  validateSortOrder,
} from "./catalogValidation.js";

const router = Router();
const categoryFields = new Set([
  "slug", "name", "description", "parentId", "imageUrl", "sortOrder", "isActive",
]);

function validatedCategory(body, current = null) {
  assertAllowedFields(body, categoryFields, { requireNonEmpty: Boolean(current) });
  const result = {};
  if (!current || Object.hasOwn(body, "slug")) result.slug = validateSlug(body.slug);
  if (!current || Object.hasOwn(body, "name")) {
    result.name = validateLocalized(body.name, "name", { required: true });
  }
  if (Object.hasOwn(body, "description")) {
    result.description = validateLocalized(body.description, "description");
  }
  if (Object.hasOwn(body, "parentId")) {
    if (body.parentId !== null && typeof body.parentId !== "string") {
      throw catalogError("parentId must be a string or null.");
    }
    result.parentId = body.parentId?.trim() || null;
  }
  if (Object.hasOwn(body, "imageUrl")) result.imageUrl = validateOptionalUrl(body.imageUrl, "imageUrl");
  if (Object.hasOwn(body, "sortOrder")) result.sortOrder = validateSortOrder(body.sortOrder);
  if (Object.hasOwn(body, "isActive")) {
    if (typeof body.isActive !== "boolean") throw catalogError("isActive must be a boolean.");
    result.isActive = body.isActive;
  }
  return result;
}

router.get("/", optionalAuth, async (req, res) => {
  try {
    return res.json(await tenantCategoryRepository.listByCompany(req.companyId));
  } catch (error) {
    return sendCatalogError(res, error);
  }
});

router.get("/:id", optionalAuth, async (req, res) => {
  try {
    const category = await tenantCategoryRepository.findByCompany(req.companyId, req.params.id);
    if (!category) return res.status(404).json({ message: "Category not found." });
    return res.json(category);
  } catch (error) {
    return sendCatalogError(res, error);
  }
});

router.post("/", requireAuth, requireTenantPermission("categories", "create"), async (req, res) => {
  try {
    const values = validatedCategory(req.body);
    if (await tenantCategoryRepository.findBySlugForCompany(req.companyId, values.slug)) {
      throw catalogError("Category slug already exists.", 409);
    }
    if (values.parentId && !(await tenantCategoryRepository.validateParentForCompany(req.companyId, values.parentId))) {
      throw catalogError("Parent category not found.", 404);
    }
    const now = new Date().toISOString();
    const category = await tenantCategoryRepository.createForCompany(req.companyId, {
      id: crypto.randomUUID(),
      ...values,
      description: values.description ?? null,
      parentId: values.parentId ?? null,
      imageUrl: values.imageUrl ?? null,
      sortOrder: values.sortOrder ?? 0,
      isActive: values.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    });
    return res.status(201).json(category);
  } catch (error) {
    return sendCatalogError(res, error, { entity: "category", operation: "create" });
  }
});

router.patch("/:id/status", requireAuth, requireTenantPermission("categories", "update"), async (req, res) => {
  try {
    assertAllowedFields(req.body, new Set(["isActive"]), { requireNonEmpty: true });
    if (typeof req.body.isActive !== "boolean") throw catalogError("isActive must be a boolean.");
    const updated = await tenantCategoryRepository.updateStatusForCompany(
      req.companyId,
      req.params.id,
      req.body.isActive,
    );
    if (!updated) throw catalogError("Category not found.", 404);
    return res.json(updated);
  } catch (error) {
    return sendCatalogError(res, error, { entity: "category", operation: "update" });
  }
});

router.patch("/:id", requireAuth, requireTenantPermission("categories", "update"), async (req, res) => {
  try {
    const current = await tenantCategoryRepository.findByCompany(req.companyId, req.params.id);
    if (!current) throw catalogError("Category not found.", 404);
    const values = validatedCategory(req.body, current);
    if (values.slug) {
      const duplicate = await tenantCategoryRepository.findBySlugForCompany(req.companyId, values.slug);
      if (duplicate && duplicate.id !== current.id) throw catalogError("Category slug already exists.", 409);
    }
    if (Object.hasOwn(values, "parentId")) {
      if (values.parentId && !(await tenantCategoryRepository.validateParentForCompany(req.companyId, values.parentId))) {
        throw catalogError("Parent category not found.", 404);
      }
      if (await tenantCategoryRepository.parentWouldCycle(req.companyId, current.id, values.parentId)) {
        throw catalogError("Category parent would create a cycle.");
      }
    }
    const updated = await tenantCategoryRepository.updateForCompany(req.companyId, current.id, {
      ...values,
      updatedAt: new Date().toISOString(),
    });
    if (!updated) throw catalogError("Category not found.", 404);
    return res.json(updated);
  } catch (error) {
    return sendCatalogError(res, error, { entity: "category", operation: "update" });
  }
});

router.delete("/:id", requireAuth, requireTenantPermission("categories", "delete"), async (req, res) => {
  try {
    const category = await tenantCategoryRepository.findByCompany(req.companyId, req.params.id);
    if (!category) throw catalogError("Category not found.", 404);
    if (await tenantCategoryRepository.countChildrenForCompany(req.companyId, category.id)) {
      throw catalogError("Category has child categories and cannot be deleted.", 409);
    }
    if (await tenantCategoryRepository.countProductReferencesForCompany(req.companyId, category.id)) {
      throw catalogError("Category is referenced by products and cannot be deleted.", 409);
    }
    const removed = await tenantCategoryRepository.deleteForCompany(req.companyId, category.id);
    if (!removed) throw catalogError("Category not found.", 404);
    return res.status(204).end();
  } catch (error) {
    return sendCatalogError(res, error, { entity: "category", operation: "delete" });
  }
});

export default router;
