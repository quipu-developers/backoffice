const path = require("path");
require("dotenv").config({
  path: path.resolve(__dirname, "../../.env"),
});

const env = process.env.NODE_ENV || "development";

const config = {
  development: {
    mongodbUri: process.env.DEV_MONGODB_URI || process.env.MONGODB_URI,
    dbName: process.env.DEV_MONGODB_DB_NAME || process.env.MONGODB_DB_NAME,
  },
  test: {
    mongodbUri: process.env.TEST_MONGODB_URI || process.env.MONGODB_URI,
    dbName: process.env.TEST_MONGODB_DB_NAME || process.env.MONGODB_DB_NAME,
  },
  production: {
    mongodbUri: process.env.PROD_MONGODB_URI || process.env.MONGODB_URI,
    dbName: process.env.PROD_MONGODB_DB_NAME || process.env.MONGODB_DB_NAME,
  },
};

module.exports = config[env];
