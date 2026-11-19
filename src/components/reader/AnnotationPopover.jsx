import { Copy, MessageSquarePlus, Quote, X } from 'lucide-react';
import { useState } from 'react';

const HIGHLIGHT_COLORS = [
  { id: 'accent', label: 'Destaque', dotClass: 'bg-accent' },
  { id: 'amber', label: 'Âmbar', dotClass: 'bg-amber-400' },
  { id: 'emerald', label: 'Esmeralda', dotClass: 'bg-emerald-400' },
  { id: 'rose', label: 'Carmim', dotClass: 'bg-rose-400' },
];

export function AnnotationPopover({
  selection,
  onHighlight,
  onQuote,
  onCopy,
  onClose,
}) {
  const [selectedColor, setSelectedColor] = useState('accent');
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');

  if (!selection?.text) return null;

  const handleSaveNote = (e) => {
    e.preventDefault();
    onHighlight?.({
      ...selection,
      color: selectedColor,
      note: noteText.trim(),
    });
    setNoteText('');
    setNoteOpen(false);
    onClose?.();
  };

  return (
    <div
      role="dialog"
      aria-label="Ações sobre o texto selecionado"
      className="fixed bottom-20 left-1/2 z-50 w-[min(92vw,380px)] -translate-x-1/2 rounded-2xl border border-accent/50 bg-card/95 p-3 shadow-2xl backdrop-blur-md"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-line">
        <div className="flex items-center gap-2">
          {HIGHLIGHT_COLORS.map((c) => {
            const active = selectedColor === c.id;
            return (
              <button
                key={c.id}
                type="button"
                aria-label={`Cor ${c.label}`}
                title={c.label}
                onClick={() => {
                  setSelectedColor(c.id);
                  if (!noteOpen) {
                    onHighlight?.({ ...selection, color: c.id, note: '' });
                    onClose?.();
                  }
                }}
                className={`flex h-8 w-8 items-center justify-center rounded-full border transition-transform ${
                  active ? 'scale-110 border-ink' : 'border-line'
                }`}
              >
                <span className={`h-4 w-4 rounded-full ${c.dotClass}`} />
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar ações de seleção"
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:text-ink"
        >
          <X className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>

      {!noteOpen ? (
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => setNoteOpen(true)}
            className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-line bg-app px-2 text-xs font-medium text-ink hover:border-accent"
          >
            <MessageSquarePlus className="h-4 w-4 text-accent" strokeWidth={1.5} />
            Anotar
          </button>

          <button
            type="button"
            onClick={() => {
              onCopy?.(selection.text);
              onClose?.();
            }}
            className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-line bg-app px-2 text-xs font-medium text-ink hover:border-accent"
          >
            <Copy className="h-4 w-4 text-accent" strokeWidth={1.5} />
            Copiar
          </button>

          <button
            type="button"
            onClick={() => {
              onQuote?.({ ...selection, color: selectedColor });
              onClose?.();
            }}
            className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-accent px-2 text-xs font-semibold text-accent-ink hover:opacity-90"
          >
            <Quote className="h-4 w-4" strokeWidth={1.5} />
            Citar
          </button>
        </div>
      ) : (
        <form onSubmit={handleSaveNote} className="mt-2.5 space-y-2">
          <textarea
            rows={2}
            autoFocus
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Escreva sua anotação sobre este trecho..."
            className="w-full resize-none rounded-xl border border-line bg-app px-3 py-2 text-xs text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setNoteOpen(false)}
              className="min-h-[40px] flex-1 rounded-xl border border-line bg-app text-xs font-medium text-muted"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="min-h-[40px] flex-1 rounded-xl bg-accent text-xs font-semibold text-accent-ink"
            >
              Salvar Nota
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
