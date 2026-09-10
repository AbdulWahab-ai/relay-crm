'use client';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import Papa from 'papaparse';
import {
  Sparkles,
  Mail,
  Phone,
  Building2,
  CalendarDays,
  Plus,
  Trash2,
  ArrowUpRight,
  Upload,
  LoaderCircle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Picker, Avatar, AppActions } from './crm-app';
import { Contact, Deal, Activity, Entity, stages, money } from '@/lib/types';
import { DEMO, mutateDemo } from '@/lib/demo-store';
import { contactSchema } from '@/lib/validation';
type Item = Contact | Deal | Activity;
function localTime(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export function RecordDialog({
  record,
  onClose,
  ...app
}: AppActions & {
  record: { entity: Entity; value?: Item } | null;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Record<string, any>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [csv, setCsv] = useState('');
  const [csvRows, setCsvRows] = useState<Record<string, unknown>[]>([]);
  useEffect(() => {
    if (record) {
      const r = record.value as any;
      setForm({
        ownerId: app.data.userId,
        name: '',
        email: '',
        phone: '',
        company: '',
        jobTitle: '',
        tags: [],
        source: 'manual',
        notes: '',
        title: '',
        stage: 'lead',
        value: 0,
        probability: 10,
        contactId: 'none',
        dealId: 'none',
        closeDate: '',
        type: 'task',
        status: 'pending',
        body: '',
        ...r,
        dueDate: localTime(r?.dueDate),
        reminderAt: localTime(r?.reminderAt),
      });
      setError('');
      setCsvRows([]);
      setCsv('');
    }
  }, [record, app.data.userId]);
  const field = (name: string, value: any) =>
    setForm((f) => ({ ...f, [name]: value }));
  const entity = record?.entity || 'contacts';
  const isImport = record?.value?.id === 'import';
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const keys =
        entity === 'contacts'
          ? [
              'name',
              'email',
              'phone',
              'company',
              'jobTitle',
              'tags',
              'source',
              'notes',
              'ownerId',
            ]
          : entity === 'deals'
            ? [
                'title',
                'stage',
                'value',
                'probability',
                'contactId',
                'closeDate',
                'notes',
                'ownerId',
              ]
            : [
                'title',
                'type',
                'status',
                'body',
                'contactId',
                'dealId',
                'dueDate',
                'reminderAt',
                'ownerId',
              ];
      const payload = Object.fromEntries(keys.map((k) => [k, form[k]]));
      ['contactId', 'dealId'].forEach((k) => {
        if (k in payload && payload[k] === 'none') payload[k] = null;
      });
      ['closeDate', 'dueDate', 'reminderAt'].forEach((k) => {
        if (k in payload)
          payload[k] = payload[k] ? new Date(payload[k]).toISOString() : null;
      });
      if (entity === 'contacts') contactSchema.parse(payload);
      await app.mutate(
        entity,
        record?.value?.id ? 'PATCH' : 'POST',
        record?.value?.id,
        payload,
      );
      toast.success(
        `${entity === 'contacts' ? 'Contact' : entity === 'deals' ? 'Deal' : 'Activity'} saved`,
      );
      onClose();
    } catch (e: any) {
      setError(e.issues?.[0]?.message || e.message);
    } finally {
      setBusy(false);
    }
  };
  const previewCSV = () => {
    setError('');
    try {
      const p = Papa.parse<Record<string, string>>(csv, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim().toLowerCase(),
      });
      if (p.errors.length) throw Error(p.errors[0].message);
      if (!p.data.length || p.data.length > 500)
        throw Error('Import between 1 and 500 rows.');
      const seen = new Set<string>();
      const rows = p.data.map((r, i) => {
        const parsed = contactSchema.safeParse({
          ...r,
          jobTitle: r.jobtitle || r.jobTitle,
          tags: (r.tags || '')
            .split(';')
            .map((t) => t.trim())
            .filter(Boolean),
          source: r.source || 'csv',
          ownerId: app.data.userId,
        });
        if (!parsed.success)
          throw Error(`Row ${i + 2}: ${parsed.error.issues[0].message}`);
        if (
          seen.has(parsed.data.email) ||
          app.data.contacts.some((c) => c.email === parsed.data.email)
        )
          throw Error(`Row ${i + 2}: duplicate email ${parsed.data.email}`);
        seen.add(parsed.data.email);
        return parsed.data;
      });
      setCsvRows(rows);
    } catch (e: any) {
      setError(e.message);
    }
  };
  const importCSV = async () => {
    setBusy(true);
    try {
      if (DEMO) {
        let next = app.data;
        for (const r of csvRows)
          next = mutateDemo(next, 'contacts', 'POST', undefined, r);
        app.setData(next);
      } else {
        const r = await fetch('/api/contacts/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csv }),
        });
        const j = await r.json();
        if (!r.ok) throw Error(j.error);
        await app.reload();
      }
      toast.success(`${csvRows.length} contacts imported`);
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={!!record} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-auto p-7">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {isImport
              ? 'Import contacts from CSV'
              : `${record?.value?.id ? 'Edit' : 'New'} ${entity === 'contacts' ? 'contact' : entity === 'deals' ? 'deal' : 'activity'}`}
          </DialogTitle>
          <DialogDescription>
            {isImport
              ? 'Preview and validate your data before importing.'
              : 'Keep the details that move this relationship forward.'}
          </DialogDescription>
        </DialogHeader>
        {error && (
          <div role="alert" className="form-error">
            {error}
          </div>
        )}
        {isImport ? (
          <div className="space-y-4">
            <p className="text-sm muted">
              Required columns: name, email, company. Optional: phone, jobTitle,
              source, notes, tags (separate tags with semicolons).
            </p>
            <Input
              type="file"
              accept=".csv,text/csv"
              aria-label="Choose CSV file"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) {
                  if (f.size > 1000000) {
                    setError('Maximum file size is 1 MB.');
                    return;
                  }
                  setCsv(await f.text());
                  setCsvRows([]);
                }
              }}
            />
            <Textarea
              value={csv}
              onChange={(e) => {
                setCsv(e.target.value);
                setCsvRows([]);
              }}
              rows={7}
              placeholder={
                'name,email,company,tags\nAvery Stone,avery@example.com,Example,SaaS;Warm lead'
              }
              aria-label="CSV contents"
            />
            {csvRows.length > 0 && (
              <div className="bg-[#eef8f2] p-3 rounded-lg text-sm text-[#518267]">
                {csvRows.length} valid contacts ready.{' '}
                {csvRows
                  .slice(0, 3)
                  .map((x) => x.name)
                  .join(', ')}
                {csvRows.length > 3 ? '…' : ''}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={previewCSV} disabled={!csv}>
                Validate & preview
              </Button>
              <Button onClick={importCSV} disabled={!csvRows.length || busy}>
                {busy
                  ? 'Importing…'
                  : `Import ${csvRows.length || ''} contacts`}
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={save} className="space-y-4">
            <div className="field-grid">
              {entity === 'contacts' ? (
                <>
                  <label className="field">
                    Full name
                    <Input
                      required
                      maxLength={120}
                      value={form.name || ''}
                      onChange={(e) => field('name', e.target.value)}
                    />
                  </label>
                  <label className="field">
                    Email
                    <Input
                      required
                      type="email"
                      value={form.email || ''}
                      onChange={(e) => field('email', e.target.value)}
                    />
                  </label>
                  <label className="field">
                    Company
                    <Input
                      required
                      value={form.company || ''}
                      onChange={(e) => field('company', e.target.value)}
                    />
                  </label>
                  <label className="field">
                    Job title
                    <Input
                      value={form.jobTitle || ''}
                      onChange={(e) => field('jobTitle', e.target.value)}
                    />
                  </label>
                  <label className="field">
                    Phone
                    <Input
                      type="tel"
                      value={form.phone || ''}
                      onChange={(e) => field('phone', e.target.value)}
                    />
                  </label>
                  <label className="field">
                    Source
                    <Input
                      value={form.source || ''}
                      onChange={(e) => field('source', e.target.value)}
                    />
                  </label>
                  <label className="field col-span-full">
                    Tags (comma separated)
                    <Input
                      value={(form.tags || []).join(',')}
                      onChange={(e) =>
                        field(
                          'tags',
                          e.target.value
                            .split(',')
                            .map((s: string) => s.trim()),
                        )
                      }
                    />
                  </label>
                </>
              ) : (
                <>
                  <label className="field col-span-full">
                    {entity === 'deals' ? 'Deal name' : 'Activity title'}
                    <Input
                      required
                      value={form.title || ''}
                      onChange={(e) => field('title', e.target.value)}
                    />
                  </label>
                  {entity === 'deals' ? (
                    <>
                      <label className="field">
                        Value (USD)
                        <Input
                          required
                          min={0}
                          max={999999999999}
                          type="number"
                          step=".01"
                          value={form.value ?? 0}
                          onChange={(e) =>
                            field('value', Number(e.target.value))
                          }
                        />
                      </label>
                      <label className="field">
                        Stage
                        <Picker
                          label="Stage"
                          value={form.stage || 'lead'}
                          onChange={(v) => field('stage', v)}
                          options={stages.map((s) => ({
                            value: s.id,
                            label: s.label,
                          }))}
                        />
                      </label>
                      <label className="field">
                        Probability (%)
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={form.probability ?? 10}
                          onChange={(e) =>
                            field('probability', Number(e.target.value))
                          }
                        />
                      </label>
                      <label className="field">
                        Expected close date
                        <Input
                          type="date"
                          value={(form.closeDate || '').slice(0, 10)}
                          onChange={(e) => field('closeDate', e.target.value)}
                        />
                      </label>
                    </>
                  ) : (
                    <>
                      <label className="field">
                        Type
                        <Picker
                          label="Activity type"
                          value={form.type || 'task'}
                          onChange={(v) => field('type', v)}
                          options={[
                            'task',
                            'call',
                            'meeting',
                            'email',
                            'note',
                          ].map((v) => ({
                            value: v,
                            label: v.charAt(0).toUpperCase() + v.slice(1),
                          }))}
                        />
                      </label>
                      <label className="field">
                        Status
                        <Picker
                          label="Status"
                          value={form.status || 'pending'}
                          onChange={(v) => field('status', v)}
                          options={['pending', 'completed', 'cancelled'].map(
                            (v) => ({ value: v, label: v }),
                          )}
                        />
                      </label>
                      <label className="field">
                        Due date
                        <Input
                          type="datetime-local"
                          value={(form.dueDate || '').slice(0, 16)}
                          onChange={(e) => field('dueDate', e.target.value)}
                        />
                      </label>
                      <label className="field">
                        Reminder
                        <Input
                          type="datetime-local"
                          value={(form.reminderAt || '').slice(0, 16)}
                          onChange={(e) => field('reminderAt', e.target.value)}
                        />
                      </label>
                      <label className="field">
                        Linked deal
                        <Picker
                          label="Linked deal"
                          value={form.dealId || 'none'}
                          onChange={(v) => {
                            field('dealId', v);
                            const d = app.data.deals.find((d) => d.id === v);
                            if (d?.contactId) field('contactId', d.contactId);
                          }}
                          options={[
                            { value: 'none', label: 'No deal' },
                            ...app.data.deals.map((d) => ({
                              value: d.id,
                              label: d.title,
                            })),
                          ]}
                        />
                      </label>
                    </>
                  )}
                  <label className="field">
                    Contact
                    <Picker
                      label="Contact"
                      value={form.contactId || 'none'}
                      onChange={(v) => field('contactId', v)}
                      options={[
                        { value: 'none', label: 'No contact' },
                        ...app.data.contacts.map((c) => ({
                          value: c.id,
                          label: c.name,
                        })),
                      ]}
                    />
                  </label>
                </>
              )}
              <label className="field">
                Owner
                <Picker
                  label="Owner"
                  value={form.ownerId || app.data.userId}
                  onChange={(v) => field('ownerId', v)}
                  options={app.data.members
                    .filter(
                      (m) =>
                        app.data.organizations.find(
                          (o) => o.id === app.data.organizationId,
                        )?.role !== 'sales_rep' || m.userId === app.data.userId,
                    )
                    .map((m) => ({ value: m.userId, label: m.user.name }))}
                />
              </label>
            </div>
            <label className="field">
              {entity === 'activities' ? 'Details' : 'Notes'}
              <Textarea
                rows={4}
                value={form[entity === 'activities' ? 'body' : 'notes'] || ''}
                onChange={(e) =>
                  field(
                    entity === 'activities' ? 'body' : 'notes',
                    e.target.value,
                  )
                }
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy} className="primary-btn">
                {busy ? <LoaderCircle className="animate-spin" /> : null}Save{' '}
                {entity === 'contacts'
                  ? 'contact'
                  : entity === 'deals'
                    ? 'deal'
                    : 'activity'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
export function RecordDetail({
  detail,
  onClose,
  ask,
  ...app
}: AppActions & {
  detail: { entity: Entity; value: Item } | null;
  onClose: () => void;
  ask: (s: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const item = detail
    ? (app.data[detail.entity] as Item[]).find(
        (x) => x.id === detail.value.id,
      ) || detail.value
    : null;
  const r = item as any;
  const entity = detail?.entity;
  const timeline = app.data.activities
    .filter((a) =>
      entity === 'contacts'
        ? a.contactId === r?.id
        : entity === 'deals'
          ? a.dealId === r?.id
          : false,
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <>
      <Sheet open={!!detail} onOpenChange={(v) => !v && onClose()}>
        <SheetContent className="sm:max-w-[520px] !w-full overflow-y-auto">
          <SheetHeader className="p-7 border-b">
            <div className="mb-4">
              <Avatar name={r?.name || r?.title || 'Record'} size={50} />
            </div>
            <SheetTitle className="text-xl">
              {r?.name || r?.title || 'Details'}
            </SheetTitle>
            <SheetDescription>
              {r?.company ||
                (entity === 'deals' ? money(r?.value || 0) : r?.type)}
            </SheetDescription>
          </SheetHeader>
          {r && (
            <div className="px-7 pb-8 space-y-6">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    app.openRecord(entity!, r);
                    onClose();
                  }}
                >
                  Edit details
                </Button>
                {entity !== 'activities' && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      ask(
                        `Review ${entity === 'contacts' ? 'contact' : 'deal'} ${r.name || r.title} (${r.id}) and suggest a follow-up task.`,
                      );
                      onClose();
                    }}
                  >
                    <Sparkles size={14} />
                    Ask Relay
                  </Button>
                )}
                <Button
                  variant="destructive"
                  aria-label="Delete record"
                  onClick={() => setDeleting(true)}
                >
                  <Trash2 size={15} />
                </Button>
              </div>
              {entity === 'contacts' && (
                <div className="space-y-3 text-sm">
                  <p className="flex items-center gap-3">
                    <Mail size={15} className="muted" />
                    <a href={`mailto:${r.email}`}>{r.email}</a>
                  </p>
                  <p className="flex items-center gap-3">
                    <Phone size={15} className="muted" />
                    {r.phone || 'No phone added'}
                  </p>
                  <p className="flex items-center gap-3">
                    <Building2 size={15} className="muted" />
                    {r.jobTitle || 'Contact'} at {r.company}
                  </p>
                  <div className="flex gap-1">
                    {r.tags?.map((t: string) => (
                      <span className="tag" key={t}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {entity === 'deals' && (
                <div className="space-y-4">
                  <label className="field">
                    Pipeline stage
                    <Picker
                      label="Change deal stage"
                      value={r.stage}
                      options={stages.map((s) => ({
                        value: s.id,
                        label: s.label,
                      }))}
                      onChange={(v) =>
                        app
                          .mutate('deals', 'PATCH', r.id, { stage: v })
                          .then(() => toast.success('Stage updated'))
                          .catch((e) => toast.error(e.message))
                      }
                    />
                  </label>
                  <p className="text-sm muted">
                    {r.probability}% probability · Expected close{' '}
                    {r.closeDate
                      ? new Date(r.closeDate).toLocaleDateString()
                      : 'not set'}
                  </p>
                </div>
              )}
              {entity === 'activities' && (
                <div className="text-sm space-y-3">
                  <span className="tag capitalize">{r.status}</span>
                  <p>
                    Due:{' '}
                    {r.dueDate
                      ? new Date(r.dueDate).toLocaleString()
                      : 'Not set'}
                  </p>
                  <p>
                    Reminder:{' '}
                    {r.reminderAt
                      ? new Date(r.reminderAt).toLocaleString()
                      : 'Not set'}
                  </p>
                  <Button
                    onClick={() =>
                      app
                        .mutate('activities', 'PATCH', r.id, {
                          status:
                            r.status === 'completed' ? 'pending' : 'completed',
                        })
                        .catch((e) => toast.error(e.message))
                    }
                  >
                    {r.status === 'completed'
                      ? 'Reopen activity'
                      : 'Mark completed'}
                  </Button>
                </div>
              )}
              {entity !== 'activities' && (
                <div className="ai-gradient p-4 rounded-xl">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-primary flex gap-2 items-center">
                      <Sparkles size={15} />
                      AI lead score
                    </span>
                    <span className="score">{r.aiScore ?? 'Not scored'}</span>
                  </div>
                  <p className="text-sm leading-relaxed text-[#867697] mt-3">
                    {r.aiExplanation ||
                      'Open the AI workspace to score this relationship.'}
                  </p>
                  {DEMO && (
                    <p className="text-xs muted mt-2">
                      Sample score · simulated in this demo
                    </p>
                  )}
                </div>
              )}
              <div>
                <h3 className="font-medium text-sm mb-2">
                  {entity === 'activities' ? 'Details' : 'Notes'}
                </h3>
                <p className="text-sm leading-relaxed muted whitespace-pre-wrap">
                  {r.notes || r.body || 'No notes yet.'}
                </p>
              </div>
              {entity !== 'activities' && (
                <div>
                  <div className="flex justify-between items-center">
                    <h3 className="font-medium">Activity timeline</h3>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        app.openRecord('activities', {
                          contactId: entity === 'contacts' ? r.id : r.contactId,
                          dealId: entity === 'deals' ? r.id : null,
                        } as Activity);
                        onClose();
                      }}
                    >
                      <Plus size={14} />
                      Add
                    </Button>
                  </div>
                  {timeline.map((a) => (
                    <div className="timeline-item" key={a.id}>
                      <span className="activity-icon">
                        <CalendarDays size={14} />
                      </span>
                      <div>
                        <div className="text-sm font-medium">{a.title}</div>
                        <div className="text-xs muted mt-1">
                          {a.type} · {a.status} ·{' '}
                          {new Date(a.createdAt).toLocaleDateString()}
                        </div>
                        <p className="text-sm muted mt-2">{a.body}</p>
                      </div>
                    </div>
                  ))}
                  {!timeline.length && (
                    <p className="text-sm muted py-5">No activities yet.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this record?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes {r?.name || r?.title}. Related activities are kept
              and unlinked. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep record</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await app.mutate(entity!, 'DELETE', r.id, {});
                  setDeleting(false);
                  onClose();
                  toast.success('Record deleted');
                } catch (e: any) {
                  toast.error(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Delete record
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
