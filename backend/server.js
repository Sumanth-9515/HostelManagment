import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import User from "./models/User.js";
import Plan from "./models/Plan.js";
import buildingRoutes from "./routes/buildingRoutes.js";
import tenantRoutes from "./routes/tenantRoutes.js";
import masterRoutes from "./routes/masterRoutes.js";
import rentRoutes from "./routes/rentroutes.js";
import activityRoutes from "./routes/activityRoutes.js";
import planRoutes from "./routes/planroutes.js";
import approvalRoutes from "./routes/approvalroutes.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  "https://hostel-management-system-sk.netlify.app",
  "https://hrms-420.netlify.app",
  "http://localhost:5173",
  "http://localhost:3000",
  "https://hrms-vaz.netlify.app",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      const cleanOrigin = origin.replace(/\/$/, "");
      if (allowedOrigins.includes(cleanOrigin)) {
        callback(null, true);
      } else {
        console.log("❌ Blocked by CORS:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// ── Health Check ──────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.status(200).json({ message: "Backend API is successfully running!" });
});

// ── Database ──────────────────────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

// ── Helper: compute expiry date ───────────────────────────────────────────────
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// ── Register ──────────────────────────────────────────────────────────────────
app.post("/api/register", async (req, res) => {
  try {
    const { name, owner, ph, email, password, address, planId } = req.body;

    if (!name || !owner || !ph || !email || !password || !address)
      return res.status(400).json({ message: "All fields are required." });

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing)
      return res.status(400).json({ message: "Email already registered." });

    const hashed = await bcrypt.hash(password, 10);

    let loginStatus      = "active";
    let planRef          = null;
    let planName         = null;
    let planStatus       = "none";
    let planActivatedAt  = null;
    let planExpiresAt    = null;
    let usedFreePlan     = false;

    if (planId) {
      const plan = await Plan.findById(planId);
      if (!plan) return res.status(400).json({ message: "Selected plan not found." });

      planRef  = plan._id;
      planName = plan.name;

      if (plan.isFree) {
        // Free plan → activate immediately, calculate expiry from plan.days
        usedFreePlan    = true;
        loginStatus     = "active";
        planStatus      = "active";
        planActivatedAt = new Date();
        planExpiresAt   = addDays(planActivatedAt, plan.days);
      } else {
        // Paid plan → pending approval; dates set when master approves
        loginStatus = "pending";
        planStatus  = "none";
      }
    }

    const user = new User({
      name:            name.trim(),
      owner:           owner.trim(),
      ph:              ph.trim(),
      email:           email.toLowerCase().trim(),
      password:        hashed,
      address:         address.trim(),
      role:            "user",
      loginStatus,
      plan:            planRef,
      planName,
      planStatus,
      planActivatedAt,
      planExpiresAt,
      planRenewalAt:   null,
      usedFreePlan,
    });

    await user.save();

    if (loginStatus === "pending") {
      return res.status(201).json({
        message: "Registered! Your account is pending approval.",
        pending: true,
      });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.status(201).json({
      message: "Registered successfully!",
      token,
      pending: false,
      user: {
        id:              user._id,
        name:            user.name,
        owner:           user.owner,
        ph:              user.ph,
        email:           user.email,
        address:         user.address,
        role:            user.role,
        loginStatus:     user.loginStatus,
        planStatus:      user.planStatus,
        planActivatedAt: user.planActivatedAt,
        planExpiresAt:   user.planExpiresAt,
        planRenewalAt:   user.planRenewalAt,
        usedFreePlan:    user.usedFreePlan,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// ── Login ─────────────────────────────────────────────────────────────────────
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Email and password required." });

    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .populate("plan", "name price days beds isFree");

    if (!user)
      return res.status(400).json({ message: "Invalid credentials." });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return res.status(400).json({ message: "Invalid credentials." });

    // ── Pending approval ──────────────────────────────────────────────────────
    if (user.loginStatus === "pending") {
      return res.status(403).json({
        message: "Your account is awaiting approval. We will respond shortly.",
        pending: true,
        extensionPending: user.extensionRequest?.requested || false,
      });
    }

    // ── Blocked ───────────────────────────────────────────────────────────────
    if (user.role !== "master" && user.loginStatus === "blocked") {
      return res.status(403).json({
        message: "Your login has been stopped by the website owner. Please contact support.",
        blocked: true,
      });
    }

    // ── Plan expiry check (runs for ALL non-master users who have a plan) ─────
    if (user.role !== "master" && user.planExpiresAt) {
      const now = new Date();
      if (now > new Date(user.planExpiresAt)) {
        // Auto-mark expired in DB
        if (user.planStatus !== "expired") {
          user.planStatus = "expired";
          await user.save();
        }
        return res.status(403).json({
          message: "Your plan has expired. Please renew to continue.",
          planExpired: true,
          planInfo: {
            planName:        user.planName,
            planActivatedAt: user.planActivatedAt,
            planExpiresAt:   user.planExpiresAt,
            planRenewalAt:   user.planRenewalAt,
            usedFreePlan:    user.usedFreePlan,
          },
          extensionPending: user.extensionRequest?.requested || false,
          userId: user._id,
          userInfo: {
            name:    user.name,
            owner:   user.owner,
            email:   user.email,
            ph:      user.ph,
            address: user.address,
          },
        });
      }
    }

    // ── Also block if already marked expired ─────────────────────────────────
    if (user.role !== "master" && user.planStatus === "expired") {
      return res.status(403).json({
        message: "Your plan has expired. Please renew to continue.",
        planExpired: true,
        planInfo: {
          planName:        user.planName,
          planActivatedAt: user.planActivatedAt,
          planExpiresAt:   user.planExpiresAt,
          planRenewalAt:   user.planRenewalAt,
          usedFreePlan:    user.usedFreePlan,
        },
        extensionPending: user.extensionRequest?.requested || false,
        userId: user._id,
        userInfo: {
          name:    user.name,
          owner:   user.owner,
          email:   user.email,
          ph:      user.ph,
          address: user.address,
        },
      });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      message: "Logged in successfully!",
      token,
      user: {
        id:              user._id,
        name:            user.name,
        owner:           user.owner,
        ph:              user.ph,
        email:           user.email,
        address:         user.address,
        role:            user.role,
        loginStatus:     user.loginStatus,
        planStatus:      user.planStatus,
        planActivatedAt: user.planActivatedAt,
        planExpiresAt:   user.planExpiresAt,
        planRenewalAt:   user.planRenewalAt,
        usedFreePlan:    user.usedFreePlan,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// ── Request Plan Extension ────────────────────────────────────────────────────
app.post("/api/request-extension", async (req, res) => {
  try {
    const { userId, planId } = req.body;
    if (!userId || !planId)
      return res.status(400).json({ message: "userId and planId required." });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found." });

    const plan = await Plan.findById(planId);
    if (!plan || !plan.isActive)
      return res.status(404).json({ message: "Plan not found or inactive." });

    if (plan.isFree)
      return res.status(400).json({ message: "Cannot request extension with a free plan." });

    user.extensionRequest = {
      requested:   true,
      planId:      plan._id,
      planName:    plan.name,
      planPrice:   plan.price,
      planDays:    plan.days,
      requestedAt: new Date(),
    };
    user.loginStatus = "pending";
    await user.save();

    res.json({ message: "Extension request submitted. Awaiting admin approval.", pending: true });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/buildings",  buildingRoutes);
app.use("/api/tenants",    tenantRoutes);
app.use("/api/rent",       rentRoutes);
app.use("/api/master",     masterRoutes);
app.use("/api/activities", activityRoutes);
app.use("/api/plans",      planRoutes);
app.use("/api/approval",   approvalRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));
