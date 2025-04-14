import { BoilerplateService } from '../services/boilerplate.service';
import { Context } from '../types/context';
import { Prisma } from '@prisma/client';
import { HttpStatus, ErrorCode, createError } from '../utils/errors';

interface BoilerplateInput {
  title: string;
  description: string;
  repositoryUrl: string;
  framework: string;
  language: string;
  tags?: string[];
}

interface BoilerplateWhereInput {
  title?: string;
  description?: string;
  authorId?: string;
  tags?: string[];
}

interface BoilerplateOrderByInput {
  title?: 'asc' | 'desc';
  createdAt?: 'asc' | 'desc';
  updatedAt?: 'asc' | 'desc';
}

type BoilerplateWithAuthor = Prisma.BoilerplateGetPayload<{
  include: { author: true }
}>;

export class BoilerplateController {
  private service: BoilerplateService;

  constructor() {
    this.service = new BoilerplateService();
  }

  async getBoilerplate(id: string) {
    const boilerplate = await this.service.findBoilerplateById(id);
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

  async getBoilerplates(params: {
    skip?: number;
    take?: number;
    where?: BoilerplateWhereInput;
    orderBy?: BoilerplateOrderByInput;
  }) {
    return await this.service.findBoilerplates(params);
  }

  async createBoilerplate(data: BoilerplateInput, user: Context['user']) {
    if (!user) {
      throw createError(
        'Not authenticated',
        HttpStatus.UNAUTHORIZED,
        ErrorCode.UNAUTHORIZED
      ).toGraphQLError();
    }

    try {
      return await this.service.createBoilerplate({ ...data, authorId: user.id });
    } catch (error: any) {
      throw createError(
        'Failed to create boilerplate',
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.INTERNAL_SERVER_ERROR,
        { userId: user.id, details: error.message }
      ).toGraphQLError();
    }
  }

  async updateBoilerplate(id: string, data: Partial<BoilerplateInput>, user: Context['user']) {
    if (!user) {
      throw createError(
        'Not authenticated',
        HttpStatus.UNAUTHORIZED,
        ErrorCode.UNAUTHORIZED
      ).toGraphQLError();
    }

    try {
      return await this.service.updateBoilerplate(id, data);
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw createError(
          'Boilerplate not found',
          HttpStatus.NOT_FOUND,
          ErrorCode.NOT_FOUND,
          { resourceId: id, userId: user.id }
        ).toGraphQLError();
      }
      throw createError(
        'Failed to update boilerplate',
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.INTERNAL_SERVER_ERROR,
        { resourceId: id, userId: user.id, details: error.message }
      ).toGraphQLError();
    }
  }

  async deleteBoilerplate(id: string, user: Context['user']) {
    if (!user) {
      throw createError(
        'Not authenticated',
        HttpStatus.UNAUTHORIZED,
        ErrorCode.UNAUTHORIZED
      ).toGraphQLError();
    }

    try {
      await this.service.deleteBoilerplate(id);
      return true;
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw createError(
          'Boilerplate not found',
          HttpStatus.NOT_FOUND,
          ErrorCode.NOT_FOUND,
          { resourceId: id, userId: user.id }
        ).toGraphQLError();
      }
      throw createError(
        'Failed to delete boilerplate',
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.INTERNAL_SERVER_ERROR,
        { resourceId: id, userId: user.id, details: error.message }
      ).toGraphQLError();
    }
  }

  async getAuthor(parent: BoilerplateWithAuthor) {
    return parent.author;
  }

  async getTags(parent: BoilerplateWithAuthor) {
    return parent.tags;
  }
}
}