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
          token_version INT DEFAULT 1 NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
          reset_password_token VARCHAR(255),
          reset_password_expires_at TIMESTAMP,
          failed_attempts INT DEFAULT 0 NOT NULL,
          locked_until TIMESTAMP,
          email_verified BOOLEAN DEFAULT FALSE NOT NULL,
          verification_token VARCHAR(255),
          onboarded BOOLEAN DEFAULT FALSE NOT NULL,
          default_speaking_language VARCHAR(10) DEFAULT 'en' NOT NULL,
          default_translation_language VARCHAR(10) DEFAULT 'fr' NOT NULL
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
      await dbClient.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INT DEFAULT 1 NOT NULL;`);
      await dbClient.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(10) DEFAULT 'en' NOT NULL;`);
      await dbClient.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_password_token VARCHAR(255);`);
      await dbClient.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_password_expires_at TIMESTAMP;`);
      await dbClient.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_attempts INT DEFAULT 0 NOT NULL;`);
      await dbClient.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;`);
      await dbClient.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE NOT NULL;`);
      await dbClient.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token VARCHAR(255);`);
      await dbClient.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarded BOOLEAN DEFAULT FALSE NOT NULL;`);
      await dbClient.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS default_speaking_language VARCHAR(10) DEFAULT 'en' NOT NULL;`);
      await dbClient.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS default_translation_language VARCHAR(10) DEFAULT 'fr' NOT NULL;`);
      await dbClient.execute(sql`UPDATE users SET email_verified = TRUE WHERE email_verified IS NULL;`);

      await dbClient.execute(sql`
        CREATE TABLE IF NOT EXISTS chats (
          id VARCHAR(36) PRIMARY KEY,
          name VARCHAR(150),
          is_group BOOLEAN DEFAULT FALSE NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
      `);

      await dbClient.execute(sql`
        CREATE TABLE IF NOT EXISTS chat_participants (
          id VARCHAR(36) PRIMARY KEY,
          chat_id VARCHAR(36) NOT NULL,
          user_id VARCHAR(36) NOT NULL,
          joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
          last_read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
      `);

      await dbClient.execute(sql`ALTER TABLE chat_participants ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL;`);

      await dbClient.execute(sql`
        CREATE TABLE IF NOT EXISTS chat_messages (
          id VARCHAR(36) PRIMARY KEY,
          chat_id VARCHAR(36) NOT NULL,
          sender_id VARCHAR(36) NOT NULL,
          original_text TEXT NOT NULL,
          source_lang VARCHAR(10) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
      `);

      await dbClient.execute(sql`
        CREATE TABLE IF NOT EXISTS message_translations (
          id VARCHAR(36) PRIMARY KEY,
          message_id VARCHAR(36) NOT NULL,
          target_lang VARCHAR(10) NOT NULL,
          translated_text TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
      `);

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
      await dbClient.execute(sql`CREATE INDEX IF NOT EXISTS idx_chat_participants_chat ON chat_participants (chat_id);`);
      await dbClient.execute(sql`CREATE INDEX IF NOT EXISTS idx_chat_participants_user ON chat_participants (user_id);`);
      await dbClient.execute(sql`CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_created ON chat_messages (chat_id, created_at);`);
      await dbClient.execute(sql`CREATE INDEX IF NOT EXISTS idx_message_translations_msg ON message_translations (message_id);`);

      console.log('[Database] PostgreSQL migrations applied successfully.');
    } else {
      // SQLite Migrations (using sqliteDb.exec for synchronous execution during startup)
      sqliteDb.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          token_version INTEGER DEFAULT 1 NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
          reset_password_token TEXT,
          reset_password_expires_at TEXT,
          failed_attempts INTEGER DEFAULT 0 NOT NULL,
          locked_until TEXT,
          email_verified INTEGER DEFAULT 0 NOT NULL,
          verification_token TEXT,
          onboarded INTEGER DEFAULT 0 NOT NULL,
          default_speaking_language TEXT DEFAULT 'en' NOT NULL,
          default_translation_language TEXT DEFAULT 'fr' NOT NULL
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
      try { sqliteDb.exec(`ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 1 NOT NULL;`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE users ADD COLUMN preferred_language TEXT DEFAULT 'en' NOT NULL;`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE users ADD COLUMN reset_password_token TEXT;`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE users ADD COLUMN reset_password_expires_at TEXT;`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE users ADD COLUMN failed_attempts INTEGER DEFAULT 0 NOT NULL;`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE users ADD COLUMN locked_until TEXT;`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0 NOT NULL;`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE users ADD COLUMN verification_token TEXT;`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE users ADD COLUMN onboarded INTEGER DEFAULT 0 NOT NULL;`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE users ADD COLUMN default_speaking_language TEXT DEFAULT 'en' NOT NULL;`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE users ADD COLUMN default_translation_language TEXT DEFAULT 'fr' NOT NULL;`); } catch (e) {}
      try { sqliteDb.exec(`UPDATE users SET email_verified = 1 WHERE email_verified IS NULL OR email_verified = 0;`); } catch (e) {}

      sqliteDb.exec(`
        CREATE TABLE IF NOT EXISTS chats (
          id TEXT PRIMARY KEY,
          name TEXT,
          is_group INTEGER DEFAULT 0 NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
        );

        CREATE TABLE IF NOT EXISTS chat_participants (
          id TEXT PRIMARY KEY,
          chat_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          joined_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
          last_read_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
        );

        CREATE TABLE IF NOT EXISTS chat_messages (
          id TEXT PRIMARY KEY,
          chat_id TEXT NOT NULL,
          sender_id TEXT NOT NULL,
          original_text TEXT NOT NULL,
          source_lang TEXT NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
        );

        CREATE TABLE IF NOT EXISTS message_translations (
          id TEXT PRIMARY KEY,
          message_id TEXT NOT NULL,
          target_lang TEXT NOT NULL,
          translated_text TEXT NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
      `);

      try { 
        sqliteDb.exec(`ALTER TABLE chat_participants ADD COLUMN last_read_at TEXT DEFAULT '1970-01-01 00:00:00' NOT NULL;`); 
        sqliteDb.exec(`UPDATE chat_participants SET last_read_at = joined_at WHERE last_read_at = '1970-01-01 00:00:00';`);
      } catch (e) {}

      sqliteDb.exec(`
        CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
        CREATE INDEX IF NOT EXISTS idx_meetings_host_scheduled ON meetings (host_id, scheduled_at);
        CREATE INDEX IF NOT EXISTS idx_meeting_transcripts_meeting_created ON meeting_transcripts (meeting_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_glossary_user_lang_project ON glossary (user_id, source_lang, target_lang, project_id);
        CREATE INDEX IF NOT EXISTS idx_tm_exact_match ON translation_memory (user_id, source_lang, target_lang, source_text, project_id);
        CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications (user_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_projects_user_created ON projects (user_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_chat_participants_chat ON chat_participants (chat_id);
        CREATE INDEX IF NOT EXISTS idx_chat_participants_user ON chat_participants (user_id);
        CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_created ON chat_messages (chat_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_message_translations_msg ON message_translations (message_id);
      `);

      console.log('[Database] SQLite migrations applied successfully.');
    }
  } catch (error) {
    console.error('[Database] FATAL: Migration failed during startup:', error);
    throw error;
  }
}
