import { PrismaClient } from "@prisma/client";
import { GraphQLError } from "graphql";

const prisma = new PrismaClient();

export class UserService {
  async findUserById(id: string) {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  async findUsers({ first, after }: { first: number; after?: string }) {
    return prisma.user.findMany({
      take: first,
      skip: after ? 1 : 0,
      cursor: after ? { id: after } : undefined,
    });
  }

  async updateProfile(id: string, data: { email?: string; name?: string }) {
    if (data.email) {
      const existingUser = await this.findUserByEmail(data.email);
      if (existingUser && existingUser.id !== id) {
        throw new GraphQLError("Email already exists", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
    }

    return prisma.user.update({
      where: { id },
      data,
    });
  }

  async getUserBoilerplates(userId: string) {
    return prisma.boilerplate.findMany({
      where: { authorId: userId },
    });
  }

  async getLikedBoilerplates(userId: string) {
    return prisma.boilerplate.findMany({
      where: {
        likes: {
          some: {
            userId: userId,
          },
        },
      },
    });
  }

  private async findUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
    });
  }
}
