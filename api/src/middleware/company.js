import {
  DEFAULT_COMPANY_ID,
  defaultCompany,
  normalizeCompanyHost,
} from "../tenancy/company.js";

function requestHost(req) {
  const forwardedHost = req.headers["x-forwarded-host"];
  const host = Array.isArray(forwardedHost)
    ? forwardedHost[0]
    : String(forwardedHost || "").split(",")[0] || req.headers.host || req.hostname || "";
  return normalizeCompanyHost(host);
}

export function resolveCompany(req, _res, next) {
  req.companyHost = requestHost(req);

  // TODO(phase-4): look up req.companyHost in verified company_domains records.
  // Only trust forwarded hosts from configured proxies when that lookup is added.
  // Client-supplied company_id and tenant fields must never select a company.
  // Unknown hosts intentionally fall back to EB Chemical during this phase.
  req.companyId = DEFAULT_COMPANY_ID;
  req.company = defaultCompany;
  next();
}
