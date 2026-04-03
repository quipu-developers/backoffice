const mongoose = require("mongoose");

const featureSchema = new mongoose.Schema(
  {
    feature_name: { type: String, required: true, unique: true, trim: true },
    is_enabled: { type: Boolean, default: false },
  },
  { timestamps: true, collection: "features" }
);

module.exports = mongoose.model("FeatureMongo", featureSchema);

