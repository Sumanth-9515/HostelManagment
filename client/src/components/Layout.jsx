import React, { useState, useEffect } from "react";
import { useNavigate, NavLink } from "react-router-dom";
import { clearSession, getSession } from "./ui.jsx";
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
  ChevronRight
} from "lucide-react";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={20} /> },
  { to: "/rent-management", label: "Rent Management", icon: <ReceiptIndianRupee size={20} /> },
    { to: "/addcandidate", label: "Add Tenant", icon: <UserPlus size={20} /> },
  { to: "/addhostel", label: "Property Management", icon: <Building2 size={20} /> },
    { to: "/overview", label: "Overview", icon: <Eye size={20} /> },
    { to: "/onboarding-manager", label: "Onboarding Manager", icon: <UserPlus size={20} /> },
  
];

export default function Layout({ children }) {
  const navigate = useNavigate();
  const user = getSession();
  
const [isOpen, setIsOpen] = useState(window.innerWidth >= 768);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Handle window resizing
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setIsOpen(false); // Close by default on mobile
      else setIsOpen(true); // Open by default on desktop
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleLogout = () => {
    clearSession();
    navigate("/login");
  };

  const toggleSidebar = () => setIsOpen(!isOpen);

  // Sidebar Widths
  const desktopWidth = isOpen ? 240 : 70;
  const mobileWidth = 260;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      
      {/* MOBILE TOP BAR (Only visible on mobile) */}
      {isMobile && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, height: 60,
          background: "var(--surface)", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", padding: "0 16px", zIndex: 100
        }}>
          <button onClick={toggleSidebar} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text)" }}>
            <Menu size={24} />
          </button>
          <div style={{ marginLeft: 16, fontWeight: 700, fontSize: 14, letterSpacing: "0.05em" }}>HOSTELIQ</div>
        </div>
      )}

      {/* OVERLAY FOR MOBILE */}
      {isMobile && isOpen && (
        <div 
          onClick={toggleSidebar}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 101
          }}
        />
      )}

      {/* SIDEBAR */}
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
        left: isMobile && !isOpen ? -mobileWidth : 0, // Slide in/out on mobile
        height: "100vh",
        zIndex: 102,
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        overflow: "hidden"
      }}>
        {/* Sidebar Header */}
        <div style={{ 
          display: "flex", alignItems: "center", justifyContent: isOpen ? "space-between" : "center",
          marginBottom: 32, padding: "0 8px" 
        }}>
          {(isOpen || isMobile) && (
            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "0.08em", color: "var(--text)" }}>
              HOSTELIQ
            </div>
          )}
          <button 
            onClick={toggleSidebar}
            style={{ 
              background: "var(--surface-2)", border: "none", borderRadius: "4px", 
              cursor: "pointer", padding: "4px", color: "var(--text-2)",
              display: isMobile ? "block" : "flex"
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
                display: "flex",
                alignItems: "center",
                padding: "10px",
                borderRadius: "var(--radius)",
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? "var(--text)" : "var(--text-2)",
                background: isActive ? "var(--surface-2)" : "transparent",
                textDecoration: "none",
                transition: "all 0.2s",
                justifyContent: isOpen ? "flex-start" : "center",
                whiteSpace: "nowrap"
              })}
            >
              <span style={{ display: "flex", flexShrink: 0 }}>{icon}</span>
              {(isOpen || isMobile) && <span style={{ marginLeft: 12 }}>{label}</span>}
            </NavLink>
          ))}
        </nav>

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

      {/* Main content */}
      <main style={{ 
        flex: 1, 
        padding: isMobile ? "80px 20px 40px" : "40px 36px", 
        overflow: "auto",
        transition: "all 0.3s"
      }}>
        {children}
      </main>
    </div>
  );
}