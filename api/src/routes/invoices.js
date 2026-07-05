import crypto from "node:crypto";
import { Router } from "express";
import { invoiceRepository, persistCompanyStore } from "../data/store.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import {
  generateInvoiceNumber,
  sanitizeCreateInvoice,
  sanitizeLineItemsUpdate,
  sanitizeUpdateInvoice,
} from "../invoices/schema.js";

const router = Router();
router.use(requireAuth, requireAdmin);

function invoiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function companyInvoices(companyId) {
  return invoiceRepository
    .getByCompany(companyId)
    .filter((inv) => !inv.deleted_at)
    .sort((a, b) => String(b.created_at || b.createdAt).localeCompare(String(a.created_at || a.createdAt)));
}

function findInvoice(companyId, invoiceId) {
  const invoice = invoiceRepository.findByCompany(companyId, invoiceId);
  if (!invoice || invoice.deleted_at) {
    throw invoiceError("Invoice not found.", 404);
  }
  return invoice;
}

function sendError(res, error) {
  return res.status(error.statusCode || 500).json({
    message: error.statusCode ? error.message : "Unable to process invoice request.",
  });
}

router.get("/", (req, res) => {
  try {
    const invoices = companyInvoices(req.companyId);
    return res.json(invoices);
  } catch (error) {
    return sendError(res, error);
  }
});

router.post("/", async (req, res) => {
  try {
    const data = sanitizeCreateInvoice(req.body);
    const invoices = companyInvoices(req.companyId);
    const invoiceNumber = generateInvoiceNumber(req.companyId, invoices);

    const now = new Date().toISOString();
    const invoice = invoiceRepository.createForCompany(req.companyId, {
      id: crypto.randomUUID(),
      invoice_number: invoiceNumber,
      order_id: req.body.order_id || req.body.orderId || null,
      ...data,
      created_by: req.user.id,
      updated_by: req.user.id,
      created_at: now,
      updated_at: now,
    });

    await persistCompanyStore(req.companyId);
    return res.status(201).json(invoice);
  } catch (error) {
    return sendError(res, error);
  }
});

router.get("/:invoiceId", (req, res) => {
  try {
    const invoice = findInvoice(req.companyId, req.params.invoiceId);
    return res.json(invoice);
  } catch (error) {
    return sendError(res, error);
  }
});

router.patch("/:invoiceId", async (req, res) => {
  try {
    const current = findInvoice(req.companyId, req.params.invoiceId);
    if (current.status === "void" || current.status === "cancelled") {
      throw invoiceError("Cannot update a void or cancelled invoice.", 400);
    }

    const updates = sanitizeUpdateInvoice(req.body);
    const lineItemsUpdate = sanitizeLineItemsUpdate(req.body);

    const now = new Date().toISOString();
    const invoice = invoiceRepository.updateForCompany(req.companyId, current.id, {
      ...current,
      ...updates,
      ...(lineItemsUpdate || {}),
      updated_by: req.user.id,
      updated_at: now,
    });

    await persistCompanyStore(req.companyId);
    return res.json(invoice);
  } catch (error) {
    return sendError(res, error);
  }
});

router.delete("/:invoiceId", async (req, res) => {
  try {
    const current = findInvoice(req.companyId, req.params.invoiceId);
    if (current.status === "void") {
      throw invoiceError("Invoice is already void.", 400);
    }

    const now = new Date().toISOString();
    const invoice = invoiceRepository.updateForCompany(req.companyId, current.id, {
      ...current,
      status: "void",
      deleted_at: now,
      updated_by: req.user.id,
      updated_at: now,
    });

    await persistCompanyStore(req.companyId);
    return res.json(invoice);
  } catch (error) {
    return sendError(res, error);
  }
});

router.post("/:invoiceId/void", async (req, res) => {
  try {
    const current = findInvoice(req.companyId, req.params.invoiceId);
    if (current.status === "void") {
      throw invoiceError("Invoice is already void.", 400);
    }

    const now = new Date().toISOString();
    const invoice = invoiceRepository.updateForCompany(req.companyId, current.id, {
      ...current,
      status: "void",
      deleted_at: now,
      updated_by: req.user.id,
      updated_at: now,
    });

    await persistCompanyStore(req.companyId);
    return res.json(invoice);
  } catch (error) {
    return sendError(res, error);
  }
});

export default router;
