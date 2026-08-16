import { Router } from "express";
import {
  productRepository,
  saveProductWithTenantCatalogLock,
} from "../data/store.js";
import { requireAnyPermission, requireAuth } from "../middleware/auth.js";
import { applyInventoryUpdate, inventoryProduct } from "../products/inventory.js";
import { recordActivityLog } from "../activityLog/logger.js";

const router = Router();

const inventoryRead = requireAnyPermission("inventory.view", "inventory.manage", "products.view", "products.manage");
const inventoryWrite = requireAnyPermission("inventory.manage", "products.update", "products.manage");

router.get("/", requireAuth, inventoryRead, (req, res) => {
  res.json(productRepository.getByCompany(req.companyId).map(inventoryProduct));
});

router.patch("/:id", requireAuth, inventoryWrite, async (req, res) => {
  const existing = productRepository.findByCompany(req.companyId, req.params.id);
  if (!existing) return res.status(404).json({ message: "Product not found." });

  try {
    const updated = applyInventoryUpdate(existing, req.body);

    const saved = await saveProductWithTenantCatalogLock(req.companyId, updated);
    recordActivityLog({
      req,
      companyId: req.companyId,
      action: "product.inventory_updated",
      entityType: "product",
      entityId: saved.id,
      entityLabel: saved.name?.en || saved.slug || saved.id,
      summary: `Inventory updated for "${saved.name?.en || saved.slug || saved.id}"`,
      beforeData: inventoryProduct(existing),
      afterData: inventoryProduct(saved),
    });
    return res.json(inventoryProduct(saved));
  } catch (error) {
    if (error?.statusCode) return res.status(error.statusCode).json({ message: error.message });
    console.error("Inventory update failed", { code: error?.code || "UNKNOWN" });
    return res.status(500).json({ message: "Inventory could not be updated." });
  }
});

export default router;
