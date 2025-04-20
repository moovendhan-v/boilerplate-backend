import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

/**
 * Express middleware for logging HTTP requests and responses
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  // Capture original methods to intercept (only for send and json)
  const originalSend = res.send;
  const originalJson = res.json;
  
  // Create response time tracking
  const startTime = Date.now();
  
  // Log request details
  logger.info('Request received', {
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    headers: {
      'user-agent': req.headers['user-agent'],
      'content-type': req.headers['content-type']
    }
  });

  // Use event listener for logging response completion
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    logger.info('Response completed', {
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      contentLength: res.getHeader('content-length'),
      contentType: res.getHeader('content-type')
    });
  });
  
  // Wrap response methods to log response details
  res.send = function(body: any): Response {
    logger.info('Response send called', {
      statusCode: res.statusCode,
      bodyLength: body ? String(body).length : 0
    });
    return originalSend.call(this, body);
  };
  
  res.json = function(body: any): Response {
    logger.info('Response json called', {
      statusCode: res.statusCode,
      bodyType: typeof body
    });
    return originalJson.call(this, body);
  };
  
  next();
};

/**
 * Express middleware for handling errors
 */
export const errorLogger = (err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error('Request error', {
    method: req.method,
    path: req.path,
    error: {
      message: err.message,
      stack: err.stack,
      code: err.code || 'UNKNOWN_ERROR',
      status: err.status || 500
    }
  });
  
  // Send appropriate error response
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
      code: err.code || 'INTERNAL_SERVER_ERROR'
    }
  });
};