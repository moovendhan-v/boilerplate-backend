import { BoilerplateService } from '../services/boilerplate.service';

const boilerplateService = new BoilerplateService();

export const boilerplateResolvers = {
  Query: {
    boilerplate: async (_, { id }) => {
      return await boilerplateService.findBoilerplateById(id);
    },
    boilerplates: async (_, { skip, take, where, orderBy }) => {
      return await boilerplateService.findBoilerplates({ skip, take, where, orderBy });
    },
  },
  Mutation: {
    createBoilerplate: async (_, { data }) => {
      return await boilerplateService.createBoilerplate(data);
    },
    updateBoilerplate: async (_, { id, data }) => {
      return await boilerplateService.updateBoilerplate(id, data);
    },
    deleteBoilerplate: async (_, { id }) => {
      await boilerplateService.deleteBoilerplate(id);
      return true;
    },
  },
  Boilerplate: {
    author: async (parent) => {
      // The author is already included in the service layer
      return parent.author;
    },
    tags: async (parent) => {
      // Tags are already included in the service layer
      return parent.tags;
    },
  },
};