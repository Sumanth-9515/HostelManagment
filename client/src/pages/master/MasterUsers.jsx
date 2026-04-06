import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { API } from "../api.js";

const token = () => sessionStorage.getItem("token");

export default function MasterOwners() {
  const [owners,   setOwners]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [selected, setSelected] = useState(null); // selected owner _id for detail drawer
  const [detail,   setDetail]   = useState(null);
  const [dLoading, setDLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${API}/master/users`, { headers: { Authorization: `Bearer ${token()}` } })
      .then((r) => {
        if (r.status === 401 || r.status === 403) { navigate("/login", { replace: true }); return null; }
        return r.json();
      })
      .then((d) => { if (d) setOwners(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [navigate]);

  const openDetail = (userId) => {
    setSelected(userId);
    setDetail(null);
    setDLoading(true);
    fetch(`${API}/master/users/${userId}`, { headers: { Authorization: `Bearer ${token()}` } })
      .then((r) => r.json())
      .then((d) => setDetail(d))
      .catch(() => {})
      .finally(() => setDLoading(false));
  };

  const filtered = owners.filter((o) =>
    `${o.name} ${o.owner} ${o.email} ${o.ph}`.toLowerCase().includes(search.toLowerCase())
  );

  const fmt  = (n) => (n ?? 0).toLocaleString("en-IN");
  const fmtR = (n) => `₹${(n ?? 0).toLocaleString("en-IN")}`;

  const statusBadge = (s) => (
    <span style={{
      padding: "2px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700,
      background: s === "blocked" ? "#fff1f2" : "#f0fdf4",
      color:      s === "blocked" ? "#e11d48" : "#16a34a",
      border:     `1px solid ${s === "blocked" ? "#fecdd3" : "#bbf7d0"}`,
    }}>
      {s === "blocked" ? "🚫 Blocked" : "✅ Active"}
    </span>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        .mo-root { font-family:'Plus Jakarta Sans',sans-serif; background:#f8f9fc; min-height:100vh; padding:28px 24px; }
        .mo-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:24px; flex-wrap:wrap; gap:12px; }
        .mo-header h1 { font-size:22px; font-weight:700; color:#0f172a; }
        .mo-header p  { font-size:13px; color:#94a3b8; margin-top:2px; }
        .mo-nav { display:flex; gap:8px; flex-wrap:wrap; }
        .mo-navbtn {
          padding:8px 16px; border-radius:8px; font-size:13px; font-weight:600;
          cursor:pointer; border:1.5px solid #e2e8f0; background:#fff; color:#64748b;
          text-decoration:none; transition:all 0.18s;
        }
        .mo-navbtn:hover { background:#f1f5f9; }
        .mo-navbtn.active { background:#6366f1; color:#fff; border-color:#6366f1; }

        .mo-search {
          width:100%; max-width:360px; padding:9px 14px;
          border:1.5px solid #e2e8f0; border-radius:9px; font-size:13.5px;
          font-family:inherit; outline:none; background:#fff;
          transition:border-color 0.2s, box-shadow 0.2s;
        }
        .mo-search:focus { border-color:#6366f1; box-shadow:0 0 0 3px rgba(99,102,241,0.12); }

        .mo-table-wrap { background:#fff; border-radius:14px; border:1.5px solid #f1f5f9; box-shadow:0 1px 4px rgba(0,0,0,0.05); overflow:hidden; }
        .mo-table { width:100%; border-collapse:collapse; }
        .mo-table thead tr { background:#f8f9fc; }
        .mo-table th { padding:11px 16px; text-align:left; font-size:11px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.06em; border-bottom:1.5px solid #f1f5f9; }
        .mo-table td { padding:13px 16px; font-size:13.5px; color:#1e293b; border-bottom:1px solid #f8f9fc; vertical-align:middle; }
        .mo-table tr:last-child td { border-bottom:none; }
        .mo-table tbody tr { cursor:pointer; transition:background 0.15s; }
        .mo-table tbody tr:hover { background:#fafbff; }
        .mo-table tbody tr.selected { background:#eef2ff; }

        .mo-mini-stat { display:flex; gap:10px; flex-wrap:wrap; }
        .mo-ms { padding:3px 9px; border-radius:6px; font-size:11px; font-weight:600; background:#f1f5f9; color:#64748b; }

        /* Drawer */
        .mo-drawer-bg {
          position:fixed; inset:0; background:rgba(0,0,0,0.25); z-index:100;
          animation:mo-fadeIn 0.2s;
        }
        @keyframes mo-fadeIn { from{opacity:0} to{opacity:1} }
        .mo-drawer {
          position:fixed; top:0; right:0; bottom:0; width:min(520px,100vw);
          background:#fff; box-shadow:-4px 0 30px rgba(0,0,0,0.12);
          z-index:101; overflow-y:auto; padding:28px 26px;
          animation:mo-slideIn 0.28s cubic-bezier(0.16,1,0.3,1);
        }
        @keyframes mo-slideIn { from{transform:translateX(100%)} to{transform:translateX(0)} }

        .mo-drawer-close {
          position:absolute; top:18px; right:20px; width:32px; height:32px;
          border-radius:50%; border:1.5px solid #e2e8f0; background:#f8f9fc;
          cursor:pointer; display:flex; align-items:center; justify-content:center;
          font-size:16px; color:#64748b; transition:all 0.18s;
        }
        .mo-drawer-close:hover { background:#fee2e2; border-color:#fca5a5; color:#e11d48; }

        .mo-drawer-name { font-size:20px; font-weight:700; color:#0f172a; margin-bottom:2px; }
        .mo-drawer-sub  { font-size:13px; color:#94a3b8; margin-bottom:20px; }

        .mo-dstats { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:22px; }
        .mo-dstat { background:#f8f9fc; border-radius:10px; padding:12px 14px; }
        .mo-dstat-val { font-size:20px; font-weight:700; color:#0f172a; }
        .mo-dstat-lbl { font-size:11px; color:#94a3b8; text-transform:uppercase; letter-spacing:0.05em; }

        .mo-section { font-size:12px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.07em; margin:18px 0 10px; }

        .mo-building-card { background:#f8f9fc; border-radius:10px; padding:14px; margin-bottom:10px; border:1px solid #f1f5f9; }
        .mo-building-name { font-size:14px; font-weight:700; color:#0f172a; margin-bottom:4px; }
        .mo-building-addr { font-size:12px; color:#94a3b8; margin-bottom:10px; }
        .mo-floor { padding:8px 10px; background:#fff; border-radius:8px; margin-bottom:6px; border:1px solid #e2e8f0; }
        .mo-floor-title { font-size:12px; font-weight:700; color:#6366f1; margin-bottom:6px; }
        .mo-rooms { display:flex; flex-wrap:wrap; gap:6px; }
        .mo-room { padding:4px 10px; background:#eef2ff; border-radius:6px; font-size:11.5px; color:#4338ca; font-weight:600; }

        .mo-tenant-card { background:#f8f9fc; border-radius:10px; padding:12px 14px; margin-bottom:8px; border:1px solid #f1f5f9; display:flex; justify-content:space-between; align-items:flex-start; gap:8px; }
        .mo-tenant-name { font-size:13.5px; font-weight:700; color:#0f172a; }
        .mo-tenant-info { font-size:12px; color:#64748b; margin-top:2px; }

        .mo-pill { padding:2px 9px; border-radius:99px; font-size:11px; font-weight:700; }
        .mo-pill.active { background:#f0fdf4; color:#16a34a; border:1px solid #bbf7d0; }
        .mo-pill.inactive { background:#fef2f2; color:#dc2626; border:1px solid #fecaca; }
        .mo-pill.paid { background:#f0fdf4; color:#16a34a; }
        .mo-pill.partial { background:#fffbeb; color:#d97706; }
        .mo-pill.due { background:#fff1f2; color:#e11d48; }

        .mo-skeleton { background:linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%); background-size:200% 100%; animation:mo-shimmer 1.4s infinite; border-radius:8px; }
        @keyframes mo-shimmer { to{background-position:-200% 0} }

        .mo-logout { padding:8px 14px; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer; border:1.5px solid #fecdd3; background:#fff1f2; color:#e11d48; transition:all 0.18s; }
        .mo-logout:hover { background:#ffe4e6; }
      `}</style>

      <div className="mo-root">
        {/* Header */}
        <div className="mo-header">
          <div>
            <h1>👥 All Owners</h1>
            <p>Every registered hostel owner on Nilayam Hostel Managements</p>
          </div>
          <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
            <div className="mo-nav">
              <Link to="/master/dashboard"    className="mo-navbtn">📊 Dashboard</Link>
              <Link to="/master/owners"       className="mo-navbtn active">👥 Owners</Link>
              <Link to="/master/manage-logins" className="mo-navbtn">🔐 Manage Logins</Link>
            </div>
            <button className="mo-logout" onClick={() => { sessionStorage.clear(); navigate("/login", { replace: true }); }}>
              Logout
            </button>
          </div>
        </div>

        {/* Search */}
        <div style={{ marginBottom:16 }}>
          <input
            className="mo-search"
            placeholder="🔍  Search by name, email or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span style={{ marginLeft:12, fontSize:13, color:"#94a3b8" }}>{filtered.length} owner{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Table */}
        <div className="mo-table-wrap">
          {loading ? (
            <div style={{ padding:24, display:"flex", flexDirection:"column", gap:12 }}>
              {[...Array(5)].map((_, i) => (
                <div key={i} className="mo-skeleton" style={{ height:44 }} />
              ))}
            </div>
          ) : (
            <div style={{ overflowX:"auto" }}>
              <table className="mo-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Property / Owner</th>
                    <th>Contact</th>
                    <th>Buildings</th>
                    <th>Tenants</th>
                    <th>Revenue/mo</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign:"center", color:"#94a3b8", padding:40 }}>No owners found.</td></tr>
                  )}
                  {filtered.map((o, i) => (
                    <tr
                      key={o._id}
                      className={selected === o._id ? "selected" : ""}
                      onClick={() => openDetail(o._id)}
                    >
                      <td style={{ color:"#94a3b8", fontSize:12 }}>{i + 1}</td>
                      <td>
                        <div style={{ fontWeight:700, color:"#0f172a" }}>{o.name}</div>
                        <div style={{ fontSize:12, color:"#64748b" }}>{o.owner}</div>
                      </td>
                      <td>
                        <div style={{ fontSize:13 }}>{o.email}</div>
                        <div style={{ fontSize:12, color:"#94a3b8" }}>{o.ph}</div>
                      </td>
                      <td>{o.stats?.totalBuildings ?? 0}</td>
                      <td>
                        <div>{o.stats?.activeTenants ?? 0} active</div>
                        <div style={{ fontSize:11, color:"#94a3b8" }}>{o.stats?.totalTenants ?? 0} total</div>
                      </td>
                      <td style={{ fontWeight:600, color:"#10b981" }}>
                        ₹{(o.stats?.totalRevenue ?? 0).toLocaleString("en-IN")}
                      </td>
                      <td>{statusBadge(o.loginStatus)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Detail drawer */}
      {selected && (
        <>
          <div className="mo-drawer-bg" onClick={() => { setSelected(null); setDetail(null); }} />
          <div className="mo-drawer">
            <button className="mo-drawer-close" onClick={() => { setSelected(null); setDetail(null); }}>✕</button>

            {dLoading && (
              <div style={{ display:"flex", flexDirection:"column", gap:12, paddingTop:40 }}>
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="mo-skeleton" style={{ height:i === 0 ? 28 : 18, width: i === 0 ? "60%" : "80%" }} />
                ))}
              </div>
            )}

            {!dLoading && detail && (
              <>
                <div className="mo-drawer-name">{detail.user.name}</div>
                <div className="mo-drawer-sub">{detail.user.owner} · {detail.user.email} · {detail.user.ph}</div>

                <div style={{ marginBottom:12 }}>{statusBadge(detail.user.loginStatus)}</div>

                <div style={{ fontSize:12, color:"#64748b", marginBottom:6 }}>
                  📍 {detail.user.address}
                </div>
                <div style={{ fontSize:12, color:"#94a3b8", marginBottom:16 }}>
                  Registered: {new Date(detail.user.createdAt).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" })}
                </div>

                {/* Stats */}
                <div className="mo-dstats">
                  {[
                    { label:"Buildings",      value: detail.stats.totalBuildings },
                    { label:"Total Tenants",  value: detail.stats.totalTenants },
                    { label:"Active Tenants", value: detail.stats.activeTenants },
                    { label:"Total Beds",     value: detail.stats.totalBeds },
                    { label:"Occupied Beds",  value: detail.stats.occupiedBeds },
                    { label:"Monthly Rev.",   value: `₹${(detail.stats.totalRevenue).toLocaleString("en-IN")}` },
                  ].map((s) => (
                    <div className="mo-dstat" key={s.label}>
                      <div className="mo-dstat-val">{s.value}</div>
                      <div className="mo-dstat-lbl">{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Buildings */}
                <div className="mo-section">🏨 Buildings & Floors</div>
                {detail.buildings.length === 0 && (
                  <div style={{ color:"#94a3b8", fontSize:13 }}>No buildings added yet.</div>
                )}
                {detail.buildings.map((b) => {
                  let totalBeds = 0, occupiedBeds = 0;
                  for (const f of b.floors) for (const r of f.rooms) {
                    totalBeds    += r.beds.length;
                    occupiedBeds += r.beds.filter(bed => bed.status === "Occupied").length;
                  }
                  return (
                    <div className="mo-building-card" key={b._id}>
                      <div className="mo-building-name">🏢 {b.buildingName}</div>
                      <div className="mo-building-addr">{b.address || "No address"}</div>
                      <div style={{ display:"flex", gap:8, marginBottom:10, flexWrap:"wrap" }}>
                        <span className="mo-ms">{b.floors.length} floors</span>
                        <span className="mo-ms">{b.floors.reduce((s, f) => s + f.rooms.length, 0)} rooms</span>
                        <span className="mo-ms">{totalBeds} beds</span>
                        <span className="mo-ms" style={{ background:"#f0fdf4", color:"#16a34a" }}>{occupiedBeds} occupied</span>
                      </div>
                      {b.floors.map((f) => (
                        <div className="mo-floor" key={f._id}>
                          <div className="mo-floor-title">Floor {f.floorNumber}{f.floorName ? ` — ${f.floorName}` : ""}</div>
                          <div className="mo-rooms">
                            {f.rooms.map((r) => (
                              <span className="mo-room" key={r._id}>
                                Rm {r.roomNumber} ({r.shareType}-share)
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}

                {/* Tenants */}
                <div className="mo-section">🧑‍🤝‍🧑 Tenants ({detail.tenants.length})</div>
                {detail.tenants.length === 0 && (
                  <div style={{ color:"#94a3b8", fontSize:13 }}>No tenants added yet.</div>
                )}
                {detail.tenants.map((t) => {
                  const pay = t.currentPayment;
                  return (
                    <div className="mo-tenant-card" key={t._id}>
                      <div>
                        <div className="mo-tenant-name">{t.name}</div>
                        <div className="mo-tenant-info">{t.phone} {t.email ? `· ${t.email}` : ""}</div>
                        {t.allocationInfo?.buildingName && (
                          <div className="mo-tenant-info" style={{ color:"#6366f1" }}>
                            🏢 {t.allocationInfo.buildingName} · Rm {t.allocationInfo.roomNumber} · Bed {t.allocationInfo.bedNumber}
                          </div>
                        )}
                        <div className="mo-tenant-info">Rent: ₹{(t.rentAmount).toLocaleString("en-IN")}/mo</div>
                      </div>
                      <div style={{ display:"flex", flexDirection:"column", gap:5, alignItems:"flex-end", flexShrink:0 }}>
                        <span className={`mo-pill ${t.status === "Active" ? "active" : "inactive"}`}>{t.status}</span>
                        {pay && (
                          <span className={`mo-pill ${pay.status.toLowerCase()}`}>{pay.status}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}