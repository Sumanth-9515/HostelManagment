import mongoose from "mongoose";

const BedSchema = new mongoose.Schema({
  bedNumber: { type: Number, required: true },
  status: { type: String, enum: ["Available", "Occupied"], default: "Available" },
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", default: null },
});

const RoomSchema = new mongoose.Schema({
  roomNumber: { type: String, required: true },
  shareType: { type: Number, required: true, min: 1 },
  beds: [BedSchema],
});

const FloorSchema = new mongoose.Schema({
  floorNumber: { type: Number, required: true },
  floorName: { type: String },
  rooms: [RoomSchema],
});

const BuildingSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    buildingName: { type: String, required: true },
    address: { type: String },
    floors: [FloorSchema],
  },
  { timestamps: true }
);

export default mongoose.model("Building", BuildingSchema);
