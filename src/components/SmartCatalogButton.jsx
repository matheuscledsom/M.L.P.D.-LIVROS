import { Check, KeyRound, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '../context/ToastContext';
import { normalizePublisherName } from '../data/brazilianPublishers';
import { runSmartCataloging } from '../services/geminiApi';
import { runLocalSmartCataloging } from '../services/localCatalogFallback';

export function SmartCatalogButton({
  item,
  geminiKey = '',
  onApplyFields,
  onOpenGeminiSettings,
}) {
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [statusNotice, setStatusNotice] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [doneMode, setDoneMode] = useState('');

  const applyLocalFallback = async (reason = '') => {
    const localRes = await runLocalSmartCataloging(item);
    onApplyFields(localRes.updates);
    setDoneMode('local');
    setStatusNotice(
      reason
        ? `${reason} Preenchimento Inteligente Local aplicado (CDD, Cutter e metadados).`
        : 'Preenchimento Inteligente Local aplicado com CDD, Cutter e editora normalizada.'
    );
    showToast({
      message: 'Ficha completada com Preenchimento Inteligente Local',
      type: 'success',
    });
    setTimeout(() => setDoneMode(''), 3500);
  };

  const handleRun = async () => {
    setErrorMsg('');
    setStatusNotice('');
    setDoneMode('');

    if (!item?.title?.trim() && !item?.isbn && !item?.doi) {
      setErrorMsg('Informe ao menos o título da obra para catalogar.');
      return;
    }

    setIsLoading(true);
    try {
      if (!geminiKey) {
        await applyLocalFallback('');
        return;
      }

      const enriched = await runSmartCataloging(geminiKey, item);
      const updates = {};

      if (enriched.synopsis) {
        updates.synopsis = enriched.synopsis;
      }

      if (enriched.genres?.length) {
        const mergedGenres = Array.from(
          new Set([...(item.genres || []), ...enriched.genres])
        ).slice(0, 4);
        updates.genres = mergedGenres;
      }

      if (enriched.atmosphere?.length) {
        updates.atmosphere = Array.from(
          new Set([...(item.atmosphere || []), ...enriched.atmosphere])
        );
      }

      if (enriched.seriesVolume && !item.seriesVolume) {
        updates.seriesVolume = enriched.seriesVolume;
      }
      if (enriched.publisher && !item.publisher) {
        updates.publisher = normalizePublisherName(enriched.publisher);
      }
      if (enriched.translator && !item.translator) {
        updates.translator = enriched.translator;
      }
      if (enriched.demographicOrigin && item.workType === 'manga') {
        updates.demographicOrigin = enriched.demographicOrigin;
      }
      if (item.workType === 'academic') {
        if (enriched.abntReference) {
          updates.abntReference = enriched.abntReference;
        }
        if (enriched.keywords && !item.keywords) {
          updates.keywords = enriched.keywords;
        }
      }

      onApplyFields(updates);
      setDoneMode('gemini');
      showToast({ message: 'Ficha completada com Gemini', type: 'success' });
      setTimeout(() => setDoneMode(''), 3000);
    } catch (error) {
      try {
        await applyLocalFallback(
          error?.userMessage || 'Gemini indisponível no momento.'
        );
      } catch (localErr) {
        setErrorMsg(
          localErr?.message ||
            error?.userMessage ||
            'Não foi possível completar a catalogação.'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleRun}
        disabled={isLoading}
        className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[4px] border border-accent/45 bg-accent/10 px-3 py-2 text-xs font-semibold text-ink transition-colors hover:bg-accent/20 disabled:opacity-55"
      >
        {doneMode ? (
          <>
            <Check className="h-4 w-4 text-accent" strokeWidth={1.5} />
            <span>
              {doneMode === 'gemini'
                ? 'Ficha completada com Gemini'
                : 'Ficha completada localmente'}
            </span>
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4 text-accent" strokeWidth={1.5} />
            <span>
              {isLoading
                ? geminiKey
                  ? 'Catalogando com Gemini...'
                  : 'Aplicando catalogação local...'
                : geminiKey
                  ? 'Catalogação Inteligente (Gemini)'
                  : 'Preenchimento Inteligente Local'}
            </span>
          </>
        )}
      </button>

      {statusNotice && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[4px] border border-line bg-app px-3 py-2 text-[11px] text-muted">
          <span>{statusNotice}</span>
          {!geminiKey && onOpenGeminiSettings && (
            <button
              type="button"
              onClick={onOpenGeminiSettings}
              className="inline-flex min-h-[32px] items-center gap-1 rounded-[4px] border border-line px-2 py-1 text-[10px] font-medium text-accent hover:border-accent"
            >
              <KeyRound className="h-3 w-3" strokeWidth={1.5} />
              Ativar Gemini
            </button>
          )}
        </div>
      )}

      {errorMsg && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[4px] border border-line bg-app px-3 py-2 text-[11px] text-ink">
          <span>{errorMsg}</span>
          {!geminiKey && onOpenGeminiSettings && (
            <button
              type="button"
              onClick={onOpenGeminiSettings}
              className="inline-flex items-center gap-1 rounded-[4px] bg-accent px-2.5 py-1 text-[10px] font-semibold text-accent-ink"
            >
              <KeyRound className="h-3 w-3" strokeWidth={1.5} />
              Configurar Chave
            </button>
          )}
        </div>
      )}
    </div>
  );
}
