import { db, isPostgres } from '../../db/db.connection';
import { pgUsers, sqliteUsers } from '../../db/schema';
import { eq } from 'drizzle-orm';

// We cast the table based on the active driver to avoid TypeScript compiler union-type issues
const usersTable = (isPostgres ? pgUsers : sqliteUsers) as any;
// Cast db to any to bypass PgDatabase | BetterSQLite3Database union signature conflicts
const dbClient = db as any;

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  createdAt?: Date | string;
}

export class UserRepository {
  async findByEmail(email: string): Promise<User | null> {
    const result = await dbClient.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    return (result[0] as User) || null;
  }

  async findById(id: string): Promise<User | null> {
    const result = await dbClient.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
    return (result[0] as User) || null;
  }

  async create(user: User): Promise<User> {
    await dbClient.insert(usersTable).values(user);
    return user;
  }
}
export default UserRepository;
