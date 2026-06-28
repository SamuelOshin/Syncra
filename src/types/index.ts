export interface TranslationRequest {
  roomId: string;
  text: string;
  sourceLang: 'en' | 'fr';
  targetLang: 'en' | 'fr';
  speakerName: string;
}

export interface CaptionPayload {
  speakerId: string;
  speakerName: string;
  originalText: string;
  translatedText: string;
  sourceLang: 'en' | 'fr';
  targetLang: 'en' | 'fr';
  latency: string;
}

export interface SignalingPayload<T> {
  to: string;
  from?: string;
  offer?: T;
  answer?: T;
  candidate?: T;
}
