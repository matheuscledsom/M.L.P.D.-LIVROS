import {
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';

export function GeminiConfigModal({
  isOpen,
  onClose,
  apiKey,
  onSaveKey,
  onClearKey,
}) {
  const [draftKey, setDraftKey] = useState(apiKey || '');
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDraftKey(apiKey || '');
      setShowKey(false);
    }
  }, [isOpen, apiKey]);

  if (!isOpen) return null;

  const hasSaved = Boolean(apiKey);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSaveKey(draftKey);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-xs"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-t-3xl border-x border-t border-line bg-card p-5 pb-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            <h3 className="text-base font-semibold text-ink">
              Inteligência Google Gemini
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-full p-1 text-muted hover:bg-elevated hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div className="rounded-2xl border border-line bg-app p-3.5 text-xs leading-relaxed text-muted">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
                <KeyRound className="h-3.5 w-3.5 text-accent" />
                Modelo gemini-2.5-flash
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  hasSaved
                    ? 'bg-accent/15 text-accent'
                    : 'bg-elevated text-subtle'
                }`}
              >
                {hasSaved && <CheckCircle2 className="h-3 w-3" />}
                {hasSaved ? 'Chave salva' : 'Não configurada'}
              </span>
            </div>
            <p>
              Sua chave gratuita do Google AI Studio é salva apenas localmente
              neste dispositivo (<code className="text-ink">localStorage</code>)
              para ativar Catalogação Inteligente, Oráculo, Recapitulação e Sínteses.
            </p>
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 font-medium text-accent hover:underline"
            >
              Gerar chave gratuita no Google AI Studio
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">
              Chave da API (Google AI Studio)
            </span>
            <div className="relative flex items-center">
              <input
                type={showKey ? 'text' : 'password'}
                value={draftKey}
                onChange={(e) => setDraftKey(e.target.value)}
                placeholder="AIza..."
                className="w-full rounded-xl border border-line bg-app py-2.5 pl-3 pr-10 font-mono text-xs text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowKey((prev) => !prev)}
                aria-label={showKey ? 'Ocultar chave' : 'Mostrar chave'}
                className="absolute right-2.5 rounded p-1 text-subtle hover:text-ink"
              >
                {showKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </label>

          <div className="flex gap-2">
            {hasSaved && (
              <button
                type="button"
                onClick={() => {
                  onClearKey();
                  setDraftKey('');
                  onClose();
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-semibold text-rose-400 hover:bg-rose-500/20"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remover
              </button>
            )}
            <button
              type="submit"
              className="flex-1 rounded-2xl bg-accent py-3 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90"
            >
              Salvar Chave
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
