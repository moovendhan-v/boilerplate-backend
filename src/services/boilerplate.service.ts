import { PrismaClient, Prisma } from "@prisma/client";
import logger from "../utils/logger";
import path from "path";
import fs from "fs/promises";
import { CustomError } from "../utils/errorHandler";

const prisma = new PrismaClient();

interface BoilerplateOrderByInput {
  title?: Prisma.SortOrder;
  stars?: Prisma.SortOrder;
  downloads?: Prisma.SortOrder;
  createdAt?: Prisma.SortOrder;
  updatedAt?: Prisma.SortOrder;
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
    repositoryUrl: string;
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
  }) {
    if (
      !data.title ||
      !data.authorId ||
      !data.repositoryUrl ||
      !data.framework ||
      !data.language
    ) {
      throw new CustomError("Missing required fields");
    }
  
    const sanitizedTitle = data.title.replace(/[^a-zA-Z0-9-_]/g, "-");
    const defaultTags = [data.framework, data.language].filter(Boolean); // basic default tags
  
    try {
      const result = await prisma.boilerplate.create({
        data: {
          title: sanitizedTitle,
          description: data.description,
          repositoryUrl: data.repositoryUrl,
          framework: data.framework,
          language: data.language,
          stars: 0,
          downloads: 0,
          // views: data.views ?? 0,
          tags: defaultTags,
          visibility: "PUBLIC",
          isSynced: false,
          currentVersion: data.currentVersion || "1.0.0",
          latestVersionNumber: data.latestVersionNumber || "1.0.0",
          // readme: data.readme || null,
          // coverImage: data.coverImage || null,
          // license: data.license || "MIT",
          // complexity: data.complexity || "INTERMEDIATE",
          authorId: data.authorId,
          categoryId: data.categoryId || null,
          forkedFromId: data.forkedFromId || null,
        },
        include: {
          author: true,
          files: true,
          likes: true,
          comments: true,
        },
      });
  
      if (!result) throw new CustomError("Failed to create boilerplate");
  
      logger.info("[BoilerplateService] Boilerplate record created", { result });
      return result;
    } catch (error: any) {
      logger.error("[BoilerplateService] Failed to create boilerplate", error);
      throw new CustomError("Failed to create boilerplate");
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
      tags?: string[];
    }
  ) {
    try {
      return await prisma.boilerplate.update({
        where: { id },
        data: {
          ...data,
          tags: data.tags || undefined,
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
      tags?: string[];
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
      if (where.tags?.length) whereConditions.tags = { hasSome: where.tags };
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

  async countBoilerplates(where?: {
    title?: string;
    description?: string;
    framework?: string;
    language?: string;
    authorId?: string;
    tags?: string[];
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
      if (where.tags?.length) whereConditions.tags = { hasSome: where.tags };
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
