import mongoose from "mongoose";

const ActivityLogSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    actionType: { 
      type: String, 
      enum: ["CREATE", "UPDATE", "DELETE", "PAYMENT", "VACATE", "REALLOCATE", "ONBOARD"], 
      required: true 
    },
    entityType: { 
      type: String, 
      enum: ["Building", "Floor", "Room", "Tenant", "Rent"], 
      required: true 
    },
    description: { type: String, required: true },
    metadata: { type: Object, default: {} }, // Extra info like IDs or Names
  },
  { timestamps: true }
);

export default mongoose.model("ActivityLog", ActivityLogSchema);