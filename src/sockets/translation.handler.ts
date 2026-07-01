import { Server, Socket } from 'socket.io';
import translationService from '../services/translation.service';
import { TranslationRequest, CaptionPayload } from '../types';
import { MeetingRepository } from '../modules/meeting/meeting.repository';

const meetingRepository = new MeetingRepository();
const transcriptThrottle = new Map<string, number[]>();
const THROTTLE_WINDOW_MS = 60 * 1000;
const MAX_TRANSCRIPTS_PER_WINDOW = 30;

function isTranscriptRateLimited(socketId: string, roomId: string): boolean {
  const key = `${socketId}:${roomId}`;
  const now = Date.now();
  const recent = (transcriptThrottle.get(key) || []).filter(timestamp => now - timestamp < THROTTLE_WINDOW_MS);

  if (recent.length >= MAX_TRANSCRIPTS_PER_WINDOW) {
    transcriptThrottle.set(key, recent);
    return true;
  }

  recent.push(now);
  transcriptThrottle.set(key, recent);
  return false;
}

export default (io: Server, socket: Socket): void => {
  socket.on('send-transcript', async ({ roomId, text, sourceLang, targetLang, speakerName }: TranslationRequest) => {
    if (!roomId || !text || !sourceLang || !targetLang || !speakerName) {
      console.warn(`Socket ${socket.id} sent an invalid transcript payload.`);
      return;
    }

    const roomIdNormalized = roomId.toLowerCase();

    if (isTranscriptRateLimited(socket.id, roomIdNormalized)) {
      socket.emit('translation-rate-limited', {
        message: 'Too many transcript messages. Please wait a moment and try again.',
        errorCode: 'RATE_LIMIT_EXCEEDED',
      });
      return;
    }

    console.log(`Transcript received from ${speakerName} (${sourceLang}): "${text}"`);
    
    const startTime = Date.now();
    const meeting = await meetingRepository.findById(roomIdNormalized);
    const hostId = meeting ? meeting.hostId : undefined;
    const projectId = meeting ? (meeting as any).projectId : undefined;
    const translation = await translationService.translate(text, sourceLang, targetLang, hostId, projectId);
    const latency = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`Translation (${targetLang}): "${translation}" [Latency: ${latency}s]`);

    const caption: CaptionPayload = {
      speakerId: socket.id,
      speakerName,
      originalText: text,
      translatedText: translation,
      sourceLang,
      targetLang,
      latency
    };

    io.to(roomIdNormalized).emit('new-caption', caption);

    meetingRepository.createTranscript({
      meetingId: roomIdNormalized,
      speakerName,
      originalText: text,
      translatedText: translation,
      sourceLang,
      targetLang,
      latency
    }).catch(err => {
      console.error(`Failed to persist transcript segment for room ${roomIdNormalized}:`, err);
    });
  });

  socket.on('disconnect', () => {
    for (const key of transcriptThrottle.keys()) {
      if (key.startsWith(`${socket.id}:`)) {
        transcriptThrottle.delete(key);
      }
    }
  });
};
