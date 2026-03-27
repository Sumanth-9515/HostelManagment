import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API } from "../api.js";
import { inputStyle, Btn } from "../components/ui.jsx";

export default function LoginPage() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) return setError("Both fields are required.");
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API}/login`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          // FIX: trim whitespace — a trailing space is the #1 silent login killer
          email:    email.trim().toLowerCase(),
          password: password,          // do NOT trim password (spaces can be intentional)
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Show the exact server error message (e.g. "Invalid credentials.")
        return setError(data.message || "Login failed. Please try again.");
      }

      // ── FIX: sessionStorage (consistent with api.js token() helper) ──────
      // Previously the navigate happened but sessionStorage may not have been
      // flushed before the next page tried to read it. We set both items
      // before navigating to guarantee they are available immediately.
      sessionStorage.setItem("token", data.token);
      sessionStorage.setItem("user",  JSON.stringify(data.user));

      // Route by role
      if (data.user.role === "master") {
        navigate("/master/dashboard");
      } else {
        navigate("/dashboard");
      }
    } catch {
      // Network / CORS / server-down errors
      setError("Cannot connect to server. Make sure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", background: "var(--bg)", padding: 20,
    }}>
      <div style={{ width: "100%", maxWidth: 380 }}>

        {/* Logo */}
        <div style={{ marginBottom: 40, textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "0.06em", marginBottom: 6 }}>
            HOSTELIQ
          </div>
          <p style={{ fontSize: 13, color: "var(--text-2)" }}>Sign in to continue</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              placeholder="you@example.com"
              style={{ ...inputStyle, padding: "10px 12px" }}
              autoFocus
              autoComplete="email"
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={labelStyle}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              placeholder="••••••••"
              style={{ ...inputStyle, padding: "10px 12px" }}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div style={{
              fontSize: 12,
              color: "var(--red)",
              padding: "8px 12px",
              background: "var(--red-bg)",
              borderRadius: "var(--radius)",
            }}>
              {error}
            </div>
          )}

          <Btn
            type="submit"
            disabled={loading}
            style={{ width: "100%", padding: "10px", marginTop: 4, justifyContent: "center" }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </Btn>
        </form>

        <p style={{ marginTop: 24, textAlign: "center", fontSize: 12, color: "var(--text-3)" }}>
          No account?{" "}
          <Link to="/register" style={{ color: "var(--text)", fontWeight: 500 }}>
            Register here
          </Link>
        </p>

        <div style={{
          marginTop: 32,
          padding: "12px",
          background: "var(--surface-2)",
          borderRadius: "var(--radius)",
          border: "1px solid var(--border)",
        }}>
          <p style={{ fontSize: 11, color: "var(--text-3)", textAlign: "center" }}>
            Master admin access uses the same login
          </p>
        </div>
      </div>
    </div>
  );
}

const labelStyle = { fontSize: 12, fontWeight: 500, color: "var(--text-2)" };