// MasterApprovals.jsx — extension requests differentiated, shows plan diff
import { useState, useEffect } from "react";
import { API } from "../api.js";

export default function MasterApprovals() {
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [success, setSuccess] = useState("");
  const [acting,  setActing]  = useState(null);

  const token   = sessionStorage.getItem("token");
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const loadPending = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API}/approval/pending`, { headers });
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch { setError("Failed to load pending users."); }
    finally  { setLoading(false); }
  };

  useEffect(() => { loadPending(); }, []);

  const act = async (id, action) => {
    setActing(id); setError(""); setSuccess("");
    try {
      const res  = await fetch(`${API}/approval/${id}/${action}`, { method: "PATCH", headers });
      const data = await res.json();
      if (!res.ok) return setError(data.message || "Action failed.");
      setUsers(users.filter(u => u._id !== id));
      setSuccess(`User ${action === "approve" ? "approved ✅" : "rejected ❌"} successfully.`);
      setTimeout(() => setSuccess(""), 4000);
    } catch { setError("Server error."); }
    finally  { setActing(null); }
  };

  const newRegs       = users.filter(u => !u.extensionRequest?.requested);
  const extensionReqs = users.filter(u =>  u.extensionRequest?.requested);

  const fmt = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" }) : "—";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        .map-root { font-family:'Plus Jakarta Sans',sans-serif; padding:32px 28px; max-width:920px; margin:0 auto; }
        .map-header { margin-bottom:28px; }
        .map-header h1 { font-size:22px; font-weight:800; color:#0f172a; }
        .map-header p  { font-size:13.5px; color:#94a3b8; margin-top:4px; }

        .map-alert { padding:10px 14px; border-radius:9px; font-size:13px; font-weight:600; margin-bottom:16px; }
        .map-alert.err { background:#fff1f2; border:1px solid #fecdd3; color:#e11d48; }
        .map-alert.ok  { background:#f0fdf4; border:1px solid #bbf7d0; color:#15803d; }

        .map-section-title { font-size:15px; font-weight:800; color:#0f172a; margin:24px 0 14px; display:flex; align-items:center; gap:8px; }
        .map-section-count { font-size:12px; font-weight:700; padding:2px 10px; border-radius:99px; }
        .map-section-count.new { background:#eef2ff; color:#4f46e5; }
        .map-section-count.ext { background:#fff7ed; color:#c2410c; }

        .map-list { display:flex; flex-direction:column; gap:14px; }

        .map-card { background:#fff; border:1.5px solid #fde68a; border-radius:14px; padding:20px 22px; display:flex; align-items:flex-start; gap:16px; flex-wrap:wrap; box-shadow:0 2px 12px rgba(0,0,0,0.04); position:relative; }
        .map-card.extension { border-color:#c7d2fe; background:#fafbff; }

        .map-ext-ribbon { position:absolute; top:12px; right:12px; background:linear-gradient(135deg,#4f46e5,#818cf8); color:#fff; font-size:10.5px; font-weight:800; padding:3px 10px; border-radius:99px; letter-spacing:0.04em; }

        .map-avatar { width:46px; height:46px; border-radius:50%; background:linear-gradient(135deg,#4f46e5,#818cf8); display:flex; align-items:center; justify-content:center; font-size:18px; font-weight:800; color:#fff; flex-shrink:0; }
        .map-avatar.ext { background:linear-gradient(135deg,#f59e0b,#fbbf24); }

        .map-info { flex:1; min-width:180px; }
        .map-name  { font-size:15px; font-weight:700; color:#0f172a; }
        .map-owner { font-size:13px; color:#64748b; margin-top:2px; }
        .map-meta  { display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; }
        .map-badge { display:inline-flex; align-items:center; gap:5px; font-size:11.5px; font-weight:600; padding:3px 10px; border-radius:99px; }
        .map-badge.email   { background:#f1f5f9; color:#475569; }
        .map-badge.ph      { background:#ecfdf5; color:#059669; }
        .map-badge.plan    { background:#eef2ff; color:#4f46e5; }
        .map-badge.plan-free { background:#ecfdf5; color:#059669; }
        .map-badge.date    { background:#fff7ed; color:#c2410c; }
        .map-badge.expired { background:#fff1f2; color:#e11d48; }
        .map-addr { font-size:12px; color:#94a3b8; margin-top:6px; line-height:1.5; }

        /* Plan diff */
        .map-plan-diff { margin-top:12px; background:#f8f9fc; border:1.5px solid #e2e8f0; border-radius:10px; padding:12px 14px; display:flex; align-items:center; gap:14px; flex-wrap:wrap; }
        .map-plan-diff-item { display:flex; flex-direction:column; gap:2px; }
        .map-plan-diff-lbl { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:#94a3b8; }
        .map-plan-diff-val { font-size:13.5px; font-weight:700; }
        .map-plan-diff-val.old { color:#e11d48; text-decoration:line-through; }
        .map-plan-diff-val.new { color:#10b981; }
        .map-plan-diff-arrow { font-size:18px; color:#94a3b8; }

        .map-actions { display:flex; flex-direction:column; gap:8px; min-width:110px; align-items:flex-end; justify-content:center; }
        .map-btn { padding:9px 18px; border-radius:9px; border:none; font-size:13px; font-weight:700; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; transition:transform 0.18s,box-shadow 0.18s,opacity 0.18s; width:100%; }
        .map-btn.approve { background:linear-gradient(135deg,#10b981,#34d399); color:#fff; box-shadow:0 3px 10px rgba(16,185,129,0.3); }
        .map-btn.approve:hover { transform:translateY(-1px); }
        .map-btn.reject  { background:#fff1f2; color:#e11d48; border:1.5px solid #fecdd3; }
        .map-btn.reject:hover { background:#fecdd3; }
        .map-btn:disabled { opacity:0.5; cursor:not-allowed; transform:none; }

        .map-empty { text-align:center; padding:56px 24px; color:#94a3b8; font-size:15px; background:#f8f9fc; border-radius:14px; border:1.5px dashed #e2e8f0; }
        .map-empty-icon { font-size:40px; display:block; margin-bottom:12px; }
        .map-sub-empty { padding:20px; text-align:center; color:#94a3b8; font-size:13px; background:#f8f9fc; border-radius:10px; border:1.5px dashed #e2e8f0; }

        .map-spin { display:inline-block; width:12px; height:12px; border:2px solid rgba(255,255,255,0.35); border-top-color:#fff; border-radius:50%; animation:map-rot 0.65s linear infinite; }
        @keyframes map-rot { to { transform:rotate(360deg); } }
      `}</style>

      <div className="map-root">
        <div className="map-header">
          <h1>⏳ Pending Approvals</h1>
          <p>Review new registrations and plan extension requests.</p>
        </div>

        {error   && <div className="map-alert err">⚠️ {error}</div>}
        {success && <div className="map-alert ok">{success}</div>}

        {loading ? (
          <div className="map-empty"><span className="map-empty-icon">⏳</span>Loading pending users…</div>
        ) : users.length === 0 ? (
          <div className="map-empty"><span className="map-empty-icon">✅</span>No pending approvals. All caught up!</div>
        ) : (
          <>
            {/* ── New Registrations ── */}
            <div className="map-section-title">
              🆕 New Registrations
              <span className="map-section-count new">{newRegs.length}</span>
            </div>
            {newRegs.length === 0
              ? <div className="map-sub-empty">No new registrations pending.</div>
              : (
                <div className="map-list">
                  {newRegs.map(user => (
                    <div key={user._id} className="map-card">
                      <div className="map-avatar">{user.name?.[0]?.toUpperCase() || "?"}</div>
                      <div className="map-info">
                        <div className="map-name">{user.name}</div>
                        <div className="map-owner">Owner: {user.owner}</div>
                        <div className="map-meta">
                          <span className="map-badge email">✉️ {user.email}</span>
                          <span className="map-badge ph">📞 {user.ph}</span>
                          {user.planName
                            ? <span className="map-badge plan">📋 {user.planName}{user.plan?.price ? ` — ₹${user.plan.price.toLocaleString("en-IN")}` : ""}</span>
                            : <span className="map-badge plan-free">✅ Free Plan</span>
                          }
                          {user.plan?.days && <span className="map-badge date">📅 {user.plan.days} days</span>}
                          <span className="map-badge date">🗓 Registered {fmt(user.createdAt)}</span>
                        </div>
                        <div className="map-addr">📍 {user.address}</div>
                      </div>
                      <div className="map-actions">
                        <button className="map-btn approve" disabled={acting === user._id} onClick={() => act(user._id, "approve")}>
                          {acting === user._id ? <><span className="map-spin" /> …</> : "✅ Approve"}
                        </button>
                        <button className="map-btn reject" disabled={acting === user._id} onClick={() => act(user._id, "reject")}>
                          ❌ Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            }

            {/* ── Plan Extension Requests ── */}
            <div className="map-section-title" style={{ marginTop:32 }}>
              🔄 Plan Extension Requests
              <span className="map-section-count ext">{extensionReqs.length}</span>
            </div>
            {extensionReqs.length === 0
              ? <div className="map-sub-empty">No extension requests pending.</div>
              : (
                <div className="map-list">
                  {extensionReqs.map(user => {
                    const extPlan = user.extensionRequest?.planId;
                    const oldPlan = user.plan;
                    return (
                      <div key={user._id} className="map-card extension">
                        <div className="map-ext-ribbon">🔄 PLAN EXTENSION</div>
                        <div className="map-avatar ext">{user.name?.[0]?.toUpperCase() || "?"}</div>
                        <div className="map-info" style={{ paddingRight:80 }}>
                          <div className="map-name">{user.name}</div>
                          <div className="map-owner">Owner: {user.owner}</div>
                          <div className="map-meta">
                            <span className="map-badge email">✉️ {user.email}</span>
                            <span className="map-badge ph">📞 {user.ph}</span>
                            <span className="map-badge expired">⏰ Plan Expired</span>
                            <span className="map-badge date">🗓 Requested {fmt(user.extensionRequest.requestedAt)}</span>
                          </div>
                          <div className="map-addr">📍 {user.address}</div>

                          {/* Plan diff */}
                          <div className="map-plan-diff">
                            <div className="map-plan-diff-item">
                              <div className="map-plan-diff-lbl">Current / Expired Plan</div>
                              <div className="map-plan-diff-val old">
                                {user.planName || "—"}
                                {oldPlan?.price != null ? ` (₹${oldPlan.price.toLocaleString("en-IN")})` : ""}
                              </div>
                            </div>
                            <div className="map-plan-diff-arrow">→</div>
                            <div className="map-plan-diff-item">
                              <div className="map-plan-diff-lbl">Requested New Plan</div>
                              <div className="map-plan-diff-val new">
                                {user.extensionRequest.planName || "—"}
                                {user.extensionRequest.planPrice != null ? ` (₹${user.extensionRequest.planPrice.toLocaleString("en-IN")})` : ""}
                              </div>
                            </div>
                            {user.extensionRequest.planDays && (
                              <>
                                <div className="map-plan-diff-arrow">·</div>
                                <div className="map-plan-diff-item">
                                  <div className="map-plan-diff-lbl">Duration</div>
                                  <div className="map-plan-diff-val new">📅 {user.extensionRequest.planDays} days</div>
                                </div>
                              </>
                            )}
                            {extPlan?.beds && (
                              <div className="map-plan-diff-item">
                                <div className="map-plan-diff-lbl">Beds</div>
                                <div className="map-plan-diff-val new">🛏 {extPlan.beds}</div>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="map-actions">
                          <button className="map-btn approve" disabled={acting === user._id} onClick={() => act(user._id, "approve")}>
                            {acting === user._id ? <><span className="map-spin" /> …</> : "✅ Approve"}
                          </button>
                          <button className="map-btn reject" disabled={acting === user._id} onClick={() => act(user._id, "reject")}>
                            ❌ Reject
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            }
          </>
        )}
      </div>
    </>
  );
}