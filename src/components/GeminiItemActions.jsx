import {
  BookOpen,
  Check,
  Copy,
  FileText,
  KeyRound,
  Sparkles,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useToast } from '../context/ToastContext';
import {
  runReviewOrAbstractSynthesis,
  runSpoilerFreeRecap,
} from '../services/geminiApi';

export function SpoilerFreeRecapAction({
  item,
  linkedPosts = [],
  geminiKey = '',
  onOpenGeminiSettings,
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [recapText, setRecapText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleGenerateRecap = async () => {
    setErrorMsg('');
    if (!geminiKey) {
      setErrorMsg('Configure sua chave gratuita do Google Gemini no Perfil.');
      return;
    }

    setIsLoading(true);
    try {
      const output = await runSpoilerFreeRecap(geminiKey, { item, linkedPosts });
      setRecapText(output);
    } catch (error) {
      setErrorMsg(error.message || 'Erro ao gerar recapitulação.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-2.5">
      <button
        type="button"
        onClick={handleGenerateRecap}
        disabled={isLoading}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-accent/45 bg-accent/15 py-2.5 text-xs font-semibold text-ink transition-colors hover:bg-accent/25 disabled:opacity-55"
      >
        <BookOpen className="h-3.5 w-3.5 text-accent" />
        <span>
          {isLoading
            ? 'Recapitulando sem spoilers...'
            : 'Recapitulação Sem Spoilers (Gemini)'}
        </span>
      </button>

      {errorMsg && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-400">
          <span>{errorMsg}</span>
          {!geminiKey && onOpenGeminiSettings && (
            <button
              type="button"
              onClick={onOpenGeminiSettings}
              className="inline-flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1 text-[10px] font-semibold text-accent-ink"
            >
              <KeyRound className="h-3 w-3" />
              Configurar Chave
            </button>
          )}
        </div>
      )}

      {recapText && (
        <div className="space-y-2 rounded-2xl border border-accent/35 bg-app p-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-accent">
              <Sparkles className="h-3.5 w-3.5" />
              Recapitulação Sem Spoilers
            </span>
            <button
              type="button"
              onClick={() => setRecapText('')}
              aria-label="Fechar recapitulação"
              className="rounded p-1 text-subtle hover:text-ink"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="whitespace-pre-line text-xs leading-relaxed text-muted">
            {recapText}
          </p>
        </div>
      )}
    </div>
  );
}

export function SynthesisReviewAction({
  item,
  linkedPosts = [],
  geminiKey = '',
  onApplyText,
  onOpenGeminiSettings,
}) {
  const { showToast } = useToast();
  const defaultMode = item.workType === 'academic' ? 'academic' : 'literary';
  const [mode, setMode] = useState(defaultMode);
  const [isLoading, setIsLoading] = useState(false);
  const [synthesisText, setSynthesisText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [applied, setApplied] = useState(false);

  const handleSynthesize = async () => {
    setErrorMsg('');
    setApplied(false);

    if (!geminiKey) {
      setErrorMsg('Configure sua chave gratuita do Google Gemini no Perfil.');
      return;
    }

    setIsLoading(true);
    try {
      const output = await runReviewOrAbstractSynthesis(geminiKey, {
        item,
        linkedPosts,
        mode,
      });
      setSynthesisText(output);
    } catch (error) {
      setErrorMsg(error.message || 'Erro ao sintetizar resenha/fichamento.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!synthesisText) return;
    try {
      await navigator.clipboard.writeText(synthesisText);
      setCopied(true);
      showToast({ message: 'Síntese copiada', type: 'success' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback silencioso
    }
  };

  const handleApply = () => {
    if (!synthesisText || !onApplyText) return;
    if (mode === 'academic') {
      onApplyText({ fichamento: synthesisText });
    } else {
      onApplyText({ notes: synthesisText });
    }
    setApplied(true);
    showToast({
      message:
        mode === 'academic'
          ? 'Resumo salvo no fichamento'
          : 'Resenha salva na review',
      type: 'success',
    });
    setTimeout(() => setApplied(false), 2200);
  };

  return (
    <div className="space-y-2.5 rounded-2xl border border-line bg-app p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink">
          <FileText className="h-3.5 w-3.5 text-accent" />
          Síntese Editorial (Gemini)
        </span>
        <div className="flex rounded-lg border border-line bg-card p-0.5">
          <button
            type="button"
            onClick={() => setMode('literary')}
            className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors ${
              mode === 'literary'
                ? 'bg-accent text-accent-ink'
                : 'text-muted hover:text-ink'
            }`}
          >
            Resenha
          </button>
          <button
            type="button"
            onClick={() => setMode('academic')}
            className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors ${
              mode === 'academic'
                ? 'bg-accent text-accent-ink'
                : 'text-muted hover:text-ink'
            }`}
          >
            Fichamento TCC
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={handleSynthesize}
        disabled={isLoading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-accent/45 bg-accent/15 py-2.5 text-xs font-semibold text-ink transition-colors hover:bg-accent/25 disabled:opacity-55"
      >
        <Sparkles className="h-3.5 w-3.5 text-accent" />
        <span>
          {isLoading
            ? 'Sintetizando com Gemini...'
            : mode === 'academic'
              ? 'Gerar Resumo Crítico para TCC'
              : 'Gerar Resenha Literária'}
        </span>
      </button>

      {errorMsg && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-400">
          <span>{errorMsg}</span>
          {!geminiKey && onOpenGeminiSettings && (
            <button
              type="button"
              onClick={onOpenGeminiSettings}
              className="inline-flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1 text-[10px] font-semibold text-accent-ink"
            >
              <KeyRound className="h-3 w-3" />
              Configurar Chave
            </button>
          )}
        </div>
      )}

      {synthesisText && (
        <div className="space-y-2.5 rounded-xl border border-accent/35 bg-card p-3">
          <p className="whitespace-pre-line text-xs leading-relaxed text-muted">
            {synthesisText}
          </p>
          <div className="flex gap-2 border-t border-line pt-2.5">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line bg-app py-1.5 text-[11px] font-medium text-ink hover:border-accent"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-accent" />
                  Copiado
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3 text-accent" />
                  Copiar
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleApply}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent py-1.5 text-[11px] font-semibold text-accent-ink hover:opacity-90"
            >
              {applied ? (
                <>
                  <Check className="h-3 w-3" />
                  Aplicado
                </>
              ) : (
                <span>
                  {mode === 'academic' ? 'Salvar no Fichamento' : 'Salvar na Review'}
                </span>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
