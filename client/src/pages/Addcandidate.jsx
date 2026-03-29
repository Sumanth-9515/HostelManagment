import { useState, useEffect, useRef } from "react";
import { API, authHeaders } from "../api.js";
import { useToast, Toast, Btn, inputStyle } from "../components/ui.jsx";
import Swal from "sweetalert2";

const INIT = {
  name: "", phone: "", email: "", fatherName: "", fatherPhone: "",
  permanentAddress: "", joiningDate: new Date().toISOString().split("T")[0],
  rentAmount: "", advanceAmount: "",
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
  
  // File upload states
  const [aadharFront, setAadharFront] = useState(null);
  const [aadharBack, setAadharBack] = useState(null);
  const [passportPhoto, setPassportPhoto] = useState(null);
  const [aadharFrontPreview, setAadharFrontPreview] = useState("");
  const [aadharBackPreview, setAadharBackPreview] = useState("");
  const [passportPhotoPreview, setPassportPhotoPreview] = useState("");
  
  const fileInputRefs = {
    aadharFront: useRef(),
    aadharBack: useRef(),
    passportPhoto: useRef(),
  };

  useEffect(() => {
    fetch(`${API}/buildings`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => setBuildings(Array.isArray(d) ? d : []))
      .catch((err) => console.error("Error fetching buildings:", err));
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
      .then((d) => setAvailBeds(d.availableBeds || []))
      .catch((err) => console.error("Error fetching beds:", err));
  }, [selRoom]);

  const handleFileChange = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        Swal.fire("Error", "File size should be less than 5MB", "error");
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === "aadharFront") {
          setAadharFront(file);
          setAadharFrontPreview(reader.result);
        } else if (type === "aadharBack") {
          setAadharBack(file);
          setAadharBackPreview(reader.result);
        } else if (type === "passportPhoto") {
          setPassportPhoto(file);
          setPassportPhotoPreview(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const validateStep1 = () => {
    const { name, phone, permanentAddress, joiningDate, rentAmount } = form;
    if (!name.trim()) {
      Swal.fire("Validation Error", "Please enter tenant's full name", "warning");
      return false;
    }
    if (!phone.trim()) {
      Swal.fire("Validation Error", "Please enter phone number", "warning");
      return false;
    }
    if (phone.trim().length < 10) {
      Swal.fire("Validation Error", "Please enter a valid 10-digit phone number", "warning");
      return false;
    }
    if (!permanentAddress.trim()) {
      Swal.fire("Validation Error", "Please enter permanent address", "warning");
      return false;
    }
    if (!joiningDate) {
      Swal.fire("Validation Error", "Please select joining date", "warning");
      return false;
    }
    if (!rentAmount || Number(rentAmount) <= 0) {
      Swal.fire("Validation Error", "Please enter a valid rent amount", "warning");
      return false;
    }
    return true;
  };

  const validateDocuments = () => {
    if (!aadharFront) {
      Swal.fire("Validation Error", "Please upload Aadhar Card (Front)", "warning");
      return false;
    }
    if (!aadharBack) {
      Swal.fire("Validation Error", "Please upload Aadhar Card (Back)", "warning");
      return false;
    }
    if (!passportPhoto) {
      Swal.fire("Validation Error", "Please upload Passport Size Photo", "warning");
      return false;
    }
    return true;
  };

  const validateAllocation = () => {
    if (!selBuilding) {
      Swal.fire("Validation Error", "Please select a building", "warning");
      return false;
    }
    if (!selFloor) {
      Swal.fire("Validation Error", "Please select a floor", "warning");
      return false;
    }
    if (!selRoom) {
      Swal.fire("Validation Error", "Please select a room", "warning");
      return false;
    }
    if (!selBed) {
      Swal.fire("Validation Error", "Please select a bed", "warning");
      return false;
    }
    return true;
  };

  const handleNextToStep2 = () => {
    if (validateStep1()) {
      setStep(2);
    }
  };

  const handleNextToStep3 = () => {
    if (validateDocuments()) {
      setStep(3);
    }
  };

  const handleStepClick = (targetStep) => {
    if (targetStep < step) {
      setStep(targetStep);
    } else if (targetStep === 2 && step === 1) {
      if (validateStep1()) {
        setStep(2);
      }
    } else if (targetStep === 3 && step === 2) {
      if (validateDocuments()) {
        setStep(3);
      }
    }
  };

  const handleSubmit = async () => {
    if (!validateStep1()) return;
    if (!validateDocuments()) return;
    if (!validateAllocation()) return;

    setLoading(true);
    const formData = new FormData();
    
    formData.append("name", form.name);
    formData.append("phone", form.phone);
    if (form.email) formData.append("email", form.email);
    if (form.fatherName) formData.append("fatherName", form.fatherName);
    if (form.fatherPhone) formData.append("fatherPhone", form.fatherPhone);
    formData.append("permanentAddress", form.permanentAddress);
    formData.append("joiningDate", form.joiningDate);
    formData.append("rentAmount", String(Number(form.rentAmount)));
    // Advance: send 0 if empty/not entered
    formData.append("advanceAmount", form.advanceAmount ? String(Number(form.advanceAmount)) : "0");
    
    formData.append("buildingId", selBuilding);
    formData.append("floorId", selFloor);
    formData.append("roomId", selRoom);
    formData.append("bedId", selBed);
    
    formData.append("aadharFront", aadharFront);
    formData.append("aadharBack", aadharBack);
    formData.append("passportPhoto", passportPhoto);

    try {
      const token = sessionStorage.getItem("token");
      if (!token) {
        throw new Error("No authentication token found");
      }

      const response = await fetch(`${API}/tenants`, { 
        method: "POST", 
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData 
      });
      
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to add tenant");
      }
      
      await Swal.fire({
        title: "Success!",
        text: "Tenant added successfully with room allocation",
        icon: "success",
        timer: 2000,
        showConfirmButton: false
      });
      
      // Reset form
      setForm(INIT);
      setSelBuilding("");
      setSelFloor("");
      setSelRoom("");
      setSelBed("");
      setStep(1);
      setAadharFront(null);
      setAadharBack(null);
      setPassportPhoto(null);
      setAadharFrontPreview("");
      setAadharBackPreview("");
      setPassportPhotoPreview("");
      
    } catch (error) {
      console.error("Error adding tenant:", error);
      Swal.fire("Error", error.message || "Failed to add tenant", "error");
    } finally {
      setLoading(false);
    }
  };

  const selectedRoom = rooms.find((r) => r._id === selRoom);
  const allBeds = selectedRoom?.beds || [];

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "20px" }}>
      <Toast toast={toast} />

      <div style={{ marginBottom: 28, textAlign: "center" }}>
        <h1 style={{ 
          fontSize: "clamp(24px, 5vw, 32px)", 
          fontWeight: 700, 
          marginBottom: 8, 
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", 
          WebkitBackgroundClip: "text", 
          WebkitTextFillColor: "transparent" 
        }}>
          Add New Tenant
        </h1>
        <p style={{ fontSize: "clamp(14px, 3vw, 16px)", color: "var(--text-2)" }}>
          Register a new tenant with complete details, documents, and room allocation
        </p>
      </div>

      {/* Step indicator */}
      <div style={{ 
        display: "flex", 
        justifyContent: "center",
        alignItems: "center", 
        gap: "clamp(8px, 2vw, 16px)", 
        marginBottom: 32, 
        flexWrap: "wrap" 
      }}>
        {[{ n: 1, label: "Personal Details" }, { n: 2, label: "Documents" }, { n: 3, label: "Room Allocation" }].map(({ n, label }, i, arr) => (
          <div key={n} style={{ display: "flex", alignItems: "center", gap: "clamp(8px, 2vw, 16px)" }}>
            <div
              onClick={() => handleStepClick(n)}
              style={{
                display: "flex", 
                alignItems: "center", 
                gap: "clamp(6px, 2vw, 12px)",
                cursor: "pointer",
                padding: "8px 0",
              }}
            >
              <div style={{
                width: "clamp(32px, 6vw, 40px)", 
                height: "clamp(32px, 6vw, 40px)", 
                borderRadius: "50%", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                fontSize: "clamp(14px, 3vw, 16px)", 
                fontWeight: 600,
                background: step === n ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" : step > n ? "#10b981" : "var(--surface-2)",
                color: step === n ? "white" : step > n ? "white" : "var(--text-3)",
                transition: "all 0.3s ease",
                transform: step === n ? "scale(1.1)" : "scale(1)",
              }}>
                {step > n ? "✓" : n}
              </div>
              <span style={{ 
                fontSize: "clamp(12px, 3vw, 14px)", 
                fontWeight: step === n ? 600 : 400, 
                color: step === n ? "var(--text)" : "var(--text-2)",
                transition: "color 0.3s ease",
                display: window.innerWidth < 768 ? "none" : "inline"
              }}>
                {label}
              </span>
            </div>
            {i < arr.length - 1 && <span style={{ color: "var(--text-3)", fontSize: "clamp(12px, 3vw, 14px)" }}>→</span>}
          </div>
        ))}
      </div>

      <div style={{ 
        background: "var(--surface)", 
        border: "1px solid var(--border)", 
        borderRadius: "var(--radius-lg)", 
        padding: "clamp(20px, 5vw, 32px)",
        transition: "all 0.3s ease",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
      }}>
        {/* ── STEP 1: Personal Details ── */}
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "clamp(16px, 4vw, 20px)" }}>
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", 
              gap: "clamp(16px, 4vw, 20px)" 
            }}>
              <div>
                <label style={lblStyle}>Full Name *</label>
                <input 
                  style={inputStyle} 
                  value={form.name} 
                  onChange={(e) => setForm({ ...form, name: e.target.value })} 
                  placeholder="John Doe" 
                  autoFocus 
                />
              </div>
              <div>
                <label style={lblStyle}>Phone *</label>
                <input 
                  style={inputStyle} 
                  value={form.phone} 
                  onChange={(e) => setForm({ ...form, phone: e.target.value })} 
                  placeholder="9876543210" 
                />
              </div>
            </div>
            
            <div>
              <label style={lblStyle}>Email</label>
              <input 
                style={inputStyle} 
                value={form.email} 
                onChange={(e) => setForm({ ...form, email: e.target.value })} 
                placeholder="john@email.com" 
              />
            </div>
            
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", 
              gap: "clamp(16px, 4vw, 20px)" 
            }}>
              <div>
                <label style={lblStyle}>Father's Name</label>
                <input 
                  style={inputStyle} 
                  value={form.fatherName} 
                  onChange={(e) => setForm({ ...form, fatherName: e.target.value })} 
                  placeholder="Father's full name" 
                />
              </div>
              <div>
                <label style={lblStyle}>Father's Phone</label>
                <input 
                  style={inputStyle} 
                  value={form.fatherPhone} 
                  onChange={(e) => setForm({ ...form, fatherPhone: e.target.value })} 
                  placeholder="Father's contact number" 
                />
              </div>
            </div>
            
            <div>
              <label style={lblStyle}>Permanent Address *</label>
              <textarea 
                style={{ ...inputStyle, resize: "vertical", minHeight: 80 }} 
                value={form.permanentAddress} 
                onChange={(e) => setForm({ ...form, permanentAddress: e.target.value })} 
                placeholder="Full address with PIN code" 
              />
            </div>
            
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", 
              gap: "clamp(16px, 4vw, 20px)" 
            }}>
              <div>
                <label style={lblStyle}>Joining Date *</label>
                <input 
                  style={inputStyle} 
                  type="date" 
                  value={form.joiningDate} 
                  onChange={(e) => setForm({ ...form, joiningDate: e.target.value })} 
                />
              </div>
              <div>
                <label style={lblStyle}>Monthly Rent (₹) *</label>
                <input 
                  style={inputStyle} 
                  type="number" 
                  value={form.rentAmount} 
                  onChange={(e) => setForm({ ...form, rentAmount: e.target.value })} 
                  placeholder="5000" 
                  min="1"
                />
              </div>
              {/* ── NEW: Advance Amount field ── */}
              <div>
                <label style={lblStyle}>
                  Advance Amount (₹)
                  <span style={{ fontWeight: 400, color: "var(--text-3)", marginLeft: 4 }}>(optional)</span>
                </label>
                <input 
                  style={inputStyle} 
                  type="number" 
                  value={form.advanceAmount} 
                  onChange={(e) => setForm({ ...form, advanceAmount: e.target.value })} 
                  placeholder="0" 
                  min="0"
                />
                <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
                  Leave blank or 0 if no advance collected.
                </p>
              </div>
            </div>
            
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
              <Btn onClick={handleNextToStep2} style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", border: "none" }}>
                Next: Upload Documents →
              </Btn>
            </div>
          </div>
        )}

        {/* ── STEP 2: Documents ── */}
        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "clamp(20px, 5vw, 24px)" }}>
            <div style={{ 
              padding: "clamp(12px, 3vw, 16px)", 
              background: "var(--surface-2)", 
              borderRadius: "var(--radius)",
              borderLeft: "4px solid #667eea"
            }}>
              <p style={{ fontSize: "clamp(12px, 3vw, 13px)", color: "var(--text-3)", margin: 0 }}>
                📄 Upload required documents (Max 5MB each). Aadhar card front & back, and a recent passport size photo.
              </p>
              <p style={{ fontSize: "clamp(11px, 2.5vw, 12px)", color: "#ef4444", marginTop: 8, fontWeight: 500 }}>
                ⚠️ All documents are mandatory
              </p>
            </div>

            {/* Aadhar Front */}
            <div>
              <label style={lblStyle}>Aadhar Card (Front) *</label>
              <div 
                style={{ 
                  border: `2px dashed ${aadharFrontPreview ? "#10b981" : "var(--border)"}`, 
                  borderRadius: "var(--radius)", 
                  padding: "clamp(16px, 4vw, 20px)",
                  textAlign: "center",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  background: aadharFrontPreview ? "rgba(16, 185, 129, 0.1)" : "transparent"
                }}
                onClick={() => fileInputRefs.aadharFront.current.click()}
              >
                {aadharFrontPreview ? (
                  <div>
                    <img src={aadharFrontPreview} alt="Aadhar Front" style={{ maxWidth: "100%", maxHeight: 150, objectFit: "contain", borderRadius: 8 }} />
                    <p style={{ fontSize: 12, color: "#10b981", marginTop: 8 }}>✓ File uploaded - Click to change</p>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 40, marginBottom: 8 }}>📄</div>
                    <p style={{ fontSize: "clamp(12px, 3vw, 13px)", color: "var(--text-2)", margin: 0 }}>Click to upload Aadhar Front</p>
                    <p style={{ fontSize: "clamp(10px, 2.5vw, 11px)", color: "var(--text-3)", marginTop: 4 }}>JPG, PNG or PDF (Max 5MB)</p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRefs.aadharFront}
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => handleFileChange(e, "aadharFront")}
                style={{ display: "none" }}
              />
            </div>

            {/* Aadhar Back */}
            <div>
              <label style={lblStyle}>Aadhar Card (Back) *</label>
              <div 
                style={{ 
                  border: `2px dashed ${aadharBackPreview ? "#10b981" : "var(--border)"}`, 
                  borderRadius: "var(--radius)", 
                  padding: "clamp(16px, 4vw, 20px)",
                  textAlign: "center",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  background: aadharBackPreview ? "rgba(16, 185, 129, 0.1)" : "transparent"
                }}
                onClick={() => fileInputRefs.aadharBack.current.click()}
              >
                {aadharBackPreview ? (
                  <div>
                    <img src={aadharBackPreview} alt="Aadhar Back" style={{ maxWidth: "100%", maxHeight: 150, objectFit: "contain", borderRadius: 8 }} />
                    <p style={{ fontSize: 12, color: "#10b981", marginTop: 8 }}>✓ File uploaded - Click to change</p>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 40, marginBottom: 8 }}>📄</div>
                    <p style={{ fontSize: "clamp(12px, 3vw, 13px)", color: "var(--text-2)", margin: 0 }}>Click to upload Aadhar Back</p>
                    <p style={{ fontSize: "clamp(10px, 2.5vw, 11px)", color: "var(--text-3)", marginTop: 4 }}>JPG, PNG or PDF (Max 5MB)</p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRefs.aadharBack}
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => handleFileChange(e, "aadharBack")}
                style={{ display: "none" }}
              />
            </div>

            {/* Passport Photo */}
            <div>
              <label style={lblStyle}>Passport Size Photo *</label>
              <div 
                style={{ 
                  border: `2px dashed ${passportPhotoPreview ? "#10b981" : "var(--border)"}`, 
                  borderRadius: "var(--radius)", 
                  padding: "clamp(16px, 4vw, 20px)",
                  textAlign: "center",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  background: passportPhotoPreview ? "rgba(16, 185, 129, 0.1)" : "transparent"
                }}
                onClick={() => fileInputRefs.passportPhoto.current.click()}
              >
                {passportPhotoPreview ? (
                  <div>
                    <img src={passportPhotoPreview} alt="Passport Photo" style={{ maxWidth: 120, maxHeight: 150, objectFit: "contain", borderRadius: 8 }} />
                    <p style={{ fontSize: 12, color: "#10b981", marginTop: 8 }}>✓ File uploaded - Click to change</p>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 40, marginBottom: 8 }}>🖼️</div>
                    <p style={{ fontSize: "clamp(12px, 3vw, 13px)", color: "var(--text-2)", margin: 0 }}>Click to upload Passport Photo</p>
                    <p style={{ fontSize: "clamp(10px, 2.5vw, 11px)", color: "var(--text-3)", marginTop: 4 }}>JPG or PNG (Max 5MB)</p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRefs.passportPhoto}
                type="file"
                accept="image/*"
                onChange={(e) => handleFileChange(e, "passportPhoto")}
                style={{ display: "none" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, flexWrap: "wrap", gap: 12 }}>
              <Btn variant="secondary" onClick={() => setStep(1)}>← Back</Btn>
              <Btn onClick={handleNextToStep3} style={{ 
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                border: "none"
              }}>
                Next: Allocate Room →
              </Btn>
            </div>
          </div>
        )}

        {/* ── STEP 3: Room Allocation ── */}
        {step === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "clamp(16px, 4vw, 20px)" }}>
            <div style={{ 
              padding: "clamp(12px, 3vw, 16px)", 
              background: "var(--surface-2)", 
              borderRadius: "var(--radius)",
              borderLeft: "4px solid #ef4444",
              backgroundColor: "rgba(239, 68, 68, 0.1)"
            }}>
              <p style={{ fontSize: "clamp(12px, 3vw, 13px)", color: "#ef4444", margin: 0, fontWeight: 500 }}>
                ⚠️ Room allocation is mandatory! Please select building, floor, room, and bed for the tenant.
              </p>
            </div>

            <div>
              <label style={lblStyle}>Building *</label>
              <select 
                style={{ ...inputStyle, borderColor: !selBuilding && step === 3 ? "#ef4444" : "var(--border)" }} 
                value={selBuilding} 
                onChange={(e) => setSelBuilding(e.target.value)}
              >
                <option value="">Select building</option>
                {buildings.map((b) => <option key={b._id} value={b._id}>{b.buildingName}</option>)}
              </select>
              {!selBuilding && (
                <p style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>Building selection is required</p>
              )}
            </div>

            {selBuilding && (
              <div>
                <label style={lblStyle}>Floor *</label>
                <select 
                  style={{ ...inputStyle, borderColor: !selFloor && step === 3 ? "#ef4444" : "var(--border)" }} 
                  value={selFloor} 
                  onChange={(e) => setSelFloor(e.target.value)}
                >
                  <option value="">Select floor</option>
                  {floors.map((f) => <option key={f._id} value={f._id}>Floor {f.floorNumber}{f.floorName ? ` — ${f.floorName}` : ""}</option>)}
                </select>
                {!selFloor && (
                  <p style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>Floor selection is required</p>
                )}
              </div>
            )}

            {selFloor && (
              <div>
                <label style={lblStyle}>Room *</label>
                <select 
                  style={{ ...inputStyle, borderColor: !selRoom && step === 3 ? "#ef4444" : "var(--border)" }} 
                  value={selRoom} 
                  onChange={(e) => setSelRoom(e.target.value)}
                >
                  <option value="">Select room</option>
                  {rooms.map((r) => {
                    const avail = r.beds.filter((b) => b.status === "Available").length;
                    return <option key={r._id} value={r._id} disabled={avail === 0}>Room {r.roomNumber} ({r.shareType}-share) — {avail} free</option>;
                  })}
                </select>
                {!selRoom && (
                  <p style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>Room selection is required</p>
                )}
              </div>
            )}

            {selRoom && (
              <div>
                <label style={lblStyle}>Select Bed *</label>
                {availBeds.length === 0 ? (
                  <div>
                    <p style={{ fontSize: "clamp(12px, 3vw, 13px)", color: "#ef4444", padding: "12px", background: "var(--red-bg)", borderRadius: "var(--radius)", textAlign: "center" }}>
                        No available beds in this room. Please select another room.
                    </p>
                  </div>
                ) : (
                  <>
                    <div style={{ 
                      display: "grid", 
                      gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", 
                      gap: "clamp(8px, 2vw, 12px)" 
                    }}>
                      {allBeds.map((bed) => {
                        const isAvail = bed.status === "Available";
                        const isSel = selBed === bed._id;
                        return (
                          <div
                            key={bed._id}
                            onClick={() => isAvail && setSelBed(bed._id)}
                            style={{
                              border: `2px solid ${isSel ? "#667eea" : isAvail ? "var(--border)" : "#fca5a5"}`,
                              background: isSel ? "linear-gradient(135deg, rgba(102,126,234,0.1) 0%, rgba(118,75,162,0.1) 100%)" : isAvail ? "var(--bg)" : "var(--red-bg)",
                              borderRadius: "var(--radius)", 
                              padding: "clamp(8px, 2vw, 12px)",
                              textAlign: "center", 
                              cursor: isAvail ? "pointer" : "not-allowed",
                              opacity: isAvail ? 1 : 0.6,
                              transition: "all 0.3s ease",
                              transform: isSel ? "scale(1.05)" : "scale(1)",
                              boxShadow: isSel ? "0 4px 12px rgba(102,126,234,0.3)" : "none"
                            }}
                          >
                            <div style={{ fontSize: "clamp(20px, 4vw, 24px)", marginBottom: 6 }}>🛏️</div>
                            <div style={{ fontSize: "clamp(12px, 2.5vw, 14px)", fontWeight: 600 }}>Bed {bed.bedNumber}</div>
                            <div style={{ fontSize: "clamp(10px, 2vw, 11px)", color: isAvail ? "#10b981" : "#ef4444", marginTop: 4 }}>
                              {isAvail ? "Available" : "Occupied"}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {!selBed && (
                      <p style={{ fontSize: 11, color: "#ef4444", marginTop: 8, textAlign: "center" }}>
                        ⚠️ Please select a bed to complete allocation
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, flexWrap: "wrap", gap: 12 }}>
              <Btn variant="secondary" onClick={() => setStep(2)}>← Back</Btn>
              <Btn 
                onClick={handleSubmit} 
                disabled={loading || !selBuilding || !selFloor || !selRoom || !selBed} 
                style={{ 
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", 
                  border: "none",
                  position: "relative",
                  overflow: "hidden",
                  opacity: (!selBuilding || !selFloor || !selRoom || !selBed) ? 0.6 : 1,
                  cursor: (!selBuilding || !selFloor || !selRoom || !selBed) ? "not-allowed" : "pointer"
                }}
              >
                {loading ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="spinner" style={{
                      width: 16, height: 16, border: "2px solid white", borderTop: "2px solid transparent",
                      borderRadius: "50%", animation: "spin 0.6s linear infinite", display: "inline-block"
                    }}></span>
                    Saving...
                  </span>
                ) : "Add Tenant"}
              </Btn>
            </div>
            {(!selBuilding || !selFloor || !selRoom || !selBed) && (
              <p style={{ fontSize: 12, color: "#ef4444", textAlign: "center", marginTop: 8 }}>
                ⚠️ Complete all allocation fields to add tenant
              </p>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @media (max-width: 768px) {
          .step-label {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}

const lblStyle = { 
  display: "block", 
  fontSize: "clamp(12px, 3vw, 13px)", 
  color: "var(--text-2)", 
  marginBottom: 6, 
  fontWeight: 500 
};