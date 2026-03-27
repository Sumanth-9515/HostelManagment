// pages/TenantRegisterPage.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Public page: /tenant-register/:token
//
// Flow:
//   1. Owner generates a shareable link → /tenant-register/<ownerToken>
//      (ownerToken = the owner's JWT, embeds their userId so the tenant is
//       automatically linked to the right owner+building)
//   2. Tenant opens the link, fills the form, submits
//   3. POST /api/tenants/register-via-link  { linkToken, ...tenantData }
//   4. Backend verifies ownerToken, creates tenant, marks bed occupied
//   5. Success screen shown
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import TenantHeader from "../components/TenantHeader.jsx";
import { API } from "../api.js";

// ── Tiny field component ─────────────────────────────────────────────────────
function Field({ label, error, required, children }) {
  return (
    <div style={fs.fieldWrap}>
      <label style={fs.label}>
        {label}
        {required && <span style={fs.req}> *</span>}
      </label>
      {children}
      {error && <span style={fs.err}>{error}</span>}
    </div>
  );
}

function Input({ error, ...props }) {
  return (
    <input
      {...props}
      style={{
        ...fs.input,
        ...(error ? fs.inputErr : {}),
        ...(props.style || {}),
      }}
    />
  );
}

// ── Steps config ──────────────────────────────────────────────────────────────
const TOTAL_STEPS = 3;

export default function TenantRegisterPage() {
  const { token: linkToken } = useParams(); // owner's JWT in URL

  const [step,    setStep]    = useState(1);
  const [loading, setLoading] = useState(false);
  const [errors,  setErrors]  = useState({});
  const [success, setSuccess] = useState(false);
  const [apiErr,  setApiErr]  = useState("");

  // ── Building/room options fetched from link token ─────────────────────────
  const [buildings, setBuildings] = useState([]);
  const [floors,    setFloors]    = useState([]);
  const [rooms,     setRooms]     = useState([]);
  const [beds,      setBeds]      = useState([]);
  const [linkValid, setLinkValid] = useState(null); // null=loading, true, false

  // ── Form state ────────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    // Step 1 — personal
    name:             "",
    phone:            "",
    email:            "",
    permanentAddress: "",
    // Step 2 — allocation
    buildingId: "",
    floorId:    "",
    roomId:     "",
    bedId:      "",
    // Step 3 — tenancy
    joiningDate:  "",
    rentAmount:   "",
  });

  // ── Validate link token on mount ─────────────────────────────────────────
  useEffect(() => {
    if (!linkToken) { setLinkValid(false); return; }

    (async () => {
      try {
        const res  = await fetch(`${API}/tenants/validate-link/${linkToken}`);
        const data = await res.json();
        if (!res.ok) return setLinkValid(false);
        setLinkValid(true);
        setBuildings(data.buildings || []);
      } catch {
        setLinkValid(false);
      }
    })();
  }, [linkToken]);

  // ── Cascade: building → floors → rooms → beds ───────────────────────────
  useEffect(() => {
    if (!form.buildingId) { setFloors([]); setRooms([]); setBeds([]); return; }
    const b = buildings.find((b) => b._id === form.buildingId);
    setFloors(b?.floors || []);
    setForm((p) => ({ ...p, floorId: "", roomId: "", bedId: "" }));
  }, [form.buildingId]);

  useEffect(() => {
    if (!form.floorId) { setRooms([]); setBeds([]); return; }
    const b = buildings.find((b) => b._id === form.buildingId);
    const f = b?.floors.find((f) => f._id === form.floorId);
    setRooms(f?.rooms || []);
    setForm((p) => ({ ...p, roomId: "", bedId: "" }));
  }, [form.floorId]);

  useEffect(() => {
    if (!form.roomId) { setBeds([]); return; }
    const b = buildings.find((b) => b._id === form.buildingId);
    const f = b?.floors.find((f) => f._id === form.floorId);
    const r = f?.rooms.find((r) => r._id === form.roomId);
    const available = (r?.beds || []).filter((bed) => bed.status === "Available");
    setBeds(available);
    setForm((p) => ({ ...p, bedId: "" }));
  }, [form.roomId]);

  // ── Field setter ─────────────────────────────────────────────────────────
  const set = (k) => (e) => {
    setForm((p) => ({ ...p, [k]: e.target.value }));
    setErrors((p) => ({ ...p, [k]: "" }));
    setApiErr("");
  };

  // ── Per-step validation ──────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (step === 1) {
      if (!form.name.trim())             e.name             = "Full name is required";
      if (!form.phone.trim())            e.phone            = "Phone number is required";
      if (!form.permanentAddress.trim()) e.permanentAddress = "Permanent address is required";
      if (form.email && !/\S+@\S+\.\S+/.test(form.email)) e.email = "Invalid email";
    }
    if (step === 3) {
      if (!form.joiningDate) e.joiningDate = "Joining date is required";
      if (!form.rentAmount)  e.rentAmount  = "Rent amount is required";
      else if (isNaN(Number(form.rentAmount)) || Number(form.rentAmount) <= 0)
        e.rentAmount = "Enter a valid amount";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (validate()) setStep((s) => s + 1); };
  const back = () => setStep((s) => s - 1);

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setApiErr("");

    try {
      const payload = {
        linkToken,
        name:             form.name.trim(),
        phone:            form.phone.trim(),
        email:            form.email.trim().toLowerCase() || undefined,
        permanentAddress: form.permanentAddress.trim(),
        joiningDate:      form.joiningDate,
        rentAmount:       Number(form.rentAmount),
        buildingId:       form.buildingId || undefined,
        floorId:          form.floorId    || undefined,
        roomId:           form.roomId     || undefined,
        bedId:            form.bedId      || undefined,
      };

      const res  = await fetch(`${API}/tenants/register-via-link`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) return setApiErr(data.message || "Registration failed.");
      setSuccess(true);
    } catch {
      setApiErr("Cannot connect to server.");
    } finally {
      setLoading(false);
    }
  };

  // ── Loading link validation ───────────────────────────────────────────────
  if (linkValid === null) {
    return (
      <>
        <TenantHeader title="Tenant Registration" />
        <div style={fs.centred}>
          <div style={fs.spinner} />
          <p style={{ color: "var(--text-3,#9e9b8e)", fontSize: 13, marginTop: 16 }}>
            Verifying registration link…
          </p>
        </div>
      </>
    );
  }

  // ── Invalid / expired link ────────────────────────────────────────────────
  if (linkValid === false) {
    return (
      <>
        <TenantHeader title="Tenant Registration" />
        <div style={fs.centred}>
          <div style={fs.iconCircle}>✕</div>
          <h2 style={fs.errorTitle}>Invalid or expired link</h2>
          <p style={fs.errorSub}>
            This registration link is not valid. Please ask your property manager
            for a new link.
          </p>
        </div>
      </>
    );
  }

  // ── Success screen ────────────────────────────────────────────────────────
  if (success) {
    return (
      <>
        <TenantHeader title="Registration Complete" />
        <div style={fs.centred}>
          <div style={{ ...fs.iconCircle, background: "var(--text,#1a1916)", color: "#fff" }}>✓</div>
          <h2 style={fs.errorTitle}>You're registered!</h2>
          <p style={fs.errorSub}>
            Your details have been submitted. Your property manager will confirm
            your room allocation shortly.
          </p>
        </div>
      </>
    );
  }

  // ── Step titles ───────────────────────────────────────────────────────────
  const stepTitles = ["Personal Details", "Room Allocation", "Tenancy Details"];

  return (
    <>
      <TenantHeader
        title="Tenant Registration"
        subtitle={stepTitles[step - 1]}
        step={step}
        totalSteps={TOTAL_STEPS}
      />

      <main style={fs.main}>
        <div style={fs.card}>

          {/* ── Step dots ─────────────────────────────────────────────── */}
          <div style={fs.stepDots}>
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <div
                key={i}
                style={{
                  ...fs.dot,
                  ...(i + 1 === step ? fs.dotActive : {}),
                  ...(i + 1 < step  ? fs.dotDone  : {}),
                }}
              >
                {i + 1 < step ? "✓" : i + 1}
              </div>
            ))}
          </div>

          <h1 style={fs.heading}>{stepTitles[step - 1]}</h1>

          {/* ── Global API error ─────────────────────────────────────── */}
          {apiErr && <div style={fs.apiErr}>{apiErr}</div>}

          <form onSubmit={handleSubmit}>

            {/* ════════════════════════════════════════════════════════
                STEP 1 — Personal Details
            ════════════════════════════════════════════════════════ */}
            {step === 1 && (
              <div style={fs.fields}>
                <Field label="Full Name" error={errors.name} required>
                  <Input
                    type="text"
                    placeholder="Ramesh Kumar"
                    value={form.name}
                    onChange={set("name")}
                    error={errors.name}
                    autoFocus
                  />
                </Field>

                <Field label="Phone Number" error={errors.phone} required>
                  <Input
                    type="tel"
                    placeholder="9876543210"
                    value={form.phone}
                    onChange={set("phone")}
                    error={errors.phone}
                  />
                </Field>

                <Field label="Email Address" error={errors.email}>
                  <Input
                    type="email"
                    placeholder="you@example.com (optional)"
                    value={form.email}
                    onChange={set("email")}
                    error={errors.email}
                  />
                </Field>

                <Field label="Permanent Address" error={errors.permanentAddress} required>
                  <textarea
                    placeholder="Door no, Street, City, State, Pincode"
                    value={form.permanentAddress}
                    onChange={set("permanentAddress")}
                    rows={3}
                    style={{
                      ...fs.input,
                      resize: "vertical",
                      minHeight: 80,
                      ...(errors.permanentAddress ? fs.inputErr : {}),
                    }}
                  />
                  {errors.permanentAddress && (
                    <span style={fs.err}>{errors.permanentAddress}</span>
                  )}
                </Field>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════
                STEP 2 — Room Allocation (optional)
            ════════════════════════════════════════════════════════ */}
            {step === 2 && (
              <div style={fs.fields}>
                <p style={fs.note}>
                  Select your assigned building and room. You can skip this if
                  your manager will allocate it later.
                </p>

                <Field label="Building">
                  <select
                    value={form.buildingId}
                    onChange={set("buildingId")}
                    style={fs.select}
                  >
                    <option value="">— Skip / Select later —</option>
                    {buildings.map((b) => (
                      <option key={b._id} value={b._id}>{b.buildingName}</option>
                    ))}
                  </select>
                </Field>

                {form.buildingId && (
                  <Field label="Floor">
                    <select
                      value={form.floorId}
                      onChange={set("floorId")}
                      style={fs.select}
                    >
                      <option value="">— Select floor —</option>
                      {floors.map((f) => (
                        <option key={f._id} value={f._id}>
                          Floor {f.floorNumber}{f.floorName ? ` — ${f.floorName}` : ""}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}

                {form.floorId && (
                  <Field label="Room">
                    <select
                      value={form.roomId}
                      onChange={set("roomId")}
                      style={fs.select}
                    >
                      <option value="">— Select room —</option>
                      {rooms.map((r) => (
                        <option key={r._id} value={r._id}>
                          Room {r.roomNumber} ({r.shareType}-share)
                        </option>
                      ))}
                    </select>
                  </Field>
                )}

                {form.roomId && (
                  <Field label="Bed">
                    {beds.length === 0 ? (
                      <p style={fs.noBeds}>No available beds in this room.</p>
                    ) : (
                      <div style={fs.bedGrid}>
                        {beds.map((bed) => (
                          <button
                            key={bed._id}
                            type="button"
                            onClick={() => setForm((p) => ({ ...p, bedId: bed._id }))}
                            style={{
                              ...fs.bedBtn,
                              ...(form.bedId === bed._id ? fs.bedBtnActive : {}),
                            }}
                          >
                            Bed {bed.bedNumber}
                          </button>
                        ))}
                      </div>
                    )}
                  </Field>
                )}
              </div>
            )}

            {/* ════════════════════════════════════════════════════════
                STEP 3 — Tenancy Details
            ════════════════════════════════════════════════════════ */}
            {step === 3 && (
              <div style={fs.fields}>
                <Field label="Joining Date" error={errors.joiningDate} required>
                  <Input
                    type="date"
                    value={form.joiningDate}
                    onChange={set("joiningDate")}
                    error={errors.joiningDate}
                    max={new Date().toISOString().split("T")[0]}
                  />
                </Field>

                <Field label="Monthly Rent (₹)" error={errors.rentAmount} required>
                  <Input
                    type="number"
                    placeholder="5000"
                    min="1"
                    value={form.rentAmount}
                    onChange={set("rentAmount")}
                    error={errors.rentAmount}
                  />
                </Field>

                {/* Summary card */}
                <div style={fs.summary}>
                  <p style={fs.summaryTitle}>Registration summary</p>
                  <div style={fs.summaryGrid}>
                    <span style={fs.summaryKey}>Name</span>
                    <span style={fs.summaryVal}>{form.name}</span>
                    <span style={fs.summaryKey}>Phone</span>
                    <span style={fs.summaryVal}>{form.phone}</span>
                    {form.email && <>
                      <span style={fs.summaryKey}>Email</span>
                      <span style={fs.summaryVal}>{form.email}</span>
                    </>}
                    {form.buildingId && <>
                      <span style={fs.summaryKey}>Building</span>
                      <span style={fs.summaryVal}>
                        {buildings.find((b) => b._id === form.buildingId)?.buildingName}
                      </span>
                    </>}
                  </div>
                </div>
              </div>
            )}

            {/* ── Navigation ──────────────────────────────────────────── */}
            <div style={fs.nav}>
              {step > 1 && (
                <button type="button" onClick={back} style={fs.btnBack}>
                  ← Back
                </button>
              )}

              {step < TOTAL_STEPS ? (
                <button type="button" onClick={next} style={fs.btnNext}>
                  Continue →
                </button>
              ) : (
                <button type="submit" disabled={loading} style={fs.btnNext}>
                  {loading ? "Submitting…" : "Submit Registration"}
                </button>
              )}
            </div>
          </form>

          <p style={fs.footNote}>
            Already registered? Contact your property manager.
          </p>
        </div>
      </main>
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const fs = {
  main: {
    minHeight: "calc(100vh - 57px)",
    background: "var(--bg,#f5f4f0)",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    padding: "40px 20px 80px",
  },
  card: {
    width: "100%",
    maxWidth: 520,
    background: "var(--surface,#fff)",
    border: "1px solid var(--border,#e2e0d8)",
    borderRadius: "var(--radius,10px)",
    padding: "36px 36px 28px",
  },
  stepDots: {
    display: "flex",
    gap: 8,
    marginBottom: 28,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    border: "1.5px solid var(--border,#e2e0d8)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11,
    fontWeight: 600,
    color: "var(--text-3,#9e9b8e)",
    transition: "all 0.2s",
  },
  dotActive: {
    border: "1.5px solid var(--text,#1a1916)",
    color: "var(--text,#1a1916)",
    background: "transparent",
  },
  dotDone: {
    background: "var(--text,#1a1916)",
    border: "1.5px solid var(--text,#1a1916)",
    color: "#fff",
  },
  heading: {
    fontSize: 20,
    fontWeight: 700,
    color: "var(--text,#1a1916)",
    marginBottom: 24,
    letterSpacing: "-0.01em",
  },
  fields: {
    display: "flex",
    flexDirection: "column",
    gap: 18,
    marginBottom: 28,
  },
  fieldWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 5,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--text-2,#5c5a4e)",
    letterSpacing: "0.02em",
  },
  req: {
    color: "var(--text,#1a1916)",
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    fontSize: 13,
    color: "var(--text,#1a1916)",
    background: "var(--surface-2,#f9f8f5)",
    border: "1px solid var(--border,#e2e0d8)",
    borderRadius: "var(--radius,10px)",
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
    transition: "border-color 0.15s",
  },
  inputErr: {
    borderColor: "var(--red,#d94f3d)",
  },
  select: {
    width: "100%",
    padding: "10px 12px",
    fontSize: 13,
    color: "var(--text,#1a1916)",
    background: "var(--surface-2,#f9f8f5)",
    border: "1px solid var(--border,#e2e0d8)",
    borderRadius: "var(--radius,10px)",
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
    cursor: "pointer",
    appearance: "none",
    backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L6 7L11 1' stroke='%239e9b8e' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 12px center",
    paddingRight: 36,
  },
  err: {
    fontSize: 11,
    color: "var(--red,#d94f3d)",
    marginTop: 2,
  },
  note: {
    fontSize: 12,
    color: "var(--text-3,#9e9b8e)",
    lineHeight: 1.6,
    margin: 0,
  },
  noBeds: {
    fontSize: 12,
    color: "var(--red,#d94f3d)",
    margin: 0,
  },
  bedGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  bedBtn: {
    padding: "7px 16px",
    fontSize: 12,
    fontWeight: 600,
    border: "1.5px solid var(--border,#e2e0d8)",
    borderRadius: "var(--radius,10px)",
    background: "var(--surface-2,#f9f8f5)",
    color: "var(--text-2,#5c5a4e)",
    cursor: "pointer",
    transition: "all 0.15s",
    fontFamily: "inherit",
  },
  bedBtnActive: {
    background: "var(--text,#1a1916)",
    color: "#fff",
    borderColor: "var(--text,#1a1916)",
  },
  summary: {
    background: "var(--surface-2,#f9f8f5)",
    border: "1px solid var(--border,#e2e0d8)",
    borderRadius: "var(--radius,10px)",
    padding: "16px 18px",
  },
  summaryTitle: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.08em",
    color: "var(--text-3,#9e9b8e)",
    textTransform: "uppercase",
    marginBottom: 12,
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    gap: "6px 16px",
  },
  summaryKey: {
    fontSize: 12,
    color: "var(--text-3,#9e9b8e)",
    fontWeight: 500,
  },
  summaryVal: {
    fontSize: 12,
    color: "var(--text,#1a1916)",
    fontWeight: 600,
  },
  apiErr: {
    marginBottom: 16,
    padding: "10px 14px",
    background: "var(--red-bg,#fef2f0)",
    border: "1px solid var(--red,#d94f3d)",
    borderRadius: "var(--radius,10px)",
    fontSize: 12,
    color: "var(--red,#d94f3d)",
  },
  nav: {
    display: "flex",
    gap: 10,
    justifyContent: "flex-end",
  },
  btnBack: {
    padding: "10px 20px",
    fontSize: 13,
    fontWeight: 600,
    background: "transparent",
    border: "1.5px solid var(--border,#e2e0d8)",
    borderRadius: "var(--radius,10px)",
    color: "var(--text-2,#5c5a4e)",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  btnNext: {
    padding: "10px 24px",
    fontSize: 13,
    fontWeight: 700,
    background: "var(--text,#1a1916)",
    color: "#fff",
    border: "none",
    borderRadius: "var(--radius,10px)",
    cursor: "pointer",
    fontFamily: "inherit",
    letterSpacing: "0.01em",
  },
  footNote: {
    marginTop: 24,
    textAlign: "center",
    fontSize: 11,
    color: "var(--text-3,#9e9b8e)",
  },
  centred: {
    minHeight: "calc(100vh - 57px)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    textAlign: "center",
  },
  spinner: {
    width: 32,
    height: 32,
    border: "2.5px solid var(--border,#e2e0d8)",
    borderTopColor: "var(--text,#1a1916)",
    borderRadius: "50%",
    animation: "spin 0.7s linear infinite",
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: "50%",
    border: "2px solid var(--text,#1a1916)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "var(--text,#1a1916)",
    marginBottom: 8,
  },
  errorSub: {
    fontSize: 13,
    color: "var(--text-3,#9e9b8e)",
    maxWidth: 320,
    lineHeight: 1.7,
  },
};