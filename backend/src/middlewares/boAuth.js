const { AdminUser } = require("../models/admin");
const { verifyAccessToken } = require("../utils/tokenUtil");

function extractBearer(req) {
  const h = req.headers.authorization || "";
  if (!h.startsWith("Bearer ")) return null;
  return h.slice(7);
}

async function requireAuth(req, res, next) {
  try {
    const token = extractBearer(req);
    if (!token) return res.status(401).json({ code: "UNAUTHORIZED" });

    const payload = verifyAccessToken(token);
    const user = await AdminUser.findById(payload.sub).lean();
    if (!user) return res.status(401).json({ code: "UNAUTHORIZED" });
    if (!user.isActive) return res.status(403).json({ code: "ACCOUNT_INACTIVE" });

    req.auth = {
      userId: String(user._id),
      perm: user.perm,
      isSuperAdmin: user.isSuperAdmin,
    };

    next();
  } catch (_e) {
    return res.status(401).json({ code: "UNAUTHORIZED" });
  }
}

function requirePerm(mask) {
  return (req, res, next) => {
    if ((req.auth.perm & mask) === mask) return next();
    return res.status(403).json({ code: "PERMISSION_DENIED" });
  };
}

function requireSuperAdmin(req, res, next) {
  if (req.auth.isSuperAdmin) return next();
  return res.status(403).json({ code: "SUPER_ADMIN_REQUIRED" });
}

module.exports = { requireAuth, requirePerm, requireSuperAdmin };
