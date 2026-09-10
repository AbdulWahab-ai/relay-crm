export const dynamic = 'force-dynamic';
import { stripe, syncStripeEvent } from '@/lib/billing';
import { handler, AppError } from '@/lib/security';
export const POST = (req: Request) =>
  handler(async () => {
    if (!process.env.STRIPE_WEBHOOK_SECRET)
      throw new AppError(503, 'Webhook not configured');
    const signature = req.headers.get('stripe-signature');
    if (!signature) throw new AppError(400, 'Missing signature');
    let event;
    try {
      event = stripe().webhooks.constructEvent(
        await req.text(),
        signature,
        process.env.STRIPE_WEBHOOK_SECRET,
      );
    } catch {
      throw new AppError(400, 'Invalid webhook signature');
    }
    await syncStripeEvent(event);
    return { received: true };
  });
