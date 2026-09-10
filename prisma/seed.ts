import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import { sampleData } from '../lib/sample-data';
import { ensurePlans } from '../lib/plans';
const db = new PrismaClient();
async function main() {
  if (process.env.ALLOW_DEMO_SEED !== 'true')
    throw Error(
      'Set ALLOW_DEMO_SEED=true only on a development or test database.',
    );
  const password = process.env.SEED_PASSWORD;
  if (!password || password.length < 12)
    throw Error(
      'Set SEED_PASSWORD to a unique password of at least 12 characters.',
    );
  const passwordHash = await hash(password, 12);
  await db.$transaction(
    async (tx) => {
      await ensurePlans(tx);
      const fixture = sampleData();
      for (const m of fixture.members)
        await tx.user.upsert({
          where: { id: m.userId },
          update: {},
          create: {
            id: m.userId,
            name: m.user.name,
            email: m.user.email,
            passwordHash,
            emailVerified: new Date(),
          },
        });
      for (const org of fixture.organizations) {
        if (await tx.organization.findUnique({ where: { id: org.id } }))
          continue;
        const data = sampleData(org.id);
        await tx.organization.create({
          data: {
            id: org.id,
            name: org.name,
            slug: org.id,
            memberships: {
              create: data.members.map((m) => ({
                userId: m.userId,
                role: m.role,
              })),
            },
            subscription: {
              create: {
                tier: 'starter',
                status: 'trialing',
                seats: 3,
                currentPeriodStart: new Date(),
                currentPeriodEnd: new Date(Date.now() + 14 * 86400000),
              },
            },
          },
        });
        await tx.contact.createMany({ data: data.contacts });
        await tx.deal.createMany({ data: data.deals });
        await tx.activity.createMany({ data: data.activities });
      }
    },
    { timeout: 20000 },
  );
  console.log(
    'Seed complete: two organizations, three users, 24 contacts, 24 deals and 22 activities. Existing organizations were preserved.',
  );
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
