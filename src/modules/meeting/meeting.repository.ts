import { db, isPostgres } from '../../db/db.connection';
import { pgMeetings, sqliteMeetings, pgMeetingTranscripts, sqliteMeetingTranscripts } from '../../db/schema';
import { eq, asc, count } from 'drizzle-orm';
import { PaginationParams } from '../../utils/pagination';

const meetingsTable = (isPostgres ? pgMeetings : sqliteMeetings) as any;
const transcriptsTable = (isPostgres ? pgMeetingTranscripts : sqliteMeetingTranscripts) as any;
const dbClient = db as any;

export interface Meeting {
  id: string;
  hostId: string;
  title: string;
  scheduledAt: Date | number | string;
  status: string;
  projectId?: string | null;
  createdAt?: Date | string;
}

export interface MeetingTranscript {
  id?: number;
  meetingId: string;
  speakerName: string;
  originalText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  latency?: number | string;
  createdAt?: Date | string;
}

export interface MeetingTranscriptSummary {
  meetingId: string;
  originalText: string;
  sourceLang: string;
  targetLang: string;
}

export class MeetingRepository {
  async create(meeting: Omit<Meeting, 'scheduledAt'> & { scheduledAt: string }): Promise<Meeting> {
    const dbValue = {
      ...meeting,
      scheduledAt: isPostgres ? new Date(meeting.scheduledAt) : new Date(meeting.scheduledAt).getTime(),
    };
    
    await dbClient.insert(meetingsTable).values(dbValue);
    return dbValue as unknown as Meeting;
  }

  async findByHostId(hostId: string): Promise<Meeting[]> {
    const result = await dbClient.select()
      .from(meetingsTable)
      .where(eq(meetingsTable.hostId, hostId))
      .orderBy(asc(meetingsTable.scheduledAt));
      
    return result as unknown as Meeting[];
  }

  async findByHostIdPaginated(hostId: string, pagination: PaginationParams): Promise<{ items: Meeting[]; total: number }> {
    const [items, totalRows] = await Promise.all([
      dbClient.select()
        .from(meetingsTable)
        .where(eq(meetingsTable.hostId, hostId))
        .orderBy(asc(meetingsTable.scheduledAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      dbClient.select({ value: count() })
        .from(meetingsTable)
        .where(eq(meetingsTable.hostId, hostId)),
    ]);

    return {
      items: items as unknown as Meeting[],
      total: Number(totalRows[0]?.value ?? 0),
    };
  }

  async findById(id: string): Promise<Meeting | null> {
    const result = await dbClient.select()
      .from(meetingsTable)
      .where(eq(meetingsTable.id, id))
      .limit(1);
      
    return (result[0] as Meeting) || null;
  }

  async findTranscripts(meetingId: string): Promise<MeetingTranscript[]> {
    const result = await dbClient.select()
      .from(transcriptsTable)
      .where(eq(transcriptsTable.meetingId, meetingId))
      .orderBy(asc(transcriptsTable.createdAt));
      
    return result as unknown as MeetingTranscript[];
  }

  async findTranscriptsPaginated(meetingId: string, pagination: PaginationParams): Promise<{ items: MeetingTranscript[]; total: number }> {
    const [items, totalRows] = await Promise.all([
      dbClient.select()
        .from(transcriptsTable)
        .where(eq(transcriptsTable.meetingId, meetingId))
        .orderBy(asc(transcriptsTable.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      dbClient.select({ value: count() })
        .from(transcriptsTable)
        .where(eq(transcriptsTable.meetingId, meetingId)),
    ]);

    return {
      items: items as unknown as MeetingTranscript[],
      total: Number(totalRows[0]?.value ?? 0),
    };
  }

  async findTranscriptSummariesByHostId(hostId: string): Promise<MeetingTranscriptSummary[]> {
    const result = await dbClient.select({
      meetingId: transcriptsTable.meetingId,
      originalText: transcriptsTable.originalText,
      sourceLang: transcriptsTable.sourceLang,
      targetLang: transcriptsTable.targetLang,
    })
      .from(transcriptsTable)
      .innerJoin(meetingsTable, eq(transcriptsTable.meetingId, meetingsTable.id))
      .where(eq(meetingsTable.hostId, hostId));

    return result as MeetingTranscriptSummary[];
  }

  async countByHostId(hostId: string): Promise<number> {
    const result = await dbClient.select({ value: count() })
      .from(meetingsTable)
      .where(eq(meetingsTable.hostId, hostId));

    return Number(result[0]?.value ?? 0);
  }

  async findTranscriptsByHostId(hostId: string): Promise<MeetingTranscript[]> {
    const result = await dbClient.select({
      id: transcriptsTable.id,
      meetingId: transcriptsTable.meetingId,
      speakerName: transcriptsTable.speakerName,
      originalText: transcriptsTable.originalText,
      translatedText: transcriptsTable.translatedText,
      sourceLang: transcriptsTable.sourceLang,
      targetLang: transcriptsTable.targetLang,
      latency: transcriptsTable.latency,
      createdAt: transcriptsTable.createdAt,
    })
      .from(transcriptsTable)
      .innerJoin(meetingsTable, eq(transcriptsTable.meetingId, meetingsTable.id))
      .where(eq(meetingsTable.hostId, hostId))
      .orderBy(asc(transcriptsTable.createdAt));

    return result as MeetingTranscript[];
  }

  async createTranscript(transcript: MeetingTranscript): Promise<void> {
    await dbClient.insert(transcriptsTable).values(transcript);
  }

  async updateStatus(id: string, status: 'scheduled' | 'completed'): Promise<void> {
    await dbClient.update(meetingsTable)
      .set({ status })
      .where(eq(meetingsTable.id, id));
  }
}
export default MeetingRepository;
