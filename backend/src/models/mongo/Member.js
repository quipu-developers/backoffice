const mongoose = require("mongoose");

const memberSchema = new mongoose.Schema(
  {
    generation: { type: String },
    username: { type: String },
    student_id: { type: String },
    major: { type: String },
    email: { type: String },
    activity: { type: Boolean },
    dev: { type: Boolean },
    game: { type: Boolean },
    design: { type: Boolean },
    blog: { type: String },
    github: { type: String },
    portfolio: { type: String },
    etc: { type: String },
  },
  { timestamps: true, collection: "members" }
);

module.exports = mongoose.model("MemberMongo", memberSchema);

