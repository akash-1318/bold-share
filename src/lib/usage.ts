import { and, eq, gt, isNull, or, sum } from 'drizzle-orm';
import { db } from './db';
import { files, subscriptions } from '../schema';
import type { SubscriptionStatus } from './plans';

export async function getUsageBytes(userId: string): Promise<number> {
  const [result] = await db
    .select({ total: sum(files.size) })
    .from(files)
    .where(
      and(
        eq(files.userId, userId),
        or(isNull(files.expiresAt), gt(files.expiresAt, new Date()))
      )
    );

  return Number(result?.total ?? 0);
}

export async function getSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
  const row = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });

  return (row?.status as SubscriptionStatus | undefined) ?? 'free';
}
