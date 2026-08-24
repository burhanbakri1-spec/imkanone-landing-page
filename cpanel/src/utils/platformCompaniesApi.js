import { apiRequest } from "./api.js";

const companiesPath = "/platform/companies";

export async function fetchPlatformCompanies() {
  const response = await apiRequest(companiesPath);
  return Array.isArray(response) ? response : response?.companies || [];
}

export async function createPlatformCompany(company) {
  const response = await apiRequest(companiesPath, {
    method: "POST",
    body: JSON.stringify(company),
  });
  return response?.company || response;
}

export async function updatePlatformCompany(companyId, company) {
  const response = await apiRequest(`${companiesPath}/${encodeURIComponent(companyId)}`, {
    method: "PATCH",
    body: JSON.stringify(company),
  });
  return response?.company || response;
}

export async function disablePlatformCompany(companyId) {
  const response = await apiRequest(`${companiesPath}/${encodeURIComponent(companyId)}/disable`, {
    method: "PATCH",
  });
  return response?.company || response;
}
