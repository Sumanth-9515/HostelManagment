import { useState, useEffect, useCallback } from "react";
import { CalendarDays, ChevronRight, MessageCircle, Phone, X } from "lucide-react";

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const API  = `${BASE}`;
const getToken = () => localStorage.getItem("token") || "";

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

const currentMonthValue = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const monthOptions = (count = 24) => {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return { value, label: monthLabel(value) };
  });
};

const monthLabel = (monthYear = currentMonthValue()) => {
  const [year, month] = monthYear.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleString("default", { month: "long", year: "numeric" });
};

const locationLabel = (item) => {
  const tenant = item?.tenant || {};
  const allocation = tenant.allocationInfo || {};
  const details = item?.buildingDetails || {};
  const building = details.buildingName || allocation.buildingName;
  const floor = details.floorName || (details.floorNumber ? `Floor ${details.floorNumber}` : allocation.floorNumber ? `Floor ${allocation.floorNumber}` : "");
  const room = details.roomNumber || allocation.roomNumber;
  return [building, floor, room ? `Room ${room}` : ""].filter(Boolean).join(" · ") || "Location not assigned";
};

const buildRentMessage = (item, selectedMonth) => {
  const tenant = item?.tenant || {};
  const remaining = item?.remaining || 0;
  return encodeURIComponent(
    `Hello ${tenant.name || "there"}, your rent status for ${monthLabel(selectedMonth)} is ${item?.record?.status || "Due"}. Pending amount: ${fmt(remaining)}. Location: ${locationLabel(item)}.`
  );
};

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

function RevenueDetailsModal({ open, onClose, data, selectedMonth }) {
  if (!open) return null;

  const summary = data?.summary || {};
  const tenants = Array.isArray(data?.tenants) ? data.tenants : [];
  const groups = [
    { key: "Due", title: "Due", tone: "red", empty: "No full dues for this month." },
    { key: "Partial", title: "Partial", tone: "amber", empty: "No partial payments for this month." },
  ];
  const toneClasses = {
    red: "bg-red-50 text-red-700 border-red-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-950/45 backdrop-blur-sm flex items-center justify-center px-2 sm:px-3 py-3 sm:py-5">
      <div className="bg-white w-full max-w-5xl max-h-[94vh] sm:max-h-[92vh] overflow-hidden rounded-2xl shadow-2xl border border-gray-100 flex flex-col">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">Revenue Overview</p>
            <h2 className="text-lg sm:text-xl font-black text-gray-900">{monthLabel(selectedMonth)}</h2>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl border border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50 flex items-center justify-center transition-colors" aria-label="Close revenue overview">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto p-4 sm:p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-xs text-gray-500 font-semibold">Total Revenue</p>
              <p className="text-2xl font-black text-gray-900 mt-1">{fmt(summary.totalRevenue)}</p>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
              <p className="text-xs text-emerald-700 font-semibold">Collected</p>
              <p className="text-2xl font-black text-emerald-700 mt-1">{fmt(summary.collectedRevenue)}</p>
            </div>
            <div className="rounded-xl border border-red-100 bg-red-50 p-4">
              <p className="text-xs text-red-700 font-semibold">Pending</p>
              <p className="text-2xl font-black text-red-700 mt-1">{fmt(summary.pendingRevenue)}</p>
            </div>
          </div>

          <div className="space-y-4">
            {groups.map((group) => {
              const rows = tenants.filter((item) => (item.record?.status || "Due") === group.key);
              return (
                <section key={group.key} className="border border-gray-100 rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-full border text-xs font-bold ${toneClasses[group.tone]}`}>{group.title}</span>
                      <span className="text-xs text-gray-400">{rows.length} candidates</span>
                    </div>
                    <span className="text-xs font-bold text-gray-500">{fmt(rows.reduce((s, item) => s + (group.key === "Paid" ? item.record?.paidAmount || 0 : item.remaining || 0), 0))}</span>
                  </div>

                  {rows.length === 0 ? (
                    <p className="px-4 py-5 text-sm text-gray-400">{group.empty}</p>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {rows.map((item) => {
                        const phone = item.tenant?.phone?.replace(/\D/g, "") || "";
                        const whatsappUrl = phone ? `https://wa.me/91${phone}?text=${buildRentMessage(item, selectedMonth)}` : "";
                        return (
                          <div key={`${item.tenant?._id}-${group.key}`} className="px-4 py-3 flex flex-col lg:flex-row lg:items-center gap-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <Avatar name={item.tenant?.name} size="md" color={group.key === "Partial" ? "#f59e0b" : "#ef4444"} />
                              <div className="min-w-0">
                                <p className="font-bold text-gray-900 truncate">{item.tenant?.name || "Candidate"}</p>
                                <p className="text-xs text-gray-500 truncate">{locationLabel(item)}</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 lg:flex lg:items-center">
                              <div className="text-left sm:text-right lg:w-28">
                                <p className="text-[10px] uppercase text-gray-400 font-semibold">Total</p>
                                <p className="text-sm font-bold text-gray-800">{fmt(item.record?.rentAmount)}</p>
                              </div>
                              <div className="text-left sm:text-right lg:w-28">
                                <p className="text-[10px] uppercase text-gray-400 font-semibold">Paid</p>
                                <p className="text-sm font-bold text-emerald-600">{fmt(item.record?.paidAmount)}</p>
                              </div>
                              <div className="text-left sm:text-right lg:w-28">
                                <p className="text-[10px] uppercase text-gray-400 font-semibold">Due</p>
                                <p className="text-sm font-bold text-red-600">{fmt(item.remaining)}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 lg:pl-2">
                              <a href={item.tenant?.phone ? `tel:${item.tenant.phone}` : undefined} className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-colors ${item.tenant?.phone ? "border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100" : "border-gray-100 bg-gray-50 text-gray-300 pointer-events-none"}`} title="Call">
                                <Phone size={16} />
                              </a>
                              <button onClick={() => whatsappUrl && window.open(whatsappUrl, "_blank")} disabled={!whatsappUrl} className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-colors ${whatsappUrl ? "border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "border-gray-100 bg-gray-50 text-gray-300"}`} title="Message">
                                <MessageCircle size={16} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [overview, setOverview] = useState([]);
  const [allTenants, setAllTenants] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthValue());
  const [monthlyRevenue, setMonthlyRevenue] = useState(null);
  const [showRevenueDetails, setShowRevenueDetails] = useState(false);
  const [owner, setOwner] = useState(null);
  
  const [loadingBuildings, setLoadingBuildings] = useState(true);
  const [loadingRent, setLoadingRent] = useState(true);
  const [loadingMonthlyRevenue, setLoadingMonthlyRevenue] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem("user");
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

  const fetchMonthlyRevenue = useCallback(async (monthYear) => {
    setLoadingMonthlyRevenue(true);
    try {
      const data = await apiFetch(`/rent/monthly-summary?monthYear=${monthYear}&includePaid=false`);
      setMonthlyRevenue(data);
    } catch (e) { setError(e.message); }
    finally { setLoadingMonthlyRevenue(false); }
  }, []);

  useEffect(() => {
    fetchBuildings();
    fetchRent();
  }, [fetchBuildings, fetchRent]);

  useEffect(() => {
    fetchMonthlyRevenue(selectedMonth);
  }, [fetchMonthlyRevenue, selectedMonth]);

  const totalBuildings = overview.length;
  const totalBeds      = overview.reduce((s, b) => s + b.totalBeds, 0);
  const occupiedBeds   = overview.reduce((s, b) => s + b.occupiedBeds, 0);
  const availableBeds  = totalBeds - occupiedBeds;
  const revenueSummary = monthlyRevenue?.summary || {};
  const totalRevenue   = revenueSummary.totalRevenue || 0;
  const collectedRev   = revenueSummary.collectedRevenue || 0;
  const pendingRev     = revenueSummary.pendingRevenue || 0;
  const paidCount      = revenueSummary.counts?.Paid || 0;
  const partialCount   = revenueSummary.counts?.Partial || 0;
  const dueCount       = revenueSummary.counts?.Due || 0;
  const revenueMonthOptions = monthOptions();

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
          <button onClick={() => { fetchBuildings(); fetchRent(); fetchMonthlyRevenue(selectedMonth); }} className="px-3 py-2 text-xs font-semibold text-indigo-600 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors">
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
          <KpiCard icon="💰" label="Collected" value={loadingMonthlyRevenue ? "—" : fmt(collectedRev)} sub={`${pct(collectedRev, totalRevenue)}% of target`} accent="#10b981" loading={loadingMonthlyRevenue} />
          <KpiCard icon="⏳" label="Pending" value={loadingMonthlyRevenue ? "—" : fmt(pendingRev)} sub="Outstanding rent" accent="#ef4444" loading={loadingMonthlyRevenue} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Revenue Panel */}
          <div onClick={() => !loadingMonthlyRevenue && setShowRevenueDetails(true)} className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="font-bold text-gray-800 text-sm">Monthly Revenue</h2>
                <p className="text-xs text-gray-400 mt-0.5">Tap card to view tenant-wise collection</p>
              </div>
              <div onClick={(e) => e.stopPropagation()} className="w-full sm:w-auto flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                <CalendarDays size={15} className="text-indigo-500 shrink-0" />
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value || currentMonthValue())}
                  className="bg-transparent text-xs font-semibold text-gray-700 outline-none w-full sm:w-[150px] min-w-0"
                  aria-label="Select revenue month"
                >
                  {revenueMonthOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>
            {loadingMonthlyRevenue ? (
              <div className="space-y-3"><Skel className="h-9 w-40" /><Skel className="h-3 w-full" /><Skel className="h-14" /></div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row sm:items-end gap-1 sm:gap-3 mb-3">
                  <p className="text-3xl font-black text-gray-900">{fmt(collectedRev)}</p>
                  <p className="text-xs text-gray-400 mb-1">of {fmt(totalRevenue)} expected</p>
                  <p className="text-2xl font-black text-indigo-500 sm:ml-auto">{pct(collectedRev, totalRevenue)}%</p>
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
                <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between text-xs font-semibold text-indigo-600">
                  <span>{monthLabel(selectedMonth)} overview</span>
                  <span className="inline-flex items-center gap-1">View details <ChevronRight size={15} /></span>
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
      <RevenueDetailsModal
        open={showRevenueDetails}
        onClose={() => setShowRevenueDetails(false)}
        data={monthlyRevenue}
        selectedMonth={selectedMonth}
      />
    </div>
  );
}
