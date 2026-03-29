import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { API } from "../api.js";

const token = () => sessionStorage.getItem("token");

export default function MasterDashboard() {
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${API}/master/stats`, {
      headers: { Authorization: `Bearer ${token()}` },
    })
      .then((r) => {
        if (r.status === 401 || r.status === 403) { navigate("/login", { replace: true }); return null; }
        return r.json();
      })
      .then((d) => { if (d) setStats(d); })
      .catch(() => setError("Failed to load stats."))
      .finally(() => setLoading(false));
  }, [navigate]);

  const fmt  = (n) => (n ?? 0).toLocaleString("en-IN");
  const fmtR = (n) => `₹${(n ?? 0).toLocaleString("en-IN")}`;

  const cards = stats
    ? [
        { label: "Total Owners",     value: fmt(stats.totalUsers),     sub: `${stats.recentUsers} new this week`,  color: "#6366f1", icon: "👥" },
        { label: "Active Owners",    value: fmt(stats.activeUsers),    sub: `${stats.blockedUsers} blocked`,        color: "#10b981", icon: "✅" },
        { label: "Total Buildings",  value: fmt(stats.totalBuildings), sub: "Across all owners",                   color: "#f59e0b", icon: "🏨" },
        { label: "Total Tenants",    value: fmt(stats.totalTenants),   sub: `${stats.activeTenants} active`,       color: "#3b82f6", icon: "🧑‍🤝‍🧑" },
        { label: "Total Beds",       value: fmt(stats.totalBeds),      sub: `${stats.availableBeds} available`,    color: "#8b5cf6", icon: "🛏️" },
        // { label: "Occupied Beds",    value: fmt(stats.occupiedBeds),   sub: `${stats.occupancyRate}% occupancy`,  color: "#ef4444", icon: "📊" },
        // { label: "Platform Revenue", value: fmtR(stats.totalRevenue),  sub: "Monthly from active tenants",        color: "#14b8a6", icon: "💰" },
        // { label: "Blocked Owners",   value: fmt(stats.blockedUsers),   sub: "Login access revoked",               color: "#f87171", icon: "🚫" },
      ]
    : [];

  // Simple bar chart for monthly growth
  const maxGrowth = stats?.monthlyGrowth?.length
    ? Math.max(...stats.monthlyGrowth.map((m) => m.count), 1)
    : 1;

  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        .md-root { font-family:'Plus Jakarta Sans',sans-serif; background:#f8f9fc; min-height:100vh; padding:28px 24px; }
        .md-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:28px; flex-wrap:wrap; gap:12px; }
        .md-header h1 { font-size:22px; font-weight:700; color:#0f172a; }
        .md-header p  { font-size:13px; color:#94a3b8; margin-top:2px; }
        .md-nav { display:flex; gap:8px; flex-wrap:wrap; }
        .md-navbtn {
          padding:8px 16px; border-radius:8px; font-size:13px; font-weight:600;
          cursor:pointer; border:1.5px solid #e2e8f0; background:#fff; color:#64748b;
          text-decoration:none; transition:all 0.18s; display:inline-flex; align-items:center; gap:6px;
        }
        .md-navbtn:hover { background:#f1f5f9; }
        .md-navbtn.active { background:#6366f1; color:#fff; border-color:#6366f1; }

        .md-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(210px,1fr)); gap:16px; margin-bottom:28px; }
        .md-card {
          background:#fff; border-radius:14px; padding:20px;
          border:1.5px solid #f1f5f9;
          box-shadow:0 1px 4px rgba(0,0,0,0.05);
          transition:box-shadow 0.2s, transform 0.2s;
        }
        .md-card:hover { box-shadow:0 6px 20px rgba(0,0,0,0.08); transform:translateY(-2px); }
        .md-card-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
        .md-card-icon {
          width:42px; height:42px; border-radius:11px;
          display:flex; align-items:center; justify-content:center; font-size:20px;
        }
        .md-card-val { font-size:26px; font-weight:700; color:#0f172a; }
        .md-card-label { font-size:12px; font-weight:600; color:#64748b; text-transform:uppercase; letter-spacing:0.05em; }
        .md-card-sub { font-size:11.5px; color:#94a3b8; margin-top:3px; }

        .md-row { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
        @media(max-width:720px) { .md-row { grid-template-columns:1fr; } }

        .md-panel { background:#fff; border-radius:14px; border:1.5px solid #f1f5f9; padding:22px; box-shadow:0 1px 4px rgba(0,0,0,0.05); }
        .md-panel-title { font-size:14px; font-weight:700; color:#0f172a; margin-bottom:18px; }

        /* Mini bar chart */
        .md-bars { display:flex; align-items:flex-end; gap:8px; height:100px; }
        .md-bar-wrap { flex:1; display:flex; flex-direction:column; align-items:center; gap:4px; }
        .md-bar { width:100%; border-radius:5px 5px 0 0; background:linear-gradient(180deg,#6366f1,#818cf8); min-height:4px; transition:height 0.5s; }
        .md-bar-lbl { font-size:10px; color:#94a3b8; }
        .md-bar-val { font-size:9.5px; font-weight:600; color:#6366f1; }

        /* Donut-style occupancy */
        .md-occ { display:flex; align-items:center; gap:20px; }
        .md-occ-ring { position:relative; width:100px; height:100px; }
        .md-occ-ring svg { transform:rotate(-90deg); }
        .md-occ-pct { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:18px; font-weight:700; color:#0f172a; }
        .md-occ-legend { display:flex; flex-direction:column; gap:10px; }
        .md-occ-row { display:flex; align-items:center; gap:8px; font-size:13px; }
        .md-occ-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }

        .md-skeleton { background:linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%); background-size:200% 100%; animation:md-shimmer 1.4s infinite; border-radius:10px; }
        @keyframes md-shimmer { to { background-position:-200% 0; } }

        .md-logout {
          padding:8px 14px; border-radius:8px; font-size:13px; font-weight:600;
          cursor:pointer; border:1.5px solid #fecdd3; background:#fff1f2; color:#e11d48;
          transition:all 0.18s;
        }
        .md-logout:hover { background:#ffe4e6; }
      `}</style>

      <div className="md-root">
        {/* Header */}
        <div className="md-header">
          <div>
            <h1>🏢 Master Dashboard</h1>
            <p>Platform-wide overview — HOSTELIQ admin panel</p>
          </div>
          <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
            <div className="md-nav">
              <Link to="/master/dashboard"   className="md-navbtn active">📊 Dashboard</Link>
              <Link to="/master/users"      className="md-navbtn">👥 Owners</Link>
              <Link to="/master/logins" className="md-navbtn">🔐 Manage Logins</Link>
            </div>
            <button className="md-logout" onClick={() => { sessionStorage.clear(); navigate("/login", { replace: true }); }}>
              Logout
            </button>
          </div>
        </div>

        {error && (
          <div style={{ padding:"12px 16px", background:"#fff1f2", border:"1px solid #fecdd3", borderRadius:10, color:"#e11d48", marginBottom:20, fontSize:13 }}>
            {error}
          </div>
        )}

        {/* Stat cards */}
        {loading ? (
          <div className="md-grid">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="md-card">
                <div className="md-skeleton" style={{ height:42, width:42, borderRadius:11, marginBottom:12 }} />
                <div className="md-skeleton" style={{ height:26, width:"60%", marginBottom:6 }} />
                <div className="md-skeleton" style={{ height:12, width:"80%" }} />
              </div>
            ))}
          </div>
        ) : (
          <div className="md-grid">
            {cards.map((c) => (
              <div className="md-card" key={c.label}>
                <div className="md-card-top">
                  <div>
                    <div className="md-card-label">{c.label}</div>
                    <div className="md-card-val">{c.value}</div>
                    <div className="md-card-sub">{c.sub}</div>
                  </div>
                  <div className="md-card-icon" style={{ background: c.color + "18" }}>
                    {c.icon}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Charts row */}
        {!loading && stats && (
          <div className="md-row">
            {/* Monthly growth bar chart */}
            <div className="md-panel">
              <div className="md-panel-title">📈 New Owner Registrations (Last 6 Months)</div>
              {stats.monthlyGrowth?.length ? (
                <div className="md-bars">
                  {stats.monthlyGrowth.map((m) => (
                    <div className="md-bar-wrap" key={`${m._id.year}-${m._id.month}`}>
                      <div className="md-bar-val">{m.count}</div>
                      <div
                        className="md-bar"
                        style={{ height: `${Math.max((m.count / maxGrowth) * 80, 4)}px` }}
                      />
                      <div className="md-bar-lbl">{monthNames[m._id.month - 1]}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color:"#94a3b8", fontSize:13 }}>No registration data yet.</div>
              )}
            </div>

            {/* Occupancy donut */}
            <div className="md-panel">
              <div className="md-panel-title">🛏️ Bed Occupancy</div>
              {stats.totalBeds > 0 ? (
                <div className="md-occ">
                  <div className="md-occ-ring">
                    <svg width="100" height="100" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="38" fill="none" stroke="#f1f5f9" strokeWidth="14" />
                      <circle
                        cx="50" cy="50" r="38" fill="none"
                        stroke="#6366f1" strokeWidth="14"
                        strokeDasharray={`${2 * Math.PI * 38}`}
                        strokeDashoffset={`${2 * Math.PI * 38 * (1 - stats.occupancyRate / 100)}`}
                        strokeLinecap="round"
                        style={{ transition:"stroke-dashoffset 0.8s" }}
                      />
                    </svg>
                    <div className="md-occ-pct">{stats.occupancyRate}%</div>
                  </div>
                  <div className="md-occ-legend">
                    <div className="md-occ-row"><div className="md-occ-dot" style={{ background:"#6366f1" }} /><span>Occupied: <b>{fmt(stats.occupiedBeds)}</b></span></div>
                    <div className="md-occ-row"><div className="md-occ-dot" style={{ background:"#e2e8f0" }} /><span>Available: <b>{fmt(stats.availableBeds)}</b></span></div>
                    <div className="md-occ-row"><div className="md-occ-dot" style={{ background:"#0f172a" }} /><span>Total: <b>{fmt(stats.totalBeds)}</b></span></div>
                  </div>
                </div>
              ) : (
                <div style={{ color:"#94a3b8", fontSize:13 }}>No beds added yet.</div>
              )}
            </div>
          </div>
        )}

        {/* Quick links */}
        {!loading && (
          <div style={{ marginTop:20, display:"flex", gap:12, flexWrap:"wrap" }}>
            <Link to="/master/owners" style={{ textDecoration:"none" }}>
              <div style={{ padding:"12px 20px", background:"#ede9fe", border:"1px solid #c4b5fd", borderRadius:10, color:"#7c3aed", fontWeight:600, fontSize:13, cursor:"pointer" }}>
                👥 View All Owners →
              </div>
            </Link>
            <Link to="/master/manage-logins" style={{ textDecoration:"none" }}>
              <div style={{ padding:"12px 20px", background:"#fff1f2", border:"1px solid #fecdd3", borderRadius:10, color:"#e11d48", fontWeight:600, fontSize:13, cursor:"pointer" }}>
                🔐 Manage Logins →
              </div>
            </Link>
          </div>
        )}
      </div>
    </>
  );
}