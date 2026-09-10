import { CRMData, Stage } from './types';
export function sampleData(orgId = 'demo-northstar'): CRMData {
  const now = new Date();
  const date = (n: number) =>
    new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + n,
      12,
    ).toISOString();
  const members = [
    {
      userId: 'demo-alex',
      role: 'admin' as const,
      user: { name: 'Alex Morgan', email: 'alex@northstar.example' },
    },
    {
      userId: 'demo-sarah',
      role: 'manager' as const,
      user: { name: 'Sarah Chen', email: 'sarah@northstar.example' },
    },
    {
      userId: 'demo-james',
      role: 'sales_rep' as const,
      user: { name: 'James Wilson', email: 'james@northstar.example' },
    },
  ];
  const people = [
    [
      'Olivia Rhye',
      'olivia@layers.example',
      'Layers',
      'VP of Operations',
      '92',
      'Inbound',
    ],
    [
      'Phoenix Baker',
      'phoenix@sisyphus.example',
      'Sisyphus',
      'Head of Growth',
      '84',
      'Referral',
    ],
    [
      'Lana Steiner',
      'lana@catalog.example',
      'Catalog',
      'Chief Technology Officer',
      '96',
      'Website',
    ],
    [
      'Demi Wilkinson',
      'demi@circooles.example',
      'Circooles',
      'Revenue Operations',
      '68',
      'Outbound',
    ],
    [
      'Drew Cano',
      'drew@hourglass.example',
      'Hourglass',
      'Director of Sales',
      '78',
      'Event',
    ],
    [
      'Natali Craig',
      'natali@commandr.example',
      'Command+R',
      'Co-founder',
      '88',
      'Referral',
    ],
    [
      'Orlando Diggs',
      'orlando@feather.example',
      'Feather',
      'Head of Partnerships',
      '73',
      'Inbound',
    ],
    [
      'Andi Lane',
      'andi@boltshift.example',
      'Boltshift',
      'VP of Engineering',
      '91',
      'Website',
    ],
    ['Kate Morrison', 'kate@acme.example', 'Acme', 'CEO', '64', 'Event'],
    [
      'Noah Williams',
      'noah@cloudwatch.example',
      'Cloudwatch',
      'Procurement Lead',
      '81',
      'Outbound',
    ],
    [
      'Sophie Moore',
      'sophie@orbit.example',
      'Orbit',
      'Chief of Staff',
      '89',
      'Referral',
    ],
    [
      'Ethan Clark',
      'ethan@nietzsche.example',
      'Nietzsche',
      'Head of Sales',
      '57',
      'Website',
    ],
  ];
  const contacts = people.map((p, i) => ({
    id: `${orgId}-c${i}`,
    organizationId: orgId,
    ownerId: members[i % 3].userId,
    name: p[0],
    email: p[1],
    company: p[2],
    jobTitle: p[3],
    phone: `+1 (415) 555-${String(100 + i).padStart(4, '0')}`,
    tags:
      i % 3 === 0
        ? ['Enterprise', 'Decision maker']
        : i % 3 === 1
          ? ['SaaS', 'Warm lead']
          : ['High intent', 'SaaS'],
    source: p[5],
    notes: `${p[0].split(' ')[0]} is evaluating a new platform for ${p[2]}. Priorities: reduce manual work, improve team visibility, and a smooth onboarding experience.`,
    aiScore: Number(p[4]),
    aiExplanation:
      'Sample score: decision-maker engagement, clear business need and recent buying signals.',
    createdAt: date(-30 - i),
    updatedAt: date(-i),
  }));
  const dealRows: [number, string, Stage, number, number, number][] = [
    [2, 'Catalog · Enterprise rollout', 'negotiation', 48000, 85, 8],
    [0, 'Layers · Platform expansion', 'proposal', 36000, 65, 15],
    [1, 'Sisyphus · Annual subscription', 'qualified', 24000, 40, 24],
    [3, 'Circooles · Sales workspace', 'lead', 18000, 15, 32],
    [5, 'Command+R · Team plan', 'proposal', 28500, 60, 18],
    [4, 'Hourglass · Growth package', 'qualified', 21000, 45, 27],
    [7, 'Boltshift · Enterprise license', 'negotiation', 56000, 90, 5],
    [6, 'Feather · Partner workspace', 'lead', 15000, 20, 40],
    [8, 'Acme · Company rollout', 'won', 42000, 100, -4],
    [9, 'Cloudwatch · Annual contract', 'won', 32000, 100, -10],
    [10, 'Orbit · Expansion', 'won', 27000, 100, -16],
    [11, 'Nietzsche · Pilot program', 'lost', 12000, 0, -7],
  ];
  const deals = dealRows.map((d, i) => ({
    id: `${orgId}-d${i}`,
    organizationId: orgId,
    ownerId: contacts[d[0]].ownerId,
    contactId: contacts[d[0]].id,
    title: d[1],
    stage: d[2],
    value: d[3],
    probability: d[4],
    closeDate: date(d[5]),
    notes:
      'Success criteria agreed. Next step: confirm scope and implementation timeline.',
    aiScore: contacts[d[0]].aiScore,
    aiExplanation:
      'Sample score based on stakeholder engagement and deal stage.',
    createdAt: date(-35),
    updatedAt: date(-i),
  }));
  const rows: [
    number,
    string,
    'task' | 'call' | 'email' | 'meeting' | 'note',
    number,
    boolean,
  ][] = [
    [0, 'Send revised proposal to Lana', 'task', 0, false],
    [1, 'Follow up with Olivia on pricing', 'task', 0, false],
    [6, 'Boltshift · Final contract review', 'meeting', 1, false],
    [2, 'Schedule a discovery call with Phoenix', 'task', 2, false],
    [4, 'Send onboarding timeline to Natali', 'task', -1, false],
    [0, 'Discussed security requirements', 'call', -2, true],
    [1, 'Shared the updated platform overview', 'email', -3, true],
    [6, 'Met engineering team for technical review', 'meeting', -1, true],
    [8, 'Contract signed — welcome aboard!', 'note', -4, true],
    [2, 'Initial discovery call completed', 'call', -18, true],
    [3, 'Budget confirmed for next quarter', 'note', -19, true],
  ];
  const activities = rows.map((a, i) => ({
    id: `${orgId}-a${i}`,
    organizationId: orgId,
    ownerId: deals[a[0]].ownerId,
    contactId: deals[a[0]].contactId,
    dealId: deals[a[0]].id,
    title: a[1],
    body: 'Stakeholders aligned on the business goals. Follow up on timeline and scope.',
    type: a[2],
    status: a[4] ? ('completed' as const) : ('pending' as const),
    dueDate: date(a[3]),
    reminderAt: date(a[3]),
    completedAt: a[4] ? date(a[3]) : null,
    createdAt: date(a[4] ? a[3] : -5),
    updatedAt: date(a[4] ? a[3] : -5),
  }));
  return {
    contacts,
    deals,
    activities,
    members,
    organizationId: orgId,
    userId: 'demo-alex',
    organizations: [
      { id: 'demo-northstar', name: 'Northstar Studio', role: 'admin' },
      { id: 'demo-ventures', name: 'Acme Ventures', role: 'admin' },
    ],
    usage: {
      actions: 187,
      tokens: 384250,
      costUsd: 1.91,
      reservedTokens: 0,
      reservedActions: 0,
      byUser: [
        {
          userId: 'demo-alex',
          name: 'Alex Morgan',
          actions: 86,
          tokens: 177700,
          costUsd: 0.91,
        },
        {
          userId: 'demo-sarah',
          name: 'Sarah Chen',
          actions: 64,
          tokens: 131100,
          costUsd: 0.63,
        },
        {
          userId: 'demo-james',
          name: 'James Wilson',
          actions: 37,
          tokens: 75450,
          costUsd: 0.37,
        },
      ],
      periodStart: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
      periodEnd: new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        1,
      ).toISOString(),
      tier: 'starter',
      status: 'trialing',
      seats: 3,
      includedActions: 500,
      includedTokens: 1000000,
      monthlySeatPriceUsd: 29,
      maxSeats: 5,
    },
  };
}
