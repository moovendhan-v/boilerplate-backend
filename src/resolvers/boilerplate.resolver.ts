import {
  Resolver,
  Query,
  Mutation,
  Args,
  Context,
  Int,
  Float,
} from "@nestjs/graphql";
import {
  Boilerplate,
  BoilerplateConnection,
  BoilerplateInput,
  BoilerplateOrderByInput,
  BoilerplateWhereInput,
  TextMatchMode,
} from "../types/boilerplate.type";
import { BoilerplateService } from "../services/boilerplate.service";
import logger from "../utils/logger";
import {
  CustomError,
  AuthenticationError,
  DatabaseError,
  handleError,
} from "../utils/errorHandler";
import { Context as AppContext } from "../types/context";
import { Category } from "../types/category.type";

const encodeCursor = (id: string): string => {
  return Buffer.from(id.toString()).toString("base64");
};

const decodeCursor = (cursor: string): string => {
  return Buffer.from(cursor, "base64").toString("utf-8");
};

@Resolver(() => Boilerplate)
export class BoilerplateResolver {
  private static _instance: BoilerplateResolver;
  private boilerplateService: BoilerplateService;

  private constructor() {
    this.boilerplateService = new BoilerplateService();
  }

  public static get instance(): BoilerplateResolver {
    if (!BoilerplateResolver._instance) {
      BoilerplateResolver._instance = new BoilerplateResolver();
    }
    return BoilerplateResolver._instance;
  }

  @Query(() => Boilerplate, { nullable: true })
  async boilerplate(@Args("id") id: string) {
    logger.info("[Boilerplate Resolver] Fetching boilerplate", { id });
    return await this.boilerplateService.findBoilerplateById(id);
  }

  @Query(() => BoilerplateConnection)
  async searchBoilerplates(
    @Args({ name: "first", type: () => Int, defaultValue: 10 }) first: number,
    @Args("after", { nullable: true }) after?: string,
    @Args("query", { nullable: true }) query?: string,
    @Args({
      name: "matchMode",
      type: () => TextMatchMode,
      defaultValue: TextMatchMode.CONTAINS,
    })
    matchMode: TextMatchMode = TextMatchMode.CONTAINS,
    @Args({ name: "minRelevanceScore", type: () => Float, defaultValue: 0.5 })
    minRelevanceScore: number = 0.5,
    @Args({ name: "where", type: () => BoilerplateWhereInput, nullable: true })
    where?: BoilerplateWhereInput,
    @Args({
      name: "orderBy",
      type: () => BoilerplateOrderByInput,
      nullable: true,
    })
    orderBy?: BoilerplateOrderByInput
  ) {
    logger.info(
      "[Boilerplate Resolver] Searching boilerplates with fuzzy matching",
      {
        pagination: { first, after },
        query,
        matchMode,
        minRelevanceScore,
        filters: where,
        orderBy,
      }
    );

    const afterId = after ? decodeCursor(after) : undefined;
    const limit = first + 1;

    try {
      const searchResults = await this.boilerplateService.searchBoilerplates({
        query,
        matchMode,
        minRelevanceScore,
        pagination: { first: limit, afterId },
        where,
        orderBy,
      });

      const hasNextPage = searchResults.items.length > first;
      const nodes = hasNextPage
        ? searchResults.items.slice(0, first)
        : searchResults.items;
      const edges = nodes.map((node) => ({
        node: node.item,
        cursor: encodeCursor(node.item.id),
        relevanceScore: node.score,
      }));
      const endCursor =
        edges.length > 0 ? edges[edges.length - 1].cursor : null;

      return {
        edges,
        pageInfo: {
          hasNextPage,
          endCursor,
        },
        totalCount: searchResults.totalCount,
      };
    } catch (error: any) {
      logger.error("[Boilerplate Resolver] Failed to search boilerplates", {
        error: error.message,
      });
      throw handleError(error);
    }
  }

  @Query(() => BoilerplateConnection)
  async boilerplates(
    @Args({ name: "first", type: () => Int, defaultValue: 10 }) first: number,
    @Args("after", { nullable: true }) after?: string,
    @Args({ name: "where", type: () => BoilerplateWhereInput, nullable: true })
    where?: BoilerplateWhereInput,
    @Args({
      name: "orderBy",
      type: () => BoilerplateOrderByInput,
      nullable: true,
    })
    orderBy?: BoilerplateOrderByInput
  ) {
    logger.info(
      "[Boilerplate Resolver] Fetching boilerplates with cursor pagination",
      {
        pagination: { first, after },
        filters: where,
        orderBy,
      }
    );

    const afterId = after ? decodeCursor(after) : undefined;
    const limit = first + 1;

    try {
      const boilerplates =
        await this.boilerplateService.findBoilerplatesWithCursor({
          first: limit,
          afterId,
          where,
          orderBy,
        });

      const hasNextPage = boilerplates.length > first;
      const nodes = hasNextPage ? boilerplates.slice(0, first) : boilerplates;
      const edges = nodes.map((node) => ({
        node,
        cursor: encodeCursor(node.id),
      }));
      const endCursor =
        edges.length > 0 ? edges[edges.length - 1].cursor : null;
      const totalCount = await this.boilerplateService.countBoilerplates(where);

      return {
        edges,
        pageInfo: {
          hasNextPage,
          endCursor,
        },
        totalCount,
      };
    } catch (error: any) {
      logger.error("[Boilerplate Resolver] Failed to fetch boilerplates", {
        error: error.message,
      });
      throw handleError(error);
    }
  }

  @Mutation(() => Boilerplate)
  async createBoilerplate(data: BoilerplateInput, { user }: AppContext) {
    logger.info("[Boilerplate Resolver] Create boilerplate attempt", {
      data: data,
    });

    if (!user) {
      logger.warn("[Boilerplate Resolver] Unauthenticated create attempt");
      throw new AuthenticationError(
        "Authentication required to create boilerplate"
      );
    }

    try {
      const boilerplate = await this.boilerplateService.createBoilerplate({
        ...data,
        authorId: user.sub,
      });

      if (!boilerplate || !boilerplate.id) {
        logger.error(
          "[Boilerplate Resolver] Service returned invalid boilerplate object",
          { boilerplate }
        );
        throw new DatabaseError("Failed to create boilerplate");
      }

      return boilerplate;
    } catch (error: any) {
      logger.error("[Boilerplate Resolver] Failed to create boilerplate", {
        error,
      });

      if (error instanceof CustomError) {
        throw error;
      }

      throw handleError(error);
    }
  }

  @Mutation(() => Boilerplate)
  async updateBoilerplate(
    @Args("id") id: string,
    @Args("data") data: Partial<BoilerplateInput>,
    @Context() { user }: AppContext
  ) {
    logger.info("[Boilerplate Resolver] Update boilerplate attempt", {
      userId: user?.sub,
      boilerplateId: id,
      updates: data,
    });

    if (!user) {
      logger.warn("[Boilerplate Resolver] Unauthenticated update attempt");
      throw new AuthenticationError(
        "Authentication required to update boilerplate"
      );
    }

    try {
      return await this.boilerplateService.updateBoilerplate(id, data);
    } catch (error: any) {
      logger.error("[Boilerplate Resolver] Failed to update boilerplate", {
        userId: user.sub,
        boilerplateId: id,
        error: error.message,
      });
      throw handleError(error);
    }
  }

  @Mutation(() => Boolean)
  async deleteBoilerplate(
    @Args("id") id: string,
    @Context() { user }: AppContext
  ) {
    logger.info("[Boilerplate Resolver] Delete boilerplate attempt", {
      userId: user?.sub,
      boilerplateId: id,
    });

    if (!user) {
      logger.warn("[Boilerplate Resolver] Unauthenticated delete attempt");
      throw new AuthenticationError(
        "Authentication required to delete boilerplate"
      );
    }

    try {
      await this.boilerplateService.deleteBoilerplate(id);
      return true;
    } catch (error: any) {
      logger.error("[Boilerplate Resolver] Failed to delete boilerplate", {
        userId: user.sub,
        boilerplateId: id,
        error: error.message,
      });
      throw handleError(error);
    }
  }

  @Mutation(() => Boilerplate)
  async likeBoilerplate(
    @Args("id") id: string,
    @Context() { user }: AppContext
  ) {
    logger.info("[Boilerplate Resolver] Like boilerplate", {
      userId: user?.sub,
      boilerplateId: id,
    });

    if (!user) {
      logger.warn("[Boilerplate Resolver] Unauthenticated like attempt");
      throw new AuthenticationError(
        "Authentication required to like boilerplate"
      );
    }

    try {
      return await this.boilerplateService.likeBoilerplate(id, user.sub);
    } catch (error: any) {
      logger.error("[Boilerplate Resolver] Failed to like boilerplate", {
        userId: user.sub,
        boilerplateId: id,
        error: error.message,
      });
      throw handleError(error);
    }
  }

  @Mutation(() => Boilerplate)
  async unlikeBoilerplate(
    @Args("id") id: string,
    @Context() { user }: AppContext
  ) {
    logger.info("[Boilerplate Resolver] Unlike boilerplate", {
      userId: user?.sub,
      boilerplateId: id,
    });

    if (!user) {
      logger.warn("[Boilerplate Resolver] Unauthenticated unlike attempt");
      throw new AuthenticationError(
        "Authentication required to unlike boilerplate"
      );
    }

    try {
      return await this.boilerplateService.unlikeBoilerplate(id, user.sub);
    } catch (error: any) {
      logger.error("[Boilerplate Resolver] Failed to unlike boilerplate", {
        userId: user.sub,
        boilerplateId: id,
        error: error.message,
      });
      throw handleError(error);
    }
  }

  @Query(() => [String])
  async likedBy(@Args("boilerplateId") boilerplateId: string) {
    logger.info("[Boilerplate Resolver] Fetching likes for boilerplate", {
      boilerplateId,
    });

    const boilerplate = await this.boilerplateService.findBoilerplateById(
      boilerplateId
    );
    if (!boilerplate) {
      logger.warn("[Boilerplate Resolver] Boilerplate not found", {
        boilerplateId,
      });
      throw new DatabaseError("Boilerplate not found");
    }

    if (boilerplate.likes && Array.isArray(boilerplate.likes)) {
      return boilerplate.likes.map((like) => like.userId);
    }
    return [];
  }

  @Query(() => [Category])
  async categories() {
    logger.info("[Boilerplate Resolver] Fetching all categories");

    try {
      const resp = await this.boilerplateService.findAllCategories();
      logger.info("[Boilerplate Resolver] Fetched categories", {
        count: resp.length,
      });
      return resp;
    } catch (error: any) {
      logger.error("[Boilerplate Resolver] Failed to fetch categories", {
        error: error.message,
      });
      throw handleError(error);
    }
  }
}

export const boilerplateResolvers = {
  Query: {
    searchBoilerplates: (
      _: unknown,
      args: {
        query?: string;
        matchMode?: TextMatchMode;
        minRelevanceScore?: number;
        first?: number;
        after?: string;
        where?: BoilerplateWhereInput;
        orderBy?: BoilerplateOrderByInput;
      }
    ) => {
      const {
        first = 10,
        after = undefined,
        query = '',
        matchMode = TextMatchMode.CONTAINS,
        minRelevanceScore = 0.5,
        where,
        orderBy,
      } = args;
    
      return BoilerplateResolver.instance.searchBoilerplates(
        first,
        after,
        query,
        matchMode,
        minRelevanceScore,
        where,
        orderBy
      );
    },    
    boilerplate: (_: unknown, args: { id: string }) =>
      BoilerplateResolver.instance.boilerplate(args.id),
    boilerplates: (
      _: unknown,
      args: {
        first: number;
        after?: string;
        where?: BoilerplateWhereInput;
        orderBy?: BoilerplateOrderByInput;
      }
    ) =>
      BoilerplateResolver.instance.boilerplates(
        args.first,
        args.after,
        args.where,
        args.orderBy
      ),
    likedBy: (_: unknown, args: { boilerplateId: string }) =>
      BoilerplateResolver.instance.likedBy(args.boilerplateId),
    categories: () => BoilerplateResolver.instance.categories(),
  },
  Mutation: {
    createBoilerplate: async (
      _: unknown,
      args: { data: BoilerplateInput },
      context: AppContext
    ) => {
      return BoilerplateResolver.instance.createBoilerplate(args.data, context);
    },
    updateBoilerplate: (
      _: unknown,
      args: { id: string; data: Partial<BoilerplateInput> },
      context: AppContext
    ) =>
      BoilerplateResolver.instance.updateBoilerplate(
        args.id,
        args.data,
        context
      ),
    deleteBoilerplate: (
      _: unknown,
      args: { id: string },
      context: AppContext
    ) => BoilerplateResolver.instance.deleteBoilerplate(args.id, context),
    likeBoilerplate: (_: unknown, args: { id: string }, context: AppContext) =>
      BoilerplateResolver.instance.likeBoilerplate(args.id, context),
    unlikeBoilerplate: (
      _: unknown,
      args: { id: string },
      context: AppContext
    ) => BoilerplateResolver.instance.unlikeBoilerplate(args.id, context),
  },
  Boilerplate: {
    // boilerplates: (parent: BoilerplateResolver) =>
    //   BoilerplateResolver.instance.userBoilerplates(parent.id),
  },
};
