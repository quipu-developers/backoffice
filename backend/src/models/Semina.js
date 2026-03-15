const mongoose = require("mongoose");

const seminaSchema = new mongoose.Schema(
  {
    semina_id: { type: Number, required: true, unique: true, index: true },
    speaker: { type: String, required: true, trim: true },
    topic: { type: String, required: true, trim: true },
    detail: { type: String, required: true },
    resources: { type: String, default: null },
    presentation_date: { type: Date, required: true },
  },
  {
    versionKey: false,
    timestamps: true,
    collection: "seminas",
  }
);

module.exports = mongoose.model("Semina", seminaSchema);
