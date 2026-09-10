export const dynamic = 'force-dynamic';
import { requireAccess } from '@/lib/access';
import { handler } from '@/lib/security';
import { usageSummary } from '@/lib/billing';
export const GET = () =>
  handler(async () => usageSummary(await requireAccess()));
