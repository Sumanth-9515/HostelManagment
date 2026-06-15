import { useEffect, useMemo, useState } from "react";
import { API, authHeaders } from "../api.js";

const BACKEND_URL = API.replace(/\/api.*$/, "");
const fmt = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(n || 0));
const fmtDateTime = (d) => d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";
const fmtMonth = (d) => d ? new Date(d).toLocaleString("en-IN", { month: "long", year: "numeric" }) : "-";
const docUrl = (src) => !src ? "" : src.startsWith("http") ? src : `${BACKEND_URL}${src}`;

const statusStyle = {
  Pending: "bg-amber-50 text-amber-700 border-amber-200",
  Approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Rejected: "bg-rose-50 text-rose-700 border-rose-200",
};

function Avatar({ tenant, onClick }) {
  const src = docUrl(tenant?.documents?.passportPhoto);
  const content = (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-indigo-100 text-base font-black text-indigo-700 ring-1 ring-slate-200">
      {src ? <img src={src} alt={tenant?.name || "Tenant"} className="h-full w-full object-cover" /> : (tenant?.name?.[0] || "?").toUpperCase()}
    </div>
  );
  if (!src || !onClick) return content;
  return (
    <button type="button" onClick={() => onClick(src, tenant?.name)} className="rounded-full outline-none transition hover:scale-105" title="View profile photo">
      {content}
    </button>
  );
}

function ProfilePhotoModal({ photo, name, onClose }) {
  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="relative max-h-[90vh] w-full max-w-3xl rounded-2xl bg-white p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-lg font-black text-white" title="Close">x</button>
        <div className="flex flex-col items-center gap-4">
          <img src={photo} alt={name || "Profile"} className="max-h-[76vh] w-full rounded-xl object-contain" />
          <p className="text-sm font-black text-slate-700">{name || "Profile Photo"}</p>
        </div>
      </div>
    </div>
  );
}

function ReceiptModal({ url, onClose }) {
  const isPdf = /\.pdf($|\?)/i.test(url);
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="relative h-[88vh] w-full max-w-5xl rounded-xl bg-white p-3" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-3 top-3 z-10 rounded-lg bg-slate-900 px-3 py-1 text-sm font-bold text-white">Close</button>
        {isPdf ? <iframe src={url} title="Payment receipt" className="h-full w-full rounded-lg border-0" /> : <img src={url} alt="Payment receipt" className="h-full w-full rounded-lg object-contain" />}
      </div>
    </div>
  );
}

function Actions({ request, busyId, onReceipt, onApprove, onReject }) {
  const t = request.tenant || {};
  const phone = (t.phone || "").replace(/\D/g, "");
  const waText = encodeURIComponent(`Hi ${t.name || "there"}, regarding your payment request for ${fmtMonth(request.dueDate)}.`);
  const waPhone = phone.startsWith("91") ? phone : `91${phone}`;
  return (
    <div className="flex flex-wrap gap-2">
      {request.receiptUrl && <button onClick={() => onReceipt(request.receiptUrl)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700">Receipt</button>}
      {phone && <a href={`tel:${t.phone}`} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700">Call</a>}
      {phone && <a href={`https://wa.me/${waPhone}?text=${waText}`} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700">WhatsApp</a>}
      {request.status === "Pending" && (
        <>
          <button disabled={busyId === request._id} onClick={() => onApprove(request._id)} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-black text-white disabled:opacity-60">Approve</button>
          <button disabled={busyId === request._id} onClick={() => onReject(request._id)} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-black text-white disabled:opacity-60">Reject</button>
        </>
      )}
    </div>
  );
}

function RequestCard({ request, busyId, onReceipt, onApprove, onReject, onPhoto }) {
  const t = request.tenant || {};
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <Avatar tenant={t} onClick={onPhoto} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-base font-black text-slate-950">{t.name || "-"}</p>
              <p className="truncate text-xs font-semibold text-slate-500">{t.phone || t.email || "-"}</p>
            </div>
            <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-black ${statusStyle[request.status] || statusStyle.Pending}`}>{request.status}</span>
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-500">{t.building || "-"} / Floor {t.floor || "-"} / Room {t.room || "-"}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Month</p>
          <p className="mt-1 text-sm font-black text-slate-950">{fmtMonth(request.dueDate)}</p>
        </div>
        <div className="rounded-xl bg-rose-50 p-3">
          <p className="text-[10px] font-black uppercase tracking-wide text-rose-400">Requested</p>
          <p className="mt-1 text-sm font-black text-rose-700">{fmt(request.requestedAmount)}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Mode</p>
          <p className="mt-1 text-sm font-black text-slate-950">{request.paymentMode}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Submitted</p>
          <p className="mt-1 text-xs font-black text-slate-950">{fmtDateTime(request.submittedAt)}</p>
        </div>
      </div>

      {request.paymentMode === "Cash" && (
        <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
          Cash handover: {fmtDateTime(request.cashHandoverAt)}
        </div>
      )}

      <div className="mt-4">
        <Actions request={request} busyId={busyId} onReceipt={onReceipt} onApprove={onApprove} onReject={onReject} />
      </div>
    </article>
  );
}

export default function PaymentRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [busyId, setBusyId] = useState("");
  const [filter, setFilter] = useState("All");

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2800);
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/payment-requests`, { headers: authHeaders() });
      const data = await res.json();
      setRequests(Array.isArray(data) ? data : []);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const generateLink = async () => {
    try {
      const res = await fetch(`${API}/payment-requests/generate-link`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to generate link.");
      const token = data.link.split("/").pop();
      setLink(`${window.location.origin}/payment-request-form/${token}`);
    } catch (err) {
      showToast(err.message);
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    showToast("Payment form link copied.");
    setTimeout(() => setCopied(false), 1800);
  };

  const approve = async (id) => {
    if (!window.confirm("Approve this payment request and update tenant payment status?")) return;
    setBusyId(id);
    try {
      const res = await fetch(`${API}/payment-requests/${id}/approve`, { method: "PATCH", headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Approval failed.");
      showToast("Payment approved and updated.");
      await load();
    } catch (err) {
      showToast(err.message);
    } finally {
      setBusyId("");
    }
  };

  const reject = async (id) => {
    const reason = window.prompt("Reject reason (optional):") || "";
    if (!window.confirm("Reject this payment request?")) return;
    setBusyId(id);
    try {
      const res = await fetch(`${API}/payment-requests/${id}/reject`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Rejection failed.");
      showToast("Payment request rejected.");
      await load();
    } catch (err) {
      showToast(err.message);
    } finally {
      setBusyId("");
    }
  };

  const filtered = useMemo(() => filter === "All" ? requests : requests.filter((r) => r.status === filter), [requests, filter]);
  const counts = {
    All: requests.length,
    Pending: requests.filter((r) => r.status === "Pending").length,
    Approved: requests.filter((r) => r.status === "Approved").length,
    Rejected: requests.filter((r) => r.status === "Rejected").length,
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {toast && <div className="fixed right-5 top-5 z-[90] max-w-sm rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white shadow-lg">{toast}</div>}
      {receiptUrl && <ReceiptModal url={receiptUrl} onClose={() => setReceiptUrl("")} />}
      {profilePhoto && <ProfilePhotoModal photo={profilePhoto.url} name={profilePhoto.name} onClose={() => setProfilePhoto(null)} />}

      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-600">Owner Dashboard</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight">Payment Requests</h1>
            <p className="text-sm text-slate-500">Review tenant submitted rent payments and approve partial or full amounts.</p>
          </div>
          <button onClick={generateLink} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-indigo-600/20">Generate Form Link</button>
        </div>

        {link && (
          <div className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Public payment request form link</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <div className="min-w-0 flex-1 break-all rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-indigo-700">{link}</div>
              <button onClick={copyLink} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700">{copied ? "Copied" : "Copy"}</button>
              <a href={link} target="_blank" rel="noreferrer" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700">Preview</a>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {["All", "Pending", "Approved", "Rejected"].map((label) => (
            <button key={label} onClick={() => setFilter(label)} className={`rounded-2xl border bg-white p-4 text-left shadow-sm ${filter === label ? "border-indigo-300 ring-2 ring-indigo-100" : "border-slate-200"}`}>
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</p>
              <p className="mt-1 text-2xl font-black">{counts[label]}</p>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="rounded-2xl bg-white p-8 text-center text-sm font-bold text-slate-500 shadow-sm">Loading payment requests...</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-center text-sm font-bold text-slate-500 shadow-sm">No payment requests found.</div>
        ) : (
          <>
            <div className="grid gap-3 md:hidden">
              {filtered.map((r) => <RequestCard key={r._id} request={r} busyId={busyId} onReceipt={setReceiptUrl} onApprove={approve} onReject={reject} onPhoto={(url, name) => setProfilePhoto({ url, name })} />)}
            </div>

            <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1060px] border-collapse text-sm">
                  <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      {["Candidate", "Location", "Month", "Amount", "Mode", "Submitted", "Status", "Actions"].map((h) => <th key={h} className="border-b border-slate-200 px-4 py-3 font-black">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => {
                      const t = r.tenant || {};
                      return (
                        <tr key={r._id} className="border-b border-slate-100 last:border-0">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar tenant={t} onClick={(url, name) => setProfilePhoto({ url, name })} />
                              <div className="min-w-0">
                                <p className="truncate font-black text-slate-900">{t.name}</p>
                                <p className="truncate text-xs text-slate-500">{t.email}</p>
                                <p className="text-xs text-slate-500">{t.phone}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600"><p className="font-bold">{t.building || "-"}</p><p>Floor {t.floor || "-"} / Room {t.room || "-"}</p></td>
                          <td className="px-4 py-3 font-bold">{fmtMonth(r.dueDate)}</td>
                          <td className="px-4 py-3"><p className="font-black text-rose-600">{fmt(r.requestedAmount)}</p><p className="text-xs text-slate-400">Rent {fmt(r.rentAmount)}</p></td>
                          <td className="px-4 py-3"><p className="font-bold">{r.paymentMode}</p>{r.paymentMode === "Cash" && <p className="text-xs text-amber-700">{fmtDateTime(r.cashHandoverAt)}</p>}</td>
                          <td className="px-4 py-3 text-xs text-slate-600">{fmtDateTime(r.submittedAt)}</td>
                          <td className="px-4 py-3"><span className={`rounded-full border px-2 py-1 text-xs font-black ${statusStyle[r.status] || statusStyle.Pending}`}>{r.status}</span></td>
                          <td className="px-4 py-3"><Actions request={r} busyId={busyId} onReceipt={setReceiptUrl} onApprove={approve} onReject={reject} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
