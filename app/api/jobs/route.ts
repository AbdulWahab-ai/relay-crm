export const dynamic = 'force-dynamic';
import { timingSafeEqual } from 'node:crypto';
import { handler, AppError } from '@/lib/security';
import { processJobs } from '@/lib/jobs';
export const maxDuration = 300;
export const GET = (req: Request) =>
  handler(async () => {
    const expected = 'Bearer ' + process.env.CRON_SECRET;
    const got = req.headers.get('authorization') || '';
    if (
      !process.env.CRON_SECRET ||
      Buffer.byteLength(got) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(got), Buffer.from(expected))
    )
      throw new AppError(401, 'Unauthorized');
    return processJobs();
  });
