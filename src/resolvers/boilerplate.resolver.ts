import { BoilerplateService } from '../services/boilerplate.service';
import { GraphQLError } from 'graphql';
import { Context } from '../types/context';
import logger from '../utils/logger';
import { Prisma } from '@prisma/client';

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
  include: {
    author: true,
    likes: true,
    files: true
  }
}>;

const boilerplateService = new BoilerplateService();

export const boilerplateResolvers = {
  Query: {
    boilerplate: async (_: any, { id }: { id: string }) => {
      logger.info('[Boilerplate Resolver] Fetching boilerplate', { id });
      return await boilerplateService.findBoilerplateById(id);
    },
    boilerplates: async (_: any, { skip, take, where, orderBy }: {
      skip?: number;
      take?: number;
      where?: BoilerplateWhereInput;
      orderBy?: BoilerplateOrderByInput;
    }) => {
      logger.info('[Boilerplate Resolver] Fetching boilerplates', {
        pagination: { skip, take },
        filters: where,
        orderBy
      });
      return await boilerplateService.findBoilerplates({ skip, take, where, orderBy });
    },
  },
  Mutation: {
    createBoilerplate: async (_: any, { data }: { data: BoilerplateInput }, { user }: Context) => {
      logger.info('[Boilerplate Resolver] Create boilerplate attempt', {
        userId: user?.id,
        data: { ...data }
      });

      if (!user) {
        logger.warn('[Boilerplate Resolver] Unauthenticated create attempt');
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }

      try {
        return await boilerplateService.createBoilerplate({
          ...data,
          authorId: user.id
        });
      } catch (error: any) {
        logger.error('[Boilerplate Resolver] Failed to create boilerplate', {
          userId: user.id,
          error: error.message
        });

        throw new GraphQLError('Failed to create boilerplate', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' }
        });
      }
    },
    updateBoilerplate: async (_: any, { id, data }: { id: string, data: Partial<BoilerplateInput> }, { user }: Context) => {
      logger.info('[Boilerplate Resolver] Update boilerplate attempt', {
        userId: user?.id,
        boilerplateId: id,
        updates: data
      });

      if (!user) {
        logger.warn('[Boilerplate Resolver] Unauthenticated update attempt');
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }

      try {
        return await boilerplateService.updateBoilerplate(id, data);
      } catch (error: any) {
        logger.error('[Boilerplate Resolver] Failed to update boilerplate', {
          userId: user.id,
          boilerplateId: id,
          error: error.message
        });

        throw new GraphQLError('Failed to update boilerplate', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' }
        });
      }
    },
    deleteBoilerplate: async (_: any, { id }: { id: string }, { user }: Context) => {
      logger.info('[Boilerplate Resolver] Delete boilerplate attempt', {
        userId: user?.id,
        boilerplateId: id
      });

      if (!user) {
        logger.warn('[Boilerplate Resolver] Unauthenticated delete attempt');
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }

      try {
        await boilerplateService.deleteBoilerplate(id);
        return true;
      } catch (error: any) {
        logger.error('[Boilerplate Resolver] Failed to delete boilerplate', {
          userId: user.id,
          boilerplateId: id,
          error: error.message
        });

        throw new GraphQLError('Failed to delete boilerplate', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' }
        });
      }
    }
  },
  Boilerplate: {
    author: (parent: BoilerplateWithAuthor) => {
      logger.info('[Boilerplate Resolver] Fetching boilerplate author', {
        boilerplateId: parent.id,
        authorId: parent.authorId
      });
      return parent.author; // This should already be included
    },
    tags: (parent: BoilerplateWithAuthor) => {
      logger.info('[Boilerplate Resolver] Fetching boilerplate tags', {
        boilerplateId: parent.id
      });
      return parent.tags; // This is a scalar field, so it's directly accessible
    }
  }
};