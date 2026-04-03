let redisClient = null;
let warnedMissingModule = false;

function getRedisClient() {
  if (redisClient) return redisClient;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  let Redis;
  try {
    // Optional dependency: production can enable Redis; dev can run without it.
    ({ default: Redis } = require("ioredis"));
  } catch (_e) {
    if (!warnedMissingModule) {
      warnedMissingModule = true;
      console.warn("[WARN] REDIS_URL is set but ioredis is not installed. Falling back to in-memory mode.");
    }
    return null;
  }

  redisClient = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
  });

  redisClient.on("error", (err) => {
    console.error("[ERROR] Redis client error:", err?.message || err);
  });

  redisClient.connect().catch((err) => {
    console.error("[ERROR] Redis connect failed:", err?.message || err);
  });

  return redisClient;
}

function getRedisMode() {
  if (!process.env.REDIS_URL) return "in-memory";
  const client = getRedisClient();
  return client ? "redis" : "in-memory";
}

module.exports = { getRedisClient, getRedisMode };
