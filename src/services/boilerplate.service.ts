import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';

const prisma = new PrismaClient();

export class BoilerplateService {
  async findBoilerplateById(id: string) {
    return prisma.boilerplate.findUnique({
      where: { id },
      include: {
        author: true,
        files: true,
        likes: true
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
        files: true,
        likes: true
      }
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
    files?: Array<{name: string; path: string; content: string}>;
  }) {
    try {
      logger.info('[BoilerplateService] Creating new boilerplate', { 
        authorId: data.authorId, 
        title: data.title 
      });
      
      return prisma.boilerplate.create({
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
          // If files are provided, create them as related records
          ...(data.files && data.files.length > 0 ? {
            files: {
              create: data.files.map(file => ({
                name: file.name,
                path: file.path,
                content: file.content
              }))
            }
          } : {})
        },
        include: {
          author: true,
          files: true,
          likes: true
        }
      });
    } catch (error) {
      logger.error('[BoilerplateService] Failed to create boilerplate', { 
        error: error.message 
      });
      throw error;
    }
  }

  async updateBoilerplate(id: string, data: {
    title?: string;
    description?: string;
    repositoryUrl?: string;
    framework?: string;
    language?: string;
    tags?: string[];
  }) {
    return prisma.boilerplate.update({
      where: { id },
      data: {
        ...data,
        tags: data.tags || undefined
      },
      include: {
        author: true,
        files: true,
        likes: true
      }
    });
  }

  async deleteBoilerplate(id: string) {
    // First delete related files to avoid foreign key constraints
    await prisma.file.deleteMany({
      where: { boilerplateId: id }
    });
    
    // Then delete any likes
    await prisma.userLikes.deleteMany({
      where: { boilerplateId: id }
    });
    
    // Finally delete the boilerplate
    return prisma.boilerplate.delete({
      where: { id }
    });
  }
}