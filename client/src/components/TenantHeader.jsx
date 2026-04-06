// components/TenantHeader.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Reusable header for all tenant-facing pages.
// Shows logo, current page title, and a slim progress bar when `steps` prop
// is passed (for multi-step forms).
// ─────────────────────────────────────────────────────────────────────────────

import { useNavigate } from "react-router-dom";

export default function TenantHeader({ title = "", subtitle = "", step = null, totalSteps = null }) {
  const navigate = useNavigate();

  const progress = step && totalSteps ? Math.round((step / totalSteps) * 100) : null;

  return (
    <header style={styles.header}>
      <div style={styles.inner}>

        {/* ── Brand ─────────────────────────────────────────────────────── */}
        <button onClick={() => navigate("/")} style={styles.brand}>
          <span style={styles.brandDot} />
          <span style={styles.brandName}>Nilayam Hostel Management</span>
        </button>

        {/* ── Page title (centre) ────────────────────────────────────────── */}
        {title && (
          <div style={styles.titleBlock}>
            <span style={styles.title}>{title}</span>
            {subtitle && <span style={styles.subtitle}>{subtitle}</span>}
          </div>
        )}

        {/* ── Step badge (right) ─────────────────────────────────────────── */}
        {step && totalSteps && (
          <div style={styles.stepBadge}>
            <span style={styles.stepText}>Step {step} of {totalSteps}</span>
          </div>
        )}

        {/* ── Empty right anchor when no step badge ─────────────────────── */}
        {!(step && totalSteps) && <div style={{ width: 100 }} />}
      </div>

      {/* ── Progress bar (only shown in multi-step forms) ─────────────────── */}
      {progress !== null && (
        <div style={styles.progressTrack}>
          <div style={{ ...styles.progressFill, width: `${progress}%` }} />
        </div>
      )}
    </header>
  );
}

const styles = {
  header: {
    position: "sticky",
    top: 0,
    zIndex: 100,
    background: "var(--bg, #f5f4f0)",
    borderBottom: "1px solid var(--border, #e2e0d8)",
    backdropFilter: "blur(10px)",
  },
  inner: {
    maxWidth: 900,
    margin: "0 auto",
    padding: "0 24px",
    height: 56,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 0,
    width: 100,
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "var(--text, #1a1916)",
    display: "inline-block",
    flexShrink: 0,
  },
  brandName: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.12em",
    color: "var(--text, #1a1916)",
    fontFamily: "inherit",
  },
  titleBlock: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text, #1a1916)",
    letterSpacing: "0.01em",
  },
  subtitle: {
    fontSize: 11,
    color: "var(--text-3, #9e9b8e)",
  },
  stepBadge: {
    width: 100,
    display: "flex",
    justifyContent: "flex-end",
  },
  stepText: {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--text-3, #9e9b8e)",
    letterSpacing: "0.04em",
  },
  progressTrack: {
    height: 2,
    background: "var(--border, #e2e0d8)",
    width: "100%",
  },
  progressFill: {
    height: "100%",
    background: "var(--text, #1a1916)",
    transition: "width 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
  },
};