import { UserService } from '../services/user.service';
import { GraphQLError } from 'graphql';
import { Context } from '../types/context';

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

export const userResolvers = {
  Query: {
    me: async (_: any, __: any, { user }: Context) => {
      if (!user) throw new GraphQLError('Not authenticated', {
        extensions: { code: 'UNAUTHENTICATED' }
      });
      return await userService.findUserById(user.id);
    },
    user: async (_: any, { id }: { id: string }, { user }: Context) => {
      if (!user) throw new GraphQLError('Not authenticated', {
        extensions: { code: 'UNAUTHENTICATED' }
      });
      return await userService.findUserById(id);
    },
    users: async (_: any, { first, after }: { first: number; after?: string }, { user }: Context) => {
      if (!user || user.role !== 'ADMIN') {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' }
        });
      }
      return await userService.findUsers({ first, after });
    },
  },

  Mutation: {
    signup: async (_: any, { input }: { input: SignupInput }) => {
      console.log('Signup attempt for user:', input.email);
      const result = await userService.signup(input);
      console.log('Signup successful for user:', input.email);
      return result;
    },
    createUser: async (_: any, { input }: { input: CreateUserInput }) => {
      console.log('Create user attempt:', {
        email: input.email,
        name: input.name,
        role: input.role || 'USER'
      });
      const result = await userService.createUser(input);
      console.log('User created successfully:', {
        id: result.user.id,
        email: result.user.email
      });
      return result;
    },
    login: async (_: any, { input }: { input: LoginInput }) => {
      console.log('Login attempt for user:', input.email);
      const result = await userService.login(input);
      console.log('Login successful for user:', input.email);
      return result;
    },
    updateProfile: async (_: any, { input }: { input: UpdateProfileInput }, { user }: Context) => {
      if (!user) throw new GraphQLError('Not authenticated', {
        extensions: { code: 'UNAUTHENTICATED' }
      });
      return await userService.updateProfile(user.id, input);
    },
    changePassword: async (_: any, { input }: { input: ChangePasswordInput }, { user }: Context) => {
      if (!user) throw new GraphQLError('Not authenticated', {
        extensions: { code: 'UNAUTHENTICATED' }
      });
      return await userService.changePassword(user.id, input);
    },
  },

  User: {
    boilerplates: async (parent: { id: string }) => {
      return await userService.getUserBoilerplates(parent.id);
    },
    likedBoilerplates: async (parent: { id: string }) => {
      return await userService.getLikedBoilerplates(parent.id);
    },
  },
};