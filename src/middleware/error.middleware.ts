import { Request, Response, NextFunction } from 'express';

export class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const timestamp = new Date().toISOString();
  const errorDetails = {
    timestamp,
    path: req.originalUrl,
    method: req.method,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    requestBody: req.body,
    requestQuery: req.query,
    requestParams: req.params,
  };

  console.error('Error Details:', JSON.stringify(errorDetails, null, 2));

  if (error instanceof HttpError) {
    return res.status(error.statusCode).json({
      message: error.message
    });
  }

  if (error.name === 'ValidationError') {
    return res.status(400).json({
      message: 'Validation Error',
      errors: error.message
    });
  }

  return res.status(500).json({
    message: 'Internal Server Error'
  });
};

export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  res.status(404).json({
    message: `Not Found - ${req.originalUrl}`
  });
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};