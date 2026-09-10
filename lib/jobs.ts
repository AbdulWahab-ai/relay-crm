import { db } from './db';
import { sendMail } from './mail';
import { runAI } from './ai/service';
import { mutateCRM } from './crm';
export async function processJobs() {
  const now = new Date();
  const reminders = await db.activity.findMany({
    where: { status: 'pending', remindedAt: null, reminderAt: { lte: now } },
    take: 50,
    include: { owner: { include: { user: true } } },
  });
  for (const a of reminders)
    await db.job.upsert({
      where: { dedupeKey: `reminder:${a.id}:${a.reminderAt?.toISOString()}` },
      create: {
        organizationId: a.organizationId,
        kind: 'reminder',
        dedupeKey: `reminder:${a.id}:${a.reminderAt?.toISOString()}`,
        payload: {
          activityId: a.id,
          reminderAt: a.reminderAt?.toISOString(),
          userId: a.ownerId,
        },
      },
      update: {},
    });
  // Stale email deliveries remain uncertain to avoid duplicate SMTP sends.
  await db.job.updateMany({
    where: {
      status: 'running',
      lockedAt: { lt: new Date(Date.now() - 10 * 60000) },
      kind: { in: ['send_email', 'reminder'] },
    },
    data: {
      status: 'uncertain',
      error: 'Delivery outcome unknown; inspect mail provider before retrying.',
    },
  });
  await db.job.updateMany({
    where: {
      status: 'running',
      lockedAt: { lt: new Date(Date.now() - 10 * 60000) },
      kind: 'lead_score',
    },
    data: { status: 'pending', lockedAt: null },
  });
  const pending = await db.job.findMany({
    where: { status: 'pending', runAfter: { lte: now }, attempts: { lt: 3 } },
    take: 3,
    orderBy: { runAfter: 'asc' },
  });
  let processed = 0;
  for (const job of pending) {
    const claimed = await db.job.updateMany({
      where: { id: job.id, status: 'pending', runAfter: job.runAfter },
      data: { status: 'running', lockedAt: now, attempts: { increment: 1 } },
    });
    if (!claimed.count) continue;
    const p = job.payload as any;
    try {
      const member = await db.membership.findUnique({
        where: {
          organizationId_userId: {
            organizationId: job.organizationId,
            userId: p.userId,
          },
        },
      });
      if (!member) throw Error('Membership no longer active');
      const access = {
        organizationId: job.organizationId,
        userId: p.userId,
        role: member.role,
      };
      if (job.kind === 'lead_score') {
        await runAI(access, {
          action: 'lead_score',
          prompt: 'Recalculate from recent CRM changes.',
          contactId: p.contactId,
          dealId: p.dealId,
        });
      } else if (job.kind === 'send_email') {
        await sendMail(p.to, p.subject, p.body, job.id);
        await mutateCRM(access, 'activities', 'POST', undefined, {
          title: p.subject,
          body: p.body,
          type: 'email',
          status: 'completed',
          contactId: p.contactId,
          dealId: p.dealId,
        });
      } else if (job.kind === 'reminder') {
        const a = await db.activity.findFirst({
          where: {
            id: p.activityId,
            organizationId: job.organizationId,
            status: 'pending',
            remindedAt: null,
            reminderAt: new Date(p.reminderAt),
          },
        });
        if (a) {
          const u = await db.user.findUniqueOrThrow({
            where: { id: a.ownerId },
          });
          await sendMail(
            u.email,
            `Reminder: ${a.title}`,
            `${a.title}\n\n${a.body}\n\nOpen your workspace: ${process.env.NEXTAUTH_URL}/activities`,
            job.id,
          );
          await db.activity.update({
            where: { id: a.id },
            data: { remindedAt: new Date() },
          });
        }
      }
      await db.job.updateMany({
        where: { id: job.id, status: 'running', lockedAt: now },
        data: { status: 'completed', lockedAt: null, error: null },
      });
      processed++;
    } catch (e: any) {
      const mail = job.kind === 'send_email' || job.kind === 'reminder';
      await db.job.updateMany({
        where: { id: job.id, status: 'running', lockedAt: now },
        data: {
          status: mail ? 'uncertain' : job.attempts >= 2 ? 'failed' : 'pending',
          runAfter: new Date(Date.now() + 5 * 60000),
          lockedAt: null,
          error:
            e.status === 402
              ? 'AI allowance unavailable'
              : e.status === 503
                ? 'Provider configuration or availability issue'
                : 'Job failed; inspect server logs',
        },
      });
    }
  }
  await db.rateLimit.deleteMany({
    where: { expiresAt: { lt: new Date(Date.now() - 86400000) } },
  });
  return { processed, examined: pending.length };
}
