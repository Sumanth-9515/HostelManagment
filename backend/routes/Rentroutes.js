/**
 * rentRoutes.js
 *
 * Mount in app.js:
 *   import rentRoutes from "./routes/rentRoutes.js";
 *   app.use("/api/rent", rentRoutes);
 */

import express from "express";
import jwt from "jsonwebtoken";
import Tenant from "../models/Tenant.js";
import Building from "../models/Building.js";
import RentPayment from "../models/RentPayment.js";

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

/**
 * Given a tenant's joiningDate, return the canonical due-date for
 * the billing cycle that contains `referenceDate`.
 *
 * Rule: due day == joiningDate day-of-month.
 * If that day has already passed this month, the *current* cycle's due date
 * was earlier this month (overdue). If it hasn't arrived yet it's upcoming.
 */
function getDueDateForCycle(joiningDate, referenceDate = new Date()) {
  const joinDay = new Date(joiningDate).getDate();
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();

  // Clamp to last day of month (e.g. joinDay=31 in Feb → 28/29)
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  const day = Math.min(joinDay, lastDayOfMonth);

  return new Date(year, month, day);
}

/** "YYYY-MM" key for the current billing month */
function monthYearKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Upsert a RentPayment record for the current cycle.
 * Safe to call multiple times — returns existing doc if already present.
 */
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

      // Include if: overdue (msUntilDue < 0)  OR  due within next 2 days
      if (msUntilDue > twoDaysMs) continue;

      const key = monthYearKey(now);
      let record = await RentPayment.findOne({ tenantId: tenant._id, monthYear: key });

      // Skip fully paid tenants
      if (record?.status === "Paid") continue;

      // Auto-create record if missing
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

    // Sort: overdue first, then by dueDate ascending
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
    const key = monthYearKey();

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
    const { q, type } = req.query; // type: "name" | "room"
    if (!q) return res.status(400).json({ message: "Query param 'q' is required." });

    let tenants = [];

    if (type === "room") {
      // Find buildings containing rooms with this number, then match tenants in those beds
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
      // Name search (case-insensitive regex)
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

    // Ensure current month record exists
    const currentRecord = await ensureRentRecord(tenant, req.user.id);

    // All history sorted newest first
    const history = await RentPayment.find({ tenantId: tenant._id }).sort({ monthYear: -1 }).lean();

    // Building details for display
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
      // Create for the requested month
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

    res.json({
      message: `Payment of ₹${actualPay} recorded.`,
      record,
      remaining: record.rentAmount - record.paidAmount,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

export default router;