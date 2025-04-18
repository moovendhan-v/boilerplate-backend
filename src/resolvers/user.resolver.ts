import { UserService } from '../services/user.service';
import { AuthService } from '../services/auth.service';
import { GraphQLError } from 'graphql';
import { Context } from '../types/context';
import logger from '../utils/logger';

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

export const userResolvers = {
  Query: {
    me: async (_: any, __: any, context: Context) => {
      const { user } = context;
      logger.info('[User Resolver] Fetching current user', { userId: user?.id });
      if (!user) {
        logger.warn('[User Resolver] Unauthenticated access attempt');
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }
      return await userService.findUserById(user.id);
    },
    user: async (_: any, { id }: { id: string }, context: Context) => {
      const { user } = context;
      logger.info('[User Resolver] Fetching user by ID', { requestedId: id, requesterId: user?.id });
      if (!user) {
        logger.warn('[User Resolver] Unauthenticated access attempt');
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }
      return await userService.findUserById(id);
    },
    users: async (_: any, { first, after }: { first: number; after?: string }, context: Context) => {
      const { user } = context;
      logger.info('[User Resolver] Fetching users list', { 
        requesterId: user?.id,
        requesterRole: user?.role,
        pagination: { first, after }
      });
      if (!user || user.role !== 'ADMIN') {
        logger.warn('[User Resolver] Unauthorized access attempt', { 
          userId: user?.id,
          role: user?.role 
        });
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' }
        });
      }
      return await userService.findUsers({ first, after });
    },
  },

  Mutation: {
    signup: async (_: any, { input }: { input: SignupInput }) => {
      logger.info('[User Resolver] Signup attempt', { email: input.email });
      const result = await userService.signup(input);
      logger.info('[User Resolver] Signup successful', { 
        userId: result.user.id,
        email: input.email 
      });
      return result;
    },
    login: async (_: any, { input }: { input: LoginInput }) => {
      logger.info('[User Resolver] Login attempt', { email: input.email });
      const result = await userService.login(input);
      logger.info('[User Resolver] Login successful', { 
        userId: result.user.id,
        email: input.email 
      });
      return result;
    },
    updateProfile: async (_: any, { input }: { input: UpdateProfileInput }, context: Context) => {
      const { user } = context;
      logger.info('[User Resolver] Profile update attempt', { 
        userId: user?.id,
        updates: input 
      });
      if (!user) {
        logger.warn('[User Resolver] Unauthenticated profile update attempt');
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }
      return await userService.updateProfile(user.id, input);
    },
    changePassword: async (_: any, { input }: { input: ChangePasswordInput }, context: Context) => {
      const { user } = context;
      logger.info('[User Resolver] Password change attempt', { userId: user?.id });
      if (!user) {
        logger.warn('[User Resolver] Unauthenticated password change attempt');
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }
      return await userService.changePassword(user.id, input);
    },
    refreshToken: async (_: any, __: any, context: Context) => {
      logger.info('[User Resolver] Token refresh attempt');

      const { req } = context;
      const refreshToken = req?.cookies?.refreshToken;
      
      if (!refreshToken) {
        logger.warn('[User Resolver] Refresh token missing in cookies');
        throw new GraphQLError('Refresh token not found', {
          extensions: { code: 'UNAUTHORIZED' },
        });
      }

      try {
        const result = await authService.refreshToken(refreshToken);
        logger.info('[User Resolver] Token refresh successful');
        return result;
      } catch (error) {
        logger.error('[User Resolver] Token refresh failed', { error });
        throw error;
      }
    },
    logout: async (_: any, __: any, context: Context) => {
      const { user, res } = context;
      logger.info('[User Resolver] Logout attempt', { userId: user?.id });
      
      if (!user || !res) {
        logger.warn('[User Resolver] Unauthenticated logout attempt');
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      await authService.logout(user.id, res);
      logger.info('[User Resolver] Logout successful', { userId: user.id });
      
      return {
        success: true,
        message: 'Successfully logged out'
      };
    },
  },

  User: {
    boilerplates: async (parent: { id: string }) => {
      logger.info('[User Resolver] Fetching user boilerplates', { userId: parent.id });
      return await userService.getUserBoilerplates(parent.id);
    },
    likedBoilerplates: async (parent: { id: string }) => {
      logger.info('[User Resolver] Fetching user liked boilerplates', { userId: parent.id });
      return await userService.getLikedBoilerplates(parent.id);
    },
  },
};