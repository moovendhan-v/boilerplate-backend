import { BoilerplateService } from '../services/boilerplate.service';
import { GraphQLError } from 'graphql';
import { Context } from '../types/context';
import logger from '../utils/logger';
import { Prisma } from '@prisma/client';

interface BoilerplateInput {
  title: string;
  description: string;
  repositoryUrl: string;
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
        data: { ...data, tags: data.tags?.length }
      });

      if (!user) {
        logger.warn('[Boilerplate Resolver] Unauthenticated create attempt');
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }

      return await boilerplateService.createBoilerplate({ ...data, authorId: user.id });
    },
    updateBoilerplate: async (_: any, { id, data }: { id: string, data: Partial<BoilerplateInput> }, { user }: Context) => {
      logger.info('[Boilerplate Resolver] Update boilerplate attempt', { 
        userId: user?.id,
        boilerplateId: id,
        updates: { ...data, tags: data.tags?.length }
      });

      if (!user) {
        logger.warn('[Boilerplate Resolver] Unauthenticated update attempt');
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }

      return await boilerplateService.updateBoilerplate(id, data);
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

      await boilerplateService.deleteBoilerplate(id);
      return true;
    }
  },
  Boilerplate: {
    author: async (parent: BoilerplateWithAuthor) => {
      logger.info('[Boilerplate Resolver] Fetching boilerplate author', { 
        boilerplateId: parent.id,
        authorId: parent.authorId 
      });
      const boilerplate = await boilerplateService.findBoilerplateById(parent.id);
      return boilerplate?.authorId;
    },
    tags: async (parent: BoilerplateWithAuthor) => {
      logger.info('[Boilerplate Resolver] Fetching boilerplate tags', { 
        boilerplateId: parent.id 
      });
      return parent.tags;
    }
  }
};