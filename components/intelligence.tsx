'use client';
import { useEffect, useState } from 'react';
import {
  Mail,
  FileText,
  Target,
  Sparkles,
  Copy,
  Check,
  LoaderCircle,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AppActions, Picker } from './crm-app';
import { callAI, SuggestionCard } from './assistant';
import { AIResult } from '@/lib/demo-ai';
import { DEMO, mutateDemo } from '@/lib/demo-store';
export function Intelligence(app: AppActions) {
  const [mode, setMode] = useState('email_draft');
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('mode');
    if (
      requested &&
      ['email_draft', 'summarize', 'lead_score'].includes(requested)
    )
      setMode(requested);
  }, []);
  const [contact, setContact] = useState(app.data.contacts[0]?.id || 'none');
  const [deal, setDeal] = useState('none');
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<AIResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const run = async () => {
    setBusy(true);
    setError('');
    setResult(null);
    setSent(false);
    try {
      const r = await callAI(
        app,
        mode,
        prompt,
        contact === 'none' ? undefined : contact,
        deal === 'none' ? undefined : deal,
      );
      setResult(r);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const send = async () => {
    if (DEMO) {
      toast.info(
        'Demo only: no email is sent. Copy this draft to your email app.',
      );
      return;
    }
    setSending(true);
    try {
      const r = await fetch(`/api/ai/actions/${result?.actions?.[0]?.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: result?.subject, body: result?.body }),
      });
      const j = await r.json();
      if (!r.ok) throw Error(j.error);
      setSent(true);
      toast.success('Email queued for delivery');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };
  return (
    <>
      <Tabs
        value={mode}
        onValueChange={(v) => {
          setMode(String(v));
          setResult(null);
          setPrompt('');
          setError('');
        }}
      >
        <TabsList className="mb-6 h-11">
          <TabsTrigger value="email_draft" className="px-4">
            <Mail size={15} />
            Email writer
          </TabsTrigger>
          <TabsTrigger value="summarize" className="px-4">
            <FileText size={15} />
            Meeting notes
          </TabsTrigger>
          <TabsTrigger value="lead_score" className="px-4">
            <Target size={15} />
            Lead scoring
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="grid lg:grid-cols-2 gap-6">
        <section className="panel p-6">
          <div className="flex items-center gap-3 mb-6">
            <span className="bg-[#f0ecfb] text-primary p-2.5 rounded-lg">
              <Sparkles size={20} />
            </span>
            <div>
              <h2 className="font-semibold">
                {mode === 'email_draft'
                  ? 'A thoughtful follow-up, in seconds'
                  : mode === 'summarize'
                    ? 'From conversation to action'
                    : 'Find your strongest opportunities'}
              </h2>
              <p className="text-xs muted mt-1.5">
                {DEMO
                  ? 'Sample AI output · no API calls or charges'
                  : 'Powered by Claude · counts toward your AI allowance'}
              </p>
            </div>
          </div>
          <div className="field-grid mb-5">
            <label className="field">
              Contact
              <Picker
                label="AI contact"
                value={contact}
                onChange={(v) => {
                  setContact(v);
                  setDeal('none');
                  setResult(null);
                }}
                options={[
                  { value: 'none', label: 'No contact' },
                  ...app.data.contacts.map((c) => ({
                    value: c.id,
                    label: c.name,
                  })),
                ]}
              />
            </label>
            <label className="field">
              Deal context
              <Picker
                label="AI deal context"
                value={deal}
                onChange={(v) => {
                  setDeal(v);
                  setResult(null);
                }}
                options={[
                  { value: 'none', label: 'No deal' },
                  ...app.data.deals
                    .filter(
                      (d) => contact === 'none' || d.contactId === contact,
                    )
                    .map((d) => ({ value: d.id, label: d.title })),
                ]}
              />
            </label>
          </div>
          <label className="field">
            {mode === 'summarize'
              ? 'Transcript or meeting notes'
              : mode === 'email_draft'
                ? 'What would you like to follow up on?'
                : 'Additional context (optional)'}
            <Textarea
              rows={mode === 'summarize' ? 12 : 7}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                mode === 'summarize'
                  ? 'Paste your conversation here…'
                  : mode === 'email_draft'
                    ? 'Thank them for the demo and propose a call to discuss the implementation timeline.'
                    : 'What else should Relay consider?'
              }
              maxLength={20000}
            />
          </label>
          {mode === 'summarize' && (
            <button
              className="text-xs text-primary mt-2"
              onClick={() =>
                setPrompt(
                  'Lana: The team liked the demo. We have approved a $48,000 budget for the rollout. We need to complete the security review first. Alex: I will send the security documentation tomorrow. Lana: Please schedule a technical review with our engineering team next week. We want to go live next month.',
                )
              }
            >
              Use sample meeting notes
            </button>
          )}
          {error && (
            <div className="form-error mt-4" role="alert">
              {error}
            </div>
          )}
          <Button
            className="primary-btn w-full mt-6"
            onClick={run}
            disabled={
              busy ||
              (mode === 'summarize'
                ? prompt.trim().length < 20
                : contact === 'none' && deal === 'none')
            }
          >
            {busy ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <Sparkles size={15} />
            )}{' '}
            {busy
              ? 'Working on it…'
              : mode === 'summarize'
                ? 'Summarize & suggest tasks'
                : mode === 'lead_score'
                  ? 'Calculate lead score'
                  : 'Draft follow-up'}
          </Button>
        </section>
        <section className="panel p-6">
          <div className="flex justify-between items-center border-b pb-4 mb-5">
            <h2 className="font-semibold text-sm">
              {mode === 'email_draft'
                ? 'Your editable draft'
                : mode === 'summarize'
                  ? 'Summary & next steps'
                  : 'Lead assessment'}
            </h2>
            <span className="tag">{DEMO ? 'Simulated' : 'AI generated'}</span>
          </div>
          {!result ? (
            <div className="empty !py-20">
              <Sparkles className="mx-auto text-[#cbc4e5] mb-4" size={34} />
              <p className="text-sm">A little context goes a long way.</p>
              <p className="text-xs mt-2 text-[#a5a5b5]">
                Your result will appear here.
              </p>
            </div>
          ) : (
            <>
              {mode === 'email_draft' && (
                <div className="space-y-4">
                  <label className="field">
                    Subject
                    <Input
                      value={result.subject || ''}
                      onChange={(e) =>
                        setResult({ ...result, subject: e.target.value })
                      }
                    />
                  </label>
                  <label className="field">
                    Message
                    <Textarea
                      rows={14}
                      value={result.body || ''}
                      onChange={(e) =>
                        setResult({ ...result, body: e.target.value })
                      }
                    />
                  </label>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() =>
                        navigator.clipboard
                          .writeText(`${result.subject}\n\n${result.body}`)
                          .then(() => toast.success('Draft copied'))
                          .catch(() =>
                            toast.error(
                              'Select the draft text and copy it manually.',
                            ),
                          )
                      }
                    >
                      <Copy size={14} />
                      Copy draft
                    </Button>
                    <Button
                      disabled={
                        sent ||
                        sending ||
                        !result.body?.trim() ||
                        !result.subject?.trim()
                      }
                      onClick={send}
                    >
                      {sent ? <Check size={14} /> : <Send size={14} />}{' '}
                      {DEMO ? 'Preview send' : sent ? 'Queued' : 'Send email'}
                    </Button>
                  </div>
                  <p className="text-xs muted">
                    {DEMO
                      ? 'Demo mode never sends email.'
                      : 'Review the recipient, subject and message before sending.'}
                  </p>
                </div>
              )}
              {mode === 'summarize' && (
                <div>
                  <p className="text-sm leading-loose">{result.summary}</p>
                  <ul className="mt-4 space-y-2 text-sm muted list-disc pl-5">
                    {result.keyPoints?.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                  {result.actions?.map((a) => (
                    <SuggestionCard key={a.id} suggestion={a} app={app} />
                  ))}
                </div>
              )}
              {mode === 'lead_score' && (
                <div className="text-center py-7">
                  <div className="inline-flex rounded-full border-[10px] border-[#e8f4ee] w-36 h-36 items-center justify-center text-[44px] text-[#539478] font-semibold">
                    {result.score}
                    <span className="text-sm font-normal self-center mt-4">
                      /100
                    </span>
                  </div>
                  <p className="text-sm muted leading-loose mt-7 max-w-sm mx-auto">
                    {result.explanation}
                  </p>
                  <p className="text-xs text-[#aaa3b6] mt-4">
                    An estimate to guide attention, not a guaranteed outcome.
                  </p>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </>
  );
}
