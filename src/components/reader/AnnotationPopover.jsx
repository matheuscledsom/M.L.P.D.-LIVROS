import {
  Copy,
  ExternalLink,
  MessageSquarePlus,
  Quote,
  Search,
  Send,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { lookupReaderTerm } from '../../services/dictionaryApi';
import { HIGHLIGHT_COLORS } from '../../utils/readerThemes';

export function AnnotationPopover({
  selection,
  onApplyHighlight,
  onSaveToVault,
  onPublishQuote,
  onCopy,
  onClose,
}) {
  const containerRef = useRef(null);
  const abortRef = useRef(null);

  const [selectedColor, setSelectedColor] = useState('amber');
  const [appliedHighlightId, setAppliedHighlightId] = useState(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');

  const [termPanelOpen, setTermPanelOpen] = useState(false);
  const [termLoading, setTermLoading] = useState(false);
  const [termResult, setTermResult] = useState(null);

  useEffect(() => {
    setSelectedColor('amber');
    setAppliedHighlightId(null);
    setNoteOpen(false);
    setNoteText('');
    setTermPanelOpen(false);
    setTermLoading(false);
    setTermResult(null);
    abortRef.current?.abort?.();
  }, [selection?.text, selection?.cfi, selection?.startOffset]);

  useEffect(() => {
    if (!selection?.text && !termPanelOpen) return undefined;
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        if (termPanelOpen) {
          setTermPanelOpen(false);
        } else {
          onClose?.();
        }
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [selection?.text, termPanelOpen, onClose]);

  useEffect(() => () => abortRef.current?.abort?.(), []);

  if (!selection?.text) return null;

  const ensureHighlightApplied = (colorId, noteVal) => {
    const saved = onApplyHighlight?.({
      ...selection,
      id: appliedHighlightId || undefined,
      color: colorId,
      note: noteVal,
    });
    if (saved?.id) {
      setAppliedHighlightId(saved.id);
    }
    return saved;
  };

  const handleColorClick = (colorId) => {
    setSelectedColor(colorId);
    ensureHighlightApplied(colorId, noteText.trim());
  };

  const handleSaveNote = (e) => {
    e.preventDefault();
    const cleanNote = noteText.trim();
    ensureHighlightApplied(selectedColor, cleanNote);
    setNoteOpen(false);
  };

  const handleLookupTerm = async () => {
    setTermPanelOpen(true);
    setTermLoading(true);
    setTermResult(null);
    abortRef.current?.abort?.();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await lookupReaderTerm(selection.text, {
        signal: controller.signal,
      });
      if (!controller.signal.aborted && !res?.aborted) {
        setTermResult(res);
      }
    } finally {
      if (!controller.signal.aborted) {
        setTermLoading(false);
      }
    }
  };

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-label="Ações sobre o texto selecionado"
      onClick={(e) => e.stopPropagation()}
      className="fixed bottom-20 left-1/2 z-50 w-[min(94vw,430px)] -translate-x-1/2 space-y-2"
    >
      {/* Mini-card de consulta de termo */}
      {termPanelOpen && (
        <div
          className="rounded-[6px] border p-3.5"
          style={{
            backgroundColor: 'var(--reader-surface)',
            borderColor: 'var(--reader-border)',
            color: 'var(--reader-ink)',
            boxShadow: '0 2px 8px color-mix(in srgb, #000000 12%, transparent)',
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-serif text-sm font-semibold">
                {termResult?.term || selection.text}
              </p>
              {termResult?.phonetic && (
                <p
                  className="text-[11px]"
                  style={{ color: 'var(--reader-muted)' }}
                >
                  {termResult.phonetic}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setTermPanelOpen(false)}
              aria-label="Fechar definição"
              title="Fechar definição"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px]"
              style={{ color: 'var(--reader-muted)' }}
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          </div>

          <div className="mt-2 text-xs leading-relaxed">
            {termLoading ? (
              <p style={{ color: 'var(--reader-muted)' }}>Consultando termo...</p>
            ) : termResult?.ok ? (
              <>
                <p className="line-clamp-3">{termResult.definition}</p>
                <div
                  className="mt-2 flex items-center justify-between gap-2 text-[11px]"
                  style={{ color: 'var(--reader-muted)' }}
                >
                  <span>Fonte: {termResult.sourceLabel}</span>
                  {termResult.sourceUrl && (
                    <a
                      href={termResult.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 hover:underline"
                      style={{ color: 'var(--reader-accent)' }}
                    >
                      <span>abrir</span>
                      <ExternalLink className="h-3 w-3" strokeWidth={1.5} />
                    </a>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-1.5">
                <p style={{ color: 'var(--reader-muted)' }}>
                  {termResult?.error || 'Nenhuma definição disponível.'}
                </p>
                <button
                  type="button"
                  onClick={handleLookupTerm}
                  className="text-[11px] font-medium hover:underline"
                  style={{ color: 'var(--reader-accent)' }}
                >
                  tentar novamente
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Barra principal compacta: 6 cores + ações + nota inline */}
      <div
        className="rounded-[6px] border px-2.5 py-1.5"
        style={{
          backgroundColor: 'var(--reader-surface)',
          borderColor: 'var(--reader-border)',
          color: 'var(--reader-ink)',
          boxShadow: '0 2px 8px color-mix(in srgb, #000000 12%, transparent)',
        }}
      >
        <div className="flex items-center justify-between gap-1.5">
          {/* 6 pontos de cor de 16px */}
          <div className="flex items-center gap-1.5">
            {HIGHLIGHT_COLORS.map((c) => {
              const active = selectedColor === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-label={`Marcar em ${c.label}`}
                  title={c.label}
                  onClick={() => handleColorClick(c.id)}
                  className="flex min-h-[36px] min-w-[26px] items-center justify-center rounded-[4px] transition-opacity duration-150 ease-out"
                >
                  <span
                    className="h-4 w-4 rounded-full"
                    style={{
                      backgroundColor: c.swatch,
                      outline: active
                        ? '1.5px solid var(--reader-accent)'
                        : 'none',
                      outlineOffset: '2px',
                    }}
                  />
                </button>
              );
            })}
          </div>

          <span
            aria-hidden="true"
            className="h-5 w-px shrink-0"
            style={{ backgroundColor: 'var(--reader-border)' }}
          />

          {/* Ações em ícone com title/tooltip */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setNoteOpen((prev) => !prev)}
              aria-label="Adicionar nota marginal"
              title="Adicionar nota marginal"
              aria-expanded={noteOpen}
              className="flex min-h-[40px] min-w-[34px] items-center justify-center rounded-[4px] transition-colors duration-150 ease-out"
              style={{
                color: noteOpen ? 'var(--reader-accent)' : 'var(--reader-muted)',
              }}
            >
              <MessageSquarePlus className="h-4 w-4" strokeWidth={1.5} />
            </button>

            <button
              type="button"
              onClick={() => {
                onSaveToVault?.({
                  ...selection,
                  id: appliedHighlightId || undefined,
                  color: selectedColor,
                  note: noteText.trim(),
                });
                onClose?.();
              }}
              aria-label="Salvar no cofre de citações"
              title="Salvar no cofre de citações"
              className="flex min-h-[40px] min-w-[34px] items-center justify-center rounded-[4px] transition-colors duration-150 ease-out"
              style={{ color: 'var(--reader-muted)' }}
            >
              <Quote className="h-4 w-4" strokeWidth={1.5} />
            </button>

            <button
              type="button"
              onClick={handleLookupTerm}
              aria-label="Pesquisar termo"
              title="Pesquisar termo"
              className="flex min-h-[40px] min-w-[34px] items-center justify-center rounded-[4px] transition-colors duration-150 ease-out"
              style={{
                color: termPanelOpen
                  ? 'var(--reader-accent)'
                  : 'var(--reader-muted)',
              }}
            >
              <Search className="h-4 w-4" strokeWidth={1.5} />
            </button>

            <button
              type="button"
              onClick={() => {
                const hl = ensureHighlightApplied(selectedColor, noteText.trim());
                onPublishQuote?.({
                  ...selection,
                  id: hl?.id || appliedHighlightId,
                  color: selectedColor,
                  note: noteText.trim(),
                });
                onClose?.();
              }}
              aria-label="Publicar trecho no Diário"
              title="Publicar trecho no Diário"
              className="flex min-h-[40px] min-w-[34px] items-center justify-center rounded-[4px] transition-colors duration-150 ease-out"
              style={{ color: 'var(--reader-muted)' }}
            >
              <Send className="h-4 w-4" strokeWidth={1.5} />
            </button>

            <button
              type="button"
              onClick={() => {
                onCopy?.(selection.text);
                onClose?.();
              }}
              aria-label="Copiar trecho"
              title="Copiar trecho"
              className="flex min-h-[40px] min-w-[34px] items-center justify-center rounded-[4px] transition-colors duration-150 ease-out"
              style={{ color: 'var(--reader-muted)' }}
            >
              <Copy className="h-4 w-4" strokeWidth={1.5} />
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar ações"
              title="Fechar"
              className="flex min-h-[40px] min-w-[32px] items-center justify-center rounded-[4px] transition-colors duration-150 ease-out"
              style={{ color: 'var(--reader-muted)' }}
            >
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Campo de comentário marginal inline abaixo */}
        {noteOpen && (
          <form
            onSubmit={handleSaveNote}
            className="mt-2 border-t pt-2 space-y-2"
            style={{ borderColor: 'var(--reader-border)' }}
          >
            <textarea
              rows={2}
              autoFocus
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="nota marginal sobre este trecho..."
              className="w-full resize-none rounded-[4px] border px-2.5 py-1.5 text-xs focus:outline-none"
              style={{
                backgroundColor: 'var(--reader-bg)',
                borderColor: 'var(--reader-border)',
                color: 'var(--reader-ink)',
              }}
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setNoteOpen(false)}
                className="min-h-[36px] rounded-[4px] px-2.5 text-xs"
                style={{ color: 'var(--reader-muted)' }}
              >
                cancelar
              </button>
              <button
                type="submit"
                className="min-h-[36px] rounded-[4px] border px-3 text-xs font-medium"
                style={{
                  borderColor: 'var(--reader-accent)',
                  color: 'var(--reader-accent)',
                }}
              >
                salvar nota
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
