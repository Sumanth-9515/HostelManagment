import "dotenv/config";
import express from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { v2 as cloudinary } from "cloudinary";

import Tenant from "../models/Tenant.js";
import RentPayment from "../models/Rentpayment.js";
import PaymentRequest from "../models/PaymentRequest.js";
import User from "../models/User.js";
import {
  buildTenantSummary,
  getBuildingDetailsForTenant,
  recordTenantPayment,
  sendSimpleBrevoEmail,
} from "./rentroutes.js";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const shortTokenStore = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of shortTokenStore.entries()) {
    if (value.expiresAt < now) shortTokenStore.delete(key);
  }
}, 60 * 60 * 1000);

const CLD_CLOUD = (process.env.CLOUDINARY_CLOUD_NAME || "").trim();
const CLD_KEY = (process.env.CLOUDINARY_API_KEY || "").trim();
const CLD_SEC = (process.env.CLOUDINARY_API_SECRET || "").trim();
const CLOUDINARY_READY = !!(CLD_CLOUD && CLD_KEY && CLD_SEC);

if (CLOUDINARY_READY) {
  cloudinary.config({ cloud_name: CLD_CLOUD, api_key: CLD_KEY, api_secret: CLD_SEC });
}

const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "payment-receipts");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    cb(null, `receipt-${Date.now()}-${crypto.randomBytes(2).toString("hex")}${ext}`);
  },
});

const upload = multer({
  storage: CLOUDINARY_READY ? multer.memoryStorage() : diskStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /^image\/(jpeg|jpg|png|webp)|application\/pdf$/.test(file.mimetype);
    ok ? cb(null, true) : cb(new Error("Only JPG, PNG, WEBP or PDF files are allowed"));
  },
});

const uploadToCloudinary = (buffer) =>
  new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder: "payment_receipts", resource_type: "auto" }, (err, result) =>
        err ? reject(err) : resolve(result.secure_url)
      )
      .end(buffer);
  });

async function resolveReceiptUrl(file) {
  if (!file) return null;
  if (CLOUDINARY_READY) return uploadToCloudinary(file.buffer);
  const backendBase = (process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/$/, "");
  return `${backendBase}/uploads/payment-receipts/${file.filename}`;
}

let legacyPendingUniqueIndexDropped = false;
async function dropLegacyPendingUniqueIndex() {
  if (legacyPendingUniqueIndexDropped) return;
  legacyPendingUniqueIndexDropped = true;
  try {
    await PaymentRequest.collection.dropIndex("owner_1_tenantId_1_monthYear_1_status_1");
  } catch (err) {
    if (err.codeName !== "IndexNotFound" && err.code !== 27) {
      console.warn("[PaymentRequests] Could not drop legacy unique index:", err.message);
    }
  }
}

function decodeOwnerToken(raw) {
  if (!raw) {
    const err = new Error("Owner token is required.");
    err.statusCode = 401;
    throw err;
  }

  let decoded;
  if (raw.length <= 12) {
    const entry = shortTokenStore.get(raw);
    if (!entry || entry.expiresAt < Date.now()) {
      const err = new Error("Link is invalid or has expired.");
      err.statusCode = 401;
      throw err;
    }
    decoded = jwt.verify(entry.jwtToken, process.env.JWT_SECRET);
  } else {
    decoded = jwt.verify(raw, process.env.JWT_SECRET);
  }

  if (decoded.purpose !== "payment-request") {
    const err = new Error("Invalid link purpose.");
    err.statusCode = 403;
    throw err;
  }
  return decoded.id;
}

function publicTenantProjection() {
  return {
    name: 1, phone: 1, email: 1, fatherName: 1, fatherPhone: 1,
    permanentAddress: 1, joiningDate: 1, rentAmount: 1,
    advanceAmount: 1, paidAdvanceAmount: 1,
    buildingId: 1, floorId: 1, roomId: 1, bedId: 1,
    allocationInfo: 1, documents: 1, status: 1,
  };
}

function monthLabel(record) {
  return new Date(record.dueDate).toLocaleString("en-IN", { month: "long", year: "numeric" });
}

const fmtINR = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(n || 0));
const fmtDateTime = (d) => d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const ADVANCE_REFUND_RULE = "If you paid an advance, please inform us 10 days before leaving. Your advance will be refunded if you inform us 10 days before. Without 10 days' notice, the advance may not be refunded.";

function advanceRefundRuleHtml(color = "#92400e") {
  return `<div style="margin:0 0 8px;"><strong style="color:${color};">1. Advance Refund Rule:</strong> ${escapeHtml(ADVANCE_REFUND_RULE)}</div>`;
}

function tokenHash(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createEmailActionTokens() {
  const approveToken = crypto.randomBytes(32).toString("base64url");
  const rejectToken = crypto.randomBytes(32).toString("base64url");
  return {
    approveToken,
    rejectToken,
    emailActions: {
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      approve: { tokenHash: tokenHash(approveToken), usedAt: null },
      reject: { tokenHash: tokenHash(rejectToken), usedAt: null },
    },
  };
}

function ownerActionLink(token) {
  const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
  return `${frontendUrl}/payment-request-action/${token}`;
}

function buildOwnerPaymentRequestEmail({ owner, tenant, request, approveToken, rejectToken }) {
  const month = monthLabel(request);
  const senderName = process.env.BREVO_SENDER_NAME || "Nilayam Hostel Manager";
  const location = tenant.allocationInfo?.buildingName
    ? `${tenant.allocationInfo.buildingName}, Floor ${tenant.allocationInfo.floorNumber || "-"}, Room ${tenant.allocationInfo.roomNumber || "-"}`
    : "Not assigned";
  const receiptHtml = request.receiptUrl
    ? `<a href="${escapeHtml(request.receiptUrl)}" target="_blank" style="display:inline-block;margin-top:14px;background:#ffffff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:10px;padding:10px 16px;font-size:13px;font-weight:800;text-decoration:none;">View Receipt</a>`
    : "";
  const cashHtml = request.paymentMode === "Cash"
    ? `<tr><td style="padding:9px 0;color:#64748b;font-size:13px;border-bottom:1px solid #e2e8f0;">Cash Handover</td><td style="padding:9px 0;color:#111827;font-size:13px;font-weight:800;text-align:right;border-bottom:1px solid #e2e8f0;">${escapeHtml(fmtDateTime(request.cashHandoverAt))}</td></tr>`
    : "";

  return {
    subject: `New Payment Request - ${tenant.name} - ${month}`,
    htmlContent: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;">
  <table width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:28px 12px;">
    <tr><td align="center">
      <table width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 12px 36px rgba(15,23,42,0.12);">
        <tr>
          <td style="background:linear-gradient(135deg,#1d4ed8,#4f46e5);padding:34px 28px;text-align:center;">
            <div style="font-size:42px;line-height:1;margin-bottom:10px;">&#8377;</div>
            <div style="font-size:24px;font-weight:900;color:#ffffff;letter-spacing:-0.3px;">New Payment Request</div>
            <div style="margin-top:6px;font-size:13px;color:rgba(255,255,255,0.82);">${escapeHtml(senderName)}</div>
            <div style="display:inline-block;margin-top:16px;border:1px solid rgba(255,255,255,0.45);background:rgba(255,255,255,0.16);border-radius:999px;padding:6px 16px;color:#ffffff;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.6px;">Owner Review Required</div>
          </td>
        </tr>
        <tr>
          <td style="padding:30px 30px 26px;">
            <p style="margin:0 0 8px;font-size:18px;font-weight:800;color:#111827;">Hi ${escapeHtml(owner.name || owner.owner || "Owner")},</p>
            <p style="margin:0;color:#475569;font-size:14px;line-height:1.8;">
              ${escapeHtml(tenant.name)} submitted a payment request for <strong style="color:#111827;">${escapeHtml(month)}</strong>.
            </p>

            <div style="margin-top:24px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:18px;">
              <div style="font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:1px;color:#4f46e5;margin-bottom:12px;">Candidate Details</div>
              <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                <tr><td style="padding:9px 0;color:#64748b;font-size:13px;border-bottom:1px solid #e2e8f0;">Name</td><td style="padding:9px 0;color:#111827;font-size:13px;font-weight:800;text-align:right;border-bottom:1px solid #e2e8f0;">${escapeHtml(tenant.name)}</td></tr>
                <tr><td style="padding:9px 0;color:#64748b;font-size:13px;border-bottom:1px solid #e2e8f0;">Phone</td><td style="padding:9px 0;color:#111827;font-size:13px;font-weight:800;text-align:right;border-bottom:1px solid #e2e8f0;">${escapeHtml(tenant.phone || "-")}</td></tr>
                <tr><td style="padding:9px 0;color:#64748b;font-size:13px;border-bottom:1px solid #e2e8f0;">Email</td><td style="padding:9px 0;color:#111827;font-size:13px;font-weight:800;text-align:right;border-bottom:1px solid #e2e8f0;">${escapeHtml(tenant.email || "-")}</td></tr>
                <tr><td style="padding:9px 0;color:#64748b;font-size:13px;">Location</td><td style="padding:9px 0;color:#111827;font-size:13px;font-weight:800;text-align:right;">${escapeHtml(location)}</td></tr>
              </table>
            </div>

            <div style="margin-top:18px;background:#eef2ff;border:1px solid #c7d2fe;border-radius:16px;padding:18px;">
              <div style="font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:1px;color:#3730a3;margin-bottom:12px;">Requested Payment</div>
              <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                <tr><td style="padding:9px 0;color:#64748b;font-size:13px;border-bottom:1px solid #dbeafe;">Billing Month</td><td style="padding:9px 0;color:#111827;font-size:13px;font-weight:800;text-align:right;border-bottom:1px solid #dbeafe;">${escapeHtml(month)}</td></tr>
                <tr><td style="padding:9px 0;color:#64748b;font-size:13px;border-bottom:1px solid #dbeafe;">Requested Amount</td><td style="padding:9px 0;color:#1d4ed8;font-size:15px;font-weight:900;text-align:right;border-bottom:1px solid #dbeafe;">${fmtINR(request.requestedAmount)}</td></tr>
                <tr><td style="padding:9px 0;color:#64748b;font-size:13px;border-bottom:1px solid #dbeafe;">Payment Mode</td><td style="padding:9px 0;color:#111827;font-size:13px;font-weight:800;text-align:right;border-bottom:1px solid #dbeafe;">${escapeHtml(request.paymentMode)}</td></tr>
                ${cashHtml}
                <tr><td style="padding:9px 0;color:#64748b;font-size:13px;">Submitted</td><td style="padding:9px 0;color:#111827;font-size:13px;font-weight:800;text-align:right;">${escapeHtml(fmtDateTime(request.submittedAt))}</td></tr>
              </table>
              ${receiptHtml}
            </div>

            <div style="margin-top:26px;text-align:center;">
              <a href="${escapeHtml(ownerActionLink(approveToken))}" target="_blank" style="display:inline-block;background:#059669;color:#ffffff;border-radius:12px;padding:13px 24px;font-size:14px;font-weight:900;text-decoration:none;margin:4px 6px;">Approve Payment</a>
              <a href="${escapeHtml(ownerActionLink(rejectToken))}" target="_blank" style="display:inline-block;background:#dc2626;color:#ffffff;border-radius:12px;padding:13px 24px;font-size:14px;font-weight:900;text-decoration:none;margin:4px 6px;">Reject Payment</a>
            </div>

            <div style="margin-top:22px;background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:12px 14px;color:#92400e;font-size:12px;line-height:1.7;">
              ${advanceRefundRuleHtml("#92400e")}
              <div><strong>2.</strong> These buttons open a secure confirmation page and use one-time action tokens. Links expire in 3 days.</div>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 28px;text-align:center;">
            <div style="font-size:14px;font-weight:900;color:#4f46e5;">${escapeHtml(senderName)}</div>
            <div style="margin-top:6px;font-size:12px;color:#94a3b8;line-height:1.6;">This is an automated owner notification.</div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  };
}

async function sendOwnerPaymentRequestEmail({ ownerId, tenant, request, approveToken, rejectToken }) {
  const owner = await User.findById(ownerId).select("name owner email").lean();
  if (!owner?.email) return;
  const email = buildOwnerPaymentRequestEmail({ owner, tenant, request, approveToken, rejectToken });
  await sendSimpleBrevoEmail(owner.email, owner.name || owner.owner || "Owner", email.subject, email.htmlContent);
}

function buildRejectedEmail({ tenant, request }) {
  const month = new Date(request.dueDate).toLocaleString("en-IN", { month: "long", year: "numeric" });
  const senderName = process.env.BREVO_SENDER_NAME || "Nilayam Hostel Manager";
  const reason = (request.rejectReason || "").trim();
  const reasonHtml = reason
    ? `
      <div style="margin:24px 0 0;">
        <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#991b1b;margin-bottom:8px;">Rejection Reason</div>
        <div style="background:#fff7ed;border:1px solid #fed7aa;border-left:4px solid #f97316;border-radius:12px;padding:14px 16px;color:#7c2d12;font-size:14px;line-height:1.7;">
          ${escapeHtml(reason)}
        </div>
      </div>`
    : `
      <div style="margin:24px 0 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;color:#475569;font-size:14px;line-height:1.7;">
        ${advanceRefundRuleHtml("#475569")}
        <div><strong>2.</strong> Please contact the owner for more details about this rejection.</div>
      </div>`;

  return {
    subject: `Payment Request Rejected - ${month}`,
    htmlContent: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Payment Request Rejected</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;">
  <table width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:28px 12px;">
    <tr>
      <td align="center">
        <table width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 12px 36px rgba(15,23,42,0.12);">
          <tr>
            <td style="background:linear-gradient(135deg,#991b1b,#ef4444);padding:34px 28px;text-align:center;">
              <div style="font-size:42px;line-height:1;margin-bottom:10px;">&#10060;</div>
              <div style="font-size:24px;font-weight:900;color:#ffffff;letter-spacing:-0.3px;">Payment Request Rejected</div>
              <div style="margin-top:6px;font-size:13px;color:rgba(255,255,255,0.82);">${escapeHtml(senderName)}</div>
              <div style="display:inline-block;margin-top:16px;border:1px solid rgba(255,255,255,0.45);background:rgba(255,255,255,0.16);border-radius:999px;padding:6px 16px;color:#ffffff;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.6px;">Action Needed</div>
            </td>
          </tr>
          <tr>
            <td style="padding:30px 30px 26px;">
              <p style="margin:0 0 8px;font-size:18px;font-weight:800;color:#111827;">Hi ${escapeHtml(tenant.name)},</p>
              <p style="margin:0;color:#475569;font-size:14px;line-height:1.8;">
                Your payment request for <strong style="color:#111827;">${escapeHtml(month)}</strong> has been rejected by the owner.
              </p>

              <div style="margin-top:24px;background:#fef2f2;border:1px solid #fecaca;border-radius:16px;padding:18px;">
                <div style="font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:1px;color:#991b1b;margin-bottom:12px;">Request Summary</div>
                <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                  <tr>
                    <td style="padding:9px 0;color:#64748b;font-size:13px;border-bottom:1px solid #fee2e2;">Tenant</td>
                    <td style="padding:9px 0;color:#111827;font-size:13px;font-weight:800;text-align:right;border-bottom:1px solid #fee2e2;">${escapeHtml(tenant.name)}</td>
                  </tr>
                  <tr>
                    <td style="padding:9px 0;color:#64748b;font-size:13px;border-bottom:1px solid #fee2e2;">Billing Month</td>
                    <td style="padding:9px 0;color:#111827;font-size:13px;font-weight:800;text-align:right;border-bottom:1px solid #fee2e2;">${escapeHtml(month)}</td>
                  </tr>
                  <tr>
                    <td style="padding:9px 0;color:#64748b;font-size:13px;border-bottom:1px solid #fee2e2;">Requested Amount</td>
                    <td style="padding:9px 0;color:#b91c1c;font-size:13px;font-weight:900;text-align:right;border-bottom:1px solid #fee2e2;">${fmtINR(request.requestedAmount)}</td>
                  </tr>
                  <tr>
                    <td style="padding:9px 0;color:#64748b;font-size:13px;border-bottom:1px solid #fee2e2;">Payment Mode</td>
                    <td style="padding:9px 0;color:#111827;font-size:13px;font-weight:800;text-align:right;border-bottom:1px solid #fee2e2;">${escapeHtml(request.paymentMode)}</td>
                  </tr>
                  <tr>
                    <td style="padding:9px 0;color:#64748b;font-size:13px;">Rejected On</td>
                    <td style="padding:9px 0;color:#111827;font-size:13px;font-weight:800;text-align:right;">${escapeHtml(fmtDateTime(request.rejectedAt || new Date()))}</td>
                  </tr>
                </table>
              </div>

              ${reasonHtml}

              <div style="margin-top:24px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:14px 16px;color:#1e3a8a;font-size:13px;line-height:1.7;">
                ${advanceRefundRuleHtml("#1e3a8a")}
                <div><strong>2.</strong> You can submit a corrected payment request from the payment request form, or contact the owner if you need clarification.</div>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 28px;text-align:center;">
              <div style="font-size:14px;font-weight:900;color:#991b1b;">${escapeHtml(senderName)}</div>
              <div style="margin-top:6px;font-size:12px;color:#94a3b8;line-height:1.6;">This is an automated message. Please do not reply to this email.</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  };
}

function buildRequestResponse(request) {
  const base = request.toObject ? request.toObject() : request;
  const tenant = base.tenantId;
  const building = tenant?.allocationInfo || {};
  return {
    ...base,
    tenant: tenant && {
      _id: tenant._id,
      name: tenant.name,
      email: tenant.email,
      phone: tenant.phone,
      rentAmount: tenant.rentAmount,
      allocationInfo: tenant.allocationInfo,
      documents: tenant.documents,
      room: building.roomNumber,
      building: building.buildingName,
      floor: building.floorNumber,
    },
  };
}

router.get("/generate-link", auth, (req, res) => {
  const jwtToken = jwt.sign(
    { id: req.user.id, purpose: "payment-request" },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
  const shortCode = crypto.randomBytes(5).toString("base64url").slice(0, 8);
  shortTokenStore.set(shortCode, { jwtToken, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 });

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  res.json({ link: `${frontendUrl}/payment-request-form/${shortCode}`, expiresIn: "7 days" });
});

router.get("/public/:ownerToken/search", async (req, res) => {
  try {
    const ownerId = decodeOwnerToken(req.params.ownerToken);
    const q = (req.query.q || "").trim();
    if (q.length < 2) return res.json([]);

    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const tenants = await Tenant.find({
      owner: ownerId,
      status: "Active",
      $or: [
        { name: { $regex: escaped, $options: "i" } },
        { email: { $regex: escaped, $options: "i" } },
        { phone: { $regex: escaped, $options: "i" } },
      ],
    })
      .select("name phone email allocationInfo rentAmount documents")
      .limit(12)
      .lean();

    res.json(tenants);
  } catch (err) {
    res.status(err.statusCode || 401).json({ message: err.message || "Invalid link." });
  }
});

router.get("/public/:ownerToken/tenant/:tenantId", async (req, res) => {
  try {
    const ownerId = decodeOwnerToken(req.params.ownerToken);
    const tenant = await Tenant.findOne({
      _id: req.params.tenantId,
      owner: ownerId,
      status: "Active",
    }, publicTenantProjection()).lean();

    if (!tenant) return res.status(404).json({ message: "Tenant not found." });

    const summary = await buildTenantSummary(tenant, ownerId, 5 * 24 * 60 * 60 * 1000);
    const pendingMonths = [
      ...(summary.pendingMonths || []),
      ...(summary.currentRecord && summary.remaining > 0 ? [summary.currentRecord] : []),
    ].filter((record) => record.status !== "Paid" && record.monthYear);

    const history = await RentPayment.find({ owner: ownerId, tenantId: tenant._id })
      .sort({ monthYear: -1 })
      .lean();
    const pendingRequests = await PaymentRequest.find({
      owner: ownerId,
      tenantId: tenant._id,
      status: "Pending",
    })
      .select("monthYear requestedAmount paymentMode submittedAt cashHandoverAt receiptUrl status")
      .lean();

    const buildingDetails = await getBuildingDetailsForTenant(tenant);
    res.json({ tenant, buildingDetails, pendingMonths, summary, history, pendingRequests });
  } catch (err) {
    res.status(err.statusCode || 401).json({ message: err.message || "Invalid link." });
  }
});

router.post("/public/:ownerToken", upload.single("receipt"), async (req, res) => {
  try {
    await dropLegacyPendingUniqueIndex();
    const ownerId = decodeOwnerToken(req.params.ownerToken);
    const { tenantId, monthYear, paymentMode, requestedAmount, cashHandoverAt } = req.body;
    if (!tenantId || !monthYear || !paymentMode) {
      return res.status(400).json({ message: "Tenant, month, and payment mode are required." });
    }
    if (!["Online", "Cash"].includes(paymentMode)) {
      return res.status(400).json({ message: "Payment mode must be Online or Cash." });
    }
    if (paymentMode === "Online" && !req.file) {
      return res.status(400).json({ message: "Receipt upload is required for online payment." });
    }
    if (paymentMode === "Cash" && !cashHandoverAt) {
      return res.status(400).json({ message: "Cash handover date and time are required." });
    }

    const tenant = await Tenant.findOne({ _id: tenantId, owner: ownerId, status: "Active" });
    if (!tenant) return res.status(404).json({ message: "Tenant not found." });

    const summary = await buildTenantSummary(tenant.toObject(), ownerId, 5 * 24 * 60 * 60 * 1000);
    const allPending = [
      ...(summary.pendingMonths || []),
      ...(summary.currentRecord && summary.remaining > 0 ? [summary.currentRecord] : []),
    ];
    const selected = allPending.find((record) => record.monthYear === monthYear);
    if (!selected || selected.status === "Paid") {
      return res.status(400).json({ message: "Selected month is not pending." });
    }

    const remainingAmount = Math.max(Number(selected.rentAmount || 0) - Number(selected.paidAmount || 0), 0);
    const amountToRequest = Number(requestedAmount || remainingAmount);
    if (remainingAmount <= 0) return res.status(400).json({ message: "Selected month is already paid." });
    if (!Number.isFinite(amountToRequest) || amountToRequest <= 0) {
      return res.status(400).json({ message: "Request amount must be greater than 0." });
    }
    if (amountToRequest > remainingAmount) {
      return res.status(400).json({ message: "Request amount cannot exceed the remaining due amount." });
    }

    const parsedCashHandoverAt = paymentMode === "Cash" ? new Date(cashHandoverAt) : null;
    if (paymentMode === "Cash" && Number.isNaN(parsedCashHandoverAt.getTime())) {
      return res.status(400).json({ message: "Cash handover date and time are invalid." });
    }

    const receiptUrl = await resolveReceiptUrl(req.file);
    const { approveToken, rejectToken, emailActions } = createEmailActionTokens();
    const request = await PaymentRequest.create({
      owner: ownerId,
      tenantId: tenant._id,
      rentPaymentId: selected._id,
      monthYear,
      dueDate: selected.dueDate,
      rentAmount: selected.rentAmount,
      paidAmountAtRequest: selected.paidAmount || 0,
      requestedAmount: amountToRequest,
      paymentMode,
      receiptUrl,
      cashHandoverAt: parsedCashHandoverAt,
      status: "Pending",
      submittedAt: new Date(),
      emailActions,
    });

    sendOwnerPaymentRequestEmail({ ownerId, tenant: tenant.toObject(), request, approveToken, rejectToken })
      .catch((err) => console.error("Owner payment request email failed:", err.message));

    res.status(201).json({ message: "Payment request submitted successfully.", request });
  } catch (err) {
    const duplicatePending = err.code === 11000;
    res.status(duplicatePending ? 409 : err.statusCode || 500).json({
      message: duplicatePending ? "A pending request already exists for this tenant and month." : err.message || "Server error.",
    });
  }
});

router.get("/", auth, async (req, res) => {
  try {
    const requests = await PaymentRequest.find({ owner: req.user.id })
      .populate("tenantId", "name phone email allocationInfo rentAmount documents")
      .sort({ submittedAt: -1 })
      .lean();
    res.json(requests.map(buildRequestResponse));
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

async function findEmailActionRequest(rawToken) {
  if (!rawToken) {
    const err = new Error("Action token is required.");
    err.statusCode = 400;
    throw err;
  }

  const hash = tokenHash(rawToken);
  const request = await PaymentRequest.findOne({
    $or: [
      { "emailActions.approve.tokenHash": hash },
      { "emailActions.reject.tokenHash": hash },
    ],
  }).populate("tenantId", "name phone email allocationInfo rentAmount documents");

  if (!request) {
    const err = new Error("Action link is invalid.");
    err.statusCode = 404;
    throw err;
  }

  const action = request.emailActions?.approve?.tokenHash === hash ? "approve" : "reject";
  const usedAt = request.emailActions?.[action]?.usedAt;
  const expiresAt = request.emailActions?.expiresAt;

  if (usedAt) {
    const err = new Error("This action link has already been used.");
    err.statusCode = 410;
    throw err;
  }
  if (!expiresAt || new Date(expiresAt).getTime() < Date.now()) {
    const err = new Error("This action link has expired.");
    err.statusCode = 410;
    throw err;
  }
  if (request.status !== "Pending") {
    const err = new Error(`This payment request is already ${request.status.toLowerCase()}.`);
    err.statusCode = 409;
    throw err;
  }

  return { request, action };
}

function emailActionResponse(request, action) {
  const tenant = request.tenantId;
  const building = tenant?.allocationInfo || {};
  return {
    action,
    request: {
      _id: request._id,
      monthYear: request.monthYear,
      dueDate: request.dueDate,
      rentAmount: request.rentAmount,
      requestedAmount: request.requestedAmount,
      paymentMode: request.paymentMode,
      receiptUrl: request.receiptUrl,
      cashHandoverAt: request.cashHandoverAt,
      submittedAt: request.submittedAt,
      status: request.status,
    },
    tenant: tenant && {
      _id: tenant._id,
      name: tenant.name,
      email: tenant.email,
      phone: tenant.phone,
      building: building.buildingName,
      floor: building.floorNumber,
      room: building.roomNumber,
    },
  };
}

router.get("/email-action/:token", async (req, res) => {
  try {
    const { request, action } = await findEmailActionRequest(req.params.token);
    res.json(emailActionResponse(request, action));
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message || "Server error." });
  }
});

router.post("/email-action/:token", async (req, res) => {
  try {
    const { request, action } = await findEmailActionRequest(req.params.token);

    if (action === "approve") {
      const result = await recordTenantPayment({
        ownerId: request.owner,
        tenantId: request.tenantId._id || request.tenantId,
        amount: request.requestedAmount,
        monthYear: request.monthYear,
        paymentType: "rent",
        note: `Approved from owner email (${request.paymentMode})`,
        sendEmail: true,
      });

      request.status = "Approved";
      request.approvedAt = new Date();
      request.approvedBy = request.owner;
      request.emailActions.approve.usedAt = new Date();
      request.emailActions.reject.usedAt = request.emailActions.reject.usedAt || new Date();
      await request.save();

      return res.json({ message: "Payment request approved.", request, payment: result });
    }

    request.status = "Rejected";
    request.rejectedAt = new Date();
    request.rejectedBy = request.owner;
    request.rejectReason = (req.body?.reason || "").trim();
    request.emailActions.reject.usedAt = new Date();
    request.emailActions.approve.usedAt = request.emailActions.approve.usedAt || new Date();
    await request.save();

    const tenant = await Tenant.findOne({ _id: request.tenantId._id || request.tenantId, owner: request.owner }).lean();
    if (tenant?.email) {
      try {
        const email = buildRejectedEmail({ tenant, request });
        await sendSimpleBrevoEmail(tenant.email, tenant.name, email.subject, email.htmlContent);
      } catch (e) {
        console.error("Payment rejection email failed:", e.message);
      }
    }

    res.json({ message: "Payment request rejected.", request });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message || "Server error." });
  }
});

router.patch("/:id/approve", auth, async (req, res) => {
  try {
    const request = await PaymentRequest.findOne({ _id: req.params.id, owner: req.user.id });
    if (!request) return res.status(404).json({ message: "Payment request not found." });
    if (request.status !== "Pending") return res.status(400).json({ message: "Only pending requests can be approved." });

    const result = await recordTenantPayment({
      ownerId: req.user.id,
      tenantId: request.tenantId,
      amount: request.requestedAmount,
      monthYear: request.monthYear,
      paymentType: "rent",
      note: `Approved tenant payment request (${request.paymentMode})`,
      sendEmail: true,
    });

    request.status = "Approved";
    request.approvedAt = new Date();
    request.approvedBy = req.user.id;
    await request.save();

    res.json({ message: "Payment request approved.", request, payment: result });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message || "Server error." });
  }
});

router.patch("/:id/reject", auth, async (req, res) => {
  try {
    const request = await PaymentRequest.findOne({ _id: req.params.id, owner: req.user.id });
    if (!request) return res.status(404).json({ message: "Payment request not found." });
    if (request.status !== "Pending") return res.status(400).json({ message: "Only pending requests can be rejected." });

    request.status = "Rejected";
    request.rejectedAt = new Date();
    request.rejectedBy = req.user.id;
    request.rejectReason = (req.body?.reason || "").trim();
    await request.save();

    const tenant = await Tenant.findOne({ _id: request.tenantId, owner: req.user.id }).lean();
    if (tenant?.email) {
      try {
        const email = buildRejectedEmail({ tenant, request });
        await sendSimpleBrevoEmail(tenant.email, tenant.name, email.subject, email.htmlContent);
      } catch (e) {
        console.error("Payment rejection email failed:", e.message);
      }
    }

    res.json({ message: "Payment request rejected.", request });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

export default router;
