import { PrismaClient, Prisma } from "@prisma/client";
import logger from "../utils/logger";
import {
  CustomError,
  DatabaseError,
  ValidationError,
} from "../utils/errorHandler";
import {
  BoilerplateWhereInput,
  TextMatchMode,
} from "../types/boilerplate.type";

const prisma = new PrismaClient();

interface BoilerplateOrderByInput {
  title?: Prisma.SortOrder;
  stars?: Prisma.SortOrder;
  likeCount?: Prisma.SortOrder;
  downloads?: Prisma.SortOrder;
  createdAt?: Prisma.SortOrder;
  updatedAt?: Prisma.SortOrder;
}

enum Complexity {
  BEGINNER = "BEGINNER",
  INTERMEDIATE = "INTERMEDIATE",
  ADVANCED = "ADVANCED",
}

export class BoilerplateService {
  boilerplatesBasePath: string = process.env.BOILERPLATE_BASE_DIR || "";

  async findBoilerplateById(id: string) {
    try {
      return await prisma.boilerplate.findUnique({
        where: { id },
        include: {
          author: true,
          files: true,
          likes: true,
        },
      });
    } catch (error: any) {
      logger.error("[BoilerplateService] Failed to fetch boilerplate by ID", {
        error: error.message,
        id,
      });
      throw new CustomError("Failed to fetch boilerplate");
    }
  }

  async findBoilerplates(params: {
    skip?: number;
    take?: number;
    where?: Prisma.BoilerplateWhereInput;
    orderBy?: Prisma.BoilerplateOrderByWithRelationInput;
  }) {
    const { skip, take, where, orderBy } = params;
    try {
      return await prisma.boilerplate.findMany({
        skip,
        take,
        where,
        orderBy,
        include: {
          author: true,
          files: true,
          likes: true,
        },
      });
    } catch (error: any) {
      logger.error("[BoilerplateService] Failed to fetch boilerplates", {
        error: error.message,
      });
      throw new CustomError("Failed to fetch boilerplates");
    }
  }
  async createBoilerplate(data: {
    title: string;
    description: string;
    repositoryUrl?: string;
    framework: string;
    language: string;
    authorId: string;
    categoryId?: string;
    forkedFromId?: string;
    currentVersion?: string;
    latestVersionNumber?: string;
    readme?: string;
    coverImage?: string;
    license?: string;
    complexity?: string;
    views?: number;
    files?: Array<{
      name: string;
      path: string;
      content: string;
      contentType?: string;
      size?: number;
    }>;
  }) {
    if (!data.title || !data.authorId || !data.framework || !data.language) {
      throw new CustomError("Missing required fields");
    }

    const sanitizedTitle = data.title.replace(/[^a-zA-Z0-9-_]/g, "-");

    try {
      // Create the boilerplate with a transaction to ensure all operations succeed or fail together
      const result = await prisma.$transaction(async (tx) => {
        // 1. First create the boilerplate
        const boilerplate = await tx.boilerplate.create({
          data: {
            title: sanitizedTitle,
            description: data.description,
            repositoryUrl: data?.repositoryUrl,
            framework: data.framework,
            language: data.language,
            stars: 0,
            downloads: 0,
            visibility: "PUBLIC",
            isSynced: false,
            readme: data.readme || null,
            coverImage: data.coverImage || null,
            license: data.license || "MIT",
            complexity: (data.complexity as Complexity) || "INTERMEDIATE",
            authorId: data.authorId,
            categoryId: data.categoryId || null,
            forkedFromId: data.forkedFromId || null,
          },
        });
        logger.info("[BoilerplateService] Boilerplate record created", {
          boilerplate,
        });

        // 2. Create version for the boilerplate if it doesn't exist
        const version = await tx.boilerplateVersion.create({
          data: {
            boilerplateId: boilerplate.id,
            versionNumber: boilerplate.currentVersion,
            changelog: "Initial version",
          },
        });
        logger.info("[BoilerplateService] Boilerplate version created", {
          version,
        });

        // 3. Create files if any are provided
        if (data.files && data.files.length > 0) {
          await Promise.all(
            data.files.map((file) =>
              tx.file.create({
                data: {
                  name: file.name,
                  path: file.path,
                  content: file.content,
                  boilerplateId: boilerplate.id,
                },
              })
            )
          );
        }

        // Return the created boilerplate with related data
        return tx.boilerplate.findUnique({
          where: { id: boilerplate.id },
          include: {
            author: true,
            files: true,
            likes: true,
            comments: true,
          },
        });
      });

      if (!result) throw new CustomError("Failed to create boilerplate");
      logger.info("[BoilerplateService] Boilerplate record created", {
        result,
      });
      return result;
    } catch (error: any) {
      logger.error("[BoilerplateService] Failed to create boilerplate", error);
      throw new CustomError(`Failed to create boilerplate: ${error.message}`);
    }
  }

  async updateBoilerplate(
    id: string,
    data: {
      title?: string;
      description?: string;
      repositoryUrl?: string;
      framework?: string;
      language?: string;
      // tags?: string[];
    }
  ) {
    try {
      return await prisma.boilerplate.update({
        where: { id },
        data: {
          ...data,
          // tags: data.tags || undefined,
        },
        include: {
          author: true,
          files: true,
          likes: true,
        },
      });
    } catch (error: any) {
      logger.error("[BoilerplateService] Failed to update boilerplate", {
        error: error.message,
        id,
      });
      throw new CustomError("Failed to update boilerplate");
    }
  }

  async deleteBoilerplate(id: string) {
    try {
      await prisma.file.deleteMany({ where: { boilerplateId: id } });
      await prisma.userLikes.deleteMany({ where: { boilerplateId: id } });

      return await prisma.boilerplate.delete({ where: { id } });
    } catch (error: any) {
      logger.error("[BoilerplateService] Failed to delete boilerplate", {
        error: error.message,
        id,
      });
      throw new CustomError("Failed to delete boilerplate");
    }
  }

  async findBoilerplatesWithCursor({
    first = 10,
    afterId,
    where,
    orderBy,
  }: {
    first?: number;
    afterId?: string;
    where?: {
      title?: string;
      description?: string;
      framework?: string;
      language?: string;
      authorId?: string;
      // tags?: string[];
    };
    orderBy?: BoilerplateOrderByInput;
  }) {
    const whereConditions: Prisma.BoilerplateWhereInput = {};

    if (where) {
      if (where.title)
        whereConditions.title = { contains: where.title, mode: "insensitive" };
      if (where.description)
        whereConditions.description = {
          contains: where.description,
          mode: "insensitive",
        };
      if (where.framework) whereConditions.framework = where.framework;
      if (where.language) whereConditions.language = where.language;
      if (where.authorId) whereConditions.authorId = where.authorId;
      // if (where.tags?.length) whereConditions.tags = { hasSome: where.tags };
    }

    if (afterId) whereConditions.id = { gt: afterId };

    const orderByCondition: Prisma.BoilerplateOrderByWithRelationInput =
      orderBy || { createdAt: "desc" };

    try {
      return await prisma.boilerplate.findMany({
        where: whereConditions,
        orderBy: orderByCondition,
        take: first,
        include: {
          author: true,
          likes: true,
          files: true,
        },
      });
    } catch (error: any) {
      logger.error(
        "[BoilerplateService] Failed to fetch boilerplates with cursor",
        {
          error: error.message,
        }
      );
      throw new CustomError("Failed to fetch boilerplates with cursor");
    }
  }

  // Search boilerplates with fuzzy matching
  async searchBoilerplates({
    query,
    matchMode = TextMatchMode.CONTAINS,
    minRelevanceScore = 0.5,
    pagination: { first, afterId },
    where,
    orderBy,
  }: {
    query?: string;
    matchMode?: TextMatchMode;
    minRelevanceScore?: number;
    pagination: { first: number; afterId?: string };
    where?: BoilerplateWhereInput;
    orderBy?: BoilerplateOrderByInput;
  }) {
    try {
      const whereClause = this.buildWhereClause(where);
  
      // Apply cursor-based pagination
      if (afterId) {
        whereClause.id = { gt: afterId };
      }
  
      // Construct search conditions based on matchMode
      const searchConditions: any[] = [];
      if (query) {
        switch (matchMode) {
          case TextMatchMode.EXACT:
            searchConditions.push(
              { title: { equals: query } },
              { description: { equals: query } },
            );
            break;
          case TextMatchMode.CONTAINS:
            searchConditions.push(
              { title: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } }
            );
            break;
          case TextMatchMode.STARTS_WITH:
            searchConditions.push(
              { title: { startsWith: query, mode: 'insensitive' } },
              { description: { startsWith: query, mode: 'insensitive' } }
            );
            break;
          case TextMatchMode.ENDS_WITH:
            searchConditions.push(
              { title: { endsWith: query, mode: 'insensitive' } },
              { description: { endsWith: query, mode: 'insensitive' } }
            );
            break;
          case TextMatchMode.REGEX:
            try {
              const regex = new RegExp(query, 'i');
              searchConditions.push(
                { title: { matches: regex } },
                { description: { matches: regex } }
              );
            } catch (e) {
              logger.warn('[BoilerplateService] Invalid regex pattern', { query });
              throw new ValidationError('Invalid regex pattern');
            }
            break;
          case TextMatchMode.FUZZY:
            // For fuzzy search, consider using PostgreSQL's trigram similarity
            // This requires raw SQL queries and enabling the pg_trgm extension
            // Example:
            // const results = await prisma.$queryRaw`SELECT * FROM "Boilerplate" WHERE similarity(title, ${query}) > 0.3 ORDER BY similarity(title, ${query}) DESC LIMIT ${first}`;
            // return { items: results.map(item => ({ item, score: 1.0 })), totalCount: results.length };
            break;
          default:
            break;
        }
  
        if (searchConditions.length > 0) {
          whereClause.OR = searchConditions;
        }
      }
  
      const orderByClause = this.buildOrderByClause(orderBy);
  
      const results = await prisma.boilerplate.findMany({
        take: first,
        where: whereClause,
        orderBy: orderByClause,
        include: {
          likes: true,
          author: true,
        },
      });
  
      // Compute relevance scores if a query is provided
      const items = results.map((item) => {
        let score = 1.0;
        if (query) {
          const titleMatch = item.title?.toLowerCase().includes(query.toLowerCase());
          const descriptionMatch = item.description?.toLowerCase().includes(query.toLowerCase());
          score = 0;
          if (titleMatch) score += 0.6;
          if (descriptionMatch) score += 0.4;
        }
        return { item, score: Math.min(score, 1.0) };
      });
  
      // Filter by minRelevanceScore
      const filteredItems = items.filter(({ score }) => score >= minRelevanceScore);
  
      return {
        items: filteredItems,
        totalCount: filteredItems.length,
      };
    } catch (error: any) {
      if (error instanceof CustomError) {
        throw error;
      }
  
      logger.error('[BoilerplateService] Error searching boilerplates', {
        query,
        matchMode,
        minRelevanceScore,
        pagination: { first, afterId },
        filters: where,
        orderBy,
        error: error.message,
      });
  
      throw new DatabaseError(`Failed to search boilerplates: ${error.message}`);
    }
  }

  // Helper method to build where clause
  private buildWhereClause(
    where?: BoilerplateWhereInput
  ): Prisma.BoilerplateWhereInput {
    const whereClause: Prisma.BoilerplateWhereInput = {};

    if (!where) return whereClause;

    // Basic filters
    if (where.title) {
      whereClause.title = {
        contains: where.title,
        mode: "insensitive",
      };
    }

    if (where.description) {
      whereClause.description = {
        contains: where.description,
        mode: "insensitive",
      };
    }

    if (where.authorId) {
      whereClause.authorId = where.authorId;
    }

    // Categories filter
    // if (where.categories) {
    //   const categoryFilter: BoilerplateCategoriesFilter = where.categories;

    //   // Filter by all categories (AND)
    //   // if (categoryFilter.every?.length) {
    //   //   whereClause.categoryId = {
    //   //     in: {
    //   //       categoryId: {
    //   //         in: categoryFilter.every,
    //   //       },
    //   //     },
    //   //   };
    //   // }

    //   // Filter by some categories (OR)
    //   // if (categoryFilter.some?.length) {
    //   //   whereClause.categories = {
    //   //     some: {
    //   //       id: {
    //   //         in: categoryFilter.some,
    //   //       },
    //   //     },
    //   //   };
    //   // }
    // }

    // Likes filter
    // if (where.likes) {
    //   const likesFilter: BoilerplateLikesFilter = where.likes;

    //   if (likesFilter.byUser) {
    //     whereClause.likes = {
    //       some: {
    //         userId: likesFilter.byUser,
    //       },
    //     };
    //   }

    //   if (likesFilter.minCount !== undefined) {
    //     whereClause.likeCount = {
    //       gte: likesFilter.minCount,
    //     };
    //   }
    // }

    return whereClause;
  }

  private buildOrderByClause(
    orderBy?: BoilerplateOrderByInput
  ): Prisma.BoilerplateOrderByWithRelationInput {
    if (!orderBy) return { createdAt: "desc" };

    const orderByClause: Prisma.BoilerplateOrderByWithRelationInput = {};

    if (orderBy.title) orderByClause.title = orderBy.title;
    if (orderBy.createdAt) orderByClause.createdAt = orderBy.createdAt;
    if (orderBy.updatedAt) orderByClause.updatedAt = orderBy.updatedAt;
    if (orderBy.stars) orderByClause.stars = orderBy.stars;
    if (orderBy.downloads) orderByClause.downloads = orderBy.downloads;

    // If nothing was set, use default
    if (Object.keys(orderByClause).length === 0) {
      return { createdAt: "desc" };
    }

    return orderByClause;
  }

  async countBoilerplates(where?: {
    title?: string;
    description?: string;
    framework?: string;
    language?: string;
    authorId?: string;
    // tags?: string[];
  }) {
    const whereConditions: Prisma.BoilerplateWhereInput = {};

    if (where) {
      if (where.title)
        whereConditions.title = { contains: where.title, mode: "insensitive" };
      if (where.description)
        whereConditions.description = {
          contains: where.description,
          mode: "insensitive",
        };
      if (where.framework) whereConditions.framework = where.framework;
      if (where.language) whereConditions.language = where.language;
      if (where.authorId) whereConditions.authorId = where.authorId;
      // if (where.tags?.length) whereConditions.tags = { hasSome: where.tags };
    }

    try {
      return await prisma.boilerplate.count({ where: whereConditions });
    } catch (error: any) {
      logger.error("[BoilerplateService] Failed to count boilerplates", {
        error: error.message,
      });
      throw new CustomError("Failed to count boilerplates");
    }
  }

  async likeBoilerplate(boilerplateId: string, userId: string) {
    try {
      const existingLike = await prisma.userLikes.findUnique({
        where: {
          userId_boilerplateId: {
            userId,
            boilerplateId,
          },
        },
      });

      if (existingLike)
        throw new CustomError("User has already liked this boilerplate");

      await prisma.$transaction([
        prisma.userLikes.create({
          data: { userId, boilerplateId },
        }),
        prisma.boilerplate.update({
          where: { id: boilerplateId },
          data: { stars: { increment: 1 } },
        }),
      ]);

      return await prisma.boilerplate.findUnique({
        where: { id: boilerplateId },
        include: {
          author: true,
          files: true,
          likes: true,
        },
      });
    } catch (error: any) {
      logger.error("[BoilerplateService] Failed to like boilerplate", {
        error: error.message,
        boilerplateId,
        userId,
      });
      throw error;
    }
  }

  async unlikeBoilerplate(boilerplateId: string, userId: string) {
    try {
      const existingLike = await prisma.userLikes.findUnique({
        where: {
          userId_boilerplateId: {
            userId,
            boilerplateId,
          },
        },
      });

      if (!existingLike)
        throw new CustomError("User has not liked this boilerplate");

      await prisma.$transaction([
        prisma.userLikes.delete({
          where: {
            userId_boilerplateId: {
              userId,
              boilerplateId,
            },
          },
        }),
        prisma.boilerplate.update({
          where: { id: boilerplateId },
          data: { stars: { decrement: 1 } },
        }),
      ]);

      return await prisma.boilerplate.findUnique({
        where: { id: boilerplateId },
        include: {
          author: true,
          files: true,
          likes: true,
        },
      });
    } catch (error: any) {
      logger.error("[BoilerplateService] Failed to unlike boilerplate", {
        error: error.message,
        boilerplateId,
        userId,
      });
      throw error;
    }
  }

  async findAllCategories() {
    try {
      return await prisma.category.findMany({
        orderBy: {
          name: "asc",
        },
      });
    } catch (error: any) {
      logger.error("[BoilerplateService] Failed to fetch categories", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw new CustomError("Failed to fetch categories");
    }
  }
}
