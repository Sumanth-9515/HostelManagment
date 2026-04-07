import "dotenv/config"; // <-- FIX: This MUST be the very first line to load .env before other imports
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import User from "./models/User.js";
import buildingRoutes from "./routes/buildingRoutes.js";
import tenantRoutes from "./routes/tenantRoutes.js";
import masterRoutes from "./routes/masterRoutes.js";
import rentRoutes from "./routes/Rentroutes.js";
import activityRoutes from "./routes/activityRoutes.js";
import path from "path";
import { fileURLToPath } from "url";

// Define __filename and __dirname for ES modules BEFORE using them
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app = express();
app.use(express.json());

// Serve uploaded tenant documents
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  "https://hostel-management-system-sk.netlify.app",
  "https://hrms-420.netlify.app",
  "http://localhost:5173",
  "http://localhost:3000",
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

// ── Register ──────────────────────────────────────────────────────────────────
app.post("/api/register", async (req, res) => {
  try {
    const { name, owner, ph, email, password, address } = req.body;

    if (!name || !owner || !ph || !email || !password || !address) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(400).json({ message: "Email already registered." });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = new User({
      name:        name.trim(),
      owner:       owner.trim(),
      ph:          ph.trim(),
      email:       email.toLowerCase().trim(),
      password:    hashed,
      address:     address.trim(),
      role:        "user",
      loginStatus: "active",
    });
    await user.save();

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.status(201).json({
      message: "Registered successfully!",
      token,
      user: {
        id:          user._id,
        name:        user.name,
        owner:       user.owner,
        ph:          user.ph,
        email:       user.email,
        address:     user.address,
        role:        user.role,
        loginStatus: user.loginStatus,
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

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required." });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials." });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(400).json({ message: "Invalid credentials." });
    }

    if (user.role !== "master" && user.loginStatus === "blocked") {
      return res.status(403).json({
        message: "Your login has been stopped by the website owner. Please contact support.",
        blocked: true,
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
        id:          user._id,
        name:        user.name,
        owner:       user.owner,
        ph:          user.ph,
        email:       user.email,
        address:     user.address,
        role:        user.role,
        loginStatus: user.loginStatus,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/buildings", buildingRoutes);
app.use("/api/tenants",   tenantRoutes);
app.use("/api/rent",      rentRoutes);
app.use("/api/master",    masterRoutes);
app.use('/api/activities', activityRoutes);


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));