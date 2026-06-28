import { drizzle as drizzlePg, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { drizzle as drizzleSqlite, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { Pool } from 'pg';
import Database from 'better-sqlite3';
import config from '../config';

const isPostgres = !!config.databaseUrl;

let pgPool: Pool | null = null;
let sqliteDb: any = null;
let dbInstance: any;

if (isPostgres) {
  pgPool = new Pool({
    connectionString: config.databaseUrl,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
  dbInstance = drizzlePg(pgPool);
  console.log('[Database] Initialized PostgreSQL Client');
} else {
  // SQLite database file in the workspace root
  sqliteDb = new Database('database.db');
  // Enable Write-Ahead Logging (WAL) for concurrent read/write performance
  sqliteDb.pragma('journal_mode = WAL');
  dbInstance = drizzleSqlite(sqliteDb);
  console.log('[Database] Initialized SQLite Client (database.db)');
}

// Export the typed DB instance, pgPool for PG sessions, and sqliteDb for SQLite sessions
export type DrizzleDB = NodePgDatabase<typeof import('./schema')> | BetterSQLite3Database<typeof import('./schema')>;
export const db = dbInstance as DrizzleDB;
export { pgPool, sqliteDb, isPostgres };
export default db;
