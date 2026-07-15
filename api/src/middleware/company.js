import {
  DEFAULT_COMPANY_ID,
  defaultCompany,
  normalizeCompanyHost,
} from "../tenancy/company.js";
import { companyRepository } from "../data/store.js";

function requestHost(req) {
  const forwardedHost = req.headers["x-forwarded-host"];
  const host = Array.isArray(forwardedHost)
    ? forwardedHost[0]
    : String(forwardedHost || "").split(",")[0] || req.headers.host || req.hostname || "";
  return normalizeCompanyHost(host);
}

export function resolveCompany(req, res, next) {
  req.companyHost = requestHost(req);
  const suppliedCompanyId = String(req.headers["x-company-id"] || "").trim().toLowerCase();
  const dedicatedCompany = companyRepository.resolveStorefront(req.companyHost, "/");
  const suppliedCompany = suppliedCompanyId
    ? companyRepository.getCompanyById(suppliedCompanyId)
    : null;

  if (
    suppliedCompanyId
    && (
      !suppliedCompany
      || suppliedCompany.status !== "active"
      || !companyRepository.hasResolvableStorefront(suppliedCompany.id)
    )
  ) {
    return res.status(404).json({ message: "Storefront company not found or inactive." });
  }
  if (suppliedCompany && dedicatedCompany && suppliedCompany.id !== dedicatedCompany.id) {
    return res.status(403).json({ message: "Storefront company does not match the request domain." });
  }
  if (!suppliedCompany && !dedicatedCompany && companyRepository.isSharedStorefrontHost(req.companyHost)) {
    return res.status(404).json({ message: "A resolved storefront company is required." });
  }

  req.requestedCompanyId = suppliedCompany?.id || dedicatedCompany?.id || null;
  req.companyId = req.requestedCompanyId || DEFAULT_COMPANY_ID;
  req.company = suppliedCompany || dedicatedCompany || defaultCompany;
  next();
}
