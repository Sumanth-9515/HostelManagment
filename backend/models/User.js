// models/User.js — with planActivatedAt, planExpiresAt, planRenewalAt + extension support
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true },
    owner:       { type: String, required: true },
    ph:          { type: String, required: true },
    email:       { type: String, required: true, unique: true },
    password:    { type: String, required: true },
    address:     { type: String, required: true },
    role:        { type: String, enum: ["user", "master"], default: "user" },
    loginStatus: { type: String, enum: ["active", "blocked", "pending"], default: "active" },

    // Plan reference
    plan:     { type: mongoose.Schema.Types.ObjectId, ref: "Plan", default: null },
    planName: { type: String, default: null },

    // ── Plan lifecycle timestamps ─────────────────────────────────────────────
    // Set at registration (free) or at approval (paid)
    planActivatedAt: { type: Date, default: null },
    // planActivatedAt + plan.days  → login blocked when now > planExpiresAt
    planExpiresAt:   { type: Date, default: null },
    // Updated each time a renewal/extension is approved by master
    planRenewalAt:   { type: Date, default: null },

    // ── Plan status ───────────────────────────────────────────────────────────
    planStatus: { type: String, enum: ["active", "expired", "none"], default: "none" },

    // Prevent re-using free trial on renewal
    usedFreePlan: { type: Boolean, default: false },

    // ── Extension / renewal request ───────────────────────────────────────────
    extensionRequest: {
      requested:   { type: Boolean, default: false },
      planId:      { type: mongoose.Schema.Types.ObjectId, ref: "Plan", default: null },
      planName:    { type: String, default: null },
      planPrice:   { type: Number, default: null },
      planDays:    { type: Number, default: null },
      requestedAt: { type: Date,   default: null },
    },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);