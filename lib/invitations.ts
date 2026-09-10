import { randomBytes } from 'node:crypto';
import { db } from './db';
import { Access, admin } from './access';
import { AppError, hash } from './security';
import { inviteSchema } from './validation';
export async function invite(a: Access, input: unknown) {
  admin(a);
  const p = inviteSchema.parse(input);
  const token = randomBytes(32).toString('hex');
  const invitation = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${a.organizationId}))`;
    const sub = await tx.subscription.findUniqueOrThrow({
      where: { organizationId: a.organizationId },
      include: { plan: true },
    });
    const members = await tx.membership.count({
      where: { organizationId: a.organizationId },
    });
    const pending = await tx.invitation.count({
      where: {
        organizationId: a.organizationId,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
        email: { not: p.email },
      },
    });
    const seatCap = sub.stripeSubscriptionId ? sub.seats : sub.plan.maxSeats;
    if (members + pending >= seatCap)
      throw new AppError(
        402,
        'No available seats. Add seats in billing before inviting another person.',
      );
    const existing = await tx.user.findUnique({ where: { email: p.email } });
    if (
      existing &&
      (await tx.membership.findUnique({
        where: {
          organizationId_userId: {
            organizationId: a.organizationId,
            userId: existing.id,
          },
        },
      }))
    )
      throw new AppError(409, 'This person is already a member');
    await tx.invitation.updateMany({
      where: {
        organizationId: a.organizationId,
        email: p.email,
        acceptedAt: null,
      },
      data: { expiresAt: new Date() },
    });
    const created = await tx.invitation.create({
      data: {
        organizationId: a.organizationId,
        ...p,
        tokenHash: hash(token),
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });
    await tx.auditLog.create({
      data: {
        organizationId: a.organizationId,
        actorId: a.userId,
        action: 'invitation.create',
        entityId: created.id,
      },
    });
    return created;
  });
  return {
    id: invitation.id,
    url: process.env.NEXTAUTH_URL + '/invite?token=' + token,
    email: invitation.email,
    expiresAt: invitation.expiresAt,
  };
}
export async function acceptInvite(userId: string, token: string) {
  if (!/^[a-f0-9]{64}$/.test(token))
    throw new AppError(400, 'Invalid invitation');
  const tokenHash = hash(token);
  const initial = await db.invitation.findUnique({ where: { tokenHash } });
  if (!initial) throw new AppError(400, 'Invalid or expired invitation');
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${initial.organizationId}))`;
    const invitation = await tx.invitation.findUnique({ where: { tokenHash } });
    if (
      !invitation ||
      invitation.acceptedAt ||
      invitation.expiresAt <= new Date()
    )
      throw new AppError(400, 'Invalid or expired invitation');
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.email !== invitation.email)
      throw new AppError(
        403,
        'Sign in with the email address that was invited.',
      );
    const sub = await tx.subscription.findUniqueOrThrow({
      where: { organizationId: invitation.organizationId },
      include: { plan: true },
    });
    const count = await tx.membership.count({
      where: { organizationId: invitation.organizationId },
    });
    if (count >= (sub.stripeSubscriptionId ? sub.seats : sub.plan.maxSeats))
      throw new AppError(402, 'This organization has no available seats');
    await tx.membership.upsert({
      where: {
        organizationId_userId: {
          organizationId: invitation.organizationId,
          userId,
        },
      },
      create: {
        organizationId: invitation.organizationId,
        userId,
        role: invitation.role,
      },
      update: {},
    });
    await tx.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    });
    await tx.user.update({
      where: { id: userId },
      data: { emailVerified: user.emailVerified || new Date() },
    });
    return { organizationId: invitation.organizationId };
  });
}
