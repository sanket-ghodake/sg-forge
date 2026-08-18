interface RateLimitData {
  count: number;
  resetTime: number;
}

const stores = new Map<string, Map<string, RateLimitData>>();

let redisClient: any = null;
let isRedisAvailable = false;

if (process.env.REDIS_URL) {
  try {
    // Use require() to avoid Turbopack/webpack static analysis failures
    // when ioredis is not installed in the current package's node_modules.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Redis = require("ioredis");
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      showFriendlyErrorStack: false,
    });

    redisClient.on("error", (err: any) => {
      if (isRedisAvailable) {
        console.warn("Redis rate-limiter disconnected. Falling back to memory:", err.message);
        isRedisAvailable = false;
      }
    });

    redisClient.on("ready", () => {
      isRedisAvailable = true;
    });
  } catch (err: any) {
    console.warn("ioredis not available, using in-memory rate limiter:", err.message);
  }
}

export async function isRateLimited(
  ip: string,
  namespace: string,
  limit: number = 5,
  windowMs: number = 60000,
): Promise<{ limited: boolean; current: number; limit: number; resetTime: number }> {
  if (isRedisAvailable && redisClient) {
    try {
      const key = `rl:${namespace}:${ip}`;
      const multi = redisClient.multi();
      multi.incr(key);
      multi.pttl(key);

      const results = await multi.exec();
      if (results && results.length === 2) {
        const countErr = results[0][0];
        const countVal = results[0][1] as number;
        const ttlErr = results[1][0];
        let ttlVal = results[1][1] as number;

        if (!countErr && !ttlErr) {
          if (countVal === 1 || ttlVal < 0) {
            await redisClient.pexpire(key, windowMs);
            ttlVal = windowMs;
          }

          const now = Date.now();
          const resetTime = now + (ttlVal > 0 ? ttlVal : windowMs);

          if (countVal > limit) {
            return { limited: true, current: countVal - 1, limit, resetTime };
          }
          return { limited: false, current: countVal, limit, resetTime };
        }
      }
    } catch (err: any) {
      console.warn("Redis rate limit check failed. Falling back to memory:", err.message);
    }
  }

  let store = stores.get(namespace);
  if (!store) {
    store = new Map<string, RateLimitData>();
    stores.set(namespace, store);
  }

  const now = Date.now();

  if (store.size > 1000) {
    for (const [key, val] of store.entries()) {
      if (now >= val.resetTime) {
        store.delete(key);
      }
    }
    if (store.size > 2000) {
      store.clear();
    }
  }

  let data = store.get(ip);

  if (!data || now >= data.resetTime) {
    data = { count: 1, resetTime: now + windowMs };
    store.set(ip, data);
    return { limited: false, current: 1, limit, resetTime: data.resetTime };
  }

  if (data.count >= limit) {
    return { limited: true, current: data.count, limit, resetTime: data.resetTime };
  }

  data.count++;
  return { limited: false, current: data.count, limit, resetTime: data.resetTime };
}
