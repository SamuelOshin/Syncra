import { db, isPostgres } from '../../db/db.connection';
import { pgTranslationMemory, sqliteTranslationMemory } from '../../db/schema';
import { eq, and, count, or, isNull } from 'drizzle-orm';
import { PaginationParams } from '../../utils/pagination';

const tmTable = (isPostgres ? pgTranslationMemory : sqliteTranslationMemory) as any;
const dbClient = db as any;

export interface TranslationSegment {
  id: string;
  userId: string;
  sourceText: string;
  targetText: string;
  sourceLang: string;
  targetLang: string;
  projectId?: string | null;
  createdAt?: Date | string;
}

export class TranslationMemoryRepository {
  async create(segment: TranslationSegment): Promise<TranslationSegment> {
    const dbValue = {
      ...segment,
      createdAt: isPostgres ? new Date() : new Date().toISOString(),
    };
    
    await dbClient.insert(tmTable).values(dbValue);
    return dbValue as unknown as TranslationSegment;
  }

  async findExactMatch(userId: string, sourceText: string, sourceLang: string, targetLang: string, projectId?: string): Promise<TranslationSegment | null> {
    const projectScope = projectId
      ? or(eq(tmTable.projectId, projectId), isNull(tmTable.projectId), eq(tmTable.projectId, ''))
      : or(isNull(tmTable.projectId), eq(tmTable.projectId, ''));

    const result = await dbClient.select()
      .from(tmTable)
      .where(
        and(
          eq(tmTable.userId, userId),
          eq(tmTable.sourceText, sourceText),
          eq(tmTable.sourceLang, sourceLang),
          eq(tmTable.targetLang, targetLang),
          projectScope
        )
      );
      
    if (projectId) {
      const projectMatch = result.find((r: any) => r.projectId === projectId);
      if (projectMatch) return projectMatch as TranslationSegment;
    }
    
    return (result.find((r: any) => !r.projectId) as TranslationSegment) || null;
  }

  async findByUserId(userId: string): Promise<TranslationSegment[]> {
    const result = await dbClient.select()
      .from(tmTable)
      .where(eq(tmTable.userId, userId));
      
    return result as unknown as TranslationSegment[];
  }

  async findByUserIdPaginated(userId: string, pagination: PaginationParams): Promise<{ items: TranslationSegment[]; total: number }> {
    const [items, totalRows] = await Promise.all([
      dbClient.select()
        .from(tmTable)
        .where(eq(tmTable.userId, userId))
        .limit(pagination.limit)
        .offset(pagination.offset),
      dbClient.select({ value: count() })
        .from(tmTable)
        .where(eq(tmTable.userId, userId)),
    ]);

    return {
      items: items as unknown as TranslationSegment[],
      total: Number(totalRows[0]?.value ?? 0),
    };
  }

  async findById(id: string): Promise<TranslationSegment | null> {
    const result = await dbClient.select()
      .from(tmTable)
      .where(eq(tmTable.id, id))
      .limit(1);
      
    return (result[0] as TranslationSegment) || null;
  }

  async delete(id: string): Promise<void> {
    await dbClient.delete(tmTable)
      .where(eq(tmTable.id, id));
  }
}
export default TranslationMemoryRepository;
