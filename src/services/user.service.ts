import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { GraphQLError } from 'graphql';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

export class UserService {
  async findUserById(id: string) {
    return prisma.user.findUnique({
      where: { id }
    });
  }

  async findUsers({ first, after }: { first: number; after?: string }) {
    return prisma.user.findMany({
      take: first,
      skip: after ? 1 : 0,
      cursor: after ? { id: after } : undefined,
    });
  }

  async signup(data: { email: string; password: string; name?: string }) {
    const existingUser = await this.findUserByEmail(data.email);
    if (existingUser) {
      throw new GraphQLError('Email already exists', {
        extensions: { code: 'BAD_USER_INPUT' }
      });
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
      data: {
        ...data,
        password: hashedPassword,
        role: 'USER'
      }
    });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '24h' });
    return { token, user };
  }

  async login(data: { email: string; password: string }) {
    const user = await this.findUserByEmail(data.email);
    if (!user) {
      throw new GraphQLError('Invalid credentials', {
        extensions: { code: 'UNAUTHENTICATED' }
      });
    }

    const validPassword = await bcrypt.compare(data.password, user.password);
    if (!validPassword) {
      throw new GraphQLError('Invalid credentials', {
        extensions: { code: 'UNAUTHENTICATED' }
      });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '24h' });
    return { token, user };
  }

  async updateProfile(id: string, data: { email?: string; name?: string }) {
    if (data.email) {
      const existingUser = await this.findUserByEmail(data.email);
      if (existingUser && existingUser.id !== id) {
        throw new GraphQLError('Email already exists', {
          extensions: { code: 'BAD_USER_INPUT' }
        });
      }
    }

    return prisma.user.update({
      where: { id },
      data
    });
  }

  async changePassword(id: string, data: { currentPassword: string; newPassword: string }) {
    const user = await this.findUserById(id);
    if (!user) {
      throw new GraphQLError('User not found', {
        extensions: { code: 'NOT_FOUND' }
      });
    }

    const validPassword = await bcrypt.compare(data.currentPassword, user.password);
    if (!validPassword) {
      throw new GraphQLError('Invalid current password', {
        extensions: { code: 'BAD_USER_INPUT' }
      });
    }

    const hashedPassword = await bcrypt.hash(data.newPassword, 10);
    return prisma.user.update({
      where: { id },
      data: { password: hashedPassword }
    });
  }

  async getUserBoilerplates(userId: string) {
    return prisma.boilerplate.findMany({
      where: { authorId: userId }
    });
  }

  async getLikedBoilerplates(userId: string) {
    return prisma.boilerplate.findMany({
      where: {
        likes: {
          some: {
            userId: userId
          }
        }
      }
    });
  }

  async createUser(data: { email: string; password: string; name?: string; role?: string }) {
    const existingUser = await this.findUserByEmail(data.email);
    if (existingUser) {
      throw new GraphQLError('Email already exists', {
        extensions: { code: 'BAD_USER_INPUT' }
      });
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
      data: {
        ...data,
        password: hashedPassword,
        role: data.role || 'USER'
      }
    });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '24h' });
    return { token, user };
  }

  private async findUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email }
    });
  }
}