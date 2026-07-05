export type SupportedLanguage = 'en' | 'fr' | 'es' | 'de' | 'ja' | 'pcm';

export interface TranslationRequest {
  roomId: string;
  text: string;
  sourceLang: SupportedLanguage;
  targetLang: SupportedLanguage;
  speakerName: string;
}

export interface CaptionPayload {
  speakerId: string;
  speakerName: string;
  originalText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  latency: string;
}

export interface SignalingPayload<T> {
  to: string;
  from?: string;
  offer?: T;
  answer?: T;
  candidate?: T;
}

export interface AudioStreamStartPayload {
  roomId: string;
  language: string;
  speakerName: string;
}
