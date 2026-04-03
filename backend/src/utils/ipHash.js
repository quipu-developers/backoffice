const { hmacSha256 } = require("./cryptoUtil");

function toIpHash(ip) {
  const salt = process.env.SERVER_SECRET_SALT;
  if (!salt) return null;
  if (!ip) return null;
  return hmacSha256(ip, salt);
}

module.exports = { toIpHash };
