/**
 * TenantOnboardingForm.jsx
 * Public self-registration form accessed via /tenant-register/:shortCode
 * Route example:
 *   <Route path="/tenant-register/:token" element={<TenantOnboardingForm />} />
 *
 * Changes:
 *  - Uses short token (8 chars) in URL instead of full JWT
 *  - Advance amount field (optional, stored as 0 if blank)
 *  - Documents upload (Aadhar front/back + passport photo) fully wired
 *  - Bed selection on step 3
 */

import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { API } from "../api.js";

const INIT = {
  name: "", phone: "", email: "", fatherName: "", fatherPhone: "",
  permanentAddress: "",
  joiningDate: new Date().toISOString().split("T")[0],
  rentAmount: "",
  advanceAmount: "",
};

/* ─── tiny helpers ────────────────────────────────────────────────── */
const inp = {
  width: "100%", padding: "11px 14px", borderRadius: 10,
  border: "1.5px solid #e2e8f0", fontSize: 14, background: "#fff",
  color: "#0f172a", outline: "none", fontFamily: "inherit",
  transition: "border-color 0.2s, box-shadow 0.2s", boxSizing: "border-box",
};
const inpFocus = { borderColor: "#6366f1", boxShadow: "0 0 0 3px rgba(99,102,241,0.12)" };
const lbl = {
  display: "block", fontSize: 12, fontWeight: 600, color: "#64748b",
  letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 5,
};

function Field({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <label style={lbl}>{label}</label>
      {children}
    </div>
  );
}

function FocusInput({ type = "text", placeholder, value, onChange, required, min }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={type} placeholder={placeholder} value={value} onChange={onChange}
      required={required} min={min}
      style={{ ...inp, ...(focused ? inpFocus : {}) }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    />
  );
}

/* ─── Step indicator ──────────────────────────────────────────────── */
function StepBar({ step }) {
  const steps = ["Personal Info", "Documents", "Room Allocation"];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 32 }}>
      {steps.map((s, i) => {
        const num = i + 1;
        const done = step > num;
        const active = step === num;
        return (
          <div key={s} style={{ display: "flex", alignItems: "center", flex: 1 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "0 0 auto" }}>
              <div style={{
                width: 34, height: 34, borderRadius: "50%",
                background: done ? "#10b981" : active ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "#e2e8f0",
                color: done || active ? "#fff" : "#94a3b8",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700,
                boxShadow: active ? "0 4px 14px rgba(99,102,241,0.35)" : "none",
                transition: "all 0.3s",
              }}>
                {done ? "✓" : num}
              </div>
              <span style={{
                fontSize: 10, fontWeight: 600, marginTop: 5, letterSpacing: "0.03em",
                color: active ? "#6366f1" : done ? "#10b981" : "#94a3b8",
                whiteSpace: "nowrap",
              }}>{s}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{
                flex: 1, height: 2, margin: "0 4px", marginBottom: 18,
                background: done ? "#10b981" : "#e2e8f0",
                transition: "background 0.3s",
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Doc upload card ─────────────────────────────────────────────── */
function DocCard({ label, icon, preview, onPick, fileRef }) {
  return (
    <div
      onClick={() => fileRef.current?.click()}
      style={{
        border: `2px dashed ${preview ? "#10b981" : "#c7d2fe"}`,
        borderRadius: 12, padding: 16, cursor: "pointer",
        background: preview ? "rgba(16,185,129,0.04)" : "rgba(99,102,241,0.03)",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
        transition: "all 0.2s", minHeight: 110,
      }}
    >
      {preview ? (
        <>
          <img src={preview} alt={label}
            style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 8, border: "2px solid #10b981" }} />
          <span style={{ fontSize: 11, color: "#10b981", fontWeight: 600 }}>✓ Uploaded</span>
          <span style={{ fontSize: 10, color: "#64748b" }}>Click to change</span>
        </>
      ) : (
        <>
          <span style={{ fontSize: 28 }}>{icon}</span>
          <span style={{ fontSize: 12, color: "#6366f1", fontWeight: 600, textAlign: "center" }}>{label}</span>
          <span style={{ fontSize: 10, color: "#94a3b8" }}>Click to upload</span>
        </>
      )}
      <input ref={fileRef} type="file" accept="image/*,application/pdf"
        onChange={onPick} style={{ display: "none" }} />
    </div>
  );
}

/* ─── Bed card ────────────────────────────────────────────────────── */
function BedCard({ bed, selected, onClick }) {
  return (
    <div onClick={onClick} style={{
      border: `2px solid ${selected ? "#6366f1" : "#e2e8f0"}`,
      background: selected ? "linear-gradient(135deg,rgba(99,102,241,0.08),rgba(139,92,246,0.08))" : "#fff",
      borderRadius: 10, padding: "12px 8px", textAlign: "center",
      cursor: "pointer", transition: "all 0.2s",
      transform: selected ? "scale(1.04)" : "scale(1)",
      boxShadow: selected ? "0 4px 14px rgba(99,102,241,0.2)" : "none",
    }}>
      <div style={{ fontSize: 22, marginBottom: 4 }}>🛏️</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: selected ? "#6366f1" : "#0f172a" }}>
        Bed {bed.bedNumber}
      </div>
      <div style={{ fontSize: 10, color: "#10b981", fontWeight: 600, marginTop: 2 }}>Available</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
export default function TenantOnboardingForm() {
  // token is now the short code (e.g. "Ab3xKp7Q") — passed as-is to the backend
  const { token } = useParams();

  const [pageStatus, setPageStatus] = useState("loading");
  const [buildings, setBuildings] = useState([]);
  const [form, setForm] = useState(INIT);
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const [floors, setFloors] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [availBeds, setAvailBeds] = useState([]);
  const [selBuilding, setSelBuilding] = useState("");
  const [selFloor, setSelFloor] = useState("");
  const [selRoom, setSelRoom] = useState("");
  const [selBed, setSelBed] = useState("");

  const [aadharFront, setAadharFront] = useState(null);
  const [aadharBack, setAadharBack] = useState(null);
  const [passportPhoto, setPassportPhoto] = useState(null);
  const [aadharFrontPreview, setAadharFrontPreview] = useState("");
  const [aadharBackPreview, setAadharBackPreview] = useState("");
  const [passportPreview, setPassportPreview] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const refs = {
    aadharFront: useRef(),
    aadharBack: useRef(),
    passportPhoto: useRef(),
  };

  /* ── Validate link on mount ── */
  useEffect(() => {
    fetch(`${API}/tenants/validate-link/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.valid) { setBuildings(d.buildings || []); setPageStatus("valid"); }
        else setPageStatus("invalid");
      })
      .catch(() => setPageStatus("invalid"));
  }, [token]);

  /* ── Cascading selects ── */
  useEffect(() => {
    setSelFloor(""); setSelRoom(""); setSelBed("");
    setFloors([]); setRooms([]); setAvailBeds([]);
    if (!selBuilding) return;
    const b = buildings.find(x => x._id === selBuilding);
    if (b) setFloors([...b.floors].sort((a, c) => a.floorNumber - c.floorNumber));
  }, [selBuilding, buildings]);

  useEffect(() => {
    setSelRoom(""); setSelBed(""); setRooms([]); setAvailBeds([]);
    if (!selFloor) return;
    const f = floors.find(x => x._id === selFloor);
    if (f) setRooms(f.rooms);
  }, [selFloor]);

  useEffect(() => {
    setSelBed(""); setAvailBeds([]);
    if (!selRoom) return;
    const r = rooms.find(x => x._id === selRoom);
    if (r) setAvailBeds(r.beds); // already filtered to Available by server
  }, [selRoom]);

  /* ── File handler ── */
  const handleFile = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError("File must be under 5 MB"); return; }
    const reader = new FileReader();
    reader.onloadend = () => {
      if (type === "aadharFront") { setAadharFront(file); setAadharFrontPreview(reader.result); }
      if (type === "aadharBack") { setAadharBack(file); setAadharBackPreview(reader.result); }
      if (type === "passportPhoto") { setPassportPhoto(file); setPassportPreview(reader.result); }
    };
    reader.readAsDataURL(file);
    setError("");
  };

  /* ── Validation ── */
const validate1 = () => {
  let errors = {};

  // ✅ Name (only letters + min 3 chars)
  if (!/^[A-Za-z ]{3,}$/.test(form.name.trim())) {
    errors.name = "Name must contain only letters (min 3 chars)";
  }

  // ✅ Phone (must start with 6-9 and exactly 10 digits)
  if (!/^[6-9]\d{9}$/.test(form.phone)) {
    errors.phone = "Phone must start with 6-9 and be 10 digits";
  }

  // ✅ Email (must contain @ and valid format)
  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = "Enter valid email";
  }

  // ✅ Father Name (same as name)
  if (!/^[A-Za-z ]{3,}$/.test(form.fatherName.trim())) {
    errors.fatherName = "Invalid father name";
  }

  // ✅ Father Phone (same rule)
  if (!/^[6-9]\d{9}$/.test(form.fatherPhone)) {
    errors.fatherPhone = "Enter valid father Phone Number";
  }

  // ✅ Address (minimum 10 characters)
  if (!form.permanentAddress || form.permanentAddress.trim().length < 10) {
    errors.permanentAddress = "Address must be at least 10 characters";
  }

  // ✅ Joining Date
  if (!form.joiningDate) {
    errors.joiningDate = "Required";
  }

  // ✅ Rent Amount (> 0)
  if (!form.rentAmount || Number(form.rentAmount) <= 0) {
    errors.rentAmount = "Invalid amount";
  }

  setFieldErrors(errors);

  if (Object.keys(errors).length > 0) {
    setError("Please fill all required fields correctly");
    return false;
  }

  return true;
};

  const validate2 = () => {
    if (!aadharFront) return setError("Please upload Aadhar Front"), false;
    if (!aadharBack) return setError("Please upload Aadhar Back"), false;
    if (!passportPhoto) return setError("Please upload Passport Photo"), false;
    return true;
  };

  const validate3 = () => {
    if (!selBuilding) return setError("Please select a building"), false;
    if (!selFloor) return setError("Please select a floor"), false;
    if (!selRoom) return setError("Please select a room"), false;
    if (!selBed) return setError("Please select a bed"), false;
    return true;
  };

  const next = (validateFn, nextStep) => {
    setError("");
    if (validateFn()) setStep(nextStep);
  };

  /* ── Submit ── */
  const handleSubmit = async () => {
    setError("");
    if (!validate1() || !validate2() || !validate3()) return;

    setLoading(true);
    const fd = new FormData();
    fd.append("linkToken", token); // short code passed as-is
    fd.append("name", form.name.trim());
    fd.append("phone", form.phone.trim());
    if (form.email) fd.append("email", form.email.trim());
    if (form.fatherName) fd.append("fatherName", form.fatherName.trim());
    if (form.fatherPhone) fd.append("fatherPhone", form.fatherPhone.trim());
    fd.append("permanentAddress", form.permanentAddress.trim());
    fd.append("joiningDate", form.joiningDate);
    fd.append("rentAmount", form.rentAmount);
    // Advance: send 0 if blank
    fd.append("advanceAmount", form.advanceAmount ? String(Number(form.advanceAmount)) : "0");
    fd.append("buildingId", selBuilding);
    fd.append("floorId", selFloor);
    fd.append("roomId", selRoom);
    fd.append("bedId", selBed);
    if (aadharFront) fd.append("aadharFront", aadharFront);
    if (aadharBack) fd.append("aadharBack", aadharBack);
    if (passportPhoto) fd.append("passportPhoto", passportPhoto);

    try {
      const res = await fetch(`${API}/tenants/register-via-link`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Registration failed. Please try again."); return; }
      setSuccessMsg(data.message);
      setPageStatus("success");
    } catch {
      setError("Connection error. Please check your internet and try again.");
    } finally {
      setLoading(false);
    }
  };

const set = k => e => {
  setForm(f => ({ ...f, [k]: e.target.value }));

  setFieldErrors(prev => ({ ...prev, [k]: "" }));
  setError("");
};

  /* ═══════ Render helpers ═══════ */
  const selStyle = { ...inp, paddingRight: 36, appearance: "none", cursor: "pointer" };

  if (pageStatus === "loading") return (
    <div style={rootStyle}>
      <div style={centerStyle}>
        <div style={spinnerStyle} />
        <p style={{ color: "#64748b", fontSize: 15, marginTop: 16 }}>Verifying your invitation link…</p>
      </div>
    </div>
  );

  if (pageStatus === "invalid") return (
    <div style={rootStyle}>
      <div style={{ ...centerStyle, maxWidth: 400 }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>🔗</div>
        <h2 style={{ color: "#0f172a", fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Link Expired or Invalid</h2>
        <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.65, textAlign: "center" }}>
          This onboarding link is no longer valid. It may have expired (links are valid for 7 days)
          or the URL was incorrectly copied. Please contact your hostel manager for a new link.
        </p>
        <div style={{
          marginTop: 20, padding: "12px 16px", background: "#fef3c7", borderRadius: 10,
          border: "1px solid #fcd34d", fontSize: 13, color: "#92400e"
        }}>
          📞 Contact your manager for a fresh onboarding link.
        </div>
      </div>
    </div>
  );

  if (pageStatus === "success") return (
    <div style={rootStyle}>
      <div style={{ ...centerStyle, maxWidth: 440 }}>
        <div style={{
          width: 72, height: 72, borderRadius: "50%",
          background: "linear-gradient(135deg,#10b981,#34d399)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 32, marginBottom: 20,
          boxShadow: "0 8px 24px rgba(16,185,129,0.35)",
        }}>✓</div>
        <h2 style={{ color: "#0f172a", fontSize: 24, fontWeight: 700, marginBottom: 8 }}>You're all set! 🎉</h2>
        <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.7, textAlign: "center", maxWidth: 340 }}>
          {successMsg || "Your registration is complete. Your hostel manager will reach out to you shortly."}
        </p>
        <div style={{
          marginTop: 24, padding: 16, background: "linear-gradient(135deg,rgba(99,102,241,0.06),rgba(139,92,246,0.06))",
          borderRadius: 12, border: "1px solid rgba(99,102,241,0.15)", width: "100%",
        }}>
          <p style={{ fontSize: 13, color: "#4f46e5", fontWeight: 600, margin: 0 }}>
            🏠 Room Allocated Successfully
          </p>
          <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0" }}>
            Check with your manager for check-in instructions.
          </p>
        </div>
      </div>
    </div>
  );

  /* ═══════ Main Form ═══════ */
  return (
    <div style={rootStyle}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        select option { color: #0f172a; }
        @keyframes ob-spin { to { transform: rotate(360deg); } }
        @keyframes ob-fade { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .ob-card { animation: ob-fade 0.4s cubic-bezier(0.16,1,0.3,1) both; }
      `}</style>

      {/* ── Header banner ── */}
      <div style={{
        background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)",
        padding: "28px 24px 60px",
        position: "relative", overflow: "hidden",
      }}>
        {[["-60px", "-40px", "200px", "rgba(139,92,246,0.2)"], ["auto", "-30px", "160px", "rgba(16,185,129,0.12)", "0px", "auto"]].map(
          ([top, right, size, color, bottom, left], i) => (
            <div key={i} style={{
              position: "absolute", top, right, bottom, left,
              width: size, height: size, borderRadius: "50%",
              background: color, filter: "blur(50px)", pointerEvents: "none",
            }} />
          )
        )}
        <div style={{ maxWidth: 540, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.14)",
              border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 17,
            }}>🏨</div>
            <span style={{ color: "#fff", fontSize: 15, fontWeight: 700, letterSpacing: "0.08em" }}>Nilayam.com</span>
          </div>
          <h1 style={{ color: "#fff", fontSize: "clamp(20px,5vw,26px)", fontWeight: 800, margin: "0 0 6px", lineHeight: 1.2 }}>
            Tenant Onboarding Form
          </h1>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, margin: 0, lineHeight: 1.6 }}>
            Fill in your details below to complete your hostel registration.
          </p>
        </div>
      </div>

      {/* ── Card (overlaps header) ── */}
      <div style={{ maxWidth: 560, margin: "-36px auto 40px", padding: "0 16px" }}>
        <div className="ob-card" style={{
          background: "#fff", borderRadius: 18,
          boxShadow: "0 8px 40px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.05)",
          padding: "clamp(20px,5vw,36px)",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}>
          <StepBar step={step} />

          {/* ── Error banner ── */}
          {error && (
            <div style={{
              padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca",
              borderRadius: 8, fontSize: 13, color: "#dc2626", marginBottom: 20,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* ══ STEP 1: Personal Info ══ */}
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <SectionLabel>Personal Information</SectionLabel>

              <TwoCol>
           <Field label="Full Name *">
  <FocusInput
    placeholder="e.g. Rahul Sharma"
    value={form.name}
    onChange={set("name")}
  />
  {fieldErrors.name && (
    <span style={{ color: "red", fontSize: 11 }}>
      {fieldErrors.name}
    </span>
  )}
</Field>
                <Field label="Phone Number *">
                  <FocusInput type="tel" placeholder="10-digit mobile" value={form.phone} onChange={set("phone")} />
                  {fieldErrors.phone && (
  <span style={{ color: "red", fontSize: 11 }}>
    {fieldErrors.phone}
  </span>
)}
                </Field>
              </TwoCol>

              <TwoCol>
                <Field label="Email Address">
                  <FocusInput type="email" placeholder="you@email.com" value={form.email} onChange={set("email")} />
                  {fieldErrors.email && (
  <span style={{ color: "red", fontSize: 11 }}>
    {fieldErrors.email}
  </span>
)}
                </Field>
           <Field label="Father's Name *">
  <FocusInput
    placeholder="Father's full name"
    value={form.fatherName}
    onChange={set("fatherName")}
  />
  {fieldErrors.fatherName && (
    <span style={{ color: "red", fontSize: 11 }}>
      {fieldErrors.fatherName}
    </span>
  )}
</Field>
              </TwoCol>

             <Field label="Father's Phone *">
  <FocusInput
    type="tel"
    placeholder="Father's mobile number"
    value={form.fatherPhone}
    onChange={set("fatherPhone")}
  />
  {fieldErrors.fatherPhone && (
    <span style={{ color: "red", fontSize: 11 }}>
      {fieldErrors.fatherPhone}
    </span>
  )}
</Field>

              <Field label="Permanent Address *">
                <FocusTarea placeholder="Full permanent address with city and state" value={form.permanentAddress} onChange={set("permanentAddress")} />
              </Field>

              <SectionLabel>Tenancy Details</SectionLabel>

              <TwoCol>
                <Field label="Joining Date *">
                  <FocusInput type="date" value={form.joiningDate} onChange={set("joiningDate")} />
                </Field>
                <Field label="Monthly Rent (₹) *">
                  <FocusInput type="number" placeholder="e.g. 5000" value={form.rentAmount} onChange={set("rentAmount")} min="1" />
                </Field>
              </TwoCol>

              {/* ── NEW: Advance Amount ── */}
              <Field label="Advance Amount (₹) — Optional">
                <FocusInput type="number" placeholder="0 (leave blank if none)" value={form.advanceAmount} onChange={set("advanceAmount")} min="0" />
                <span style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                  Leave blank or enter 0 if no advance was collected.
                </span>
              </Field>

              <PrimaryBtn onClick={() => next(validate1, 2)} style={{ marginTop: 8 }}>
                Next: Upload Documents →
              </PrimaryBtn>
            </div>
          )}

          {/* ══ STEP 2: Documents ══ */}
          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <SectionLabel>Upload Documents</SectionLabel>
              <p style={{ fontSize: 13, color: "#64748b", margin: "-8px 0 0", lineHeight: 1.65 }}>
                Upload clear photos of your documents (JPG, PNG or PDF, max 5 MB each). All three are required.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14 }}>
                <DocCard label="Aadhar Front *" icon="🪪"
                  preview={aadharFrontPreview} fileRef={refs.aadharFront}
                  onPick={e => handleFile(e, "aadharFront")} />
                <DocCard label="Aadhar Back *" icon="🪪"
                  preview={aadharBackPreview} fileRef={refs.aadharBack}
                  onPick={e => handleFile(e, "aadharBack")} />
                <DocCard label="Passport Photo *" icon="🖼️"
                  preview={passportPreview} fileRef={refs.passportPhoto}
                  onPick={e => handleFile(e, "passportPhoto")} />
              </div>

              {/* Upload status summary */}
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8,
                padding: "10px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0",
              }}>
                {[
                  { label: "Aadhar Front", ok: !!aadharFront },
                  { label: "Aadhar Back", ok: !!aadharBack },
                  { label: "Passport", ok: !!passportPhoto },
                ].map(({ label, ok }) => (
                  <div key={label} style={{ textAlign: "center", fontSize: 11 }}>
                    <div style={{ fontSize: 16 }}>{ok ? "✅" : "⬜"}</div>
                    <div style={{ color: ok ? "#10b981" : "#94a3b8", fontWeight: 600, marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>

              <InfoBox>
                🔒 Your documents are securely stored and used only for identity verification.
              </InfoBox>

              <RowBtns>
                <SecondaryBtn onClick={() => { setError(""); setStep(1); }}>← Back</SecondaryBtn>
                <PrimaryBtn onClick={() => next(validate2, 3)}>Next: Choose Room →</PrimaryBtn>
              </RowBtns>
            </div>
          )}

          {/* ══ STEP 3: Room Allocation ══ */}
          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <SectionLabel>Room Allocation</SectionLabel>

              {buildings.length === 0 ? (
                <InfoBox color="#fef3c7" border="#fcd34d" text="#92400e">
                  ⚠️ No buildings are currently available. Please contact your manager.
                </InfoBox>
              ) : (
                <>
                  <Field label="Building *">
                    <div style={{ position: "relative" }}>
                      <select value={selBuilding} onChange={e => { setSelBuilding(e.target.value); setError(""); }}
                        style={selStyle}>
                        <option value="">Select building</option>
                        {buildings.map(b => <option key={b._id} value={b._id}>{b.buildingName}</option>)}
                      </select>
                      <span style={chevron}>▾</span>
                    </div>
                  </Field>

                  {selBuilding && (
                    <Field label="Floor *">
                      <div style={{ position: "relative" }}>
                        <select value={selFloor} onChange={e => { setSelFloor(e.target.value); setError(""); }}
                          style={selStyle}>
                          <option value="">Select floor</option>
                          {floors.map(f => <option key={f._id} value={f._id}>
                            Floor {f.floorNumber}{f.floorName ? ` — ${f.floorName}` : ""}
                          </option>)}
                        </select>
                        <span style={chevron}>▾</span>
                      </div>
                    </Field>
                  )}

                  {selFloor && (
                    <Field label="Room *">
                      <div style={{ position: "relative" }}>
                        <select value={selRoom} onChange={e => { setSelRoom(e.target.value); setError(""); }}
                          style={selStyle}>
                          <option value="">Select room</option>
                          {rooms.map(r => {
                            const avail = r.beds.filter(b => b.status === "Available").length;
                            return (
                              <option key={r._id} value={r._id} disabled={avail === 0}>
                                Room {r.roomNumber} ({r.shareType}-share) — {avail} bed{avail !== 1 ? "s" : ""} free
                              </option>
                            );
                          })}
                        </select>
                        <span style={chevron}>▾</span>
                      </div>
                    </Field>
                  )}

                  {selRoom && (
                    <div>
                      <label style={lbl}>Select Bed *</label>
                      {availBeds.length === 0 ? (
                        <InfoBox color="#fef2f2" border="#fecaca" text="#dc2626">
                          No available beds in this room. Please select a different room.
                        </InfoBox>
                      ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(90px,1fr))", gap: 10, marginTop: 6 }}>
                          {availBeds.map(bed => (
                            <BedCard key={bed._id} bed={bed}
                              selected={selBed === bed._id}
                              onClick={() => { setSelBed(bed._id); setError(""); }} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              <RowBtns>
                <SecondaryBtn onClick={() => { setError(""); setStep(2); }}>← Back</SecondaryBtn>
                <PrimaryBtn
                  onClick={handleSubmit}
                  disabled={loading || !selBuilding || !selFloor || !selRoom || !selBed}
                  style={{ opacity: (!selBuilding || !selFloor || !selRoom || !selBed || loading) ? 0.6 : 1 }}
                >
                  {loading ? (
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{
                        width: 15, height: 15, border: "2px solid rgba(255,255,255,0.4)",
                        borderTop: "2px solid #fff", borderRadius: "50%",
                        animation: "ob-spin 0.6s linear infinite", display: "inline-block",
                      }} />
                      Registering…
                    </span>
                  ) : "Submit Registration ✓"}
                </PrimaryBtn>
              </RowBtns>
            </div>
          )}
        </div>

        <p style={{ textAlign: "center", fontSize: 12, color: "#94a3b8", marginTop: 16 }}>
          Secured by HOSTELIQ — your data is encrypted and safe.
        </p>
      </div>
    </div>
  );
}

/* ─── Shared mini-components ───────────────────────────────────────── */
function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase",
      color: "#6366f1", background: "#eef2ff", display: "inline-block",
      padding: "3px 10px", borderRadius: 6, marginBottom: 2,
    }}>{children}</div>
  );
}

function TwoCol({ children }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14 }}>
      {children}
    </div>
  );
}

function FocusTarea({ placeholder, value, onChange }) {
  const [focused, setFocused] = useState(false);
  return (
    <textarea
      placeholder={placeholder} value={value} onChange={onChange}
      rows={3}
      style={{
        ...inp, resize: "vertical", lineHeight: 1.5,
        ...(focused ? inpFocus : {}),
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    />
  );
}

function PrimaryBtn({ children, onClick, disabled, style = {} }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        padding: "12px 22px", borderRadius: 10, border: "none", cursor: disabled ? "not-allowed" : "pointer",
        background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff",
        fontSize: 14, fontWeight: 700, fontFamily: "inherit",
        boxShadow: "0 4px 14px rgba(99,102,241,0.3)",
        transition: "transform 0.15s, box-shadow 0.15s",
        ...style,
      }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 6px 18px rgba(99,102,241,0.4)"; } }}
      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 14px rgba(99,102,241,0.3)"; }}
    >
      {children}
    </button>
  );
}

function SecondaryBtn({ children, onClick }) {
  return (
    <button onClick={onClick}
      style={{
        padding: "12px 18px", borderRadius: 10, border: "1.5px solid #e2e8f0",
        background: "#fff", color: "#475569", fontSize: 14, fontWeight: 600,
        cursor: "pointer", fontFamily: "inherit", transition: "background 0.15s",
      }}
      onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
      onMouseLeave={e => e.currentTarget.style.background = "#fff"}
    >
      {children}
    </button>
  );
}

function RowBtns({ children }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginTop: 4 }}>
      {children}
    </div>
  );
}

function InfoBox({ children, color = "#eff6ff", border = "#bfdbfe", text = "#1e40af" }) {
  return (
    <div style={{
      padding: "10px 14px", background: color, border: `1px solid ${border}`,
      borderRadius: 8, fontSize: 13, color: text, lineHeight: 1.55,
    }}>
      {children}
    </div>
  );
}

/* ─── Shared styles ────────────────────────────────────────────────── */
const rootStyle = {
  minHeight: "100vh", background: "#f1f5f9",
  fontFamily: "'Plus Jakarta Sans', sans-serif",
};
const centerStyle = {
  minHeight: "100vh", display: "flex", flexDirection: "column",
  alignItems: "center", justifyContent: "center", padding: 24,
};
const spinnerStyle = {
  width: 40, height: 40, border: "3px solid #e2e8f0",
  borderTop: "3px solid #6366f1", borderRadius: "50%",
  animation: "ob-spin 0.8s linear infinite",
};
const chevron = {
  position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
  pointerEvents: "none", color: "#94a3b8", fontSize: 14,
};