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
import { GraphQLScalarType, validateSchema } from "graphql";
import { requestLogger, errorLogger } from "./middleware/logger.middleware";
import crypto from "crypto";
import { GraphQLUpload, graphqlUploadExpress } from "graphql-upload-minimal";

import { boilerplateResolvers } from "./resolvers/boilerplate.resolver";
import { userResolvers } from "./resolvers/user.resolver";
import {
  errorStatusMap,
  isErrorCode,
  STATUS_CODES,
} from "./utils/errorHandler";

// Merge resolvers
const resolvers = {
  Query: {
    ...(userResolvers.Query || {}),
    ...(boilerplateResolvers.Query || {}),
  },
  Mutation: {
    ...(userResolvers.Mutation || {}),
    ...(boilerplateResolvers.Mutation || {}),
  },
  User: userResolvers.User,
  Boilerplate: boilerplateResolvers.Boilerplate,
  // Upload: GraphQLUpload,
};

function logResolverKeys(resolvers: Record<string, any>) {
  for (const typeName in resolvers) {
    console.log(`Resolver type: ${typeName}`);
    if (typeof resolvers[typeName] === "object") {
      console.log(`  Fields: ${Object.keys(resolvers[typeName]).join(", ")}`);
    }
  }
}

async function startServer() {
  const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
  const prisma = new PrismaClient();
  const pubsub = new PubSub();
  const app = express();
  const httpServer = createServer(app);

  const allowedOrigins = [
    process.env.CLIENT_URL || "http://localhost:8080",
    "http://localhost:8080",
    "http://[::1]:8080"
  ];

  // Define the CORS options once
  const corsOptions = {
    origin: allowedOrigins,
    credentials: true,
    methods: ["POST", "GET", "OPTIONS", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization", "Apollo-Require-Preflight"]
  };

  console.log("=== RESOLVER STRUCTURE ===");
  logResolverKeys(resolvers);

  const typeDefs = loadSchemaSync(
    path.join(__dirname, "./schema/**/*.graphql"),
    { loaders: [new GraphQLFileLoader()] }
  );

  const schema = makeExecutableSchema({ typeDefs, resolvers });

  const validationErrors = validateSchema(schema);
  if (validationErrors.length > 0) {
    console.error("Schema validation errors:", validationErrors);
    throw new Error("Schema validation failed");
  }

  const wsServer = new WebSocketServer({
    server: httpServer,
    path: "/graphql",
  });
  const serverCleanup = useServer(
    {
      schema,
      context: async (ctx) => ({ prisma, redis, pubsub }),
    },
    wsServer
  );

  const getCleanStackTrace = () => {
    return new Error().stack
      ?.split("\n")
      .filter((line) => !line.includes("node_modules") && line.includes(".ts"))
      .slice(1, 3)
      .map((line) => `     ↳ ${line.trim()}`)
      .join("\n");
  };

  const hashQuery = (query = "") =>
    crypto.createHash("sha256").update(query).digest("hex");

  const server = new ApolloServer({
    schema,
    csrfPrevention: false,
    formatError: (formattedError, error: unknown) => {
      const status =
        typeof formattedError.extensions?.status === "number"
          ? formattedError.extensions.status
          : formattedError.extensions?.code === "UNAUTHENTICATED"
          ? 401
          : formattedError.extensions?.code === "FORBIDDEN"
          ? 403
          : formattedError.extensions?.code === "BAD_USER_INPUT"
          ? 400
          : 500;

      return {
        ...formattedError,
        extensions: {
          ...formattedError.extensions,
          status,
        },
      };
    },
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
            `🔹 Variables: ${JSON.stringify(requestContext.request.variables)}`
          );

          return {
            async didResolveOperation(ctx) {
              if (!ctx.operation) return;
              const operationType = ctx.operation.operation;
              logger.info(
                `✅ Operation resolved: ${operationType} ${operationName}`
              );
            },
            async executionDidStart() {
              return {
                willResolveField({ info, args }) {
                  const path = `${info.parentType.name}.${info.fieldName}`;
                  const trace = getCleanStackTrace();
                  // logger.debug(`🔍 Resolving field: ${path}`);
                  // logger.debug(`   ➤ Args: ${JSON.stringify(args)}`);
                },
              };
            },
          };
        },
      },
    ],
  });

  await server.start();

  // Apply middleware in the correct order
  app.use(json());
  app.use(cookieParser());
  app.use(cors(corsOptions));

  // ADD THIS LINE - Add the upload middleware before the GraphQL endpoint
  app.use(graphqlUploadExpress({ maxFileSize: 10000000, maxFiles: 10 }));

  // Explicit OPTIONS handler for CORS preflight
  app.options("/graphql", cors(corsOptions));

  // Add the status code middleware for GraphQL errors
  app.use("/graphql", (req, res, next) => {
    const originalSend = res.send;

    res.send = function (body) {
      try {
        const parsedBody = JSON.parse(body);

        if (parsedBody?.errors?.length > 0) {
          const firstError = parsedBody.errors[0];

          // Case 1: use extension status directly
          if (
            firstError.extensions?.status &&
            typeof firstError.extensions.status === "number"
          ) {
            res.status(firstError.extensions.status);
          }

          // Case 2: use code and errorStatusMap
          else if (
            firstError.extensions?.code &&
            isErrorCode(firstError.extensions.code)
          ) {
            const code = firstError.extensions.code;
            const statusCode =
              errorStatusMap[code as keyof typeof errorStatusMap];
            res.status(statusCode);
          }

          // Default fallback
          else {
            res.status(STATUS_CODES.SERVER_ERROR.INTERNAL_SERVER_ERROR);
          }
        }
      } catch (e) {
        console.error("Error processing GraphQL response:", e);
      }

      return originalSend.call(this, body);
    };

    next();
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
          return { prisma, redis, pubsub, res };
        }
      },
    })
  );

  app.use(errorLogger);

  const PORT = process.env.PORT || 4000;
  httpServer.listen(PORT, () => {
    logger.info(`🚀 Server ready at http://localhost:${PORT}/graphql`);
  });
}

startServer().catch((err) => {
  logger.error("❌ Failed to start server", err);
});