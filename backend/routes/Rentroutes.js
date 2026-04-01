/**
 * rentRoutes.js
 */

import express from "express";
import jwt from "jsonwebtoken";
import axios from "axios";
import Tenant from "../models/Tenant.js";
import Building from "../models/Building.js";
import RentPayment from "../models/Rentpayment.js";

const router = express.Router();

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

function monthYearKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getAllCyclesSinceJoining(joiningDate, now = new Date(), lookaheadMs = 0) {
  const join = new Date(joiningDate);
  const joinDay = join.getDate();
  const cycles = [];
  const thresholdTime = now.getTime() + lookaheadMs;

  let cycleYear = join.getFullYear();
  let cycleMonth = join.getMonth();

  let safeCounter = 0;
  while (safeCounter < 1200) {
    safeCounter++;
    
    const lastDay = new Date(cycleYear, cycleMonth + 1, 0).getDate();
    const cycleStart = new Date(cycleYear, cycleMonth, Math.min(joinDay, lastDay));

    if (cycleStart.getTime() > thresholdTime) break;

    cycles.push({ year: cycleYear, month: cycleMonth, dueDate: cycleStart });

    cycleMonth++;
    if (cycleMonth > 11) { cycleMonth = 0; cycleYear++; }
  }

  return cycles;
}

async function buildTenantSummary(tenant, ownerId, lookaheadMs = 0) {
  const now = new Date();
  const allCycles = getAllCyclesSinceJoining(tenant.joiningDate, now, lookaheadMs);

  if (allCycles.length === 0) {
    return {
      currentRecord: null, remaining: 0, pendingMonths: [], arrearsTotal: 0, totalAccumulatedDue: 0,
      hasPreviousPending: false, pendingMonthsCount: 0,
      isOverdue: false, daysOverdue: null, daysUntilDue: null, dueDate: null
    };
  }

  const currentCycle = allCycles[allCycles.length - 1];
  const previousCycles = allCycles.slice(0, -1);

  const pendingMonths = [];
  let arrearsTotal = 0;

  for (const { year, month, dueDate } of previousCycles) {
    const key = `${year}-${String(month + 1).padStart(2, "0")}`;
    let record = await RentPayment.findOne({ tenantId: tenant._id, monthYear: key });
    if (!record) {
      record = await RentPayment.create({
        owner: ownerId, tenantId: tenant._id, monthYear: key, dueDate,
        rentAmount: tenant.rentAmount, paidAmount: 0, status: "Due", payments: []
      });
    }
    if (record.status !== "Paid") {
      pendingMonths.push(record.toObject ? record.toObject() : record);
      arrearsTotal += (record.rentAmount - record.paidAmount);
    }
  }

  const currentKey = `${currentCycle.year}-${String(currentCycle.month + 1).padStart(2, "0")}`;
  let currentRecord = await RentPayment.findOne({ tenantId: tenant._id, monthYear: currentKey });
  if (!currentRecord) {
    currentRecord = await RentPayment.create({
      owner: ownerId, tenantId: tenant._id, monthYear: currentKey, dueDate: currentCycle.dueDate,
      rentAmount: tenant.rentAmount, paidAmount: 0, status: "Due", payments: []
    });
  }

  const currentRemaining = currentRecord.rentAmount - currentRecord.paidAmount;
  const msUntilDue = currentRecord.dueDate.getTime() - now.getTime();
  
  const isOverdue = msUntilDue < 0;
  const daysOverdue = isOverdue ? Math.ceil(Math.abs(msUntilDue) / 86400000) : null;
  const daysUntilDue = !isOverdue ? Math.ceil(msUntilDue / 86400000) : null;

  const grandTotal = arrearsTotal + currentRemaining;

  return {
    currentRecord,
    remaining: currentRemaining,
    pendingMonths,
    arrearsTotal,
    totalAccumulatedDue: grandTotal,
    hasPreviousPending: pendingMonths.length > 0,
    pendingMonthsCount: pendingMonths.length,
    isOverdue,
    daysOverdue,
    daysUntilDue,
    dueDate: currentRecord.dueDate
  };
}

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

async function sendBrevoEmail(toEmail, toName, subject, htmlContent) {
  if (!toEmail) throw new Error("Tenant has no email address on record.");

  const apiKey = (process.env.BREVO_API_KEY || "").trim();
  const senderEmail = (process.env.BREVO_SENDER_EMAIL || "").trim();

  if (!apiKey) throw new Error("BREVO_API_KEY is not set in environment variables.");
  if (!senderEmail) throw new Error("BREVO_SENDER_EMAIL is not set in environment variables.");

  const payload = {
    sender: { name: (process.env.BREVO_SENDER_NAME || "Hostel Manager").trim(), email: senderEmail },
    to: [{ email: toEmail, name: toName }],
    subject,
    htmlContent,
  };

  try {
    const { data } = await axios.post(BREVO_API_URL, payload, {
      headers: { "Content-Type": "application/json", "api-key": apiKey },
    });
    return data;
  } catch (err) {
    throw new Error(`Email send failed`);
  }
}

const fmtINR = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) : "—";

function emailWrapper({ accentColor, icon, title, bodyHtml }) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${title}</title><style>body{margin:0;padding:0;background:#f4f6fb;font-family:'Segoe UI',Arial,sans-serif;}a{color:${accentColor};}.wrapper{max-width:600px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);}.header{background:${accentColor};padding:32px 40px 24px;text-align:center;}.header .icon{font-size:40px;display:block;margin-bottom:8px;}.header h1{margin:0;color:#fff;font-size:22px;font-weight:700;}.header p{margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:14px;}.body{padding:32px 40px;}.greeting{font-size:17px;color:#1a202c;font-weight:600;margin-bottom:6px;}.sub{font-size:14px;color:#4a5568;margin-bottom:24px;line-height:1.6;}.card{background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;padding:20px 24px;margin-bottom:20px;}.card-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #e2e8f0;}.card-row:last-child{border-bottom:none;}.card-label{color:#718096;font-size:13px;}.card-value{color:#1a202c;font-size:13px;font-weight:600;}.amount-box{background:${accentColor}10;border:1.5px solid ${accentColor}40;border-radius:10px;padding:16px 20px;text-align:center;margin-bottom:20px;}.amount-box .amount-label{color:#718096;font-size:12px;text-transform:uppercase;margin-bottom:4px;}.amount-box .amount-value{color:${accentColor};font-size:28px;font-weight:800;}.badge{display:inline-block;padding:4px 12px;border-radius:50px;font-size:12px;font-weight:700;}.note-box{border-left:4px solid ${accentColor};background:${accentColor}08;border-radius:0 8px 8px 0;padding:12px 16px;margin-bottom:20px;font-size:13px;color:#4a5568;line-height:1.6;}.footer{background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;}.footer p{margin:0;color:#a0aec0;font-size:12px;line-height:1.8;}.arrears-table{width:100%;border-collapse:collapse;margin-bottom:16px;}.arrears-table th{background:#fef2f2;color:#991b1b;font-size:12px;text-transform:uppercase;padding:8px 12px;text-align:left;border-bottom:2px solid #fecaca;}.arrears-table td{padding:8px 12px;font-size:13px;border-bottom:1px solid #fee2e2;}.arrears-table tr:last-child td{border-bottom:none;}</style></head><body><div class="wrapper"><div class="header"><span class="icon">${icon}</span><h1>${title}</h1><p>${process.env.BREVO_SENDER_NAME || "Hostel Manager"}</p></div><div class="body">${bodyHtml}</div><div class="footer"><p>This is an automated message from ${process.env.BREVO_SENDER_NAME || "Hostel Manager"}.<br/>Please do not reply to this email. For queries, contact your hostel management.</p></div></div></body></html>`;
}

function buildReminderEmail({ tenant, record, buildingDetails, isOverdue, daysOverdue, daysUntilDue, pendingMonths = [], arrearsTotal = 0, totalAccumulatedDue = 0 }) {
  const remaining = record.rentAmount - record.paidAmount;
  const month = new Date(record.dueDate).toLocaleString("en-IN", { month: "long", year: "numeric" });
  const hasPreviousPending = pendingMonths.length > 0;
  const accentColor = (isOverdue || hasPreviousPending) ? "#e53e3e" : "#d97706";

  const statusBadge = isOverdue
    ? `<span class="badge" style="background:#fee2e2;color:#c53030;">⚠️ ${daysOverdue} Day${daysOverdue > 1 ? "s" : ""} Overdue</span>`
    : `<span class="badge" style="background:#fef3c7;color:#b45309;">🕐 Due in ${daysUntilDue === 0 ? "Today" : `${daysUntilDue} Day${daysUntilDue > 1 ? "s" : ""}`}</span>`;

  const buildingHtml = buildingDetails
    ? `<div class="card-row"><span class="card-label">Building</span><span class="card-value">${buildingDetails.buildingName}</span></div>
       <div class="card-row"><span class="card-label">Room</span><span class="card-value">Room ${buildingDetails.roomNumber}</span></div>`
    : "";

  const arrearsHtml = hasPreviousPending
    ? `<div style="background:#fef2f2;border:1.5px solid #fecaca;border-radius:10px;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0 0 10px;color:#991b1b;font-weight:700;font-size:14px;">⚠️ Outstanding Arrears — ${pendingMonths.length} Month${pendingMonths.length > 1 ? "s" : ""} Unpaid</p>
      <table class="arrears-table">
        <thead><tr><th>Month</th><th style="text-align:right;">Due</th><th style="text-align:right;">Paid</th><th style="text-align:right;">Remaining</th></tr></thead>
        <tbody>
          ${pendingMonths.map(pm => `<tr><td>${new Date(pm.dueDate).toLocaleString("en-IN", { month: "long", year: "numeric" })}</td><td style="text-align:right;">${fmtINR(pm.rentAmount)}</td><td style="text-align:right;color:#276749;">${fmtINR(pm.paidAmount)}</td><td style="text-align:right;color:#c53030;font-weight:700;">${fmtINR(pm.rentAmount - pm.paidAmount)}</td></tr>`).join("")}
        </tbody>
      </table>
      <div style="text-align:right;padding-top:8px;border-top:2px solid #fecaca;margin-top:4px;">
        <span style="color:#991b1b;font-size:16px;font-weight:800;">Total Previous Arrears: ${fmtINR(arrearsTotal)}</span>
      </div></div>`
    : "";

  const bodyHtml = `
    <p class="greeting">Hello ${tenant.name},</p>
    <p class="sub">${
      hasPreviousPending
        ? `Your account has <strong style="color:#c53030;">unpaid rent from previous months</strong>. The total outstanding amount including the current month is <strong style="color:#c53030;">${fmtINR(totalAccumulatedDue)}</strong>. Please clear all dues at the earliest.`
        : isOverdue
        ? `Your rent payment for <strong>${month}</strong> is <strong style="color:#c53030;">overdue by ${daysOverdue} day${daysOverdue > 1 ? "s" : ""}</strong>.`
        : `This is a friendly reminder that your rent payment for <strong>${month}</strong> is coming up.`
    }</p>
    ${arrearsHtml}
    <div class="amount-box">
      <div class="amount-label">${hasPreviousPending ? "Total Amount Due (All Months)" : "Amount Due"}</div>
      <div class="amount-value">${fmtINR(hasPreviousPending ? totalAccumulatedDue : remaining)}</div>
      <div style="margin-top:8px;">${statusBadge}</div>
    </div>
    <div class="card">
      <div class="card-row"><span class="card-label">Billing Month</span><span class="card-value">${month}</span></div>
      <div class="card-row"><span class="card-label">Due Date</span><span class="card-value">${fmtDate(record.dueDate)}</span></div>
      <div class="card-row"><span class="card-label">Remaining This Month</span><span class="card-value" style="color:${accentColor};">${fmtINR(remaining)}</span></div>
      ${buildingHtml}
    </div>
  `;

  const subject = hasPreviousPending
    ? `🚨 Urgent: ${pendingMonths.length} Month(s) Rent Arrears — ${fmtINR(totalAccumulatedDue)} Total Outstanding`
    : isOverdue
    ? `⚠️ Rent Overdue by ${daysOverdue} Day${daysOverdue > 1 ? "s" : ""} — ${month}`
    : `🔔 Rent Reminder: Due ${daysUntilDue === 0 ? "Today" : `in ${daysUntilDue} Day${daysUntilDue > 1 ? "s" : ""}`} — ${month}`;

  return { subject, html: emailWrapper({ accentColor, icon: hasPreviousPending ? "🚨" : isOverdue ? "⚠️" : "🔔", title: hasPreviousPending ? "Urgent: Rent Arrears Notice" : isOverdue ? "Rent Payment Overdue" : "Rent Payment Reminder", bodyHtml }) };
}

function buildFullPaymentEmail({ tenant, record, paymentAmount, buildingDetails }) {
  const month = new Date(record.dueDate).toLocaleString("en-IN", { month: "long", year: "numeric" });
  const bodyHtml = `
    <p class="greeting">Hello ${tenant.name},</p>
    <p class="sub">Your rent for <strong>${month}</strong> has been fully paid. Thank you!</p>
    <div class="amount-box"><div class="amount-label">Amount Paid</div><div class="amount-value">${fmtINR(paymentAmount)}</div></div>
  `;
  return { subject: `✅ Rent Paid — ${month}`, html: emailWrapper({ accentColor: "#276749", icon: "✅", title: "Rent Payment Confirmed", bodyHtml }) };
}

function buildPartialPaymentEmail({ tenant, record, paymentAmount, buildingDetails }) {
  const remaining = record.rentAmount - record.paidAmount;
  const month = new Date(record.dueDate).toLocaleString("en-IN", { month: "long", year: "numeric" });
  const bodyHtml = `
    <p class="greeting">Hello ${tenant.name},</p>
    <p class="sub">We have received your partial rent payment for <strong>${month}</strong>. Remaining balance: ${fmtINR(remaining)}.</p>
    <div class="amount-box"><div class="amount-label">Payment Received</div><div class="amount-value" style="color:#276749;">${fmtINR(paymentAmount)}</div></div>
  `;
  return { subject: `⏳ Partial Payment Received — ${fmtINR(remaining)} Still Due for ${month}`, html: emailWrapper({ accentColor: "#d97706", icon: "⏳", title: "Partial Payment Received", bodyHtml }) };
}

// ── Time Constants ────────────────────────────────────────────────────────────
// 5 Days for details/history UI, 2 Days strictly for the Due Alerts UI
const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

router.get("/due", auth, async (req, res) => {
  try {
    const tenants = await Tenant.find({ owner: req.user.id, status: "Active" }).lean();
    const results = [];

    for (const tenant of tenants) {
      // Build summary using 5-day lookahead so internal values are consistent
      const summary = await buildTenantSummary(tenant, req.user.id, FIVE_DAYS_MS);
      
      const owesCurrent = summary.remaining > 0;
      // ONLY trigger the "Due Alert" if it's strictly within 2 days or overdue
      const currentIsDueSoonOrOverdue = (summary.isOverdue || (summary.daysUntilDue !== null && summary.daysUntilDue <= 2));

      if (summary.hasPreviousPending || (owesCurrent && currentIsDueSoonOrOverdue)) {
        results.push({
          tenant,
          record: summary.currentRecord,
          ...summary,
        });
      }
    }

    results.sort((a, b) => {
      if (a.hasPreviousPending && !b.hasPreviousPending) return -1;
      if (!a.hasPreviousPending && b.hasPreviousPending) return 1;
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    });

    res.json(results);
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

router.get("/all", auth, async (req, res) => {
  try {
    const tenants = await Tenant.find({ owner: req.user.id, status: "Active" }).lean();
    const results = await Promise.all(
      tenants.map(async (tenant) => {
        const summary = await buildTenantSummary(tenant, req.user.id, FIVE_DAYS_MS);
        return { tenant, record: summary.currentRecord, ...summary };
      })
    );
    res.json(results);
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

router.get("/search", auth, async (req, res) => {
  try {
    const { q, type } = req.query;
    if (!q) return res.status(400).json({ message: "Query param 'q' is required." });

    let tenants = [];
    if (type === "room") {
      const buildings = await Building.find({ owner: req.user.id }).lean();
      const matchedBedIds = [];
      for (const b of buildings) for (const f of b.floors) for (const r of f.rooms) {
        if (r.roomNumber.toLowerCase().includes(q.toLowerCase())) r.beds.forEach(bed => { if (bed.tenantId) matchedBedIds.push(bed.tenantId.toString()); });
      }
      tenants = await Tenant.find({ owner: req.user.id, status: "Active", _id: { $in: matchedBedIds } }).lean();
    } else {
      tenants = await Tenant.find({ owner: req.user.id, status: "Active", name: { $regex: q, $options: "i" } }).lean();
    }

    const results = await Promise.all(
      tenants.map(async (tenant) => {
        const summary = await buildTenantSummary(tenant, req.user.id, FIVE_DAYS_MS);
        return { tenant, record: summary.currentRecord, ...summary };
      })
    );
    res.json(results);
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

router.get("/tenant/:tenantId", auth, async (req, res) => {
  try {
    const tenant = await Tenant.findOne({ _id: req.params.tenantId, owner: req.user.id }).lean();
    if (!tenant) return res.status(404).json({ message: "Tenant not found." });

    // Build the "Current Month" allowing up to 5 days visibility
    const summary = await buildTenantSummary(tenant, req.user.id, FIVE_DAYS_MS);
    
    // Crucial fix: Only fetch history records where dueDate is <= (Today + 5 Days)
    // This hides old records that were accidentally generated too far in the future
    const thresholdDate = new Date(Date.now() + FIVE_DAYS_MS);
    const history = await RentPayment.find({ 
      tenantId: tenant._id,
      dueDate: { $lte: thresholdDate }
    }).sort({ monthYear: -1 }).lean();

    let buildingDetails = null;
    if (tenant.buildingId) {
      const building = await Building.findById(tenant.buildingId).lean();
      if (building) {
        const floor = building.floors.find((f) => f._id.toString() === tenant.floorId?.toString());
        const room = floor?.rooms.find((r) => r._id.toString() === tenant.roomId?.toString());
        buildingDetails = {
          buildingName: building.buildingName, address: building.address,
          floorNumber: floor?.floorNumber, floorName: floor?.floorName,
          roomNumber: room?.roomNumber, shareType: room?.shareType,
        };
      }
    }

    res.json({ tenant, buildingDetails, ...summary, history });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

router.post("/pay", auth, async (req, res) => {
  try {
    const { tenantId, amount, note, monthYear } = req.body;
    if (!tenantId || !amount || amount <= 0) return res.status(400).json({ message: "Valid amount required." });

    const tenant = await Tenant.findOne({ _id: tenantId, owner: req.user.id });
    if (!tenant) return res.status(404).json({ message: "Tenant not found." });

    let key = monthYear;
    if (!key) {
      const allCycles = getAllCyclesSinceJoining(tenant.joiningDate, new Date(), 0);
      const cycle = allCycles[allCycles.length - 1];
      key = cycle ? `${cycle.year}-${String(cycle.month + 1).padStart(2, "0")}` : monthYearKey(new Date());
    }

    let record = await RentPayment.findOne({ tenantId, monthYear: key });
    if (!record) {
      const parts = key.split("-");
      const dueDate = getDueDateForCycle(tenant.joiningDate, parseInt(parts[0]), parseInt(parts[1]) - 1);
      record = await RentPayment.create({
        owner: req.user.id, tenantId, monthYear: key, dueDate,
        rentAmount: tenant.rentAmount, paidAmount: 0, status: "Due", payments: [],
      });
    }

    const actualPay = Math.min(Number(amount), record.rentAmount - record.paidAmount);
    record.paidAmount += actualPay;
    record.payments.push({ amount: actualPay, paidAt: new Date(), note: note || "" });

    if (record.paidAmount >= record.rentAmount) record.status = "Paid";
    else if (record.paidAmount > 0) record.status = "Partial";

    await record.save();

    if (tenant.email) {
      try {
        const emailTemplate = record.status === "Paid" ? buildFullPaymentEmail({ tenant, record, paymentAmount: actualPay }) : buildPartialPaymentEmail({ tenant, record, paymentAmount: actualPay });
        await sendBrevoEmail(tenant.email, tenant.name, emailTemplate.subject, emailTemplate.html);
      } catch (e) { console.error("Email failed:", e.message); }
    }

    res.json({ message: `Payment of ₹${actualPay} recorded.`, record });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

router.post("/send-reminder", auth, async (req, res) => {
  try {
    const { tenantId } = req.body;
    const tenant = await Tenant.findOne({ _id: tenantId, owner: req.user.id }).lean();
    if (!tenant?.email) return res.status(422).json({ message: "No email." });

    const summary = await buildTenantSummary(tenant, req.user.id, FIVE_DAYS_MS);
    if (summary.currentRecord?.status === "Paid" && !summary.hasPreviousPending) {
      return res.status(400).json({ message: "Rent already paid." });
    }

    const { subject, html } = buildReminderEmail({ tenant, record: summary.currentRecord, ...summary });
    await sendBrevoEmail(tenant.email, tenant.name, subject, html);

    res.json({ message: `Reminder sent to ${tenant.email}.` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;