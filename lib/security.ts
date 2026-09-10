import { createHash } from 'node:crypto';
import { db } from './db';
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function hash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
export async function rateLimit(key: string, limit: number, seconds: number) {
  const k = hash(key);
  const now = new Date();
  const expires = new Date(now.getTime() + seconds * 1000);
  const result = await db.$queryRaw<
    { count: number }[]
  >`INSERT INTO "RateLimit" ("key","count","expiresAt") VALUES (${k},1,${expires}) ON CONFLICT ("key") DO UPDATE SET "count"=CASE WHEN "RateLimit"."expiresAt"<${now} THEN 1 ELSE "RateLimit"."count"+1 END,"expiresAt"=CASE WHEN "RateLimit"."expiresAt"<${now} THEN ${expires} ELSE "RateLimit"."expiresAt" END RETURNING "count"`;
  if (result[0].count > limit)
    throw new AppError(429, 'Too many requests. Please try again later.');
}
export function sameOrigin(req: Request) {
  const origin = req.headers.get('origin');
  const expected = process.env.NEXTAUTH_URL;
  if (!expected || origin !== new URL(expected).origin)
    throw new AppError(403, 'Invalid request origin');
}
export async function jsonBody(req: Request, max = 1000000) {
  const text = await req.text();
  if (Buffer.byteLength(text) > max)
    throw new AppError(413, 'Request too large');
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError(400, 'Invalid JSON');
  }
}
export async function handler(fn: () => Promise<unknown>) {
  try {
    return Response.json(await fn(), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e: any) {
    if (e.name === 'ZodError')
      return Response.json(
        { error: e.issues[0]?.message || 'Invalid input' },
        { status: 400 },
      );
    if (e.code === 'P2002')
      return Response.json(
        { error: 'A record with these details already exists.' },
        { status: 409 },
      );
    if (e instanceof AppError)
      return Response.json({ error: e.message }, { status: e.status });
    console.error('Request failed', e.name, e.code || '');
    return Response.json(
      { error: 'Unable to complete this request. Please try again.' },
      { status: 500 },
    );
  }
}
