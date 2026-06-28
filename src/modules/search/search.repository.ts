import { and, eq, like, or, sql } from 'drizzle-orm';
import { db, isPostgres } from '../../db/db.connection';
import {
  pgGlossary,
  pgMeetingTranscripts,
  pgMeetings,
  pgTranslationMemory,
  sqliteGlossary,
  sqliteMeetingTranscripts,
  sqliteMeetings,
  sqliteTranslationMemory,
} from '../../db/schema';

const meetingsTable = (isPostgres ? pgMeetings : sqliteMeetings) as any;
const transcriptsTable = (isPostgres ? pgMeetingTranscripts : sqliteMeetingTranscripts) as any;
const glossaryTable = (isPostgres ? pgGlossary : sqliteGlossary) as any;
const tmTable = (isPostgres ? pgTranslationMemory : sqliteTranslationMemory) as any;
const dbClient = db as any;

export class SearchRepository {
  async globalSearch(userId: string, rawQuery: string) {
    const normalized = `%${rawQuery.trim().toLowerCase()}%`;

    const [meetings, glossary, translationMemory, transcripts] = await Promise.all([
      dbClient.select()
        .from(meetingsTable)
        .where(
          and(
            eq(meetingsTable.hostId, userId),
            like(sql`lower(${meetingsTable.title})`, normalized)
          )
        )
        .limit(5),

      dbClient.select()
        .from(glossaryTable)
        .where(
          and(
            eq(glossaryTable.userId, userId),
            or(
              like(sql`lower(${glossaryTable.sourceText})`, normalized),
              like(sql`lower(${glossaryTable.targetText})`, normalized)
            )
          )
        )
        .limit(5),

      dbClient.select()
        .from(tmTable)
        .where(
          and(
            eq(tmTable.userId, userId),
            or(
              like(sql`lower(${tmTable.sourceText})`, normalized),
              like(sql`lower(${tmTable.targetText})`, normalized)
            )
          )
        )
        .limit(5),

      dbClient.select({
        id: transcriptsTable.id,
        meetingId: transcriptsTable.meetingId,
        speakerName: transcriptsTable.speakerName,
        originalText: transcriptsTable.originalText,
        translatedText: transcriptsTable.translatedText,
        createdAt: transcriptsTable.createdAt,
      })
        .from(transcriptsTable)
        .innerJoin(meetingsTable, eq(transcriptsTable.meetingId, meetingsTable.id))
        .where(
          and(
            eq(meetingsTable.hostId, userId),
            or(
              like(sql`lower(${transcriptsTable.originalText})`, normalized),
              like(sql`lower(${transcriptsTable.translatedText})`, normalized)
            )
          )
        )
        .limit(5),
    ]);

    return {
      meetings,
      transcripts,
      glossary,
      translationMemory,
    };
  }
}

export default SearchRepository;
