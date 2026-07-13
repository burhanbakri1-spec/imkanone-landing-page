import { Router } from "express";
import { companyRepository } from "../data/store.js";
import { optionalAuth } from "../middleware/auth.js";
import { createPublicCompanyContext } from "../tenancy/company.js";

const router = Router();

router.get("/context", optionalAuth, (req, res) => {
  const company = companyRepository.getCompanyById(req.companyId) || req.company;
  res.json(createPublicCompanyContext(company, { host: req.companyHost }));
});

export default router;
