import express from "express";
import User from "../models/User.js";
import Building from "../models/Building.js";
import Tenant from "../models/Tenant.js";
import RentPayment from "../models/Rentpayment.js";
import PaymentRequest from "../models/PaymentRequest.js";
import AutoMailConfig from "../models/Automailconfig.js";
import ActivityLog from "../models/ActivityLog.js";
import jwt from "jsonwebtoken";

const router = express.Router();

// ── Master auth middleware ────────────────────────────────────────────────────
const masterAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided." });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "master")
      return res.status(403).json({ message: "Access denied. Master only." });
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: "Invalid token." });
  }
};

// ── Helper: build full stats for one user ────────────────────────────────────
async function buildUserStats(user) {
  const buildings     = await Building.find({ owner: user._id }).lean();
  const tenants       = await Tenant.find({ owner: user._id }).lean();
  const activeTenants = tenants.filter((t) => t.status === "Active");

  let totalBeds = 0, occupiedBeds = 0;
  for (const b of buildings) {
    for (const f of b.floors) {
      for (const r of f.rooms) {
        totalBeds    += r.beds.length;
        occupiedBeds += r.beds.filter((bed) => bed.status === "Occupied").length;
      }
    }
  }

  const totalRevenue = activeTenants.reduce((s, t) => s + (t.rentAmount || 0), 0);

  return {
    totalBuildings:  buildings.length,
    totalTenants:    tenants.length,
    activeTenants:   activeTenants.length,
    inactiveTenants: tenants.length - activeTenants.length,
    totalBeds,
    occupiedBeds,
    availableBeds:   totalBeds - occupiedBeds,
    totalRevenue,
  };
}

function calculateStats(buildings, tenants) {
  const activeTenants = tenants.filter((t) => t.status === "Active");
  let totalBeds = 0, occupiedBeds = 0;
  for (const b of buildings) {
    for (const f of b.floors) {
      for (const r of f.rooms) {
        totalBeds += r.beds.length;
        occupiedBeds += r.beds.filter((bed) => bed.status === "Occupied").length;
      }
    }
  }

  return {
    totalBuildings: buildings.length,
    totalTenants: tenants.length,
    activeTenants: activeTenants.length,
    inactiveTenants: tenants.length - activeTenants.length,
    totalBeds,
    occupiedBeds,
    availableBeds: totalBeds - occupiedBeds,
    totalRevenue: activeTenants.reduce((s, t) => s + (t.rentAmount || 0), 0),
  };
}

async function buildOwnerDeleteSummary(ownerId) {
  const [buildings, tenantCount, rentPaymentCount, paymentRequestCount, autoMailConfigCount, activityLogCount] = await Promise.all([
    Building.find({ owner: ownerId }).select("floors").lean(),
    Tenant.countDocuments({ owner: ownerId }),
    RentPayment.countDocuments({ owner: ownerId }),
    PaymentRequest.countDocuments({ owner: ownerId }),
    AutoMailConfig.countDocuments({ owner: ownerId }),
    ActivityLog.countDocuments({ owner: ownerId }),
  ]);

  let totalFloors = 0;
  let totalRooms = 0;
  let totalBeds = 0;
  for (const building of buildings) {
    totalFloors += building.floors.length;
    for (const floor of building.floors) {
      totalRooms += floor.rooms.length;
      for (const room of floor.rooms) totalBeds += room.beds.length;
    }
  }

  return {
    buildings: buildings.length,
    floors: totalFloors,
    rooms: totalRooms,
    beds: totalBeds,
    tenants: tenantCount,
    rentPayments: rentPaymentCount,
    paymentRequests: paymentRequestCount,
    autoMailConfigs: autoMailConfigCount,
    activityLogs: activityLogCount,
  };
}

// ── 1. PLATFORM OVERVIEW STATS ────────────────────────────────────────────────
// GET /api/master/stats
router.get("/stats", masterAuth, async (req, res) => {
  try {
    const [
      totalUsers,
      blockedUsers,
      totalBuildings,
      totalTenants,
      activeTenants,
    ] = await Promise.all([
      User.countDocuments({ role: "user" }),
      User.countDocuments({ role: "user", loginStatus: "blocked" }),
      Building.countDocuments(),
      Tenant.countDocuments(),
      Tenant.countDocuments({ status: "Active" }),
    ]);

    const allBuildings = await Building.find().lean();
    let totalBeds = 0, occupiedBeds = 0;
    for (const b of allBuildings) {
      for (const f of b.floors) {
        for (const r of f.rooms) {
          totalBeds    += r.beds.length;
          occupiedBeds += r.beds.filter((bed) => bed.status === "Occupied").length;
        }
      }
    }

    const revenueData  = await Tenant.aggregate([
      { $match: { status: "Active" } },
      { $group: { _id: null, total: { $sum: "$rentAmount" } } },
    ]);
    const totalRevenue = revenueData[0]?.total || 0;

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentUsers  = await User.countDocuments({ role: "user", createdAt: { $gte: sevenDaysAgo } });

    // Monthly growth: registrations per month last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);

    const monthlyGrowth = await User.aggregate([
      { $match: { role: "user", createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    res.json({
      totalUsers,
      blockedUsers,
      activeUsers:     totalUsers - blockedUsers,
      totalBuildings,
      totalTenants,
      activeTenants,
      inactiveTenants: totalTenants - activeTenants,
      totalBeds,
      occupiedBeds,
      availableBeds:   totalBeds - occupiedBeds,
      occupancyRate:   totalBeds ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
      totalRevenue,
      recentUsers,
      monthlyGrowth,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// ── 2. ALL USERS WITH STATS ───────────────────────────────────────────────────
// GET /api/master/users
router.get("/users", masterAuth, async (req, res) => {
  try {
    const users = await User.find({ role: "user" }).select("-password").lean();
    const ownerIds = users.map((user) => user._id);
    const [buildings, tenants] = await Promise.all([
      Building.find({ owner: { $in: ownerIds } }).lean(),
      Tenant.find({ owner: { $in: ownerIds } }).lean(),
    ]);
    const buildingsByOwner = new Map();
    const tenantsByOwner = new Map();

    buildings.forEach((building) => {
      const key = building.owner.toString();
      if (!buildingsByOwner.has(key)) buildingsByOwner.set(key, []);
      buildingsByOwner.get(key).push(building);
    });
    tenants.forEach((tenant) => {
      const key = tenant.owner.toString();
      if (!tenantsByOwner.has(key)) tenantsByOwner.set(key, []);
      tenantsByOwner.get(key).push(tenant);
    });

    const usersWithStats = users.map((user) => ({
      ...user,
      stats: calculateStats(
        buildingsByOwner.get(user._id.toString()) || [],
        tenantsByOwner.get(user._id.toString()) || []
      ),
    }));

    res.json(usersWithStats);
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// ── 3. SINGLE USER FULL DETAIL ────────────────────────────────────────────────
// GET /api/master/users/:userId
router.get("/users/:userId", masterAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select("-password").lean();
    if (!user) return res.status(404).json({ message: "User not found." });

    const buildings = await Building.find({ owner: user._id }).lean();
    const tenants   = await Tenant.find({ owner: user._id }).sort({ createdAt: -1 }).lean();

    // Attach payment summary per tenant (current month)
    const now     = new Date();
    const monthYr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const records = await RentPayment.find({
      owner: user._id,
      monthYear: monthYr,
      tenantId: { $in: tenants.map((tenant) => tenant._id) },
    }).lean();
    const recordsByTenantId = new Map(records.map((record) => [record.tenantId.toString(), record]));
    const tenantsWithPayment = tenants.map((t) => ({
      ...t,
      currentPayment: recordsByTenantId.get(t._id.toString()) || null,
    }));

    res.json({
      user,
      buildings,
      tenants: tenantsWithPayment,
      stats:   await buildUserStats(user),
    });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// ── 4. TOGGLE LOGIN STATUS ────────────────────────────────────────────────────
// GET /api/master/users/:userId/delete-summary
router.get("/users/:userId/delete-summary", masterAuth, async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.userId, role: "user" }).select("name owner email ph").lean();
    if (!user) return res.status(404).json({ message: "Owner not found." });

    const counts = await buildOwnerDeleteSummary(user._id);
    res.json({ user, counts });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// DELETE /api/master/users/:userId
router.delete("/users/:userId", masterAuth, async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.userId, role: "user" }).select("name owner email ph").lean();
    if (!user) return res.status(404).json({ message: "Owner not found." });

    const counts = await buildOwnerDeleteSummary(user._id);
    await Promise.all([
      Building.deleteMany({ owner: user._id }),
      Tenant.deleteMany({ owner: user._id }),
      RentPayment.deleteMany({ owner: user._id }),
      PaymentRequest.deleteMany({ owner: user._id }),
      AutoMailConfig.deleteMany({ owner: user._id }),
      ActivityLog.deleteMany({ owner: user._id }),
    ]);
    await User.deleteOne({ _id: user._id, role: "user" });

    res.json({
      message: `Owner ${user.owner || user.name} and all related data deleted successfully.`,
      userId: user._id,
      counts,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// PATCH /api/master/users/:userId/login-status
// Body: { loginStatus: "active" | "blocked" }
router.patch("/users/:userId/login-status", masterAuth, async (req, res) => {
  try {
    const { loginStatus } = req.body;
    if (!["active", "blocked"].includes(loginStatus)) {
      return res.status(400).json({ message: "loginStatus must be 'active' or 'blocked'." });
    }

    const user = await User.findOne({ _id: req.params.userId, role: "user" });
    if (!user) return res.status(404).json({ message: "User not found." });

    user.loginStatus = loginStatus;
    await user.save();

    res.json({
      message:     `Login ${loginStatus === "blocked" ? "blocked" : "restored"} for ${user.owner}.`,
      userId:      user._id,
      loginStatus: user.loginStatus,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// ── 5. BULK TOGGLE (optional convenience) ─────────────────────────────────────
// PATCH /api/master/users/bulk-status
// Body: { userIds: [...], loginStatus: "active"|"blocked" }
router.patch("/users/bulk-status", masterAuth, async (req, res) => {
  try {
    const { userIds, loginStatus } = req.body;
    if (!Array.isArray(userIds) || !["active", "blocked"].includes(loginStatus)) {
      return res.status(400).json({ message: "Invalid payload." });
    }
    await User.updateMany(
      { _id: { $in: userIds }, role: "user" },
      { loginStatus }
    );
    res.json({ message: `Updated ${userIds.length} user(s) to ${loginStatus}.` });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

export default router;
