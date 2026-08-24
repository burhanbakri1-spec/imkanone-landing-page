import { Router } from "express";
import {
  categoryCardRepository,
  offerRepository,
  persistCompanyStore,
} from "../data/store.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

function sortOffers(items) {
  return [...items].sort((a, b) => Number(a.displayOrder || 0) - Number(b.displayOrder || 0));
}

function sortCategoryCards(items) {
  return [...items].sort((a, b) => Number(a.displayOrder || 0) - Number(b.displayOrder || 0));
}

router.get("/", (req, res) => {
  res.json(sortOffers(offerRepository.getByCompany(req.companyId).filter((offer) => offer.isActive)));
});

router.get("/all", requireAuth, (req, res) => {
  res.json(sortOffers(offerRepository.getByCompany(req.companyId)));
});

router.get("/category-cards", (req, res) => {
  res.json(sortCategoryCards(categoryCardRepository.getByCompany(req.companyId).filter((card) => card.isActive !== false)));
});

router.get("/category-cards/all", requireAuth, (req, res) => {
  res.json(sortCategoryCards(categoryCardRepository.getByCompany(req.companyId)));
});

router.put("/category-cards/:key", requireAuth, async (req, res) => {
  const existing = categoryCardRepository.findByCompany(req.companyId, req.params.key);
  if (!existing) return res.status(404).json({ message: "Category card not found." });

  const updated = categoryCardRepository.updateForCompany(req.companyId, req.params.key, {
    ...existing,
    ...req.body,
    key: req.params.key,
    updatedAt: new Date().toISOString(),
  });
  await persistCompanyStore(req.companyId);
  return res.json(updated);
});

router.post("/", requireAuth, async (req, res) => {
  const offer = {
    ...req.body,
    id: req.body.id || `offer-${Date.now()}`,
    isActive: req.body.isActive !== false,
  };
  offerRepository.createForCompany(req.companyId, offer, { prepend: true });
  await persistCompanyStore(req.companyId);
  res.status(201).json(offer);
});

router.put("/:id", requireAuth, async (req, res) => {
  const existing = offerRepository.findByCompany(req.companyId, req.params.id);
  if (!existing) return res.status(404).json({ message: "Offer not found." });

  const updated = offerRepository.updateForCompany(req.companyId, req.params.id, {
    ...existing,
    ...req.body,
    id: req.params.id,
  });
  await persistCompanyStore(req.companyId);
  return res.json(updated);
});

router.delete("/:id", requireAuth, async (req, res) => {
  const removed = offerRepository.deleteForCompany(req.companyId, req.params.id);
  if (!removed) return res.status(404).json({ message: "Offer not found." });

  await persistCompanyStore(req.companyId, { pruneMissing: true });
  return res.status(204).end();
});

export default router;
