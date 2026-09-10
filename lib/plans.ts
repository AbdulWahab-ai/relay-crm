import { Prisma } from '@prisma/client';
import { plans } from './types';
export async function ensurePlans(tx: Prisma.TransactionClient) {
  for (const [tier, p] of Object.entries(plans))
    await tx.planLimits.upsert({
      where: { tier: tier as any },
      update: {},
      create: {
        tier: tier as any,
        monthlySeatPriceUsd: p.price,
        includedActions: p.actions,
        includedTokens: p.tokens,
        maxSeats: p.seats,
      },
    });
}
export function trialPeriod() {
  const start = new Date();
  const end = new Date(start.getTime() + 14 * 86400000);
  return { currentPeriodStart: start, currentPeriodEnd: end };
}
export async function createWorkspace(
  tx: Prisma.TransactionClient,
  userId: string,
  name: string,
) {
  await ensurePlans(tx);
  return tx.organization.create({
    data: {
      name,
      slug:
        name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .slice(0, 40) +
        '-' +
        crypto.randomUUID().slice(0, 8),
      memberships: { create: { userId, role: 'admin' } },
      subscription: {
        create: {
          ...trialPeriod(),
          tier: 'starter',
          status: 'trialing',
          seats: 1,
        },
      },
    },
  });
}
