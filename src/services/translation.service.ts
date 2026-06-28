import config from '../config';
import { GlossaryRepository } from '../modules/glossary/glossary.repository';
import { TranslationMemoryRepository } from '../modules/translation-memory/tm.repository';
import { randomUUID } from 'crypto';

class TranslationService {
  private readonly apiKey: string;
  private readonly apiUrl: string;
  private readonly model: string;

  constructor() {
    this.apiKey = config.openRouterApiKey;
    this.apiUrl = config.openRouterApiUrl;
    this.model = config.modelName;
  }

  /**
   * Translates text between French and English.
   * @param text - The text to translate.
   * @param sourceLang - 'fr' or 'en'.
   * @param targetLang - 'fr' or 'en'.
   * @returns The translated text.
   */
  public async translate(
    text: string, 
    sourceLang: string, 
    targetLang: string,
    userId?: string,
    projectId?: string
  ): Promise<string> {
    if (!this.apiKey) {
      console.warn("Translation service warning: OPENROUTER_API_KEY is not configured.");
      return "[Translation Error: API Key missing on server]";
    }

    const normalizedText = text.trim().toLowerCase();
    const tmRepository = new TranslationMemoryRepository();

    // 1. Check Translation Memory first (Exact Match)
    if (userId) {
      try {
        const match = await tmRepository.findExactMatch(userId, normalizedText, sourceLang, targetLang, projectId);
        if (match) {
          console.log(`[TranslationMemory] Match found! Reusing translation: "${match.targetText}"`);
          return match.targetText;
        }
      } catch (err) {
        console.error('[TranslationMemory] Error querying exact match:', err);
      }
    }

    let glossaryTermsText = '';
    if (userId) {
      try {
        const glossaryRepository = new GlossaryRepository();
        const activeTerms = await glossaryRepository.findActiveTerms(userId, sourceLang, targetLang, projectId);
        
        if (activeTerms.length > 0) {
          glossaryTermsText = "\n\nCRITICAL: You must strictly follow these glossary term mappings during translation:\n" + 
            activeTerms.map(t => `- "${t.sourceText}" must be translated exactly as "${t.targetText}" (do not translate it differently).`).join('\n');
        }
      } catch (err) {
        console.error('Failed to fetch glossary terms for translation:', err);
      }
    }

    const systemPrompt = this.getSystemPrompt(sourceLang, targetLang, glossaryTermsText);

    try {
      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://github.com/google-deepmind/antigravity",
          "X-Title": "LingoMeet"
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: text }
          ],
          temperature: 0.3
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`OpenRouter API error: ${response.status} - ${errorText}`);
        return `[Translation Error: HTTP ${response.status}]`;
      }

      const data: any = await response.json();
      if (data.choices && data.choices[0] && data.choices[0].message) {
        const translation = data.choices[0].message.content.trim();

        // Asynchronously cache the translation in Translation Memory
        if (userId && !translation.startsWith('[Translation Error')) {
          tmRepository.create({
            id: randomUUID(),
            userId,
            sourceText: normalizedText,
            targetText: translation,
            sourceLang,
            targetLang,
            projectId: projectId || null
          }).catch(err => console.error('[TranslationMemory] Failed to cache segment:', err));
        }

        return translation;
      }

      console.error("OpenRouter response format error:", data);
      return "[Translation Error: Invalid response format]";
    } catch (error) {
      console.error("Translation API call failed:", error);
      return "[Translation Error: Connection failed]";
    }
  }

  /**
   * Generates localized system prompt for translation.
   * @private
   */
  private getSystemPrompt(sourceLang: string, targetLang: string, glossaryTermsText: string = ''): string {
    const languageNames: Record<string, string> = {
      en: 'English',
      fr: 'French',
      es: 'Spanish',
      de: 'German',
      ja: 'Japanese'
    };

    const sourceName = languageNames[sourceLang] || sourceLang;
    const targetName = languageNames[targetLang] || targetLang;

    let prompt = `You are a professional, real-time translator. Translate the following spoken ${sourceName} into natural, fluent ${targetName}. `;
    
    if (sourceLang === 'fr') {
      prompt += "Note that the spoken French may contain West African/Beninese French phrasing, accents, or local terminology. ";
    }
    
    prompt += `Output ONLY the ${targetName} translation. Do not add explanations, notes, quotes, or any conversational filler.`;

    if (glossaryTermsText) {
      prompt += glossaryTermsText;
    }
    return prompt;
  }
}

export const translationService = new TranslationService();
export default translationService;

