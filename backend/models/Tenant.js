import mongoose from "mongoose";

const TenantSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String },
    fatherName: { type: String },
    fatherPhone: { type: String },
    permanentAddress: { type: String, required: true },
    joiningDate: { type: Date, required: true },
    rentAmount: { type: Number, required: true },
    // ── NEW: Advance amount paid at joining (optional, defaults to 0) ──
    advanceAmount: { type: Number, default: 0 },
    paidAdvanceAmount: { type: Number, default: 0 },
    buildingId: { type: mongoose.Schema.Types.ObjectId, ref: "Building", default: null },
    floorId: { type: mongoose.Schema.Types.ObjectId, default: null },
    roomId: { type: mongoose.Schema.Types.ObjectId, default: null },
    bedId: { type: mongoose.Schema.Types.ObjectId, default: null },
    allocationInfo: {
      buildingName: String,
      floorNumber: Number,
      roomNumber: String,
      bedNumber: Number,
    },
    documents: {
      aadharFront:   { type: String, default: null }, // Cloudinary URL
      aadharBack:    { type: String, default: null }, // Cloudinary URL
      passportPhoto: { type: String, default: null }, // Cloudinary URL
    },
    source: {
      type: String,
      enum: ["admin", "onboarding-link"],
      default: "admin",
    },
    // ── NEW: Notification read flag for onboarding-link candidates ──
    // false = admin has NOT yet seen this candidate in the notification panel
    // true  = admin has opened the notification dropdown and this entry was marked read
    isVerified: { type: Boolean, default: false },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
  },
  { timestamps: true }
);

TenantSchema.index({ owner: 1, status: 1, createdAt: -1 });
TenantSchema.index({ owner: 1, createdAt: -1 });
TenantSchema.index({ owner: 1, source: 1, createdAt: -1 });
TenantSchema.index({ owner: 1, source: 1, isVerified: 1 });
TenantSchema.index({ owner: 1, status: 1, joiningDate: 1 });
TenantSchema.index({ owner: 1, status: 1, buildingId: 1 });
TenantSchema.index({ owner: 1, status: 1, name: 1 });
TenantSchema.index({ owner: 1, status: 1, email: 1 });
TenantSchema.index({ owner: 1, status: 1, phone: 1 });
TenantSchema.index({ owner: 1, roomId: 1 });
TenantSchema.index({ owner: 1, bedId: 1 });

export default mongoose.model("Tenant", TenantSchema);
