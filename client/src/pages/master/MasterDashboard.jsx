import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API, authHeaders } from "../api.js";
import { StatCard } from "../components/ui.jsx";

export default function MasterDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const user = JSON.parse(sessionStorage.getItem("user") || "{}");
    if (user.role !== "master") return navigate("/login");

    fetch(`${API}/master/stats`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [navigate]);

  if (loading) return <div style={{ color: "var(--text-3)", fontSize: 13, padding: 40 }}>Loading…</div>;

  const occupancyRate = stats?.totalBeds > 0 ? Math.round((stats.occupiedBeds / stats.totalBeds) * 100) : 0;

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 36 }}>
        <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Master Admin</div>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Platform Overview</h1>
        <p style={{ fontSize: 13, color: "var(--text-2)" }}>Live statistics across all registered users</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))", gap: 12, marginBottom: 28 }}>
        <StatCard label="Total Users" value={stats?.totalUsers ?? 0} sub={`+${stats?.recentUsers ?? 0} this week`} />
        <StatCard label="Buildings" value={stats?.totalBuildings ?? 0} />
        <StatCard label="Total Beds" value={stats?.totalBeds ?? 0} />
        <StatCard label="Occupied" value={stats?.occupiedBeds ?? 0} sub={`${occupancyRate}% rate`} />
        <StatCard label="Available" value={stats?.availableBeds ?? 0} />
        <StatCard label="Total Tenants" value={stats?.totalTenants ?? 0} sub={`${stats?.activeTenants ?? 0} active`} />
        <StatCard label="Monthly Revenue" value={`₹${(stats?.totalRevenue ?? 0).toLocaleString()}`} />
      </div>

      {/* Occupancy bar */}
      {stats?.totalBeds > 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "20px 24px", marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Platform Occupancy</span>
            <span style={{ fontSize: 12, fontFamily: "'DM Mono', monospace" }}>{occupancyRate}%</span>
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

      {/* Quick links */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div
          onClick={() => navigate("/master/users")}
          style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "20px 24px", cursor: "pointer", transition: "border-color 0.15s" }}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--accent)"}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border)"}
        >
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>View All Users →</div>
          <p style={{ fontSize: 12, color: "var(--text-3)" }}>{stats?.totalUsers ?? 0} registered users with their hostel details</p>
        </div>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "20px 24px" }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>New This Week</div>
          <p style={{ fontSize: 12, color: "var(--text-3)" }}>{stats?.recentUsers ?? 0} new user registrations in the last 7 days</p>
        </div>
      </div>
    </div>
  );
}