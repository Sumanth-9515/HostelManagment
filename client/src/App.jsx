import { Routes, Route, Navigate } from "react-router-dom";

// Regular pages
import LoginPage          from "./pages/LoginPage";
import RegisterPage       from "./pages/RegisterPage";
import Dashboard          from "./pages/Dashboard";
import AddHostel          from "./pages/Addhostel";
import AddCandidate       from "./pages/Addcandidate";
import Overview           from "./pages/Overview";

// Master pages
import MasterDashboard    from "./pages/master/MasterDashboard";
import MasterUsers        from "./pages/master/MasterUsers";

// ── NEW: public tenant self-registration page ─────────────────────────────
import TenantRegisterPage from "./pages/TenantRegisterPage.jsx";

// Layouts
import Layout             from "./components/Layout";
import MasterLayout       from "./components/MasterLayout";
import RentManagement from "./pages/Rentmanagement.jsx";
import ManageLogins from "./pages/master/Managelogins.jsx";
import TenantOnboardingForm from "./pages/Tenantonboardingform.jsx";
import OnboardingManager from "./pages/Onboardingmanager.jsx";
import CandidatesManagement from "./pages/Candidatesmanagement.jsx";
import ActivityLogs from "./pages/ActivityLogs.jsx";

// ── Auth guards ───────────────────────────────────────────────────────────────
function RequireUser({ children }) {
  const user  = JSON.parse(sessionStorage.getItem("user")  || "{}");
  const token = sessionStorage.getItem("token");
  if (!token || !user?.id)          return <Navigate to="/login"            replace />;
  if (user.role === "master")       return <Navigate to="/master/dashboard" replace />;
  return children;
}

function RequireMaster({ children }) {
  const user  = JSON.parse(sessionStorage.getItem("user")  || "{}");
  const token = sessionStorage.getItem("token");
  if (!token || !user?.id)          return <Navigate to="/login"     replace />;
  if (user.role !== "master")       return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* ── Public ─────────────────────────────────────────────────────── */}
      <Route path="/login"    element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/tenant-onboarding" element={<TenantOnboardingForm />} />
      {/* ── Tenant self-registration (no auth — uses link token in URL) ── */}
      {/* Owner shares: http://yourapp/tenant-register/<JWT>               */}
      <Route path="/tenant-register/:token" element={<TenantOnboardingForm />} />

      {/* ── Regular user routes wrapped in Layout ──────────────────────── */}
      <Route path="/dashboard" element={
        <RequireUser><Layout><Dashboard /></Layout></RequireUser>
      } />
      <Route path="/overview" element={
        <RequireUser><Layout><Overview /></Layout></RequireUser>
      } />
      <Route path="/addhostel" element={
        <RequireUser><Layout><AddHostel /></Layout></RequireUser>
      } />
      <Route path="/addcandidate" element={
        <RequireUser><Layout><AddCandidate /></Layout></RequireUser>
      } />
            <Route path="/candidates" element={
        <RequireUser><Layout><CandidatesManagement/></Layout></RequireUser>
      } />
    <Route path="/rent-management" element={
        <RequireUser><Layout><RentManagement/></Layout></RequireUser>
      } />
          <Route path="/onboarding-manager" element={
        <RequireUser><Layout><OnboardingManager/></Layout></RequireUser>
      } />
                <Route path="/activity-logs" element={
        <RequireUser><Layout><ActivityLogs/></Layout></RequireUser>
      } />

      {/* ── Master routes wrapped in MasterLayout ──────────────────────── */}
      <Route path="/master/dashboard" element={
        <RequireMaster><MasterLayout><MasterDashboard /></MasterLayout></RequireMaster>
      } />
      <Route path="/master/users" element={
        <RequireMaster><MasterLayout><MasterUsers /></MasterLayout></RequireMaster>
      } />
          <Route path="/master/logins" element={
        <RequireMaster><MasterLayout><ManageLogins /></MasterLayout></RequireMaster>
      } />

      {/* ── Fallback ───────────────────────────────────────────────────── */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}