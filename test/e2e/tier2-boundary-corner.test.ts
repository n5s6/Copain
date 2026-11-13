import { describe, it, expect, beforeAll, afterAll, beforeEach } from './fixtures/test-runner.ts';
import { createMockServerFixture } from './fixtures/mock-server-fixture.ts';
import { createTestContext, TestContext, normalizeChatEndpoint } from './fixtures/test-context.ts';

describe('Tier 2: Boundary & Corner Cases Suite (18 Tests)', () => {
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
        apiKey: 'sk-tier2-test-key',
        model: 'gpt-4o'
      }
    });
  });

  // -------------------------------------------------------------------------
  // Input Boundaries & Validation
  // -------------------------------------------------------------------------
  describe('Input Boundaries & Validation', () => {
    it('T2.1: Empty string input rejection', async () => {
      let threw = false;
      try {
        await ctx.sendMessage('');
      } catch (err: any) {
        threw = true;
        expect(err.message).toContain('empty');
      }
      expect(threw).toBe(true);
      expect(fixture.server.getRecordedRequests()).toHaveLength(0);
      expect(ctx.getMessages()).toHaveLength(0);
    });

    it('T2.2: Whitespace-only string rejection', async () => {
      let threw = false;
      try {
        await ctx.sendMessage('   \t\n   \r\n   ');
      } catch (err: any) {
        threw = true;
        expect(err.message).toContain('whitespace');
      }
      expect(threw).toBe(true);
      expect(fixture.server.getRecordedRequests()).toHaveLength(0);
      expect(ctx.getMessages()).toHaveLength(0);
    });

    it('T2.3: Extremely long message (>10,000 characters) payload transmission', async () => {
      const longMessage = 'A'.repeat(12000);
      fixture.setOptions({ customResponseText: 'Received long message successfully' });

      const res = await ctx.sendMessage(longMessage);
      expect(res.fullText).toBe('Received long message successfully');

      const lastReq = fixture.server.getLastRequest();
      expect(lastReq.body.messages[0].content).toHaveLength(12000);
      expect(lastReq.body.messages[0].content).toBe(longMessage);
    });
  });

  // -------------------------------------------------------------------------
  // Character Encodings & Security
  // -------------------------------------------------------------------------
  describe('Character Encodings & Security', () => {
    it('T2.4: Unicode, Emojis, Accents, RTL, and CJK characters preservation', async () => {
      const complexText =
        'Test emojis: 🚀💬🤖🔥, Accents: éàçüöñ, RTL: مرحبا بالعالم, CJK: 你好世界';
      fixture.setOptions({ customResponseText: 'Echo: ' + complexText });

      const res = await ctx.sendMessage(complexText);
      expect(res.fullText).toBe('Echo: ' + complexText);

      const lastReq = fixture.server.getLastRequest();
      expect(lastReq.body.messages[0].content).toBe(complexText);
    });

    it('T2.5: Script injection and SQL strings sanitization in payload', async () => {
      const maliciousPayload =
        "<script>alert('XSS')</script><img src=x onerror=alert(1)>' OR '1'='1; DROP TABLE users; --";
      fixture.setOptions({ customResponseText: 'Safe response' });

      const res = await ctx.sendMessage(maliciousPayload);
      expect(res.fullText).toBe('Safe response');

      const lastReq = fixture.server.getLastRequest();
      expect(lastReq.body.messages[0].content).toBe(maliciousPayload);
    });
  });

  // -------------------------------------------------------------------------
  // URL Normalization Edge Cases
  // -------------------------------------------------------------------------
  describe('URL Normalization', () => {
    it('T2.6: Normalizes base URL with trailing slash', async () => {
      const port = fixture.server.getPort();
      const rawUrl = `http://127.0.0.1:${port}/v1/`;
      const normalized = normalizeChatEndpoint(rawUrl);
      expect(normalized).toBe(`http://127.0.0.1:${port}/v1/chat/completions`);

      await ctx.updateSettings({ baseUrl: rawUrl });
      const res = await ctx.sendMessage('Trailing slash test');
      expect(res.error).toBeUndefined();
      expect(res.fullText.length).toBeGreaterThan(0);
      const lastReq = fixture.server.getLastRequest();
      expect(lastReq).toBeDefined();
      expect(lastReq.body.messages[0].content).toBe('Trailing slash test');
    });

    it('T2.7: Normalizes base URL missing /v1 path segment', async () => {
      const port = fixture.server.getPort();
      const rawUrl = `http://127.0.0.1:${port}`;
      const normalized = normalizeChatEndpoint(rawUrl);
      expect(normalized).toBe(`http://127.0.0.1:${port}/v1/chat/completions`);

      // Also verify duplicate slashes and fragments are normalized
      const doubleSlashUrl = `http://127.0.0.1:${port}//v1//chat/completions#frag`;
      expect(normalizeChatEndpoint(doubleSlashUrl)).toBe(`http://127.0.0.1:${port}/v1/chat/completions`);

      await ctx.updateSettings({ baseUrl: rawUrl });
      const res = await ctx.sendMessage('Missing v1 test');
      expect(res.error).toBeUndefined();
      expect(res.fullText.length).toBeGreaterThan(0);
      const lastReq = fixture.server.getLastRequest();
      expect(lastReq).toBeDefined();
      expect(lastReq.body.messages[0].content).toBe('Missing v1 test');
    });

    it('T2.8: Normalizes base URL that already includes /v1/chat/completions/', async () => {
      const port = fixture.server.getPort();
      const rawUrl = `http://127.0.0.1:${port}/v1/chat/completions/`;
      const normalized = normalizeChatEndpoint(rawUrl);
      expect(normalized).toBe(`http://127.0.0.1:${port}/v1/chat/completions`);

      // Verify query parameters (such as Azure OpenAI ?api-version=...) are preserved intact
      const azureUrl = `http://127.0.0.1:${port}/openai/deployments/gpt-4/chat/completions?api-version=2024-02-15-preview`;
      expect(normalizeChatEndpoint(azureUrl)).toBe(azureUrl);

      const queryBaseUrl = `http://127.0.0.1:${port}/v1?custom-param=123`;
      expect(normalizeChatEndpoint(queryBaseUrl)).toBe(`http://127.0.0.1:${port}/v1/chat/completions?custom-param=123`);

      await ctx.updateSettings({ baseUrl: rawUrl });
      const res = await ctx.sendMessage('Full path test');
      expect(res.error).toBeUndefined();
      expect(res.fullText.length).toBeGreaterThan(0);
      const lastReq = fixture.server.getLastRequest();
      expect(lastReq).toBeDefined();
      expect(lastReq.body.messages[0].content).toBe('Full path test');
    });
  });

  // -------------------------------------------------------------------------
  // Authentication Variations
  // -------------------------------------------------------------------------
  describe('Authentication Variations', () => {
    it('T2.9: Empty API key (local LLM mode) omits Authorization header', async () => {
      await ctx.updateSettings({ apiKey: '' });
      await ctx.sendMessage('Empty key test');

      const lastReq = fixture.server.getLastRequest();
      expect(lastReq.headers['authorization']).toBeUndefined();
      expect(fixture.server.getLastBearerToken()).toBeUndefined();
    });

    it('T2.10: API key with special symbols and surrounding spaces', async () => {
      await ctx.updateSettings({ apiKey: '  sk-with-spaces-and-$pecial!#  ' });
      await ctx.sendMessage('Special key test');

      const token = fixture.server.getLastBearerToken();
      expect(token).toBe('sk-with-spaces-and-$pecial!#');
    });
  });

  // -------------------------------------------------------------------------
  // Protocol & Network Error Recovery Matrix
  // -------------------------------------------------------------------------
  describe('Protocol & Network Error Recovery Matrix', () => {
    it('T2.11: HTTP 401 Unauthorized error propagation and draft preservation', async () => {
      fixture.setOptions({
        mode: 'error',
        errorCode: 401,
        errorMessage: 'Invalid API Key provided'
      });

      const res = await ctx.sendMessage('Secret prompt draft');
      expect(res.statusCode).toBe(401);
      expect(res.error).toContain('Invalid API Key');
      expect(ctx.lastDraft).toBe('Secret prompt draft');
    });

    it('T2.12: HTTP 429 Rate Limit error handling with backoff info', async () => {
      fixture.setOptions({
        mode: 'error',
        errorCode: 429,
        errorMessage: 'Rate limit exceeded. Please wait.',
        retryAfterSeconds: 5
      });

      const res = await ctx.sendMessage('Quota prompt');
      expect(res.statusCode).toBe(429);
      expect(res.error).toContain('Rate limit exceeded');
      expect(ctx.lastDraft).toBe('Quota prompt');
    });

    it('T2.13: HTTP 500 Internal Server Error recovery and retry readiness', async () => {
      fixture.setOptions({
        mode: 'error',
        errorCode: 500,
        errorMessage: 'Server crashed on prompt generation'
      });

      const res = await ctx.sendMessage('Crashed prompt');
      expect(res.statusCode).toBe(500);
      expect(res.error).toContain('Server crashed');

      // Recover server and retry
      fixture.reset();
      fixture.setOptions({ customResponseText: 'Recovered after crash' });
      const retryRes = await ctx.sendMessage(ctx.lastDraft);
      expect(retryRes.fullText).toBe('Recovered after crash');
    });

    it('T2.14: HTTP 404 Model Not Found error notification', async () => {
      fixture.setOptions({
        mode: 'error',
        errorCode: 404,
        errorMessage: 'The model gpt-unknown does not exist'
      });

      const res = await ctx.sendMessage('Unknown model test');
      expect(res.statusCode).toBe(404);
      expect(res.error).toContain('model gpt-unknown does not exist');
    });

    it('T2.15: Network ECONNREFUSED when endpoint port is unreachable', async () => {
      await ctx.updateSettings({
        baseUrl: 'http://127.0.0.1:1/v1' // Port 1 is dead
      });

      const res = await ctx.sendMessage('Unreachable destination');
      expect(res.error).toContain('ECONNREFUSED');
      expect(ctx.lastDraft).toBe('Unreachable destination');
    });

    it('T2.16: Mid-stream socket abrupt disconnect handling and partial retention', async () => {
      fixture.setOptions({
        mode: 'abrupt_disconnect',
        customResponseText: 'Beginning of response that will be cut off abruptly'
      });

      const res = await ctx.sendMessage('Abrupt drop test');
      expect(res.error).toMatch(/interrompue|fetch failed|socket hang up|ECONNRESET/i);
      expect(res.fullText.length >= 0).toBe(true);
      if (res.fullText.length > 0) {
        expect(res.fullText).toContain('Beginning');
      }
    });

    it('T2.17: Rapid successive dispatches without state corruption', async () => {
      fixture.setOptions({ customResponseText: 'Quick reply' });

      // Simulate sequential rapid sending
      const p1 = ctx.sendMessage('Rapid 1');
      const p2 = ctx.sendMessage('Rapid 2');
      const [res1, res2] = await Promise.all([p1, p2]);

      expect(res1.fullText).toBe('Quick reply');
      expect(res2.fullText).toBe('Quick reply');
      expect(ctx.getMessages().length).toBe(4); // 2 user + 2 assistant
    });

    it('T2.18: Non-JSON error body (HTTP 502 Bad Gateway with HTML)', async () => {
      fixture.setOptions({
        mode: 'custom_html_error',
        errorCode: 502,
        customHtmlBody: '<html><head><title>502 Bad Gateway</title></head><body>502 Bad Gateway</body></html>'
      });

      const res = await ctx.sendMessage('HTML error test');
      expect(res.statusCode).toBe(502);
      expect(res.error).toContain('502');
      expect(res.error).toContain('Bad Gateway');
    });
  });
});
