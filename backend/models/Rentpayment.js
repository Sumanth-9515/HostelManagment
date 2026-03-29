import mongoose from "mongoose";

const PaymentEntrySchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  paidAt: { type: Date, default: Date.now },
  note: { type: String, default: "" },
});

const RentPaymentSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true },

    // e.g. "2025-06"  (YYYY-MM — one doc per tenant per month)
    monthYear: { type: String, required: true },

    // Canonical due date for this cycle
    dueDate: { type: Date, required: true },

    // Rent expected for this month
    rentAmount: { type: Number, required: true },

    // Running total already paid
    paidAmount: { type: Number, default: 0 },

    // "Due" | "Partial" | "Paid"
    status: {
      type: String,
      enum: ["Due", "Partial", "Paid"],
      default: "Due",
    },

    // Each call to /pay appends here
    payments: [PaymentEntrySchema],
  },
  { timestamps: true }
);

// Compound unique index: one record per tenant per month
RentPaymentSchema.index({ tenantId: 1, monthYear: 1 }, { unique: true });

export default mongoose.model("RentPayment", RentPaymentSchema);