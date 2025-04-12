import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class UserService {
  async findUserById(id: string) {
    return prisma.user.findUnique({
      where: { id }
    });
  }

  async findUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email }
    });
  }

  async createUser(data: {
    email: string;
    password: string;
    name?: string;
  }) {
    return prisma.user.create({
      data
    });
  }

  async updateUser(id: string, data: {
    email?: string;
    name?: string;
  }) {
    return prisma.user.update({
      where: { id },
      data
    });
  }

  async deleteUser(id: string) {
    return prisma.user.delete({
      where: { id }
    });
  }
}