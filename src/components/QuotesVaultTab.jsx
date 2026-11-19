import { Check, ImageDown, Plus, Quote, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '../context/ToastContext';
import { generateEditorialQuoteCard } from '../utils/editorialCardGenerator';

function formatQuoteDate(iso) {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
    }).format(new Date(iso));
  } catch {
    return '';
  }
}

export function QuotesVaultTab({ item, onUpdate }) {
  const { showToast } = useToast();
  const [quoteText, setQuoteText] = useState('');
  const [location, setLocation] = useState('');
  const [note, setNote] = useState('');
  const [generatingId, setGeneratingId] = useState(null);
  const [downloadedId, setDownloadedId] = useState(null);

  const quotes = Array.isArray(item.quotes) ? item.quotes : [];

  const handleAddQuote = (e) => {
    e.preventDefault();
    const cleanText = quoteText.trim();
    if (!cleanText) return;

    const newQuote = {
      id: `quote-${Date.now()}`,
      text: cleanText,
      location: location.trim(),
      note: note.trim(),
      createdAt: new Date().toISOString(),
    };

    onUpdate({ quotes: [newQuote, ...quotes] });
    showToast({ message: 'Citação salva no cofre', type: 'success' });
    setQuoteText('');
    setLocation('');
    setNote('');
  };

  const handleDeleteQuote = (quoteId) => {
    onUpdate({ quotes: quotes.filter((q) => q.id !== quoteId) });
  };

  const handleGenerateCard = async (quote) => {
    setGeneratingId(quote.id);
    try {
      await generateEditorialQuoteCard({
        quoteText: quote.text,
        location: quote.location,
        note: quote.note,
        title: item.title,
        author: item.author,
      });
      setDownloadedId(quote.id);
      showToast({
        message: 'Card Editorial 1080x1350 baixado',
        type: 'success',
      });
      setTimeout(() => {
        setDownloadedId((current) => (current === quote.id ? null : current));
      }, 2500);
    } finally {
      setGeneratingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleAddQuote}
        className="space-y-3 rounded-2xl border border-line bg-app p-3.5"
      >
        <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
          <Quote className="h-3.5 w-3.5 text-accent" />
          <span>Nova Citação ou Trecho</span>
        </div>

        <textarea
          rows={3}
          required
          value={quoteText}
          onChange={(e) => setQuoteText(e.target.value)}
          placeholder="Transcreva aqui a citação ou trecho marcante..."
          className="w-full resize-none rounded-xl border border-line bg-card px-3 py-2.5 text-xs leading-relaxed text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
        />

        <div className="grid grid-cols-1 gap-2">
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Página ou Capítulo exato (ex: Pág. 142 ou Cap. 8)"
            className="w-full rounded-xl border border-line bg-card px-3 py-2 text-xs text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
          />

          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Nota analítica ou comentário crítico (opcional)..."
            className="w-full resize-none rounded-xl border border-line bg-card px-3 py-2 text-xs leading-relaxed text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={!quoteText.trim()}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-accent py-2.5 text-xs font-semibold text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-45"
        >
          <Plus className="h-3.5 w-3.5" />
          Salvar no Cofre
        </button>
      </form>

      {/* Lista de Citações Salvas */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-muted">Cofre de Citações</span>
          <span className="text-[11px] text-subtle">
            {quotes.length} {quotes.length === 1 ? 'registro' : 'registros'}
          </span>
        </div>

        {quotes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-app px-4 py-8 text-center text-xs text-subtle">
            Nenhuma citação salva para esta obra ainda.
          </div>
        ) : (
          quotes.map((quote) => {
            const isGenerating = generatingId === quote.id;
            const isDownloaded = downloadedId === quote.id;

            return (
              <article
                key={quote.id}
                className="space-y-2.5 rounded-2xl border border-line bg-app p-3.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Quote className="h-3.5 w-3.5 shrink-0 text-accent" />
                    {quote.location && (
                      <span className="rounded-full border border-accent/40 bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">
                        {quote.location}
                      </span>
                    )}
                    {quote.createdAt && (
                      <span className="text-[10px] text-subtle">
                        {formatQuoteDate(quote.createdAt)}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteQuote(quote.id)}
                    aria-label="Excluir citação"
                    className="rounded-lg p-1 text-subtle hover:bg-rose-500/10 hover:text-rose-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <blockquote className="border-l-2 border-accent/60 pl-3 text-xs leading-relaxed text-ink">
                  {quote.text}
                </blockquote>

                {quote.note && (
                  <p className="rounded-xl border border-line bg-card px-3 py-2 text-[11px] leading-relaxed text-muted">
                    {quote.note}
                  </p>
                )}

                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={() => handleGenerateCard(quote)}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-accent/40 bg-accent/15 py-2 text-[11px] font-semibold text-ink transition-colors hover:bg-accent/25 disabled:opacity-50"
                >
                  {isDownloaded ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-accent" />
                      Card 1080x1350 baixado
                    </>
                  ) : (
                    <>
                      <ImageDown className="h-3.5 w-3.5 text-accent" />
                      {isGenerating ? 'Gerando arte...' : 'Gerar Card Editorial'}
                    </>
                  )}
                </button>
              </article>
            );
          })
        )}
      </div>

      {/* Fichamento Analítico Geral */}
      <label className="block rounded-2xl border border-line bg-app p-3.5">
        <span className="mb-1.5 block text-xs font-semibold text-ink">
          Fichamento Analítico Geral
        </span>
        <textarea
          rows={4}
          value={item.fichamento || ''}
          onChange={(e) => onUpdate({ fichamento: e.target.value })}
          placeholder="Resumo estruturado, conceitos-chave, fichamento por seção e síntese crítica..."
          className="w-full resize-none rounded-xl border border-line bg-card px-3 py-2.5 text-xs leading-relaxed text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
        />
      </label>
    </div>
  );
}
