import express from "express";
import User from "../models/User.js";
import Building from "../models/Building.js";
import Tenant from "../models/Tenant.js";
import RentPayment from "../models/RentPayment.js";
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

// ── 1. PLATFORM OVERVIEW STATS ────────────────────────────────────────────────
// GET /api/master/stats
router.get("/stats", masterAuth, async (req, res) => {
  try {
    const totalUsers     = await User.countDocuments({ role: "user" });
    const blockedUsers   = await User.countDocuments({ role: "user", loginStatus: "blocked" });
    const totalBuildings = await Building.countDocuments();
    const totalTenants   = await Tenant.countDocuments();
    const activeTenants  = await Tenant.countDocuments({ status: "Active" });

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

    const usersWithStats = await Promise.all(
      users.map(async (user) => ({
        ...user,
        stats: await buildUserStats(user),
      }))
    );

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

    const tenantsWithPayment = await Promise.all(
      tenants.map(async (t) => {
        const rec = await RentPayment.findOne({ tenantId: t._id, monthYear: monthYr }).lean();
        return { ...t, currentPayment: rec || null };
      })
    );

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