import { userResolvers } from './user.resolver';
import { boilerplateResolvers } from './boilerplate.resolver';
import { mergeResolvers } from '@graphql-tools/merge';

const resolvers = mergeResolvers([userResolvers, boilerplateResolvers]);

export default resolvers;