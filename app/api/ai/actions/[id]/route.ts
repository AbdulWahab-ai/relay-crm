export const dynamic = 'force-dynamic';
import { requireAccess } from '@/lib/access';
import { handler, jsonBody, sameOrigin } from '@/lib/security';
import { confirmAction } from '@/lib/ai/tools';
export const POST = (
  req: Request,
  context: { params: Promise<{ id: string }> },
) =>
  handler(async () => {
    const params = await context.params;
    sameOrigin(req);
    return confirmAction(await requireAccess(), params.id, await jsonBody(req));
  });
