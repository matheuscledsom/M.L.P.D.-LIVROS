import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  HelpCircle,
  ListTree,
  Maximize2,
  Minimize2,
  Search,
  Settings2,
} from 'lucide-react';
import { useState } from 'react';

export function ReaderToolbar({
  title,
  formatLabel,
  visible,
  progressPct = 0,
  positionLabel = '',
  chapterLabel = '',
  estimatedMinutesRemaining = 0,
  chapters = [],
  isBookmarked = false,
  isFullscreen = false,
  onBack,
  onToggleToc,
  onOpenSearch,
  onToggleSettings,
  onToggleBookmark,
  onToggleFullscreen,
  onToggleHelp,
  onScrubPercent,
}) {
  const [scrubbingPct, setScrubbingPct] = useState(null);
  const shownPct = scrubbingPct !== null ? scrubbingPct : Math.round(progressPct || 0);

  const hoveredChapter =
    scrubbingPct !== null && chapters.length > 0
      ? chapters.reduce((best, ch) => {
          const chPct = Number(ch.pct ?? -1);
          if (chPct >= 0 && chPct <= scrubbingPct) return ch;
          return best;
        }, chapters[0])
      : null;

  return (
    <>
      {/* Indicador de progresso fino fixo no topo (sempre visível) */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 bg-transparent"
      >
        <div
          className="h-full bg-accent transition-[width] duration-200"
          style={{ width: `${Math.max(0, Math.min(100, progressPct || 0))}%` }}
        />
      </div>

      {/* Barra Superior */}
      <header
        className={`fixed inset-x-0 top-0 z-40 border-b border-line bg-card/92 backdrop-blur-md transition-all duration-200 ${
          visible
            ? 'translate-y-0 opacity-100'
            : '-translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              aria-label="Fechar leitor"
              title="Fechar leitor (Esc)"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-ink hover:bg-elevated"
            >
              <ArrowLeft className="h-5 w-5 text-accent" strokeWidth={1.5} />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-xs sm:text-sm font-semibold text-ink">
                  {title || 'Leitor Códice'}
                </h1>
                {formatLabel && (
                  <span className="shrink-0 rounded-md border border-accent/40 bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-accent">
                    {formatLabel}
                  </span>
                )}
              </div>
              {chapterLabel && (
                <p className="truncate text-[11px] text-muted">{chapterLabel}</p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
            <button
              type="button"
              onClick={onToggleToc}
              aria-label="Abrir índice e anotações"
              title="Índice e Anotações (T)"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-muted hover:bg-elevated hover:text-ink"
            >
              <ListTree className="h-4 w-4 text-accent" strokeWidth={1.5} />
            </button>

            <button
              type="button"
              onClick={onOpenSearch}
              aria-label="Buscar no texto"
              title="Buscar no texto (/)"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-muted hover:bg-elevated hover:text-ink"
            >
              <Search className="h-4 w-4 text-accent" strokeWidth={1.5} />
            </button>

            <button
              type="button"
              onClick={onToggleBookmark}
              aria-label={isBookmarked ? 'Remover marcador' : 'Adicionar marcador'}
              title="Alternar marcador"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-accent hover:bg-elevated"
            >
              {isBookmarked ? (
                <BookmarkCheck className="h-4 w-4 fill-current" strokeWidth={1.5} />
              ) : (
                <Bookmark className="h-4 w-4" strokeWidth={1.5} />
              )}
            </button>

            <button
              type="button"
              onClick={onToggleSettings}
              aria-label="Ajustes de leitura e tema"
              title="Ajustes do leitor"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-muted hover:bg-elevated hover:text-ink"
            >
              <Settings2 className="h-4 w-4 text-accent" strokeWidth={1.5} />
            </button>

            <button
              type="button"
              onClick={onToggleFullscreen}
              aria-label={isFullscreen ? 'Sair de tela cheia' : 'Tela cheia'}
              title="Tela cheia (F)"
              className="hidden sm:flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-muted hover:bg-elevated hover:text-ink"
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4 text-accent" strokeWidth={1.5} />
              ) : (
                <Maximize2 className="h-4 w-4 text-accent" strokeWidth={1.5} />
              )}
            </button>

            <button
              type="button"
              onClick={onToggleHelp}
              aria-label="Atalhos de teclado"
              title="Atalhos (?)"
              className="hidden sm:flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-muted hover:bg-elevated hover:text-ink"
            >
              <HelpCircle className="h-4 w-4 text-accent" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </header>

      {/* Barra Inferior com Scrubber de Progresso */}
      <footer
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/92 backdrop-blur-md transition-all duration-200 pb-[env(safe-area-inset-bottom)] ${
          visible
            ? 'translate-y-0 opacity-100'
            : 'translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        <div className="mx-auto max-w-5xl px-4 py-3 space-y-2 relative">
          {scrubbingPct !== null && (
            <div className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 rounded-xl border border-accent/50 bg-card px-3 py-1.5 text-[11px] font-semibold text-ink shadow-xl whitespace-nowrap">
              {hoveredChapter?.label
                ? `${hoveredChapter.label} · ${scrubbingPct}%`
                : `${scrubbingPct}%`}
            </div>
          )}

          <div className="relative flex items-center">
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={shownPct}
              onInput={(e) => setScrubbingPct(Number(e.target.value))}
              onChange={(e) => {
                const next = Number(e.target.value);
                setScrubbingPct(null);
                onScrubPercent?.(next);
              }}
              aria-label="Navegar pelo progresso da obra"
              className="h-1 w-full cursor-pointer appearance-none rounded-full bg-line accent-accent"
              style={{
                background: `linear-gradient(to right, var(--accent-color) 0%, var(--accent-color) ${shownPct}%, var(--border-subtle) ${shownPct}%, var(--border-subtle) 100%)`,
              }}
            />
            {chapters.slice(0, 30).map((ch, idx) =>
              typeof ch.pct === 'number' && ch.pct > 0 && ch.pct < 100 ? (
                <span
                  key={`${ch.id || idx}`}
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 h-2 w-0.5 -translate-y-1/2 bg-ink/40"
                  style={{ left: `${ch.pct}%` }}
                />
              ) : null
            )}
          </div>

          <div className="flex items-center justify-between gap-2 text-[11px] text-muted tabular-nums">
            <span className="truncate font-medium text-ink">
              {positionLabel || `${shownPct}% lido`}
            </span>
            <span className="shrink-0">
              <strong className="font-semibold text-accent">{shownPct}%</strong>
              {estimatedMinutesRemaining > 0
                ? ` · ${estimatedMinutesRemaining} min restantes`
                : ' · Concluído'}
            </span>
          </div>
        </div>
      </footer>
    </>
  );
}
