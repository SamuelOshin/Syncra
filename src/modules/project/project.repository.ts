import { db, isPostgres } from '../../db/db.connection';
import { pgProjects, sqliteProjects } from '../../db/schema';
import { eq, desc, count } from 'drizzle-orm';
import { PaginationParams } from '../../utils/pagination';

const projectsTable = (isPostgres ? pgProjects : sqliteProjects) as any;
const dbClient = db as any;

export interface ProjectRecord {
  id: string;
  userId: string;
  name: string;
  description?: string;
  createdAt?: Date | string;
}

export class ProjectRepository {
  async create(record: ProjectRecord): Promise<ProjectRecord> {
    const dbValue = {
      ...record,
      createdAt: isPostgres ? new Date() : new Date().toISOString()
    };

    await dbClient.insert(projectsTable).values(dbValue);
    return dbValue as unknown as ProjectRecord;
  }

  async findByUserId(userId: string): Promise<ProjectRecord[]> {
    const result = await dbClient.select()
      .from(projectsTable)
      .where(eq(projectsTable.userId, userId))
      .orderBy(desc(projectsTable.createdAt));

    return result as unknown as ProjectRecord[];
  }

  async findByUserIdPaginated(userId: string, pagination: PaginationParams): Promise<{ items: ProjectRecord[]; total: number }> {
    const [items, totalRows] = await Promise.all([
      dbClient.select()
        .from(projectsTable)
        .where(eq(projectsTable.userId, userId))
        .orderBy(desc(projectsTable.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      dbClient.select({ value: count() })
        .from(projectsTable)
        .where(eq(projectsTable.userId, userId)),
    ]);

    return {
      items: items as unknown as ProjectRecord[],
      total: Number(totalRows[0]?.value ?? 0),
    };
  }

  async findById(id: string): Promise<ProjectRecord | null> {
    const result = await dbClient.select()
      .from(projectsTable)
      .where(eq(projectsTable.id, id))
      .limit(1);

    return (result[0] as ProjectRecord) || null;
  }

  async delete(id: string): Promise<void> {
    await dbClient.delete(projectsTable)
      .where(eq(projectsTable.id, id));
  }
}
export default ProjectRepository;
