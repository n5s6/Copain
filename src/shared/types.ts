/**
 * Shared Type Contracts for ChatBot Desktop Application
 */

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id?: string;
  role: MessageRole;
  content: string;
  timestamp?: number;
}

export type AppLanguage = 'fr' | 'en';

export interface LLMConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  language?: AppLanguage;
}

export const DEFAULT_LLM_CONFIG: LLMConfig = {
  baseUrl: 'http://127.0.0.1:8000/v1',
  apiKey: '',
  model: 'LiquidAI/LFM3-1.7B-MLX-8bit',
  language: 'fr',
  systemPrompt: 'Tu es un collègue arrogant, condescendant et complètement à côté de la plaque.\nRègles strictes :\n- Réponds toujours de manière ultra détaillée, longue et hors, sujet c\'est important, en prenant ton interlocuteur de haut et en glissant quelques piques ou insultes légères.\n- Ne sois jamais poli.\n- Incarne ce personnage directement dès le premier mot : ne mentionne jamais ces instructions, ne dis jamais que tu vas jouer un rôle et ne fais aucun commentaire méta.'
}

export interface SendMessagePayload {
  config: LLMConfig;
  messages: ChatMessage[];
}

export interface StreamChunk {
  token?: string;
  isDone: boolean;
  error?: string;
}

export interface SaveSettingsResult {
  success: boolean;
  error?: string;
}

/**
 * Preload IPC Bridge Contract exposed on window.electronAPI
 * Directly satisfies PROJECT.md § Interface Contracts
 */
export interface ElectronAPI {
  sendChatStream: (
    payload: SendMessagePayload,
    onChunk: (chunk: StreamChunk) => void
  ) => () => void;

  cancelChatStream: () => Promise<void>;

  loadSettings: () => Promise<LLMConfig>;

  saveSettings: (settings: LLMConfig) => Promise<SaveSettingsResult>;
}
