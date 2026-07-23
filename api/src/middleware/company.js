import { normalizeCompanyHost } from "../tenancy/company.js";
import { companyRepository, resolveByActiveVerifiedDomain } from "../data/store.js";
import { cpanelOrigins } from "../cpanel.js";

const cpanelHosts = new Set(
  cpanelOrigins
    .map((o) => {
      try {
        return normalizeCompanyHost(new URL(o).hostname);
      } catch {
        return null;
      }
    })
    .filter(Boolean),
);

function requestHost(req) {
  const forwardedHost = req.headers["x-forwarded-host"];
  const host = Array.isArray(forwardedHost)
    ? forwardedHost[0]
    : String(forwardedHost || "").split(",")[0] || req.headers.host || req.hostname || "";
  return normalizeCompanyHost(host);
}

export function resolveCompany(req, res, next) {
  const authHeader = String(req.headers.authorization || "");
  if (authHeader.startsWith("Bearer ") && authHeader.length > 7) {
    req.companyHost = "";
    req.requestedCompanyId = null;
    req.companyId = null;
    req.company = null;
    return next();
  }

  const origin = String(req.headers.origin || "").trim();
  const hasOrigin = Boolean(origin);

  if (hasOrigin) {
    if (origin.startsWith("https://")) {
      let originHost = "";
      try { originHost = normalizeCompanyHost(new URL(origin).hostname); } catch {}
      if (originHost) {
        if (cpanelHosts.has(originHost)) {
          req.companyHost = "";
          req.requestedCompanyId = null;
          req.companyId = null;
          req.company = null;
          return next();
        }
        const domainEntry = resolveByActiveVerifiedDomain(originHost);
        if (domainEntry) {
          const company = companyRepository.getCompanyById(domainEntry.company_id);
          req.companyHost = originHost;
          req.requestedCompanyId = domainEntry.company_id;
          req.companyId = domainEntry.company_id;
          req.company = company || null;
          return next();
        }
      }
    }
    req.companyHost = "";
    req.requestedCompanyId = null;
    req.companyId = null;
    req.company = null;
    return next();
  }

  const host = requestHost(req);
  req.companyHost = host;
  const domainEntry = host ? resolveByActiveVerifiedDomain(host) : null;
  if (domainEntry) {
    const company = companyRepository.getCompanyById(domainEntry.company_id);
    req.requestedCompanyId = domainEntry.company_id;
    req.companyId = domainEntry.company_id;
    req.company = company || null;
  } else {
    req.requestedCompanyId = null;
    req.companyId = null;
    req.company = null;
  }
  next();
}
