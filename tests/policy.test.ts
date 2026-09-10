import { describe, it, expect, vi } from 'vitest';
import { contactSchema, dealSchema, activitySchema } from '../lib/validation';
import { scope, canModify } from '../lib/access';
import { entityName } from '../lib/crm';
import {
  calculateCost,
  withinAllowance,
  tokenReservation,
} from '../lib/ai/usage';
import { demoAI } from '../lib/demo-ai';
import { sampleData } from '../lib/sample-data';
describe('Validation and permissions', () => {
  it('normalizes contact emails and tags', () => {
    const c = contactSchema.parse({
      name: 'Test Person',
      email: 'HELLO@Example.com',
      company: 'Example',
      tags: ['SaaS', 'SaaS', ''],
    });
    expect(c.email).toBe('hello@example.com');
    expect(c.tags).toEqual(['SaaS']);
  });
  it('rejects invalid amounts and probabilities', () => {
    expect(() => dealSchema.parse({ title: 'Bad deal', value: -1 })).toThrow();
    expect(() =>
      dealSchema.parse({ title: 'Bad deal', value: 100, probability: 101 }),
    ).toThrow();
  });
  it('rejects malformed activity dates', () =>
    expect(() =>
      activitySchema.parse({ title: 'Follow up', dueDate: 'tomorrow' }),
    ).toThrow());
  it('scopes sales representatives and denies cross-tenant records', () => {
    const a = { organizationId: 'a', userId: 'u', role: 'sales_rep' as const };
    expect(scope(a)).toEqual({ organizationId: 'a', ownerId: 'u' });
    expect(canModify(a, { organizationId: 'b', ownerId: 'u' })).toBe(false);
    expect(canModify(a, { organizationId: 'a', ownerId: 'other' })).toBe(false);
  });
  it('does not accept inherited object keys as API entities', () =>
    expect(() => entityName('toString')).toThrow());
});
describe('AI budget policy', () => {
  it('computes provider cost from input and output independently', () =>
    expect(calculateCost(1000, 500, 3, 15)).toBeCloseTo(0.0105, 8));
  it('counts simultaneous reservations toward both caps', () => {
    expect(withinAllowance(4, 1, 100, 10, 10, 5, 1000)).toBe(false);
    expect(withinAllowance(0, 0, 900, 50, 51, 10, 1000)).toBe(false);
    expect(withinAllowance(0, 0, 900, 50, 50, 10, 1000)).toBe(true);
  });
  it('reserves enough room for UTF-8 input and bounded output', () => {
    expect(tokenReservation({ text: '你好' }, 100)).toBeGreaterThan(10100);
  });
  it('uses live demo data for stale closing-deal queries', () => {
    const data = sampleData();
    data.deals = [];
    expect(
      demoAI(
        data,
        'assistant',
        'Show deals closing this month with no activity in 2 weeks',
      ).text,
    ).toContain('No deals match');
  });
});

describe('Demo state parity', () => {
  it('prepares a task for the explicitly selected opportunity without applying it', () => {
    const data = sampleData();
    const deal = data.deals[2];
    const before = data.activities.length;
    const result = demoAI(
      data,
      'assistant',
      'Create a follow-up task',
      deal.contactId || undefined,
      deal.id,
    );
    expect(result.actions?.[0].payload.dealId).toBe(deal.id);
    expect(result.actions?.[0].payload.contactId).toBe(deal.contactId);
    expect(data.activities).toHaveLength(before);
  });
  it('handles action requests in an empty workspace', () => {
    const data = sampleData();
    data.deals = [];
    expect(
      demoAI(data, 'assistant', 'Create a follow-up task').actions,
    ).toEqual([]);
    expect(demoAI(data, 'assistant', 'Move the deal to won').actions).toEqual(
      [],
    );
  });
  it('uses completion time when deciding whether a deal needs follow-up', () => {
    const data = sampleData();
    const deal = data.deals.find((d) => !['won', 'lost'].includes(d.stage))!;
    data.deals = [deal];
    data.activities = [
      {
        ...data.activities[0],
        dealId: deal.id,
        status: 'completed',
        createdAt: new Date(0).toISOString(),
        completedAt: new Date().toISOString(),
      },
    ];
    expect(
      demoAI(data, 'assistant', 'Show deals with no activity in 2 weeks').text,
    ).toContain('No deals match');
  });
  it('keeps closed stages and probability aligned', async () => {
    const { mutateDemo } = await import('../lib/demo-store');
    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      setItem: (k: string, v: string) => storage.set(k, v),
      getItem: (k: string) => storage.get(k) || null,
    });
    const data = sampleData();
    const next = mutateDemo(data, 'deals', 'PATCH', data.deals[0].id, {
      stage: 'won',
    });
    expect(next.deals[0].probability).toBe(100);
  });
  it('rejects duplicate contact creation in the demo', async () => {
    const { mutateDemo } = await import('../lib/demo-store');
    const data = sampleData();
    expect(() =>
      mutateDemo(data, 'contacts', 'POST', undefined, {
        name: 'Duplicate Person',
        email: data.contacts[0].email,
        company: 'Test',
      }),
    ).toThrow('already exists');
  });
});
