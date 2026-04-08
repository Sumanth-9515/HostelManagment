// Loginpage.jsx — plan-expired popup with autofilled user details & no free plans on renewal
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API } from "../api.js";

export default function LoginPage() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [blocked,  setBlocked]  = useState(false);
  const [pending,  setPending]  = useState(false);
  const [focused,  setFocused]  = useState("");
  const [showPass, setShowPass] = useState(false);
  const [mounted,  setMounted]  = useState(false);

  // Plan expired flow
  const [planExpired,      setPlanExpired]      = useState(false);
  const [planInfo,         setPlanInfo]         = useState(null);
  const [userInfo,         setUserInfo]         = useState(null);  // autofill for renewal
  const [expiredUserId,    setExpiredUserId]     = useState(null);
  const [extensionPending, setExtensionPending] = useState(false);

  // Renewal modal state
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [plans,          setPlans]          = useState([]);
  const [plansLoading,   setPlansLoading]   = useState(false);
  const [selectedPlan,   setSelectedPlan]   = useState(null);
  const [extending,      setExtending]      = useState(false);
  const [extendMsg,      setExtendMsg]      = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 40);
    const tk   = sessionStorage.getItem("token");
    const user = sessionStorage.getItem("user");
    if (tk && user) {
      try {
        const parsed = JSON.parse(user);
        navigate(parsed.role === "master" ? "/master/dashboard" : "/dashboard", { replace: true });
      } catch { sessionStorage.clear(); }
    }
    return () => clearTimeout(t);
  }, [navigate]);

  const reset = () => {
    setError(""); setBlocked(false); setPending(false);
    setPlanExpired(false); setPlanInfo(null); setUserInfo(null);
    setExpiredUserId(null); setExtensionPending(false);
    setShowRenewModal(false); setSelectedPlan(null); setExtendMsg("");
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) return setError("Both fields are required.");
    reset();
    setLoading(true);
    try {
      const res  = await fetch(`${API}/login`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = await res.json();

      if (res.status === 403 && data.pending) {
        setPending(true);
        setExtensionPending(data.extensionPending || false);
        return;
      }
      if (res.status === 403 && data.blocked)     { setBlocked(true); return; }
      if (res.status === 403 && data.planExpired) {
        setPlanExpired(true);
        setPlanInfo(data.planInfo);
        setUserInfo(data.userInfo);
        setExpiredUserId(data.userId);
        setExtensionPending(data.extensionPending || false);
        return;
      }
      if (!res.ok) return setError(data.message || "Login failed. Please try again.");

      sessionStorage.setItem("token", data.token);
      sessionStorage.setItem("user",  JSON.stringify(data.user));
      navigate(data.user.role === "master" ? "/master/dashboard" : "/dashboard", { replace: true });
    } catch {
      setError("Cannot connect to server. Make sure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  const openRenewModal = async () => {
    setShowRenewModal(true);
    setSelectedPlan(null);
    setExtendMsg("");
    setPlansLoading(true);
    try {
      const res  = await fetch(`${API}/plans`);
      const data = await res.json();
      // Always exclude free plans on renewal
      const paid = Array.isArray(data) ? data.filter(p => !p.isFree) : [];
      setPlans(paid);
    } catch { setPlans([]); }
    finally  { setPlansLoading(false); }
  };

  const handleConfirmExtension = async () => {
    if (!selectedPlan || !expiredUserId) return;
    setExtending(true);
    setExtendMsg("");
    try {
      const res  = await fetch(`${API}/request-extension`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ userId: expiredUserId, planId: selectedPlan._id }),
      });
      const data = await res.json();
      if (!res.ok) { setExtendMsg("error:" + (data.message || "Failed.")); return; }
      setExtendMsg("success:Extension request submitted! Admin will approve shortly.");
      setExtensionPending(true);
      setShowRenewModal(false);
    } catch {
      setExtendMsg("error:Cannot connect to server.");
    } finally {
      setExtending(false);
    }
  };

  const fmt = (d) => d ? new Date(d).toLocaleString("en-IN", { day:"numeric", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" }) : "—";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }

        .lp-root { min-height:100vh; display:flex; font-family:'Plus Jakarta Sans',sans-serif; background:#f8f9fc; }

        .lp-left { display:none; flex:0 0 400px; background:linear-gradient(155deg,#1e1b4b 0%,#312e81 45%,#4338ca 100%); padding:48px 44px; flex-direction:column; justify-content:space-between; position:relative; overflow:hidden; }
        @media (min-width:860px) { .lp-left { display:flex; } }
        .lp-left-blob1 { position:absolute; top:-100px; right:-80px; width:300px; height:300px; border-radius:50%; background:rgba(139,92,246,0.25); filter:blur(70px); pointer-events:none; }
        .lp-left-blob2 { position:absolute; bottom:-80px; left:-60px; width:260px; height:260px; border-radius:50%; background:rgba(16,185,129,0.15); filter:blur(55px); pointer-events:none; }
        .lp-brand { display:flex; align-items:center; gap:10px; position:relative; z-index:1; }
        .lp-brand-icon { width:38px; height:38px; background:rgba(255,255,255,0.15); border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:18px; border:1px solid rgba(255,255,255,0.2); }
        .lp-brand-name { font-size:16px; font-weight:700; letter-spacing:0.1em; color:#fff; }
        .lp-left-mid { position:relative; z-index:1; }
        .lp-left-mid h2 { font-size:26px; font-weight:700; color:#fff; line-height:1.35; margin-bottom:12px; }
        .lp-left-mid p { font-size:13.5px; color:rgba(255,255,255,0.45); line-height:1.75; }
        .lp-features { display:flex; flex-direction:column; gap:10px; position:relative; z-index:1; }
        .lp-feat { display:flex; align-items:center; gap:10px; padding:10px 14px; background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.1); border-radius:10px; }
        .lp-feat-dot { width:7px; height:7px; border-radius:50%; background:#34d399; box-shadow:0 0 8px #34d399; flex-shrink:0; }
        .lp-feat-txt { font-size:12.5px; color:rgba(255,255,255,0.6); }

        .lp-right { flex:1; display:flex; align-items:center; justify-content:center; padding:40px 24px; }
        .lp-card { width:100%; max-width:390px; opacity:0; transform:translateY(20px); transition:opacity 0.5s cubic-bezier(0.16,1,0.3,1),transform 0.5s cubic-bezier(0.16,1,0.3,1); }
        .lp-card.in { opacity:1; transform:translateY(0); }

        .lp-mob-brand { display:flex; align-items:center; gap:8px; margin-bottom:28px; }
        @media (min-width:860px) { .lp-mob-brand { display:none; } }
        .lp-mob-brand-icon { width:32px; height:32px; background:linear-gradient(135deg,#4f46e5,#818cf8); border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:14px; }
        .lp-mob-brand-name { font-size:15px; font-weight:700; letter-spacing:0.08em; color:#1e1b4b; }

        .lp-hd { margin-bottom:30px; }
        .lp-hd h1 { font-size:23px; font-weight:700; color:#0f172a; margin-bottom:5px; }
        .lp-hd p  { font-size:13.5px; color:#94a3b8; }

        .lp-form { display:flex; flex-direction:column; gap:17px; }
        .lp-field { display:flex; flex-direction:column; gap:6px; }
        .lp-lbl { font-size:11.5px; font-weight:600; letter-spacing:0.05em; text-transform:uppercase; color:#94a3b8; transition:color 0.2s; }
        .lp-lbl.on { color:#4f46e5; }
        .lp-iw { position:relative; }
        .lp-inp { width:100%; padding:11px 42px 11px 14px; font-size:14px; font-family:'Plus Jakarta Sans',sans-serif; color:#0f172a; background:#fff; border:1.5px solid #e2e8f0; border-radius:10px; outline:none; transition:border-color 0.2s,box-shadow 0.2s,background 0.2s; -webkit-appearance:none; }
        .lp-inp::placeholder { color:#cbd5e1; }
        .lp-inp:focus { border-color:#6366f1; box-shadow:0 0 0 3.5px rgba(99,102,241,0.13); background:#fafbff; }
        .lp-inp.err { border-color:#fca5a5; }
        .lp-eye-btn { position:absolute; right:11px; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; color:#b0bec5; display:flex; align-items:center; padding:2px; transition:color 0.2s; }
        .lp-eye-btn:hover { color:#6366f1; }

        .lp-err { display:flex; align-items:center; gap:8px; padding:10px 13px; background:#fff1f2; border:1px solid #fecdd3; border-radius:9px; font-size:12.5px; color:#e11d48; animation:lp-shake 0.35s ease; }
        @keyframes lp-shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-5px)} 40%{transform:translateX(5px)} 60%{transform:translateX(-3px)} 80%{transform:translateX(3px)} }

        .lp-blocked { padding:18px 20px; background:#fff7ed; border:1.5px solid #fed7aa; border-radius:13px; }
        .lp-blocked-title { display:flex; align-items:center; gap:9px; font-size:15px; font-weight:700; color:#c2410c; margin-bottom:8px; }
        .lp-blocked-body { font-size:13px; color:#9a3412; line-height:1.6; }
        .lp-blocked-contact { display:inline-flex; align-items:center; gap:6px; margin-top:12px; padding:8px 16px; background:#fff; border:1.5px solid #fed7aa; border-radius:8px; font-size:12.5px; font-weight:700; color:#c2410c; text-decoration:none; }

        .lp-pending { padding:18px 20px; background:#fffbeb; border:1.5px solid #fde68a; border-radius:13px; }
        .lp-pending-title { display:flex; align-items:center; gap:9px; font-size:15px; font-weight:700; color:#92400e; margin-bottom:8px; }
        .lp-pending-body { font-size:13px; color:#78350f; line-height:1.6; }

        .lp-btn { width:100%; padding:12.5px; font-size:14px; font-weight:600; font-family:'Plus Jakarta Sans',sans-serif; color:#fff; background:linear-gradient(135deg,#4f46e5 0%,#6366f1 100%); border:none; border-radius:10px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; box-shadow:0 4px 14px rgba(79,70,229,0.28); transition:transform 0.18s,box-shadow 0.18s,opacity 0.18s; margin-top:2px; }
        .lp-btn:not(:disabled):hover { transform:translateY(-1px); box-shadow:0 8px 22px rgba(79,70,229,0.38); }
        .lp-btn:disabled { opacity:0.6; cursor:not-allowed; }
        .lp-spin { width:15px; height:15px; border:2px solid rgba(255,255,255,0.35); border-top-color:#fff; border-radius:50%; animation:lp-rot 0.65s linear infinite; }
        @keyframes lp-rot { to{transform:rotate(360deg)} }

        .lp-div { display:flex; align-items:center; gap:12px; margin:18px 0 0; }
        .lp-div-line { flex:1; height:1px; background:#e2e8f0; }
        .lp-div-txt  { font-size:11.5px; color:#cbd5e1; }
        .lp-foot { margin-top:14px; text-align:center; font-size:13px; color:#94a3b8; }
        .lp-foot a { color:#6366f1; font-weight:600; text-decoration:none; }

        /* ══════════ PLAN EXPIRED OVERLAY ══════════ */
        .exp-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.6); backdrop-filter:blur(5px); z-index:1000; display:flex; align-items:center; justify-content:center; padding:20px; animation:exp-fade 0.25s ease; }
        @keyframes exp-fade { from{opacity:0} to{opacity:1} }
        .exp-modal { background:#fff; border-radius:22px; padding:0; max-width:500px; width:100%; box-shadow:0 28px 70px rgba(0,0,0,0.2); animation:exp-up 0.32s cubic-bezier(0.16,1,0.3,1); overflow:hidden; }
        @keyframes exp-up { from{opacity:0;transform:translateY(36px)} to{opacity:1;transform:translateY(0)} }

        /* Header band */
        .exp-header { background:linear-gradient(135deg,#fef3c7,#fde68a); padding:28px 28px 20px; text-align:center; border-bottom:1.5px solid #fde68a; }
        .exp-icon  { font-size:52px; display:block; margin-bottom:10px; }
        .exp-title { font-size:21px; font-weight:800; color:#92400e; margin-bottom:5px; }
        .exp-sub   { font-size:13px; color:#78350f; line-height:1.6; }

        /* Body */
        .exp-body { padding:22px 26px 26px; }

        /* Plan info table */
        .exp-table { background:#f8f9fc; border:1.5px solid #e2e8f0; border-radius:12px; padding:14px 16px; margin-bottom:18px; }
        .exp-row { display:flex; justify-content:space-between; align-items:center; padding:5px 0; border-bottom:1px solid #f1f5f9; font-size:13px; }
        .exp-row:last-child { border-bottom:none; }
        .exp-row-lbl { color:#94a3b8; font-weight:500; }
        .exp-row-val { color:#0f172a; font-weight:700; text-align:right; }
        .exp-row-val.red  { color:#e11d48; }
        .exp-row-val.green{ color:#10b981; }

        /* User info */
        .exp-user-card { background:#eef2ff; border:1.5px solid #c7d2fe; border-radius:12px; padding:12px 16px; margin-bottom:18px; }
        .exp-user-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:#6366f1; margin-bottom:10px; }
        .exp-user-grid  { display:grid; grid-template-columns:1fr 1fr; gap:6px 16px; }
        .exp-user-item  { font-size:12.5px; color:#3730a3; }
        .exp-user-item span { font-weight:700; }

        /* Pending badge */
        .exp-pending-badge { display:flex; align-items:center; justify-content:center; gap:8px; background:#fffbeb; border:1.5px solid #fde68a; border-radius:10px; padding:11px 16px; font-size:13px; font-weight:700; color:#92400e; margin-bottom:14px; }

        /* Extend msg */
        .exp-msg { padding:10px 14px; border-radius:9px; font-size:13px; font-weight:600; margin-bottom:14px; }
        .exp-msg.ok  { background:#f0fdf4; border:1px solid #bbf7d0; color:#15803d; }
        .exp-msg.err { background:#fff1f2; border:1px solid #fecdd3; color:#e11d48; }

        /* Action buttons */
        .exp-btn-renew { width:100%; padding:13px; border-radius:11px; border:none; font-size:14px; font-weight:700; font-family:'Plus Jakarta Sans',sans-serif; background:linear-gradient(135deg,#4f46e5,#6366f1); color:#fff; cursor:pointer; box-shadow:0 4px 16px rgba(79,70,229,0.3); transition:transform 0.18s,box-shadow 0.18s; display:flex; align-items:center; justify-content:center; gap:8px; margin-bottom:10px; }
        .exp-btn-renew:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 8px 24px rgba(79,70,229,0.4); }
        .exp-btn-renew:disabled { opacity:0.6; cursor:not-allowed; }
        .exp-btn-back  { width:100%; padding:11px; border-radius:10px; border:1.5px solid #e2e8f0; font-size:13.5px; font-weight:600; font-family:'Plus Jakarta Sans',sans-serif; background:#fff; color:#64748b; cursor:pointer; transition:border-color 0.18s,color 0.18s; }
        .exp-btn-back:hover { border-color:#6366f1; color:#4f46e5; }

        /* ══════════ RENEW PLAN MODAL ══════════ */
        .ren-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.65); backdrop-filter:blur(5px); z-index:1010; display:flex; align-items:center; justify-content:center; padding:20px; animation:exp-fade 0.2s ease; }
        .ren-modal { background:#fff; border-radius:20px; max-width:520px; width:100%; max-height:90vh; overflow-y:auto; box-shadow:0 28px 70px rgba(0,0,0,0.22); animation:exp-up 0.28s cubic-bezier(0.16,1,0.3,1); }
        .ren-header { padding:22px 24px 16px; border-bottom:1.5px solid #f1f5f9; display:flex; align-items:center; justify-content:space-between; }
        .ren-header h3 { font-size:17px; font-weight:800; color:#0f172a; }
        .ren-close { background:none; border:none; font-size:20px; cursor:pointer; color:#94a3b8; line-height:1; padding:2px; }
        .ren-body { padding:20px 24px 24px; }

        /* Autofill user summary */
        .ren-user-box { background:#f8f9fc; border:1.5px solid #e2e8f0; border-radius:12px; padding:14px 16px; margin-bottom:18px; }
        .ren-user-box-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:#94a3b8; margin-bottom:10px; }
        .ren-user-box-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px 20px; }
        .ren-user-field { font-size:12.5px; }
        .ren-user-field-lbl { color:#94a3b8; font-size:11px; }
        .ren-user-field-val { color:#0f172a; font-weight:700; margin-top:1px; }

        /* Plan selection */
        .ren-plans-title { font-size:13px; font-weight:700; color:#0f172a; margin-bottom:12px; }
        .ren-plans-list  { display:flex; flex-direction:column; gap:10px; margin-bottom:18px; }
        .ren-plan-opt { border:2px solid #e2e8f0; border-radius:12px; padding:14px 16px; cursor:pointer; transition:border-color 0.18s,background 0.18s,box-shadow 0.18s; display:flex; align-items:center; gap:14px; }
        .ren-plan-opt:hover { border-color:#a5b4fc; background:#fafbff; }
        .ren-plan-opt.selected { border-color:#4f46e5; background:#eef2ff; box-shadow:0 0 0 3px rgba(99,102,241,0.15); }
        .ren-plan-radio { width:18px; height:18px; border-radius:50%; border:2px solid #cbd5e1; flex-shrink:0; display:flex; align-items:center; justify-content:center; transition:border-color 0.18s; }
        .ren-plan-opt.selected .ren-plan-radio { border-color:#4f46e5; background:#4f46e5; }
        .ren-plan-radio-dot { width:8px; height:8px; border-radius:50%; background:#fff; }
        .ren-plan-info { flex:1; }
        .ren-plan-name { font-size:14px; font-weight:700; color:#0f172a; }
        .ren-plan-meta { font-size:12px; color:#94a3b8; margin-top:3px; }
        .ren-plan-price { font-size:19px; font-weight:800; color:#4f46e5; }

        .ren-loading { text-align:center; color:#94a3b8; font-size:13px; padding:24px; }
        .ren-empty   { text-align:center; color:#94a3b8; font-size:13px; padding:24px; background:#f8f9fc; border-radius:10px; border:1.5px dashed #e2e8f0; }

        .ren-msg { padding:10px 14px; border-radius:9px; font-size:13px; font-weight:600; margin-bottom:14px; }
        .ren-msg.ok  { background:#f0fdf4; border:1px solid #bbf7d0; color:#15803d; }
        .ren-msg.err { background:#fff1f2; border:1px solid #fecdd3; color:#e11d48; }

        .ren-confirm-btn { width:100%; padding:13px; border-radius:11px; border:none; font-size:14px; font-weight:700; font-family:'Plus Jakarta Sans',sans-serif; background:linear-gradient(135deg,#10b981,#34d399); color:#fff; cursor:pointer; box-shadow:0 4px 14px rgba(16,185,129,0.3); transition:transform 0.18s,opacity 0.18s; display:flex; align-items:center; justify-content:center; gap:8px; }
        .ren-confirm-btn:hover:not(:disabled) { transform:translateY(-1px); }
        .ren-confirm-btn:disabled { opacity:0.5; cursor:not-allowed; }

        .ren-spin { width:14px; height:14px; border:2px solid rgba(255,255,255,0.35); border-top-color:#fff; border-radius:50%; animation:lp-rot 0.65s linear infinite; }
      `}</style>

      {/* ══ Plan Expired Overlay ══ */}
      {planExpired && !showRenewModal && (
        <div className="exp-overlay">
          <div className="exp-modal">
            <div className="exp-header">
              <span className="exp-icon">⏰</span>
              <div className="exp-title">Your Plan Has Expired</div>
              <div className="exp-sub">Your subscription has ended. Renew now to regain full access to your dashboard.</div>
            </div>
            <div className="exp-body">
              {/* Plan details */}
              {planInfo && (
                <div className="exp-table">
                  <div className="exp-row">
                    <span className="exp-row-lbl">Plan</span>
                    <span className="exp-row-val">{planInfo.planName || "—"}</span>
                  </div>
                  <div className="exp-row">
                    <span className="exp-row-lbl">Activated on</span>
                    <span className="exp-row-val">{fmt(planInfo.planActivatedAt)}</span>
                  </div>
                  <div className="exp-row">
                    <span className="exp-row-lbl">Expired on</span>
                    <span className="exp-row-val red">{fmt(planInfo.planExpiresAt)}</span>
                  </div>
                  {planInfo.planRenewalAt && (
                    <div className="exp-row">
                      <span className="exp-row-lbl">Last renewed</span>
                      <span className="exp-row-val green">{fmt(planInfo.planRenewalAt)}</span>
                    </div>
                  )}
                  {planInfo.usedFreePlan && (
                    <div className="exp-row">
                      <span className="exp-row-lbl">Free trial</span>
                      <span className="exp-row-val red">Already used — paid plans only</span>
                    </div>
                  )}
                </div>
              )}

              {/* Extension pending */}
              {extensionPending && (
                <div className="exp-pending-badge">⏳ Extension request pending admin approval</div>
              )}

              {/* Extend message */}
              {extendMsg && (
                <div className={`exp-msg ${extendMsg.startsWith("success") ? "ok" : "err"}`}>
                  {extendMsg.replace(/^(success|error):/, "")}
                </div>
              )}

              {!extensionPending && (
                <button className="exp-btn-renew" onClick={openRenewModal}>
                  🔄 Extend / Renew Plan
                </button>
              )}
              <button className="exp-btn-back" onClick={reset}>← Back to Login</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Renew Plan Modal ══ */}
      {showRenewModal && (
        <div className="ren-overlay">
          <div className="ren-modal">
            <div className="ren-header">
              <h3>🔄 Select a Plan to Renew</h3>
              <button className="ren-close" onClick={() => setShowRenewModal(false)}>✕</button>
            </div>
            <div className="ren-body">
              {/* Autofilled user details */}
              {userInfo && (
                <div className="ren-user-box">
                  <div className="ren-user-box-title">Your Account Details</div>
                  <div className="ren-user-box-grid">
                    <div className="ren-user-field">
                      <div className="ren-user-field-lbl">Property Name</div>
                      <div className="ren-user-field-val">{userInfo.name}</div>
                    </div>
                    <div className="ren-user-field">
                      <div className="ren-user-field-lbl">Owner</div>
                      <div className="ren-user-field-val">{userInfo.owner}</div>
                    </div>
                    <div className="ren-user-field">
                      <div className="ren-user-field-lbl">Email</div>
                      <div className="ren-user-field-val">{userInfo.email}</div>
                    </div>
                    <div className="ren-user-field">
                      <div className="ren-user-field-lbl">Phone</div>
                      <div className="ren-user-field-val">{userInfo.ph}</div>
                    </div>
                    {userInfo.address && (
                      <div className="ren-user-field" style={{ gridColumn: "1 / -1" }}>
                        <div className="ren-user-field-lbl">Address</div>
                        <div className="ren-user-field-val">{userInfo.address}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Plan selection */}
              <div className="ren-plans-title">Choose a plan (free trial not available):</div>
              {plansLoading ? (
                <div className="ren-loading">⏳ Loading plans…</div>
              ) : plans.length === 0 ? (
                <div className="ren-empty">No paid plans available right now. Contact admin.</div>
              ) : (
                <div className="ren-plans-list">
                  {plans.map(plan => (
                    <div
                      key={plan._id}
                      className={`ren-plan-opt ${selectedPlan?._id === plan._id ? "selected" : ""}`}
                      onClick={() => setSelectedPlan(plan)}
                    >
                      <div className="ren-plan-radio">
                        {selectedPlan?._id === plan._id && <div className="ren-plan-radio-dot" />}
                      </div>
                      <div className="ren-plan-info">
                        <div className="ren-plan-name">{plan.name}</div>
                        <div className="ren-plan-meta">🛏 {plan.beds} beds &nbsp;·&nbsp; 📅 {plan.days} days</div>
                      </div>
                      <div className="ren-plan-price">₹{plan.price.toLocaleString("en-IN")}</div>
                    </div>
                  ))}
                </div>
              )}

              {extendMsg && (
                <div className={`ren-msg ${extendMsg.startsWith("success") ? "ok" : "err"}`}>
                  {extendMsg.replace(/^(success|error):/, "")}
                </div>
              )}

              <button
                className="ren-confirm-btn"
                disabled={!selectedPlan || extending}
                onClick={handleConfirmExtension}
              >
                {extending && <div className="ren-spin" />}
                {extending ? "Submitting…" : selectedPlan ? `✅ Request — ${selectedPlan.name} (₹${selectedPlan.price.toLocaleString("en-IN")})` : "Select a plan above"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Main Login Page ══ */}
      <div className="lp-root">
        <div className="lp-left">
          <div className="lp-left-blob1" /><div className="lp-left-blob2" />
          <div className="lp-brand"><div className="lp-brand-icon">🏨</div><span className="lp-brand-name">Nilayam Hostel Management</span></div>
          <div className="lp-left-mid"><h2>Manage your hostel smarter</h2><p>Everything you need to run your property — rooms, tenants, payments — in one place.</p></div>
          <div className="lp-features">
            {["Room & bed management","Tenant onboarding & KYC","Rent tracking & receipts","Multi-property support"].map(f => (
              <div className="lp-feat" key={f}><div className="lp-feat-dot" /><span className="lp-feat-txt">{f}</span></div>
            ))}
          </div>
        </div>

        <div className="lp-right">
          <div className={`lp-card ${mounted ? "in" : ""}`}>
            <div className="lp-mob-brand"><div className="lp-mob-brand-icon">🏨</div><span className="lp-mob-brand-name">Nilayam Hostel Management</span></div>
            <div className="lp-hd"><h1>Welcome back 👋</h1><p>Sign in to your account to continue</p></div>

            <form className="lp-form" onSubmit={handleLogin}>
              <div className="lp-field">
                <label className={`lp-lbl ${focused === "email" ? "on" : ""}`}>Email</label>
                <div className="lp-iw">
                  <input type="email" className={`lp-inp ${error ? "err" : ""}`} value={email}
                    onChange={(e) => { setEmail(e.target.value); reset(); }}
                    onFocus={() => setFocused("email")} onBlur={() => setFocused("")}
                    placeholder="you@example.com" autoFocus autoComplete="email" />
                </div>
              </div>

              <div className="lp-field">
                <label className={`lp-lbl ${focused === "password" ? "on" : ""}`}>Password</label>
                <div className="lp-iw">
                  <input type={showPass ? "text" : "password"} className={`lp-inp ${error ? "err" : ""}`} value={password}
                    onChange={(e) => { setPassword(e.target.value); reset(); }}
                    onFocus={() => setFocused("password")} onBlur={() => setFocused("")}
                    placeholder="••••••••" autoComplete="current-password" />
                  <button type="button" className="lp-eye-btn" onClick={() => setShowPass(p => !p)} tabIndex={-1}>
                    {showPass
                      ? <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
              </div>

              {error && (
                <div className="lp-err">
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {error}
                </div>
              )}

              {pending && (
                <div className="lp-pending">
                  <div className="lp-pending-title"><span style={{ fontSize:20 }}>⏳</span> Account Pending Approval</div>
                  <div className="lp-pending-body">
                    {extensionPending
                      ? "Your plan extension request is being reviewed by the admin. Please check back soon."
                      : "Your registration is waiting for admin approval. We will review and respond shortly."}
                  </div>
                </div>
              )}

              {blocked && (
                <div className="lp-blocked">
                  <div className="lp-blocked-title"><span style={{ fontSize:20 }}>🚫</span> Login Access Suspended</div>
                  <div className="lp-blocked-body">
                    Your account has been suspended. Please contact support to restore access.
                  </div>
                  <a href="mailto:nilayamhostelmanagment@gmail.com" className="lp-blocked-contact">
                    📧 Contact Support
                  </a>
                </div>
              )}

              <button type="submit" className="lp-btn" disabled={loading}>
                {loading && <div className="lp-spin" />}
                {loading ? "Signing in…" : "Sign in →"}
              </button>
            </form>

          
          </div>
        </div>
      </div>
    </>
  );
}