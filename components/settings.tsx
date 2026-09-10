'use client';
import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Sparkles,
  ArrowUpRight,
  Check,
  CreditCard,
  Users,
  Coins,
  Copy,
  Plus,
  RotateCcw,
  ExternalLink,
  ShieldCheck,
  BookOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { AppActions, Picker, Avatar } from './crm-app';
import { Tier, Role, plans, money } from '@/lib/types';
import { DEMO, changeDemoPlan, resetDemo } from '@/lib/demo-store';
export function Billing(app: AppActions) {
  const u = app.data.usage;
  const admin =
    app.data.organizations.find((o) => o.id === app.data.organizationId)
      ?.role === 'admin';
  const [seats, setSeats] = useState(
    Math.max(u.seats, app.data.members.length),
  );
  const [busy, setBusy] = useState(false);
  const choose = async (tier: Tier) => {
    if (DEMO) {
      app.setData(changeDemoPlan(app.data, tier));
      toast.success(`Demo plan changed to ${plans[tier].name}. No charges.`);
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, seats }),
      });
      const j = await r.json();
      if (!r.ok) throw Error(j.error);
      location.href = j.url;
    } catch (e: any) {
      toast.error(e.message);
      setBusy(false);
    }
  };
  const portal = async () => {
    if (DEMO) {
      toast.info(
        'Stripe portal is available after connecting a Stripe account.',
      );
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/billing/portal', { method: 'POST' });
      const j = await r.json();
      if (!r.ok) throw Error(j.error);
      location.href = j.url;
    } catch (e: any) {
      toast.error(e.message);
      setBusy(false);
    }
  };
  return (
    <div className="space-y-6">
      <section className="panel p-6 flex flex-wrap justify-between gap-5 items-center">
        <div className="flex items-center gap-4">
          <span className="p-3 rounded-xl bg-[#efeafb] text-primary">
            <CreditCard size={23} />
          </span>
          <div>
            <div className="flex gap-2 items-center">
              <h2 className="text-xl font-semibold capitalize">
                {u.tier} plan
              </h2>
              <span className="tag">{DEMO ? 'Demo' : u.status}</span>
            </div>
            <p className="text-sm muted mt-2">
              {money(u.monthlySeatPriceUsd)} per seat / month · {u.seats}{' '}
              {DEMO ? 'sample ' : ''}seats · USD
            </p>
          </div>
        </div>
        {admin && (
          <Button
            variant="outline"
            className="outline-btn"
            onClick={portal}
            disabled={busy}
          >
            Manage subscription <ArrowUpRight size={14} />
          </Button>
        )}
      </section>
      <div className="grid md:grid-cols-3 gap-5">
        <section className="panel p-6">
          <div className="text-sm muted mb-4 flex items-center gap-2">
            <Sparkles size={16} />
            AI model calls
          </div>
          <div className="metric-value">
            {u.actions.toLocaleString()}
            <span className="text-base text-[#a2a4b4] font-normal">
              {' '}
              / {u.includedActions.toLocaleString()}
            </span>
          </div>
          <Progress
            className="mt-5"
            aria-label="AI actions used"
            value={Math.min(
              100,
              ((u.actions + u.reservedActions) / u.includedActions) * 100,
            )}
          />
          <p className="text-xs muted mt-3">
            {Math.max(
              0,
              u.includedActions - u.actions - u.reservedActions,
            ).toLocaleString()}{' '}
            calls available
          </p>
        </section>
        <section className="panel p-6">
          <div className="text-sm muted mb-4 flex items-center gap-2">
            <Coins size={16} />
            Total tokens
          </div>
          <div className="metric-value">
            {(u.tokens / 1000).toFixed(1)}k
            <span className="text-base text-[#a2a4b4] font-normal">
              {' '}
              / {u.includedTokens / 1000000}M
            </span>
          </div>
          <Progress
            className="mt-5"
            aria-label="AI tokens used"
            value={Math.min(
              100,
              ((u.tokens + u.reservedTokens) / u.includedTokens) * 100,
            )}
          />
          <p className="text-xs muted mt-3">
            {Math.max(
              0,
              u.includedTokens - u.tokens - u.reservedTokens,
            ).toLocaleString()}{' '}
            tokens available
          </p>
        </section>
        <section className="panel p-6">
          <div className="text-sm muted mb-4 flex items-center gap-2">
            <CreditCard size={16} />
            {u.ownOnly ? 'Your' : 'Organization'} AI provider cost
          </div>
          <div className="metric-value">${u.costUsd.toFixed(2)}</div>
          <p className="text-xs muted mt-5 leading-relaxed">
            {DEMO
              ? 'Illustrative sample cost.'
              : 'Provider cost from recorded token usage.'}{' '}
            Included in your allowance; no automatic overage charges.
          </p>
        </section>
      </div>
      <div className="ai-gradient rounded-xl p-5 text-sm text-[#88749d] flex gap-3 items-start">
        <ShieldCheck className="shrink-0 mt-0.5" size={19} />
        <div>
          <strong className="text-[#716083] font-medium">
            You’re in control of your usage.
          </strong>
          <p className="mt-1 text-xs leading-loose">
            AI pauses when either limit is reached. Your CRM stays available.
            Each assistant tool round uses one model call. Billing period:{' '}
            {new Date(u.periodStart).toLocaleDateString()}–
            {new Date(u.periodEnd).toLocaleDateString()}.
            {u.reservedTokens > 0
              ? ` ${u.reservedTokens.toLocaleString()} tokens are held for in-flight or uncertain requests.`
              : ''}
          </p>
        </div>
      </div>
      <section className="panel overflow-hidden">
        <div className="panel-heading">
          <h2>{admin ? 'Team AI usage' : 'Your AI usage'}</h2>
          <span className="text-xs muted">This billing period</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Member</TableHead>
              <TableHead>Model calls</TableHead>
              <TableHead>Tokens</TableHead>
              <TableHead>Provider cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {u.byUser.map((m) => (
              <TableRow key={m.userId}>
                <TableCell className="pl-6 py-4">
                  <span className="inline-flex items-center gap-3">
                    <Avatar name={m.name} />
                    {m.name}
                  </span>
                </TableCell>
                <TableCell>{m.actions}</TableCell>
                <TableCell>{m.tokens.toLocaleString()}</TableCell>
                <TableCell>${m.costUsd.toFixed(4)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!u.byUser.length && (
          <div className="empty">No AI usage recorded in this period.</div>
        )}
      </section>
      <div className="flex flex-wrap justify-between items-center gap-3 pt-3">
        <div>
          <h2 className="text-xl font-semibold">Room for your next chapter</h2>
          <p className="text-sm muted mt-2">
            Monthly plans. Shared AI allowance per organization.
          </p>
        </div>
        {admin && (
          <label className="field flex-row items-center">
            Seats{' '}
            <Input
              type="number"
              className="w-20 bg-white"
              min={app.data.members.length}
              max={500}
              value={seats}
              onChange={(e) => setSeats(Number(e.target.value))}
            />
          </label>
        )}
      </div>
      <div className="grid md:grid-cols-3 gap-5">
        {Object.entries(plans).map(([key, p]) => (
          <section
            key={key}
            className={`panel p-6 ${key === 'pro' ? '!border-[#b4a5e0] relative' : ''}`}
          >
            {key === 'pro' && (
              <span className="absolute -top-2.5 right-5 bg-[#8d75cf] text-white text-[10px] uppercase px-2.5 py-1 rounded tracking-wide">
                Built for growth
              </span>
            )}
            <h3 className="font-semibold text-lg">{p.name}</h3>
            <div className="my-4">
              <span className="text-3xl font-semibold tracking-tight">
                ${p.price}
              </span>
              <span className="text-xs muted"> / seat / month</span>
            </div>
            <ul className="space-y-3 text-sm text-[#858296]">
              {[
                `${p.actions.toLocaleString()} AI calls / month`,
                `${p.tokens / 1000000}M tokens / month`,
                `Up to ${p.seats} team members`,
                'Contacts, pipeline & AI workspace',
              ].map((x) => (
                <li key={x} className="flex gap-2 items-center">
                  <Check size={14} className="text-[#9a8abf]" />
                  {x}
                </li>
              ))}
            </ul>
            <Button
              className="w-full mt-6 h-10"
              variant={key === 'pro' ? 'default' : 'outline'}
              disabled={!admin || busy || key === u.tier}
              onClick={() => choose(key as Tier)}
            >
              {key === u.tier
                ? 'Current plan'
                : DEMO
                  ? 'Try ' + p.name
                  : 'Choose ' + p.name}
            </Button>
          </section>
        ))}
      </div>
      {DEMO && admin && (
        <div className="panel p-5 flex flex-wrap gap-3 justify-between items-center">
          <div className="text-sm">
            <strong>Test the allowance limit</strong>
            <p className="text-xs muted mt-1">
              Demo controls only. Try an AI action after filling the allowance.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              app.setData({
                ...app.data,
                usage: {
                  ...u,
                  actions: u.includedActions,
                  tokens: u.includedTokens,
                },
              });
              toast.success('Demo allowance filled');
            }}
          >
            Simulate usage limit
          </Button>
        </div>
      )}
    </div>
  );
}
export function OrganizationSettings(app: AppActions) {
  const org = app.data.organizations.find(
    (o) => o.id === app.data.organizationId,
  )!;
  const admin = org.role === 'admin';
  const [name, setName] = useState(org.name);
  const [invite, setInvite] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('sales_rep');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [newOrg, setNewOrg] = useState(false);
  const [newName, setNewName] = useState('');
  const save = async () => {
    try {
      if (DEMO) {
        app.setData({
          ...app.data,
          organizations: app.data.organizations.map((o) =>
            o.id === org.id ? { ...o, name } : o,
          ),
        });
      } else {
        const r = await fetch('/api/organizations', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        });
        const j = await r.json();
        if (!r.ok) throw Error(j.error);
        await app.reload();
      }
      toast.success('Workspace updated');
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  const submitInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (DEMO) {
        if (app.data.members.some((m) => m.user.email === email))
          throw Error('This email already belongs to a team member');
        if (app.data.members.length >= app.data.usage.maxSeats)
          throw Error('Upgrade your plan to add more members');
        app.setData({
          ...app.data,
          members: [
            ...app.data.members,
            {
              userId: crypto.randomUUID(),
              role: role as Role,
              user: { name: email.split('@')[0], email },
            },
          ],
        });
        toast.success('Sample teammate added. No invitation was sent.');
        setInvite(false);
      } else {
        const r = await fetch('/api/invitations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, role }),
        });
        const j = await r.json();
        if (!r.ok) throw Error(j.error);
        setLink(j.url);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const updateRole = async (userId: string, value: string) => {
    try {
      if (DEMO) {
        if (
          app.data.members.filter((m) => m.role === 'admin').length === 1 &&
          app.data.members.find((m) => m.userId === userId)?.role === 'admin' &&
          value !== 'admin'
        )
          throw Error('Keep at least one admin');
        app.setData({
          ...app.data,
          members: app.data.members.map((m) =>
            m.userId === userId ? { ...m, role: value as Role } : m,
          ),
          organizations: app.data.organizations.map((o) =>
            o.id === org.id && userId === app.data.userId
              ? { ...o, role: value as Role }
              : o,
          ),
        });
      } else {
        const r = await fetch('/api/organizations', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, role: value }),
        });
        const j = await r.json();
        if (!r.ok) throw Error(j.error);
        await app.reload();
      }
      toast.success('Role updated');
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  return (
    <div className="space-y-6">
      <section className="panel p-6">
        <h2 className="font-semibold mb-5">Workspace details</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <label className="field flex-1 max-w-sm">
            Organization name
            <Input
              value={name}
              maxLength={120}
              disabled={!admin}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          {admin && (
            <Button onClick={save} disabled={name.trim().length < 2}>
              Save changes
            </Button>
          )}
          <Button
            variant="outline"
            className="ml-auto"
            onClick={() => setNewOrg(true)}
          >
            <Plus size={14} />
            New organization
          </Button>
        </div>
      </section>
      <section className="panel overflow-hidden">
        <div className="panel-heading">
          <div>
            <h2>Your people</h2>
            <p className="text-xs muted mt-1.5">
              {app.data.members.length} members · Roles are specific to this
              organization.
            </p>
          </div>
          {admin && (
            <Button
              onClick={() => {
                setInvite(true);
                setLink('');
              }}
            >
              <Plus size={14} />
              Invite member
            </Button>
          )}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Member</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {app.data.members.map((m) => (
              <TableRow key={m.userId}>
                <TableCell className="pl-6 py-4">
                  <span className="inline-flex items-center gap-3">
                    <Avatar name={m.user.name} />
                    {m.user.name}
                    {m.userId === app.data.userId && (
                      <span className="tag">You</span>
                    )}
                  </span>
                </TableCell>
                <TableCell className="muted text-sm">{m.user.email}</TableCell>
                <TableCell>
                  {admin ? (
                    <Picker
                      label={`Role for ${m.user.name}`}
                      value={m.role}
                      onChange={(v) => updateRole(m.userId, v)}
                      options={[
                        { value: 'admin', label: 'Admin' },
                        { value: 'manager', label: 'Manager' },
                        { value: 'sales_rep', label: 'Sales rep' },
                      ]}
                    />
                  ) : (
                    <span className="tag">{m.role}</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
      <div className="grid md:grid-cols-3 gap-5">
        {[
          [
            'Admins',
            'Manage people, organization settings, CRM records and billing.',
          ],
          [
            'Managers',
            'Manage all contacts, deals and activities in this organization.',
          ],
          [
            'Sales reps',
            'Read and manage their own CRM records and personal AI usage.',
          ],
        ].map(([title, body]) => (
          <div className="panel p-5" key={title}>
            <ShieldCheck size={19} className="text-[#a591c5] mb-3" />
            <h3 className="font-medium text-sm">{title}</h3>
            <p className="text-sm muted leading-relaxed mt-2">{body}</p>
          </div>
        ))}
      </div>
      {DEMO && (
        <section className="panel p-6 flex flex-wrap gap-4 items-center justify-between">
          <div>
            <h2 className="font-semibold">Start fresh</h2>
            <p className="text-sm muted mt-2">
              Restore this browser’s current demo workspace to its original
              sample data.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              app.setData(resetDemo());
              toast.success('Demo data restored');
            }}
          >
            <RotateCcw size={14} />
            Reset demo data
          </Button>
        </section>
      )}
      <Dialog open={invite} onOpenChange={setInvite}>
        <DialogContent className="sm:max-w-md p-6">
          <DialogHeader>
            <DialogTitle>Invite a teammate</DialogTitle>
            <DialogDescription>
              {DEMO
                ? 'Adds a sample teammate to this browser. No email will be sent.'
                : 'Create a private, single-use invitation link valid for 7 days. Share it with the intended recipient.'}
            </DialogDescription>
          </DialogHeader>
          {link ? (
            <div className="space-y-4">
              <Input aria-label="Invitation link" readOnly value={link} />
              <Button
                onClick={() =>
                  navigator.clipboard
                    .writeText(link)
                    .then(() => toast.success('Invitation link copied'))
                }
              >
                <Copy size={14} />
                Copy invitation link
              </Button>
            </div>
          ) : (
            <form onSubmit={submitInvite} className="space-y-4">
              <label className="field">
                Email
                <Input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label className="field">
                Role
                <Picker
                  label="Invitation role"
                  value={role}
                  onChange={setRole}
                  options={[
                    { value: 'sales_rep', label: 'Sales rep' },
                    { value: 'manager', label: 'Manager' },
                    { value: 'admin', label: 'Admin' },
                  ]}
                />
              </label>
              <Button type="submit" disabled={busy}>
                {busy
                  ? 'Creating…'
                  : DEMO
                    ? 'Add sample teammate'
                    : 'Create invitation'}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={newOrg} onOpenChange={setNewOrg}>
        <DialogContent className="p-6">
          <DialogHeader>
            <DialogTitle>New organization</DialogTitle>
            <DialogDescription>
              {DEMO
                ? 'The demo includes two sample organizations. Switch between them from the sidebar.'
                : 'Create a separate workspace with its own membership, CRM and subscription trial.'}
            </DialogDescription>
          </DialogHeader>
          {!DEMO && (
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  const r = await fetch('/api/organizations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: newName }),
                  });
                  const j = await r.json();
                  if (!r.ok) throw Error(j.error);
                  await app.reload();
                  setNewOrg(false);
                  toast.success(
                    'Organization created. Select it in the sidebar.',
                  );
                } catch (e: any) {
                  toast.error(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label className="field">
                Name
                <Input
                  required
                  minLength={2}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </label>
              <Button type="submit" disabled={busy}>
                Create organization
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
export function TestGuide() {
  return (
    <div className="max-w-4xl space-y-6">
      <div className="ai-gradient rounded-xl p-6">
        <h2 className="text-lg font-semibold text-[#7d689b]">
          Take Relay for a spin
        </h2>
        <p className="text-sm text-[#9783ab] leading-loose mt-2">
          This private demo runs with sample data saved in your browser. AI is
          simulated; no email is delivered and no payment is taken. Changes
          survive refresh on this device. Reset everything from Settings when
          you’re done.
        </p>
      </div>
      <section className="panel p-7 guide-content">
        <ol className="list-decimal pl-5">
          {[
            [
              'Explore your overview',
              'Check pipeline totals and the four stage bars. Complete a task in “Up next”; it should move into Recent activity.',
            ],
            [
              'Create a contact',
              'Open Contacts → Add contact. Enter a name, email, company and tags. Save, search for the name, then open the record and edit it.',
            ],
            [
              'Import a CSV',
              'Use Contacts → Import CSV. Provide name,email,company headers and a few records. Validate & preview before importing. A duplicate or invalid email should produce an error.',
            ],
            [
              'Move a deal',
              'Create a deal linked to your contact. Drag it from Lead to Proposal. Open it to verify the stage and change its value; the overview totals should update. Keyboard users can change the stage from deal details.',
            ],
            [
              'Follow through',
              'Add an activity linked to the contact and deal, with a due date and reminder. Complete it. Check that it appears in both record timelines. Demo reminders appear as due activities; email reminders require a connected mail service.',
            ],
            [
              'Try the assistant',
              'Click Ask Relay anywhere. Ask “Show deals closing this month with no activity in 2 weeks.” Then ask “Create a follow-up task for Catalog.” Accept the suggestion once and find it in Activities.',
            ],
            [
              'Use the AI workspace',
              'Draft a follow-up and edit the result. Try Meeting notes → Use sample meeting notes → Summarize, then accept a suggested task. Choose Lead scoring to save a sample assessment.',
            ],
            [
              'Exercise the allowance',
              'Open Usage & billing. Note the model-call and token counts, then run an AI action and check they increase. Click Simulate usage limit and try AI again: it should stop. Choose a larger demo plan to continue.',
            ],
            [
              'Switch organizations',
              'Use the workspace selector in the sidebar. Create a contact in one organization, switch, and check that your new contact is absent there. Switch back and refresh to confirm it remains.',
            ],
            [
              'Restore the demo',
              'Settings → Reset demo data restores the current workspace. Try the flows again with a clean slate.',
            ],
          ].map(([t, b]) => (
            <li key={t}>
              <strong>{t}</strong>
              <p className="text-sm">{b}</p>
            </li>
          ))}
        </ol>
      </section>
      <section className="panel p-6">
        <h2 className="font-semibold">When live services are connected</h2>
        <p className="text-sm muted leading-loose mt-3">
          The supplied user testing guide adds signup, Google sign-in,
          invitation acceptance, role checks, real Claude usage logs, Stripe
          test checkout and webhook replay, and scheduled email delivery. These
          integration checks need your own configured test services.
        </p>
      </section>
    </div>
  );
}
