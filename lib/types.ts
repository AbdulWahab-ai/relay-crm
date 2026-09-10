export type Role = 'admin' | 'manager' | 'sales_rep';
export type Tier = 'starter' | 'pro' | 'enterprise';
export type Stage =
  | 'lead'
  | 'qualified'
  | 'proposal'
  | 'negotiation'
  | 'won'
  | 'lost';
export type Entity = 'contacts' | 'deals' | 'activities';
export type Contact = {
  id: string;
  organizationId: string;
  ownerId: string;
  name: string;
  email: string;
  company: string;
  jobTitle?: string;
  phone?: string;
  tags: string[];
  source: string;
  notes: string;
  aiScore?: number | null;
  aiExplanation?: string | null;
  scoredAt?: string | null;
  createdAt: string;
  updatedAt: string;
};
export type Deal = {
  id: string;
  organizationId: string;
  ownerId: string;
  contactId: string | null;
  title: string;
  stage: Stage;
  value: number;
  probability: number;
  closeDate: string | null;
  notes: string;
  aiScore?: number | null;
  aiExplanation?: string | null;
  createdAt: string;
  updatedAt: string;
};
export type Activity = {
  id: string;
  organizationId: string;
  ownerId: string;
  contactId: string | null;
  dealId: string | null;
  title: string;
  body: string;
  type: 'task' | 'call' | 'email' | 'meeting' | 'note';
  status: 'pending' | 'completed' | 'cancelled';
  dueDate: string | null;
  reminderAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};
export type Member = {
  userId: string;
  role: Role;
  user: { name: string; email: string };
};
export type Org = { id: string; name: string; role: Role };
export type Usage = {
  actions: number;
  tokens: number;
  costUsd: number;
  reservedTokens: number;
  reservedActions: number;
  byUser: {
    userId: string;
    name: string;
    actions: number;
    tokens: number;
    costUsd: number;
  }[];
  periodStart: string;
  periodEnd: string;
  tier: Tier;
  status: string;
  seats: number;
  includedActions: number;
  includedTokens: number;
  monthlySeatPriceUsd: number;
  maxSeats: number;
  ownOnly?: boolean;
};
export type DashboardData = {
  pipeline: number;
  openCount: number;
  weighted: number;
  won: number;
  closed: number;
  contacts: number;
  companies: number;
  stages: { id: Stage; value: number; count: number }[];
  upcoming: Activity[];
  recent: Activity[];
  pending: number;
  closing: number;
};
export type CRMData = {
  dashboard?: DashboardData;
  contacts: Contact[];
  deals: Deal[];
  activities: Activity[];
  members: Member[];
  organizations: Org[];
  organizationId: string;
  userId: string;
  usage: Usage;
};
export const stages: { id: Stage; label: string; color: string }[] = [
  { id: 'lead', label: 'Lead', color: '#93a1bb' },
  { id: 'qualified', label: 'Qualified', color: '#8297df' },
  { id: 'proposal', label: 'Proposal', color: '#9983df' },
  { id: 'negotiation', label: 'Negotiation', color: '#bfa1e5' },
  { id: 'won', label: 'Closed won', color: '#70b398' },
  { id: 'lost', label: 'Closed lost', color: '#d4919b' },
];
export const plans: Record<
  Tier,
  {
    name: string;
    price: number;
    actions: number;
    tokens: number;
    seats: number;
  }
> = {
  starter: {
    name: 'Starter',
    price: 29,
    actions: 500,
    tokens: 1000000,
    seats: 5,
  },
  pro: { name: 'Pro', price: 79, actions: 3000, tokens: 6000000, seats: 50 },
  enterprise: {
    name: 'Enterprise',
    price: 149,
    actions: 15000,
    tokens: 30000000,
    seats: 500,
  },
};
export const money = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
export const initials = (name: string) =>
  name
    .split(' ')
    .map((x) => x[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
