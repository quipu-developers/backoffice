const crypto = require("crypto");

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

function hmacSha256(value, secret) {
  return crypto.createHmac("sha256", secret).update(String(value)).digest("hex");
}

module.exports = { sha256, randomToken, hmacSha256 };
