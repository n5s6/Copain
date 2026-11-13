import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowDown, Guitar, Send, SlidersHorizontal, Square, X } from 'lucide-react';
import { ChatMessage, LLMConfig } from '../../../shared/types';
import { Translations } from '../i18n';
import { MessageBubble } from './MessageBubble';

interface ChatViewProps {
  messages: ChatMessage[];
  config: LLMConfig;
  isStreaming: boolean;
  error: string | null;
  t: Translations;
  onClearError: () => void;
  onSendMessage: (content: string) => Promise<boolean>;
  onStopStreaming: () => Promise<void>;
  onOpenSettings: () => void;
}

export function ChatView({
  messages,
  config,
  isStreaming,
  error,
  t,
  onClearError,
  onSendMessage,
  onStopStreaming,
  onOpenSettings
}: ChatViewProps): React.JSX.Element {
  const [input, setInput] = useState('');
  const [autoFollow, setAutoFollow] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isProgrammaticScrollRef = useRef(false);

  useEffect(() => {
    if (!autoFollow) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    isProgrammaticScrollRef.current = true;
    container.scrollTop = container.scrollHeight;
    requestAnimationFrame(() => {
      isProgrammaticScrollRef.current = false;
    });
  }, [messages, isStreaming, autoFollow]);

  const handleScroll = (): void => {
    if (isProgrammaticScrollRef.current) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    const isAtBottom = distanceFromBottom <= 32;

    if (!isAtBottom && autoFollow) {
      setAutoFollow(false);
    } else if (isAtBottom && !autoFollow) {
      setAutoFollow(true);
    }
  };

  const handleScrollToBottom = (): void => {
    setAutoFollow(true);
    const container = scrollContainerRef.current;
    if (container) {
      isProgrammaticScrollRef.current = true;
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 300);
    }
  };

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const nextHeight = Math.min(el.scrollHeight, 160);
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > 160 ? 'auto' : 'hidden';
  }, [input]);

  const handleSubmit = async (): Promise<void> => {
    if (!input.trim() || isStreaming) return;
    const draft = input;
    setInput('');
    setAutoFollow(true);
    const sent = await onSendMessage(draft);
    if (!sent) {
      setInput(draft);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  const hasSystemPrompt = config.systemPrompt.trim().length > 0;

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      {/* Messages Area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="chat-scrollbar flex-1 overflow-y-auto px-4 py-6 sm:px-6"
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-5">
          {messages.length === 0 ? (
            <div className="mt-12 flex flex-col items-center text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/20 to-violet-500/20 text-indigo-400">
                <Guitar className="h-6 w-6" />
              </div>
              <h1 className="text-xl font-semibold tracking-tight text-white">
                {t.chat.welcomeTitle}
              </h1>
              <p className="mt-1.5 max-w-md text-sm text-slate-400">
                {t.chat.welcomeSubtitle}
              </p>

              <div className="mt-6 w-full max-w-md rounded-2xl border border-slate-800 bg-slate-800/40 p-4 text-left text-xs">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <span className="font-medium text-slate-300">{t.chat.activeConfig}</span>
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-medium text-indigo-300 transition hover:bg-slate-700 hover:text-white"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    <span>{t.chat.edit}</span>
                  </button>
                </div>

                <div className="mt-3 space-y-2 text-slate-400">
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">{t.chat.model}</span>
                    <span className="truncate font-mono text-slate-200">
                      {config.model || t.chat.notSet}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">{t.chat.endpoint}</span>
                    <span className="truncate font-mono text-slate-200">
                      {config.baseUrl || t.chat.notSet}
                    </span>
                  </div>
                  <div className="pt-1">
                    <span className="text-slate-500">{t.chat.instructionsLabel}</span>
                    <p className="mt-1 line-clamp-3 rounded-lg bg-slate-900/80 px-2.5 py-2 text-slate-300 border border-slate-800/80">
                      {hasSystemPrompt
                        ? config.systemPrompt
                        : t.chat.noCustomInstructions}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isLast = index === messages.length - 1;
              return (
                <MessageBubble
                  key={msg.id || index}
                  message={msg}
                  isStreaming={isStreaming && isLast && msg.role === 'assistant'}
                  t={t.message}
                />
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Floating Scroll-to-Bottom / Resume Follow Button */}
      {!autoFollow && messages.length > 0 && (
        <div className="pointer-events-none absolute bottom-24 left-0 right-0 z-10 flex justify-center">
          <button
            type="button"
            onClick={handleScrollToBottom}
            title={t.chat.scrollToBottomTitle}
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-slate-700/90 bg-slate-800/95 px-3.5 py-1.5 text-xs font-medium text-slate-200 shadow-lg backdrop-blur transition hover:border-indigo-500/60 hover:bg-slate-800 hover:text-white"
          >
            <ArrowDown className="h-3.5 w-3.5 text-indigo-400" />
            <span>{isStreaming ? t.chat.followResponse : t.chat.scrollToBottom}</span>
          </button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="mx-auto mb-2 w-full max-w-3xl px-4 sm:px-6">
          <div className="flex items-start justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs text-red-200">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              <span className="select-text">{error}</span>
            </div>
            <button
              type="button"
              onClick={onClearError}
              className="rounded p-0.5 text-red-300 hover:bg-red-500/20 hover:text-white"
              aria-label={t.chat.closeError}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Input Bar */}
      <div className="border-t border-slate-800/80 bg-slate-900/95 px-4 py-3.5 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-end gap-2.5">
          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t.chat.inputPlaceholder}
              disabled={isStreaming}
              className="no-scrollbar block w-full resize-none overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-800/70 px-4 py-3 text-sm leading-5 text-white placeholder-slate-400 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
            />
          </div>

          {isStreaming ? (
            <button
              type="button"
              onClick={() => void onStopStreaming()}
              title={t.chat.stopTitle}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-600 text-white shadow-sm transition hover:bg-red-500"
              aria-label={t.chat.stopAria}
            >
              <Square className="h-4 w-4 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!input.trim()}
              title={t.chat.sendTitle}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={t.chat.sendAria}
            >
              <Send className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

