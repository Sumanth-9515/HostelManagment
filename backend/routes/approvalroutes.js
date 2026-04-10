// routes/approvalRoutes.js
import express from "express";
import User from "../models/User.js";
import Plan from "../models/Plan.js";
import jwt from "jsonwebtoken";

const router = express.Router();

// ── Auth middleware (master only) ─────────────────────────────────────────────
function masterAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ message: "No token." });
  try {
    const decoded = jwt.verify(auth.split(" ")[1], process.env.JWT_SECRET);
    if (decoded.role !== "master") return res.status(403).json({ message: "Master only." });
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: "Invalid token." });
  }
}

// Helper
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// ── GET all pending users ─────────────────────────────────────────────────────
router.get("/pending", masterAuth, async (req, res) => {
  try {
    const users = await User.find({ loginStatus: "pending", role: "user" })
      .select("-password")
      .populate("plan", "name price days beds")
      .populate("extensionRequest.planId", "name price days beds")
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// ── GET all users with plan info (master plan monitor page) ───────────────────
router.get("/users-plan", masterAuth, async (req, res) => {
  try {
    const users = await User.find({ role: "user" })
      .select("-password")
      .populate("plan", "name price days beds isFree")
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// ── PATCH edit planExpiresAt and/or planBeds for a user (master only) ─────────
router.patch("/:id/edit-plan", masterAuth, async (req, res) => {
  try {
    const { planExpiresAt, planBeds } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found." });

    // Validate and apply planExpiresAt if provided
    if (planExpiresAt !== undefined && planExpiresAt !== null && planExpiresAt !== "") {
      const parsed = new Date(planExpiresAt);
      if (isNaN(parsed.getTime()))
        return res.status(400).json({ message: "Invalid planExpiresAt date." });
      user.planExpiresAt = parsed;

      // Recalculate planStatus based on new expiry
      const now = new Date();
      if (parsed > now) {
        user.planStatus = "active";
        if (user.loginStatus === "blocked" && user.planStatus !== "active") {
          // Only unblock if they were blocked due to expiry; leave other blocks alone
        }
      } else {
        user.planStatus = "expired";
      }
    }

    // Validate and apply planBeds if provided
    if (planBeds !== undefined && planBeds !== null && planBeds !== "") {
      const beds = Number(planBeds);
      if (isNaN(beds) || beds < 0)
        return res.status(400).json({ message: "Invalid planBeds value." });
      user.planBeds = beds;
    }

    await user.save();
    const saved = await User.findById(user._id).select("-password");
    res.json({ message: "Plan updated successfully.", user: saved });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// ── PATCH approve ─────────────────────────────────────────────────────────────
router.patch("/:id/approve", masterAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate("extensionRequest.planId");
    if (!user) return res.status(404).json({ message: "User not found." });

    const isExtension = user.extensionRequest?.requested === true;
    const now = new Date();

    if (isExtension) {
      // Extension approval: switch to new plan, set planRenewalAt = now
      const newPlan = user.extensionRequest.planId;
      if (!newPlan) return res.status(400).json({ message: "Extension plan not found." });

      user.plan            = newPlan._id;
      user.planName        = newPlan.name;
      user.planActivatedAt = user.planActivatedAt || now; // keep original activation if exists
      user.planRenewalAt   = now;                          // ← renewal timestamp
      user.planExpiresAt   = addDays(now, newPlan.days);  // fresh expiry from approval date
      user.planStatus      = "active";
      user.loginStatus     = "active";

      // ── Accumulate bed limit: add new plan's beds on top of existing total ──
      const currentBeds = user.planBeds ?? 0;
      user.planBeds = currentBeds + newPlan.beds;
      // ────────────────────────────────────────────────────────────────────────

      user.extensionRequest = {
        requested: false, planId: null, planName: null,
        planPrice: null, planDays: null, requestedAt: null,
      };
    } else {
      // New registration approval: set planActivatedAt + planExpiresAt
      const plan = await Plan.findById(user.plan);

      user.loginStatus     = "active";
      user.planActivatedAt = now;
      user.planRenewalAt   = null; // first activation, not a renewal
      user.planStatus      = plan ? "active" : "none";

      if (plan) {
        user.planExpiresAt = addDays(now, plan.days);
        // ── Set initial bed limit from the approved plan ──────────────────────
        user.planBeds = plan.beds;
        // ─────────────────────────────────────────────────────────────────────
      }
    }

    await user.save();
    const saved = await User.findById(user._id).select("-password");
    res.json({ message: "User approved.", user: saved });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// ── PATCH reject ──────────────────────────────────────────────────────────────
router.patch("/:id/reject", masterAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found." });

    const isExtension = user.extensionRequest?.requested === true;

    if (isExtension) {
      // Clear extension request; revert loginStatus so user can retry
      user.extensionRequest = {
        requested: false, planId: null, planName: null,
        planPrice: null, planDays: null, requestedAt: null,
      };
      user.loginStatus = "blocked";
    } else {
      user.loginStatus = "blocked";
    }

    await user.save();
    const saved = await User.findById(user._id).select("-password");
    res.json({ message: "User rejected.", user: saved });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

export default router;