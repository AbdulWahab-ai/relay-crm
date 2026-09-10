export const dynamic = 'force-dynamic';
import { requireAccess } from '@/lib/access';
import { handler, jsonBody, sameOrigin, rateLimit } from '@/lib/security';
import { runAI } from '@/lib/ai/service';
export const maxDuration = 300;
export const POST = (req: Request) =>
  handler(async () => {
    sameOrigin(req);
    const a = await requireAccess();
    await rateLimit('ai:' + a.organizationId, 30, 60);
    return runAI(a, await jsonBody(req, 100000));
  });
