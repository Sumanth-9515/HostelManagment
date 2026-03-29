/**
 * RentManagement.jsx
 *
 * Drop this file into your pages or components folder.
 * Expects: localStorage.getItem("token") for auth header.
 * API base: import.meta.env.VITE_API_URL  (e.g. http://localhost:5000)
 *
 * Register route in app:
 *   import rentRoutes from "./routes/rentRoutes.js";
 *   app.use("/api/rent", rentRoutes);
 */

import { useEffect, useState, useCallback, useRef } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

const authHeader = () => ({
  "Content-Type": "application/json",
  // Change localStorage to sessionStorage here:
  Authorization: `Bearer ${sessionStorage.getItem("token")}`, 
});

// ─── tiny helpers ────────────────────────────────────────────────────────────
const fmt = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const fmtDateTime = (d) =>
  d
    ? new Date(d).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

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

// ─── WhatsApp message builder ────────────────────────────────────────────────
function buildWAMessage(tenant, record, buildingDetails) {
  const room = buildingDetails
    ? `Room ${buildingDetails.roomNumber}, Floor ${buildingDetails.floorNumber}, ${buildingDetails.buildingName}`
    : "your room";
  const remaining = record ? record.rentAmount - record.paidAmount : tenant.rentAmount;
  const month = record
    ? new Date(record.dueDate).toLocaleString("en-IN", { month: "long", year: "numeric" })
    : new Date().toLocaleString("en-IN", { month: "long", year: "numeric" });

  return encodeURIComponent(
    `Hello ${tenant.name},\n\nThis is a gentle reminder that your rent of ${fmt(remaining)} for ${month} (${room}) is due.\n\nPlease make the payment at the earliest.\n\nThank you!`
  );
}

// ─── Document Viewer Modal ────────────────────────────────────────────────────
function DocumentViewer({ imageUrl, onClose }) {
  const handleOpenInNewTab = () => {
    window.open(imageUrl, "_blank");
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={onClose}>
      <div className="relative max-w-4xl max-h-[90vh] w-full" onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors text-2xl"
        >
          ✕
        </button>
        
        {/* Open in new tab button */}
        <button
          onClick={handleOpenInNewTab}
          className="absolute -top-12 right-12 text-white hover:text-gray-300 transition-colors text-sm bg-white/20 px-3 py-1 rounded-lg"
        >
          🔗 Open in new tab
        </button>
        
        {/* Image */}
        <img
          src={imageUrl}
          alt="Document"
          className="w-full h-full object-contain rounded-lg"
        />
      </div>
    </div>
  );
}

// ─── DueCard component ───────────────────────────────────────────────────────
function DueCard({ item, onSelect, onPayNow }) {
  const { tenant, record, remaining, isOverdue, daysOverdue, daysUntilDue } = item;
  const alloc = tenant.allocationInfo || {};
  const phone = tenant.phone?.replace(/\D/g, "");

  const handleWA = (e) => {
    e.stopPropagation();
    const msg = buildWAMessage(tenant, record, alloc);
    window.open(`https://wa.me/91${phone}?text=${msg}`, "_blank");
  };

  const handleCall = (e) => {
    e.stopPropagation();
    window.location.href = `tel:${tenant.phone}`;
  };

  return (
    <div
      onClick={() => onSelect(tenant._id)}
      className="relative group cursor-pointer rounded-2xl border border-gray-200 bg-white hover:border-amber-400 hover:shadow-md transition-all duration-200 overflow-hidden"
    >
      {/* overdue strip */}
      {isOverdue && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-rose-400 to-rose-500" />
      )}
      {!isOverdue && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500" />
      )}

      <div className="p-4 pt-5">
        {/* top row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <p className="font-bold text-gray-900 text-base leading-tight">{tenant.name}</p>
            <p className="text-gray-500 text-xs mt-0.5">{tenant.phone}</p>
          </div>
          <div className="flex gap-1.5 shrink-0">
            {/* WhatsApp */}
            <button
              onClick={handleWA}
              title="Send WhatsApp reminder"
              className="w-8 h-8 flex items-center justify-center rounded-full bg-emerald-50 hover:bg-emerald-500 border border-emerald-200 transition-colors group"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-emerald-600 group-hover:fill-white">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
            </button>
            {/* Call */}
            <button
              onClick={handleCall}
              title="Call tenant"
              className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-50 hover:bg-blue-500 border border-blue-200 transition-colors group"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-blue-600 group-hover:fill-white">
                <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.01L6.6 10.8z" />
              </svg>
            </button>
          </div>
        </div>

        {/* allocation */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {alloc.buildingName && (
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-gray-100 border border-gray-200 text-gray-600">
              🏢 {alloc.buildingName}
            </span>
          )}
          {alloc.roomNumber && (
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-gray-100 border border-gray-200 text-gray-600">
              🚪 Room {alloc.roomNumber}
            </span>
          )}
          {alloc.floorNumber !== undefined && (
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-gray-100 border border-gray-200 text-gray-600">
              📍 Floor {alloc.floorNumber}
            </span>
          )}
        </div>

        {/* rent info */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-gray-400 text-[11px] uppercase tracking-wide">To Pay</p>
            <p className="text-2xl font-black text-gray-900">{fmt(remaining)}</p>
            {record?.paidAmount > 0 && (
              <p className="text-[11px] text-gray-500">Paid: {fmt(record.paidAmount)}</p>
            )}
          </div>
          <div className="text-right">
            {isOverdue ? (
              <span className="text-rose-600 text-xs font-semibold bg-rose-50 px-2 py-1 rounded-lg border border-rose-200">
                ⚠️ {daysOverdue}d overdue
              </span>
            ) : (
              <span className="text-amber-600 text-xs font-semibold bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">
                🕐 Due in {daysUntilDue === 0 ? "today" : `${daysUntilDue}d`}
              </span>
            )}
          </div>
        </div>

        {/* pay button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPayNow(tenant._id, record?.monthYear, remaining);
          }}
          className="mt-3 w-full py-2 rounded-xl font-bold text-sm bg-amber-500 hover:bg-amber-600 active:scale-95 text-white transition-all duration-150"
        >
          Pay Now
        </button>
      </div>
    </div>
  );
}

// ─── TenantRow (search results) ──────────────────────────────────────────────
function TenantRow({ item, onSelect, onPayNow }) {
  const { tenant, record, remaining } = item;
  const alloc = tenant.allocationInfo || {};

  return (
    <div
      onClick={() => onSelect(tenant._id)}
      className="flex items-center gap-4 px-5 py-3.5 rounded-xl border border-gray-200 bg-white hover:border-amber-300 hover:shadow-sm cursor-pointer transition-all duration-150 group"
    >
      <div className="w-10 h-10 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center shrink-0">
        <span className="text-amber-700 font-bold text-sm">{tenant.name?.[0]?.toUpperCase()}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-gray-900 font-semibold text-sm truncate">{tenant.name}</p>
        <p className="text-gray-500 text-xs truncate">
          {tenant.phone}
          {alloc.roomNumber ? ` · Room ${alloc.roomNumber}` : ""}
          {alloc.buildingName ? ` · ${alloc.buildingName}` : ""}
        </p>
      </div>
      <div className="text-right shrink-0">
        {pill(record?.status || "Due")}
        <p className="text-gray-900 font-bold text-sm mt-1">{fmt(remaining)}</p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (record?.status !== "Paid") onPayNow(tenant._id, record?.monthYear, remaining);
        }}
        disabled={record?.status === "Paid"}
        className="ml-2 px-3 py-1.5 text-xs rounded-lg font-semibold bg-amber-500 hover:bg-amber-600 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-all active:scale-95 shrink-0"
      >
        Pay
      </button>
    </div>
  );
}

// ─── Tenant Detail Modal ──────────────────────────────────────────────────────
function TenantDetailModal({ tenantId, onClose, onPayNow, onPaymentDone }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewingDoc, setViewingDoc] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`${API}/api/rent/tenant/${tenantId}`, { headers: authHeader() });
    const d = await r.json();
    setData(d);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    load();
  }, [load, onPaymentDone]);

  if (!data && !loading) return null;

  const { tenant, buildingDetails, currentRecord, remaining, history } = data || {};
  const phone = tenant?.phone?.replace(/\D/g, "");

  const handleWA = () => {
    const msg = buildWAMessage(tenant, currentRecord, buildingDetails);
    window.open(`https://wa.me/91${phone}?text=${msg}`, "_blank");
  };

  const handleViewDocument = (docUrl) => {
    if (docUrl) {
      setViewingDoc(docUrl);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl">
          {/* header */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
            <h2 className="text-gray-900 font-bold text-lg">Tenant Details</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
            >
              ✕
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-8 h-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
            </div>
          ) : (
            <div className="p-6 space-y-6">
              {/* Profile */}
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center shrink-0">
                  <span className="text-amber-700 font-black text-xl">{tenant?.name?.[0]?.toUpperCase()}</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-gray-900 font-bold text-xl">{tenant?.name}</h3>
                  <p className="text-gray-500 text-sm">{tenant?.email || "No email"}</p>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={handleWA}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-600 border border-emerald-200 text-emerald-700 hover:text-white transition-colors"
                    >
                      <span>📱</span> WhatsApp
                    </button>
                    <a
                      href={`tel:${tenant?.phone}`}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-blue-50 hover:bg-blue-600 border border-blue-200 text-blue-700 hover:text-white transition-colors"
                    >
                      <span>📞</span> Call
                    </a>
                  </div>
                </div>
                <div className="text-right">
                  {pill(currentRecord?.status || "Due")}
                </div>
              </div>

              {/* Father's Details Section */}
              {(tenant?.fatherName || tenant?.fatherPhone) && (
                <div className="rounded-xl border border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50 p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <span>👨‍👦</span> Father's Details
                  </h4>
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
                        <button
                          onClick={() => window.location.href = `tel:${tenant.fatherPhone}`}
                          className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium"
                        >
                          📞 Call Father
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Info grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  ["Phone", tenant?.phone],
                  ["Joining Date", fmtDate(tenant?.joiningDate)],
                  ["Monthly Rent", fmt(tenant?.rentAmount)],
                  ["Permanent Address", tenant?.permanentAddress],
                  buildingDetails && ["Building", buildingDetails.buildingName],
                  buildingDetails && ["Floor", `Floor ${buildingDetails.floorNumber}${buildingDetails.floorName ? ` (${buildingDetails.floorName})` : ""}`],
                  buildingDetails && ["Room", `Room ${buildingDetails.roomNumber}`],
                  buildingDetails && ["Share Type", `${buildingDetails.shareType}-sharing`],
                ]
                  .filter(Boolean)
                  .map(([label, val]) => (
                    <div key={label} className="rounded-xl bg-gray-50 border border-gray-200 p-3">
                      <p className="text-gray-500 text-[11px] uppercase tracking-wide mb-0.5">{label}</p>
                      <p className="text-gray-900 text-sm font-medium">{val || "—"}</p>
                    </div>
                  ))}
              </div>

              {/* Documents Section */}
              {(tenant?.documents?.aadharFront || tenant?.documents?.aadharBack || tenant?.documents?.passportPhoto) && (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <span>📄</span> Documents
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {tenant?.documents?.aadharFront && (
                      <div className="bg-white rounded-lg p-3 border border-gray-200 text-center cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleViewDocument(tenant.documents.aadharFront)}>
                        <div className="text-3xl mb-2">🪪</div>
                        <p className="text-gray-700 font-medium text-sm">Aadhar Front</p>
                        <p className="text-gray-400 text-xs mt-1">Click to view</p>
                      </div>
                    )}
                    {tenant?.documents?.aadharBack && (
                      <div className="bg-white rounded-lg p-3 border border-gray-200 text-center cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleViewDocument(tenant.documents.aadharBack)}>
                        <div className="text-3xl mb-2">🪪</div>
                        <p className="text-gray-700 font-medium text-sm">Aadhar Back</p>
                        <p className="text-gray-400 text-xs mt-1">Click to view</p>
                      </div>
                    )}
                    {tenant?.documents?.passportPhoto && (
                      <div className="bg-white rounded-lg p-3 border border-gray-200 text-center cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleViewDocument(tenant.documents.passportPhoto)}>
                        <div className="text-3xl mb-2">📸</div>
                        <p className="text-gray-700 font-medium text-sm">Passport Photo</p>
                        <p className="text-gray-400 text-xs mt-1">Click to view</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Current month payment */}
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wide">Current Month</p>
                    <p className="text-gray-900 font-bold text-lg">
                      {currentRecord
                        ? new Date(currentRecord.dueDate).toLocaleString("en-IN", { month: "long", year: "numeric" })
                        : "—"}
                    </p>
                    <p className="text-gray-500 text-xs">Due: {fmtDate(currentRecord?.dueDate)}</p>
                  </div>
                  {currentRecord?.status !== "Paid" && (
                    <button
                      onClick={() => onPayNow(tenant._id, currentRecord?.monthYear, remaining)}
                      className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm active:scale-95 transition-all"
                    >
                      Pay Now
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-white rounded-xl p-3 text-center border border-gray-200">
                    <p className="text-gray-500 text-[11px]">Rent</p>
                    <p className="text-gray-900 font-bold">{fmt(currentRecord?.rentAmount || tenant?.rentAmount)}</p>
                  </div>
                  <div className="bg-white rounded-xl p-3 text-center border border-gray-200">
                    <p className="text-gray-500 text-[11px]">Paid</p>
                    <p className="text-emerald-600 font-bold">{fmt(currentRecord?.paidAmount || 0)}</p>
                  </div>
                  <div className="bg-white rounded-xl p-3 text-center border border-gray-200">
                    <p className="text-gray-500 text-[11px]">Remaining</p>
                    <p className={`font-bold ${remaining > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                      {fmt(remaining || 0)}
                    </p>
                  </div>
                </div>

                {/* partial payments of this month */}
                {currentRecord?.payments?.length > 0 && (
                  <div className="mt-4">
                    <p className="text-gray-500 text-xs uppercase tracking-wide mb-2">Payments This Month</p>
                    <div className="space-y-1.5">
                      {currentRecord.payments.map((p, i) => (
                        <div key={i} className="flex items-center justify-between text-sm px-3 py-2 rounded-lg bg-white border border-gray-200">
                          <span className="text-gray-500 text-xs">{fmtDateTime(p.paidAt)}</span>
                          <span className="text-gray-900 font-semibold">{fmt(p.amount)}</span>
                          {p.note && <span className="text-gray-400 text-xs italic">{p.note}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Payment History */}
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wide mb-3">Full Payment History</p>
                {history?.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-4">No history yet.</p>
                ) : (
                  <div className="space-y-2">
                    {history?.map((rec) => (
                      <div
                        key={rec._id}
                        className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 flex items-center justify-between"
                      >
                        <div>
                          <p className="text-gray-900 text-sm font-semibold">
                            {new Date(rec.dueDate).toLocaleString("en-IN", { month: "long", year: "numeric" })}
                          </p>
                          <p className="text-gray-500 text-xs">Due: {fmtDate(rec.dueDate)}</p>
                        </div>
                        <div className="text-right">
                          {pill(rec.status)}
                          <p className="text-gray-500 text-xs mt-1">
                            {fmt(rec.paidAmount)} / {fmt(rec.rentAmount)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Document Viewer Modal */}
      {viewingDoc && (
        <DocumentViewer
          imageUrl={viewingDoc}
          onClose={() => setViewingDoc(null)}
        />
      )}
    </>
  );
}

// ─── Pay Modal ────────────────────────────────────────────────────────────────
function PayModal({ tenantId, monthYear, maxAmount, onClose, onSuccess }) {
  const [amount, setAmount] = useState(maxAmount || "");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handlePay = async () => {
    const val = Number(amount);
    if (!val || val <= 0) return setError("Enter a valid amount.");
    if (val > maxAmount) return setError(`Amount cannot exceed remaining due of ${fmt(maxAmount)}.`);

    setLoading(true);
    setError("");
    try {
      const r = await fetch(`${API}/api/rent/pay`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({ tenantId, amount: val, note, monthYear }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      onSuccess(d);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-gray-900 font-bold">Record Payment</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg transition-colors">✕</button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Remaining Due</p>
            <p className="text-3xl font-black text-amber-600">{fmt(maxAmount)}</p>
          </div>

          <div>
            <label className="block text-gray-600 text-xs uppercase tracking-wide mb-1.5">
              Amount Paid (₹)
            </label>
            <input
              ref={inputRef}
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handlePay()}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-lg font-bold focus:outline-none focus:border-amber-400 transition-colors placeholder:text-gray-400"
              placeholder="0"
              min="1"
              max={maxAmount}
            />
          </div>

          <div>
            <label className="block text-gray-600 text-xs uppercase tracking-wide mb-1.5">
              Note (optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-amber-400 transition-colors placeholder:text-gray-400"
              placeholder="Cash, UPI, etc."
            />
          </div>

          {error && (
            <p className="text-rose-600 text-sm bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            onClick={handlePay}
            disabled={loading}
            className="w-full py-3 rounded-xl font-bold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all text-base"
          >
            {loading ? "Processing…" : "Confirm Payment"}
          </button>

          <p className="text-gray-400 text-xs text-center">
            Partial payments allowed. Remaining balance will carry forward.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="fixed bottom-6 right-6 z-[70] flex items-center gap-3 bg-emerald-600 border border-emerald-500 text-white px-5 py-3 rounded-2xl shadow-xl animate-bounce-once">
      <span className="text-lg">✅</span>
      <span className="font-semibold text-sm">{msg}</span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function RentManagement() {
  const [dueItems, setDueItems] = useState([]);
  const [dueLoading, setDueLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState("name"); // "name" | "room"
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [selectedTenantId, setSelectedTenantId] = useState(null);
  const [payModal, setPayModal] = useState(null); // { tenantId, monthYear, maxAmount }
  const [toast, setToast] = useState("");
  const [paymentDone, setPaymentDone] = useState(0); // counter to trigger re-fetch

  const pollRef = useRef(null);

  // ── Load due cards ──────────────────────────────────────────────────────────
  const loadDue = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/rent/due`, { headers: authHeader() });
      const d = await r.json();
      if (Array.isArray(d)) setDueItems(d);
    } catch {}
    setDueLoading(false);
  }, []);

  useEffect(() => {
    loadDue();
    // Poll every 60 seconds for real-time feel
    pollRef.current = setInterval(loadDue, 60_000);
    return () => clearInterval(pollRef.current);
  }, [loadDue, paymentDone]);

  // ── Search ──────────────────────────────────────────────────────────────────
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setHasSearched(true);
    try {
      const r = await fetch(
        `${API}/api/rent/search?q=${encodeURIComponent(searchQuery)}&type=${searchType}`,
        { headers: authHeader() }
      );
      const d = await r.json();
      setSearchResults(Array.isArray(d) ? d : []);
    } catch {
      setSearchResults([]);
    }
    setSearching(false);
  }, [searchQuery, searchType]);

  // Live search on type for names
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }
    const t = setTimeout(handleSearch, 400);
    return () => clearTimeout(t);
  }, [searchQuery, handleSearch]);

  const onPayNow = (tenantId, monthYear, remaining) => {
    setPayModal({ tenantId, monthYear, maxAmount: remaining });
  };

  const onPaySuccess = (data) => {
    setPayModal(null);
    setToast(data.message || "Payment recorded!");
    setPaymentDone((n) => n + 1);
    // Re-run search if active
    if (hasSearched) handleSearch();
  };

  const summaryStats = {
    total: dueItems.length,
    overdue: dueItems.filter((i) => i.isOverdue).length,
    upcoming: dueItems.filter((i) => !i.isOverdue).length,
    totalDue: dueItems.reduce((s, i) => s + i.remaining, 0),
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* ── Header ── */}
      <div className="border-b border-gray-200 bg-white/95 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black tracking-tight">
              <span className="text-amber-500">₹</span> Rent Management
            </h1>
            <p className="text-gray-500 text-xs mt-0.5">Real-time hostel rent tracking</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-gray-500 text-xs">Live</span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-5 py-6 space-y-8">

        {/* ── Summary Stats ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Alerts", value: summaryStats.total, color: "text-gray-900" },
            { label: "Overdue", value: summaryStats.overdue, color: "text-rose-600" },
            { label: "Due Soon", value: summaryStats.upcoming, color: "text-amber-600" },
            { label: "Total Pending", value: fmt(summaryStats.totalDue), color: "text-amber-600" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
              <p className="text-gray-500 text-xs uppercase tracking-wide">{label}</p>
              <p className={`text-2xl font-black mt-1 ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* ── Due / Upcoming Cards ── */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-gray-900 font-bold text-base">⚡ Due Alerts</h2>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">
              Due within 2 days or overdue
            </span>
          </div>

          {dueLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-48 rounded-2xl bg-gray-100 border border-gray-200 animate-pulse" />
              ))}
            </div>
          ) : dueItems.length === 0 ? (
            <div className="text-center py-12 rounded-2xl border border-gray-200 bg-white/40">
              <p className="text-4xl mb-2">🎉</p>
              <p className="text-gray-600 font-semibold">All clear! No dues within the next 2 days.</p>
              <p className="text-gray-400 text-sm mt-1">Check back later or use search below.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {dueItems.map((item) => (
                <DueCard
                  key={item.tenant._id}
                  item={item}
                  onSelect={setSelectedTenantId}
                  onPayNow={onPayNow}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── Search ── */}
        <section>
          <h2 className="text-gray-900 font-bold text-base mb-4">🔍 Search Tenants</h2>

          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            {/* Type toggle */}
            <div className="flex rounded-xl border border-gray-200 overflow-hidden shrink-0">
              <button
                onClick={() => { setSearchType("name"); setSearchResults([]); setHasSearched(false); }}
                className={`px-4 py-2 text-sm font-semibold transition-colors ${
                  searchType === "name"
                    ? "bg-amber-500 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                By Name
              </button>
              <button
                onClick={() => { setSearchType("room"); setSearchResults([]); setHasSearched(false); }}
                className={`px-4 py-2 text-sm font-semibold transition-colors ${
                  searchType === "room"
                    ? "bg-amber-500 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                By Room
              </button>
            </div>

            {/* Search input */}
            <div className="flex flex-1 min-w-48 rounded-xl border border-gray-200 bg-white overflow-hidden focus-within:border-amber-400 transition-colors">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder={searchType === "name" ? "Enter tenant name…" : "Enter room number…"}
                className="flex-1 bg-transparent px-4 py-2.5 text-gray-900 text-sm focus:outline-none placeholder:text-gray-400"
              />
              <button
                onClick={handleSearch}
                className="px-4 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm transition-colors"
              >
                {searching ? "…" : "Search"}
              </button>
            </div>
          </div>

          {/* Results */}
          {searching && (
            <div className="flex items-center gap-2 py-4 text-gray-500 text-sm">
              <div className="w-4 h-4 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
              Searching…
            </div>
          )}

          {!searching && hasSearched && searchResults.length === 0 && (
            <div className="text-center py-8 rounded-xl border border-gray-200 bg-white/40">
              <p className="text-gray-500 text-sm">No tenants found for "{searchQuery}"</p>
            </div>
          )}

          {!searching && searchResults.length > 0 && (
            <div className="space-y-2">
              <p className="text-gray-500 text-xs mb-2">
                {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} found
              </p>
              {searchResults.map((item) => (
                <TenantRow
                  key={item.tenant._id}
                  item={item}
                  onSelect={setSelectedTenantId}
                  onPayNow={onPayNow}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ── Tenant Detail Modal ── */}
      {selectedTenantId && (
        <TenantDetailModal
          tenantId={selectedTenantId}
          onClose={() => setSelectedTenantId(null)}
          onPayNow={onPayNow}
          onPaymentDone={paymentDone}
        />
      )}

      {/* ── Pay Modal ── */}
      {payModal && (
        <PayModal
          tenantId={payModal.tenantId}
          monthYear={payModal.monthYear}
          maxAmount={payModal.maxAmount}
          onClose={() => setPayModal(null)}
          onSuccess={onPaySuccess}
        />
      )}

      {/* ── Toast ── */}
      {toast && <Toast msg={toast} onDone={() => setToast("")} />}
    </div>
  );
}