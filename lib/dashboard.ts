import { db } from './db';
import { Access, scope } from './access';
export async function dashboardSummary(a: Access) {
  const where = scope(a);
  const [groups, contacts, companies, upcoming, recent] = await Promise.all([
    db.deal.groupBy({
      by: ['stage'],
      where,
      _sum: { value: true },
      _count: true,
    }),
    db.contact.count({ where }),
    db.contact.groupBy({ by: ['company'], where }),
    db.activity.findMany({
      where: { ...where, status: 'pending' },
      orderBy: { dueDate: { sort: 'asc', nulls: 'last' } },
      take: 4,
    }),
    db.activity.findMany({
      where: { ...where, status: 'completed' },
      orderBy: { updatedAt: 'desc' },
      take: 4,
    }),
  ]);
  const weighted = await db.deal.groupBy({
    by: ['probability'],
    where: { ...where, stage: { notIn: ['won', 'lost'] } },
    _sum: { value: true },
  });
  const active = groups.filter((g) => !['won', 'lost'].includes(g.stage));
  const won = groups.find((g) => g.stage === 'won')?._count || 0;
  const lost = groups.find((g) => g.stage === 'lost')?._count || 0;
  const [pending, closing] = await Promise.all([
    db.activity.count({ where: { ...where, status: 'pending' } }),
    db.deal.count({
      where: {
        ...where,
        stage: { notIn: ['won', 'lost'] },
        closeDate: {
          gte: new Date(),
          lte: new Date(Date.now() + 14 * 86400000),
        },
      },
    }),
  ]);
  return {
    pipeline: active.reduce((s, g) => s + Number(g._sum.value || 0), 0),
    openCount: active.reduce((s, g) => s + g._count, 0),
    weighted: weighted.reduce(
      (s, g) => s + (Number(g._sum.value || 0) * g.probability) / 100,
      0,
    ),
    won,
    closed: won + lost,
    contacts,
    companies: companies.length,
    stages: groups.map((g) => ({
      id: g.stage,
      value: Number(g._sum.value || 0),
      count: g._count,
    })),
    upcoming,
    recent,
    pending,
    closing,
  };
}
