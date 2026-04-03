const mongoose = require("mongoose");

const fileSchema = new mongoose.Schema(
  {
    semina_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "SeminaMongo" },
    file_name: { type: String, required: true },
  },
  { timestamps: true, collection: "files" }
);

module.exports = mongoose.model("FileMongo", fileSchema);

