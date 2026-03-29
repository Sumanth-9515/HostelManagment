/**
 * rentRoutes.js
 *
 * Mount in app.js:
 *   import rentRoutes from "./routes/rentRoutes.js";
 *   app.use("/api/rent", rentRoutes);
 *
 * .env required:
 *   JWT_SECRET=
 *   BREVO_API_KEY=
 *   BREVO_SENDER_EMAIL=
 *   BREVO_SENDER_NAME=Hostel Manager   (optional, defaults to "Hostel Manager")
 */

import express from "express";
import jwt from "jsonwebtoken";
import axios from "axios";
import Tenant from "../models/Tenant.js";
import Building from "../models/Building.js";
import RentPayment from "../models/Rentpayment.js";

const router = express.Router();

// ── Auth middleware ───────────────────────────────────────────────────────────
const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided." });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Invalid token." });
  }
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function getDueDateForCycle(joiningDate, referenceDate = new Date()) {
  const joinDay = new Date(joiningDate).getDate();
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  const day = Math.min(joinDay, lastDayOfMonth);
  return new Date(year, month, day);
}

function monthYearKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

async function ensureRentRecord(tenant, ownerId) {
  const now = new Date();
  const dueDate = getDueDateForCycle(tenant.joiningDate, now);
  const key = monthYearKey(now);

  let record = await RentPayment.findOne({ tenantId: tenant._id, monthYear: key });
  if (!record) {
    record = await RentPayment.create({
      owner: ownerId,
      tenantId: tenant._id,
      monthYear: key,
      dueDate,
      rentAmount: tenant.rentAmount,
      paidAmount: 0,
      status: "Due",
      payments: [],
    });
  }
  return record;
}

// ── Brevo Email Helper ────────────────────────────────────────────────────────

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

/**
 * Send an email via Brevo Transactional API (uses axios — no Node 18 fetch needed).
 * Throws a descriptive error on failure so the route can surface it properly.
 */
async function sendBrevoEmail(toEmail, toName, subject, htmlContent) {
  if (!toEmail) throw new Error("Tenant has no email address on record.");

  // Validate env vars early so the error is obvious
  const apiKey = (process.env.BREVO_API_KEY || "").trim();
  const senderEmail = (process.env.BREVO_SENDER_EMAIL || "").trim();

  if (!apiKey) {
    throw new Error("BREVO_API_KEY is not set in environment variables.");
  }
  if (!senderEmail) {
    throw new Error("BREVO_SENDER_EMAIL is not set in environment variables.");
  }

  const payload = {
    sender: {
      name: (process.env.BREVO_SENDER_NAME || "Hostel Manager").trim(),
      email: senderEmail,
    },
    to: [{ email: toEmail, name: toName }],
    subject,
    htmlContent,
  };

  try {
    const { data } = await axios.post(BREVO_API_URL, payload, {
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
    });
    return data;
  } catch (err) {
    // axios wraps HTTP errors in err.response — extract Brevo's actual message
    const brevoMsg =
      err.response?.data?.message ||
      err.response?.data?.code ||
      err.message ||
      "Unknown Brevo error";
    const status = err.response?.status || "N/A";
    console.error(`[Brevo] ${status} —`, brevoMsg, err.response?.data || "");
    throw new Error(`Email send failed (${status}): ${brevoMsg}`);
  }
}

// ── Email Templates ───────────────────────────────────────────────────────────

const fmtINR = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) : "—";

/**
 * Shared email wrapper with header/footer branding.
 */
function emailWrapper({ accentColor, icon, title, bodyHtml }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${title}</title>
<style>
  body { margin:0; padding:0; background:#f4f6fb; font-family:'Segoe UI',Arial,sans-serif; }
  a { color: ${accentColor}; }
  .wrapper { max-width:600px; margin:32px auto; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08); }
  .header { background:${accentColor}; padding:32px 40px 24px; text-align:center; }
  .header .icon { font-size:40px; display:block; margin-bottom:8px; }
  .header h1 { margin:0; color:#fff; font-size:22px; font-weight:700; letter-spacing:-0.3px; }
  .header p { margin:6px 0 0; color:rgba(255,255,255,0.85); font-size:14px; }
  .body { padding:32px 40px; }
  .greeting { font-size:17px; color:#1a202c; font-weight:600; margin-bottom:6px; }
  .sub { font-size:14px; color:#4a5568; margin-bottom:24px; line-height:1.6; }
  .card { background:#f8fafc; border-radius:12px; border:1px solid #e2e8f0; padding:20px 24px; margin-bottom:20px; }
  .card-row { display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid #e2e8f0; }
  .card-row:last-child { border-bottom:none; }
  .card-label { color:#718096; font-size:13px; }
  .card-value { color:#1a202c; font-size:13px; font-weight:600; }
  .amount-box { background:${accentColor}10; border:1.5px solid ${accentColor}40; border-radius:10px; padding:16px 20px; text-align:center; margin-bottom:20px; }
  .amount-box .amount-label { color:#718096; font-size:12px; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px; }
  .amount-box .amount-value { color:${accentColor}; font-size:28px; font-weight:800; }
  .badge { display:inline-block; padding:4px 12px; border-radius:50px; font-size:12px; font-weight:700; }
  .note-box { border-left:4px solid ${accentColor}; background:${accentColor}08; border-radius:0 8px 8px 0; padding:12px 16px; margin-bottom:20px; font-size:13px; color:#4a5568; line-height:1.6; }
  .footer { background:#f8fafc; border-top:1px solid #e2e8f0; padding:20px 40px; text-align:center; }
  .footer p { margin:0; color:#a0aec0; font-size:12px; line-height:1.8; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <span class="icon">${icon}</span>
    <h1>${title}</h1>
    <p>${process.env.BREVO_SENDER_NAME || "Hostel Manager"}</p>
  </div>
  <div class="body">
    ${bodyHtml}
  </div>
  <div class="footer">
    <p>This is an automated message from ${process.env.BREVO_SENDER_NAME || "Hostel Manager"}.<br/>
    Please do not reply to this email. For queries, contact your hostel management.</p>
  </div>
</div>
</body>
</html>`;
}

/** Template 1 — Rent Due / Overdue Reminder */
function buildReminderEmail({ tenant, record, buildingDetails, isOverdue, daysOverdue, daysUntilDue }) {
  const remaining = record.rentAmount - record.paidAmount;
  const month = new Date(record.dueDate).toLocaleString("en-IN", { month: "long", year: "numeric" });
  const accentColor = isOverdue ? "#e53e3e" : "#d97706";

  const statusBadge = isOverdue
    ? `<span class="badge" style="background:#fee2e2;color:#c53030;">⚠️ ${daysOverdue} Day${daysOverdue > 1 ? "s" : ""} Overdue</span>`
    : `<span class="badge" style="background:#fef3c7;color:#b45309;">🕐 Due in ${daysUntilDue === 0 ? "Today" : `${daysUntilDue} Day${daysUntilDue > 1 ? "s" : ""}`}</span>`;

  const buildingHtml = buildingDetails
    ? `<div class="card-row"><span class="card-label">Building</span><span class="card-value">${buildingDetails.buildingName}</span></div>
       <div class="card-row"><span class="card-label">Floor</span><span class="card-value">Floor ${buildingDetails.floorNumber}${buildingDetails.floorName ? ` (${buildingDetails.floorName})` : ""}</span></div>
       <div class="card-row"><span class="card-label">Room</span><span class="card-value">Room ${buildingDetails.roomNumber}</span></div>`
    : "";

  const partialHtml =
    record.paidAmount > 0
      ? `<div class="card-row"><span class="card-label">Already Paid</span><span class="card-value" style="color:#276749;">${fmtINR(record.paidAmount)}</span></div>`
      : "";

  const bodyHtml = `
    <p class="greeting">Hello ${tenant.name},</p>
    <p class="sub">${
      isOverdue
        ? `Your rent payment for <strong>${month}</strong> is <strong style="color:#c53030;">overdue by ${daysOverdue} day${daysOverdue > 1 ? "s" : ""}</strong>. Please clear your dues at the earliest to avoid any inconvenience.`
        : `This is a friendly reminder that your rent payment for <strong>${month}</strong> is coming up. Please ensure timely payment to avoid any late fees.`
    }</p>

    <div class="amount-box">
      <div class="amount-label">Amount Due</div>
      <div class="amount-value">${fmtINR(remaining)}</div>
      <div style="margin-top:8px;">${statusBadge}</div>
    </div>

    <div class="card">
      <div class="card-row"><span class="card-label">Billing Month</span><span class="card-value">${month}</span></div>
      <div class="card-row"><span class="card-label">Due Date</span><span class="card-value">${fmtDate(record.dueDate)}</span></div>
      <div class="card-row"><span class="card-label">Total Rent</span><span class="card-value">${fmtINR(record.rentAmount)}</span></div>
      ${partialHtml}
      <div class="card-row"><span class="card-label">Remaining</span><span class="card-value" style="color:${accentColor};">${fmtINR(remaining)}</span></div>
      ${buildingHtml}
    </div>

    <div class="note-box">
      💡 Please pay your rent on time to maintain a good payment record. If you have already made the payment, kindly ignore this reminder.
    </div>
  `;

  const subject = isOverdue
    ? `⚠️ Rent Overdue by ${daysOverdue} Day${daysOverdue > 1 ? "s" : ""} — ${month}`
    : `🔔 Rent Reminder: Due ${daysUntilDue === 0 ? "Today" : `in ${daysUntilDue} Day${daysUntilDue > 1 ? "s" : ""}`} — ${month}`;

  return {
    subject,
    html: emailWrapper({
      accentColor,
      icon: isOverdue ? "⚠️" : "🔔",
      title: isOverdue ? "Rent Payment Overdue" : "Rent Payment Reminder",
      bodyHtml,
    }),
  };
}

/** Template 2 — Partial Payment Received */
function buildPartialPaymentEmail({ tenant, record, paymentAmount, buildingDetails }) {
  const remaining = record.rentAmount - record.paidAmount;
  const month = new Date(record.dueDate).toLocaleString("en-IN", { month: "long", year: "numeric" });
  const accentColor = "#d97706";

  const buildingHtml = buildingDetails
    ? `<div class="card-row"><span class="card-label">Room</span><span class="card-value">Room ${buildingDetails.roomNumber}, ${buildingDetails.buildingName}</span></div>`
    : "";

  const bodyHtml = `
    <p class="greeting">Hello ${tenant.name},</p>
    <p class="sub">We have received your partial rent payment for <strong>${month}</strong>. Thank you! Your remaining balance is shown below.</p>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
      <div class="amount-box" style="margin-bottom:0;">
        <div class="amount-label">Payment Received</div>
        <div class="amount-value" style="font-size:22px;color:#276749;">${fmtINR(paymentAmount)}</div>
      </div>
      <div class="amount-box" style="margin-bottom:0;background:#fff7ed;border-color:#fed7aa;">
        <div class="amount-label">Still Remaining</div>
        <div class="amount-value" style="font-size:22px;color:#c2410c;">${fmtINR(remaining)}</div>
      </div>
    </div>

    <div class="card">
      <div class="card-row"><span class="card-label">Billing Month</span><span class="card-value">${month}</span></div>
      <div class="card-row"><span class="card-label">Total Rent</span><span class="card-value">${fmtINR(record.rentAmount)}</span></div>
      <div class="card-row"><span class="card-label">Total Paid So Far</span><span class="card-value" style="color:#276749;">${fmtINR(record.paidAmount)}</span></div>
      <div class="card-row"><span class="card-label">Remaining Balance</span><span class="card-value" style="color:#c2410c;">${fmtINR(remaining)}</span></div>
      <div class="card-row"><span class="card-label">Due Date</span><span class="card-value">${fmtDate(record.dueDate)}</span></div>
      ${buildingHtml}
    </div>

    <div class="note-box">
      ⏳ Please clear the remaining balance of <strong>${fmtINR(remaining)}</strong> before the due date to avoid any late charges.
    </div>
  `;

  return {
    subject: `✅ Partial Payment of ${fmtINR(paymentAmount)} Received — ${month}`,
    html: emailWrapper({
      accentColor,
      icon: "💳",
      title: "Partial Payment Received",
      bodyHtml,
    }),
  };
}

/** Template 3 — Full Payment Confirmed */
function buildFullPaymentEmail({ tenant, record, paymentAmount, buildingDetails }) {
  const month = new Date(record.dueDate).toLocaleString("en-IN", { month: "long", year: "numeric" });
  const accentColor = "#059669";

  const buildingHtml = buildingDetails
    ? `<div class="card-row"><span class="card-label">Room</span><span class="card-value">Room ${buildingDetails.roomNumber}, ${buildingDetails.buildingName}</span></div>`
    : "";

  const bodyHtml = `
    <p class="greeting">Hello ${tenant.name},</p>
    <p class="sub">🎉 Your rent for <strong>${month}</strong> has been paid in full. Thank you for your timely payment!</p>

    <div class="amount-box" style="background:#f0fdf4;border-color:#86efac;">
      <div class="amount-label">Total Paid</div>
      <div class="amount-value" style="color:#15803d;">${fmtINR(record.rentAmount)}</div>
      <div style="margin-top:8px;"><span class="badge" style="background:#dcfce7;color:#15803d;">✅ Fully Paid</span></div>
    </div>

    <div class="card">
      <div class="card-row"><span class="card-label">Billing Month</span><span class="card-value">${month}</span></div>
      <div class="card-row"><span class="card-label">Amount Paid</span><span class="card-value" style="color:#15803d;">${fmtINR(record.rentAmount)}</span></div>
      <div class="card-row"><span class="card-label">Payment Date</span><span class="card-value">${fmtDate(new Date())}</span></div>
      <div class="card-row"><span class="card-label">Status</span><span class="card-value"><span class="badge" style="background:#dcfce7;color:#15803d;">✅ Paid</span></span></div>
      ${buildingHtml}
    </div>

    <div class="note-box" style="border-color:#059669;background:#f0fdf4;">
      🙏 Thank you for being a responsible tenant. Your payment has been recorded. Please keep this email as your receipt for the month of ${month}.
    </div>
  `;

  return {
    subject: `🎉 Rent Fully Paid for ${month} — Thank You!`,
    html: emailWrapper({
      accentColor,
      icon: "✅",
      title: "Rent Payment Confirmed",
      bodyHtml,
    }),
  };
}

// ── 1. DASHBOARD — tenants whose rent is due ≤ 2 days away or already overdue ─
// GET /api/rent/due
router.get("/due", auth, async (req, res) => {
  try {
    const tenants = await Tenant.find({ owner: req.user.id, status: "Active" }).lean();
    const now = new Date();
    const twoDaysMs = 2 * 24 * 60 * 60 * 1000;

    const results = [];

    for (const tenant of tenants) {
      const dueDate = getDueDateForCycle(tenant.joiningDate, now);
      const msUntilDue = dueDate - now;

      if (msUntilDue > twoDaysMs) continue;

      const key = monthYearKey(now);
      let record = await RentPayment.findOne({ tenantId: tenant._id, monthYear: key });

      if (record?.status === "Paid") continue;

      if (!record) {
        record = await RentPayment.create({
          owner: req.user.id,
          tenantId: tenant._id,
          monthYear: key,
          dueDate,
          rentAmount: tenant.rentAmount,
          paidAmount: 0,
          status: "Due",
          payments: [],
        });
      }

      const remaining = record.rentAmount - record.paidAmount;
      const isOverdue = msUntilDue < 0;
      const daysOverdue = isOverdue ? Math.ceil(Math.abs(msUntilDue) / 86400000) : null;
      const daysUntilDue = !isOverdue ? Math.ceil(msUntilDue / 86400000) : null;

      results.push({
        tenant,
        record,
        remaining,
        isOverdue,
        daysOverdue,
        daysUntilDue,
        dueDate,
      });
    }

    results.sort((a, b) => {
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    });

    res.json(results);
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// ── 2. ALL TENANTS with current-month payment status ─────────────────────────
// GET /api/rent/all
router.get("/all", auth, async (req, res) => {
  try {
    const tenants = await Tenant.find({ owner: req.user.id, status: "Active" }).lean();

    const results = await Promise.all(
      tenants.map(async (tenant) => {
        const record = await ensureRentRecord(tenant, req.user.id);
        return {
          tenant,
          record,
          remaining: record.rentAmount - record.paidAmount,
        };
      })
    );

    res.json(results);
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// ── 3. SEARCH by name or roomNumber ──────────────────────────────────────────
// GET /api/rent/search?q=<name_or_room>
router.get("/search", auth, async (req, res) => {
  try {
    const { q, type } = req.query;
    if (!q) return res.status(400).json({ message: "Query param 'q' is required." });

    let tenants = [];

    if (type === "room") {
      const buildings = await Building.find({ owner: req.user.id }).lean();
      const matchedBedIds = [];

      for (const building of buildings) {
        for (const floor of building.floors) {
          for (const room of floor.rooms) {
            if (room.roomNumber.toLowerCase().includes(q.toLowerCase())) {
              for (const bed of room.beds) {
                if (bed.tenantId) matchedBedIds.push(bed.tenantId.toString());
              }
            }
          }
        }
      }

      tenants = await Tenant.find({
        owner: req.user.id,
        status: "Active",
        _id: { $in: matchedBedIds },
      }).lean();
    } else {
      tenants = await Tenant.find({
        owner: req.user.id,
        status: "Active",
        name: { $regex: q, $options: "i" },
      }).lean();
    }

    const results = await Promise.all(
      tenants.map(async (tenant) => {
        const record = await ensureRentRecord(tenant, req.user.id);
        return {
          tenant,
          record,
          remaining: record.rentAmount - record.paidAmount,
        };
      })
    );

    res.json(results);
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// ── 4. SINGLE TENANT — full detail + full payment history ────────────────────
// GET /api/rent/tenant/:tenantId
router.get("/tenant/:tenantId", auth, async (req, res) => {
  try {
    const tenant = await Tenant.findOne({ _id: req.params.tenantId, owner: req.user.id }).lean();
    if (!tenant) return res.status(404).json({ message: "Tenant not found." });

    const currentRecord = await ensureRentRecord(tenant, req.user.id);

    const history = await RentPayment.find({ tenantId: tenant._id }).sort({ monthYear: -1 }).lean();

    let buildingDetails = null;
    if (tenant.buildingId) {
      const building = await Building.findById(tenant.buildingId).lean();
      if (building) {
        const floor = building.floors.find((f) => f._id.toString() === tenant.floorId?.toString());
        const room = floor?.rooms.find((r) => r._id.toString() === tenant.roomId?.toString());
        buildingDetails = {
          buildingName: building.buildingName,
          address: building.address,
          floorNumber: floor?.floorNumber,
          floorName: floor?.floorName,
          roomNumber: room?.roomNumber,
          shareType: room?.shareType,
        };
      }
    }

    res.json({
      tenant,
      buildingDetails,
      currentRecord,
      remaining: currentRecord.rentAmount - currentRecord.paidAmount,
      history,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// ── 5. RECORD PAYMENT ─────────────────────────────────────────────────────────
// POST /api/rent/pay
// Body: { tenantId, amount, note?, monthYear? }
router.post("/pay", auth, async (req, res) => {
  try {
    const { tenantId, amount, note, monthYear } = req.body;

    if (!tenantId || !amount || amount <= 0) {
      return res.status(400).json({ message: "tenantId and a positive amount are required." });
    }

    const tenant = await Tenant.findOne({ _id: tenantId, owner: req.user.id });
    if (!tenant) return res.status(404).json({ message: "Tenant not found." });

    const key = monthYear || monthYearKey();
    let record = await RentPayment.findOne({ tenantId, monthYear: key });

    if (!record) {
      const parts = key.split("-");
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1;
      const joinDay = new Date(tenant.joiningDate).getDate();
      const lastDay = new Date(year, month + 1, 0).getDate();
      const dueDate = new Date(year, month, Math.min(joinDay, lastDay));

      record = await RentPayment.create({
        owner: req.user.id,
        tenantId,
        monthYear: key,
        dueDate,
        rentAmount: tenant.rentAmount,
        paidAmount: 0,
        status: "Due",
        payments: [],
      });
    }

    const remaining = record.rentAmount - record.paidAmount;
    const actualPay = Math.min(Number(amount), remaining);

    record.paidAmount += actualPay;
    record.payments.push({ amount: actualPay, paidAt: new Date(), note: note || "" });

    if (record.paidAmount >= record.rentAmount) {
      record.status = "Paid";
    } else if (record.paidAmount > 0) {
      record.status = "Partial";
    }

    await record.save();

    // ── Auto-send payment confirmation email ──────────────────────────────────
    if (tenant.email) {
      try {
        // Fetch building details for email
        let buildingDetails = null;
        if (tenant.buildingId) {
          const building = await Building.findById(tenant.buildingId).lean();
          if (building) {
            const floor = building.floors.find((f) => f._id.toString() === tenant.floorId?.toString());
            const room = floor?.rooms.find((r) => r._id.toString() === tenant.roomId?.toString());
            buildingDetails = {
              buildingName: building.buildingName,
              floorNumber: floor?.floorNumber,
              floorName: floor?.floorName,
              roomNumber: room?.roomNumber,
            };
          }
        }

        let emailTemplate;
        if (record.status === "Paid") {
          emailTemplate = buildFullPaymentEmail({ tenant, record, paymentAmount: actualPay, buildingDetails });
        } else {
          emailTemplate = buildPartialPaymentEmail({ tenant, record, paymentAmount: actualPay, buildingDetails });
        }

        await sendBrevoEmail(tenant.email, tenant.name, emailTemplate.subject, emailTemplate.html);
      } catch (emailErr) {
        // Don't fail the payment if email fails — just log
        console.error("Payment email failed:", emailErr.message);
      }
    }

    res.json({
      message: `Payment of ₹${actualPay} recorded.`,
      record,
      remaining: record.rentAmount - record.paidAmount,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// ── 6. SEND REMINDER EMAIL ────────────────────────────────────────────────────
// POST /api/rent/send-reminder
// Body: { tenantId }
router.post("/send-reminder", auth, async (req, res) => {
  try {
    const { tenantId } = req.body;
    if (!tenantId) return res.status(400).json({ message: "tenantId is required." });

    const tenant = await Tenant.findOne({ _id: tenantId, owner: req.user.id }).lean();
    if (!tenant) return res.status(404).json({ message: "Tenant not found." });

    if (!tenant.email) {
      return res.status(422).json({ message: "Tenant does not have an email address on record." });
    }

    // Ensure current month record exists
    const record = await ensureRentRecord(tenant, req.user.id);

    if (record.status === "Paid") {
      return res.status(400).json({ message: "Rent is already fully paid for this month." });
    }

    // Compute overdue / upcoming status
    const now = new Date();
    const dueDate = getDueDateForCycle(tenant.joiningDate, now);
    const msUntilDue = dueDate - now;
    const isOverdue = msUntilDue < 0;
    const daysOverdue = isOverdue ? Math.ceil(Math.abs(msUntilDue) / 86400000) : null;
    const daysUntilDue = !isOverdue ? Math.ceil(msUntilDue / 86400000) : null;

    // Fetch building details
    let buildingDetails = null;
    if (tenant.buildingId) {
      const building = await Building.findById(tenant.buildingId).lean();
      if (building) {
        const floor = building.floors.find((f) => f._id.toString() === tenant.floorId?.toString());
        const room = floor?.rooms.find((r) => r._id.toString() === tenant.roomId?.toString());
        buildingDetails = {
          buildingName: building.buildingName,
          floorNumber: floor?.floorNumber,
          floorName: floor?.floorName,
          roomNumber: room?.roomNumber,
        };
      }
    }

    const { subject, html } = buildReminderEmail({
      tenant,
      record,
      buildingDetails,
      isOverdue,
      daysOverdue,
      daysUntilDue,
    });

    await sendBrevoEmail(tenant.email, tenant.name, subject, html);

    res.json({ message: `Reminder email sent to ${tenant.email}.` });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to send email." });
  }
});

export default router;