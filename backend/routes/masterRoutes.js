import express from "express";
import User from "../models/User.js";
import Building from "../models/Building.js";
import Tenant from "../models/Tenant.js";
import jwt from "jsonwebtoken";

const router = express.Router();

// Master auth middleware
const masterAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided." });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "master") return res.status(403).json({ message: "Access denied. Master only." });
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: "Invalid token." });
  }
};

// GET ALL USERS with stats
router.get("/users", masterAuth, async (req, res) => {
  try {
    const users = await User.find({ role: "user" }).select("-password").lean();

    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const buildings = await Building.find({ owner: user._id });
        const tenants = await Tenant.find({ owner: user._id });
        const activeTenants = tenants.filter((t) => t.status === "Active");
        const totalRevenue = activeTenants.reduce((sum, t) => sum + (t.rentAmount || 0), 0);

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
          ...user,
          stats: {
            totalBuildings: buildings.length,
            totalTenants: tenants.length,
            activeTenants: activeTenants.length,
            totalBeds,
            occupiedBeds,
            availableBeds: totalBeds - occupiedBeds,
            totalRevenue,
          },
        };
      })
    );

    res.json(usersWithStats);
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// GET SINGLE USER DETAIL
router.get("/users/:userId", masterAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select("-password").lean();
    if (!user) return res.status(404).json({ message: "User not found." });

    const buildings = await Building.find({ owner: user._id });
    const tenants = await Tenant.find({ owner: user._id }).sort({ createdAt: -1 });

    res.json({ user, buildings, tenants });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// PLATFORM OVERVIEW STATS
router.get("/stats", masterAuth, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: "user" });
    const totalBuildings = await Building.countDocuments();
    const totalTenants = await Tenant.countDocuments();
    const activeTenants = await Tenant.countDocuments({ status: "Active" });

    const allBuildings = await Building.find().lean();
    let totalBeds = 0, occupiedBeds = 0;
    for (const b of allBuildings) {
      for (const f of b.floors) {
        for (const r of f.rooms) {
          totalBeds += r.beds.length;
          occupiedBeds += r.beds.filter((bed) => bed.status === "Occupied").length;
        }
      }
    }

    const revenueData = await Tenant.aggregate([
      { $match: { status: "Active" } },
      { $group: { _id: null, total: { $sum: "$rentAmount" } } },
    ]);
    const totalRevenue = revenueData[0]?.total || 0;

    // Recent registrations (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentUsers = await User.countDocuments({ role: "user", createdAt: { $gte: sevenDaysAgo } });

    res.json({
      totalUsers,
      totalBuildings,
      totalTenants,
      activeTenants,
      totalBeds,
      occupiedBeds,
      availableBeds: totalBeds - occupiedBeds,
      totalRevenue,
      recentUsers,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

export default router;
