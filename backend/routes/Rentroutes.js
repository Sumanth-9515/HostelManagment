
/**
 * rentRoutes.js  —  Production-optimised with Email Templates & Global Stats
 */

import express from "express";
import jwt from "jsonwebtoken";
import axios from "axios";
import Tenant from "../models/Tenant.js";
import Building from "../models/Building.js";
import RentPayment from "../models/Rentpayment.js";

const router = express.Router();

// ── Auth ───────────────────────────────────────────────────────────────────────
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

// ── Helpers ────────────────────────────────────────────────────────────────────
function monthYearKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getDueDateForCycle(joiningDate, year, month) {
  const joinDay = new Date(joiningDate).getDate();
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(joinDay, lastDay));
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
      currentRecord: null, remaining: 0, pendingMonths: [], arrearsTotal: 0,
      totalAccumulatedDue: 0, hasPreviousPending: false, pendingMonthsCount: 0,
      isOverdue: false, daysOverdue: null, daysUntilDue: null, dueDate: null,
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
        rentAmount: tenant.rentAmount, paidAmount: 0, status: "Due", payments: [],
      });
    }
    if (record.status !== "Paid") {
      pendingMonths.push(record.toObject ? record.toObject() : record);
      arrearsTotal += record.rentAmount - record.paidAmount;
    }
  }

  const currentKey = `${currentCycle.year}-${String(currentCycle.month + 1).padStart(2, "0")}`;
  let currentRecord = await RentPayment.findOne({ tenantId: tenant._id, monthYear: currentKey });
  if (!currentRecord) {
    currentRecord = await RentPayment.create({
      owner: ownerId, tenantId: tenant._id, monthYear: currentKey,
      dueDate: currentCycle.dueDate, rentAmount: tenant.rentAmount,
      paidAmount: 0, status: "Due", payments: [],
    });
  }

  const currentRemaining = currentRecord.rentAmount - currentRecord.paidAmount;
  const msUntilDue = currentRecord.dueDate.getTime() - now.getTime();
  const isOverdue = msUntilDue < 0;
  const daysOverdue = isOverdue ? Math.ceil(Math.abs(msUntilDue) / 86400000) : null;
  const daysUntilDue = !isOverdue ? Math.ceil(msUntilDue / 86400000) : null;

  return {
    currentRecord,
    remaining: currentRemaining,
    pendingMonths,
    arrearsTotal,
    totalAccumulatedDue: arrearsTotal + currentRemaining,
    hasPreviousPending: pendingMonths.length > 0,
    pendingMonthsCount: pendingMonths.length,
    isOverdue,
    daysOverdue,
    daysUntilDue,
    dueDate: currentRecord.dueDate,
  };
}

function sortDueResults(a, b) {
  if (a.hasPreviousPending && !b.hasPreviousPending) return -1;
  if (!a.hasPreviousPending && b.hasPreviousPending) return 1;
  if (a.isOverdue && !b.isOverdue) return -1;
  if (!a.isOverdue && b.isOverdue) return 1;
  return new Date(a.dueDate) - new Date(b.dueDate);
}

function toResponseItem(item) {
  return {
    tenant:              item.tenant,
    record:              item.currentRecord,
    remaining:           item.remaining,
    pendingMonths:       item.pendingMonths,
    arrearsTotal:        item.arrearsTotal,
    totalAccumulatedDue: item.totalAccumulatedDue,
    hasPreviousPending:  item.hasPreviousPending,
    pendingMonthsCount:  item.pendingMonthsCount,
    isOverdue:           item.isOverdue,
    daysOverdue:         item.daysOverdue,
    daysUntilDue:        item.daysUntilDue,
    dueDate:             item.dueDate,
  };
}

function isDueAlert({ hasPreviousPending, remaining, isOverdue, daysUntilDue }) {
  const owesCurrent = remaining > 0;
  const currentIsDueSoonOrOverdue = isOverdue || (daysUntilDue !== null && daysUntilDue <= 2);
  return hasPreviousPending || (owesCurrent && currentIsDueSoonOrOverdue);
}

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

// ── Email Template Helpers ───────────────────────────────────────────────────
const fmtINR = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) : "—";

function emailWrapper({ accentColor, icon, title, badgeLabel, badgeColor, bodyHtml }) {
  const senderName = process.env.BREVO_SENDER_NAME || "Hostel Manager";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { margin: 0; padding: 0; background: #f0f4f8; font-family: 'Segoe UI', Helvetica, Arial, sans-serif; -webkit-text-size-adjust: 100%; }
    img { border: 0; display: block; max-width: 100%; }
    a { text-decoration: none; }
    table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    td { padding: 0; }
    .email-bg   { background: #f0f4f8; padding: 28px 16px 40px; }
    .email-card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 8px 40px rgba(0,0,0,0.10); }
    .header { background: linear-gradient(135deg, ${accentColor} 0%, ${accentColor}cc 100%); padding: 36px 40px 28px; text-align: center; position: relative; }
    .header-icon { font-size: 44px; line-height: 1; margin-bottom: 10px; display: block; }
    .header-title { color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: -0.3px; margin-bottom: 4px; }
    .header-sub { color: rgba(255,255,255,0.82); font-size: 13px; }
    .header-badge { display: inline-block; margin-top: 14px; background: rgba(255,255,255,0.22); border: 1px solid rgba(255,255,255,0.40); color: #fff; font-size: 12px; font-weight: 700; letter-spacing: 0.5px; padding: 5px 16px; border-radius: 50px; text-transform: uppercase; }
    .body { padding: 32px 36px; }
    .greeting { font-size: 18px; font-weight: 700; color: #1a202c; margin-bottom: 6px; }
    .sub-text  { font-size: 14px; color: #4a5568; line-height: 1.7; margin-bottom: 28px; }
    .amount-box { background: ${accentColor}0f; border: 2px solid ${accentColor}30; border-radius: 14px; padding: 20px; text-align: center; margin-bottom: 24px; }
    .amount-label { color: #718096; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
    .amount-value { color: ${accentColor}; font-size: 36px; font-weight: 900; letter-spacing: -1px; line-height: 1; }
    .amount-note  { color: #718096; font-size: 12px; margin-top: 8px; }
    .status-pill { display: inline-block; padding: 5px 16px; border-radius: 50px; font-size: 12px; font-weight: 700; background: ${badgeColor || accentColor + '20'}; color: ${accentColor}; border: 1px solid ${accentColor}40; margin-top: 12px; }
    .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; color: #a0aec0; margin-bottom: 10px; margin-top: 24px; }
    .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; margin-bottom: 16px; }
    .info-card-header { background: ${accentColor}0c; border-bottom: 1px solid ${accentColor}20; padding: 10px 18px; display: flex; align-items: center; gap: 8px; }
    .info-card-header-icon { font-size: 15px; }
    .info-card-header-label { font-size: 12px; font-weight: 700; color: ${accentColor}; text-transform: uppercase; letter-spacing: 0.8px; }
    .info-row { display: flex; justify-content: space-between; align-items: center; padding: 11px 18px; border-bottom: 1px solid #edf2f7; flex-wrap: wrap; gap: 4px; }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #718096; font-size: 13px; min-width: 120px; }
    .info-value { color: #1a202c; font-size: 13px; font-weight: 600; text-align: right; word-break: break-word; }
    .info-value.accent { color: ${accentColor}; }
    .arrears-wrap { background: #fff5f5; border: 1.5px solid #fed7d7; border-radius: 14px; overflow: hidden; margin-bottom: 20px; }
    .arrears-header { background: #fef2f2; padding: 12px 18px; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid #fed7d7; }
    .arrears-header-text { font-size: 13px; font-weight: 700; color: #c53030; }
    .arrears-table { width: 100%; }
    .arrears-table th { background: #fef2f2; color: #991b1b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; padding: 8px 14px; text-align: left; border-bottom: 1px solid #fecaca; }
    .arrears-table td { padding: 10px 14px; font-size: 13px; border-bottom: 1px solid #fee2e2; color: #2d3748; }
    .arrears-table tr:last-child td { border-bottom: none; }
    .arrears-table .amt-paid { color: #276749; font-weight: 600; }
    .arrears-table .amt-due  { color: #c53030; font-weight: 700; }
    .arrears-total-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 18px; border-top: 2px solid #fecaca; background: #fef2f2; }
    .arrears-total-label { font-size: 13px; font-weight: 700; color: #991b1b; }
    .arrears-total-value { font-size: 16px; font-weight: 800; color: #c53030; }
    .note-box { border-left: 4px solid ${accentColor}; background: ${accentColor}08; border-radius: 0 10px 10px 0; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; color: #4a5568; line-height: 1.7; }
    .divider { border: none; border-top: 1px solid #e2e8f0; margin: 24px 0; }
    .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 22px 36px 24px; text-align: center; }
    .footer-logo { font-size: 16px; font-weight: 800; color: ${accentColor}; margin-bottom: 6px; letter-spacing: -0.3px; }
    .footer-text { color: #a0aec0; font-size: 12px; line-height: 1.8; }
    @media only screen and (max-width: 600px) {
      .email-bg  { padding: 16px 8px 32px; }
      .header    { padding: 28px 20px 22px; }
      .header-title { font-size: 19px; }
      .body      { padding: 24px 20px; }
      .footer    { padding: 20px 20px 22px; }
      .amount-value { font-size: 30px; }
      .info-row  { flex-direction: column; align-items: flex-start; }
      .info-value { text-align: left; }
      .arrears-table th, .arrears-table td { padding: 8px 10px; font-size: 12px; }
    }
  </style>
</head>
<body>
<div class="email-bg">
  <div class="email-card">
    <div class="header">
      <span class="header-icon">${icon}</span>
      <div class="header-title">${title}</div>
      <div class="header-sub">${senderName}</div>
      ${badgeLabel ? `<div class="header-badge">${badgeLabel}</div>` : ""}
    </div>
    <div class="body">
      ${bodyHtml}
    </div>
    <div class="footer">
      <div class="footer-logo">🏠 ${senderName}</div>
      <div class="footer-text">
        This is an automated message. Please do not reply to this email.<br/>
        For any queries, contact your hostel management directly.
      </div>
    </div>
  </div>
</div>
</body>
</html>`;
}

function buildTenantDetailsSection(tenant, accentColor) {
  const rows = [
    tenant.name        && { label: "Full Name",      value: tenant.name },
    tenant.email       && { label: "Email Address",  value: tenant.email },
    tenant.phone       && { label: "Phone",          value: tenant.phone },
    tenant.joiningDate && { label: "Member Since",   value: fmtDate(tenant.joiningDate) },
  ].filter(Boolean);

  return `
    <div class="section-title">👤 Tenant Profile</div>
    <div class="info-card">
      <div class="info-card-header">
        <span class="info-card-header-icon">🪪</span>
        <span class="info-card-header-label">Personal Details</span>
      </div>
      ${rows.map(r => `
        <div class="info-row">
          <span class="info-label">${r.label}</span>
          <span class="info-value">${r.value}</span>
        </div>`).join("")}
    </div>`;
}

function buildRoomAllocationSection(buildingDetails) {
  if (!buildingDetails) return "";
  const rows = [
    buildingDetails.buildingName  && { label: "Building",     value: buildingDetails.buildingName, icon: "🏢" },
    buildingDetails.address       && { label: "Address",      value: buildingDetails.address,       icon: "📍" },
    buildingDetails.floorName     && { label: "Floor",        value: `${buildingDetails.floorName}${buildingDetails.floorNumber ? ` (Floor ${buildingDetails.floorNumber})` : ""}`, icon: "🏗️" },
    buildingDetails.roomNumber    && { label: "Room No.",     value: `Room ${buildingDetails.roomNumber}`, icon: "🚪" },
    buildingDetails.shareType     && { label: "Occupancy",    value: buildingDetails.shareType,     icon: "🛏️" },
  ].filter(Boolean);

  if (rows.length === 0) return "";
  return `
    <div class="section-title">🏠 Room Allocation</div>
    <div class="info-card">
      <div class="info-card-header">
        <span class="info-card-header-icon">📋</span>
        <span class="info-card-header-label">Accommodation Details</span>
      </div>
      ${rows.map(r => `
        <div class="info-row">
          <span class="info-label">${r.icon} ${r.label}</span>
          <span class="info-value">${r.value}</span>
        </div>`).join("")}
    </div>`;
}

function buildReminderEmail({ tenant, record, buildingDetails, isOverdue, daysOverdue, daysUntilDue, pendingMonths = [], arrearsTotal = 0, totalAccumulatedDue = 0 }) {
  const remaining = record.rentAmount - record.paidAmount;
  const month = new Date(record.dueDate).toLocaleString("en-IN", { month: "long", year: "numeric" });
  const hasPreviousPending = pendingMonths.length > 0;
  const accentColor = (isOverdue || hasPreviousPending) ? "#e53e3e" : "#d97706";

  let statusText, badgeLabel, statusPill;
  if (hasPreviousPending) {
    badgeLabel  = `${pendingMonths.length} Month${pendingMonths.length > 1 ? "s" : ""} Arrears`;
    statusText  = `Your account has <strong style="color:#c53030;">unpaid rent from previous months</strong>. Total outstanding including current month is <strong style="color:#c53030;">${fmtINR(totalAccumulatedDue)}</strong>. Please clear all dues at the earliest to avoid penalties.`;
    statusPill  = `<span class="status-pill">🚨 Urgent — Multiple Dues Pending</span>`;
  } else if (isOverdue) {
    badgeLabel  = `${daysOverdue} Day${daysOverdue > 1 ? "s" : ""} Overdue`;
    statusText  = `Your rent payment for <strong>${month}</strong> is <strong style="color:#c53030;">overdue by ${daysOverdue} day${daysOverdue > 1 ? "s" : ""}</strong>. Please pay immediately to avoid late charges.`;
    statusPill  = `<span class="status-pill">⚠️ ${daysOverdue} Day${daysOverdue > 1 ? "s" : ""} Overdue</span>`;
  } else {
    badgeLabel  = daysUntilDue === 0 ? "Due Today" : `Due in ${daysUntilDue} Day${daysUntilDue > 1 ? "s" : ""}`;
    statusText  = `This is a friendly reminder that your rent payment for <strong>${month}</strong> is ${daysUntilDue === 0 ? "<strong>due today</strong>" : `due in <strong>${daysUntilDue} day${daysUntilDue > 1 ? "s" : ""}</strong>`}. Kindly ensure timely payment.`;
    statusPill  = `<span class="status-pill">🕐 ${badgeLabel}</span>`;
  }

  const arrearsHtml = hasPreviousPending ? `
    <div class="section-title">📂 Arrears Breakdown</div>
    <div class="arrears-wrap">
      <div class="arrears-header">
        <span style="font-size:16px;">⚠️</span>
        <span class="arrears-header-text">${pendingMonths.length} Unpaid Month${pendingMonths.length > 1 ? "s" : ""} — Immediate Action Required</span>
      </div>
      <table class="arrears-table">
        <thead>
          <tr>
            <th>Month</th>
            <th style="text-align:right;">Rent Due</th>
            <th style="text-align:right;">Paid</th>
            <th style="text-align:right;">Balance</th>
          </tr>
        </thead>
        <tbody>
          ${pendingMonths.map(pm => `
            <tr>
              <td>${new Date(pm.dueDate).toLocaleString("en-IN", { month: "short", year: "numeric" })}</td>
              <td style="text-align:right;">${fmtINR(pm.rentAmount)}</td>
              <td style="text-align:right;" class="amt-paid">${fmtINR(pm.paidAmount)}</td>
              <td style="text-align:right;" class="amt-due">${fmtINR(pm.rentAmount - pm.paidAmount)}</td>
            </tr>`).join("")}
        </tbody>
      </table>
      <div class="arrears-total-row">
        <span class="arrears-total-label">Previous Arrears Total</span>
        <span class="arrears-total-value">${fmtINR(arrearsTotal)}</span>
      </div>
    </div>` : "";

  const bodyHtml = `
    <p class="greeting">Hello, ${tenant.name}! 👋</p>
    <p class="sub-text">${statusText}</p>
    <div class="amount-box">
      <div class="amount-label">${hasPreviousPending ? "Total Outstanding (All Months)" : "Amount Due This Month"}</div>
      <div class="amount-value">${fmtINR(hasPreviousPending ? totalAccumulatedDue : remaining)}</div>
      <div>${statusPill}</div>
      ${hasPreviousPending ? `<div class="amount-note">Includes ${fmtINR(remaining)} for current month + ${fmtINR(arrearsTotal)} arrears</div>` : ""}
    </div>
    <div class="section-title">📅 Current Billing Cycle</div>
    <div class="info-card">
      <div class="info-card-header">
        <span class="info-card-header-icon">💳</span>
        <span class="info-card-header-label">Payment Details</span>
      </div>
      <div class="info-row"><span class="info-label">Billing Month</span><span class="info-value">${month}</span></div>
      <div class="info-row"><span class="info-label">Due Date</span><span class="info-value">${fmtDate(record.dueDate)}</span></div>
      <div class="info-row"><span class="info-label">Monthly Rent</span><span class="info-value">${fmtINR(record.rentAmount)}</span></div>
      <div class="info-row"><span class="info-label">Paid So Far</span><span class="info-value" style="color:#276749;">${fmtINR(record.paidAmount)}</span></div>
      <div class="info-row"><span class="info-label">Remaining This Month</span><span class="info-value accent">${fmtINR(remaining)}</span></div>
    </div>
    ${arrearsHtml}
    ${buildTenantDetailsSection(tenant, accentColor)}
    ${buildRoomAllocationSection(buildingDetails)}
    <hr class="divider" />
    <div class="note-box">
      💡 <strong>Note:</strong> If you have already made this payment, please disregard this reminder. 
    </div>`;

  const subject = hasPreviousPending
    ? `🚨 Urgent: ${pendingMonths.length} Month(s) Rent Arrears — ${fmtINR(totalAccumulatedDue)} Total Outstanding`
    : isOverdue
    ? `⚠️ Rent Overdue by ${daysOverdue} Day${daysOverdue > 1 ? "s" : ""} — ${month}`
    : `🔔 Rent Reminder: Due ${daysUntilDue === 0 ? "Today" : `in ${daysUntilDue} Day${daysUntilDue > 1 ? "s" : ""}`} — ${month}`;

  const icon  = hasPreviousPending ? "🚨" : isOverdue ? "⚠️" : "🔔";
  const title = hasPreviousPending ? "Urgent: Rent Arrears Notice" : isOverdue ? "Rent Payment Overdue" : "Rent Payment Reminder";

  return { subject, html: emailWrapper({ accentColor, icon, title, badgeLabel, bodyHtml }) };
}

function buildFullPaymentEmail({ tenant, record, paymentAmount, buildingDetails }) {
  const month = new Date(record.dueDate).toLocaleString("en-IN", { month: "long", year: "numeric" });
  const accentColor = "#276749";

  const bodyHtml = `
    <p class="greeting">Thank you, ${tenant.name}! 🎉</p>
    <p class="sub-text">Your rent payment for <strong>${month}</strong> has been received in full. Your account is now up to date. We appreciate your timely payment!</p>
    <div class="amount-box">
      <div class="amount-label">Total Amount Paid</div>
      <div class="amount-value">${fmtINR(paymentAmount)}</div>
      <div><span class="status-pill">✅ Payment Complete</span></div>
    </div>
    <div class="section-title">🧾 Payment Summary</div>
    <div class="info-card">
      <div class="info-card-header"><span class="info-card-header-icon">✅</span><span class="info-card-header-label">Transaction Details</span></div>
      <div class="info-row"><span class="info-label">Billing Month</span><span class="info-value">${month}</span></div>
      <div class="info-row"><span class="info-label">Due Date</span><span class="info-value">${fmtDate(record.dueDate)}</span></div>
      <div class="info-row"><span class="info-label">Amount Paid</span><span class="info-value" style="color:#276749;">${fmtINR(paymentAmount)}</span></div>
      <div class="info-row"><span class="info-label">Balance Remaining</span><span class="info-value">₹0 — Fully Paid</span></div>
    </div>
    ${buildTenantDetailsSection(tenant, accentColor)}
    ${buildRoomAllocationSection(buildingDetails)}
    <hr class="divider" />
    <div class="note-box">🏠 <strong>Keep this as your payment record.</strong></div>`;

  return {
    subject: `✅ Rent Paid Successfully — ${month} | ${fmtINR(paymentAmount)}`,
    html: emailWrapper({ accentColor, icon: "✅", title: "Rent Payment Confirmed", badgeLabel: "Paid in Full", bodyHtml })
  };
}

function buildPartialPaymentEmail({ tenant, record, paymentAmount, buildingDetails }) {
  const remaining = record.rentAmount - record.paidAmount;
  const month = new Date(record.dueDate).toLocaleString("en-IN", { month: "long", year: "numeric" });
  const accentColor = "#d97706";
  const progressPct = Math.round((record.paidAmount / record.rentAmount) * 100);

  const progressBar = `
    <div style="margin:16px 0 4px;">
      <div style="display:flex;justify-content:space-between;font-size:12px;color:#718096;margin-bottom:6px;"><span>Payment Progress</span><span>${progressPct}% paid</span></div>
      <div style="background:#e2e8f0;border-radius:50px;height:10px;overflow:hidden;"><div style="background:linear-gradient(90deg,#276749,#48bb78);width:${progressPct}%;height:100%;border-radius:50px;"></div></div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:#a0aec0;margin-top:4px;"><span>${fmtINR(record.paidAmount)} paid</span><span>${fmtINR(remaining)} remaining</span></div>
    </div>`;

  const bodyHtml = `
    <p class="greeting">Hello, ${tenant.name}!</p>
    <p class="sub-text">
      We have received your partial rent payment of <strong style="color:#276749;">${fmtINR(paymentAmount)}</strong> for <strong>${month}</strong>.
      The remaining balance of <strong style="color:#d97706;">${fmtINR(remaining)}</strong> is still outstanding. 
      Please clear the balance before the due date.
    </p>

    <!-- Amount Box -->
    <div class="amount-box">
      <div class="amount-label">Balance Still Due</div>
      <div class="amount-value">${fmtINR(remaining)}</div>
      <div><span class="status-pill">⏳ Partially Paid</span></div>
    </div>
    <div class="section-title">🧾 Payment Breakdown</div>
    <div class="info-card">
      <div class="info-card-header"><span class="info-card-header-icon">⏳</span><span class="info-card-header-label">Transaction Details</span></div>
      <div class="info-row"><span class="info-label">Billing Month</span><span class="info-value">${month}</span></div>
      <div class="info-row"><span class="info-label">This Payment</span><span class="info-value" style="color:#276749;">+ ${fmtINR(paymentAmount)}</span></div>
      <div class="info-row"><span class="info-label">Balance Remaining</span><span class="info-value accent">${fmtINR(remaining)}</span></div>
      <div style="padding:14px 18px;">${progressBar}</div>
    </div>
    ${buildTenantDetailsSection(tenant, accentColor)}
    ${buildRoomAllocationSection(buildingDetails)}
    <hr class="divider" />
    <div class="note-box">⏰ <strong>Action Required:</strong> Please pay the remaining <strong>${fmtINR(remaining)}</strong> to mark this month as fully settled.</div>`;

  return {
    subject: `⏳ Partial Payment Received — ${fmtINR(remaining)} Still Due for ${month}`,
    html: emailWrapper({ accentColor, icon: "⏳", title: "Partial Payment Received", badgeLabel: `${progressPct}% Paid`, bodyHtml })
  };
}

// ── GET /due (Paginated + Global Stats) ──────────────────────────────────────────
router.get("/due", auth, async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));

    const tenants = await Tenant.find(
      { owner: req.user.id, status: "Active" },
      {
        _id: 1, name: 1, phone: 1, email: 1, joiningDate: 1, rentAmount: 1,
        buildingId: 1, floorId: 1, roomId: 1, bedId: 1,
        allocationInfo: 1, documents: 1,
        fatherName: 1, fatherPhone: 1, permanentAddress: 1, status: 1,
      }
    ).lean();

    if (tenants.length === 0) {
      return res.json({ 
        data: [], page, limit, total: 0, totalPages: 0,
        stats: { totalAlerts: 0, totalOverdueOrCarryForward: 0, totalDueSoon: 0, totalPendingAmount: 0, carryForwardTenantsCount: 0 }
      });
    }

    const summaries = await Promise.all(
      tenants.map(async (tenant) => {
        const s = await buildTenantSummary(tenant, req.user.id, FIVE_DAYS_MS);
        return { tenant, ...s };
      })
    );

    const filtered = summaries.filter(isDueAlert).sort(sortDueResults);

    // Calculate global stats BEFORE paginating
    let totalPendingAmount = 0;
    let totalOverdueOrCarryForward = 0;
    let totalDueSoon = 0;
    let carryForwardTenantsCount = 0;

    filtered.forEach(item => {
      totalPendingAmount += item.totalAccumulatedDue;
      if (item.hasPreviousPending) {
        carryForwardTenantsCount++;
      }
      if (item.hasPreviousPending || item.isOverdue) {
        totalOverdueOrCarryForward++;
      } else if (item.daysUntilDue !== null && item.daysUntilDue <= 2) {
        totalDueSoon++;
      }
    });

    const total      = filtered.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const start      = (page - 1) * limit;
    const data       = filtered.slice(start, start + limit).map(toResponseItem);

    res.json({ 
      data, page, limit, total, totalPages,
      stats: {
        totalAlerts: total,
        totalOverdueOrCarryForward,
        totalDueSoon,
        totalPendingAmount,
        carryForwardTenantsCount
      }
    });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// ── GET /due/search ───────────────────────────────────────────────────────────
router.get("/due/search", auth, async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    if (!q) return res.status(400).json({ message: "Query param 'q' is required." });

    const tenants = await Tenant.find({
      owner: req.user.id,
      status: "Active",
      name: { $regex: q, $options: "i" },
    }).lean();

    if (tenants.length === 0) return res.json([]);

    const summaries = await Promise.all(
      tenants.map(async (tenant) => {
        const s = await buildTenantSummary(tenant, req.user.id, FIVE_DAYS_MS);
        return { tenant, ...s };
      })
    );

    const data = summaries
      .filter(isDueAlert)
      .sort(sortDueResults)
      .map(toResponseItem);

    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// ── Shared APIs ───────────────────────────────────────────────────────────────

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

async function sendBrevoEmail(toEmail, toName, subject, htmlContent) {
  if (!toEmail) throw new Error("Tenant has no email address on record.");
  const apiKey = (process.env.BREVO_API_KEY || "").trim();
  const senderEmail = (process.env.BREVO_SENDER_EMAIL || "").trim();
  if (!apiKey) throw new Error("BREVO_API_KEY is not set in environment variables.");
  if (!senderEmail) throw new Error("BREVO_SENDER_EMAIL is not set in environment variables.");
  const payload = {
    sender: { name: (process.env.BREVO_SENDER_NAME || "Nivas Hostel Manager").trim(), email: senderEmail },
    to: [{ email: toEmail, name: toName }],
    subject,
    htmlContent,
  };
  try {
    const { data } = await axios.post(BREVO_API_URL, payload, {
      headers: { "Content-Type": "application/json", "api-key": apiKey },
    });
    return data;
  } catch {
    throw new Error("Email send failed");
  }
}

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
      for (const b of buildings)
        for (const f of b.floors)
          for (const r of f.rooms)
            if (r.roomNumber.toLowerCase().includes(q.toLowerCase()))
              r.beds.forEach((bed) => { if (bed.tenantId) matchedBedIds.push(bed.tenantId.toString()); });
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

    const summary = await buildTenantSummary(tenant, req.user.id, FIVE_DAYS_MS);

    const thresholdDate = new Date(Date.now() + FIVE_DAYS_MS);
    const history = await RentPayment.find({
      tenantId: tenant._id,
      dueDate: { $lte: thresholdDate },
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
    if (!tenantId || !amount || amount <= 0)
      return res.status(400).json({ message: "Valid amount required." });

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
        const emailTemplate =
          record.status === "Paid"
            ? buildFullPaymentEmail({ tenant, record, paymentAmount: actualPay, buildingDetails: null })
            : buildPartialPaymentEmail({ tenant, record, paymentAmount: actualPay, buildingDetails: null });
        await sendBrevoEmail(tenant.email, tenant.name, emailTemplate.subject, emailTemplate.html);
      } catch (e) {
        console.error("Email failed:", e.message);
      }
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