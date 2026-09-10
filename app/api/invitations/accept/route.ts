export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { handler, jsonBody, sameOrigin, rateLimit } from '@/lib/security';
import { requireUser } from '@/lib/access';
import { acceptInvite } from '@/lib/invitations';
export const POST = (req: Request) =>
  handler(async () => {
    sameOrigin(req);
    const userId = await requireUser();
    await rateLimit('accept:' + userId, 20, 3600);
    const { token } = z
      .object({ token: z.string() })
      .parse(await jsonBody(req));
    const result = await acceptInvite(userId, token);
    (await cookies()).set('relay-org', result.organizationId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
    return result;
  });
