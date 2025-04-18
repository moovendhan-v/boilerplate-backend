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
import { validateSchema } from 'graphql';

// Import resolvers
import { boilerplateResolvers } from './resolvers/boilerplate.resolver';
import { userResolvers } from './resolvers/user.resolver';

// Merge resolvers properly
const resolvers = {
  Query: {
    ...(boilerplateResolvers.Query || {}),
    ...(userResolvers.Query || {}),
  },
  Mutation: {
    ...(boilerplateResolvers.Mutation || {}),
    ...(userResolvers.Mutation || {}),
  },
  // Add resolver types
  Boilerplate: boilerplateResolvers.Boilerplate,
  User: userResolvers.User,
  // Add other types as needed
};

// Debug function to log resolver structure
function logResolverKeys(resolvers: Record<string, any>) {
  for (const typeName in resolvers) {
    console.log(`Resolver type: ${typeName}`);
    if (typeof resolvers[typeName] === 'object') {
      console.log(`  Fields: ${Object.keys(resolvers[typeName]).join(', ')}`);
    }
  }
}

async function startServer() {
  // Initialize clients
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  const prisma = new PrismaClient();
  const pubsub = new PubSub();

  // Create Express app
  const app = express();
  const httpServer = createServer(app);

  try {
    // Log the resolver structure for debugging
    console.log('=== RESOLVER STRUCTURE ===');
    logResolverKeys(resolvers);
    
    // When you're ready to go back to file-based schemas:
    const typeDefs = loadSchemaSync(path.join(__dirname, './schema/**/*.graphql'), {
      loaders: [new GraphQLFileLoader()]
    });

    // Create schema
    const schema = makeExecutableSchema({
      typeDefs,
      resolvers,
    });
    
    // Validate schema
    const validationErrors = validateSchema(schema);
    if (validationErrors.length > 0) {
      console.error('Schema validation errors:', validationErrors);
      throw new Error('Schema validation failed');
    }

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
        // Add a plugin to log resolver execution for debugging
        {
          async requestDidStart() {
            return {
              async didResolveOperation(context) {
                console.log(`Operation: ${context.operationName || 'anonymous'}`);
              },
              async didEncounterErrors(ctx) {
                console.error('GraphQL errors:', ctx.errors);
              },
              async executionDidStart() {
                return {
                  willResolveField({ info }) {
                    console.log(`Resolving field: ${info.parentType.name}.${info.fieldName}`);
                    return (error) => {
                      if (error) {
                        console.error(`Error resolving ${info.parentType.name}.${info.fieldName}:`, error);
                      }
                    };
                  },
                };
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

    // Add a middleware to log incoming requests
    app.use('/graphql', (req, res, next) => {
      console.log('Incoming GraphQL request:', {
        method: req.method,
        path: req.path,
        headers: {
          auth: req.headers.authorization ? 'Present' : 'Not present',
          contentType: req.headers['content-type'],
        },
        body: req.body ? 'Present' : 'Not present',
      });
      next();
    });

    // Add an error middleware
    app.use((err: any, req: any, res: any, next: (arg0: any) => void) => {
      console.error('Express error middleware caught:', err);
      next(err);
    });

    // Apply middleware with better error handling
    app.use(
      '/graphql',
      json(),
      cookieParser(),
      (req, res, next) => {
        try {
          authenticate(req, res, next);
        } catch (error) {
          console.error('Authentication middleware error:', error);
          next(error);
        }
      },
      expressMiddleware(server, {
        context: async ({ req }) => {
          try {
            const context = {
              prisma,
              redis,
              pubsub,
              user: req.user,
              token: req.headers.authorization,
            };
      
            console.log('[GraphQL] Request context created:', {
              user: req.user ? `ID: ${req.user.id}` : 'anonymous',
              hasToken: !!req.headers.authorization,
            });
            
            return context;
          } catch (error) {
            console.error('Error creating context:', error);
            // Return a basic context even on error
            return { prisma, redis, pubsub };
          }
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