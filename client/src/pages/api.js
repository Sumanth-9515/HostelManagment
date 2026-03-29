// api.js — central API config used by every page/component
// Set VITE_API_URL in your .env file, e.g.: VITE_API_URL=http://localhost:5000/api

export const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// ── Token helpers (sessionStorage — consistent everywhere) ────────────────
// FIX: these were already correct; added null-safety and a setter/clearer.
export const token      = ()          => sessionStorage.getItem("token") ?? "";
export const getUser    = ()          => {
  try { return JSON.parse(sessionStorage.getItem("user") ?? "null"); }
  catch { return null; }
};

export const authHeadersMultipart = () => ({
  Authorization: `Bearer ${sessionStorage.getItem("token")}`,
});
export const setSession = (token, user) => {
  sessionStorage.setItem("token", token);
  sessionStorage.setItem("user",  JSON.stringify(user));
};
export const clearSession = () => {
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("user");
};

// ── Auth headers for manual fetch calls ───────────────────────────────────
export const authHeaders = () => ({
  "Content-Type": "application/json",
  Authorization:  `Bearer ${token()}`,
});

// ── Drop-in authenticated fetch wrapper ───────────────────────────────────
// Usage: const data = await authFetch("/buildings");
// On 401 it clears session and reloads to /login automatically.
export const authFetch = async (path, options = {}) => {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...authHeaders(),
      ...(options.headers ?? {}),
    },
  });

  // Auto-logout on expired/invalid token
  if (res.status === 401) {
    clearSession();
    window.location.href = "/login";
    return null;
  }

  return res;
};