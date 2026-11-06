import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.ts";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL must be set before initializing Prisma");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

export const connectPrisma = async () => {
  await prisma.$connect();
  await prisma.$queryRaw`SELECT 1`;
};

export const disconnectPrisma = async () => {
  await prisma.$disconnect();
};

export default prisma;
