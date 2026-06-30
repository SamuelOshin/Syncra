import { DeepLProvider, GoogleTranslateProvider, OpenRouterLLMProvider, TranslationProvider } from './translation.providers';
import { TranslationMemoryRepository } from '../../modules/translation-memory/tm.repository';
import { randomUUID } from 'crypto';
import config from '../../config';

export class TranslationManager {
  private readonly providers: Record<string, TranslationProvider> = {
    deepl: new DeepLProvider(),
    google: new GoogleTranslateProvider(),
    openrouter: new OpenRouterLLMProvider(),
  };

  private readonly fallbackChain: string[];
  private readonly cooldowns = new Map<string, number>();
  private readonly tmRepository = new TranslationMemoryRepository();

  constructor() {
    // Read fallback chain from environment. Default: deepl -> google -> openrouter
    const primary = config.primaryTranslationProvider || 'deepl';
    const fallbacks = config.translationFallbackChain || 'google,openrouter';
    
    this.fallbackChain = [
      primary.toLowerCase(),
      ...fallbacks.split(',').map(p => p.trim().toLowerCase())
    ];

    // Remove duplicates while preserving order
    this.fallbackChain = Array.from(new Set(this.fallbackChain));
    console.log(`[TranslationManager] Initialized with fallback chain: ${this.fallbackChain.join(' -> ')}`);
  }

  /**
   * Translates text between languages with fallback and caching.
   */
  public async translate(
    text: string,
    sourceLang: string,
    targetLang: string,
    userId?: string,
    projectId?: string
  ): Promise<string> {
    const normalizedText = text.trim();
    if (!normalizedText) return '';

    // 1. Check Translation Memory (Cache) first
    if (userId) {
      try {
        const match = await this.tmRepository.findExactMatch(
          userId,
          normalizedText.toLowerCase(),
          sourceLang,
          targetLang,
          projectId
        );
        if (match) {
          console.log(`[TranslationMemory] Cache hit: "${match.targetText}"`);
          return match.targetText;
        }
      } catch (err) {
        console.error('[TranslationMemory] Error querying cache:', err);
      }
    }

    // 2. Iterate through fallback chain
    for (const providerName of this.fallbackChain) {
      const provider = this.providers[providerName];
      if (!provider || !provider.isConfigured()) {
        continue;
      }

      // Check if provider is on cooldown
      const cooldownUntil = this.cooldowns.get(providerName) || 0;
      if (Date.now() < cooldownUntil) {
        console.warn(`[TranslationManager] Skipping provider ${providerName} (on cooldown)`);
        continue;
      }

      try {
        console.log(`[TranslationManager] Attempting translation using ${providerName}...`);
        const translation = await provider.translate(normalizedText, sourceLang, targetLang, userId);
        
        // Cache the successful translation asynchronously
        if (userId) {
          this.tmRepository.create({
            id: randomUUID(),
            userId,
            sourceText: normalizedText.toLowerCase(),
            targetText: translation,
            sourceLang,
            targetLang,
            projectId: projectId || null
          }).catch(err => console.error('[TranslationMemory] Failed to cache segment:', err));
        }

        return translation;
      } catch (err: any) {
        console.error(`[TranslationManager] Provider ${providerName} failed:`, err.message);
        // Set a 60-second cooldown for this provider
        this.cooldowns.set(providerName, Date.now() + 60000);
      }
    }

    // 3. UX Fallback: If all providers fail, return the original text
    console.error('[TranslationManager] All translation providers failed. Returning original text.');
    return text;
  }
}

export const translationManager = new TranslationManager();
export default translationManager;
