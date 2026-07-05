import { Server, Socket } from 'socket.io';
import { sttService } from '../services/stt/stt.service';
import { translationManager } from '../services/translation/translation.manager';
import { MeetingRepository } from '../modules/meeting/meeting.repository';
import { AudioStreamStartPayload, CaptionPayload } from '../types';

const meetingRepository = new MeetingRepository();

export default (io: Server, socket: Socket): void => {
  let chunkCount = 0;

  // Handle audio stream start
  socket.on('audio-stream-start', async (data: AudioStreamStartPayload & { targetLanguage?: string }) => {
    const { roomId, language, speakerName, targetLanguage } = data;
    console.log(`[STT Socket] audio-stream-start received: roomId=${roomId}, lang=${language}, speaker=${speakerName}, targetLanguage=${targetLanguage}`);
    
    if (!roomId || !language || !speakerName) {
      console.warn(`[STT Socket] Missing required fields in audio-stream-start payload`);
      return;
    }

    const roomIdNormalized = roomId.toLowerCase();

    // Verify the meeting exists (Zero-Trust)
    const meeting = await meetingRepository.findById(roomIdNormalized);
    if (!meeting) {
      console.warn(`[STT Socket] Meeting ${roomIdNormalized} not found in database.`);
      return;
    }
    if (meeting.status === 'completed') {
      console.warn(`[STT Socket] Meeting ${roomIdNormalized} is already completed.`);
      return;
    }

    const hostId = meeting.hostId;
    const projectId = (meeting as any).projectId;
    chunkCount = 0; // Reset chunk count

    // Start Deepgram session with transcript callback
    try {
      await sttService.startSession(socket.id, roomIdNormalized, language, speakerName, async (text, isFinal) => {
        console.log(`[STT Socket] Transcript from Deepgram: "${text}" (isFinal: ${isFinal})`);
        
        if (!isFinal) {
          // Send interim transcript only to the speaker
          socket.emit('interim-caption', { text, speakerName });
          return;
        }

        // Final transcript — translate and broadcast
        const startTime = Date.now();
        const targetLang = targetLanguage || (language === 'en' ? 'fr' : 'en');
        console.log(`[STT Socket] Translating final transcript: "${text}" from ${language} to ${targetLang}`);
        
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
    if (!data) return;
    
    // Log once every 100 chunks to avoid flooding logs while proving data is flowing
    chunkCount++;
    if (chunkCount === 1 || chunkCount % 100 === 0) {
      console.log(`[STT Socket] Received ${chunkCount} audio chunks from socket: ${socket.id} (Bytes: ${data.byteLength})`);
    }

    if (!sttService.hasSession(socket.id)) {
      if (chunkCount === 1 || chunkCount % 100 === 0) {
        console.warn(`[STT Socket] Received audio chunk but no active session exists for socket: ${socket.id}`);
      }
      return;
    }

    try {
      sttService.feedAudio(socket.id, Buffer.from(data));
    } catch (err) {
      console.error(`[STT] Error feeding audio for socket ${socket.id}:`, err);
    }
  });

  // Handle audio stream stop
  socket.on('audio-stream-stop', () => {
    console.log(`[STT Socket] audio-stream-stop received for socket: ${socket.id}`);
    sttService.stopSession(socket.id);
  });

  // Clean up on disconnect
  socket.on('disconnect', () => {
    console.log(`[STT Socket] disconnect received for socket: ${socket.id}`);
    sttService.stopSession(socket.id);
  });
};
