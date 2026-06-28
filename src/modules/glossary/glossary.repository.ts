import { db, isPostgres } from '../../db/db.connection';
import { pgGlossary, sqliteGlossary } from '../../db/schema';
import { eq, and, count, or, isNull } from 'drizzle-orm';
import { PaginationParams } from '../../utils/pagination';

const glossaryTable = (isPostgres ? pgGlossary : sqliteGlossary) as any;
const dbClient = db as any;

export interface GlossaryTerm {
  id: string;
  userId: string;
  sourceText: string;
  targetText: string;
  sourceLang: string;
  targetLang: string;
  projectId?: string | null;
  createdAt?: Date | string;
}

export class GlossaryRepository {
  async create(term: GlossaryTerm): Promise<GlossaryTerm> {
    const dbValue = {
      ...term,
      createdAt: isPostgres ? new Date() : new Date().toISOString(),
    };
    
    await dbClient.insert(glossaryTable).values(dbValue);
    return dbValue as unknown as GlossaryTerm;
  }

  async findByUserId(userId: string): Promise<GlossaryTerm[]> {
    const result = await dbClient.select()
      .from(glossaryTable)
      .where(eq(glossaryTable.userId, userId));
      
    return result as unknown as GlossaryTerm[];
  }

  async findByUserIdPaginated(userId: string, pagination: PaginationParams): Promise<{ items: GlossaryTerm[]; total: number }> {
    const [items, totalRows] = await Promise.all([
      dbClient.select()
        .from(glossaryTable)
        .where(eq(glossaryTable.userId, userId))
        .limit(pagination.limit)
        .offset(pagination.offset),
      dbClient.select({ value: count() })
        .from(glossaryTable)
        .where(eq(glossaryTable.userId, userId)),
    ]);

    return {
      items: items as unknown as GlossaryTerm[],
      total: Number(totalRows[0]?.value ?? 0),
    };
  }

  async findActiveTerms(userId: string, sourceLang: string, targetLang: string, projectId?: string | null): Promise<GlossaryTerm[]> {
    const projectScope = projectId
      ? or(eq(glossaryTable.projectId, projectId), isNull(glossaryTable.projectId), eq(glossaryTable.projectId, ''))
      : or(isNull(glossaryTable.projectId), eq(glossaryTable.projectId, ''));

    const result = await dbClient.select()
      .from(glossaryTable)
      .where(
        and(
          eq(glossaryTable.userId, userId),
          eq(glossaryTable.sourceLang, sourceLang),
          eq(glossaryTable.targetLang, targetLang),
          projectScope
        )
      );

    return result as unknown as GlossaryTerm[];
  }

  async findById(id: string): Promise<GlossaryTerm | null> {
    const result = await dbClient.select()
      .from(glossaryTable)
      .where(eq(glossaryTable.id, id))
      .limit(1);
      
    return (result[0] as GlossaryTerm) || null;
  }

  async delete(id: string): Promise<void> {
    await dbClient.delete(glossaryTable)
      .where(eq(glossaryTable.id, id));
  }
}
export default GlossaryRepository;
