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
  files?: FileInput[];
}

interface FileInput {
  name: string;
  path: string;
  content: string;
  type: string;
}

interface BoilerplateWhereInput {
  title?: string;
  description?: string;
  framework?: string;
  language?: string;
  authorId?: string;
  tags?: string[];
}

interface BoilerplateOrderByInput {
  title?: 'asc' | 'desc';
  stars?: 'asc' | 'desc';
  downloads?: 'asc' | 'desc';
  createdAt?: 'asc' | 'desc';
  updatedAt?: 'asc' | 'desc';
}

// Base64 encode/decode helpers
const encodeCursor = (id: string): string => {
  return Buffer.from(id.toString()).toString('base64');
};

const decodeCursor = (cursor: string): string => {
  return Buffer.from(cursor, 'base64').toString('utf-8');
};

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
    
    // Updated to match cursor-based pagination in schema
    boilerplates: async (_: any, { first = 10, after, where, orderBy }: {
      first?: number;
      after?: string;
      where?: BoilerplateWhereInput;
      orderBy?: BoilerplateOrderByInput;
    }) => {
      logger.info('[Boilerplate Resolver] Fetching boilerplates with cursor pagination', {
        pagination: { first, after },
        filters: where,
        orderBy
      });

      // If we have an 'after' cursor, decode it to get the ID
      const afterId = after ? decodeCursor(after) : undefined;
      
      // Get one more item than requested to determine if there's a next page
      const limit = first + 1;
      
      try {
        const boilerplates = await boilerplateService.findBoilerplatesWithCursor({
          first: limit,
          afterId,
          where, 
          orderBy
        });
        
        // Check if we have more results than requested
        const hasNextPage = boilerplates.length > first;
        
        // Remove the extra item if we have one
        const nodes = hasNextPage ? boilerplates.slice(0, first) : boilerplates;
        
        // Create the edges array
        const edges = nodes.map(node => ({
          node,
          cursor: encodeCursor(node.id)
        }));
        
        // Get the last cursor
        const endCursor = edges.length > 0 ? edges[edges.length - 1].cursor : null;
        
        // Get the total count (you might want to optimize this)
        const totalCount = await boilerplateService.countBoilerplates(where);
        
        return {
          edges,
          pageInfo: {
            hasNextPage,
            endCursor
          },
          totalCount
        };
      } catch (error: any) {
        logger.error('[Boilerplate Resolver] Failed to fetch boilerplates', {
          error: error.message
        });

        throw new GraphQLError('Failed to fetch boilerplates', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' }
        });
      }
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
        // Make sure the service method is properly implemented and returns the expected type
        const boilerplate = await boilerplateService.createBoilerplate({
          ...data,
          authorId: user.id
        });
    
        // Add additional validation to ensure we're returning a complete object
        if (!boilerplate || !boilerplate.id) {
          logger.error('[Boilerplate Resolver] Service returned invalid boilerplate object', {
            boilerplate
          });
          throw new GraphQLError('Failed to create boilerplate', {
            extensions: { code: 'INTERNAL_SERVER_ERROR' }
          });
        }
    
        return boilerplate;
      } catch (error: any) {
        logger.error('[Boilerplate Resolver] Failed to create boilerplate', {
          userId: user.id,
          error: error.message,
          stack: error.stack
        });
    
        if (error instanceof GraphQLError) {
          throw error;
        }
    
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
    },
    
    likeBoilerplate: async (_: any, { id }: { id: string }, { user }: Context) => {
      logger.info('[Boilerplate Resolver] Like boilerplate', {
        userId: user?.id,
        boilerplateId: id
      });

      if (!user) {
        logger.warn('[Boilerplate Resolver] Unauthenticated like attempt');
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }

      try {
        return await boilerplateService.likeBoilerplate(id, user.id);
      } catch (error: any) {
        logger.error('[Boilerplate Resolver] Failed to like boilerplate', {
          userId: user.id,
          boilerplateId: id,
          error: error.message
        });

        throw new GraphQLError('Failed to like boilerplate', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' }
        });
      }
    },

    unlikeBoilerplate: async (_: any, { id }: { id: string }, { user }: Context) => {
      logger.info('[Boilerplate Resolver] Unlike boilerplate', {
        userId: user?.id,
        boilerplateId: id
      });

      if (!user) {
        logger.warn('[Boilerplate Resolver] Unauthenticated unlike attempt');
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }

      try {
        return await boilerplateService.unlikeBoilerplate(id, user.id);
      } catch (error: any) {
        logger.error('[Boilerplate Resolver] Failed to unlike boilerplate', {
          userId: user.id,
          boilerplateId: id,
          error: error.message
        });

        throw new GraphQLError('Failed to unlike boilerplate', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' }
        });
      }
    },

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
    },
    files: (parent: BoilerplateWithAuthor) => {
      logger.info('[Boilerplate Resolver] Fetching boilerplate files', {
        boilerplateId: parent.id
      });
      return parent.files || []; // Handle potential null case
    },
    likedBy: async (parent: BoilerplateWithAuthor) => {
      logger.info('[Boilerplate Resolver] Fetching boilerplate likedBy', {
        boilerplateId: parent.id
      });
      if (parent.likes && Array.isArray(parent.likes)) {
        return parent.likes.map(like => like.userId);
      }
      return [];
    }
  }
};