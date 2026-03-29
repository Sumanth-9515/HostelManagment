import React, { useState, useEffect } from "react";
import { useNavigate, NavLink } from "react-router-dom";
import { clearSession } from "./ui.jsx";

// Icons (Simple SVGs)
const Icons = {
  Overview: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>,
  Users: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>,
  Logins: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>,
  Menu: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>,
  Close: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>,
  ChevronLeft: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>,
  ChevronRight: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
};

const NAV = [
  { to: "/master/dashboard", label: "Overview", icon: <Icons.Overview /> },
  { to: "/master/users",     label: "Users",    icon: <Icons.Users />    },
  { to: "/master/logins",    label: "Logins",   icon: <Icons.Logins />   }
];

export default function MasterLayout({ children }) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(window.innerWidth > 1024);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile && window.innerWidth > 1024) setIsOpen(true);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleLogout = () => {
    clearSession();
    navigate("/login");
  };

  // Sidebar width logic
  const desktopWidth = isOpen ? "240px" : "70px";
  const sidebarWidth = isMobile ? "280px" : desktopWidth;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", minHeight: "100vh", background: "var(--bg)" }}>
      
      {/* 1. MOBILE TOP NAVBAR (The "Under Layout" for the icon) */}
      {isMobile && (
        <header style={{
          width: "100%", height: "60px", background: "var(--surface)",
          borderBottom: "1px solid var(--border)", display: "flex",
          alignItems: "center", padding: "0 16px", position: "sticky", top: 0, zIndex: 100
        }}>
          <button 
            onClick={() => setIsOpen(true)}
            style={{ 
              background: "none", border: "none", color: "var(--text)", 
              cursor: "pointer", padding: "4px", display: "flex", alignItems: "center" 
            }}
          >
            <Icons.Menu />
          </button>
          <div style={{ marginLeft: "16px", fontSize: 14, fontWeight: 700, letterSpacing: "0.05em" }}>
            HOSTELIQ
          </div>
        </header>
      )}

      {/* 2. SIDEBAR */}
      <aside style={{
        width: sidebarWidth,
        flexShrink: 0,
        background: "var(--surface)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        position: isMobile ? "fixed" : "sticky",
        top: 0,
        left: 0,
        height: "100vh",
        zIndex: 110,
        transition: "transform 0.3s ease, width 0.3s ease",
        transform: isMobile && !isOpen ? "translateX(-100%)" : "translateX(0)",
        padding: "20px 12px"
      }}>
        
        {/* Sidebar Header (Logo + Close/Collapse Button) */}
        <div style={{ 
          display: "flex", alignItems: "center", justifyContent: "space-between", 
          marginBottom: 30, padding: "0 8px", minHeight: "40px" 
        }}>
          {(isOpen || isMobile) && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em" }}>HOSTELIQ</div>
              <div style={{ fontSize: 9, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase" }}>Master Admin</div>
            </div>
          )}

          {/* Close button for Mobile / Collapse button for Laptop */}
          <button 
            onClick={() => setIsOpen(!isOpen)}
            style={{ 
              background: "var(--surface-2)", border: "none", borderRadius: "6px",
              width: "28px", height: "28px", display: "flex", alignItems: "center", 
              justifyContent: "center", cursor: "pointer", color: "var(--text-2)"
            }}
          >
            {isMobile ? <Icons.Close /> : (isOpen ? <Icons.ChevronLeft /> : <Icons.ChevronRight />)}
          </button>
        </div>

        {/* Nav links */}
        <nav style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
          {NAV.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              title={!isOpen && !isMobile ? label : ""}
              style={({ isActive }) => ({
                display: "flex", alignItems: "center", gap: "12px",
                padding: "10px", borderRadius: "var(--radius)",
                fontSize: 13, fontWeight: isActive ? 600 : 400,
                color: isActive ? "var(--text)" : "var(--text-2)",
                background: isActive ? "var(--surface-2)" : "transparent",
                textDecoration: "none", transition: "all 0.12s",
                justifyContent: (isOpen || isMobile) ? "flex-start" : "center",
              })}
            >
              <span style={{ display: "flex", flexShrink: 0 }}>{icon}</span>
              {(isOpen || isMobile) && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Logout Section */}
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          <button
            onClick={handleLogout}
            style={{
              width: "100%", padding: "10px", borderRadius: "var(--radius)",
              background: "transparent", border: "1px solid var(--border)",
              fontSize: 12, color: "var(--text-3)", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: (isOpen || isMobile) ? "flex-start" : "center",
              gap: "10px", fontFamily: "inherit"
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            {(isOpen || isMobile) && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      {/* 3. MOBILE OVERLAY */}
      {isMobile && isOpen && (
        <div 
          onClick={() => setIsOpen(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", 
            backdropFilter: "blur(2px)", zIndex: 105
          }}
        />
      )}

      {/* 4. MAIN CONTENT */}
      <main style={{ 
        flex: 1, 
        minWidth: isMobile ? "100%" : "0", // Ensures content doesn't push sidebar
        padding: isMobile ? "24px 20px" : "40px 36px", 
        overflow: "auto" 
      }}>
        {children}
      </main>
    </div>
  );
}