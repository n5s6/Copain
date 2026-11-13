import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Save, X } from 'lucide-react';
import { LLMConfig } from '../../../shared/types';
import { Translations } from '../i18n';

interface SettingsModalProps {
  isOpen: boolean;
  initialConfig: LLMConfig;
  t: Translations['settingsModal'];
  onClose: () => void;
  onSave: (config: LLMConfig) => Promise<void>;
}

export function SettingsModal({
  isOpen,
  initialConfig,
  t,
  onClose,
  onSave
}: SettingsModalProps): React.JSX.Element | null {
  const [draft, setDraft] = useState<LLMConfig>(initialConfig);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDraft(initialConfig);
      setValidationError(null);
      setShowKey(false);
    }
  }, [isOpen, initialConfig]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const trimmedUrl = draft.baseUrl.trim();
    const trimmedModel = draft.model.trim();

    if (!trimmedUrl || !/^https?:\/\//i.test(trimmedUrl)) {
      setValidationError(t.invalidUrlError);
      return;
    }

    if (!trimmedModel) {
      setValidationError(t.modelRequiredError);
      return;
    }

    setSaving(true);
    setValidationError(null);
    try {
      await onSave({
        baseUrl: trimmedUrl,
        apiKey: draft.apiKey.trim(),
        model: trimmedModel,
        systemPrompt: initialConfig.systemPrompt,
        language: initialConfig.language
      });
      onClose();
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : t.saveError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div>
            <h2 id="settings-modal-title" className="text-base font-semibold text-white">
              {t.title}
            </h2>
            <p className="text-xs text-slate-400">{t.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            aria-label={t.closeAria}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 p-6">
          {validationError && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {validationError}
            </div>
          )}

          <div>
            <label htmlFor="baseUrl" className="mb-1.5 block text-xs font-medium text-slate-300">
              {t.baseUrlLabel}
            </label>
            <input
              id="baseUrl"
              type="text"
              value={draft.baseUrl}
              onChange={(e) => setDraft((prev) => ({ ...prev, baseUrl: e.target.value }))}
              placeholder={t.baseUrlPlaceholder}
              className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="model" className="mb-1.5 block text-xs font-medium text-slate-300">
                {t.modelLabel}
              </label>
              <input
                id="model"
                type="text"
                value={draft.model}
                onChange={(e) => setDraft((prev) => ({ ...prev, model: e.target.value }))}
                placeholder={t.modelPlaceholder}
                className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label htmlFor="apiKey" className="mb-1.5 block text-xs font-medium text-slate-300">
                {t.apiKeyLabel} <span className="text-slate-500">{t.apiKeyOptional}</span>
              </label>
              <div className="relative">
                <input
                  id="apiKey"
                  type={showKey ? 'text' : 'password'}
                  value={draft.apiKey}
                  onChange={(e) => setDraft((prev) => ({ ...prev, apiKey: e.target.value }))}
                  placeholder={t.apiKeyPlaceholder}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/70 py-2.5 pl-3.5 pr-10 text-sm text-white placeholder-slate-500 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-white"
                  aria-label={showKey ? t.hideKeyAria : t.showKeyAria}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-300">{t.instructionsLabel}</span>
              <span className="rounded-md border border-slate-700/80 bg-slate-800/80 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                {t.readOnlyBadge}
              </span>
            </div>
            <div className="chat-scrollbar max-h-36 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-950/50 px-3.5 py-2.5 text-xs leading-relaxed text-slate-300 select-text">
              {initialConfig.systemPrompt.trim().length > 0
                ? initialConfig.systemPrompt
                : t.noCustomInstructions}
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">{t.instructionsHint}</p>
          </div>

          <div className="flex items-center justify-end gap-2.5 border-t border-slate-800 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>{saving ? t.saving : t.save}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
