import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import Swal from "sweetalert2";
import { API } from "../api.js";

const BACKEND_URL = API.replace(/\/api.*$/, "");
const fmt = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(n || 0));
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-";
const fmtDateTime = (d) => d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";
const fmtMonth = (d) => d ? new Date(d).toLocaleString("en-IN", { month: "long", year: "numeric" }) : "-";
const docUrl = (src) => !src ? "" : src.startsWith("http") ? src : `${BACKEND_URL}${src}`;
const remaining = (m) => Math.max(Number(m?.rentAmount || 0) - Number(m?.paidAmount || 0), 0);
const tenantLocationParts = (tenant) => {
  const info = tenant?.allocationInfo || {};
  return {
    building: info.buildingName || "Building not assigned",
    room: info.roomNumber ? `Room ${info.roomNumber}` : "Room not assigned",
  };
};

function Avatar({ tenant, size = "md" }) {
  const src = docUrl(tenant?.documents?.passportPhoto);
  const sizes = { sm: "h-11 w-11 text-base", md: "h-20 w-20 text-2xl", lg: "h-24 w-24 text-3xl" };
  return (
    <div className={`${sizes[size]} shrink-0 overflow-hidden rounded-full border-4 border-white bg-indigo-100 shadow-sm ring-1 ring-slate-200 flex items-center justify-center font-black text-indigo-700`}>
      {src ? <img src={src} alt={tenant?.name || "Tenant"} className="h-full w-full object-cover" /> : (tenant?.name?.[0] || "?").toUpperCase()}
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-bold text-slate-900 break-words">{value || "-"}</p>
    </div>
  );
}

function RequestModal({ tenant, month, onClose, onSubmit, submitting }) {
  const maxAmount = remaining(month);
  const [amount, setAmount] = useState(String(maxAmount));
  const [mode, setMode] = useState("Online");
  const [receipt, setReceipt] = useState(null);
  const [cashAt, setCashAt] = useState("");
  const [error, setError] = useState("");

  const submit = (e) => {
    e.preventDefault();
    setError("");
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return setError("Enter a valid payment amount.");
    if (value > maxAmount) return setError("Amount cannot be greater than remaining due.");
    if (mode === "Online" && !receipt) return setError("Receipt is required for online payment.");
    if (mode === "Cash" && !cashAt) return setError("Select cash handover date and time.");
    onSubmit({ amount: value, mode, receipt, cashAt });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/65 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="max-h-[92vh] w-full max-w-lg overflow-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-indigo-600">Payment Request</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">{fmtMonth(month.dueDate)}</h2>
            <p className="text-sm text-slate-500">{tenant.name} can request full or partial payment approval.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-slate-200 px-3 py-1 text-sm font-black text-slate-500">X</button>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <Detail label="Rent" value={fmt(month.rentAmount)} />
          <Detail label="Paid" value={fmt(month.paidAmount)} />
          <Detail label="Due" value={fmt(maxAmount)} />
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className="text-xs font-black uppercase tracking-wide text-slate-500">Request Amount</label>
            <input
              type="number"
              min="1"
              max={maxAmount}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-lg font-black text-slate-950 outline-none focus:border-indigo-400"
            />
          </div>
          <div>
            <label className="text-xs font-black uppercase tracking-wide text-slate-500">Payment Mode</label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {["Online", "Cash"].map((m) => (
                <button key={m} type="button" onClick={() => setMode(m)} className={`rounded-xl border px-4 py-3 text-sm font-black ${mode === m ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600"}`}>{m}</button>
              ))}
            </div>
          </div>
          {mode === "Online" ? (
            <div>
              <label className="text-xs font-black uppercase tracking-wide text-slate-500">Receipt Image/PDF</label>
              <input type="file" accept="image/*,application/pdf" onChange={(e) => setReceipt(e.target.files?.[0] || null)} className="mt-2 w-full rounded-xl border border-dashed border-slate-300 p-3 text-sm" />
            </div>
          ) : (
            <div>
              <label className="text-xs font-black uppercase tracking-wide text-slate-500">Cash Handover Date & Time</label>
              <input type="datetime-local" value={cashAt} onChange={(e) => setCashAt(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-400" />
            </div>
          )}
          {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>}
          <button disabled={submitting} className="w-full rounded-xl bg-indigo-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-indigo-600/20 disabled:opacity-50">
            {submitting ? "Submitting..." : "Submit Request"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function PaymentRequestForm() {
  const { ownerToken } = useParams();
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modalMonth, setModalMonth] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showSearch, setShowSearch] = useState(true);

  useEffect(() => {
    const t = setTimeout(async () => {
      setError("");
      if (query.trim().length < 2) return setMatches([]);
      try {
        const res = await fetch(`${API}/payment-requests/public/${ownerToken}/search?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Search failed.");
        setMatches(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message);
        setMatches([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, ownerToken]);

  const loadProfile = async (tenantId) => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`${API}/payment-requests/public/${ownerToken}/tenant/${tenantId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Tenant not found.");
      setProfile(data);
      setShowSearch(false);
    } catch (err) {
      setError(err.message);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const submitRequest = async ({ amount, mode, receipt, cashAt }) => {
    setError("");
    setMessage("");
    const fd = new FormData();
    fd.append("tenantId", selectedId);
    fd.append("monthYear", modalMonth.monthYear);
    fd.append("requestedAmount", String(amount));
    fd.append("paymentMode", mode);
    if (receipt) fd.append("receipt", receipt);
    if (cashAt) fd.append("cashHandoverAt", cashAt);

    setSubmitting(true);
    try {
      const res = await fetch(`${API}/payment-requests/public/${ownerToken}`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Request submission failed.");
      const successText = "Your payment request is submitted. Please wait for owner approval. Once approved, you will receive a confirmation email.";
      setMessage(successText);
      await Swal.fire({
        icon: "success",
        title: "Request submitted",
        text: successText,
        confirmButtonColor: "#4f46e5",
      });
      setModalMonth(null);
      await loadProfile(selectedId);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const tenant = profile?.tenant;
  const building = profile?.buildingDetails || {};
  const totalDue = useMemo(() => (profile?.pendingMonths || []).reduce((sum, m) => sum + remaining(m), 0), [profile]);
  const history = profile?.history || [];
  const pendingRequestsByMonth = useMemo(() => {
    const map = {};
    (profile?.pendingRequests || []).forEach((request) => {
      if (!map[request.monthYear]) map[request.monthYear] = [];
      map[request.monthYear].push(request);
    });
    return map;
  }, [profile]);

  const backToSearch = () => {
    setShowSearch(true);
    setProfile(null);
    setSelectedId("");
    setQuery("");
    setMatches([]);
    setMessage("");
    setError("");
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      {modalMonth && tenant && <RequestModal tenant={tenant} month={modalMonth} onClose={() => setModalMonth(null)} onSubmit={submitRequest} submitting={submitting} />}
      <div className={`${showSearch ? "mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-5 py-8" : "mx-auto w-full max-w-md px-4 py-6 sm:py-10 lg:max-w-6xl"}`}>
        {showSearch ? (
          <>
            <div className="mb-8 text-center">
              <p className="text-sm font-black uppercase tracking-[0.28em] text-indigo-600">Nilayam Hostel</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Tenant Payment Request</h1>
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <label className="text-sm font-black uppercase tracking-wide text-slate-500">Search tenant</label>
              <div className="relative mt-3">
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, email, or phone" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-base font-bold outline-none focus:border-indigo-400 focus:bg-white" />
                {matches.length > 0 && (
                  <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 max-h-80 overflow-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                    {matches.map((t) => {
                      const location = tenantLocationParts(t);
                      return (
                      <button key={t._id} type="button" onClick={() => { setSelectedId(t._id); setQuery(`${t.name} - ${location.building} / ${location.room}`); setMatches([]); loadProfile(t._id); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-slate-50">
                        <Avatar tenant={t} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-black text-slate-900">{t.name}</span>
                          <span className="block truncate text-xs font-semibold text-slate-500">{location.building}</span>
                          <span className="block text-xs font-black text-indigo-600">{location.room}</span>
                        </span>
                        <span className="text-xs font-bold text-indigo-600">Select</span>
                      </button>
                    );
                    })}
                  </div>
                )}
              </div>
              <p className="mt-4 text-sm font-semibold leading-6 text-slate-500">
                Search your tenant profile, choose a pending rent month, enter the amount you paid, and submit cash details or an online receipt. Your owner will review the request; once approved, your payment status is updated and a confirmation email is sent.
              </p>
            </section>
          </>
        ) : (
          <div className="mb-4">
            <button type="button" onClick={backToSearch} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm">
              <span className="text-lg leading-none">&larr;</span>
              Back to search
            </button>
          </div>
        )}

        {error && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>}
        {message && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</div>}
        {loading && <div className="mt-4 rounded-xl bg-white p-6 text-sm font-bold text-slate-500 shadow-sm">Loading tenant profile...</div>}

        {tenant && (
          <div className="mt-6 space-y-6">
            <section className="mx-auto w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="bg-slate-950 px-5 py-6 text-white">
                <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
                  <Avatar tenant={tenant} size="lg" />
                  <div className="min-w-0 flex-1">
                    <h2 className="break-words text-2xl font-black sm:truncate">{tenant.name}</h2>
                    <div className="mt-2 grid gap-1 text-sm text-slate-300 sm:grid-cols-2">
                      <p>{tenant.phone || "-"}</p>
                      <p>{tenant.email || "-"}</p>
                      <p>Father: {tenant.fatherName || "-"}</p>
                      <p>{building.buildingName || tenant.allocationInfo?.buildingName || "Room not assigned"}</p>
                    </div>
                  </div>
                </div>
              </div>
    
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">Pending payments to pay</p>
                  <h2 className="text-xl font-black">Total Due: <span className="text-rose-600">{fmt(totalDue)}</span></h2>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{profile.pendingMonths?.length || 0} month(s)</span>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {profile.pendingMonths?.length ? profile.pendingMonths.map((m) => {
                  const pendingRequests = pendingRequestsByMonth[m.monthYear] || [];
                  return (
                    <div key={m.monthYear} className={`rounded-2xl border p-4 text-left transition ${pendingRequests.length ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50"}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-base font-black text-slate-950">{fmtMonth(m.dueDate)}</p>
                          <p className="text-xs font-semibold text-slate-500">Paid {fmt(m.paidAmount)} of {fmt(m.rentAmount)}</p>
                        </div>
                        <p className="text-lg font-black text-rose-600">{fmt(remaining(m))}</p>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                        <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.min(100, (Number(m.paidAmount || 0) / Number(m.rentAmount || 1)) * 100)}%` }} />
                      </div>
                      {pendingRequests.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {pendingRequests.map((request) => (
                            <div key={request._id} className="rounded-xl border border-amber-200 bg-white px-3 py-2">
                              <p className="text-sm font-black text-amber-800">You requested {fmt(request.requestedAmount)}</p>
                              <p className="mt-1 text-xs font-semibold text-amber-700">Please wait for approval from owner. Once approved, you will receive a confirmation email.</p>
                            </div>
                          ))}
                        </div>
                      )}
                      <button type="button" onClick={() => setModalMonth(m)} className="mt-3 w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white shadow-sm shadow-indigo-600/20">
                        Click to update payment
                      </button>
                    </div>
                  );
                }) : <p className="rounded-xl bg-emerald-50 p-4 text-sm font-bold text-emerald-700">No pending months found.</p>}
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-lg font-black">More Details</h2>
                <div className="mt-4 grid gap-3">
                  <Detail label="Joining Date" value={fmtDate(tenant.joiningDate)} />
                  <Detail label="Monthly Rent" value={fmt(tenant.rentAmount)} />
                  <Detail label="Advance" value={`${fmt(tenant.paidAdvanceAmount)} paid / ${fmt(tenant.advanceAmount)}`} />
                  <Detail label="Building" value={building.buildingName || tenant.allocationInfo?.buildingName} />
                  <Detail label="Floor" value={building.floorName || tenant.allocationInfo?.floorNumber} />
                  <Detail label="Room / Bed" value={`Room ${building.roomNumber || tenant.allocationInfo?.roomNumber || "-"} / Bed ${tenant.allocationInfo?.bedNumber || "-"}`} />
                  <Detail label="Address" value={tenant.permanentAddress} />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-lg font-black">All Payment History</h2>
                <div className="mt-4 space-y-3">
                  {history.length ? history.map((h) => (
                    <div key={h._id} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-black text-slate-950">{fmtMonth(h.dueDate)}</p>
                          <p className="text-xs font-semibold text-slate-500">Due date {fmtDate(h.dueDate)}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${h.status === "Paid" ? "bg-emerald-50 text-emerald-700" : h.status === "Partial" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}`}>{h.status}</span>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                        <Detail label="Rent" value={fmt(h.rentAmount)} />
                        <Detail label="Paid" value={fmt(h.paidAmount)} />
                        <Detail label="Balance" value={fmt(remaining(h))} />
                      </div>
                      {h.payments?.length > 0 && (
                        <div className="mt-3 space-y-1 border-t border-slate-100 pt-2">
                          {h.payments.map((p, idx) => <p key={idx} className="text-xs font-semibold text-slate-500">{fmt(p.amount)} paid on {fmtDateTime(p.paidAt)}</p>)}
                        </div>
                      )}
                    </div>
                  )) : <p className="rounded-xl bg-slate-50 p-4 text-sm font-bold text-slate-500">No payment history found.</p>}
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
