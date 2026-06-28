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
  public readonly livekitUrl: string;
  public readonly livekitApiKey: string;
  public readonly livekitApiSecret: string;
  public readonly hasLiveKit: boolean;

  constructor() {
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

    const secret = process.env.SESSION_SECRET;
    if (!secret && process.env.NODE_ENV === 'production') {
      throw new Error("FATAL: SESSION_SECRET is required in production mode.");
    }
    this.sessionSecret = secret || 'syncra-local-development-secret-key';

    this.livekitUrl = process.env.LIVEKIT_URL || '';
    this.livekitApiKey = process.env.LIVEKIT_API_KEY || '';
    this.livekitApiSecret = process.env.LIVEKIT_API_SECRET || '';
    this.hasLiveKit = !!(this.livekitUrl && this.livekitApiKey && this.livekitApiSecret);

    if (this.hasLiveKit) {
      console.log("[Config] LiveKit Cloud is configured. Using LiveKit as primary media engine.");
    } else {
      console.log("[Config] LiveKit credentials not found. Falling back to local P2P WebRTC Mesh.");
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
