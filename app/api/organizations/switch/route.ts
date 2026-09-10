export const dynamic = 'force-dynamic';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/access';
import { handler, jsonBody, sameOrigin, AppError } from '@/lib/security';
export const POST = (req: Request) =>
  handler(async () => {
    sameOrigin(req);
    const userId = await requireUser();
    const { organizationId } = z
      .object({ organizationId: z.string().max(100) })
      .parse(await jsonBody(req));
    if (
      !(await db.membership.findUnique({
        where: { organizationId_userId: { organizationId, userId } },
      }))
    )
      throw new AppError(403, 'Membership required');
    (await cookies()).set('relay-org', organizationId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 86400 * 30,
    });
    return { organizationId };
  });
