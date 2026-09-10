import { z } from 'zod';
const short = z.string().trim().max(120);
const id = z.string().min(1).max(100);
const nullableId = id.nullable().optional();
const date = z.string().datetime().nullable().optional();
export const contactSchema = z.object({
  name: short.min(2, 'Name must contain at least 2 characters'),
  email: z
    .string()
    .trim()
    .email('Enter a valid email')
    .max(254)
    .transform((s) => s.toLowerCase()),
  company: short.min(1, 'Company is required'),
  phone: z.string().max(50).optional().default(''),
  jobTitle: short.optional().default(''),
  tags: z
    .array(z.string().trim().max(40))
    .max(20)
    .default([])
    .transform((v) => Array.from(new Set(v.filter(Boolean)))),
  source: short.default('manual'),
  notes: z.string().max(12000).default(''),
  ownerId: id.optional(),
});
export const dealSchema = z.object({
  title: short.min(2),
  stage: z
    .enum(['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'])
    .default('lead'),
  value: z.number().min(0).max(999999999999),
  probability: z.number().int().min(0).max(100).default(10),
  closeDate: date,
  contactId: nullableId,
  ownerId: id.optional(),
  notes: z.string().max(12000).default(''),
});
export const activitySchema = z.object({
  title: short.min(2),
  type: z.enum(['call', 'email', 'meeting', 'note', 'task']).default('task'),
  status: z.enum(['pending', 'completed', 'cancelled']).default('pending'),
  body: z.string().max(20000).default(''),
  dueDate: date,
  reminderAt: date,
  contactId: nullableId,
  dealId: nullableId,
  ownerId: id.optional(),
});
export const schemas = {
  contacts: contactSchema,
  deals: dealSchema,
  activities: activitySchema,
};
export const signupSchema = z.object({
  name: short.min(2),
  email: z
    .string()
    .email()
    .transform((s) => s.toLowerCase().trim()),
  password: z.string().min(12).max(128),
  organizationName: short.min(2),
});
export const inviteSchema = z.object({
  email: z
    .string()
    .email()
    .transform((s) => s.toLowerCase().trim()),
  role: z.enum(['admin', 'manager', 'sales_rep']).default('sales_rep'),
});
export const aiSchema = z.object({
  action: z.enum(['assistant', 'email_draft', 'summarize', 'lead_score']),
  prompt: z.string().max(20000).default(''),
  contactId: nullableId,
  dealId: nullableId,
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(4000),
      }),
    )
    .max(8)
    .default([]),
});
