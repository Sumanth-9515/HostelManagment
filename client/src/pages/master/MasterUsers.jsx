import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API, authHeaders } from "../api.js";
import { Badge, Btn } from "../components/ui.jsx";

export default function MasterUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const user = JSON.parse(sessionStorage.getItem("user") || "{}");
    if (user.role !== "master") return navigate("/login");

    fetch(`${API}/master/users`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => { setUsers(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [navigate]);

  const loadDetail = async (userId) => {
    if (selected === userId) { setSelected(null); setDetail(null); return; }
    setSelected(userId); setDetailLoading(true);
    const r = await fetch(`${API}/master/users/${userId}`, { headers: authHeaders() });
    const d = await r.json();
    setDetail(d); setDetailLoading(false);
  };

  const filtered = users.filter((u) =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.owner?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div style={{ color: "var(--text-3)", fontSize: 13, padding: 40 }}>Loading…</div>;

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Registered Users</h1>
        <p style={{ fontSize: 13, color: "var(--text-2)" }}>{users.length} total users on the platform</p>
      </div>

      <div style={{ marginBottom: 16 }}>
        <input
          style={{
            width: "100%", maxWidth: 360, padding: "8px 12px",
            background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)",
            fontSize: 13, color: "var(--text)", outline: "none",
          }}
          placeholder="Search by name, owner or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 && (
        <p style={{ fontSize: 13, color: "var(--text-3)" }}>No users found.</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.map((u) => (
          <div key={u._id}>
            {/* User row */}
            <div
              style={{
                background: "var(--surface)", border: `1px solid ${selected === u._id ? "var(--accent)" : "var(--border)"}`,
                borderRadius: selected === u._id ? "var(--radius-lg) var(--radius-lg) 0 0" : "var(--radius-lg)",
                padding: "14px 18px", cursor: "pointer", transition: "border-color 0.15s",
              }}
              onClick={() => loadDetail(u._id)}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 3 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{u.owner}</span>
                    <span style={{ fontSize: 12, color: "var(--text-3)" }}>·</span>
                    <span style={{ fontSize: 13, color: "var(--text-2)" }}>{u.name}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-3)" }}>{u.email} · {u.ph}</div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, auto)", gap: "4px 12px", textAlign: "right" }}>
                    {[
                      ["Buildings", u.stats.totalBuildings],
                      ["Tenants", u.stats.activeTenants],
                      ["Beds", u.stats.totalBeds],
                      ["Revenue", `₹${(u.stats.totalRevenue || 0).toLocaleString()}`],
                    ].map(([k, v]) => (
                      <div key={k} style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 13, fontWeight: 600, fontFamily: "'DM Mono', monospace" }}>{v}</div>
                        <div style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{k}</div>
                      </div>
                    ))}
                  </div>
                  <span style={{ color: "var(--text-3)", fontSize: 16, marginLeft: 8 }}>{selected === u._id ? "↑" : "↓"}</span>
                </div>
              </div>
            </div>

            {/* Expanded detail */}
            {selected === u._id && (
              <div style={{
                background: "var(--surface-2)", border: "1px solid var(--accent)",
                borderTop: "none", borderRadius: "0 0 var(--radius-lg) var(--radius-lg)",
                padding: "20px 18px",
              }}>
                {detailLoading ? (
                  <p style={{ fontSize: 13, color: "var(--text-3)" }}>Loading details…</p>
                ) : detail ? (
                  <UserDetail detail={detail} />
                ) : null}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function UserDetail({ detail }) {
  const { user, buildings, tenants } = detail;
  const activeTenants = tenants.filter((t) => t.status === "Active");

  return (
    <div>
      {/* Profile */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
        {[
          ["Property Name", user.name],
          ["Owner", user.owner],
          ["Email", user.email],
          ["Phone", user.ph],
          ["Address", user.address],
          ["Joined", new Date(user.createdAt).toLocaleDateString()],
        ].map(([k, v]) => (
          <div key={k} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "10px 12px" }}>
            <div style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 3 }}>{k}</div>
            <div style={{ fontSize: 13, fontWeight: 500, wordBreak: "break-word" }}>{v || "—"}</div>
          </div>
        ))}
      </div>

      {/* Buildings */}
      {buildings.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
            Buildings ({buildings.length})
          </h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {buildings.map((b) => {
              let totalBeds = 0, occupiedBeds = 0;
              for (const f of b.floors) {
                for (const r of f.rooms) {
                  totalBeds += r.beds.length;
                  occupiedBeds += r.beds.filter(bed => bed.status === "Occupied").length;
                }
              }
              return (
                <div key={b._id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "10px 14px", minWidth: 180 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{b.buildingName}</div>
                  {b.address && <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 6 }}>{b.address}</div>}
                  <div style={{ display: "flex", gap: 4 }}>
                    <Badge>{b.floors.length} floors</Badge>
                    <Badge>{occupiedBeds}/{totalBeds} beds</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tenants table */}
      {tenants.length > 0 && (
        <div>
          <h3 style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
            Tenants ({tenants.length} total · {activeTenants.length} active)
          </h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Name", "Phone", "Building", "Room", "Bed", "Rent", "Status"].map((h) => (
                    <th key={h} style={{ padding: "6px 10px", textAlign: "left", fontWeight: 500, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em", fontSize: 10 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t._id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={td}>{t.name}</td>
                    <td style={td}>{t.phone}</td>
                    <td style={td}>{t.allocationInfo?.buildingName || "—"}</td>
                    <td style={td}>{t.allocationInfo?.roomNumber || "—"}</td>
                    <td style={td}>{t.allocationInfo?.bedNumber ?? "—"}</td>
                    <td style={td}>₹{(t.rentAmount || 0).toLocaleString()}</td>
                    <td style={{ ...td, padding: "8px 10px" }}>
                      <Badge color={t.status === "Active" ? "green" : "default"}>{t.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {buildings.length === 0 && tenants.length === 0 && (
        <p style={{ fontSize: 12, color: "var(--text-3)" }}>No buildings or tenants added yet.</p>
      )}
    </div>
  );
}

const td = { padding: "9px 10px", color: "var(--text)" };