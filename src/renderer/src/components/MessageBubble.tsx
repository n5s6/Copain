import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, Check, Copy, User } from 'lucide-react';
import { ChatMessage } from '../../../shared/types';
import { Translations } from '../i18n';

interface MessageBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
  t: Translations['message'];
}

export function MessageBubble({
  message,
  isStreaming = false,
  t
}: MessageBubbleProps): React.JSX.Element {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = async (): Promise<void> => {
    if (!message.content) return;
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard write may fail if window is unfocused
    }
  };

  return (
    <div className={`flex w-full gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-800 text-indigo-400">
          <Bot className="h-4 w-4" />
        </div>
      )}

      <div
        className={`group relative max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed select-text ${
          isUser
            ? 'bg-indigo-600 text-white shadow-sm'
            : 'border border-slate-800 bg-slate-800/70 text-slate-100'
        }`}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
        ) : (
          <div className="markdown-body space-y-2.5 break-words">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => (
                  <h1 className="mt-3 mb-1.5 text-lg font-bold text-white first:mt-0">{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 className="mt-3 mb-1.5 text-base font-semibold text-white first:mt-0">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="mt-2.5 mb-1 text-sm font-semibold text-slate-100 first:mt-0">
                    {children}
                  </h3>
                ),
                p: ({ children }) => <p className="leading-relaxed">{children}</p>,
                ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
                li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                blockquote: ({ children }) => (
                  <blockquote className="border-l-2 border-indigo-500/60 pl-3 italic text-slate-300">
                    {children}
                  </blockquote>
                ),
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-400 underline decoration-indigo-400/50 underline-offset-2 hover:text-indigo-300"
                  >
                    {children}
                  </a>
                ),
                hr: () => <hr className="my-3 border-slate-700/80" />,
                table: ({ children }) => (
                  <div className="my-2 overflow-x-auto rounded-lg border border-slate-700/80">
                    <table className="w-full border-collapse text-left text-xs">{children}</table>
                  </div>
                ),
                thead: ({ children }) => <thead className="bg-slate-900/80 text-slate-200">{children}</thead>,
                th: ({ children }) => (
                  <th className="border-b border-slate-700/80 px-3 py-2 font-semibold">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="border-b border-slate-800 px-3 py-2 text-slate-300">{children}</td>
                ),
                pre: ({ children }) => (
                  <pre className="chat-scrollbar my-2 overflow-x-auto rounded-xl border border-slate-700/70 bg-slate-950/90 p-3 font-mono text-xs leading-relaxed text-slate-200">
                    {children}
                  </pre>
                ),
                code: ({ className, children, ...props }) => {
                  const isBlock = Boolean(className?.startsWith('language-'));
                  if (isBlock) {
                    return (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  }
                  return (
                    <code
                      className="rounded bg-slate-900/90 px-1.5 py-0.5 font-mono text-xs text-indigo-300 border border-slate-700/50"
                      {...props}
                    >
                      {children}
                    </code>
                  );
                }
              }}
            >
              {message.content}
            </ReactMarkdown>
            {isStreaming && (
              <span className="inline-block h-4 w-1.5 animate-pulse rounded-sm bg-indigo-400 align-middle" />
            )}
          </div>
        )}

        {!isUser && !isStreaming && message.content.length > 0 && (
          <button
            type="button"
            onClick={() => void handleCopy()}
            title={t.copyTitle}
            className="absolute -bottom-3 right-2 hidden items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 text-[11px] text-slate-300 shadow-sm transition hover:border-slate-600 hover:text-white group-hover:flex"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-400" />
                <span>{t.copied}</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>{t.copy}</span>
              </>
            )}
          </button>
        )}
      </div>

      {isUser && (
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/30">
          <User className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}
