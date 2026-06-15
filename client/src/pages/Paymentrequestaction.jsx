import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { API } from "../api.js";

const fmt = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(n || 0));
const fmtDateTime = (d) => d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";
const fmtMonth = (d) => d ? new Date(d).toLocaleString("en-IN", { month: "long", year: "numeric" }) : "-";

function Detail({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-bold text-slate-900 break-words">{value || "-"}</p>
    </div>
  );
}

export default function PaymentRequestAction() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${API}/payment-requests/email-action/${token}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || "Action link is invalid.");
        setData(json);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`${API}/payment-requests/email-action/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Action failed.");
      setDone(json.message || "Action completed.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const action = data?.action;
  const request = data?.request;
  const tenant = data?.tenant;

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 text-center">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-indigo-600">Nilayam Hostel</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight">Confirm Payment Request Action</h1>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {loading ? (
            <p className="text-center text-sm font-bold text-slate-500">Checking secure action link...</p>
          ) : error && !data ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>
          ) : done ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-center">
              <p className="text-lg font-black text-emerald-700">{done}</p>
              <p className="mt-1 text-sm font-semibold text-emerald-600">This one-time link is now closed.</p>
            </div>
          ) : (
            <>
              <div className={`rounded-2xl px-4 py-4 text-white ${action === "approve" ? "bg-emerald-600" : "bg-rose-600"}`}>
                <p className="text-sm font-black uppercase tracking-wide">{action === "approve" ? "Approve Payment" : "Reject Payment"}</p>
                <p className="mt-1 text-2xl font-black">{fmt(request.requestedAmount)}</p>
                <p className="text-sm font-semibold opacity-90">{fmtMonth(request.dueDate)}</p>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Detail label="Candidate" value={tenant?.name} />
                <Detail label="Phone" value={tenant?.phone} />
                <Detail label="Email" value={tenant?.email} />
                <Detail label="Location" value={`${tenant?.building || "-"} / Floor ${tenant?.floor || "-"} / Room ${tenant?.room || "-"}`} />
                <Detail label="Payment Mode" value={request.paymentMode} />
                <Detail label="Submitted" value={fmtDateTime(request.submittedAt)} />
              </div>

              {request.receiptUrl && (
                <a href={request.receiptUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-black text-indigo-700">
                  View Receipt
                </a>
              )}

              {action === "reject" && (
                <div className="mt-4">
                  <label className="text-xs font-black uppercase tracking-wide text-slate-500">Reject Reason</label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    placeholder="Optional reason to send to tenant"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-rose-400"
                  />
                </div>
              )}

              {error && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>}

              <button
                onClick={submit}
                disabled={submitting}
                className={`mt-5 w-full rounded-xl px-5 py-3 text-sm font-black text-white disabled:opacity-60 ${action === "approve" ? "bg-emerald-600" : "bg-rose-600"}`}
              >
                {submitting ? "Processing..." : action === "approve" ? "Final Approve" : "Final Reject"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
