export const dynamic = 'force-dynamic';
import { hash as hashPassword } from 'bcryptjs';
import { db } from '@/lib/db';
import { signupSchema } from '@/lib/validation';
import { handler, jsonBody, sameOrigin, rateLimit } from '@/lib/security';
import { createWorkspace } from '@/lib/plans';
export const POST = (req: Request) =>
  handler(async () => {
    sameOrigin(req);
    await rateLimit(
      'signup-ip:' +
        (req.headers.get('x-forwarded-for')?.split(',')[0] || 'local'),
      5,
      3600,
    );
    const p = signupSchema.parse(await jsonBody(req));
    const passwordHash = await hashPassword(p.password, 12);
    await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name: p.name, email: p.email, passwordHash },
      });
      await createWorkspace(tx, user.id, p.organizationName);
    });
    return { created: true };
  });
