import { Request, Response, NextFunction } from 'express';
import { validate, ValidationError } from 'class-validator';
import { plainToClass } from 'class-transformer';
import logger from '../utils/logger';
import { Schema } from 'joi';

export const validateRequest = <T extends object>(type: new () => T) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const dtoObject = plainToClass(type, req.body);
    const errors = await validate(dtoObject);

    if (errors.length > 0) {
      const validationErrors = errors.map((error: ValidationError) => ({
        property: error.property,
        constraints: error.constraints
      }));

      logger.warn('[Validation Middleware] Request body validation failed', {
        path: req.path,
        method: req.method,
        errors: validationErrors
      });

      return res.status(400).json({
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    req.body = dtoObject;
    next();
  };
};

export const validateQueryParams = (schema: Schema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.query);
    if (error) {
      logger.warn('[Validation Middleware] Query parameters validation failed', {
        path: req.path,
        method: req.method,
        query: req.query,
        errors: error.details.map((detail: { message: string }) => detail.message)
      });

      return res.status(400).json({
        message: 'Invalid query parameters',
        errors: error.details.map((detail: { message: string }) => detail.message)
      });
    }
    next();
  };
};