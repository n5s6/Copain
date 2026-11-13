import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  normalizeChatEndpoint,
  prepareMessagesPayload,
  streamChatCompletion
} from '../../src/main/services/openai-client';
import { MockOpenAIServer } from '../mocks/mock-openai-server';
import { StreamChunk } from '../../src/shared/types';

describe('OpenAI Client Service (Real Implementation)', () => {
  let mockServer: MockOpenAIServer;
  let baseUrl: string;

  beforeAll(async () => {
    mockServer = new MockOpenAIServer();
    baseUrl = await mockServer.start();
  });

  afterAll(async () => {
    await mockServer.stop();
  });

  beforeEach(() => {
    mockServer.reset();
  });

  it('normalizes OpenAI-compatible base URLs accurately', () => {
    expect(normalizeChatEndpoint('https://api.openai.com/v1')).toBe(
      'https://api.openai.com/v1/chat/completions'
    );
    expect(normalizeChatEndpoint('https://api.openai.com/v1/')).toBe(
      'https://api.openai.com/v1/chat/completions'
    );
    expect(normalizeChatEndpoint('http://localhost:11434')).toBe(
      'http://localhost:11434/v1/chat/completions'
    );
    expect(normalizeChatEndpoint('http://localhost:1234/v1/chat/completions/')).toBe(
      'http://localhost:1234/v1/chat/completions'
    );
    expect(() => normalizeChatEndpoint('ftp://invalid')).toThrow();
  });

  it('places non-empty instructions at messages[0] and omits blank instructions', () => {
    const withPrompt = prepareMessagesPayload('Tu es un assistant concis.', [
      { role: 'user', content: 'Bonjour' }
    ]);
    expect(withPrompt).toEqual([
      { role: 'system', content: 'Tu es un assistant concis.' },
      { role: 'user', content: 'Bonjour' }
    ]);

    const withoutPrompt = prepareMessagesPayload('   ', [
      { role: 'user', content: 'Bonjour' }
    ]);
    expect(withoutPrompt).toEqual([{ role: 'user', content: 'Bonjour' }]);
  });

  it('streams tokens from MockOpenAIServer with custom instructions and auth header', async () => {
    mockServer.setOptions({ customResponseText: 'Réponse en streaming !' });

    const chunks: StreamChunk[] = [];
    await streamChatCompletion(
      {
        config: {
          baseUrl,
          apiKey: 'sk-test-secret',
          model: 'gpt-4o-mini',
          systemPrompt: 'Réponds toujours en français.'
        },
        messages: [{ role: 'user', content: 'Salut' }]
      },
      (chunk) => chunks.push(chunk)
    );

    const fullText = chunks
      .filter((c) => c.token)
      .map((c) => c.token)
      .join('');
    expect(fullText).toBe('Réponse en streaming !');
    expect(chunks[chunks.length - 1]?.isDone).toBe(true);
    expect(chunks.some((c) => c.error)).toBe(false);

    const lastReq = mockServer.getLastRequest();
    expect(lastReq?.headers['authorization']).toBe('Bearer sk-test-secret');
    expect(lastReq?.body.model).toBe('gpt-4o-mini');
    expect(lastReq?.body.messages[0]).toEqual({
      role: 'system',
      content: 'Réponds toujours en français.'
    });
  });

  it('omits Authorization header when apiKey is empty (local LLM mode)', async () => {
    const chunks: StreamChunk[] = [];
    await streamChatCompletion(
      {
        config: {
          baseUrl,
          apiKey: '',
          model: 'llama3',
          systemPrompt: ''
        },
        messages: [{ role: 'user', content: 'Hello local' }]
      },
      (chunk) => chunks.push(chunk)
    );

    const lastReq = mockServer.getLastRequest();
    expect(lastReq?.headers['authorization']).toBeUndefined();
    expect(chunks[chunks.length - 1]?.isDone).toBe(true);
  });

  it('propagates HTTP error status cleanly', async () => {
    mockServer.setOptions({
      mode: 'error',
      errorCode: 401,
      errorMessage: 'Invalid API key'
    });

    const chunks: StreamChunk[] = [];
    await streamChatCompletion(
      {
        config: {
          baseUrl,
          apiKey: 'sk-bad',
          model: 'gpt-4o',
          systemPrompt: ''
        },
        messages: [{ role: 'user', content: 'Test' }]
      },
      (chunk) => chunks.push(chunk)
    );

    const lastChunk = chunks[chunks.length - 1];
    expect(lastChunk?.isDone).toBe(true);
    expect(lastChunk?.error).toContain('401');
  });

  it('handles non-streaming JSON response fallback', async () => {
    mockServer.setOptions({
      mode: 'non_streaming',
      customResponseText: 'Réponse JSON directe'
    });

    const chunks: StreamChunk[] = [];
    await streamChatCompletion(
      {
        config: {
          baseUrl,
          apiKey: '',
          model: 'gpt-4o',
          systemPrompt: ''
        },
        messages: [{ role: 'user', content: 'Test JSON' }]
      },
      (chunk) => chunks.push(chunk)
    );

    const fullText = chunks
      .filter((c) => c.token)
      .map((c) => c.token)
      .join('');
    expect(fullText).toBe('Réponse JSON directe');
    expect(chunks[chunks.length - 1]?.isDone).toBe(true);
  });

  it('aborts streaming cleanly when AbortSignal is triggered', async () => {
    mockServer.setOptions({
      mode: 'streaming',
      streamDelayMs: 0,
      customResponseText: 'Une réponse assez longue pour être annulée en cours de route'
    });

    const controller = new AbortController();
    const chunks: StreamChunk[] = [];

    await streamChatCompletion(
      {
        config: {
          baseUrl,
          apiKey: 'sk-test',
          model: 'gpt-4o',
          systemPrompt: ''
        },
        messages: [{ role: 'user', content: 'Cancel me' }]
      },
      (chunk) => {
        chunks.push(chunk);
        if (chunk.token) {
          controller.abort();
        }
      },
      controller.signal
    );

    const lastChunk = chunks[chunks.length - 1];
    expect(lastChunk?.isDone).toBe(true);
    expect(lastChunk?.error).toBeUndefined();
  });
});
