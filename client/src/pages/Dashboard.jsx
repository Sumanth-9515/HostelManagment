import { useState, useEffect, useCallback } from "react";

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const API  = `${BASE}`;
const getToken = () => sessionStorage.getItem("token") || "";

const authHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
});

const decodeJWT = (token) => {
  try {
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(b64));
  } catch { return null; }
};

const apiFetch = async (path) => {
  const res = await fetch(`${API}${path}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`${res.status} error`);
  return res.json();
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmt = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(n || 0);

const pct  = (num, den) => (den > 0 ? Math.round((num / den) * 100) : 0);
const clamp = (v) => Math.min(100, Math.max(0, v));

const greet = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

const monthLabel = () =>
  new Date().toLocaleString("default", { month: "long", year: "numeric" });

// ─── UI COMPONENTS ────────────────────────────────────────────────────────────
const Skel = ({ className = "" }) => (
  <div className={`animate-pulse bg-gray-100 rounded-xl ${className}`} />
);

const Avatar = ({ name = "?", size = "md", color = "#6366f1" }) => {
  const sz = { sm: "w-7 h-7 text-xs", md: "w-9 h-9 text-sm", lg: "w-12 h-12 text-base" };
  return (
    <div
      className={`${sz[size]} rounded-full flex items-center justify-center font-bold shrink-0 select-none`}
      style={{ background: color + "22", color }}
    >
      {(name?.[0] || "?").toUpperCase()}
    </div>
  );
};

function KpiCard({ icon, label, value, sub, accent, loading }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col gap-3" style={{ borderTop: `3px solid ${accent}` }}>
      {loading ? (
        <><Skel className="h-10 w-10" /><Skel className="h-7 w-24" /><Skel className="h-4 w-32" /></>
      ) : (
        <>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: accent + "18", color: accent }}>{icon}</div>
          <div>
            <p className="text-2xl font-extrabold text-gray-900 tracking-tight leading-none">{value}</p>
            <p className="text-xs font-medium text-gray-500 mt-1">{label}</p>
          </div>
          {sub && <p className="text-xs text-gray-400 leading-tight">{sub}</p>}
        </>
      )}
    </div>
  );
}

function Bar({ value, total, color = "#6366f1", height = "h-2" }) {
  const p = clamp(pct(value, total));
  return (
    <div className={`w-full ${height} bg-gray-100 rounded-full overflow-hidden`}>
      <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${p}%`, background: color }} />
    </div>
  );
}

function Donut({ value, total, color = "#6366f1" }) {
  const p = clamp(pct(value, total));
  const r = 15.915;
  const c = 2 * Math.PI * r;
  const dash = (p / 100) * c;
  return (
    <div className="relative w-20 h-20 shrink-0">
      <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
        <circle cx="18" cy="18" r={r} fill="none" stroke="#f3f4f6" strokeWidth="3" />
        <circle cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${dash} ${c - dash}`} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-sm font-extrabold text-gray-800">{p}%</div>
    </div>
  );
}

function BuildingCard({ b }) {
  const occ = pct(b.occupiedBeds, b.totalBeds);
  const accent = occ >= 80 ? "#10b981" : occ >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0 pr-2">
          <h3 className="font-bold text-gray-800 text-sm truncate">{b.buildingName}</h3>
          {b.address && <p className="text-xs text-gray-400 mt-0.5 truncate">{b.address}</p>}
        </div>
        <span className="shrink-0 text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: accent + "18", color: accent }}>{occ}% full</span>
      </div>
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1.5">
          <span>{b.occupiedBeds} occupied</span>
          <span>{b.availableBeds} free</span>
        </div>
        <Bar value={b.occupiedBeds} total={b.totalBeds} color={accent} />
      </div>
      <div className="grid grid-cols-3 divide-x divide-gray-100">
        {[ { label: "Floors", val: b.totalFloors }, { label: "Rooms", val: b.totalRooms }, { label: "Beds", val: b.totalBeds } ].map(({ label, val }) => (
          <div key={label} className="text-center px-2">
            <p className="font-extrabold text-gray-800 text-lg leading-none">{val}</p>
            <p className="text-xs text-gray-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-gray-50">
        <span className="text-xs text-gray-500">👤 {b.totalTenants} tenants</span>
        <span className="text-sm font-bold text-gray-700">{fmt(b.totalRevenue)}<span className="text-xs font-normal text-gray-400">/mo</span></span>
      </div>
    </div>
  );
}

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [overview, setOverview] = useState([]);
  const [allTenants, setAllTenants] = useState([]);
  const [owner, setOwner] = useState(null);
  
  const [loadingBuildings, setLoadingBuildings] = useState(true);
  const [loadingRent, setLoadingRent] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("user");
    if (stored) {
      try { setOwner(JSON.parse(stored)); } catch { setOwner(decodeJWT(getToken())); }
    } else {
      setOwner(decodeJWT(getToken()));
    }
  }, []);

  const fetchBuildings = useCallback(async () => {
    setLoadingBuildings(true);
    try {
      const data = await apiFetch("/buildings/stats/overview");
      setOverview(Array.isArray(data) ? data : []);
    } catch (e) { setError(e.message); }
    finally { setLoadingBuildings(false); }
  }, []);

  const fetchRent = useCallback(async () => {
    setLoadingRent(true);
    try {
      const data = await apiFetch("/rent/all");
      setAllTenants(Array.isArray(data) ? data : []);
    } catch (e) { setError(e.message); }
    finally { setLoadingRent(false); }
  }, []);

  useEffect(() => {
    fetchBuildings();
    fetchRent();
  }, [fetchBuildings, fetchRent]);

  const totalBuildings = overview.length;
  const totalBeds      = overview.reduce((s, b) => s + b.totalBeds, 0);
  const occupiedBeds   = overview.reduce((s, b) => s + b.occupiedBeds, 0);
  const availableBeds  = totalBeds - occupiedBeds;
  const totalRevenue   = allTenants.reduce((s, t) => s + (t.record?.rentAmount || 0), 0);
  const collectedRev   = allTenants.reduce((s, t) => s + (t.record?.paidAmount || 0), 0);
  const pendingRev     = allTenants.reduce((s, t) => s + (t.remaining || 0), 0);
  const paidCount      = allTenants.filter((t) => t.record?.status === "Paid").length;
  const partialCount   = allTenants.filter((t) => t.record?.status === "Partial").length;
  const dueCount       = allTenants.filter((t) => t.record?.status === "Due").length;

  const ownerName = owner?.owner || owner?.name || "Owner";
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="min-h-screen bg-[#f7f8fc]">
      {/* HEADER */}
      <div className="bg-white border-b border-gray-100 px-5 sm:px-8 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <div>
          <h1 className="text-base sm:text-lg font-bold text-gray-900">
            {greet()}, <span className="text-indigo-600">{ownerName}</span> 👋
          </h1>
          <p className="text-xs text-gray-400">{today}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => { fetchBuildings(); fetchRent(); }} className="px-3 py-2 text-xs font-semibold text-indigo-600 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors">
            ↻ Refresh
          </button>
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5">
            <Avatar name={ownerName} size="sm" color="#6366f1" />
            <div className="hidden sm:block leading-tight">
              <p className="text-xs font-bold text-gray-700 truncate max-w-[120px]">{ownerName}</p>
              <p className="text-[10px] text-gray-400 truncate max-w-[130px]">{owner?.email || "Property Manager"}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-7">
        
        {/* KPI STRIP (Occupancy card removed, updated to lg:grid-cols-5) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiCard icon="🏢" label="Buildings" value={loadingBuildings ? "—" : totalBuildings} accent="#6366f1" loading={loadingBuildings} />
          <KpiCard icon="🛏️" label="Total Beds" value={loadingBuildings ? "—" : totalBeds} sub={`${availableBeds} available`} accent="#0ea5e9" loading={loadingBuildings} />
          <KpiCard icon="👥" label="Total Tenants" value={loadingRent ? "—" : allTenants.length} sub="Active residents" accent="#8b5cf6" loading={loadingRent} />
          <KpiCard icon="💰" label="Collected" value={loadingRent ? "—" : fmt(collectedRev)} sub={`${pct(collectedRev, totalRevenue)}% of target`} accent="#10b981" loading={loadingRent} />
          <KpiCard icon="⏳" label="Pending" value={loadingRent ? "—" : fmt(pendingRev)} sub="Outstanding rent" accent="#ef4444" loading={loadingRent} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Revenue Panel */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-gray-800 text-sm">Monthly Revenue</h2>
              <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">{monthLabel()}</span>
            </div>
            {loadingRent ? (
              <div className="space-y-3"><Skel className="h-9 w-40" /><Skel className="h-3 w-full" /><Skel className="h-14" /></div>
            ) : (
              <>
                <div className="flex items-end gap-3 mb-3">
                  <p className="text-3xl font-black text-gray-900">{fmt(collectedRev)}</p>
                  <p className="text-xs text-gray-400 mb-1">of {fmt(totalRevenue)} expected</p>
                  <p className="text-2xl font-black text-indigo-500 ml-auto">{pct(collectedRev, totalRevenue)}%</p>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-5">
                  <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct(collectedRev, totalRevenue)}%` }} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-emerald-50 rounded-xl p-3 text-center">
                    <p className="text-xl font-extrabold text-emerald-600">{paidCount}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Paid</p>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-3 text-center">
                    <p className="text-xl font-extrabold text-amber-600">{partialCount}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Partial</p>
                  </div>
                  <div className="bg-red-50 rounded-xl p-3 text-center">
                    <p className="text-xl font-extrabold text-red-600">{dueCount}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Due</p>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Occupancy Panel */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h2 className="font-bold text-gray-800 text-sm mb-5">Bed Occupancy Detail</h2>
            {loadingBuildings ? (
              <div className="flex gap-6"><Skel className="w-20 h-20 rounded-full" /><div className="flex-1 space-y-3"><Skel className="h-4" /><Skel className="h-4 w-3/4" /></div></div>
            ) : (
              <>
                <div className="flex items-center gap-6 mb-5">
                  <Donut value={occupiedBeds} total={totalBeds} color="#6366f1" />
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-indigo-500" /><span className="text-xs text-gray-500 flex-1">Occupied</span><span className="text-xs font-bold text-gray-800">{occupiedBeds}</span></div>
                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-gray-200" /><span className="text-xs text-gray-500 flex-1">Available</span><span className="text-xs font-bold text-gray-800">{availableBeds}</span></div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-4 border-t border-gray-50">
                  <div className="text-center"><p className="font-extrabold text-gray-800">{overview.reduce((s, b) => s + b.totalFloors, 0)}</p><p className="text-xs text-gray-400">Floors</p></div>
                  <div className="text-center"><p className="font-extrabold text-gray-800">{overview.reduce((s, b) => s + b.totalRooms, 0)}</p><p className="text-xs text-gray-400">Rooms</p></div>
                  <div className="text-center"><p className="font-extrabold text-gray-800">{totalBeds}</p><p className="text-xs text-gray-400">Beds</p></div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* BUILDINGS GRID */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-800 text-sm">Properties</h2>
            <span className="text-xs text-gray-400">{totalBuildings} buildings total</span>
          </div>
          {loadingBuildings ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => <Skel key={i} className="h-52" />)}
            </div>
          ) : overview.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
              <p className="text-3xl mb-2">🏗️</p>
              <p className="text-sm text-gray-400">No properties managed yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {overview.map((b) => <BuildingCard key={b.buildingId} b={b} />)}
            </div>
          )}
        </div>

        <p className="text-center text-[10px] uppercase tracking-widest text-gray-300 pb-4">
          Property Management Dashboard · {owner?.email}
        </p>
      </div>
    </div>
  );
}