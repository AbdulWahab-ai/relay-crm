export const dynamic = 'force-dynamic';
import { db } from '@/lib/db';
import { dashboardSummary } from '@/lib/dashboard';
import { requireAccess, scope } from '@/lib/access';
import { handler, jsonBody, sameOrigin, rateLimit } from '@/lib/security';
import { entityName, listCRM, mutateCRM } from '@/lib/crm';
import { usageSummary } from '@/lib/billing';
export const GET = (
  req: Request,
  context: { params: Promise<{ entity: string }> },
) =>
  handler(async () => {
    const params = await context.params;
    const a = await requireAccess();
    if (params.entity === 'bootstrap') {
      const [
        contacts,
        deals,
        activities,
        members,
        memberships,
        usage,
        dashboard,
      ] = await Promise.all([
        db.contact.findMany({
          where: scope(a),
          take: 1000,
          orderBy: { updatedAt: 'desc' },
        }),
        db.deal.findMany({
          where: scope(a),
          take: 1000,
          orderBy: { updatedAt: 'desc' },
        }),
        db.activity.findMany({
          where: scope(a),
          take: 1000,
          orderBy: { updatedAt: 'desc' },
        }),
        db.membership.findMany({
          where: { organizationId: a.organizationId },
          include: { user: { select: { name: true, email: true } } },
        }),
        db.membership.findMany({
          where: { userId: a.userId },
          include: { organization: true },
        }),
        usageSummary(a),
        dashboardSummary(a),
      ]);
      return {
        contacts,
        deals: deals.map((d) => ({ ...d, value: Number(d.value) })),
        activities,
        members,
        organizations: memberships.map((m) => ({
          id: m.organizationId,
          name: m.organization.name,
          role: m.role,
        })),
        organizationId: a.organizationId,
        userId: a.userId,
        usage,
        dashboard,
      };
    }
    return listCRM(a, entityName(params.entity), new URL(req.url).searchParams);
  });
export const POST = (
  req: Request,
  context: { params: Promise<{ entity: string }> },
) =>
  handler(async () => {
    const params = await context.params;
    sameOrigin(req);
    const a = await requireAccess();
    await rateLimit('crm:' + a.userId, 120, 60);
    return mutateCRM(
      a,
      entityName(params.entity),
      'POST',
      undefined,
      await jsonBody(req),
    );
  });
