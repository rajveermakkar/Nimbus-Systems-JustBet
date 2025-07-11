const Redis = require('ioredis');

// Redis configuration for cloud deployment
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  // SSL configuration for cloud providers
  tls: process.env.REDIS_SSL === 'true' ? {} : undefined,
};

// Create Redis client
const redis = new Redis(redisConfig);

// Handle connection events
redis.on('connect', () => {
  console.log('*** Redis connected successfully ***');
});

redis.on('error', (error) => {
  console.error('X Redis connection error:', error.message);
});

redis.on('ready', () => {
  console.log('--Redis is ready to accept commands--');
});

redis.on('close', () => {
  console.log('X Redis connection closed X');
});

// Helper functions for auction caching
const auctionCache = {
  // Get cached data with timing
  async get(key) {
    const startTime = Date.now();
    try {
      const cached = await redis.get(key);
      const duration = Date.now() - startTime;
      if (cached) {
        console.log(`[REDIS] ${key} - CACHE HIT (${duration}ms)`);
        return JSON.parse(cached);
      } else {
        console.log(`[REDIS] ${key} - CACHE MISS (${duration}ms)`);
        return null;
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[REDIS] ${key} - ERROR (${duration}ms):`, error);
      return null;
    }
  },

  // Set cached data with TTL and timing
  async set(key, data, ttl = 30) {
    const startTime = Date.now();
    try {
      await redis.setex(key, ttl, JSON.stringify(data));
      const duration = Date.now() - startTime;
      console.log(`[REDIS] ${key} - CACHE SET (${duration}ms)`);
      return true;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[REDIS] ${key} - SET ERROR (${duration}ms):`, error);
      return false;
    }
  },

  // Delete cache key with timing
  async del(key) {
    const startTime = Date.now();
    try {
      await redis.del(key);
      const duration = Date.now() - startTime;
      console.log(`[REDIS] ${key} - CACHE DEL (${duration}ms)`);
      return true;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[REDIS] ${key} - DEL ERROR (${duration}ms):`, error);
      return false;
    }
  },

  // Delete multiple keys with timing
  async delMultiple(keys) {
    const startTime = Date.now();
    try {
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      const duration = Date.now() - startTime;
      console.log(`[REDIS] Multiple keys - CACHE DEL (${duration}ms)`);
      return true;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[REDIS] Multiple keys - DEL ERROR (${duration}ms):`, error);
      return false;
    }
  },

  // Get TTL for a key with timing
  async getTTL(key) {
    const startTime = Date.now();
    try {
      const ttl = await redis.ttl(key);
      const duration = Date.now() - startTime;
      console.log(`[REDIS] ${key} - TTL CHECK (${duration}ms)`);
      return ttl;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[REDIS] ${key} - TTL ERROR (${duration}ms):`, error);
      return -1;
    }
  },

  // Check if Redis is connected
  isConnected() {
    return redis.status === 'ready';
  }
};

module.exports = {
  redis,
  auctionCache
}; 