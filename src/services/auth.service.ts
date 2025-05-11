import { PrismaClient, Prisma, User } from "@prisma/client";
import bcrypt from "bcryptjs";
import { GraphQLError } from "graphql";
import * as jwt from "jsonwebtoken";
import { redis } from "../config/redis";
import { Response } from "express";
import logger from "../utils/logger";
import axios from "axios";

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const REFRESH_SECRET = process.env.REFRESH_SECRET || "your-refresh-secret";

// Token expiration times in seconds
const ACCESS_TOKEN_EXPIRY = "24h"; // #TODO: Update this time for productions
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days

// Type for user without password
type SafeUser = Omit<User, "password">;

// Auth response type
interface AuthResponse {
  token: string;
  refreshToken: string;
  user: SafeUser;
}

// Add these constants at the top with your other constants
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GITHUB_CALLBACK_URL = process.env.GITHUB_CALLBACK_URL;

export class AuthService {
  /**
   * Generates JWT access and refresh tokens
   * @param user User object
   * @returns Object containing access and refresh tokens
   */
  private generateTokens(user: SafeUser): {
    accessToken: string;
    refreshToken: string;
    tokenId: string;
  } {
    // Generate a unique token identifier
    const tokenId = crypto.randomUUID?.() || Date.now().toString();

    const accessToken = jwt.sign(
      {
        email: user.email,
        sub: user.id,
        role: user.role,
        jti: tokenId,
      },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    const refreshToken = jwt.sign(
      {
        sub: user.id,
        jti: tokenId,
      },
      REFRESH_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRY }
    );

    return { accessToken, refreshToken, tokenId };
  }

  /**
   * Stores refresh token in Redis with metadata
   * @param userId User ID
   * @param refreshToken Refresh token
   * @param tokenId Unique token identifier
   */
  private async storeRefreshToken(
    userId: string,
    refreshToken: string,
    tokenId: string
  ): Promise<void> {
    const tokenData = JSON.stringify({
      userId,
      tokenId,
      createdAt: new Date().toISOString(),
    });

    try {
      // Store token with user ID as part of the key for easy lookup
      await redis.set(
        `refresh_token:${userId}:${tokenId}`,
        tokenData,
        "EX",
        REFRESH_TOKEN_EXPIRY
      );

      // Also store by token value for validation
      await redis.set(
        `token:${refreshToken}`,
        tokenData,
        "EX",
        REFRESH_TOKEN_EXPIRY
      );
    } catch (error) {
      logger.error("Error storing refresh token:", error);
      throw new GraphQLError("Failed to store authentication data", {
        extensions: { code: "INTERNAL_SERVER_ERROR" },
      });
    }
  }

  /**
   * Sets refresh token cookie
   * @param res Express response object
   * @param refreshToken Refresh token
   */
  private setRefreshTokenCookie(res: Response, refreshToken: string): void {
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: REFRESH_TOKEN_EXPIRY * 1000, // Convert to milliseconds
      path: "/",
      domain: process.env.COOKIE_DOMAIN || undefined,
    });
  }

  /**
   * Refreshes access token using refresh token
   * @param refreshToken Refresh token
   * @returns Object with new access token and user details
   */
  async refreshToken(
    refreshToken: string,
    res: Response
  ): Promise<{ access_token: string; refreshToken: string; user: SafeUser }> {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, REFRESH_SECRET) as {
        sub: string;
        jti: string;
      };
      const userId = decoded.sub;
      const tokenId = decoded.jti;

      // Check if refresh token exists in Redis
      const tokenData = await redis.get(`token:${refreshToken}`);
      if (!tokenData) {
        logger.warn(
          `Token refresh failed: Token not found in Redis for user ${userId}`
        );
        throw new GraphQLError("Invalid refresh token", {
          extensions: { code: "UNAUTHORIZED" },
        });
      }

      // Parse token data
      const parsedTokenData = JSON.parse(tokenData);

      // Verify token belongs to the correct user
      if (parsedTokenData.userId !== userId) {
        logger.warn(`Token refresh failed: Token belongs to different user`);
        throw new GraphQLError("Invalid refresh token", {
          extensions: { code: "UNAUTHORIZED" },
        });
      }

      // Get user from database
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        logger.warn(`Token refresh failed: User ${userId} not found`);
        throw new GraphQLError("User not found", {
          extensions: { code: "UNAUTHORIZED" },
        });
      }

      const { ...safeUser } = user;
      const {
        accessToken,
        refreshToken: newRefreshToken,
        tokenId: newTokenId,
      } = this.generateTokens(safeUser);

      // Invalidate old token
      await redis.del(`token:${refreshToken}`);
      await redis.del(`refresh_token:${userId}:${tokenId}`);

      // Store new refresh token
      await this.storeRefreshToken(userId, newRefreshToken, newTokenId);

      // Fix: Use newRefreshToken instead of refreshToken
      this.setRefreshTokenCookie(res, newRefreshToken);

      logger.info(`Access token refreshed for user ${userId}`);

      return {
        access_token: accessToken,
        refreshToken: newRefreshToken,
        user: safeUser,
      };
    } catch (error) {
      // Error handling code remains unchanged
      if (error instanceof jwt.JsonWebTokenError) {
        logger.warn("Token refresh failed: JWT validation error", {
          error: error.message,
        });
        throw new GraphQLError("Invalid refresh token", {
          extensions: { code: "UNAUTHORIZED" },
        });
      }

      if (error instanceof GraphQLError) {
        throw error;
      }

      logger.error("Token refresh error:", error);
      throw new GraphQLError("Authentication error", {
        extensions: { code: "UNAUTHORIZED" },
      });
    }
  }

  /**
   * Handles user logout
   * @param userId User ID
   * @param res Express response object
   */
  async logout(userId: string, res: Response): Promise<void> {
    try {
      // Find and remove all refresh tokens for this user
      const keys = await redis.keys(`refresh_token:${userId}:*`);
      if (keys.length > 0) {
        await redis.del(keys);
        logger.info(`Removed ${keys.length} refresh tokens for user ${userId}`);
      }

      // Clear refresh token cookie
      res.cookie("refreshToken", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        expires: new Date(0),
        path: "/",
        domain: process.env.COOKIE_DOMAIN || undefined,
      });

      logger.info(`User ${userId} logged out successfully`);
    } catch (error) {
      logger.error("Logout error:", error);
      throw new GraphQLError("Logout failed", {
        extensions: { code: "INTERNAL_SERVER_ERROR" },
      });
    }
  }

  /**
   * Verifies JWT access token
   * @param token Access token
   * @returns Decoded token payload or null if invalid
   */
  verifyToken(token: string): any {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      logger.warn("Token verification failed:", error);
      return null;
    }
  }

  /**
   * Handles GitHub OAuth authentication
   * @param code GitHub authorization code
   * @param res Express response object
   */
  async githubAuth(code: string, res: Response): Promise<AuthResponse> {
    try {
      // Exchange code for access token
      const tokenResponse = await axios.post(
        "https://github.com/login/oauth/access_token",
        {
          client_id: GITHUB_CLIENT_ID,
          client_secret: GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: GITHUB_CALLBACK_URL,
        },
        {
          headers: {
            Accept: "application/json",
          },
        }
      );

      const accessToken = tokenResponse.data.access_token;

      // Get user data from GitHub
      const githubUser = await axios.get("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      // Get user email from GitHub
      const emails = await axios.get("https://api.github.com/user/emails", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const primaryEmail = emails.data.find(
        (email: any) => email.primary
      )?.email;

      // Type-safe approach for finding user
      let user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: primaryEmail },
            { githubId: githubUser.data.id.toString() },
          ],
        },
      });

      if (!user) {
        // Create new user with type-safe data
        user = await prisma.user.create({
          data: {
            email: primaryEmail,
            name: githubUser.data.name || "GitHub User",
            avatar: githubUser.data.avatar_url,
            role: "USER",
            authProvider: "GITHUB",
            githubId: githubUser.data.id.toString(),
            githubToken: accessToken,
          },
        });
      } else {
        // Update existing user with type-safe data
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            githubId: githubUser.data.id.toString(),
            githubToken: accessToken,
            avatar: githubUser.data.avatar_url,
            name: user.name || githubUser.data.name,
            authProvider: "GITHUB",
          },
        });
      }

      // Remove password from user object
      const { ...safeUser } = user;

      // Generate tokens
      const {
        accessToken: jwtToken,
        refreshToken,
        tokenId,
      } = this.generateTokens(safeUser);

      // Store refresh token
      await this.storeRefreshToken(user.id, refreshToken, tokenId);

      // Set refresh token cookie
      this.setRefreshTokenCookie(res, refreshToken);

      logger.info(`User ${user.id} authenticated via GitHub`);

      return {
        token: jwtToken,
        refreshToken,
        user: safeUser,
      };
    } catch (error) {
      logger.error("GitHub authentication error:", error);
      throw new GraphQLError("GitHub authentication failed", {
        extensions: { code: "INTERNAL_SERVER_ERROR" },
      });
    }
  }
}
