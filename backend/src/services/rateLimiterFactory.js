const rateLimit = require("express-rate-limit");
const { getRedisClient } = require("./redisClient");

let RedisStore = null;
let warnedMissingStore = false;

function getRedisStoreCtor() {
  if (RedisStore) return RedisStore;
  try {
    ({ RedisStore } = require("rate-limit-redis"));
    return RedisStore;
  } catch (_e) {
    if (!warnedMissingStore) {
      warnedMissingStore = true;
      console.warn(
        "[WARN] rate-limit-redis is not installed. Falling back to in-memory rate limiter."
      );
    }
    return null;
  }
}

function createRateLimiter({
  windowMs,
  max,
  keyGenerator,
  code = "TOO_MANY_REQUESTS",
  message = "Too Many Requests",
}) {
  const redis = getRedisClient();
  const Ctor = redis ? getRedisStoreCtor() : null;

  const base = {
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    handler: (_req, res) => {
      return res.status(429).json({ code, message });
    },
  };

  if (!redis || !Ctor) return rateLimit(base);

  return rateLimit({
    ...base,
    store: new Ctor({
      sendCommand: (...args) => redis.call(...args),
    }),
  });
}

module.exports = { createRateLimiter };

