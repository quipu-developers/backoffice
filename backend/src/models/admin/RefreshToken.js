const mongoose = require("mongoose");

const refreshTokenSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "AdminUser" },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    revoked: { type: Boolean, default: false },
    revokedAt: { type: Date },
    replacedByTokenId: { type: mongoose.Schema.Types.ObjectId, ref: "RefreshToken" },
    deviceInfo: {
      userAgent: String,
      os: String,
      browser: String,
      ipHash: String,
      lastSeenAt: Date,
    },
  },
  { timestamps: true }
);

refreshTokenSchema.index({ userId: 1, revoked: 1, revokedAt: 1 });
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("RefreshToken", refreshTokenSchema);
