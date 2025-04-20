// decorators/Auth.ts
import { AuthenticationError, AuthorizationError } from "../utils/errorHandler";
import logger from "../utils/logger";

export function Authenticated() {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const context = args[2];
      const info = args[3];

      if (!context.user) {
        logger.warn("[Auth Check] No authenticated user found", {
          operation: info.fieldName,
        });
        throw new AuthenticationError("Authentication required");
      }

      logger.info("[Auth Check] User is authenticated", {
        userId: context.user.sub,
        operation: info.fieldName,
      });

      return originalMethod.apply(this, args);
    };
  };
}

export function HasRole(role: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const context = args[2];
      const info = args[3];

      if (!context.user) {
        logger.warn("[Auth Check] No authenticated user found", {
          operation: info.fieldName,
        });
        throw new AuthenticationError("Authentication required");
      }

      if (context.user.role !== role) {
        logger.warn("[Auth Check] Unauthorized role access", {
          userId: context.user.sub,
          userRole: context.user.role,
          requiredRole: role,
          operation: info.fieldName,
        });
        throw new AuthorizationError(`Requires ${role} role`);
      }

      logger.info("[Auth Check] User has required role", {
        userId: context.user.sub,
        role: role,
        operation: info.fieldName,
      });

      return originalMethod.apply(this, args);
    };
  };
}
