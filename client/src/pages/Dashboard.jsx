import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API, authHeaders } from "../api.js";
import { StatCard } from "../components/ui.jsx";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const stored = sessionStorage.getItem("user");
    const token = sessionStorage.getItem("token");
    if (!token || !stored) return navigate("/login");
    const u = JSON.parse(stored);
    if (u.role === "master") return navigate("/master/dashboard");
    setUser(u);
  }, [navigate]);

  useEffect(() => {
    if (!user) return;
    fetch(`${API}/buildings/stats/overview`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) {
          const totals = d.reduce(
            (acc, s) => ({
              totalBuildings: acc.totalBuildings + 1,
              totalBeds: acc.totalBeds + s.totalBeds,
              occupiedBeds: acc.occupiedBeds + s.occupiedBeds,
              availableBeds: acc.availableBeds + s.availableBeds,
              totalTenants: acc.totalTenants + s.totalTenants,
              totalRevenue: acc.totalRevenue + s.totalRevenue,
            }),
            { totalBuildings: 0, totalBeds: 0, occupiedBeds: 0, availableBeds: 0, totalTenants: 0, totalRevenue: 0 }
          );
          setStats(totals);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user]);

  if (!user) return null;

  const occupancyRate = stats && stats.totalBeds > 0
    ? Math.round((stats.occupiedBeds / stats.totalBeds) * 100)
    : 0;

  return (
    <div style={{ maxWidth: 860 }}>
      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Good day, {user.owner}</h1>
        <p style={{ fontSize: 13, color: "var(--text-2)" }}>{user.name} · {user.email}</p>
      </div>

      {/* Stats grid */}
      {loading ? (
        <p style={{ color: "var(--text-3)", fontSize: 13 }}>Loading statistics…</p>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 14, marginBottom: 28 }}>
            <StatCard label="Buildings" value={stats?.totalBuildings ?? 0} />
            <StatCard label="Total Beds" value={stats?.totalBeds ?? 0} />
            <StatCard label="Occupied" value={stats?.occupiedBeds ?? 0} sub={`${occupancyRate}% occupancy`} />
            <StatCard label="Available" value={stats?.availableBeds ?? 0} />
            <StatCard label="Tenants" value={stats?.totalTenants ?? 0} />
            <StatCard label="Monthly Revenue" value={`₹${(stats?.totalRevenue ?? 0).toLocaleString()}`} />
          </div>

          {/* Occupancy bar */}
          {stats?.totalBeds > 0 && (
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "20px 24px", marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Occupancy</span>
                <span style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", color: "var(--text)" }}>{occupancyRate}%</span>
              </div>
              <div style={{ height: 6, background: "var(--surface-2)", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${occupancyRate}%`, background: "var(--accent)", borderRadius: 99, transition: "width 0.6s ease" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                <span style={{ fontSize: 11, color: "var(--text-3)" }}>{stats.occupiedBeds} occupied</span>
                <span style={{ fontSize: 11, color: "var(--text-3)" }}>{stats.availableBeds} available</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* Profile section */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "20px 24px" }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Profile</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
          {[
            ["Property Name", user.name],
            ["Owner", user.owner],
            ["Email", user.email],
            ["Phone", user.ph],
            ["Address", user.address],
          ].map(([k, v]) => (
            <div key={k}>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.04em" }}>{k}</div>
              <div style={{ fontSize: 13, color: "var(--text)", wordBreak: "break-word" }}>{v || "—"}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}