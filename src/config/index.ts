import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

class Config {
  public readonly port: number;
  public readonly openRouterApiKey: string;
  public readonly openRouterApiUrl: string;
  public readonly modelName: string;
  public readonly databaseUrl: string | undefined;
  public readonly sessionSecret: string;
  public readonly jwtAccessSecret: string;
  public readonly jwtRefreshSecret: string;
  public readonly jwtAccessExpiresIn: string;
  public readonly jwtRefreshExpiresIn: string;
  public readonly livekitUrl: string;
  public readonly livekitApiKey: string;
  public readonly livekitApiSecret: string;
  public readonly hasLiveKit: boolean;
  public readonly deeplApiKey: string;
  public readonly googleTranslateApiKey: string;
  public readonly primaryTranslationProvider: string;
  public readonly translationFallbackChain: string;
  public readonly deepgramApiKey: string;
  public readonly hasDeepgram: boolean;
  public readonly requireEmailVerification: boolean;
  public readonly resendApiKey: string;
  public readonly emailFrom: string;

  get vapidPublicKey(): string {
    return process.env.VAPID_PUBLIC_KEY || '';
  }

  get vapidPrivateKey(): string {
    return process.env.VAPID_PRIVATE_KEY || '';
  }

  get vapidSubject(): string {
    return process.env.VAPID_SUBJECT || 'mailto:support@syncra.app';
  }

  constructor() {
    this.requireEmailVerification = process.env.REQUIRE_EMAIL_VERIFICATION === 'true';
    this.resendApiKey = process.env.RESEND_API_KEY || '';
    this.emailFrom = process.env.EMAIL_FROM || 'Syncra <onboarding@resend.dev>';
    this.port = this.normalizePort(process.env.PORT || '3000');
    
    // Fail-fast in production if API key is missing
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey && process.env.NODE_ENV === 'production') {
      throw new Error("FATAL: OPENROUTER_API_KEY is required in production mode.");
    }
    
    this.openRouterApiKey = apiKey || '';
    this.openRouterApiUrl = process.env.OPENROUTER_API_URL || "https://openrouter.ai/api/v1/chat/completions";
    this.modelName = process.env.MODEL_NAME || "google/gemini-2.5-flash";
    this.databaseUrl = process.env.DATABASE_URL;

    // Translation Config
    this.deeplApiKey = process.env.DEEPL_API_KEY || '';
    this.googleTranslateApiKey = process.env.GOOGLE_TRANSLATE_API_KEY || '';
    this.primaryTranslationProvider = process.env.PRIMARY_TRANSLATION_PROVIDER || 'deepl';
    this.translationFallbackChain = process.env.TRANSLATION_FALLBACK_CHAIN || 'google,openrouter';

    const secret = process.env.SESSION_SECRET;
    if (!secret && process.env.NODE_ENV === 'production') {
      throw new Error("FATAL: SESSION_SECRET is required in production mode.");
    }
    this.sessionSecret = secret || 'syncra-local-development-secret-key';

    // JWT Configuration
    const accessSecret = process.env.JWT_ACCESS_SECRET;
    if (!accessSecret && process.env.NODE_ENV === 'production') {
      throw new Error("FATAL: JWT_ACCESS_SECRET is required in production mode.");
    }
    this.jwtAccessSecret = accessSecret || 'syncra-local-jwt-access-secret-key-12345';

    const refreshSecret = process.env.JWT_REFRESH_SECRET;
    if (!refreshSecret && process.env.NODE_ENV === 'production') {
      throw new Error("FATAL: JWT_REFRESH_SECRET is required in production mode.");
    }
    this.jwtRefreshSecret = refreshSecret || 'syncra-local-jwt-refresh-secret-key-67890';

    this.jwtAccessExpiresIn = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
    this.jwtRefreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

    this.livekitUrl = process.env.LIVEKIT_URL || '';
    this.livekitApiKey = process.env.LIVEKIT_API_KEY || '';
    this.livekitApiSecret = process.env.LIVEKIT_API_SECRET || '';
    this.hasLiveKit = !!(this.livekitUrl && this.livekitApiKey && this.livekitApiSecret);

    if (this.hasLiveKit) {
      console.log("[Config] LiveKit Cloud is configured. Using LiveKit as primary media engine.");
    } else {
      console.log("[Config] LiveKit credentials not found. Falling back to local P2P WebRTC Mesh.");
    }

    this.deepgramApiKey = process.env.DEEPGRAM_API_KEY || '';
    this.hasDeepgram = !!this.deepgramApiKey;

    if (this.hasDeepgram) {
      console.log('[Config] Deepgram is configured. Server-side STT enabled.');
      this.validateDeepgramKey();
    } else {
      console.log('[Config] Deepgram not configured. Falling back to client-side Web Speech API.');
    }
  }

  private async validateDeepgramKey(): Promise<void> {
    try {
      const response = await fetch('https://api.deepgram.com/v1/projects', {
        headers: {
          'Authorization': `Token ${this.deepgramApiKey}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data: any = await response.json();
        const projectNames = data.projects?.map((p: any) => p.name).join(', ') || 'None';
        console.log(`[Config] Deepgram API key is VALID. Access to projects: [${projectNames}]`);
      } else {
        const text = await response.text();
        console.error(`[Config] Deepgram API key is INVALID. Status: ${response.status}. Error: ${text}`);
      }
    } catch (err: any) {
      console.error(`[Config] Deepgram API key verification failed network check: ${err.message || err}`);
    }
  }

  private normalizePort(val: string): number {
    const port = parseInt(val, 10);
    if (isNaN(port)) return 3000;
    if (port >= 0) return port;
    return 3000;
  }
}

export const config = new Config();
export default config;
