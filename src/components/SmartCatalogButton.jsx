import { Check, KeyRound, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '../context/ToastContext';
import { runSmartCataloging } from '../services/geminiApi';

export function SmartCatalogButton({
  item,
  geminiKey = '',
  onApplyFields,
  onOpenGeminiSettings,
}) {
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [done, setDone] = useState(false);

  const handleRun = async () => {
    setErrorMsg('');
    setDone(false);

    if (!geminiKey) {
      setErrorMsg('Configure sua chave gratuita do Google Gemini no Perfil.');
      return;
    }

    if (!item?.title?.trim()) {
      setErrorMsg('Informe ao menos o título da obra para catalogar.');
      return;
    }

    setIsLoading(true);
    try {
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
        updates.publisher = enriched.publisher;
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
      setDone(true);
      showToast({ message: 'Ficha completada com Gemini', type: 'success' });
      setTimeout(() => setDone(false), 3000);
    } catch (error) {
      setErrorMsg(error.message || 'Falha ao consultar Gemini.');
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
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-accent/45 bg-accent/15 px-3 py-2.5 text-xs font-semibold text-ink transition-colors hover:bg-accent/25 disabled:opacity-55"
      >
        {done ? (
          <>
            <Check className="h-3.5 w-3.5 text-accent" />
            <span>Ficha completada com Gemini</span>
          </>
        ) : (
          <>
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            <span>
              {isLoading
                ? 'Catalogando com Gemini...'
                : 'Catalogação Inteligente (Gemini)'}
            </span>
          </>
        )}
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
    </div>
  );
}
