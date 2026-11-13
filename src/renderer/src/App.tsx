import React, { useEffect, useState } from 'react';
import { Guitar, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { AppLanguage, DEFAULT_LLM_CONFIG, LLMConfig } from '../../shared/types';
import { ChatView } from './components/ChatView';
import { SettingsModal } from './components/SettingsModal';
import { useChat } from './hooks/useChat';
import { TRANSLATIONS } from './i18n';

export function App(): React.JSX.Element {
  const [settings, setSettings] = useState<LLMConfig>(DEFAULT_LLM_CONFIG);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const { messages, isStreaming, error, clearError, sendMessage, stopStreaming, resetChat } =
    useChat();

  const language: AppLanguage = settings.language === 'en' ? 'en' : 'fr';
  const t = TRANSLATIONS[language];

  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI
        .loadSettings()
        .then((loaded) => {
          if (loaded) setSettings(loaded);
        })
        .catch((err) => {
          console.warn('Impossible de charger la configuration :', err);
        });
    }
  }, []);

  const handleSaveSettings = async (newSettings: LLMConfig): Promise<void> => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      const result = await window.electronAPI.saveSettings(newSettings);
      if (!result.success) {
        throw new Error(result.error || t.app.saveError);
      }
    }
    setSettings(newSettings);
  };

  const handleLanguageChange = async (nextLanguage: AppLanguage): Promise<void> => {
    if (nextLanguage === language) return;
    const updated: LLMConfig = { ...settings, language: nextLanguage };
    setSettings(updated);
    if (typeof window !== 'undefined' && window.electronAPI) {
      await window.electronAPI.saveSettings(updated).catch(() => {});
    }
  };

  return (
    <div className="flex h-screen w-screen flex-col bg-slate-900 text-slate-100">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900/95 px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
            <Guitar className="h-4 w-4" />
          </div>
          <span className="text-base font-semibold tracking-tight text-white">Copain</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Language Switcher */}
          <div
            className="inline-flex items-center rounded-xl border border-slate-800 bg-slate-800/60 p-0.5 text-[11px] font-medium"
            title={t.app.languageTitle}
            role="group"
            aria-label={t.app.languageTitle}
          >
            <button
              type="button"
              onClick={() => void handleLanguageChange('fr')}
              className={`rounded-lg px-2 py-1 transition ${
                language === 'fr'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              FR
            </button>
            <button
              type="button"
              onClick={() => void handleLanguageChange('en')}
              className={`rounded-lg px-2 py-1 transition ${
                language === 'en'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              EN
            </button>
          </div>

          <button
            type="button"
            onClick={() => void resetChat()}
            disabled={messages.length === 0 && !isStreaming}
            title={t.app.clearTitle}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-800/60 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-700 hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t.app.clear}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            title={t.app.settingsTitle}
            className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-300 transition hover:bg-indigo-500/20 hover:text-white"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>{t.app.settings}</span>
          </button>
        </div>
      </header>

      {/* Single Ephemeral Chat */}
      <ChatView
        messages={messages}
        config={settings}
        isStreaming={isStreaming}
        error={error}
        t={t}
        onClearError={clearError}
        onSendMessage={(content) => sendMessage(content, settings)}
        onStopStreaming={stopStreaming}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* LLM & System Prompt Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        initialConfig={settings}
        t={t.settingsModal}
        onClose={() => setIsSettingsOpen(false)}
        onSave={handleSaveSettings}
      />
    </div>
  );
}

export default App;
