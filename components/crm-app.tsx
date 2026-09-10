'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  ArrowUpRight,
  ArrowRight,
  ArrowDownRight,
  LayoutDashboard,
  Users,
  Layers,
  CheckSquare,
  Sparkles,
  Settings,
  CreditCard,
  Search,
  Plus,
  ChevronDown,
  Bell,
  ChevronsUpDown,
  Activity as ActivityIcon,
  TrendingUp,
  Target,
  Clock,
  CalendarDays,
  Phone,
  Mail,
  Video,
  FileText,
  BookOpen,
  LogOut,
  Command,
  MoreHorizontal,
  LoaderCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  CRMData,
  Contact,
  Deal,
  Activity,
  Entity,
  stages,
  money,
  initials,
} from '@/lib/types';
import { sampleData } from '@/lib/sample-data';
import {
  DEMO,
  readDemo,
  writeDemo,
  mutateDemo,
  switchDemo,
} from '@/lib/demo-store';
import { RecordDialog, RecordDetail } from './records';
import { Assistant } from './assistant';
import { ConversationHome } from './conversation-home';
import { Intelligence } from './intelligence';
import { Billing, OrganizationSettings, TestGuide } from './settings';
export type View =
  | 'dashboard'
  | 'contacts'
  | 'deals'
  | 'activities'
  | 'intelligence'
  | 'settings'
  | 'billing'
  | 'guide';
export type AppActions = {
  data: CRMData;
  setData: (d: CRMData) => void;
  mutate: (
    entity: Entity,
    method: string,
    id: string | undefined,
    input: Record<string, unknown>,
  ) => Promise<void>;
  reload: () => Promise<void>;
  openRecord: (entity: Entity, record?: Contact | Deal | Activity) => void;
};
const nav = [
  ['dashboard', 'Chat & work', Sparkles, '/'],
  ['contacts', 'Contacts', Users, '/contacts'],
  ['deals', 'Deals', Layers, '/deals'],
  ['activities', 'Activities', CheckSquare, '/activities'],
  ['intelligence', 'AI workspace', Sparkles, '/intelligence'],
] as const;
export function Picker({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label: string;
  className?: string;
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => v !== null && onChange(String(v))}
    >
      <SelectTrigger
        aria-label={label}
        className={className || 'h-9 bg-white min-w-32'}
      >
        <SelectValue>
          {options.find((x) => x.value === value)?.label || value}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((x) => (
          <SelectItem key={x.value} value={x.value}>
            {x.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size }}>
      {initials(name)}
    </span>
  );
}
export function CRMApp({ view }: { view: View }) {
  const router = useRouter();
  const [data, setRaw] = useState<CRMData>(sampleData);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [assistant, setAssistant] = useState(false);
  const [assistantPrompt, setAssistantPrompt] = useState('');
  const [record, setRecord] = useState<{
    entity: Entity;
    value?: Contact | Deal | Activity;
  } | null>(null);
  const [detail, setDetail] = useState<{
    entity: Entity;
    value: Contact | Deal | Activity;
  } | null>(null);
  const [filter, setFilter] = useState('all');
  const setData = useCallback((d: CRMData) => {
    setRaw(d);
    if (DEMO) writeDemo(d);
  }, []);
  const reload = useCallback(async () => {
    if (DEMO) {
      setRaw(readDemo());
      setReady(true);
      return;
    }
    const res = await fetch('/api/crm/bootstrap', { cache: 'no-store' });
    if (res.status === 401) {
      router.replace('/login');
      return;
    }
    const json = await res.json();
    if (!res.ok) throw Error(json.error || 'Could not load your workspace');
    setRaw(json);
    setReady(true);
  }, [router]);
  useEffect(() => {
    reload().catch((e) => setError(e.message));
    if (view === 'contacts')
      setQuery(new URLSearchParams(location.search).get('q') || '');
  }, [reload, view]);
  const mutate = async (
    entity: Entity,
    method: string,
    id: string | undefined,
    input: Record<string, unknown>,
  ) => {
    if (DEMO) setData(mutateDemo(data, entity, method, id, input));
    else {
      const r = await fetch(`/api/crm/${entity}${id ? '/' + id : ''}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: method === 'DELETE' ? undefined : JSON.stringify(input),
      });
      const j = await r.json();
      if (!r.ok) throw Error(j.error || 'Unable to save');
      await reload();
    }
  };
  const openRecord = (entity: Entity, value?: Contact | Deal | Activity) =>
    setRecord({ entity, value });
  const actions = { data, setData, mutate, reload, openRecord };
  const ask = (prompt: string) => {
    setAssistantPrompt(prompt);
    setAssistant(true);
  };
  const org = data.organizations.find((x) => x.id === data.organizationId);
  const me = data.members.find((x) => x.userId === data.userId);
  const title =
    nav.find((n) => n[0] === view)?.[1] ||
    (
      {
        billing: 'Usage & billing',
        settings: 'Organization settings',
        guide: 'Testing guide',
      } as Record<string, string>
    )[view];
  if (!ready)
    return (
      <div className="auth-bg">
        <div className="auth-card text-center">
          <div className="text-xl font-semibold mb-5">Relay CRM</div>
          {error ? (
            <>
              <p className="form-error">{error}</p>
              <Button className="mt-5" onClick={() => location.reload()}>
                Try again
              </Button>
            </>
          ) : (
            <>
              <LoaderCircle className="animate-spin mx-auto text-primary" />
              <p className="subtitle">Opening your workspace…</p>
            </>
          )}
        </div>
      </div>
    );
  return (
    <SidebarProvider
      className="conversation-shell"
      style={{ '--sidebar-width': '238px' } as React.CSSProperties}
    >
      <Sidebar className="border-r relay-sidebar">
        <SidebarHeader className="px-6 pt-8 pb-6">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-[25px] font-semibold tracking-[-1.2px]"
          >
            <span className="flex items-center justify-center w-8 h-8 bg-primary text-white rounded-[9px]">
              <Layers size={21} />
            </span>
            relay
            <span className="w-1.5 h-1.5 rounded-full bg-primary self-end mb-2.5 -ml-1" />
          </Link>
        </SidebarHeader>
        <SidebarContent className="px-4 gap-4">
          <div className="p-2 bg-white border rounded-lg mb-2">
            <div className="flex items-center gap-2 px-1">
              <span className="flex items-center justify-center w-7 h-7 bg-[#eef0f8] text-[#7280a1] text-xs font-semibold rounded">
                {initials(org?.name || 'Workspace')}
              </span>
              <Picker
                label="Switch organization"
                value={data.organizationId}
                options={data.organizations.map((x) => ({
                  value: x.id,
                  label: x.name,
                }))}
                onChange={async (id) => {
                  if (DEMO) setData(switchDemo(id));
                  else {
                    const r = await fetch('/api/organizations/switch', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ organizationId: id }),
                    });
                    if (r.ok) await reload();
                    else toast.error('Unable to switch organization');
                  }
                  setDetail(null);
                  setAssistant(false);
                }}
                className="border-0 shadow-none p-0 min-w-0 w-full text-[13px]"
              />
            </div>
          </div>
          <div className="small-cap px-3">Workspace</div>
          <nav className="space-y-1">
            {nav.map(([id, label, Icon, path]) => (
              <Link
                key={id}
                href={path}
                className={`nav-link ${view === id ? 'active' : ''}`}
              >
                <Icon />
                {label}
                {id === 'intelligence' && (
                  <span className="ml-auto text-[10px] tracking-wide bg-[#e7e2f8] text-[#8770c5] px-1.5 py-0.5 rounded">
                    AI
                  </span>
                )}
              </Link>
            ))}
          </nav>
          <div className="small-cap px-3 mt-5">Manage</div>
          <nav className="space-y-1">
            <Link
              href="/billing"
              className={`nav-link ${view === 'billing' ? 'active' : ''}`}
            >
              <CreditCard />
              Usage & billing
            </Link>
            <Link
              href="/settings"
              className={`nav-link ${view === 'settings' ? 'active' : ''}`}
            >
              <Settings />
              Settings
            </Link>
          </nav>
        </SidebarContent>
        <SidebarFooter className="p-4 gap-4">
          <div className="rounded-lg border border-[#e3dff4] bg-[#f1effb] p-3.5">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-[#6f60bc]">
              <Sparkles size={14} />
              Your AI allowance
              <span className="ml-auto text-[11px] capitalize font-normal">
                {data.usage.tier}
              </span>
            </div>
            <Progress
              value={Math.min(
                100,
                (data.usage.tokens / data.usage.includedTokens) * 100,
              )}
              className="mt-3 [&_[data-slot=progress-track]]:h-1.5"
              aria-label="AI token allowance used"
            />
            <p className="text-[12px] text-[#8a81a9] mt-2">
              {Math.round(data.usage.tokens / 1000)}k /{' '}
              {Math.round(data.usage.includedTokens / 1000000)}M tokens used
            </p>
            <Link
              href="/billing"
              className="mt-3 flex items-center justify-between text-xs text-[#7466b9] font-medium"
            >
              View usage <ArrowUpRight size={14} />
            </Link>
          </div>
          <Link href="/guide" className="nav-link !py-1">
            <BookOpen />
            Testing guide <ArrowUpRight className="ml-auto !w-4" />
          </Link>
          <div className="border-t pt-4 flex gap-2.5 items-center">
            <Avatar name={me?.user.name || 'Alex Morgan'} size={35} />
            <div>
              <div className="text-[13px] font-medium">{me?.user.name}</div>
              <div className="text-xs muted capitalize mt-0.5">
                {org?.role} · {DEMO ? 'Demo workspace' : 'Member'}
              </div>
            </div>
            {!DEMO && (
              <Button
                size="icon"
                variant="ghost"
                aria-label="Sign out"
                onClick={() => signOut({ callbackUrl: '/login' })}
              >
                <LogOut size={15} />
              </Button>
            )}
          </div>
        </SidebarFooter>
      </Sidebar>
      <div className="flex-1 min-w-0">
        <header className="crm-topbar h-[72px] px-6 border-b bg-white flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <SidebarTrigger className="md:hidden" />
            <span className="text-sm text-[#979caa]">Sales workspace</span>
            <span className="text-[#c2c7d1]">/</span>
            <span className="text-sm font-medium">{title}</span>
          </div>
          <div className="flex items-center gap-5">
            <form
              className="header-search flex items-center gap-2 text-[#a1a7b3]"
              onSubmit={(e) => {
                e.preventDefault();
                router.push('/contacts?q=' + encodeURIComponent(query));
              }}
            >
              <Search size={17} />
              <input
                aria-label="Search workspace"
                placeholder="Search anything…"
                className="text-sm w-40 outline-none text-foreground"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </form>
            {DEMO && (
              <span className="tag !bg-[#f1eefb] !text-[#8572bc]">
                Demo mode
              </span>
            )}
            <button
              aria-label="View reminders"
              onClick={() => router.push('/activities')}
              className="relative"
            >
              <Bell size={18} className="text-[#7b8496]" />
              {data.activities.some(
                (x) =>
                  x.status === 'pending' &&
                  x.dueDate &&
                  new Date(x.dueDate) <= new Date(),
              ) && (
                <span className="absolute -top-0.5 -right-0.5 rounded-full bg-primary w-1.5 h-1.5 ring-2 ring-white" />
              )}
            </button>
            <Avatar name={me?.user.name || 'Alex Morgan'} />
          </div>
        </header>
        <main
          className={`app-main ${view === 'dashboard' ? 'conversation-main' : ''}`}
        >
          <div
            className={`flex justify-between gap-4 items-start mb-7 ${view === 'dashboard' ? 'hidden' : ''}`}
          >
            <div>
              <div className="flex items-center gap-2">
                {view === 'dashboard' ? (
                  <h1 className="page-title">
                    Good morning, {me?.user.name.split(' ')[0] || 'Alex'}
                  </h1>
                ) : (
                  <h1 className="page-title">{title}</h1>
                )}
              </div>
              <p className="subtitle">
                {view === 'dashboard'
                  ? 'Your sales workspace. Every relationship, every next step.'
                  : view === 'contacts'
                    ? 'Every relationship. A little more connected.'
                    : view === 'deals'
                      ? 'Keep your next win moving forward.'
                      : view === 'activities'
                        ? 'The right follow-up, at the right time.'
                        : view === 'intelligence'
                          ? 'Turn conversations into your next best move.'
                          : view === 'billing'
                            ? 'A clear view of your plan, team and AI usage.'
                            : view === 'settings'
                              ? 'Your workspace, people and preferences.'
                              : 'A hands-on walkthrough of your CRM.'}
              </p>
            </div>
            <div className="flex items-center gap-2 pt-0.5">
              {view === 'dashboard' && (
                <span className="outline-btn hide-mobile border inline-flex items-center gap-2 text-sm">
                  <CalendarDays size={15} />
                  {new Date().toLocaleDateString('en-US', {
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              )}
              {['dashboard', 'contacts', 'deals', 'activities'].includes(
                view,
              ) && (
                <Button
                  className="primary-btn"
                  onClick={() =>
                    openRecord(
                      view === 'contacts'
                        ? 'contacts'
                        : view === 'activities'
                          ? 'activities'
                          : 'deals',
                    )
                  }
                >
                  <Plus size={16} />
                  {view === 'contacts'
                    ? 'Add contact'
                    : view === 'activities'
                      ? 'New activity'
                      : 'New deal'}
                </Button>
              )}
            </div>
          </div>
          {!DEMO &&
            ['contacts', 'deals', 'activities'].some(
              (e) => data[e as Entity].length >= 1000,
            ) && (
              <p className="form-error mb-5">
                This workspace shows the 1,000 most recently updated records per
                view. Dashboard totals include all records. Use the paginated
                CRM API for full exports and larger datasets.
              </p>
            )}
          {view === 'dashboard' && (
            <ConversationHome
              key={data.organizationId}
              {...actions}
              ask={ask}
              showDetail={(entity, value) => setDetail({ entity, value })}
            />
          )}
          {view === 'contacts' && (
            <Contacts
              {...actions}
              query={query}
              setQuery={setQuery}
              filter={filter}
              setFilter={setFilter}
              show={(value) => setDetail({ entity: 'contacts', value })}
            />
          )}
          {view === 'deals' && (
            <Deals
              {...actions}
              query={query}
              setQuery={setQuery}
              show={(value) => setDetail({ entity: 'deals', value })}
            />
          )}
          {view === 'activities' && (
            <Activities
              {...actions}
              query={query}
              setQuery={setQuery}
              show={(value) => setDetail({ entity: 'activities', value })}
            />
          )}
          {view === 'intelligence' && <Intelligence {...actions} />}
          {view === 'billing' && <Billing {...actions} />}
          {view === 'settings' && <OrganizationSettings {...actions} />}
          {view === 'guide' && <TestGuide />}
        </main>
        <Button
          onClick={() => {
            setAssistantPrompt('');
            setAssistant(true);
          }}
          className="fixed bottom-6 right-7 h-12 px-5 rounded-full shadow-[0_5px_24px_#6254c33b] z-30"
        >
          <Sparkles size={17} />
          Ask Relay <span className="ml-2 text-white/50">↗</span>
        </Button>
      </div>
      <RecordDialog
        record={record}
        onClose={() => setRecord(null)}
        {...actions}
      />
      <RecordDetail
        detail={detail}
        onClose={() => setDetail(null)}
        {...actions}
        ask={ask}
      />
      <Assistant
        open={assistant}
        onClose={() => setAssistant(false)}
        initialPrompt={assistantPrompt}
        {...actions}
      />
    </SidebarProvider>
  );
}
function Dashboard({
  data,
  mutate,
  ask,
  showDetail,
}: AppActions & {
  ask: (s: string) => void;
  showDetail: (e: Entity, r: Contact | Deal | Activity) => void;
}) {
  const open = data.deals.filter((d) => !['won', 'lost'].includes(d.stage));
  const closed = data.deals.filter((d) => ['won', 'lost'].includes(d.stage));
  const won = closed.filter((d) => d.stage === 'won');
  const pipeline =
    data.dashboard?.pipeline ?? open.reduce((a, d) => a + d.value, 0);
  const weighted =
    data.dashboard?.weighted ??
    open.reduce((a, d) => a + (d.value * d.probability) / 100, 0);
  const upcoming =
    data.dashboard?.upcoming ??
    data.activities
      .filter((x) => x.status === 'pending')
      .sort((a, b) => (a.dueDate || 'z').localeCompare(b.dueDate || 'z'));
  const recent =
    data.dashboard?.recent ??
    data.activities
      .filter((x) => x.status === 'completed')
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 4);
  const stageData = stages.slice(0, 4).map((s) => ({
    ...s,
    value:
      data.dashboard?.stages.find((g) => g.id === s.id)?.value ??
      open.filter((d) => d.stage === s.id).reduce((a, d) => a + d.value, 0),
    count:
      data.dashboard?.stages.find((g) => g.id === s.id)?.count ??
      open.filter((d) => d.stage === s.id).length,
  }));
  const max = Math.max(...stageData.map((s) => s.value), 1);
  const closing =
    data.dashboard?.closing ??
    open.filter(
      (d) =>
        d.closeDate &&
        new Date(d.closeDate).getTime() - Date.now() < 14 * 86400000,
    ).length;
  const metrics = [
    {
      label: 'Total pipeline',
      value: money(pipeline),
      icon: Layers,
      foot: `${data.dashboard?.openCount ?? open.length} active opportunities`,
      accent: 'Open pipeline',
    },
    {
      label: 'Weighted forecast',
      value: money(weighted),
      icon: TrendingUp,
      foot: 'Based on deal probabilities',
      accent: 'Expected revenue',
    },
    {
      label: 'Win rate',
      value: `${(data.dashboard?.closed ?? closed.length) ? Math.round(((data.dashboard?.won ?? won.length) / (data.dashboard?.closed ?? closed.length)) * 100) : 0}%`,
      icon: Target,
      foot: `${data.dashboard?.won ?? won.length} won of ${data.dashboard?.closed ?? closed.length} closed deals`,
      accent: 'All closed deals',
    },
    {
      label: 'Active contacts',
      value: (data.dashboard?.contacts ?? data.contacts.length).toString(),
      icon: Users,
      foot: `Across ${data.dashboard?.companies ?? new Set(data.contacts.map((c) => c.company)).size} companies`,
      accent: 'Your relationships',
    },
  ];
  return (
    <>
      <div className="metrics-grid grid grid-cols-4 gap-4 mb-6">
        {metrics.map((m) => (
          <div className="panel p-5" key={m.label}>
            <div className="flex justify-between items-center text-[13px] text-[#798395]">
              <span>{m.label}</span>
              <m.icon size={17} className="text-[#959ab3]" />
            </div>
            <div className="metric-value mt-4 mb-3">{m.value}</div>
            <div className="text-[12px] text-[#8a92a2]">
              <span className="inline-flex items-center gap-1 text-[#5d977c] mr-1.5">
                <span className="w-1 h-1 bg-[#6aa184] rounded-full" />
                {m.accent}
              </span>
            </div>
            <div className="text-xs muted mt-2">{m.foot}</div>
          </div>
        ))}
      </div>
      <div className="ai-gradient rounded-xl px-5 py-4 mb-6 flex items-center justify-between gap-4">
        <div className="flex gap-3.5 items-center">
          <span className="bg-white text-primary rounded-lg p-2 border border-[#e7e0f7]">
            <Sparkles size={19} />
          </span>
          <div>
            <div className="text-[14px] font-medium text-[#64518e]">
              A little intelligence. A lot of momentum.
            </div>
            <div className="text-[13px] text-[#9386a7] mt-1">
              {closing} deals are closing soon. Let Relay help you find the next
              best action.
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          className="text-[#8774b6] text-[13px] shrink-0"
          onClick={() =>
            ask(
              'Show deals closing in the next two weeks and suggest my priorities.',
            )
          }
        >
          <span className="hide-mobile">Explore insights</span>
          <ArrowRight size={16} />
        </Button>
      </div>
      <div className="dashboard-grid grid grid-cols-[1.5fr_1fr] gap-6 mb-6">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Pipeline by stage</h2>
              <p className="text-xs muted mt-1.5">
                A clear path from first hello to closed won.
              </p>
            </div>
            <Link
              href="/deals"
              className="text-xs text-[#8a8fa4] flex gap-1 items-center"
            >
              View pipeline <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="px-6 py-5">
            <div className="flex items-end gap-3">
              <span className="text-[25px] tracking-tight font-semibold">
                {money(pipeline)}
              </span>
              <span className="text-xs muted mb-1.5">
                across {data.dashboard?.openCount ?? open.length} open deals
              </span>
            </div>
            <div className="mt-6 space-y-5">
              {stageData.map((s) => (
                <div
                  className="grid grid-cols-[88px_1fr_62px] items-center gap-3"
                  key={s.id}
                >
                  <span className="text-[12px] text-[#788296]">{s.label}</span>
                  <div className="chart-grid h-7">
                    <div
                      className="h-full rounded-r bar-fill flex justify-end items-center pr-2 min-w-5"
                      style={{
                        width: `${Math.max(5, (s.value / max) * 95)}%`,
                        background: s.color,
                      }}
                    >
                      <span className="text-[11px] text-white/90">
                        {s.count}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-[#7a8092] text-right">
                    {money(s.value)}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex justify-between pl-[100px] pr-[72px] text-[11px] text-[#a8aebb] mt-5">
              <span>$0</span>
              <span>{money(max / 2)}</span>
              <span>{money(max)}</span>
            </div>
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div className="flex items-center gap-2">
              <h2>Up next</h2>
              <span className="tag">
                {data.dashboard?.pending ?? upcoming.length}
              </span>
            </div>
            <Link
              href="/activities"
              className="text-xs text-[#8a8fa4] flex items-center gap-1"
            >
              View all <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="px-5">
            {upcoming.slice(0, 4).map((a) => (
              <div
                key={a.id}
                className="py-[18px] border-b last:border-b-0 flex gap-3"
              >
                <button
                  aria-label={`Complete ${a.title}`}
                  onClick={() =>
                    mutate('activities', 'PATCH', a.id, { status: 'completed' })
                      .then(() => toast.success('Activity completed'))
                      .catch((e) => toast.error(e.message))
                  }
                  className="w-[17px] h-[17px] rounded-full border border-[#d7dce6] mt-1 hover:bg-[#ebe6fb] shrink-0"
                />
                <div className="min-w-0">
                  <button
                    className="text-[13px] font-medium text-left leading-relaxed"
                    onClick={() => showDetail('activities', a)}
                  >
                    {a.title}
                  </button>
                  <div className="flex items-center gap-2 text-[11px] text-[#9a9faf] mt-1.5">
                    <span>
                      {data.contacts.find((c) => c.id === a.contactId)
                        ?.company || 'Workspace'}
                    </span>
                    <span>·</span>
                    <span
                      className={
                        a.dueDate && new Date(a.dueDate) < new Date()
                          ? 'text-[#c88869]'
                          : ''
                      }
                    >
                      {a.dueDate
                        ? new Date(a.dueDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })
                        : 'No due date'}
                    </span>
                  </div>
                </div>
                <span className="ml-auto">
                  <Avatar
                    name={
                      data.members.find((m) => m.userId === a.ownerId)?.user
                        .name || 'Team'
                    }
                    size={25}
                  />
                </span>
              </div>
            ))}
            {!upcoming.length && (
              <div className="empty">You’re all caught up.</div>
            )}
          </div>
        </section>
      </div>
      <div className="dashboard-grid grid grid-cols-[1.5fr_1fr] gap-6">
        <section className="panel overflow-hidden">
          <div className="panel-heading">
            <h2>Deals to keep an eye on</h2>
            <Link
              href="/deals"
              className="text-xs text-[#8a8fa4] flex items-center gap-1"
            >
              All deals <ArrowUpRight size={14} />
            </Link>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-[#fafbfe]">
                <TableHead className="pl-6 text-xs font-normal">
                  Deal name
                </TableHead>
                <TableHead className="text-xs font-normal">Value</TableHead>
                <TableHead className="text-xs font-normal">Stage</TableHead>
                <TableHead className="text-xs font-normal">AI score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {open
                .slice()
                .sort((a, b) => b.value - a.value)
                .slice(0, 4)
                .map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="pl-6 py-4">
                      <button
                        className="table-link text-xs"
                        onClick={() => showDetail('deals', d)}
                      >
                        {d.title}
                      </button>
                      <div className="text-[11px] text-[#9ca3b0] mt-1">
                        {data.contacts.find((c) => c.id === d.contactId)?.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{money(d.value)}</TableCell>
                    <TableCell>
                      <span className="tag capitalize text-[11px]">
                        <span
                          className="stage-dot !w-1.5 !h-1.5"
                          style={{
                            background: stages.find((s) => s.id === d.stage)
                              ?.color,
                          }}
                        />
                        {d.stage}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="score">
                        <Sparkles size={10} />
                        {d.aiScore ?? '—'}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Recent activity</h2>
            <ActivityIcon size={16} className="text-[#b2b6c4]" />
          </div>
          <div className="px-5">
            {recent.map((a) => (
              <button
                className="timeline-item w-full text-left last:border-b-0"
                key={a.id}
                onClick={() => showDetail('activities', a)}
              >
                <span className="activity-icon">
                  {a.type === 'call' ? (
                    <Phone size={14} />
                  ) : a.type === 'email' ? (
                    <Mail size={14} />
                  ) : a.type === 'meeting' ? (
                    <Video size={14} />
                  ) : (
                    <FileText size={14} />
                  )}
                </span>
                <div>
                  <div className="text-xs leading-relaxed">{a.title}</div>
                  <p className="text-[11px] text-[#9ba2b0] mt-1.5">
                    {data.contacts.find((c) => c.id === a.contactId)?.company} ·{' '}
                    {new Date(a.updatedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </button>
            ))}
            {!recent.length && (
              <div className="empty">Activity will appear here.</div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
function Contacts(
  props: AppActions & {
    query: string;
    setQuery: (v: string) => void;
    filter: string;
    setFilter: (v: string) => void;
    show: (c: Contact) => void;
  },
) {
  const { data, query, setQuery, filter, setFilter, show } = props;
  const [page, setPage] = useState(0);
  const rows = data.contacts.filter(
    (c) =>
      `${c.name} ${c.email} ${c.company} ${c.tags.join(' ')}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (filter === 'all' || c.tags.includes(filter)),
  );
  return (
    <section className="panel overflow-hidden">
      <div className="p-5 flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs w-full">
          <Search size={16} className="absolute left-3 top-3 text-[#9ca3b3]" />
          <Input
            placeholder="Search contacts…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            className="pl-9 h-10"
          />
        </div>
        <Picker
          label="Filter by tag"
          value={filter}
          onChange={(v) => {
            setFilter(v);
            setPage(0);
          }}
          options={[
            { value: 'all', label: 'All tags' },
            ...Array.from(new Set(data.contacts.flatMap((c) => c.tags))).map(
              (t) => ({ value: t, label: t }),
            ),
          ]}
        />
        <Button
          variant="outline"
          className="outline-btn ml-auto"
          onClick={() =>
            props.openRecord('contacts', { id: 'import' } as Contact)
          }
        >
          Import CSV
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="bg-[#fafbfe]">
            <TableHead className="pl-6">Name</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Tags</TableHead>
            <TableHead>AI score</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Source</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.slice(page * 10, page * 10 + 10).map((c) => (
            <TableRow key={c.id} className="data-row">
              <TableCell className="py-4 pl-6">
                <div className="flex items-center gap-3">
                  <Avatar name={c.name} />
                  <div>
                    <button
                      className="table-link text-sm"
                      onClick={() => show(c)}
                    >
                      {c.name}
                    </button>
                    <div className="text-xs muted mt-1">{c.email}</div>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-sm">
                {c.company}
                <div className="text-xs muted mt-1">{c.jobTitle}</div>
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {c.tags.map((t) => (
                    <span className="tag" key={t}>
                      {t}
                    </span>
                  ))}
                </div>
              </TableCell>
              <TableCell>
                <span className="score">
                  <Sparkles size={11} />
                  {c.aiScore ?? '—'}
                </span>
              </TableCell>
              <TableCell>
                <Avatar
                  name={
                    data.members.find((x) => x.userId === c.ownerId)?.user
                      .name || 'Team'
                  }
                />
              </TableCell>
              <TableCell className="text-xs muted">{c.source}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!rows.length && (
        <div className="empty">No contacts match your search.</div>
      )}
      <div className="flex justify-between items-center p-5 border-t text-xs muted">
        <span>
          {rows.length} contacts · Page {page + 1} of{' '}
          {Math.max(1, Math.ceil(rows.length / 10))}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            disabled={(page + 1) * 10 >= rows.length}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </section>
  );
}
function Deals({
  data,
  mutate,
  openRecord,
  query,
  setQuery,
  show,
}: AppActions & {
  query: string;
  setQuery: (v: string) => void;
  show: (d: Deal) => void;
}) {
  const [owner, setOwner] = useState('all');
  const rows = data.deals.filter(
    (d) =>
      d.title.toLowerCase().includes(query.toLowerCase()) &&
      (owner === 'all' || d.ownerId === owner),
  );
  return (
    <>
      <div className="flex gap-3 mb-5">
        <Input
          className="max-w-xs bg-white h-10"
          placeholder="Search deals…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Picker
          label="Deal owner"
          value={owner}
          onChange={setOwner}
          options={[
            { value: 'all', label: 'All owners' },
            ...data.members.map((m) => ({
              value: m.userId,
              label: m.user.name,
            })),
          ]}
        />
        <div className="ml-auto text-sm muted self-center hide-mobile">
          {rows.length} deals · {money(rows.reduce((a, d) => a + d.value, 0))}
        </div>
      </div>
      <div className="kanban">
        {stages.map((s) => {
          const deals = rows.filter((d) => d.stage === s.id);
          return (
            <section
              className="kanban-col"
              key={s.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData('text/plain');
                if (rows.some((d) => d.id === id))
                  mutate('deals', 'PATCH', id, { stage: s.id })
                    .then(() => toast.success(`Moved to ${s.label}`))
                    .catch((e) => toast.error(e.message));
              }}
            >
              <div className="flex items-center gap-2 px-1 pt-1 text-sm font-medium">
                <span className="stage-dot" style={{ background: s.color }} />
                {s.label}
                <span className="text-xs muted">{deals.length}</span>
                <button
                  className="ml-auto text-[#9ca4b6]"
                  aria-label={`Add deal to ${s.label}`}
                  onClick={() => openRecord('deals', { stage: s.id } as Deal)}
                >
                  <Plus size={15} />
                </button>
              </div>
              <p className="text-xs muted px-1 mt-2 mb-4">
                {money(deals.reduce((a, d) => a + d.value, 0))}
              </p>
              {deals.map((d) => (
                <article
                  key={d.id}
                  className="deal-card"
                  draggable
                  onDragStart={(e) =>
                    e.dataTransfer.setData('text/plain', d.id)
                  }
                >
                  <div className="flex justify-between mb-3">
                    <span className="tag">
                      {data.contacts.find((c) => c.id === d.contactId)
                        ?.company || 'Opportunity'}
                    </span>
                    <button
                      aria-label={`Open ${d.title}`}
                      onClick={() => show(d)}
                    >
                      <MoreHorizontal size={16} className="muted" />
                    </button>
                  </div>
                  <button
                    className="text-sm font-medium text-left leading-relaxed"
                    onClick={() => show(d)}
                  >
                    {d.title}
                  </button>
                  <div className="text-lg font-semibold mt-3 mb-4">
                    {money(d.value)}
                  </div>
                  <div className="border-t pt-3 flex justify-between items-center">
                    <span className="text-xs muted flex gap-1 items-center">
                      <CalendarDays size={12} />
                      {d.closeDate
                        ? new Date(d.closeDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })
                        : 'No date'}
                    </span>
                    <span className="score">
                      <Sparkles size={10} />
                      {d.aiScore ?? '—'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-3">
                    <Avatar
                      name={
                        data.members.find((m) => m.userId === d.ownerId)?.user
                          .name || 'Team'
                      }
                      size={24}
                    />
                    <span className="text-xs muted">
                      {d.probability}% probability
                    </span>
                  </div>
                </article>
              ))}
              {!deals.length && (
                <p className="text-xs text-center text-[#a6adbc] mt-12">
                  Drop a deal here
                </p>
              )}
            </section>
          );
        })}
      </div>
      <p className="text-xs muted mt-2">
        Drag a card to change its stage, or open a deal to choose a stage with
        the keyboard.
      </p>
    </>
  );
}
function Activities({
  data,
  mutate,
  query,
  setQuery,
  show,
}: AppActions & {
  query: string;
  setQuery: (v: string) => void;
  show: (a: Activity) => void;
}) {
  const [filter, setFilter] = useState('pending');
  const rows = data.activities
    .filter(
      (a) =>
        (filter === 'all' || a.status === filter) &&
        a.title.toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) => (a.dueDate || 'z').localeCompare(b.dueDate || 'z'));
  return (
    <section className="panel">
      <div className="p-5 flex gap-3">
        <Input
          className="max-w-xs h-10"
          placeholder="Find an activity…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Picker
          label="Activity status"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'pending', label: 'Upcoming & overdue' },
            { value: 'completed', label: 'Completed' },
            { value: 'all', label: 'All activities' },
          ]}
        />
      </div>
      <div className="px-5">
        {rows.map((a) => (
          <div key={a.id} className="timeline-item items-center">
            <button
              aria-label={`${a.status === 'completed' ? 'Reopen' : 'Complete'} ${a.title}`}
              className={`w-5 h-5 rounded-full border shrink-0 ${a.status === 'completed' ? 'bg-primary text-white' : ''}`}
              onClick={() =>
                mutate('activities', 'PATCH', a.id, {
                  status: a.status === 'completed' ? 'pending' : 'completed',
                })
                  .then(() => toast.success('Activity updated'))
                  .catch((e) => toast.error(e.message))
              }
            >
              {a.status === 'completed' && <span className="text-xs">✓</span>}
            </button>
            <div className="flex-1">
              <button
                className={`text-sm text-left font-medium ${a.status === 'completed' ? 'line-through text-[#8991a1]' : ''}`}
                onClick={() => show(a)}
              >
                {a.title}
              </button>
              <p className="text-xs muted mt-2">
                {data.contacts.find((c) => c.id === a.contactId)?.name ||
                  'No contact'}{' '}
                ·{' '}
                {data.deals.find((d) => d.id === a.dealId)?.title ||
                  'General activity'}
              </p>
            </div>
            <span className="tag capitalize hide-mobile">{a.type}</span>
            <span
              className={`text-xs min-w-[75px] text-right ${a.status === 'pending' && a.dueDate && new Date(a.dueDate) < new Date() ? 'text-[#c18468]' : 'muted'}`}
            >
              {a.dueDate
                ? new Date(a.dueDate).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })
                : 'No due date'}
            </span>
            <Avatar
              name={
                data.members.find((m) => m.userId === a.ownerId)?.user.name ||
                'Team'
              }
            />
          </div>
        ))}
        {!rows.length && (
          <div className="empty">
            No activities here. Create one to keep the conversation moving.
          </div>
        )}
      </div>
    </section>
  );
}
