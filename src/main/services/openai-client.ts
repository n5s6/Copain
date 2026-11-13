import { ChatMessage, SendMessagePayload, StreamChunk } from '../../shared/types';

/**
 * Normalizes an OpenAI-compatible base URL into a full `/chat/completions` endpoint URL.
 * Handles trailing slashes, missing `/v1` segments, full `/chat/completions` paths, and duplicate slashes.
 */
export function normalizeChatEndpoint(baseUrl: string): string {
  if (!baseUrl || typeof baseUrl !== 'string') {
    throw new Error('URL de base invalide : veuillez renseigner une URL.');
  }

  const trimmed = baseUrl.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error(
      `Protocole invalide dans l'URL "${trimmed}". L'URL doit commencer par http:// ou https://`
    );
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error(`Format d'URL invalide : ${trimmed}`);
  }

  url.hash = '';
  const cleanPath = url.pathname.replace(/\/+/g, '/').replace(/\/+$/, '');

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
 * Builds the OpenAI `messages` array for `/chat/completions`:
 * - Places non-empty `systemPrompt` (instructions) at index 0 with role `system`.
 * - Omits `systemPrompt` if empty or whitespace-only.
 * - Filters out any stray `system` messages in conversation history and preserves turn order.
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

function extractErrorMessage(status: number, bodyText: string): string {
  const trimmed = bodyText.trim();
  if (trimmed) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed?.error?.message) {
        return `Erreur API (${status}) : ${parsed.error.message}`;
      }
      if (typeof parsed?.error === 'string') {
        return `Erreur API (${status}) : ${parsed.error}`;
      }
      if (parsed?.message) {
        return `Erreur API (${status}) : ${parsed.message}`;
      }
    } catch {
      // Non-JSON body (e.g., HTML 502 Bad Gateway)
    }
    const snippet = trimmed.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180);
    if (snippet) {
      return `Erreur HTTP ${status} : ${snippet}`;
    }
  }
  return `Erreur HTTP ${status}`;
}

function parseSseDataLine(line: string): { token?: string; isDone: boolean } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith(':')) {
    return null;
  }
  if (!trimmed.startsWith('data:')) {
    return null;
  }

  const dataStr = trimmed.slice(5).trim();
  if (dataStr === '[DONE]') {
    return { isDone: true };
  }

  try {
    const parsed = JSON.parse(dataStr);
    const delta = parsed?.choices?.[0]?.delta?.content;
    if (typeof delta === 'string' && delta.length > 0) {
      return { token: delta, isDone: false };
    }
    const finishReason = parsed?.choices?.[0]?.finish_reason;
    if (finishReason && delta === undefined) {
      return null;
    }
  } catch {
    // Ignore malformed JSON chunks without crashing the stream
  }

  return null;
}

/**
 * Streams a chat completion from an OpenAI-compatible `/v1/chat/completions` endpoint.
 * Supports both SSE streaming and non-streaming JSON fallback responses.
 */
export async function streamChatCompletion(
  payload: SendMessagePayload,
  onChunk: (chunk: StreamChunk) => void,
  signal?: AbortSignal
): Promise<void> {
  const { config, messages } = payload;

  if (!config.model || !config.model.trim()) {
    onChunk({ isDone: true, error: 'Veuillez configurer un nom de modèle dans les paramètres.' });
    return;
  }

  let endpoint: string;
  try {
    endpoint = normalizeChatEndpoint(config.baseUrl);
  } catch (err) {
    onChunk({
      isDone: true,
      error: err instanceof Error ? err.message : 'URL de base invalide.'
    });
    return;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream'
  };

  const trimmedKey = config.apiKey?.trim();
  if (trimmedKey) {
    headers['Authorization'] = `Bearer ${trimmedKey}`;
  }

  const body = JSON.stringify({
    model: config.model.trim(),
    messages: prepareMessagesPayload(config.systemPrompt, messages),
    stream: true
  });

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body,
      signal
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      onChunk({ isDone: true });
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    onChunk({
      isDone: true,
      error: `Impossible de joindre le serveur LLM (${endpoint}) : ${message}`
    });
    return;
  }

  if (!response.ok) {
    let errorBody = '';
    try {
      errorBody = await response.text();
    } catch {
      // Ignore body read error
    }
    onChunk({
      isDone: true,
      error: extractErrorMessage(response.status, errorBody)
    });
    return;
  }

  const contentType = response.headers.get('content-type') || '';

  // Non-streaming JSON fallback
  if (contentType.includes('application/json') || !response.body) {
    try {
      const json = await response.json();
      const content = json?.choices?.[0]?.message?.content;
      if (typeof content === 'string' && content.length > 0) {
        onChunk({ token: content, isDone: false });
      }
      onChunk({ isDone: true });
    } catch (err) {
      onChunk({
        isDone: true,
        error: `Réponse JSON invalide du serveur : ${err instanceof Error ? err.message : String(err)}`
      });
    }
    return;
  }

  // SSE streaming
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let doneSent = false;

  const onAbort = (): void => {
    void reader.cancel().catch(() => {});
  };
  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    while (true) {
      if (signal?.aborted) {
        if (!doneSent) {
          doneSent = true;
          onChunk({ isDone: true });
        }
        return;
      }

      const { value, done } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (signal?.aborted) {
          if (!doneSent) {
            doneSent = true;
            onChunk({ isDone: true });
          }
          return;
        }
        const parsed = parseSseDataLine(line);
        if (!parsed) continue;

        if (parsed.isDone) {
          doneSent = true;
          onChunk({ isDone: true });
          return;
        }
        if (parsed.token) {
          onChunk({ token: parsed.token, isDone: false });
        }
      }
    }

    // Flush any remaining buffered line
    if (!signal?.aborted && buffer.trim().length > 0) {
      const parsed = parseSseDataLine(buffer);
      if (parsed?.token) {
        onChunk({ token: parsed.token, isDone: false });
      } else if (parsed?.isDone) {
        doneSent = true;
        onChunk({ isDone: true });
        return;
      }
    }

    if (!doneSent) {
      onChunk({ isDone: true });
    }
  } catch (err) {
    if (signal?.aborted || (err instanceof Error && err.name === 'AbortError')) {
      if (!doneSent) {
        onChunk({ isDone: true });
      }
      return;
    }
    onChunk({
      isDone: true,
      error: `Connexion interrompue pendant le streaming : ${err instanceof Error ? err.message : String(err)}`
    });
  } finally {
    signal?.removeEventListener('abort', onAbort);
    reader.releaseLock();
  }
}
