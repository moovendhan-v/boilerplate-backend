// server.ts
import express from "express";
import { createServer } from "http";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/lib/use/ws";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { loadSchemaSync } from "@graphql-tools/load";
import { GraphQLFileLoader } from "@graphql-tools/graphql-file-loader";
import { PubSub } from "graphql-subscriptions";
import Redis from "ioredis";
import cors from "cors";
import { json } from "body-parser";
import { PrismaClient } from "@prisma/client";
import path from "path";
import logger from "./utils/logger";
import cookieParser from "cookie-parser";
import { authenticate } from "./middleware/auth.middleware";
import { validateSchema } from "graphql";
import { requestLogger, errorLogger } from "./middleware/logger.middleware";
import crypto from "crypto";

// Import resolvers
import { boilerplateResolvers } from "./resolvers/boilerplate.resolver";
import { userResolvers } from "./resolvers/user.resolver";

// Merge resolvers properly
const resolvers = {
  Query: {
    ...(userResolvers.Query || {}),
    ...(boilerplateResolvers.Query || {}),
  },
  Mutation: {
    ...(userResolvers.Mutation || {}),
    ...(boilerplateResolvers.Mutation || {}),
  },
  // Add resolver types
  User: userResolvers.User,
  Boilerplate: boilerplateResolvers.Boilerplate,
  // Add other types as needed
};

// Debug function to log resolver structure
function logResolverKeys(resolvers: Record<string, any>) {
  for (const typeName in resolvers) {
    console.log(`Resolver type: ${typeName}`);
    if (typeof resolvers[typeName] === "object") {
      console.log(`  Fields: ${Object.keys(resolvers[typeName]).join(", ")}`);
    }
  }
}

async function startServer() {
  // Initialize clients
  const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
  const prisma = new PrismaClient();
  const pubsub = new PubSub();

  // Create Express app
  const app = express();

  const httpServer = createServer(app);

  try {
    // Log the resolver structure for debugging
    console.log("=== RESOLVER STRUCTURE ===");
    logResolverKeys(resolvers);

    // When you're ready to go back to file-based schemas:
    const typeDefs = loadSchemaSync(
      path.join(__dirname, "./schema/**/*.graphql"),
      {
        loaders: [new GraphQLFileLoader()],
      }
    );

    // Create schema
    const schema = makeExecutableSchema({
      typeDefs,
      resolvers,
    });

    // Validate schema
    const validationErrors = validateSchema(schema);
    if (validationErrors.length > 0) {
      console.error("Schema validation errors:", validationErrors);
      throw new Error("Schema validation failed");
    }

    // Create WebSocket server for subscriptions
    const wsServer = new WebSocketServer({
      server: httpServer,
      path: "/graphql",
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

    const getCleanStackTrace = () => {
      return new Error().stack
        ?.split("\n")
        .filter(
          (line) => !line.includes("node_modules") && line.includes(".ts")
        )
        .slice(1, 3)
        .map((line) => `     ↳ ${line.trim()}`)
        .join("\n");
    };

    const hashQuery = (query: string = "") =>
      crypto.createHash("sha256").update(query).digest("hex");

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
          async requestDidStart(requestContext) {
            const startTime = Date.now();
            const operationName =
              requestContext.request.operationName || "anonymous";
            const query = requestContext.request.query
              ?.trim()
              .replace(/\s+/g, " ");
            const queryHash = hashQuery(query);

            logger.info(`📥 Request started: ${operationName}`);
            logger.info(`🔹 Query: ${query}`);
            logger.info(`🔹 Query Hash: ${queryHash}`);
            logger.info(
              `🔹 Variables: ${JSON.stringify(
                requestContext.request.variables
              )}`
            );

            return {
              async didResolveOperation(ctx) {
                if (!ctx.operation) {
                  return;
                }
                const operationType = ctx.operation.operation;
                logger.info(
                  `✅ Operation resolved: ${operationType} ${operationName}`
                );
              },

              async executionDidStart() {
                return {
                  willResolveField({ info, args, contextValue }) {
                    const fieldStart = Date.now();
                    const path = `${info.parentType.name}.${info.fieldName}`;
                    const trace = getCleanStackTrace();

                    logger.debug(`🔍 Resolving field: ${path}`);
                    logger.debug(`   ➤ Args: ${JSON.stringify(args)}`);
                    logger.debug(`   ➤ Parent Type: ${info.parentType.name}`);
                    logger.debug(`   ➤ Return Type: ${info.returnType}`);
                    if (trace) logger.debug(`   ➤ Trace:\n${trace}`);

                    // if (contextValue?.user) {
                    //   logger.debug(
                    //     `   ➤ User: ${contextValue.user.email} (${contextValue.user.role})`
                    //   );
                    // }

                    return (error, result) => {
                      const duration = Date.now() - fieldStart;
                      if (error) {
                        logger.error(
                          `❌ Error in ${path} (${duration}ms):`,
                          error
                        );
                      } else {
                        logger.debug(`✅ Resolved ${path} in ${duration}ms`);
                      }
                    };
                  },
                };
              },
              async didEncounterErrors(ctx) {
                logger.error(`❗ GraphQL errors in ${operationName}:`);
                ctx.errors.forEach((err, index) => {
                  logger.error(`  ${index + 1}. Message: ${err.message}`);
                  if (err.path)
                    logger.error(`     Path: ${err.path.join(".")}`);
                  if (err.originalError?.stack) {
                    logger.error(`     Stack:\n${err.originalError.stack}`);
                  }
                });
              },

              async willSendResponse(ctx) {
                const totalTime = Date.now() - startTime;
                logger.info(
                  `📤 Response sent for ${operationName} in ${totalTime}ms`
                );
              },
            };
          },
        },
      ],
    });

    // Start Apollo Server
    await server.start();

    // Apply global middleware for all routes
    // 1. Add request logger as early as possible for all routes
    app.use(requestLogger);

    // 2. Standard middleware
    app.use(json());
    app.use(cookieParser());

    // 3. CORS middleware for all routes
    app.use(
      cors({
        origin: "http://localhost:8080",
        credentials: true,
        methods: ["POST", "GET", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
      })
    );

    // Explicit OPTIONS handler for CORS preflight
    app.options("/graphql", (req, res) => {
      res.header("Access-Control-Allow-Origin", "http://localhost:8080");
      res.header("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.header("Access-Control-Allow-Credentials", "true");
      res.sendStatus(200);
    });

    // Apply middleware with better error handling for GraphQL
    app.use(
      "/graphql",
      (req, res, next) => {
        try {
          authenticate(req, res, next);
        } catch (error) {
          logger.error("Authentication middleware error:", error);
          next(error);
        }
      },
      expressMiddleware(server, {
        context: async ({ req, res }) => {
          try {
            const context = {
              prisma,
              redis,
              pubsub,
              user: req.user,
              token: req.headers.authorization,
              req,
              res,
            };

            logger.info("[GraphQL] Request context created", {
              user: req.user ? `ID: ${req.user.sub}` : "anonymous",
              hasToken: !!req.headers.authorization,
            });

            return context;
          } catch (error) {
            logger.error("Error creating context:", error);
            // Return a basic context even on error
            return { prisma, redis, pubsub };
          }
        },
      })
    );

    // Add global error logger as the last middleware
    app.use(errorLogger);

    // Start HTTP server
    const PORT = process.env.PORT || 4000;
    httpServer.listen(PORT, () => {
      logger.info(
        `🚀 GraphQL server ready at http://localhost:${PORT}/graphql`
      );
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
  logger.error("Error starting server:", err);
  process.exit(1);
});
