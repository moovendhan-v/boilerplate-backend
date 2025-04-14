import 'reflect-metadata';
import express from 'express';
import { createServer } from 'http';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { PubSub } from 'graphql-subscriptions';
import Redis from 'ioredis';
import cors from 'cors';
import { json } from 'body-parser';
import { PrismaClient } from '@prisma/client';
import resolvers from './resolvers';
import typeDefs from './schema';
import { authenticate, requireAuth } from './middleware/auth.middleware';
import logger from './utils/logger';

// Initialize Redis client
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Initialize Prisma client
const prisma = new PrismaClient();

// Initialize PubSub for GraphQL subscriptions
const pubsub = new PubSub();

// Create Express app
const app = express();
const httpServer = createServer(app);

// Create WebSocket server
const wsServer = new WebSocketServer({
  server: httpServer,
  path: '/graphql',
});

// Create schema
const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

// Create Apollo Server
const server = new ApolloServer({
  schema,
  plugins: [
    ApolloServerPluginDrainHttpServer({ httpServer }),
    {
      async serverWillStart() {
        return {
          async drainServer() {
            await serverCleanup.dispose();
          },
        };
      },
    },
  ],
});

// Set up WebSocket server
const serverCleanup = useServer(
  {
    schema,
    context: async (ctx) => {
      return { prisma, redis, pubsub };
    },
  },
  wsServer
);

// Start server
async function startServer() {
  await server.start();

  // Apply middleware
  app.use(cors<cors.CorsRequest>());
  app.use(json());
  app.use(authenticate);

  // GraphQL endpoint with authentication
  app.use(
    '/graphql',
    expressMiddleware(server, {
      context: async ({ req }) => {
        return {
          prisma,
          redis,
          pubsub,
          user: req.user,
        };
      },
    })
  );

  const PORT = process.env.PORT || 4000;
  httpServer.listen(PORT, () => {
    logger.info(`🚀 Server ready at http://localhost:${PORT}/graphql`);
    logger.info(`🚀 WebSocket server ready at ws://localhost:${PORT}/graphql`);
  });
}

startServer().catch((err) => {
  logger.error('Error starting server:', err);
});