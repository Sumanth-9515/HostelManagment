// api.js — central API config used by every page/component
// Set VITE_API_URL in your .env file, e.g.: VITE_API_URL=http://localhost:5000/api

export const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// ── Token helpers (localStorage — consistent everywhere) ────────────────
// FIX: these were already correct; added null-safety and a setter/clearer.
export const token      = ()          => localStorage.getItem("token") ?? "";
export const getUser    = ()          => {
  try { return JSON.parse(localStorage.getItem("user") ?? "null"); }
  catch { return null; }
};
export const setSession = (token, user) => {
  localStorage.setItem("token", token);
  localStorage.setItem("user",  JSON.stringify(user));
};
export const clearSession = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
};

// ── Auth headers for manual fetch calls ───────────────────────────────────
export const authHeaders = () => ({
  "Content-Type": "application/json",
  Authorization:  `Bearer ${token()}`,
});

// ── Drop-in authenticated fetch wrapper ───────────────────────────────────
// Usage: const data = await authFetch("/buildings");
export const authFetch = async (path, options = {}) => {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...authHeaders(),
      ...(options.headers ?? {}),
    },
  });

  return res;
};
