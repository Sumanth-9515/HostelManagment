/**
 * AutoMailSettings.jsx  —  Admin UI for automatic email reminder configuration.
 */

import { useEffect, useState, useCallback } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const authHeader = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${sessionStorage.getItem("token")}`,
});

function fmtDateTime(d) {
  if (!d) return "Never run";
  return new Date(d).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatAMPM(timeStr) {
  if (!timeStr) return "00:00";
  const [h, m] = timeStr.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

function isToday(d) {
  if (!d) return false;
  const now  = new Date();
  const date = new Date(d);
  if (isNaN(date.getTime())) return false;
  return date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

function getMins(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

function ToggleBlock({ label, description, checked, onChange, count, badgeColor, color = "violet", time, onTimeChange, lastRun, disabled = false }) {
  const colors = {
    red:    { track: "bg-red-500",    dot: "bg-white" },
    amber:  { track: "bg-amber-500",  dot: "bg-white" },
    blue:   { track: "bg-blue-500",   dot: "bg-white" },
    violet: { track: "bg-violet-500", dot: "bg-white" },
  };
  const c = colors[color] || colors.violet;

  return (
    <div className={`rounded-2xl border transition-all duration-200 overflow-hidden ${checked ? "bg-white border-gray-300 shadow-sm" : "bg-gray-50 border-gray-100"}`}>
      <div className="flex items-center justify-between gap-4 p-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-gray-800">{label}</p>
            {count !== undefined && (
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black tracking-wide ${badgeColor || 'bg-gray-200 text-gray-700'}`}>
                {count} {count === 1 ? 'tenant' : 'tenants'}
              </span>
            )}
          </div>
          {description && <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{description}</p>}
        </div>
        <button
          type="button"
          role="switch"
          disabled={disabled}
          onClick={() => !disabled && onChange(!checked)}
          className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none shrink-0
            ${checked ? c.track : "bg-gray-300"}
            ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full ${c.dot} shadow transition-transform duration-200 ${checked ? "translate-x-6" : "translate-x-0"}`} />
        </button>
      </div>

      {checked && (
        <div className="bg-gray-50/80 px-4 py-3 border-t border-gray-100 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Set Time:</p>
            <input
              type="time"
              value={time}
              onChange={(e) => onTimeChange(e.target.value)}
              className="px-2 py-1.5 rounded-lg border border-gray-300 bg-white text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
            <span className="text-xs font-bold text-gray-700 bg-white px-2 py-1 rounded-md border shadow-sm">
              {formatAMPM(time)}
            </span>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Last Run</p>
            <p className="text-xs font-semibold text-gray-600">{fmtDateTime(lastRun)}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Toast({ msg, type = "success", onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 4000);
    return () => clearTimeout(t);
  }, [onDone]);

  const styles = {
    success: "bg-emerald-600 text-white",
    error:   "bg-red-600 text-white",
    info:    "bg-blue-600 text-white",
  };

  return (
    <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-2xl text-sm font-semibold flex items-center gap-2 transition-all animate-bounce ${styles[type]}`}>
      {type === "success" ? "✅" : type === "error" ? "❌" : "ℹ️"} {msg}
    </div>
  );
}

function TenantMailRow({ tenant, fallbackDate }) {
  const effectiveDate = tenant.lastMailSent || fallbackDate;
  const sentToday = isToday(effectiveDate);

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${sentToday ? "bg-emerald-50 border-emerald-200" : "bg-gray-50 border-gray-200"}`}>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-black text-base ${sentToday ? "bg-emerald-200 text-emerald-800" : "bg-gray-200 text-gray-600"}`}>
        {tenant.name?.[0]?.toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{tenant.name}</p>
        <p className="text-xs text-gray-400 truncate">{tenant.email || "No email"}</p>
      </div>
      <div className="shrink-0 text-right">
        {sentToday ? (
          <div>
            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500 text-white">✓ Sent Today</span>
            <p className="text-[10px] text-emerald-600 mt-1">{fmtDateTime(effectiveDate)}</p>
          </div>
        ) : (
          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-gray-200 text-gray-500">NOT SENT</span>
        )}
      </div>
    </div>
  );
}

export default function AutoMailSettings() {
  const [config, setConfig] = useState({
    isEnabled: false,
    sendArrears: false, sendOverdue: false, sendUpcoming: false,
    timeArrears: "09:00", timeOverdue: "10:00", timeUpcoming: "11:00",
    lastRunArrears: null, lastRunOverdue: null, lastRunUpcoming: null,
  });

  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [running, setRunning] = useState(false);
  const [toast,   setToast]   = useState(null); 

  const [classifiedTenants, setClassifiedTenants] = useState({ arrears: [], overdue: [], upcoming: [] });
  const [tLoading, setTLoading] = useState(false);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/auto-mail/config`, { headers: authHeader() });
      if (!res.ok) throw new Error("Failed to load config");
      const data = await res.json();
      setConfig({
        isEnabled:       data.isEnabled     ?? false,
        sendArrears:     data.sendArrears   ?? false,
        sendOverdue:     data.sendOverdue   ?? false,
        sendUpcoming:    data.sendUpcoming  ?? false,
        timeArrears:     data.timeArrears   || "09:00",
        timeOverdue:     data.timeOverdue   || "10:00",
        timeUpcoming:    data.timeUpcoming  || "11:00",
        lastRunArrears:  data.lastRunArrears  || null,
        lastRunOverdue:  data.lastRunOverdue  || null,
        lastRunUpcoming: data.lastRunUpcoming || null,
      });
    } catch (err) {
      setToast({ msg: err.message, type: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTenants = useCallback(async () => {
    setTLoading(true);
    try {
      const res = await fetch(`${API}/rent/all`, { headers: authHeader() });
      if (!res.ok) throw new Error("Failed to load tenants");
      const data = await res.json();

      const arr = [];
      const ovr = [];
      const upc = [];

      data.forEach((item) => {
        if (!item || item.totalAccumulatedDue <= 0 || !item.tenant) return;
        
        if (item.hasPreviousPending) {
          arr.push(item.tenant);
        } else if (item.isOverdue) {
          ovr.push(item.tenant);
        } else if (item.daysUntilDue !== null && item.daysUntilDue <= 5) {
          upc.push(item.tenant);
        }
      });

      setClassifiedTenants({ arrears: arr, overdue: ovr, upcoming: upc });
    } catch (err) {
      console.error(err);
    } finally {
      setTLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
    fetchTenants();
  }, [fetchConfig, fetchTenants]);

  function updateField(field, value) {
    setConfig((prev) => ({ ...prev, [field]: value }));
  }

  function validateTimes() {
    if (!config.isEnabled) return true;
    const active = [];
    if (config.sendArrears) active.push({ name: "Arrears", t: config.timeArrears });
    if (config.sendOverdue) active.push({ name: "Overdue", t: config.timeOverdue });
    if (config.sendUpcoming) active.push({ name: "Upcoming", t: config.timeUpcoming });

    for (let i = 0; i < active.length; i++) {
      if (!active[i].t) {
        setToast({ msg: `${active[i].name} requires a scheduled time.`, type: "error" });
        return false;
      }
      for (let j = i + 1; j < active.length; j++) {
        let diff = Math.abs(getMins(active[i].t) - getMins(active[j].t));
        if (diff > 12 * 60) diff = 24 * 60 - diff;
        if (diff < 30) {
          setToast({ msg: `Security risk: Keep at least a 30-min gap between ${active[i].name} & ${active[j].name}.`, type: "error" });
          return false;
        }
      }
    }
    return true;
  }

  async function handleSave() {
    if (!validateTimes()) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/auto-mail/config`, {
        method: "POST", headers: authHeader(), body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Save failed");
      setToast({ msg: "Settings saved successfully!", type: "success" });
    } catch (err) {
      setToast({ msg: err.message, type: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleRunNow() {
    setRunning(true);
    try {
      const res = await fetch(`${API}/auto-mail/run-now`, { method: "POST", headers: authHeader() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to run job");
      setToast({ msg: "Email jobs started! Mails will be sent in the background.", type: "info" });
      setTimeout(() => {
        fetchConfig();
        fetchTenants();
      }, 15000); 
    } catch (err) {
      setToast({ msg: err.message, type: "error" });
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
      </div>
    );
  }

  const RenderStatusGroup = ({ title, icon, colorClass, list, fallbackDate }) => {
    if (!list || list.length === 0) return null;
    return (
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className={`w-2 h-2 rounded-full ${colorClass}`} />
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
            {icon} {title} ({list.length})
          </p>
        </div>
        <div className="space-y-2">
          {list.map(t => <TenantMailRow key={t._id} tenant={t} fallbackDate={fallbackDate} />)}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-width-4xl mx-auto" style={{ maxWidth: "950px" }}>

        <div className="mb-8">
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">📧 Auto Email Setup</h1>
          <p className="text-gray-500 text-sm mt-1">Configure individual times and rules to automate tenant rent reminders.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Left Column (Settings) */}
          <div className="lg:col-span-5 space-y-5">

            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center text-violet-600 text-lg">⚡</div>
                <div><h2 className="text-base font-bold text-gray-800">Master Scheduler</h2></div>
              </div>
              <div className="bg-gray-50 p-4 rounded-2xl border flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold">Enable Automations</p>
                  <p className="text-xs text-gray-500 mt-1">Turn on/off entire system</p>
                </div>
                <button type="button" onClick={() => updateField("isEnabled", !config.isEnabled)} className={`relative w-12 h-6 rounded-full transition-colors ${config.isEnabled ? "bg-violet-500" : "bg-gray-300"}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${config.isEnabled ? "translate-x-6" : ""}`} />
                </button>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 text-lg">🔔</div>
                <div><h2 className="text-base font-bold text-gray-800">Reminder Policies</h2></div>
              </div>

              <div className="space-y-4">
                <ToggleBlock
                  label="🚨 Previous Arrears"
                  description="Tenants with past unpaid months"
                  count={classifiedTenants.arrears.length}
                  badgeColor="bg-red-100 text-red-700"
                  color="red"
                  checked={config.sendArrears}
                  onChange={(v) => updateField("sendArrears", v)}
                  time={config.timeArrears}
                  onTimeChange={(v) => updateField("timeArrears", v)}
                  lastRun={config.lastRunArrears}
                  disabled={!config.isEnabled}
                />

                <ToggleBlock
                  label="⚠️ Current Overdue"
                  description="Current month payment has crossed due date"
                  count={classifiedTenants.overdue.length}
                  badgeColor="bg-orange-100 text-orange-700"
                  color="amber"
                  checked={config.sendOverdue}
                  onChange={(v) => updateField("sendOverdue", v)}
                  time={config.timeOverdue}
                  onTimeChange={(v) => updateField("timeOverdue", v)}
                  lastRun={config.lastRunOverdue}
                  disabled={!config.isEnabled}
                />

                <ToggleBlock
                  label="📅 Upcoming / Due"
                  description="Rent is due today or in next 5 days"
                  count={classifiedTenants.upcoming.length}
                  badgeColor="bg-blue-100 text-blue-700"
                  color="blue"
                  checked={config.sendUpcoming}
                  onChange={(v) => updateField("sendUpcoming", v)}
                  time={config.timeUpcoming}
                  onTimeChange={(v) => updateField("timeUpcoming", v)}
                  lastRun={config.lastRunUpcoming}
                  disabled={!config.isEnabled}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={handleSave} disabled={saving} className="flex-1 py-3 rounded-2xl font-bold text-white bg-violet-600 hover:bg-violet-700 shadow-md">
                {saving ? "Saving…" : "💾 Save Changes"}
              </button>
              <button onClick={handleRunNow} disabled={running} className="flex-1 py-3 rounded-2xl font-bold text-white bg-amber-500 hover:bg-amber-600 shadow-md">
                {running ? "Executing…" : "▶ Run Immediately"}
              </button>
            </div>
          </div>

          {/* Right Column (Live Status) */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 min-h-full">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 text-lg">📬</div>
                  <div>
                    <h2 className="text-base font-bold text-gray-800">Targeted Mail Status</h2>
                    <p className="text-xs text-gray-400">Track which group received emails today</p>
                  </div>
                </div>
                <button onClick={() => { fetchConfig(); fetchTenants(); }} disabled={tLoading} className="text-xs font-bold text-violet-600 bg-violet-50 px-3 py-1.5 rounded-lg border border-violet-100 hover:bg-violet-100">
                  {tLoading ? "Syncing..." : "↻ Refresh"}
                </button>
              </div>

              {tLoading ? (
                <div className="space-y-4">
                  {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
                </div>
              ) : (
                <div className="space-y-2">
                  {!config.sendArrears && !config.sendOverdue && !config.sendUpcoming && (
                    <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed">
                      <p className="text-2xl mb-2">😴</p>
                      <p className="text-gray-500 text-sm font-semibold">No policies are active.</p>
                    </div>
                  )}

                  {config.sendArrears && <RenderStatusGroup title="Arrears Targets" icon="🚨" colorClass="bg-red-500" list={classifiedTenants.arrears} fallbackDate={config.lastRunArrears} />}
                  {config.sendOverdue && <RenderStatusGroup title="Overdue Targets" icon="⚠️" colorClass="bg-orange-500" list={classifiedTenants.overdue} fallbackDate={config.lastRunOverdue} />}
                  {config.sendUpcoming && <RenderStatusGroup title="Upcoming Targets" icon="📅" colorClass="bg-blue-500" list={classifiedTenants.upcoming} fallbackDate={config.lastRunUpcoming} />}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}