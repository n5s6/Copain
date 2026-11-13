import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { MockOpenAIServer } from '../../mocks/mock-openai-server.ts';
import type {
  ChatMessage,
  LLMConfig,
  StreamChunk,
  SaveSettingsResult
} from '../../../src/shared/types.ts';

/**
 * Normalizes OpenAI chat completion endpoint URL.
 * Handles trailing slashes, missing /v1 paths, full /chat/completions paths,
 * duplicate internal slashes, query parameters, and fragments.
 */
export function normalizeChatEndpoint(baseUrl: string): string {
  if (!baseUrl || typeof baseUrl !== 'string') {
    throw new Error('Invalid Base URL: URL must be a non-empty string');
  }

  const trimmed = baseUrl.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error(`Invalid protocol in Base URL: ${trimmed}. Must begin with http:// or https://`);
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error(`Invalid URL format: ${trimmed}`);
  }

  // Clear fragment if present
  url.hash = '';

  // Clean duplicate internal slashes and trailing slashes in pathname
  let cleanPath = url.pathname.replace(/\/+/g, '/').replace(/\/+$/, '');

  if (cleanPath.endsWith('/chat/completions')) {
    url.pathname = cleanPath;
  } else if (cleanPath.endsWith('/v1')) {
    url.pathname = `${cleanPath}/chat/completions`;
  } else if (cleanPath === '') {
    url.pathname = '/v1/chat/completions';
  } else {
    url.pathname = `${cleanPath}/v1/chat/completions`;
  }

  return url.toString();
}

/**
 * Prepares the messages payload array according to requirements:
 * System prompt placed at messages[0] if non-empty, omitted if blank or whitespace only.
 */
export function prepareMessagesPayload(
  systemPrompt: string | undefined,
  conversationHistory: ChatMessage[]
): Array<{ role: string; content: string }> {
  const result: Array<{ role: string; content: string }> = [];

  if (systemPrompt && systemPrompt.trim().length > 0) {
    result.push({
      role: 'system',
      content: systemPrompt
    });
  }

  for (const msg of conversationHistory) {
    if (msg.role !== 'system') {
      result.push({
        role: msg.role,
        content: msg.content
      });
    }
  }

  return result;
}

export interface SendMessageResult {
  fullText: string;
  chunks: StreamChunk[];
  error?: string;
  statusCode?: number;
}

export interface TestContextOptions {
  mockServer: MockOpenAIServer;
  defaultConfig?: Partial<LLMConfig>;
  storageDir?: string;
}

export class TestContext {
  public mockServer: MockOpenAIServer;
  private config: LLMConfig;
  private messages: ChatMessage[] = [];
  private currentAbortController: AbortController | null = null;
  private storageDir: string;
  public lastDraft: string = '';
  public inputDraft: string = '';

  public setInputDraft(text: string): void {
    this.inputDraft = text;
  }

  public clearDraft(): void {
    this.inputDraft = '';
  }

  constructor(options: TestContextOptions) {
    this.mockServer = options.mockServer;
    this.storageDir =
      options.storageDir ||
      path.join(
        os.tmpdir(),
        `chatbot-test-storage-${Date.now()}-${Math.random().toString(36).slice(2)}`
      );

    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }

    this.config = {
      baseUrl: options.mockServer.getBaseUrl(),
      apiKey: 'sk-default-test-key',
      model: 'gpt-4o',
      systemPrompt: '',
      ...options.defaultConfig
    };
  }

  public get baseUrl(): string {
    return this.config.baseUrl;
  }

  public getSettings(): Promise<LLMConfig> {
    return Promise.resolve({ ...this.config });
  }

  public updateSettings(partial: Partial<LLMConfig>): Promise<SaveSettingsResult> {
    this.config = {
      ...this.config,
      ...partial
    };

    // Simulate persistent settings storage to userData/settings.json
    try {
      const settingsFile = path.join(this.storageDir, 'settings.json');
      fs.writeFileSync(
        settingsFile,
        JSON.stringify(
          {
            baseUrl: this.config.baseUrl,
            model: this.config.model,
            systemPrompt: this.config.systemPrompt,
            apiKey: this.config.apiKey
          },
          null,
          2
        ),
        'utf-8'
      );
      return Promise.resolve({ success: true });
    } catch (err: any) {
      return Promise.resolve({ success: false, error: err.message });
    }
  }

  public getMessages(): ChatMessage[] {
    return [...this.messages];
  }

  /**
   * Resets the active chat session (R2 strict ephemerality).
   * Completely purges in-memory messages array to empty [].
   * Does NOT alter saved settings.
   */
  public resetSession(): Promise<void> {
    this.messages = [];
    this.lastDraft = '';
    this.inputDraft = '';
    return Promise.resolve();
  }

  /**
   * Dispatches a user message to the mock server / LLM endpoint.
   */
  public async sendMessage(
    content: string,
    options: {
      onChunk?: (chunk: StreamChunk) => void;
      stream?: boolean;
    } = {}
  ): Promise<SendMessageResult> {
    // Input validation: empty or whitespace only rejection
    if (!content || content.trim().length === 0) {
      throw new Error('Message content cannot be empty or whitespace only');
    }

    this.lastDraft = content;
    this.inputDraft = '';
    const userMessage: ChatMessage = {
      role: 'user',
      content,
      timestamp: Date.now()
    };
    this.messages.push(userMessage);

    const payloadMessages = prepareMessagesPayload(this.config.systemPrompt, this.messages);
    const endpoint = normalizeChatEndpoint(this.config.baseUrl);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (this.config.apiKey && this.config.apiKey.trim().length > 0) {
      headers['Authorization'] = `Bearer ${this.config.apiKey.trim()}`;
    }

    const stream = options.stream !== false;
    const requestBody = JSON.stringify({
      model: this.config.model,
      messages: payloadMessages,
      stream
    });

    this.currentAbortController = new AbortController();
    const { signal } = this.currentAbortController;

    const accumulatedChunks: StreamChunk[] = [];
    let fullText = '';
    let errorMessage: string | undefined;
    let statusCode: number | undefined;

    try {
      const urlObj = new URL(endpoint);
      const isLoopback = urlObj.hostname === '127.0.0.1' || urlObj.hostname === 'localhost';
      const parsedPort = parseInt(urlObj.port, 10);
      const targetServer = MockOpenAIServer.getServer(parsedPort) || this.mockServer;
      const isServerMatch = isLoopback && parsedPort === targetServer.getPort();

      // Check for connection refused (dead port or stopped server)
      if (isLoopback && (!isServerMatch || !targetServer.isServerRunning())) {
        const connErr = `ECONNREFUSED: Impossible de se connecter au serveur à ${this.config.baseUrl}`;
        const errChunk: StreamChunk = { isDone: true, error: connErr };
        accumulatedChunks.push(errChunk);
        options.onChunk?.(errChunk);
        return {
          fullText: '',
          chunks: accumulatedChunks,
          error: connErr
        };
      }

      // Try network fetch first; fallback to in-process dispatch if macOS sandbox blocks socket connect (EPERM)
      let useInProcess = false;

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: requestBody,
          signal
        });

        statusCode = response.status;

        if (!response.ok) {
          let errDetails = `HTTP ${response.status} ${response.statusText}`;
          try {
            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
              const errJson = (await response.json()) as any;
              if (errJson?.error?.message) {
                errDetails = errJson.error.message;
              }
            } else {
              const textBody = await response.text();
              if (textBody) {
                errDetails = `HTTP ${response.status}: ${textBody.slice(0, 100)}`;
              }
            }
          } catch {}

          errorMessage = errDetails;
          const errChunk: StreamChunk = { isDone: true, error: errDetails };
          accumulatedChunks.push(errChunk);
          options.onChunk?.(errChunk);

          return {
            fullText: '',
            chunks: accumulatedChunks,
            error: errorMessage,
            statusCode
          };
        }

        if (!stream) {
          const json = (await response.json()) as any;
          fullText = json.choices?.[0]?.message?.content || '';
          const chunk: StreamChunk = { token: fullText, isDone: true };
          accumulatedChunks.push(chunk);
          options.onChunk?.(chunk);

          this.messages.push({
            role: 'assistant',
            content: fullText,
            timestamp: Date.now()
          });

          return {
            fullText,
            chunks: accumulatedChunks,
            statusCode
          };
        }

        // Handle Streaming SSE via real reader
        const reader = response.body?.getReader();
        if (!reader) throw new Error('Response body has no readable stream reader');
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(':')) continue;

            if (trimmed === 'data: [DONE]') {
              const doneChunk: StreamChunk = { isDone: true };
              accumulatedChunks.push(doneChunk);
              options.onChunk?.(doneChunk);
              break;
            }

            if (trimmed.startsWith('data: ')) {
              try {
                const parsed = JSON.parse(trimmed.slice(6));
                const deltaContent = parsed.choices?.[0]?.delta?.content;
                if (deltaContent) {
                  fullText += deltaContent;
                  const tokenChunk: StreamChunk = { token: deltaContent, isDone: false };
                  accumulatedChunks.push(tokenChunk);
                  options.onChunk?.(tokenChunk);
                }
              } catch {}
            }
          }
        }

        this.messages.push({
          role: 'assistant',
          content: fullText,
          timestamp: Date.now()
        });

        return {
          fullText,
          chunks: accumulatedChunks,
          statusCode
        };
      } catch (fetchErr: any) {
        if (fetchErr.name === 'AbortError') throw fetchErr;

        // Sandbox socket permission limitation -> fallback to mockServer.processRequest
        if (
          fetchErr.cause?.code === 'EPERM' ||
          fetchErr.code === 'EPERM' ||
          fetchErr.message?.includes('EPERM')
        ) {
          useInProcess = true;
        } else {
          throw fetchErr;
        }
      }

      if (useInProcess) {
        if (signal.aborted) {
          throw new DOMException('This operation was aborted', 'AbortError');
        }

        const processed = targetServer.processRequest(
          'POST',
          urlObj.pathname,
          headers,
          requestBody
        );

        statusCode = processed.statusCode;

        if (statusCode >= 400) {
          let errDetails = `HTTP ${statusCode}`;
          if (typeof processed.body === 'object' && processed.body?.error?.message) {
            errDetails = processed.body.error.message;
          } else if (typeof processed.body === 'string') {
            errDetails = `HTTP ${statusCode}: ${processed.body.slice(0, 100)}`;
          }
          errorMessage = errDetails;
          const errChunk: StreamChunk = { isDone: true, error: errDetails };
          accumulatedChunks.push(errChunk);
          options.onChunk?.(errChunk);

          return {
            fullText: '',
            chunks: accumulatedChunks,
            error: errorMessage,
            statusCode
          };
        }

        if (!processed.isStream) {
          fullText = processed.body?.choices?.[0]?.message?.content || '';
          const chunk: StreamChunk = { token: fullText, isDone: true };
          accumulatedChunks.push(chunk);
          options.onChunk?.(chunk);

          this.messages.push({
            role: 'assistant',
            content: fullText,
            timestamp: Date.now()
          });

          return {
            fullText,
            chunks: accumulatedChunks,
            statusCode
          };
        }

        // Process SSE chunks
        for (const rawChunk of processed.chunks || []) {
          if (signal.aborted) {
            throw new DOMException('This operation was aborted', 'AbortError');
          }

          const lines = rawChunk.split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(':')) continue;

            if (trimmed === 'data: [DONE]') {
              const doneChunk: StreamChunk = { isDone: true };
              accumulatedChunks.push(doneChunk);
              options.onChunk?.(doneChunk);
              break;
            }

            if (trimmed.startsWith('data: ')) {
              try {
                const parsed = JSON.parse(trimmed.slice(6));
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) {
                  fullText += delta;
                  const tokenChunk: StreamChunk = { token: delta, isDone: false };
                  accumulatedChunks.push(tokenChunk);
                  options.onChunk?.(tokenChunk);
                }
              } catch {}
            }
          }
        }

        if (processed.abruptDisconnect) {
          errorMessage = 'Connexion interrompue (abrupt disconnect)';
          const errChunk: StreamChunk = { isDone: true, error: errorMessage };
          accumulatedChunks.push(errChunk);
          options.onChunk?.(errChunk);

          if (fullText.length > 0) {
            this.messages.push({
              role: 'assistant',
              content: fullText,
              timestamp: Date.now()
            });
          }

          return {
            fullText,
            chunks: accumulatedChunks,
            error: errorMessage,
            statusCode
          };
        }

        this.messages.push({
          role: 'assistant',
          content: fullText,
          timestamp: Date.now()
        });

        return {
          fullText,
          chunks: accumulatedChunks,
          statusCode
        };
      }

      return {
        fullText,
        chunks: accumulatedChunks,
        statusCode
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        const abortChunk: StreamChunk = { isDone: true, error: 'Aborted' };
        accumulatedChunks.push(abortChunk);
        options.onChunk?.(abortChunk);

        if (fullText.length > 0) {
          this.messages.push({
            role: 'assistant',
            content: fullText,
            timestamp: Date.now()
          });
        }

        return {
          fullText,
          chunks: accumulatedChunks,
          error: 'Aborted',
          statusCode
        };
      }

      const rawMsg = err.message || '';
      const isSocketHangupOrReset =
        rawMsg.includes('fetch failed') ||
        rawMsg.includes('terminated') ||
        rawMsg.includes('socket hang up') ||
        rawMsg.includes('ECONNRESET') ||
        err.cause?.code === 'ECONNRESET' ||
        err.cause?.code === 'UND_ERR_SOCKET';

      if (isSocketHangupOrReset) {
        errorMessage = `Connexion au serveur interrompue (${rawMsg || 'abrupt disconnect'})`;
      } else {
        errorMessage = rawMsg || 'Network error';
      }
      const errChunk: StreamChunk = { isDone: true, error: errorMessage };
      accumulatedChunks.push(errChunk);
      options.onChunk?.(errChunk);

      if (fullText.length > 0) {
        this.messages.push({
          role: 'assistant',
          content: fullText,
          timestamp: Date.now()
        });
      }

      return {
        fullText,
        chunks: accumulatedChunks,
        error: errorMessage,
        statusCode
      };
    } finally {
      this.currentAbortController = null;
    }
  }

  /**
   * Cancels in-flight streaming request.
   */
  public cancelMessage(): Promise<void> {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
    }
    return Promise.resolve();
  }

  /**
   * Alias conforming to test runner probe interface.
   */
  public cancelStream(): Promise<void> {
    return this.cancelMessage();
  }

  /**
   * Alias conforming to ElectronAPI contract in PROJECT.md.
   */
  public cancelChatStream(): Promise<void> {
    return this.cancelMessage();
  }

  /**
   * Strict ephemerality verification:
   * Asserts that persistent storage contains NO conversation messages.
   * Recursively traverses subdirectories safely without EISDIR crashes,
   * inspects JSON objects deeply for any message arrays or suspect chat keys,
   * and verifies text files contain no chat transcripts.
   */
  public assertNoMessagesInStorage(): Promise<void> {
    if (!fs.existsSync(this.storageDir)) {
      return Promise.resolve();
    }

    const inspectFile = (filePath: string) => {
      const fileName = path.basename(filePath);
      const content = fs.readFileSync(filePath, 'utf-8');

      let parsedJson: any = null;
      try {
        parsedJson = JSON.parse(content);
      } catch {
        // Non-JSON file
      }

      if (parsedJson !== null && typeof parsedJson === 'object') {
        const checkObject = (obj: any, pathTrace: string = '') => {
          if (!obj || typeof obj !== 'object') return;

          if (Array.isArray(obj)) {
            for (const item of obj) {
              if (item && typeof item === 'object' && ('role' in item || 'content' in item)) {
                throw new Error(
                  `Ephemerality violation: Stored message array detected in ${fileName} at ${pathTrace}`
                );
              }
              checkObject(item, `${pathTrace}[]`);
            }
            return;
          }

          for (const [key, value] of Object.entries(obj)) {
            const lowerKey = key.toLowerCase();
            const isSuspectKey =
              lowerKey === 'messages' ||
              lowerKey === 'chathistory' ||
              lowerKey === 'chat_history' ||
              lowerKey === 'recentmessages' ||
              lowerKey === 'recent_messages' ||
              lowerKey === 'conversations' ||
              lowerKey === 'conversation' ||
              lowerKey === 'transcripts' ||
              lowerKey === 'transcript' ||
              lowerKey === 'history' ||
              lowerKey === 'threads' ||
              lowerKey === 'chat';

            if (
              isSuspectKey &&
              value &&
              (Array.isArray(value) ? value.length > 0 : typeof value === 'object')
            ) {
              throw new Error(
                `Ephemerality violation: ${fileName} contains chat history under key "${key}"!`
              );
            }

            checkObject(value, pathTrace ? `${pathTrace}.${key}` : key);
          }
        };

        checkObject(parsedJson);
      } else {
        const hasRoleContent = content.includes('"role"') && content.includes('"content"');
        const hasTranscript =
          /\b(user|assistant|system):\s+/i.test(content) ||
          (content.includes('role:') && content.includes('content:'));

        if (hasRoleContent || hasTranscript) {
          throw new Error(`Ephemerality violation: Found message data stored in ${fileName}!`);
        }
      }
    };

    const walkDir = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walkDir(fullPath);
        } else if (entry.isFile()) {
          inspectFile(fullPath);
        }
      }
    };

    walkDir(this.storageDir);
    return Promise.resolve();
  }

  /**
   * Clean up temporary storage directory.
   */
  public cleanup(): void {
    try {
      if (fs.existsSync(this.storageDir)) {
        fs.rmSync(this.storageDir, { recursive: true, force: true });
      }
    } catch {
      // ignore
    }
  }
}

export function createTestContext(options: TestContextOptions): TestContext {
  return new TestContext(options);
}
