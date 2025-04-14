export interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
}

export interface Context {
  user?: User;
}

// src/types/context.ts
// import { PrismaClient } from '@prisma/client';
// import { Redis } from 'ioredis';
// import { PubSub } from 'graphql-subscriptions';

// export interface Context {
//   prisma: PrismaClient;
//   redis: Redis;
//   pubsub: PubSub;
//   user?: {
//     id: string;
//     email: string;
//     roles: string[];
//     // Add any other user properties you need
//   } | null;
// }