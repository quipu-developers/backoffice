const mongoose = require("mongoose");

const adminAuditLogSchema = new mongoose.Schema(
  {
    actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
    targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
    action: { type: String, required: true },
    before: { type: mongoose.Schema.Types.Mixed },
    after: { type: mongoose.Schema.Types.Mixed },
    ipHash: { type: String },
    userAgent: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

adminAuditLogSchema.index({ actorUserId: 1, createdAt: -1 });
adminAuditLogSchema.index({ action: 1, createdAt: -1 });
adminAuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

function denyMutation(next) {
  next(new Error("ADMIN_AUDIT_LOG_APPEND_ONLY"));
}

// Enforce append-only policy at model level.
adminAuditLogSchema.pre("updateOne", denyMutation);
adminAuditLogSchema.pre("updateMany", denyMutation);
adminAuditLogSchema.pre("findOneAndUpdate", denyMutation);
adminAuditLogSchema.pre("replaceOne", denyMutation);
adminAuditLogSchema.pre("deleteOne", denyMutation);
adminAuditLogSchema.pre("deleteMany", denyMutation);
adminAuditLogSchema.pre("findOneAndDelete", denyMutation);
adminAuditLogSchema.pre("findOneAndRemove", denyMutation);

module.exports = mongoose.model("AdminAuditLog", adminAuditLogSchema);
