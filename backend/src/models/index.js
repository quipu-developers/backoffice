const mongoose = require("mongoose");
const config = require("../config/config");

const Member = require("./Member");
const Semina = require("./Semina");
const File = require("./File");
const Feature = require("./Feature");

async function connectDB() {
  if (!config?.mongodbUri) {
    throw new Error("MONGODB_URI(또는 환경별 URI)가 설정되지 않았습니다.");
  }

  await mongoose.connect(config.mongodbUri, {
    dbName: config.dbName || undefined,
    serverSelectionTimeoutMS: 10000,
  });
}

module.exports = {
  mongoose,
  connectDB,
  Member,
  Semina,
  File,
  Feature,
};
