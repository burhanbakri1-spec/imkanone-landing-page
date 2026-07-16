import {
  apiRequest,
  clearAuthSession,
  getToken,
  getStoredUser,
  setAuthSession,
} from "./api.js";
import {
  clearTenantCaches,
  getStoredCompanyContext,
  sanitizeCompanyContext,
  setStoredCompanyContext,
} from "./companyContext.js";

function authenticatedUser(session) {
  if (!session) return null;
  const user = session.user || session;
  return {
    ...user,
    activeCompany: sanitizeCompanyContext(session.activeCompany || user.activeCompany),
    activeMembership: session.activeMembership || user.activeMembership || null,
  };
}

export function getCurrentUser() {
  const user = getStoredUser();
  return user
    ? { ...user, activeCompany: getStoredCompanyContext() || user.activeCompany || null }
    : null;
}

export function setCurrentUser(user) {
  if (!user) {
    clearTenantCaches();
    clearAuthSession();
    return;
  }

  localStorage.setItem("epChemicalUser", JSON.stringify(user));
}

export async function loginUser(email, password) {
  const session = await apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  clearTenantCaches();
  setAuthSession(session);
  const companyContext = session.activeCompany
    ? await apiRequest("/company/context")
    : null;
  const activeCompany = setStoredCompanyContext({
    ...session.activeCompany,
    ...companyContext,
  });
  const user = authenticatedUser({ ...session, activeCompany });
  localStorage.setItem("epChemicalUser", JSON.stringify(user));
  return { ...session, user, activeCompany };
}

export async function registerCustomer({ name, email, phone, password }) {
  const session = await apiRequest("/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, phone, password }),
  });
  setAuthSession(session);
  return {
    error: "",
    user: session.user,
  };
}

export async function fetchCurrentUser() {
  if (!getToken()) {
    setCurrentUser(null);
    return null;
  }

  const session = await apiRequest("/auth/me");
  const companyContext = session.activeCompany
    ? await apiRequest("/company/context")
    : null;
  const activeCompany = setStoredCompanyContext({
    ...session.activeCompany,
    ...companyContext,
  });
  const user = authenticatedUser({ ...session, activeCompany });
  setCurrentUser(user);
  return user;
}

export async function logoutUser() {
  try {
    return await apiRequest("/auth/logout", {
      method: "POST",
    });
  } finally {
    clearTenantCaches();
    clearAuthSession();
  }
}
