import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class BoilerplateService {
  async findBoilerplateById(id: string) {
    return prisma.boilerplate.findUnique({
      where: { id },
      include: {
        author: true,
        tags: true
      }
    });
  }

  async findBoilerplates(params: {
    skip?: number;
    take?: number;
    where?: any;
    orderBy?: any;
  }) {
    const { skip, take, where, orderBy } = params;
    return prisma.boilerplate.findMany({
      skip,
      take,
      where,
      orderBy,
      include: {
        author: true,
        tags: true
      }
    });
  }

  async createBoilerplate(data: {
    title: string;
    description: string;
    authorId: string;
    repositoryUrl: string;
    tags?: string[];
  }) {
    return prisma.boilerplate.create({
      data: {
        ...data,
        tags: {
          create: data.tags?.map(tag => ({ name: tag })) || []
        }
      },
      include: {
        author: true,
        tags: true
      }
    });
  }

  async updateBoilerplate(id: string, data: {
    title?: string;
    description?: string;
    repositoryUrl?: string;
    tags?: string[];
  }) {
    return prisma.boilerplate.update({
      where: { id },
      data: {
        ...data,
        tags: data.tags ? {
          deleteMany: {},
          create: data.tags.map(tag => ({ name: tag }))
        } : undefined
      },
      include: {
        author: true,
        tags: true
      }
    });
  }

  async deleteBoilerplate(id: string) {
    return prisma.boilerplate.delete({
      where: { id }
    });
  }
}