import { STATUS_CODES } from '../utils/statusCode';

// Type for GraphQL error codes
export type GraphQLErrorCode = keyof typeof STATUS_CODES.GRAPHQL_ERROR;

// Type for HTTP status codes
export type HTTPStatusCode = 
  | keyof typeof STATUS_CODES.SUCCESS
  | keyof typeof STATUS_CODES.CLIENT_ERROR
  | keyof typeof STATUS_CODES.SERVER_ERROR;

// Interface for error response
export interface ErrorResponse {
  message: string;
  code: GraphQLErrorCode;
  status: number;
}

// Type guard to check if a string is a valid GraphQL error code
export const isGraphQLErrorCode = (code: string): code is GraphQLErrorCode => {
  return Object.keys(STATUS_CODES.GRAPHQL_ERROR).includes(code);
};

// Type guard to check if a string is a valid HTTP status code
export const isHTTPStatusCode = (code: string): code is HTTPStatusCode => {
  return (
    Object.keys(STATUS_CODES.SUCCESS).includes(code) ||
    Object.keys(STATUS_CODES.CLIENT_ERROR).includes(code) ||
    Object.keys(STATUS_CODES.SERVER_ERROR).includes(code)
  );
};