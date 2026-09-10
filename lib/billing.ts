import Stripe from 'stripe';
import { db } from './db';
import { Access, admin } from './access';
import { AppError } from './security';
import { Tier } from './types';
export function stripe() {
  if (!process.env.STRIPE_SECRET_KEY)
    throw new AppError(
      503,
      'Stripe is not connected yet. Configure the server environment to enable billing.',
    );
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}
export function stripePrice(tier: Tier) {
  const price = process.env[`STRIPE_PRICE_${tier.toUpperCase()}`];
  if (!price)
    throw new AppError(503, 'This plan is not configured in Stripe yet.');
  return price;
}
export async function usageSummary(a: Access) {
  const sub = await db.subscription.findUnique({
    where: { organizationId: a.organizationId },
    include: { plan: true },
  });
  if (!sub) throw new AppError(404, 'Subscription not found');
  const orgWide = a.role === 'admin';
  const where = {
    organizationId: a.organizationId,
    periodStart: sub.currentPeriodStart,
    ...(!orgWide ? { userId: a.userId } : {}),
  };
  const [byUser, bucket, members] = await Promise.all([
    db.aIUsageLog.groupBy({
      by: ['userId'],
      where,
      _count: true,
      _sum: { inputTokens: true, outputTokens: true, costUsd: true },
    }),
    db.usageBucket.findUnique({
      where: {
        organizationId_periodStart: {
          organizationId: a.organizationId,
          periodStart: sub.currentPeriodStart,
        },
      },
    }),
    db.membership.findMany({
      where: { organizationId: a.organizationId },
      include: { user: { select: { name: true } } },
    }),
  ]);
  const users = byUser.map((x) => ({
    userId: x.userId,
    name:
      members.find((m) => m.userId === x.userId)?.user.name || 'Team member',
    actions: x._count,
    tokens: (x._sum.inputTokens || 0) + (x._sum.outputTokens || 0),
    costUsd: Number(x._sum.costUsd || 0),
  }));
  return {
    tier: sub.tier,
    status: sub.status,
    seats: sub.seats,
    periodStart: sub.currentPeriodStart,
    periodEnd: sub.currentPeriodEnd,
    includedActions: sub.plan.includedActions,
    includedTokens: sub.plan.includedTokens,
    monthlySeatPriceUsd: Number(sub.plan.monthlySeatPriceUsd),
    maxSeats: sub.plan.maxSeats,
    actions: bucket?.actions || 0,
    tokens: bucket?.tokens || 0,
    costUsd: orgWide
      ? Number(bucket?.costUsd || 0)
      : users.reduce((s, u) => s + u.costUsd, 0),
    reservedTokens: bucket?.reservedTokens || 0,
    reservedActions: bucket?.reservedActions || 0,
    byUser: users,
    ownOnly: !orgWide,
  };
}
export async function checkout(a: Access, tier: Tier, seats: number) {
  admin(a);
  const plan = await db.planLimits.findUnique({ where: { tier } });
  const occupied = await db.membership.count({
    where: { organizationId: a.organizationId },
  });
  if (
    !plan ||
    !Number.isInteger(seats) ||
    seats < occupied ||
    seats > plan.maxSeats
  )
    throw new AppError(
      400,
      `Choose at least ${occupied} seats within your plan limit.`,
    );
  const billing = stripe();
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${a.organizationId}))`;
      const sub = await tx.subscription.findUniqueOrThrow({
        where: { organizationId: a.organizationId },
        include: { organization: true },
      });
      if (sub.stripeSubscriptionId) {
        const portal = await billing.billingPortal.sessions.create({
          customer: sub.stripeCustomerId!,
          return_url: process.env.NEXTAUTH_URL + '/billing',
        });
        return { url: portal.url };
      }
      let customer = sub.stripeCustomerId;
      if (!customer) {
        customer = (
          await billing.customers.create(
            {
              name: sub.organization.name,
              metadata: { organizationId: a.organizationId },
            },
            { idempotencyKey: `customer-${a.organizationId}` },
          )
        ).id;
        await tx.subscription.update({
          where: { id: sub.id },
          data: { stripeCustomerId: customer },
        });
      }
      const open = await billing.checkout.sessions.list({
        customer,
        status: 'open',
        limit: 1,
      });
      if (open.data[0]?.url) return { url: open.data[0].url };
      const result = await billing.checkout.sessions.create(
        {
          mode: 'subscription',
          customer,
          line_items: [{ price: stripePrice(tier), quantity: seats }],
          success_url: process.env.NEXTAUTH_URL + '/billing?checkout=success',
          cancel_url: process.env.NEXTAUTH_URL + '/billing?checkout=cancelled',
          subscription_data: { metadata: { organizationId: a.organizationId } },
          metadata: { organizationId: a.organizationId },
          allow_promotion_codes: true,
        },
        {
          idempotencyKey: `checkout-${a.organizationId}-${tier}-${seats}-${Math.floor(Date.now() / 60000)}`,
        },
      );
      return { url: result.url };
    },
    { timeout: 25000 },
  );
}
export async function syncStripeEvent(event: Stripe.Event) {
  if (
    ![
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'invoice.paid',
      'invoice.payment_failed',
    ].includes(event.type)
  )
    return;
  const object = event.data.object as any;
  const subId = event.type.startsWith('customer.subscription.')
    ? object.id
    : typeof object.subscription === 'string'
      ? object.subscription
      : object.subscription?.id;
  if (!subId) return;
  const customer =
    typeof object.customer === 'string' ? object.customer : object.customer?.id;
  const local = await db.subscription.findUnique({
    where: { stripeCustomerId: customer },
  });
  if (!local) return;
  await db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${local.organizationId}))`;
      if (await tx.stripeEvent.findUnique({ where: { id: event.id } })) return;
      const latest = await stripe().subscriptions.retrieve(subId);
      const current = await tx.subscription.findUniqueOrThrow({
        where: { id: local.id },
      });
      if (
        current.stripeSubscriptionId &&
        current.stripeSubscriptionId !== subId &&
        current.status !== 'canceled'
      ) {
        await tx.stripeEvent.create({
          data: { id: event.id, type: event.type },
        });
        return;
      }
      const seatItem = latest.items.data.find((i) =>
        ['starter', 'pro', 'enterprise'].some(
          (t) => process.env[`STRIPE_PRICE_${t.toUpperCase()}`] === i.price.id,
        ),
      );
      if (!seatItem) throw new AppError(400, 'Unknown Stripe plan price');
      const tier = (['starter', 'pro', 'enterprise'] as Tier[]).find(
        (t) =>
          process.env[`STRIPE_PRICE_${t.toUpperCase()}`] === seatItem.price.id,
      )!;
      await tx.subscription.update({
        where: { id: local.id },
        data: {
          stripeSubscriptionId: latest.id,
          stripeSeatItemId: seatItem.id,
          tier,
          status: latest.status,
          seats: seatItem.quantity || 1,
          currentPeriodStart: new Date(latest.current_period_start * 1000),
          currentPeriodEnd: new Date(latest.current_period_end * 1000),
          cancelAtPeriodEnd: latest.cancel_at_period_end,
        },
      });
      await tx.stripeEvent.create({ data: { id: event.id, type: event.type } });
    },
    { timeout: 25000 },
  );
}
