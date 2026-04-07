import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, NavLink } from "react-router-dom";
import { clearSession, getSession } from "./ui.jsx";
import { API, authHeaders } from "../api.js"; // same folder as ui.jsx — adjust if needed
// Import Icons
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
  Volume2  ,
} from "lucide-react";

const NAV = [
  { to: "/dashboard",          label: "Dashboard",           icon: <LayoutDashboard size={20} /> },
  { to: "/rent-management",    label: "Rent Management",     icon: <ReceiptIndianRupee size={20} /> },
  { to: "/addcandidate",       label: "Add Candidate",       icon: <UserPlus size={20} /> },
  { to: "/candidates",         label: "Total Candidates",    icon: <Users size={20} /> },
  { to: "/addhostel",          label: "Property Management", icon: <Building2 size={20} /> },
  { to: "/overview",           label: "Buildings Overview",            icon: <Eye size={20} /> },
  { to: "/onboarding-manager", label: "Onboarding Manager",  icon: <UserPlus size={20} /> },
  { to: "/activity-logs", label: "Activity Logs", icon: <Volume2 size={20} /> },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const BACKEND_URL   = API.replace(/\/api.*$/, "");
const LAST_SEEN_KEY = "hosteliq_notif_last_seen"; // localStorage key for unread tracking

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
  .notif-item:hover { background: #f8fafc !important; cursor: default; }
  .notif-scrollable::-webkit-scrollbar { width: 4px; }
  .notif-scrollable::-webkit-scrollbar-track { background: transparent; }
  .notif-scrollable::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
`;

// ─── Notification Dropdown Component ─────────────────────────────────────────
function NotificationDropdown({ notifications, unreadCount, onClose, anchorRef, isMobile, onCandidateClick }) {
  const dropRef = useRef(null);

  // Close when clicking outside
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

  // Dynamic position — mobile: below navbar right, desktop: right of sidebar bell opening UPWARDS
  let posStyle;
  if (isMobile) {
    posStyle = { position: "fixed", top: 64, right: 12, left: "auto", width: "calc(100vw - 24px)", maxWidth: 380 };
  } else {
    const rect = anchorRef.current?.getBoundingClientRect();
    posStyle = {
      position: "fixed",
      // Changed from top to bottom so it gracefully opens upwards from the bell and never cuts off
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
              {/* Unread indicator dot */}
              {t._isNew && (
                <div style={{
                  position: "absolute", top: 15, right: 14,
                  width: 8, height: 8, borderRadius: "50%",
                  background: "#6366f1",
                  boxShadow: "0 0 0 2.5px rgba(99,102,241,0.22)",
                }} />
              )}

              {/* Avatar */}
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
                  ? <img
                      src={docUrl(t.documents.passportPhoto)}
                      alt={t.name}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  : t.name?.charAt(0).toUpperCase()
                }
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Name + NEW badge */}
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

                {/* Phone · email */}
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>
                  📱 {t.phone}
                  {t.email && <span style={{ marginLeft: 5, color: "#94a3b8" }}>· {t.email}</span>}
                </div>

                {/* Info chips */}
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
                {/* View more details */}
<div
  style={{
    fontSize: 9,
    color: "#2563eb",
    marginTop: 6,
    cursor: "pointer",
    fontWeight: 600
  }}
  onClick={() => console.log("View details of:", t)}
>
  👉 View more details
</div>

                {/* Timestamp */}
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 5 }}>
                  Filled via onboarding form · {timeAgo(t.createdAt)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer link */}
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

  // ── Fetch using the EXISTING endpoint that already works ────────────────────
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(`${API}/tenants?source=onboarding-link`, {
        headers: authHeaders(),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data)) return;

      // Read last-seen timestamp from localStorage
      const lastSeen = (() => {
        try { return new Date(localStorage.getItem(LAST_SEEN_KEY) || 0).getTime(); }
        catch { return 0; }
      })();

      // Tag each candidate as new or seen
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

  // Poll every 20 s — gives near-real-time feel
  useEffect(() => {
    // Only fetch/poll when notification window is CLOSED.
    // This prevents background polls from erasing the "NEW" badges while the user is actively reading them.
    if (!notifOpen) {
      fetchNotifications();
      const id = setInterval(fetchNotifications, 20000);
      return () => clearInterval(id);
    }
  }, [fetchNotifications, notifOpen]);

  // ── Mark all as read ────────────────────────────────────────────────────────
  const markAllRead = useCallback(async () => {
    // PRIMARY: update localStorage timestamp — badge clears instantly
    try { localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString()); } catch {}
    
    // Clear unread bell count
    setUnreadCount(0); 
    
    // NOTE: We INTENTIONALLY DO NOT clear `_isNew` from `notifications` here!
    // This ensures that the "NEW" visual badge alongside the person's name 
    // STAYS VISIBLE while the user has the dropdown open to read who is new.

    // SECONDARY: also update isVerified in DB
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

          {/* Bell — right of mobile navbar */}
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
            <style>{GLOBAL_STYLES}</style>
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

        {/* User + Logout */}
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 8 }}>
          {user && (isOpen || isMobile) && (
            <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 10, padding: "0 8px" }}>
              <div style={{ fontWeight: 600, color: "var(--text-2)", marginBottom: 1 }}>{user.owner}</div>
              <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>
            </div>
          )}
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
    </div>
  );
}