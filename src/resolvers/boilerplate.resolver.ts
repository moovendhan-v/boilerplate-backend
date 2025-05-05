import { Resolver, Query, Mutation, Args, Context, Int } from "@nestjs/graphql";
import {
  Boilerplate,
  BoilerplateConnection,
  BoilerplateInput,
  BoilerplateOrderByInput,
  BoilerplateWhereInput,
} from "../types/boilerplate.type";
import { BoilerplateService } from "../services/boilerplate.service";
import logger from "../utils/logger";
import { Prisma } from "@prisma/client";
import {
  CustomError,
  AuthenticationError,
  DatabaseError,
  handleError,
} from "../utils/errorHandler";
import { Context as AppContext } from "../types/context";
import { GraphQLUpload, FileUpload } from "graphql-upload-minimal";
import * as path from "path";
import * as fs from "fs";
import { createWriteStream } from "fs";
import { finished } from "stream/promises";
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
  async createBoilerplate(
    data: BoilerplateInput,
    zipFile: FileUpload | null,
    { user }: AppContext
  ) {
    logger.info("[Boilerplate Resolver] Create boilerplate attempt", {
      data: data,
      fileReceived: !!zipFile,
    });

    if (!user) {
      logger.warn("[Boilerplate Resolver] Unauthenticated create attempt");
      throw new AuthenticationError(
        "Authentication required to create boilerplate"
      );
    }

    try {
      let zipFilePath: string | undefined;

      logger.info(
        "[Boilerplate Resolver] File check:",
        zipFile
          ? { filename: zipFile.filename, mimetype: zipFile.mimetype }
          : "No file received"
      );

      if (zipFile) {
        // Process the file
        const { filename, mimetype, createReadStream } = zipFile;

        if (
          mimetype !== "application/zip" &&
          mimetype !== "application/x-zip-compressed" &&
          mimetype !== "application/octet-stream"
        ) {
          logger.warn("[Boilerplate Resolver] Invalid mimetype", { mimetype });
          throw new Error(
            `Invalid file type: ${mimetype}. Only zip files are allowed.`
          );
        }

        const uploadDir = path.join(__dirname, "../../uploads");
        logger.info("[Boilerplate Resolver] Uploading zip file", {
          filename,
          mimetype,
          uploadDir,
        });

        // Create directory if it doesn't exist
        await fs.promises.mkdir(uploadDir, { recursive: true });

        // Generate a unique filename to prevent collisions
        const uniqueFilename = `${Date.now()}-${filename.replace(
          /[^a-zA-Z0-9._-]/g,
          "_"
        )}`;
        zipFilePath = path.join(uploadDir, uniqueFilename);

        logger.info("[Boilerplate Resolver] Saving file to", { zipFilePath });

        // Stream the file to disk
        const stream = createReadStream();
        const out = fs.createWriteStream(zipFilePath);

        // Use promise to handle stream completion
        await new Promise((resolve, reject) => {
          stream
            .pipe(out)
            .on("finish", () => {
              logger.info("[Boilerplate Resolver] File write completed");
              resolve(true);
            })
            .on("error", (err) => {
              logger.error("[Boilerplate Resolver] File write error", {
                error: err,
              });
              reject(err);
            });
        });

        logger.info("[Boilerplate Resolver] Zip file uploaded successfully", {
          zipFilePath,
        });
      }

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
      logger.error("[Boilerplate Resolver] Failed to create boilerplate", {error});

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

// Update the exported resolvers object
export const boilerplateResolvers = {
  Query: {
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
      args: { data: BoilerplateInput; zipFile?: Promise<FileUpload> },
      context: AppContext
    ) => {
      const zipFile = args.zipFile ? await args.zipFile : null;
      return BoilerplateResolver.instance.createBoilerplate(
        args.data,
        zipFile,
        context
      );
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
    // Add any field resolvers for the Boilerplate type if needed
  },
};
