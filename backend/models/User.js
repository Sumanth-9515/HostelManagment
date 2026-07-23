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

    // One fixed public onboarding code per owner. Generated once on first link
    // request and reused forever for /tenant-register/:code.
    onboardingCode: { type: String, default: null, unique: true, sparse: true },

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

    // ── Accumulated bed limit ─────────────────────────────────────────────────
    // On new registration/approval: set to plan.beds
    // On extension approval: incremented by the new extension plan's beds
    // This is the actual enforced bed limit used across buildingRoutes
    planBeds: { type: Number, default: null },

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

userSchema.index({ role: 1, createdAt: -1 });
userSchema.index({ role: 1, loginStatus: 1, createdAt: -1 });
userSchema.index({ role: 1, planStatus: 1, planExpiresAt: 1 });

export default mongoose.model("User", userSchema);
