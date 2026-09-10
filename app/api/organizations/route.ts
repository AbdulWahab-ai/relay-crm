export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireUser, requireAccess, admin } from '@/lib/access';
import { createWorkspace } from '@/lib/plans';
import {
  handler,
  jsonBody,
  sameOrigin,
  rateLimit,
  AppError,
} from '@/lib/security';
export const GET = () =>
  handler(async () => {
    const userId = await requireUser();
    return db.membership.findMany({
      where: { userId },
      include: { organization: true },
    });
  });
export const POST = (req: Request) =>
  handler(async () => {
    sameOrigin(req);
    const userId = await requireUser();
    await rateLimit('org-create:' + userId, 5, 86400);
    const p = z
      .object({ name: z.string().trim().min(2).max(120) })
      .parse(await jsonBody(req));
    return db.$transaction((tx) => createWorkspace(tx, userId, p.name));
  });
export const PATCH = (req: Request) =>
  handler(async () => {
    sameOrigin(req);
    const a = await requireAccess();
    admin(a);
    const p = z
      .object({
        name: z.string().trim().min(2).max(120).optional(),
        userId: z.string().optional(),
        role: z.enum(['admin', 'manager', 'sales_rep']).optional(),
      })
      .parse(await jsonBody(req));
    if (p.name)
      return db.organization.update({
        where: { id: a.organizationId },
        data: { name: p.name },
      });
    if (p.userId && p.role)
      return db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${a.organizationId}))`;
        const current = await tx.membership.findUnique({
          where: {
            organizationId_userId: {
              organizationId: a.organizationId,
              userId: p.userId!,
            },
          },
        });
        if (!current) throw new AppError(404, 'Member not found');
        if (
          current.role === 'admin' &&
          p.role !== 'admin' &&
          (await tx.membership.count({
            where: { organizationId: a.organizationId, role: 'admin' },
          })) <= 1
        )
          throw new AppError(400, 'Keep at least one organization admin');
        return tx.membership.update({
          where: {
            organizationId_userId: {
              organizationId: a.organizationId,
              userId: p.userId!,
            },
          },
          data: { role: p.role },
        });
      });
    throw new AppError(400, 'Provide a workspace name or member role');
  });
