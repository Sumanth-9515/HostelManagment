// MasterPlanMonitor.jsx
// Add to master dashboard routes: /master/plan-monitor
// Fetches all users, shows plan duration, live countdown to planExpiresAt, all timestamps
import { useState, useEffect, useCallback } from "react";
import { API } from "../api.js";

// Live countdown hook
function useCountdown(target) {
  const calc = useCallback(() => {
    if (!target) return null;
    const diff = new Date(target) - new Date();
    if (diff <= 0) return { expired: true, d: 0, h: 0, m: 0, s: 0, total: diff };
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return { expired: false, d, h, m, s, total: diff };
  }, [target]);

  const [tick, setTick] = useState(calc);
  useEffect(() => {
    const t = setInterval(() => setTick(calc()), 1000);
    return () => clearInterval(t);
  }, [calc]);
  return tick;
}

// Beautiful badge-shaped countdown component
function CountdownBadge({ expiresAt, planStatus }) {
  const cd = useCountdown(expiresAt);
  
  if (!expiresAt || planStatus === "none") {
    return (
      <div className="cd-badge cd-badge-neutral">
        <span className="cd-icon">📅</span>
        <span className="cd-text">No plan</span>
      </div>
    );
  }
  
  if (!cd || cd.expired || planStatus === "expired") {
    return (
      <div className="cd-badge cd-badge-expired">
        <span className="cd-icon">⛔</span>
        <span className="cd-text">Expired</span>
      </div>
    );
  }
  
  const urgent = cd.total < 3 * 86400000;
  const isToday = cd.d === 0;
  
  if (urgent) {
    return (
      <div className="cd-badge cd-badge-urgent">
        <span className="cd-icon">🔥</span>
        <div className="cd-timer">
          {!isToday && <span className="cd-days">{cd.d}d</span>}
          <span className="cd-hours">{String(cd.h).padStart(2, '0')}h</span>
          <span className="cd-mins">{String(cd.m).padStart(2, '0')}m</span>
          <span className="cd-secs">{String(cd.s).padStart(2, '0')}s</span>
        </div>
      </div>
    );
  }
  
  return (
    <div className="cd-badge cd-badge-active">
      <span className="cd-icon">⏳</span>
      <div className="cd-timer">
        {cd.d > 0 && <span className="cd-days">{cd.d}d</span>}
        <span className="cd-hours">{String(cd.h).padStart(2, '0')}h</span>
        <span className="cd-mins">{String(cd.m).padStart(2, '0')}m</span>
        <span className="cd-secs">{String(cd.s).padStart(2, '0')}s</span>
      </div>
    </div>
  );
}

// ── Edit Plan Popup ───────────────────────────────────────────────────────────
function EditPlanModal({ user, onClose, onSaved, token }) {
  // Convert ISO date to datetime-local input format (YYYY-MM-DDTHH:mm)
  const toInputVal = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [expiresAt, setExpiresAt] = useState(toInputVal(user.planExpiresAt));
  const [planBeds, setPlanBeds] = useState(user.planBeds ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const handleSave = async () => {
    setErr("");
    if (!expiresAt && planBeds === "") {
      setErr("Please update at least one field.");
      return;
    }
    setSaving(true);
    try {
      const body = {};
      if (expiresAt) body.planExpiresAt = new Date(expiresAt).toISOString();
      if (planBeds !== "") body.planBeds = Number(planBeds);

      const res = await fetch(`${API}/approval/${user._id}/edit-plan`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.message || "Failed to update."); return; }
      onSaved(data.user);
      onClose();
    } catch {
      setErr("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div>
            <div className="modal-title">✏️ Edit Plan Fields</div>
            <div className="modal-subtitle">{user.name} · {user.email}</div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Current values info */}
        <div className="modal-info-row">
          <div className="modal-info-item">
            <span className="modal-info-label">Current Plan</span>
            <span className="modal-info-value">📋 {user.planName || "—"}</span>
          </div>
          <div className="modal-info-item">
            <span className="modal-info-label">Plan Status</span>
            <span className="modal-info-value">{user.planStatus || "—"}</span>
          </div>
        </div>

        {/* Fields */}
        <div className="modal-fields">
          {/* Plan Expires At */}
          <div className="modal-field-group">
            <label className="modal-label">
              📅 Plan Expires At
              <span className="modal-label-hint">
                Current: {user.planExpiresAt
                  ? new Date(user.planExpiresAt).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
                  : "Not set"}
              </span>
            </label>
            <input
              type="datetime-local"
              className="modal-input"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>

          {/* Plan Beds */}
          <div className="modal-field-group">
            <label className="modal-label">
              🛏️ Plan Beds (Limit)
              <span className="modal-label-hint">
                Current: {user.planBeds != null ? user.planBeds : "Not set"}
              </span>
            </label>
            <input
              type="number"
              className="modal-input"
              min="0"
              placeholder="Enter bed count"
              value={planBeds}
              onChange={(e) => setPlanBeds(e.target.value)}
            />
          </div>
        </div>

        {/* Error */}
        {err && (
          <div className="modal-error">⚠️ {err}</div>
        )}

        {/* Actions */}
        <div className="modal-actions">
          <button className="modal-btn-cancel" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="modal-btn-save" onClick={handleSave} disabled={saving}>
            {saving ? (
              <span className="modal-saving">
                <span className="modal-spinner" /> Saving...
              </span>
            ) : "💾 Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

const fmt = (d) => d
  ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
  : "—";

const STATUS_STYLES = {
  active: { bg: "#ecfdf5", text: "#059669", border: "#10b981", label: "Active", icon: "✅" },
  expired: { bg: "#fef2f2", text: "#dc2626", border: "#ef4444", label: "Expired", icon: "⛔" },
  none: { bg: "#f1f5f9", text: "#64748b", border: "#cbd5e1", label: "No Plan", icon: "📋" },
};

const LOGIN_STYLES = {
  active: { bg: "#ecfdf5", color: "#059669", icon: "🟢" },
  blocked: { bg: "#fef2f2", color: "#dc2626", icon: "🔴" },
  pending: { bg: "#fffbeb", color: "#d97706", icon: "🟡" },
};

export default function MasterPlanMonitor() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  // Edit modal state
  const [editUser, setEditUser] = useState(null);

  const token = sessionStorage.getItem("token");
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const load = async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API}/approval/users-plan`, { headers });
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch { setError("Failed to load users."); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Called after successful save — update user in local state
  const handleUserSaved = (updatedUser) => {
    setUsers((prev) =>
      prev.map((u) => (u._id === updatedUser._id ? { ...u, ...updatedUser } : u))
    );
  };

  const filtered = users.filter(u => {
    const s = search.toLowerCase();
    const matchSearch = !s || u.name?.toLowerCase().includes(s) || u.email?.toLowerCase().includes(s) || u.owner?.toLowerCase().includes(s) || u.planName?.toLowerCase().includes(s);
    const matchFilter = filter === "all"
      || (filter === "pending" && u.loginStatus === "pending")
      || (filter !== "pending" && u.planStatus === filter);
    return matchSearch && matchFilter;
  });

  const counts = {
    all: users.length,
    active: users.filter(u => u.planStatus === "active").length,
    expired: users.filter(u => u.planStatus === "expired").length,
    none: users.filter(u => u.planStatus === "none").length,
    pending: users.filter(u => u.loginStatus === "pending").length,
  };

  return (
    <div className="pm-container">
      <style>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        .pm-container {
          min-height: 100vh;
          background: #f8fafc;
          padding: 32px 28px;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        /* Stats Cards */
        .stat-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          padding: 20px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          position: relative;
          overflow: hidden;
          box-shadow: 0 1px 2px rgba(0,0,0,0.03);
        }

        .stat-card:hover {
          transform: translateY(-2px);
          border-color: #cbd5e1;
          box-shadow: 0 8px 25px -5px rgba(0,0,0,0.08);
        }

        .stat-card.active {
          border-color: #10b981;
          background: #f0fdf4;
          box-shadow: 0 4px 12px rgba(16,185,129,0.1);
        }

        .stat-number {
          font-size: 38px;
          font-weight: 800;
          color: #1e293b;
          letter-spacing: -0.02em;
        }

        .stat-label {
          font-size: 11px;
          font-weight: 600;
          color: #64748b;
          margin-top: 6px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        /* Countdown Badge Styles */
        .cd-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          border-radius: 40px;
          font-weight: 600;
          font-size: 13px;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .cd-badge-active {
          background: #ecfdf5;
          border: 1px solid #d1fae5;
          color: #059669;
        }

        .cd-badge-urgent {
          background: #fef2f2;
          border: 1px solid #fee2e2;
          color: #dc2626;
          animation: softPulse 1.5s ease-in-out infinite;
        }

        @keyframes softPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.75; background: #fff1f1; }
        }

        .cd-badge-expired {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          color: #94a3b8;
        }

        .cd-badge-neutral {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          color: #94a3b8;
        }

        .cd-icon {
          font-size: 13px;
        }

        .cd-timer {
          display: flex;
          gap: 4px;
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
          font-weight: 700;
        }

        .cd-days, .cd-hours, .cd-mins, .cd-secs {
          background: rgba(0,0,0,0.04);
          padding: 2px 6px;
          border-radius: 20px;
        }

        /* Table Styles */
        .data-table {
          width: 100%;
          border-collapse: collapse;
          background: #ffffff;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }

        .data-table thead tr {
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
        }

        .data-table th {
          padding: 16px 16px;
          text-align: left;
          font-size: 11px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          border-bottom: 1px solid #e2e8f0;
          white-space: nowrap;
        }

        .data-table td {
          padding: 16px 16px;
          border-bottom: 1px solid #f1f5f9;
          vertical-align: middle;
          transition: all 0.2s;
        }

        .data-table tbody tr:hover td {
          background: #fafcff;
        }

        .data-table tbody tr:last-child td {
          border-bottom: none;
        }

        /* Status Badges */
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          border-radius: 30px;
          font-size: 12px;
          font-weight: 600;
        }

        /* Search Input */
        .search-input {
          background: #ffffff;
          border: 1.5px solid #e2e8f0;
          border-radius: 48px;
          padding: 12px 20px 12px 48px;
          width: 100%;
          max-width: 380px;
          color: #1e293b;
          font-size: 14px;
          transition: all 0.2s;
          font-family: inherit;
        }

        .search-input:focus {
          outline: none;
          border-color: #10b981;
          box-shadow: 0 0 0 3px rgba(16,185,129,0.1);
        }

        .search-input::placeholder {
          color: #94a3b8;
        }

        /* User details */
        .user-name {
          font-weight: 700;
          color: #0f172a;
          font-size: 14px;
        }

        .user-owner {
          color: #64748b;
          font-size: 11px;
          margin-top: 2px;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .user-email {
          color: #3b82f6;
          font-size: 11px;
          margin-top: 2px;
        }

        .plan-name {
          font-weight: 700;
          color: #0f172a;
          font-size: 14px;
        }

        .plan-details {
          color: #64748b;
          font-size: 11px;
          margin-top: 2px;
        }

        .date-text {
          color: #475569;
          font-size: 12px;
          font-family: monospace;
          white-space: nowrap;
        }

        .expired-date {
          color: #dc2626;
        }

        .renewal-date {
          color: #059669;
        }

        /* Scrollbar */
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        ::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 10px;
        }

        ::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }

        /* Extension badge */
        .ext-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 10px;
          background: #fef3c7;
          border: 1px solid #fde68a;
          border-radius: 30px;
          font-size: 10px;
          font-weight: 600;
          color: #d97706;
          margin-top: 6px;
        }

        /* Loading spinner */
        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #e2e8f0;
          border-top-color: #10b981;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Overflow container */
        .table-container {
          overflow-x: auto;
          border-radius: 20px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
        }

        /* ── Edit Button ───────────────────────────────────────────────────── */
        .edit-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 12px;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
          color: #059669;
          cursor: pointer;
          transition: all 0.18s;
          white-space: nowrap;
          margin-top: 6px;
        }

        .edit-btn:hover {
          background: #dcfce7;
          border-color: #86efac;
          color: #047857;
          transform: translateY(-1px);
          box-shadow: 0 3px 8px rgba(16,185,129,0.15);
        }

        /* ── Modal Overlay ─────────────────────────────────────────────────── */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.45);
          backdrop-filter: blur(4px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          animation: fadeIn 0.18s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        .modal-box {
          background: #ffffff;
          border-radius: 24px;
          width: 100%;
          max-width: 460px;
          box-shadow: 0 24px 60px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.08);
          animation: slideUp 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
          overflow: hidden;
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        .modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 24px 24px 16px;
          border-bottom: 1px solid #f1f5f9;
        }

        .modal-title {
          font-size: 17px;
          font-weight: 700;
          color: #0f172a;
        }

        .modal-subtitle {
          font-size: 12px;
          color: #64748b;
          margin-top: 4px;
        }

        .modal-close {
          background: #f1f5f9;
          border: none;
          border-radius: 50%;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 13px;
          color: #64748b;
          transition: all 0.15s;
          flex-shrink: 0;
        }

        .modal-close:hover {
          background: #fee2e2;
          color: #dc2626;
        }

        .modal-info-row {
          display: flex;
          gap: 12px;
          padding: 14px 24px;
          background: #f8fafc;
          border-bottom: 1px solid #f1f5f9;
        }

        .modal-info-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex: 1;
        }

        .modal-info-label {
          font-size: 10px;
          font-weight: 600;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .modal-info-value {
          font-size: 13px;
          font-weight: 600;
          color: #334155;
        }

        .modal-fields {
          padding: 20px 24px;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .modal-field-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .modal-label {
          font-size: 13px;
          font-weight: 600;
          color: #374151;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .modal-label-hint {
          font-size: 11px;
          font-weight: 400;
          color: #94a3b8;
        }

        .modal-input {
          border: 1.5px solid #e2e8f0;
          border-radius: 12px;
          padding: 10px 14px;
          font-size: 14px;
          color: #1e293b;
          font-family: inherit;
          transition: all 0.2s;
          background: #fafafa;
          width: 100%;
        }

        .modal-input:focus {
          outline: none;
          border-color: #10b981;
          box-shadow: 0 0 0 3px rgba(16,185,129,0.1);
          background: #fff;
        }

        .modal-error {
          margin: 0 24px;
          padding: 10px 14px;
          background: #fef2f2;
          border: 1px solid #fee2e2;
          border-radius: 10px;
          font-size: 13px;
          color: #dc2626;
        }

        .modal-actions {
          display: flex;
          gap: 12px;
          padding: 16px 24px 24px;
          justify-content: flex-end;
        }

        .modal-btn-cancel {
          padding: 10px 20px;
          border: 1.5px solid #e2e8f0;
          border-radius: 12px;
          background: #fff;
          color: #64748b;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
          font-family: inherit;
        }

        .modal-btn-cancel:hover:not(:disabled) {
          background: #f8fafc;
          border-color: #cbd5e1;
        }

        .modal-btn-save {
          padding: 10px 24px;
          background: linear-gradient(135deg, #10b981, #059669);
          border: none;
          border-radius: 12px;
          color: #fff;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
          font-family: inherit;
          box-shadow: 0 2px 8px rgba(16,185,129,0.3);
        }

        .modal-btn-save:hover:not(:disabled) {
          background: linear-gradient(135deg, #059669, #047857);
          box-shadow: 0 4px 14px rgba(16,185,129,0.4);
          transform: translateY(-1px);
        }

        .modal-btn-save:disabled,
        .modal-btn-cancel:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          transform: none;
        }

        .modal-saving {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .modal-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255,255,255,0.4);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          display: inline-block;
        }
      `}</style>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">
          📊 Plan Monitor
        </h1>
        <p className="text-slate-500 mt-1 text-sm">
          Live plan countdown & subscription insights
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {[
          { key: "all", label: "TOTAL USERS", num: counts.all, icon: "👥" },
          { key: "active", label: "ACTIVE PLANS", num: counts.active, icon: "⚡" },
          { key: "expired", label: "EXPIRED PLANS", num: counts.expired, icon: "⛔" },
          { key: "none", label: "NO PLAN", num: counts.none, icon: "📋" },
          { key: "pending", label: "PENDING", num: counts.pending, icon: "⏳" },
        ].map(stat => (
          <div
            key={stat.key}
            className={`stat-card ${filter === stat.key ? 'active' : ''}`}
            onClick={() => setFilter(stat.key)}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="stat-number">{stat.num}</div>
                <div className="stat-label">{stat.label}</div>
              </div>
              <div className="text-2xl opacity-60">{stat.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 text-base">🔍</div>
          <input
            type="text"
            placeholder="Search by name, email, owner or plan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-700 text-sm flex items-center gap-2">
          <span>⚠️</span> {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="bg-white border border-slate-100 rounded-2xl flex flex-col items-center justify-center py-20">
          <div className="spinner mb-4" />
          <p className="text-slate-500">Loading users...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-2xl flex flex-col items-center justify-center py-20">
          <div className="text-5xl mb-4">🔍</div>
          <p className="text-slate-600 text-lg">No users found</p>
          <p className="text-slate-400 text-sm mt-1">Try adjusting your search or filter</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>S.No</th>
                <th>USER</th>
                <th>PLAN</th>
                <th>PLAN STATUS</th>
                <th>LOGIN STATUS</th>
                <th>ACTIVATED AT</th>
                <th>EXPIRES AT</th>
                <th>RENEWAL AT</th>
                <th>TIME REMAINING</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user, idx) => {
                const ps = STATUS_STYLES[user.planStatus] || STATUS_STYLES.none;
                const ls = LOGIN_STYLES[user.loginStatus] || LOGIN_STYLES.active;
                const isExpired = user.planExpiresAt && new Date(user.planExpiresAt) < new Date();
                
                return (
                  <tr key={user._id}>
                    <td className="text-slate-400 font-medium text-sm">{idx + 1}</td>
                    <td>
                      <div className="user-name">{user.name || "—"}</div>
                      <div className="user-owner">
                        <span>🌐</span> {user.owner || "—"}
                      </div>
                      <div className="user-email">{user.email || "—"}</div>
                      {user.extensionRequest?.requested && (
                        <div className="ext-badge">
                          🔄 Extension Requested
                        </div>
                      )}
                    </td>
                    <td>
                      {user.planName ? (
                        <div>
                          <div className="plan-name">📋 {user.planName}</div>
                          {user.plan?.price != null && (
                            <div className="plan-details">
                              ₹{user.plan.price.toLocaleString("en-IN")} · {user.plan?.days}d · {user.plan?.beds} beds
                            </div>
                          )}
                          {user.planBeds != null && (
                            <div className="plan-details" style={{ color: "#7c3aed" }}>
                              🛏️ Limit: {user.planBeds} beds
                            </div>
                          )}
                        </div>
                      ) : user.usedFreePlan ? (
                        <span className="text-emerald-600 font-medium text-sm">✅ Free (used)</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td>
                      <div className="status-badge" style={{ background: ps.bg, border: `1px solid ${ps.border}30` }}>
                        <span>{ps.icon}</span>
                        <span style={{ color: ps.text }}>{ps.label}</span>
                      </div>
                    </td>
                    <td>
                      <div className="status-badge" style={{ background: ls.bg, border: `1px solid ${ls.color}30` }}>
                        <span>{ls.icon}</span>
                        <span style={{ color: ls.color }} className="capitalize">{user.loginStatus || "active"}</span>
                      </div>
                    </td>
                    <td className="date-text">
                      {user.planActivatedAt ? fmt(user.planActivatedAt) : "—"}
                    </td>
                    <td className="date-text">
                      {user.planExpiresAt ? (
                        <span className={isExpired ? "expired-date" : ""}>
                          {fmt(user.planExpiresAt)}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="date-text">
                      {user.planRenewalAt ? (
                        <span className="renewal-date">{fmt(user.planRenewalAt)}</span>
                      ) : "—"}
                    </td>
                    <td>
                      <CountdownBadge expiresAt={user.planExpiresAt} planStatus={user.planStatus} />
                    </td>
                    {/* ── Actions column with Edit button ── */}
                    <td>
                      <button
                        className="edit-btn"
                        onClick={() => setEditUser(user)}
                        title="Edit plan expiry and bed limit"
                      >
                        ✏️ Edit Plan
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Edit Plan Modal ── */}
      {editUser && (
        <EditPlanModal
          user={editUser}
          token={token}
          onClose={() => setEditUser(null)}
          onSaved={handleUserSaved}
        />
      )}
    </div>
  );
}