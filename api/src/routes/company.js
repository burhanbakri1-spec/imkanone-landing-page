import { Router } from "express";
import { createPublicCompanyContext } from "../tenancy/company.js";

const router = Router();

router.get("/context", (req, res) => {
  res.json(createPublicCompanyContext(req.company, { host: req.companyHost }));
});

export default router;
