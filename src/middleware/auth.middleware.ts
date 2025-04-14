import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import logger from '../utils/logger';
import jwt from 'jsonwebtoken';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
      };
    }
  }
}

const authService = new AuthService();

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    logger.info('[Auth Middleware] Authentication attempt', { 
      hasAuthHeader: !!authHeader 
    });

    if (!authHeader) {
      logger.warn('[Auth Middleware] No authorization header');
      return next();
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      logger.warn('[Auth Middleware] No token in authorization header');
      return next();
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key') as {
        userId: string;
        email: string;
        role: string;
      };

      logger.info('[Auth Middleware] Token decoded successfully', { 
        userId: decoded.userId 
      });

      req.user = {
        id: decoded.userId,
        email: decoded.email,
        role: decoded.role
      };

      logger.info('[Auth Middleware] User attached to request', {
        user: req.user
      })

      next();
    } catch (error) {
      logger.warn('[Auth Middleware] Invalid token', { error });
      return next();
    }
  } catch (error) {
    logger.error('[Auth Middleware] Authentication error', { error });
    return next();
  }
};

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    logger.warn('[Auth Middleware] Authentication required but no user found');
    return res.status(401).json({ message: 'Authentication required' });
  }
  next();
};

export const authorize = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      logger.warn('[Auth Middleware] Authorization required but no user found');
      return res.status(401).json({ message: 'Authentication required' });
    }

    logger.info('[Auth Middleware] Checking authorization', { 
      userId: req.user.id,
      userRole: req.user.role,
      requiredRoles: roles 
    });

    if (roles.length && !roles.includes(req.user.role)) {
      logger.warn('[Auth Middleware] Insufficient permissions', { 
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: roles 
      });
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    logger.info('[Auth Middleware] Authorization successful', { 
      userId: req.user.id,
      role: req.user.role 
    });
    next();
  };
};
