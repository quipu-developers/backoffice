const mongoose = require("mongoose");

const memberSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    grade: { type: Number, required: true },
    student_id: { type: String, required: true, unique: true, trim: true },
    major: { type: String, required: true, trim: true },
    phone_number: { type: String, required: true, trim: true },
    semina: { type: Boolean, required: true },
    dev: { type: Boolean, required: true },
    study: { type: Boolean, required: true },
    external: { type: Boolean, required: true },
    motivation_semina: { type: String, default: null },
    field_dev: { type: String, default: null },
    motivation_study: { type: String, default: null },
    motivation_external: { type: String, default: null },
    portfolio_pdf: { type: String, default: null },
    github_profile: { type: String, default: null },
  },
  {
    versionKey: false,
    timestamps: true,
    collection: "members",
  }
);

module.exports = mongoose.model("Member", memberSchema);
