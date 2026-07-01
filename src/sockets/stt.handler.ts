import { Server, Socket } from 'socket.io';
import { sttService } from '../services/stt/stt.service';
import { translationManager } from '../services/translation/translation.manager';
import { MeetingRepository } from '../modules/meeting/meeting.repository';
import { AudioStreamStartPayload, CaptionPayload } from '../types';

const meetingRepository = new MeetingRepository();

export default (io: Server, socket: Socket): void => {
  // Handle audio stream start
  socket.on('audio-stream-start', async (data: AudioStreamStartPayload) => {
    const { roomId, language, speakerName } = data;
    if (!roomId || !language || !speakerName) return;

    const roomIdNormalized = roomId.toLowerCase();

    // Verify the meeting exists (Zero-Trust)
    const meeting = await meetingRepository.findById(roomIdNormalized);
    if (!meeting || meeting.status === 'completed') return;

    const hostId = meeting.hostId;
    const projectId = (meeting as any).projectId;

    // Start Deepgram session with transcript callback
    try {
      await sttService.startSession(socket.id, roomIdNormalized, language, speakerName, async (text, isFinal) => {
        if (!isFinal) {
          // Send interim transcript only to the speaker
          socket.emit('interim-caption', { text, speakerName });
          return;
        }

        // Final transcript — translate and broadcast
        const startTime = Date.now();
        const targetLang = language === 'en' ? 'fr' : 'en';
        const translation = await translationManager.translate(text, language, targetLang, hostId, projectId);
        const latency = ((Date.now() - startTime) / 1000).toFixed(2);

        const caption: CaptionPayload = {
          speakerId: socket.id,
          speakerName,
          originalText: text,
          translatedText: translation,
          sourceLang: language,
          targetLang,
          latency
        };

        io.to(roomIdNormalized).emit('new-caption', caption);

        // Persist transcript segment
        meetingRepository.createTranscript({
          meetingId: roomIdNormalized,
          speakerName,
          originalText: text,
          translatedText: translation,
          sourceLang: language,
          targetLang,
          latency
        }).catch(err => console.error(`Failed to persist STT transcript for room ${roomIdNormalized}:`, err));
      });

      console.log(`[STT] Started streaming session for ${speakerName} in room ${roomIdNormalized}`);
    } catch (err) {
      console.error(`[STT] Failed to start session for socket ${socket.id}:`, err);
    }
  });

  // Handle incoming audio chunks
  socket.on('audio-chunk', (data: ArrayBuffer) => {
    if (!data || !sttService.hasSession(socket.id)) return;
    try {
      sttService.feedAudio(socket.id, Buffer.from(data));
    } catch (err) {
      console.error(`[STT] Error feeding audio for socket ${socket.id}:`, err);
    }
  });

  // Handle audio stream stop
  socket.on('audio-stream-stop', () => {
    sttService.stopSession(socket.id);
  });

  // Clean up on disconnect
  socket.on('disconnect', () => {
    sttService.stopSession(socket.id);
  });
};
