import mongoose from "mongoose";

const PaymentRequestSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true },
    rentPaymentId: { type: mongoose.Schema.Types.ObjectId, ref: "RentPayment", default: null },

    monthYear: { type: String, required: true },
    dueDate: { type: Date, required: true },
    rentAmount: { type: Number, required: true },
    paidAmountAtRequest: { type: Number, default: 0 },
    requestedAmount: { type: Number, required: true },

    paymentMode: { type: String, enum: ["Online", "Cash"], required: true },
    receiptUrl: { type: String, default: null },
    cashHandoverAt: { type: Date, default: null },

    status: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending" },
    submittedAt: { type: Date, default: Date.now },

    approvedAt: { type: Date, default: null },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    rejectedAt: { type: Date, default: null },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    rejectReason: { type: String, default: "" },
    emailActions: {
      expiresAt: { type: Date, default: null },
      approve: {
        tokenHash: { type: String, default: null },
        usedAt: { type: Date, default: null },
      },
      reject: {
        tokenHash: { type: String, default: null },
        usedAt: { type: Date, default: null },
      },
    },
  },
  { timestamps: true }
);

PaymentRequestSchema.index({ owner: 1, status: 1, submittedAt: -1 });
PaymentRequestSchema.index({ owner: 1, submittedAt: -1 });
PaymentRequestSchema.index({ owner: 1, tenantId: 1, monthYear: 1, status: 1 });
PaymentRequestSchema.index({ "emailActions.approve.tokenHash": 1 });
PaymentRequestSchema.index({ "emailActions.reject.tokenHash": 1 });

export default mongoose.model("PaymentRequest", PaymentRequestSchema);
