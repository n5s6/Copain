import { describe, it, expect, beforeAll, afterAll, beforeEach } from './fixtures/test-runner.ts';
import { createMockServerFixture } from './fixtures/mock-server-fixture.ts';
import { createTestContext, TestContext } from './fixtures/test-context.ts';
import { MockOpenAIServer } from '../mocks/mock-openai-server.ts';

describe('Tier 4: Real-World Workload Application Scenarios (5 Scenarios)', () => {
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
        apiKey: 'sk-tier4-scenario-key',
        model: 'gpt-4o',
        systemPrompt: ''
      }
    });
  });

  // -------------------------------------------------------------------------
  // Scenario S1: Senior Developer Coding Assistant Workflow
  // -------------------------------------------------------------------------
  it('Scenario S1: Senior Developer Coding Assistant Workflow', async () => {
    // Step 1: Set architect persona system prompt
    const systemPrompt =
      'You are a Principal Software Architect. Provide idiomatic, clean TypeScript code with explanations.';
    await ctx.updateSettings({
      systemPrompt,
      model: 'gpt-4o'
    });

    // Step 2: Submit legacy JavaScript code snippet for conversion
    const legacyCodePrompt =
      "function fetchUser(id, cb) { http.get('/u/' + id, function(res) { cb(res.data); }); }\n" +
      'Convert this to modern async/await with strict TypeScript types.';

    const refactoredResponse =
      'Here is the refactored modern TypeScript code:\n\n' +
      '```typescript\n' +
      'interface UserResponse {\n' +
      '  id: string;\n' +
      '  name: string;\n' +
      '}\n\n' +
      'export async function fetchUser(id: string): Promise<UserResponse> {\n' +
      "  const res = await fetch(`/u/${id}`);\n" +
      '  if (!res.ok) throw new Error(`HTTP ${res.status}`);\n' +
      '  return (await res.json()) as UserResponse;\n' +
      '}\n' +
      '```\n' +
      'Key improvements:\n' +
      '- Replaced callbacks with async/await Promises.\n' +
      '- Strict UserResponse contract typing.';

    fixture.setOptions({ customResponseText: refactoredResponse });

    // Step 3: Stream reception and verification
    const res1 = await ctx.sendMessage(legacyCodePrompt);
    expect(res1.fullText).toBe(refactoredResponse);
    expect(res1.fullText).toContain('```typescript');
    expect(res1.fullText).toContain('export async function fetchUser');

    // Step 4: Multi-turn follow-up: request custom error handling
    const followUpPrompt = 'Add try/catch with custom error handling';
    const followUpResponse =
      '```typescript\n' +
      'export class UserFetchError extends Error {}\n\n' +
      'export async function fetchUser(id: string): Promise<UserResponse> {\n' +
      '  try {\n' +
      "    const res = await fetch(`/u/${id}`);\n" +
      '    return (await res.json()) as UserResponse;\n' +
      '  } catch (err: any) {\n' +
      '    throw new UserFetchError(`Failed to fetch user ${id}: ${err.message}`);\n' +
      '  }\n' +
      '}\n' +
      '```';

    fixture.setOptions({ customResponseText: followUpResponse });
    const res2 = await ctx.sendMessage(followUpPrompt);
    expect(res2.fullText).toContain('UserFetchError');

    // Step 5: Verification of full history payload
    const lastReq = fixture.server.getLastRequest();
    const payload = lastReq.body.messages;
    expect(payload).toHaveLength(4);
    expect(payload[0].role).toBe('system');
    expect(payload[0].content).toBe(systemPrompt);
    expect(payload[1].role).toBe('user');
    expect(payload[1].content).toBe(legacyCodePrompt);
    expect(payload[2].role).toBe('assistant');
    expect(payload[2].content).toBe(refactoredResponse);
    expect(payload[3].role).toBe('user');
    expect(payload[3].content).toBe(followUpPrompt);
  });

  // -------------------------------------------------------------------------
  // Scenario S2: Multi-turn Technical Consultation & Clarification
  // -------------------------------------------------------------------------
  it('Scenario S2: Multi-turn Technical Consultation & Clarification', async () => {
    // Turn 1: DNS question
    fixture.setOptions({
      customResponseText: 'NXDOMAIN indicates the domain does not exist in DNS.'
    });
    const res1 = await ctx.sendMessage('What does NXDOMAIN mean in DNS resolution?');
    expect(res1.fullText).toContain('NXDOMAIN indicates');

    // Turn 2: Troubleshooting tool
    fixture.setOptions({
      customResponseText: 'Run: dig +trace example.com to troubleshoot resolution.'
    });
    const res2 = await ctx.sendMessage('How do I troubleshoot this using dig on macOS?');
    expect(res2.fullText).toContain('dig +trace');

    // Turn 3: Authoritative nameserver clarification
    fixture.setOptions({
      customResponseText: 'Check for network timeouts or UDP packet drops on port 53.'
    });
    const res3 = await ctx.sendMessage("What if the authoritative nameserver doesn't respond?");
    expect(res3.fullText).toContain('port 53');

    // Verify all 3 recorded requests strictly preserved chronological accumulation
    const recorded = fixture.server.getRecordedRequests();
    expect(recorded).toHaveLength(3);

    // Request 1: [user]
    expect(recorded[0].body.messages).toHaveLength(1);
    expect(recorded[0].body.messages[0].content).toBe(
      'What does NXDOMAIN mean in DNS resolution?'
    );

    // Request 2: [user1, assistant1, user2]
    expect(recorded[1].body.messages).toHaveLength(3);
    expect(recorded[1].body.messages[2].content).toBe(
      'How do I troubleshoot this using dig on macOS?'
    );

    // Request 3: [user1, assistant1, user2, assistant2, user3]
    expect(recorded[2].body.messages).toHaveLength(5);
    expect(recorded[2].body.messages[4].content).toBe(
      "What if the authoritative nameserver doesn't respond?"
    );
  });

  // -------------------------------------------------------------------------
  // Scenario S3: Ephemeral Confidential Scratchpad
  // -------------------------------------------------------------------------
  it('Scenario S3: Ephemeral Confidential Scratchpad', async () => {
    // Step 1: Send proprietary sensitive financial prompt
    const confidentialPrompt =
      'CONFIDENTIAL: Q3 revenue was $4.2M with 38% gross margin. Calculate net operating profit given $1.1M OpEx.';
    const calculationResult =
      'Gross profit = $4.2M * 0.38 = $1,596,000.\n' +
      'Net operating profit = $1,596,000 - $1,100,000 = $496,000.';

    fixture.setOptions({ customResponseText: calculationResult });
    const res = await ctx.sendMessage(confidentialPrompt);
    expect(res.fullText).toContain('$496,000');

    // Step 2: Verify active in-memory session contains confidential data
    expect(ctx.getMessages()).toHaveLength(2);
    expect(ctx.getMessages()[0].content).toContain('CONFIDENTIAL');

    // Step 3: Trigger session purge (Clear Session)
    await ctx.resetSession();

    // Step 4: Strict audit: conversation array is empty
    expect(ctx.getMessages()).toHaveLength(0);

    // Step 5: Persistent storage audit: zero trace of financial text
    await ctx.assertNoMessagesInStorage();
  });

  // -------------------------------------------------------------------------
  // Scenario S4: Network Interruption & Seamless Draft Recovery
  // -------------------------------------------------------------------------
  it('Scenario S4: Network Interruption & Seamless Draft Recovery', async () => {
    // Step 1: Simulate network outage by stopping mock server
    await fixture.stop();

    // Step 2: User sends detailed question while server is down
    const detailedPrompt = 'Compare Raft vs Paxos consensus protocols in 3 key differences.';
    const failedRes = await ctx.sendMessage(detailedPrompt);

    // Step 3: Immediate ECONNREFUSED error banner
    expect(failedRes.error).toContain('ECONNREFUSED');

    // Step 4: User draft preserved intact
    expect(ctx.lastDraft).toBe(detailedPrompt);

    // Step 5: Network recovers (mock server restarted)
    const newBaseUrl = await fixture.start();
    await ctx.updateSettings({ baseUrl: newBaseUrl });

    // Step 6: User clicks Retry without retyping
    fixture.setOptions({
      customResponseText:
        '1. Leader Election: Raft has strong symmetric leader.\n' +
        '2. Understandability: Raft was designed for clarity.\n' +
        '3. Log Compaction: Snapshotting mechanisms differ.'
    });

    const retryRes = await ctx.sendMessage(ctx.lastDraft);
    expect(retryRes.fullText).toContain('Leader Election: Raft');
    expect(retryRes.error).toBeUndefined();

    // Step 7: Final verified message history contains successful exchange
    const messages = ctx.getMessages();
    expect(messages.length).toBeGreaterThanOrEqual(2);
    expect(messages[messages.length - 1].content).toContain('Leader Election: Raft');
  });

  // -------------------------------------------------------------------------
  // Scenario S5: Cold Start Onboarding & Seamless Provider Switching
  // -------------------------------------------------------------------------
  it('Scenario S5: Cold Start Onboarding & Seamless Provider Switching', async () => {
    // Step 1: Cold start with default placeholder configuration
    expect(ctx.getMessages()).toHaveLength(0);

    // Step 2: User configures local Ollama helper (empty API key)
    const localServer = new MockOpenAIServer({
      customResponseText: 'Greetings from local Ollama Llama 3!'
    });
    const localUrl = await localServer.start();

    try {
      await ctx.updateSettings({
        baseUrl: localUrl,
        apiKey: '', // Empty key for local LLM
        model: 'llama3',
        systemPrompt: 'You are Ollama local helper.'
      });

      // Step 3: Dispatch local message
      const localRes = await ctx.sendMessage('Test local');
      expect(localRes.fullText).toBe('Greetings from local Ollama Llama 3!');

      const localReq = localServer.getLastRequest();
      expect(localReq.body.model).toBe('llama3');
      expect(localReq.headers['authorization']).toBeUndefined();
      expect(localServer.getLastSystemPrompt()).toBe('You are Ollama local helper.');

      // Step 4: Switch to cloud OpenAI provider
      const cloudServer = new MockOpenAIServer({
        customResponseText: 'Greetings from cloud GPT-4o!'
      });
      const cloudUrl = await cloudServer.start();

      try {
        await ctx.updateSettings({
          baseUrl: cloudUrl,
          apiKey: 'sk-live-cloud-key-555',
          model: 'gpt-4o',
          systemPrompt: 'You are Cloud assistant.'
        });

        // Step 5: Dispatch cloud message
        const cloudRes = await ctx.sendMessage('Test cloud');
        expect(cloudRes.fullText).toBe('Greetings from cloud GPT-4o!');

        const cloudReq = cloudServer.getLastRequest();
        expect(cloudReq.body.model).toBe('gpt-4o');
        expect(cloudReq.headers['authorization']).toBe('Bearer sk-live-cloud-key-555');
        expect(cloudServer.getLastSystemPrompt()).toBe('You are Cloud assistant.');

        // Step 6: Settings persistence check after app reload / session reset
        await ctx.resetSession();
        const reloadedSettings = await ctx.getSettings();
        expect(reloadedSettings.baseUrl).toBe(cloudUrl);
        expect(reloadedSettings.apiKey).toBe('sk-live-cloud-key-555');
        expect(reloadedSettings.model).toBe('gpt-4o');
        expect(reloadedSettings.systemPrompt).toBe('You are Cloud assistant.');
        expect(ctx.getMessages()).toHaveLength(0);
      } finally {
        await cloudServer.stop();
      }
    } finally {
      await localServer.stop();
    }
  });
});
