import { useNavigate, NavLink } from "react-router-dom";
import { clearSession } from "./ui.jsx";

const NAV = [
  { to: "/master/dashboard", label: "Overview" },
  { to: "/master/users",     label: "Users"    },
  { to: "/master/logins",    label: "Logins"   }
];

export default function MasterLayout({ children }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    clearSession();
    navigate("/login");
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      {/* Sidebar */}
      <aside style={{
        width: 220, flexShrink: 0,
        background: "var(--surface)", borderRight: "1px solid var(--border)",
        display: "flex", flexDirection: "column", padding: "24px 16px",
        position: "sticky", top: 0, height: "100vh",
      }}>
        {/* Logo */}
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 6, padding: "0 8px" }}>
          HOSTELIQ
        </div>
        <div style={{
          fontSize: 9, fontWeight: 600, letterSpacing: "0.1em", color: "var(--text-3)",
          textTransform: "uppercase", padding: "0 8px", marginBottom: 28,
        }}>
          Master Admin
        </div>

        {/* Nav links */}
        <nav style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
          {NAV.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              style={({ isActive }) => ({
                display: "block", padding: "8px 10px",
                borderRadius: "var(--radius)",
                fontSize: 13, fontWeight: isActive ? 600 : 400,
                color: isActive ? "var(--text)" : "var(--text-2)",
                background: isActive ? "var(--surface-2)" : "transparent",
                textDecoration: "none", transition: "all 0.12s",
              })}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 8 }}>
          <button
            onClick={handleLogout}
            style={{
              width: "100%", padding: "7px 10px", borderRadius: "var(--radius)",
              background: "transparent", border: "1px solid var(--border)",
              fontSize: 12, color: "var(--text-3)", cursor: "pointer",
              textAlign: "left", fontFamily: "inherit",
            }}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, padding: "40px 36px", overflow: "auto" }}>
        {children}
      </main>
    </div>
  );
}