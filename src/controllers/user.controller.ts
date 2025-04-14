import { UserService } from '../services/user.service';
import { Context } from '../types/context';
import { HttpStatus, ErrorCode, createError } from '../utils/errors';

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

export class UserController {
  private service: UserService;

  constructor() {
    this.service = new UserService();
  }

  async getMe(user: Context['user']) {
    if (!user) {
      throw createError(
        'Not authenticated',
        HttpStatus.UNAUTHORIZED,
        ErrorCode.UNAUTHORIZED
      ).toGraphQLError();
    }
    return await this.service.findUserById(user.id);
  }

  async getUser(id: string, user: Context['user']) {
    if (!user) {
      throw createError(
        'Not authenticated',
        HttpStatus.UNAUTHORIZED,
        ErrorCode.UNAUTHORIZED
      ).toGraphQLError();
    }
    return await this.service.findUserById(id);
  }

  async getUsers(params: { first: number; after?: string }, user: Context['user']) {
    if (!user || user.role !== 'ADMIN') {
      throw createError(
        'Not authorized',
        HttpStatus.FORBIDDEN,
        ErrorCode.FORBIDDEN,
        { userId: user?.id, action: 'list_users' }
      ).toGraphQLError();
    }
    return await this.service.findUsers(params);
  }

  async signup(input: SignupInput) {
    try {
      return await this.service.signup(input);
    } catch (error: any) {
      throw createError(
        'Failed to signup',
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.INTERNAL_SERVER_ERROR,
        { details: error.message }
      ).toGraphQLError();
    }
  }

  async createUser(input: CreateUserInput) {
    try {
      return await this.service.createUser(input);
    } catch (error: any) {
      throw createError(
        'Failed to create user',
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.INTERNAL_SERVER_ERROR,
        { details: error.message }
      ).toGraphQLError();
    }
  }

  async login(input: LoginInput) {
    try {
      return await this.service.login(input);
    } catch (error: any) {
      throw createError(
        'Failed to login',
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.INTERNAL_SERVER_ERROR,
        { details: error.message }
      ).toGraphQLError();
    }
  }

  async updateProfile(input: UpdateProfileInput, user: Context['user']) {
    if (!user) {
      throw createError(
        'Not authenticated',
        HttpStatus.UNAUTHORIZED,
        ErrorCode.UNAUTHORIZED
      ).toGraphQLError();
    }
    try {
      return await this.service.updateProfile(user.id, input);
    } catch (error: any) {
      throw createError(
        'Failed to update profile',
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.INTERNAL_SERVER_ERROR,
        { userId: user.id, details: error.message }
      ).toGraphQLError();
    }
  }

  async changePassword(input: ChangePasswordInput, user: Context['user']) {
    if (!user) {
      throw createError(
        'Not authenticated',
        HttpStatus.UNAUTHORIZED,
        ErrorCode.UNAUTHORIZED
      ).toGraphQLError();
    }
    try {
      return await this.service.changePassword(user.id, input);
    } catch (error: any) {
      throw createError(
        'Failed to change password',
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.INTERNAL_SERVER_ERROR,
        { userId: user.id, details: error.message }
      ).toGraphQLError();
    }
  }

  async getBoilerplates(userId: string) {
    return await this.service.getUserBoilerplates(userId);
  }

  async getLikedBoilerplates(userId: string) {
    return await this.service.getLikedBoilerplates(userId);
  }
}