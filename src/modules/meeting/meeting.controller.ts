import { Request, Response, NextFunction } from 'express';
import { MeetingRepository } from './meeting.repository';
import { successResponse } from '../../utils/response';
import { NotFoundError, ForbiddenError } from '../../utils/errors';
import config from '../../config';
import { NotificationRepository } from '../notifications/notification.repository';
import { buildPaginationMeta, parsePagination } from '../../utils/pagination';
import { randomUUID } from 'crypto';

const meetingRepository = new MeetingRepository();

function generateRoomCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const rand = (len: number) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${rand(3)}-${rand(4)}-${rand(3)}`;
}

export class MeetingController {
  async createMeeting(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { title, scheduledAt, projectId } = req.body;
      const hostId = req.session.user!.id;
      const roomId = generateRoomCode();

      const newMeeting = await meetingRepository.create({
        id: roomId,
        hostId,
        title,
        scheduledAt,
        status: 'scheduled',
        projectId: projectId || null,
      });

      const notificationRepository = new NotificationRepository();
      await notificationRepository.create({
        id: randomUUID(),
        userId: hostId,
        title: 'Meeting Scheduled',
        message: `Meeting "${title}" has been scheduled for ${new Date(scheduledAt).toLocaleString()}.`,
        type: 'success'
      }).catch(err => console.error('Failed to create notification:', err));

      successResponse(res, 201, 'Meeting scheduled successfully', {
        meeting: newMeeting
      });
    } catch (error) {
      next(error);
    }
  }

  async getMeetings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hostId = req.session.user!.id;
      const pagination = parsePagination(req.query);
      const [{ items: meetings, total }, transcriptSummaries] = await Promise.all([
        meetingRepository.findByHostIdPaginated(hostId, pagination),
        meetingRepository.findTranscriptSummariesByHostId(hostId),
      ]);

      const summariesByMeeting = new Map<string, { languages: Set<string>; wordCount: number }>();
      transcriptSummaries.forEach((summary) => {
        const existing = summariesByMeeting.get(summary.meetingId) || { languages: new Set<string>(), wordCount: 0 };
        existing.languages.add(`${summary.sourceLang.toUpperCase()}->${summary.targetLang.toUpperCase()}`);
        existing.wordCount += summary.originalText.split(/\s+/).filter(Boolean).length;
        summariesByMeeting.set(summary.meetingId, existing);
      });

      const meetingsWithLangs = meetings.map((meeting) => {
        const summary = summariesByMeeting.get(meeting.id);
        return {
          ...meeting,
          languages: summary && summary.languages.size > 0 ? Array.from(summary.languages) : ['EN->FR'],
          wordCount: summary?.wordCount ?? 0,
        };
      });

      successResponse(res, 200, 'Meetings retrieved successfully', {
        meetings: meetingsWithLangs,
        pagination: buildPaginationMeta(pagination, total),
      });
    } catch (error) {
      next(error);
    }
  }

  async getMeetingTranscript(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.session.user!.id;
      const pagination = parsePagination(req.query);
      const meeting = await meetingRepository.findById(id);
      if (!meeting) {
        next(new NotFoundError('Meeting not found', 'MEETING_NOT_FOUND'));
        return;
      }

      if (meeting.hostId !== userId) {
        next(new ForbiddenError('You do not have permission to access this transcript', 'FORBIDDEN_TRANSCRIPT_ACCESS'));
        return;
      }

      const { items: transcripts, total } = await meetingRepository.findTranscriptsPaginated(id, pagination);

      successResponse(res, 200, 'Transcript retrieved successfully', {
        transcripts,
        pagination: buildPaginationMeta(pagination, total),
      });
    } catch (error) {
      next(error);
    }
  }

  async verifyMeeting(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const meeting = await meetingRepository.findById(id);
      if (!meeting) {
        next(new NotFoundError('Meeting room not found', 'MEETING_NOT_FOUND'));
        return;
      }

      successResponse(res, 200, 'Meeting verified successfully', {
        meeting: {
          id: meeting.id,
          title: meeting.title,
          status: meeting.status,
          hostId: meeting.hostId,
          mediaEngine: config.hasLiveKit ? 'livekit' : 'p2p'
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async endMeeting(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.session.user!.id;

      const meeting = await meetingRepository.findById(id);
      if (!meeting) {
        next(new NotFoundError('Meeting not found', 'MEETING_NOT_FOUND'));
        return;
      }

      if (meeting.hostId !== userId) {
        next(new ForbiddenError('Only the host can end this meeting', 'FORBIDDEN_MEETING_END'));
        return;
      }

      await meetingRepository.updateStatus(id, 'completed');

      const io = req.app.get('io');
      if (io) {
        io.to(id).emit('meeting-ended');
        console.log(`Socket broadcast: Meeting ${id} ended by host. Kicking all peers.`);
      }

      successResponse(res, 200, 'Meeting ended successfully', {});
    } catch (error) {
      next(error);
    }
  }
}
export default MeetingController;
