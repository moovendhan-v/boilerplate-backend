import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { loadSchemaSync } from '@graphql-tools/load';
import { GraphQLFileLoader } from '@graphql-tools/graphql-file-loader';
import { join } from 'path';
import cors from 'cors';
import express from 'express';
import { json } from 'body-parser';

// Import resolvers
import { boilerplateResolvers } from '../resolvers/boilerplate.resolver';

// Load schema
const schema = loadSchemaSync(join(__dirname, '../schema/**/*.graphql'), {
  loaders: [new GraphQLFileLoader()]
});

// Merge resolvers
const resolvers = {
  ...boilerplateResolvers,
};

// Create Apollo Server
export async function createApolloServer(app: express.Application) {
  const server = new ApolloServer({
    typeDefs: schema,
    resolvers,
  });

  // Start the server
  await server.start();

  const corsOptions = {
    origin: 'http://localhost:8080',
    credentials: true,
  };
  
  app.use(
    '/graphql',
    cors(corsOptions),
    json(),
    expressMiddleware(server, {
      context: async ({ req }) => ({
        token: req.headers.authorization,
      }),
    }),
  );

  return server;
}