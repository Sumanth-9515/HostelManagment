import { useEffect, useState, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const authHeader = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${sessionStorage.getItem("token")}`,
});

const fmt = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const fmtMonthYear = (d) =>
  d ? new Date(d).toLocaleString("en-IN", { month: "long", year: "numeric" }) : "—";

// ─── Pill badge ───────────────────────────────────────────────────────────────
const statusPill = (status) => {
  const map = {
    Active:   "bg-emerald-100 text-emerald-800 border-emerald-200",
    Inactive: "bg-gray-100 text-gray-500 border-gray-200",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${map[status] || map.Active}`}>
      {status}
    </span>
  );
};

const rentPill = (status) => {
  const map = {
    Paid:    "bg-emerald-100 text-emerald-800 border-emerald-200",
    Partial: "bg-amber-100 text-amber-800 border-amber-200",
    Due:     "bg-rose-100 text-rose-800 border-rose-200",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${map[status] || map.Due}`}>
      {status}
    </span>
  );
};

// ─── Profile Image Full Popup ─────────────────────────────────────────────────
function ProfileImagePopup({ imageUrl, name, onClose }) {
  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
      onClick={onClose}
    >
      <div className="relative flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/40 text-white text-lg font-bold transition-colors z-10 border border-white/30"
        >✕</button>
        <div className="w-64 h-64 sm:w-80 sm:h-80 rounded-full overflow-hidden border-4 border-white/30 shadow-2xl">
          <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
        </div>
        {name && <p className="text-white font-bold text-lg tracking-wide drop-shadow-lg">{name}</p>}
        <button
          onClick={() => window.open(imageUrl, "_blank")}
          className="text-white/70 hover:text-white text-xs font-semibold underline underline-offset-2 transition-colors"
        >🔗 Open full size</button>
      </div>
    </div>
  );
}

// ─── Document Viewer ──────────────────────────────────────────────────────────
function DocumentViewer({ imageUrl, onClose }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      <div className="relative max-w-4xl max-h-[90vh] w-full" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-12 right-0 text-white hover:text-gray-300 text-2xl">✕</button>
        <button
          onClick={() => window.open(imageUrl, "_blank")}
          className="absolute -top-12 right-12 text-white hover:text-gray-300 text-sm bg-white/20 px-3 py-1 rounded-lg"
        >🔗 Open in new tab</button>
        <img src={imageUrl} alt="Document" className="w-full h-full object-contain rounded-lg" />
      </div>
    </div>
  );
}

// ─── Vacate Confirm Modal ─────────────────────────────────────────────────────
function VacateConfirmModal({ tenantName, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden">
        <div className="px-6 pt-6 pb-4 text-center">
          <div className="w-14 h-14 rounded-full bg-rose-100 border-2 border-rose-300 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🚪</span>
          </div>
          <h3 className="text-gray-900 font-bold text-lg mb-1">Vacate Tenant?</h3>
          <p className="text-gray-500 text-sm">
            Are you sure you want to vacate{" "}
            <span className="font-semibold text-gray-800">{tenantName}</span>?
          </p>
          <p className="text-rose-500 text-xs mt-2 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
            ⚠️ This will free their bed and mark them as Inactive. This cannot be undone.
          </p>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
          >Cancel</button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-sm transition-colors active:scale-95 disabled:opacity-50"
          >{loading ? "Vacating…" : "Yes, Vacate"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Room Allocator ───────────────────────────────────────────────────────────
function RoomAllocator({ onSelect }) {
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
        allocationInfo: {
          buildingName: building.buildingName,
          floorNumber:  floor.floorNumber,
          roomNumber:   room.roomNumber,
          bedNumber:    bed.bedNumber,
        },
      });
    }
  }, [selectedBed]);

  const sc = "w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-amber-400 disabled:bg-gray-50 disabled:text-gray-400";

  if (loadingBuildings) return <div className="text-xs text-gray-400 animate-pulse py-2">Loading buildings…</div>;

  return (
    <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
      <p className="text-amber-700 text-xs font-semibold uppercase tracking-wide mb-1">Select New Bed</p>
      <div>
        <label className="text-gray-500 text-[11px] uppercase tracking-wide">Building</label>
        <select value={selectedBuilding} onChange={(e) => { setSelectedBuilding(e.target.value); setSelectedFloor(""); setSelectedRoom(""); setSelectedBed(""); onSelect(null); }} className={sc}>
          <option value="">— Choose Building —</option>
          {buildings.map((b) => <option key={b._id} value={b._id}>{b.buildingName}</option>)}
        </select>
      </div>
      <div>
        <label className="text-gray-500 text-[11px] uppercase tracking-wide">Floor</label>
        <select value={selectedFloor} onChange={(e) => { setSelectedFloor(e.target.value); setSelectedRoom(""); setSelectedBed(""); onSelect(null); }} disabled={!selectedBuilding} className={sc}>
          <option value="">— Choose Floor —</option>
          {floors.map((f) => <option key={f._id} value={f._id}>{f.floorName || `Floor ${f.floorNumber}`}</option>)}
        </select>
      </div>
      <div>
        <label className="text-gray-500 text-[11px] uppercase tracking-wide">Room</label>
        <select value={selectedRoom} onChange={(e) => { setSelectedRoom(e.target.value); setSelectedBed(""); onSelect(null); }} disabled={!selectedFloor} className={sc}>
          <option value="">— Choose Room —</option>
          {rooms.map((r) => <option key={r._id} value={r._id}>Room {r.roomNumber} ({r.shareType}-share)</option>)}
        </select>
      </div>
      <div>
        <label className="text-gray-500 text-[11px] uppercase tracking-wide">Available Bed</label>
        <select value={selectedBed} onChange={(e) => setSelectedBed(e.target.value)} disabled={!selectedRoom} className={sc}>
          <option value="">— Choose Bed —</option>
          {beds.length === 0 && selectedRoom
            ? <option disabled>No available beds in this room</option>
            : beds.map((b) => <option key={b._id} value={b._id}>Bed {b.bedNumber}</option>)
          }
        </select>
      </div>
    </div>
  );
}

// ─── Candidate Detail Modal ───────────────────────────────────────────────────
function CandidateDetailModal({ tenantId, onClose, onCandidateUpdated }) {
  const [data, setData]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [viewingDoc, setViewingDoc] = useState(null);
  const [showProfilePopup, setShowProfilePopup] = useState(false);

  // Edit state
  const [isEditing, setIsEditing]     = useState(false);
  const [editForm, setEditForm]       = useState({});
  const [editRoomMode, setEditRoomMode] = useState(false);
  const [newAllocation, setNewAllocation] = useState(null);
  const [saving, setSaving]           = useState(false);
  const [saveError, setSaveError]     = useState("");

  // Doc re-upload
  const [docFiles, setDocFiles]       = useState({ aadharFront: null, aadharBack: null, passportPhoto: null });
  const [docPreviews, setDocPreviews] = useState({ aadharFront: null, aadharBack: null, passportPhoto: null });

  // Vacate state
  const [showVacateConfirm, setShowVacateConfirm] = useState(false);
  const [vacating, setVacating]       = useState(false);
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
    try {
      const r = await fetch(`${API}/rent/tenant/${tenantId}`, { headers: authHeader() });
      const d = await r.json();
      setData(d);
    } catch {}
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (data?.tenant) {
      const t = data.tenant;
      setEditForm({
        name:             t.name || "",
        phone:            t.phone || "",
        email:            t.email || "",
        fatherName:       t.fatherName || "",
        fatherPhone:      t.fatherPhone || "",
        permanentAddress: t.permanentAddress || "",
        joiningDate:      t.joiningDate ? t.joiningDate.slice(0, 10) : "",
        rentAmount:       t.rentAmount || "",
      });
    }
  }, [data]);

  const handleEditField = (key, val) => setEditForm((f) => ({ ...f, [key]: val }));

  const resetEditState = () => {
    setIsEditing(false); setEditRoomMode(false); setNewAllocation(null); setSaveError("");
    setDocFiles({ aadharFront: null, aadharBack: null, passportPhoto: null });
    setDocPreviews({ aadharFront: null, aadharBack: null, passportPhoto: null });
  };

  const handleSaveEdit = async () => {
    setSaving(true); setSaveError("");
    try {
      const fd = new FormData();
      fd.append("name",             editForm.name);
      fd.append("phone",            editForm.phone);
      fd.append("email",            editForm.email || "");
      fd.append("fatherName",       editForm.fatherName || "");
      fd.append("fatherPhone",      editForm.fatherPhone || "");
      fd.append("permanentAddress", editForm.permanentAddress);
      fd.append("joiningDate",      editForm.joiningDate);
      fd.append("rentAmount",       editForm.rentAmount);
      if (docFiles.aadharFront)   fd.append("aadharFront",   docFiles.aadharFront);
      if (docFiles.aadharBack)    fd.append("aadharBack",    docFiles.aadharBack);
      if (docFiles.passportPhoto) fd.append("passportPhoto", docFiles.passportPhoto);

      const r = await fetch(`${API}/tenants/${tenantId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${sessionStorage.getItem("token")}` },
        body: fd,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Failed to update.");

      if (editRoomMode && newAllocation) {
        const rb = await fetch(`${API}/tenants/${tenantId}/reallocate`, {
          method: "PUT",
          headers: authHeader(),
          body: JSON.stringify(newAllocation),
        });
        const rd = await rb.json();
        if (!rb.ok) throw new Error(rd.message || "Failed to reallocate bed.");
      }

      resetEditState();
      await load();
      if (onCandidateUpdated) onCandidateUpdated("Candidate updated successfully!");
    } catch (e) { setSaveError(e.message); }
    setSaving(false);
  };

  const handleVacate = async () => {
    setVacating(true); setVacateError("");
    try {
      const r = await fetch(`${API}/tenants/${tenantId}/vacate`, { method: "DELETE", headers: authHeader() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Failed to vacate.");
      setShowVacateConfirm(false);
      if (onCandidateUpdated) onCandidateUpdated("Tenant vacated successfully!");
      onClose();
    } catch (e) { setVacateError(e.message); }
    setVacating(false);
  };

  const handleViewDocument = (url) => { if (url) setViewingDoc(url); };

  if (!data && !loading) return null;

  const { tenant, buildingDetails, currentRecord, remaining, history, pendingMonths, arrearsTotal, totalAccumulatedDue, hasPreviousPending, pendingMonthsCount } = data || {};
  const phone        = tenant?.phone?.replace(/\D/g, "");
  const passportPhoto = tenant?.documents?.passportPhoto;
  const inputClass   = "w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900 text-sm focus:outline-none focus:border-amber-400 transition-colors";

  return (
    <>
      <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm">
        <div className="relative w-full sm:max-w-2xl h-[95dvh] sm:h-auto sm:max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden">

          {/* ── STICKY HEADER ── */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 bg-white shrink-0">
            <h2 className="text-gray-900 font-bold text-base sm:text-lg">
              {isEditing ? "✏️ Edit Candidate" : "👤 Candidate Details"}
            </h2>
            <div className="flex items-center gap-2">
              {!isEditing && !loading && (
                <>
                  <button
                    onClick={() => { setIsEditing(true); setSaveError(""); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 hover:bg-amber-500 border border-amber-200 text-amber-700 hover:text-white transition-colors"
                  >✏️ Edit</button>
                  <button
                    onClick={() => setShowVacateConfirm(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 hover:bg-rose-500 border border-rose-200 text-rose-700 hover:text-white transition-colors"
                  >🚪 Vacate</button>
                </>
              )}
              {isEditing && (
                <button
                  onClick={resetEditState}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-600 transition-colors"
                >✕ Cancel</button>
              )}
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors text-lg"
              >✕</button>
            </div>
          </div>

          {/* ── SCROLLABLE BODY ── */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <div className="w-8 h-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
              </div>
            ) : (
              <div className="p-4 sm:p-6 space-y-5">

                {/* ── PENDING DUES BANNER ── */}
                {!isEditing && hasPreviousPending && (
                  <div className="rounded-2xl border-2 border-rose-300 bg-rose-50 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="relative flex h-4 w-4 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500" />
                      </span>
                      <h4 className="text-rose-700 font-bold text-sm">
                        {pendingMonthsCount} Month{pendingMonthsCount > 1 ? "s" : ""} Unpaid
                      </h4>
                    </div>
                    <p className="text-rose-400 text-xs uppercase tracking-wide">Total Arrears</p>
                    <p className="text-rose-600 text-2xl font-black">{fmt(arrearsTotal)}</p>
                    <div className="mt-3 space-y-1.5">
                      {pendingMonths?.map((pm) => {
                        const rem = pm.rentAmount - pm.paidAmount;
                        return (
                          <div key={pm.monthYear} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-rose-200">
                            <span className="text-gray-700 text-xs font-medium">{fmtMonthYear(pm.dueDate)}</span>
                            <div className="flex items-center gap-2">
                              {rentPill(pm.status)}
                              <span className="text-rose-600 text-xs font-bold">{fmt(rem)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── TENANT HEADER (view) ── */}
                {!isEditing && (
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="relative shrink-0">
                      <div
                        onClick={() => passportPhoto && setShowProfilePopup(true)}
                        title={passportPhoto ? "Click to view profile photo" : undefined}
                        className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden border-2 flex items-center justify-center
                          ${passportPhoto ? "border-amber-300 cursor-pointer hover:opacity-80 hover:scale-105 transition-all duration-150 shadow-md" : "border-amber-200 bg-amber-100"}`}
                      >
                        {passportPhoto
                          ? <img src={passportPhoto} alt={tenant?.name} className="w-full h-full object-cover" />
                          : <span className="text-amber-700 font-black text-lg sm:text-xl">{tenant?.name?.[0]?.toUpperCase()}</span>
                        }
                      </div>
                      {passportPhoto && (
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-amber-500 border-2 border-white flex items-center justify-center">
                          <span className="text-[9px]">👁</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-gray-900 font-bold text-lg sm:text-xl truncate">{tenant?.name}</h3>
                        {statusPill(tenant?.status)}
                      </div>
                      <p className="text-gray-500 text-sm truncate mt-0.5">{tenant?.email || "No email on record"}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <button
                          onClick={() => window.open(`https://wa.me/91${phone}`, "_blank")}
                          className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-600 border border-emerald-200 text-emerald-700 hover:text-white transition-colors"
                        >📱 WhatsApp</button>
                        <a
                          href={`tel:${tenant?.phone}`}
                          className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-blue-50 hover:bg-blue-600 border border-blue-200 text-blue-700 hover:text-white transition-colors"
                        >📞 Call</a>
                      </div>
                    </div>
                    <div className="text-right shrink-0 hidden sm:block">
                      <p className="text-gray-400 text-[10px] uppercase font-semibold mb-1">Total Due</p>
                      <p className="text-xl font-black text-gray-900">{fmt(totalAccumulatedDue || 0)}</p>
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
                        {[
                          { label: "Full Name *",        key: "name",             type: "text",   placeholder: "Tenant name" },
                          { label: "Phone *",            key: "phone",            type: "tel",    placeholder: "Phone number" },
                          { label: "Email",              key: "email",            type: "email",  placeholder: "Email address" },
                          { label: "Monthly Rent (₹) *", key: "rentAmount",       type: "number", placeholder: "Rent amount" },
                          { label: "Joining Date",       key: "joiningDate",      type: "date",   placeholder: "" },
                          { label: "Permanent Address",  key: "permanentAddress", type: "text",   placeholder: "Permanent address" },
                        ].map(({ label, key, type, placeholder }) => (
                          <div key={key}>
                            <label className="text-gray-500 text-[11px] uppercase tracking-wide">{label}</label>
                            <input
                              type={type}
                              value={editForm[key] || ""}
                              onChange={(e) => handleEditField(key, e.target.value)}
                              className={inputClass}
                              placeholder={placeholder}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Father's Details */}
                    <div>
                      <p className="text-gray-500 text-xs uppercase tracking-wide font-semibold mb-2">Father's Details</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-gray-500 text-[11px] uppercase tracking-wide">Father's Name</label>
                          <input type="text" value={editForm.fatherName || ""} onChange={(e) => handleEditField("fatherName", e.target.value)} className={inputClass} placeholder="Father's name" />
                        </div>
                        <div>
                          <label className="text-gray-500 text-[11px] uppercase tracking-wide">Father's Phone</label>
                          <input type="tel" value={editForm.fatherPhone || ""} onChange={(e) => handleEditField("fatherPhone", e.target.value)} className={inputClass} placeholder="Father's phone" />
                        </div>
                      </div>
                    </div>

                    {/* Document Re-upload */}
                    <div>
                      <p className="text-gray-500 text-xs uppercase tracking-wide font-semibold mb-2">Documents</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                          { field: "aadharFront",   label: "Aadhar Front",   icon: "🪪" },
                          { field: "aadharBack",    label: "Aadhar Back",    icon: "🪪" },
                          { field: "passportPhoto", label: "Passport Photo", icon: "📷" },
                        ].map(({ field, label, icon }) => {
                          const existingUrl = tenant?.documents?.[field];
                          const previewUrl  = docPreviews[field];
                          const hasNew      = !!docFiles[field];
                          return (
                            <div key={field} className="rounded-xl border border-gray-200 bg-gray-50 p-3 flex flex-col gap-2">
                              <p className="text-gray-600 text-[11px] uppercase tracking-wide font-semibold">{icon} {label}</p>
                              <div className="relative w-full h-20 rounded-lg overflow-hidden border border-gray-200 bg-white flex items-center justify-center">
                                {previewUrl ? (
                                  <>
                                    <img src={previewUrl} alt={label} className="w-full h-full object-cover" />
                                    <span className="absolute top-1 right-1 text-[9px] font-bold bg-amber-500 text-white px-1.5 py-0.5 rounded-full">NEW</span>
                                  </>
                                ) : existingUrl ? (
                                  <img src={existingUrl} alt={label} className="w-full h-full object-cover cursor-pointer hover:opacity-80" onClick={() => handleViewDocument(existingUrl)} title="Click to view" />
                                ) : (
                                  <span className="text-gray-300 text-3xl">{icon}</span>
                                )}
                              </div>
                              <div className="flex gap-1.5">
                                <label className="flex-1 flex items-center justify-center gap-1 cursor-pointer text-[11px] font-semibold px-2 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition-colors">
                                  📁 {existingUrl || hasNew ? "Re-upload" : "Upload"}
                                  <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf" className="hidden" onChange={(e) => handleDocFileChange(field, e.target.files[0])} />
                                </label>
                                {hasNew && (
                                  <button onClick={() => clearDocFile(field)} className="px-2 py-1.5 rounded-lg bg-gray-100 border border-gray-200 text-gray-500 hover:bg-gray-200 text-[11px] font-semibold">✕</button>
                                )}
                                {existingUrl && !hasNew && (
                                  <button onClick={() => handleViewDocument(existingUrl)} className="px-2 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 text-[11px] font-semibold">👁</button>
                                )}
                              </div>
                              {hasNew && <p className="text-[10px] text-amber-600 font-medium truncate">📎 {docFiles[field].name}</p>}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Room Allocation */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-gray-500 text-xs uppercase tracking-wide font-semibold">Room Allocation</p>
                        <button
                          onClick={() => { setEditRoomMode((v) => !v); setNewAllocation(null); }}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${editRoomMode ? "bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200" : "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"}`}
                        >{editRoomMode ? "✕ Cancel Room Edit" : "🏠 Change Room"}</button>
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
                          <RoomAllocator onSelect={setNewAllocation} />
                          {newAllocation && (
                            <div className="mt-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-700 font-semibold">
                              ✅ {newAllocation.allocationInfo.buildingName} · Floor {newAllocation.allocationInfo.floorNumber} · Room {newAllocation.allocationInfo.roomNumber} · Bed {newAllocation.allocationInfo.bedNumber}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {saveError && (
                      <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-600">{saveError}</div>
                    )}
                    <button
                      onClick={handleSaveEdit}
                      disabled={saving}
                      className="w-full py-3 rounded-xl font-bold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all text-sm"
                    >{saving ? "Saving…" : "💾 Save Changes"}</button>
                  </div>
                )}

                {/* ── VIEW MODE DETAILS ── */}
                {!isEditing && (
                  <>
                    {/* Father's Details */}
                    {(tenant?.fatherName || tenant?.fatherPhone) && (
                      <div className="rounded-xl border border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50 p-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">👨‍👦 Father's Details</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {tenant.fatherName && (
                            <div className="bg-white rounded-lg p-3 border border-gray-200">
                              <p className="text-gray-500 text-[10px] uppercase tracking-wide">Father's Name</p>
                              <p className="text-gray-900 font-medium text-sm">{tenant.fatherName}</p>
                            </div>
                          )}
                          {tenant.fatherPhone && (
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
                        ["Phone",             tenant?.phone],
                        ["Email",             tenant?.email],
                        ["Joining Date",      fmtDate(tenant?.joiningDate)],
                        ["Monthly Rent",      fmt(tenant?.rentAmount)],
                        ["Advance Paid",      tenant?.advanceAmount ? fmt(tenant.advanceAmount) : null],
                        ["Permanent Address", tenant?.permanentAddress],
                        buildingDetails && ["Building",  buildingDetails.buildingName],
                        buildingDetails && ["Floor",     `Floor ${buildingDetails.floorNumber}`],
                        buildingDetails && ["Room",      `Room ${buildingDetails.roomNumber}`],
                        buildingDetails?.bedNumber && ["Bed", `Bed ${buildingDetails.bedNumber}`],
                      ].filter(Boolean).filter(([, v]) => v).map(([label, val]) => (
                        <div key={label} className="rounded-xl bg-gray-50 border border-gray-200 p-3">
                          <p className="text-gray-500 text-[11px] uppercase tracking-wide mb-0.5">{label}</p>
                          <p className="text-gray-900 text-sm font-medium">{val}</p>
                        </div>
                      ))}
                    </div>

                    {/* Documents */}
                    {(tenant?.documents?.aadharFront || tenant?.documents?.aadharBack || tenant?.documents?.passportPhoto) && (
                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">📄 Documents</h4>
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { field: "aadharFront",   label: "Aadhar Front",   icon: "🪪", isPhoto: false },
                            { field: "aadharBack",    label: "Aadhar Back",    icon: "🪪", isPhoto: false },
                            { field: "passportPhoto", label: "Passport Photo", icon: null,  isPhoto: true  },
                          ].map(({ field, label, icon, isPhoto }) => {
                            const url = tenant?.documents?.[field];
                            if (!url) return null;
                            return (
                              <div
                                key={field}
                                className="bg-white rounded-lg p-3 border border-gray-200 text-center cursor-pointer hover:shadow-md transition-shadow"
                                onClick={() => isPhoto ? setShowProfilePopup(true) : handleViewDocument(url)}
                              >
                                {isPhoto ? (
                                  <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-amber-200 mx-auto mb-2">
                                    <img src={url} alt="Passport" className="w-full h-full object-cover" />
                                  </div>
                                ) : (
                                  <div className="text-2xl sm:text-3xl mb-2">{icon}</div>
                                )}
                                <p className="text-gray-700 font-medium text-xs sm:text-sm">{label}</p>
                                <p className="text-gray-400 text-[10px] mt-1">Click to view</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Rent Summary */}
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                        <div>
                          <p className="text-gray-500 text-xs uppercase tracking-wide">Current Month</p>
                          <p className="text-gray-900 font-bold text-lg">{currentRecord ? fmtMonthYear(currentRecord.dueDate) : "—"}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {rentPill(currentRecord?.status || "Due")}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-white rounded-xl p-3 text-center border border-gray-200">
                          <p className="text-gray-500 text-[11px]">Rent</p>
                          <p className="text-gray-900 font-bold text-sm">{fmt(currentRecord?.rentAmount || tenant?.rentAmount)}</p>
                        </div>
                        <div className="bg-white rounded-xl p-3 text-center border border-gray-200">
                          <p className="text-gray-500 text-[11px]">Paid</p>
                          <p className="text-emerald-600 font-bold text-sm">{fmt(currentRecord?.paidAmount || 0)}</p>
                        </div>
                        <div className="bg-white rounded-xl p-3 text-center border border-gray-200">
                          <p className="text-gray-500 text-[11px]">Remaining</p>
                          <p className={`font-bold text-sm ${(remaining || 0) > 0 ? "text-rose-600" : "text-emerald-600"}`}>{fmt(remaining || 0)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Payment History */}
                    {history && history.length > 0 && (
                      <div>
                        <p className="text-gray-500 text-xs uppercase tracking-wide mb-3">Payment History</p>
                        <div className="space-y-2">
                          {history.map((rec) => {
                            const recRem = rec.rentAmount - rec.paidAmount;
                            return (
                              <div key={rec._id} className={`rounded-xl border px-4 py-3 flex items-center justify-between gap-2 ${rec.status !== "Paid" ? "bg-rose-50 border-rose-200" : "bg-gray-50 border-gray-200"}`}>
                                <div className="min-w-0">
                                  <p className="text-gray-900 text-sm font-semibold">{fmtMonthYear(rec.dueDate)}</p>
                                  <p className="text-gray-500 text-xs">Due: {fmtDate(rec.dueDate)}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <div className="text-right">
                                    {rentPill(rec.status)}
                                    <p className="text-gray-500 text-xs mt-1">{fmt(rec.paidAmount)} / {fmt(rec.rentAmount)}</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <div className="h-4" />
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showProfilePopup && passportPhoto && (
        <ProfileImagePopup imageUrl={passportPhoto} name={tenant?.name} onClose={() => setShowProfilePopup(false)} />
      )}
      {showVacateConfirm && (
        <VacateConfirmModal
          tenantName={tenant?.name}
          onConfirm={handleVacate}
          onCancel={() => { setShowVacateConfirm(false); setVacateError(""); }}
          loading={vacating}
        />
      )}
      {vacateError && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[95] bg-rose-600 text-white px-5 py-3 rounded-xl shadow-xl text-sm font-semibold">
          ❌ {vacateError}
        </div>
      )}
      {viewingDoc && <DocumentViewer imageUrl={viewingDoc} onClose={() => setViewingDoc(null)} />}
    </>
  );
}

// ─── Mobile Card ──────────────────────────────────────────────────────────────
function CandidateCard({ tenant, rentInfo, onViewMore, onPhotoClick }) {
  const alloc    = tenant.allocationInfo || {};
  const photo    = tenant.documents?.passportPhoto;
  const initials = tenant.name?.[0]?.toUpperCase();
  const isOverdue = rentInfo?.hasPreviousPending;

  return (
    <div className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden
      ${isOverdue ? "border-rose-300 hover:border-rose-400" : "border-gray-200 hover:border-amber-300"}`}>
      {/* Top accent bar */}
      <div className={`h-1 w-full ${
        isOverdue
          ? "bg-gradient-to-r from-rose-400 to-rose-600"
          : tenant.status === "Active"
            ? "bg-gradient-to-r from-emerald-400 to-emerald-500"
            : "bg-gray-300"
      }`} />

      <div className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-xl overflow-hidden border-2 flex items-center justify-center shrink-0
              ${photo ? "border-amber-300 cursor-pointer hover:scale-110 hover:shadow-md transition-all" : "border-amber-200 bg-amber-100"}`}
            onClick={() => photo && onPhotoClick?.(photo, tenant.name)}
          >
            {photo
              ? <img src={photo} alt={tenant.name} className="w-full h-full object-cover" />
              : <span className="text-amber-700 font-black text-base">{initials}</span>
            }
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-gray-900 font-bold text-sm truncate">{tenant.name}</p>
              {statusPill(tenant.status)}
            </div>
            <p className="text-gray-500 text-xs mt-0.5 truncate">{tenant.phone}</p>
            {tenant.email && <p className="text-gray-400 text-[11px] truncate">{tenant.email}</p>}
          </div>
        </div>

        {/* Rent Status badge (prominent if overdue) */}
        {rentInfo && (
          <div className={`rounded-xl px-3 py-2 border flex items-center justify-between
            ${isOverdue ? "bg-rose-50 border-rose-200" : "bg-gray-50 border-gray-100"}`}>
            <div>
              <p className="text-[10px] uppercase tracking-wide font-semibold text-gray-400">Rent Status</p>
              <div className="mt-0.5"><RentStatusBadge rentInfo={rentInfo} /></div>
            </div>
            {rentInfo.totalAccumulatedDue > 0 && (
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wide font-semibold text-gray-400">Due</p>
                <p className="text-rose-600 font-bold text-sm">{fmt(rentInfo.totalAccumulatedDue)}</p>
              </div>
            )}
          </div>
        )}

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
            <p className="text-gray-400 text-[10px] uppercase tracking-wide">Joining</p>
            <p className="text-gray-800 text-xs font-semibold mt-0.5">{fmtDate(tenant.joiningDate)}</p>
          </div>
          <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
            <p className="text-amber-500 text-[10px] uppercase tracking-wide">Rent</p>
            <p className="text-gray-800 text-xs font-semibold mt-0.5">{fmt(tenant.rentAmount)}</p>
          </div>
          <div className="col-span-2 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
            <p className="text-gray-400 text-[10px] uppercase tracking-wide">Room Allocated</p>
            <p className="text-gray-800 text-xs font-semibold mt-0.5">
              {alloc.buildingName
                ? `${alloc.buildingName} · Floor ${alloc.floorNumber} · Room ${alloc.roomNumber}${alloc.bedNumber ? ` · Bed ${alloc.bedNumber}` : ""}`
                : <span className="text-gray-400 italic">Not allocated</span>
              }
            </p>
          </div>
        </div>

        {/* Action */}
        <button
          onClick={() => onViewMore(tenant._id)}
          className="w-full py-2 rounded-xl text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 active:scale-95 transition-all"
        >👁 View More</button>
      </div>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className="fixed bottom-6 right-6 z-[80] flex items-center gap-3 bg-emerald-600 border border-emerald-500 text-white px-5 py-3 rounded-2xl shadow-xl">
      <span className="text-lg">✅</span>
      <span className="font-semibold text-sm">{msg}</span>
    </div>
  );
}

// ─── Rent Status Badge ────────────────────────────────────────────────────────
function RentStatusBadge({ rentInfo, size = "sm" }) {
  if (!rentInfo) return <span className="text-gray-300 text-xs">—</span>;
  const { hasPreviousPending, currentRecord } = rentInfo;
  const curStatus = currentRecord?.status || "Due";

  if (hasPreviousPending) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border border-rose-300 bg-rose-100 text-rose-700">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
        </span>
        Overdue
      </span>
    );
  }
  if (curStatus === "Paid") {
    return <span className="px-2 py-0.5 rounded-full text-xs font-bold border border-emerald-200 bg-emerald-100 text-emerald-700">✓ Paid</span>;
  }
  if (curStatus === "Partial") {
    return <span className="px-2 py-0.5 rounded-full text-xs font-bold border border-amber-200 bg-amber-100 text-amber-700">Partial</span>;
  }
  // Due
  return <span className="px-2 py-0.5 rounded-full text-xs font-bold border border-rose-200 bg-rose-50 text-rose-600">Due</span>;
}

// ─── Arrears Summary cell ─────────────────────────────────────────────────────
function ArrearCell({ rentInfo }) {
  if (!rentInfo) return <span className="text-gray-300 text-xs">—</span>;
  const { hasPreviousPending, arrearsTotal, totalAccumulatedDue, currentRecord } = rentInfo;
  const curStatus = currentRecord?.status || "Due";
  const remaining = (currentRecord?.rentAmount || 0) - (currentRecord?.paidAmount || 0);
  if (!hasPreviousPending && curStatus === "Paid") {
    return <span className="text-emerald-500 text-xs font-semibold">Clear</span>;
  }
  return (
    <div>
      <p className="text-rose-600 font-bold text-sm">{fmt(totalAccumulatedDue)}</p>
      {hasPreviousPending && (
        <p className="text-rose-400 text-[10px] mt-0.5">Arrears: {fmt(arrearsTotal)}</p>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CandidatesManagement() {
  const location = useLocation();

  const [tenants, setTenants]           = useState([]);
  const [rentMap, setRentMap]           = useState(new Map()); // tenantId → rentSummary
  const [loading, setLoading]           = useState(true);

  const [searchQuery, setSearchQuery]   = useState("");
  const [searchType, setSearchType]     = useState("name");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching]       = useState(false);
  const [hasSearched, setHasSearched]   = useState(false);

  const [selectedId, setSelectedId]     = useState(null);
  const [toast, setToast]               = useState("");
  const [refreshKey, setRefreshKey]     = useState(0);

  // Photo popup from table
  const [tablePhotoPopup, setTablePhotoPopup] = useState(null); // {imageUrl, name}

  // ── Load tenants + rent status in parallel ────────────────────────────────
  const loadTenants = useCallback(async () => {
    setLoading(true);
    try {
      const [tr, rr] = await Promise.all([
        fetch(`${API}/tenants`, { headers: authHeader() }).then((r) => r.json()),
        fetch(`${API}/rent/all`,  { headers: authHeader() }).then((r) => r.json()),
      ]);
      setTenants(Array.isArray(tr) ? tr : []);
      if (Array.isArray(rr)) {
        const map = new Map();
        rr.forEach((item) => {
          if (item.tenant?._id) map.set(item.tenant._id.toString(), item);
        });
        setRentMap(map);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadTenants(); }, [loadTenants, refreshKey]);

  // ── Auto-filter when navigated from notification with a candidate name ────
  // Runs after tenants are loaded — filters directly from the loaded list
  useEffect(() => {
    const candidateName = location.state?.candidateName;
    if (candidateName && tenants.length > 0) {
      setSearchType("name");
      setSearchQuery(candidateName);
      const filtered = tenants.filter((t) =>
        t.name?.toLowerCase().includes(candidateName.toLowerCase())
      );
      setSearchResults(filtered);
      setHasSearched(true);
    }
  }, [tenants, location.state]);

  const getRentInfo = (tenantId) => rentMap.get(tenantId?.toString()) || null;

  // ── Search ─────────────────────────────────────────────────────────────────
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearching(true); setHasSearched(true);
    try {
      const r = await fetch(
        `${API}/rent/search?q=${encodeURIComponent(searchQuery)}&type=${searchType}`,
        { headers: authHeader() }
      );
      const d = await r.json();
      setSearchResults(Array.isArray(d) ? d.map((item) => item.tenant) : []);
    } catch { setSearchResults([]); }
    setSearching(false);
  }, [searchQuery, searchType]);

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); setHasSearched(false); return; }
    const t = setTimeout(handleSearch, 400);
    return () => clearTimeout(t);
  }, [searchQuery, handleSearch]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const rentValues = [...rentMap.values()];
  const stats = {
    active:   tenants.filter((t) => t.status === "Active").length,
    inactive: tenants.filter((t) => t.status === "Inactive").length,
    dues:     rentValues.filter((r) => !r.hasPreviousPending && r.currentRecord?.status !== "Paid").length,
    overdues: rentValues.filter((r) => r.hasPreviousPending).length,
  };

  // ── Sort rank for active tenants ──────────────────────────────────────────
  const rentRank = (tenantId) => {
    const ri = getRentInfo(tenantId);
    if (!ri) return 3;
    if (ri.hasPreviousPending) return 0;
    if (ri.currentRecord?.status === "Due")     return 1;
    if (ri.currentRecord?.status === "Partial") return 2;
    return 3; // Paid
  };

  // ── Derived lists ─────────────────────────────────────────────────────────
  const sourceList = hasSearched ? searchResults : tenants;
  const activeList = sourceList
    .filter((t) => t.status === "Active")
    .sort((a, b) => rentRank(a._id) - rentRank(b._id));
  const inactiveList = sourceList.filter((t) => t.status === "Inactive");

  const handleCandidateUpdated = (msg) => {
    setToast(msg || "Updated!");
    setRefreshKey((k) => k + 1);
    if (hasSearched) handleSearch();
  };

  // ── Table header helper ───────────────────────────────────────────────────
  const TH = ({ children, className = "" }) => (
    <th className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 border-b border-gray-200 ${className}`}>
      {children}
    </th>
  );

  // ── Shared table row renderer ─────────────────────────────────────────────
  const renderRow = (tenant, isInactive = false) => {
    const alloc    = tenant.allocationInfo || {};
    const photo    = tenant.documents?.passportPhoto;
    const rentInfo = getRentInfo(tenant._id);
    const rowBg    = isInactive
      ? "hover:bg-gray-50/60 opacity-70"
      : rentInfo?.hasPreviousPending
        ? "hover:bg-rose-50/40 bg-rose-50/10"
        : "hover:bg-amber-50/40";

    return (
      <tr key={tenant._id} className={`transition-colors group ${rowBg}`}>
        {/* Candidate */}
        <td className="px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl overflow-hidden border-2 flex items-center justify-center shrink-0
                ${photo ? "border-amber-200 cursor-pointer hover:scale-110 hover:shadow-md transition-all" : "border-amber-100 bg-amber-50"}`}
              onClick={() => photo && setTablePhotoPopup({ imageUrl: photo, name: tenant.name })}
              title={photo ? "Click to enlarge photo" : undefined}
            >
              {photo
                ? <img src={photo} alt={tenant.name} className="w-full h-full object-cover" />
                : <span className="text-amber-600 font-black text-sm">{tenant.name?.[0]?.toUpperCase()}</span>
              }
            </div>
            <div className="min-w-0">
              <p className="text-gray-900 font-semibold text-sm truncate max-w-[150px]">{tenant.name}</p>
              <div className="mt-0.5">{statusPill(tenant.status)}</div>
            </div>
          </div>
        </td>

        {/* Phone / Email */}
        <td className="px-4 py-3.5">
          <p className="text-gray-800 text-sm font-medium">{tenant.phone}</p>
          {tenant.email
            ? <p className="text-gray-400 text-xs mt-0.5 truncate max-w-[180px]">{tenant.email}</p>
            : <p className="text-gray-300 text-xs mt-0.5 italic">No email</p>
          }
        </td>

        {/* Joining Date */}
        <td className="px-4 py-3.5">
          <p className="text-gray-700 text-sm">{fmtDate(tenant.joiningDate)}</p>
        </td>

        {/* Rent */}
        <td className="px-4 py-3.5">
          <p className="text-gray-900 font-bold text-sm">{fmt(tenant.rentAmount)}</p>
          {tenant.advanceAmount > 0 && (
            <p className="text-gray-400 text-[11px] mt-0.5">Adv: {fmt(tenant.advanceAmount)}</p>
          )}
        </td>

        {/* Rent Status */}
        <td className="px-4 py-3.5">
          <div className="flex flex-col gap-1">
            <RentStatusBadge rentInfo={rentInfo} />
            <ArrearCell rentInfo={rentInfo} />
          </div>
        </td>

        {/* Room */}
        <td className="px-4 py-3.5">
          {alloc.buildingName ? (
            <div>
              <p className="text-gray-800 text-sm font-medium">{alloc.buildingName}</p>
              <p className="text-gray-400 text-xs mt-0.5">
                Floor {alloc.floorNumber} · Room {alloc.roomNumber}
                {alloc.bedNumber ? ` · Bed ${alloc.bedNumber}` : ""}
              </p>
            </div>
          ) : (
            <span className="text-gray-300 text-sm italic">Not allocated</span>
          )}
        </td>

        {/* Actions */}
        <td className="px-4 py-3.5 text-right">
          <button
            onClick={() => setSelectedId(tenant._id)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 hover:bg-amber-500 border border-amber-200 text-amber-700 hover:text-white transition-colors group-hover:shadow-sm"
          >👁 View</button>
        </td>
      </tr>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">

      {/* ── PAGE HEADER ── */}
      <div className="border-b border-gray-200 bg-white/95 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-black tracking-tight">
              <span className="text-amber-500">👥</span> Candidates Management
            </h1>
            <p className="text-gray-500 text-xs mt-0.5">All registered tenant candidates</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {stats.overdues > 0 && (
              <span className="hidden sm:flex items-center gap-1.5 text-xs bg-rose-100 border border-rose-200 text-rose-700 px-3 py-1.5 rounded-lg font-bold">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                </span>
                {stats.overdues} Overdue
              </span>
            )}
            <span className="hidden sm:flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-lg font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              {stats.active} Active
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── STATS STRIP (4 cards only) ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Total Active */}
          <div className="rounded-2xl border border-emerald-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-gray-500 text-xs uppercase tracking-wide">Total Active</p>
            <p className="text-2xl font-black mt-1 text-emerald-600">{stats.active}</p>
            <p className="text-gray-400 text-[10px] mt-0.5">Current tenants</p>
          </div>

          {/* Dues (this month) */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 px-5 py-4 shadow-sm">
            <p className="text-gray-500 text-xs uppercase tracking-wide">Dues</p>
            <p className="text-2xl font-black mt-1 text-amber-600">{stats.dues}</p>
            <p className="text-gray-400 text-[10px] mt-0.5">Current month unpaid</p>
          </div>

          {/* Overdues (pending arrears) */}
          <div className="rounded-2xl border border-rose-300 bg-rose-50 px-5 py-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-gray-500 text-xs uppercase tracking-wide">Overdues</p>
              {stats.overdues > 0 && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                </span>
              )}
            </div>
            <p className="text-2xl font-black text-rose-600">{stats.overdues}</p>
            <p className="text-gray-400 text-[10px] mt-0.5">Pending arrears</p>
          </div>

          {/* Inactive */}
          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-gray-500 text-xs uppercase tracking-wide">Inactive</p>
            <p className="text-2xl font-black mt-1 text-gray-400">{stats.inactive}</p>
            <p className="text-gray-400 text-[10px] mt-0.5">Vacated / left</p>
          </div>
        </div>

        {/* ── SEARCH BAR ── */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex rounded-xl border border-gray-200 overflow-hidden shrink-0">
            {["name", "room"].map((type) => (
              <button
                key={type}
                onClick={() => { setSearchType(type); setSearchResults([]); setHasSearched(false); setSearchQuery(""); }}
                className={`px-4 py-2 text-sm font-semibold transition-colors capitalize ${searchType === type ? "bg-amber-500 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
              >By {type === "name" ? "Name" : "Room"}</button>
            ))}
          </div>

          <div className="flex flex-1 min-w-0 rounded-xl border border-gray-200 bg-white overflow-hidden focus-within:border-amber-400 transition-colors">
            <span className="px-3 flex items-center text-gray-400 text-base shrink-0">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder={searchType === "name" ? "Search by tenant name…" : "Search by room number…"}
              className="flex-1 bg-transparent py-2.5 pr-3 text-gray-900 text-sm focus:outline-none placeholder:text-gray-400"
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(""); setSearchResults([]); setHasSearched(false); }} className="px-3 text-gray-400 hover:text-gray-600 text-sm">✕</button>
            )}
            <button onClick={handleSearch} className="px-4 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm transition-colors shrink-0">
              {searching ? "…" : "Search"}
            </button>
          </div>
        </div>

        {/* Search feedback */}
        {searching && (
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <div className="w-4 h-4 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" /> Searching…
          </div>
        )}
        {!searching && hasSearched && searchResults.length === 0 && (
          <div className="text-center py-8 rounded-xl border border-gray-200 bg-white/60">
            <p className="text-gray-500 text-sm">No candidates found for "{searchQuery}"</p>
          </div>
        )}

        {/* ── LOADING SKELETON ── */}
        {loading && (
          <>
            <div className="hidden lg:block rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
              <div className="animate-pulse">
                <div className="h-12 bg-gray-50 border-b border-gray-200" />
                {[1,2,3,4,5].map((i) => (
                  <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-gray-100">
                    <div className="w-10 h-10 rounded-xl bg-gray-200 shrink-0" />
                    <div className="flex-1 space-y-2"><div className="h-3 bg-gray-200 rounded w-1/3" /><div className="h-2.5 bg-gray-100 rounded w-1/4" /></div>
                    <div className="h-3 bg-gray-200 rounded w-24" />
                    <div className="h-3 bg-gray-200 rounded w-16" />
                    <div className="h-6 bg-gray-200 rounded-full w-16" />
                    <div className="h-3 bg-gray-200 rounded w-32" />
                    <div className="h-8 bg-gray-200 rounded-lg w-16" />
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:hidden">
              {[1,2,3].map((i) => <div key={i} className="h-52 rounded-2xl bg-gray-100 border border-gray-200 animate-pulse" />)}
            </div>
          </>
        )}

        {/* ── EMPTY STATE ── */}
        {!loading && activeList.length === 0 && inactiveList.length === 0 && !hasSearched && (
          <div className="text-center py-16 rounded-2xl border border-gray-200 bg-white">
            <p className="text-5xl mb-3">👥</p>
            <p className="text-gray-600 font-semibold text-lg">No candidates yet</p>
            <p className="text-gray-400 text-sm mt-1">Add tenants to see them here.</p>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            ACTIVE CANDIDATES TABLE
        ══════════════════════════════════════════════════════════════════ */}
        {!loading && activeList.length > 0 && (
          <div className="space-y-2">
            {/* Section header */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                  Active Candidates
                </h2>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  {activeList.length}
                </span>
              </div>
              {stats.overdues > 0 && (
                <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500" />
                  </span>
                  Overdue rows sorted first
                </span>
              )}
            </div>

            {/* Desktop Table */}
            <div className="hidden lg:block rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
              <table className="w-full">
                <thead>
                  <tr>
                    <TH>Candidate</TH>
                    <TH>Phone / Email</TH>
                    <TH>Joining Date</TH>
                    <TH>Rent</TH>
                    <TH>Rent Status</TH>
                    <TH>Room Allocated</TH>
                    <TH className="text-right">Actions</TH>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {activeList.map((tenant) => renderRow(tenant, false))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:hidden">
              {activeList.map((tenant) => (
                <CandidateCard
                  key={tenant._id}
                  tenant={tenant}
                  rentInfo={getRentInfo(tenant._id)}
                  onViewMore={setSelectedId}
                  onPhotoClick={(url, name) => setTablePhotoPopup({ imageUrl: url, name })}
                />
              ))}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            INACTIVE CANDIDATES  (separate container, at bottom)
        ══════════════════════════════════════════════════════════════════ */}
        {!loading && inactiveList.length > 0 && (
          <div className="space-y-2">
            {/* Section header */}
            <div className="flex items-center gap-2 pt-2">
              <div className="flex-1 h-px bg-gray-200" />
              <div className="flex items-center gap-2 px-3">
                <span className="w-2.5 h-2.5 rounded-full bg-gray-300 inline-block" />
                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide">
                  Inactive / Vacated
                </h2>
                <span className="text-xs font-bold text-gray-400 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">
                  {inactiveList.length}
                </span>
              </div>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Desktop Table */}
            <div className="hidden lg:block rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm opacity-75">
              <table className="w-full">
                <thead>
                  <tr>
                    <TH>Candidate</TH>
                    <TH>Phone / Email</TH>
                    <TH>Joining Date</TH>
                    <TH>Rent</TH>
                    <TH>Rent Status</TH>
                    <TH>Room Allocated</TH>
                    <TH className="text-right">Actions</TH>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {inactiveList.map((tenant) => renderRow(tenant, true))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:hidden">
              {inactiveList.map((tenant) => (
                <CandidateCard
                  key={tenant._id}
                  tenant={tenant}
                  rentInfo={null}
                  onViewMore={setSelectedId}
                  onPhotoClick={(url, name) => setTablePhotoPopup({ imageUrl: url, name })}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── DETAIL MODAL ── */}
      {selectedId && (
        <CandidateDetailModal
          tenantId={selectedId}
          onClose={() => setSelectedId(null)}
          onCandidateUpdated={handleCandidateUpdated}
        />
      )}

      {/* ── TABLE PHOTO POPUP ── */}
      {tablePhotoPopup && (
        <ProfileImagePopup
          imageUrl={tablePhotoPopup.imageUrl}
          name={tablePhotoPopup.name}
          onClose={() => setTablePhotoPopup(null)}
        />
      )}

      {/* ── TOAST ── */}
      {toast && <Toast msg={toast} onDone={() => setToast("")} />}
    </div>
  );
}