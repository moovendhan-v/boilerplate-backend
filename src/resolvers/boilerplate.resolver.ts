import { Resolver, Query, Mutation, Arg, Ctx, Authorized, FieldResolver, Root } from 'type-graphql';
import { BoilerplateService } from '../services/boilerplate.service';
import { Boilerplate, User, BoilerplateWhereInput, BoilerplateOrderByInput } from '../types';
import { Context } from '../types/context';
import { HttpStatus, ErrorCode, createError } from '../utils/errors';
import { AppError } from '../utils/errors';

const boilerplateService = new BoilerplateService();

@Resolver(() => Boilerplate)
export class BoilerplateResolver {
  @Query(() => Boilerplate)
  async boilerplate(@Arg('id') id: string) {
    const boilerplate = await boilerplateService.findBoilerplateById(id);
    if (!boilerplate) {
      throw createError(
        'Boilerplate not found',
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        { resourceId: id }
      ).toGraphQLError();
    }
    return boilerplate;
  }

  @Query(() => [Boilerplate])
  async boilerplates(
    @Arg('skip', { nullable: true }) skip?: number,
    @Arg('take', { nullable: true }) take?: number,
    @Arg('where', () => BoilerplateWhereInput, { nullable: true }) where?: BoilerplateWhereInput,
    @Arg('orderBy', () => BoilerplateOrderByInput, { nullable: true }) orderBy?: BoilerplateOrderByInput
  ) {
    return await boilerplateService.findBoilerplates({ skip, take, where, orderBy });
  }

  @Mutation(() => Boilerplate)
  @Authorized()
  async createBoilerplate(
    @Ctx() { user }: Context,
    @Arg('title') title: string,
    @Arg('description') description: string,
    @Arg('repositoryUrl') repositoryUrl: string,
    @Arg('framework') framework: string,
    @Arg('language') language: string,
    @Arg('tags', () => [String], { nullable: true }) tags?: string[]
  ) {
    try {
      const boilerplate = await boilerplateService.createBoilerplate({
        title,
        description,
        repositoryUrl,
        framework,
        language,
        tags,
        authorId: user!.id
      });

      if (!boilerplate) {
        throw createError(
          'Failed to create boilerplate',
          HttpStatus.INTERNAL_SERVER_ERROR,
          ErrorCode.INTERNAL_SERVER_ERROR
        );
      }

      return boilerplate;
    } catch (error: unknown) {
      if (error instanceof AppError) {
        throw error;
      }
      throw createError(
        'Failed to create boilerplate',
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.INTERNAL_SERVER_ERROR,
        { details: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  @Mutation(() => Boilerplate)
  @Authorized()
  async updateBoilerplate(
    @Ctx() { user }: Context,
    @Arg('id') id: string,
    @Arg('title', { nullable: true }) title?: string,
    @Arg('description', { nullable: true }) description?: string,
    @Arg('repositoryUrl', { nullable: true }) repositoryUrl?: string,
    @Arg('framework', { nullable: true }) framework?: string,
    @Arg('language', { nullable: true }) language?: string,
    @Arg('tags', () => [String], { nullable: true }) tags?: string[]
  ) {
    try {
      return await boilerplateService.updateBoilerplate(id, {
        title,
        description,
        repositoryUrl,
        framework,
        language,
        tags
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw createError(
          'Boilerplate not found',
          HttpStatus.NOT_FOUND,
          ErrorCode.NOT_FOUND,
          { resourceId: id, userId: user!.id }
        ).toGraphQLError();
      }
      throw createError(
        'Failed to update boilerplate',
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.INTERNAL_SERVER_ERROR,
        { resourceId: id, userId: user!.id, details: error.message }
      ).toGraphQLError();
    }
  }

  @Mutation(() => Boolean)
  @Authorized()
  async deleteBoilerplate(
    @Ctx() { user }: Context,
    @Arg('id') id: string
  ) {
    try {
      await boilerplateService.deleteBoilerplate(id);
      return true;
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw createError(
          'Boilerplate not found',
          HttpStatus.NOT_FOUND,
          ErrorCode.NOT_FOUND,
          { resourceId: id, userId: user!.id }
        ).toGraphQLError();
      }
      throw createError(
        'Failed to delete boilerplate',
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.INTERNAL_SERVER_ERROR,
        { resourceId: id, userId: user!.id, details: error.message }
      ).toGraphQLError();
    }
  }

  @FieldResolver(() => User)
  async author(@Root() boilerplate: Boilerplate) {
    return boilerplate.author;
  }

  @FieldResolver(() => [String])
  async tags(@Root() boilerplate: Boilerplate) {
    return boilerplate.tags;
  }
}