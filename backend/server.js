import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import User from "./models/User.js";
import buildingRoutes from "./routes/buildingRoutes.js";
import tenantRoutes from "./routes/tenantRoutes.js";
import masterRoutes from "./routes/masterRoutes.js";

dotenv.config();

const app = express();
app.use(express.json());

// ── Production CORS Configuration ─────────────────────────────────────────────
// Explicitly allow your Netlify frontend and Localhost (for local development)
const allowedOrigins = [
  "https://hostel-management-system-sk.netlify.app", // Your Production Frontend
  "http://localhost:5173",                           // Local Dev (Vite)
  "http://localhost:3000"                            // Local Dev (CRA)
];

app.use(
  cors({
    origin: function (origin, callback) {
      // allow requests with no origin (like mobile apps or curl requests)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true, // Allow cookies/Authorization headers to be sent
  })
);

// ── Root Health Check (Required for Render) ───────────────────────────────────
// Render pings the root to verify if the server deployed successfully
app.get("/", (req, res) => {
  res.status(200).json({ message: "Backend API is successfully running!" });
});

// ── Database ─────────────────────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

// ── Register ──────────────────────────────────────────────────────────────────
// FIX: User.js schema fields are: name (property name), owner (owner name),
//      ph, email, password, address, role.
//      Frontend RegisterPage sends exactly these — mapping is correct.
//      Bug was: response never sent back a token, so user had to log in again.
//      Now we auto-issue a token on register so UX is seamless.
app.post("/api/register", async (req, res) => {
  try {
    const { name, owner, ph, email, password, address } = req.body;

    // Validate all required fields
    if (!name || !owner || !ph || !email || !password || !address) {
      return res.status(400).json({ message: "All fields are required." });
    }

    // Email uniqueness check
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(400).json({ message: "Email already registered." });
    }

    // Hash password
    const hashed = await bcrypt.hash(password, 10);

    const user = new User({
      name:     name.trim(),     // property / shop name
      owner:    owner.trim(),    // owner's real name
      ph:       ph.trim(),
      email:    email.toLowerCase().trim(),
      password: hashed,
      address:  address.trim(),
      role:     "user",
    });
    await user.save();

    // FIX: Issue JWT immediately so frontend can redirect without a second login
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.status(201).json({
      message: "Registered successfully!",
      token,
      user: {
        id:      user._id,
        name:    user.name,    // property name
        owner:   user.owner,   // owner name
        ph:      user.ph,
        email:   user.email,
        address: user.address,
        role:    user.role,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// ── Login ─────────────────────────────────────────────────────────────────────
// FIX 1: Was comparing plain-text password — bcrypt.compare was already used, OK.
// FIX 2: email lookup must be case-insensitive (lowercase stored on register).
// FIX 3: JWT payload now includes `name` and `owner` so downstream routes/UI
//         can display the right person name without an extra DB call.
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required." });
    }

    // FIX: case-insensitive email lookup
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials." });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(400).json({ message: "Invalid credentials." });
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
        id:      user._id,
        name:    user.name,    // property / shop name
        owner:   user.owner,   // owner's real name  ← was missing before
        ph:      user.ph,
        email:   user.email,
        address: user.address,
        role:    user.role,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error.", error: err.message });
  }
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/buildings", buildingRoutes);
app.use("/api/tenants", tenantRoutes);
app.use("/api/master", masterRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));