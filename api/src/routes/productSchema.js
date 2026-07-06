import { Router } from "express";
import {
  companyProductSchemaRepository,
  persistCompanyStore,
} from "../data/store.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import {
  defaultProductSchema,
  sanitizeProductSchema,
} from "../productSchema/schema.js";

export const publicProductSchemaRouter = Router();
export const adminProductSchemaRouter = Router();

function schemaForCompany(companyId) {
  const record = companyProductSchemaRepository.findByCompany(companyId, (item) => item.id === `product-schema-${companyId}`)
    || companyProductSchemaRepository.findByCompany(companyId, () => true);
  return record?.schema || defaultProductSchema();
}

publicProductSchemaRouter.get("/", (req, res) => {
  res.json(schemaForCompany(req.companyId));
});

adminProductSchemaRouter.use(requireAuth, requireAdmin);

adminProductSchemaRouter.get("/", (req, res) => {
  res.json(schemaForCompany(req.companyId));
});

adminProductSchemaRouter.patch("/", async (req, res) => {
  try {
    const schema = sanitizeProductSchema(req.body);
    const current = companyProductSchemaRepository.findByCompany(req.companyId, () => true);
    const now = new Date().toISOString();
    const record = {
      id: current?.id || `product-schema-${req.companyId}`,
      schema,
      createdAt: current?.createdAt || now,
      updatedAt: now,
    };
    if (current) companyProductSchemaRepository.updateForCompany(req.companyId, current.id, record);
    else companyProductSchemaRepository.createForCompany(req.companyId, record);
    await persistCompanyStore(req.companyId);
    return res.json(schema);
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.statusCode ? error.message : "Unable to save product schema.",
    });
  }
});
