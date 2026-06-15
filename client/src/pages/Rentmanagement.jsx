// RentManagement.jsx
// npm install html-to-image   ← required for bill image generation

import { useEffect, useState, useCallback, useRef } from "react";
import { toPng } from "html-to-image";
import RentDueCardImage from "./Rentduecardimage";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const authHeader = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("token")}`,
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

function AdvanceStatusBadge({ advanceAmount = 0, paidAdvanceAmount = 0, pendingAdvanceAmount = 0, compact = false }) {
  if (advanceAmount <= 0) return null;
  const isPaid = pendingAdvanceAmount <= 0;
  if (compact) {
    return (
      <div className={`mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 shadow-sm ${isPaid ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50"}`}>
        <span className={`flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm font-black shadow-sm ${isPaid ? "text-emerald-700" : "text-amber-700"}`}>₹</span>
        <div className="leading-tight">
          <p className={`text-[10px] font-bold uppercase tracking-wide ${isPaid ? "text-emerald-700" : "text-amber-600"}`}>{isPaid ? "Advance Paid" : "Advance Pending"}</p>
          <p className="text-sm font-black text-gray-900">{fmt(isPaid ? paidAdvanceAmount : pendingAdvanceAmount)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`mt-2 rounded-lg border px-3 py-2 ${isPaid ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
      <div className="flex justify-between text-[11px]">
        <span className={`font-semibold ${isPaid ? "text-emerald-700" : "text-amber-700"}`}>{isPaid ? "Advance Paid" : "Advance Pending"}</span>
        <span className={`font-bold ${isPaid ? "text-emerald-700" : "text-amber-700"}`}>{fmt(isPaid ? paidAdvanceAmount : pendingAdvanceAmount)}</span>
      </div>
      {!isPaid && (
        <div className="mt-1 flex justify-between text-[10px] text-amber-600">
          <span>Paid: {fmt(paidAdvanceAmount)}</span>
          <span>Total: {fmt(advanceAmount)}</span>
        </div>
      )}
    </div>
  );
}

function buildPayable(pendingMonths = [], record = null, remaining = 0, pendingAdvanceAmount = 0) {
  const arr = [];
  if (pendingAdvanceAmount > 0)
    arr.push({ monthYear: "__advance__", paymentType: "advance", maxAmount: pendingAdvanceAmount, label: "Advance Amount" });
  pendingMonths.forEach((pm) => {
    const rem = pm.rentAmount - pm.paidAmount;
    if (rem > 0) arr.push({ monthYear: pm.monthYear, paymentType: "rent", maxAmount: rem, label: `${fmtMonthYear(pm.dueDate)} (Arrears)` });
  });
  if (record && remaining > 0)
    arr.push({ monthYear: record.monthYear, paymentType: "rent", maxAmount: remaining, label: `${fmtMonthYear(record.dueDate)} (Current)` });
  return arr;
}

function buildWAMessage(tenant, record, totalAccumulatedDue, buildingDetails, pendingMonths = [], isOverdue = false, daysOverdue = null, daysUntilDue = null) {
  const room = buildingDetails ? `Room ${buildingDetails.roomNumber}` : "your room";
  const month = record
    ? new Date(record.dueDate).toLocaleString("en-IN", { month: "long", year: "numeric" })
    : "this month";
  
  const hasPreviousPending = pendingMonths && pendingMonths.length > 0;
  const remainingCurrent = record ? record.rentAmount - record.paidAmount : 0;
  
  let message = "";
  
  if (hasPreviousPending) {
    const arrearsTotal = pendingMonths.reduce((sum, pm) => sum + (pm.rentAmount - pm.paidAmount), 0);
    message = `🚨 *URGENT: RENT ARREARS ALERT* 🚨\n\n`;
    message += `Hello ${tenant.name},\n\n`;
    message += `❌ *You have ${pendingMonths.length} month(s) of unpaid rent!*\n\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `📋 *OUTSTANDING BREAKDOWN*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    message += `*Previous Months Arrears:*\n`;
    pendingMonths.forEach((pm, idx) => {
      const pmRemaining = pm.rentAmount - pm.paidAmount;
      const pmMonth = new Date(pm.dueDate).toLocaleString("en-IN", { month: "long", year: "numeric" });
      message += `📆 ${pmMonth}: ₹${pmRemaining.toLocaleString('en-IN')}\n`;
    });
    message += `\n📌 *Current Month (${month}):* ₹${remainingCurrent.toLocaleString('en-IN')}\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `💰 *TOTAL DUE:* ₹${totalAccumulatedDue.toLocaleString('en-IN')}\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    message += `⚠️ *IMMEDIATE ACTION REQUIRED*\n`;
    message += `Please clear all pending dues at the earliest to avoid\n`;
    message += `- Late payment penalties\n`;
    message += `- Service interruption\n\n`;
    message += `📍 Location: ${room}\n`;
    message += `📞 Contact: ${tenant.phone || 'your manager'}\n\n`;
    message += `Thank you for your prompt attention.`;
  } else if (isOverdue) {
    message = `⚠️ *RENT OVERDUE ALERT* ⚠️\n\n`;
    message += `Hello ${tenant.name},\n\n`;
    message += `Your rent payment for *${month}* is *OVERDUE by ${daysOverdue} day(s)*!\n\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `💰 *Due Amount:* ₹${remainingCurrent.toLocaleString('en-IN')}\n`;
    message += `📍 *Location:* ${room}\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    message += `Please make the payment immediately to avoid late fees.\n\n`;
    message += `📞 For assistance: ${tenant.phone || 'Contact manager'}\n\n`;
    message += `Thank you for your cooperation.`;
  } else if (daysUntilDue !== null && daysUntilDue <= 2) {
    const urgencyText = daysUntilDue === 0 ? "TODAY" : `in ${daysUntilDue} day(s)`;
    message = `🔔 *RENT REMINDER* 🔔\n\n`;
    message += `Hello ${tenant.name},\n\n`;
    message += `This is a friendly reminder that your rent for *${month}* is due ${urgencyText}.\n\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `💰 *Amount Due:* ₹${remainingCurrent.toLocaleString('en-IN')}\n`;
    message += `📍 *Location:* ${room}\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    message += `Please ensure timely payment to avoid any inconvenience.\n\n`;
    message += `✨ Thank you for your prompt attention!`;
  } else {
    message = `🏠 *Rent Payment Reminder* 🏠\n\n`;
    message += `Hello ${tenant.name},\n\n`;
    message += `Your rent for *${month}* of ₹${remainingCurrent.toLocaleString('en-IN')} is due soon.\n\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `📍 *Room:* ${room}\n`;
    message += `💰 *Amount:* ₹${remainingCurrent.toLocaleString('en-IN')}\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    message += `Please make the payment at your earliest convenience.\n\n`;
    message += `🙏 Thank you!`;
  }
  
  message += `\n\n━━━━━━━━━━━━━━━━━━━━\n💳 *Payment Options:*\n`;
  message += `• UPI / Bank Transfer\n`;
  message += `• Cash at office\n`;
  message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
  message += `*This is an automated message from your hostel management.*`;
  
  return encodeURIComponent(message);
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
      if (!r.ok) {
        let data = {};
        try { data = await r.json(); } catch {}
        throw new Error(data.message || "Failed to send email.");
      }
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
  if (state === "error")   return <button onClick={handleSend} title={errMsg} className={`${baseClass} bg-rose-50 border-rose-200 text-rose-700 ${className}`}>Failed</button>;
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

// ─── Bill Preview Modal ───────────────────────────────────────────────────────
// HOW IT WORKS:
// 1. Bill image is generated from the off-screen RentDueCardImage card.
// 2. On "Send Bill via WhatsApp":
//    a. The image is COPIED TO CLIPBOARD (so user can paste it directly in WhatsApp chat).
//    b. WhatsApp is opened (wa.me on mobile, web.whatsapp.com on desktop) with a
//       pre-filled text message: "Hi {name}, your rent bill image of {month} ..."
//    c. User pastes the copied image in the WhatsApp chat and sends.
// 3. Download PNG is still available as a separate action.
// 4. "Send as plain text" fallback remains unchanged.
function BillPreviewModal({ item, onClose }) {
  const billRef             = useRef(null);
  const [imgUrl, setImgUrl] = useState(null);
  const [generating, setGenerating] = useState(true);
  const [genError, setGenError]     = useState("");
  const [shareState, setShareState] = useState("idle"); // idle | copying | done | error
  const [shareMsg,  setShareMsg]    = useState("");

  // ── Generate PNG after off-screen card mounts ─────────────────────────────
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!billRef.current) { setGenerating(false); setGenError("Card not ready."); return; }
      try {
        const dataUrl = await toPng(billRef.current, {
          cacheBust: true, pixelRatio: 2, backgroundColor: "#ffffff", skipFonts: false,
        });
        setImgUrl(dataUrl);
      } catch {
        setGenError("Could not generate image. Use text message instead.");
      }
      setGenerating(false);
    }, 700);
    return () => clearTimeout(timer);
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  const triggerDownload = (dataUrl) => {
    const a = document.createElement("a");
    a.download = `rent-bill-${(item.tenant?.name || "tenant").replace(/\s+/g, "-").toLowerCase()}.png`;
    a.href = dataUrl;
    a.click();
  };

  // ── Build the short WhatsApp caption message ──────────────────────────────
  // "Hi {name}, your rent bill image of {month dues} — please complete your
  //  payment, see due details in the image."
  const buildBillCaption = () => {
    const name  = item.tenant?.name || "there";
    const record = item.record;
    const month  = record
      ? new Date(record.dueDate).toLocaleString("en-IN", { month: "long", year: "numeric" })
      : "this month";

    const hasPending = item.pendingMonths && item.pendingMonths.length > 0;

    let caption = `Hi ${name}, 👋\n\n`;

    if (hasPending) {
      const months = item.pendingMonths
        .map((pm) => new Date(pm.dueDate).toLocaleString("en-IN", { month: "long", year: "numeric" }))
        .join(", ");
      caption += `📋 Your rent bill for *${months}* (arrears) + *${month}* is attached.\n\n`;
    } else {
      caption += `📋 Your rent bill image for *${month}* is attached.\n\n`;
    }

    caption += `💰 *Total Due: ${fmt(item.totalAccumulatedDue)}*\n\n`;
    caption += `Please complete your payment at the earliest.\n`;
    caption += `📌 See all due details in the image above.\n\n`;
    caption += `_Hostel Management_`;

    return encodeURIComponent(caption);
  };

  // ── PRIMARY: Copy image to clipboard + open WhatsApp ─────────────────────
  //
  // STEP 1 — Copy the bill PNG to the system clipboard so the user can
  //           paste it (Ctrl+V / long-press Paste) directly inside WhatsApp.
  // STEP 2 — Open WhatsApp (mobile: wa.me, desktop: web.whatsapp.com) with
  //           a pre-filled caption message for the tenant's number.
  //
  // The user just has to:
  //   • (mobile)  long-press in the chat input → Paste
  //   • (desktop) Ctrl+V in the WhatsApp Web chat input
  // …and then hit Send.
  //
  const handleShareWA = async () => {
    if (!imgUrl) return;
    setShareState("copying");
    setShareMsg("");

    const phone = item.tenant?.phone?.replace(/\D/g, "") || "";
    const caption = buildBillCaption();

    // ── Step 1: Copy image to clipboard ──────────────────────────────────
    let copied = false;
    try {
      // Convert data URL → Blob → ClipboardItem
      const res  = await fetch(imgUrl);
      const blob = await res.blob();

      if (
        typeof ClipboardItem !== "undefined" &&
        navigator.clipboard &&
        navigator.clipboard.write
      ) {
        const clipItem = new ClipboardItem({ "image/png": blob });
        await navigator.clipboard.write([clipItem]);
        copied = true;
      }
    } catch {
      // Clipboard API blocked (e.g. Firefox, non-HTTPS) — fall back to download
      copied = false;
    }

    // ── Step 2: Open WhatsApp with pre-filled caption ─────────────────────
    const waUrl = isMobile()
      ? `https://wa.me/91${phone}?text=${caption}`
      : `https://web.whatsapp.com/send?phone=91${phone}&text=${caption}`;

    setTimeout(() => {
      window.open(waUrl, "_blank");
    }, 300);

    // ── Step 3: Show result message ───────────────────────────────────────
    if (copied) {
      setShareMsg("✅ Image copied! WhatsApp is opening — paste the image (Ctrl+V / long-press) in the chat and send.");
    } else {
      // Clipboard failed — download the image so the user can attach it manually
      triggerDownload(imgUrl);
      setShareMsg("✅ Image downloaded! WhatsApp is opening — attach the image from your gallery/files and send.");
    }
    setShareState("done");
  };

  // ── FALLBACK: plain text WhatsApp (no image) ──────────────────────────────
  const handleTextFallback = () => {
    const phone = item.tenant?.phone?.replace(/\D/g, "") || "";
    const url = isMobile()
      ? `https://wa.me/91${phone}?text=${buildWAMessage(item.tenant, item.record, item.totalAccumulatedDue, item.tenant?.allocationInfo, item.pendingMonths, item.isOverdue, item.daysOverdue, item.daysUntilDue)}`
      : `https://web.whatsapp.com/send?phone=91${phone}?text=${buildWAMessage(item.tenant, item.record, item.totalAccumulatedDue, item.tenant?.allocationInfo, item.pendingMonths, item.isOverdue, item.daysOverdue, item.daysUntilDue)}`;
    window.open(url, "_blank");
    onClose();
  };

  const urgencyColor = item.hasPreviousPending
    ? "from-rose-600 to-rose-800"
    : item.isOverdue
    ? "from-orange-500 to-orange-700"
    : item.daysUntilDue !== null && item.daysUntilDue <= 2
    ? "from-amber-500 to-amber-700"
    : "from-violet-600 to-violet-800";

  const onMobile = isMobile();

  return (
    <>
      {/* Off-screen bill card for html-to-image capture */}
      <div aria-hidden style={{ position: "fixed", left: "-9999px", top: "0", zIndex: -1, pointerEvents: "none" }}>
        <RentDueCardImage item={item} cardRef={billRef} />
      </div>

      {/* ── Modal overlay ── */}
      <div className="fixed inset-0 z-[77] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md" onClick={onClose}>
        <div className="flex flex-col items-center gap-4 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>

          {/* Header */}
          <div className="flex items-center justify-between w-full">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r ${urgencyColor} border border-white/20`}>
              <span className="text-white text-sm">📸</span>
              <span className="text-white font-bold text-sm">Rent Bill Preview</span>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/30 text-white border border-white/20 text-base transition-colors">✕</button>
          </div>

          {/* Bill image preview */}
          <div className="relative w-full rounded-2xl shadow-2xl overflow-hidden bg-white" style={{ minHeight: "180px" }}>
            {generating && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white z-10 rounded-2xl">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full border-2 border-amber-200 border-t-amber-500 animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center text-sm">📄</div>
                </div>
                <p className="text-gray-500 text-xs font-medium">Generating bill…</p>
              </div>
            )}
            {!generating && imgUrl && (
              <img src={imgUrl} alt="Rent Bill" className="w-full rounded-2xl" style={{ display: "block" }} />
            )}
            {!generating && !imgUrl && (
              <div className="p-6 text-center">
                <p className="text-rose-500 text-sm font-medium mb-1">⚠️ Preview unavailable</p>
                <p className="text-gray-400 text-xs">{genError}</p>
              </div>
            )}
          </div>

          {/* ── Action buttons ── */}
          {!generating && (
            <div className="flex flex-col gap-2.5 w-full">

              {/* How it works info box */}
              {shareState === "idle" && imgUrl && (
                <div className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/15">
                  {onMobile ? (
                    <p className="text-white/70 text-[11px] leading-relaxed text-center">
                      📋 Bill image will be <strong className="text-white/90">copied to clipboard</strong> + WhatsApp opens.<br />
                      <strong className="text-white/90">Long-press → Paste</strong> the image in the chat, then send.
                    </p>
                  ) : (
                    <p className="text-white/70 text-[11px] leading-relaxed text-center">
                      📋 Bill image will be <strong className="text-white/90">copied to clipboard</strong> + WhatsApp Web opens.<br />
                      Press <strong className="text-white/90">Ctrl+V</strong> in the chat to paste the image, then send.
                    </p>
                  )}
                </div>
              )}

              {/* Primary: Copy & Open WhatsApp */}
              {imgUrl && shareState !== "done" && (
                <button
                  onClick={handleShareWA}
                  disabled={shareState === "copying"}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-sm text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 active:scale-95 transition-all shadow-lg"
                >
                  {shareState === "copying" ? (
                    <><div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />Copying image…</>
                  ) : (
                    <>{onMobile ? "📋 Copy Bill & Open WhatsApp" : "📋 Copy Bill & Open WhatsApp"}</>
                  )}
                </button>
              )}

              {/* Success */}
              {shareState === "done" && (
                <div className="w-full px-4 py-3 rounded-xl text-center text-sm font-bold text-emerald-700 bg-emerald-50 border border-emerald-200">
                  {shareMsg}
                </div>
              )}

              {/* Download only */}
              {imgUrl && (
                <button
                  onClick={() => triggerDownload(imgUrl)}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-semibold text-sm text-white/80 bg-white/15 hover:bg-white/25 border border-white/20 active:scale-95 transition-all"
                >
                  ⬇️ Download PNG Only
                </button>
              )}

              {/* Text fallback */}
              <button
                onClick={handleTextFallback}
                className="text-white/45 hover:text-white/75 text-xs text-center underline underline-offset-2 transition-colors mt-0.5"
              >
                Send as plain text message instead
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Due Card ─────────────────────────────────────────────────────────────────
function DueCard({ item, onSelect, onPayNow }) {
  const { tenant, record, remaining, isOverdue, daysOverdue, daysUntilDue, pendingMonths, totalAccumulatedDue, hasPreviousPending, pendingMonthsCount, pendingAdvanceAmount = 0, paidAdvanceAmount = 0, advanceAmount = 0 } = item;
  const alloc = tenant.allocationInfo || {};
  const phone = tenant.phone?.replace(/\D/g, "");
  const payable = buildPayable(pendingMonths, record, remaining, pendingAdvanceAmount);
  const passportPhoto = tenant.documents?.passportPhoto;
  const [showProfilePopup, setShowProfilePopup] = useState(false);
  const [showBillModal, setShowBillModal] = useState(false);

const handleWA = (e) => { 
  e.stopPropagation(); 
  window.open(`https://wa.me/91${phone}?text=${buildWAMessage(
    tenant, 
    record, 
    totalAccumulatedDue, 
    alloc, 
    pendingMonths, 
    isOverdue, 
    daysOverdue, 
    daysUntilDue
  )}`, "_blank"); 
};
  const handleCall = (e) => { e.stopPropagation(); window.location.href = `tel:${tenant.phone}`; };
  const handleAvatarClick = (e) => { e.stopPropagation(); if (passportPhoto) setShowProfilePopup(true); };
  const handleBillImage = (e) => { e.stopPropagation(); setShowBillModal(true); };

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
            {/* ACTION BUTTONS — 📱 text WA | 📸 image bill | 📞 call */}
            <div className="flex gap-1.5 shrink-0">
              {/* Existing text WA button */}
              <button
                onClick={handleWA}
                title="Send text message via WhatsApp"
                className="w-8 h-8 flex items-center justify-center rounded-full bg-emerald-50 hover:bg-emerald-500 border border-emerald-200 transition-colors"
              >📱</button>
              {/* Image bill button */}
              <button
                onClick={handleBillImage}
                title="Send rent bill image via WhatsApp"
                className="w-8 h-8 flex items-center justify-center rounded-full bg-violet-50 hover:bg-violet-500 border border-violet-200 transition-colors hover:text-white"
              >📸</button>
              <button
                onClick={handleCall}
                title="Call tenant"
                className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-50 hover:bg-blue-500 border border-blue-200 transition-colors"
              >📞</button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-3">
            {alloc.buildingName && <span className="text-[11px] px-2 py-0.5 rounded-md bg-gray-100 border border-gray-200 text-gray-600">🏢 {alloc.buildingName}</span>}
            {alloc.roomNumber   && <span className="text-[11px] px-2 py-0.5 rounded-md bg-gray-100 border border-gray-200 text-gray-600">🚪 Room {alloc.roomNumber}</span>}
            {advanceAmount > 0 && (
              <span className={`text-[11px] px-2 py-0.5 rounded-md border font-semibold ${pendingAdvanceAmount > 0 ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
                Adv {fmt(pendingAdvanceAmount > 0 ? pendingAdvanceAmount : paidAdvanceAmount)}
              </span>
            )}
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
      {/* Bill image modal */}
      {showBillModal && (
        <BillPreviewModal item={item} onClose={() => setShowBillModal(false)} />
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
  const [editingPayment, setEditingPayment] = useState(null);

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
        advanceAmount: t.advanceAmount ?? 0,
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
      formData.append("advanceAmount", editForm.advanceAmount === "" ? "0" : String(Number(editForm.advanceAmount) || 0));
      if (docFiles.aadharFront)   formData.append("aadharFront",   docFiles.aadharFront);
      if (docFiles.aadharBack)    formData.append("aadharBack",    docFiles.aadharBack);
      if (docFiles.passportPhoto) formData.append("passportPhoto", docFiles.passportPhoto);

      const r = await fetch(`${API}/tenants/${tenantId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
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

  const handlePaymentCorrectionSaved = async (result) => {
    setEditingPayment(null);
    await load();
    if (onTenantUpdated) onTenantUpdated(result);
  };

  if (!data && !loading) return null;

  const { tenant, buildingDetails, currentRecord, remaining, history, pendingMonths, arrearsTotal, totalAccumulatedDue, hasPreviousPending, pendingMonthsCount, pendingAdvanceAmount = 0, paidAdvanceAmount = 0 } = data || {};
  const phone = tenant?.phone?.replace(/\D/g, "");
  const advanceAmount = Number(tenant?.advanceAmount || 0);
  const payable = buildPayable(pendingMonths, currentRecord, remaining, pendingAdvanceAmount);
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
                  <AdvanceStatusBadge advanceAmount={advanceAmount} paidAdvanceAmount={paidAdvanceAmount} pendingAdvanceAmount={pendingAdvanceAmount} compact />
                  <div className="flex flex-wrap gap-2 mt-2">
<button 
  onClick={() => window.open(`https://wa.me/91${phone}?text=${buildWAMessage(
    tenant, 
    currentRecord, 
    totalAccumulatedDue, 
    buildingDetails, 
    pendingMonths, 
    isOverdue, 
    daysOverdue, 
    daysUntilDue
  )}`, "_blank")} 
  className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-600 border border-emerald-200 text-emerald-700 hover:text-white transition-colors"
>
  📱 WhatsApp
</button>
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
                  <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-3">
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-amber-700">Advance Amount (₹)</label>
                    <div className="flex items-center gap-2">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-sm font-black text-amber-700 shadow-sm">₹</span>
                      <input type="number" min="0" value={editForm.advanceAmount ?? ""} onChange={(e) => handleEditField("advanceAmount", e.target.value)} className="w-full bg-white border border-amber-200 rounded-xl px-3 py-2 text-gray-900 text-sm font-bold focus:outline-none focus:border-amber-400 transition-colors" placeholder="0" />
                    </div>
                  </div>
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
                  ["Advance Expected", fmt(advanceAmount)],
                  ["Advance Paid", fmt(paidAdvanceAmount)],
                  ["Advance Pending", fmt(pendingAdvanceAmount)],
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
                            {Number(rec.paidAmount || 0) > 0 && (
                              <button
                                onClick={() => setEditingPayment(rec)}
                                className="text-[10px] px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-500 border border-blue-200 text-blue-700 hover:text-white font-bold transition-colors shrink-0"
                                title="Edit payment"
                              >
                                Edit
                              </button>
                            )}
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
      {editingPayment && <EditPaymentModal record={editingPayment} onClose={() => setEditingPayment(null)} onSuccess={handlePaymentCorrectionSaved} />}
    </>
  );
}

// ─── Pay Modal ────────────────────────────────────────────────────────────────
function EditPaymentModal({ record, onClose, onSuccess }) {
  const [monthRentAmount, setMonthRentAmount] = useState(record?.rentAmount ?? 0);
  const [paidAmount, setPaidAmount] = useState(record?.paidAmount ?? 0);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  const rentAmount = Number(monthRentAmount || 0);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSave = async () => {
    const rentVal = Number(monthRentAmount);
    const val = Number(paidAmount);
    if (Number.isNaN(rentVal) || rentVal <= 0) return setError("Enter a valid monthly rent.");
    if (Number.isNaN(val) || val < 0) return setError("Enter a valid paid amount.");
    if (val > rentVal) return setError(`Paid amount cannot exceed rent of ${fmt(rentVal)}.`);
    setLoading(true); setError("");
    try {
      const r = await fetch(`${API}/rent/payment/${record._id}`, {
        method: "PUT",
        headers: authHeader(),
        body: JSON.stringify({ rentAmount: rentVal, paidAmount: val, note }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Failed to update payment.");
      onSuccess(d);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!record) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-white">
          <div>
            <h3 className="text-gray-900 font-bold">Edit Payment</h3>
            <p className="text-gray-500 text-xs mt-0.5">{fmtMonthYear(record.dueDate)}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg transition-colors">x</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
              <p className="text-gray-500 text-[11px] uppercase tracking-wide">Monthly Rent</p>
              <p className="text-gray-900 text-sm font-black mt-1">{fmt(record.rentAmount || 0)}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
              <p className="text-gray-500 text-[11px] uppercase tracking-wide">Current Paid</p>
              <p className="text-emerald-600 text-sm font-black mt-1">{fmt(record.paidAmount || 0)}</p>
            </div>
          </div>
          <div>
            <label className="block text-gray-600 text-xs uppercase tracking-wide mb-1.5">Correct Monthly Rent For This Month (₹)</label>
            <input type="number" value={monthRentAmount} onChange={(e) => setMonthRentAmount(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-lg font-bold focus:outline-none focus:border-blue-400" min="1" />
            <p className="mt-1 text-[11px] text-gray-400">Only this history month will change.</p>
          </div>
          <div>
            <label className="block text-gray-600 text-xs uppercase tracking-wide mb-1.5">Correct Paid Amount (₹)</label>
            <input ref={inputRef} type="number" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSave()} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-lg font-bold focus:outline-none focus:border-blue-400" min="0" max={rentAmount} />
          </div>
          <div>
            <label className="block text-gray-600 text-xs uppercase tracking-wide mb-1.5">Reason / Note</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-blue-400" placeholder="Wrong entry corrected" />
          </div>
          {error && <p className="text-rose-600 text-sm bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-3">
            <button onClick={onClose} disabled={loading} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors disabled:opacity-50">Cancel</button>
            <button onClick={handleSave} disabled={loading} className="flex-1 py-3 rounded-xl font-bold text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all text-sm">{loading ? "Saving..." : "Save"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

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
      const r = await fetch(`${API}/rent/pay`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({ tenantId, amount: val, note, monthYear: selectedMonth, paymentType: selectedOption?.paymentType || "rent" }),
      });
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
              <label className="block text-gray-600 text-xs uppercase tracking-wide mb-1.5">Select Month / Advance to Pay</label>
              <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm font-bold focus:outline-none focus:border-amber-400">
                {payableMonths.map((m) => <option key={m.monthYear} value={m.monthYear}>{m.label} — {fmt(m.maxAmount)}</option>)}
              </select>
            </div>
          ) : (
            <div><p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Paying For</p><p className="text-gray-900 text-lg font-bold">{selectedOption?.label}</p></div>
          )}
          <div><p className="text-gray-500 text-xs uppercase tracking-wide mb-1">{selectedOption?.paymentType === "advance" ? "Pending Advance" : "Remaining Due"}</p><p className="text-3xl font-black text-amber-600">{fmt(maxAmount)}</p></div>
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





// ─── Location Filter Dropdown ─────────────────────────────────────────────────
function LocationFilter({ dueItems, onFilterChange }) {
  const [selectedBuilding, setSelectedBuilding] = useState("");
  const [selectedFloor,    setSelectedFloor]    = useState("");
  const [selectedRoom,     setSelectedRoom]     = useState("");

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

  console.log("Buildings found in filter:", buildings.map(b => b.name));

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

  return (
    <div className="flex flex-wrap items-center gap-2">
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

      {hasAnyFilter && (
        <button
          onClick={clearAll}
          className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors"
        >
          ✕ Clear Filter
        </button>
      )}

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

// ─── Main Component ───────────────────────────────────────────────────────────
export default function RentManagement() {
  const [dueItems,    setDueItems]    = useState([]);
  const [dueLoading,  setDueLoading]  = useState(true);
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

  const [locationFilter, setLocationFilter] = useState({ building: "", floor: "", room: "" });
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all");



  const [selectedTenantId, setSelectedTenantId] = useState(null);
  const [payModal,         setPayModal]          = useState(null);
  const [toast,            setToast]             = useState("");
  const [paymentDone,      setPaymentDone]        = useState(0);


  const [allDueItemsForFilter, setAllDueItemsForFilter] = useState([]);
  const [filterLoading, setFilterLoading] = useState(true);

  const fetchAllDueItems = useCallback(async () => {
    setFilterLoading(true);
    setDueLoading(true);
    try {
      const r = await fetch(`${API}/rent/due?paymentStatus=${encodeURIComponent(paymentStatusFilter)}`, { headers: authHeader() });
      const d = await r.json();
      const allData = Array.isArray(d.data) ? d.data : [];

      setDueItems(allData);
      setAllDueItemsForFilter(allData);
      setTotal(d.total ?? allData.length);
      if (d.stats) setGlobalStats(d.stats);
      return allData;
    } catch (error) {
      console.error("Error fetching all due items:", error);
      setDueItems([]);
      setAllDueItemsForFilter([]);
      setTotal(0);
      return [];
    } finally {
      setDueLoading(false);
      setFilterLoading(false);
    }
  }, [paymentStatusFilter]);

  useEffect(() => {
    fetchAllDueItems();
  }, [paymentDone, fetchAllDueItems]);

  const handleSearchChange = (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    clearTimeout(searchDebounceRef.current);
    if (!q.trim()) { setSearchResults(null); setSearchDone(false); return; }
    searchDebounceRef.current = setTimeout(async () => {
      setSearchLoading(true); setSearchDone(false);
      try {
        const r = await fetch(`${API}/rent/due/search?q=${encodeURIComponent(q.trim())}&paymentStatus=${encodeURIComponent(paymentStatusFilter)}`, { headers: authHeader() });
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

  const handlePaymentStatusChange = (e) => {
    setPaymentStatusFilter(e.target.value);
    setLocationFilter({ building: "", floor: "", room: "" });
    clearSearch();
  };

  const onPayNow = (tenantId, payableMonths, initialMonthYear) => {
    setPayModal({ tenantId, payableMonths, initialMonthYear });
  };

  const onPaySuccess = (data) => {
    setPayModal(null);
    setToast(data.message || "Payment recorded!");
    setPaymentDone((n) => n + 1);
    if (searchQuery.trim()) {
      clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = setTimeout(async () => {
        try {
          const r = await fetch(`${API}/rent/due/search?q=${encodeURIComponent(searchQuery.trim())}&paymentStatus=${encodeURIComponent(paymentStatusFilter)}`, { headers: authHeader() });
          const d = await r.json();
          setSearchResults(Array.isArray(d) ? d : []);
        } catch {}
      }, 300);
    }
  };

  const handleTenantUpdated = () => {
    setToast("Tenant updated successfully!");
    setPaymentDone((n) => n + 1);
  };

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

  const getFilteredItems = useCallback(() => {
    if (!locationFilter.building && !locationFilter.floor && !locationFilter.room) {
      return null;
    }
    return applyLocationFilter(allDueItemsForFilter);
  }, [locationFilter, allDueItemsForFilter]);

  const filteredItems = getFilteredItems();
  const isSearchMode     = searchResults !== null;
  const isFilterMode     = !!(locationFilter.building || locationFilter.floor || locationFilter.room);
  const statsLoading     = dueLoading && dueItems.length === 0;

  let baseItems;
  if (isSearchMode) {
    baseItems = searchResults || [];
  } else if (isFilterMode && filteredItems) {
    baseItems = filteredItems;
  } else {
    baseItems = dueItems;
  }

  const displayItems = baseItems;
  const filterSourceItems = isSearchMode ? (searchResults || []) : allDueItemsForFilter;
  const filteredCount = isFilterMode && filteredItems ? filteredItems.length : 0;
  const paymentStatusOptions = [
    { value: "previous", label: "Previous months overdues" },
    { value: "advance-pending", label: "Advance pending" },
    { value: "current", label: "Current month dues" },
    { value: "upcoming", label: "Upcoming dues" },
    { value: "all", label: "All" },
  ];
  const selectedPaymentStatusLabel = paymentStatusOptions.find((o) => o.value === paymentStatusFilter)?.label || "All";

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
                {selectedPaymentStatusLabel}
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

          <div className="mb-4 p-3 rounded-2xl border border-gray-200 bg-white">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide">Payment status</p>
                <p className="text-gray-400 text-[11px] mt-0.5">Choose which rent records to fetch</p>
              </div>
              <div className="relative w-full sm:w-72">
                <select
                  value={paymentStatusFilter}
                  onChange={handlePaymentStatusChange}
                  className="w-full appearance-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 pr-9 text-sm font-semibold text-gray-800 focus:outline-none focus:border-amber-400 transition-colors"
                >
                  {paymentStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">▼</span>
              </div>
            </div>
          </div>

          {/* Location Filter Row */}
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
                }}
              />
            </div>
          )}

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
                  {[1, 2, 3, 4, 5, 6].slice(0, isSearchMode ? 3 : 6).map((i) => (
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

          {!isSearchMode && !isFilterMode && displayItems.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200 text-center">
              <p className="text-gray-400 text-xs">
                Showing all <span className="font-semibold text-gray-700">{displayItems.length}</span> rent due record{displayItems.length !== 1 ? "s" : ""} for this owner
              </p>
            </div>
          )}

          {/* Filter mode count */}
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
  
      {toast && <Toast msg={toast} onDone={() => setToast("")} />}
    </div>
  );
}
