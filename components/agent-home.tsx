'use client';
import { useState } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  ArrowUp,
  ArrowUpRight,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Mail,
  Target,
  Layers,
  CalendarDays,
  ChevronRight,
  LoaderCircle,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AppActions } from './crm-app';
import { callAI, SuggestionCard } from './assistant';
import { AIResult } from '@/lib/demo-ai';
import { DEMO } from '@/lib/demo-store';
import {
  Contact,
  Deal,
  Activity,
  Entity,
  money,
  stages,
  initials,
} from '@/lib/types';
import { toast } from 'sonner';

export function AgentHome({
  ask,
  showDetail,
  ...app
}: AppActions & {
  ask: (prompt: string) => void;
  showDetail: (entity: Entity, value: Contact | Deal | Activity) => void;
}) {
  const { data } = app;
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<AIResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [completing, setCompleting] = useState<string | null>(null);
  const open = data.deals.filter((d) => !['won', 'lost'].includes(d.stage));
  const pipeline =
    data.dashboard?.pipeline ?? open.reduce((s, d) => s + d.value, 0);
  const weighted =
    data.dashboard?.weighted ??
    open.reduce((s, d) => s + (d.value * d.probability) / 100, 0);
  const pending = data.activities
    .filter((a) => a.status === 'pending')
    .sort((a, b) => (a.dueDate || 'z').localeCompare(b.dueDate || 'z'));
  const overdue = pending.filter(
    (a) => a.dueDate && new Date(a.dueDate).getTime() < Date.now(),
  );
  const stale = open.filter(
    (d) =>
      !data.activities.some(
        (a) =>
          a.dealId === d.id &&
          a.status === 'completed' &&
          new Date(a.completedAt || a.updatedAt).getTime() >
            Date.now() - 14 * 86400000,
      ),
  );
  const priorities = [
    ...stale,
    ...open.filter((d) => !stale.some((s) => s.id === d.id)),
  ].slice(0, 4);
  const recent = [...data.activities]
    .filter((a) => a.status === 'completed')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 4);
  async function run(question: string, deal?: Deal) {
    if (busy || !question.trim()) return;
    setBusy(true);
    setError('');
    setResult(null);
    setSelected(deal?.id || null);
    try {
      setResult(
        await callAI(
          app,
          'assistant',
          question,
          deal?.contactId || undefined,
          deal?.id,
        ),
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Unable to review your CRM. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="agent-home">
      <div className="sales-tabs">
        <span className="selected">
          <Sparkles size={16} /> My workday
        </span>
        <Link href="/deals">Pipeline</Link>
        <Link href="/intelligence">
          AI studio <span className="beta-pill">BETA</span>
        </Link>
        <Link href="/activities">Activity center</Link>
        <span className="workspace-status">
          <span /> {DEMO ? 'Sample workspace' : 'Connected workspace'}
        </span>
      </div>
      <div className="agent-layout">
        <div className="agent-main-column">
          <section className="agent-command">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <span className="agent-mark">
                  <Sparkles size={19} />
                </span>{' '}
                Relay Agent <span className="beta-pill">BETA</span>
              </div>
              <span className="text-xs text-[#637995]">
                {DEMO ? 'Demo intelligence' : 'CRM intelligence'}
              </span>
            </div>
            <h2>Let’s move your next deal forward.</h2>
            <p className="agent-intro">
              {stale.length
                ? `${stale.length} opportunities have no completed activity in 14 days.`
                : 'Your open opportunities are ready for review.'}{' '}
              {overdue.length
                ? `${overdue.length} tasks are overdue.`
                : 'Review your next steps below.'}
            </p>
            <form
              className="agent-composer"
              onSubmit={(e) => {
                e.preventDefault();
                run(prompt);
              }}
            >
              <Textarea
                aria-label="Ask your sales agent"
                placeholder="Ask a question, or tell Relay what to do…"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                maxLength={4000}
                className="!border-0 !shadow-none !bg-transparent !resize-none !min-h-16"
              />
              <div className="flex justify-between items-center px-3 pb-3 gap-2">
                <span className="text-xs text-[#72849b] flex items-center gap-1.5">
                  <Layers size={13} /> Contacts, deals & activities
                </span>
                <Button
                  type="submit"
                  size="icon"
                  aria-label="Run agent request"
                  disabled={busy || !prompt.trim()}
                  className="rounded-xl"
                >
                  {busy ? (
                    <LoaderCircle size={17} className="animate-spin" />
                  ) : (
                    <ArrowUp size={18} />
                  )}
                </Button>
              </div>
            </form>
            <div className="agent-shortcuts">
              {[
                ['Review pipeline', 'Show deals with no activity in 2 weeks'],
                ['Prioritize contacts', 'Show my highest-priority contacts'],
                ['Find closing deals', 'Show deals closing this month'],
              ].map(([label, q]) => (
                <button
                  key={label}
                  disabled={busy}
                  onClick={() => {
                    setPrompt(q);
                    run(q);
                  }}
                >
                  <Sparkles size={13} />
                  {label}
                  <ArrowUpRight size={13} />
                </button>
              ))}
            </div>
            <div className="agent-assurance">
              <ShieldCheck size={13} />
              {DEMO
                ? 'Simulated AI · changes stay in this browser · no real emails or charges'
                : 'Actions are reviewed before they change your CRM'}
            </div>
          </section>
          {(busy || error || result) && (
            <section className="panel agent-response" aria-live="polite">
              <div className="flex justify-between gap-3 items-center mb-4">
                <h3 className="font-semibold flex gap-2 items-center">
                  <Sparkles size={17} className="text-primary" />{' '}
                  {busy ? 'Reviewing your workspace…' : 'Agent review'}
                </h3>
                {!busy && (
                  <button
                    className="text-sm muted"
                    onClick={() => {
                      setResult(null);
                      setError('');
                    }}
                  >
                    Dismiss
                  </button>
                )}
              </div>
              {busy && (
                <div className="flex items-center gap-2 text-sm muted">
                  <LoaderCircle size={16} className="animate-spin" /> Reading
                  related records and preparing next steps
                </div>
              )}
              {error && <p className="form-error">{error}</p>}
              {result && (
                <>
                  <p className="whitespace-pre-wrap text-sm leading-7">
                    {result.text}
                  </p>
                  {result.trace?.length ? (
                    <div className="agent-evidence">
                      <ShieldCheck size={14} />
                      {result.trace.join(' · ')}
                    </div>
                  ) : null}
                  {result.actions
                    ?.filter((a) => a.kind !== 'send_email')
                    .map((a) => (
                      <SuggestionCard key={a.id} suggestion={a} app={app} />
                    ))}
                  {selected && data.deals.find((d) => d.id === selected) && (
                    <button
                      className="text-primary text-sm mt-4"
                      onClick={() =>
                        showDetail(
                          'deals',
                          data.deals.find((d) => d.id === selected)!,
                        )
                      }
                    >
                      Open source opportunity{' '}
                      <ArrowUpRight size={14} className="inline" />
                    </button>
                  )}
                </>
              )}
            </section>
          )}
          <div className="agent-metrics">
            {[
              {
                label: 'Open pipeline',
                value: money(pipeline),
                sub: `${data.dashboard?.openCount ?? open.length} opportunities`,
                icon: Layers,
              },
              {
                label: 'Weighted forecast',
                value: money(weighted),
                sub: 'From recorded probabilities',
                icon: Target,
              },
              {
                label: 'Needs attention',
                value: String(stale.length),
                sub: 'No completed activity in 14 days',
                icon: AlertCircle,
              },
            ].map((m) => (
              <div key={m.label} className="panel">
                <div className="flex justify-between text-sm muted">
                  {m.label}
                  <m.icon size={16} />
                </div>
                <strong>{m.value}</strong>
                <span>{m.sub}</span>
              </div>
            ))}
          </div>
          <section className="panel priority-panel">
            <div className="panel-heading">
              <div>
                <h2>Your next best actions</h2>
                <p className="text-xs muted mt-1">
                  Suggested from your current CRM records
                </p>
              </div>
              <span className="tag !bg-[#eaf4ff] !text-[#1766b0]">
                <Sparkles size={12} /> {priorities.length} to review
              </span>
            </div>
            <Tabs defaultValue="priorities">
              <TabsList className="mx-5 mt-4 mb-1">
                <TabsTrigger value="priorities">Opportunities</TabsTrigger>
                <TabsTrigger value="activity">Recent activity</TabsTrigger>
              </TabsList>
              <TabsContent value="priorities">
                <div className="px-5">
                  {priorities.map((d) => {
                    const contact = data.contacts.find(
                      (c) => c.id === d.contactId,
                    );
                    const inactive = stale.some((s) => s.id === d.id);
                    return (
                      <article key={d.id} className="priority-row">
                        <span
                          className={`priority-symbol ${inactive ? 'warning' : ''}`}
                        >
                          {inactive ? (
                            <Clock size={19} />
                          ) : (
                            <Target size={19} />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => showDetail('deals', d)}
                              className="font-semibold text-sm text-left hover:text-primary"
                            >
                              {d.title}
                            </button>
                            <span
                              className={`priority-badge ${inactive ? 'warning' : ''}`}
                            >
                              {inactive ? 'Follow-up needed' : 'Keep momentum'}
                            </span>
                          </div>
                          <p>
                            {inactive
                              ? 'No recent completed activity. Confirm the next step with your buyer.'
                              : 'Review the latest context and schedule the next conversation.'}
                          </p>
                          <div className="text-xs muted mt-2">
                            {contact?.company || contact?.name || 'Opportunity'}{' '}
                            <span className="mx-2">·</span> {money(d.value)}{' '}
                            <span className="mx-2">·</span>{' '}
                            <span className="capitalize">{d.stage}</span>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          className="shrink-0"
                          disabled={busy}
                          onClick={() =>
                            run(`Create a follow-up task for ${d.title}`, d)
                          }
                        >
                          Review action <ChevronRight size={14} />
                        </Button>
                      </article>
                    );
                  })}
                  {!priorities.length && (
                    <div className="empty">
                      No open opportunities. Create a deal to start your
                      workday.
                    </div>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="activity">
                <div className="px-5">
                  {recent.map((a) => (
                    <button
                      key={a.id}
                      className="priority-row w-full text-left"
                      onClick={() => showDetail('activities', a)}
                    >
                      <span className="priority-symbol">
                        <CheckCircle2 size={18} />
                      </span>
                      <div>
                        <p className="!text-foreground font-medium">
                          {a.title}
                        </p>
                        <p>
                          {new Date(a.updatedAt).toLocaleDateString()} ·{' '}
                          {a.type}
                        </p>
                      </div>
                      <ArrowUpRight size={16} className="ml-auto muted" />
                    </button>
                  ))}
                  {!recent.length && (
                    <p className="empty">Completed activities appear here.</p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Pipeline at a glance</h2>
                <p className="text-xs muted mt-1">
                  Win rate:{' '}
                  {Math.round(
                    ((data.dashboard?.won ??
                      data.deals.filter((d) => d.stage === 'won').length) /
                      Math.max(
                        1,
                        data.dashboard?.closed ??
                          data.deals.filter((d) =>
                            ['won', 'lost'].includes(d.stage),
                          ).length,
                      )) *
                      100,
                  )}
                  % of closed deals
                </p>
              </div>
              <Link
                href="/deals"
                className="text-sm text-primary flex items-center gap-1"
              >
                Open pipeline <ArrowUpRight size={14} />
              </Link>
            </div>
            <div className="pipeline-snapshot">
              {stages.slice(0, 4).map((s, i) => {
                const value =
                  data.dashboard?.stages.find((g) => g.id === s.id)?.value ??
                  open
                    .filter((d) => d.stage === s.id)
                    .reduce((sum, d) => sum + d.value, 0);
                return (
                  <Link href="/deals" key={s.id}>
                    <span className="text-sm muted">{s.label}</span>
                    <strong>{money(value)}</strong>
                    <div className="snapshot-track">
                      <div
                        style={{
                          width: `${pipeline ? Math.max(3, (value / pipeline) * 100) : 0}%`,
                          background: [
                            '#93c5fd',
                            '#38a3ed',
                            '#2675d8',
                            '#0759a3',
                          ][i],
                        }}
                      />
                    </div>
                    <span className="text-xs muted">
                      {data.dashboard?.stages.find((g) => g.id === s.id)
                        ?.count ??
                        open.filter((d) => d.stage === s.id).length}{' '}
                      deals
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
        <aside className="agent-right-column">
          <section className="panel today-panel">
            <div className="panel-heading">
              <h2>Today’s agenda</h2>
              <CalendarDays size={17} className="text-primary" />
            </div>
            <div className="agenda-date">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
              <span>{pending.length} open tasks & activities</span>
            </div>
            {pending.slice(0, 4).map((a) => (
              <div key={a.id} className="agenda-item">
                <button
                  disabled={completing !== null}
                  aria-label={`Complete ${a.title}`}
                  onClick={async () => {
                    setCompleting(a.id);
                    try {
                      await app.mutate('activities', 'PATCH', a.id, {
                        status: 'completed',
                      });
                      toast.success('Activity completed');
                    } catch (e) {
                      toast.error(
                        e instanceof Error
                          ? e.message
                          : 'Unable to complete activity',
                      );
                    } finally {
                      setCompleting(null);
                    }
                  }}
                  className="agenda-check"
                >
                  {completing === a.id && (
                    <LoaderCircle size={12} className="animate-spin" />
                  )}
                </button>
                <div>
                  <button
                    className="text-left text-sm font-medium"
                    onClick={() => showDetail('activities', a)}
                  >
                    {a.title}
                  </button>
                  <p>
                    {a.dueDate
                      ? new Date(a.dueDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })
                      : 'No due date'}{' '}
                    <span>· {a.type}</span>
                  </p>
                </div>
              </div>
            ))}
            {!pending.length && (
              <div className="empty">You’re all caught up.</div>
            )}
            <Link href="/activities" className="panel-bottom-link">
              View all activities <ArrowRight size={14} />
            </Link>
          </section>
          <section className="agent-tools">
            <span className="small-cap">Work with your agent</span>
            <h3>
              A little help.
              <br />A lot more progress.
            </h3>
            {[
              {
                icon: Mail,
                mode: 'email_draft',
                title: 'Write a follow-up',
                sub: 'Start with relationship context',
              },
              {
                icon: CalendarDays,
                mode: 'summarize',
                title: 'Summarize a meeting',
                sub: 'Turn notes into next steps',
              },
              {
                icon: Target,
                mode: 'lead_score',
                title: 'Score a lead',
                sub: 'Understand your next opportunity',
              },
            ].map((t) => (
              <Link href={`/intelligence?mode=${t.mode}`} key={t.title}>
                <span>
                  <t.icon size={17} />
                </span>
                <div>
                  <strong>{t.title}</strong>
                  <p>{t.sub}</p>
                </div>
                <ChevronRight size={14} className="ml-auto" />
              </Link>
            ))}
          </section>
          <section className="panel p-5">
            <div className="flex items-center gap-2 text-sm font-semibold mb-4">
              <ShieldCheck size={17} className="text-[#16856c]" /> You’re in
              control
            </div>
            <p className="text-sm muted leading-6">
              Review suggested changes before accepting. Every accepted task
              appears in your activity list.
            </p>
            <button
              className="text-primary text-sm flex gap-1 items-center mt-4"
              onClick={() =>
                ask('Show deals closing this month with no activity in 2 weeks')
              }
            >
              Continue with Relay <ArrowUpRight size={14} />
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
}
