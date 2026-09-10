export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { requireAccess } from '@/lib/access';
import { handler, jsonBody, sameOrigin, rateLimit } from '@/lib/security';
import { checkout } from '@/lib/billing';
export const POST = (req: Request) =>
  handler(async () => {
    sameOrigin(req);
    const a = await requireAccess();
    await rateLimit('checkout:' + a.organizationId, 10, 3600);
    const p = z
      .object({
        tier: z.enum(['starter', 'pro', 'enterprise']),
        seats: z.number().int().min(1).max(500),
      })
      .parse(await jsonBody(req));
    return checkout(a, p.tier, p.seats);
  });
