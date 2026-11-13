import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SettingsService } from '../../src/main/services/settings-service';
import { DEFAULT_LLM_CONFIG } from '../../src/shared/types';

describe('SettingsService', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'chatbot-settings-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('returns DEFAULT_LLM_CONFIG when no settings file exists', async () => {
    const service = new SettingsService(tempDir);
    const loaded = await service.load();
    expect(loaded).toEqual(DEFAULT_LLM_CONFIG);
  });

  it('saves and reloads LLM configuration across instances without storing chat history', async () => {
    const service1 = new SettingsService(tempDir);
    const saveRes = await service1.save({
      baseUrl: '  http://localhost:11434/v1  ',
      apiKey: '  sk-local  ',
      model: '  llama3  ',
      systemPrompt: 'Tu es un pirate.',
      language: 'en'
    });
    expect(saveRes.success).toBe(true);

    const service2 = new SettingsService(tempDir);
    const loaded = await service2.load();
    expect(loaded).toEqual({
      baseUrl: 'http://localhost:11434/v1',
      apiKey: 'sk-local',
      model: 'llama3',
      systemPrompt: 'Tu es un pirate.',
      language: 'en'
    });
  });
});

