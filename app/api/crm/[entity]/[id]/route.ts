export const dynamic = 'force-dynamic';
import { requireAccess } from '@/lib/access';
import { handler, jsonBody, sameOrigin, rateLimit } from '@/lib/security';
import { entityName, getRecord, mutateCRM } from '@/lib/crm';
type Context = { params: Promise<{ entity: string; id: string }> };
export const GET = (_: Request, context: Context) =>
  handler(async () => {
    const params = await context.params;
    return getRecord(
      await requireAccess(),
      entityName(params.entity),
      params.id,
    );
  });
export const PATCH = (req: Request, context: Context) =>
  handler(async () => {
    const params = await context.params;
    sameOrigin(req);
    const a = await requireAccess();
    await rateLimit('crm:' + a.userId, 120, 60);
    return mutateCRM(
      a,
      entityName(params.entity),
      'PATCH',
      params.id,
      await jsonBody(req),
    );
  });
export const DELETE = (req: Request, context: Context) =>
  handler(async () => {
    const params = await context.params;
    sameOrigin(req);
    return mutateCRM(
      await requireAccess(),
      entityName(params.entity),
      'DELETE',
      params.id,
      {},
    );
  });
