export const dynamic = 'force-dynamic';
import Papa from 'papaparse';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireAccess } from '@/lib/access';
import {
  handler,
  jsonBody,
  sameOrigin,
  rateLimit,
  AppError,
} from '@/lib/security';
import { contactSchema } from '@/lib/validation';
export const POST = (req: Request) =>
  handler(async () => {
    sameOrigin(req);
    const a = await requireAccess();
    await rateLimit('import:' + a.userId, 5, 3600);
    const { csv } = z
      .object({ csv: z.string().max(1000000) })
      .parse(await jsonBody(req, 1100000));
    const result = Papa.parse<Record<string, string>>(csv, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
    });
    if (result.errors.length)
      throw new AppError(400, 'Invalid CSV: ' + result.errors[0].message);
    if (!result.data.length || result.data.length > 500)
      throw new AppError(400, 'Import 1–500 contacts at a time');
    const seen = new Set<string>();
    const data = result.data.map((r, i) => {
      const p = contactSchema.safeParse({
        ...r,
        jobTitle: r.jobtitle || r.jobTitle,
        tags: (r.tags || '')
          .split(';')
          .map((t) => t.trim())
          .filter(Boolean),
        source: r.source || 'csv',
        ownerId: a.userId,
      });
      if (!p.success)
        throw new AppError(400, `Row ${i + 2}: ${p.error.issues[0].message}`);
      if (seen.has(p.data.email))
        throw new AppError(400, `Duplicate email on row ${i + 2}`);
      seen.add(p.data.email);
      return { ...p.data, organizationId: a.organizationId, ownerId: a.userId };
    });
    await db.$transaction(async (tx) => {
      await tx.contact.createMany({ data });
      await tx.auditLog.create({
        data: {
          organizationId: a.organizationId,
          actorId: a.userId,
          action: 'contacts.import',
        },
      });
    });
    return { imported: data.length };
  });
