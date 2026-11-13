import { describe, it, expect, beforeAll, afterAll, beforeEach } from './fixtures/test-runner.ts';
import { createMockServerFixture } from './fixtures/mock-server-fixture.ts';
import { createTestContext, TestContext } from './fixtures/test-context.ts';
import { MockOpenAIServer } from '../mocks/mock-openai-server.ts';

describe('Tier 3: Cross-Feature Combinations Suite (6 Tests)', () => {
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
        apiKey: 'sk-tier3-test-key',
        model: 'gpt-4o',
        systemPrompt: ''
      }
    });
  });

  // -------------------------------------------------------------------------
  // T3.1: Custom System Prompt + Streaming + Mid-stream Abort & Recovery
  // -------------------------------------------------------------------------
  it('T3.1: Custom system prompt + streaming + mid-stream abort & recovery in follow-up', async () => {
    await ctx.updateSettings({ systemPrompt: 'You are a technical editor.' });
    fixture.setOptions({
      customResponseText: 'Sentence one with facts. Sentence two with further details. Sentence three.'
    });

    // Send Turn 1 with mid-stream abort
    const p1 = ctx.sendMessage('Write a 500-word essay.', {
      onChunk: (chunk) => {
        if (chunk.token && chunk.token.includes('Sentence')) {
          ctx.cancelMessage();
        }
      }
    });
    const res1 = await p1;
    expect(res1.error).toBe('Aborted');
    expect(res1.fullText.length).toBeGreaterThan(0);

    const lastReq1 = fixture.server.getLastRequest();
    expect(lastReq1.body.messages[0].role).toBe('system');
    expect(lastReq1.body.messages[0].content).toBe('You are a technical editor.');

    // Send Turn 2 follow-up
    fixture.setOptions({ customResponseText: 'Here is the shorter version.' });
    const res2 = await ctx.sendMessage('Make it shorter.');
    expect(res2.fullText).toBe('Here is the shorter version.');

    const lastReq2 = fixture.server.getLastRequest();
    const payload = lastReq2.body.messages;
    expect(payload).toHaveLength(4);
    expect(payload[0].role).toBe('system');
    expect(payload[0].content).toBe('You are a technical editor.');
    expect(payload[1].role).toBe('user');
    expect(payload[1].content).toBe('Write a 500-word essay.');
    expect(payload[2].role).toBe('assistant');
    expect(payload[2].content).toBe(res1.fullText);
    expect(payload[3].role).toBe('user');
    expect(payload[3].content).toBe('Make it shorter.');
  });

  // -------------------------------------------------------------------------
  // T3.2: Settings Update (Model & Base URL) + In-Flight Message + Session Reset
  // -------------------------------------------------------------------------
  it('T3.2: Settings update across servers with session reset ensuring zero cross-talk', async () => {
    const server2 = new MockOpenAIServer({
      customResponseText: 'Response from server 2 with mistral'
    });
    const url2 = await server2.start();

    try {
      // Turn 1 on Server 1
      fixture.setOptions({ customResponseText: 'Turn 1 from server 1' });
      const res1 = await ctx.sendMessage('Hello server 1');
      expect(res1.fullText).toBe('Turn 1 from server 1');
      expect(fixture.server.getRecordedRequests()).toHaveLength(1);
      expect(server2.getRecordedRequests()).toHaveLength(0);

      // Change settings to Server 2 and Model mistral-large
      await ctx.updateSettings({
        baseUrl: url2,
        model: 'mistral-large'
      });

      // Clear session (ephemeral reset)
      await ctx.resetSession();
      expect(ctx.getMessages()).toHaveLength(0);

      // Send to Server 2
      const res2 = await ctx.sendMessage('Hello server 2');
      expect(res2.fullText).toBe('Response from server 2 with mistral');

      // Verify server 1 received no new requests
      expect(fixture.server.getRecordedRequests()).toHaveLength(1);
      // Verify server 2 received exactly 1 request with zero history from turn 1
      expect(server2.getRecordedRequests()).toHaveLength(1);
      const req2 = server2.getLastRequest();
      expect(req2.body.model).toBe('mistral-large');
      expect(req2.body.messages).toHaveLength(1);
      expect(req2.body.messages[0].content).toBe('Hello server 2');
    } finally {
      await server2.stop();
    }
  });

  // -------------------------------------------------------------------------
  // T3.3: Multiline Markdown Prompt + Code Block Stream with Syntax Delimiters
  // -------------------------------------------------------------------------
  it('T3.3: Multiline markdown prompt + code block stream with syntax delimiters', async () => {
    const promptWithCode =
      'Provide a TypeScript interface:\n```typescript\ninterface User { id: string; }\n```';
    const codeResponse =
      'Here is the requested interface:\n\n```typescript\nexport interface Profile {\n  name: string;\n  age: number;\n}\n```\nDone.';

    fixture.setOptions({ customResponseText: codeResponse });

    const chunksReceived: string[] = [];
    const res = await ctx.sendMessage(promptWithCode, {
      onChunk: (c) => {
        if (c.token) chunksReceived.push(c.token);
      }
    });

    expect(res.fullText).toBe(codeResponse);
    expect(res.fullText).toContain('```typescript');
    expect(res.fullText).toContain('export interface Profile');
    expect(res.fullText).toContain('```');

    const lastReq = fixture.server.getLastRequest();
    expect(lastReq.body.messages[0].content).toBe(promptWithCode);
  });

  // -------------------------------------------------------------------------
  // T3.4: Rate Limit (429) Error Encounter + Settings Fix + Retry without Message Loss
  // -------------------------------------------------------------------------
  it('T3.4: 429 rate limit error + settings update to upgraded key + retry without draft loss', async () => {
    fixture.setOptions({
      mode: 'error',
      errorCode: 429,
      errorMessage: 'Rate limit exceeded on current API key'
    });

    const userDraft = 'Analyze this financial report for anomalies...';
    const res1 = await ctx.sendMessage(userDraft);
    expect(res1.statusCode).toBe(429);
    expect(res1.error).toContain('Rate limit exceeded');
    expect(ctx.lastDraft).toBe(userDraft);

    // User updates API key in settings
    await ctx.updateSettings({ apiKey: 'sk-upgraded-key-999' });

    // Mock server returns normal response
    fixture.reset();
    fixture.setOptions({
      customResponseText: 'Analysis complete: Zero anomalies detected.'
    });

    // Retry using preserved draft
    const res2 = await ctx.sendMessage(ctx.lastDraft);
    expect(res2.fullText).toBe('Analysis complete: Zero anomalies detected.');

    const token = fixture.server.getLastBearerToken();
    expect(token).toBe('sk-upgraded-key-999');
  });

  // -------------------------------------------------------------------------
  // T3.5: Full Settings & Ephemerality Lifecycle
  // -------------------------------------------------------------------------
  it('T3.5: Full lifecycle: custom config -> 3-turn chat stream -> reload -> storage audit', async () => {
    await ctx.updateSettings({
      model: 'gpt-4o-mini',
      systemPrompt: 'Expert sys'
    });

    // Turn 1
    fixture.setOptions({ customResponseText: 'Response 1' });
    await ctx.sendMessage('Question 1');

    // Turn 2
    fixture.setOptions({ customResponseText: 'Response 2' });
    await ctx.sendMessage('Question 2');

    // Turn 3
    fixture.setOptions({ customResponseText: 'Response 3' });
    await ctx.sendMessage('Question 3');

    expect(ctx.getMessages()).toHaveLength(6); // 3 pairs

    // Reload / reset session
    await ctx.resetSession();

    // Verify chat messages array is 100% empty
    expect(ctx.getMessages()).toHaveLength(0);

    // Verify settings persisted
    const loadedSettings = await ctx.getSettings();
    expect(loadedSettings.model).toBe('gpt-4o-mini');
    expect(loadedSettings.systemPrompt).toBe('Expert sys');

    // Verify persistent storage contains NO conversation data
    await ctx.assertNoMessagesInStorage();
  });

  // -------------------------------------------------------------------------
  // T3.6: Dynamic System Prompt Modification between Multi-turn Exchanges
  // -------------------------------------------------------------------------
  it('T3.6: Dynamic system prompt modification between multi-turn exchanges in single session', async () => {
    // Step 1: Initial formal prompt
    await ctx.updateSettings({ systemPrompt: 'Tone: Formal' });
    fixture.setOptions({ customResponseText: 'Greetings. How may I assist you?' });
    const res1 = await ctx.sendMessage('Hello');
    expect(res1.fullText).toBe('Greetings. How may I assist you?');
    expect(fixture.server.getLastSystemPrompt()).toBe('Tone: Formal');

    // Step 2: Update system prompt mid-session to casual
    await ctx.updateSettings({ systemPrompt: 'Tone: Casual' });

    // Step 3: Send follow-up in same active session
    fixture.setOptions({ customResponseText: 'Hey! The weather is sunny and warm.' });
    const res2 = await ctx.sendMessage('How is the weather?');
    expect(res2.fullText).toBe('Hey! The weather is sunny and warm.');

    // Step 4: Verify payload carried updated system prompt AND preserved multi-turn history
    const lastReq = fixture.server.getLastRequest();
    const messages = lastReq.body.messages;
    expect(messages).toHaveLength(4);
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toBe('Tone: Casual');
    expect(messages[1].role).toBe('user');
    expect(messages[1].content).toBe('Hello');
    expect(messages[2].role).toBe('assistant');
    expect(messages[2].content).toBe('Greetings. How may I assist you?');
    expect(messages[3].role).toBe('user');
    expect(messages[3].content).toBe('How is the weather?');
  });
});
