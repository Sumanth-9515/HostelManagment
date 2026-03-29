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
      aadharFront: { type: String, default: null }, // Cloudinary URL
      aadharBack: { type: String, default: null },  // Cloudinary URL
      passportPhoto: { type: String, default: null } // Cloudinary URL
    },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
  },
  { timestamps: true }
);

export default mongoose.model("Tenant", TenantSchema);