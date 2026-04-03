const mongoose = require("mongoose");
const { Permission } = require("../../config/permissions");

const adminUserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    googleSub: { type: String, unique: true, sparse: true },
    name: { type: String },
    pictureUrl: { type: String },
    perm: { type: Number, required: true, default: Permission.READ },
    isSuperAdmin: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AdminUser", adminUserSchema);
