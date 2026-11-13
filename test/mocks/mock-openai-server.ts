import * as http from 'node:http';
import { Socket } from 'node:net';
import type { AddressInfo } from 'node:net';

export interface RecordedRequest {
  timestamp: number;
  method: string;
  url: string;
  headers: http.IncomingHttpHeaders;
  body: any;
}

export type MockBehaviorMode =
  | 'streaming'
  | 'non_streaming'
  | 'echo_system_prompt'
  | 'error'
  | 'abrupt_disconnect'
  | 'custom_html_error';

export interface MockServerOptions {
  mode?: MockBehaviorMode;
  errorCode?: number;
  errorMessage?: string;
  streamDelayMs?: number;
  customResponseText?: string;
  retryAfterSeconds?: number;
  customHtmlBody?: string;
}

export interface ProcessedResponse {
  statusCode: number;
  headers: Record<string, string>;
  isStream: boolean;
  body?: any;
  chunks?: string[];
  abruptDisconnect?: boolean;
}

export class MockOpenAIServer {
  private static activeServers = new Map<number, MockOpenAIServer>();

  public static getServer(port: number): MockOpenAIServer | undefined {
    return MockOpenAIServer.activeServers.get(port);
  }

  private server: http.Server | null = null;
  private recordedRequests: RecordedRequest[] = [];
  private activeSockets = new Set<Socket>();
  private options: MockServerOptions;
  private port: number = 0;
  private isRunning: boolean = false;
  private lastRequestAborted: boolean = false;

  constructor(options: MockServerOptions = {}) {
    this.options = {
      mode: 'streaming',
      streamDelayMs: 0,
      customResponseText: 'Hello from MockOpenAIServer!',
      ...options
    };
  }

  /**
   * Updates runtime options for the mock server.
   * Clears errorCode and related error states if a new non-error mode is set without an explicit errorCode.
   */
  public setOptions(options: Partial<MockServerOptions>): void {
    const updated = { ...this.options, ...options };
    if (options.mode && options.mode !== 'error' && options.errorCode === undefined) {
      delete updated.errorCode;
      delete updated.errorMessage;
    }
    if (options.mode && options.mode !== 'custom_html_error' && options.customHtmlBody === undefined) {
      delete updated.customHtmlBody;
    }
    if ('errorCode' in options && options.errorCode === undefined) {
      delete updated.errorCode;
    }
    if ('errorMessage' in options && options.errorMessage === undefined) {
      delete updated.errorMessage;
    }
    if ('customHtmlBody' in options && options.customHtmlBody === undefined) {
      delete updated.customHtmlBody;
    }
    this.options = updated;
  }

  /**
   * Resets recorded requests and restores default options.
   */
  public reset(): void {
    this.recordedRequests = [];
    this.lastRequestAborted = false;
    this.options = {
      mode: 'streaming',
      streamDelayMs: 0,
      customResponseText: 'Hello from MockOpenAIServer!'
    };
  }

  /**
   * Returns a copy of all recorded requests.
   */
  public getRecordedRequests(): RecordedRequest[] {
    return [...this.recordedRequests];
  }

  /**
   * Returns the most recent recorded request.
   */
  public getLastRequest(): RecordedRequest | undefined {
    return this.recordedRequests[this.recordedRequests.length - 1];
  }

  /**
   * Extracts the Bearer token from the last request's Authorization header.
   */
  public getLastBearerToken(): string | undefined {
    const last = this.getLastRequest();
    const auth = last?.headers['authorization'];
    if (!auth || typeof auth !== 'string') return undefined;
    const match = auth.match(/^Bearer\s+(.*)$/i);
    return match ? match[1] : undefined;
  }

  /**
   * Extracts the system prompt from the last request's messages array.
   */
  public getLastSystemPrompt(): string | undefined {
    const last = this.getLastRequest();
    if (!last?.body?.messages || !Array.isArray(last.body.messages)) return undefined;
    const sys = last.body.messages.find((m: any) => m.role === 'system');
    return sys?.content;
  }

  /**
   * Extracts the last user message from the messages array.
   */
  public getLastUserMessage(): string | undefined {
    const last = this.getLastRequest();
    if (!last?.body?.messages || !Array.isArray(last.body.messages)) return undefined;
    const userMessages = last.body.messages.filter((m: any) => m.role === 'user');
    return userMessages[userMessages.length - 1]?.content;
  }

  /**
   * Processes an incoming request body and headers.
   * Centralized logic used by both the HTTP server and direct test harness dispatches.
   */
  public processRequest(
    method: string,
    url: string,
    headers: Record<string, string | string[] | undefined>,
    rawBody: string
  ): ProcessedResponse {
    // Normalize headers to lowercase keys (conforming to Node http.IncomingHttpHeaders)
    const normalizedHeaders: http.IncomingHttpHeaders = {};
    for (const [k, v] of Object.entries(headers)) {
      normalizedHeaders[k.toLowerCase()] = v as any;
    }

    let parsedBody: any = {};
    try {
      parsedBody = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        isStream: false,
        body: { error: { message: 'Invalid JSON body' } }
      };
    }

    // Record request
    this.recordedRequests.push({
      timestamp: Date.now(),
      method,
      url,
      headers: normalizedHeaders,
      body: parsedBody
    });

    // Per-request header overrides
    const overrideMode =
      (normalizedHeaders['x-mock-mode'] as MockBehaviorMode) || this.options.mode;
    const overrideStatus = normalizedHeaders['x-mock-status']
      ? parseInt(normalizedHeaders['x-mock-status'] as string, 10)
      : this.options.errorCode;

    // Handle Custom HTML Error (e.g. 502 with HTML body)
    if (overrideMode === 'custom_html_error' || this.options.customHtmlBody) {
      const status = overrideStatus || this.options.errorCode || 502;
      return {
        statusCode: status,
        headers: { 'Content-Type': 'text/html' },
        isStream: false,
        body: this.options.customHtmlBody || '<html><body>502 Bad Gateway</body></html>'
      };
    }

    // Handle Error Mode
    if (overrideMode === 'error' || overrideStatus) {
      const status = overrideStatus || 500;
      const msg = this.options.errorMessage || `Simulated error ${status}`;
      const resHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (status === 429 && this.options.retryAfterSeconds) {
        resHeaders['Retry-After'] = String(this.options.retryAfterSeconds);
      }

      return {
        statusCode: status,
        headers: resHeaders,
        isStream: false,
        body: {
          error: {
            message: msg,
            type:
              status === 401
                ? 'invalid_request_error'
                : status === 429
                  ? 'insufficient_quota'
                  : status === 404
                    ? 'model_not_found'
                    : 'api_error',
            code:
              status === 401
                ? 'invalid_api_key'
                : status === 429
                  ? 'insufficient_quota'
                  : null
          }
        }
      };
    }

    // Determine response text
    let responseContent = this.options.customResponseText || '';
    if (overrideMode === 'echo_system_prompt') {
      const sysMsg = (parsedBody.messages || []).find((m: any) => m.role === 'system');
      responseContent = sysMsg
        ? `System prompt received: [${sysMsg.content}]`
        : 'No system prompt received.';
    }

    // Handle Non-Streaming Mode
    if (parsedBody.stream === false || overrideMode === 'non_streaming') {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        isStream: false,
        body: {
          id: `mockcmpl-${Date.now()}`,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: parsedBody.model || 'mock-model',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: responseContent
              },
              finish_reason: 'stop'
            }
          ],
          usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
        }
      };
    }

    // Handle Streaming SSE Mode
    const chunks: string[] = [];
    const initialChunk = {
      id: `mockcmpl-${Date.now()}`,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: parsedBody.model || 'mock-model',
      choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }]
    };
    chunks.push(`data: ${JSON.stringify(initialChunk)}\n\n`);

    const words = responseContent.split(' ');
    let abrupt = false;
    for (let i = 0; i < words.length; i++) {
      if (overrideMode === 'abrupt_disconnect' && i === Math.floor(words.length / 2)) {
        abrupt = true;
        break;
      }
      const token = i === 0 ? words[i] : ` ${words[i]}`;
      const chunk = {
        id: `mockcmpl-${Date.now()}`,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: parsedBody.model || 'mock-model',
        choices: [{ index: 0, delta: { content: token }, finish_reason: null }]
      };
      chunks.push(`data: ${JSON.stringify(chunk)}\n\n`);
    }

    if (!abrupt) {
      const finalChunk = {
        id: `mockcmpl-${Date.now()}`,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: parsedBody.model || 'mock-model',
        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }]
      };
      chunks.push(`data: ${JSON.stringify(finalChunk)}\n\n`);
      chunks.push('data: [DONE]\n\n');
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive'
      },
      isStream: true,
      chunks,
      abruptDisconnect: abrupt
    };
  }

  /**
   * Starts the HTTP server on dynamic port 0.
   * Resolves with the base URL (e.g., "http://127.0.0.1:54321/v1").
   */
  public async start(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        const url = req.url || '';
        const method = req.method || 'GET';
        const pathname = url.split('?')[0].replace(/\/+$/, '');

        // Endpoint: Reset
        if (method === 'POST' && (pathname === '/mock/reset' || pathname === '/v1/mock/reset')) {
          this.reset();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok' }));
          return;
        }

        // Endpoint: Inspect requests
        if (method === 'GET' && (pathname === '/mock/requests' || pathname === '/v1/mock/requests')) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(this.recordedRequests));
          return;
        }

        // Endpoint: Chat completions
        const isChatCompletion =
          pathname === '/v1/chat/completions' ||
          pathname === '/chat/completions' ||
          pathname.endsWith('/chat/completions');

        if (method === 'POST' && isChatCompletion) {
          const bodyChunks: Buffer[] = [];
          let clientAborted = false;

          req.on('data', (c) => bodyChunks.push(typeof c === 'string' ? Buffer.from(c) : c));
          req.on('close', () => {
            if (!res.writableEnded) {
              clientAborted = true;
              this.lastRequestAborted = true;
            }
          });

          req.on('end', async () => {
            if (clientAborted) return;
            const rawBody = Buffer.concat(bodyChunks).toString('utf-8');
            const processed = this.processRequest(method, url, req.headers as any, rawBody);

            res.writeHead(processed.statusCode, processed.headers);

            if (!processed.isStream) {
              const bodyStr =
                typeof processed.body === 'string'
                  ? processed.body
                  : JSON.stringify(processed.body);
              res.end(bodyStr);
              return;
            }

            // Stream SSE chunks
            for (const chunk of processed.chunks || []) {
              if (clientAborted) break;
              if (this.options.streamDelayMs && this.options.streamDelayMs > 0) {
                await new Promise((r) => setTimeout(r, this.options.streamDelayMs));
                if (clientAborted) break;
              }
              res.write(chunk);
            }

            if (processed.abruptDisconnect) {
              await new Promise((r) => setTimeout(r, 20));
              req.socket.destroy();
              return;
            }

            if (!clientAborted) {
              res.end();
            }
          });
          return;
        }

        // Unhandled route -> 404
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: `Not found: ${method} ${url}` } }));
      });

      this.server.on('connection', (socket: Socket) => {
        this.activeSockets.add(socket);
        socket.on('close', () => this.activeSockets.delete(socket));
      });

      this.server.on('error', (err) => reject(err));

      this.server.listen(0, '127.0.0.1', () => {
        const addr = this.server!.address() as AddressInfo;
        this.port = addr.port;
        this.isRunning = true;
        MockOpenAIServer.activeServers.set(this.port, this);
        resolve(`http://127.0.0.1:${addr.port}/v1`);
      });
    });
  }

  /**
   * Shuts down the HTTP server and forcibly cleans up all lingering connections.
   */
  public async stop(): Promise<void> {
    this.isRunning = false;
    MockOpenAIServer.activeServers.delete(this.port);

    for (const socket of this.activeSockets) {
      socket.destroy();
    }
    this.activeSockets.clear();

    return new Promise((resolve, reject) => {
      if (this.server) {
        this.server.close((err) => {
          this.server = null;
          if (err) reject(err);
          else resolve();
        });
      } else {
        resolve();
      }
    });
  }

  public getPort(): number {
    return this.port;
  }

  public getBaseUrl(): string {
    return `http://127.0.0.1:${this.port}/v1`;
  }

  public isServerRunning(): boolean {
    return this.isRunning;
  }

  public wasLastRequestAborted(): boolean {
    return this.lastRequestAborted;
  }
}
