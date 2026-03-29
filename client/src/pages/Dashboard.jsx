import { useState, useEffect, useCallback } from "react";

// ─── CONFIG ───────────────────────────────────────────────────────────────────
// Matches Rentmanagement.jsx & Addcandidate.jsx exactly:
// VITE_API_URL = "http://localhost:5000"  (no /api suffix here)
const BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";
const API  = `${BASE}/api`;

// ✅ sessionStorage — matches RegisterPage.jsx & Rentmanagement.jsx
const getToken = () => sessionStorage.getItem("token") || "";

// ✅ Same pattern as Rentmanagement.jsx authHeader()
const authHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
});

// Decode JWT payload (no library needed)
const decodeJWT = (token) => {
  try {
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(b64));
  } catch {
    return null;
  }
};

const apiFetch = async (path) => {
  const res = await fetch(`${API}${path}`, { headers: authHeaders() });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `${res.status} ${res.statusText}`);
  }
  return res.json();
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmt = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(n || 0);

const pct  = (num, den) => (den > 0 ? Math.round((num / den) * 100) : 0);
const clamp = (v) => Math.min(100, Math.max(0, v));

const STATUS_STYLE = {
  Paid:    { bg: "bg-emerald-50", text: "text-emerald-700", dot: "#10b981" },
  Partial: { bg: "bg-amber-50",   text: "text-amber-700",   dot: "#f59e0b" },
  Due:     { bg: "bg-red-50",     text: "text-red-600",     dot: "#ef4444" },
};

const greet = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

const monthLabel = () =>
  new Date().toLocaleString("default", { month: "long", year: "numeric" });

// ─── SKELETON ─────────────────────────────────────────────────────────────────
const Skel = ({ className = "" }) => (
  <div className={`animate-pulse bg-gray-100 rounded-xl ${className}`} />
);

// ─── AVATAR ───────────────────────────────────────────────────────────────────
const Avatar = ({ name = "?", size = "md", color = "#6366f1" }) => {
  const sz = {
    sm: "w-7 h-7 text-xs",
    md: "w-9 h-9 text-sm",
    lg: "w-12 h-12 text-base",
  };
  return (
    <div
      className={`${sz[size]} rounded-full flex items-center justify-center font-bold shrink-0 select-none`}
      style={{ background: color + "22", color }}
    >
      {(name?.[0] || "?").toUpperCase()}
    </div>
  );
};

// ─── KPI CARD ─────────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, accent, loading }) {
  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col gap-3"
      style={{ borderTop: `3px solid ${accent}` }}
    >
      {loading ? (
        <>
          <Skel className="h-10 w-10" />
          <Skel className="h-7 w-24" />
          <Skel className="h-4 w-32" />
        </>
      ) : (
        <>
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
            style={{ background: accent + "18", color: accent }}
          >
            {icon}
          </div>
          <div>
            <p className="text-2xl font-extrabold text-gray-900 tracking-tight leading-none">
              {value}
            </p>
            <p className="text-xs font-medium text-gray-500 mt-1">{label}</p>
          </div>
          {sub && <p className="text-xs text-gray-400 leading-tight">{sub}</p>}
        </>
      )}
    </div>
  );
}

// ─── PROGRESS BAR ─────────────────────────────────────────────────────────────
function Bar({ value, total, color = "#6366f1", height = "h-2" }) {
  const p = clamp(pct(value, total));
  return (
    <div className={`w-full ${height} bg-gray-100 rounded-full overflow-hidden`}>
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{ width: `${p}%`, background: color }}
      />
    </div>
  );
}

// ─── DONUT ────────────────────────────────────────────────────────────────────
function Donut({ value, total, color = "#6366f1" }) {
  const p   = clamp(pct(value, total));
  const r   = 15.915;
  const c   = 2 * Math.PI * r;
  const dash = (p / 100) * c;
  return (
    <div className="relative w-20 h-20 shrink-0">
      <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
        <circle cx="18" cy="18" r={r} fill="none" stroke="#f3f4f6" strokeWidth="3" />
        <circle
          cx="18" cy="18" r={r} fill="none"
          stroke={color} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-extrabold text-gray-800">{p}%</span>
      </div>
    </div>
  );
}

// ─── BUILDING CARD ────────────────────────────────────────────────────────────
function BuildingCard({ b }) {
  const occ    = pct(b.occupiedBeds, b.totalBeds);
  const accent = occ >= 80 ? "#10b981" : occ >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0 pr-2">
          <h3 className="font-bold text-gray-800 text-sm truncate">{b.buildingName}</h3>
          {b.address && (
            <p className="text-xs text-gray-400 mt-0.5 truncate">{b.address}</p>
          )}
        </div>
        <span
          className="shrink-0 text-xs font-bold px-2.5 py-1 rounded-full"
          style={{ background: accent + "18", color: accent }}
        >
          {occ}% full
        </span>
      </div>

      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1.5">
          <span>{b.occupiedBeds} occupied</span>
          <span>{b.availableBeds} free</span>
        </div>
        <Bar value={b.occupiedBeds} total={b.totalBeds} color={accent} />
      </div>

      <div className="grid grid-cols-3 divide-x divide-gray-100">
        {[
          { label: "Floors", val: b.totalFloors },
          { label: "Rooms",  val: b.totalRooms  },
          { label: "Beds",   val: b.totalBeds   },
        ].map(({ label, val }) => (
          <div key={label} className="text-center px-2">
            <p className="font-extrabold text-gray-800 text-lg leading-none">{val}</p>
            <p className="text-xs text-gray-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-gray-50">
        <span className="text-xs text-gray-500">👤 {b.totalTenants} tenants</span>
        <span className="text-sm font-bold text-gray-700">
          {fmt(b.totalRevenue)}
          <span className="text-xs font-normal text-gray-400">/mo</span>
        </span>
      </div>
    </div>
  );
}

// ─── RENT ALERT CARD ──────────────────────────────────────────────────────────
function AlertCard({ item }) {
  const { tenant, record, remaining, isOverdue, daysOverdue, daysUntilDue } = item;
  const accent   = isOverdue ? "#ef4444" : "#f59e0b";
  const bgBorder = isOverdue ? "bg-red-50 border-red-100" : "bg-amber-50 border-amber-100";
  const tClass   = isOverdue ? "text-red-600" : "text-amber-600";
  const dueLabel =
    isOverdue ? `${daysOverdue}d overdue`
    : daysUntilDue === 0 ? "Due today"
    : `Due in ${daysUntilDue}d`;

  return (
    <div className={`border rounded-2xl p-4 flex gap-3 items-start ${bgBorder}`}>
      <Avatar name={tenant.name} color={accent} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-gray-800 text-sm truncate">{tenant.name}</p>
            <p className="text-xs text-gray-500 truncate">
              {tenant.allocationInfo?.buildingName || "—"} · Room{" "}
              {tenant.allocationInfo?.roomNumber || "—"} · Bed{" "}
              {tenant.allocationInfo?.bedNumber || "—"}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-extrabold text-sm text-gray-800">{fmt(remaining)}</p>
            <p className={`text-xs font-semibold ${tClass}`}>{dueLabel}</p>
          </div>
        </div>
        <div className="mt-2.5">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>{fmt(record?.paidAmount || 0)} paid</span>
            <span>{pct(record?.paidAmount || 0, record?.rentAmount || 1)}%</span>
          </div>
          <Bar
            value={record?.paidAmount || 0}
            total={record?.rentAmount || 1}
            color={accent}
            height="h-1"
          />
        </div>
      </div>
    </div>
  );
}

// ─── TENANT ROW ───────────────────────────────────────────────────────────────
function TenantRow({ item }) {
  const { tenant, record, remaining } = item;
  const p       = pct(record?.paidAmount || 0, record?.rentAmount || 1);
  const st      = STATUS_STYLE[record?.status] || STATUS_STYLE.Due;
  const barColor = p === 100 ? "#10b981" : p > 0 ? "#f59e0b" : "#ef4444";

  return (
    <tr className="border-b border-gray-50 hover:bg-slate-50/70 transition-colors">
      <td className="py-3 px-4">
        <div className="flex items-center gap-2.5">
          <Avatar name={tenant.name} size="sm" color="#6366f1" />
          <div>
            <p className="text-sm font-semibold text-gray-800 leading-tight">{tenant.name}</p>
            <p className="text-xs text-gray-400">{tenant.phone}</p>
          </div>
        </div>
      </td>
      <td className="py-3 px-4 text-xs text-gray-600">
        <span className="truncate block max-w-[120px]">
          {tenant.allocationInfo?.buildingName || "—"}
        </span>
      </td>
      <td className="py-3 px-4 text-xs text-gray-600">
        {tenant.allocationInfo?.roomNumber ? (
          `Rm ${tenant.allocationInfo.roomNumber} · Bed ${tenant.allocationInfo.bedNumber}`
        ) : (
          <span className="text-gray-300 italic">Not assigned</span>
        )}
      </td>
      <td className="py-3 px-4 min-w-[110px]">
        <div className="flex items-center gap-2">
          <Bar
            value={record?.paidAmount || 0}
            total={record?.rentAmount || 1}
            color={barColor}
            height="h-1.5"
          />
          <span className="text-xs text-gray-400 shrink-0">{p}%</span>
        </div>
      </td>
      <td className="py-3 px-4">
        <span
          className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${st.bg} ${st.text}`}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.dot }} />
          {record?.status || "Due"}
        </span>
      </td>
      <td className="py-3 px-4 text-right">
        <p className="text-sm font-bold text-gray-800">{fmt(record?.rentAmount)}</p>
        {remaining > 0 && (
          <p className="text-xs text-red-400">−{fmt(remaining)}</p>
        )}
      </td>
    </tr>
  );
}

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [overview,   setOverview]   = useState([]);
  const [dueList,    setDueList]    = useState([]);
  const [allTenants, setAllTenants] = useState([]);
  const [owner,      setOwner]      = useState(null);   // from sessionStorage user / JWT
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [searchQ,    setSearchQ]    = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  // ── Read owner from sessionStorage (set by RegisterPage / LoginPage) ────────
  useEffect(() => {
    // 1. Try the "user" object stored by RegisterPage.jsx
    const stored = sessionStorage.getItem("user");
    if (stored) {
      try {
        setOwner(JSON.parse(stored));
        return;
      } catch { /* fall through */ }
    }
    // 2. Fallback: decode the JWT itself
    const token = getToken();
    if (token) setOwner(decodeJWT(token));
  }, []);

  // ── Fetch all dashboard data ─────────────────────────────────────────────
  // Route paths must match how you mount in app.js:
  //   app.use("/api/buildings", buildingRoutes)  →  /buildings/stats/overview
  //   app.use("/api/rent",      rentRoutes)       →  /rent/due  /rent/all
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ov, due, all] = await Promise.all([
        apiFetch("/buildings/stats/overview"),
        apiFetch("/rent/due"),
        apiFetch("/rent/all"),
      ]);
      setOverview(Array.isArray(ov)  ? ov  : []);
      setDueList(Array.isArray(due)  ? due : []);
      setAllTenants(Array.isArray(all) ? all : []);
      setLastRefresh(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 60_000);
    return () => clearInterval(id);
  }, [fetchAll]);

  // ── Aggregate KPIs ───────────────────────────────────────────────────────
  const totalBuildings = overview.length;
  const totalBeds      = overview.reduce((s, b) => s + b.totalBeds, 0);
  const occupiedBeds   = overview.reduce((s, b) => s + b.occupiedBeds, 0);
  const availableBeds  = totalBeds - occupiedBeds;
  const totalRevenue   = allTenants.reduce((s, t) => s + (t.record?.rentAmount || 0), 0);
  const collectedRev   = allTenants.reduce((s, t) => s + (t.record?.paidAmount || 0), 0);
  const pendingRev     = allTenants.reduce((s, t) => s + (t.remaining || 0), 0);
  const totalTenants   = allTenants.length;
  const paidCount      = allTenants.filter((t) => t.record?.status === "Paid").length;
  const partialCount   = allTenants.filter((t) => t.record?.status === "Partial").length;
  const dueCount       = allTenants.filter((t) => t.record?.status === "Due").length;
  const overdueCount   = dueList.filter((t) => t.isOverdue).length;

  // ── Filter tenants table ─────────────────────────────────────────────────
  const filtered = allTenants.filter((t) => {
    const q = searchQ.toLowerCase();
    const matchQ =
      !q ||
      t.tenant?.name?.toLowerCase().includes(q) ||
      t.tenant?.phone?.includes(q) ||
      t.tenant?.allocationInfo?.roomNumber?.toLowerCase().includes(q) ||
      t.tenant?.allocationInfo?.buildingName?.toLowerCase().includes(q);
    const matchSt = statusFilter === "All" || t.record?.status === statusFilter;
    return matchQ && matchSt;
  });

  // ── Owner display name ───────────────────────────────────────────────────
  // RegisterPage stores: { name (property name), owner (real name), email, ph, ... }
  const ownerName  = owner?.owner || owner?.name || owner?.email?.split("@")[0] || "Owner";
  const ownerEmail = owner?.email || "";

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  // ── Error screen ─────────────────────────────────────────────────────────
  if (error && !loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl border border-red-100 p-10 text-center shadow-md max-w-sm w-full">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="font-bold text-gray-800 text-lg mb-2">Couldn't load dashboard</h2>
          <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-2 mb-3 break-words">
            {error}
          </p>
          <p className="text-xs text-gray-400 mb-6">
            API:{" "}
            <code className="bg-gray-100 px-1 rounded text-indigo-600 text-xs">{API}</code>
          </p>
          <button
            onClick={fetchAll}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8fc]">

      {/* ════════════════════════ TOP BAR ════════════════════════════════════ */}
      <div className="bg-white border-b border-gray-100 px-5 sm:px-8 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">

        {/* Left — greeting */}
        <div>
          {!owner && loading ? (
            <><Skel className="h-5 w-44 mb-1" /><Skel className="h-3 w-32" /></>
          ) : (
            <>
              <h1 className="text-base sm:text-lg font-bold text-gray-900 leading-tight">
                {greet()},{" "}
                <span className="text-indigo-600">{ownerName}</span> 👋
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">{today}</p>
            </>
          )}
        </div>

        {/* Right — refresh + owner chip */}
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="hidden sm:block text-xs text-gray-400">
              {lastRefresh.toLocaleTimeString()}
            </span>
          )}

          <button
            onClick={fetchAll}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-indigo-600 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors disabled:opacity-40"
          >
            <span
              style={{ display: "inline-block" }}
              className={loading ? "animate-spin" : ""}
            >
              ↻
            </span>
            Refresh
          </button>

          {/* Owner chip */}
          {owner && (
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5">
              <Avatar name={ownerName} size="sm" color="#6366f1" />
              <div className="hidden sm:block leading-tight">
                <p className="text-xs font-bold text-gray-700 truncate max-w-[120px]">
                  {ownerName}
                </p>
                {ownerEmail && (
                  <p className="text-[10px] text-gray-400 truncate max-w-[130px]">
                    {ownerEmail}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ════════════════════════ PAGE BODY ══════════════════════════════════ */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-7">

        {/* ── KPI STRIP ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          {[
            {
              icon: "🏢", label: "Buildings",
              value: loading ? "—" : totalBuildings,
              accent: "#6366f1",
            },
            {
              icon: "🛏️", label: "Total Beds",
              value: loading ? "—" : totalBeds,
              sub: `${availableBeds} available`,
              accent: "#0ea5e9",
            },
            {
              icon: "✅", label: "Occupied",
              value: loading ? "—" : occupiedBeds,
              sub: `${pct(occupiedBeds, totalBeds)}% occupancy`,
              accent: "#10b981",
            },
            {
              icon: "👥", label: "Active Tenants",
              value: loading ? "—" : totalTenants,
              sub: `${paidCount} paid this month`,
              accent: "#8b5cf6",
            },
            {
              icon: "💰", label: "Collected",
              value: loading ? "—" : fmt(collectedRev),
              sub: `${pct(collectedRev, totalRevenue)}% of expected`,
              accent: "#10b981",
            },
            {
              icon: "⏳", label: "Pending",
              value: loading ? "—" : fmt(pendingRev),
              sub: `${overdueCount} overdue`,
              accent: "#ef4444",
            },
          ].map((s) => (
            <KpiCard key={s.label} {...s} loading={loading} />
          ))}
        </div>

        {/* ── REVENUE + OCCUPANCY ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Revenue panel */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-gray-800 text-sm">Monthly Revenue</h2>
              <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">
                {monthLabel()}
              </span>
            </div>

            {loading ? (
              <div className="space-y-3">
                <Skel className="h-9 w-40" />
                <Skel className="h-3 w-full" />
                <Skel className="h-14" />
              </div>
            ) : (
              <>
                <div className="flex items-end gap-3 mb-3">
                  <p className="text-3xl font-black text-gray-900">{fmt(collectedRev)}</p>
                  <p className="text-xs text-gray-400 mb-1">
                    of {fmt(totalRevenue)} expected
                  </p>
                  <p className="text-2xl font-black text-indigo-500 ml-auto">
                    {pct(collectedRev, totalRevenue)}%
                  </p>
                </div>

                <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-5">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${clamp(pct(collectedRev, totalRevenue))}%`,
                      background: "linear-gradient(90deg,#6366f1,#8b5cf6)",
                    }}
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Paid",    count: paidCount,    color: "#10b981", bg: "bg-emerald-50" },
                    { label: "Partial", count: partialCount, color: "#f59e0b", bg: "bg-amber-50" },
                    { label: "Pending", count: dueCount,     color: "#ef4444", bg: "bg-red-50" },
                  ].map(({ label, count, color, bg }) => (
                    <div key={label} className={`${bg} rounded-xl p-3 text-center`}>
                      <p className="text-xl font-extrabold" style={{ color }}>{count}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Occupancy panel */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-gray-800 text-sm">Bed Occupancy</h2>
              <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">
                {totalBuildings} building{totalBuildings !== 1 ? "s" : ""}
              </span>
            </div>

            {loading ? (
              <div className="flex gap-6">
                <Skel className="w-20 h-20 rounded-full" />
                <div className="flex-1 space-y-3">
                  <Skel className="h-4" />
                  <Skel className="h-4 w-3/4" />
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-6 mb-5">
                  <Donut value={occupiedBeds} total={totalBeds} color="#6366f1" />
                  <div className="space-y-3 flex-1">
                    {[
                      { label: "Occupied",  val: occupiedBeds,  color: "#6366f1" },
                      { label: "Available", val: availableBeds, color: "#e5e7eb" },
                    ].map(({ label, val, color }) => (
                      <div key={label} className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-sm shrink-0"
                          style={{ background: color }}
                        />
                        <span className="text-xs text-gray-500 flex-1">{label}</span>
                        <span className="text-xs font-bold text-gray-800">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-4 border-t border-gray-50">
                  {[
                    { label: "Floors", val: overview.reduce((s, b) => s + b.totalFloors, 0) },
                    { label: "Rooms",  val: overview.reduce((s, b) => s + b.totalRooms, 0) },
                    { label: "Beds",   val: totalBeds },
                  ].map(({ label, val }) => (
                    <div key={label} className="text-center">
                      <p className="font-extrabold text-gray-800">{val}</p>
                      <p className="text-xs text-gray-400">{label}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── BUILDINGS GRID ──────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-800 text-sm">Properties</h2>
            <span className="text-xs text-gray-400">{totalBuildings} total</span>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => <Skel key={i} className="h-52" />)}
            </div>
          ) : overview.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
              <p className="text-3xl mb-2">🏗️</p>
              <p className="text-sm text-gray-400">No buildings added yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {overview.map((b) => (
                <BuildingCard key={b.buildingId} b={b} />
              ))}
            </div>
          )}
        </div>

        {/* ── RENT ALERTS ─────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-gray-800 text-sm">Rent Alerts</h2>
              {dueList.length > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {dueList.length}
                </span>
              )}
            </div>
            <span className="text-xs text-gray-400">Overdue + due within 2 days</span>
          </div>

          {loading ? (
            <div className="grid sm:grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => <Skel key={i} className="h-20" />)}
            </div>
          ) : dueList.length === 0 ? (
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-8 text-center">
              <p className="text-2xl mb-2">🎉</p>
              <p className="text-emerald-700 font-semibold text-sm">All caught up!</p>
              <p className="text-xs text-emerald-500 mt-1">
                No overdue or upcoming rent payments.
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {dueList.map((item) => (
                <AlertCard key={item.tenant._id} item={item} />
              ))}
            </div>
          )}
        </div>

        {/* ── TENANTS TABLE ───────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

          {/* Table toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-gray-50">
            <div>
              <h2 className="font-bold text-gray-800 text-sm">All Tenants</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {monthLabel()} · {totalTenants} active
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {["All", "Paid", "Partial", "Due"].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                    statusFilter === s
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {s}
                </button>
              ))}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search…"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  className="pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-xl w-36 sm:w-48 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]">
                  🔍
                </span>
              </div>
            </div>
          </div>

          {/* Table body */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => <Skel key={i} className="h-11" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-3xl mb-2">🔍</p>
                <p className="text-sm text-gray-400">
                  {searchQ || statusFilter !== "All"
                    ? "No tenants match your filters."
                    : "No active tenants yet."}
                </p>
              </div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-100 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Tenant</th>
                    <th className="py-3 px-4">Building</th>
                    <th className="py-3 px-4">Room · Bed</th>
                    <th className="py-3 px-4 min-w-[120px]">Paid</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Rent</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <TenantRow key={item.tenant._id} item={item} />
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Table footer totals */}
          {!loading && filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-gray-50 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-gray-400">
                Showing{" "}
                <span className="font-semibold text-gray-600">{filtered.length}</span> of{" "}
                <span className="font-semibold text-gray-600">{totalTenants}</span> tenants
              </p>
              <div className="flex gap-4 text-xs text-gray-500 flex-wrap">
                <span>
                  Expected:{" "}
                  <span className="font-semibold text-gray-700">{fmt(totalRevenue)}</span>
                </span>
                <span>
                  Collected:{" "}
                  <span className="font-semibold text-emerald-600">{fmt(collectedRev)}</span>
                </span>
                <span>
                  Pending:{" "}
                  <span className="font-semibold text-red-500">{fmt(pendingRev)}</span>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Page footer */}
        <p className="text-center text-xs text-gray-300 pb-4">
          Auto-refreshes every 60 s
          {ownerEmail ? ` · ${ownerEmail}` : ""}
        </p>
      </div>
    </div>
  );
}