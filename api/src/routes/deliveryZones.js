import crypto from "node:crypto";
import { Router } from "express";
import { deliveryZoneRepository, persistCompanyStore } from "../data/store.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { sanitizeCreateZone, sanitizeUpdateZone } from "../delivery/schema.js";

function zoneError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function sendError(res, error) {
  return res.status(error.statusCode || 500).json({
    message: error.statusCode ? error.message : "Unable to process delivery zone request.",
  });
}

function companyZones(companyId) {
  return deliveryZoneRepository
    .getByCompany(companyId)
    .filter((z) => !z.deleted_at)
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0) || a.city_name.localeCompare(b.city_name));
}

function findZone(companyId, zoneId) {
  const zone = deliveryZoneRepository.findByCompany(companyId, zoneId);
  if (!zone || zone.deleted_at) {
    throw zoneError("Delivery zone not found.", 404);
  }
  return zone;
}

// --- Public route: enabled zones only ---
const publicRouter = Router();

publicRouter.get("/", (req, res) => {
  try {
    const zones = companyZones(req.companyId).filter((z) => z.enabled !== false);
    return res.json(zones);
  } catch (error) {
    return sendError(res, error);
  }
});

// --- Admin routes: full CRUD ---
const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

adminRouter.get("/", (req, res) => {
  try {
    return res.json(companyZones(req.companyId));
  } catch (error) {
    return sendError(res, error);
  }
});

adminRouter.post("/", async (req, res) => {
  try {
    const data = sanitizeCreateZone(req.body);
    const duplicate = deliveryZoneRepository.findByCompany(
      req.companyId,
      (z) => z.city_key === data.city_key && !z.deleted_at,
    );
    if (duplicate) {
      throw zoneError("A delivery zone with this city_key already exists.", 409);
    }
    const now = new Date().toISOString();
    const zone = deliveryZoneRepository.createForCompany(req.companyId, {
      id: crypto.randomUUID(),
      ...data,
      created_by: req.user.id,
      updated_by: req.user.id,
      created_at: now,
      updated_at: now,
    });
    await persistCompanyStore(req.companyId);
    return res.status(201).json(zone);
  } catch (error) {
    return sendError(res, error);
  }
});

adminRouter.get("/:zoneId", (req, res) => {
  try {
    return res.json(findZone(req.companyId, req.params.zoneId));
  } catch (error) {
    return sendError(res, error);
  }
});

adminRouter.patch("/:zoneId", async (req, res) => {
  try {
    const current = findZone(req.companyId, req.params.zoneId);
    const updates = sanitizeUpdateZone(req.body);
    const now = new Date().toISOString();
    const zone = deliveryZoneRepository.updateForCompany(req.companyId, current.id, {
      ...current,
      ...updates,
      updated_by: req.user.id,
      updated_at: now,
    });
    await persistCompanyStore(req.companyId);
    return res.json(zone);
  } catch (error) {
    return sendError(res, error);
  }
});

adminRouter.delete("/:zoneId", async (req, res) => {
  try {
    const current = findZone(req.companyId, req.params.zoneId);
    const now = new Date().toISOString();
    const zone = deliveryZoneRepository.updateForCompany(req.companyId, current.id, {
      ...current,
      enabled: false,
      deleted_at: now,
      updated_by: req.user.id,
      updated_at: now,
    });
    await persistCompanyStore(req.companyId);
    return res.json(zone);
  } catch (error) {
    return sendError(res, error);
  }
});

export { publicRouter, adminRouter };
