import { PrismaClient } from '@prisma/client';
const globalDB = globalThis as unknown as { prisma?: PrismaClient };
export const db = globalDB.prisma || new PrismaClient({ log: ['error'] });
if (process.env.NODE_ENV !== 'production') globalDB.prisma = db;
