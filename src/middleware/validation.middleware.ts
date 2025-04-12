import { Request, Response, NextFunction } from 'express';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';

export const validateRequest = (type: any) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const dtoObject = plainToClass(type, req.body);
    const errors = await validate(dtoObject);

    if (errors.length > 0) {
      const validationErrors = errors.map(error => ({
        property: error.property,
        constraints: error.constraints
      }));

      return res.status(400).json({
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    req.body = dtoObject;
    next();
  };
};

export const validateQueryParams = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.query);
    if (error) {
      return res.status(400).json({
        message: 'Invalid query parameters',
        errors: error.details.map((detail: any) => detail.message)
      });
    }
    next();
  };
};