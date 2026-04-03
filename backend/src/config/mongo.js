const mongoose = require("mongoose");

async function connectMongo() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is required");

  await mongoose.connect(uri, {
    dbName: process.env.MONGO_DB_NAME || "quipu_backoffice",
  });

  console.log("[LOG] MongoDB connected");
}

module.exports = { connectMongo };
