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
    me: async (_: any, __: any, { user }: Context) => {
      logger.info('[User Resolver] Fetching current user', { userId: user?.id });
      if (!user) {
        logger.warn('[User Resolver] Unauthenticated access attempt');
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }
      return await userService.findUserById(user.id);
    },
    user: async (_: any, { id }: { id: string }, { user }: Context) => {
      logger.info('[User Resolver] Fetching user by ID', { requestedId: id, requesterId: user?.id });
      if (!user) {
        logger.warn('[User Resolver] Unauthenticated access attempt');
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }
      return await userService.findUserById(id);
    },
    users: async (_: any, { first, after }: { first: number; after?: string }, { user }: Context) => {
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
    // createUser: async (_: any, { input }: { input: CreateUserInput }) => {
    //   logger.info('[User Resolver] Create user attempt', {
    //     email: input.email,
    //     name: input.name,
    //     role: input.role || 'USER'
    //   });
    //   const result = await authService.signup(input);
    //   logger.info('[User Resolver] User created successfully', {
    //     userId: result.user.id,
    //     email: result.user.email
    //   });
    //   return result;
    // },
    login: async (_: any, { input }: { input: LoginInput }) => {
      logger.info('[User Resolver] Login attempt', { email: input.email });
      const result = await userService.login(input);
      logger.info('[User Resolver] Login successful', { 
        userId: result.user.id,
        email: input.email 
      });
      return result;
    },
    updateProfile: async (_: any, { input }: { input: UpdateProfileInput }, { user }: Context) => {
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
    changePassword: async (_: any, { input }: { input: ChangePasswordInput }, { user }: Context) => {
      logger.info('[User Resolver] Password change attempt', { userId: user?.id });
      if (!user) {
        logger.warn('[User Resolver] Unauthenticated password change attempt');
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }
      return await userService.changePassword(user.id, input);
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