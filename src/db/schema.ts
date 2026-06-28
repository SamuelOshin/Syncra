import { pgTable, varchar, timestamp, text, serial, boolean } from 'drizzle-orm/pg-core';
import { sqliteTable, text as sqliteText, integer as sqliteInteger } from 'drizzle-orm/sqlite-core';
import config from '../config';

const isPostgres = !!config.databaseUrl;

// ==========================================
// 1. USERS TABLE
// ==========================================

export const pgUsers = pgTable('users', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  email: varchar('email', { length: 150 }).unique().notNull(),
  password: varchar('password', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const sqliteUsers = sqliteTable('users', {
  id: sqliteText('id').primaryKey(),
  name: sqliteText('name').notNull(),
  email: sqliteText('email').unique().notNull(),
  password: sqliteText('password').notNull(),
  createdAt: sqliteText('created_at').default('(CURRENT_TIMESTAMP)').notNull(),
});

// ==========================================
// 2. MEETINGS TABLE
// ==========================================

export const pgMeetings = pgTable('meetings', {
  id: varchar('id', { length: 36 }).primaryKey(),
  hostId: varchar('host_id', { length: 36 }).notNull(),
  title: varchar('title', { length: 150 }).notNull(),
  status: varchar('status', { length: 20 }).default('scheduled').notNull(),
  scheduledAt: timestamp('scheduled_at').notNull(),
  projectId: varchar('project_id', { length: 36 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const sqliteMeetings = sqliteTable('meetings', {
  id: sqliteText('id').primaryKey(),
  hostId: sqliteText('host_id').notNull(),
  title: sqliteText('title').notNull(),
  status: sqliteText('status').default('scheduled').notNull(),
  scheduledAt: sqliteInteger('scheduled_at').notNull(),
  projectId: sqliteText('project_id'),
  createdAt: sqliteText('created_at').default('(CURRENT_TIMESTAMP)').notNull(),
});

// ==========================================
// 3. MEETING TRANSCRIPTS TABLE
// ==========================================

export const pgMeetingTranscripts = pgTable('meeting_transcripts', {
  id: serial('id').primaryKey(),
  meetingId: varchar('meeting_id', { length: 36 }).notNull(),
  speakerName: varchar('speaker_name', { length: 100 }).notNull(),
  originalText: text('original_text').notNull(),
  translatedText: text('translated_text').notNull(),
  sourceLang: varchar('source_lang', { length: 10 }).notNull(),
  targetLang: varchar('target_lang', { length: 10 }).notNull(),
  latency: varchar('latency', { length: 10 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const sqliteMeetingTranscripts = sqliteTable('meeting_transcripts', {
  id: sqliteInteger('id').primaryKey({ autoIncrement: true }),
  meetingId: sqliteText('meeting_id').notNull(),
  speakerName: sqliteText('speaker_name').notNull(),
  originalText: sqliteText('original_text').notNull(),
  translatedText: sqliteText('translated_text').notNull(),
  sourceLang: sqliteText('source_lang').notNull(),
  targetLang: sqliteText('target_lang').notNull(),
  latency: sqliteText('latency'),
  createdAt: sqliteText('created_at').default('(CURRENT_TIMESTAMP)').notNull(),
});

// ==========================================
// 4. GLOSSARY TABLE
// ==========================================

export const pgGlossary = pgTable('glossary', {
  id: varchar('id', { length: 36 }).primaryKey(),
  userId: varchar('user_id', { length: 36 }).notNull(),
  sourceText: varchar('source_text', { length: 255 }).notNull(),
  targetText: varchar('target_text', { length: 255 }).notNull(),
  sourceLang: varchar('source_lang', { length: 10 }).notNull(),
  targetLang: varchar('target_lang', { length: 10 }).notNull(),
  projectId: varchar('project_id', { length: 36 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const sqliteGlossary = sqliteTable('glossary', {
  id: sqliteText('id').primaryKey(),
  userId: sqliteText('user_id').notNull(),
  sourceText: sqliteText('source_text').notNull(),
  targetText: sqliteText('target_text').notNull(),
  sourceLang: sqliteText('source_lang').notNull(),
  targetLang: sqliteText('target_lang').notNull(),
  projectId: sqliteText('project_id'),
  createdAt: sqliteText('created_at').default('(CURRENT_TIMESTAMP)').notNull(),
});

// ==========================================
// 5. TRANSLATION MEMORY TABLE
// ==========================================

export const pgTranslationMemory = pgTable('translation_memory', {
  id: varchar('id', { length: 36 }).primaryKey(),
  userId: varchar('user_id', { length: 36 }).notNull(),
  sourceText: text('source_text').notNull(),
  targetText: text('target_text').notNull(),
  sourceLang: varchar('source_lang', { length: 10 }).notNull(),
  targetLang: varchar('target_lang', { length: 10 }).notNull(),
  projectId: varchar('project_id', { length: 36 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const sqliteTranslationMemory = sqliteTable('translation_memory', {
  id: sqliteText('id').primaryKey(),
  userId: sqliteText('user_id').notNull(),
  sourceText: sqliteText('source_text').notNull(),
  targetText: sqliteText('target_text').notNull(),
  sourceLang: sqliteText('source_lang').notNull(),
  targetLang: sqliteText('target_lang').notNull(),
  projectId: sqliteText('project_id'),
  createdAt: sqliteText('created_at').default('(CURRENT_TIMESTAMP)').notNull(),
});

// ==========================================
// 6. NOTIFICATIONS TABLE
// ==========================================

export const pgNotifications = pgTable('notifications', {
  id: varchar('id', { length: 36 }).primaryKey(),
  userId: varchar('user_id', { length: 36 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  type: varchar('type', { length: 50 }).default('info').notNull(),
  read: boolean('read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const sqliteNotifications = sqliteTable('notifications', {
  id: sqliteText('id').primaryKey(),
  userId: sqliteText('user_id').notNull(),
  title: sqliteText('title').notNull(),
  message: sqliteText('message').notNull(),
  type: sqliteText('type').default('info').notNull(),
  read: sqliteInteger('read', { mode: 'boolean' }).default(false).notNull(),
  createdAt: sqliteText('created_at').default('(CURRENT_TIMESTAMP)').notNull(),
});

// Dynamic Exports based on active dialect
export const users = isPostgres ? pgUsers : sqliteUsers;
export const meetings = isPostgres ? pgMeetings : sqliteMeetings;
export const meetingTranscripts = isPostgres ? pgMeetingTranscripts : sqliteMeetingTranscripts;
export const glossary = isPostgres ? pgGlossary : sqliteGlossary;
export const translationMemory = isPostgres ? pgTranslationMemory : sqliteTranslationMemory;
export const notifications = isPostgres ? pgNotifications : sqliteNotifications;

// ==========================================
// 7. PROJECTS TABLE
// ==========================================

export const pgProjects = pgTable('projects', {
  id: varchar('id', { length: 36 }).primaryKey(),
  userId: varchar('user_id', { length: 36 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const sqliteProjects = sqliteTable('projects', {
  id: sqliteText('id').primaryKey(),
  userId: sqliteText('user_id').notNull(),
  name: sqliteText('name').notNull(),
  description: sqliteText('description'),
  createdAt: sqliteText('created_at').default('(CURRENT_TIMESTAMP)').notNull(),
});

export const projects = isPostgres ? pgProjects : sqliteProjects;



