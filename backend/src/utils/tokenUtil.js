const jwt = require("jsonwebtoken");
const crypto = require("crypto");

function signAccessToken(userId) {
  return jwt.sign(
    { sub: String(userId), jti: crypto.randomUUID() },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: "15m" }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
}

module.exports = { signAccessToken, verifyAccessToken };
