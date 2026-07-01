import { DeepgramClient } from '@deepgram/sdk';
import config from '../../config';

export class DeepgramSTTService {
  private sessions = new Map<
    string,
    {
      connection: any;
      roomId: string;
      speakerName: string;
      language: string;
    }
  >();

  /**
   * Starts a new streaming transcription session for a socket client.
   */
  public async startSession(
    socketId: string,
    roomId: string,
    language: string,
    speakerName: string,
    onTranscript: (text: string, isFinal: boolean) => void
  ): Promise<void> {
    if (this.sessions.has(socketId)) {
      this.stopSession(socketId);
    }

    if (!config.hasDeepgram) {
      throw new Error('Deepgram API Key is not configured on the server.');
    }

    const deepgram = new DeepgramClient({ apiKey: config.deepgramApiKey });

    // Map locales to Deepgram supported languages
    const langMapping: Record<string, string> = {
      en: 'en-US',
      fr: 'fr',
      es: 'es',
      de: 'de',
      ja: 'ja'
    };
    const dgLanguage = langMapping[language] || 'en-US';

    console.log(`[STT] Opening Deepgram connection for ${speakerName} (Language: ${dgLanguage})`);

    try {
      const connection = await deepgram.listen.v1.connect({
        model: 'nova-3',
        language: dgLanguage,
        encoding: 'linear16',
        sample_rate: 16000,
        channels: 1,
        interim_results: 'true',
        utterance_end_ms: 1500,
        smart_format: 'true'
      });

      connection.on('open', () => {
        console.log(`[STT] Deepgram connection opened for socket: ${socketId}`);
      });

      connection.on('message', (data: any) => {
        if (data.type === 'Results') {
          const transcript = data.channel?.alternatives?.[0]?.transcript || '';
          if (!transcript.trim()) return;

          const isFinal = data.is_final;
          onTranscript(transcript.trim(), isFinal);
        }
      });

      connection.on('error', (error: any) => {
        console.error(`[STT] Deepgram connection error for socket ${socketId}:`, error);
      });

      connection.on('close', () => {
        console.log(`[STT] Deepgram connection closed for socket: ${socketId}`);
        this.sessions.delete(socketId);
      });

      this.sessions.set(socketId, {
        connection,
        roomId,
        speakerName,
        language
      });
    } catch (err) {
      console.error(`[STT] Error establishing Deepgram connection for socket ${socketId}:`, err);
      throw err;
    }
  }

  /**
   * Feeds raw PCM audio chunk to the user's active Deepgram session.
   */
  public feedAudio(socketId: string, audioChunk: Buffer): void {
    const session = this.sessions.get(socketId);
    if (!session) {
      return;
    }

    const { connection } = session;
    if (connection) {
      try {
        connection.sendMedia(audioChunk);
      } catch (err) {
        console.error(`[STT] Error sending audio media for socket ${socketId}:`, err);
      }
    }
  }

  /**
   * Stops and cleans up the Deepgram session for a client.
   */
  public stopSession(socketId: string): void {
    const session = this.sessions.get(socketId);
    if (!session) return;

    console.log(`[STT] Closing Deepgram session for socket: ${socketId}`);
    const { connection } = session;
    try {
      connection.close();
    } catch (err) {
      console.error(`[STT] Error closing Deepgram connection for socket ${socketId}:`, err);
    }

    this.sessions.delete(socketId);
  }

  /**
   * Checks if a socket has an active streaming session.
   */
  public hasSession(socketId: string): boolean {
    return this.sessions.has(socketId);
  }
}

export const sttService = new DeepgramSTTService();
export default sttService;
