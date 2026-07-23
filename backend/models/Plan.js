import mongoose from "mongoose";

const planSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true, trim: true },
    price:    { type: Number, required: true },          // INR; 0 = free
    days:     { type: Number, required: true },          // subscription duration
    beds:     { type: Number, required: true },          // max beds allowed
    isFree:   { type: Boolean, default: false },         // convenience flag
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

planSchema.index({ isActive: 1, price: 1 });
planSchema.index({ price: 1 });

export default mongoose.model("Plan", planSchema);
