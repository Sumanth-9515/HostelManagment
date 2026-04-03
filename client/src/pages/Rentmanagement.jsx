import { useEffect, useState, useCallback, useRef } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const authHeader = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${sessionStorage.getItem("token")}`,
});

const fmt = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const fmtDateTime = (d) => d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const fmtMonthYear = (d) => d ? new Date(d).toLocaleString("en-IN", { month: "long", year: "numeric" }) : "—";

const statusColor = {
  Paid: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Partial: "bg-amber-100 text-amber-800 border-amber-200",
  Due: "bg-rose-100 text-rose-800 border-rose-200",
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
    if (rem > 0) {
      arr.push({ monthYear: pm.monthYear, maxAmount: rem, label: `${fmtMonthYear(pm.dueDate)} (Arrears)` });
    }
  });
  if (record && remaining > 0) {
    arr.push({ monthYear: record.monthYear, maxAmount: remaining, label: `${fmtMonthYear(record.dueDate)} (Current)` });
  }
  return arr;
}

function buildWAMessage(tenant, record, buildingDetails) {
  const room = buildingDetails ? `Room ${buildingDetails.roomNumber}` : "your room";
  const remaining = record ? record.rentAmount - record.paidAmount : tenant.rentAmount;
  const month = record ? new Date(record.dueDate).toLocaleString("en-IN", { month: "long", year: "numeric" }) : "this month";
  return encodeURIComponent(`Hello ${tenant.name},\n\nThis is a gentle reminder that your rent of ${fmt(remaining)} for ${month} (${room}) is due.\nPlease pay at the earliest.\n\nThank you!`);
}

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
      const r = await fetch(`${API}/rent/send-reminder`, { method: "POST", headers: authHeader(), body: JSON.stringify({ tenantId }) });
      if (!r.ok) throw new Error("Failed to send email.");
      setState("sent"); timerRef.current = setTimeout(() => setState("idle"), 3000);
    } catch (err) {
      setErrMsg(err.message || "Error"); setState("error");
      timerRef.current = setTimeout(() => { setState("idle"); setErrMsg(""); }, 3000);
    }
  };

  const baseClass = "flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold border transition-all duration-200 select-none";
  if (state === "sent") return <button disabled className={`${baseClass} bg-emerald-50 border-emerald-200 text-emerald-700 ${className}`}>Sent ✓</button>;
  if (state === "error") return <button onClick={handleSend} className={`${baseClass} bg-rose-50 border-rose-200 text-rose-700 ${className}`}>Failed</button>;
  if (state === "sending") return <button disabled className={`${baseClass} bg-violet-50 border-violet-200 text-violet-500 opacity-75 ${className}`}>Sending…</button>;

  const btnStyle = hasPreviousPending ? `bg-rose-50 hover:bg-rose-500 border-rose-300 text-rose-700 hover:text-white` : `bg-violet-50 hover:bg-violet-500 border-violet-200 text-violet-700 hover:text-white`;
  return <button onClick={handleSend} className={`${baseClass} ${btnStyle} ${className}`}>{hasPreviousPending ? "⚠️ Warn Email" : "✉️ Email"}</button>;
}

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

function DueCard({ item, onSelect, onPayNow }) {
  const { tenant, record, remaining, isOverdue, daysOverdue, daysUntilDue, pendingMonths, totalAccumulatedDue, hasPreviousPending, pendingMonthsCount } = item;
  const alloc = tenant.allocationInfo || {};
  const phone = tenant.phone?.replace(/\D/g, "");
  const payable = buildPayable(pendingMonths, record, remaining);

  const handleWA = (e) => { e.stopPropagation(); window.open(`https://wa.me/91${phone}?text=${buildWAMessage(tenant, record, alloc)}`, "_blank"); };
  const handleCall = (e) => { e.stopPropagation(); window.location.href = `tel:${tenant.phone}`; };

  return (
    <div onClick={() => onSelect(tenant._id)} className="relative group cursor-pointer rounded-2xl border border-gray-200 bg-white hover:border-amber-400 hover:shadow-md transition-all duration-200 overflow-hidden">
      {hasPreviousPending ? <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-600 via-rose-400 to-rose-600 animate-pulse" /> : isOverdue ? <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-rose-400 to-rose-500" /> : <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500" />}
      
      {hasPreviousPending && (
        <div className="absolute -top-2 -right-2 z-10">
          <span className="relative flex h-6 w-6">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-6 w-6 bg-rose-600 items-center justify-center shadow-lg"><span className="text-white text-[10px] font-black leading-none">{pendingMonthsCount}</span></span>
          </span>
        </div>
      )}

      <div className="p-4 pt-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div><p className="font-bold text-gray-900 text-base leading-tight">{tenant.name}</p><p className="text-gray-500 text-xs mt-0.5">{tenant.phone}</p></div>
          <div className="flex gap-1.5 shrink-0">
            <button onClick={handleWA} className="w-8 h-8 flex items-center justify-center rounded-full bg-emerald-50 hover:bg-emerald-500 border border-emerald-200 transition-colors group">📱</button>
            <button onClick={handleCall} className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-50 hover:bg-blue-500 border border-blue-200 transition-colors group">📞</button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {alloc.buildingName && <span className="text-[11px] px-2 py-0.5 rounded-md bg-gray-100 border border-gray-200 text-gray-600">🏢 {alloc.buildingName}</span>}
          {alloc.roomNumber && <span className="text-[11px] px-2 py-0.5 rounded-md bg-gray-100 border border-gray-200 text-gray-600">🚪 Room {alloc.roomNumber}</span>}
        </div>

        <div className="flex items-end justify-between">
          <div>
            <p className="text-gray-400 text-[11px] uppercase tracking-wide">Total Accumulated Due</p>
            <p className={`text-2xl font-black ${hasPreviousPending ? "text-rose-600" : "text-gray-900"}`}>{fmt(totalAccumulatedDue)}</p>
          </div>
          <div className="text-right">
            {isOverdue ? <span className="text-rose-600 text-xs font-semibold bg-rose-50 px-2 py-1 rounded-lg border border-rose-200">⚠️ {daysOverdue}d overdue</span> : daysUntilDue !== null ? <span className="text-amber-600 text-xs font-semibold bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">🕐 Due in {daysUntilDue === 0 ? "today" : `${daysUntilDue}d`}</span> : null}
          </div>
        </div>

        {hasPreviousPending && pendingMonths.length > 0 && (
          <div className="mt-2 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 space-y-1">
            <p className="text-rose-600 text-[10px] uppercase tracking-wide font-semibold mb-1">Pending Months</p>
            {pendingMonths.slice(0, 3).map((pm) => <div key={pm.monthYear} className="flex justify-between text-[11px]"><span className="text-rose-700">{fmtMonthYear(pm.dueDate)}</span><span className="text-rose-700 font-bold">{fmt(pm.rentAmount - pm.paidAmount)}</span></div>)}
          </div>
        )}

        <div className="mt-3 flex gap-2">
          <button onClick={(e) => { e.stopPropagation(); onPayNow(tenant._id, payable, payable[0]?.monthYear); }} disabled={payable.length === 0} className={`flex-1 py-2 rounded-xl font-bold text-sm text-white transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${hasPreviousPending ? "bg-rose-500 hover:bg-rose-600 active:scale-95" : "bg-amber-500 hover:bg-amber-600 active:scale-95"}`}>
            {hasPreviousPending ? "Pay Dues" : "Pay Now"}
          </button>
          <EmailReminderButton tenantId={tenant._id} tenantEmail={tenant.email} hasPreviousPending={hasPreviousPending} pendingMonthsCount={pendingMonthsCount} className="shrink-0 px-3" />
        </div>
      </div>
    </div>
  );
}

function TenantRow({ item, onSelect, onPayNow }) {
  const { tenant, record, remaining, pendingMonths, totalAccumulatedDue, hasPreviousPending, pendingMonthsCount } = item;
  const alloc = tenant.allocationInfo || {};
  const payable = buildPayable(pendingMonths, record, remaining);
  const isFullyPaid = payable.length === 0;

  return (
    <div onClick={() => onSelect(tenant._id)} className={`relative flex items-center gap-4 px-5 py-3.5 rounded-xl border bg-white hover:shadow-sm cursor-pointer transition-all duration-150 group ${hasPreviousPending ? "border-rose-300 hover:border-rose-400 bg-rose-50/30" : "border-gray-200 hover:border-amber-300"}`}>
      {hasPreviousPending && (
        <div className="absolute -top-2 -left-2 z-10"><span className="relative flex h-5 w-5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" /><span className="relative inline-flex rounded-full h-5 w-5 bg-rose-600 items-center justify-center shadow"><span className="text-white text-[9px] font-black leading-none">{pendingMonthsCount}</span></span></span></div>
      )}
      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${hasPreviousPending ? "bg-rose-100 border border-rose-300" : "bg-amber-100 border border-amber-200"}`}>
        <span className={`font-bold text-sm ${hasPreviousPending ? "text-rose-700" : "text-amber-700"}`}>{tenant.name?.[0]?.toUpperCase()}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-gray-900 font-semibold text-sm truncate">{tenant.name}</p>
        <p className="text-gray-500 text-xs truncate">{tenant.phone} {alloc.roomNumber ? ` · Room ${alloc.roomNumber}` : ""}</p>
        {hasPreviousPending && <p className="text-rose-600 text-[10px] font-semibold mt-0.5">{pendingMonthsCount} month arrears — {fmt(totalAccumulatedDue)} total</p>}
      </div>
      <div className="text-right shrink-0">
        {hasPreviousPending ? <><span className="px-2 py-0.5 rounded-full text-xs font-semibold border bg-rose-100 text-rose-800 border-rose-200">Arrears</span><p className="text-rose-600 font-black text-sm mt-1">{fmt(totalAccumulatedDue)}</p></> : <>{pill(record?.status || "Due")}<p className="text-gray-900 font-bold text-sm mt-1">{fmt(totalAccumulatedDue)}</p></>}
      </div>
      <button onClick={(e) => { e.stopPropagation(); if (!isFullyPaid) onPayNow(tenant._id, payable, payable[0]?.monthYear); }} disabled={isFullyPaid} className={`ml-2 px-3 py-1.5 text-xs rounded-lg font-semibold disabled:opacity-30 disabled:cursor-not-allowed text-white transition-all active:scale-95 shrink-0 ${hasPreviousPending ? "bg-rose-500 hover:bg-rose-600" : "bg-amber-500 hover:bg-amber-600"}`}>Pay</button>
    </div>
  );
}

// ─── Room Allocator (used inside Edit mode) ───────────────────────────────────
function RoomAllocator({ currentAlloc, onSelect }) {
  const [buildings, setBuildings] = useState([]);
  const [selectedBuilding, setSelectedBuilding] = useState("");
  const [selectedFloor, setSelectedFloor] = useState("");
  const [selectedRoom, setSelectedRoom] = useState("");
  const [selectedBed, setSelectedBed] = useState("");
  const [loadingBuildings, setLoadingBuildings] = useState(true);

  const floors = buildings.find((b) => b._id === selectedBuilding)?.floors || [];
  const rooms = floors.find((f) => f._id === selectedFloor)?.rooms || [];
  const beds = rooms.find((r) => r._id === selectedRoom)?.beds.filter((b) => b.status === "Available") || [];

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

  // Propagate selection upward whenever bed is chosen
  useEffect(() => {
    if (!selectedBed || !selectedRoom || !selectedFloor || !selectedBuilding) return;
    const building = buildings.find((b) => b._id === selectedBuilding);
    const floor = building?.floors.find((f) => f._id === selectedFloor);
    const room = floor?.rooms.find((r) => r._id === selectedRoom);
    const bed = room?.beds.find((b) => b._id === selectedBed);
    if (building && floor && room && bed) {
      onSelect({
        buildingId: building._id,
        floorId: floor._id,
        roomId: room._id,
        bedId: bed._id,
        allocationInfo: {
          buildingName: building.buildingName,
          floorNumber: floor.floorNumber,
          roomNumber: room.roomNumber,
          bedNumber: bed.bedNumber,
        },
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
          {beds.length === 0 && selectedRoom ? <option disabled>No available beds in this room</option> : beds.map((b) => <option key={b._id} value={b._id}>Bed {b.bedNumber}</option>)}
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
          <div className="w-14 h-14 rounded-full bg-rose-100 border-2 border-rose-300 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🚪</span>
          </div>
          <h3 className="text-gray-900 font-bold text-lg mb-1">Vacate Tenant?</h3>
          <p className="text-gray-500 text-sm">
            Are you sure you want to vacate <span className="font-semibold text-gray-800">{tenantName}</span>?
          </p>
          <p className="text-rose-500 text-xs mt-2 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
            ⚠️ This will free their bed and mark them as Inactive. This action cannot be undone.
          </p>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onCancel} disabled={loading} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading} className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-sm transition-colors active:scale-95 disabled:opacity-50">
            {loading ? "Vacating…" : "Yes, Vacate"}
          </button>
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

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [editRoomMode, setEditRoomMode] = useState(false);
  const [newAllocation, setNewAllocation] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Vacate state
  const [showVacateConfirm, setShowVacateConfirm] = useState(false);
  const [vacating, setVacating] = useState(false);
  const [vacateError, setVacateError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`${API}/rent/tenant/${tenantId}`, { headers: authHeader() });
    const d = await r.json();
    setData(d); setLoading(false);
  }, [tenantId]);

  useEffect(() => { load(); }, [load, onPaymentDone]);

  // Populate edit form when data loads
  useEffect(() => {
    if (data?.tenant) {
      const t = data.tenant;
      setEditForm({
        name: t.name || "",
        phone: t.phone || "",
        email: t.email || "",
        fatherName: t.fatherName || "",
        fatherPhone: t.fatherPhone || "",
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
      // 1. Update tenant basic fields
      const r = await fetch(`${API}/tenants/${tenantId}`, {
        method: "PUT",
        headers: authHeader(),
        body: JSON.stringify({
          name: editForm.name,
          phone: editForm.phone,
          email: editForm.email,
          fatherName: editForm.fatherName,
          fatherPhone: editForm.fatherPhone,
          permanentAddress: editForm.permanentAddress,
          joiningDate: editForm.joiningDate,
          rentAmount: Number(editForm.rentAmount),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Failed to update tenant.");

      // 2. If room changed, reallocate bed
      if (editRoomMode && newAllocation) {
        const rb = await fetch(`${API}/tenants/${tenantId}/reallocate`, {
          method: "PUT",
          headers: authHeader(),
          body: JSON.stringify(newAllocation),
        });
        const rd = await rb.json();
        if (!rb.ok) throw new Error(rd.message || "Failed to reallocate bed.");
      }

      setIsEditing(false);
      setEditRoomMode(false);
      setNewAllocation(null);
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

  const handleViewDocument = (docUrl) => { if (docUrl) setViewingDoc(docUrl); };

  const inputClass = "w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900 text-sm focus:outline-none focus:border-amber-400 transition-colors";
  const readonlyClass = "w-full bg-white rounded-xl p-3 border border-gray-200";

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm">
        {/* Modal container — full screen on mobile, max-w-2xl centered on larger screens */}
        <div className="relative w-full sm:max-w-2xl h-[95dvh] sm:h-auto sm:max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden">

          {/* Sticky Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 bg-white shrink-0">
            <h2 className="text-gray-900 font-bold text-base sm:text-lg">
              {isEditing ? "✏️ Edit Tenant" : "Tenant Details"}
            </h2>
            <div className="flex items-center gap-2">
              {!isEditing && !loading && (
                <>
                  {/* Edit button */}
                  <button
                    onClick={() => { setIsEditing(true); setSaveError(""); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 hover:bg-amber-500 border border-amber-200 text-amber-700 hover:text-white transition-colors"
                  >
                    ✏️ Edit
                  </button>
                  {/* Vacate button */}
                  <button
                    onClick={() => setShowVacateConfirm(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 hover:bg-rose-500 border border-rose-200 text-rose-700 hover:text-white transition-colors"
                  >
                    🚪 Vacate
                  </button>
                </>
              )}
              {isEditing && (
                <button
                  onClick={() => { setIsEditing(false); setEditRoomMode(false); setNewAllocation(null); setSaveError(""); }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-600 transition-colors"
                >
                  ✕ Cancel
                </button>
              )}
              <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors text-lg">✕</button>
            </div>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-48"><div className="w-8 h-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" /></div>
            ) : (
              <div className="p-4 sm:p-6 space-y-5">

                {/* ── CARRY-FORWARD DUES ── */}
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
                            <div><span className="text-gray-700 text-xs font-medium">{fmtMonthYear(pm.dueDate)}</span>{pm.paidAmount > 0 && <span className="text-gray-400 text-[10px] ml-2">(paid {fmt(pm.paidAmount)})</span>}</div>
                            <div className="flex items-center gap-2">
                              {pill(pm.status)}<span className="text-rose-600 text-xs font-bold">{fmt(pmRemaining)}</span>
                              <button onClick={() => onPayNow(tenant._id, payable, pm.monthYear)} className="text-[10px] px-2 py-0.5 rounded-md bg-rose-500 hover:bg-rose-600 text-white font-bold transition-colors">Pay</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── TENANT HEADER (view mode) ── */}
                {!isEditing && (
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center shrink-0">
                      <span className="text-amber-700 font-black text-lg sm:text-xl">{tenant?.name?.[0]?.toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-gray-900 font-bold text-lg sm:text-xl truncate">{tenant?.name}</h3>
                      <p className="text-gray-500 text-sm truncate">{tenant?.email || "No email on record"}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <button onClick={() => window.open(`https://wa.me/91${phone}?text=${buildWAMessage(tenant, currentRecord, buildingDetails)}`, "_blank")} className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-600 border border-emerald-200 text-emerald-700 hover:text-white transition-colors">📱 WhatsApp</button>
                        <a href={`tel:${tenant?.phone}`} className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-blue-50 hover:bg-blue-600 border border-blue-200 text-blue-700 hover:text-white transition-colors">📞 Call</a>
                        {(currentRecord?.status !== "Paid" || hasPreviousPending) && <EmailReminderButton tenantId={tenant?._id} tenantEmail={tenant?.email} hasPreviousPending={hasPreviousPending} pendingMonthsCount={pendingMonthsCount} />}
                      </div>
                    </div>
                    <div className="text-right shrink-0 hidden sm:block">
                      <p className="text-gray-400 text-[10px] uppercase font-semibold mb-1">Grand Total Due</p>
                      <p className="text-xl font-black text-gray-900">{fmt(totalAccumulatedDue)}</p>
                    </div>
                  </div>
                )}

                {/* ── EDIT FORM ── */}
                {isEditing && (
                  <div className="space-y-4">
                    {/* Basic Info */}
                    <div>
                      <p className="text-gray-500 text-xs uppercase tracking-wide font-semibold mb-2">Basic Information</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-gray-500 text-[11px] uppercase tracking-wide">Full Name *</label>
                          <input type="text" value={editForm.name} onChange={(e) => handleEditField("name", e.target.value)} className={inputClass} placeholder="Tenant name" />
                        </div>
                        <div>
                          <label className="text-gray-500 text-[11px] uppercase tracking-wide">Phone *</label>
                          <input type="tel" value={editForm.phone} onChange={(e) => handleEditField("phone", e.target.value)} className={inputClass} placeholder="Phone number" />
                        </div>
                        <div>
                          <label className="text-gray-500 text-[11px] uppercase tracking-wide">Email</label>
                          <input type="email" value={editForm.email} onChange={(e) => handleEditField("email", e.target.value)} className={inputClass} placeholder="Email address" />
                        </div>
                        <div>
                          <label className="text-gray-500 text-[11px] uppercase tracking-wide">Monthly Rent (₹) *</label>
                          <input type="number" value={editForm.rentAmount} onChange={(e) => handleEditField("rentAmount", e.target.value)} className={inputClass} placeholder="Rent amount" />
                        </div>
                        <div>
                          <label className="text-gray-500 text-[11px] uppercase tracking-wide">Joining Date</label>
                          <input type="date" value={editForm.joiningDate} onChange={(e) => handleEditField("joiningDate", e.target.value)} className={inputClass} />
                        </div>
                        <div>
                          <label className="text-gray-500 text-[11px] uppercase tracking-wide">Permanent Address</label>
                          <input type="text" value={editForm.permanentAddress} onChange={(e) => handleEditField("permanentAddress", e.target.value)} className={inputClass} placeholder="Permanent address" />
                        </div>
                      </div>
                    </div>

                    {/* Father Details */}
                    <div>
                      <p className="text-gray-500 text-xs uppercase tracking-wide font-semibold mb-2">Father's Details</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-gray-500 text-[11px] uppercase tracking-wide">Father's Name</label>
                          <input type="text" value={editForm.fatherName} onChange={(e) => handleEditField("fatherName", e.target.value)} className={inputClass} placeholder="Father's name" />
                        </div>
                        <div>
                          <label className="text-gray-500 text-[11px] uppercase tracking-wide">Father's Phone</label>
                          <input type="tel" value={editForm.fatherPhone} onChange={(e) => handleEditField("fatherPhone", e.target.value)} className={inputClass} placeholder="Father's phone" />
                        </div>
                      </div>
                    </div>

                    {/* Room / Bed Allocation */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-gray-500 text-xs uppercase tracking-wide font-semibold">Room Allocation</p>
                        <button
                          onClick={() => { setEditRoomMode((v) => !v); setNewAllocation(null); }}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${editRoomMode ? "bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200" : "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"}`}
                        >
                          {editRoomMode ? "✕ Cancel Room Edit" : "🏠 Change Room"}
                        </button>
                      </div>

                      {/* Current allocation display */}
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
                          {newAllocation && (
                            <div className="mt-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-700 font-semibold">
                              ✅ New bed selected: {newAllocation.allocationInfo.buildingName} · Floor {newAllocation.allocationInfo.floorNumber} · Room {newAllocation.allocationInfo.roomNumber} · Bed {newAllocation.allocationInfo.bedNumber}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Save error */}
                    {saveError && (
                      <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-600">{saveError}</div>
                    )}

                    {/* Save button */}
                    <button
                      onClick={handleSaveEdit}
                      disabled={saving}
                      className="w-full py-3 rounded-xl font-bold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all text-sm"
                    >
                      {saving ? "Saving…" : "💾 Save Changes"}
                    </button>
                  </div>
                )}

                {/* ── VIEW MODE DETAILS ── */}
                {!isEditing && (
                  <>
                    {/* Father Details */}
                    {(tenant?.fatherName || tenant?.fatherPhone) && (
                      <div className="rounded-xl border border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50 p-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><span>👨‍👦</span> Father's Details</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {tenant?.fatherName && (
                            <div className="bg-white rounded-lg p-3 border border-gray-200">
                              <p className="text-gray-500 text-[10px] uppercase tracking-wide">Father's Name</p>
                              <p className="text-gray-900 font-medium text-sm">{tenant.fatherName}</p>
                            </div>
                          )}
                          {tenant?.fatherPhone && (
                            <div className="bg-white rounded-lg p-3 border border-gray-200">
                              <p className="text-gray-500 text-[10px] uppercase tracking-wide">Father's Phone</p>
                              <p className="text-gray-900 font-medium text-sm">{tenant.fatherPhone}</p>
                              <button onClick={() => window.location.href = `tel:${tenant.fatherPhone}`} className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium">📞 Call Father</button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Info Grid */}
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
                          <p className="text-gray-900 text-sm font-medium">{val || "—"}</p>
                        </div>
                      ))}
                    </div>

                    {/* Documents */}
                    {(tenant?.documents?.aadharFront || tenant?.documents?.aadharBack || tenant?.documents?.passportPhoto) && (
                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><span>📄</span> Documents</h4>
                        <div className="grid grid-cols-3 gap-3">
                          {tenant?.documents?.aadharFront && (
                            <div className="bg-white rounded-lg p-3 border border-gray-200 text-center cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleViewDocument(tenant.documents.aadharFront)}>
                              <div className="text-2xl sm:text-3xl mb-2">🪪</div>
                              <p className="text-gray-700 font-medium text-xs sm:text-sm">Aadhar Front</p>
                              <p className="text-gray-400 text-[10px] mt-1">Click to view</p>
                            </div>
                          )}
                          {tenant?.documents?.aadharBack && (
                            <div className="bg-white rounded-lg p-3 border border-gray-200 text-center cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleViewDocument(tenant.documents.aadharBack)}>
                              <div className="text-2xl sm:text-3xl mb-2">🪪</div>
                              <p className="text-gray-700 font-medium text-xs sm:text-sm">Aadhar Back</p>
                              <p className="text-gray-400 text-[10px] mt-1">Click to view</p>
                            </div>
                          )}
                          {tenant?.documents?.passportPhoto && (
                            <div className="bg-white rounded-lg p-3 border border-gray-200 text-center cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleViewDocument(tenant.documents.passportPhoto)}>
                              <div className="text-2xl sm:text-3xl mb-2">📸</div>
                              <p className="text-gray-700 font-medium text-xs sm:text-sm">Passport Photo</p>
                              <p className="text-gray-400 text-[10px] mt-1">Click to view</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Current Month Rent */}
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
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-white rounded-xl p-3 text-center border border-gray-200"><p className="text-gray-500 text-[11px]">Rent</p><p className="text-gray-900 font-bold text-sm">{fmt(currentRecord?.rentAmount || tenant?.rentAmount)}</p></div>
                        <div className="bg-white rounded-xl p-3 text-center border border-gray-200"><p className="text-gray-500 text-[11px]">Paid</p><p className="text-emerald-600 font-bold text-sm">{fmt(currentRecord?.paidAmount || 0)}</p></div>
                        <div className="bg-white rounded-xl p-3 text-center border border-gray-200"><p className="text-gray-500 text-[11px]">Remaining</p><p className={`font-bold text-sm ${remaining > 0 ? "text-rose-600" : "text-emerald-600"}`}>{fmt(remaining || 0)}</p></div>
                      </div>
                    </div>

                    {/* Payment History */}
                    <div>
                      <p className="text-gray-500 text-xs uppercase tracking-wide mb-3">Full Payment History</p>
                      {history?.length === 0 ? <p className="text-gray-400 text-sm text-center py-4">No history yet.</p> : (
                        <div className="space-y-2">
                          {history?.map((rec) => {
                            const recRemaining = rec.rentAmount - rec.paidAmount;
                            const isPending = rec.status !== "Paid";
                            return (
                              <div key={rec._id} className={`rounded-xl border px-4 py-3 flex items-center justify-between gap-2 ${isPending ? "bg-rose-50 border-rose-200" : "bg-gray-50 border-gray-200"}`}>
                                <div className="min-w-0">
                                  <p className="text-gray-900 text-sm font-semibold">{fmtMonthYear(rec.dueDate)}</p>
                                  <p className="text-gray-500 text-xs">Due: {fmtDate(rec.dueDate)}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <div className="text-right">{pill(rec.status)}<p className="text-gray-500 text-xs mt-1">{fmt(rec.paidAmount)} / {fmt(rec.rentAmount)}</p></div>
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

                {/* Bottom padding for mobile */}
                <div className="h-4" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Vacate confirmation modal */}
      {showVacateConfirm && (
        <VacateConfirmModal
          tenantName={tenant?.name}
          onConfirm={handleVacate}
          onCancel={() => { setShowVacateConfirm(false); setVacateError(""); }}
          loading={vacating}
        />
      )}
      {vacateError && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[80] bg-rose-600 text-white px-5 py-3 rounded-xl shadow-xl text-sm font-semibold">
          ❌ {vacateError}
        </div>
      )}

      {viewingDoc && <DocumentViewer imageUrl={viewingDoc} onClose={() => setViewingDoc(null)} />}
    </>
  );
}

function PayModal({ tenantId, payableMonths, initialMonthYear, onClose, onSuccess }) {
  const [selectedMonth, setSelectedMonth] = useState(initialMonthYear || payableMonths[0]?.monthYear);
  const selectedOption = payableMonths.find(m => m.monthYear === selectedMonth);
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
          <h3 className="text-gray-900 font-bold">Record Payment</h3><button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg transition-colors">✕</button>
        </div>
        <div className="p-6 space-y-4">
          {payableMonths.length > 1 ? (
             <div>
               <label className="block text-gray-600 text-xs uppercase tracking-wide mb-1.5">Select Month to Pay</label>
               <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm font-bold focus:outline-none focus:border-amber-400">
                 {payableMonths.map(m => <option key={m.monthYear} value={m.monthYear}>{m.label} — {fmt(m.maxAmount)}</option>)}
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

export default function RentManagement() {
  const [dueItems, setDueItems] = useState([]);
  const [dueLoading, setDueLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState("name");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState(null);
  const [payModal, setPayModal] = useState(null);
  const [toast, setToast] = useState("");
  const [paymentDone, setPaymentDone] = useState(0);

  const pollRef = useRef(null);

  const loadDue = useCallback(async () => {
    try {
      const r = await fetch(`${API}/rent/due`, { headers: authHeader() });
      const d = await r.json();
      if (Array.isArray(d)) setDueItems(d);
    } catch {}
    setDueLoading(false);
  }, []);

  useEffect(() => {
    loadDue();
    pollRef.current = setInterval(loadDue, 60_000);
    return () => clearInterval(pollRef.current);
  }, [loadDue, paymentDone]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearching(true); setHasSearched(true);
    try {
      const r = await fetch(`${API}/rent/search?q=${encodeURIComponent(searchQuery)}&type=${searchType}`, { headers: authHeader() });
      const d = await r.json();
      setSearchResults(Array.isArray(d) ? d : []);
    } catch { setSearchResults([]); }
    setSearching(false);
  }, [searchQuery, searchType]);

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); setHasSearched(false); return; }
    const t = setTimeout(handleSearch, 400);
    return () => clearTimeout(t);
  }, [searchQuery, handleSearch]);

  const onPayNow = (tenantId, payableMonths, initialMonthYear) => { setPayModal({ tenantId, payableMonths, initialMonthYear }); };
  const onPaySuccess = (data) => { setPayModal(null); setToast(data.message || "Payment recorded!"); setPaymentDone((n) => n + 1); if (hasSearched) handleSearch(); };

  const handleTenantUpdated = () => {
    setToast("Tenant updated successfully!");
    setPaymentDone((n) => n + 1);
    if (hasSearched) handleSearch();
    loadDue();
  };

  const summaryStats = {
    total: dueItems.length,
    overdue: dueItems.filter((i) => i.isOverdue || i.hasPreviousPending).length,
    upcoming: dueItems.filter((i) => !i.isOverdue && !i.hasPreviousPending).length,
    totalDue: dueItems.reduce((s, i) => s + (i.totalAccumulatedDue ?? i.remaining), 0),
  };

  const carryForwardCount = dueItems.filter((i) => i.hasPreviousPending).length;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <div className="border-b border-gray-200 bg-white/95 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
          <div><h1 className="text-xl font-black tracking-tight"><span className="text-amber-500">₹</span> Rent Management</h1><p className="text-gray-500 text-xs mt-0.5">Real-time hostel rent tracking</p></div>
          <div className="flex items-center gap-2">
            {carryForwardCount > 0 && <span className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-1 rounded-lg"><span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" /></span>{carryForwardCount} carry-forward</span>}
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /><span className="text-gray-500 text-xs">Live</span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-5 py-6 space-y-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Alerts", value: summaryStats.total, color: "text-gray-900" },
            { label: "Overdue / Carry-forward", value: summaryStats.overdue, color: "text-rose-600" },
            { label: "Due Soon", value: summaryStats.upcoming, color: "text-amber-600" },
            { label: "Total Pending", value: fmt(summaryStats.totalDue), color: "text-amber-600" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm"><p className="text-gray-500 text-xs uppercase tracking-wide">{label}</p><p className={`text-2xl font-black mt-1 ${color}`}>{value}</p></div>
          ))}
        </div>

        {carryForwardCount > 0 && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3.5 flex items-start gap-3">
            <span className="relative flex h-5 w-5 shrink-0 mt-0.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" /><span className="relative inline-flex rounded-full h-5 w-5 bg-rose-500 items-center justify-center"><span className="text-white text-[9px] font-black">{carryForwardCount}</span></span></span>
            <div><p className="text-rose-700 font-bold text-sm">{carryForwardCount} tenant{carryForwardCount > 1 ? "s have" : " has"} pending dues from previous months</p><p className="text-rose-500 text-xs mt-0.5">Payments are being tracked from each tenant's joining date. Cards with a red bubble indicate carry-forward arrears.</p></div>
          </div>
        )}

        <section>
          <div className="flex items-center gap-3 mb-4"><h2 className="text-gray-900 font-bold text-base">⚡ Due Alerts</h2><span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">Due within 2 days, overdue, or carry-forward arrears</span></div>
          {dueLoading ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{[1, 2, 3].map((i) => <div key={i} className="h-48 rounded-2xl bg-gray-100 border border-gray-200 animate-pulse" />)}</div> : dueItems.length === 0 ? <div className="text-center py-12 rounded-2xl border border-gray-200 bg-white/40"><p className="text-4xl mb-2">🎉</p><p className="text-gray-600 font-semibold">All clear! No dues within the next 2 days.</p></div> : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{dueItems.map((item) => <DueCard key={item.tenant._id} item={item} onSelect={setSelectedTenantId} onPayNow={onPayNow} />)}</div>}
        </section>

        <section>
          <h2 className="text-gray-900 font-bold text-base mb-4">🔍 Search Tenants</h2>
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <div className="flex rounded-xl border border-gray-200 overflow-hidden shrink-0"><button onClick={() => { setSearchType("name"); setSearchResults([]); setHasSearched(false); }} className={`px-4 py-2 text-sm font-semibold transition-colors ${searchType === "name" ? "bg-amber-500 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>By Name</button><button onClick={() => { setSearchType("room"); setSearchResults([]); setHasSearched(false); }} className={`px-4 py-2 text-sm font-semibold transition-colors ${searchType === "room" ? "bg-amber-500 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>By Room</button></div>
            <div className="flex flex-1 min-w-48 rounded-xl border border-gray-200 bg-white overflow-hidden focus-within:border-amber-400 transition-colors"><input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} placeholder={searchType === "name" ? "Enter tenant name…" : "Enter room number…"} className="flex-1 bg-transparent px-4 py-2.5 text-gray-900 text-sm focus:outline-none placeholder:text-gray-400" /><button onClick={handleSearch} className="px-4 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm transition-colors">{searching ? "…" : "Search"}</button></div>
          </div>
          {searching && <div className="flex items-center gap-2 py-4 text-gray-500 text-sm"><div className="w-4 h-4 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" /> Searching…</div>}
          {!searching && hasSearched && searchResults.length === 0 && <div className="text-center py-8 rounded-xl border border-gray-200 bg-white/40"><p className="text-gray-500 text-sm">No tenants found for "{searchQuery}"</p></div>}
          {!searching && searchResults.length > 0 && <div className="space-y-2"><p className="text-gray-500 text-xs mb-2">{searchResults.length} result{searchResults.length !== 1 ? "s" : ""} found</p>{searchResults.map((item) => <TenantRow key={item.tenant._id} item={item} onSelect={setSelectedTenantId} onPayNow={onPayNow} />)}</div>}
        </section>
      </div>

      {selectedTenantId && (
        <TenantDetailModal
          tenantId={selectedTenantId}
          onClose={() => setSelectedTenantId(null)}
          onPayNow={onPayNow}
          onPaymentDone={paymentDone}
          onTenantUpdated={handleTenantUpdated}
        />
      )}
      {payModal && <PayModal tenantId={payModal.tenantId} payableMonths={payModal.payableMonths} initialMonthYear={payModal.initialMonthYear} onClose={() => setPayModal(null)} onSuccess={onPaySuccess} />}
      {toast && <Toast msg={toast} onDone={() => setToast("")} />}
    </div>
  );
}