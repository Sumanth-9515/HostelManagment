import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API } from "../api.js";
import { inputStyle, Btn } from "../components/ui.jsx";

export default function RegisterPage() {
  const [form, setForm] = useState({
    name:     "",   // property / shop name  (maps to User.name in schema)
    owner:    "",   // owner's real name     (maps to User.owner in schema)
    ph:       "",
    email:    "",
    password: "",
    address:  "",
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const navigate = useNavigate();

  const set = (k) => (e) => {
    setForm({ ...form, [k]: e.target.value });
    setError(""); // clear error on any change
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const { name, owner, ph, email, password, address } = form;

    if (!name || !owner || !ph || !email || !password || !address) {
      return setError("All fields are required.");
    }

    // Basic email format check client-side
    if (!/\S+@\S+\.\S+/.test(email)) {
      return setError("Please enter a valid email address.");
    }

    if (password.length < 6) {
      return setError("Password must be at least 6 characters.");
    }

    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API}/register`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:     name.trim(),
          owner:    owner.trim(),
          ph:       ph.trim(),
          email:    email.trim().toLowerCase(),  // FIX: normalise before sending
          password: password,                     // do NOT trim password
          address:  address.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) return setError(data.message || "Registration failed.");

      // FIX: server now returns a token on register — log them in immediately
      // instead of redirecting to /login and making them type credentials again.
      if (data.token && data.user) {
        sessionStorage.setItem("token", data.token);
        sessionStorage.setItem("user",  JSON.stringify(data.user));

        // Role-based redirect (new users are always "user", but be defensive)
        if (data.user.role === "master") {
          navigate("/master/dashboard");
        } else {
          navigate("/dashboard");
        }
      } else {
        // Fallback: server didn't return token (old server version) → go to login
        navigate("/login");
      }
    } catch {
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
      <div style={{ width: "100%", maxWidth: 440 }}>

        <div style={{ marginBottom: 36, textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "0.06em", marginBottom: 6 }}>
            HOSTELIQ
          </div>
          <p style={{ fontSize: 13, color: "var(--text-2)" }}>Create your account</p>
        </div>

        <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={fieldWrap}>
              <label style={labelStyle}>Property / Shop Name *</label>
              <input
                style={inputStyle}
                value={form.name}
                onChange={set("name")}
                placeholder="Block A Hostel"
                autoFocus
              />
            </div>
            <div style={fieldWrap}>
              <label style={labelStyle}>Owner Name *</label>
              <input
                style={inputStyle}
                value={form.owner}
                onChange={set("owner")}
                placeholder="John Doe"
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={fieldWrap}>
              <label style={labelStyle}>Phone *</label>
              <input
                style={inputStyle}
                value={form.ph}
                onChange={set("ph")}
                placeholder="9876543210"
                type="tel"
              />
            </div>
            <div style={fieldWrap}>
              <label style={labelStyle}>Email *</label>
              <input
                type="email"
                style={inputStyle}
                value={form.email}
                onChange={set("email")}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>
          </div>

          <div style={fieldWrap}>
            <label style={labelStyle}>Password *</label>
            <input
              type="password"
              style={inputStyle}
              value={form.password}
              onChange={set("password")}
              placeholder="Min. 6 characters"
              autoComplete="new-password"
            />
          </div>

          <div style={fieldWrap}>
            <label style={labelStyle}>Address *</label>
            <textarea
              style={{ ...inputStyle, resize: "vertical", minHeight: 70 }}
              value={form.address}
              onChange={set("address")}
              placeholder="Full address of your property"
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
            style={{ width: "100%", padding: "10px", marginTop: 4 }}
          >
            {loading ? "Creating account…" : "Create account"}
          </Btn>
        </form>

        <p style={{ marginTop: 20, textAlign: "center", fontSize: 12, color: "var(--text-3)" }}>
          Already have an account?{" "}
          <Link to="/login" style={{ color: "var(--text)", fontWeight: 500 }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}

const labelStyle = { fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 4, display: "block" };
const fieldWrap  = { display: "flex", flexDirection: "column", gap: 5 };