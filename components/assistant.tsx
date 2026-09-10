'use client';
import { useEffect, useState, useRef } from 'react';
import {
  Sparkles,
  ArrowUp,
  Check,
  LoaderCircle,
  Plus,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AppActions } from './crm-app';
import { DEMO, chargeDemo, mutateDemo } from '@/lib/demo-store';
import { demoAI, AIResult, Suggestion } from '@/lib/demo-ai';
export async function callAI(
  app: AppActions,
  action: string,
  prompt: string,
  contactId?: string,
  dealId?: string,
  history: { role: 'user' | 'assistant'; content: string }[] = [],
) {
  if (DEMO) {
    let next = chargeDemo(app.data);
    const result = demoAI(next, action, prompt, contactId, dealId);
    if (action === 'lead_score')
      next = mutateDemo(
        next,
        dealId ? 'deals' : 'contacts',
        'PATCH',
        dealId || contactId,
        { aiScore: result.score, aiExplanation: result.explanation },
      );
    app.setData(next);
    return result;
  }
  const r = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action,
      prompt,
      contactId: contactId || null,
      dealId: dealId || null,
      history: history.slice(-8),
    }),
  });
  const j = await r.json();
  await app.reload();
  if (!r.ok) throw Error(j.error);
  return j as AIResult;
}
export function SuggestionCard({
  suggestion,
  app,
  onAccepted,
}: {
  suggestion: Suggestion;
  app: AppActions;
  onAccepted?: () => void;
}) {
  const [accepted, setAccepted] = useState(suggestion.status === 'accepted');
  const [busy, setBusy] = useState(false);
  const accept = async () => {
    setBusy(true);
    try {
      if (DEMO) {
        if (suggestion.kind === 'create_task')
          await app.mutate('activities', 'POST', undefined, {
            ...suggestion.payload,
            type: 'task',
            status: 'pending',
          });
        else
          await app.mutate('deals', 'PATCH', suggestion.payload.dealId, {
            stage: suggestion.payload.stage,
          });
      } else {
        const r = await fetch(`/api/ai/actions/${suggestion.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        });
        const j = await r.json();
        if (!r.ok) throw Error(j.error);
        await app.reload();
      }
      setAccepted(true);
      onAccepted?.();
      toast.success('Suggestion applied');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="border rounded-lg p-4 bg-white mt-3">
      <div className="text-[11px] small-cap mb-2">
        Suggested {suggestion.kind === 'create_task' ? 'task' : 'stage change'}
      </div>
      <p className="text-sm font-medium leading-relaxed">
        {suggestion.payload.title || `Move deal to ${suggestion.payload.stage}`}
      </p>
      <p className="text-xs muted mt-2 line-clamp-3">
        {suggestion.payload.body || suggestion.payload.reason}
      </p>
      <Button
        className="mt-3"
        variant={accepted ? 'secondary' : 'outline'}
        disabled={accepted || busy}
        onClick={accept}
      >
        {accepted ? (
          <Check size={13} />
        ) : busy ? (
          <LoaderCircle className="animate-spin" size={13} />
        ) : (
          <Plus size={13} />
        )}{' '}
        {accepted ? 'Accepted' : 'Accept suggestion'}
      </Button>
    </div>
  );
}
export function Assistant({
  open,
  onClose,
  initialPrompt,
  ...app
}: AppActions & { open: boolean; onClose: () => void; initialPrompt: string }) {
  const [messages, setMessages] = useState<
    { role: 'user' | 'assistant'; content: string; result?: AIResult }[]
  >([]);
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open && initialPrompt) setPrompt(initialPrompt);
  }, [open, initialPrompt]);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);
  useEffect(() => {
    setMessages([]);
    setError('');
  }, [app.data.organizationId]);
  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!prompt.trim() || busy) return;
    const question = prompt;
    setPrompt('');
    setError('');
    setMessages((m) => [...m, { role: 'user', content: question }]);
    setBusy(true);
    try {
      const result = await callAI(
        app,
        'assistant',
        question,
        undefined,
        undefined,
        messages.map((m) => ({ role: m.role, content: m.content })),
      );
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: result.text || '', result },
      ]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-[450px] !w-full !gap-0">
        <SheetHeader className="p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="bg-[#efebfb] text-primary p-2 rounded-lg">
              <Sparkles size={20} />
            </div>
            <div>
              <SheetTitle className="text-lg">Ask Relay</SheetTitle>
              <SheetDescription>
                Your pipeline. Your next move.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <div className="flex-1 overflow-auto p-5">
          {DEMO && (
            <div className="text-xs text-[#9b83b7] bg-[#f6f2fc] rounded-lg p-3 mb-5">
              Demo assistant · responses are simulated using this browser’s
              sample CRM records. No Claude calls or charges.
            </div>
          )}
          {!messages.length && (
            <div className="py-5">
              <h3 className="text-xl font-medium mb-2">
                What can we move forward?
              </h3>
              <p className="text-sm muted leading-relaxed mb-6">
                Ask about relationships, spot deals that need attention, or
                prepare your next follow-up.
              </p>
              {[
                'Show deals closing this month with no activity in 2 weeks',
                'Create a follow-up task for Catalog',
                'Show my highest-priority contacts',
              ].map((s) => (
                <button
                  key={s}
                  onClick={() => setPrompt(s)}
                  className="border p-3 rounded-lg flex gap-2 text-sm text-left mb-2 w-full text-[#76728b] hover:bg-[#faf8ff]"
                >
                  {s}
                  <ChevronRight size={16} className="ml-auto shrink-0 mt-0.5" />
                </button>
              ))}
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className="mb-5">
              <div className="text-xs text-[#9993a6] mb-2">
                {m.role === 'user' ? 'You' : '✧ Relay'}
              </div>
              <div
                className={`chat-bubble ${m.role === 'user' ? '!bg-white !border-[#e8ebf1]' : ''}`}
              >
                {m.content}
              </div>
              {m.result?.trace?.length ? (
                <div className="text-[11px] muted mt-2">
                  {m.result.trace.join(' → ')}
                </div>
              ) : null}
              {m.result?.actions
                ?.filter((a) => a.kind !== 'send_email')
                .map((a) => (
                  <SuggestionCard key={a.id} suggestion={a} app={app} />
                ))}
            </div>
          ))}
          {busy && (
            <div className="text-sm text-primary flex items-center gap-2">
              <LoaderCircle className="animate-spin" size={16} />
              Reviewing your CRM…
            </div>
          )}
          {error && (
            <div role="alert" className="form-error mt-3">
              {error}
            </div>
          )}
          <div ref={end} />
        </div>
        <form onSubmit={send} className="p-5 border-t">
          <div className="relative">
            <Textarea
              aria-label="Message Relay"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Ask anything about your CRM…"
              rows={3}
              className="pr-12 text-sm"
              maxLength={4000}
            />
            <Button
              type="submit"
              size="icon"
              disabled={busy || !prompt.trim()}
              aria-label="Send message"
              className="absolute right-2 bottom-2"
            >
              <ArrowUp size={18} />
            </Button>
          </div>
          <div className="flex justify-between text-[11px] text-[#9993a6] mt-3">
            <span>Changes always require your confirmation.</span>
            <button
              type="button"
              onClick={() => {
                setMessages([]);
                setError('');
              }}
            >
              Clear chat
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
