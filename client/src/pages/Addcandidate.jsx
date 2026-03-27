import { useState, useEffect } from "react";
import { API, authHeaders } from "../api.js";
import { useToast, Toast, Btn, inputStyle } from "../components/ui.jsx";

const INIT = {
  name: "", phone: "", email: "", permanentAddress: "",
  joiningDate: new Date().toISOString().split("T")[0], rentAmount: "",
};

export default function AddCandidate() {
  const [form, setForm] = useState(INIT);
  const [buildings, setBuildings] = useState([]);
  const [floors, setFloors] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [availBeds, setAvailBeds] = useState([]);
  const [selBuilding, setSelBuilding] = useState("");
  const [selFloor, setSelFloor] = useState("");
  const [selRoom, setSelRoom] = useState("");
  const [selBed, setSelBed] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const { toast, show } = useToast();

  useEffect(() => {
    fetch(`${API}/buildings`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => setBuildings(Array.isArray(d) ? d : []));
  }, []);

  useEffect(() => {
    setSelFloor(""); setSelRoom(""); setSelBed("");
    setFloors([]); setRooms([]); setAvailBeds([]);
    if (!selBuilding) return;
    const b = buildings.find((x) => x._id === selBuilding);
    if (b) setFloors([...b.floors].sort((a, c) => a.floorNumber - c.floorNumber));
  }, [selBuilding, buildings]);

  useEffect(() => {
    setSelRoom(""); setSelBed(""); setRooms([]); setAvailBeds([]);
    if (!selFloor) return;
    const f = floors.find((x) => x._id === selFloor);
    if (f) setRooms(f.rooms);
  }, [selFloor, floors]);

  useEffect(() => {
    setSelBed(""); setAvailBeds([]);
    if (!selBuilding || !selFloor || !selRoom) return;
    fetch(`${API}/buildings/${selBuilding}/floors/${selFloor}/rooms/${selRoom}/available-beds`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => setAvailBeds(d.availableBeds || []));
  }, [selRoom]);

  const validateStep1 = () => {
    const { name, phone, permanentAddress, joiningDate, rentAmount } = form;
    if (!name || !phone || !permanentAddress || !joiningDate || !rentAmount) {
      show("Fill all required fields", "error"); return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateStep1()) return;
    if (selRoom && !selBed) return show("Select a bed", "error");

    setLoading(true);
    const body = {
      ...form, rentAmount: Number(form.rentAmount),
      ...(selBed ? { buildingId: selBuilding, floorId: selFloor, roomId: selRoom, bedId: selBed } : {}),
    };

    const r = await fetch(`${API}/tenants`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
    const d = await r.json();
    setLoading(false);

    if (!r.ok) return show(d.message, "error");
    show("Tenant added successfully");
    setForm(INIT); setSelBuilding(""); setSelFloor(""); setSelRoom(""); setSelBed(""); setStep(1);
  };

  const selectedRoom = rooms.find((r) => r._id === selRoom);
  const allBeds = selectedRoom?.beds || [];

  return (
    <div style={{ maxWidth: 640 }}>
      <Toast toast={toast} />

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Add Tenant</h1>
        <p style={{ fontSize: 13, color: "var(--text-2)" }}>Register a new tenant and allocate a bed</p>
      </div>

      {/* Step indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
        {[{ n: 1, label: "Details" }, { n: 2, label: "Allocation" }].map(({ n, label }, i, arr) => (
          <div key={n} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              onClick={() => n < step || (n === 2 && validateStep1()) ? setStep(n) : null}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                cursor: "pointer", padding: "6px 0",
              }}
            >
              <div style={{
                width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 600,
                background: step === n ? "var(--accent)" : step > n ? "var(--green-bg)" : "var(--surface-2)",
                color: step === n ? "var(--accent-fg)" : step > n ? "var(--green)" : "var(--text-3)",
                border: `1px solid ${step === n ? "var(--accent)" : "var(--border)"}`,
              }}>
                {step > n ? "✓" : n}
              </div>
              <span style={{ fontSize: 13, fontWeight: step === n ? 600 : 400, color: step === n ? "var(--text)" : "var(--text-2)" }}>
                {label}
              </span>
            </div>
            {i < arr.length - 1 && <span style={{ color: "var(--text-3)", fontSize: 12 }}>→</span>}
          </div>
        ))}
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 24 }}>
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={lblStyle}>Full Name *</label>
                <input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="John Doe" autoFocus />
              </div>
              <div>
                <label style={lblStyle}>Phone *</label>
                <input style={inputStyle} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="9876543210" />
              </div>
            </div>
            <div>
              <label style={lblStyle}>Email</label>
              <input style={inputStyle} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="john@email.com" />
            </div>
            <div>
              <label style={lblStyle}>Permanent Address *</label>
              <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 72 }} value={form.permanentAddress} onChange={(e) => setForm({ ...form, permanentAddress: e.target.value })} placeholder="Full address" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={lblStyle}>Joining Date *</label>
                <input style={inputStyle} type="date" value={form.joiningDate} onChange={(e) => setForm({ ...form, joiningDate: e.target.value })} />
              </div>
              <div>
                <label style={lblStyle}>Monthly Rent (₹) *</label>
                <input style={inputStyle} type="number" value={form.rentAmount} onChange={(e) => setForm({ ...form, rentAmount: e.target.value })} placeholder="5000" />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
              <Btn onClick={() => { if (validateStep1()) setStep(2); }}>
                Next: Allocate Bed →
              </Btn>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ fontSize: 12, color: "var(--text-3)", background: "var(--surface-2)", padding: "10px 12px", borderRadius: "var(--radius)", borderLeft: "2px solid var(--accent)" }}>
              Select building → floor → room → bed. Allocation is optional.
            </p>

            <div>
              <label style={lblStyle}>Building</label>
              <select style={inputStyle} value={selBuilding} onChange={(e) => setSelBuilding(e.target.value)}>
                <option value="">No allocation</option>
                {buildings.map((b) => <option key={b._id} value={b._id}>{b.buildingName}</option>)}
              </select>
            </div>

            {selBuilding && (
              <div>
                <label style={lblStyle}>Floor</label>
                <select style={inputStyle} value={selFloor} onChange={(e) => setSelFloor(e.target.value)}>
                  <option value="">Select floor</option>
                  {floors.map((f) => <option key={f._id} value={f._id}>Floor {f.floorNumber}{f.floorName ? ` — ${f.floorName}` : ""}</option>)}
                </select>
              </div>
            )}

            {selFloor && (
              <div>
                <label style={lblStyle}>Room</label>
                <select style={inputStyle} value={selRoom} onChange={(e) => setSelRoom(e.target.value)}>
                  <option value="">Select room</option>
                  {rooms.map((r) => {
                    const avail = r.beds.filter((b) => b.status === "Available").length;
                    return <option key={r._id} value={r._id} disabled={avail === 0}>Room {r.roomNumber} ({r.shareType}-share) — {avail} free</option>;
                  })}
                </select>
              </div>
            )}

            {selRoom && (
              <div>
                <label style={lblStyle}>Bed *</label>
                {availBeds.length === 0 ? (
                  <p style={{ fontSize: 12, color: "var(--red)", padding: "10px 12px", background: "var(--red-bg)", borderRadius: "var(--radius)" }}>
                    No available beds in this room. Choose another.
                  </p>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 8 }}>
                    {allBeds.map((bed) => {
                      const isAvail = bed.status === "Available";
                      const isSel = selBed === bed._id;
                      return (
                        <div
                          key={bed._id}
                          onClick={() => isAvail && setSelBed(bed._id)}
                          style={{
                            border: `1px solid ${isSel ? "var(--accent)" : isAvail ? "var(--border)" : "#fca5a5"}`,
                            background: isSel ? "var(--surface-2)" : isAvail ? "var(--bg)" : "var(--red-bg)",
                            borderRadius: "var(--radius)", padding: "10px 6px",
                            textAlign: "center", cursor: isAvail ? "pointer" : "not-allowed",
                            opacity: isAvail ? 1 : 0.5,
                          }}
                        >
                          <div style={{ fontSize: 20, marginBottom: 4 }}>🛏</div>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>Bed {bed.bedNumber}</div>
                          <div style={{ fontSize: 10, color: isAvail ? "var(--green)" : "var(--red)", marginTop: 2 }}>
                            {isAvail ? "Free" : "Taken"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <Btn variant="secondary" onClick={() => setStep(1)}>← Back</Btn>
              <Btn onClick={handleSubmit} disabled={loading}>
                {loading ? "Saving…" : "Add Tenant"}
              </Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const lblStyle = { display: "block", fontSize: 12, color: "var(--text-2)", marginBottom: 5, fontWeight: 500 };
