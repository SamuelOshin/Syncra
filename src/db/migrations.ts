import { db, isPostgres, sqliteDb } from './db.connection';
import { sql } from 'drizzle-orm';

// Cast db to any to bypass PgDatabase | BetterSQLite3Database union type signature conflicts
const dbClient = db as any;

export async function initializeDatabase() {
  console.log('[Database] Running startup migrations...');
  
  try {
    if (isPostgres) {
      // PostgreSQL Migrations
      await dbClient.execute(sql`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(36) PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(150) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
      `);

      await dbClient.execute(sql`
        CREATE TABLE IF NOT EXISTS meetings (
          id VARCHAR(36) PRIMARY KEY,
          host_id VARCHAR(36) NOT NULL,
          title VARCHAR(255) NOT NULL,
          scheduled_at TIMESTAMP NOT NULL,
          status VARCHAR(20) DEFAULT 'scheduled' NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
      `);

      await dbClient.execute(sql`
        CREATE TABLE IF NOT EXISTS meeting_transcripts (
          id SERIAL PRIMARY KEY,
          meeting_id VARCHAR(36) NOT NULL,
          speaker_name VARCHAR(100) NOT NULL,
          original_text TEXT NOT NULL,
          translated_text TEXT NOT NULL,
          source_lang VARCHAR(10) NOT NULL,
          target_lang VARCHAR(10) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
      `);

      await dbClient.execute(sql`
        CREATE TABLE IF NOT EXISTS glossary (
          id VARCHAR(36) PRIMARY KEY,
          user_id VARCHAR(36) NOT NULL,
          source_text VARCHAR(255) NOT NULL,
          target_text VARCHAR(255) NOT NULL,
          source_lang VARCHAR(10) NOT NULL,
          target_lang VARCHAR(10) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
      `);

      await dbClient.execute(sql`
        CREATE TABLE IF NOT EXISTS translation_memory (
          id VARCHAR(36) PRIMARY KEY,
          user_id VARCHAR(36) NOT NULL,
          source_text TEXT NOT NULL,
          target_text TEXT NOT NULL,
          source_lang VARCHAR(10) NOT NULL,
          target_lang VARCHAR(10) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
      `);

      await dbClient.execute(sql`
        CREATE TABLE IF NOT EXISTS notifications (
          id VARCHAR(36) PRIMARY KEY,
          user_id VARCHAR(36) NOT NULL,
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          type VARCHAR(50) DEFAULT 'info' NOT NULL,
          read BOOLEAN DEFAULT FALSE NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
      `);

      await dbClient.execute(sql`
        CREATE TABLE IF NOT EXISTS projects (
          id VARCHAR(36) PRIMARY KEY,
          user_id VARCHAR(36) NOT NULL,
          name VARCHAR(100) NOT NULL,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
      `);

      await dbClient.execute(sql`ALTER TABLE meetings ADD COLUMN IF NOT EXISTS project_id VARCHAR(36);`);
      await dbClient.execute(sql`ALTER TABLE glossary ADD COLUMN IF NOT EXISTS project_id VARCHAR(36);`);
      await dbClient.execute(sql`ALTER TABLE translation_memory ADD COLUMN IF NOT EXISTS project_id VARCHAR(36);`);
      await dbClient.execute(sql`ALTER TABLE meeting_transcripts ADD COLUMN IF NOT EXISTS latency VARCHAR(10);`);

      // Table for connect-pg-simple session store (safe, self-contained creation)
      await dbClient.execute(sql`
        CREATE TABLE IF NOT EXISTS "session" (
          "sid" varchar NOT NULL COLLATE "default" PRIMARY KEY,
          "sess" json NOT NULL,
          "expire" timestamp(6) NOT NULL
        ) WITH (OIDS=FALSE);
      `);

      await dbClient.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");`);
      await dbClient.execute(sql`CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);`);
      await dbClient.execute(sql`CREATE INDEX IF NOT EXISTS idx_meetings_host_scheduled ON meetings (host_id, scheduled_at);`);
      await dbClient.execute(sql`CREATE INDEX IF NOT EXISTS idx_meeting_transcripts_meeting_created ON meeting_transcripts (meeting_id, created_at);`);
      await dbClient.execute(sql`CREATE INDEX IF NOT EXISTS idx_glossary_user_lang_project ON glossary (user_id, source_lang, target_lang, project_id);`);
      await dbClient.execute(sql`CREATE INDEX IF NOT EXISTS idx_tm_exact_match ON translation_memory (user_id, source_lang, target_lang, source_text, project_id);`);
      await dbClient.execute(sql`CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications (user_id, created_at);`);
      await dbClient.execute(sql`CREATE INDEX IF NOT EXISTS idx_projects_user_created ON projects (user_id, created_at);`);

      console.log('[Database] PostgreSQL migrations applied successfully.');
    } else {
      // SQLite Migrations (using sqliteDb.exec for synchronous execution during startup)
      sqliteDb.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
        );

        CREATE TABLE IF NOT EXISTS meetings (
          id TEXT PRIMARY KEY,
          host_id TEXT NOT NULL,
          title TEXT NOT NULL,
          scheduled_at INTEGER NOT NULL,
          status TEXT DEFAULT 'scheduled' NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
        );

        CREATE TABLE IF NOT EXISTS meeting_transcripts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          meeting_id TEXT NOT NULL,
          speaker_name TEXT NOT NULL,
          original_text TEXT NOT NULL,
          translated_text TEXT NOT NULL,
          source_lang TEXT NOT NULL,
          target_lang TEXT NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
        );

        CREATE TABLE IF NOT EXISTS glossary (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          source_text TEXT NOT NULL,
          target_text TEXT NOT NULL,
          source_lang TEXT NOT NULL,
          target_lang TEXT NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
        );

        CREATE TABLE IF NOT EXISTS translation_memory (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          source_text TEXT NOT NULL,
          target_text TEXT NOT NULL,
          source_lang TEXT NOT NULL,
          target_lang TEXT NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
        );

        CREATE TABLE IF NOT EXISTS notifications (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          type TEXT DEFAULT 'info' NOT NULL,
          read INTEGER DEFAULT 0 NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
        );

        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
      `);

      // Safely add optional columns to existing SQLite tables if they don't exist
      try { sqliteDb.exec(`ALTER TABLE meetings ADD COLUMN project_id TEXT;`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE glossary ADD COLUMN project_id TEXT;`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE translation_memory ADD COLUMN project_id TEXT;`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE meeting_transcripts ADD COLUMN latency TEXT;`); } catch (e) {}

      sqliteDb.exec(`
        CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
        CREATE INDEX IF NOT EXISTS idx_meetings_host_scheduled ON meetings (host_id, scheduled_at);
        CREATE INDEX IF NOT EXISTS idx_meeting_transcripts_meeting_created ON meeting_transcripts (meeting_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_glossary_user_lang_project ON glossary (user_id, source_lang, target_lang, project_id);
        CREATE INDEX IF NOT EXISTS idx_tm_exact_match ON translation_memory (user_id, source_lang, target_lang, source_text, project_id);
        CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications (user_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_projects_user_created ON projects (user_id, created_at);
      `);

      console.log('[Database] SQLite migrations applied successfully.');
    }
  } catch (error) {
    console.error('[Database] FATAL: Migration failed during startup:', error);
    throw error;
  }
}
