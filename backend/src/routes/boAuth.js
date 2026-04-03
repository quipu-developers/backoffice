const express = require("express");
const passport = require("passport");
const mongoose = require("mongoose");
const { randomToken, sha256 } = require("../utils/cryptoUtil");
const { signAccessToken } = require("../utils/tokenUtil");
const { permToLabels } = require("../utils/permLabels");
const { toIpHash } = require("../utils/ipHash");
const { AdminUser, RefreshToken, AuthCode, AdminInvite } = require("../models/admin");
const { requireAuth } = require("../middlewares/boAuth");
const { writeAuditLog } = require("../services/auditLogService");
const { createRateLimiter } = require("../services/rateLimiterFactory");
const { getRedisClient } = require("../services/redisClient");

const router = express.Router();

const REFRESH_GRACE_WINDOW_MS = Number(process.env.REFRESH_GRACE_WINDOW_MS || 10000);
const refreshLocks = new Map(); // in-process dedupe; distributed lock is attempted via Redis.

const oauthStartLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
});

const tokenExchangeLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 5,
});

const oauthCallbackLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
});

const refreshLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => {
    const rt = req.cookies?.bo_rt;
    if (rt) return `rt:${sha256(rt)}`;
    return `ip:${req.ip}`;
  },
});

const inviteLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
});

async function acquireDistributedRefreshLock(lockKey) {
  const redis = getRedisClient();
  if (!redis) return null;

  const lockValue = randomToken(16);
  const lockRedisKey = `bo:refresh-lock:${lockKey}`;
  const ok = await redis.set(lockRedisKey, lockValue, "PX", 15000, "NX");
  if (ok !== "OK") return null;
  return { redis, lockRedisKey, lockValue };
}

async function releaseDistributedRefreshLock(lock) {
  if (!lock?.redis) return;
  // Delete lock only if value matches (avoid deleting another owner's lock).
  const lua = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;
  try {
    await lock.redis.eval(lua, 1, lock.lockRedisKey, lock.lockValue);
  } catch (_e) {}
}

function parseDeviceInfo(userAgentRaw) {
  const ua = userAgentRaw || "";
  let os = "unknown";
  if (/iphone|ipad|ios/i.test(ua)) os = "ios";
  else if (/android/i.test(ua)) os = "android";
  else if (/windows/i.test(ua)) os = "windows";
  else if (/mac os x|macintosh/i.test(ua)) os = "macos";
  else if (/linux/i.test(ua)) os = "linux";

  let browser = "unknown";
  if (/edg\//i.test(ua)) browser = "edge";
  else if (/chrome\//i.test(ua) && !/edg\//i.test(ua)) browser = "chrome";
  else if (/safari\//i.test(ua) && !/chrome\//i.test(ua)) browser = "safari";
  else if (/firefox\//i.test(ua)) browser = "firefox";

  return { os, browser };
}

function getAllowedOrigins() {
  return (process.env.BO_ALLOWED_ORIGINS || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function checkRefreshCsrf(req) {
  const xrw = req.headers["x-requested-with"];
  const origin = req.headers.origin || "";
  const referer = req.headers.referer || "";
  const allowed = getAllowedOrigins();

  if (xrw !== "XMLHttpRequest") return false;
  if (!allowed.includes(origin)) return false;
  if (referer && !allowed.some((o) => referer.startsWith(o))) return false;
  return true;
}

function setRefreshCookie(res, rawToken) {
  res.cookie("bo_rt", rawToken, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/bo/auth/refresh",
    maxAge: 14 * 24 * 60 * 60 * 1000,
  });
}

function setOAuthStateCookie(res, state) {
  res.cookie("bo_oauth_state", state, {
    signed: true,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/bo/auth/google/callback",
    maxAge: 5 * 60 * 1000,
  });
}

function clearOAuthStateCookie(res) {
  res.clearCookie("bo_oauth_state", { path: "/bo/auth/google/callback" });
}

function verifyOAuthState(req, res, next) {
  const cookieState = req.signedCookies?.bo_oauth_state;
  const queryState = typeof req.query?.state === "string" ? req.query.state : "";
  if (!cookieState || !queryState || cookieState !== queryState) {
    clearOAuthStateCookie(res);
    return res.redirect(`${process.env.BO_FRONTEND_URL}/?reason=oauth_state_invalid`);
  }
  clearOAuthStateCookie(res);
  next();
}

router.get("/google", oauthStartLimiter, (req, res, next) => {
  const state = randomToken(16);
  setOAuthStateCookie(res, state);
  passport.authenticate("google", {
    session: false,
    state,
    scope: ["openid", "email", "profile"],
  })(req, res, next);
});

router.get(
  "/google/callback",
  oauthCallbackLimiter,
  verifyOAuthState,
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${process.env.BO_FRONTEND_URL}/?reason=oauth_failed`,
  }),
  async (req, res) => {
    const user = req.user;
    res.clearCookie("bo_invite_token", { path: "/" });

    const code = randomToken(16);
    await AuthCode.create({
      codeHash: sha256(code),
      userId: user._id,
      expiresAt: new Date(Date.now() + 30 * 1000),
    });

    return res.redirect(`${process.env.BO_FRONTEND_URL}/auth/callback?code=${code}`);
  }
);

router.post("/token-exchange", tokenExchangeLimiter, async (req, res) => {
  const { code } = req.body || {};
  if (!code) return res.status(401).json({ code: "UNAUTHORIZED" });

  const doc = await AuthCode.findOneAndUpdate(
    {
      codeHash: sha256(code),
      usedAt: null,
      expiresAt: { $gt: new Date() },
    },
    { $set: { usedAt: new Date() } },
    { new: true }
  );
  if (!doc) return res.status(401).json({ code: "UNAUTHORIZED" });

  const rt = randomToken(32);
  const tokenHash = sha256(rt);
  const userAgent = req.headers["user-agent"] || "";
  const parsed = parseDeviceInfo(userAgent);
  await RefreshToken.create({
    userId: doc.userId,
    tokenHash,
    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    deviceInfo: {
      userAgent,
      os: parsed.os,
      browser: parsed.browser,
      ipHash: toIpHash(
        req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || ""
      ),
      lastSeenAt: new Date(),
    },
  });

  setRefreshCookie(res, rt);
  const accessToken = signAccessToken(doc.userId);
  return res.json({ accessToken });
});

router.get("/invite/:token", inviteLimiter, async (req, res) => {
  const token = req.params.token;
  const invite = await AdminInvite.findOne({ tokenHash: sha256(token) });
  if (!invite) {
    return res.redirect(`${process.env.BO_FRONTEND_URL}/?reason=invite_invalid`);
  }
  if (invite.expiresAt < new Date()) {
    if (invite.status === "pending") {
      invite.status = "expired";
      await invite.save();
    }
    return res.redirect(`${process.env.BO_FRONTEND_URL}/?reason=invite_invalid`);
  }
  if (invite.status !== "pending") {
    return res.redirect(`${process.env.BO_FRONTEND_URL}/?reason=invite_invalid`);
  }

  res.cookie("bo_invite_token", token, {
    signed: true,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60 * 1000,
  });

  return res.redirect(`${process.env.BO_BACKEND_URL}/bo/auth/google`);
});

async function rotateRefresh(rawRt, req) {
  const now = Date.now();
  const tokenHash = sha256(rawRt);
  const session = await mongoose.startSession();
  let newRawRt;
  let userId;
  try {
    await session.withTransaction(async () => {
      // Atomic lock by tokenHash: only one request can revoke+own this token.
      const lockedOld = await RefreshToken.findOneAndUpdate(
        {
          tokenHash,
          revoked: false,
          expiresAt: { $gt: new Date(now) },
        },
        { $set: { revoked: true, revokedAt: new Date() } },
        { session, new: true }
      );
      if (!lockedOld) throw new Error("REFRESH_TOKEN_RACE_LOST");

      const user = await AdminUser.findById(lockedOld.userId).session(session);
      if (!user || !user.isActive) throw new Error("ACCOUNT_INACTIVE");

      newRawRt = randomToken(32);
      const newHash = sha256(newRawRt);
      const userAgent = req.headers["user-agent"] || "";
      const parsed = parseDeviceInfo(userAgent);

      const created = await RefreshToken.create(
        [
          {
            userId: lockedOld.userId,
            tokenHash: newHash,
            expiresAt: new Date(now + 14 * 24 * 60 * 60 * 1000),
            deviceInfo: {
              userAgent,
              os: parsed.os,
              browser: parsed.browser,
              ipHash: toIpHash(
                req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || ""
              ),
            },
          },
        ],
        { session }
      ).then((arr) => arr[0]);

      await RefreshToken.updateOne(
        { _id: lockedOld._id },
        { $set: { replacedByTokenId: created._id } },
        { session }
      );

      userId = String(lockedOld.userId);
    });
  } catch (e) {
    if (e.message === "ACCOUNT_INACTIVE") return { error: "ACCOUNT_INACTIVE" };
    if (e.message === "REFRESH_TOKEN_RACE_LOST") {
      // No token issuance happened. Safely classify current token state.
      const current = await RefreshToken.findOne({ tokenHash });
      if (!current) return { error: "REFRESH_TOKEN_INVALID" };
      if (current.expiresAt.getTime() < now) return { error: "REFRESH_TOKEN_EXPIRED" };
      if (!current.revoked) return { error: "REFRESH_TOKEN_INVALID_OR_USED" };

      const elapsed = now - new Date(current.revokedAt || 0).getTime();
      if (elapsed <= REFRESH_GRACE_WINDOW_MS) return { error: "REFRESH_TOKEN_REVOKED" };

      await RefreshToken.updateMany(
        { userId: current.userId, revoked: false },
        { $set: { revoked: true, revokedAt: new Date() } }
      );
      await writeAuditLog({
        actorUserId: current.userId,
        targetUserId: current.userId,
        action: "REFRESH_TOKEN_REUSE_DETECTED",
        before: { tokenId: String(current._id) },
        after: { revokedAllTokens: true },
        req,
      });
      return { error: "REFRESH_TOKEN_REUSE_DETECTED" };
    }
    throw e;
  } finally {
    await session.endSession();
  }

  return { accessToken: signAccessToken(userId), refreshToken: newRawRt };
}

router.post("/refresh", refreshLimiter, async (req, res) => {
  if (!checkRefreshCsrf(req)) return res.status(401).json({ code: "CSRF_BLOCKED" });

  const rawRt = req.cookies.bo_rt;
  if (!rawRt) return res.status(401).json({ code: "REFRESH_TOKEN_INVALID" });

  const lockKey = sha256(rawRt);
  let distLock = null;
  if (refreshLocks.has(lockKey)) {
    try {
      const result = await refreshLocks.get(lockKey);
      if (result.error) return res.status(401).json({ code: result.error });
      setRefreshCookie(res, result.refreshToken);
      return res.json({ accessToken: result.accessToken });
    } catch {
      return res.status(401).json({ code: "REFRESH_TOKEN_INVALID" });
    }
  }

  try {
    distLock = await acquireDistributedRefreshLock(lockKey);
  } catch (_e) {}
  if (getRedisClient() && !distLock) {
    // Another instance is likely rotating this token right now.
    return res.status(401).json({ code: "REFRESH_TOKEN_REVOKED" });
  }

  const p = rotateRefresh(rawRt, req).finally(async () => {
    refreshLocks.delete(lockKey);
    await releaseDistributedRefreshLock(distLock);
  });
  refreshLocks.set(lockKey, p);

  try {
    const result = await p;
    if (result.error) return res.status(401).json({ code: result.error });

    setRefreshCookie(res, result.refreshToken);
    return res.json({ accessToken: result.accessToken });
  } catch {
    return res.status(401).json({ code: "REFRESH_TOKEN_INVALID" });
  }
});

router.post("/logout", async (req, res) => {
  // Intentionally allow logout without requireAuth:
  // access token can be expired while refresh cookie still needs revocation.
  const rawRt = req.cookies.bo_rt;
  if (rawRt) {
    await RefreshToken.updateOne(
      { tokenHash: sha256(rawRt), revoked: false },
      { $set: { revoked: true, revokedAt: new Date() } }
    );
  }
  res.clearCookie("bo_rt", { path: "/bo/auth/refresh" });
  return res.status(200).json({ ok: true });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await AdminUser.findById(req.auth.userId).lean();
  return res.json({
    id: String(user._id),
    email: user.email,
    name: user.name,
    isSuperAdmin: user.isSuperAdmin,
    isActive: user.isActive,
    perm: user.perm,
    permLabels: permToLabels(user.perm),
  });
});

module.exports = router;
