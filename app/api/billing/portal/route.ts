export const dynamic = 'force-dynamic';
import { requireAccess, admin } from '@/lib/access';
import { db } from '@/lib/db';
import { handler, sameOrigin, AppError } from '@/lib/security';
import { stripe } from '@/lib/billing';
export const POST = (req: Request) =>
  handler(async () => {
    sameOrigin(req);
    const a = await requireAccess();
    admin(a);
    const sub = await db.subscription.findUniqueOrThrow({
      where: { organizationId: a.organizationId },
    });
    if (!sub.stripeCustomerId)
      throw new AppError(400, 'Choose a plan to set up billing first');
    return stripe().billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: process.env.NEXTAUTH_URL + '/billing',
    });
  });
