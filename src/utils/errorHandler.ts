import { GraphQLError } from 'graphql';
import { Prisma } from '@prisma/client';

// Status codes organized by category
export const STATUS_CODES = {
  SUCCESS: {
    OK: 200,
    CREATED: 201,
    ACCEPTED: 202,
    NO_CONTENT: 204,
  },
  CLIENT_ERROR: {
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    METHOD_NOT_ALLOWED: 405,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    TOO_MANY_REQUESTS: 429,
  },
  SERVER_ERROR: {
    INTERNAL_SERVER_ERROR: 500,
    NOT_IMPLEMENTED: 501,
    BAD_GATEWAY: 502,
    SERVICE_UNAVAILABLE: 503,
    GATEWAY_TIMEOUT: 504,
  },
};

// Error codes with their corresponding status codes
export enum ErrorCode {
  // Authentication Errors
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  UNAUTHORIZED = 'UNAUTHORIZED',
  
  // Client Errors
  BAD_REQUEST = 'BAD_REQUEST',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  CONFLICT = 'CONFLICT',
  
  // Business Logic Errors
  INVALID_OPERATION = 'INVALID_OPERATION',
  BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',
  
  // Server Errors
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  
  // GraphQL Specific Errors
  GRAPHQL_PARSE_FAILED = 'GRAPHQL_PARSE_FAILED',
  GRAPHQL_VALIDATION_FAILED = 'GRAPHQL_VALIDATION_FAILED',
  BAD_USER_INPUT = 'BAD_USER_INPUT'
}

// Error code to HTTP status code mapping
const errorStatusMap: Record<ErrorCode, number> = {
  [ErrorCode.UNAUTHENTICATED]: STATUS_CODES.CLIENT_ERROR.UNAUTHORIZED,
  [ErrorCode.UNAUTHORIZED]: STATUS_CODES.CLIENT_ERROR.FORBIDDEN,
  [ErrorCode.BAD_REQUEST]: STATUS_CODES.CLIENT_ERROR.BAD_REQUEST,
  [ErrorCode.NOT_FOUND]: STATUS_CODES.CLIENT_ERROR.NOT_FOUND,
  [ErrorCode.VALIDATION_ERROR]: STATUS_CODES.CLIENT_ERROR.UNPROCESSABLE_ENTITY,
  [ErrorCode.CONFLICT]: STATUS_CODES.CLIENT_ERROR.CONFLICT,
  [ErrorCode.INVALID_OPERATION]: STATUS_CODES.CLIENT_ERROR.BAD_REQUEST,
  [ErrorCode.BUSINESS_RULE_VIOLATION]: STATUS_CODES.CLIENT_ERROR.UNPROCESSABLE_ENTITY,
  [ErrorCode.INTERNAL_SERVER_ERROR]: STATUS_CODES.SERVER_ERROR.INTERNAL_SERVER_ERROR,
  [ErrorCode.DATABASE_ERROR]: STATUS_CODES.SERVER_ERROR.INTERNAL_SERVER_ERROR,
  [ErrorCode.SERVICE_UNAVAILABLE]: STATUS_CODES.SERVER_ERROR.SERVICE_UNAVAILABLE,
  [ErrorCode.GRAPHQL_PARSE_FAILED]: STATUS_CODES.CLIENT_ERROR.BAD_REQUEST,
  [ErrorCode.GRAPHQL_VALIDATION_FAILED]: STATUS_CODES.CLIENT_ERROR.BAD_REQUEST,
  [ErrorCode.BAD_USER_INPUT]: STATUS_CODES.CLIENT_ERROR.BAD_REQUEST
};

// Base custom error class
export class CustomError extends GraphQLError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.INTERNAL_SERVER_ERROR,
    additionalProps: Record<string, any> = {}
  ) {
    const status = errorStatusMap[code];
    super(message, {
      extensions: {
        code,
        status,
        timestamp: new Date().toISOString(),
        ...additionalProps
      },
    });
  }
}

// Specialized error classes
export class AuthenticationError extends CustomError {
  constructor(message: string = 'Authentication required') {
    super(message, ErrorCode.UNAUTHENTICATED);
  }
}

export class AuthorizationError extends CustomError {
  constructor(message: string = 'Not authorized') {
    super(message, ErrorCode.UNAUTHORIZED);
  }
}

export class ValidationError extends CustomError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, ErrorCode.VALIDATION_ERROR, { details });
  }
}

export class DatabaseError extends CustomError {
  constructor(message: string = 'Database operation failed') {
    super(message, ErrorCode.DATABASE_ERROR);
  }
}

// Error mapping functions
export const mapPrismaError = (error: any): CustomError => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2025':
        return new CustomError('Resource not found', ErrorCode.NOT_FOUND);
      case 'P2002':
        return new CustomError('Resource already exists', ErrorCode.CONFLICT);
      case 'P2014':
        return new CustomError('Invalid operation', ErrorCode.INVALID_OPERATION);
      case 'P2003':
        return new CustomError('Invalid input data', ErrorCode.VALIDATION_ERROR);
      default:
        return new DatabaseError(`Database error: ${error.message}`);
    }
  }
  return new CustomError(error.message || 'An unexpected error occurred', ErrorCode.INTERNAL_SERVER_ERROR);
};

// Type guards
export const isErrorCode = (code: string): code is ErrorCode => {
  return Object.values(ErrorCode).includes(code as ErrorCode);
};

// Helper function to handle any error type
export const handleError = (error: any): CustomError => {
  if (error instanceof CustomError) {
    return error;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return mapPrismaError(error);
  }
  return new CustomError(error.message || 'An unexpected error occurred', ErrorCode.INTERNAL_SERVER_ERROR);
};

// Error response interface
export interface ErrorResponse {
  message: string;
  code: ErrorCode;
  status: number;
  timestamp: string;
  details?: Record<string, any>;
}