import config from '../../config';

export interface TranslationProvider {
  readonly name: string;
  translate(text: string, sourceLang: string, targetLang: string, userId?: string): Promise<string>;
  isConfigured(): boolean;
}

// ==========================================
// 1. DEEPL TRANSLATION PROVIDER
// ==========================================
export class DeepLProvider implements TranslationProvider {
  readonly name = 'deepl';

  isConfigured(): boolean {
    return !!config.deeplApiKey;
  }

  async translate(text: string, sourceLang: string, targetLang: string): Promise<string> {
    if (sourceLang.toLowerCase() === 'pcm' || targetLang.toLowerCase() === 'pcm') {
      throw new Error('DeepL does not support Nigerian Pidgin (pcm) translation.');
    }

    const key = config.deeplApiKey;
    if (!key) throw new Error('DeepL API key not configured');

    // DeepL requires specific regional codes for English and Portuguese targets
    const mapLang = (lang: string): string => {
      const l = lang.toLowerCase();
      if (l === 'en') return 'EN-US';
      if (l === 'pt') return 'PT-BR';
      return l.toUpperCase();
    };

    const isFreeKey = key.endsWith(':fx');
    const url = isFreeKey ? 'https://api-free.deepl.com/v2/translate' : 'https://api.deepl.com/v2/translate';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: [text],
        source_lang: sourceLang.toUpperCase(),
        target_lang: mapLang(targetLang),
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`DeepL API error: ${response.status} - ${errText}`);
    }

    const data: any = await response.json();
    if (data.translations && data.translations[0]) {
      return data.translations[0].text;
    }
    throw new Error('Invalid DeepL API response format');
  }
}

// ==========================================
// 2. GOOGLE TRANSLATE PROVIDER
// ==========================================
export class GoogleTranslateProvider implements TranslationProvider {
  readonly name = 'google';

  isConfigured(): boolean {
    return !!config.googleTranslateApiKey;
  }

  async translate(text: string, sourceLang: string, targetLang: string): Promise<string> {
    const key = config.googleTranslateApiKey;
    if (!key) throw new Error('Google Translate API key not configured');

    const url = `https://translation.googleapis.com/language/translate/v2?key=${key}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: text,
        source: sourceLang,
        target: targetLang,
        format: 'text',
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google Translate API error: ${response.status} - ${errText}`);
    }

    const data: any = await response.json();
    if (data.data && data.data.translations && data.data.translations[0]) {
      return data.data.translations[0].translatedText;
    }
    throw new Error('Invalid Google Translate API response format');
  }
}

// ==========================================
// 3. OPENROUTER LLM PROVIDER (Refactored)
// ==========================================
export class OpenRouterLLMProvider implements TranslationProvider {
  readonly name = 'openrouter';

  isConfigured(): boolean {
    return !!config.openRouterApiKey;
  }

  async translate(text: string, sourceLang: string, targetLang: string): Promise<string> {
    const key = config.openRouterApiKey;
    if (!key) throw new Error('OpenRouter API key not configured');

    const languageNames: Record<string, string> = {
      en: 'English',
      fr: 'French',
      es: 'Spanish',
      de: 'German',
      ja: 'Japanese',
      pt: 'Portuguese',
      it: 'Italian',
      nl: 'Dutch',
      zh: 'Chinese',
      ru: 'Russian',
      ar: 'Arabic',
      hi: 'Hindi',
      ko: 'Korean',
      pcm: 'Nigerian Pidgin'
    };

    const sourceName = languageNames[sourceLang] || sourceLang;
    const targetName = languageNames[targetLang] || targetLang;

    let prompt = `You are a professional, real-time translator. Translate the following text from ${sourceName} into natural, fluent ${targetName}. `;
    if (sourceLang === 'fr') {
      prompt += "Note that the spoken French may contain West African/Beninese French phrasing, accents, or local terminology. ";
    }
    if (sourceLang === 'pcm') {
      prompt += "Note that the input is in Nigerian Pidgin English. Translate Pidgin English terms, syntax, and grammar accurately and contextually into fluent, natural-sounding target language. ";
    }
    prompt += `Output ONLY the ${targetName} translation. Do not add explanations, notes, quotes, or any conversational filler.`;

    const response = await fetch(config.openRouterApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/google-deepmind/antigravity',
        'X-Title': 'LingoMeet',
      },
      body: JSON.stringify({
        model: config.modelName,
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: text },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errText}`);
    }

    const data: any = await response.json();
    if (data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content.trim();
    }
    throw new Error('Invalid OpenRouter API response format');
  }
}
