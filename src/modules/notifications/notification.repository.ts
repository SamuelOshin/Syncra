import { db, isPostgres } from '../../db/db.connection';
import { pgNotifications, sqliteNotifications } from '../../db/schema';
import { eq, desc, count } from 'drizzle-orm';
import { PaginationParams } from '../../utils/pagination';

const notificationsTable = (isPostgres ? pgNotifications : sqliteNotifications) as any;
const dbClient = db as any;

export interface NotificationRecord {
  id: string;
  userId: string;
  title: string;
  message: string;
  type?: string;
  read?: boolean;
  createdAt?: Date | string;
}

export class NotificationRepository {
  async create(record: NotificationRecord): Promise<NotificationRecord> {
    const dbValue = {
      ...record,
      type: record.type || 'info',
      read: record.read !== undefined ? record.read : false,
      createdAt: isPostgres ? new Date() : new Date().toISOString()
    };

    await dbClient.insert(notificationsTable).values(dbValue);
    return dbValue as unknown as NotificationRecord;
  }

  async findByUserId(userId: string): Promise<NotificationRecord[]> {
    const result = await dbClient.select()
      .from(notificationsTable)
      .where(eq(notificationsTable.userId, userId))
      .orderBy(desc(notificationsTable.createdAt));
    
    return result as unknown as NotificationRecord[];
  }

  async findByUserIdPaginated(userId: string, pagination: PaginationParams): Promise<{ items: NotificationRecord[]; total: number }> {
    const [items, totalRows] = await Promise.all([
      dbClient.select()
        .from(notificationsTable)
        .where(eq(notificationsTable.userId, userId))
        .orderBy(desc(notificationsTable.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      dbClient.select({ value: count() })
        .from(notificationsTable)
        .where(eq(notificationsTable.userId, userId)),
    ]);

    return {
      items: items as unknown as NotificationRecord[],
      total: Number(totalRows[0]?.value ?? 0),
    };
  }

  async markAllAsRead(userId: string): Promise<void> {
    await dbClient.update(notificationsTable)
      .set({ read: true })
      .where(eq(notificationsTable.userId, userId));
  }

  async clearAll(userId: string): Promise<void> {
    await dbClient.delete(notificationsTable)
      .where(eq(notificationsTable.userId, userId));
  }
}
export default NotificationRepository;
