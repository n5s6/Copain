import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import { DEFAULT_LLM_CONFIG, LLMConfig, SaveSettingsResult } from '../../shared/types';

export class SettingsService {
  private readonly filePath: string;
  private cachedSettings: LLMConfig | null = null;

  constructor(userDataDir: string) {
    this.filePath = join(userDataDir, 'settings.json');
  }

  public async load(): Promise<LLMConfig> {
    if (this.cachedSettings) {
      return { ...this.cachedSettings };
    }

    try {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<LLMConfig>;
      this.cachedSettings = {
        baseUrl: typeof parsed.baseUrl === 'string' ? parsed.baseUrl : DEFAULT_LLM_CONFIG.baseUrl,
        apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : DEFAULT_LLM_CONFIG.apiKey,
        model: typeof parsed.model === 'string' ? parsed.model : DEFAULT_LLM_CONFIG.model,
        systemPrompt:
          typeof parsed.systemPrompt === 'string'
            ? parsed.systemPrompt
            : DEFAULT_LLM_CONFIG.systemPrompt,
        language: parsed.language === 'en' ? 'en' : 'fr'
      };
      return { ...this.cachedSettings };
    } catch {
      this.cachedSettings = { ...DEFAULT_LLM_CONFIG };
      return { ...this.cachedSettings };
    }
  }

  public async save(settings: LLMConfig): Promise<SaveSettingsResult> {
    try {
      const sanitized: LLMConfig = {
        baseUrl: typeof settings.baseUrl === 'string' ? settings.baseUrl.trim() : '',
        apiKey: typeof settings.apiKey === 'string' ? settings.apiKey.trim() : '',
        model: typeof settings.model === 'string' ? settings.model.trim() : '',
        systemPrompt: typeof settings.systemPrompt === 'string' ? settings.systemPrompt : '',
        language: settings.language === 'en' ? 'en' : 'fr'
      };

      await fs.mkdir(dirname(this.filePath), { recursive: true });
      await fs.writeFile(this.filePath, JSON.stringify(sanitized, null, 2), 'utf-8');
      this.cachedSettings = sanitized;
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Erreur lors de la sauvegarde des paramètres.'
      };
    }
  }
}

