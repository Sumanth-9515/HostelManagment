import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API } from "../api.js";

export default function LoginPage() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [blocked,  setBlocked]  = useState(false);
  const [focused,  setFocused]  = useState("");
  const [showPass, setShowPass] = useState(false);
  const [mounted,  setMounted]  = useState(false);
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

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) return setError("Both fields are required.");
    setError(""); setBlocked(false);
    setLoading(true);
    try {
      const res  = await fetch(`${API}/login`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = await res.json();

      // Blocked by master — show special alert
      if (res.status === 403 && data.blocked) {
        setBlocked(true);
        return;
      }

      if (!res.ok) return setError(data.message || "Login failed. Please try again.");

      sessionStorage.setItem("token", data.token);
      sessionStorage.setItem("user",  JSON.stringify(data.user));
      // replace: true removes login from history — back button won't return here
      navigate(data.user.role === "master" ? "/master/dashboard" : "/dashboard", { replace: true });
    } catch {
      setError("Cannot connect to server. Make sure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');
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
        .lp-inp.err { border-color:#fca5a5; box-shadow:0 0 0 3px rgba(252,165,165,0.18); }
        .lp-eye-btn { position:absolute; right:11px; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; color:#b0bec5; display:flex; align-items:center; padding:2px; transition:color 0.2s; }
        .lp-eye-btn:hover { color:#6366f1; }

        .lp-err { display:flex; align-items:center; gap:8px; padding:10px 13px; background:#fff1f2; border:1px solid #fecdd3; border-radius:9px; font-size:12.5px; color:#e11d48; animation:lp-shake 0.35s ease; }
        @keyframes lp-shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-5px)} 40%{transform:translateX(5px)} 60%{transform:translateX(-3px)} 80%{transform:translateX(3px)} }

        /* Blocked alert */
        .lp-blocked { padding:18px 20px; background:#fff7ed; border:1.5px solid #fed7aa; border-radius:13px; animation:lp-shake 0.35s ease; }
        .lp-blocked-title { display:flex; align-items:center; gap:9px; font-size:15px; font-weight:700; color:#c2410c; margin-bottom:8px; }
        .lp-blocked-body { font-size:13px; color:#9a3412; line-height:1.6; }
        .lp-blocked-contact { display:inline-flex; align-items:center; gap:6px; margin-top:12px; padding:8px 16px; background:#fff; border:1.5px solid #fed7aa; border-radius:8px; font-size:12.5px; font-weight:700; color:#c2410c; text-decoration:none; transition:background 0.18s; }
        .lp-blocked-contact:hover { background:#fff7ed; }

        .lp-btn { width:100%; padding:12.5px; font-size:14px; font-weight:600; font-family:'Plus Jakarta Sans',sans-serif; color:#fff; background:linear-gradient(135deg,#4f46e5 0%,#6366f1 100%); border:none; border-radius:10px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; box-shadow:0 4px 14px rgba(79,70,229,0.28); transition:transform 0.18s,box-shadow 0.18s,opacity 0.18s; margin-top:2px; }
        .lp-btn:not(:disabled):hover { transform:translateY(-1px); box-shadow:0 8px 22px rgba(79,70,229,0.38); }
        .lp-btn:not(:disabled):active { transform:translateY(0); }
        .lp-btn:disabled { opacity:0.6; cursor:not-allowed; }
        .lp-spin { width:15px; height:15px; border:2px solid rgba(255,255,255,0.35); border-top-color:#fff; border-radius:50%; animation:lp-rot 0.65s linear infinite; }
        @keyframes lp-rot { to{transform:rotate(360deg)} }

        .lp-div { display:flex; align-items:center; gap:12px; margin:18px 0 0; }
        .lp-div-line { flex:1; height:1px; background:#e2e8f0; }
        .lp-div-txt  { font-size:11.5px; color:#cbd5e1; }
        .lp-foot { margin-top:14px; text-align:center; font-size:13px; color:#94a3b8; }
        .lp-foot a { color:#6366f1; font-weight:600; text-decoration:none; transition:opacity 0.2s; }
        .lp-foot a:hover { opacity:0.75; }
      `}</style>

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
                  <input type="email" className={`lp-inp ${error || blocked ? "err" : ""}`} value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(""); setBlocked(false); }}
                    onFocus={() => setFocused("email")} onBlur={() => setFocused("")}
                    placeholder="you@example.com" autoFocus autoComplete="email" />
                </div>
              </div>

              <div className="lp-field">
                <label className={`lp-lbl ${focused === "password" ? "on" : ""}`}>Password</label>
                <div className="lp-iw">
                  <input type={showPass ? "text" : "password"} className={`lp-inp ${error || blocked ? "err" : ""}`} value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(""); setBlocked(false); }}
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

              {/* Normal error */}
              {error && !blocked && (
                <div className="lp-err">
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {error}
                </div>
              )}

              {/* ── BLOCKED BY MASTER — special prominent alert ── */}
              {blocked && (
                <div className="lp-blocked">
                  <div className="lp-blocked-title">
                    <span style={{ fontSize:20 }}>🚫</span>
                    Login Access Suspended
                  </div>
                  <div className="lp-blocked-body">
                    Your account login has been stopped by the website owner.
                    You cannot access your dashboard at this time.
                    Please contact the Nilayam Hostel Management support team to have your access restored.
                  </div>
                  <a href="mailto:nilayamhostelmanagment@gmail.com" className="lp-blocked-contact">
                    📧 Contact Nilayam Hostel Management Support
                  </a>
                </div>
              )}

              <button type="submit" className="lp-btn" disabled={loading}>
                {loading && <div className="lp-spin" />}
                {loading ? "Signing in…" : "Sign in →"}
              </button>
            </form>

            <div className="lp-div"><div className="lp-div-line" /><span className="lp-div-txt">or</span><div className="lp-div-line" /></div>
            <p className="lp-foot">No account? <Link to="/register">Register here</Link></p>
          </div>
        </div>
      </div>
    </>
  );
}