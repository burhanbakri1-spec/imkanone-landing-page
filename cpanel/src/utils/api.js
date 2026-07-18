const configuredApiUrl = import.meta.env?.VITE_API_URL || "http://localhost:5000";
const normalizedApiUrl = configuredApiUrl.replace(/\/$/, "");

export const apiBaseUrl = normalizedApiUrl.endsWith("/api")
  ? normalizedApiUrl
  : `${normalizedApiUrl}/api`;
export const tokenStorageKey = "epChemicalJwt";
export const userStorageKey = "epChemicalUser";
export const protectedApiErrorEvent = "epChemical:protected-api-error";

export function resolveApiAssetUrl(value) {
  if (!value || typeof value !== "string") return null;
  if (!value.startsWith("/")) return value;
  return new URL(value, `${new URL(apiBaseUrl).origin}/`).toString();
}

function createUploadError(message, status) {
  const error = new Error(message);
  error.status = status;

  if ((status === 401 || status === 403) && typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(protectedApiErrorEvent, {
        detail: { status },
      }),
    );
  }

  return error;
}

export function getToken() {
  return localStorage.getItem(tokenStorageKey);
}

export function setAuthSession({ token, user }) {
  const previousToken = localStorage.getItem(tokenStorageKey);
  if (previousToken && previousToken !== token) {
    localStorage.removeItem("cpanelActiveCompany");
  }
  localStorage.setItem(tokenStorageKey, token);
  localStorage.setItem(userStorageKey, JSON.stringify(user));
}

export function clearAuthSession() {
  localStorage.removeItem(tokenStorageKey);
  localStorage.removeItem(userStorageKey);
  localStorage.removeItem("cpanelActiveCompany");
}

export function getStoredUser() {
  try {
    const user = localStorage.getItem(userStorageKey);
    return user ? JSON.parse(user) : null;
  } catch (error) {
    return null;
  }
}

export function createApiHeaders(token, headers = {}) {
  const safeHeaders = Object.fromEntries(
    Object.entries(headers).filter(([name]) => name.toLowerCase() !== "x-company-id"),
  );

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...safeHeaders,
  };
}

export async function apiRequest(path, options = {}) {
  const token = getToken();
  const url = `${apiBaseUrl}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: createApiHeaders(token, options.headers),
  });

  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data.message || "API request failed.";
    console.error("API request failed", {
      endpoint: path,
      status: response.status,
      message,
    });
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return data;
}

export async function uploadImage(file) {
  const token = getToken();

  if (!token) {
    throw createUploadError("Authentication required.", 401);
  }

  const formData = new FormData();
  formData.append("image", file);

  const response = await fetch(`${apiBaseUrl}/uploads`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw createUploadError(data.message || "Image upload failed.", response.status);
  }

  const url = data.url || data.path || "";
  return {
    ...data,
    url,
    path: data.path || url,
  };
}

export async function uploadImages(files = []) {
  const fileList = Array.from(files).filter(Boolean);
  if (!fileList.length) {
    return [];
  }

  const token = getToken();

  if (!token) {
    throw createUploadError("Authentication required.", 401);
  }

  const formData = new FormData();
  fileList.forEach((file) => formData.append("image", file));

  const response = await fetch(`${apiBaseUrl}/uploads`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw createUploadError(data.message || "Images upload failed.", response.status);
  }

  const uploaded = data.files || (data.path || data.url ? [data] : []);
  return uploaded.map((file) => {
    const url = file.url || file.path || "";
    return {
      ...file,
      url,
      path: file.path || url,
    };
  });
}

export function uploadProductMedia(file, productId, onProgress = () => {}) {
  const token = getToken();
  if (!token) return Promise.reject(createUploadError("Authentication required.", 401));
  if (!productId) return Promise.reject(createUploadError("Save the product before uploading media.", 400));
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", `${apiBaseUrl}/uploads/products/${encodeURIComponent(productId)}`);
    request.setRequestHeader("Authorization", `Bearer ${token}`);
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener("load", () => {
      const data = (() => { try { return JSON.parse(request.responseText || "{}"); } catch { return {}; } })();
      if (request.status < 200 || request.status >= 300) return reject(createUploadError(data.message || "Media upload failed.", request.status));
      const url = data.url || data.path || "";
      return resolve({ ...data, url, path: data.path || url });
    });
    request.addEventListener("error", () => reject(createUploadError("Media upload failed.", 0)));
    const formData = new FormData();
    formData.append("media", file);
    request.send(formData);
  });
}

export async function deleteProductMedia(productId, value) {
  return apiRequest(`/uploads/products/${encodeURIComponent(productId)}`, {
    method: "DELETE",
    body: JSON.stringify({ url: value }),
  });
}
