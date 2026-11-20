import {
  Activity,
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
import { sanitizeGeminiKey, testGeminiConnection } from '../services/geminiApi';

export function GeminiConfigModal({
  isOpen,
  onClose,
  apiKey,
  onSaveKey,
  onClearKey,
}) {
  const [draftKey, setDraftKey] = useState(apiKey || '');
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setDraftKey(apiKey || '');
      setShowKey(false);
      setTesting(false);
      setTestResult(null);
    }
  }, [isOpen, apiKey]);

  if (!isOpen) return null;

  const hasSaved = Boolean(apiKey);

  const handleTest = async () => {
    const clean = sanitizeGeminiKey(draftKey || apiKey);
    setTesting(true);
    setTestResult(null);
    const res = await testGeminiConnection(clean);
    setTestResult(res);
    setTesting(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSaveKey(sanitizeGeminiKey(draftKey));
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Configuração da Inteligência Google Gemini"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-t-[6px] sm:rounded-[6px] border border-line bg-card p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" strokeWidth={1.5} />
            <h3 className="text-base font-semibold text-ink">
              Inteligência Google Gemini
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar configuração Gemini"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[4px] border border-line text-muted hover:text-ink"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div className="rounded-[4px] border border-line bg-app p-3.5 text-xs leading-relaxed text-muted">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
                <KeyRound className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
                Fallback Multi-Modelo Automático
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-[4px] border px-2 py-0.5 text-[10px] font-medium ${
                  hasSaved
                    ? 'border-accent/40 bg-accent/10 text-accent'
                    : 'border-line text-subtle'
                }`}
              >
                {hasSaved && <CheckCircle2 className="h-3 w-3" strokeWidth={1.5} />}
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
              <ExternalLink className="h-3 w-3" strokeWidth={1.5} />
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
                onChange={(e) => {
                  setDraftKey(e.target.value);
                  setTestResult(null);
                }}
                placeholder="AIza..."
                className="w-full min-h-[44px] rounded-[4px] border border-line bg-app py-2.5 pl-3 pr-11 font-mono text-xs text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowKey((prev) => !prev)}
                aria-label={showKey ? 'Ocultar chave' : 'Mostrar chave'}
                className="absolute right-1.5 flex min-h-[38px] min-w-[38px] items-center justify-center rounded-[4px] text-subtle hover:text-ink"
              >
                {showKey ? (
                  <EyeOff className="h-4 w-4" strokeWidth={1.5} />
                ) : (
                  <Eye className="h-4 w-4" strokeWidth={1.5} />
                )}
              </button>
            </div>
          </label>

          {/* Testar Conexão */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleTest}
              disabled={testing}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[4px] border border-line bg-app px-3 py-2 text-xs font-medium text-ink transition-colors hover:border-accent hover:text-accent disabled:opacity-55"
            >
              <Activity className="h-4 w-4 text-accent" strokeWidth={1.5} />
              <span>{testing ? 'Testando conexão...' : 'Testar Conexão'}</span>
            </button>

            {testResult && (
              <div
                role="status"
                className={`rounded-[4px] border p-3 text-xs ${
                  testResult.ok
                    ? 'border-accent/40 bg-accent/10 text-ink'
                    : 'border-line bg-app text-ink'
                }`}
              >
                {testResult.ok ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 tabular-nums">
                    <span className="font-medium text-accent">
                      Conectado: {testResult.model}
                    </span>
                    <span className="text-[11px] text-muted">
                      {testResult.latencyMs} ms
                    </span>
                  </div>
                ) : (
                  <p className="leading-relaxed text-muted">
                    {testResult.errorMessage}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            {hasSaved && (
              <button
                type="button"
                onClick={() => {
                  onClearKey();
                  setDraftKey('');
                  setTestResult(null);
                  onClose();
                }}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-[4px] border border-line bg-app px-4 py-2.5 text-xs font-semibold text-ink hover:border-accent"
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                Remover
              </button>
            )}
            <button
              type="submit"
              className="min-h-[44px] flex-1 rounded-[4px] bg-accent py-2.5 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90"
            >
              Salvar Chave
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
