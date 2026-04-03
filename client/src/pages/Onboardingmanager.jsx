/**
 * OnboardingManager.jsx
 * Admin page — generate & share the onboarding link, and view candidates who registered via it.
 * Drop this into your existing dashboard routing.
 */

import { useState, useEffect } from "react";
import { API, authHeaders } from "../api.js";

// Backend base URL (e.g. "http://localhost:5000") — strips any trailing /api path
// so that /uploads/tenant-docs/xxx.jpg resolves correctly.
const BACKEND_URL = API.replace(/\/api.*$/, "");

// Resolve a document URL stored in DB:
//   - Cloudinary / external http(s) URL → use as-is
//   - Relative disk path "/uploads/..." → prepend backend origin
const docUrl = (src) => {
  if (!src) return null;
  if (src.startsWith("http")) return src;
  return `${BACKEND_URL}${src}`;
};

/* ─── tiny style helpers ────────────────────────────────────────── */
const card = {
  background: "#fff", borderRadius: 16,
  boxShadow: "0 2px 16px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)",
  padding: "24px",
};
const pill = (color, bg) => ({
  display: "inline-flex", alignItems: "center", gap: 5,
  padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700,
  color, background: bg, whiteSpace: "nowrap",
});

/* ─── Stat card ─────────────────────────────────────────────────── */
function StatCard({ icon, label, value, color }) {
  return (
    <div style={{
      ...card, display: "flex", alignItems: "center", gap: 16,
      borderLeft: `4px solid ${color}`,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12, fontSize: 20,
        background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>{value}</div>
        <div style={{ fontSize: 12, color: "#64748b", fontWeight: 500, marginTop: 1 }}>{label}</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
export default function OnboardingManager() {
  const [link,       setLink]       = useState("");
  const [linkLoading,setLinkLoading]= useState(false);
  const [copied,     setCopied]     = useState(false);
  const [tenants,    setTenants]    = useState([]);
  const [fetching,   setFetching]   = useState(true);
  const [search,     setSearch]     = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [qrVisible,  setQrVisible]  = useState(false);
  const [toast,      setToast]      = useState(null);

  /* ── Load candidates who registered via onboarding link ── */
  useEffect(() => {
    setFetching(true);
    fetch(`${API}/tenants?source=onboarding-link`, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => setTenants(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setFetching(false));
  }, []);

  /* ── Generate link ── */
/* ── Generate link ── */
const generateLink = async () => {
  setLinkLoading(true);
  try {
    const res  = await fetch(`${API}/tenants/generate-link`, { headers: authHeaders() });
    const data = await res.json();
    
    if (res.ok) {
      // --- FIX STARTS HERE ---
      // 1. Extract the token from the end of the link sent by the backend
      const token = data.link.split('/').pop(); 
      
      // 2. Create a dynamic link using the current website's URL
      // window.location.origin will be "http://localhost:5173" during dev
      // and "https://hostel-management-system-sk.netlify.app" in production
      const dynamicLink = `${window.location.origin}/tenant-register/${token}`;
      
      setLink(dynamicLink);
      // --- FIX ENDS HERE ---
    }
    else showToast(data.message || "Failed to generate link", "error");
  } catch {
    showToast("Connection error. Please try again.", "error");
  } finally {
    setLinkLoading(false);
  }
};

  /* ── Copy link ── */
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      showToast("Link copied to clipboard!", "success");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      showToast("Failed to copy. Please copy manually.", "error");
    }
  };

  /* ── Toast ── */
  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  /* ── Filtering ── */
  const filtered = tenants.filter(t => {
    const q = search.toLowerCase();
    const matchSearch =
      t.name?.toLowerCase().includes(q) ||
      t.phone?.includes(q) ||
      t.email?.toLowerCase().includes(q) ||
      t.allocationInfo?.buildingName?.toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total:    tenants.length,
    active:   tenants.filter(t => t.status === "Active").length,
    inactive: tenants.filter(t => t.status === "Inactive").length,
    allocated: tenants.filter(t => t.buildingId).length,
  };

  const qrUrl = link ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(link)}` : "";

  return (
    <div style={{
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      padding: "clamp(16px,4vw,32px)",
      maxWidth: 1100, margin: "0 auto",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        @keyframes om-fade { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes om-spin { to { transform: rotate(360deg); } }
        .om-row:hover { background: #f8fafc !important; }
        .om-copy-btn:hover { background: #4f46e5 !important; }
        .om-gen-btn:hover { opacity: 0.9 !important; transform: translateY(-1px) !important; }
      `}</style>

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 9999,
          padding: "12px 18px", borderRadius: 10,
          background: toast.type === "success" ? "#10b981" : "#ef4444",
          color: "#fff", fontSize: 13, fontWeight: 600,
          boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
          animation: "om-fade 0.3s ease",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          {toast.type === "success" ? "✓" : "⚠️"} {toast.msg}
        </div>
      )}

      {/* ── Page heading ── */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: "clamp(20px,4vw,26px)", fontWeight: 800, color: "#0f172a", margin: "0 0 4px" }}>
          🔗 Onboarding Manager
        </h1>
        <p style={{ fontSize: 13.5, color: "#64748b", margin: 0 }}>
          Generate a shareable form link and track candidates who self-registered.
        </p>
      </div>

      {/* ── Stats row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14, marginBottom: 26 }}>
        <StatCard icon="👥" label="Total via Link"  value={stats.total}    color="#6366f1" />
        <StatCard icon="✅" label="Active"          value={stats.active}   color="#10b981" />
        <StatCard icon="🏠" label="Room Allocated"  value={stats.allocated} color="#f59e0b" />
        <StatCard icon="🚪" label="Vacated"         value={stats.inactive}  color="#ef4444" />
      </div>

      {/* ── Link Generator card ── */}
      <div style={{ ...card, marginBottom: 24, borderTop: "4px solid #6366f1" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: "0 0 4px" }}>
              📋 Onboarding Form Link
            </h2>
            <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
              Share this link with prospective tenants. It's valid for 7 days.
            </p>
          </div>
          <button
            className="om-gen-btn"
            onClick={generateLink}
            disabled={linkLoading}
            style={{
              padding: "10px 20px", borderRadius: 10, border: "none",
              background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
              color: "#fff", fontSize: 13, fontWeight: 700,
              cursor: linkLoading ? "not-allowed" : "pointer",
              boxShadow: "0 4px 14px rgba(99,102,241,0.28)",
              display: "flex", alignItems: "center", gap: 8,
              transition: "transform 0.15s, opacity 0.15s",
              opacity: linkLoading ? 0.7 : 1,
              flexShrink: 0,
            }}
          >
            {linkLoading ? (
              <>
                <span style={{ width:14,height:14,border:"2px solid rgba(255,255,255,0.4)",
                  borderTop:"2px solid #fff",borderRadius:"50%",animation:"om-spin 0.6s linear infinite",display:"inline-block"
                }} />
                Generating…
              </>
            ) : (link ? "🔄 Regenerate" : "⚡ Generate Link")}
          </button>
        </div>

        {link ? (
          <>
            {/* Link display */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div style={{
                flex: 1, minWidth: 200, padding: "10px 14px",
                background: "#f8fafc", border: "1.5px solid #e2e8f0",
                borderRadius: 10, fontSize: 13, color: "#4f46e5",
                fontFamily: "monospace", wordBreak: "break-all",
                display: "flex", alignItems: "center",
              }}>
                {link}
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button
                  className="om-copy-btn"
                  onClick={copyLink}
                  style={{
                    padding: "10px 16px", borderRadius: 10, border: "none",
                    background: copied ? "#10b981" : "#6366f1",
                    color: "#fff", fontSize: 13, fontWeight: 700,
                    cursor: "pointer", transition: "background 0.2s",
                    display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  {copied ? "✓ Copied!" : "📋 Copy"}
                </button>
                <button
                  onClick={() => setQrVisible(v => !v)}
                  style={{
                    padding: "10px 14px", borderRadius: 10,
                    border: "1.5px solid #e2e8f0", background: "#fff",
                    color: "#475569", fontSize: 13, fontWeight: 600,
                    cursor: "pointer",
                  }}
                  title="Show QR code"
                >
                  {qrVisible ? "✕ QR" : "📷 QR"}
                </button>
                <a
                  href={link} target="_blank" rel="noreferrer"
                  style={{
                    padding: "10px 14px", borderRadius: 10,
                    border: "1.5px solid #e2e8f0", background: "#fff",
                    color: "#475569", fontSize: 13, fontWeight: 600,
                    cursor: "pointer", textDecoration: "none",
                    display: "flex", alignItems: "center", gap: 5,
                  }}
                  title="Preview form"
                >
                  🔗 Preview
                </a>
              </div>
            </div>

            {/* Info row */}
            <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
              <div style={{ ...pill("#92400e","#fef3c7") }}>⏳ Expires in 7 days</div>
              <div style={{ ...pill("#065f46","#d1fae5") }}>🔓 Public — no login needed</div>
              <div style={{ ...pill("#1e40af","#dbeafe") }}>🌐 Can be shared via WhatsApp / Email</div>
            </div>

            {/* QR code */}
            {qrVisible && (
              <div style={{
                marginTop: 18, padding: 18, background: "#f8fafc",
                borderRadius: 12, border: "1.5px solid #e2e8f0",
                display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 10,
                animation: "om-fade 0.3s ease",
              }}>
                <img src={qrUrl} alt="QR Code" width={160} height={160}
                  style={{ borderRadius: 8, display: "block" }} />
                <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>
                  Scan to open the onboarding form
                </span>
              </div>
            )}

            {/* Share tips */}
            <div style={{
              marginTop: 16, padding: "12px 16px",
              background: "linear-gradient(135deg,rgba(99,102,241,0.04),rgba(139,92,246,0.04))",
              border: "1px solid rgba(99,102,241,0.12)", borderRadius: 10,
              fontSize: 13, color: "#4f46e5", lineHeight: 1.6,
            }}>
              <strong>💡 How to share:</strong> Copy the link above and send it via WhatsApp, Email, or SMS. 
              Or show the QR code to the candidate for instant access.
            </div>
          </>
        ) : (
          <div style={{
            padding: 24, border: "2px dashed #c7d2fe", borderRadius: 12,
            textAlign: "center", color: "#94a3b8",
          }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔗</div>
            <p style={{ margin: 0, fontSize: 14 }}>Click "Generate Link" to create a shareable onboarding form URL.</p>
          </div>
        )}
      </div>

      {/* ── Candidates table card ── */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: "0 0 3px" }}>
              👤 Self-Registered Candidates
            </h2>
            <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
              Tenants who filled the onboarding form themselves.
            </p>
          </div>
          <span style={{ ...pill("#4f46e5","#eef2ff"), fontSize: 12, padding: "5px 12px" }}>
            {filtered.length} record{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
              color: "#94a3b8", pointerEvents: "none", fontSize: 15 }}>🔍</span>
            <input
              placeholder="Search by name, phone, building…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: "100%", padding: "9px 12px 9px 36px", borderRadius: 9,
                border: "1.5px solid #e2e8f0", fontSize: 13, outline: "none",
                fontFamily: "inherit", color: "#0f172a",
              }}
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{
              padding: "9px 14px", borderRadius: 9, border: "1.5px solid #e2e8f0",
              fontSize: 13, fontFamily: "inherit", color: "#0f172a",
              cursor: "pointer", background: "#fff", outline: "none",
            }}
          >
            <option value="all">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Vacated</option>
          </select>
        </div>

        {/* Table / list */}
        {fetching ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <div style={{ width: 32, height: 32, border: "3px solid #e2e8f0",
              borderTop: "3px solid #6366f1", borderRadius: "50%",
              animation: "om-spin 0.8s linear infinite", margin: "0 auto 12px" }} />
            <p style={{ color: "#94a3b8", fontSize: 14 }}>Loading candidates…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
            <h3 style={{ color: "#0f172a", fontSize: 16, margin: "0 0 6px" }}>No candidates yet</h3>
            <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>
              {tenants.length === 0
                ? "Share the onboarding link above and candidates will appear here once they register."
                : "No candidates match your current search / filter."}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                    {["Candidate","Phone / Email","Joining Date","Rent","Allocation","Status"].map(h => (
                      <th key={h} style={{
                        padding: "10px 14px", textAlign: "left", fontSize: 11,
                        fontWeight: 700, color: "#64748b", letterSpacing: "0.05em",
                        textTransform: "uppercase", whiteSpace: "nowrap",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t, i) => (
                    <tr
                      key={t._id}
                      className="om-row"
                      style={{
                        borderBottom: "1px solid #f1f5f9",
                        background: i % 2 === 0 ? "#fff" : "#fafbfc",
                        transition: "background 0.15s",
                        animation: `om-fade 0.3s ease ${i * 0.04}s both`,
                      }}
                    >
                      {/* Name + photo */}
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{
                            width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                            background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: "#fff", fontWeight: 700, fontSize: 13,
                            overflow: "hidden",
                          }}>
                            {t.documents?.passportPhoto
                              ? <img src={docUrl(t.documents.passportPhoto)} alt={t.name}
                                  style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              : t.name?.charAt(0).toUpperCase()
                            }
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: "#0f172a" }}>{t.name}</div>
                            {t.fatherName && (
                              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>
                                Father: {t.fatherName}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Phone / Email */}
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ color: "#0f172a", fontWeight: 500 }}>{t.phone}</div>
                        {t.email && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{t.email}</div>}
                      </td>

                      {/* Date */}
                      <td style={{ padding: "12px 14px", color: "#475569", whiteSpace: "nowrap" }}>
                        {t.joiningDate ? new Date(t.joiningDate).toLocaleDateString("en-IN", {
                          day: "2-digit", month: "short", year: "numeric"
                        }) : "—"}
                      </td>

                      {/* Rent */}
                      <td style={{ padding: "12px 14px", fontWeight: 600, color: "#0f172a" }}>
                        ₹{Number(t.rentAmount).toLocaleString("en-IN")}
                      </td>

                      {/* Allocation */}
                      <td style={{ padding: "12px 14px" }}>
                        {t.allocationInfo?.buildingName ? (
                          <div>
                            <div style={{ fontWeight: 600, color: "#0f172a", fontSize: 12 }}>
                              {t.allocationInfo.buildingName}
                            </div>
                            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>
                              Fl {t.allocationInfo.floorNumber} · Rm {t.allocationInfo.roomNumber} · Bed {t.allocationInfo.bedNumber}
                            </div>
                          </div>
                        ) : (
                          <span style={{ ...pill("#92400e","#fef3c7"), fontSize: 11 }}>Unallocated</span>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: "12px 14px" }}>
                        <span style={t.status === "Active"
                          ? pill("#065f46","#d1fae5")
                          : pill("#991b1b","#fee2e2")
                        }>
                          {t.status === "Active" ? "● Active" : "● Vacated"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Documents quick-view section */}
            <div style={{ marginTop: 24 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: "#64748b",
                textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 14 }}>
                Document Overview
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 12 }}>
                {filtered.map(t => {
                  const docs = [
                    { src: docUrl(t.documents?.passportPhoto), label: "Passport Photo", icon: "🖼️" },
                    { src: docUrl(t.documents?.aadharFront),   label: "Aadhar Front",   icon: "🪪" },
                    { src: docUrl(t.documents?.aadharBack),    label: "Aadhar Back",    icon: "🪪" },
                  ];
                  const allUploaded  = docs.every(d => !!d.src);
                  const noneUploaded = docs.every(d => !d.src);
                  return (
                    <div key={t._id + "-docs"} style={{
                      padding: 14, borderRadius: 12, background: "#fafbfc",
                      border: `1.5px solid ${allUploaded ? "#bbf7d0" : noneUploaded ? "#fecaca" : "#fde68a"}`,
                    }}>
                      {/* Header row */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                        <div style={{ fontWeight: 600, color: "#0f172a", fontSize: 13 }}>{t.name}</div>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
                          background: allUploaded ? "#d1fae5" : noneUploaded ? "#fee2e2" : "#fef3c7",
                          color: allUploaded ? "#065f46" : noneUploaded ? "#991b1b" : "#92400e",
                        }}>
                          {allUploaded ? "✓ All Docs" : noneUploaded ? "✗ No Docs" : "⚠ Partial"}
                        </span>
                      </div>
                      {/* Doc thumbnails */}
                      <div style={{ display: "flex", gap: 10 }}>
                        {docs.map(({ src, label, icon }) => (
                          <div key={label} style={{ textAlign: "center", flex: 1 }}>
                            {src ? (
                              <a href={src} target="_blank" rel="noreferrer">
                                <img src={src} alt={label} style={{
                                  width: "100%", maxWidth: 56, height: 52, objectFit: "cover",
                                  borderRadius: 8, border: "2px solid #10b981",
                                  display: "block", margin: "0 auto",
                                }} />
                              </a>
                            ) : (
                              <div style={{
                                width: "100%", maxWidth: 56, height: 52, margin: "0 auto",
                                borderRadius: 8, border: "2px dashed #e2e8f0",
                                background: "#f8fafc", display: "flex",
                                alignItems: "center", justifyContent: "center",
                                fontSize: 18, color: "#cbd5e1",
                              }}>{icon}</div>
                            )}
                            <span style={{
                              fontSize: 9, marginTop: 4, display: "block",
                              color: src ? "#10b981" : "#ef4444", fontWeight: 600,
                            }}>
                              {src ? "✓ " : "✗ "}{label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}