import { BoilerplateService } from '../services/boilerplate.service';
import { GraphQLError } from 'graphql';
import { Context } from '../types/context';

interface BoilerplateInput {
  title: string;
  description: string;
  repositoryUrl: string;
  framework: string;
  language: string;
  tags: string[];
  files: FileInput[];
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
  tags?: string[];
  authorId?: string;
}

interface BoilerplateOrderByInput {
  title?: 'asc' | 'desc';
  stars?: 'asc' | 'desc';
  downloads?: 'asc' | 'desc';
  createdAt?: 'asc' | 'desc';
  updatedAt?: 'asc' | 'desc';
}

const boilerplateService = new BoilerplateService();

export const boilerplateResolvers = {
  Query: {
    boilerplate: async (_: any, { id }: { id: string }) => {
      return await boilerplateService.findBoilerplateById(id);
    },
    boilerplates: async (_: any, { first, after, where, orderBy }: {
      first?: number;
      after?: string;
      where?: BoilerplateWhereInput;
      orderBy?: BoilerplateOrderByInput;
    }) => {
      return await boilerplateService.findBoilerplates({ first, after, where, orderBy });
    },
  },
  Mutation: {
    createBoilerplate: async (_: any, { data }: { data: BoilerplateInput }, { user }: Context) => {
      if (!user) throw new GraphQLError('Not authenticated', {
        extensions: { code: 'UNAUTHENTICATED' }
      });
      return await boilerplateService.createBoilerplate({ ...data, authorId: user.id });
    },
    updateBoilerplate: async (_: any, { id, data }: { id: string, data: Partial<BoilerplateInput> }, { user }: Context) => {
      if (!user) throw new GraphQLError('Not authenticated', {
        extensions: { code: 'UNAUTHENTICATED' }
      });
      return await boilerplateService.updateBoilerplate(id, data, user.id);
    },
    deleteBoilerplate: async (_: any, { id }: { id: string }, { user }: Context) => {
      if (!user) throw new GraphQLError('Not authenticated', {
        extensions: { code: 'UNAUTHENTICATED' }
      });
      await boilerplateService.deleteBoilerplate(id, user.id);
      return true;
    },
    likeBoilerplate: async (_: any, { id }: { id: string }, { user }: Context) => {
      if (!user) throw new GraphQLError('Not authenticated', {
        extensions: { code: 'UNAUTHENTICATED' }
      });
      return await boilerplateService.likeBoilerplate(id, user.id);
    },
    unlikeBoilerplate: async (_: any, { id }: { id: string }, { user }: Context) => {
      if (!user) throw new GraphQLError('Not authenticated', {
        extensions: { code: 'UNAUTHENTICATED' }
      });
      return await boilerplateService.unlikeBoilerplate(id, user.id);
    },
  },
  Boilerplate: {
    author: async (parent: { authorId: string }) => {
      return await boilerplateService.getBoilerplateAuthor(parent.authorId);
    },
    likedBy: async (parent: { id: string }) => {
      return await boilerplateService.getBoilerplateLikedBy(parent.id);
    },
  },
};