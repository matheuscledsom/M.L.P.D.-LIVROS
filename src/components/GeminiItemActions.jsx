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
import {
  buildLocalReviewOrAbstractSynthesis,
  buildLocalSpoilerFreeRecap,
} from '../services/localCatalogFallback';

export function SpoilerFreeRecapAction({
  item,
  linkedPosts = [],
  geminiKey = '',
  onOpenGeminiSettings,
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [recapText, setRecapText] = useState('');
  const [modeNote, setModeNote] = useState('');

  const handleGenerateRecap = async () => {
    setModeNote('');
    if (!geminiKey) {
      setRecapText(buildLocalSpoilerFreeRecap({ item, linkedPosts }));
      setModeNote('Gerado localmente com suas anotações, citações e marcador de leitura.');
      return;
    }

    setIsLoading(true);
    try {
      const output = await runSpoilerFreeRecap(geminiKey, { item, linkedPosts });
      setRecapText(output);
      setModeNote('');
    } catch (error) {
      setRecapText(buildLocalSpoilerFreeRecap({ item, linkedPosts }));
      setModeNote(
        `${error?.userMessage || 'Gemini indisponível.'} Exibindo síntese local sem spoilers.`
      );
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
        className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[4px] border border-accent/45 bg-accent/10 py-2.5 text-xs font-semibold text-ink transition-colors hover:bg-accent/20 disabled:opacity-55"
      >
        <BookOpen className="h-4 w-4 text-accent" strokeWidth={1.5} />
        <span>
          {isLoading
            ? 'Recapitulando sem spoilers...'
            : geminiKey
              ? 'Recapitulação Sem Spoilers (Gemini)'
              : 'Recapitulação Sem Spoilers (Local)'}
        </span>
      </button>

      {modeNote && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[4px] border border-line bg-app px-3 py-2 text-[11px] text-muted">
          <span>{modeNote}</span>
          {!geminiKey && onOpenGeminiSettings && (
            <button
              type="button"
              onClick={onOpenGeminiSettings}
              className="inline-flex min-h-[32px] items-center gap-1 rounded-[4px] border border-line px-2 py-1 text-[10px] font-medium text-accent hover:border-accent"
            >
              <KeyRound className="h-3 w-3" strokeWidth={1.5} />
              Configurar Chave
            </button>
          )}
        </div>
      )}

      {recapText && (
        <div className="space-y-2 rounded-[4px] border border-accent/35 bg-app p-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-accent">
              <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} />
              Recapitulação Sem Spoilers
            </span>
            <button
              type="button"
              onClick={() => setRecapText('')}
              aria-label="Fechar recapitulação"
              className="rounded-[4px] p-1 text-subtle hover:text-ink"
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.5} />
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
  const [modeNote, setModeNote] = useState('');
  const [copied, setCopied] = useState(false);
  const [applied, setApplied] = useState(false);

  const handleSynthesize = async () => {
    setModeNote('');
    setApplied(false);

    if (!geminiKey) {
      setSynthesisText(
        buildLocalReviewOrAbstractSynthesis({ item, linkedPosts, mode })
      );
      setModeNote(
        'Síntese montada localmente a partir do seu fichamento, citações e notas.'
      );
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
      setSynthesisText(
        buildLocalReviewOrAbstractSynthesis({ item, linkedPosts, mode })
      );
      setModeNote(
        `${error?.userMessage || 'Gemini indisponível.'} Exibindo rascunho local estruturado.`
      );
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
    <div className="space-y-2.5 rounded-[4px] border border-line bg-app p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink">
          <FileText className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
          Síntese Editorial
        </span>
        <div className="flex rounded-[4px] border border-line bg-card p-0.5">
          <button
            type="button"
            onClick={() => setMode('literary')}
            className={`rounded-[2px] px-2 py-0.5 text-[10px] font-medium transition-colors ${
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
            className={`rounded-[2px] px-2 py-0.5 text-[10px] font-medium transition-colors ${
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
        className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[4px] border border-accent/45 bg-accent/10 py-2.5 text-xs font-semibold text-ink transition-colors hover:bg-accent/20 disabled:opacity-55"
      >
        <Sparkles className="h-4 w-4 text-accent" strokeWidth={1.5} />
        <span>
          {isLoading
            ? 'Sintetizando com Gemini...'
            : mode === 'academic'
              ? 'Gerar Resumo Crítico para TCC'
              : 'Gerar Resenha Literária'}
        </span>
      </button>

      {modeNote && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[4px] border border-line bg-card px-3 py-2 text-[11px] text-muted">
          <span>{modeNote}</span>
          {!geminiKey && onOpenGeminiSettings && (
            <button
              type="button"
              onClick={onOpenGeminiSettings}
              className="inline-flex min-h-[32px] items-center gap-1 rounded-[4px] border border-line px-2 py-1 text-[10px] font-medium text-accent hover:border-accent"
            >
              <KeyRound className="h-3 w-3" strokeWidth={1.5} />
              Configurar Chave
            </button>
          )}
        </div>
      )}

      {synthesisText && (
        <div className="space-y-2.5 rounded-[4px] border border-accent/35 bg-card p-3">
          <p className="whitespace-pre-line text-xs leading-relaxed text-muted">
            {synthesisText}
          </p>
          <div className="flex gap-2 border-t border-line pt-2.5">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-[4px] border border-line bg-app py-1.5 text-[11px] font-medium text-ink hover:border-accent"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
                  Copiado
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
                  Copiar
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleApply}
              className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-[4px] bg-accent py-1.5 text-[11px] font-semibold text-accent-ink hover:opacity-90"
            >
              {applied ? (
                <>
                  <Check className="h-3.5 w-3.5" strokeWidth={1.5} />
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
