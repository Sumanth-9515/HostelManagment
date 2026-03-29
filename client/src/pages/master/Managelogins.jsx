import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { API } from "../api.js";

const token = () => sessionStorage.getItem("token");

export default function ManageLogins() {
  const [owners,   setOwners]   = useState([]);   // { ...user, stats, loginStatus, _pending }
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState({});   // { [userId]: true/false }
  const [saved,    setSaved]    = useState({});   // { [userId]: "success"|"error" }
  const [search,   setSearch]   = useState("");
  const [filter,   setFilter]   = useState("all"); // "all"|"active"|"blocked"
  const navigate = useNavigate();

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${API}/master/users`, { headers: { Authorization: `Bearer ${token()}` } })
      .then((r) => {
        if (r.status === 401 || r.status === 403) { navigate("/login", { replace: true }); return null; }
        return r.json();
      })
      .then((d) => {
        if (d) setOwners(d.map((u) => ({ ...u, _pending: u.loginStatus })));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [navigate]);

  useEffect(() => { load(); }, [load]);

  const togglePending = (userId, status) => {
    setOwners((prev) => prev.map((u) => u._id === userId ? { ...u, _pending: status } : u));
    setSaved((prev) => ({ ...prev, [userId]: null })); // clear saved badge on change
  };

  const saveStatus = async (userId) => {
    const owner = owners.find((u) => u._id === userId);
    if (!owner || owner._pending === owner.loginStatus) return; // nothing changed

    setSaving((prev) => ({ ...prev, [userId]: true }));
    try {
      const res = await fetch(`${API}/master/users/${userId}/login-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ loginStatus: owner._pending }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      // Commit the change
      setOwners((prev) =>
        prev.map((u) => u._id === userId ? { ...u, loginStatus: data.loginStatus, _pending: data.loginStatus } : u)
      );
      setSaved((prev) => ({ ...prev, [userId]: "success" }));
      setTimeout(() => setSaved((prev) => ({ ...prev, [userId]: null })), 3000);
    } catch (err) {
      setSaved((prev) => ({ ...prev, [userId]: "error" }));
    } finally {
      setSaving((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const filtered = owners.filter((o) => {
    const matchSearch = `${o.name} ${o.owner} ${o.email}`.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || o.loginStatus === filter;
    return matchSearch && matchFilter;
  });

  const counts = {
    all:     owners.length,
    active:  owners.filter((o) => o.loginStatus === "active").length,
    blocked: owners.filter((o) => o.loginStatus === "blocked").length,
  };

  const isDirty = (o) => o._pending !== o.loginStatus;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        .ml-root { font-family:'Plus Jakarta Sans',sans-serif; background:#f8f9fc; min-height:100vh; padding:28px 24px; }
        .ml-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:24px; flex-wrap:wrap; gap:12px; }
        .ml-header h1 { font-size:22px; font-weight:700; color:#0f172a; }
        .ml-header p  { font-size:13px; color:#94a3b8; margin-top:2px; }

        .ml-nav { display:flex; gap:8px; flex-wrap:wrap; }
        .ml-navbtn {
          padding:8px 16px; border-radius:8px; font-size:13px; font-weight:600;
          cursor:pointer; border:1.5px solid #e2e8f0; background:#fff; color:#64748b;
          text-decoration:none; transition:all 0.18s;
        }
        .ml-navbtn:hover { background:#f1f5f9; }
        .ml-navbtn.active { background:#6366f1; color:#fff; border-color:#6366f1; }

        .ml-toolbar { display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-bottom:20px; }

        .ml-search {
          flex:1; min-width:220px; max-width:340px; padding:9px 14px;
          border:1.5px solid #e2e8f0; border-radius:9px; font-size:13.5px;
          font-family:inherit; outline:none; background:#fff;
          transition:border-color 0.2s, box-shadow 0.2s;
        }
        .ml-search:focus { border-color:#6366f1; box-shadow:0 0 0 3px rgba(99,102,241,0.12); }

        .ml-filter-btn {
          padding:8px 14px; border-radius:8px; font-size:12.5px; font-weight:600;
          border:1.5px solid #e2e8f0; background:#fff; color:#64748b; cursor:pointer; transition:all 0.18s;
        }
        .ml-filter-btn:hover { background:#f1f5f9; }
        .ml-filter-btn.on-all     { background:#eef2ff; color:#6366f1; border-color:#c7d2fe; }
        .ml-filter-btn.on-active  { background:#f0fdf4; color:#16a34a; border-color:#bbf7d0; }
        .ml-filter-btn.on-blocked { background:#fff1f2; color:#e11d48; border-color:#fecdd3; }

        /* Info banner */
        .ml-banner {
          display:flex; align-items:flex-start; gap:12px;
          padding:14px 18px; background:#fffbeb; border:1px solid #fde68a;
          border-radius:12px; margin-bottom:20px; font-size:13px; color:#92400e;
        }

        /* Owner cards grid */
        .ml-grid { display:flex; flex-direction:column; gap:14px; }

        .ml-card {
          background:#fff; border-radius:14px; padding:20px 22px;
          border:1.5px solid #f1f5f9;
          box-shadow:0 1px 4px rgba(0,0,0,0.05);
          display:flex; align-items:center; gap:16px; flex-wrap:wrap;
          transition:border-color 0.2s, box-shadow 0.2s;
        }
        .ml-card.blocked-card { border-color:#fecdd3; background:#fff9f9; }
        .ml-card.dirty-card   { border-color:#c7d2fe; }

        .ml-avatar {
          width:46px; height:46px; border-radius:12px; font-size:18px;
          display:flex; align-items:center; justify-content:center; flex-shrink:0;
        }

        .ml-info { flex:1; min-width:180px; }
        .ml-info-name  { font-size:15px; font-weight:700; color:#0f172a; }
        .ml-info-sub   { font-size:12.5px; color:#64748b; margin-top:2px; }
        .ml-info-stats { display:flex; gap:8px; flex-wrap:wrap; margin-top:7px; }
        .ml-stat-chip  { padding:2px 9px; border-radius:6px; font-size:11px; font-weight:600; background:#f1f5f9; color:#64748b; }

        /* Toggle switch */
        .ml-toggle-wrap { display:flex; flex-direction:column; align-items:center; gap:5px; flex-shrink:0; }
        .ml-toggle-label { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:#94a3b8; }

        .ml-switch { position:relative; display:inline-block; width:52px; height:28px; }
        .ml-switch input { opacity:0; width:0; height:0; }
        .ml-slider {
          position:absolute; cursor:pointer; inset:0;
          background:#e2e8f0; border-radius:99px;
          transition:background 0.25s;
        }
        .ml-slider::before {
          content:""; position:absolute; height:22px; width:22px;
          left:3px; top:3px; background:#fff; border-radius:50%;
          transition:transform 0.25s; box-shadow:0 1px 4px rgba(0,0,0,0.15);
        }
        input:checked + .ml-slider { background:#10b981; }
        input:checked + .ml-slider::before { transform:translateX(24px); }
        .ml-switch.blocked input:checked + .ml-slider { background:#ef4444; }
        .ml-switch.blocked input + .ml-slider { background:#e2e8f0; }

        .ml-toggle-status {
          font-size:12px; font-weight:700;
          padding:2px 9px; border-radius:6px;
        }
        .ml-toggle-status.active  { background:#f0fdf4; color:#16a34a; }
        .ml-toggle-status.blocked { background:#fff1f2; color:#e11d48; }

        /* Save button */
        .ml-save-btn {
          padding:9px 20px; border-radius:9px; font-size:13px; font-weight:700;
          border:none; cursor:pointer; font-family:inherit;
          transition:all 0.18s; flex-shrink:0;
        }
        .ml-save-btn.ready  { background:#6366f1; color:#fff; box-shadow:0 4px 12px rgba(99,102,241,0.3); }
        .ml-save-btn.ready:hover { background:#4f46e5; transform:translateY(-1px); }
        .ml-save-btn.idle   { background:#f1f5f9; color:#94a3b8; cursor:default; }
        .ml-save-btn.saving { background:#e0e7ff; color:#6366f1; cursor:wait; }
        .ml-save-btn.success { background:#f0fdf4; color:#16a34a; cursor:default; }
        .ml-save-btn.error   { background:#fff1f2; color:#e11d48; cursor:default; }

        .ml-saved-toast {
          padding:2px 10px; border-radius:6px; font-size:11.5px; font-weight:700;
        }
        .ml-saved-toast.success { background:#f0fdf4; color:#16a34a; }
        .ml-saved-toast.error   { background:#fff1f2; color:#e11d48; }

        .ml-skeleton { background:linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%); background-size:200% 100%; animation:ml-shimmer 1.4s infinite; border-radius:10px; }
        @keyframes ml-shimmer { to{background-position:-200% 0} }

        .ml-logout { padding:8px 14px; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer; border:1.5px solid #fecdd3; background:#fff1f2; color:#e11d48; transition:all 0.18s; }
        .ml-logout:hover { background:#ffe4e6; }
      `}</style>

      <div className="ml-root">
        {/* Header */}
        <div className="ml-header">
          <div>
            <h1>🔐 Manage Logins</h1>
            <p>Control owner login access — block or restore instantly</p>
          </div>
          <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
            <div className="ml-nav">
              <Link to="/master/dashboard"    className="ml-navbtn">📊 Dashboard</Link>
              <Link to="/master/owners"       className="ml-navbtn">👥 Owners</Link>
              <Link to="/master/manage-logins" className="ml-navbtn active">🔐 Manage Logins</Link>
            </div>
            <button className="ml-logout" onClick={() => { sessionStorage.clear(); navigate("/login", { replace: true }); }}>
              Logout
            </button>
          </div>
        </div>

        {/* Info banner */}
        <div className="ml-banner">
          <span style={{ fontSize:18 }}>ℹ️</span>
          <div>
            <strong>How it works:</strong> Toggle the switch to change an owner's login status, then click <strong>Save</strong>.
            Blocked owners will see an alert on the login screen and cannot access their dashboard.
          </div>
        </div>

        {/* Summary chips */}
        <div style={{ display:"flex", gap:10, marginBottom:18, flexWrap:"wrap" }}>
          <div style={{ padding:"8px 16px", borderRadius:9, background:"#eef2ff", color:"#6366f1", fontWeight:700, fontSize:13 }}>
            Total: {counts.all}
          </div>
          <div style={{ padding:"8px 16px", borderRadius:9, background:"#f0fdf4", color:"#16a34a", fontWeight:700, fontSize:13 }}>
            ✅ Active: {counts.active}
          </div>
          <div style={{ padding:"8px 16px", borderRadius:9, background:"#fff1f2", color:"#e11d48", fontWeight:700, fontSize:13 }}>
            🚫 Blocked: {counts.blocked}
          </div>
        </div>

        {/* Toolbar */}
        <div className="ml-toolbar">
          <input
            className="ml-search"
            placeholder="🔍  Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {["all","active","blocked"].map((f) => (
            <button
              key={f}
              className={`ml-filter-btn ${filter === f ? `on-${f}` : ""}`}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "All" : f === "active" ? "✅ Active" : "🚫 Blocked"}
              <span style={{ marginLeft:4, opacity:0.7 }}>({counts[f]})</span>
            </button>
          ))}
        </div>

        {/* Cards */}
        {loading ? (
          <div className="ml-grid">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="ml-card">
                <div className="ml-skeleton" style={{ width:46, height:46, borderRadius:12 }} />
                <div style={{ flex:1, display:"flex", flexDirection:"column", gap:8 }}>
                  <div className="ml-skeleton" style={{ height:18, width:"40%" }} />
                  <div className="ml-skeleton" style={{ height:13, width:"60%" }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="ml-grid">
            {filtered.length === 0 && (
              <div style={{ color:"#94a3b8", fontSize:13, padding:20 }}>No owners match your filter.</div>
            )}
            {filtered.map((o) => {
              const pending    = o._pending;
              const isBlocked  = pending === "blocked";
              const dirty      = isDirty(o);
              const isSaving   = saving[o._id];
              const savedState = saved[o._id];

              let saveBtnClass = "idle";
              let saveBtnText  = "Saved";
              if (dirty)              { saveBtnClass = "ready";   saveBtnText = "Save"; }
              if (isSaving)           { saveBtnClass = "saving";  saveBtnText = "Saving…"; }
              if (savedState === "success") { saveBtnClass = "success"; saveBtnText = "✓ Saved"; }
              if (savedState === "error")   { saveBtnClass = "error";   saveBtnText = "Error"; }

              return (
                <div
                  key={o._id}
                  className={`ml-card ${isBlocked && !dirty ? "blocked-card" : ""} ${dirty ? "dirty-card" : ""}`}
                >
                  {/* Avatar */}
                  <div
                    className="ml-avatar"
                    style={{ background: isBlocked ? "#fff1f2" : "#eef2ff" }}
                  >
                    {isBlocked ? "🚫" : "👤"}
                  </div>

                  {/* Info */}
                  <div className="ml-info">
                    <div className="ml-info-name">{o.name}</div>
                    <div className="ml-info-sub">{o.owner} · {o.email} · {o.ph}</div>
                    <div className="ml-info-stats">
                      <span className="ml-stat-chip">🏨 {o.stats?.totalBuildings ?? 0} bldgs</span>
                      <span className="ml-stat-chip">🧑‍🤝‍🧑 {o.stats?.activeTenants ?? 0} active tenants</span>
                      <span className="ml-stat-chip">💰 ₹{(o.stats?.totalRevenue ?? 0).toLocaleString("en-IN")}/mo</span>
                    </div>
                  </div>

                  {/* Toggle */}
                  <div className="ml-toggle-wrap">
                    <div className="ml-toggle-label">Login</div>
                    <label className={`ml-switch ${isBlocked ? "blocked" : ""}`}>
                      <input
                        type="checkbox"
                        checked={!isBlocked}
                        onChange={(e) => togglePending(o._id, e.target.checked ? "active" : "blocked")}
                      />
                      <span className="ml-slider" />
                    </label>
                    <div className={`ml-toggle-status ${isBlocked ? "blocked" : "active"}`}>
                      {isBlocked ? "Blocked" : "Active"}
                    </div>
                  </div>

                  {/* Save */}
                  <button
                    className={`ml-save-btn ${saveBtnClass}`}
                    disabled={!dirty || isSaving || !!savedState}
                    onClick={() => saveStatus(o._id)}
                  >
                    {saveBtnText}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}