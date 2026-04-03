const { AdminAuditLog } = require("../models/admin");
const { toIpHash } = require("../utils/ipHash");

async function writeAuditLog({
  actorUserId,
  targetUserId = null,
  action,
  before = null,
  after = null,
  req,
  session = null,
}) {
  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "";
  const ipHash = toIpHash(ip);

  const payload = {
    actorUserId,
    targetUserId,
    action,
    before,
    after,
    ipHash,
    userAgent: req.headers["user-agent"] || "",
  };

  if (session) {
    await AdminAuditLog.create([payload], { session });
    return;
  }

  await AdminAuditLog.create(payload);
}

module.exports = { writeAuditLog };
