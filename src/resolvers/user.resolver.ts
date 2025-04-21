import {
  Resolver,
  Query,
  Mutation,
  Args,
  Context,
  ObjectType,
  Field,
  ID,
} from "@nestjs/graphql";
import { UserService } from "../services/user.service";
import { AuthService } from "../services/auth.service";
import {
  AuthenticationError,
  AuthorizationError,
  CustomError,
  ErrorCode,
} from "../utils/errorHandler";
import { Authenticated } from "../decorator/Auth";
import { User as UserContext } from "../types/context";
import { Context as AppContext } from "../types/context";

@ObjectType()
export class User {
  @Field(() => ID)
  id: string;

  @Field()
  email: string;

  @Field({ nullable: true })
  name?: string;

  @Field()
  role: string;

  @Field()
  createdAt: string;

  @Field()
  updatedAt: string;

  constructor(data: Partial<User> = {}) {
    Object.assign(this, data);
    this.id = data.id || "";
    this.email = data.email || "";
    this.role = data.role || "";
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }
}

const userService = new UserService();
const authService = new AuthService();

@Resolver(() => User)
export class UserResolver {
  static instance = new UserResolver();

  @Query(() => User, { nullable: true })
  async me(@Context() context: AppContext) {
    const { user } = context;
    if (!user) throw new AuthenticationError();
    return await userService.findUserById(user.sub);
  }

  @Query(() => User, { nullable: true })
  async user(@Args("id") id: string, @Context() context: AppContext) {
    const { user } = context;
    if (!user) throw new AuthenticationError();
    return await userService.findUserById(id);
  }

  @Query(() => [User])
  @Authenticated()
  async users(
    @Args("first") first: number,
    @Args("after", { nullable: true }) after: string | undefined,
    @Context() context: AppContext
  ) {
    const { user } = context;
    if (!user || user.role !== "ADMIN") throw new AuthorizationError();
    return await userService.findUsers({ first, after });
  }

  @Mutation(() => User)
  async signup(
    @Args("input") input: { email: string; password: string; name?: string }
  ) {
    return await userService.signup(input);
  }

  @Mutation(() => Object)
  async login(
    @Args("input") input: { email: string; password: string },
    @Context() context: AppContext
  ) {
    const { res } = context;

    if (!res)
      throw new CustomError("Internal server error",
        ErrorCode.INTERNAL_SERVER_ERROR);

    const user = await authService.validateUser(input.email, input.password);
    if (!user) throw new AuthorizationError("Invalid email or password");

    const result = await authService.login(user, res);

    return {...result};
  }

  @Mutation(() => User)
  async updateProfile(
    @Args("input") input: { name?: string; email?: string },
    @Context() context: AppContext
  ) {
    const { user } = context;
    if (!user) throw new AuthenticationError();
    return await userService.updateProfile(user.sub, input);
  }

  @Mutation(() => User)
  async changePassword(
    @Args("input")
    input: {
      currentPassword: string;
      newPassword: string;
    },
    @Context() context: AppContext
  ) {
    const { user } = context;
    if (!user) throw new AuthenticationError();
    return await userService.changePassword(user.sub, input);
  }

  @Mutation(() => Object)
  async refreshToken(@Context() context: AppContext) {
    const { req, res } = context;
    const refreshToken = req?.cookies?.refreshToken;

    if (!res)
      throw new CustomError(
        "Internal server error",
        ErrorCode.INTERNAL_SERVER_ERROR
      );

    if (!refreshToken) throw new AuthorizationError("Refresh token not found");

    const result = await authService.refreshToken(refreshToken, res);
    return result;
  }

  @Mutation(() => Object)
  async logout(@Context() context: AppContext) {
    const { user, res } = context;
    if (!user || !res) throw new AuthenticationError();

    await authService.logout(user.sub, res);
    return {
      success: true,
      message: "Successfully logged out",
    };
  }

  @Query(() => [Object], { name: 'userBoilerplates' })
  async userBoilerplates(@Args("userId", { type: () => ID }) userId: string) {
    if (!userId) throw new CustomError("userId is required", ErrorCode.BAD_USER_INPUT);
    return await userService.getUserBoilerplates(userId);
  }

  @Query(() => [Object])
  async likedBoilerplates(@Args("userId", { type: () => ID }) userId: string) {
    if (!userId) throw new CustomError("userId is required", ErrorCode.BAD_USER_INPUT);
    return await userService.getLikedBoilerplates(userId);
  }
}

// Export the resolver object structure that server.ts expects
export const userResolvers = {
  Query: {
    me: (_: unknown, _args: unknown, context: AppContext) => UserResolver.instance.me(context),
    user: (_: unknown, args: { id: string }, context: AppContext) => UserResolver.instance.user(args.id, context),
    users: (_: unknown, args: { first: number; after: string | undefined }, context: AppContext) => UserResolver.instance.users(args.first, args.after, context),
    userBoilerplates: (_: unknown, args: { userId: string }) => UserResolver.instance.userBoilerplates(args.userId),
    likedBoilerplates: (_: unknown, args: { userId: string }) => UserResolver.instance.likedBoilerplates(args.userId)
  },
  Mutation: {
    signup: (
      _: unknown,
      args: { input: { email: string; password: string; name?: string } }
    ) => UserResolver.instance.signup(args.input),
    login: (
      _: unknown,
      args: { input: { email: string; password: string } },
      context: AppContext
    ) => UserResolver.instance.login(args.input, context),
    updateProfile: (
      _: unknown,
      args: { input: { name?: string; email?: string } },
      context: AppContext
    ) => UserResolver.instance.updateProfile(args.input, context),
    changePassword: (
      _: unknown,
      args: { input: { currentPassword: string; newPassword: string } },
      context: AppContext
    ) => UserResolver.instance.changePassword(args.input, context),
    refreshToken: (_: unknown, _args: unknown, context: AppContext) =>
      UserResolver.instance.refreshToken(context),
    logout: (_: unknown, _args: unknown, context: AppContext) =>
      UserResolver.instance.logout(context),
  },
  User: {
    // Add this field resolver
    boilerplates: (parent: User) => 
      UserResolver.instance.userBoilerplates(parent.id),
    
    // You should also add likedBoilerplates since it's defined in your schema
    likedBoilerplates: (parent: User) => 
      UserResolver.instance.likedBoilerplates(parent.id)
  },
};
