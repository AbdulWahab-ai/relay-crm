import { CRMData, Entity, plans, Tier } from './types';
import { sampleData } from './sample-data';
import { schemas } from './validation';
export const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
const prefix = 'relay-crm-demo-v1';
export function readDemo(): CRMData {
  try {
    const id = localStorage.getItem(prefix + '-active') || 'demo-northstar';
    return (
      JSON.parse(localStorage.getItem(prefix + '-' + id) || 'null') ||
      sampleData(id)
    );
  } catch {
    return sampleData();
  }
}
export function writeDemo(data: CRMData) {
  localStorage.setItem(
    prefix + '-' + data.organizationId,
    JSON.stringify(data),
  );
  localStorage.setItem(prefix + '-active', data.organizationId);
}
export function switchDemo(id: string) {
  localStorage.setItem(prefix + '-active', id);
  return readDemo();
}
export function resetDemo() {
  const data = sampleData(readDemo().organizationId);
  writeDemo(data);
  return data;
}
export function mutateDemo(
  data: CRMData,
  entity: Entity,
  method: string,
  id: string | undefined,
  input: Record<string, unknown>,
): CRMData {
  if (method !== 'DELETE') {
    const scoreFields = Object.fromEntries(
      Object.entries(input).filter(([k]) =>
        ['aiScore', 'aiExplanation', 'scoredAt'].includes(k),
      ),
    );
    input = {
      ...(method === 'PATCH'
        ? schemas[entity].partial()
        : schemas[entity]
      ).parse(input),
      ...scoreFields,
    };
    if (
      entity === 'contacts' &&
      input.email &&
      data.contacts.some((c) => c.id !== id && c.email === input.email)
    )
      throw Error('A contact with this email already exists.');
    if (entity === 'deals' && input.stage === 'won') input.probability = 100;
    if (entity === 'deals' && input.stage === 'lost') input.probability = 0;
    if (entity === 'activities' && input.status)
      input.completedAt =
        input.status === 'completed' ? new Date().toISOString() : null;
  }
  const next = structuredClone(data);
  const rows = next[entity] as unknown as Record<string, unknown>[];
  if (method === 'DELETE') {
    next[entity] = rows.filter((x) => x.id !== id) as never;
    if (entity === 'contacts') {
      next.deals.forEach((x) => {
        if (x.contactId === id) x.contactId = null;
      });
      next.activities.forEach((x) => {
        if (x.contactId === id) x.contactId = null;
      });
    }
    if (entity === 'deals')
      next.activities.forEach((x) => {
        if (x.dealId === id) x.dealId = null;
      });
  } else if (method === 'PATCH') {
    const row = rows.find((x) => x.id === id);
    if (!row) throw Error('Record not found');
    Object.assign(row, input, { updatedAt: new Date().toISOString() });
    if (entity === 'activities' && input.status === 'completed')
      row.completedAt = new Date().toISOString();
  } else
    rows.unshift({
      id: crypto.randomUUID(),
      organizationId: data.organizationId,
      ownerId: data.userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...input,
    });
  writeDemo(next);
  return next;
}
export function changeDemoPlan(data: CRMData, tier: Tier) {
  const p = plans[tier];
  const next = {
    ...data,
    usage: {
      ...data.usage,
      tier,
      includedActions: p.actions,
      includedTokens: p.tokens,
      monthlySeatPriceUsd: p.price,
      maxSeats: p.seats,
    },
  };
  writeDemo(next);
  return next;
}
export function chargeDemo(data: CRMData) {
  if (
    data.usage.actions >= data.usage.includedActions ||
    data.usage.tokens + 1800 > data.usage.includedTokens
  )
    throw Error('AI allowance reached. Upgrade your plan to continue.');
  const next = structuredClone(data);
  next.usage.actions++;
  next.usage.tokens += 1800;
  next.usage.costUsd += 0.008;
  const u = next.usage.byUser.find((x) => x.userId === data.userId);
  if (u) {
    u.actions++;
    u.tokens += 1800;
    u.costUsd += 0.008;
  }
  writeDemo(next);
  return next;
}
