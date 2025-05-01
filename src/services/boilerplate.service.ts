import { PrismaClient, Prisma } from "@prisma/client";
import logger from "../utils/logger";
import GitService from "./git.service";
import path from "path";
import fs from "fs/promises";
import { CustomError } from "../utils/errorHandler";

const prisma = new PrismaClient();

interface BoilerplateWhereInput {
  title?: { contains: string; mode: Prisma.QueryMode };
  description?: { contains: string; mode: Prisma.QueryMode };
  framework?: { equals: string };
  language?: { equals: string };
  authorId?: string;
  tags?: { hasSome: string[] };
  id?: { gt: string };
}

interface BoilerplateOrderByInput {
  title?: Prisma.SortOrder;
  stars?: Prisma.SortOrder;
  downloads?: Prisma.SortOrder;
  createdAt?: Prisma.SortOrder;
  updatedAt?: Prisma.SortOrder;
}

export class BoilerplateService {
  gitService = new GitService();
  boilerplatesBasePath: string = process.env.BOILERPLATE_BASE_DIR || "";

  async findBoilerplateById(id: string) {
    return prisma.boilerplate.findUnique({
      where: { id },
      include: {
        author: true,
        files: true,
        likes: true,
      },
    });
  }

  async findBoilerplates(params: {
    skip?: number;
    take?: number;
    where?: Prisma.BoilerplateWhereInput;
    orderBy?: Prisma.BoilerplateOrderByWithRelationInput;
  }) {
    const { skip, take, where, orderBy } = params;
    return prisma.boilerplate.findMany({
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
  }

  async createBoilerplate(data: {
    title: string;
    description: string;
    authorId: string;
    repositoryUrl: string;
    framework: string;
    language: string;
    tags?: string[];
    category: string;
    zipFilePath?: string;
  }) {
    // Validate and sanitize input data
    if (!data.title || !data.authorId || !data.category) {
      throw new CustomError("Missing required fields");
    }

    // Sanitize the title to create a safe directory name
    const sanitizedTitle = data.title.replace(/[^a-zA-Z0-9-_]/g, "-");
    const repoPath = path.join(
      this.boilerplatesBasePath,
      data.authorId,
      sanitizedTitle
    );
    logger.info("[BoilerplateService] Repo path", { repoPath });

    let result;

    try {
      logger.info("boilerplatesBasePath", { path : this.boilerplatesBasePath})
      // Ensure the base directory exists
      if (!this.boilerplatesBasePath) {
        throw new CustomError("Base directory not configured");
      }

      logger.info("[BoilerplateService] Creating new boilerplate", {
        data
      });

      // Create initial database record
      result = await prisma.boilerplate.create({
        data: {
          title: sanitizedTitle,
          description: data.description,
          repositoryUrl: data.repositoryUrl,
          framework: data.framework,
          language: data.language,
          tags: data.tags || [],
          authorId: data.authorId,
          stars: 0,
          downloads: 0,
        },
        include: {
          author: true,
          files: true,
          likes: true,
        },
      });

      if (!result) throw new CustomError("Failed to create boilerplate");
      logger.info("[BoilerplateService] Boilerplate record created", { result });

      // Process uploaded zip file if provided
      if (data.zipFilePath) {
        const processResult = await this.gitService.processUploadedZip(
          data.zipFilePath,
          data.category,
          sanitizedTitle,
          "System",
          "system@boilerplates.com"
        );

        if (!processResult.success) {
          throw new CustomError(
            `Failed to process zip file: ${processResult.message}`
          );
        }

        // Update repository path in database
        await prisma.boilerplate.update({
          where: { id: result.id },
          data: { repositoryUrl: processResult.path },
        });

        logger.info("[BoilerplateService] Zip file processed successfully", {
          repoPath: processResult.path,
        });
      } else {
        // Initialize empty repository if no zip file
        const initRepo = await this.gitService.initRepo(repoPath);
        logger.info("[BoilerplateService] Repo initialized", {
          success: initRepo.success,
          message: initRepo.message,
        })
        if (!initRepo.success) throw new CustomError("Failed to init repo");
      }

      return result;
    } catch (error: any) {
      logger.error("[BoilerplateService] Failed to create boilerplate", {
        error: error.message,
        stack: error.stack,
      });
      try {
        if (!this.boilerplatesBasePath) throw new Error("BASE_DIR not set");
        await fs.rm(repoPath, { recursive: true, force: true });

        // Cleanup database record if it was created
        if (result?.id) {
          await prisma.boilerplate.delete({
            where: { id: result.id },
          });
        }
      } catch (cleanupError) {
        console.error("Cleanup error during rollback:", cleanupError);
      }
      throw error;
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
    return prisma.boilerplate.update({
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
  }

  async deleteBoilerplate(id: string) {
    await prisma.file.deleteMany({ where: { boilerplateId: id } });
    await prisma.userLikes.deleteMany({ where: { boilerplateId: id } });

    return prisma.boilerplate.delete({ where: { id } });
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

    return prisma.boilerplate.findMany({
      where: whereConditions,
      orderBy: orderByCondition,
      take: first,
      include: {
        author: true,
        likes: true,
        files: true,
      },
    });
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

    return prisma.boilerplate.count({ where: whereConditions });
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
        throw new Error("User has already liked this boilerplate");

      await prisma.$transaction([
        prisma.userLikes.create({
          data: { userId, boilerplateId },
        }),
        prisma.boilerplate.update({
          where: { id: boilerplateId },
          data: { stars: { increment: 1 } },
        }),
      ]);

      return prisma.boilerplate.findUnique({
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

      if (!existingLike) throw new Error("User has not liked this boilerplate");

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

      return prisma.boilerplate.findUnique({
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

  // Add this method to your BoilerplateService class
  async findAllCategories() {
    try {
      return await prisma.category.findMany({
        orderBy: {
          name: "asc",
        },
      });
    } catch (error) {
      logger.error("[BoilerplateService] Failed to fetch categories", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }
}
