// server.ts
import express from 'express';
import { createServer } from 'http';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { loadSchemaSync } from '@graphql-tools/load';
import { GraphQLFileLoader } from '@graphql-tools/graphql-file-loader';
import { PubSub } from 'graphql-subscriptions';
import Redis from 'ioredis';
import cors from 'cors';
import { json } from 'body-parser';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import logger from './utils/logger';
import cookieParser from 'cookie-parser';
import { authenticate } from './middleware/auth.middleware';

// Import resolvers
import { boilerplateResolvers } from './resolvers/boilerplate.resolver';
// Merge resolvers
const resolvers = {
  ...boilerplateResolvers,
  // Add other resolvers here
};

async function startServer() {
  // Initialize clients
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  const prisma = new PrismaClient();
  const pubsub = new PubSub();

  // Create Express app
  const app = express();
  const httpServer = createServer(app);

  try {
    // When you're ready to go back to file-based schemas:
    const typeDefs = loadSchemaSync(path.join(__dirname, './schema/**/*.graphql'), {
      loaders: [new GraphQLFileLoader()]
    });

    // Create schema
    const schema = makeExecutableSchema({
      typeDefs,
      resolvers,
    });

    // Create WebSocket server for subscriptions
    const wsServer = new WebSocketServer({
      server: httpServer,
      path: '/graphql',
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

    // Create Apollo Server
    const server = new ApolloServer({
      schema,
      csrfPrevention: false, // Disable for development
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

    // Start Apollo Server
    await server.start();

    // CORS middleware for all routes
    app.use(cors({
      origin: 'http://localhost:8080',
      credentials: true,
      methods: ['POST', 'GET', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }));

    // Explicit OPTIONS handler for CORS preflight
    app.options('/graphql', (req, res) => {
      res.header('Access-Control-Allow-Origin', 'http://localhost:8080');
      res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.header('Access-Control-Allow-Credentials', 'true');
      res.sendStatus(200);
    });

    // Apply middleware
    app.use(
      '/graphql',
      json(),
      cookieParser(),
      authenticate,
      expressMiddleware(server, {
        context: async ({ req }) => {
          return {
            prisma,
            redis,
            pubsub,
            user: req.user,
            token: req.headers.authorization,
          };
        },
      })
    );

    // Start HTTP server
    const PORT = process.env.PORT || 4000;
    httpServer.listen(PORT, () => {
      logger.info(`🚀 GraphQL server ready at http://localhost:${PORT}/graphql`);
      logger.info(`🚀 Subscriptions ready at ws://localhost:${PORT}/graphql`);
    });

    return { app, httpServer, server };
  } catch (error: any) {
    logger.error(`Schema initialization error: ${error?.message}`, { error });
    throw error;
  }
}

// Start the server
startServer().catch((err) => {
  logger.error('Error starting server:', err);
  process.exit(1);
});