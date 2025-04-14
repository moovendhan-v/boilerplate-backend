import { Resolver, Query, Mutation, Arg, Ctx, Authorized, FieldResolver, Root } from 'type-graphql';
import { UserController } from '../controllers/user.controller';
import { User, UserConnection, Boilerplate, AuthPayload, Context } from '../types';
import logger from '../utils/logger';

const controller = new UserController();

@Resolver()
export class UserResolver {
  @Query(() => User)
  async me(@Ctx() { user }: Context) {
    logger.info('[UserResolver] Fetching current user', { userId: user?.id });
    try {
      const result = await controller.getMe(user);
      logger.info('[UserResolver] Successfully fetched current user', { userId: user?.id });
      return result;
    } catch (error) {
      logger.error('[UserResolver] Failed to fetch current user', { 
        userId: user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  @Query(() => User)
  @Authorized()
  async user(@Arg('id') id: string, @Ctx() { user }: Context) {
    logger.info('[UserResolver] Fetching user by ID', { userId: id, requesterId: user?.id });
    try {
      const result = await controller.getUser(id, user);
      logger.info('[UserResolver] Successfully fetched user', { userId: id });
      return result;
    } catch (error) {
      logger.error('[UserResolver] Failed to fetch user', { 
        userId: id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  @Query(() => UserConnection)
  @Authorized('ADMIN')
  async users(
    @Ctx() { user }: Context,
    @Arg('first') first: number,
    @Arg('after', { nullable: true }) after?: string
  ) {
    logger.info('[UserResolver] Fetching users list', { 
      requesterId: user?.id,
      first,
      after
    });
    try {
      const result = await controller.getUsers({ first, after }, user);
      logger.info('[UserResolver] Successfully fetched users list', { 
        count: result.totalCount
      });
      return result;
    } catch (error) {
      logger.error('[UserResolver] Failed to fetch users list', { 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  @Mutation(() => AuthPayload)
  async signup(
    @Arg('email') email: string,
    @Arg('password') password: string,
    @Arg('name', { nullable: true }) name?: string
  ) {
    logger.info('[UserResolver] Creating new user', { email });
    try {
      const result = await controller.signup({ email, password, name });
      logger.info('[UserResolver] Successfully created new user', { email });
      return result;
    } catch (error) {
      logger.error('[UserResolver] Failed to create new user', { 
        email,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  @Mutation(() => User)
  // @Authorized('ADMIN')
  async createUser(
    @Arg('email') email: string,
    @Arg('password') password: string,
    @Arg('name', { nullable: true }) name?: string,
    @Arg('role', { nullable: true }) role?: string
  ) {
    logger.info('[UserResolver] Creating user (admin)', { email, role });
    try {
      const result = await controller.createUser({ email, password, name, role });
      logger.info('[UserResolver] Successfully created user (admin)', { email, role });
      return result;
    } catch (error) {
      logger.error('[UserResolver] Failed to create user (admin)', { 
        email,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  @Mutation(() => AuthPayload)
  async login(
    @Arg('email') email: string,
    @Arg('password') password: string
  ) {
    logger.info('[UserResolver] User login attempt', { email });
    try {
      const result = await controller.login({ email, password });
      logger.info('[UserResolver] Successful login', { email });
      return result;
    } catch (error) {
      logger.error('[UserResolver] Failed login attempt', { 
        email,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  @Mutation(() => User)
  @Authorized()
  async updateProfile(
    @Ctx() { user }: Context,
    @Arg('name', { nullable: true }) name?: string,
    @Arg('email', { nullable: true }) email?: string
  ) {
    logger.info('[UserResolver] Updating user profile', { 
      userId: user?.id,
      updates: { name, email }
    });
    try {
      const result = await controller.updateProfile({ name, email }, user);
      logger.info('[UserResolver] Successfully updated user profile', { userId: user?.id });
      return result;
    } catch (error) {
      logger.error('[UserResolver] Failed to update user profile', { 
        userId: user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  @Mutation(() => User)
  @Authorized()
  async changePassword(
    @Arg('currentPassword') currentPassword: string,
    @Arg('newPassword') newPassword: string,
    @Ctx() { user }: Context
  ) {
    logger.info('[UserResolver] Changing user password', { userId: user?.id });
    try {
      const result = await controller.changePassword({ currentPassword, newPassword }, user);
      logger.info('[UserResolver] Successfully changed user password', { userId: user?.id });
      return result;
    } catch (error) {
      logger.error('[UserResolver] Failed to change user password', { 
        userId: user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  @FieldResolver(() => [Boilerplate])
  async boilerplates(@Root() user: User) {
    logger.info('[UserResolver] Fetching user boilerplates', { userId: user.id });
    try {
      const result = await controller.getBoilerplates(user.id);
      logger.info('[UserResolver] Successfully fetched user boilerplates', { 
        userId: user.id,
        count: result.length
      });
      return result;
    } catch (error) {
      logger.error('[UserResolver] Failed to fetch user boilerplates', { 
        userId: user.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  @FieldResolver(() => [Boilerplate])
  async likedBoilerplates(@Root() user: User) {
    logger.info('[UserResolver] Fetching user liked boilerplates', { userId: user.id });
    try {
      const result = await controller.getLikedBoilerplates(user.id);
      logger.info('[UserResolver] Successfully fetched user liked boilerplates', { 
        userId: user.id,
        count: result.length
      });
      return result;
    } catch (error) {
      logger.error('[UserResolver] Failed to fetch user liked boilerplates', { 
        userId: user.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
}