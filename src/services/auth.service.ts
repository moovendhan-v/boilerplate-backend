import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { GraphQLError } from 'graphql';
import * as jwt from 'jsonwebtoken';
import { redis } from '../config/redis';
import { Response } from 'express';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'your-refresh-secret';

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

  private generateTokens(user: any) {
    const accessToken = jwt.sign(
      { email: user.email, sub: user.id },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { sub: user.id },
      REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    return { accessToken, refreshToken };
  }

  private async storeRefreshToken(userId: string, refreshToken: string) {
    // Store in Redis with 7 days expiry
    await redis.set(
      `refresh_token:${userId}`,
      refreshToken,
      'EX',
      7 * 24 * 60 * 60
    );
  }

  async login(user: any, res: Response) {
    const { accessToken, refreshToken } = this.generateTokens(user);
    
    // Store refresh token in Redis
    await this.storeRefreshToken(user.id, refreshToken);

    // Set refresh token in HTTP-only cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', // Changed from 'strict' to 'lax' for better compatibility
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
      domain: process.env.COOKIE_DOMAIN || undefined
    });

    return {
      access_token: accessToken,
      user
    };
  }

  async signup(data: { email: string; password: string; name: string | undefined }, res: Response) {
    try {
      const hashedPassword = await bcrypt.hash(data.password, 10);
      const user = await prisma.user.create({
        data: {
          ...data,
          password: hashedPassword,
          role: 'USER',
        },
      });

      const { accessToken, refreshToken } = this.generateTokens(user);
      
      // Store refresh token in Redis
      await this.storeRefreshToken(user.id, refreshToken);

      // Set refresh token in HTTP-only cookie
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      return { token: accessToken, user };
    } catch (error: any) {
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

  async refreshToken(refreshToken: string) {
    try {
      const decoded = jwt.verify(refreshToken, REFRESH_SECRET) as { sub: string };
      
      // Check if refresh token exists in Redis
      const storedToken = await redis.get(`refresh_token:${decoded.sub}`);
      if (!storedToken || storedToken !== refreshToken) {
        throw new GraphQLError('Invalid refresh token', {
          extensions: { code: 'UNAUTHORIZED' },
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: decoded.sub },
      });

      if (!user) {
        throw new GraphQLError('User not found', {
          extensions: { code: 'UNAUTHORIZED' },
        });
      }

      // Generate new access token
      const accessToken = jwt.sign(
        { email: user.email, sub: user.id },
        JWT_SECRET,
        { expiresIn: '15m' }
      );

      return { access_token: accessToken };
    } catch (error) {
      throw new GraphQLError('Invalid refresh token', {
        extensions: { code: 'UNAUTHORIZED' },
      });
    }
  }

  async logout(userId: string, res: Response) {
    // Remove refresh token from Redis
    await redis.del(`refresh_token:${userId}`);
    
    // Clear refresh token cookie
    res.cookie('refreshToken', '', {
      httpOnly: true,
      expires: new Date(0),
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