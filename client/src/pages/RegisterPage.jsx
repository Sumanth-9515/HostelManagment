// RegisterPage.jsx — updated with plan-aware registration
import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { API } from "../api.js";

export default function RegisterPage() {
  const [form, setForm] = useState({ name: "", owner: "", ph: "", email: "", password: "", address: "" });
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [focused,  setFocused]  = useState("");
  const [showPass, setShowPass] = useState(false);
  const [mounted,  setMounted]  = useState(false);
  const [pending,  setPending]  = useState(false);

  const navigate  = useNavigate();
  const location  = useLocation();
  const chosenPlan = location.state?.plan || null;  // plan passed from landing page

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 40);
    return () => clearTimeout(t);
  }, []);

  const set = (k) => (e) => { setForm({ ...form, [k]: e.target.value }); setError(""); };

  const handleRegister = async (e) => {
    e.preventDefault();
    const { name, owner, ph, email, password, address } = form;
    if (!name || !owner || !ph || !email || !password || !address)
      return setError("All fields are required.");
    if (!/\S+@\S+\.\S+/.test(email))
      return setError("Please enter a valid email address.");
    if (password.length < 6)
      return setError("Password must be at least 6 characters.");

    setError(""); setLoading(true);
    try {
      const body = { name: name.trim(), owner: owner.trim(), ph: ph.trim(), email: email.trim().toLowerCase(), password, address: address.trim() };
      if (chosenPlan) body.planId = chosenPlan._id;

      const res  = await fetch(`${API}/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) return setError(data.message || "Registration failed.");

      if (data.pending) {
        setPending(true);
        return;
      }

      if (data.token && data.user) {
        sessionStorage.setItem("token", data.token);
        sessionStorage.setItem("user",  JSON.stringify(data.user));
        navigate(data.user.role === "master" ? "/master/dashboard" : "/dashboard", { replace: true });
      } else {
        navigate("/login", { replace: true });
      }
    } catch {
      setError("Cannot connect to server. Make sure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  // ── Pending approval screen ───────────────────────────────────────────────
  if (pending) {
    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          .pend-root { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f8f9fc; font-family: 'Plus Jakarta Sans', sans-serif; padding: 24px; }
          .pend-card { background: #fff; border-radius: 20px; border: 2px solid #fde68a; box-shadow: 0 12px 40px rgba(0,0,0,0.08); padding: 48px 36px; max-width: 480px; width: 100%; text-align: center; animation: pend-in 0.5s cubic-bezier(0.16,1,0.3,1); }
          @keyframes pend-in { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
          .pend-icon { font-size: 56px; margin-bottom: 20px; }
          .pend-title { font-size: 22px; font-weight: 800; color: #92400e; margin-bottom: 12px; }
          .pend-body { font-size: 14px; color: #78350f; line-height: 1.75; margin-bottom: 24px; }
          .pend-plan { display: inline-flex; align-items: center; gap: 8px; background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 10px; padding: 10px 20px; font-size: 13.5px; font-weight: 700; color: #b45309; margin-bottom: 28px; }
          .pend-link { display: inline-block; padding: 11px 28px; border-radius: 10px; background: linear-gradient(135deg,#4f46e5,#6366f1); color: #fff; font-size: 14px; font-weight: 700; text-decoration: none; box-shadow: 0 4px 14px rgba(79,70,229,0.3); }
          .pend-sub { font-size: 12.5px; color: #94a3b8; margin-top: 16px; }
        `}</style>
        <div className="pend-root">
          <div className="pend-card">
            <div className="pend-icon">⏳</div>
            <div className="pend-title">Registration Successful!</div>
            <p className="pend-body">
              Your account has been created and is currently <strong>awaiting approval</strong> from the Nilayam admin team.
              We will review your registration and respond shortly.
            </p>
            {chosenPlan && (
              <div className="pend-plan">📋 Plan: {chosenPlan.name} — ₹{chosenPlan.price.toLocaleString("en-IN")}</div>
            )}
            <Link to="/login" className="pend-link">Go to Login →</Link>
            <p className="pend-sub">Once approved, you'll be able to sign in and start managing your hostel.</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .rp-root { min-height: 100vh; display: flex; font-family: 'Plus Jakarta Sans', sans-serif; background: #f8f9fc; }

        .rp-left { display: none; flex: 0 0 360px; background: linear-gradient(155deg,#1e1b4b 0%,#312e81 45%,#4338ca 100%); padding: 48px 40px; flex-direction: column; justify-content: space-between; position: relative; overflow: hidden; }
        @media (min-width: 900px) { .rp-left { display: flex; } }
        .rp-blob1 { position: absolute; top: -90px; right: -70px; width: 280px; height: 280px; border-radius: 50%; background: rgba(139,92,246,0.22); filter: blur(65px); pointer-events: none; }
        .rp-blob2 { position: absolute; bottom: -70px; left: -50px; width: 240px; height: 240px; border-radius: 50%; background: rgba(16,185,129,0.13); filter: blur(50px); pointer-events: none; }
        .rp-brand { display: flex; align-items: center; gap: 10px; position: relative; z-index: 1; }
        .rp-brand-icon { width: 36px; height: 36px; background: rgba(255,255,255,0.14); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 17px; border: 1px solid rgba(255,255,255,0.18); }
        .rp-brand-name { font-size: 16px; font-weight: 700; letter-spacing: 0.1em; color: #fff; }
        .rp-left-mid { position: relative; z-index: 1; }
        .rp-left-mid h2 { font-size: 24px; font-weight: 700; color: #fff; line-height: 1.35; margin-bottom: 12px; }
        .rp-left-mid p  { font-size: 13px; color: rgba(255,255,255,0.43); line-height: 1.75; }
        .rp-steps { display: flex; flex-direction: column; gap: 0; position: relative; z-index: 1; }
        .rp-step { display: flex; align-items: flex-start; gap: 12px; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.07); }
        .rp-step:last-child { border-bottom: none; }
        .rp-step-num { width: 26px; height: 26px; border-radius: 50%; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.18); display: flex; align-items: center; justify-content: center; font-size: 11.5px; font-weight: 700; color: #a5b4fc; flex-shrink: 0; margin-top: 1px; }
        .rp-step-body h4 { font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.75); margin-bottom: 2px; }
        .rp-step-body p  { font-size: 11.5px; color: rgba(255,255,255,0.35); line-height: 1.55; }

        /* Selected plan banner on left */
        .rp-plan-banner { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 12px; padding: 14px 16px; position: relative; z-index: 1; }
        .rp-plan-banner-lbl { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; color: rgba(255,255,255,0.4); text-transform: uppercase; margin-bottom: 5px; }
        .rp-plan-banner-name { font-size: 15px; font-weight: 800; color: #fff; }
        .rp-plan-banner-price { font-size: 13px; color: rgba(255,255,255,0.55); margin-top: 2px; }

        .rp-right { flex: 1; display: flex; align-items: center; justify-content: center; padding: 40px 24px; overflow-y: auto; }
        .rp-card { width: 100%; max-width: 460px; opacity: 0; transform: translateY(20px); transition: opacity 0.5s cubic-bezier(0.16,1,0.3,1), transform 0.5s cubic-bezier(0.16,1,0.3,1); }
        .rp-card.in { opacity: 1; transform: translateY(0); }

        .rp-mob-brand { display: flex; align-items: center; gap: 8px; margin-bottom: 26px; }
        @media (min-width: 900px) { .rp-mob-brand { display: none; } }
        .rp-mob-brand-icon { width: 32px; height: 32px; background: linear-gradient(135deg,#4f46e5,#818cf8); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 14px; }
        .rp-mob-brand-name { font-size: 15px; font-weight: 700; letter-spacing: 0.08em; color: #1e1b4b; }

        /* Selected plan pill (mobile / top of form) */
        .rp-plan-pill { display: inline-flex; align-items: center; gap: 8px; background: #eef2ff; border: 1.5px solid #c7d2fe; border-radius: 10px; padding: 8px 14px; font-size: 13px; font-weight: 700; color: #4f46e5; margin-bottom: 18px; }
        .rp-plan-pill-free { background: #ecfdf5; border-color: #a7f3d0; color: #059669; }

        .rp-hd { margin-bottom: 22px; }
        .rp-hd h1 { font-size: 22px; font-weight: 700; color: #0f172a; margin-bottom: 5px; }
        .rp-hd p  { font-size: 13.5px; color: #94a3b8; }

        .rp-form { display: flex; flex-direction: column; gap: 15px; }
        .rp-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        @media (max-width: 500px) { .rp-grid-2 { grid-template-columns: 1fr; } }
        .rp-field { display: flex; flex-direction: column; gap: 6px; }
        .rp-lbl { font-size: 11.5px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: #94a3b8; transition: color 0.2s; }
        .rp-lbl.on { color: #4f46e5; }
        .rp-iw { position: relative; }
        .rp-inp { width: 100%; padding: 11px 14px; font-size: 14px; font-family: 'Plus Jakarta Sans', sans-serif; color: #0f172a; background: #fff; border: 1.5px solid #e2e8f0; border-radius: 10px; outline: none; transition: border-color 0.2s, box-shadow 0.2s; -webkit-appearance: none; }
        .rp-inp::placeholder { color: #cbd5e1; }
        .rp-inp:focus { border-color: #6366f1; box-shadow: 0 0 0 3.5px rgba(99,102,241,0.13); }
        .rp-inp.err { border-color: #fca5a5; }
        .rp-eye-btn { position: absolute; right: 11px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #b0bec5; display: flex; align-items: center; padding: 2px; transition: color 0.2s; }
        .rp-eye-btn:hover { color: #6366f1; }
        .rp-textarea { width: 100%; padding: 11px 14px; font-size: 14px; font-family: 'Plus Jakarta Sans', sans-serif; color: #0f172a; background: #fff; border: 1.5px solid #e2e8f0; border-radius: 10px; outline: none; resize: vertical; min-height: 72px; transition: border-color 0.2s, box-shadow 0.2s; }
        .rp-textarea:focus { border-color: #6366f1; box-shadow: 0 0 0 3.5px rgba(99,102,241,0.13); }
        .rp-textarea.err { border-color: #fca5a5; }
        .rp-err { display: flex; align-items: center; gap: 8px; padding: 10px 13px; background: #fff1f2; border: 1px solid #fecdd3; border-radius: 9px; font-size: 12.5px; color: #e11d48; }
        .rp-btn { width: 100%; padding: 12.5px; font-size: 14px; font-weight: 600; font-family: 'Plus Jakarta Sans', sans-serif; color: #fff; background: linear-gradient(135deg,#4f46e5 0%,#6366f1 100%); border: none; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 14px rgba(79,70,229,0.28); transition: transform 0.18s, box-shadow 0.18s; margin-top: 2px; }
        .rp-btn:not(:disabled):hover { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(79,70,229,0.38); }
        .rp-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .rp-spin { width: 15px; height: 15px; border: 2px solid rgba(255,255,255,0.35); border-top-color: #fff; border-radius: 50%; animation: rp-rot 0.65s linear infinite; }
        @keyframes rp-rot { to { transform: rotate(360deg); } }
        .rp-foot { margin-top: 18px; text-align: center; font-size: 13px; color: #94a3b8; }
        .rp-foot a { color: #6366f1; font-weight: 600; text-decoration: none; }
        .rp-foot a:hover { opacity: 0.75; }
        .rp-progress { display: flex; gap: 5px; margin-bottom: 22px; }
        .rp-pdot { height: 3px; border-radius: 99px; background: #e2e8f0; transition: background 0.3s, flex 0.3s; }
        .rp-pdot.done { background: #6366f1; }

        /* Paid plan note */
        .rp-paid-note { display: flex; align-items: flex-start; gap: 10px; background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 10px; padding: 12px 14px; font-size: 12.5px; color: #92400e; line-height: 1.6; }
      `}</style>

      <div className="rp-root">
        {/* Left panel */}
        <div className="rp-left">
          <div className="rp-blob1" /><div className="rp-blob2" />
          <div className="rp-brand"><div className="rp-brand-icon">🏨</div><span className="rp-brand-name">Nilayam Hostel Management</span></div>
          <div className="rp-left-mid"><h2>Get started in minutes</h2><p>Set up your property profile and start managing your hostel from day one.</p></div>

          {chosenPlan && (
            <div className="rp-plan-banner">
              <div className="rp-plan-banner-lbl">Selected Plan</div>
              <div className="rp-plan-banner-name">{chosenPlan.name}</div>
              <div className="rp-plan-banner-price">
                {chosenPlan.isFree ? "Free • Instant access" : `₹${chosenPlan.price.toLocaleString("en-IN")} • ${chosenPlan.days} days • ${chosenPlan.beds} beds`}
              </div>
            </div>
          )}

          <div className="rp-steps">
            {[
              { n: "1", h: "Create your account",    p: "Enter your property and contact details" },
              { n: "2", h: "Set up your rooms",      p: "Add beds, floors, and pricing" },
              { n: "3", h: "Onboard tenants",        p: "Add tenants and collect rent digitally" },
            ].map(s => (
              <div className="rp-step" key={s.n}>
                <div className="rp-step-num">{s.n}</div>
                <div className="rp-step-body"><h4>{s.h}</h4><p>{s.p}</p></div>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div className="rp-right">
          <div className={`rp-card ${mounted ? "in" : ""}`}>
            <div className="rp-mob-brand"><div className="rp-mob-brand-icon">🏨</div><span className="rp-mob-brand-name">Nilayam Hostel Management</span></div>

            {/* Plan pill */}
            {chosenPlan && (
              <div className={`rp-plan-pill ${chosenPlan.isFree ? "rp-plan-pill-free" : ""}`}>
                {chosenPlan.isFree ? "✅" : "📋"} {chosenPlan.name}
                {chosenPlan.isFree ? " — Free" : ` — ₹${chosenPlan.price.toLocaleString("en-IN")}`}
              </div>
            )}

            {/* Progress */}
            <div className="rp-progress">
              {[...Array(6)].map((_, i) => {
                const filled = [form.name, form.owner, form.ph, form.email, form.password, form.address][i];
                return <div key={i} className={`rp-pdot ${filled ? "done" : ""}`} style={{ flex: 1 }} />;
              })}
            </div>

            <div className="rp-hd">
              <h1>Create your account ✨</h1>
              <p>Fill in your property details to get started</p>
            </div>

            <form className="rp-form" onSubmit={handleRegister}>
              <div className="rp-grid-2">
                <div className="rp-field">
                  <label className={`rp-lbl ${focused === "name" ? "on" : ""}`}>Property / Shop Name</label>
                  <input className={`rp-inp ${error ? "err" : ""}`} value={form.name} onChange={set("name")} onFocus={() => setFocused("name")} onBlur={() => setFocused("")} placeholder="Block A Hostel" autoFocus />
                </div>
                <div className="rp-field">
                  <label className={`rp-lbl ${focused === "owner" ? "on" : ""}`}>Owner Name</label>
                  <input className={`rp-inp ${error ? "err" : ""}`} value={form.owner} onChange={set("owner")} onFocus={() => setFocused("owner")} onBlur={() => setFocused("")} placeholder="John Doe" />
                </div>
              </div>
              <div className="rp-grid-2">
                <div className="rp-field">
                  <label className={`rp-lbl ${focused === "ph" ? "on" : ""}`}>Phone</label>
                  <input type="tel" className={`rp-inp ${error ? "err" : ""}`} value={form.ph} onChange={set("ph")} onFocus={() => setFocused("ph")} onBlur={() => setFocused("")} placeholder="9876543210" />
                </div>
                <div className="rp-field">
                  <label className={`rp-lbl ${focused === "email" ? "on" : ""}`}>Email</label>
                  <input type="email" className={`rp-inp ${error ? "err" : ""}`} value={form.email} onChange={set("email")} onFocus={() => setFocused("email")} onBlur={() => setFocused("")} placeholder="you@example.com" autoComplete="email" />
                </div>
              </div>
              <div className="rp-field">
                <label className={`rp-lbl ${focused === "password" ? "on" : ""}`}>Password</label>
                <div className="rp-iw">
                  <input type={showPass ? "text" : "password"} className={`rp-inp ${error ? "err" : ""}`} value={form.password} onChange={set("password")} onFocus={() => setFocused("password")} onBlur={() => setFocused("")} placeholder="Min. 6 characters" autoComplete="new-password" style={{ paddingRight: 40 }} />
                  <button type="button" className="rp-eye-btn" onClick={() => setShowPass(p => !p)} tabIndex={-1}>
                    {showPass
                      ? <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
              </div>
              <div className="rp-field">
                <label className={`rp-lbl ${focused === "address" ? "on" : ""}`}>Address</label>
                <textarea className={`rp-textarea ${error ? "err" : ""}`} value={form.address} onChange={set("address")} onFocus={() => setFocused("address")} onBlur={() => setFocused("")} placeholder="Full address of your property" />
              </div>

              {/* Paid plan note */}
              {chosenPlan && !chosenPlan.isFree && (
                <div className="rp-paid-note">
                  ⏳ <span>After registering with the <strong>{chosenPlan.name}</strong> plan, your account will go into a <strong>pending state</strong> and require admin approval before you can log in.</span>
                </div>
              )}

              {error && (
                <div className="rp-err">
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {error}
                </div>
              )}

              <button type="submit" className="rp-btn" disabled={loading}>
                {loading && <div className="rp-spin" />}
                {loading ? "Creating account…" : "Create account →"}
              </button>
            </form>

            <p className="rp-foot">Already have an account? <Link to="/login">Sign in</Link></p>
          </div>
        </div>
      </div>
    </>
  );
}