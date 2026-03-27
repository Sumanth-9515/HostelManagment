import { useState, useEffect } from "react";
import { API, authHeaders } from "../api.js";
import { useToast, Toast, Modal, Badge, Btn, inputStyle } from "../components/ui.jsx";

const SHARE_OPTIONS = [1, 2, 3, 4, 5, 6];

export default function AddHostel() {
  const [buildings, setBuildings] = useState([]);
  const [activeBuilding, setActiveBuilding] = useState(null);
  const [activeFloor, setActiveFloor] = useState(null);
  const { toast, show } = useToast();

  const [bForm, setBForm] = useState({ buildingName: "", address: "" });
  const [fForm, setFForm] = useState({ floorNumber: "", floorName: "" });
  const [rForm, setRForm] = useState({ roomNumber: "", shareType: "2" });

  const [showBModal, setShowBModal] = useState(false);
  const [showFModal, setShowFModal] = useState(false);
  const [showRModal, setShowRModal] = useState(false);
  const [editBuilding, setEditBuilding] = useState(null);

  const fetchBuildings = async () => {
    const r = await fetch(`${API}/buildings`, { headers: authHeaders() });
    const d = await r.json();
    setBuildings(Array.isArray(d) ? d : []);
  };

  useEffect(() => { fetchBuildings(); }, []);

  const handleAddBuilding = async () => {
    if (!bForm.buildingName.trim()) return show("Building name required", "error");
    const url = editBuilding ? `${API}/buildings/${editBuilding._id}` : `${API}/buildings`;
    const method = editBuilding ? "PUT" : "POST";
    const r = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(bForm) });
    const d = await r.json();
    if (!r.ok) return show(d.message, "error");
    show(editBuilding ? "Building updated" : "Building added");
    setBForm({ buildingName: "", address: "" }); setEditBuilding(null); setShowBModal(false);
    fetchBuildings();
  };

  const handleDeleteBuilding = async (id) => {
    if (!window.confirm("Delete this building and all its data?")) return;
    const r = await fetch(`${API}/buildings/${id}`, { method: "DELETE", headers: authHeaders() });
    if (!r.ok) return show("Delete failed", "error");
    show("Building deleted");
    if (activeBuilding?._id === id) { setActiveBuilding(null); setActiveFloor(null); }
    fetchBuildings();
  };

  const handleAddFloor = async () => {
    if (!fForm.floorNumber.toString().trim()) return show("Floor number required", "error");
    const r = await fetch(`${API}/buildings/${activeBuilding._id}/floors`, {
      method: "POST", headers: authHeaders(),
      body: JSON.stringify({ floorNumber: Number(fForm.floorNumber), floorName: fForm.floorName }),
    });
    const d = await r.json();
    if (!r.ok) return show(d.message, "error");
    show("Floor added"); setFForm({ floorNumber: "", floorName: "" }); setShowFModal(false);
    fetchBuildings(); setActiveBuilding(d.building);
  };

  const handleAddRoom = async () => {
    if (!rForm.roomNumber.trim()) return show("Room number required", "error");
    const r = await fetch(`${API}/buildings/${activeBuilding._id}/floors/${activeFloor._id}/rooms`, {
      method: "POST", headers: authHeaders(),
      body: JSON.stringify({ roomNumber: rForm.roomNumber, shareType: Number(rForm.shareType) }),
    });
    const d = await r.json();
    if (!r.ok) return show(d.message, "error");
    show("Room added"); setRForm({ roomNumber: "", shareType: "2" }); setShowRModal(false);
    fetchBuildings();
    const upd = d.building;
    setActiveBuilding(upd);
    setActiveFloor(upd.floors.find((f) => f._id === activeFloor._id));
  };

  const activeB = activeBuilding ? buildings.find((b) => b._id === activeBuilding._id) || activeBuilding : null;

  return (
    <div style={{ maxWidth: 960 }}>
      <Toast toast={toast} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Properties</h1>
          <p style={{ fontSize: 13, color: "var(--text-2)" }}>Manage buildings, floors and rooms</p>
        </div>
        <Btn onClick={() => { setEditBuilding(null); setBForm({ buildingName: "", address: "" }); setShowBModal(true); }}>
          + Building
        </Btn>
      </div>

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", overflowX: "auto", paddingBottom: 8 }}>
        {/* Buildings panel */}
        <Panel title={`Buildings (${buildings.length})`}>
          {buildings.length === 0 && <EmptyState text="No buildings yet" />}
          {buildings.map((b) => {
            const totalRooms = b.floors?.reduce((a, f) => a + f.rooms.length, 0) || 0;
            const totalBeds = b.floors?.reduce((a, f) => a + f.rooms.reduce((x, r) => x + r.beds.length, 0), 0) || 0;
            const isActive = activeB?._id === b._id;
            return (
              <div
                key={b._id}
                onClick={() => { setActiveBuilding(b); setActiveFloor(null); }}
                style={{
                  padding: "12px", borderRadius: "var(--radius)", marginBottom: 8,
                  border: `1px solid ${isActive ? "var(--accent)" : "var(--border)"}`,
                  background: isActive ? "var(--surface-2)" : "var(--bg)",
                  cursor: "pointer", transition: "all 0.15s",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{b.buildingName}</div>
                    {b.address && <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.address}</div>}
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      <Badge>{b.floors?.length || 0} floors</Badge>
                      <Badge>{totalRooms} rooms</Badge>
                      <Badge>{totalBeds} beds</Badge>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4, marginLeft: 8 }}>
                    <button style={iconBtn} onClick={(e) => { e.stopPropagation(); setEditBuilding(b); setBForm({ buildingName: b.buildingName, address: b.address || "" }); setShowBModal(true); }}>✎</button>
                    <button style={{ ...iconBtn, color: "var(--red)" }} onClick={(e) => { e.stopPropagation(); handleDeleteBuilding(b._id); }}>✕</button>
                  </div>
                </div>
              </div>
            );
          })}
        </Panel>

        {/* Floors panel */}
        {activeB && (
          <Panel title={`Floors — ${activeB.buildingName}`} action={<Btn variant="ghost" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => setShowFModal(true)}>+ Floor</Btn>}>
            {activeB.floors?.length === 0 && <EmptyState text="No floors. Add one." />}
            {[...activeB.floors].sort((a, c) => a.floorNumber - c.floorNumber).map((f) => {
              const isActive = activeFloor?._id === f._id;
              return (
                <div
                  key={f._id}
                  onClick={() => setActiveFloor(f)}
                  style={{
                    padding: "12px", borderRadius: "var(--radius)", marginBottom: 8,
                    border: `1px solid ${isActive ? "var(--accent)" : "var(--border)"}`,
                    background: isActive ? "var(--surface-2)" : "var(--bg)",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                    Floor {f.floorNumber}{f.floorName ? ` — ${f.floorName}` : ""}
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <Badge>{f.rooms.length} rooms</Badge>
                    <Badge>{f.rooms.reduce((a, r) => a + r.beds.length, 0)} beds</Badge>
                  </div>
                </div>
              );
            })}
          </Panel>
        )}

        {/* Rooms panel */}
        {activeFloor && (
          <Panel title={`Rooms — Floor ${activeFloor.floorNumber}`} action={<Btn variant="ghost" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => setShowRModal(true)}>+ Room</Btn>}>
            {activeFloor.rooms.length === 0 && <EmptyState text="No rooms. Add one." />}
            {activeFloor.rooms.map((r) => {
              const occupied = r.beds.filter((b) => b.status === "Occupied").length;
              return (
                <div key={r._id} style={{ padding: 12, border: "1px solid var(--border)", borderRadius: "var(--radius)", marginBottom: 8, background: "var(--bg)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>Room {r.roomNumber}</span>
                    <Badge>{r.shareType}-share</Badge>
                  </div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
                    {r.beds.map((bed) => (
                      <div key={bed._id} style={{
                        width: 30, height: 30, borderRadius: 4,
                        background: bed.status === "Occupied" ? "var(--red-bg)" : "var(--green-bg)",
                        border: `1px solid ${bed.status === "Occupied" ? "#fca5a5" : "#86efac"}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10, fontWeight: 600,
                        color: bed.status === "Occupied" ? "var(--red)" : "var(--green)",
                      }}>
                        {bed.bedNumber}
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-3)" }}>{occupied}/{r.beds.length} occupied</div>
                </div>
              );
            })}
          </Panel>
        )}
      </div>

      {/* Building Modal */}
      <Modal open={showBModal} onClose={() => setShowBModal(false)} title={editBuilding ? "Edit Building" : "Add Building"}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={lblStyle}>Building Name *</label>
            <input style={inputStyle} value={bForm.buildingName} onChange={(e) => setBForm({ ...bForm, buildingName: e.target.value })} placeholder="e.g. Block A" autoFocus />
          </div>
          <div>
            <label style={lblStyle}>Address</label>
            <input style={inputStyle} value={bForm.address} onChange={(e) => setBForm({ ...bForm, address: e.target.value })} placeholder="Full address" />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
            <Btn variant="secondary" onClick={() => setShowBModal(false)}>Cancel</Btn>
            <Btn onClick={handleAddBuilding}>{editBuilding ? "Update" : "Add Building"}</Btn>
          </div>
        </div>
      </Modal>

      {/* Floor Modal */}
      <Modal open={showFModal} onClose={() => setShowFModal(false)} title={`Add Floor — ${activeB?.buildingName}`}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={lblStyle}>Floor Number *</label>
            <input style={inputStyle} type="number" value={fForm.floorNumber} onChange={(e) => setFForm({ ...fForm, floorNumber: e.target.value })} placeholder="e.g. 1" autoFocus />
          </div>
          <div>
            <label style={lblStyle}>Floor Name (optional)</label>
            <input style={inputStyle} value={fForm.floorName} onChange={(e) => setFForm({ ...fForm, floorName: e.target.value })} placeholder="e.g. Ground Floor" />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
            <Btn variant="secondary" onClick={() => setShowFModal(false)}>Cancel</Btn>
            <Btn onClick={handleAddFloor}>Add Floor</Btn>
          </div>
        </div>
      </Modal>

      {/* Room Modal */}
      <Modal open={showRModal} onClose={() => setShowRModal(false)} title={`Add Room — Floor ${activeFloor?.floorNumber}`}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={lblStyle}>Room Number *</label>
            <input style={inputStyle} value={rForm.roomNumber} onChange={(e) => setRForm({ ...rForm, roomNumber: e.target.value })} placeholder="e.g. 101" autoFocus />
          </div>
          <div>
            <label style={lblStyle}>Share Type *</label>
            <select style={inputStyle} value={rForm.shareType} onChange={(e) => setRForm({ ...rForm, shareType: e.target.value })}>
              {SHARE_OPTIONS.map((n) => <option key={n} value={n}>{n} Share ({n} Bed{n > 1 ? "s" : ""})</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {Array.from({ length: Number(rForm.shareType) }, (_, i) => (
              <div key={i} style={{ width: 28, height: 28, borderRadius: 4, background: "var(--green-bg)", border: "1px solid #86efac", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600, color: "var(--green)" }}>
                {i + 1}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
            <Btn variant="secondary" onClick={() => setShowRModal(false)}>Cancel</Btn>
            <Btn onClick={handleAddRoom}>Add Room</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Panel({ title, children, action }) {
  return (
    <div style={{ minWidth: 260, flex: "0 0 260px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h3 style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function EmptyState({ text }) {
  return <p style={{ fontSize: 12, color: "var(--text-3)", textAlign: "center", padding: "20px 0" }}>{text}</p>;
}

const iconBtn = { background: "transparent", border: "none", cursor: "pointer", fontSize: 14, color: "var(--text-3)", padding: "2px 4px", borderRadius: 4 };
const lblStyle = { display: "block", fontSize: 12, color: "var(--text-2)", marginBottom: 5, fontWeight: 500 };
