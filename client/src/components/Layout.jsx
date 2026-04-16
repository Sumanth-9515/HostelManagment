import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, NavLink } from "react-router-dom";
import { clearSession, getSession } from "./ui.jsx";
import { API, authHeaders } from "../api.js";
import {
  LayoutDashboard,
  Eye,
  Building2,
  UserPlus,
  ReceiptIndianRupee,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Users,
  Bell,
  Volume2,
  User,
  Pencil,
  Check,
  AlertCircle,
  EyeOff,
  Mail ,
  History ,
  // UserPlus ,
  
} from "lucide-react";

const NAV = [
  { to: "/dashboard",          label: "Dashboard",           icon: <LayoutDashboard size={20} /> },
  { to: "/rent-management",    label: "Rent Management",     icon: <ReceiptIndianRupee size={20} /> },
  { to: "/addcandidate",       label: "Add Candidate",       icon: <UserPlus size={20} /> },
  { to: "/candidates",         label: "Total Candidates",    icon: <Users size={20} /> },
  { to: "/addhostel",          label: "Property Management", icon: <Building2 size={20} /> },
  { to: "/overview",           label: "Buildings Overview",  icon: <Eye size={20} /> },
{ to: "/onboarding-manager", label: "Onboarding Manager", icon: <UserPlus size={20} /> },
  { to: "/activity-logs",      label: "Activity Logs",       icon: <History size={20} />  },
  { 
  to: "/automail-settings",   
  label: "AutoMail Settings",   
  icon: <Mail size={20} /> 
}
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const BACKEND_URL   = API.replace(/\/api.*$/, "");
const LAST_SEEN_KEY = "hosteliq_notif_last_seen";

const docUrl = (src) => {
  if (!src) return null;
  if (src.startsWith("http")) return src;
  return `${BACKEND_URL}${src}`;
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : "—";

// ─── Shared keyframe styles ───────────────────────────────────────────────────
const GLOBAL_STYLES = `
  @keyframes notif-slide {
    from { opacity:0; transform:translateY(8px) scale(0.97); }
    to   { opacity:1; transform:translateY(0)   scale(1); }
  }
  @keyframes bell-pop {
    0%  { transform: scale(0); }
    60% { transform: scale(1.3); }
    100%{ transform: scale(1); }
  }
  @keyframes profile-in {
    from { opacity:0; transform:translateY(20px) scale(0.96); }
    to   { opacity:1; transform:translateY(0) scale(1); }
  }
  .notif-item:hover { background: #f8fafc !important; cursor: default; }
  .notif-scrollable::-webkit-scrollbar { width: 4px; }
  .notif-scrollable::-webkit-scrollbar-track { background: transparent; }
  .notif-scrollable::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
  .profile-scrollable::-webkit-scrollbar { width: 5px; }
  .profile-scrollable::-webkit-scrollbar-track { background: transparent; }
  .profile-scrollable::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
`;

// ═════════════════════════════════════════════════════════════════════════════
// ─── Profile Modal ────────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
function ProfileModal({ onClose, onProfileUpdated }) {
  const [profile, setProfile]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [fetchErr, setFetchErr] = useState("");
  const [editMode, setEditMode] = useState(false);

  // Edit form fields
  const [form, setForm]       = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [saveErr, setSaveErr] = useState("");
  const [saveOk, setSaveOk]   = useState(false);

  // Fetch profile from DB
  const loadProfile = useCallback(async () => {
    setLoading(true); setFetchErr("");
    try {
      const res = await fetch(`${API}/profile`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) { setFetchErr(data.message || "Failed to load profile."); return; }
      setProfile(data);
      setForm({
        name:     data.name    || "",
        owner:    data.owner   || "",
        email:    data.email   || "",
        ph:       data.ph      || "",
        address:  data.address || "",
        password: "",
      });
    } catch {
      setFetchErr("Network error. Could not load profile.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  // Close on Escape
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const handleSave = async () => {
    setSaveErr(""); setSaveOk(false);
    if (!form.name.trim() || !form.owner.trim() || !form.email.trim() || !form.ph.trim() || !form.address.trim()) {
      setSaveErr("Name, owner, email, phone, and address are required.");
      return;
    }
    setSaving(true);
    try {
      const body = {
        name:    form.name.trim(),
        owner:   form.owner.trim(),
        email:   form.email.trim(),
        ph:      form.ph.trim(),
        address: form.address.trim(),
      };
      if (form.password.trim()) body.password = form.password.trim();

      const res  = await fetch(`${API}/profile`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setSaveErr(data.message || "Update failed."); return; }
      setProfile(data.user);
      setSaveOk(true);
      setEditMode(false);
      setForm(f => ({ ...f, password: "" }));
      if (onProfileUpdated) onProfileUpdated(data.user);
    } catch {
      setSaveErr("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const planStatusColor = {
    active:  { bg: "#ecfdf5", color: "#059669", border: "#bbf7d0" },
    expired: { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
    none:    { bg: "#f1f5f9", color: "#64748b", border: "#e2e8f0" },
  };
  const psc = planStatusColor[profile?.planStatus] || planStatusColor.none;

  const loginStatusColor = {
    active:  { bg: "#ecfdf5", color: "#059669" },
    blocked: { bg: "#fef2f2", color: "#dc2626" },
    pending: { bg: "#fffbeb", color: "#d97706" },
  };
  const lsc = loginStatusColor[profile?.loginStatus] || loginStatusColor.active;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(15,23,42,0.5)",
        backdropFilter: "blur(6px)",
        zIndex: 9998,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px",
      }}
    >
      <style>{GLOBAL_STYLES}</style>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 24,
          width: "100%",
          maxWidth: 560,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 32px 80px rgba(0,0,0,0.22), 0 6px 24px rgba(0,0,0,0.1)",
          animation: "profile-in 0.25s cubic-bezier(0.34,1.56,0.64,1)",
          overflow: "hidden",
        }}
      >
        {/* ── Top Banner / Avatar area ── */}
        <div style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 60%, #1e40af 100%)",
          padding: "28px 24px 20px",
          position: "relative",
          flexShrink: 0,
        }}>
          {/* Close btn */}
          <button
            onClick={onClose}
            style={{
              position: "absolute", top: 16, right: 16,
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: "50%", width: 34, height: 34,
              color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.22)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.12)"}
          >✕</button>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* Avatar circle */}
            <div style={{
              width: 64, height: 64, borderRadius: "50%",
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 26, fontWeight: 800, color: "#fff",
              border: "3px solid rgba(255,255,255,0.25)",
              flexShrink: 0,
              boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
            }}>
              {profile?.name?.charAt(0)?.toUpperCase() || "?"}
            </div>

            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em" }}>
                {profile?.name || "Loading..."}
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>
                {profile?.email || ""}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                {profile?.planStatus && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "3px 10px",
                    borderRadius: 99, background: psc.bg, color: psc.color,
                    border: `1px solid ${psc.border}`,
                  }}>
                    {profile.planStatus === "active" ? "✅" : profile.planStatus === "expired" ? "⛔" : "📋"} Plan {profile.planStatus}
                  </span>
                )}
                {profile?.loginStatus && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "3px 10px",
                    borderRadius: 99, background: lsc.bg, color: lsc.color,
                    border: `1px solid ${lsc.color}22`,
                  }}>
                    Login: {profile.loginStatus}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Edit / Cancel toggle */}
          {!loading && !fetchErr && (
            <button
              onClick={() => { setEditMode(v => !v); setSaveErr(""); setSaveOk(false); }}
              style={{
                position: "absolute", bottom: 16, right: 20,
                background: editMode ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.12)",
                border: `1px solid ${editMode ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.2)"}`,
                borderRadius: 8, padding: "6px 14px",
                color: editMode ? "#fca5a5" : "#fff",
                fontSize: 12, fontWeight: 600, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
                transition: "all 0.18s",
              }}
            >
              {editMode ? <><X size={13} /> Cancel Edit</> : <><Pencil size={13} /> Edit Profile</>}
            </button>
          )}
        </div>

        {/* ── Body ── */}
        <div
          className="profile-scrollable"
          style={{ overflowY: "auto", flex: 1, padding: "20px 24px 24px" }}
        >
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{
                width: 36, height: 36, border: "3px solid #e2e8f0",
                borderTopColor: "#6366f1", borderRadius: "50%",
                animation: "notif-slide 0.8s linear infinite",
                margin: "0 auto 12px",
              }} />
              <div style={{ color: "#94a3b8", fontSize: 13 }}>Loading profile...</div>
            </div>
          ) : fetchErr ? (
            <div style={{
              background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12,
              padding: "14px 16px", color: "#dc2626", fontSize: 13,
              display: "flex", gap: 8, alignItems: "center",
            }}>
              <AlertCircle size={16} /> {fetchErr}
            </div>
          ) : editMode ? (
            /* ──────────── EDIT MODE ──────────── */
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>
                ✏️ Edit Your Profile
              </div>

              {[
                { label: "Full Name",     field: "name",    type: "text",     placeholder: "Your full name" },
                { label: "Owner / Brand", field: "owner",   type: "text",     placeholder: "Hostel / brand name" },
                { label: "Email",         field: "email",   type: "email",    placeholder: "you@example.com" },
                { label: "Phone Number",  field: "ph",      type: "tel",      placeholder: "+91 XXXXX XXXXX" },
                { label: "Address",       field: "address", type: "textarea", placeholder: "Full address" },
{ label: "New Password",  field: "password", type: showPassword ? "text" : "password", placeholder: "Leave blank to keep unchanged" },
              ].map(({ label, field, type, placeholder }) => (
                <div key={field} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {label}
                  </label>
                  {type === "textarea" ? (
                    <textarea
                      rows={3}
                      value={form[field]}
                      onChange={(e) => setForm(f => ({ ...f, [field]: e.target.value }))}
                      placeholder={placeholder}
                      style={{
                        border: "1.5px solid #e2e8f0", borderRadius: 10,
                        padding: "10px 13px", fontSize: 13, color: "#1e293b",
                        fontFamily: "inherit", resize: "vertical",
                        background: "#fafafa", transition: "border-color 0.2s",
                        outline: "none",
                      }}
                      onFocus={(e) => e.target.style.borderColor = "#6366f1"}
                      onBlur={(e) => e.target.style.borderColor = "#e2e8f0"}
                    />
                  ) : (
                  <div style={{ position: "relative" }}>
  <input
    type={type}
    value={form[field]}
    onChange={(e) => setForm(f => ({ ...f, [field]: e.target.value }))}
    placeholder={placeholder}
    style={{
      border: "1.5px solid #e2e8f0",
      borderRadius: 10,
      padding: "10px 40px 10px 13px",
      fontSize: 13,
      color: "#1e293b",
      fontFamily: "inherit",
      background: "#fafafa",
      transition: "border-color 0.2s",
      outline: "none",
      width: "100%"
    }}
  />

  {field === "password" && (
    <button
      type="button"
      onClick={() => setShowPassword(!showPassword)}
      style={{
        position: "absolute",
        right: 10,
        top: "50%",
        transform: "translateY(-50%)",
        background: "none",
        border: "none",
        cursor: "pointer",
        color: "#64748b"
      }}
    >
      {showPassword ? <Eye size={16}/> : <EyeOff size={16}/>}
    </button>
  )}
</div>
                  )}
                </div>
              ))}

              {saveErr && (
                <div style={{
                  background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10,
                  padding: "10px 14px", color: "#dc2626", fontSize: 12,
                  display: "flex", gap: 7, alignItems: "center",
                }}>
                  <AlertCircle size={14} /> {saveErr}
                </div>
              )}

              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  background: saving ? "#a5b4fc" : "linear-gradient(135deg,#6366f1,#4f46e5)",
                  border: "none", borderRadius: 12,
                  padding: "12px 0", color: "#fff",
                  fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  transition: "all 0.18s",
                  boxShadow: "0 4px 14px rgba(99,102,241,0.35)",
                }}
              >
                {saving ? (
                  <>
                    <span style={{
                      width: 14, height: 14, border: "2px solid rgba(255,255,255,0.4)",
                      borderTopColor: "#fff", borderRadius: "50%",
                      animation: "notif-slide 0.7s linear infinite",
                      display: "inline-block",
                    }} />
                    Saving...
                  </>
                ) : (
                  <><Check size={15} /> Save Changes</>
                )}
              </button>
            </div>
          ) : (
            /* ──────────── VIEW MODE ──────────── */
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

              {/* ── Personal Info ── */}
              <section>
                <div style={{
                  fontSize: 10, fontWeight: 700, color: "#94a3b8",
                  textTransform: "uppercase", letterSpacing: "0.08em",
                  marginBottom: 12,
                }}>👤 Personal Info</div>
                <div style={{
                  background: "#f8fafc", borderRadius: 14,
                  border: "1px solid #e2e8f0", overflow: "hidden",
                }}>
                  {[
                    { label: "Name",         value: profile?.name },
                    { label: "Owner / Brand",value: profile?.owner },
                    { label: "Email",        value: profile?.email },
                    { label: "Phone",        value: profile?.ph },
                    { label: "Address",      value: profile?.address },
                    { label: "Role",         value: profile?.role },
                  ].map(({ label, value }, i, arr) => (
                    <div key={label} style={{
                      display: "flex", alignItems: "flex-start",
                      padding: "11px 16px",
                      borderBottom: i < arr.length - 1 ? "1px solid #e2e8f0" : "none",
                      gap: 12,
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", width: 110, flexShrink: 0, paddingTop: 1 }}>
                        {label}
                      </div>
                      <div style={{ fontSize: 13, color: "#1e293b", fontWeight: 500, flex: 1, wordBreak: "break-word" }}>
                        {value || "—"}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* ── Account Status ── */}
              <section>
                <div style={{
                  fontSize: 10, fontWeight: 700, color: "#94a3b8",
                  textTransform: "uppercase", letterSpacing: "0.08em",
                  marginBottom: 12,
                }}>🔐 Account Status</div>
                <div style={{
                  background: "#f8fafc", borderRadius: 14,
                  border: "1px solid #e2e8f0", overflow: "hidden",
                }}>
                  {[
                    {
                      label: "Login Status",
                      value: (
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: "3px 10px",
                          borderRadius: 99, background: lsc.bg, color: lsc.color,
                        }}>
                          {profile?.loginStatus || "—"}
                        </span>
                      ),
                    },
                    {
                      label: "Used Free Plan",
                      value: profile?.usedFreePlan ? "✅ Yes" : "❌ No",
                    },
                  ].map(({ label, value }, i, arr) => (
                    <div key={label} style={{
                      display: "flex", alignItems: "center",
                      padding: "11px 16px",
                      borderBottom: i < arr.length - 1 ? "1px solid #e2e8f0" : "none",
                      gap: 12,
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", width: 110, flexShrink: 0 }}>
                        {label}
                      </div>
                      <div style={{ fontSize: 13, color: "#1e293b", fontWeight: 500 }}>
                        {value || "—"}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* ── Plan Details ── */}
              <section>
                <div style={{
                  fontSize: 10, fontWeight: 700, color: "#94a3b8",
                  textTransform: "uppercase", letterSpacing: "0.08em",
                  marginBottom: 12,
                }}>📋 Plan Details</div>
                <div style={{
                  background: "#f8fafc", borderRadius: 14,
                  border: "1px solid #e2e8f0", overflow: "hidden",
                }}>
                  {[
                    { label: "Plan Name",    value: profile?.planName || "—" },
                    {
                      label: "Plan Status",
                      value: (
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: "3px 10px",
                          borderRadius: 99, background: psc.bg, color: psc.color,
                          border: `1px solid ${psc.border}`,
                        }}>
                          {profile?.planStatus === "active" ? "✅ Active" : profile?.planStatus === "expired" ? "⛔ Expired" : "📋 None"}
                        </span>
                      ),
                    },
                    { label: "Plan Beds",    value: profile?.planBeds != null ? `🛏️ ${profile.planBeds} beds` : "—" },
                    { label: "Activated At", value: fmtDate(profile?.planActivatedAt) },
                    { label: "Expires At",   value: profile?.planExpiresAt
                        ? <span style={{ color: new Date(profile.planExpiresAt) < new Date() ? "#dc2626" : "#059669", fontWeight: 600 }}>
                            {fmtDate(profile.planExpiresAt)}
                          </span>
                        : "—"
                    },
                    { label: "Renewal At",   value: fmtDate(profile?.planRenewalAt) },
                    { label: "Price",        value: profile?.plan?.price != null ? `₹${Number(profile.plan.price).toLocaleString("en-IN")}` : "—" },
                    { label: "Duration",     value: profile?.plan?.days != null ? `${profile.plan.days} days` : "—" },
                  ].map(({ label, value }, i, arr) => (
                    <div key={label} style={{
                      display: "flex", alignItems: "center",
                      padding: "11px 16px",
                      borderBottom: i < arr.length - 1 ? "1px solid #e2e8f0" : "none",
                      gap: 12,
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", width: 110, flexShrink: 0 }}>
                        {label}
                      </div>
                      <div style={{ fontSize: 13, color: "#1e293b", fontWeight: 500 }}>
                        {value || "—"}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* ── Save OK toast ── */}
              {saveOk && (
                <div style={{
                  background: "#ecfdf5", border: "1px solid #bbf7d0", borderRadius: 10,
                  padding: "10px 14px", color: "#059669", fontSize: 12,
                  display: "flex", gap: 7, alignItems: "center", fontWeight: 600,
                }}>
                  <Check size={14} /> Profile updated successfully!
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Notification Dropdown Component ─────────────────────────────────────────
function NotificationDropdown({ notifications, unreadCount, onClose, anchorRef, isMobile, onCandidateClick }) {
  const dropRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (
        dropRef.current && !dropRef.current.contains(e.target) &&
        anchorRef.current && !anchorRef.current.contains(e.target)
      ) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose, anchorRef]);

  let posStyle;
  if (isMobile) {
    posStyle = { position: "fixed", top: 64, right: 12, left: "auto", width: "calc(100vw - 24px)", maxWidth: 380 };
  } else {
    const rect = anchorRef.current?.getBoundingClientRect();
    posStyle = {
      position: "fixed",
      bottom: rect ? (window.innerHeight - rect.bottom) : 20,
      left: rect ? rect.right + 12 : 260,
      width: 370,
    };
  }

  return (
    <div
      ref={dropRef}
      style={{
        ...posStyle,
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 16,
        boxShadow: "0 20px 60px rgba(0,0,0,0.14), 0 4px 20px rgba(0,0,0,0.08)",
        overflow: "hidden",
        zIndex: 9999,
        animation: "notif-slide 0.22s cubic-bezier(0.4,0,0.2,1)",
        maxHeight: "75vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <style>{GLOBAL_STYLES}</style>

      {/* Header */}
      <div style={{
        padding: "14px 16px 12px",
        borderBottom: "1px solid #e2e8f0",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "#fafbff", flexShrink: 0,
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a", display: "flex", alignItems: "center", gap: 7 }}>
            <Bell size={14} color="#6366f1" strokeWidth={2.5} />
            Onboarding Notifications
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
            {unreadCount > 0
              ? `${unreadCount} new candidate${unreadCount > 1 ? "s" : ""} registered via form`
              : "You're all caught up!"}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "#f1f5f9", border: "none", borderRadius: 8,
            width: 28, height: 28, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#64748b", fontSize: 14, fontWeight: 700, flexShrink: 0,
          }}
        >✕</button>
      </div>

      {/* Notification list */}
      <div className="notif-scrollable" style={{ overflowY: "auto", flex: 1 }}>
        {notifications.length === 0 ? (
          <div style={{ padding: "44px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>No submissions yet</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 5, lineHeight: 1.6 }}>
              Candidates who fill the onboarding<br />form will appear here automatically.
            </div>
          </div>
        ) : (
          notifications.map((t, i) => (
            <div
              key={t._id}
              className="notif-item"
              onClick={() => onCandidateClick(t.name)}
              style={{
                padding: "12px 16px",
                borderBottom: i < notifications.length - 1 ? "1px solid #f1f5f9" : "none",
                display: "flex", gap: 11, alignItems: "flex-start",
                background: t._isNew
                  ? "linear-gradient(90deg,rgba(99,102,241,0.07) 0%,rgba(99,102,241,0.01) 100%)"
                  : "#fff",
                transition: "background 0.15s",
                position: "relative",
                cursor: "pointer",
              }}
            >
              {t._isNew && (
                <div style={{
                  position: "absolute", top: 15, right: 14,
                  width: 8, height: 8, borderRadius: "50%",
                  background: "#6366f1",
                  boxShadow: "0 0 0 2.5px rgba(99,102,241,0.22)",
                }} />
              )}

              <div style={{
                width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontWeight: 700, fontSize: 15,
                overflow: "hidden",
                border: t._isNew ? "2.5px solid #6366f1" : "2px solid #e2e8f0",
                boxSizing: "border-box",
              }}>
                {t.documents?.passportPhoto
                  ? <img src={docUrl(t.documents.passportPhoto)} alt={t.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : t.name?.charAt(0).toUpperCase()
                }
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                  <span style={{
                    fontWeight: t._isNew ? 700 : 600,
                    fontSize: 13, color: "#0f172a",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {t.name}
                  </span>
                  {t._isNew && (
                    <span style={{
                      fontSize: 9, fontWeight: 800, letterSpacing: "0.06em",
                      background: "#16a34a", color: "#fff",
                      padding: "2px 6px", borderRadius: 99, flexShrink: 0,
                    }}>NEW</span>
                  )}
                </div>

                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>
                  📱 {t.phone}
                  {t.email && <span style={{ marginLeft: 5, color: "#94a3b8" }}>· {t.email}</span>}
                </div>

                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: "#4f46e5", background: "#eef2ff", padding: "2px 7px", borderRadius: 99 }}>
                    🗓 {t.joiningDate
                      ? new Date(t.joiningDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                      : "—"}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: "#065f46", background: "#d1fae5", padding: "2px 7px", borderRadius: 99 }}>
                    ₹{Number(t.rentAmount).toLocaleString("en-IN")}
                  </span>
                  {t.allocationInfo?.buildingName ? (
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#92400e", background: "#fef3c7", padding: "2px 7px", borderRadius: 99 }}>
                      🏠 {t.allocationInfo.buildingName}
                    </span>
                  ) : (
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#b45309", background: "#fff7ed", padding: "2px 7px", borderRadius: 99 }}>
                      ⏳ Unallocated
                    </span>
                  )}
                </div>
                <div
                  style={{ fontSize: 9, color: "#2563eb", marginTop: 6, cursor: "pointer", fontWeight: 600 }}
                  onClick={() => console.log("View details of:", t)}
                >
                  👉 View more details
                </div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 5 }}>
                  Filled via onboarding form · {timeAgo(t.createdAt)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {notifications.length > 0 && (
        <div style={{ padding: "10px 16px", borderTop: "1px solid #e2e8f0", background: "#fafbff", flexShrink: 0 }}>
          <a
            href="/onboarding-manager"
            onClick={onClose}
            style={{
              display: "block", textAlign: "center",
              fontSize: 12, fontWeight: 600, color: "#6366f1",
              textDecoration: "none", padding: "5px 0",
            }}
          >
            View all in Onboarding Manager →
          </a>
        </div>
      )}
    </div>
  );
}

// ─── Sidebar Bell Button ──────────────────────────────────────────────────────
function BellButton({ buttonRef, unreadCount, onClick, isOpen, collapsed }) {
  return (
    <button
      ref={buttonRef}
      onClick={onClick}
      title="Onboarding notifications"
      style={{
        position: "relative",
        background: isOpen ? "var(--surface-2,#f1f5f9)" : "transparent",
        border: "none",
        borderRadius: "var(--radius,8px)",
        cursor: "pointer",
        padding: "10px",
        color: isOpen ? "var(--text,#0f172a)" : "var(--text-2,#64748b)",
        display: "flex",
        alignItems: "center",
        justifyContent: collapsed ? "center" : "flex-start",
        width: "100%",
        gap: 12,
        transition: "all 0.2s",
      }}
      onMouseEnter={(e) => { if (!isOpen) e.currentTarget.style.background = "var(--surface-2,#f1f5f9)"; }}
      onMouseLeave={(e) => { if (!isOpen) e.currentTarget.style.background = "transparent"; }}
    >
      <span style={{ position: "relative", display: "flex", flexShrink: 0 }}>
        <Bell size={20} />
        {unreadCount > 0 && (
          <span style={{
            position: "absolute", top: -5, right: -5,
            minWidth: 16, height: 16, borderRadius: 99,
            background: "#ef4444", color: "#fff",
            fontSize: 9, fontWeight: 800,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "0 3px",
            border: "1.5px solid var(--surface,#fff)",
            animation: "bell-pop 0.4s cubic-bezier(0.34,1.56,0.64,1)",
          }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </span>
      {!collapsed && (
        <span style={{ fontSize: 13, fontWeight: 400, color: "var(--text-2,#64748b)", whiteSpace: "nowrap" }}>
          Onboarding Notifications
        </span>
      )}
    </button>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
export default function Layout({ children }) {
  const navigate  = useNavigate();
  const user      = getSession();

  const [isOpen,   setIsOpen]   = useState(window.innerWidth >= 768);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // ── Notification state ──────────────────────────────────────────────────────
  const [notifications, setNotifications] = useState([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [notifOpen,     setNotifOpen]     = useState(false);
  const bellRef = useRef(null);

  // ── Profile modal state ─────────────────────────────────────────────────────
  const [profileOpen, setProfileOpen] = useState(false);

  // Handle window resizing
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setIsOpen(false);
      else        setIsOpen(true);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ── Fetch notifications ─────────────────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(`${API}/tenants?source=onboarding-link`, {
        headers: authHeaders(),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data)) return;

      const lastSeen = (() => {
        try { return new Date(localStorage.getItem(LAST_SEEN_KEY) || 0).getTime(); }
        catch { return 0; }
      })();

      const enriched = data.map(t => ({
        ...t,
        _isNew: new Date(t.createdAt).getTime() > lastSeen,
      }));

      setNotifications(enriched);
      setUnreadCount(enriched.filter(t => t._isNew).length);
    } catch {
      // Layout must never crash due to notification fetch failure
    }
  }, []);

  useEffect(() => {
    if (!notifOpen) {
      fetchNotifications();
      const id = setInterval(fetchNotifications, 20000);
      return () => clearInterval(id);
    }
  }, [fetchNotifications, notifOpen]);

  // ── Mark all as read ────────────────────────────────────────────────────────
  const markAllRead = useCallback(async () => {
    try { localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString()); } catch {}
    setUnreadCount(0);
    try {
      await fetch(`${API}/tenants/mark-verified`, {
        method: "PATCH",
        headers: authHeaders(),
      });
    } catch { /* intentional */ }
  }, []);

  const handleBellClick = () => {
    const opening = !notifOpen;
    setNotifOpen(opening);
    if (opening && unreadCount > 0) markAllRead();
  };

  const handleCandidateClick = (candidateName) => {
    setNotifOpen(false);
    navigate("/candidates", { state: { candidateName } });
  };

  const handleLogout = () => {
    clearSession();
    navigate("/login");
  };

  const toggleSidebar = () => setIsOpen(v => !v);

  const desktopWidth = isOpen ? 240 : 70;
  const mobileWidth  = 260;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      <style>{GLOBAL_STYLES}</style>

      {/* ── MOBILE TOP BAR ─────────────────────────────────────────────────── */}
      {isMobile && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, height: 60,
          background: "var(--surface)", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", padding: "0 16px", zIndex: 100,
        }}>
          <button onClick={toggleSidebar} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text)" }}>
            <Menu size={24} />
          </button>
          <div style={{ marginLeft: 16, fontWeight: 700, fontSize: 14, letterSpacing: "0.05em", flex: 1 }}>
            Nilayam
          </div>
          <button
            ref={bellRef}
            onClick={handleBellClick}
            title="Onboarding notifications"
            style={{
              position: "relative",
              background: notifOpen ? "var(--surface-2,#f1f5f9)" : "transparent",
              border: "none", borderRadius: 8, cursor: "pointer", padding: "8px",
              color: notifOpen ? "var(--text,#0f172a)" : "var(--text-2,#64748b)",
              display: "flex", alignItems: "center",
            }}
          >
            <Bell size={22} />
            {unreadCount > 0 && (
              <span style={{
                position: "absolute", top: 4, right: 4,
                minWidth: 17, height: 17, borderRadius: 99,
                background: "#ef4444", color: "#fff",
                fontSize: 9, fontWeight: 800,
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: "0 3px",
                border: "1.5px solid var(--surface,#fff)",
                animation: "bell-pop 0.4s cubic-bezier(0.34,1.56,0.64,1)",
              }}>
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* ── MOBILE OVERLAY ─────────────────────────────────────────────────── */}
      {isMobile && isOpen && (
        <div
          onClick={toggleSidebar}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 101 }}
        />
      )}

      {/* ── SIDEBAR ────────────────────────────────────────────────────────── */}
      <aside style={{
        width: isMobile ? mobileWidth : desktopWidth,
        flexShrink: 0,
        background: "var(--surface)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        padding: "20px 12px",
        position: isMobile ? "fixed" : "sticky",
        top: 0,
        left: isMobile && !isOpen ? -mobileWidth : 0,
        height: "100vh",
        zIndex: 102,
        transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
        overflow: "hidden",
      }}>
        {/* Sidebar Header */}
        <div style={{
          display: "flex", alignItems: "center",
          justifyContent: isOpen ? "space-between" : "center",
          marginBottom: 32, padding: "0 8px",
        }}>
          {(isOpen || isMobile) && (
            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "0.08em", color: "var(--text)" }}>
              NILAYAM
            </div>
          )}
          <button
            onClick={toggleSidebar}
            style={{
              background: "var(--surface-2)", border: "none", borderRadius: "4px",
              cursor: "pointer", padding: "4px", color: "var(--text-2)",
              display: isMobile ? "block" : "flex",
            }}
          >
            {isMobile ? <X size={18} /> : (isOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />)}
          </button>
        </div>

        {/* Nav links */}
        <nav style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
          {NAV.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => isMobile && setIsOpen(false)}
              style={({ isActive }) => ({
                display: "flex", alignItems: "center",
                padding: "10px", borderRadius: "var(--radius)",
                fontSize: 13, fontWeight: isActive ? 600 : 400,
                color: isActive ? "var(--text)" : "var(--text-2)",
                background: isActive ? "var(--surface-2)" : "transparent",
                textDecoration: "none", transition: "all 0.2s",
                justifyContent: isOpen ? "flex-start" : "center",
                whiteSpace: "nowrap",
              })}
            >
              <span style={{ display: "flex", flexShrink: 0 }}>{icon}</span>
              {(isOpen || isMobile) && <span style={{ marginLeft: 12 }}>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Bell in sidebar — desktop only */}
        {!isMobile && (
          <>
            <div style={{ height: 1, background: "var(--border,#e2e8f0)", margin: "8px 0 4px" }} />
            <BellButton
              buttonRef={bellRef}
              unreadCount={unreadCount}
              onClick={handleBellClick}
              isOpen={notifOpen}
              collapsed={!isOpen}
            />
          </>
        )}

        {/* ── User + Profile click + Logout ──────────────────────────────── */}
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 8 }}>
          {user && (isOpen || isMobile) ? (
            /* Clickable profile row */
            <button
              onClick={() => setProfileOpen(true)}
              title="View / Edit your profile"
              style={{
                width: "100%",
                background: "var(--surface-2,#f8fafc)",
                border: "1px solid var(--border,#e2e8f0)",
                borderRadius: 10,
                padding: "10px 10px",
                marginBottom: 8,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 10,
                textAlign: "left",
                transition: "all 0.18s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#eff6ff";
                e.currentTarget.style.borderColor = "#bfdbfe";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "var(--surface-2,#f8fafc)";
                e.currentTarget.style.borderColor = "var(--border,#e2e8f0)";
              }}
            >
              {/* Mini avatar */}
              <div style={{
                width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontWeight: 700, fontSize: 13,
              }}>
                {user.owner?.charAt(0)?.toUpperCase() || user.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontWeight: 600, fontSize: 12,
                  color: "var(--text-2,#334155)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {user.owner || user.name}
                </div>
                <div style={{
                  fontSize: 10, color: "var(--text-3,#94a3b8)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  marginTop: 1,
                }}>
                  {user.email}
                </div>
              </div>
              <User size={14} style={{ color: "#94a3b8", flexShrink: 0 }} />
            </button>
          ) : user && !isOpen && !isMobile ? (
            /* Collapsed — just icon */
            <button
              onClick={() => setProfileOpen(true)}
              title="View / Edit your profile"
              style={{
                width: "100%", padding: "10px", marginBottom: 8,
                background: "transparent", border: "none",
                cursor: "pointer", display: "flex", justifyContent: "center",
                borderRadius: "var(--radius)",
                transition: "all 0.18s",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface-2,#f1f5f9)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontWeight: 700, fontSize: 13,
              }}>
                {user.owner?.charAt(0)?.toUpperCase() || user.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
            </button>
          ) : null}

          <button
            onClick={handleLogout}
            style={{
              width: "100%", padding: "10px", borderRadius: "var(--radius)",
              background: "transparent", border: isOpen ? "1px solid var(--border)" : "none",
              fontSize: 12, color: "var(--text-3)", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: isOpen ? "flex-start" : "center",
            }}
          >
            <LogOut size={18} />
            {(isOpen || isMobile) && <span style={{ marginLeft: 12 }}>Sign out</span>}
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ───────────────────────────────────────────────────── */}
      <main style={{
        flex: 1,
        padding: isMobile ? "80px 20px 40px" : "40px 36px",
        overflow: "auto",
        transition: "all 0.3s",
      }}>
        {children}
      </main>

      {/* ── NOTIFICATION DROPDOWN ──────────────────────────────────────────── */}
      {notifOpen && (
        <NotificationDropdown
          notifications={notifications}
          unreadCount={unreadCount}
          onClose={() => setNotifOpen(false)}
          anchorRef={bellRef}
          isMobile={isMobile}
          onCandidateClick={handleCandidateClick}
        />
      )}

      {/* ── PROFILE MODAL ──────────────────────────────────────────────────── */}
      {profileOpen && (
        <ProfileModal
          onClose={() => setProfileOpen(false)}
          onProfileUpdated={(updatedUser) => {
            // Optionally refresh session display — session store update can be wired here
            // if getSession/setSession supports it. For now the modal reflects DB truth.
          }}
        />
      )}
    </div>
  );
}