import { describe, it, expect, beforeAll, afterAll, beforeEach } from './fixtures/test-runner.ts';
import { createMockServerFixture } from './fixtures/mock-server-fixture.ts';
import { createTestContext, TestContext } from './fixtures/test-context.ts';
import { MockOpenAIServer } from '../mocks/mock-openai-server.ts';

describe('Tier 1: Feature Coverage Suite (28 Tests)', () => {
  const fixture = createMockServerFixture();
  let ctx: TestContext;

  beforeAll(async () => {
    await fixture.start();
  });

  afterAll(async () => {
    await fixture.stop();
  });

  beforeEach(() => {
    fixture.reset();
    ctx = createTestContext({
      mockServer: fixture.server,
      defaultConfig: {
        baseUrl: fixture.baseUrl,
        apiKey: 'sk-tier1-test-key',
        model: 'gpt-4o',
        systemPrompt: ''
      }
    });
  });

  // -------------------------------------------------------------------------
  // Feature 1: LLM Connection Config (Base URL, API Key, Model) [R1]
  // -------------------------------------------------------------------------
  describe('Feature 1: LLM Connection Config', () => {
    it('T1.1.1: Base URL configuration with valid localhost URL and path verification', async () => {
      const res = await ctx.sendMessage('Ping T1.1.1');
      expect(res.error).toBeUndefined();
      expect(res.fullText.length).toBeGreaterThan(0);
      const lastReq = fixture.server.getLastRequest();
      expect(lastReq).toBeDefined();
      expect(lastReq.method).toBe('POST');
      expect(lastReq.url).toMatch(/\/v1\/chat\/completions|\/chat\/completions/);
    });

    it('T1.1.2: API Key configuration and transmission in Authorization header', async () => {
      await ctx.updateSettings({ apiKey: 'sk-valid-auth-token-xyz' });
      await ctx.sendMessage('Auth check');
      const token = fixture.server.getLastBearerToken();
      expect(token).toBe('sk-valid-auth-token-xyz');
      const lastReq = fixture.server.getLastRequest();
      expect(lastReq.headers['authorization']).toBe('Bearer sk-valid-auth-token-xyz');
    });

    it('T1.1.3: Model name configuration and request body serialization', async () => {
      await ctx.updateSettings({ model: 'meta-llama/Llama-3-70b-Instruct' });
      await ctx.sendMessage('Model check');
      const lastReq = fixture.server.getLastRequest();
      expect(lastReq.body.model).toBe('meta-llama/Llama-3-70b-Instruct');
    });

    it('T1.1.4: Dynamic settings update between successive dispatches across servers', async () => {
      const serverB = new MockOpenAIServer({
        customResponseText: 'Hello from Server B!'
      });
      const urlB = await serverB.start();

      try {
        // Send to Server A
        await ctx.sendMessage('Message to Server A');
        expect(fixture.server.getRecordedRequests()).toHaveLength(1);
        expect(serverB.getRecordedRequests()).toHaveLength(0);

        // Switch to Server B
        await ctx.updateSettings({
          baseUrl: urlB,
          model: 'gpt-3.5-turbo'
        });
        const resB = await ctx.sendMessage('Message to Server B');
        expect(resB.fullText).toContain('Server B');
        expect(fixture.server.getRecordedRequests()).toHaveLength(1);
        expect(serverB.getRecordedRequests()).toHaveLength(1);
        expect(serverB.getLastRequest().body.model).toBe('gpt-3.5-turbo');
      } finally {
        await serverB.stop();
      }
    });

    it('T1.1.5: Persistent settings storage and reload verification', async () => {
      await ctx.updateSettings({
        baseUrl: 'http://127.0.0.1:9999/v1',
        model: 'claude-3-haiku',
        apiKey: 'sk-persisted-key'
      });

      const loaded = await ctx.getSettings();
      expect(loaded.baseUrl).toBe('http://127.0.0.1:9999/v1');
      expect(loaded.model).toBe('claude-3-haiku');
      expect(loaded.apiKey).toBe('sk-persisted-key');
    });
  });

  // -------------------------------------------------------------------------
  // Feature 2: System Prompt Transmission & Customization [R1]
  // -------------------------------------------------------------------------
  describe('Feature 2: System Prompt Transmission', () => {
    it('T1.2.1: Custom system prompt correctly placed at messages[0]', async () => {
      await ctx.updateSettings({ systemPrompt: 'Tu es un assistant concis et formel.' });
      await ctx.sendMessage('Bonjour');

      const lastReq = fixture.server.getLastRequest();
      expect(lastReq.body.messages).toHaveLength(2);
      expect(lastReq.body.messages[0].role).toBe('system');
      expect(lastReq.body.messages[0].content).toBe('Tu es un assistant concis et formel.');
      expect(lastReq.body.messages[1].role).toBe('user');
      expect(lastReq.body.messages[1].content).toBe('Bonjour');
    });

    it('T1.2.2: Dynamic system prompt modification changes payload on next exchange', async () => {
      await ctx.updateSettings({ systemPrompt: 'Prompt version 1' });
      await ctx.sendMessage('Message 1');
      expect(fixture.server.getLastSystemPrompt()).toBe('Prompt version 1');

      await ctx.updateSettings({ systemPrompt: 'Tu es un pirate jovial.' });
      await ctx.sendMessage('Qui es-tu ?');
      expect(fixture.server.getLastSystemPrompt()).toBe('Tu es un pirate jovial.');
    });

    it('T1.2.3: Blank/empty system prompt omitted from request payload', async () => {
      await ctx.updateSettings({ systemPrompt: '   \n  \t  ' });
      await ctx.sendMessage('Hello without system prompt');

      const lastReq = fixture.server.getLastRequest();
      expect(lastReq.body.messages).toHaveLength(1);
      expect(lastReq.body.messages[0].role).toBe('user');
      expect(fixture.server.getLastSystemPrompt()).toBeUndefined();
    });

    it('T1.2.4: Multiline system prompt formatting preservation', async () => {
      const multilinePrompt = 'You are an expert system.\nRules:\n- Never use passive voice.\n- Quote accurately: "Veritas".';
      await ctx.updateSettings({ systemPrompt: multilinePrompt });
      await ctx.sendMessage('Rule check');

      expect(fixture.server.getLastSystemPrompt()).toBe(multilinePrompt);
    });

    it('T1.2.5: Behavioral system prompt verification (echo mode returns system persona)', async () => {
      fixture.setOptions({ mode: 'echo_system_prompt' });
      await ctx.updateSettings({ systemPrompt: 'IDENTITY: AGENT-007' });
      const res = await ctx.sendMessage('Identify yourself');

      expect(res.fullText).toBe('System prompt received: [IDENTITY: AGENT-007]');
    });

    it('T1.2.6: System prompt with markdown and code snippets', async () => {
      const mdPrompt = '# Instruction\nRespond only in `JSON` format:\n```json\n{"status": "ok"}\n```';
      await ctx.updateSettings({ systemPrompt: mdPrompt });
      await ctx.sendMessage('Format check');

      expect(fixture.server.getLastSystemPrompt()).toBe(mdPrompt);
    });
  });

  // -------------------------------------------------------------------------
  // Feature 3: User Message Input & Conversational Exchange [R2]
  // -------------------------------------------------------------------------
  describe('Feature 3: User Message Input & Conversational Exchange', () => {
    it('T1.3.1: Standard user message input and successful delivery', async () => {
      const res = await ctx.sendMessage('Quelle est la capitale de la France ?');
      expect(res.fullText).toBeDefined();
      expect(fixture.server.getLastUserMessage()).toBe('Quelle est la capitale de la France ?');
    });

    it('T1.3.2: User message reflected immediately in conversation state', async () => {
      await ctx.sendMessage('Test message reflection');
      const messages = ctx.getMessages();
      expect(messages.length).toBeGreaterThanOrEqual(1);
      expect(messages[0].role).toBe('user');
      expect(messages[0].content).toBe('Test message reflection');
    });

    it('T1.3.3: Assistant response successfully paired with user prompt', async () => {
      fixture.setOptions({ customResponseText: 'Paris est la capitale de la France.' });
      const res = await ctx.sendMessage('Capitale France ?');

      const messages = ctx.getMessages();
      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe('user');
      expect(messages[1].role).toBe('assistant');
      expect(messages[1].content).toBe('Paris est la capitale de la France.');
      expect(res.fullText).toBe('Paris est la capitale de la France.');
    });

    it('T1.3.4: Multi-turn message order preservation in request history', async () => {
      fixture.setOptions({ customResponseText: 'Got it, blue.' });
      await ctx.sendMessage('My favorite color is blue.');

      fixture.setOptions({ customResponseText: 'Your color is blue.' });
      await ctx.sendMessage('What is my favorite color?');

      const lastReq = fixture.server.getLastRequest();
      const payloadMessages = lastReq.body.messages;
      expect(payloadMessages).toHaveLength(3);
      expect(payloadMessages[0].role).toBe('user');
      expect(payloadMessages[0].content).toBe('My favorite color is blue.');
      expect(payloadMessages[1].role).toBe('assistant');
      expect(payloadMessages[1].content).toBe('Got it, blue.');
      expect(payloadMessages[2].role).toBe('user');
      expect(payloadMessages[2].content).toBe('What is my favorite color?');
    });

    it('T1.3.5: Input field draft recording and clear on dispatch', async () => {
      ctx.setInputDraft('Clearing test');
      expect(ctx.inputDraft).toBe('Clearing test');
      const res = await ctx.sendMessage('Clearing test');
      expect(res.error).toBeUndefined();
      expect(ctx.inputDraft).toBe('');
      expect(ctx.lastDraft).toBe('Clearing test');
      const messages = ctx.getMessages();
      expect(messages[0].content).toBe('Clearing test');
    });

    it('T1.3.6: Shift+Enter multiline user message control', async () => {
      const multilineUser = 'Line 1\nLine 2\nLine 3';
      await ctx.sendMessage(multilineUser);
      expect(fixture.server.getLastUserMessage()).toBe(multilineUser);
    });
  });

  // -------------------------------------------------------------------------
  // Feature 4: SSE Response Streaming & Live Token Reception [R2, Verification]
  // -------------------------------------------------------------------------
  describe('Feature 4: SSE Response Streaming', () => {
    it('T1.4.1: Stream chunks incrementally received and assembled into complete text', async () => {
      fixture.setOptions({
        customResponseText: 'Alpha Beta Gamma Delta'
      });
      const receivedTokens: string[] = [];
      const res = await ctx.sendMessage('Stream test', {
        onChunk: (chunk) => {
          if (chunk.token) receivedTokens.push(chunk.token);
        }
      });

      expect(receivedTokens.length).toBeGreaterThanOrEqual(4);
      expect(res.fullText).toBe('Alpha Beta Gamma Delta');
      expect(receivedTokens.join('')).toBe('Alpha Beta Gamma Delta');
    });

    it('T1.4.2: Handling of multi-token bursts in single chunk', async () => {
      fixture.setOptions({
        customResponseText: 'The quick brown fox jumps over the lazy dog.'
      });
      const res = await ctx.sendMessage('Burst test');
      expect(res.fullText).toBe('The quick brown fox jumps over the lazy dog.');
    });

    it('T1.4.3: Clean completion on data: [DONE]', async () => {
      let isDoneSeen = false;
      const res = await ctx.sendMessage('Done test', {
        onChunk: (c) => {
          if (c.isDone) isDoneSeen = true;
        }
      });
      expect(isDoneSeen).toBe(true);
      expect(res.fullText).toBeDefined();
    });

    it('T1.4.4: Streaming abort/cancel terminates stream gracefully', async () => {
      fixture.setOptions({
        customResponseText: 'Word1 Word2 Word3 Word4 Word5'
      });
      const cancelPromise = ctx.sendMessage('Cancel test', {
        onChunk: () => {
          ctx.cancelMessage();
        }
      });
      const res = await cancelPromise;
      expect(res.error).toBe('Aborted');
    });

    it('T1.4.5: Keep-alive comments (: keep-alive) ignored without corrupting stream', async () => {
      fixture.setOptions({
        customResponseText: 'Clean text without comments'
      });
      const res = await ctx.sendMessage('Keepalive test');
      expect(res.fullText).not.toContain(':');
      expect(res.fullText).not.toContain('keep-alive');
      expect(res.fullText).toBe('Clean text without comments');
    });

    it('T1.4.6: Non-streaming JSON mode fallback handling', async () => {
      fixture.setOptions({
        mode: 'non_streaming',
        customResponseText: 'Non-streaming response'
      });
      const res = await ctx.sendMessage('Non-stream test', { stream: false });
      expect(res.fullText).toBe('Non-streaming response');
    });
  });

  // -------------------------------------------------------------------------
  // Feature 5: Strict Session Ephemerality & State Reset [R2]
  // -------------------------------------------------------------------------
  describe('Feature 5: Strict Session Ephemerality', () => {
    it('T1.5.1: Zero persistence of messages to storage or disk', async () => {
      await ctx.sendMessage('Sensitive message 1');
      await ctx.sendMessage('Sensitive message 2');
      await ctx.assertNoMessagesInStorage();
    });

    it('T1.5.2: State reset clearing message array to empty state', async () => {
      await ctx.sendMessage('Message before reset');
      expect(ctx.getMessages()).toHaveLength(2); // user + assistant

      await ctx.resetSession();
      expect(ctx.getMessages()).toHaveLength(0);
    });

    it('T1.5.3: Multiple chat threads disallowed / strictly single active session', async () => {
      await ctx.sendMessage('First conversation');
      expect(ctx.getMessages().length).toBeGreaterThan(0);

      // Reset to start new conversation
      await ctx.resetSession();
      expect(ctx.getMessages()).toHaveLength(0);

      await ctx.sendMessage('Brand new conversation');
      const messages = ctx.getMessages();
      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe('Brand new conversation');
    });

    it('T1.5.4: New chat action resets conversation without altering saved settings', async () => {
      await ctx.updateSettings({
        systemPrompt: 'Keep this prompt',
        model: 'custom-model-id'
      });
      await ctx.sendMessage('Will be cleared');

      await ctx.resetSession();
      expect(ctx.getMessages()).toHaveLength(0);

      const settings = await ctx.getSettings();
      expect(settings.systemPrompt).toBe('Keep this prompt');
      expect(settings.model).toBe('custom-model-id');
    });

    it('T1.5.5: Clean state reset blank slate simulation', async () => {
      await ctx.sendMessage('Turn 1');
      await ctx.resetSession();

      await ctx.sendMessage('Fresh turn after reload');
      const lastReq = fixture.server.getLastRequest();
      // Should only contain the fresh turn, not Turn 1
      expect(lastReq.body.messages).toHaveLength(1);
      expect(lastReq.body.messages[0].content).toBe('Fresh turn after reload');
    });
  });
});
