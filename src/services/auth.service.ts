import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { GraphQLError } from 'graphql';
import * as jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export class AuthService {
  async validateUser(email: string, password: string) {
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return null;
    }

    const { password: _, ...result } = user;
    return result;
  }

  async login(user: any) {
    const payload = { email: user.email, sub: user.id };
    return {
      access_token: jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' }),
      user
    };
  }

  async signup(data: { email: string; password: string; name?: string }) {
    try {
      const hashedPassword = await bcrypt.hash(data.password, 10);
      const user = await prisma.user.create({
        data: {
          ...data,
          password: hashedPassword,
          role: 'USER',
        },
      });
      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '24h' });
      return { token, user };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError && 
        error.code === 'P2002' &&
        Array.isArray(error.meta?.target) &&
        error.meta.target.includes('email')
      ) {
        throw new GraphQLError('Email already exists', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }
      // Re-throw other errors
      if (error instanceof Error) {
        throw new GraphQLError(error.message, {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
      throw new GraphQLError('An unexpected error occurred', {
        extensions: { code: 'INTERNAL_SERVER_ERROR' },
      });
    }
  }
  
  private async findUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email }
    });
  }
  
  verifyToken(token: string) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return null;
    }
  }
}