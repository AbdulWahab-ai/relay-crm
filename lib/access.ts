import { getServerSession } from 'next-auth';
import { cookies } from 'next/headers';
import { Role } from '@prisma/client';
import { authOptions } from './auth';
import { db } from './db';
import { AppError } from './security';
export type Access = { userId: string; organizationId: string; role: Role };
export async function requireUser() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) throw new AppError(401, 'Please sign in');
  return String(userId);
}
export async function requireAccess(): Promise<Access> {
  const userId = await requireUser();
  const active = (await cookies()).get('relay-org')?.value;
  const member = active
    ? await db.membership.findUnique({
        where: { organizationId_userId: { organizationId: active, userId } },
      })
    : await db.membership.findFirst({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      });
  if (!member) throw new AppError(403, 'Organization membership required');
  return { userId, organizationId: member.organizationId, role: member.role };
}
export function admin(a: Access) {
  if (a.role !== 'admin')
    throw new AppError(403, 'An organization admin is required');
}
export function scope(a: Access) {
  return {
    organizationId: a.organizationId,
    ...(a.role === 'sales_rep' ? { ownerId: a.userId } : {}),
  };
}
export function canModify(
  a: Access,
  record: { organizationId: string; ownerId: string },
) {
  return (
    record.organizationId === a.organizationId &&
    (a.role !== 'sales_rep' || record.ownerId === a.userId)
  );
}
