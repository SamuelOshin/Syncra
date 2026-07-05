import { db, isPostgres } from '../../db/db.connection';
import { pgUsers, sqliteUsers } from '../../db/schema';
import { eq, sql } from 'drizzle-orm';

// We cast the table based on the active driver to avoid TypeScript compiler union-type issues
const usersTable = (isPostgres ? pgUsers : sqliteUsers) as any;
// Cast db to any to bypass PgDatabase | BetterSQLite3Database union signature conflicts
const dbClient = db as any;

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  tokenVersion?: number;
  preferredLanguage?: string;
  createdAt?: Date | string;
  resetPasswordToken?: string | null;
  resetPasswordExpiresAt?: Date | string | null;
  failedAttempts?: number;
  lockedUntil?: Date | string | null;
  emailVerified?: boolean | number;
  verificationToken?: string | null;
  onboarded?: boolean | number;
  defaultSpeakingLanguage?: string;
  defaultTranslationLanguage?: string;
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

  async findByResetToken(token: string): Promise<User | null> {
    const result = await dbClient.select().from(usersTable).where(eq(usersTable.resetPasswordToken, token)).limit(1);
    return (result[0] as User) || null;
  }

  async findByVerificationToken(token: string): Promise<User | null> {
    const result = await dbClient.select().from(usersTable).where(eq(usersTable.verificationToken, token)).limit(1);
    return (result[0] as User) || null;
  }

  async create(user: User): Promise<User> {
    await dbClient.insert(usersTable).values(user);
    return user;
  }

  async update(userId: string, data: Partial<User>): Promise<void> {
    await dbClient
      .update(usersTable)
      .set(data)
      .where(eq(usersTable.id, userId));
  }

  async incrementTokenVersion(userId: string): Promise<void> {
    await dbClient
      .update(usersTable)
      .set({ tokenVersion: sql`token_version + 1` })
      .where(eq(usersTable.id, userId));
  }
}
export default UserRepository;
