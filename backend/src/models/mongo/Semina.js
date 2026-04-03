const mongoose = require("mongoose");

const seminaSchema = new mongoose.Schema(
  {
    speaker: { type: String, required: true },
    topic: { type: String, required: true },
    detail: { type: String },
    resources: { type: String },
    presentation_date: { type: Date, required: true },
  },
  { timestamps: true, collection: "semina" }
);

module.exports = mongoose.model("SeminaMongo", seminaSchema);

