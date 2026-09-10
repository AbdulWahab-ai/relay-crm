import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { db } from './db';
import { Access, scope, canModify } from './access';
import { AppError } from './security';
import { schemas } from './validation';
import type { Entity } from './types';
export function entityName(value: string): Entity {
  if (!Object.hasOwn(schemas, value))
    throw new AppError(404, 'Unknown record type');
  return value as Entity;
}
const model = (tx: any, e: Entity): any =>
  tx[{ contacts: 'contact', deals: 'deal', activities: 'activity' }[e]];
export async function getRecord(
  a: Access,
  e: Entity,
  id: string,
  tx: any = db,
) {
  const record = await model(tx, e).findFirst({ where: { id, ...scope(a) } });
  if (!record) throw new AppError(404, 'Record not found');
  return record;
}
async function checkLinks(
  tx: Prisma.TransactionClient,
  a: Access,
  e: Entity,
  p: any,
) {
  if (p.ownerId) {
    if (a.role === 'sales_rep' && p.ownerId !== a.userId)
      throw new AppError(403, 'You may only own your own records');
    if (
      !(await tx.membership.findUnique({
        where: {
          organizationId_userId: {
            organizationId: a.organizationId,
            userId: p.ownerId,
          },
        },
      }))
    )
      throw new AppError(400, 'Owner must belong to this organization');
  }
  if (p.contactId) await getRecord(a, 'contacts', p.contactId, tx);
  if (p.dealId) {
    const deal = await getRecord(a, 'deals', p.dealId, tx);
    if (p.contactId && deal.contactId && deal.contactId !== p.contactId)
      throw new AppError(400, 'Contact must match the linked deal');
  }
}
async function queueScores(
  tx: Prisma.TransactionClient,
  a: Access,
  e: Entity,
  r: any,
) {
  const targets: any[] = [];
  if (e === 'contacts') targets.push({ contactId: r.id });
  if (e === 'deals') {
    targets.push({ dealId: r.id });
    if (r.contactId) targets.push({ contactId: r.contactId });
  }
  if (e === 'activities') {
    if (r.contactId) targets.push({ contactId: r.contactId });
    if (r.dealId) targets.push({ dealId: r.dealId });
  }
  for (const t of targets) {
    const key = `score:${a.organizationId}:${t.contactId || t.dealId}`;
    await tx.job.upsert({
      where: { dedupeKey: key },
      create: {
        organizationId: a.organizationId,
        kind: 'lead_score',
        dedupeKey: key,
        payload: { ...t, userId: a.userId },
        runAfter: new Date(Date.now() + 60000),
      },
      update: {
        status: 'pending',
        attempts: 0,
        error: null,
        payload: { ...t, userId: a.userId },
        runAfter: new Date(Date.now() + 60000),
      },
    });
  }
}
export async function mutateCRM(
  a: Access,
  e: Entity,
  method: string,
  id: string | undefined,
  input: unknown,
  existingTx?: Prisma.TransactionClient,
) {
  const parsed =
    method === 'DELETE'
      ? {}
      : (method === 'PATCH' ? schemas[e].partial() : schemas[e]).parse(input);
  const work = async (tx: Prisma.TransactionClient) => {
    const current = id ? await getRecord(a, e, id, tx) : null;
    await checkLinks(tx, a, e, { ...current, ...parsed });
    if (method === 'DELETE') {
      if (!current) throw new AppError(404, 'Record not found');
      if (e === 'contacts') {
        await tx.deal.updateMany({
          where: { organizationId: a.organizationId, contactId: id },
          data: { contactId: null },
        });
        await tx.activity.updateMany({
          where: { organizationId: a.organizationId, contactId: id },
          data: { contactId: null },
        });
      }
      if (e === 'deals')
        await tx.activity.updateMany({
          where: { organizationId: a.organizationId, dealId: id },
          data: { dealId: null },
        });
      await model(tx, e).delete({ where: { id } });
      await tx.auditLog.create({
        data: {
          organizationId: a.organizationId,
          actorId: a.userId,
          action: `${e}.delete`,
          entityId: id,
        },
      });
      return { id, deleted: true };
    }
    const p: any = { ...parsed };
    if (e === 'deals') {
      if (p.stage === 'won') p.probability = 100;
      if (p.stage === 'lost') p.probability = 0;
    }
    if (e === 'activities' && p.status)
      p.completedAt = p.status === 'completed' ? new Date() : null;
    const row = id
      ? await model(tx, e).update({ where: { id }, data: p })
      : await model(tx, e).create({
          data: {
            ...p,
            organizationId: a.organizationId,
            ownerId: p.ownerId || a.userId,
          },
        });
    await tx.auditLog.create({
      data: {
        organizationId: a.organizationId,
        actorId: a.userId,
        action: `${e}.${id ? 'update' : 'create'}`,
        entityId: row.id,
      },
    });
    await queueScores(tx, a, e, row);
    return row;
  };
  return existingTx ? work(existingTx) : db.$transaction(work);
}
export async function listCRM(a: Access, e: Entity, search: URLSearchParams) {
  const query = search.get('q')?.slice(0, 200) || '';
  const take = Math.min(100, Math.max(1, Number(search.get('limit')) || 50));
  const cursor = search.get('cursor');
  const where: any = { ...scope(a) };
  if (query)
    where.OR = (
      e === 'contacts' ? ['name', 'email', 'company'] : ['title']
    ).map((k) => ({ [k]: { contains: query, mode: 'insensitive' } }));
  if (e === 'contacts' && search.get('tag'))
    where.tags = { has: search.get('tag') };
  if (e === 'deals' && search.get('stage'))
    where.stage = z
      .enum(['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'])
      .parse(search.get('stage'));
  if (e === 'activities' && search.get('status'))
    where.status = z
      .enum(['pending', 'completed', 'cancelled'])
      .parse(search.get('status'));
  const items = await model(db, e).findMany({
    where,
    orderBy: { id: 'asc' },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  return {
    items: items.slice(0, take),
    nextCursor: items.length > take ? items[take - 1].id : null,
  };
}
