import Redis from 'ioredis';
import logger from '../utils/logger';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  commandTimeout: 5000,
  retryStrategy: (times) => {
    const delay = Math.min(times * 1000, 3000);
    logger.info(`Retrying Redis connection in ${delay}ms...`);
    return delay;
  }
});

redis.on('error', (error) => {
  logger.error('Redis connection error:', error);
});

redis.on('connect', () => {
  logger.info('Successfully connected to Redis');
});

export { redis };