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
  // Get cached data
  async get(key) {
    try {
      const cached = await redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  },

  // Set cached data with TTL
  async set(key, data, ttl = 30) {
    try {
      await redis.setex(key, ttl, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Redis set error:', error);
      return false;
    }
  },

  // Delete cache key
  async del(key) {
    try {
      await redis.del(key);
      return true;
    } catch (error) {
      console.error('Redis del error:', error);
      return false;
    }
  },

  // Delete multiple keys
  async delMultiple(keys) {
    try {
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      return true;
    } catch (error) {
      console.error('Redis delMultiple error:', error);
      return false;
    }
  },

  // Get TTL for a key
  async getTTL(key) {
    try {
      return await redis.ttl(key);
    } catch (error) {
      console.error('Redis TTL error:', error);
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