import {
  beforeAll,
  afterAll,
  describe,
  it,
  expect,
  vi,
  beforeEach,
} from 'vitest';
const provider = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: provider.create };
  },
}));
import { db } from '../lib/db';
import { createWorkspace } from '../lib/plans';
import { mutateCRM, getRecord, listCRM } from '../lib/crm';
import { invite, acceptInvite } from '../lib/invitations';
import { trackAIUsage } from '../lib/ai/usage';
import { confirmAction, proposal } from '../lib/ai/tools';
import { Access } from '../lib/access';
const enabled = !!process.env.TEST_DATABASE_URL;
const suite = enabled ? describe : describe.skip;
suite('PostgreSQL integration', () => {
  let admin: Access, rep: Access, other: Access;
  let ids: string[] = [];
  let userIds: string[] = [];
  let contactId: string;
  beforeAll(async () => {
    if (
      process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL ||
      !process.env.TEST_DATABASE_URL?.includes('relay_test')
    )
      throw Error('Use a separate relay_test database.');
    process.env.ANTHROPIC_API_KEY = 'mock-provider';
    process.env.ANTHROPIC_MODEL = 'mock-model';
    process.env.AI_INPUT_USD_PER_MILLION = '3';
    process.env.AI_OUTPUT_USD_PER_MILLION = '15';
    process.env.NEXTAUTH_URL = 'http://localhost:3000';
    const suffix = crypto.randomUUID();
    const users = await Promise.all(
      ['Admin', 'Rep', 'Other', 'Guest'].map((name) =>
        db.user.create({
          data: { name, email: `${name.toLowerCase()}-${suffix}@example.test` },
        }),
      ),
    );
    userIds = users.map((u) => u.id);
    const org1 = await db.$transaction((tx) =>
      createWorkspace(tx, users[0].id, 'Test One'),
    );
    const org2 = await db.$transaction((tx) =>
      createWorkspace(tx, users[2].id, 'Test Two'),
    );
    ids = [org1.id, org2.id];
    await db.membership.create({
      data: { organizationId: org1.id, userId: users[1].id, role: 'sales_rep' },
    });
    admin = { organizationId: org1.id, userId: users[0].id, role: 'admin' };
    rep = { organizationId: org1.id, userId: users[1].id, role: 'sales_rep' };
    other = { organizationId: org2.id, userId: users[2].id, role: 'admin' };
    const c = await mutateCRM(admin, 'contacts', 'POST', undefined, {
      name: 'Lana Example',
      email: 'lana@example.test',
      company: 'Catalog',
    });
    contactId = c.id;
  });
  beforeEach(() => {
    provider.create.mockReset();
    provider.create.mockResolvedValue({
      id: 'msg-mock',
      usage: { input_tokens: 1000, output_tokens: 500 },
      content: [{ type: 'text', text: 'Test output' }],
    });
  });
  afterAll(async () => {
    for (const organizationId of ids) {
      await db.activity.deleteMany({ where: { organizationId } });
      await db.deal.deleteMany({ where: { organizationId } });
      await db.contact.deleteMany({ where: { organizationId } });
      await db.aIUsageLog.deleteMany({ where: { organizationId } });
      await db.aIRequest.deleteMany({ where: { organizationId } });
      await db.aIAction.deleteMany({ where: { organizationId } });
      await db.organization.delete({ where: { id: organizationId } });
    }
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.$disconnect();
  });
  it('enforces tenant and ownership isolation for reads and writes', async () => {
    await expect(getRecord(other, 'contacts', contactId)).rejects.toThrow(
      'Record not found',
    );
    await expect(getRecord(rep, 'contacts', contactId)).rejects.toThrow(
      'Record not found',
    );
    await expect(
      mutateCRM(rep, 'contacts', 'PATCH', contactId, { name: 'Hijacked' }),
    ).rejects.toThrow('Record not found');
    const list = await listCRM(rep, 'contacts', new URLSearchParams());
    expect(list.items).toHaveLength(0);
  });
  it('rejects cross-organization contact links in both service and database', async () => {
    await expect(
      mutateCRM(other, 'deals', 'POST', undefined, {
        title: 'Cross tenant',
        value: 100,
        contactId,
      }),
    ).rejects.toThrow();
    await expect(
      db.deal.create({
        data: {
          organizationId: other.organizationId,
          ownerId: other.userId,
          title: 'Invalid direct FK',
          value: 100,
          contactId,
        },
      }),
    ).rejects.toThrow();
  });
  it('creates deals and activities, then unlinks them transactionally on contact delete', async () => {
    const c = await mutateCRM(admin, 'contacts', 'POST', undefined, {
      name: 'Disposable Record',
      email: 'disposable@example.test',
      company: 'Test',
    });
    const d = await mutateCRM(admin, 'deals', 'POST', undefined, {
      title: 'Test opportunity',
      value: 12000,
      contactId: c.id,
    });
    const a = await mutateCRM(admin, 'activities', 'POST', undefined, {
      title: 'Follow up',
      contactId: c.id,
      dealId: d.id,
    });
    await mutateCRM(admin, 'activities', 'PATCH', a.id, {
      status: 'completed',
    });
    expect(
      (await getRecord(admin, 'activities', a.id)).completedAt,
    ).not.toBeNull();
    await mutateCRM(admin, 'contacts', 'DELETE', c.id, {});
    expect((await getRecord(admin, 'deals', d.id)).contactId).toBeNull();
    expect((await getRecord(admin, 'activities', a.id)).contactId).toBeNull();
  });
  it('hashes invitations, checks intended email, and prevents reuse', async () => {
    const guest = await db.user.findUniqueOrThrow({
      where: { id: userIds[3] },
    });
    const created = await invite(admin, {
      email: guest.email,
      role: 'manager',
    });
    const token = new URL(created.url).searchParams.get('token')!;
    const stored = await db.invitation.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(stored.tokenHash).not.toBe(token);
    await expect(acceptInvite(other.userId, token)).rejects.toThrow(
      'email address',
    );
    await acceptInvite(guest.id, token);
    await expect(acceptInvite(guest.id, token)).rejects.toThrow('expired');
    expect(
      (
        await db.membership.findUniqueOrThrow({
          where: {
            organizationId_userId: {
              organizationId: admin.organizationId,
              userId: guest.id,
            },
          },
        })
      ).role,
    ).toBe('manager');
  });
  it('accepts AI mutations at most once, even with simultaneous clicks', async () => {
    const p = await proposal(admin, 'create_task', {
      title: 'Unique AI task',
      contactId,
    });
    const results = await Promise.allSettled([
      confirmAction(admin, p.id, {}),
      confirmAction(admin, p.id, {}),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(
      await db.activity.count({
        where: {
          organizationId: admin.organizationId,
          title: 'Unique AI task',
        },
      }),
    ).toBe(1);
  });
  it('records actual tokens and cost for each model call', async () => {
    await trackAIUsage(admin, 'assistant', {
      model: 'mock-model',
      max_tokens: 1500,
      messages: [{ role: 'user', content: 'Hello' }],
    });
    const log = await db.aIUsageLog.findFirstOrThrow({
      where: { organizationId: admin.organizationId },
    });
    expect(log.inputTokens).toBe(1000);
    expect(log.outputTokens).toBe(500);
    expect(Number(log.costUsd)).toBeCloseTo(0.0105, 8);
    const bucket = await db.usageBucket.findFirstOrThrow({
      where: { organizationId: admin.organizationId },
    });
    expect(bucket.tokens).toBe(1500);
    expect(bucket.reservedActions).toBe(0);
  });
  it('serializes concurrent allowance reservations before provider calls', async () => {
    const bucket = await db.usageBucket.findFirstOrThrow({
      where: { organizationId: admin.organizationId },
    });
    await db.usageBucket.update({
      where: {
        organizationId_periodStart: {
          organizationId: admin.organizationId,
          periodStart: bucket.periodStart,
        },
      },
      data: { actions: 499 },
    });
    provider.create.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 100));
      return { usage: { input_tokens: 20, output_tokens: 10 }, content: [] };
    });
    const requests = Array.from({ length: 5 }, () =>
      trackAIUsage(admin, 'assistant', {
        model: 'mock-model',
        max_tokens: 1500,
        messages: [{ role: 'user', content: 'Hello' }],
      }),
    );
    const results = await Promise.allSettled(requests);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(provider.create).toHaveBeenCalledTimes(1);
    const after = await db.usageBucket.findFirstOrThrow({
      where: { organizationId: admin.organizationId },
    });
    expect(after.actions).toBe(500);
    await db.usageBucket.update({
      where: {
        organizationId_periodStart: {
          organizationId: admin.organizationId,
          periodStart: bucket.periodStart,
        },
      },
      data: { actions: 2 },
    });
  });
  it('releases allowance for a definite rejection and holds uncertain outcomes', async () => {
    provider.create.mockRejectedValueOnce(
      Object.assign(new Error('bad request'), { status: 400 }),
    );
    await expect(
      trackAIUsage(admin, 'assistant', {
        model: 'mock-model',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    ).rejects.toThrow();
    let b = await db.usageBucket.findFirstOrThrow({
      where: { organizationId: admin.organizationId },
    });
    expect(b.reservedActions).toBe(0);
    provider.create.mockRejectedValueOnce(new Error('connection lost'));
    await expect(
      trackAIUsage(admin, 'assistant', {
        model: 'mock-model',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    ).rejects.toThrow('held');
    b = await db.usageBucket.findFirstOrThrow({
      where: { organizationId: admin.organizationId },
    });
    expect(b.reservedActions).toBe(1);
    expect(b.reservedTokens).toBeGreaterThan(10000);
  });
});
