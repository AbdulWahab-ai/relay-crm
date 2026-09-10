import { CRMData, money, Stage } from './types';
export type Suggestion = {
  id: string;
  kind: string;
  payload: Record<string, any>;
  status?: string;
};
export type AIResult = {
  text?: string;
  summary?: string;
  keyPoints?: string[];
  subject?: string;
  body?: string;
  score?: number;
  explanation?: string;
  actions?: Suggestion[];
  trace?: string[];
};
export function demoAI(
  data: CRMData,
  action: string,
  prompt: string,
  contactId?: string,
  dealId?: string,
): AIResult {
  const c = data.contacts.find((c) => c.id === contactId);
  const d = data.deals.find((d) => d.id === dealId);
  const id = () => crypto.randomUUID();
  const q = prompt.toLowerCase();
  if (action === 'email_draft')
    return {
      subject: `Next steps for ${c?.company || 'our conversation'}`,
      body: `Hi ${c?.name.split(' ')[0] || 'there'},\n\nThank you for taking the time to discuss ${d?.title || 'your team’s priorities'}. ${c?.notes ? `I noted your focus on ${c.company}’s goals.` : 'It was helpful to understand what matters most to your team.'}\n\n${prompt || 'I’d love to align on the scope and timeline for the next step.'}\n\nWould you have 20 minutes this week to review the proposal and answer any open questions?\n\nBest,\n${data.members.find((m) => m.userId === data.userId)?.user.name || 'Alex'}`,
      actions: [
        { id: id(), kind: 'send_email', payload: { contactId, dealId } },
      ],
    };
  if (action === 'summarize') {
    const sentences = prompt
      .split(/[.!?\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 8);
    const points = sentences.slice(0, 4);
    const suggestions = sentences
      .filter((s) => /send|follow|schedule|share|review|confirm/i.test(s))
      .slice(0, 3);
    return {
      summary: points.slice(0, 2).join('. ') + '.',
      keyPoints: points,
      actions: (suggestions.length
        ? suggestions
        : ['Review meeting notes and confirm next steps']
      ).map((t) => ({
        id: id(),
        kind: 'create_task',
        payload: {
          title: t.slice(0, 120),
          body: 'Suggested from the sample transcript. Review before accepting.',
          contactId: contactId || null,
          dealId: dealId || null,
          dueDate: new Date(Date.now() + 2 * 86400000).toISOString(),
        },
      })),
    };
  }
  if (action === 'lead_score') {
    const count = data.activities.filter(
      (a) => a.contactId === contactId || (dealId && a.dealId === dealId),
    ).length;
    const score = Math.min(97, 52 + count * 7 + (d ? d.probability / 4 : 12));
    return {
      score: Math.round(score),
      explanation: `Sample heuristic: ${count} linked activities${d ? `, ${d.probability}% recorded deal probability` : ''}, and ${c?.company || 'the relationship'}’s documented needs. This is a demo calculation, not a Claude prediction.`,
    };
  }
  if (/create|schedule|add.*task|follow.?up task/.test(q)) {
    const chosen =
      d ||
      data.deals.find((d) =>
        q.includes(d.title.split(' · ')[0].toLowerCase()),
      ) ||
      data.deals[0];
    if (!chosen)
      return {
        text: 'There are no deals in this workspace. Create a deal before scheduling its follow-up.',
        actions: [],
      };
    return {
      text: `I’ve prepared a follow-up task for ${chosen.title}. Review it below and accept to add it to your activities.`,
      trace: ['Demo record lookup', 'Prepared task suggestion'],
      actions: [
        {
          id: id(),
          kind: 'create_task',
          payload: {
            title: `Follow up on ${chosen.title}`,
            body: prompt.slice(0, 4000),
            dealId: chosen.id,
            contactId: chosen.contactId,
            dueDate: new Date(Date.now() + 86400000).toISOString(),
          },
        },
      ],
    };
  }
  if (/move|stage|mark.*won/.test(q)) {
    const chosen =
      d ||
      data.deals.find((d) =>
        q.includes(d.title.split(' · ')[0].toLowerCase()),
      ) ||
      data.deals[0];
    if (!chosen)
      return {
        text: 'There are no deals in this workspace to update.',
        actions: [],
      };
    const stage =
      (
        [
          'won',
          'lost',
          'negotiation',
          'proposal',
          'qualified',
          'lead',
        ] as Stage[]
      ).find((s) => q.includes(s)) || 'negotiation';
    return {
      text: `Ready to move ${chosen.title} to ${stage}. Confirm the change below.`,
      trace: ['Demo deal lookup'],
      actions: [
        {
          id: id(),
          kind: 'update_stage',
          payload: { dealId: chosen.id, stage, reason: prompt },
        },
      ],
    };
  }
  let deals = data.deals.filter((d) => !['won', 'lost'].includes(d.stage));
  if (/closing|close/.test(q)) {
    const end = /month/.test(q)
      ? new Date(
          new Date().getFullYear(),
          new Date().getMonth() + 1,
          1,
        ).getTime()
      : Date.now() + 14 * 86400000;
    deals = deals.filter(
      (d) =>
        d.closeDate &&
        new Date(d.closeDate).getTime() >= Date.now() &&
        new Date(d.closeDate).getTime() < end,
    );
  }
  if (/no activity|inactive|stale/.test(q))
    deals = deals.filter(
      (d) =>
        !data.activities.some(
          (a) =>
            a.dealId === d.id &&
            a.status === 'completed' &&
            new Date(a.completedAt || a.updatedAt).getTime() >
              Date.now() - 14 * 86400000,
        ),
    );
  if (/contact/.test(q) && !/deal/.test(q))
    return {
      text: `Your workspace has ${data.contacts.length} contacts, ranked by recorded score.\n\n${[
        ...data.contacts,
      ]
        .sort((a, b) => (b.aiScore ?? -1) - (a.aiScore ?? -1))
        .slice(0, 6)
        .map(
          (c) => `• ${c.name} · ${c.company} · score ${c.aiScore ?? 'pending'}`,
        )
        .join('\n')}\n\nOpen a contact to review its timeline.`,
      trace: ['Demo contact lookup'],
    };
  return {
    text: deals.length
      ? `I found ${deals.length} matching open deals worth ${money(deals.reduce((s, d) => s + d.value, 0))}.\n\n${deals
          .slice(0, 6)
          .map((d) => `• ${d.title} — ${money(d.value)} · ${d.stage}`)
          .join(
            '\n',
          )}\n\nPrioritize the nearest close date and confirm each stakeholder’s next step.`
      : 'No deals match those filters. Try broadening the closing window.',
    trace: ['Demo deal filter', 'Demo activity lookup'],
  };
}
