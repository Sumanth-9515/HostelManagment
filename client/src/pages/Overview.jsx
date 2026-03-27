import { useState, useEffect, useCallback } from "react";
import { API, authHeaders } from "../api.js";
import { useToast, Toast, Modal, Badge, Btn, StatCard, inputStyle } from "../components/Ui.jsx";

export default function Overview() {
  const [stats, setStats] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast, show } = useToast();

  // Room viewer
  const [viewMode, setViewMode] = useState("browse"); // "browse" | "search"
  const [searchRoom, setSearchRoom] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

  // Browse
  const [browseBuilding, setBrowseBuilding] = useState("");
  const [browseFloor, setBrowseFloor] = useState("");
  const [browseRoom, setBrowseRoom] = useState("");
  const [browseData, setBrowseData] = useState(null);
  const [browseFloors, setBrowseFloors] = useState([]);
  const [browseRooms, setBrowseRooms] = useState([]);

  // Modals
  const [tenantModal, setTenantModal] = useState(null);
  const [editModal, setEditModal] = useState(null);
  const [editForm, setEditForm] = useState({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [sr, br] = await Promise.all([
      fetch(`${API}/buildings/stats/overview`, { headers: authHeaders() }),
      fetch(`${API}/buildings`, { headers: authHeaders() }),
    ]);
    setStats(Array.isArray(await sr.json()) ? await (fetch(`${API}/buildings/stats/overview`, { headers: authHeaders() }).then(r => r.json())) : []);
    const bd = await br.json();
    setBuildings(Array.isArray(bd) ? bd : []);
    setLoading(false);
  }, []);

  // Simpler fetch
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [sr, br] = await Promise.all([
        fetch(`${API}/buildings/stats/overview`, { headers: authHeaders() }).then(r => r.json()),
        fetch(`${API}/buildings`, { headers: authHeaders() }).then(r => r.json()),
      ]);
      setStats(Array.isArray(sr) ? sr : []);
      setBuildings(Array.isArray(br) ? br : []);
      setLoading(false);
    };
    load();
  }, []);

  const totalStats = stats.reduce((acc, s) => ({
    totalBeds: acc.totalBeds + s.totalBeds,
    occupiedBeds: acc.occupiedBeds + s.occupiedBeds,
    availableBeds: acc.availableBeds + s.availableBeds,
    totalTenants: acc.totalTenants + s.totalTenants,
    totalRevenue: acc.totalRevenue + s.totalRevenue,
  }), { totalBeds: 0, occupiedBeds: 0, availableBeds: 0, totalTenants: 0, totalRevenue: 0 });

  // Search
  const handleSearch = async () => {
    if (!searchRoom.trim()) return;
    setSearchLoading(true); setSearchError(""); setSearchResult(null);
    const r = await fetch(`${API}/buildings/search/room?roomNumber=${encodeURIComponent(searchRoom.trim())}`, { headers: authHeaders() });
    const d = await r.json();
    setSearchLoading(false);
    if (!r.ok) return setSearchError(d.message);
    setSearchResult(d);
  };

  // Browse cascades
  useEffect(() => {
    setBrowseFloor(""); setBrowseRoom(""); setBrowseData(null); setBrowseFloors([]); setBrowseRooms([]);
    if (!browseBuilding) return;
    const b = buildings.find((x) => x._id === browseBuilding);
    if (b) setBrowseFloors([...b.floors].sort((a, c) => a.floorNumber - c.floorNumber));
  }, [browseBuilding, buildings]);

  useEffect(() => {
    setBrowseRoom(""); setBrowseData(null); setBrowseRooms([]);
    if (!browseFloor) return;
    const f = browseFloors.find((x) => x._id === browseFloor);
    if (f) setBrowseRooms(f.rooms);
  }, [browseFloor, browseFloors]);

  useEffect(() => {
    if (!browseRoom) return;
    const loadRoom = async () => {
      const r = await fetch(`${API}/buildings/${browseBuilding}`, { headers: authHeaders() });
      const d = await r.json();
      if (!r.ok) return;
      const floor = d.floors?.find((f) => f._id === browseFloor);
      const room = floor?.rooms?.find((rm) => rm._id === browseRoom);
      if (room) setBrowseData({ room, buildingName: d.buildingName, floorNumber: floor.floorNumber });
    };
    loadRoom();
  }, [browseRoom]);

  // Edit building
  const handleEditSave = async () => {
    const r = await fetch(`${API}/buildings/${editModal._id}`, { method: "PUT", headers: authHeaders(), body: JSON.stringify(editForm) });
    const d = await r.json();
    if (!r.ok) return show(d.message, "error");
    show("Building updated");
    setEditModal(null);
    const [sr, br] = await Promise.all([
      fetch(`${API}/buildings/stats/overview`, { headers: authHeaders() }).then(r => r.json()),
      fetch(`${API}/buildings`, { headers: authHeaders() }).then(r => r.json()),
    ]);
    setStats(Array.isArray(sr) ? sr : []);
    setBuildings(Array.isArray(br) ? br : []);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this building? All data will be lost.")) return;
    const r = await fetch(`${API}/buildings/${id}`, { method: "DELETE", headers: authHeaders() });
    if (!r.ok) return show("Delete failed.", "error");
    show("Building deleted.");
    const [sr, br] = await Promise.all([
      fetch(`${API}/buildings/stats/overview`, { headers: authHeaders() }).then(r => r.json()),
      fetch(`${API}/buildings`, { headers: authHeaders() }).then(r => r.json()),
    ]);
    setStats(Array.isArray(sr) ? sr : []);
    setBuildings(Array.isArray(br) ? br : []);
  };

  if (loading) return <div style={{ color: "var(--text-3)", fontSize: 13, padding: 40 }}>Loading…</div>;

  return (
    <div style={{ maxWidth: 960 }}>
      <Toast toast={toast} />

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Overview</h1>
        <p style={{ fontSize: 13, color: "var(--text-2)" }}>Live occupancy and building statistics</p>
      </div>

      {/* Global stats */}
      {stats.length > 1 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12, marginBottom: 28 }}>
          <StatCard label="Total Beds" value={totalStats.totalBeds} />
          <StatCard label="Occupied" value={totalStats.occupiedBeds} />
          <StatCard label="Available" value={totalStats.availableBeds} />
          <StatCard label="Tenants" value={totalStats.totalTenants} />
          <StatCard label="Revenue" value={`₹${totalStats.totalRevenue.toLocaleString()}`} />
        </div>
      )}

      {/* Per-building cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 28 }}>
        {stats.map((s) => {
          const pct = s.totalBeds > 0 ? Math.round((s.occupiedBeds / s.totalBeds) * 100) : 0;
          return (
            <div key={s.buildingId} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "20px 24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div>
                  <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>{s.buildingName}</h2>
                  {s.address && <p style={{ fontSize: 12, color: "var(--text-3)" }}>{s.address}</p>}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn variant="ghost" style={{ fontSize: 12, padding: "5px 12px" }}
                    onClick={() => { setEditModal(buildings.find(b => b._id.toString() === s.buildingId.toString())); setEditForm({ buildingName: s.buildingName, address: s.address || "" }); }}>
                    Edit
                  </Btn>
                  <Btn variant="danger" style={{ fontSize: 12, padding: "5px 12px" }} onClick={() => handleDelete(s.buildingId)}>
                    Delete
                  </Btn>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 10, marginBottom: 16 }}>
                {[
                  ["Floors", s.totalFloors],
                  ["Rooms", s.totalRooms],
                  ["Beds", s.totalBeds],
                  ["Occupied", s.occupiedBeds],
                  ["Available", s.availableBeds],
                  ["Tenants", s.totalTenants],
                  ["Revenue", `₹${s.totalRevenue.toLocaleString()}`],
                ].map(([label, value]) => (
                  <div key={label} style={{ textAlign: "center", background: "var(--surface-2)", borderRadius: "var(--radius)", padding: "10px 6px" }}>
                    <div style={{ fontSize: 15, fontWeight: 600, fontFamily: "'DM Mono', monospace" }}>{value}</div>
                    <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Occupancy bar */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Occupancy</span>
                  <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace" }}>{pct}%</span>
                </div>
                <div style={{ height: 4, background: "var(--surface-2)", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: "var(--accent)", borderRadius: 99 }} />
                </div>
              </div>
            </div>
          );
        })}
        {stats.length === 0 && (
          <p style={{ color: "var(--text-3)", fontSize: 13 }}>No buildings found. Add one from Properties.</p>
        )}
      </div>

      {/* Room viewer */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "20px 24px" }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Room Viewer</h2>
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {["browse", "search"].map((m) => (
            <Btn key={m} variant={viewMode === m ? "primary" : "ghost"} style={{ fontSize: 12, padding: "5px 14px" }} onClick={() => setViewMode(m)}>
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </Btn>
          ))}
        </div>

        {viewMode === "search" && (
          <div>
            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <input
                style={{ ...inputStyle, flex: 1 }}
                value={searchRoom}
                onChange={(e) => setSearchRoom(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Room number e.g. 101"
              />
              <Btn onClick={handleSearch} disabled={searchLoading} style={{ padding: "8px 16px" }}>
                {searchLoading ? "…" : "Search"}
              </Btn>
            </div>
            {searchError && <p style={{ color: "var(--red)", fontSize: 12 }}>{searchError}</p>}
            {searchResult && searchResult.map((res, i) => (
              <RoomDetail key={i} data={res} onBedClick={setTenantModal} />
            ))}
          </div>
        )}

        {viewMode === "browse" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
              <div>
                <label style={lblStyle}>Building</label>
                <select style={inputStyle} value={browseBuilding} onChange={(e) => setBrowseBuilding(e.target.value)}>
                  <option value="">Select building</option>
                  {buildings.map((b) => <option key={b._id} value={b._id}>{b.buildingName}</option>)}
                </select>
              </div>
              {browseBuilding && (
                <div>
                  <label style={lblStyle}>Floor</label>
                  <select style={inputStyle} value={browseFloor} onChange={(e) => setBrowseFloor(e.target.value)}>
                    <option value="">Select floor</option>
                    {browseFloors.map((f) => <option key={f._id} value={f._id}>Floor {f.floorNumber}{f.floorName ? ` — ${f.floorName}` : ""}</option>)}
                  </select>
                </div>
              )}
              {browseFloor && (
                <div>
                  <label style={lblStyle}>Room</label>
                  <select style={inputStyle} value={browseRoom} onChange={(e) => setBrowseRoom(e.target.value)}>
                    <option value="">Select room</option>
                    {browseRooms.map((r) => <option key={r._id} value={r._id}>Room {r.roomNumber}</option>)}
                  </select>
                </div>
              )}
            </div>
            {browseData && (
              <RoomDetail
                data={{ ...browseData.room, buildingName: browseData.buildingName, floorNumber: browseData.floorNumber }}
                onBedClick={setTenantModal}
              />
            )}
          </div>
        )}
      </div>

      {/* Tenant modal */}
      <Modal open={!!tenantModal} onClose={() => setTenantModal(null)} title="Tenant Details">
        {tenantModal && (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {[
              ["Name", tenantModal.name],
              ["Phone", tenantModal.phone],
              ["Email", tenantModal.email || "—"],
              ["Joining Date", tenantModal.joiningDate ? new Date(tenantModal.joiningDate).toLocaleDateString() : "—"],
              ["Rent", tenantModal.rentAmount ? `₹${tenantModal.rentAmount.toLocaleString()}` : "—"],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>{k}</span>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{v}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editModal} onClose={() => setEditModal(null)} title="Edit Building">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={lblStyle}>Building Name</label>
            <input style={inputStyle} value={editForm.buildingName || ""} onChange={(e) => setEditForm({ ...editForm, buildingName: e.target.value })} />
          </div>
          <div>
            <label style={lblStyle}>Address</label>
            <input style={inputStyle} value={editForm.address || ""} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
            <Btn variant="secondary" onClick={() => setEditModal(null)}>Cancel</Btn>
            <Btn onClick={handleEditSave}>Save</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function RoomDetail({ data, onBedClick }) {
  const { buildingName, floorNumber, roomNumber, shareType, beds } = data;
  const occupied = beds.filter((b) => b.status === "Occupied").length;
  return (
    <div style={{ background: "var(--surface-2)", borderRadius: "var(--radius)", padding: 16, marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13 }}>
          <span style={{ color: "var(--text-2)" }}>{buildingName}</span>
          <span style={{ color: "var(--text-3)", margin: "0 6px" }}>/</span>
          <span style={{ color: "var(--text-2)" }}>Floor {floorNumber}</span>
          <span style={{ color: "var(--text-3)", margin: "0 6px" }}>/</span>
          <strong>Room {roomNumber}</strong>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "'DM Mono', monospace" }}>{occupied}/{beds.length}</span>
          <span style={{ fontSize: 11, background: "var(--surface)", border: "1px solid var(--border)", padding: "2px 8px", borderRadius: 99 }}>{shareType}-share</span>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 8 }}>
        {beds.map((bed, i) => {
          const isOcc = bed.status === "Occupied";
          const tenant = bed.tenant || (typeof bed.tenantId === "object" ? bed.tenantId : null);
          return (
            <div
              key={bed._id || i}
              onClick={() => isOcc && onBedClick(tenant || bed)}
              style={{
                background: "var(--surface)", border: `1px solid ${isOcc ? "#fca5a5" : "var(--border)"}`,
                borderRadius: "var(--radius)", padding: "12px 8px", textAlign: "center",
                cursor: isOcc ? "pointer" : "default",
              }}
            >
              <div style={{ fontSize: 18, marginBottom: 4 }}>🛏</div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>Bed {bed.bedNumber}</div>
              <div style={{ fontSize: 11, color: isOcc ? "var(--red)" : "var(--green)", marginTop: 3 }}>
                {isOcc ? (tenant?.name || "Occupied") : "Free"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const lblStyle = { display: "block", fontSize: 11, color: "var(--text-3)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" };
