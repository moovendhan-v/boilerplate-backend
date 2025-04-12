import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';

import userRoutes from './routes/user.routes';
import boilerplateRoutes from './routes/boilerplate.routes';
import authRoutes from './routes/auth.routes';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { createApolloServer } from './graphql/server';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());

// Request parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Compression and logging
app.use(compression());
app.use(morgan('dev'));

// Initialize Apollo Server
async function initializeApolloServer() {
  try {
    await createApolloServer(app);
    console.log('🚀 GraphQL server initialized successfully');
  } catch (error) {
    console.error('Failed to initialize GraphQL server:', error);
    process.exit(1);
  }
}

// Initialize GraphQL
initializeApolloServer().catch(console.error);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/boilerplates', boilerplateRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;