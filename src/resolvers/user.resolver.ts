import { UserService } from "../services/user.service";
import { AuthService } from "../services/auth.service";
import { GraphQLError } from "graphql";
import { Context } from "../types/context";
import logger from "../utils/logger";
import { Args } from "@prisma/client/runtime/library";
import { redis } from '../config/redis';

interface SignupInput {
  email: string;
  password: string;
  name?: string;
}

interface CreateUserInput {
  email: string;
  password: string;
  name?: string;
  role?: string;
}

interface LoginInput {
  email: string;
  password: string;
}

interface UpdateProfileInput {
  name?: string;
  email?: string;
}

interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

const userService = new UserService();
const authService = new AuthService();

// Token expiration time in seconds (e.g., 7 days)
const REFRESH_TOKEN_EXPIRY = 60 * 60 * 24 * 7;

export const userResolvers = {
  Query: {
    me: async (_: any, __: any, context: Context) => {
      const { user } = context;
      logger.info("usercontext", user);
      logger.info("[User Resolver] Fetching current user", {
        userId: user?.sub,
      });
      if (!user) {
        logger.warn("[User Resolver] Unauthenticated access attempt");
        throw new GraphQLError("Not authenticated", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }
      return await userService.findUserById(user.sub);
    },
    user: async (_: any, { id }: { id: string }, context: Context) => {
      const { user } = context;
      logger.info("[User Resolver] Fetching user by ID", {
        requestedId: id,
        requesterId: user?.sub,
      });
      if (!user) {
        logger.warn("[User Resolver] Unauthenticated access attempt");
        throw new GraphQLError("Not authenticated", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }
      return await userService.findUserById(id);
    },
    users: async (
      _: any,
      { first, after }: { first: number; after?: string },
      context: Context
    ) => {
      const { user } = context;
      logger.info("[User Resolver] Fetching users list", {
        requesterId: user?.sub,
        requesterRole: user?.role,
        pagination: { first, after },
      });
      if (!user || user.role !== "ADMIN") {
        logger.warn("[User Resolver] Unauthorized access attempt", {
          userId: user?.sub,
          role: user?.role,
        });
        throw new GraphQLError("Not authorized", {
          extensions: { code: "FORBIDDEN" },
        });
      }
      return await userService.findUsers({ first, after });
    },
  },

  Mutation: {
    signup: async (_: any, { input }: { input: SignupInput }) => {
      logger.info("[User Resolver] Signup attempt", { email: input.email });
      const result = await userService.signup(input);
      logger.info("[User Resolver] Signup successful", {
        userId: result.user.id,
        email: input.email,
      });
      return result;
    },
    login: async (_: any, args: { input: LoginInput }, context: Context) => {
      const { input } = args;
      const { res } = context;
      
      logger.info('[User Resolver] Login attempt', { email: input.email });
      logger.info('[User Resolver] res type:', typeof res);
      logger.info('[User Resolver] res keys:', res && Object.keys(res));
      logger.info('[User Resolver] res.constructor.name:', res && res.constructor && res.constructor.name);

      // Check if res exists in context
      if (!res) {
        logger.error('[User Resolver] Response object missing in context');
        throw new GraphQLError('Internal server error', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' }
        });
      }
      
      // First validate the user
      const user = await authService.validateUser(input.email, input.password);
      
      if (!user) {
        logger.warn('[User Resolver] Login failed: Invalid credentials', { email: input.email });
        throw new GraphQLError('Invalid email or password', {
          extensions: { code: 'UNAUTHORIZED' }
        });
      }
      
      // Use the AuthService login method to generate tokens and set cookies
      const result = await authService.login(user, res);
      
      logger.info('[User Resolver] Login successful', { 
        userId: user.id,
        email: input.email 
      });
      
      return {
        token: result.token,
        refreshToken: result.refreshToken,
        user: result.user
      };
    },
    updateProfile: async (
      _: any,
      { input }: { input: UpdateProfileInput },
      context: Context
    ) => {
      const { user } = context;
      logger.info("[User Resolver] Profile update attempt", {
        userId: user?.sub,
        updates: input,
      });
      if (!user) {
        logger.warn("[User Resolver] Unauthenticated profile update attempt");
        throw new GraphQLError("Not authenticated", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }
      return await userService.updateProfile(user.sub, input);
    },
    changePassword: async (
      _: any,
      { input }: { input: ChangePasswordInput },
      context: Context
    ) => {
      const { user } = context;
      logger.info("[User Resolver] Password change attempt", {
        userId: user?.sub,
      });
      if (!user) {
        logger.warn("[User Resolver] Unauthenticated password change attempt");
        throw new GraphQLError("Not authenticated", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }
      return await userService.changePassword(user.sub, input);
    },
    refreshToken: async (_: any, __: any, context: Context) => {
      logger.info("[User Resolver] Token refresh attempt");

      const { req } = context;
      const refreshToken = req?.cookies?.refreshToken;

      if (!refreshToken) {
        logger.warn("[User Resolver] Refresh token missing in cookies");
        throw new GraphQLError("Refresh token not found", {
          extensions: { code: "UNAUTHORIZED" },
        });
      }

      try {
        const result = await authService.refreshToken(refreshToken);
        logger.info("[User Resolver] Token refresh successful");
        return result;
      } catch (error) {
        logger.error("[User Resolver] Token refresh failed", { error });
        throw error;
      }
    },
    logout: async (_: any, __: any, context: Context) => {
      const { user, res } = context;
      logger.info("[User Resolver] Logout attempt", { userId: user?.sub });

      if (!user || !res) {
        logger.warn("[User Resolver] Unauthenticated logout attempt");
        throw new GraphQLError("Not authenticated", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      await authService.logout(user.sub, res);
      logger.info("[User Resolver] Logout successful", { userId: user.sub });

      return {
        success: true,
        message: "Successfully logged out",
      };
    },
  },

  User: {
    boilerplates: async (parent: { id: string }) => {
      logger.info("[User Resolver] Fetching user boilerplates", {
        userId: parent.id,
      });
      return await userService.getUserBoilerplates(parent.id);
    },
    likedBoilerplates: async (parent: { id: string }) => {
      logger.info("[User Resolver] Fetching user liked boilerplates", {
        userId: parent.id,
      });
      return await userService.getLikedBoilerplates(parent.id);
    },
  },
};
