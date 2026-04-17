/**
 * autoMailRoutes.js — Routes + Cron Service for Automatic Email Reminders
 */

import express from "express";
import jwt from "jsonwebtoken";
import cron from "node-cron";
import axios from "axios";

import Tenant from "../models/Tenant.js";
import RentPayment from "../models/Rentpayment.js";
import AutoMailConfig from "../models/Automailconfig.js";
import Building from "../models/Building.js";

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

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

async function sendBrevoEmail(toEmail, toName, subject, htmlContent) {
  if (!toEmail) throw new Error("No email address for tenant.");
  const apiKey      = (process.env.BREVO_API_KEY        || "").trim();
  const senderEmail = (process.env.BREVO_SENDER_EMAIL   || "").trim();
  const senderName  = (process.env.BREVO_SENDER_NAME    || "Hostel Manager").trim();

  if (!apiKey)      throw new Error("BREVO_API_KEY not set.");
  if (!senderEmail) throw new Error("BREVO_SENDER_EMAIL not set.");

  const payload = {
    sender: { name: senderName, email: senderEmail },
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
    throw new Error(err.response ? err.response.data.message || err.message : err.message);
  }
}

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

function getMins(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
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

async function getBuildingDetailsForTenant(tenant) {
  if (!tenant.buildingId) return null;
  const building = await Building.findById(tenant.buildingId).lean();
  if (!building) return null;

  const floor = building.floors.find((f) => f._id.toString() === tenant.floorId?.toString());
  const room = floor?.rooms.find((r) => r._id.toString() === tenant.roomId?.toString());

  return {
    buildingName: building.buildingName,
    address: building.address,
    floorNumber: floor?.floorNumber,
    floorName: floor?.floorName,
    roomNumber: room?.roomNumber,
    shareType: room?.shareType,
  };
}

const fmtINR = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

// ── Email Templates (Fully Responsive with Tables instead of Flex) ──
function emailWrapper({ accentColor, icon, title, badgeLabel, bodyHtml }) {
  const senderName = process.env.BREVO_SENDER_NAME || "Hostel Manager";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { margin: 0; padding: 0; background: #f0f4f8; font-family: 'Segoe UI', Helvetica, Arial, sans-serif; -webkit-text-size-adjust: 100%; width: 100%; }
    .email-bg { background: #f0f4f8; padding: 20px 10px; width: 100%; }
    .email-card { max-width: 600px; width: 100%; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, ${accentColor} 0%, ${accentColor}cc 100%); padding: 30px 20px; text-align: center; }
    .header-icon { font-size: 40px; margin-bottom: 10px; display: block; }
    .header-title { color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: -0.3px; margin-bottom: 4px; }
    .header-sub { color: rgba(255,255,255,0.85); font-size: 13px; }
    .header-badge { display: inline-block; margin-top: 12px; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.4); color: #fff; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 50px; text-transform: uppercase; }
    .body { padding: 24px 20px; }
    .greeting { font-size: 16px; font-weight: 700; color: #1a202c; margin-bottom: 6px; }
    .sub-text { font-size: 13px; color: #4a5568; line-height: 1.6; margin-bottom: 24px; }
    .amount-box { background: ${accentColor}0f; border: 1px solid ${accentColor}30; border-radius: 12px; padding: 16px; text-align: center; margin-bottom: 24px; }
    .amount-label { color: #718096; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
    .amount-value { color: ${accentColor}; font-size: 32px; font-weight: 900; letter-spacing: -1px; }
    .status-pill { display: inline-block; padding: 4px 12px; border-radius: 50px; font-size: 11px; font-weight: 700; background: ${accentColor}20; color: ${accentColor}; margin-top: 8px; }
    .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #a0aec0; margin-bottom: 8px; margin-top: 20px; }
    .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 16px; }
    .info-card-header { background: ${accentColor}0c; border-bottom: 1px solid ${accentColor}20; padding: 10px 16px; }
    .arrears-wrap { background: #fff5f5; border: 1px solid #fed7d7; border-radius: 12px; overflow: hidden; margin-bottom: 20px; }
    .arrears-header { background: #fef2f2; padding: 10px 14px; border-bottom: 1px solid #fed7d7; }
    .arrears-table { width: 100%; border-collapse: collapse; }
    .arrears-table th { background: #fef2f2; color: #991b1b; font-size: 10px; text-transform: uppercase; padding: 8px; text-align: right; border-bottom: 1px solid #fecaca; }
    .arrears-table th:first-child { text-align: left; }
    .arrears-table td { padding: 8px; font-size: 12px; border-bottom: 1px solid #fee2e2; color: #2d3748; text-align: right; }
    .arrears-table td:first-child { text-align: left; }
    .arrears-total-row { background: #fef2f2; border-top: 2px solid #fecaca; }
    .note-box { border-left: 4px solid ${accentColor}; background: ${accentColor}08; border-radius: 0 8px 8px 0; padding: 12px; margin-top: 20px; font-size: 12px; color: #4a5568; line-height: 1.6; }
    .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px; text-align: center; }
    .footer-logo { font-size: 14px; font-weight: 800; color: ${accentColor}; margin-bottom: 4px; }
    .footer-text { color: #a0aec0; font-size: 11px; line-height: 1.6; }
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
    tenant.email       && { label: "Email",          value: tenant.email },
    tenant.phone       && { label: "Phone",          value: tenant.phone },
    tenant.joiningDate && { label: "Joined",         value: fmtDate(tenant.joiningDate) },
  ].filter(Boolean);
  
  return `
    <div class="section-title">👤 Tenant Profile</div>
    <div class="info-card">
      <div class="info-card-header">
        <span style="font-size:14px; vertical-align: middle;">🪪</span>
        <span style="font-size:11px;font-weight:700;color:${accentColor};text-transform:uppercase;margin-left:6px;vertical-align: middle;">Personal Details</span>
      </div>
      <table width="100%" style="border-collapse: collapse;">
        ${rows.map(r => `
          <tr>
            <td style="padding:10px 16px; border-bottom:1px solid #edf2f7; color:#718096; font-size:12px; width:40%; vertical-align:top;">${r.label}</td>
            <td style="padding:10px 16px; border-bottom:1px solid #edf2f7; color:#1a202c; font-size:12px; font-weight:600; text-align:right; width:60%; word-break:break-word; vertical-align:top;">${r.value}</td>
          </tr>
        `).join("")}
      </table>
    </div>`;
}

function buildRoomAllocationSection(buildingDetails) {
  if (!buildingDetails) return "";
  const rows = [
    buildingDetails.buildingName  && { label: "Building",     value: buildingDetails.buildingName, icon: "🏢" },
    buildingDetails.roomNumber    && { label: "Room No.",     value: `Room ${buildingDetails.roomNumber}`, icon: "🚪" },
  ].filter(Boolean);
  
  return `
    <div class="section-title">🏠 Room Allocated</div>
    <div class="info-card">
      <div class="info-card-header">
        <span style="font-size:14px; vertical-align: middle;">📋</span>
        <span style="font-size:11px;font-weight:700;color:#2c3e50;text-transform:uppercase;margin-left:6px;vertical-align: middle;">Accommodation Details</span>
      </div>
      <table width="100%" style="border-collapse: collapse;">
        ${rows.map(r => `
          <tr>
            <td style="padding:10px 16px; border-bottom:1px solid #edf2f7; color:#718096; font-size:12px; width:45%; vertical-align:top;">${r.icon} ${r.label}</td>
            <td style="padding:10px 16px; border-bottom:1px solid #edf2f7; color:#1a202c; font-size:12px; font-weight:600; text-align:right; width:55%; word-break:break-word; vertical-align:top;">${r.value}</td>
          </tr>
        `).join("")}
      </table>
    </div>`;
}

function buildReminderEmail({ tenant, record, buildingDetails, isOverdue, daysOverdue, daysUntilDue, pendingMonths = [], arrearsTotal = 0, totalAccumulatedDue = 0 }) {
  const remaining = record.rentAmount - record.paidAmount;
  const month = new Date(record.dueDate).toLocaleString("en-IN", { month: "short", year: "numeric" });
  const hasPreviousPending = pendingMonths.length > 0;
  const accentColor = (isOverdue || hasPreviousPending) ? "#e53e3e" : "#d97706";

  let statusText, badgeLabel, statusPill;
  if (hasPreviousPending) {
    badgeLabel  = `${pendingMonths.length} Mth${pendingMonths.length > 1 ? "s" : ""} Arrears`;
    statusText  = `Your account has <strong style="color:#c53030;">unpaid rent from previous months</strong>. Total outstanding is <strong style="color:#c53030;">${fmtINR(totalAccumulatedDue)}</strong>. Please clear all dues immediately.`;
    statusPill  = `<span class="status-pill">🚨 Urgent — Dues Pending</span>`;
  } else if (isOverdue) {
    badgeLabel  = `${daysOverdue} Day${daysOverdue > 1 ? "s" : ""} Overdue`;
    statusText  = `Your rent payment for <strong>${month}</strong> is <strong style="color:#c53030;">overdue by ${daysOverdue} day${daysOverdue > 1 ? "s" : ""}</strong>. Please pay immediately to avoid late charges.`;
    statusPill  = `<span class="status-pill">⚠️ Overdue</span>`;
  } else {
    badgeLabel  = daysUntilDue === 0 ? "Due Today" : `Due in ${daysUntilDue} Day${daysUntilDue > 1 ? "s" : ""}`;
    statusText  = `This is a friendly reminder that your rent payment for <strong>${month}</strong> is ${daysUntilDue === 0 ? "<strong>due today</strong>" : `due in <strong>${daysUntilDue} day${daysUntilDue > 1 ? "s" : ""}</strong>`}. Kindly ensure timely payment.`;
    statusPill  = `<span class="status-pill">🕐 ${badgeLabel}</span>`;
  }

  const arrearsHtml = hasPreviousPending ? `
    <div class="section-title">📂 Arrears Breakdown</div>
    <div class="arrears-wrap">
      <div class="arrears-header">
        <span style="font-size:14px; vertical-align:middle;">⚠️</span>
        <span style="font-size:12px;font-weight:700;color:#c53030;margin-left:4px;vertical-align:middle;">${pendingMonths.length} Unpaid Month${pendingMonths.length > 1 ? "s" : ""}</span>
      </div>
      <table class="arrears-table">
        <thead>
          <tr>
            <th>Mth</th>
            <th>Due</th>
            <th>Paid</th>
            <th>Bal</th>
          </tr>
        </thead>
        <tbody>
          ${pendingMonths.map(pm => `
            <tr>
              <td>${new Date(pm.dueDate).toLocaleString("en-IN", { month: "short", year: "2-digit" })}</td>
              <td>${fmtINR(pm.rentAmount)}</td>
              <td style="color:#276749;font-weight:600;">${fmtINR(pm.paidAmount)}</td>
              <td style="color:#c53030;font-weight:700;">${fmtINR(pm.rentAmount - pm.paidAmount)}</td>
            </tr>
          `).join("")}
          <tr class="arrears-total-row">
            <td colspan="3" style="font-weight:700;color:#991b1b;padding:12px 8px;">Total Arrears</td>
            <td style="font-weight:800;color:#c53030;padding:12px 8px;font-size:14px;">${fmtINR(arrearsTotal)}</td>
          </tr>
        </tbody>
      </table>
    </div>` : "";

  const bodyHtml = `
    <p class="greeting">Hello, ${tenant.name}! 👋</p>
    <p class="sub-text">${statusText}</p>
    <div class="amount-box">
      <div class="amount-label">${hasPreviousPending ? "Total Outstanding" : "Amount Due"}</div>
      <div class="amount-value">${fmtINR(hasPreviousPending ? totalAccumulatedDue : remaining)}</div>
      <div>${statusPill}</div>
    </div>
    
    <div class="section-title">📅 Current Billing Cycle</div>
    <div class="info-card">
      <div class="info-card-header">
        <span style="font-size:14px; vertical-align: middle;">💳</span>
        <span style="font-size:11px;font-weight:700;color:${accentColor};text-transform:uppercase;margin-left:6px;vertical-align: middle;">Payment Details</span>
      </div>
      <table width="100%" style="border-collapse: collapse;">
        <tr>
          <td style="padding:10px 16px; border-bottom:1px solid #edf2f7; color:#718096; font-size:12px; width:45%;">Billing Month</td>
          <td style="padding:10px 16px; border-bottom:1px solid #edf2f7; color:#1a202c; font-size:12px; font-weight:600; text-align:right; width:55%;">${month}</td>
        </tr>
        <tr>
          <td style="padding:10px 16px; border-bottom:1px solid #edf2f7; color:#718096; font-size:12px;">Due Date</td>
          <td style="padding:10px 16px; border-bottom:1px solid #edf2f7; color:#1a202c; font-size:12px; font-weight:600; text-align:right;">${fmtDate(record.dueDate)}</td>
        </tr>
        <tr>
          <td style="padding:10px 16px; color:#718096; font-size:12px;">Remaining This Mth</td>
          <td style="padding:10px 16px; font-size:12px; font-weight:700; text-align:right; color:${accentColor};">${fmtINR(remaining)}</td>
        </tr>
      </table>
    </div>
    
    ${arrearsHtml}
    ${buildTenantDetailsSection(tenant, accentColor)}
    ${buildRoomAllocationSection(buildingDetails)}
    
    <div class="note-box">💡 <strong>Note:</strong> If you have already made this payment, please disregard this reminder.</div>`;

  const subject = hasPreviousPending ? `🚨 Urgent: Rent Arrears — ${fmtINR(totalAccumulatedDue)} Outstanding` : isOverdue ? `⚠️ Rent Overdue — ${month}` : `🔔 Rent Reminder: Due ${daysUntilDue === 0 ? "Today" : `in ${daysUntilDue} Days`} — ${month}`;
  const icon  = hasPreviousPending ? "🚨" : isOverdue ? "⚠️" : "🔔";
  const title = hasPreviousPending ? "Urgent: Rent Arrears Notice" : isOverdue ? "Rent Payment Overdue" : "Rent Payment Reminder";

  return { subject, html: emailWrapper({ accentColor, icon, title, badgeLabel, bodyHtml }) };
}

// ── Execute Specific Target Type ──
async function runEmailJobForOwner(ownerId, targetType, force = false) {
  const config = await AutoMailConfig.findOne({ owner: ownerId });
  if (!config) return;

  if (!force && !config.isEnabled) return;

  if (targetType === "arrears" && !config.sendArrears) return;
  if (targetType === "overdue" && !config.sendOverdue) return;
  if (targetType === "upcoming" && !config.sendUpcoming) return;

  const tenants = await Tenant.find({ owner: ownerId, status: "Active" }).lean();
  console.log(`[AutoMail] Running job for owner ${ownerId} | Type: ${targetType.toUpperCase()}`);

  let emailsSent = 0;

  for (const tenant of tenants) {
    try {
      if (!tenant.email) continue;

      const summary = await buildTenantSummary(tenant, ownerId, FIVE_DAYS_MS);
      if (!summary || summary.totalAccumulatedDue <= 0) continue;

      const isDueToday = isSameDay(new Date(summary.currentRecord.dueDate), new Date());
      if (isDueToday) {
        summary.isOverdue = false;
        summary.daysOverdue = null;
        summary.daysUntilDue = 0;
      }

      let dueType = null;
      if (summary.hasPreviousPending) {
        dueType = "arrears";
      } else if (summary.isOverdue) {
        dueType = "overdue";
      } else if (summary.daysUntilDue !== null && summary.daysUntilDue <= 5) {
        dueType = "upcoming";
      }

      if (dueType !== targetType) continue;

      const buildingDetails = await getBuildingDetailsForTenant(tenant);
      const { subject, html } = buildReminderEmail({ tenant, record: summary.currentRecord, buildingDetails, ...summary });

      await sendBrevoEmail(tenant.email, tenant.name, subject, html);

      await Tenant.findByIdAndUpdate(
        tenant._id, 
        { $set: { lastMailSent: new Date() } }, 
        { returnDocument: 'after', strict: false }
      );

      emailsSent++;
      console.log(`[AutoMail]   ✓ Sent ${targetType} email to ${tenant.name}`);

      await sleep(2000); 

    } catch (err) {
      console.error(`[AutoMail]   ✗ Failed for ${tenant.name}:`, err.message);
    }
  }

  // Update specific last run audit
  if (targetType === "arrears") await AutoMailConfig.findByIdAndUpdate(config._id, { lastRunArrears: new Date() });
  if (targetType === "overdue") await AutoMailConfig.findByIdAndUpdate(config._id, { lastRunOverdue: new Date() });
  if (targetType === "upcoming") await AutoMailConfig.findByIdAndUpdate(config._id, { lastRunUpcoming: new Date() });

  console.log(`[AutoMail] ${targetType.toUpperCase()} Job done — ${emailsSent} sent.`);
}

// ── Cron Job Registry (With IST Timezone Fix) ──
const cronJobs = new Map();

function scheduleJobForOwner(ownerId, type, timeStr) {
  const jobKey = `${ownerId}_${type}`;
  if (cronJobs.has(jobKey)) {
    cronJobs.get(jobKey).stop();
    cronJobs.delete(jobKey);
  }

  const [hours, minutes] = (timeStr || "09:00").split(":").map(Number);
  if (isNaN(hours) || isNaN(minutes)) return;

  const cronExpr = `${minutes} ${hours} * * *`;
  
  // FIX: Force node-cron to use IST timezone so it executes perfectly in Production
  const task = cron.schedule(cronExpr, async () => {
    console.log(`[AutoMail] Cron fired for ${jobKey} at ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} (IST)`);
    await runEmailJobForOwner(ownerId, type, false);
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata"
  });

  cronJobs.set(jobKey, task);
  console.log(`[AutoMail] Scheduled ${jobKey} at ${timeStr} (IST)`);
}

export async function initAllCronJobs() {
  try {
    const allConfigs = await AutoMailConfig.find({ isEnabled: true });
    for (const config of allConfigs) {
      const oid = config.owner.toString();
      if (config.sendArrears && config.timeArrears) scheduleJobForOwner(oid, "arrears", config.timeArrears);
      if (config.sendOverdue && config.timeOverdue) scheduleJobForOwner(oid, "overdue", config.timeOverdue);
      if (config.sendUpcoming && config.timeUpcoming) scheduleJobForOwner(oid, "upcoming", config.timeUpcoming);
    }
  } catch (err) {
    console.error("[AutoMail] Init failed:", err.message);
  }
}

// ── Routes ──
router.get("/config", auth, async (req, res) => {
  try {
    let config = await AutoMailConfig.findOne({ owner: req.user.id });
    if (!config) config = await AutoMailConfig.create({ owner: req.user.id });
    res.json(config);
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

router.post("/config", auth, async (req, res) => {
  try {
    const { sendArrears, sendOverdue, sendUpcoming, timeArrears, timeOverdue, timeUpcoming, isEnabled } = req.body;

    if (isEnabled) {
      const activeTimes = [];
      if (sendArrears) {
        if (!timeArrears) return res.status(400).json({ message: "Time allocation is mandatory for Arrears." });
        activeTimes.push({ label: "Arrears", time: timeArrears });
      }
      if (sendOverdue) {
        if (!timeOverdue) return res.status(400).json({ message: "Time allocation is mandatory for Overdue." });
        activeTimes.push({ label: "Overdue", time: timeOverdue });
      }
      if (sendUpcoming) {
        if (!timeUpcoming) return res.status(400).json({ message: "Time allocation is mandatory for Upcoming." });
        activeTimes.push({ label: "Upcoming", time: timeUpcoming });
      }

      for (let i = 0; i < activeTimes.length; i++) {
        for (let j = i + 1; j < activeTimes.length; j++) {
          const m1 = getMins(activeTimes[i].time);
          const m2 = getMins(activeTimes[j].time);
          let diff = Math.abs(m1 - m2);
          if (diff > 12 * 60) diff = 24 * 60 - diff; 
          
          if (diff < 30) {
            return res.status(400).json({ 
              message: `Security Warning: Keep at least a 30-minute gap between ${activeTimes[i].label} and ${activeTimes[j].label} to prevent spam-blocking.` 
            });
          }
        }
      }
    }

    const config = await AutoMailConfig.findOneAndUpdate(
      { owner: req.user.id },
      {
        $set: { sendArrears, sendOverdue, sendUpcoming, timeArrears, timeOverdue, timeUpcoming, isEnabled },
      },
      { returnDocument: 'after', upsert: true, runValidators: true }
    );

    ["arrears", "overdue", "upcoming"].forEach(type => {
      const jobKey = `${req.user.id}_${type}`;
      if (cronJobs.has(jobKey)) {
        cronJobs.get(jobKey).stop();
        cronJobs.delete(jobKey);
      }
    });

    if (config.isEnabled) {
      if (config.sendArrears) scheduleJobForOwner(req.user.id, "arrears", config.timeArrears);
      if (config.sendOverdue) scheduleJobForOwner(req.user.id, "overdue", config.timeOverdue);
      if (config.sendUpcoming) scheduleJobForOwner(req.user.id, "upcoming", config.timeUpcoming);
    }

    res.json({ message: "Configuration saved successfully.", config });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

router.post("/run-now", auth, async (req, res) => {
  try {
    const config = await AutoMailConfig.findOne({ owner: req.user.id });
    if (!config) return res.status(404).json({ message: "Config not found." });

    const runPromises = [];
    if (config.sendArrears) runPromises.push(runEmailJobForOwner(req.user.id, "arrears", true));
    if (config.sendOverdue) runPromises.push(runEmailJobForOwner(req.user.id, "overdue", true));
    if (config.sendUpcoming) runPromises.push(runEmailJobForOwner(req.user.id, "upcoming", true));

    Promise.all(runPromises).catch(err => console.error("[AutoMail] manual run error:", err.message));

    res.json({ message: "Background email tasks triggered." });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

export default router;