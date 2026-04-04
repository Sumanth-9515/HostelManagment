import { useState, useEffect, useMemo } from "react";
import { API, authHeaders } from "../api.js";
import { useToast, Toast, Modal, StatCard } from "../components/Ui.jsx";

// ── Inject animation styles once ─────────────────────────────────────────────
const injectStyles = () => {
  if (document.getElementById("ov-styles")) return;
  const s = document.createElement("style");
  s.id = "ov-styles";
  s.textContent = `
    @keyframes ovSlideUp {
      from { opacity: 0; transform: translateY(18px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes ovFadeIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    .ov-slide { animation: ovSlideUp 0.28s cubic-bezier(0.22,1,0.36,1); }
    .ov-fade  { animation: ovFadeIn 0.22s ease; }
    .bed-tile { transition: transform 0.15s ease, box-shadow 0.15s ease; }
    .bed-tile:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(0,0,0,0.10); }
    .ov-spin {
      width: 32px; height: 32px; border-radius: 50%;
      border: 3px solid #dbeafe; border-top-color: #2563eb;
      animation: spin 0.75s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `;
  document.head.appendChild(s);
};

// ── Shared styles ─────────────────────────────────────────────────────────────
const sel =
  "width:100%;padding:10px 14px;border-radius:12px;border:2px solid #f1f5f9;" +
  "background:#f8fafc;color:#1e293b;font-size:13px;font-weight:500;" +
  "outline:none;appearance:none;cursor:pointer;transition:border-color 0.2s";
const inp =
  "width:100%;padding:10px 14px;border-radius:12px;border:2px solid #f1f5f9;" +
  "background:#f8fafc;color:#1e293b;font-size:13px;font-weight:500;" +
  "outline:none;transition:border-color 0.2s,background 0.2s";
const lbl =
  "display:block;font-size:10px;font-weight:700;color:#94a3b8;" +
  "text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px";

const GRAD = "linear-gradient(135deg,#1d4ed8 0%,#7c3aed 100%)";

// ── Mini helpers ──────────────────────────────────────────────────────────────
function Chip({ children, color = "#3b82f6", bg = "#eff6ff", border = "#bfdbfe" }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 10px", borderRadius: 99,
      fontSize: 11, fontWeight: 700, color, background: bg, border: `1px solid ${border}`,
    }}>
      {children}
    </span>
  );
}

function SummaryPill({ label, value, color, bg, border }) {
  return (
    <div style={{
      padding: "10px 18px", borderRadius: 14, background: bg, border: `1px solid ${border}`,
      textAlign: "center", minWidth: 80,
    }}>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 600, color, opacity: 0.75, marginTop: 1 }}>{label}</div>
    </div>
  );
}

function InfoRow({ label, value, accent }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "9px 12px", borderRadius: 10,
      background: accent ? "#eff6ff" : "#f8fafc",
    }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: accent ? "#2563eb" : "#1e293b" }}>{value}</span>
    </div>
  );
}

// ── Tenant detail modal ───────────────────────────────────────────────────────
function TenantModal({ tenant, onClose }) {
  if (!tenant) return null;
  const initial = tenant.name?.[0]?.toUpperCase() || "?";
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 60, display: "flex",
        alignItems: "center", justifyContent: "center", padding: 16,
        background: "rgba(15,23,42,0.50)", backdropFilter: "blur(4px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="ov-slide"
        style={{
          width: "100%", maxWidth: 360, borderRadius: 20,
          background: "#fff", boxShadow: "0 24px 60px rgba(0,0,0,0.18)",
          overflow: "hidden", maxHeight: "90vh", overflowY: "auto",
        }}
      >
        {/* Gradient header */}
        <div style={{ background: GRAD, padding: "22px 20px 20px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 48, height: 48, borderRadius: "50%", background: "rgba(255,255,255,0.22)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, fontWeight: 800, color: "#fff",
              }}>
                {initial}
              </div>
              <div>
                <h3 style={{ color: "#fff", fontWeight: 800, fontSize: 16, margin: 0 }}>{tenant.name || "Unknown"}</h3>
                <p style={{ color: "#bfdbfe", fontSize: 12, margin: "2px 0 0" }}>{tenant.phone || "—"}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                width: 28, height: 28, borderRadius: "50%", border: "none",
                background: "rgba(255,255,255,0.18)", color: "#fff", cursor: "pointer",
                fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >✕</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
          {tenant.email && <InfoRow label="Email" value={tenant.email} />}
          <InfoRow
            label="Joining Date"
            value={tenant.joiningDate
              ? new Date(tenant.joiningDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
              : "—"}
          />
          <InfoRow label="Monthly Rent" value={tenant.rentAmount ? `₹${Number(tenant.rentAmount).toLocaleString()}` : "—"} accent />
          {tenant.permanentAddress && <InfoRow label="Address" value={tenant.permanentAddress} />}
          {tenant.allocationInfo?.buildingName && (
            <InfoRow
              label="Room"
              value={`${tenant.allocationInfo.buildingName} · Floor ${tenant.allocationInfo.floorNumber} · Rm ${tenant.allocationInfo.roomNumber} · Bed ${tenant.allocationInfo.bedNumber}`}
            />
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            {tenant.phone && (
              <a
                href={`tel:${tenant.phone}`}
                style={{
                  flex: 1, textAlign: "center", padding: "10px 0",
                  borderRadius: 12, background: "#22c55e", color: "#fff",
                  fontSize: 13, fontWeight: 700, textDecoration: "none",
                }}
              >📞 Call</a>
            )}
            {tenant.phone && (
              <a
                href={`https://wa.me/91${tenant.phone}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  flex: 1, textAlign: "center", padding: "10px 0",
                  borderRadius: 12, background: "#10b981", color: "#fff",
                  fontSize: 13, fontWeight: 700, textDecoration: "none",
                }}
              >💬 WhatsApp</a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── RoomDetail card ───────────────────────────────────────────────────────────
function RoomDetail({ data, onBedClick }) {
  const { buildingName, floorNumber, floorName, roomNumber, shareType, beds } = data;
  const occupied = beds.filter((b) => b.status === "Occupied").length;
  const pct = beds.length > 0 ? Math.round((occupied / beds.length) * 100) : 0;
  const barColor = pct === 100 ? "#ef4444" : pct >= 60 ? "#f59e0b" : "#22c55e";

  return (
    <div
      className="ov-slide"
      style={{
        background: "#f8fafc", border: "1px solid #e2e8f0",
        borderRadius: 16, padding: 16, marginTop: 10,
      }}
    >
      {/* Room header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 13 }}>
          <span style={{ color: "#94a3b8" }}>{buildingName}</span>
          <span style={{ color: "#cbd5e1", margin: "0 5px" }}>/</span>
          <span style={{ color: "#94a3b8" }}>
            Floor {floorNumber}{floorName ? ` · ${floorName}` : ""}
          </span>
          <span style={{ color: "#cbd5e1", margin: "0 5px" }}>/</span>
          <strong style={{ color: "#1e293b" }}>Room {roomNumber}</strong>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, fontFamily: "monospace", color: "#94a3b8" }}>
            {occupied}/{beds.length}
          </span>
          <Chip>{shareType}-share</Chip>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 5, background: "#e2e8f0", borderRadius: 99, overflow: "hidden", marginBottom: 12 }}>
        <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 99, transition: "width 0.6s ease" }} />
      </div>

      {/* Bed grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 8 }}>
        {beds.map((bed, i) => {
          const isOcc = bed.status === "Occupied";
          const tenant =
            bed.tenant ||
            (bed.tenantId && typeof bed.tenantId === "object" ? bed.tenantId : null);
          return (
            <div
              key={bed._id || i}
              className="bed-tile"
              onClick={() => isOcc && onBedClick(tenant || bed)}
              style={{
                background: isOcc ? "#fef2f2" : "#f0fdf4",
                border: `1.5px solid ${isOcc ? "#fca5a5" : "#86efac"}`,
                borderRadius: 12, padding: "10px 8px", textAlign: "center",
                cursor: isOcc ? "pointer" : "default",
              }}
            >
              <div style={{ fontSize: 20, marginBottom: 3 }}>🛏</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#334155" }}>Bed {bed.bedNumber}</div>
              <div style={{
                fontSize: 11, fontWeight: 700, marginTop: 2,
                color: isOcc ? "#ef4444" : "#16a34a",
              }}>
                {isOcc ? (tenant?.name?.split(" ")[0] || "Occupied") : "Free"}
              </div>
              {isOcc && (
                <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 2 }}>tap for info</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Overview ─────────────────────────────────────────────────────────────
export default function Overview() {
  const [stats, setStats] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast, show } = useToast();

  // ── Room Viewer tabs
  const [viewMode, setViewMode] = useState("browse"); // "browse" | "search" | "share"

  // ── Search state
  const [searchRoom, setSearchRoom] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

  // ── Browse state
  const [browseBuilding, setBrowseBuilding] = useState("");
  const [browseFloor, setBrowseFloor] = useState("");
  const [browseRoom, setBrowseRoom] = useState("");
  const [browseData, setBrowseData] = useState(null);
  const [browseFloors, setBrowseFloors] = useState([]);
  const [browseRooms, setBrowseRooms] = useState([]);

  // ── Share Explorer state
  const [selectedShare, setSelectedShare] = useState("");
  const [shareLoading, setShareLoading] = useState(false);
  const [populatedBuildings, setPopulatedBuildings] = useState([]);
  const [shareFetched, setShareFetched] = useState(false);

  // ── Modals
  const [tenantModal, setTenantModal] = useState(null);
  const [editModal, setEditModal] = useState(null);
  const [editForm, setEditForm] = useState({});

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    injectStyles();
    const load = async () => {
      setLoading(true);
      const [sr, br] = await Promise.all([
        fetch(`${API}/buildings/stats/overview`, { headers: authHeaders() }).then((r) => r.json()),
        fetch(`${API}/buildings`, { headers: authHeaders() }).then((r) => r.json()),
      ]);
      setStats(Array.isArray(sr) ? sr : []);
      setBuildings(Array.isArray(br) ? br : []);
      setLoading(false);
    };
    load();
  }, []);

  const refreshData = async () => {
    const [sr, br] = await Promise.all([
      fetch(`${API}/buildings/stats/overview`, { headers: authHeaders() }).then((r) => r.json()),
      fetch(`${API}/buildings`, { headers: authHeaders() }).then((r) => r.json()),
    ]);
    setStats(Array.isArray(sr) ? sr : []);
    setBuildings(Array.isArray(br) ? br : []);
    // Invalidate share cache so it refetches fresh data
    setShareFetched(false);
    setPopulatedBuildings([]);
  };

  // ── Totals ────────────────────────────────────────────────────────────────
  const totalStats = stats.reduce(
    (acc, s) => ({
      totalBeds: acc.totalBeds + s.totalBeds,
      occupiedBeds: acc.occupiedBeds + s.occupiedBeds,
      availableBeds: acc.availableBeds + s.availableBeds,
      totalTenants: acc.totalTenants + s.totalTenants,
      totalRevenue: acc.totalRevenue + s.totalRevenue,
    }),
    { totalBeds: 0, occupiedBeds: 0, availableBeds: 0, totalTenants: 0, totalRevenue: 0 }
  );

  // ── Share type derived data ───────────────────────────────────────────────
  const allShareTypes = useMemo(() => {
    const set = new Set();
    for (const b of buildings) {
      for (const f of b.floors || []) {
        for (const r of f.rooms || []) {
          if (r.shareType) set.add(r.shareType);
        }
      }
    }
    return [...set].sort((a, b) => a - b);
  }, [buildings]);

  const fetchPopulated = async () => {
    if (shareFetched) return;
    setShareLoading(true);
    const results = await Promise.all(
      buildings.map((b) =>
        fetch(`${API}/buildings/${b._id}`, { headers: authHeaders() }).then((r) => r.json())
      )
    );
    setPopulatedBuildings(results.filter((b) => b && b._id));
    setShareFetched(true);
    setShareLoading(false);
  };

  const shareRooms = useMemo(() => {
    if (!selectedShare) return [];
    const n = Number(selectedShare);
    const result = [];
    for (const b of populatedBuildings) {
      for (const f of b.floors || []) {
        for (const r of f.rooms || []) {
          if (r.shareType === n) {
            result.push({
              ...r,
              buildingName: b.buildingName,
              buildingId: b._id,
              floorNumber: f.floorNumber,
              floorName: f.floorName,
            });
          }
        }
      }
    }
    return result;
  }, [selectedShare, populatedBuildings]);

  const shareSummary = useMemo(() => {
    let total = 0, occupied = 0;
    for (const r of shareRooms) {
      total += r.beds?.length || 0;
      occupied += (r.beds || []).filter((b) => b.status === "Occupied").length;
    }
    return { total, occupied, free: total - occupied };
  }, [shareRooms]);

  // ── Search ────────────────────────────────────────────────────────────────
  const handleSearch = async () => {
    if (!searchRoom.trim()) return;
    setSearchLoading(true); setSearchError(""); setSearchResult(null);
    const r = await fetch(
      `${API}/buildings/search/room?roomNumber=${encodeURIComponent(searchRoom.trim())}`,
      { headers: authHeaders() }
    );
    const d = await r.json();
    setSearchLoading(false);
    if (!r.ok) return setSearchError(d.message);
    setSearchResult(d);
  };

  // ── Browse cascades ───────────────────────────────────────────────────────
  useEffect(() => {
    setBrowseFloor(""); setBrowseRoom(""); setBrowseData(null);
    setBrowseFloors([]); setBrowseRooms([]);
    if (!browseBuilding) return;
    const b = buildings.find((x) => x._id === browseBuilding);
    if (b) setBrowseFloors([...b.floors].sort((a, c) => a.floorNumber - c.floorNumber));
  }, [browseBuilding, buildings]);

  useEffect(() => {
    setBrowseRoom(""); setBrowseData(null); setBrowseRooms([]);
    if (!browseFloor) return;
    const f = browseFloors.find((x) => x._id === browseFloor);
    if (f) setBrowseRooms(f.rooms);
  }, [browseFloor, browseFloors]);

  useEffect(() => {
    if (!browseRoom) return;
    const loadRoom = async () => {
      const r = await fetch(`${API}/buildings/${browseBuilding}`, { headers: authHeaders() });
      const d = await r.json();
      if (!r.ok) return;
      const floor = d.floors?.find((f) => f._id === browseFloor);
      const room = floor?.rooms?.find((rm) => rm._id === browseRoom);
      if (room) setBrowseData({ room, buildingName: d.buildingName, floorNumber: floor.floorNumber, floorName: floor.floorName });
    };
    loadRoom();
  }, [browseRoom]);

  // ── Edit / Delete building ────────────────────────────────────────────────
  const handleEditSave = async () => {
    const r = await fetch(`${API}/buildings/${editModal._id}`, {
      method: "PUT", headers: authHeaders(), body: JSON.stringify(editForm),
    });
    const d = await r.json();
    if (!r.ok) return show(d.message, "error");
    show("Building updated");
    setEditModal(null);
    refreshData();
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this building? All data will be lost.")) return;
    const r = await fetch(`${API}/buildings/${id}`, { method: "DELETE", headers: authHeaders() });
    if (!r.ok) return show("Delete failed.", "error");
    show("Building deleted.");
    refreshData();
  };

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 240, flexDirection: "column", gap: 14 }}>
      <div className="ov-spin" />
      <p style={{ color: "#94a3b8", fontSize: 13 }}>Loading overview…</p>
    </div>
  );

  return (
   <div style={{ width: "100%", maxWidth: 1400, margin: "0 auto", padding: "0 20px" }}>
      <Toast toast={toast} />

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", marginBottom: 3 }}>Overview</h1>
        <p style={{ fontSize: 13, color: "#94a3b8" }}>Live occupancy and building statistics</p>
      </div>

      {/* ── Global stat pills ─────────────────────────────────────────────── */}
      {stats.length > 1 && (
        <div
          style={{ display: "grid", gap: 12, marginBottom: 28 }}
          className="ov-fade"
          // 5 columns on wide, responsive
          // We'll use a style that works without Tailwind grid breakpoints
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {[
              { label: "Total Beds", value: totalStats.totalBeds, icon: "🛏", color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
              { label: "Occupied", value: totalStats.occupiedBeds, icon: "🔴", color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
              { label: "Available", value: totalStats.availableBeds, icon: "✅", color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
              { label: "Tenants", value: totalStats.totalTenants, icon: "👤", color: "#7c3aed", bg: "#faf5ff", border: "#e9d5ff" },
              { label: "Revenue", value: `₹${totalStats.totalRevenue.toLocaleString()}`, icon: "💰", color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
            ].map(({ label, value, icon, color, bg, border }) => (
              <div
                key={label}
                style={{
                  flex: "1 1 140px", background: bg, border: `1px solid ${border}`,
                  borderRadius: 16, padding: "16px 14px",
                }}
              >
                <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color, opacity: 0.7, marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

           {/* ── Room Viewer ───────────────────────────────────────────────────── */}
      <div style={{
        background: "#fff", border: "1px solid #e2e8f0",
        borderRadius: 18, padding: "20px 22px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
      }}>
        <h2 style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", marginBottom: 16 }}>Room Viewer</h2>

        {/* Tab bar */}
        <div style={{
          display: "flex", gap: 4, background: "#f1f5f9",
          borderRadius: 12, padding: 4, marginBottom: 20, width: "fit-content",
        }}>
          {[
            { key: "browse", label: "🗺 Browse" },
            { key: "search", label: "🔍 Search" },
            { key: "share", label: "🛏 By Share Type" },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => {
                setViewMode(key);
                if (key === "share") fetchPopulated();
              }}
              style={{
                padding: "7px 16px", borderRadius: 9, border: "none", cursor: "pointer",
                fontSize: 12, fontWeight: 700, transition: "all 0.2s",
                background: viewMode === key ? "#fff" : "transparent",
                color: viewMode === key ? "#2563eb" : "#64748b",
                boxShadow: viewMode === key ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              }}
            >{label}</button>
          ))}
        </div>

        {/* ── SEARCH mode ─────────────────────────────────────────────────── */}
        {viewMode === "search" && (
          <div className="ov-fade">
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input
                style={{ ...Object.fromEntries(inp.split(";").filter(Boolean).map(p => { const [k, v] = p.split(":"); return [k.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase()), v.trim()]; })), flex: 1 }}
                value={searchRoom}
                onChange={(e) => setSearchRoom(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Room number e.g. 101"
              />
              <button
                onClick={handleSearch}
                disabled={searchLoading}
                style={{
                  padding: "10px 20px", borderRadius: 12, border: "none",
                  background: GRAD, color: "#fff", fontSize: 13, fontWeight: 700,
                  cursor: searchLoading ? "not-allowed" : "pointer", opacity: searchLoading ? 0.7 : 1,
                }}
              >{searchLoading ? "…" : "Search"}</button>
            </div>
            {searchError && <p style={{ color: "#ef4444", fontSize: 12, marginBottom: 8 }}>{searchError}</p>}
            {searchResult && searchResult.map((res, i) => (
              <RoomDetail key={i} data={res} onBedClick={setTenantModal} />
            ))}
          </div>
        )}

        {/* ── BROWSE mode ─────────────────────────────────────────────────── */}
        {viewMode === "browse" && (
          <div className="ov-fade">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
              <div style={{ flex: "1 1 160px" }}>
                <label style={{ ...Object.fromEntries(lbl.split(";").filter(Boolean).map(p => { const [k, v] = p.split(":"); return [k.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase()), v.trim()]; })) }}>Building</label>
                <select
                  style={{ ...Object.fromEntries(sel.split(";").filter(Boolean).map(p => { const [k, v] = p.split(":"); return [k.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase()), v.trim()]; })) }}
                  value={browseBuilding}
                  onChange={(e) => setBrowseBuilding(e.target.value)}
                >
                  <option value="">Select building</option>
                  {buildings.map((b) => <option key={b._id} value={b._id}>{b.buildingName}</option>)}
                </select>
              </div>
              {browseBuilding && (
                <div style={{ flex: "1 1 160px" }}>
                  <label style={{ ...Object.fromEntries(lbl.split(";").filter(Boolean).map(p => { const [k, v] = p.split(":"); return [k.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase()), v.trim()]; })) }}>Floor</label>
                  <select
                    style={{ ...Object.fromEntries(sel.split(";").filter(Boolean).map(p => { const [k, v] = p.split(":"); return [k.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase()), v.trim()]; })) }}
                    value={browseFloor}
                    onChange={(e) => setBrowseFloor(e.target.value)}
                  >
                    <option value="">Select floor</option>
                    {browseFloors.map((f) => (
                      <option key={f._id} value={f._id}>
                        Floor {f.floorNumber}{f.floorName ? ` — ${f.floorName}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {browseFloor && (
                <div style={{ flex: "1 1 160px" }}>
                  <label style={{ ...Object.fromEntries(lbl.split(";").filter(Boolean).map(p => { const [k, v] = p.split(":"); return [k.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase()), v.trim()]; })) }}>Room</label>
                  <select
                    style={{ ...Object.fromEntries(sel.split(";").filter(Boolean).map(p => { const [k, v] = p.split(":"); return [k.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase()), v.trim()]; })) }}
                    value={browseRoom}
                    onChange={(e) => setBrowseRoom(e.target.value)}
                  >
                    <option value="">Select room</option>
                    {browseRooms.map((r) => (
                      <option key={r._id} value={r._id}>Room {r.roomNumber}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            {browseData && (
              <RoomDetail
                data={{
                  ...browseData.room,
                  buildingName: browseData.buildingName,
                  floorNumber: browseData.floorNumber,
                  floorName: browseData.floorName,
                }}
                onBedClick={setTenantModal}
              />
            )}
          </div>
        )}

        {/* ── SHARE TYPE mode ─────────────────────────────────────────────── */}
        {viewMode === "share" && (
          <div className="ov-fade">
            {shareLoading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 0", flexDirection: "column", gap: 12 }}>
                <div className="ov-spin" />
                <p style={{ color: "#94a3b8", fontSize: 13 }}>Fetching all rooms…</p>
              </div>
            ) : (
              <>
                {/* Selector row */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-end", marginBottom: 20 }}>
                  <div style={{ flex: "0 0 200px" }}>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                      Share Type
                    </label>
                    <select
                      value={selectedShare}
                      onChange={(e) => setSelectedShare(e.target.value)}
                      style={{
                        width: "100%", padding: "10px 14px", borderRadius: 12,
                        border: "2px solid #e2e8f0", background: "#f8fafc",
                        fontSize: 13, fontWeight: 600, color: "#1e293b",
                        outline: "none", cursor: "pointer",
                      }}
                    >
                      <option value="">— Select share type —</option>
                      {allShareTypes.map((n) => (
                        <option key={n} value={n}>
                          {n}-Share ({n} Bed{n > 1 ? "s" : ""} per room)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Summary pills */}
                  {selectedShare && (
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <SummaryPill label="Free Beds" value={shareSummary.free} color="#16a34a" bg="#f0fdf4" border="#bbf7d0" />
                      <SummaryPill label="Occupied" value={shareSummary.occupied} color="#dc2626" bg="#fef2f2" border="#fecaca" />
                      <SummaryPill label="Total Beds" value={shareSummary.total} color="#2563eb" bg="#eff6ff" border="#bfdbfe" />
                      <SummaryPill label="Rooms" value={shareRooms.length} color="#7c3aed" bg="#faf5ff" border="#e9d5ff" />
                    </div>
                  )}
                </div>

                {/* Quick-pick chips when nothing selected */}
                {!selectedShare && (
                  <div style={{ textAlign: "center", padding: "32px 0" }}>
                    <div style={{ fontSize: 40, marginBottom: 8 }}>🛏</div>
                    <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 16 }}>
                      Select a share type to see bed availability across all buildings
                    </p>
                    {allShareTypes.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                        {allShareTypes.map((n) => (
                          <button
                            key={n}
                            onClick={() => setSelectedShare(String(n))}
                            style={{
                              padding: "8px 20px", borderRadius: 99, border: "none",
                              background: GRAD, color: "#fff", fontSize: 13, fontWeight: 700,
                              cursor: "pointer", boxShadow: "0 2px 8px rgba(37,99,235,0.25)",
                            }}
                          >
                            {n}-Share
                          </button>
                        ))}
                      </div>
                    )}
                    {allShareTypes.length === 0 && (
                      <p style={{ color: "#cbd5e1", fontSize: 12 }}>No rooms found in any building.</p>
                    )}
                  </div>
                )}

                {/* Occupancy progress for selected share */}
                {selectedShare && shareSummary.total > 0 && (
                  <div style={{ marginBottom: 16, padding: "12px 16px", background: "#f8fafc", borderRadius: 14, border: "1px solid #e2e8f0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}>
                      <span style={{ fontWeight: 700, color: "#475569" }}>
                        Overall occupancy for {selectedShare}-share rooms
                      </span>
                      <span style={{ fontWeight: 800, color: "#2563eb" }}>
                        {Math.round((shareSummary.occupied / shareSummary.total) * 100)}%
                      </span>
                    </div>
                    <div style={{ height: 8, background: "#e2e8f0", borderRadius: 99, overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.round((shareSummary.occupied / shareSummary.total) * 100)}%`,
                          background: GRAD,
                          borderRadius: 99,
                          transition: "width 0.6s ease",
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Room list */}
                {selectedShare && shareRooms.length === 0 && (
                  <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", padding: "24px 0" }}>
                    No {selectedShare}-share rooms found across your buildings.
                  </p>
                )}
                {selectedShare && shareRooms.map((room, i) => (
                  <RoomDetail key={room._id || i} data={room} onBedClick={setTenantModal} />
                ))}
              </>
            )}
          </div>
        )}
      </div>
      <br />

      {/* ── Per-building cards ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 28 }}>
     <div class="flex items-center justify-center ">
  <h1 class="text-2xl font-extrabold">
    Buildings Overview
  </h1>
</div>
        {stats.map((s) => {
          const pct = s.totalBeds > 0 ? Math.round((s.occupiedBeds / s.totalBeds) * 100) : 0;
          const barColor = pct === 100 ? "#ef4444" : pct >= 60 ? "#f59e0b" : "#22c55e";
          const b = buildings.find((x) => x._id?.toString() === s.buildingId?.toString());
          return (
            <div
              key={s.buildingId}
              className="ov-slide"
              style={{
                background: "#fff", border: "1px solid #e2e8f0",
                borderRadius: 18, padding: "20px 22px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              }}
            >
              {/* Name + actions */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div>
                  <h2 style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", marginBottom: 2 }}>{s.buildingName}</h2>
                  {s.address && <p style={{ fontSize: 12, color: "#94a3b8" }}>{s.address}</p>}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => {
                      setEditModal(b || { _id: s.buildingId, buildingName: s.buildingName, address: s.address });
                      setEditForm({ buildingName: s.buildingName, address: s.address || "" });
                    }}
                    style={{
                      padding: "5px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0",
                      background: "#f8fafc", fontSize: 12, fontWeight: 700, color: "#475569",
                      cursor: "pointer",
                    }}
                  >Edit</button>
                  <button
                    onClick={() => handleDelete(s.buildingId)}
                    style={{
                      padding: "5px 14px", borderRadius: 10, border: "1.5px solid #fecaca",
                      background: "#fef2f2", fontSize: 12, fontWeight: 700, color: "#ef4444",
                      cursor: "pointer",
                    }}
                  >Delete</button>
                </div>
              </div>

              {/* Stat cells */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                {[
                  ["Floors", s.totalFloors, "#3b82f6"],
                  ["Rooms", s.totalRooms, "#8b5cf6"],
                  ["Beds", s.totalBeds, "#0ea5e9"],
                  ["Occupied", s.occupiedBeds, "#ef4444"],
                  ["Free", s.availableBeds, "#22c55e"],
                  ["Tenants", s.totalTenants, "#f59e0b"],
                  ["Revenue", `₹${(s.totalRevenue || 0).toLocaleString()}`, "#10b981"],
                ].map(([label, value, color]) => (
                  <div
                    key={label}
                    style={{
                      flex: "1 1 70px", textAlign: "center", background: "#f8fafc",
                      border: "1px solid #f1f5f9", borderRadius: 12, padding: "10px 6px",
                    }}
                  >
                    <div style={{ fontSize: 15, fontWeight: 800, color }}>{value}</div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Occupancy bar */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 11, color: "#94a3b8" }}>
                  <span style={{ fontWeight: 600 }}>Occupancy</span>
                  <span style={{ fontWeight: 700, color: barColor }}>{pct}%</span>
                </div>
                <div style={{ height: 6, background: "#f1f5f9", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 99, transition: "width 0.7s ease" }} />
                </div>
              </div>
            </div>
          );
        })}
        {stats.length === 0 && (
          <div style={{ textAlign: "center", padding: "52px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 10 }}>🏠</div>
            <p style={{ color: "#94a3b8", fontSize: 14 }}>No buildings yet. Add one from Properties.</p>
          </div>
        )}
      </div>

 

      {/* ── Tenant modal ──────────────────────────────────────────────────── */}
      <TenantModal tenant={tenantModal} onClose={() => setTenantModal(null)} />

      {/* ── Edit building modal ───────────────────────────────────────────── */}
      <Modal open={!!editModal} onClose={() => setEditModal(null)} title="Edit Building">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
              Building Name
            </label>
            <input
              style={{ width: "100%", padding: "10px 14px", borderRadius: 12, border: "2px solid #e2e8f0", background: "#f8fafc", fontSize: 13, fontWeight: 500, color: "#1e293b", outline: "none", boxSizing: "border-box" }}
              value={editForm.buildingName || ""}
              onChange={(e) => setEditForm({ ...editForm, buildingName: e.target.value })}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
              Address
            </label>
            <input
              style={{ width: "100%", padding: "10px 14px", borderRadius: 12, border: "2px solid #e2e8f0", background: "#f8fafc", fontSize: 13, fontWeight: 500, color: "#1e293b", outline: "none", boxSizing: "border-box" }}
              value={editForm.address || ""}
              onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
            />
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
            <button
              onClick={() => setEditModal(null)}
              style={{ padding: "9px 20px", borderRadius: 12, border: "1.5px solid #e2e8f0", background: "#f8fafc", fontSize: 13, fontWeight: 700, color: "#64748b", cursor: "pointer" }}
            >Cancel</button>
            <button
              onClick={handleEditSave}
              style={{ padding: "9px 24px", borderRadius: 12, border: "none", background: GRAD, fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer" }}
            >Save Changes</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}