import { useState, useEffect } from "react";

// ─── inputStyle ────────────────────────────────────────────────────────────────
export const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  fontSize: 13,
  color: "var(--text)",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

// ─── Btn ───────────────────────────────────────────────────────────────────────
export function Btn({ children, onClick, disabled, variant = "primary", style = {}, type = "button" }) {
  const base = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    gap: 6, padding: "7px 16px", borderRadius: "var(--radius)",
    fontSize: 13, fontWeight: 500, cursor: disabled ? "not-allowed" : "pointer",
    border: "1px solid transparent", outline: "none", fontFamily: "inherit",
    opacity: disabled ? 0.55 : 1, transition: "opacity 0.15s",
  };

  const variants = {
    primary: {
      background: "var(--accent)", color: "var(--accent-fg)",
      borderColor: "var(--accent)",
    },
    secondary: {
      background: "var(--surface-2)", color: "var(--text)",
      borderColor: "var(--border)",
    },
    ghost: {
      background: "transparent", color: "var(--text-2)",
      borderColor: "transparent",
    },
    danger: {
      background: "var(--red-bg)", color: "var(--red)",
      borderColor: "#fca5a5",
    },
  };

  return (
    <button
      type={type}
      onClick={disabled ? undefined : onClick}
      style={{ ...base, ...(variants[variant] || variants.primary), ...style }}
    >
      {children}
    </button>
  );
}

// ─── Badge ─────────────────────────────────────────────────────────────────────
export function Badge({ children, color = "default" }) {
  const colors = {
    default: { background: "var(--surface-2)", color: "var(--text-3)", border: "1px solid var(--border)" },
    green:   { background: "var(--green-bg)",  color: "var(--green)",  border: "1px solid #86efac" },
    red:     { background: "var(--red-bg)",    color: "var(--red)",    border: "1px solid #fca5a5" },
    blue:    { background: "#eff6ff",          color: "#3b82f6",       border: "1px solid #bfdbfe" },
  };
  return (
    <span style={{
      display: "inline-block", fontSize: 10, fontWeight: 500,
      padding: "2px 7px", borderRadius: 99,
      ...(colors[color] || colors.default),
    }}>
      {children}
    </span>
  );
}

// ─── StatCard ──────────────────────────────────────────────────────────────────
export function StatCard({ label, value, sub }) {
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: "var(--radius-lg)", padding: "16px 18px",
    }}>
      <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: "var(--text)", marginBottom: sub ? 4 : 0 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-3)" }}>{sub}</div>}
    </div>
  );
}

// ─── Toast ─────────────────────────────────────────────────────────────────────
export function useToast() {
  const [toast, setToast] = useState(null);

  const show = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  return { toast, show };
}

export function Toast({ toast }) {
  if (!toast) return null;

  const isError = toast.type === "error";
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 9999,
      background: isError ? "var(--red-bg)" : "var(--surface)",
      color: isError ? "var(--red)" : "var(--text)",
      border: `1px solid ${isError ? "#fca5a5" : "var(--border)"}`,
      borderRadius: "var(--radius-lg)", padding: "12px 18px",
      fontSize: 13, fontWeight: 500, boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
      display: "flex", alignItems: "center", gap: 8,
    }}>
      <span>{isError ? "✕" : "✓"}</span>
      {toast.message}
    </div>
  );
}

// ─── Modal ─────────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return;
    const handler = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.4)", display: "flex",
        alignItems: "center", justifyContent: "center", padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)", padding: 24,
          width: "100%", maxWidth: 440,
          boxShadow: "0 8px 40px rgba(0,0,0,0.2)",
        }}
      >
        {title && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600 }}>{title}</h2>
            <button
              onClick={onClose}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", fontSize: 18, padding: "0 2px" }}
            >
              ✕
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

// ─── Auth helpers (sessionStorage) ────────────────────────────────────────────
export const getSession = () => {
  try {
    return JSON.parse(sessionStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

export const clearSession = () => {
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("user");
};