import { db, isPostgres } from '../../db/db.connection';
import { pgPushSubscriptions, sqlitePushSubscriptions } from '../../db/schema';
import { eq, and } from 'drizzle-orm';

const pushTable = (isPostgres ? pgPushSubscriptions : sqlitePushSubscriptions) as any;
const dbClient = db as any;

export interface PushSubscriptionRecord {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  createdAt?: Date | string;
}

export class PushSubscriptionRepository {
  async create(record: PushSubscriptionRecord): Promise<PushSubscriptionRecord> {
    const dbValue = {
      ...record,
      createdAt: isPostgres ? new Date() : new Date().toISOString()
    };

    // Check if subscription already exists for this endpoint
    const existing = await dbClient.select()
      .from(pushTable)
      .where(eq(pushTable.endpoint, record.endpoint))
      .limit(1);

    if (existing.length > 0) {
      await dbClient.update(pushTable)
        .set({
          userId: record.userId,
          p256dh: record.p256dh,
          auth: record.auth,
          createdAt: dbValue.createdAt
        })
        .where(eq(pushTable.endpoint, record.endpoint));
    } else {
      await dbClient.insert(pushTable).values(dbValue);
    }

    return dbValue as unknown as PushSubscriptionRecord;
  }

  async findByUserId(userId: string): Promise<PushSubscriptionRecord[]> {
    const result = await dbClient.select()
      .from(pushTable)
      .where(eq(pushTable.userId, userId));
    
    return result as unknown as PushSubscriptionRecord[];
  }

  async deleteByEndpoint(endpoint: string): Promise<void> {
    await dbClient.delete(pushTable)
      .where(eq(pushTable.endpoint, endpoint));
  }

  async deleteByUserAndEndpoint(userId: string, endpoint: string): Promise<void> {
    await dbClient.delete(pushTable)
      .where(and(
        eq(pushTable.userId, userId),
        eq(pushTable.endpoint, endpoint)
      ));
  }
}
export default PushSubscriptionRepository;
