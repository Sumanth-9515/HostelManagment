/**
 * AutoMailConfig.js  —  Model for storing the admin's auto-email reminder configuration.
 */

import mongoose from "mongoose";

const AutoMailConfigSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, 
    },

    // ── Toggles ──
    sendArrears: { type: Boolean, default: false },
    sendOverdue: { type: Boolean, default: false },
    sendUpcoming: { type: Boolean, default: false },

    // ── Individual Times (HH:MM format) ──
    timeArrears: { type: String, default: "09:00" },
    timeOverdue: { type: String, default: "10:00" },
    timeUpcoming: { type: String, default: "11:00" },

    // ── Audit (Last run tracking per type) ──
    lastRunArrears: { type: Date, default: null },
    lastRunOverdue: { type: Date, default: null },
    lastRunUpcoming: { type: Date, default: null },

    isEnabled: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("AutoMailConfig", AutoMailConfigSchema);