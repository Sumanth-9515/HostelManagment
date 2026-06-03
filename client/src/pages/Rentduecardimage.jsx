// RentDueCardImage.jsx
// Professional rent bill card — captured as PNG via html-to-image
// Install dependency: npm install html-to-image

import React from "react";

const fmt = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

const fmtMonthYear = (d) =>
  d
    ? new Date(d).toLocaleString("en-IN", { month: "long", year: "numeric" })
    : "—";

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

// ─── Theme resolver ───────────────────────────────────────────────────────────
function resolveTheme(hasPreviousPending, isOverdue, daysUntilDue) {
  if (hasPreviousPending)
    return {
      gradientA: "#b91c1c",
      gradientB: "#450a0a",
      headerText: "#fecaca",
      accentBg: "#fff1f2",
      accentBorder: "#fecaca",
      rowOdd: "#fff5f5",
      rowEven: "#fff0f0",
      rowBorder: "#fecaca",
      rowText: "#7f1d1d",
      label: "ARREARS ALERT",
      emoji: "🚨",
      badgeBg: "#fef2f2",
      badgeText: "#991b1b",
      badgeBorder: "#fca5a5",
      totalLabel: "Total Arrears Due",
    };
  if (isOverdue)
    return {
      gradientA: "#c2410c",
      gradientB: "#431407",
      headerText: "#fed7aa",
      accentBg: "#fff7ed",
      accentBorder: "#fdba74",
      rowOdd: "#fff7ed",
      rowEven: "#ffedd5",
      rowBorder: "#fed7aa",
      rowText: "#7c2d12",
      label: "OVERDUE",
      emoji: "⚠️",
      badgeBg: "#fff7ed",
      badgeText: "#9a3412",
      badgeBorder: "#fdba74",
      totalLabel: "Total Overdue",
    };
  if (daysUntilDue !== null && daysUntilDue <= 2)
    return {
      gradientA: "#b45309",
      gradientB: "#451a03",
      headerText: "#fde68a",
      accentBg: "#fffbeb",
      accentBorder: "#fcd34d",
      rowOdd: "#fffbeb",
      rowEven: "#fef9c3",
      rowBorder: "#fde68a",
      rowText: "#78350f",
      label: "DUE SOON",
      emoji: "🔔",
      badgeBg: "#fffbeb",
      badgeText: "#92400e",
      badgeBorder: "#fcd34d",
      totalLabel: "Amount Due",
    };
  return {
    gradientA: "#6d28d9",
    gradientB: "#1e1b4b",
    headerText: "#ddd6fe",
    accentBg: "#f5f3ff",
    accentBorder: "#c4b5fd",
    rowOdd: "#f5f3ff",
    rowEven: "#ede9fe",
    rowBorder: "#c4b5fd",
    rowText: "#4c1d95",
    label: "REMINDER",
    emoji: "🏠",
    badgeBg: "#f5f3ff",
    badgeText: "#4c1d95",
    badgeBorder: "#c4b5fd",
    totalLabel: "Rent Due",
  };
}

// ─── RentDueCardImage ─────────────────────────────────────────────────────────
export default function RentDueCardImage({ item, cardRef }) {
  const {
    tenant,
    record,
    remaining,
    isOverdue,
    daysOverdue,
    daysUntilDue,
    pendingMonths = [],
    totalAccumulatedDue,
    hasPreviousPending,
  } = item;

  const alloc = tenant?.allocationInfo || {};
  const t = resolveTheme(hasPreviousPending, isOverdue, daysUntilDue);
  const now = new Date();
  const initial = tenant?.name?.[0]?.toUpperCase() || "?";

  const s = {
    // Root card
    card: {
      width: "480px",
      fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
      backgroundColor: "#ffffff",
      borderRadius: "18px",
      overflow: "hidden",
      boxShadow: "0 32px 64px rgba(0,0,0,0.3)",
      position: "relative",
    },
    // ── Header ──────────────────────────
    header: {
      background: `linear-gradient(145deg, ${t.gradientA} 0%, ${t.gradientB} 100%)`,
      padding: "28px 28px 22px",
      position: "relative",
      overflow: "hidden",
    },
    headerCircle1: {
      position: "absolute",
      top: "-28px",
      right: "-28px",
      width: "130px",
      height: "130px",
      borderRadius: "50%",
      background: "rgba(255,255,255,0.08)",
    },
    headerCircle2: {
      position: "absolute",
      bottom: "-40px",
      left: "20px",
      width: "90px",
      height: "90px",
      borderRadius: "50%",
      background: "rgba(255,255,255,0.06)",
    },
    headerCircle3: {
      position: "absolute",
      top: "10px",
      right: "100px",
      width: "50px",
      height: "50px",
      borderRadius: "50%",
      background: "rgba(255,255,255,0.05)",
    },
    brandRow: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      marginBottom: "20px",
      position: "relative",
      zIndex: 1,
    },
    brandText: {
      color: "rgba(255,255,255,0.75)",
      fontSize: "11px",
      fontWeight: "600",
      letterSpacing: "2.5px",
      textTransform: "uppercase",
    },
    brandTitle: {
      color: "#ffffff",
      fontSize: "22px",
      fontWeight: "800",
      marginTop: "3px",
      letterSpacing: "-0.5px",
    },
    badge: {
      background: "rgba(255,255,255,0.18)",
      borderRadius: "12px",
      padding: "10px 16px",
      textAlign: "center",
      border: "1px solid rgba(255,255,255,0.25)",
      backdropFilter: "blur(8px)",
    },
    badgeEmoji: {
      fontSize: "22px",
      display: "block",
    },
    badgeLabel: {
      color: "#ffffff",
      fontSize: "8px",
      fontWeight: "800",
      letterSpacing: "1.5px",
      display: "block",
      marginTop: "4px",
    },
    tenantRow: {
      display: "flex",
      alignItems: "center",
      gap: "14px",
      position: "relative",
      zIndex: 1,
    },
    avatar: {
      width: "54px",
      height: "54px",
      borderRadius: "50%",
      background: "rgba(255,255,255,0.22)",
      border: "2.5px solid rgba(255,255,255,0.45)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "22px",
      fontWeight: "900",
      color: "#ffffff",
      flexShrink: 0,
      overflow: "hidden",
    },
    tenantName: {
      color: "#ffffff",
      fontSize: "20px",
      fontWeight: "800",
      letterSpacing: "-0.3px",
    },
    tenantPhone: {
      color: "rgba(255,255,255,0.75)",
      fontSize: "12px",
      marginTop: "3px",
    },
    // ── Info strip ──────────────────────
    infoStrip: {
      background: t.accentBg,
      padding: "14px 28px",
      display: "flex",
      gap: "28px",
      alignItems: "center",
      borderBottom: `1px solid ${t.accentBorder}`,
    },
    infoItem: {
      display: "flex",
      flexDirection: "column",
    },
    infoLabel: {
      color: "#9ca3af",
      fontSize: "9px",
      fontWeight: "700",
      letterSpacing: "1.2px",
      textTransform: "uppercase",
    },
    infoValue: {
      color: "#111827",
      fontSize: "13px",
      fontWeight: "700",
      marginTop: "2px",
    },
    infoDate: {
      marginLeft: "auto",
    },
    // ── Body ────────────────────────────
    body: {
      padding: "22px 28px",
    },
    sectionLabel: {
      color: "#6b7280",
      fontSize: "9px",
      fontWeight: "700",
      letterSpacing: "1.5px",
      textTransform: "uppercase",
      marginBottom: "10px",
    },
    table: {
      borderRadius: "10px",
      overflow: "hidden",
      border: `1px solid ${t.rowBorder}`,
      marginBottom: "18px",
    },
    tableRowOdd: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "11px 16px",
      background: t.rowOdd,
    },
    tableRowEven: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "11px 16px",
      background: t.rowEven,
      borderTop: `1px solid ${t.rowBorder}`,
    },
    tableRowMonth: {
      color: t.rowText,
      fontSize: "12px",
      fontWeight: "600",
    },
    tableRowPaid: {
      color: "#9ca3af",
      fontSize: "10px",
      marginTop: "1px",
    },
    tableRowAmt: {
      color: "#dc2626",
      fontSize: "13px",
      fontWeight: "800",
    },
    // Current month table
    currentTable: {
      borderRadius: "10px",
      overflow: "hidden",
      border: "1px solid #e5e7eb",
      marginBottom: "18px",
    },
    curRowGray: {
      display: "flex",
      justifyContent: "space-between",
      padding: "11px 16px",
      background: "#f9fafb",
      borderBottom: "1px solid #e5e7eb",
    },
    curRowGreen: {
      display: "flex",
      justifyContent: "space-between",
      padding: "11px 16px",
      background: "#f0fdf4",
      borderBottom: "1px solid #dcfce7",
    },
    curRowWhite: {
      display: "flex",
      justifyContent: "space-between",
      padding: "11px 16px",
      background: "#ffffff",
    },
    curLabel: {
      color: "#6b7280",
      fontSize: "12px",
    },
    curValue: (color) => ({
      color,
      fontSize: "12px",
      fontWeight: "700",
    }),
    // Divider
    divider: {
      borderTop: "2px dashed #e5e7eb",
      margin: "4px 0 18px",
    },
    // Due status pill
    pillRow: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      marginTop: "8px",
      marginBottom: "4px",
    },
    pill: {
      fontSize: "10px",
      fontWeight: "700",
      padding: "4px 12px",
      borderRadius: "20px",
      background: t.badgeBg,
      color: t.badgeText,
      border: `1px solid ${t.badgeBorder}`,
    },
    dueDateText: {
      color: "#9ca3af",
      fontSize: "10px",
    },
    // ── Total block ─────────────────────
    totalBlock: {
      background: `linear-gradient(135deg, ${t.gradientA} 0%, ${t.gradientB} 100%)`,
      borderRadius: "14px",
      padding: "18px 22px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      position: "relative",
      overflow: "hidden",
      marginTop: "4px",
    },
    totalBlockCircle: {
      position: "absolute",
      top: "-20px",
      right: "-20px",
      width: "90px",
      height: "90px",
      borderRadius: "50%",
      background: "rgba(255,255,255,0.1)",
    },
    totalLabel: {
      color: "rgba(255,255,255,0.8)",
      fontSize: "9px",
      fontWeight: "700",
      letterSpacing: "2px",
      textTransform: "uppercase",
    },
    totalAmount: {
      color: "#ffffff",
      fontSize: "32px",
      fontWeight: "900",
      letterSpacing: "-1px",
      marginTop: "3px",
    },
    totalMonthsBadge: {
      background: "rgba(255,255,255,0.18)",
      borderRadius: "10px",
      padding: "8px 14px",
      textAlign: "center",
      border: "1px solid rgba(255,255,255,0.25)",
    },
    totalMonthsNum: {
      color: "#ffffff",
      fontSize: "26px",
      fontWeight: "900",
      display: "block",
    },
    totalMonthsLabel: {
      color: "rgba(255,255,255,0.7)",
      fontSize: "8px",
      fontWeight: "700",
      letterSpacing: "1px",
      display: "block",
      marginTop: "1px",
    },
    // ── Footer ──────────────────────────
    footer: {
      background: "#f9fafb",
      borderTop: "1px solid #e5e7eb",
      padding: "18px 28px",
    },
    footerLabel: {
      color: "#6b7280",
      fontSize: "9px",
      fontWeight: "700",
      letterSpacing: "1.5px",
      textTransform: "uppercase",
      marginBottom: "12px",
    },
    payOptions: {
      display: "flex",
      gap: "10px",
    },
    payOption: {
      flex: 1,
      background: "#ffffff",
      border: "1px solid #e5e7eb",
      borderRadius: "10px",
      padding: "10px",
      textAlign: "center",
    },
    payOptionIcon: {
      fontSize: "18px",
      display: "block",
    },
    payOptionText: {
      color: "#374151",
      fontSize: "9px",
      fontWeight: "600",
      letterSpacing: "0.5px",
      display: "block",
      marginTop: "4px",
    },
    footerNote: {
      marginTop: "14px",
      textAlign: "center",
      color: "#d1d5db",
      fontSize: "9px",
      letterSpacing: "0.5px",
    },
  };

  return (
    <div ref={cardRef} style={s.card}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={s.header}>
        <div style={s.headerCircle1} />
        <div style={s.headerCircle2} />
        <div style={s.headerCircle3} />

        {/* Brand row */}
        <div style={s.brandRow}>
          <div>
            <div style={s.brandText}>🏢 Hostel Management</div>
            <div style={s.brandTitle}>Rent Statement</div>
          </div>
          <div style={s.badge}>
            <span style={s.badgeEmoji}>{t.emoji}</span>
            <span style={s.badgeLabel}>{t.label}</span>
          </div>
        </div>

        {/* Tenant row */}
        <div style={s.tenantRow}>
          <div style={s.avatar}>{initial}</div>
          <div>
            <div style={s.tenantName}>{tenant?.name}</div>
            <div style={s.tenantPhone}>{tenant?.phone}</div>
          </div>
        </div>
      </div>

      {/* ── Info strip ──────────────────────────────────────────────────── */}
      <div style={s.infoStrip}>
        {alloc.buildingName && (
          <div style={s.infoItem}>
            <span style={s.infoLabel}>Building</span>
            <span style={s.infoValue}>{alloc.buildingName}</span>
          </div>
        )}
        {alloc.roomNumber && (
          <div style={s.infoItem}>
            <span style={s.infoLabel}>Room</span>
            <span style={s.infoValue}>Room {alloc.roomNumber}</span>
          </div>
        )}
        {alloc.bedNumber && (
          <div style={s.infoItem}>
            <span style={s.infoLabel}>Bed</span>
            <span style={s.infoValue}>Bed {alloc.bedNumber}</span>
          </div>
        )}
        <div style={{ ...s.infoItem, ...s.infoDate }}>
          <span style={s.infoLabel}>Generated</span>
          <span style={s.infoValue}>{fmtDate(now)}</span>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div style={s.body}>

        {/* Carry-forward arrears table */}
        {hasPreviousPending && pendingMonths.length > 0 && (
          <div>
            <div style={s.sectionLabel}>Previous Months Arrears</div>
            <div style={s.table}>
              {pendingMonths.map((pm, idx) => {
                const pmRem = pm.rentAmount - pm.paidAmount;
                const rowStyle = idx % 2 === 0 ? s.tableRowOdd : s.tableRowEven;
                return (
                  <div key={pm.monthYear} style={rowStyle}>
                    <div>
                      <div style={s.tableRowMonth}>{fmtMonthYear(pm.dueDate)}</div>
                      {pm.paidAmount > 0 && (
                        <div style={s.tableRowPaid}>Paid: {fmt(pm.paidAmount)}</div>
                      )}
                    </div>
                    <div style={s.tableRowAmt}>{fmt(pmRem)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Current month breakdown */}
        {record && (
          <div>
            <div style={s.sectionLabel}>
              {hasPreviousPending ? "Current Month" : "Rent Breakdown"} —{" "}
              {fmtMonthYear(record.dueDate)}
            </div>
            <div style={s.currentTable}>
              <div style={s.curRowGray}>
                <span style={s.curLabel}>Monthly Rent</span>
                <span style={s.curValue("#111827")}>{fmt(record.rentAmount)}</span>
              </div>
              <div style={s.curRowGreen}>
                <span style={s.curLabel}>Amount Paid</span>
                <span style={s.curValue("#16a34a")}>
                  {record.paidAmount > 0 ? `− ${fmt(record.paidAmount)}` : "₹0"}
                </span>
              </div>
              <div style={s.curRowWhite}>
                <span style={{ ...s.curLabel, fontWeight: "600", color: "#374151" }}>
                  Remaining
                </span>
                <span style={s.curValue("#dc2626")}>{fmt(remaining || 0)}</span>
              </div>
            </div>

            {/* Status pill + due date */}
            <div style={s.pillRow}>
              {isOverdue ? (
                <span style={s.pill}>⚠️ Overdue by {daysOverdue} day{daysOverdue > 1 ? "s" : ""}</span>
              ) : daysUntilDue !== null ? (
                <span style={s.pill}>
                  🕐 Due {daysUntilDue === 0 ? "today" : `in ${daysUntilDue} day${daysUntilDue > 1 ? "s" : ""}`}
                </span>
              ) : null}
              <span style={s.dueDateText}>Due date: {fmtDate(record.dueDate)}</span>
            </div>
          </div>
        )}

        {/* Dashed divider */}
        <div style={s.divider} />

        {/* Total block */}
        <div style={s.totalBlock}>
          <div style={s.totalBlockCircle} />
          <div>
            <div style={s.totalLabel}>{t.totalLabel}</div>
            <div style={s.totalAmount}>{fmt(totalAccumulatedDue)}</div>
          </div>
          {hasPreviousPending && (
            <div style={s.totalMonthsBadge}>
              <span style={s.totalMonthsNum}>{pendingMonths.length + 1}</span>
              <span style={s.totalMonthsLabel}>MONTHS{"\n"}PENDING</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <div style={s.footer}>
        <div style={s.footerLabel}>💳 Payment Options</div>
        <div style={s.payOptions}>
          {[
            { icon: "📱", text: "UPI / GPay" },
            { icon: "🏦", text: "Bank Transfer" },
            { icon: "💵", text: "Cash at Office" },
          ].map(({ icon, text }) => (
            <div key={text} style={s.payOption}>
              <span style={s.payOptionIcon}>{icon}</span>
              <span style={s.payOptionText}>{text}</span>
            </div>
          ))}
        </div>
        <div style={s.footerNote}>
          Automated rent statement · Hostel Management System
        </div>
      </div>
    </div>
  );
}