'use client';
import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowUp,
  Plus,
  Sparkles,
  ChevronDown,
  ArrowUpRight,
  PanelRight,
  FileText,
  Layers,
  ShieldCheck,
  LoaderCircle,
  MessageSquare,
  Target,
  CalendarDays,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AppActions } from './crm-app';
import { AgentHome } from './agent-home';
import { callAI, SuggestionCard } from './assistant';
import { AIResult } from '@/lib/demo-ai';
import { DEMO } from '@/lib/demo-store';
import { Activity, Contact, Deal, Entity, money, stages } from '@/lib/types';

type Message = {
  role: 'user' | 'assistant';
  content: string;
  result?: AIResult;
};
export function ConversationHome({
  ask,
  showDetail,
  ...app
}: AppActions & {
  ask: (p: string) => void;
  showDetail: (e: Entity, v: Contact | Deal | Activity) => void;
}) {
  const [mode, setMode] = useState('chat');
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState(false);
  const [skills, setSkills] = useState(false);
  const name =
    app.data.members
      .find((m) => m.userId === app.data.userId)
      ?.user.name.split(' ')[0] || 'Alex';
  const open = app.data.deals.filter((d) => !['won', 'lost'].includes(d.stage));
  const total = open.reduce((s, d) => s + d.value, 0);
  const skillList = [
    {
      title: 'Daily briefing',
      detail: 'Find where to focus today',
      icon: CalendarDays,
      prompt: 'Show deals closing this month with no activity in 2 weeks',
    },
    {
      title: 'Pipeline review',
      detail: 'See your open opportunities',
      icon: Layers,
      prompt: 'Show all open deals in my pipeline',
    },
    {
      title: 'Lead priorities',
      detail: 'Find your strongest relationships',
      icon: Target,
      prompt: 'Show my highest-priority contacts',
    },
  ];
  async function send(value = prompt) {
    if (!value.trim() || busy) return;
    setPrompt('');
    setSkills(false);
    setError('');
    setBusy(true);
    setMessages((m) => [...m, { role: 'user', content: value }]);
    try {
      const result = await callAI(
        app,
        'assistant',
        value,
        undefined,
        undefined,
        messages.map((m) => ({ role: m.role, content: m.content })),
      );
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: result.text || '', result },
      ]);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Unable to complete the request. Try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  if (mode === 'work')
    return (
      <>
        <div className="conversation-modebar">
          <Button variant="ghost" onClick={() => setMode('chat')}>
            <MessageSquare size={16} /> Back to conversation
          </Button>
          <span className="text-sm muted">Sales workspace</span>
        </div>
        <AgentHome {...app} ask={ask} showDetail={showDetail} />
      </>
    );
  return (
    <div
      className={`conversation-home ${messages.length ? 'has-conversation' : ''}`}
    >
      <div className="conversation-modebar">
        <span className="flex items-center gap-2">
          Relay <ChevronDown size={13} />
        </span>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setMode('work')}>
            <PanelRight size={16} /> Workspace
          </Button>
          {messages.length > 0 && (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setMessages([]);
                setReport(false);
                setError('');
              }}
            >
              <RotateCcw size={14} /> New chat
            </Button>
          )}
        </div>
      </div>
      <div className="conversation-center">
        {!messages.length && (
          <div className="conversation-welcome">
            <Sparkles className="conversation-star" size={34} />
            <h1>Let’s get to work, {name}</h1>
          </div>
        )}
        {messages.length > 0 && (
          <div className="conversation-thread" aria-live="polite">
            {messages.map((m, i) => (
              <article key={i} className={`conversation-message ${m.role}`}>
                {m.role === 'assistant' && (
                  <div className="conversation-author">
                    <Sparkles size={20} /> Relay
                  </div>
                )}
                {m.result?.trace?.length ? (
                  <details className="conversation-trace">
                    <summary>
                      <ShieldCheck size={14} /> Reviewed CRM records ·{' '}
                      {m.result.trace.length} steps
                    </summary>
                    <ul>
                      {m.result.trace.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  </details>
                ) : null}
                <div className="conversation-copy">{m.content}</div>
                {m.result?.actions
                  ?.filter((a) => a.kind !== 'send_email')
                  .map((a) => (
                    <SuggestionCard key={a.id} suggestion={a} app={app} />
                  ))}
                {m.role === 'assistant' && (
                  <button
                    className="report-artifact"
                    onClick={() => setReport(!report)}
                  >
                    <span>
                      <FileText size={21} />
                    </span>
                    <div>
                      <strong>Sales pipeline overview</strong>
                      <p>
                        Interactive report · {open.length} open opportunities
                      </p>
                    </div>
                    <ArrowUpRight size={17} />
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
        {report && (
          <section className="conversation-report">
            <div className="flex items-center justify-between">
              <div>
                <span className="small-cap">CRM report</span>
                <h2>Pipeline overview</h2>
              </div>
              <button
                aria-label="Close pipeline report"
                onClick={() => setReport(false)}
              >
                Close
              </button>
            </div>
            <div className="report-total">
              {money(total)}
              <span>open pipeline</span>
            </div>
            <div className="conversation-bars">
              {stages.slice(0, 4).map((s) => {
                const value = open
                  .filter((d) => d.stage === s.id)
                  .reduce((sum, d) => sum + d.value, 0);
                return (
                  <div key={s.id}>
                    <span>{money(value)}</span>
                    <div className="report-bar-track">
                      <div
                        style={{
                          height: `${total ? Math.max(3, (value / total) * 100) : 0}%`,
                        }}
                      />
                    </div>
                    <span>{s.label}</span>
                  </div>
                );
              })}
            </div>
            <div className="report-deals">
              {open.slice(0, 5).map((d) => (
                <button key={d.id} onClick={() => showDetail('deals', d)}>
                  <span>{d.title}</span>
                  <strong>{money(d.value)}</strong>
                  <ArrowUpRight size={14} />
                </button>
              ))}
            </div>
            <Link href="/deals" className="text-sm underline">
              Open all opportunities
            </Link>
          </section>
        )}
        {busy && (
          <div className="conversation-thinking" role="status">
            <LoaderCircle size={17} className="animate-spin" /> Reviewing your
            CRM…
          </div>
        )}
        {error && (
          <p role="alert" className="form-error mb-4">
            {error}
          </p>
        )}
        <form
          className="claude-composer"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <Textarea
            aria-label="Message your CRM assistant"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="How can I help you today?"
            maxLength={4000}
            className="!resize-none !border-0 !shadow-none !bg-transparent !min-h-24"
          />
          <div className="claude-composer-footer">
            <button
              type="button"
              className="composer-plus"
              aria-label="Browse sales skills"
              aria-expanded={skills}
              onClick={() => setSkills(!skills)}
            >
              <Plus size={19} />
            </button>
            <Tabs value={mode} onValueChange={(v) => setMode(String(v))}>
              <TabsList>
                <TabsTrigger value="chat">Chat</TabsTrigger>
                <TabsTrigger value="work">Work</TabsTrigger>
              </TabsList>
            </Tabs>
            <span className="composer-model">
              {DEMO ? 'Demo agent' : 'CRM agent'} <ChevronDown size={12} />
            </span>
            <Button
              type="submit"
              size="icon"
              disabled={busy || !prompt.trim()}
              aria-label="Send message"
              className="composer-send"
            >
              <ArrowUp size={19} />
            </Button>
          </div>
        </form>
        {skills && (
          <div className="sales-skills-menu">
            {skillList.map((s) => (
              <button
                key={s.title}
                disabled={busy}
                onClick={() => send(s.prompt)}
              >
                <s.icon size={17} />
                <span>{s.title}</span>
                <ArrowUpRight size={14} />
              </button>
            ))}
          </div>
        )}
        <div className="conversation-disclaimer">
          {DEMO
            ? 'Sample CRM · simulated AI · no real emails or charges'
            : 'Review suggested actions before applying them to your CRM.'}
        </div>
        {!messages.length && (
          <>
            <div className="crm-connection">
              <span className="connection-icon">
                <Layers size={21} />
              </span>
              <div>
                <strong>Your CRM, in the conversation</strong>
                <p>
                  {app.data.contacts.length} contacts · {open.length}{' '}
                  opportunities ·{' '}
                  {
                    app.data.organizations.find(
                      (o) => o.id === app.data.organizationId,
                    )?.name
                  }
                </p>
              </div>
              <button onClick={() => setMode('work')}>
                Open <ArrowUpRight size={13} />
              </button>
            </div>
            <div className="conversation-skills">
              {skillList.map((s) => (
                <button
                  key={s.title}
                  onClick={() => send(s.prompt)}
                  disabled={busy}
                >
                  <s.icon size={19} />
                  <strong>{s.title}</strong>
                  <p>{s.detail}</p>
                </button>
              ))}
            </div>
            <div className="conversation-recent">
              <div className="flex justify-between">
                <h2>Start with your business</h2>
                <Link href="/intelligence">
                  All AI tools <ArrowUpRight size={12} className="inline" />
                </Link>
              </div>
              {open.slice(0, 3).map((d) => (
                <button
                  key={d.id}
                  onClick={() => send(`Create a follow-up task for ${d.title}`)}
                  disabled={busy}
                >
                  <MessageSquare size={15} />
                  <span>Plan the next step for {d.title}</span>
                  <ArrowUpRight size={14} />
                </button>
              ))}
              {!open.length && (
                <p className="text-sm muted mt-4">
                  Add an opportunity in your workspace to get started.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
