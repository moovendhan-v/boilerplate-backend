import { GraphQLError } from 'graphql';

// Define error codes
export enum ErrorCode {
  // Authentication Errors
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  UNAUTHORIZED = 'UNAUTHORIZED',
  
  // Client Errors
  BAD_REQUEST = 'BAD_REQUEST',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  
  // Server Errors
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE'
}

// Define error messages
export const ErrorMessage = {
  [ErrorCode.UNAUTHENTICATED]: 'Not authenticated',
  [ErrorCode.UNAUTHORIZED]: 'Not authorized',
  [ErrorCode.BAD_REQUEST]: 'Bad request',
  [ErrorCode.NOT_FOUND]: 'Resource not found',
  [ErrorCode.VALIDATION_ERROR]: 'Validation error',
  [ErrorCode.INTERNAL_SERVER_ERROR]: 'Internal server error',
  [ErrorCode.DATABASE_ERROR]: 'Database error',
  [ErrorCode.SERVICE_UNAVAILABLE]: 'Service unavailable'
};

// Custom error class
export class CustomGraphQLError extends GraphQLError {
  constructor(message: string, code: ErrorCode) {
    super(message, {
      extensions: {
        code,
        timestamp: new Date().toISOString()
      }
    });
  }
}

// Error factory functions
export const createAuthError = (message?: string) => {
  return new CustomGraphQLError(
    message || ErrorMessage[ErrorCode.UNAUTHENTICATED],
    ErrorCode.UNAUTHENTICATED
  );
};

export const createValidationError = (message?: string) => {
  return new CustomGraphQLError(
    message || ErrorMessage[ErrorCode.VALIDATION_ERROR],
    ErrorCode.VALIDATION_ERROR
  );
};

export const createServerError = (message?: string) => {
  return new CustomGraphQLError(
    message || ErrorMessage[ErrorCode.INTERNAL_SERVER_ERROR],
    ErrorCode.INTERNAL_SERVER_ERROR
  );
};