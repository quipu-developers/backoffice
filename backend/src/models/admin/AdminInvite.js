const mongoose = require("mongoose");
const { Permission } = require("../../config/permissions");

const adminInviteSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    perm: { type: Number, required: true, default: Permission.READ },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["pending", "used", "expired", "revoked"],
      default: "pending",
    },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "AdminUser" },
    usedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
  },
  { timestamps: true }
);

adminInviteSchema.index({ email: 1, status: 1 });
adminInviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("AdminInvite", adminInviteSchema);
