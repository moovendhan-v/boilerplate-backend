import { PrismaClient, Prisma } from "@prisma/client";
import logger from "../utils/logger";

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
    files?: Array<{ name: string; path: string; content: string }>;
  }) {
    try {
      logger.info("[BoilerplateService] Creating new boilerplate", {
        authorId: data.authorId,
        title: data.title,
      });

      const result = await prisma.boilerplate.create({
        data: {
          title: data.title,
          description: data.description,
          repositoryUrl: data.repositoryUrl,
          framework: data.framework,
          language: data.language,
          tags: data.tags || [],
          authorId: data.authorId,
          stars: 0,
          downloads: 0,
          ...(data.files?.length
            ? {
                files: {
                  create: data.files.map(({ name, path, content }) => ({
                    name,
                    path,
                    content,
                  })),
                },
              }
            : {}),
        },
        include: {
          author: true,
          files: true,
          likes: true,
        },
      });

      if (!result) throw new Error("Failed to create boilerplate");

      return result;
    } catch (error: any) {
      logger.error("[BoilerplateService] Failed to create boilerplate", {
        error: error.message,
        stack: error.stack,
      });
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
      if (where.tags?.length)
        whereConditions.tags = { hasSome: where.tags };
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
      if (where.tags?.length)
        whereConditions.tags = { hasSome: where.tags };
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

      if (!existingLike)
        throw new Error("User has not liked this boilerplate");

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
}
