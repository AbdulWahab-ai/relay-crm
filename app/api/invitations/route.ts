export const dynamic = 'force-dynamic';
import { handler, jsonBody, sameOrigin, rateLimit } from '@/lib/security';
import { requireAccess } from '@/lib/access';
import { invite } from '@/lib/invitations';
export const POST = (req: Request) =>
  handler(async () => {
    sameOrigin(req);
    const a = await requireAccess();
    await rateLimit('invite:' + a.userId, 20, 3600);
    return invite(a, await jsonBody(req));
  });
