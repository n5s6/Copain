import { useCallback, useEffect, useRef, useState } from 'react';
import { ChatMessage, LLMConfig, StreamChunk } from '../../../shared/types';

export interface UseChatReturn {
  messages: ChatMessage[];
  isStreaming: boolean;
  error: string | null;
  clearError: () => void;
  sendMessage: (content: string, config: LLMConfig) => Promise<boolean>;
  stopStreaming: () => Promise<void>;
  resetChat: () => Promise<void>;
}

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const cleanupListener = useCallback(() => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanupListener();
    };
  }, [cleanupListener]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const stopStreaming = useCallback(async () => {
    cleanupListener();
    if (window.electronAPI) {
      await window.electronAPI.cancelChatStream();
    }
    setIsStreaming(false);
  }, [cleanupListener]);

  const resetChat = useCallback(async () => {
    await stopStreaming();
    setMessages([]);
    setError(null);
  }, [stopStreaming]);

  const sendMessage = useCallback(
    async (rawContent: string, config: LLMConfig): Promise<boolean> => {
      const content = rawContent.trim();
      if (!content || isStreaming) {
        return false;
      }

      if (!window.electronAPI) {
        setError("L'interface Electron n'est pas disponible.");
        return false;
      }

      setError(null);

      const userMessage: ChatMessage = {
        id: createId(),
        role: 'user',
        content,
        timestamp: Date.now()
      };

      const assistantId = createId();
      const assistantPlaceholder: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: Date.now()
      };

      const historyForApi = [...messages, userMessage];
      setMessages([...historyForApi, assistantPlaceholder]);
      setIsStreaming(true);

      cleanupListener();

      const unsubscribe = window.electronAPI.sendChatStream(
        {
          config,
          messages: historyForApi
        },
        (chunk: StreamChunk) => {
          if (chunk.token) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId ? { ...msg, content: msg.content + chunk.token } : msg
              )
            );
          }

          if (chunk.error) {
            setError(chunk.error);
            // Remove empty assistant placeholder if no tokens arrived
            setMessages((prev) =>
              prev.filter((msg) => !(msg.id === assistantId && msg.content.length === 0))
            );
          }

          if (chunk.isDone) {
            cleanupListener();
            setIsStreaming(false);
          }
        }
      );

      cleanupRef.current = unsubscribe;
      return true;
    },
    [isStreaming, messages, cleanupListener]
  );

  return {
    messages,
    isStreaming,
    error,
    clearError,
    sendMessage,
    stopStreaming,
    resetChat
  };
}

