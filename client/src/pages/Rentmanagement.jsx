import { useEffect, useState, useCallback, useRef } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const authHeader = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${sessionStorage.getItem("token")}`,
});

const fmt = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const fmtDateTime = (d) =>
  d
    ? new Date(d).toLocaleString("en-IN", {
        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : "—";
const fmtMonthYear = (d) =>
  d ? new Date(d).toLocaleString("en-IN", { month: "long", year: "numeric" }) : "—";

const statusColor = {
  Paid:    "bg-emerald-100 text-emerald-800 border-emerald-200",
  Partial: "bg-amber-100 text-amber-800 border-amber-200",
  Due:     "bg-rose-100 text-rose-800 border-rose-200",
};

const pill = (status) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${statusColor[status] || statusColor.Due}`}>
    {status}
  </span>
);

function buildPayable(pendingMonths = [], record = null, remaining = 0) {
  const arr = [];
  pendingMonths.forEach((pm) => {
    const rem = pm.rentAmount - pm.paidAmount;
    if (rem > 0) arr.push({ monthYear: pm.monthYear, maxAmount: rem, label: `${fmtMonthYear(pm.dueDate)} (Arrears)` });
  });
  if (record && remaining > 0)
    arr.push({ monthYear: record.monthYear, maxAmount: remaining, label: `${fmtMonthYear(record.dueDate)} (Current)` });
  return arr;
}

function buildWAMessage(tenant, record, buildingDetails) {
  const room = buildingDetails ? `Room ${buildingDetails.roomNumber}` : "your room";
  const remaining = record ? record.rentAmount - record.paidAmount : tenant.rentAmount;
  const month = record
    ? new Date(record.dueDate).toLocaleString("en-IN", { month: "long", year: "numeric" })
    : "this month";
  return encodeURIComponent(
    `Hello ${tenant.name},\n\nThis is a gentle reminder that your rent of ${fmt(remaining)} for ${month} (${room}) is due.\nPlease pay at the earliest.\n\nThank you!`
  );
}

// ─── Profile Image Popup ──────────────────────────────────────────────────────
function ProfileImagePopup({ imageUrl, name, onClose }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md" onClick={onClose}>
      <div className="relative flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-3 -right-3 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/40 text-white text-lg font-bold transition-colors z-10 border border-white/30">✕</button>
        <div className="w-64 h-64 sm:w-80 sm:h-80 rounded-full overflow-hidden border-4 border-white/30 shadow-2xl">
          <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
        </div>
        {name && <p className="text-white font-bold text-lg tracking-wide drop-shadow-lg">{name}</p>}
        <button onClick={() => window.open(imageUrl, "_blank")} className="text-white/70 hover:text-white text-xs font-semibold underline underline-offset-2 transition-colors">🔗 Open full size</button>
      </div>
    </div>
  );
}

// ─── Profile Avatar ───────────────────────────────────────────────────────────
function ProfileAvatar({ name, photoUrl, size = "md", hasPreviousPending = false, onClick }) {
  const sizes = { sm: "w-10 h-10 text-sm", md: "w-12 h-12 text-base", lg: "w-14 h-14 text-xl" };
  const ringColor = hasPreviousPending ? "border-rose-400" : "border-amber-300";
  return (
    <div
      onClick={onClick}
      title={photoUrl ? "Click to view profile photo" : undefined}
      className={`${sizes[size]} rounded-full flex items-center justify-center shrink-0 overflow-hidden border-2 ${ringColor} ${photoUrl ? "cursor-pointer hover:opacity-80 hover:scale-105 transition-all duration-150 shadow-md" : hasPreviousPending ? "bg-rose-100" : "bg-amber-100"}`}
    >
      {photoUrl ? (
        <img src={photoUrl} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span className={`font-black ${hasPreviousPending ? "text-rose-700" : "text-amber-700"}`}>
          {name?.[0]?.toUpperCase()}
        </span>
      )}
    </div>
  );
}

// ─── Email Reminder Button ────────────────────────────────────────────────────
function EmailReminderButton({ tenantId, tenantEmail, hasPreviousPending = false, pendingMonthsCount = 0, className = "" }) {
  const [state, setState] = useState("idle");
  const [errMsg, setErrMsg] = useState("");
  const timerRef = useRef(null);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const handleSend = async (e) => {
    e.stopPropagation();
    if (state === "sending" || state === "sent") return;
    setState("sending"); setErrMsg("");
    try {
      const r = await fetch(`${API}/rent/send-reminder`, {
        method: "POST", headers: authHeader(), body: JSON.stringify({ tenantId }),
      });
      if (!r.ok) throw new Error("Failed to send email.");
      setState("sent");
      timerRef.current = setTimeout(() => setState("idle"), 3000);
    } catch (err) {
      setErrMsg(err.message || "Error");
      setState("error");
      timerRef.current = setTimeout(() => { setState("idle"); setErrMsg(""); }, 3000);
    }
  };

  const baseClass = "flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold border transition-all duration-200 select-none";
  if (state === "sent")    return <button disabled className={`${baseClass} bg-emerald-50 border-emerald-200 text-emerald-700 ${className}`}>Sent ✓</button>;
  if (state === "error")   return <button onClick={handleSend} className={`${baseClass} bg-rose-50 border-rose-200 text-rose-700 ${className}`}>Failed</button>;
  if (state === "sending") return <button disabled className={`${baseClass} bg-violet-50 border-violet-200 text-violet-500 opacity-75 ${className}`}>Sending…</button>;

  const btnStyle = hasPreviousPending
    ? "bg-rose-50 hover:bg-rose-500 border-rose-300 text-rose-700 hover:text-white"
    : "bg-violet-50 hover:bg-violet-500 border-violet-200 text-violet-700 hover:text-white";
  return (
    <button onClick={handleSend} className={`${baseClass} ${btnStyle} ${className}`}>
      {hasPreviousPending ? "⚠️ Warn Email" : "✉️ Email"}
    </button>
  );
}

// ─── Document Viewer ──────────────────────────────────────────────────────────
function DocumentViewer({ imageUrl, onClose }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={onClose}>
      <div className="relative max-w-4xl max-h-[90vh] w-full" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-12 right-0 text-white hover:text-gray-300 text-2xl">✕</button>
        <button onClick={() => window.open(imageUrl, "_blank")} className="absolute -top-12 right-12 text-white hover:text-gray-300 text-sm bg-white/20 px-3 py-1 rounded-lg">🔗 Open in new tab</button>
        <img src={imageUrl} alt="Document" className="w-full h-full object-contain rounded-lg" />
      </div>
    </div>
  );
}

// ─── Due Card (unchanged) ─────────────────────────────────────────────────────
function DueCard({ item, onSelect, onPayNow }) {
  const { tenant, record, remaining, isOverdue, daysOverdue, daysUntilDue, pendingMonths, totalAccumulatedDue, hasPreviousPending, pendingMonthsCount } = item;
  const alloc = tenant.allocationInfo || {};
  const phone = tenant.phone?.replace(/\D/g, "");
  const payable = buildPayable(pendingMonths, record, remaining);
  const passportPhoto = tenant.documents?.passportPhoto;
  const [showProfilePopup, setShowProfilePopup] = useState(false);

  const handleWA = (e) => { e.stopPropagation(); window.open(`https://wa.me/91${phone}?text=${buildWAMessage(tenant, record, alloc)}`, "_blank"); };
  const handleCall = (e) => { e.stopPropagation(); window.location.href = `tel:${tenant.phone}`; };
  const handleAvatarClick = (e) => { e.stopPropagation(); if (passportPhoto) setShowProfilePopup(true); };

  return (
    <>
      <div onClick={() => onSelect(tenant._id)} className="relative group cursor-pointer rounded-2xl border border-gray-200 bg-white hover:border-amber-400 hover:shadow-md transition-all duration-200 overflow-hidden">
        {hasPreviousPending
          ? <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-600 via-rose-400 to-rose-600 animate-pulse" />
          : isOverdue
          ? <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-rose-400 to-rose-500" />
          : <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500" />}

        {hasPreviousPending && (
          <div className="absolute -top-2 -right-2 z-10">
            <span className="relative flex h-6 w-6">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-6 w-6 bg-rose-600 items-center justify-center shadow-lg">
                <span className="text-white text-[10px] font-black leading-none">{pendingMonthsCount}</span>
              </span>
            </span>
          </div>
        )}

        <div className="p-4 pt-5">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <ProfileAvatar name={tenant.name} photoUrl={passportPhoto} size="md" hasPreviousPending={hasPreviousPending} onClick={handleAvatarClick} />
              <div className="min-w-0">
                <p className="font-bold text-gray-900 text-base leading-tight truncate">{tenant.name}</p>
                <p className="text-gray-500 text-xs mt-0.5">{tenant.phone}</p>
              </div>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <button onClick={handleWA} className="w-8 h-8 flex items-center justify-center rounded-full bg-emerald-50 hover:bg-emerald-500 border border-emerald-200 transition-colors">📱</button>
              <button onClick={handleCall} className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-50 hover:bg-blue-500 border border-blue-200 transition-colors">📞</button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-3">
            {alloc.buildingName && <span className="text-[11px] px-2 py-0.5 rounded-md bg-gray-100 border border-gray-200 text-gray-600">🏢 {alloc.buildingName}</span>}
            {alloc.roomNumber   && <span className="text-[11px] px-2 py-0.5 rounded-md bg-gray-100 border border-gray-200 text-gray-600">🚪 Room {alloc.roomNumber}</span>}
          </div>

          <div className="flex items-end justify-between">
            <div>
              <p className="text-gray-400 text-[11px] uppercase tracking-wide">Total Accumulated Due</p>
              <p className={`text-2xl font-black ${hasPreviousPending ? "text-rose-600" : "text-gray-900"}`}>{fmt(totalAccumulatedDue)}</p>
            </div>
            <div className="text-right">
              {isOverdue
                ? <span className="text-rose-600 text-xs font-semibold bg-rose-50 px-2 py-1 rounded-lg border border-rose-200">⚠️ {daysOverdue}d overdue</span>
                : daysUntilDue !== null
                ? <span className="text-amber-600 text-xs font-semibold bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">🕐 Due in {daysUntilDue === 0 ? "today" : `${daysUntilDue}d`}</span>
                : null}
            </div>
          </div>

          {hasPreviousPending && pendingMonths.length > 0 && (
            <div className="mt-2 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 space-y-1">
              <p className="text-rose-600 text-[10px] uppercase tracking-wide font-semibold mb-1">Pending Months</p>
              {pendingMonths.slice(0, 3).map((pm) => (
                <div key={pm.monthYear} className="flex justify-between text-[11px]">
                  <span className="text-rose-700">{fmtMonthYear(pm.dueDate)}</span>
                  <span className="text-rose-700 font-bold">{fmt(pm.rentAmount - pm.paidAmount)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 flex gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); onPayNow(tenant._id, payable, payable[0]?.monthYear); }}
              disabled={payable.length === 0}
              className={`flex-1 py-2 rounded-xl font-bold text-sm text-white transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${hasPreviousPending ? "bg-rose-500 hover:bg-rose-600 active:scale-95" : "bg-amber-500 hover:bg-amber-600 active:scale-95"}`}
            >
              {hasPreviousPending ? "Pay Dues" : "Pay Now"}
            </button>
            <EmailReminderButton tenantId={tenant._id} tenantEmail={tenant.email} hasPreviousPending={hasPreviousPending} pendingMonthsCount={pendingMonthsCount} className="shrink-0 px-3" />
          </div>
        </div>
      </div>

      {showProfilePopup && passportPhoto && (
        <ProfileImagePopup imageUrl={passportPhoto} name={tenant.name} onClose={() => setShowProfilePopup(false)} />
      )}
    </>
  );
}

// ─── Room Allocator ───────────────────────────────────────────────────────────
function RoomAllocator({ currentAlloc, onSelect }) {
  const [buildings, setBuildings] = useState([]);
  const [selectedBuilding, setSelectedBuilding] = useState("");
  const [selectedFloor, setSelectedFloor] = useState("");
  const [selectedRoom, setSelectedRoom] = useState("");
  const [selectedBed, setSelectedBed] = useState("");
  const [loadingBuildings, setLoadingBuildings] = useState(true);

  const floors = buildings.find((b) => b._id === selectedBuilding)?.floors || [];
  const rooms  = floors.find((f) => f._id === selectedFloor)?.rooms || [];
  const beds   = rooms.find((r) => r._id === selectedRoom)?.beds.filter((b) => b.status === "Available") || [];

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API}/buildings`, { headers: authHeader() });
        const d = await r.json();
        setBuildings(Array.isArray(d) ? d : []);
      } catch {}
      setLoadingBuildings(false);
    })();
  }, []);

  useEffect(() => {
    if (!selectedBed || !selectedRoom || !selectedFloor || !selectedBuilding) return;
    const building = buildings.find((b) => b._id === selectedBuilding);
    const floor    = building?.floors.find((f) => f._id === selectedFloor);
    const room     = floor?.rooms.find((r) => r._id === selectedRoom);
    const bed      = room?.beds.find((b) => b._id === selectedBed);
    if (building && floor && room && bed) {
      onSelect({
        buildingId: building._id, floorId: floor._id, roomId: room._id, bedId: bed._id,
        allocationInfo: { buildingName: building.buildingName, floorNumber: floor.floorNumber, roomNumber: room.roomNumber, bedNumber: bed.bedNumber },
      });
    }
  }, [selectedBed]);

  const selectClass = "w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-amber-400 disabled:bg-gray-50 disabled:text-gray-400";

  if (loadingBuildings) return <div className="text-xs text-gray-400 animate-pulse py-2">Loading buildings…</div>;

  return (
    <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
      <p className="text-amber-700 text-xs font-semibold uppercase tracking-wide mb-1">Select New Bed</p>
      <div>
        <label className="text-gray-500 text-[11px] uppercase tracking-wide">Building</label>
        <select value={selectedBuilding} onChange={(e) => { setSelectedBuilding(e.target.value); setSelectedFloor(""); setSelectedRoom(""); setSelectedBed(""); onSelect(null); }} className={selectClass}>
          <option value="">— Choose Building —</option>
          {buildings.map((b) => <option key={b._id} value={b._id}>{b.buildingName}</option>)}
        </select>
      </div>
      <div>
        <label className="text-gray-500 text-[11px] uppercase tracking-wide">Floor</label>
        <select value={selectedFloor} onChange={(e) => { setSelectedFloor(e.target.value); setSelectedRoom(""); setSelectedBed(""); onSelect(null); }} disabled={!selectedBuilding} className={selectClass}>
          <option value="">— Choose Floor —</option>
          {floors.map((f) => <option key={f._id} value={f._id}>{f.floorName || `Floor ${f.floorNumber}`}</option>)}
        </select>
      </div>
      <div>
        <label className="text-gray-500 text-[11px] uppercase tracking-wide">Room</label>
        <select value={selectedRoom} onChange={(e) => { setSelectedRoom(e.target.value); setSelectedBed(""); onSelect(null); }} disabled={!selectedFloor} className={selectClass}>
          <option value="">— Choose Room —</option>
          {rooms.map((r) => <option key={r._id} value={r._id}>Room {r.roomNumber} ({r.shareType}-share)</option>)}
        </select>
      </div>
      <div>
        <label className="text-gray-500 text-[11px] uppercase tracking-wide">Available Bed</label>
        <select value={selectedBed} onChange={(e) => setSelectedBed(e.target.value)} disabled={!selectedRoom} className={selectClass}>
          <option value="">— Choose Bed —</option>
          {beds.length === 0 && selectedRoom
            ? <option disabled>No available beds in this room</option>
            : beds.map((b) => <option key={b._id} value={b._id}>Bed {b.bedNumber}</option>)}
        </select>
      </div>
    </div>
  );
}

// ─── Vacate Confirmation Modal ────────────────────────────────────────────────
function VacateConfirmModal({ tenantName, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden">
        <div className="px-6 pt-6 pb-4 text-center">
          <div className="w-14 h-14 rounded-full bg-rose-100 border-2 border-rose-300 flex items-center justify-center mx-auto mb-4"><span className="text-2xl">🚪</span></div>
          <h3 className="text-gray-900 font-bold text-lg mb-1">Vacate Tenant?</h3>
          <p className="text-gray-500 text-sm">Are you sure you want to vacate <span className="font-semibold text-gray-800">{tenantName}</span>?</p>
          <p className="text-rose-500 text-xs mt-2 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">⚠️ This will free their bed and mark them as Inactive. This action cannot be undone.</p>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onCancel} disabled={loading} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors disabled:opacity-50">Cancel</button>
          <button onClick={onConfirm} disabled={loading} className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-sm transition-colors active:scale-95 disabled:opacity-50">{loading ? "Vacating…" : "Yes, Vacate"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Tenant Detail Modal ──────────────────────────────────────────────────────
function TenantDetailModal({ tenantId, onClose, onPayNow, onPaymentDone, onTenantUpdated }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewingDoc, setViewingDoc] = useState(null);
  const [showProfilePopup, setShowProfilePopup] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [editRoomMode, setEditRoomMode] = useState(false);
  const [newAllocation, setNewAllocation] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [docFiles, setDocFiles] = useState({ aadharFront: null, aadharBack: null, passportPhoto: null });
  const [docPreviews, setDocPreviews] = useState({ aadharFront: null, aadharBack: null, passportPhoto: null });
  const [showVacateConfirm, setShowVacateConfirm] = useState(false);
  const [vacating, setVacating] = useState(false);
  const [vacateError, setVacateError] = useState("");

  const handleDocFileChange = (field, file) => {
    if (!file) return;
    setDocFiles((prev) => ({ ...prev, [field]: file }));
    const reader = new FileReader();
    reader.onloadend = () => setDocPreviews((prev) => ({ ...prev, [field]: reader.result }));
    reader.readAsDataURL(file);
  };

  const clearDocFile = (field) => {
    setDocFiles((prev) => ({ ...prev, [field]: null }));
    setDocPreviews((prev) => ({ ...prev, [field]: null }));
  };

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`${API}/rent/tenant/${tenantId}`, { headers: authHeader() });
    const d = await r.json();
    setData(d);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { load(); }, [load, onPaymentDone]);

  useEffect(() => {
    if (data?.tenant) {
      const t = data.tenant;
      setEditForm({
        name: t.name || "", phone: t.phone || "", email: t.email || "",
        fatherName: t.fatherName || "", fatherPhone: t.fatherPhone || "",
        permanentAddress: t.permanentAddress || "",
        joiningDate: t.joiningDate ? t.joiningDate.slice(0, 10) : "",
        rentAmount: t.rentAmount || "",
      });
    }
  }, [data]);

  const handleEditField = (key, val) => setEditForm((f) => ({ ...f, [key]: val }));

  const handleSaveEdit = async () => {
    setSaving(true); setSaveError("");
    try {
      const formData = new FormData();
      formData.append("name", editForm.name);
      formData.append("phone", editForm.phone);
      formData.append("email", editForm.email || "");
      formData.append("fatherName", editForm.fatherName || "");
      formData.append("fatherPhone", editForm.fatherPhone || "");
      formData.append("permanentAddress", editForm.permanentAddress);
      formData.append("joiningDate", editForm.joiningDate);
      formData.append("rentAmount", editForm.rentAmount);
      if (docFiles.aadharFront)   formData.append("aadharFront",   docFiles.aadharFront);
      if (docFiles.aadharBack)    formData.append("aadharBack",    docFiles.aadharBack);
      if (docFiles.passportPhoto) formData.append("passportPhoto", docFiles.passportPhoto);

      const r = await fetch(`${API}/tenants/${tenantId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${sessionStorage.getItem("token")}` },
        body: formData,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Failed to update tenant.");

      if (editRoomMode && newAllocation) {
        const rb = await fetch(`${API}/tenants/${tenantId}/reallocate`, {
          method: "PUT", headers: authHeader(), body: JSON.stringify(newAllocation),
        });
        const rd = await rb.json();
        if (!rb.ok) throw new Error(rd.message || "Failed to reallocate bed.");
      }

      setIsEditing(false); setEditRoomMode(false); setNewAllocation(null);
      setDocFiles({ aadharFront: null, aadharBack: null, passportPhoto: null });
      setDocPreviews({ aadharFront: null, aadharBack: null, passportPhoto: null });
      await load();
      if (onTenantUpdated) onTenantUpdated();
    } catch (e) {
      setSaveError(e.message);
    }
    setSaving(false);
  };

  const handleVacate = async () => {
    setVacating(true); setVacateError("");
    try {
      const r = await fetch(`${API}/tenants/${tenantId}/vacate`, { method: "DELETE", headers: authHeader() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Failed to vacate.");
      setShowVacateConfirm(false);
      if (onTenantUpdated) onTenantUpdated();
      onClose();
    } catch (e) {
      setVacateError(e.message);
    }
    setVacating(false);
  };

  if (!data && !loading) return null;

  const { tenant, buildingDetails, currentRecord, remaining, history, pendingMonths, arrearsTotal, totalAccumulatedDue, hasPreviousPending, pendingMonthsCount } = data || {};
  const phone = tenant?.phone?.replace(/\D/g, "");
  const payable = buildPayable(pendingMonths, currentRecord, remaining);
  const passportPhoto = tenant?.documents?.passportPhoto;
  const handleViewDocument = (docUrl) => { if (docUrl) setViewingDoc(docUrl); };
  const inputClass = "w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900 text-sm focus:outline-none focus:border-amber-400 transition-colors";

  return (
    <>
<div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm">
  <div className="relative w-full sm:max-w-2xl h-[95dvh] sm:h-auto sm:max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden">
 <br />
    <div className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 bg-white shrink-0">
      <h2 className="text-gray-900 font-bold text-base sm:text-lg">{isEditing ? "✏️ Edit Tenant" : "Tenant Details"}</h2>
      <div className="flex items-center gap-2">
        {!isEditing && !loading && (
          <>
            <button onClick={() => { setIsEditing(true); setSaveError(""); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 hover:bg-amber-500 border border-amber-200 text-amber-700 hover:text-white transition-colors">✏️ Edit</button>
            <button onClick={() => setShowVacateConfirm(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 hover:bg-rose-500 border border-rose-200 text-rose-700 hover:text-white transition-colors">🚪 Vacate</button>
          </>
        )}
        {isEditing && (
          <button onClick={() => { setIsEditing(false); setEditRoomMode(false); setNewAllocation(null); setSaveError(""); setDocFiles({ aadharFront: null, aadharBack: null, passportPhoto: null }); setDocPreviews({ aadharFront: null, aadharBack: null, passportPhoto: null }); }} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-600 transition-colors">✕ Cancel</button>
        )}
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors text-lg">✕</button>
      </div>
    </div>

    <div className="flex-1 overflow-y-auto">
      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="w-8 h-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" /></div>
      ) : (
        <div className="p-4 sm:p-6 space-y-5">

          {!isEditing && hasPreviousPending && (
            <div className="rounded-2xl border-2 border-rose-300 bg-rose-50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="relative flex h-4 w-4 shrink-0"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" /><span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500" /></span>
                <h4 className="text-rose-700 font-bold text-sm">Carry-Forward Dues — {pendingMonthsCount} Month{pendingMonthsCount > 1 ? "s" : ""} Unpaid</h4>
              </div>
              <div className="text-center mb-3">
                <p className="text-rose-400 text-xs uppercase tracking-wide">Total Arrears (Previous Months)</p>
                <p className="text-rose-600 text-3xl font-black">{fmt(arrearsTotal)}</p>
              </div>
              <div className="space-y-1.5">
                {pendingMonths.map((pm) => {
                  const pmRemaining = pm.rentAmount - pm.paidAmount;
                  return (
                    <div key={pm.monthYear} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-rose-200">
                      <div>
                        <span className="text-gray-700 text-xs font-medium">{fmtMonthYear(pm.dueDate)}</span>
                        {pm.paidAmount > 0 && <span className="text-gray-400 text-[10px] ml-2">(paid {fmt(pm.paidAmount)})</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        {pill(pm.status)}
                        <span className="text-rose-600 text-xs font-bold">{fmt(pmRemaining)}</span>
                        <button onClick={() => onPayNow(tenant._id, payable, pm.monthYear)} className="text-[10px] px-2 py-0.5 rounded-md bg-rose-500 hover:bg-rose-600 text-white font-bold transition-colors">Pay</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!isEditing && (
            <>
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="relative shrink-0">
                  <div onClick={() => passportPhoto && setShowProfilePopup(true)} title={passportPhoto ? "Click to view profile photo" : undefined} className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden border-2 flex items-center justify-center ${passportPhoto ? "border-amber-300 cursor-pointer hover:opacity-80 hover:scale-105 transition-all duration-150 shadow-md" : "border-amber-200 bg-amber-100"}`}>
                    {passportPhoto ? <img src={passportPhoto} alt={tenant?.name} className="w-full h-full object-cover" /> : <span className="text-amber-700 font-black text-lg sm:text-xl">{tenant?.name?.[0]?.toUpperCase()}</span>}
                  </div>
                  {passportPhoto && <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-amber-500 border-2 border-white flex items-center justify-center"><span className="text-[9px]">👁</span></div>}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-gray-900 font-bold text-lg sm:text-xl truncate">{tenant?.name}</h3>
                  <p className="text-gray-500 text-sm truncate">{tenant?.email || "No email on record"}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <button onClick={() => window.open(`https://wa.me/91${phone}?text=${buildWAMessage(tenant, currentRecord, buildingDetails)}`, "_blank")} className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-600 border border-emerald-200 text-emerald-700 hover:text-white transition-colors">📱WhatsApp</button>
                    <a href={`tel:${tenant?.phone}`} className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-blue-50 hover:bg-blue-600 border border-blue-200 text-blue-700 hover:text-white transition-colors">📞 Call</a>
                    {(currentRecord?.status !== "Paid" || hasPreviousPending) && <EmailReminderButton tenantId={tenant?._id} tenantEmail={tenant?.email} hasPreviousPending={hasPreviousPending} pendingMonthsCount={pendingMonthsCount} />}
                  </div>
                </div>
                <div className="text-right shrink-0 hidden sm:block">
                  <p className="text-gray-400 text-[10px] uppercase font-semibold mb-1">Grand Total Due</p>
                  <p className="text-xl font-black text-gray-900">{fmt(totalAccumulatedDue)}</p>
                </div>
              </div>
              
              <div className="sm:hidden bg-amber-50 rounded-xl p-3 border border-amber-200 flex items-center justify-between mt-2">
                <div>
                  <p className="text-gray-500 text-[10px] uppercase font-semibold">Grand Total Due</p>
                  <p className="text-lg font-black text-gray-900">{fmt(totalAccumulatedDue)}</p>
                </div>
                <div className="text-amber-500 text-2xl">💰</div>
              </div>
            </>
          )}

          {isEditing && (
            <div className="space-y-4">
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wide font-semibold mb-2">Basic Information</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className="text-gray-500 text-[11px] uppercase tracking-wide">Full Name *</label><input type="text" value={editForm.name} onChange={(e) => handleEditField("name", e.target.value)} className={inputClass} placeholder="Tenant name" /></div>
                  <div><label className="text-gray-500 text-[11px] uppercase tracking-wide">Phone *</label><input type="tel" value={editForm.phone} onChange={(e) => handleEditField("phone", e.target.value)} className={inputClass} placeholder="Phone number" /></div>
                  <div><label className="text-gray-500 text-[11px] uppercase tracking-wide">Email</label><input type="email" value={editForm.email} onChange={(e) => handleEditField("email", e.target.value)} className={inputClass} placeholder="Email address" /></div>
                  <div><label className="text-gray-500 text-[11px] uppercase tracking-wide">Monthly Rent (₹) *</label><input type="number" value={editForm.rentAmount} onChange={(e) => handleEditField("rentAmount", e.target.value)} className={inputClass} placeholder="Rent amount" /></div>
                  <div><label className="text-gray-500 text-[11px] uppercase tracking-wide">Joining Date</label><input type="date" value={editForm.joiningDate} onChange={(e) => handleEditField("joiningDate", e.target.value)} className={inputClass} /></div>
                  <div><label className="text-gray-500 text-[11px] uppercase tracking-wide">Permanent Address</label><input type="text" value={editForm.permanentAddress} onChange={(e) => handleEditField("permanentAddress", e.target.value)} className={inputClass} placeholder="Permanent address" /></div>
                </div>
              </div>
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wide font-semibold mb-2">Father's Details</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className="text-gray-500 text-[11px] uppercase tracking-wide">Father's Name</label><input type="text" value={editForm.fatherName} onChange={(e) => handleEditField("fatherName", e.target.value)} className={inputClass} placeholder="Father's name" /></div>
                  <div><label className="text-gray-500 text-[11px] uppercase tracking-wide">Father's Phone</label><input type="tel" value={editForm.fatherPhone} onChange={(e) => handleEditField("fatherPhone", e.target.value)} className={inputClass} placeholder="Father's phone" /></div>
                </div>
              </div>

              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wide font-semibold mb-2">Documents</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { field: "aadharFront", label: "Aadhar Front", icon: "🪪" },
                    { field: "aadharBack", label: "Aadhar Back", icon: "🪪" },
                    { field: "passportPhoto", label: "Passport Photo", icon: "📷" },
                  ].map(({ field, label, icon }) => {
                    const existingUrl = tenant?.documents?.[field];
                    const previewUrl  = docPreviews[field];
                    const hasNew      = !!docFiles[field];
                    return (
                      <div key={field} className="rounded-xl border border-gray-200 bg-gray-50 p-3 flex flex-col gap-2">
                        <p className="text-gray-600 text-[11px] uppercase tracking-wide font-semibold flex items-center gap-1">{icon} {label}</p>
                        <div className="relative w-full h-20 rounded-lg overflow-hidden border border-gray-200 bg-white flex items-center justify-center">
                          {previewUrl ? (
                            <><img src={previewUrl} alt={label} className="w-full h-full object-cover" /><span className="absolute top-1 right-1 text-[9px] font-bold bg-amber-500 text-white px-1.5 py-0.5 rounded-full">NEW</span></>
                          ) : existingUrl ? (
                            <img src={existingUrl} alt={label} className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity" onClick={() => handleViewDocument(existingUrl)} title="Click to view" />
                          ) : (
                            <span className="text-gray-300 text-3xl">{icon}</span>
                          )}
                        </div>
                        <div className="flex gap-1.5">
                          <label className="flex-1 flex items-center justify-center gap-1 cursor-pointer text-[11px] font-semibold px-2 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition-colors">
                            📁 {existingUrl || hasNew ? "Re-upload" : "Upload"}
                            <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf" className="hidden" onChange={(e) => handleDocFileChange(field, e.target.files[0])} />
                          </label>
                          {hasNew && <button onClick={() => clearDocFile(field)} className="px-2 py-1.5 rounded-lg bg-gray-100 border border-gray-200 text-gray-500 hover:bg-gray-200 text-[11px] font-semibold transition-colors" title="Remove new file">✕</button>}
                          {existingUrl && !hasNew && <button onClick={() => handleViewDocument(existingUrl)} className="px-2 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 text-[11px] font-semibold transition-colors" title="View current">👁</button>}
                        </div>
                        {hasNew && <p className="text-[10px] text-amber-600 font-medium truncate">📎 {docFiles[field].name}</p>}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <p className="text-gray-500 text-xs uppercase tracking-wide font-semibold">Room Allocation</p>
                  <button onClick={() => { setEditRoomMode((v) => !v); setNewAllocation(null); }} className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${editRoomMode ? "bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200" : "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"}`}>{editRoomMode ? "✕ Cancel Room Edit" : "🏠 Change Room"}</button>
                </div>
                {!editRoomMode && (
                  <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 grid grid-cols-3 gap-2 text-center">
                    <div><p className="text-gray-400 text-[10px] uppercase">Building</p><p className="text-gray-800 text-sm font-semibold">{buildingDetails?.buildingName || "—"}</p></div>
                    <div><p className="text-gray-400 text-[10px] uppercase">Floor</p><p className="text-gray-800 text-sm font-semibold">{buildingDetails?.floorNumber != null ? `Floor ${buildingDetails.floorNumber}` : "—"}</p></div>
                    <div><p className="text-gray-400 text-[10px] uppercase">Room / Bed</p><p className="text-gray-800 text-sm font-semibold">{buildingDetails?.roomNumber ? `${buildingDetails.roomNumber} / Bed ${buildingDetails.bedNumber || "—"}` : "—"}</p></div>
                  </div>
                )}
                {editRoomMode && (
                  <>
                    <RoomAllocator currentAlloc={buildingDetails} onSelect={setNewAllocation} />
                    {newAllocation && <div className="mt-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-700 font-semibold">✅ New bed selected: {newAllocation.allocationInfo.buildingName} · Floor {newAllocation.allocationInfo.floorNumber} · Room {newAllocation.allocationInfo.roomNumber} · Bed {newAllocation.allocationInfo.bedNumber}</div>}
                  </>
                )}
              </div>

              {saveError && <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-600">{saveError}</div>}
              <button onClick={handleSaveEdit} disabled={saving} className="w-full py-3 rounded-xl font-bold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all text-sm">{saving ? "Saving…" : "💾 Save Changes"}</button>
            </div>
          )}

          {!isEditing && (
            <>
              {(tenant?.fatherName || tenant?.fatherPhone) && (
                <div className="rounded-xl border border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50 p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><span>👨‍👦</span> Father's Details</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {tenant?.fatherName && <div className="bg-white rounded-lg p-3 border border-gray-200"><p className="text-gray-500 text-[10px] uppercase tracking-wide">Father's Name</p><p className="text-gray-900 font-medium text-sm">{tenant.fatherName}</p></div>}
                    {tenant?.fatherPhone && <div className="bg-white rounded-lg p-3 border border-gray-200"><p className="text-gray-500 text-[10px] uppercase tracking-wide">Father's Phone</p><p className="text-gray-900 font-medium text-sm">{tenant.fatherPhone}</p><button onClick={() => window.location.href = `tel:${tenant.fatherPhone}`} className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium">📞 Call Father</button></div>}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  ["Phone", tenant?.phone],
                  ["Joining Date", fmtDate(tenant?.joiningDate)],
                  ["Monthly Rent", fmt(tenant?.rentAmount)],
                  ["Permanent Address", tenant?.permanentAddress],
                  buildingDetails && ["Building", buildingDetails.buildingName],
                  buildingDetails && ["Floor", `Floor ${buildingDetails.floorNumber}`],
                  buildingDetails && ["Room", `Room ${buildingDetails.roomNumber}`],
                  buildingDetails?.bedNumber && ["Bed", `Bed ${buildingDetails.bedNumber}`],
                ].filter(Boolean).map(([label, val]) => (
                  <div key={label} className="rounded-xl bg-gray-50 border border-gray-200 p-3">
                    <p className="text-gray-500 text-[11px] uppercase tracking-wide mb-0.5">{label}</p>
                    <p className="text-gray-900 text-sm font-medium break-words">{val || "—"}</p>
                  </div>
                ))}
              </div>

              {(tenant?.documents?.aadharFront || tenant?.documents?.aadharBack || tenant?.documents?.passportPhoto) && (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><span>📄</span> Documents</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {tenant?.documents?.aadharFront && <div className="bg-white rounded-lg p-3 border border-gray-200 text-center cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleViewDocument(tenant.documents.aadharFront)}><div className="text-2xl sm:text-3xl mb-2">🪪</div><p className="text-gray-700 font-medium text-xs sm:text-sm">Aadhar Front</p><p className="text-gray-400 text-[10px] mt-1">Click to view</p></div>}
                    {tenant?.documents?.aadharBack && <div className="bg-white rounded-lg p-3 border border-gray-200 text-center cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleViewDocument(tenant.documents.aadharBack)}><div className="text-2xl sm:text-3xl mb-2">🪪</div><p className="text-gray-700 font-medium text-xs sm:text-sm">Aadhar Back</p><p className="text-gray-400 text-[10px] mt-1">Click to view</p></div>}
                    {tenant?.documents?.passportPhoto && (
                      <div className="bg-white rounded-lg p-3 border border-gray-200 text-center cursor-pointer hover:shadow-md transition-shadow" onClick={() => setShowProfilePopup(true)}>
                        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-amber-200 mx-auto mb-2"><img src={tenant.documents.passportPhoto} alt="Passport" className="w-full h-full object-cover" /></div>
                        <p className="text-gray-700 font-medium text-xs sm:text-sm">Passport Photo</p>
                        <p className="text-gray-400 text-[10px] mt-1">Click to view</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wide">Current Month</p>
                    <p className="text-gray-900 font-bold text-lg">{currentRecord ? fmtMonthYear(currentRecord.dueDate) : "—"}</p>
                    <p className="text-gray-500 text-xs">Due: {fmtDate(currentRecord?.dueDate)}</p>
                  </div>
                  {currentRecord?.status !== "Paid" && (
                    <button onClick={() => onPayNow(tenant._id, payable, currentRecord?.monthYear)} className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm active:scale-95 transition-all">Pay Now</button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <div className="bg-white rounded-xl p-2 sm:p-3 text-center border border-gray-200"><p className="text-gray-500 text-[10px] sm:text-[11px]">Rent</p><p className="text-gray-900 font-bold text-xs sm:text-sm">{fmt(currentRecord?.rentAmount || tenant?.rentAmount)}</p></div>
                  <div className="bg-white rounded-xl p-2 sm:p-3 text-center border border-gray-200"><p className="text-gray-500 text-[10px] sm:text-[11px]">Paid</p><p className="text-emerald-600 font-bold text-xs sm:text-sm">{fmt(currentRecord?.paidAmount || 0)}</p></div>
                  <div className="bg-white rounded-xl p-2 sm:p-3 text-center border border-gray-200"><p className="text-gray-500 text-[10px] sm:text-[11px]">Remaining</p><p className={`font-bold text-xs sm:text-sm ${remaining > 0 ? "text-rose-600" : "text-emerald-600"}`}>{fmt(remaining || 0)}</p></div>
                </div>
              </div>

              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wide mb-3">Full Payment History</p>
                {history?.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-4">No history yet.</p>
                ) : (
                  <div className="space-y-2">
                    {history?.map((rec) => {
                      const recRemaining = rec.rentAmount - rec.paidAmount;
                      const isPending = rec.status !== "Paid";
                      return (
                        <div key={rec._id} className={`rounded-xl border px-3 sm:px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${isPending ? "bg-rose-50 border-rose-200" : "bg-gray-50 border-gray-200"}`}>
                          <div className="min-w-0">
                            <p className="text-gray-900 text-sm font-semibold">{fmtMonthYear(rec.dueDate)}</p>
                            <p className="text-gray-500 text-xs">Due: {fmtDate(rec.dueDate)}</p>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                            <div className="text-left sm:text-right">{pill(rec.status)}<p className="text-gray-500 text-xs mt-1">{fmt(rec.paidAmount)} / {fmt(rec.rentAmount)}</p></div>
                            {isPending && <button onClick={() => onPayNow(tenant._id, [{ monthYear: rec.monthYear, maxAmount: recRemaining, label: fmtMonthYear(rec.dueDate) }], rec.monthYear)} className="text-[10px] px-2 py-1 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-bold transition-colors shrink-0">Pay {fmt(recRemaining)}</button>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          <div className="h-4" />
        </div>
      )}
    </div>
  </div>
</div>

      {showProfilePopup && passportPhoto && <ProfileImagePopup imageUrl={passportPhoto} name={tenant?.name} onClose={() => setShowProfilePopup(false)} />}
      {showVacateConfirm && <VacateConfirmModal tenantName={tenant?.name} onConfirm={handleVacate} onCancel={() => { setShowVacateConfirm(false); setVacateError(""); }} loading={vacating} />}
      {vacateError && <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[80] bg-rose-600 text-white px-5 py-3 rounded-xl shadow-xl text-sm font-semibold">❌ {vacateError}</div>}
      {viewingDoc && <DocumentViewer imageUrl={viewingDoc} onClose={() => setViewingDoc(null)} />}
    </>
  );
}

// ─── Pay Modal ────────────────────────────────────────────────────────────────
function PayModal({ tenantId, payableMonths, initialMonthYear, onClose, onSuccess }) {
  const [selectedMonth, setSelectedMonth] = useState(initialMonthYear || payableMonths[0]?.monthYear);
  const selectedOption = payableMonths.find((m) => m.monthYear === selectedMonth);
  const maxAmount = selectedOption ? selectedOption.maxAmount : 0;
  const [amount, setAmount] = useState(maxAmount || "");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { if (selectedOption) setAmount(selectedOption.maxAmount); setError(""); }, [selectedMonth]);

  const handlePay = async () => {
    const val = Number(amount);
    if (!val || val <= 0) return setError("Enter a valid amount.");
    if (val > maxAmount) return setError(`Amount cannot exceed remaining due of ${fmt(maxAmount)}.`);
    setLoading(true); setError("");
    try {
      const r = await fetch(`${API}/rent/pay`, { method: "POST", headers: authHeader(), body: JSON.stringify({ tenantId, amount: val, note, monthYear: selectedMonth }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      onSuccess(d);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  if (!payableMonths || payableMonths.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-white">
          <h3 className="text-gray-900 font-bold">Record Payment</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg transition-colors">✕</button>
        </div>
        <div className="p-6 space-y-4">
          {payableMonths.length > 1 ? (
            <div>
              <label className="block text-gray-600 text-xs uppercase tracking-wide mb-1.5">Select Month to Pay</label>
              <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm font-bold focus:outline-none focus:border-amber-400">
                {payableMonths.map((m) => <option key={m.monthYear} value={m.monthYear}>{m.label} — {fmt(m.maxAmount)}</option>)}
              </select>
            </div>
          ) : (
            <div><p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Paying For</p><p className="text-gray-900 text-lg font-bold">{selectedOption?.label}</p></div>
          )}
          <div><p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Remaining Due</p><p className="text-3xl font-black text-amber-600">{fmt(maxAmount)}</p></div>
          <div><label className="block text-gray-600 text-xs uppercase tracking-wide mb-1.5">Amount Paid (₹)</label><input ref={inputRef} type="number" value={amount} onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handlePay()} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-lg font-bold focus:outline-none focus:border-amber-400" min="1" max={maxAmount} /></div>
          <div><label className="block text-gray-600 text-xs uppercase tracking-wide mb-1.5">Note (optional)</label><input type="text" value={note} onChange={(e) => setNote(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-amber-400" placeholder="Cash, UPI, etc." /></div>
          {error && <p className="text-rose-600 text-sm bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}
          <button onClick={handlePay} disabled={loading} className="w-full py-3 rounded-xl font-bold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all text-base">{loading ? "Processing…" : "Confirm Payment"}</button>
        </div>
      </div>
    </div>
  );
}

function Toast({ msg, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
  return <div className="fixed bottom-6 right-6 z-[70] flex items-center gap-3 bg-emerald-600 border border-emerald-500 text-white px-5 py-3 rounded-2xl shadow-xl animate-bounce-once"><span className="text-lg">✅</span><span className="font-semibold text-sm">{msg}</span></div>;
}

// ─── useBulkMailEngine ────────────────────────────────────────────────────────
function useBulkMailEngine() {
  const [phase,          setPhase]          = useState("select");
  const [allItems,       setAllItems]       = useState([]);
  const [itemsLoading,   setItemsLoading]   = useState(false);
  const [sentLog,        setSentLog]        = useState([]);
  const [currentIndex,   setCurrentIndex]   = useState(0);
  const [currentTenantId, setCurrentTenantId] = useState(null);
  const [countdown,      setCountdown]      = useState(60);
  const [sendingCurrent, setSendingCurrent] = useState(false);
  const [totalInQueue,   setTotalInQueue]   = useState(0);

  const queueRef    = useRef([]);
  const indexRef    = useRef(0);
  const activeRef   = useRef(false);
  const timerRef    = useRef(null);

  const fetchAllItems = useCallback(async () => {
    if (allItems.length > 0) return;
    setItemsLoading(true);
    try {
      const r = await fetch(`${API}/rent/due?page=1&limit=500`, { headers: authHeader() });
      const d = await r.json();
      setAllItems(Array.isArray(d.data) ? d.data : []);
    } catch {}
    setItemsLoading(false);
  }, [allItems.length]);

  const runNext = useCallback(async () => {
    if (!activeRef.current) return;
    const idx   = indexRef.current;
    const queue = queueRef.current;
    if (idx >= queue.length) {
      activeRef.current = false;
      setPhase("done");
      setSendingCurrent(false);
      return;
    }
    const item = queue[idx];
    setCurrentIndex(idx);
    setCurrentTenantId(item.tenant._id);
    setSendingCurrent(true);
    let status = "sent";
    try {
      const r = await fetch(`${API}/rent/send-reminder`, {
        method: "POST", headers: authHeader(), body: JSON.stringify({ tenantId: item.tenant._id }),
      });
      if (!r.ok) throw new Error();
    } catch { status = "error"; }
    if (!activeRef.current) return;
    setSentLog((prev) => [...prev, { id: item.tenant._id, name: item.tenant.name, status }]);
    setSendingCurrent(false);
    indexRef.current = idx + 1;
    const isLast = idx + 1 >= queue.length;
    if (isLast) { activeRef.current = false; setPhase("done"); return; }
    let remaining = 60;
    setCountdown(remaining);
    const tick = () => {
      if (!activeRef.current) return;
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) { runNext(); } else { timerRef.current = setTimeout(tick, 1000); }
    };
    timerRef.current = setTimeout(tick, 1000);
  }, []);

  const startSending = useCallback((queue) => {
    clearTimeout(timerRef.current);
    setPhase("select");
    queueRef.current  = queue;
    indexRef.current  = 0;
    activeRef.current = true;
    setTotalInQueue(queue.length);
    setSentLog([]);
    setCurrentIndex(0);
    setCountdown(60);
    setPhase("sending");
    runNext();
  }, [runNext]);

  const stopSending = useCallback(() => {
    activeRef.current = false;
    clearTimeout(timerRef.current);
    setPhase("select");
    setSentLog([]);
    setCurrentIndex(0);
    setCurrentTenantId(null);
    setTotalInQueue(0);
  }, []);

  useEffect(() => () => { activeRef.current = false; clearTimeout(timerRef.current); }, []);

  return {
    phase, allItems, itemsLoading, sentLog,
    currentIndex, currentTenantId, countdown, sendingCurrent, totalInQueue,
    startSending, stopSending, fetchAllItems,
  };
}

// ─── Bulk Mail Modal ──────────────────────────────────────────────────────────
function BulkMailModal({
  phase, allItems, itemsLoading, sentLog,
  currentIndex, currentTenantId, countdown, sendingCurrent, totalInQueue,
  startSending, stopSending,
  onMinimize, onStop,
}) {
  const [selected, setSelected] = useState(new Set());

  const sections = [
    {
      key: "carryforward",
      label: "Carry-Forward Pending Dues",
      subtitle: "Pending dues from previous months",
      icon: "🔴",
      color: { header: "bg-rose-50 border-rose-200", badge: "bg-rose-500 text-white", row: "hover:bg-rose-50", accentBg: "bg-rose-100" },
      items: allItems.filter((i) => i.hasPreviousPending),
    },
    {
      key: "thismonth",
      label: "This Month's Dues",
      subtitle: "Overdue or due today / within 2 days",
      icon: "🟠",
      color: { header: "bg-amber-50 border-amber-200", badge: "bg-amber-500 text-white", row: "hover:bg-amber-50", accentBg: "bg-amber-100" },
      items: allItems.filter((i) => !i.hasPreviousPending && i.isOverdue),
    },
    {
      key: "upcoming",
      label: "Upcoming Due Soon",
      subtitle: "Due within the next 2 days (not yet overdue)",
      icon: "🟡",
      color: { header: "bg-yellow-50 border-yellow-200", badge: "bg-yellow-500 text-white", row: "hover:bg-yellow-50", accentBg: "bg-yellow-100" },
      items: allItems.filter((i) => !i.hasPreviousPending && !i.isOverdue && i.daysUntilDue !== null),
    },
  ];

  const toggle = (id) =>
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleSection = (items) => {
    const ids    = items.map((i) => i.tenant._id);
    const allSel = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const n = new Set(prev);
      allSel ? ids.forEach((id) => n.delete(id)) : ids.forEach((id) => n.add(id));
      return n;
    });
  };

  const handleStart = () => {
    const queue = allItems.filter((i) => selected.has(i.tenant._id));
    if (!queue.length) return;
    startSending(queue);
  };

  const currentItem = currentTenantId ? allItems.find((i) => i.tenant._id === currentTenantId) : null;
  const done        = sentLog.length;
  const pct         = totalInQueue > 0 ? Math.round((done / totalInQueue) * 100) : 0;
  const isWaiting   = !sendingCurrent && phase === "sending" && done > 0 && done < totalInQueue;

  const SectionBlock = ({ section }) => {
    if (section.items.length === 0)
      return (
        <div className={`rounded-2xl border ${section.color.header} p-4`}>
          <div className="flex items-center gap-2 mb-1">
            <span>{section.icon}</span>
            <h3 className="font-bold text-gray-800 text-sm">{section.label}</h3>
          </div>
          <p className="text-gray-400 text-xs pl-6">No tenants in this category.</p>
        </div>
      );

    const allSel  = section.items.every((i) => selected.has(i.tenant._id));
    const someSel = section.items.some((i) => selected.has(i.tenant._id));

    return (
      <div className={`rounded-2xl border ${section.color.header} overflow-hidden`}>
        <div className={`flex items-center justify-between px-4 py-3 border-b ${section.color.header}`}>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base">{section.icon}</span>
            <div className="min-w-0">
              <p className="font-bold text-gray-800 text-sm leading-tight">{section.label}</p>
              <p className="text-gray-500 text-[11px]">{section.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${section.color.badge}`}>{section.items.length}</span>
            <button onClick={() => toggleSection(section.items)} className="text-xs font-semibold px-3 py-1 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors">
              {allSel ? "Deselect All" : someSel ? "Select Rest" : "Select All"}
            </button>
          </div>
        </div>
        <div className="divide-y divide-gray-100 bg-white">
          {section.items.map((item) => {
            const { tenant, totalAccumulatedDue, remaining, isOverdue, daysUntilDue, daysOverdue } = item;
            const alloc    = tenant.allocationInfo || {};
            const isSel    = selected.has(tenant._id);
            const logEntry = sentLog.find((l) => l.id === tenant._id);
            const isActive = phase === "sending" && sendingCurrent && currentTenantId === tenant._id;
            return (
              <div key={tenant._id} onClick={() => phase === "select" && !logEntry && toggle(tenant._id)}
                className={`flex items-center gap-3 px-4 py-3 transition-colors ${phase === "select" && !logEntry ? `cursor-pointer ${section.color.row}` : "cursor-default"} ${isActive ? "bg-violet-50" : ""} ${isSel && !logEntry ? "bg-opacity-60" : ""}`}>
                <div className="shrink-0 w-5 flex items-center justify-center">
                  {logEntry ? <span className="text-base">{logEntry.status === "sent" ? "✅" : "❌"}</span>
                    : isActive ? <div className="w-4 h-4 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
                    : <input type="checkbox" checked={isSel} disabled={phase !== "select"} onChange={() => toggle(tenant._id)} onClick={(e) => e.stopPropagation()} className="w-4 h-4 rounded cursor-pointer" />}
                </div>
                <div className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-sm font-black overflow-hidden border-2 ${item.hasPreviousPending ? "border-rose-300 bg-rose-100 text-rose-700" : "border-amber-300 bg-amber-100 text-amber-700"}`}>
                  {tenant.documents?.passportPhoto ? <img src={tenant.documents.passportPhoto} alt={tenant.name} className="w-full h-full object-cover" /> : tenant.name?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">{tenant.name}</p>
                  <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                    {alloc.buildingName && <span className="text-gray-400 text-[10px]">🏢 {alloc.buildingName}</span>}
                    {alloc.roomNumber   && <span className="text-gray-400 text-[10px]">🚪 Room {alloc.roomNumber}</span>}
                    {tenant.email       && <span className="text-gray-400 text-[10px] truncate max-w-[140px]">✉️ {tenant.email}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className={`font-black text-sm ${item.hasPreviousPending || isOverdue ? "text-rose-600" : "text-amber-600"}`}>{fmt(totalAccumulatedDue || remaining || 0)}</p>
                  {isOverdue && daysOverdue > 0 ? <span className="text-rose-500 text-[10px] font-semibold">{daysOverdue}d overdue</span>
                    : daysUntilDue === 0 ? <span className="text-amber-500 text-[10px] font-semibold">Due today</span>
                    : daysUntilDue !== null ? <span className="text-amber-500 text-[10px] font-semibold">In {daysUntilDue}d</span>
                    : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl flex flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden" style={{ maxHeight: "92vh" }}>
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-violet-100 border border-violet-200 flex items-center justify-center shrink-0"><span className="text-base">📧</span></div>
            <div className="min-w-0">
              <h2 className="text-gray-900 font-bold text-base leading-tight">Bulk Mail Reminders</h2>
              <p className="text-gray-400 text-[11px]">
                {phase === "sending" ? `Sending in background… ${done} / ${totalInQueue} done`
                  : phase === "done" ? `Completed — ${sentLog.filter((l) => l.status === "sent").length} sent, ${sentLog.filter((l) => l.status === "error").length} failed`
                  : "Select tenants and send automated payment reminders"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-3">
            <button onClick={onMinimize} title="Minimise — mails will continue sending in background" className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-violet-100 text-violet-500 hover:text-violet-700 border border-violet-200 transition-colors font-bold text-lg leading-none">−</button>
            <button onClick={onStop} title={phase === "sending" ? "Stop sending & close" : "Close"} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">✕</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {itemsLoading && (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
              <p className="text-gray-400 text-sm">Loading tenants…</p>
            </div>
          )}
          {!itemsLoading && phase === "select" && (
            <div className="p-4 space-y-4">
              <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                <span className="text-blue-500 text-base shrink-0 mt-0.5">🛡️</span>
                <p className="text-blue-700 text-xs leading-relaxed">For Security Reasons, mails are sent <strong>one at a time</strong> with a <strong>60-second gap</strong> between each. You can <strong>minimise (−)</strong> this popup — sending will continue in the background.</p>
              </div>
              {sections.map((s) => <SectionBlock key={s.key} section={s} />)}
            </div>
          )}
          {!itemsLoading && (phase === "sending" || phase === "done") && (
            <div className="p-4 space-y-4">
              <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
                <div className="flex justify-between text-xs text-gray-500 mb-2">
                  <span className="font-semibold text-violet-700">{phase === "done" ? "✅ All done!" : `Sending ${done + (sendingCurrent ? 1 : 0)} of ${totalInQueue}…`}</span>
                  <span className="font-bold">{pct}%</span>
                </div>
                <div className="w-full h-3 rounded-full bg-white border border-violet-200 overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-700 ${phase === "done" ? "bg-emerald-500" : "bg-gradient-to-r from-violet-500 to-violet-400"}`} style={{ width: `${phase === "done" ? 100 : pct}%` }} />
                </div>
                {phase === "sending" && currentItem && (
                  <div className="mt-4 bg-white rounded-xl border border-violet-200 px-4 py-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-violet-100 border-2 border-violet-300 flex items-center justify-center text-base font-black text-violet-700 overflow-hidden shrink-0">
                      {currentItem.tenant.documents?.passportPhoto ? <img src={currentItem.tenant.documents.passportPhoto} alt={currentItem.tenant.name} className="w-full h-full object-cover" /> : currentItem.tenant.name?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-sm">{currentItem.tenant.name}</p>
                      <p className="text-gray-400 text-xs truncate">{currentItem.tenant.email || "No email on record"}</p>
                    </div>
                    {sendingCurrent ? (
                      <div className="flex items-center gap-1.5 shrink-0"><div className="w-3.5 h-3.5 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" /><span className="text-violet-600 text-xs font-semibold">Sending…</span></div>
                    ) : isWaiting ? (
                      <div className="flex flex-col items-center shrink-0">
                        <div className="relative w-12 h-12">
                          <svg className="w-full h-full -rotate-90" viewBox="0 0 48 48">
                            <circle cx="24" cy="24" r="20" fill="none" stroke="#ede9fe" strokeWidth="4" />
                            <circle cx="24" cy="24" r="20" fill="none" stroke="#8b5cf6" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 20}`} strokeDashoffset={`${2 * Math.PI * 20 * (countdown / 60)}`} className="transition-all duration-1000" />
                          </svg>
                          <span className="absolute inset-0 flex items-center justify-center text-violet-700 font-black text-xs">{countdown}</span>
                        </div>
                        <p className="text-gray-400 text-[9px] mt-0.5">next in</p>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
              {sentLog.length > 0 && (
                <div className="rounded-2xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <p className="text-gray-600 text-xs font-semibold uppercase tracking-wide">Send Log</p>
                    <span className="text-xs text-gray-400">{sentLog.filter((l) => l.status === "sent").length} ✅ · {sentLog.filter((l) => l.status === "error").length} ❌</span>
                  </div>
                  <div className="divide-y divide-gray-100 max-h-56 overflow-y-auto bg-white">
                    {sentLog.map((log, i) => (
                      <div key={log.id} className="flex items-center gap-3 px-4 py-2.5">
                        <span className="text-gray-400 text-[10px] font-mono w-5 shrink-0">{i + 1}</span>
                        <span className="flex-1 text-gray-800 text-sm font-medium truncate">{log.name}</span>
                        {log.status === "sent" ? <span className="text-emerald-600 text-xs font-semibold">✅ Sent</span> : <span className="text-rose-500 text-xs font-semibold">❌ Failed</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {phase === "sending" && <div className="space-y-3">{sections.map((s) => <SectionBlock key={s.key} section={s} />)}</div>}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-gray-200 bg-white px-5 py-4">
          {phase === "select" && !itemsLoading && (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm text-gray-600">
                {selected.size > 0 ? <><span className="font-bold text-gray-900">{selected.size}</span> tenant{selected.size !== 1 ? "s" : ""} selected</> : <span className="text-gray-400">No tenants selected</span>}
              </p>
              <div className="flex gap-2">
                <button onClick={onMinimize} className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors">Cancel</button>
                <button onClick={handleStart} disabled={selected.size === 0} className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-violet-500 hover:bg-violet-600 text-white font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all">
                  ✉️ Send {selected.size > 0 ? `${selected.size} ` : ""}Mail{selected.size !== 1 ? "s" : ""}
                </button>
              </div>
            </div>
          )}
          {phase === "sending" && (
            <div className="flex items-center justify-between gap-2">
              <p className="text-gray-400 text-xs">🔒 Mails continue even if you close this popup.</p>
              <button onClick={onMinimize} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-50 border border-violet-200 text-violet-700 font-semibold text-xs hover:bg-violet-100 transition-colors">− Minimise</button>
            </div>
          )}
          {phase === "done" && (
            <button onClick={onStop} className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm active:scale-95 transition-all">✅ Done — Close</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Location Filter Dropdown (UPDATED to work with all tenants across pages) ──
function LocationFilter({ dueItems, onFilterChange }) {
  const [selectedBuilding, setSelectedBuilding] = useState("");
  const [selectedFloor,    setSelectedFloor]    = useState("");
  const [selectedRoom,     setSelectedRoom]     = useState("");

  // Derive unique buildings from ALL due items (not just current page)
// Derive unique buildings from ALL due items - ensure all buildings are included
const buildings = Array.from(
  new Map(
    dueItems
      .filter((i) => i.tenant?.allocationInfo?.buildingName)
      .map((i) => [
        i.tenant.allocationInfo.buildingName,
        { name: i.tenant.allocationInfo.buildingName }
      ])
  ).values()
).sort((a, b) => a.name.localeCompare(b.name));

// Debug log to check what buildings are found
console.log("Buildings found in filter:", buildings.map(b => b.name));

  // Derive floors for selected building from ALL due items
  const floors = selectedBuilding
    ? Array.from(
        new Map(
          dueItems
            .filter(
              (i) =>
                i.tenant?.allocationInfo?.buildingName === selectedBuilding &&
                i.tenant?.allocationInfo?.floorNumber != null
            )
            .map((i) => [
              i.tenant.allocationInfo.floorNumber,
              { number: i.tenant.allocationInfo.floorNumber }
            ])
        ).values()
      ).sort((a, b) => a.number - b.number)
    : [];

  // Derive rooms for selected building + floor from ALL due items
  const rooms = selectedBuilding && selectedFloor !== ""
    ? Array.from(
        new Map(
          dueItems
            .filter(
              (i) =>
                i.tenant?.allocationInfo?.buildingName === selectedBuilding &&
                String(i.tenant?.allocationInfo?.floorNumber) === String(selectedFloor) &&
                i.tenant?.allocationInfo?.roomNumber != null
            )
            .map((i) => [
              i.tenant.allocationInfo.roomNumber,
              { number: i.tenant.allocationInfo.roomNumber }
            ])
        ).values()
      ).sort((a, b) => String(a.number).localeCompare(String(b.number), undefined, { numeric: true }))
    : [];

  const hasAnyFilter = selectedBuilding || selectedFloor || selectedRoom;

  const handleBuildingChange = (val) => {
    setSelectedBuilding(val);
    setSelectedFloor("");
    setSelectedRoom("");
    onFilterChange({ building: val, floor: "", room: "" });
  };

  const handleFloorChange = (val) => {
    setSelectedFloor(val);
    setSelectedRoom("");
    onFilterChange({ building: selectedBuilding, floor: val, room: "" });
  };

  const handleRoomChange = (val) => {
    setSelectedRoom(val);
    onFilterChange({ building: selectedBuilding, floor: selectedFloor, room: val });
  };

  const clearAll = () => {
    setSelectedBuilding("");
    setSelectedFloor("");
    setSelectedRoom("");
    onFilterChange({ building: "", floor: "", room: "" });
  };

  const selectBase = "bg-white border border-gray-200 rounded-xl px-3 py-2 text-gray-900 text-sm focus:outline-none focus:border-amber-400 transition-colors appearance-none cursor-pointer";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Building */}
      <div className="relative">
        <div className={`flex items-center gap-1.5 ${selectedBuilding ? "border-amber-400 bg-amber-50" : "border-gray-200 bg-white"} border rounded-xl px-3 py-2 transition-all`}>
          <span className="text-sm shrink-0">🏢</span>
          <select
            value={selectedBuilding}
            onChange={(e) => handleBuildingChange(e.target.value)}
            className="bg-transparent text-sm text-gray-900 focus:outline-none cursor-pointer pr-1"
            style={{ minWidth: "120px" }}
          >
            <option value="">All Buildings</option>
            {buildings.map((b) => (
              <option key={b.name} value={b.name}>{b.name}</option>
            ))}
          </select>
          {selectedBuilding && (
            <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center shrink-0">✓</span>
          )}
        </div>
      </div>

      {/* Floor — only shown after building selected */}
      {selectedBuilding && (
        <div className="relative flex items-center gap-1">
          <span className="text-gray-400 text-xs">›</span>
          <div className={`flex items-center gap-1.5 ${selectedFloor !== "" ? "border-amber-400 bg-amber-50" : "border-gray-200 bg-white"} border rounded-xl px-3 py-2 transition-all`}>
            <span className="text-sm shrink-0">🏬</span>
            <select
              value={selectedFloor}
              onChange={(e) => handleFloorChange(e.target.value)}
              className="bg-transparent text-sm text-gray-900 focus:outline-none cursor-pointer pr-1"
              style={{ minWidth: "100px" }}
            >
              <option value="">All Floors</option>
              {floors.map((f) => (
                <option key={f.number} value={f.number}>Floor {f.number}</option>
              ))}
            </select>
            {selectedFloor !== "" && (
              <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center shrink-0">✓</span>
            )}
          </div>
        </div>
      )}

      {/* Room — only shown after floor selected */}
      {selectedBuilding && selectedFloor !== "" && (
        <div className="relative flex items-center gap-1">
          <span className="text-gray-400 text-xs">›</span>
          <div className={`flex items-center gap-1.5 ${selectedRoom ? "border-amber-400 bg-amber-50" : "border-gray-200 bg-white"} border rounded-xl px-3 py-2 transition-all`}>
            <span className="text-sm shrink-0">🚪</span>
            <select
              value={selectedRoom}
              onChange={(e) => handleRoomChange(e.target.value)}
              className="bg-transparent text-sm text-gray-900 focus:outline-none cursor-pointer pr-1"
              style={{ minWidth: "100px" }}
            >
              <option value="">All Rooms</option>
              {rooms.map((r) => (
                <option key={r.number} value={r.number}>Room {r.number}</option>
              ))}
            </select>
            {selectedRoom && (
              <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center shrink-0">✓</span>
            )}
          </div>
        </div>
      )}

      {/* Clear filter button */}
      {hasAnyFilter && (
        <button
          onClick={clearAll}
          className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors"
        >
          ✕ Clear Filter
        </button>
      )}

      {/* Active filter summary badge with count */}
      {hasAnyFilter && (
        <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full font-medium">
          {selectedRoom
            ? `Room ${selectedRoom}, Floor ${selectedFloor}, ${selectedBuilding}`
            : selectedFloor !== ""
            ? `Floor ${selectedFloor}, ${selectedBuilding}`
            : selectedBuilding}
        </span>
      )}
    </div>
  );
}

// ─── Pagination Controls ──────────────────────────────────────────────────────
function Pagination({ page, totalPages, total, limit, onPageChange, loading }) {
  if (totalPages <= 1) return null;
  const start = (page - 1) * limit + 1;
  const end   = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
      <p className="text-gray-500 text-xs">
        Showing <span className="font-semibold text-gray-800">{start}–{end}</span> of{" "}
        <span className="font-semibold text-gray-800">{total}</span> tenants with dues
      </p>
      <div className="flex items-center gap-1.5">
        <button onClick={() => onPageChange(page - 1)} disabled={page <= 1 || loading} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">← Prev</button>
        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
          .reduce((acc, p, idx, arr) => { if (idx > 0 && p - arr[idx - 1] > 1) acc.push("…"); acc.push(p); return acc; }, [])
          .map((item, idx) =>
            item === "…" ? <span key={`ellipsis-${idx}`} className="px-1 text-gray-400 text-xs">…</span>
              : <button key={item} onClick={() => onPageChange(item)} disabled={loading} className={`w-8 h-8 rounded-lg text-xs font-bold border transition-colors disabled:cursor-not-allowed ${item === page ? "bg-amber-500 border-amber-500 text-white" : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"}`}>{item}</button>
          )}
        <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages || loading} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Next →</button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
const PAGE_LIMIT = 10;

export default function RentManagement() {
  const [dueItems,    setDueItems]    = useState([]);
  const [dueLoading,  setDueLoading]  = useState(true);
  const [page,        setPage]        = useState(1);
  const [totalPages,  setTotalPages]  = useState(1);
  const [total,       setTotal]       = useState(0);

  const [globalStats, setGlobalStats] = useState({
    totalAlerts: 0,
    totalOverdueOrCarryForward: 0,
    totalDueSoon: 0,
    totalPendingAmount: 0,
    carryForwardTenantsCount: 0
  });

  const [searchQuery,   setSearchQuery]   = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchDone,    setSearchDone]    = useState(false);
  const searchDebounceRef = useRef(null);

  // ── Location filter state ──────────────────────────────────────────────────
  const [locationFilter, setLocationFilter] = useState({ building: "", floor: "", room: "" });

  const bulkEngine = useBulkMailEngine();

  const [selectedTenantId, setSelectedTenantId] = useState(null);
  const [payModal,         setPayModal]          = useState(null);
  const [toast,            setToast]             = useState("");
  const [paymentDone,      setPaymentDone]        = useState(0);
  const [showBulkMail,     setShowBulkMail]       = useState(false);

  // All due items across all pages for filter options (fetched once, unbounded)
  const [allDueItemsForFilter, setAllDueItemsForFilter] = useState([]);
  const [filterLoading, setFilterLoading] = useState(true);

  // Fetch all items once for filter dropdown population (get all tenants across all pages)
const fetchAllDueItems = useCallback(async () => {
  setFilterLoading(true); // Start loading
  try {
    console.log("Fetching all due items from all pages...");
    let allData = [];
    let currentPage = 1;
    let hasMore = true;
    
    while (hasMore) {
      const r = await fetch(`${API}/rent/due?page=${currentPage}&limit=100`, { headers: authHeader() });
      const d = await r.json();
      console.log(`Page ${currentPage} fetched:`, d.data?.length || 0, "items");
      if (d.data && d.data.length > 0) {
        allData = [...allData, ...d.data];
        currentPage++;
        hasMore = currentPage <= d.totalPages;
      } else {
        hasMore = false;
      }
    }
    
    console.log("Total items fetched across all pages:", allData.length);
    // Log unique rooms found
    const rooms = new Set();
    allData.forEach(item => {
      if (item.tenant?.allocationInfo?.roomNumber) {
        rooms.add(item.tenant.allocationInfo.roomNumber);
      }
    });
    console.log("Unique rooms with dues:", Array.from(rooms).sort());
    
    if (allData.length > 0) {
      setAllDueItemsForFilter(allData);
      return allData;
    }
    return [];
  } catch (error) {
    console.error("Error fetching all due items:", error);
    return [];
  } finally {
    setFilterLoading(false); // End loading
  }
}, []);

  useEffect(() => {
    fetchAllDueItems();
  }, [paymentDone, fetchAllDueItems]);

  const loadDuePage = useCallback(async (pageNum = 1) => {
    setDueLoading(true);
    try {
      const r = await fetch(`${API}/rent/due?page=${pageNum}&limit=${PAGE_LIMIT}`, { headers: authHeader() });
      const d = await r.json();
      if (d.data) {
        setDueItems(d.data);
        setPage(d.page);
        setTotalPages(d.totalPages);
        setTotal(d.total);
        if (d.stats) setGlobalStats(d.stats);
      }
    } catch {}
    setDueLoading(false);
  }, []);

  useEffect(() => {
    loadDuePage(page);
  }, [page, paymentDone, loadDuePage]);

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSearchChange = (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    clearTimeout(searchDebounceRef.current);
    if (!q.trim()) { setSearchResults(null); setSearchDone(false); return; }
    searchDebounceRef.current = setTimeout(async () => {
      setSearchLoading(true); setSearchDone(false);
      try {
        const r = await fetch(`${API}/rent/due/search?q=${encodeURIComponent(q.trim())}`, { headers: authHeader() });
        const d = await r.json();
        setSearchResults(Array.isArray(d) ? d : []);
      } catch { setSearchResults([]); }
      setSearchLoading(false); setSearchDone(true);
    }, 400);
  };

  const clearSearch = () => {
    setSearchQuery(""); setSearchResults(null); setSearchDone(false);
    clearTimeout(searchDebounceRef.current);
  };

  const onPayNow = (tenantId, payableMonths, initialMonthYear) => {
    setPayModal({ tenantId, payableMonths, initialMonthYear });
  };

  const onPaySuccess = (data) => {
    setPayModal(null);
    setToast(data.message || "Payment recorded!");
    setPaymentDone((n) => n + 1);
    // Refresh the all due items for filter after payment
    fetchAllDueItems();
    if (searchQuery.trim()) {
      clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = setTimeout(async () => {
        try {
          const r = await fetch(`${API}/rent/due/search?q=${encodeURIComponent(searchQuery.trim())}`, { headers: authHeader() });
          const d = await r.json();
          setSearchResults(Array.isArray(d) ? d : []);
        } catch {}
      }, 300);
    }
  };

  const handleTenantUpdated = () => {
    setToast("Tenant updated successfully!");
    setPaymentDone((n) => n + 1);
    loadDuePage(page);
    fetchAllDueItems();
  };

  // ── Apply location filter to items (this now works on ALL items from allDueItemsForFilter) ──
  const applyLocationFilter = (items) => {
    const { building, floor, room } = locationFilter;
    if (!building && !floor && !room) return items;
    return items.filter((item) => {
      const alloc = item.tenant?.allocationInfo || {};
      if (building && alloc.buildingName !== building) return false;
      if (floor !== "" && String(alloc.floorNumber) !== String(floor)) return false;
      if (room && String(alloc.roomNumber) !== String(room)) return false;
      return true;
    });
  };

  // Get filtered items from the complete dataset (all pages)
  const getFilteredItems = useCallback(() => {
    if (!locationFilter.building && !locationFilter.floor && !locationFilter.room) {
      return null; // No filter active
    }
    return applyLocationFilter(allDueItemsForFilter);
  }, [locationFilter, allDueItemsForFilter]);

  const filteredItems = getFilteredItems();
  const isSearchMode     = searchResults !== null;
  const isFilterMode     = !!(locationFilter.building || locationFilter.floor || locationFilter.room);
  const statsLoading     = dueLoading && dueItems.length === 0;

  // Base items: search results, filtered items (from all pages), or paginated due items
  let baseItems;
  if (isSearchMode) {
    baseItems = searchResults || [];
  } else if (isFilterMode && filteredItems) {
    baseItems = filteredItems;
  } else {
    baseItems = dueItems;
  }

  const displayItems = baseItems;

  // For filter dropdown, use all due items across all pages
  const filterSourceItems = isSearchMode ? (searchResults || []) : allDueItemsForFilter;

  // Get the count of filtered results (for display)
  const filteredCount = isFilterMode && filteredItems ? filteredItems.length : 0;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">

      {/* Sticky Header */}
      <div className="border-b border-gray-200 bg-white/95 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black tracking-tight"><span className="text-amber-500">₹</span> Rent Management</h1>
            <p className="text-gray-500 text-xs mt-0.5">Real-time hostel rent tracking</p>
          </div>
          <div className="flex items-center gap-2">
            {!isSearchMode && total > 0 && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-1 rounded-lg">
                <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" /></span>
                {total} due
              </span>
            )}
            <button
              onClick={() => {
                setShowBulkMail(true);
                if (bulkEngine.phase !== "sending") { bulkEngine.stopSending(); }
                bulkEngine.fetchAllItems();
              }}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-200 shadow-sm
                ${bulkEngine.phase === "sending" ? "bg-violet-500 border-violet-500 text-white" : "bg-violet-50 hover:bg-violet-500 border-violet-200 text-violet-700 hover:text-white"}`}
            >
              📧 <span className="hidden sm:inline">Send Bulk Emails</span>
              {bulkEngine.phase === "sending" && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
                </span>
              )}
            </button>
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-gray-500 text-xs">Live</span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-5 py-6 space-y-6">

        {/* Global Summary Stats */}
        {!isSearchMode && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {[
                { label: "Total Alerts", value: statsLoading ? "—" : globalStats.totalAlerts, color: "text-gray-900" },
                { label: "Overdue / Carry-Forward", value: statsLoading ? "—" : globalStats.totalOverdueOrCarryForward, color: "text-rose-600" },
                { label: "Due Soon", value: statsLoading ? "—" : globalStats.totalDueSoon, color: "text-amber-600" },
                { label: "Total Pending", value: statsLoading ? "—" : fmt(globalStats.totalPendingAmount), color: "text-amber-700" },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
                  <p className="text-gray-500 text-xs uppercase tracking-wide">{label}</p>
                  <p className={`text-2xl font-black mt-1 ${color}`}>{value}</p>
                </div>
              ))}
            </div>

            {globalStats.carryForwardTenantsCount > 0 && !statsLoading && (
              <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 flex items-start gap-3">
                <div className="relative flex items-center justify-center w-6 h-6 mt-0.5">
                  {globalStats.carryForwardTenantsCount > 0 && (
                    <span className="absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75 animate-ping"></span>
                  )}
                  <div className="relative w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center text-xs font-bold">
                    {globalStats.carryForwardTenantsCount}
                  </div>
                </div>
                <div>
                  <p className="text-rose-700 font-bold text-sm">
                    {globalStats.carryForwardTenantsCount} tenant{globalStats.carryForwardTenantsCount !== 1 ? "s" : ""} have pending dues from previous months
                  </p>
                  <p className="text-rose-600/80 text-xs mt-0.5">
                    Payments are being tracked from each tenant's joining date. Cards with a red bubble indicate carry-forward arrears.
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Due Alerts Section ── */}
        <section>
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-3">
              <h2 className="text-gray-900 font-bold text-base">⚡ Due Alerts</h2>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200 hidden sm:inline">
                Due within 2 days, overdue, or carry-forward arrears
              </span>
            </div>

            {/* Search Box */}
            <div className="relative w-full sm:w-64">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">🔍</span>
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search by tenant name…"
                className="w-full pl-8 pr-8 py-2 rounded-xl border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:border-amber-400 transition-colors placeholder-gray-400"
              />
              {searchQuery && (
                <button onClick={clearSearch} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-base leading-none" title="Clear search">✕</button>
              )}
            </div>
          </div>

          {/* ── Location Filter Row ── */}
     {/* ── Location Filter Row ── */}
{/* Only show filter after data is loaded and we have filter source items */}
{!dueLoading && !filterLoading && filterSourceItems.length > 0 && (
  <div className="mb-4 p-3 rounded-2xl border border-gray-200 bg-white">
    <div className="flex items-center gap-2 mb-2.5">
      <span className="text-gray-500 text-xs font-semibold uppercase tracking-wide">Filter by location</span>
      {isFilterMode && (
        <span className="text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
          {filteredCount} result{filteredCount !== 1 ? "s" : ""}
        </span>
      )}
    </div>
    <LocationFilter
      dueItems={filterSourceItems}
      onFilterChange={(f) => {
        setLocationFilter(f);
        setPage(1);
      }}
    />
  </div>
)}

{/* Show loading skeleton for filter while data is being fetched */}
{!dueLoading && filterLoading && (
  <div className="mb-4 p-3 rounded-2xl border border-gray-200 bg-white">
    <div className="flex items-center gap-2 mb-2.5">
      <span className="text-gray-500 text-xs font-semibold uppercase tracking-wide">Filter by location</span>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <div className="h-10 w-32 bg-gray-100 rounded-xl animate-pulse"></div>
      <div className="h-10 w-28 bg-gray-100 rounded-xl animate-pulse"></div>
      <div className="h-10 w-28 bg-gray-100 rounded-xl animate-pulse"></div>
    </div>
  </div>
)}

          {/* Search result label */}
          {isSearchMode && (
            <div className="mb-3 flex items-center gap-2">
              {searchLoading ? (
                <span className="text-gray-400 text-xs animate-pulse">Searching…</span>
              ) : searchDone && searchResults.length === 0 ? (
                <div className="w-full text-center py-10 rounded-2xl border border-gray-200 bg-white/60">
                  <p className="text-3xl mb-2">✅</p>
                  <p className="text-gray-600 font-semibold text-sm">No pending records for <span className="text-gray-900">"{searchQuery}"</span></p>
                  <p className="text-gray-400 text-xs mt-1">This tenant either doesn't exist or has no dues right now.</p>
                  <button onClick={clearSearch} className="mt-3 text-xs text-amber-600 hover:text-amber-700 font-semibold underline underline-offset-2">Clear search</button>
                </div>
              ) : searchDone && searchResults.length > 0 ? (
                <span className="text-xs text-gray-500 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full font-medium">
                  {searchResults.length} result{searchResults.length > 1 ? "s" : ""} with pending dues for "{searchQuery}"
                </span>
              ) : null}
            </div>
          )}

          {/* Filter result label when filter active but no search */}
          {isFilterMode && !isSearchMode && filteredCount === 0 && (
            <div className="mb-3">
              <div className="w-full text-center py-10 rounded-2xl border border-gray-200 bg-white/60">
                <p className="text-3xl mb-2">🏠</p>
                <p className="text-gray-600 font-semibold text-sm">No tenants with dues in the selected location</p>
                <p className="text-gray-400 text-xs mt-1">Try selecting a different building, floor, or room.</p>
              </div>
            </div>
          )}

          {/* Cards Grid */}
          {(!isSearchMode || (isSearchMode && !searchDone && !searchLoading) || (isSearchMode && searchResults.length > 0)) && (
            <>
              {(dueLoading && !isSearchMode) || searchLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5, 6].slice(0, isSearchMode ? 3 : PAGE_LIMIT > 6 ? 6 : PAGE_LIMIT).map((i) => (
                    <div key={i} className="h-48 rounded-2xl bg-gray-100 border border-gray-200 animate-pulse" />
                  ))}
                </div>
              ) : displayItems.length === 0 && !isSearchMode && !isFilterMode ? (
                <div className="text-center py-12 rounded-2xl border border-gray-200 bg-white/40">
                  <p className="text-4xl mb-2">🎉</p>
                  <p className="text-gray-600 font-semibold">All clear! No dues within the next 2 days.</p>
                </div>
              ) : displayItems.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {displayItems.map((item) => (
                    <DueCard key={item.tenant._id} item={item} onSelect={setSelectedTenantId} onPayNow={onPayNow} />
                  ))}
                </div>
              ) : null}
            </>
          )}

          {/* Pagination — only shown when NOT in search mode AND NOT in filter mode (filter shows all results from all pages) */}
          {!isSearchMode && !isFilterMode && (
            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              limit={PAGE_LIMIT}
              onPageChange={handlePageChange}
              loading={dueLoading}
            />
          )}

          {/* Show count when filter is active */}
          {isFilterMode && !isSearchMode && displayItems.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200 text-center">
              <p className="text-gray-400 text-xs">
                Showing <span className="font-semibold text-gray-700">{displayItems.length}</span> tenant{displayItems.length !== 1 ? "s" : ""} matching filter (from all pages)
              </p>
            </div>
          )}
        </section>

      </div>

      {/* Modals */}
      {selectedTenantId && (
        <TenantDetailModal
          tenantId={selectedTenantId}
          onClose={() => setSelectedTenantId(null)}
          onPayNow={onPayNow}
          onPaymentDone={paymentDone}
          onTenantUpdated={handleTenantUpdated}
        />
      )}
      {payModal && (
        <PayModal
          tenantId={payModal.tenantId}
          payableMonths={payModal.payableMonths}
          initialMonthYear={payModal.initialMonthYear}
          onClose={() => setPayModal(null)}
          onSuccess={onPaySuccess}
        />
      )}
      {showBulkMail && (
        <BulkMailModal
          phase={bulkEngine.phase}
          allItems={bulkEngine.allItems}
          itemsLoading={bulkEngine.itemsLoading}
          sentLog={bulkEngine.sentLog}
          currentIndex={bulkEngine.currentIndex}
          currentTenantId={bulkEngine.currentTenantId}
          countdown={bulkEngine.countdown}
          sendingCurrent={bulkEngine.sendingCurrent}
          totalInQueue={bulkEngine.totalInQueue}
          startSending={bulkEngine.startSending}
          stopSending={bulkEngine.stopSending}
          onMinimize={() => setShowBulkMail(false)}
          onStop={() => { bulkEngine.stopSending(); setShowBulkMail(false); }}
        />
      )}
      {toast && <Toast msg={toast} onDone={() => setToast("")} />}
    </div>
  );
}