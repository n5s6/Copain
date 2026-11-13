import { describe, it, expect, vi } from 'vitest';
import { IPC_CHANNELS } from '../../src/shared/ipc-channels';
import {
  ChatMessage,
  SendMessagePayload,
  StreamChunk,
  SaveSettingsResult,
  ElectronAPI,
  DEFAULT_LLM_CONFIG
} from '../../src/shared/types';
import App from '../../src/renderer/src/App';

describe('Milestone 1 Smoke Test & Type Contracts', () => {
  it('executes vitest assertions cleanly', () => {
    expect(true).toBe(true);
    expect(1 + 1).toBe(2);
  });

  describe('IPC Channels Constants', () => {
    it('defines all required IPC channel constants', () => {
      expect(IPC_CHANNELS).toBeDefined();
      expect(IPC_CHANNELS.CHAT_SEND_STREAM).toBe('chat:send-stream');
      expect(IPC_CHANNELS.CHAT_CANCEL_STREAM).toBe('chat:cancel-stream');
      expect(IPC_CHANNELS.CHAT_STREAM_CHUNK).toBe('chat:stream-chunk');
      expect(IPC_CHANNELS.SETTINGS_LOAD).toBe('settings:load');
      expect(IPC_CHANNELS.SETTINGS_SAVE).toBe('settings:save');
    });

    it('freezes IPC_CHANNELS as immutable', () => {
      expect(Object.isFrozen(IPC_CHANNELS)).toBe(true);
    });
  });

  describe('Shared Type Contracts & Default Values', () => {
    it('provides valid DEFAULT_LLM_CONFIG matching LLMConfig contract', () => {
      expect(DEFAULT_LLM_CONFIG).toBeDefined();
      expect(typeof DEFAULT_LLM_CONFIG.baseUrl).toBe('string');
      expect(typeof DEFAULT_LLM_CONFIG.apiKey).toBe('string');
      expect(typeof DEFAULT_LLM_CONFIG.model).toBe('string');
      expect(typeof DEFAULT_LLM_CONFIG.systemPrompt).toBe('string');
    });

    it('correctly structures ChatMessage objects', () => {
      const userMsg: ChatMessage = {
        role: 'user',
        content: 'Hello world',
        timestamp: Date.now()
      };
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: 'Hello! How can I help you?',
        timestamp: Date.now()
      };
      const systemMsg: ChatMessage = {
        role: 'system',
        content: 'You are a helpful assistant.'
      };

      expect(userMsg.role).toBe('user');
      expect(userMsg.content).toBe('Hello world');
      expect(userMsg.timestamp).toBeGreaterThan(0);

      expect(assistantMsg.role).toBe('assistant');
      expect(systemMsg.role).toBe('system');
      expect(systemMsg.timestamp).toBeUndefined();
    });

    it('correctly structures SendMessagePayload objects', () => {
      const payload: SendMessagePayload = {
        config: {
          baseUrl: 'http://127.0.0.1:3000/v1',
          apiKey: 'test-key',
          model: 'gpt-3.5-turbo',
          systemPrompt: 'Be concise'
        },
        messages: [{ role: 'user', content: 'What is 2+2?' }]
      };

      expect(payload.config.baseUrl).toBe('http://127.0.0.1:3000/v1');
      expect(payload.messages).toHaveLength(1);
      expect(payload.messages[0].role).toBe('user');
    });

    it('correctly structures StreamChunk objects', () => {
      const tokenChunk: StreamChunk = {
        token: '4',
        isDone: false
      };
      const doneChunk: StreamChunk = {
        token: '',
        isDone: true
      };
      const errorChunk: StreamChunk = {
        isDone: true,
        error: 'Network connection lost'
      };

      expect(tokenChunk.token).toBe('4');
      expect(tokenChunk.isDone).toBe(false);
      expect(doneChunk.isDone).toBe(true);
      expect(errorChunk.error).toBe('Network connection lost');
    });
  });

  describe('ElectronAPI Interface Mock Verification', () => {
    it('allows clean implementation of ElectronAPI matching contract', async () => {
      const onChunkMock = vi.fn();
      const cancelMock = vi.fn().mockResolvedValue(undefined);
      const loadMock = vi.fn().mockResolvedValue(DEFAULT_LLM_CONFIG);
      const saveMock = vi.fn().mockResolvedValue({ success: true } as SaveSettingsResult);

      const mockApi: ElectronAPI = {
        sendChatStream: vi.fn((_payload, onChunk) => {
          onChunk({ token: 'test', isDone: false });
          onChunk({ isDone: true });
          return () => {};
        }),
        cancelChatStream: cancelMock,
        loadSettings: loadMock,
        saveSettings: saveMock
      };

      const cleanup = mockApi.sendChatStream(
        { config: DEFAULT_LLM_CONFIG, messages: [{ role: 'user', content: 'hi' }] },
        onChunkMock
      );
      expect(typeof cleanup).toBe('function');
      cleanup();

      expect(onChunkMock).toHaveBeenCalledTimes(2);
      expect(onChunkMock).toHaveBeenNthCalledWith(1, { token: 'test', isDone: false });
      expect(onChunkMock).toHaveBeenNthCalledWith(2, { isDone: true });

      const loadedSettings = await mockApi.loadSettings();
      expect(loadedSettings).toEqual(DEFAULT_LLM_CONFIG);

      const saveResult = await mockApi.saveSettings(DEFAULT_LLM_CONFIG);
      expect(saveResult).toEqual({ success: true });

      await mockApi.cancelChatStream();
      expect(cancelMock).toHaveBeenCalled();
    });
  });

  describe('Renderer App Component Export', () => {
    it('exports App as a valid React functional component', () => {
      expect(App).toBeDefined();
      expect(typeof App).toBe('function');
    });
  });
});
