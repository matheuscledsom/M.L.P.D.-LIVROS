import {
  ArrowLeft,
  Bookmark,
  Contrast,
  HelpCircle,
  ListTree,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Search,
  Timer,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatExactPercent } from './useReaderProgress';

function formatFocusClock(totalSeconds) {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function ReaderToolbar({
  title,
  formatLabel,
  visible,
  telemetry = null,
  progressPct = 0,
  totalPages = 0,
  chapterLabel = '',
  chapters = [],
  isBookmarked = false,
  isFullscreen = false,
  activeThemeId = 'app',
  onBack,
  onToggleToc,
  onOpenSearch,
  onCycleQuickTheme,
  onToggleSettings,
  onToggleBookmark,
  onToggleFullscreen,
  onToggleHelp,
  onScrubPercent,
}) {
  const [scrubbingPct, setScrubbingPct] = useState(null);
  const [metricMode, setMetricMode] = useState('percent');
  const [focusRunning, setFocusRunning] = useState(false);
  const [focusSeconds, setFocusSeconds] = useState(0);

  useEffect(() => {
    if (!focusRunning) return undefined;
    const id = setInterval(() => {
      setFocusSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [focusRunning]);

  const safePct = Math.max(0, Math.min(100, Number(progressPct) || 0));
  const shownPct = scrubbingPct !== null ? scrubbingPct : safePct;

  const hoveredChapter =
    scrubbingPct !== null && chapters.length > 0
      ? chapters.reduce((best, ch) => {
          const chPct = Number(ch.pct ?? -1);
          if (chPct >= 0 && chPct <= scrubbingPct) return ch;
          return best;
        }, chapters[0])
      : null;

  const estimatedHoverPage =
    scrubbingPct !== null && totalPages > 0
      ? Math.max(1, Math.min(totalPages, Math.round((scrubbingPct / 100) * totalPages)))
      : null;

  const percentDisplay =
    telemetry?.percentText ||
    `${formatExactPercent(safePct)} lido · falta ${formatExactPercent(Math.max(0, 100 - safePct))}`;
  const hasKnownPages = Boolean(
    telemetry?.hasTotalPages && totalPages > 0 && telemetry?.pagesText
  );
  const pagesDisplay = hasKnownPages ? telemetry.pagesText : '';
  const shownMetricText =
    metricMode === 'pages' && hasKnownPages ? pagesDisplay : percentDisplay;

  return (
    <>
      {/* Linha de progresso mínima fixada no topo */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[2px] bg-transparent"
      >
        <div
          className="h-full transition-[width] duration-150 ease-out"
          style={{
            width: `${safePct}%`,
            backgroundColor: 'var(--reader-accent)',
          }}
        />
      </div>

      {/* Barra Superior */}
      <header
        className={`fixed inset-x-0 top-0 z-40 border-b transition-all duration-150 ease-out ${
          visible
            ? 'translate-y-0 opacity-100'
            : '-translate-y-full opacity-0 pointer-events-none'
        }`}
        style={{
          backgroundColor: 'var(--reader-bg)',
          borderColor: 'var(--reader-border)',
          color: 'var(--reader-ink)',
        }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-3 py-1.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <button
              type="button"
              onClick={onBack}
              aria-label="Fechar leitor"
              title="Fechar leitor (Esc)"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[4px] transition-colors duration-150 ease-out"
              style={{ color: 'var(--reader-muted)', touchAction: 'manipulation' }}
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
            </button>
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <h1 className="truncate text-xs sm:text-sm font-semibold">
                  {title || 'Leitor Códice'}
                </h1>
                {formatLabel && (
                  <span
                    className="shrink-0 text-[10px] uppercase tracking-wider"
                    style={{ color: 'var(--reader-muted)' }}
                  >
                    {formatLabel}
                  </span>
                )}
              </div>
              {chapterLabel && (
                <p
                  className="truncate text-[11px]"
                  style={{ color: 'var(--reader-muted)' }}
                >
                  {chapterLabel}
                </p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={onToggleToc}
              aria-label="Abrir índice e anotações"
              title="Índice e notas (T)"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[4px] transition-colors duration-150 ease-out"
              style={{ color: 'var(--reader-muted)', touchAction: 'manipulation' }}
            >
              <ListTree className="h-4 w-4" strokeWidth={1.5} />
            </button>

            <button
              type="button"
              onClick={onOpenSearch}
              aria-label="Buscar no texto"
              title="Buscar no texto (/)"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[4px] transition-colors duration-150 ease-out"
              style={{ color: 'var(--reader-muted)', touchAction: 'manipulation' }}
            >
              <Search className="h-4 w-4" strokeWidth={1.5} />
            </button>

            <button
              type="button"
              onClick={onToggleBookmark}
              aria-label={isBookmarked ? 'Remover marcador' : 'Adicionar marcador'}
              aria-pressed={isBookmarked}
              title={isBookmarked ? 'Marcador ativo (B)' : 'Marcar página (B)'}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[4px] transition-colors duration-150 ease-out"
              style={{
                color: isBookmarked ? 'var(--reader-accent)' : 'var(--reader-muted)',
                touchAction: 'manipulation',
              }}
            >
              <Bookmark
                className={`h-4 w-4 ${isBookmarked ? 'fill-current' : ''}`}
                strokeWidth={1.5}
              />
            </button>

            <div className="inline-flex items-center">
              <button
                type="button"
                onClick={() => setFocusRunning((prev) => !prev)}
                aria-pressed={focusRunning}
                aria-label={
                  focusRunning
                    ? `Pausar timer silencioso de leitura (${formatFocusClock(focusSeconds)})`
                    : `Iniciar timer silencioso de leitura (${formatFocusClock(focusSeconds)})`
                }
                title="Timer silencioso de foco (sem alertas ou sons)"
                className="flex min-h-[44px] items-center gap-1 rounded-[4px] border px-2 text-[11px] font-medium tabular-nums transition-colors duration-150 ease-out"
                style={{
                  borderColor: 'var(--reader-border)',
                  color: focusRunning ? 'var(--reader-accent)' : 'var(--reader-muted)',
                  touchAction: 'manipulation',
                }}
              >
                {focusRunning ? (
                  <Pause className="h-3.5 w-3.5" strokeWidth={1.5} />
                ) : focusSeconds > 0 ? (
                  <Play className="h-3.5 w-3.5" strokeWidth={1.5} />
                ) : (
                  <Timer className="h-3.5 w-3.5" strokeWidth={1.5} />
                )}
                <span>{formatFocusClock(focusSeconds)}</span>
              </button>
              {focusSeconds > 0 && !focusRunning && (
                <button
                  type="button"
                  onClick={() => setFocusSeconds(0)}
                  aria-label="Zerar timer de leitura"
                  title="Zerar timer"
                  className="flex min-h-[44px] min-w-[36px] items-center justify-center rounded-[4px] transition-colors"
                  style={{ color: 'var(--reader-muted)', touchAction: 'manipulation' }}
                >
                  <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={onCycleQuickTheme}
              aria-label="Alternar tema rápido entre White, Sépia e OLED"
              title="Alternar tema (White / Sépia / OLED)"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-[4px] border px-2 text-[11px] font-medium transition-colors duration-150 ease-out"
              style={{
                borderColor: 'var(--reader-border)',
                color:
                  activeThemeId === 'white' ||
                  activeThemeId === 'sepia' ||
                  activeThemeId === 'oled'
                    ? 'var(--reader-accent)'
                    : 'var(--reader-muted)',
                touchAction: 'manipulation',
              }}
            >
              <Contrast className="h-3.5 w-3.5" strokeWidth={1.5} />
              <span className="hidden sm:inline">
                {activeThemeId === 'sepia'
                  ? 'Sépia'
                  : activeThemeId === 'oled'
                    ? 'OLED'
                    : activeThemeId === 'white'
                      ? 'White'
                      : 'Tema'}
              </span>
            </button>

            <button
              type="button"
              onClick={onToggleSettings}
              aria-label="Abrir configurações de tipografia e leitura (Aa)"
              title="Tipografia e tema (A)"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-[4px] border px-2.5 text-xs font-medium transition-colors duration-150 ease-out"
              style={{
                borderColor: 'var(--reader-border)',
                color: 'var(--reader-ink)',
                touchAction: 'manipulation',
              }}
            >
              <span className="font-serif text-[13px] font-semibold leading-none tracking-tight">
                Aa
              </span>
              <span
                className="hidden md:inline text-[11px] font-normal"
                style={{ color: 'var(--reader-muted)' }}
              >
                Tipografia
              </span>
            </button>

            <button
              type="button"
              onClick={onToggleFullscreen}
              aria-label={isFullscreen ? 'Sair de tela cheia' : 'Tela cheia'}
              title="Tela cheia (F)"
              className="hidden sm:flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[4px] transition-colors duration-150 ease-out"
              style={{
                color: isFullscreen ? 'var(--reader-accent)' : 'var(--reader-muted)',
                touchAction: 'manipulation',
              }}
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" strokeWidth={1.5} />
              ) : (
                <Maximize2 className="h-4 w-4" strokeWidth={1.5} />
              )}
            </button>

            <button
              type="button"
              onClick={onToggleHelp}
              aria-label="Atalhos de teclado"
              title="Atalhos (?)"
              className="hidden sm:flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[4px] transition-colors duration-150 ease-out"
              style={{ color: 'var(--reader-muted)', touchAction: 'manipulation' }}
            >
              <HelpCircle className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </header>

      {/* Barra Inferior: Scrubber 2px->4px + linha única dual (% / páginas · previsão) */}
      <footer
        className={`fixed inset-x-0 bottom-0 z-40 border-t transition-all duration-150 ease-out pb-[env(safe-area-inset-bottom)] ${
          visible
            ? 'translate-y-0 opacity-100'
            : 'translate-y-full opacity-0 pointer-events-none'
        }`}
        style={{
          backgroundColor: 'var(--reader-bg)',
          borderColor: 'var(--reader-border)',
          color: 'var(--reader-ink)',
        }}
      >
        <div className="relative mx-auto max-w-5xl px-4 py-2.5 space-y-1.5">
          {scrubbingPct !== null && (
            <div
              className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-[4px] border px-2.5 py-1 text-[11px] font-medium tabular-nums"
              style={{
                backgroundColor: 'var(--reader-bg)',
                borderColor: 'var(--reader-border)',
                color: 'var(--reader-ink)',
              }}
            >
              {hoveredChapter?.label ? `${hoveredChapter.label}` : 'Progresso'}
              {estimatedHoverPage ? ` · Pág. ${estimatedHoverPage}` : ''}
              {` · ${formatExactPercent(scrubbingPct)}`}
            </div>
          )}

          {/* Trilha 2px -> 4px ao passar mouse/arrastar, preenchida em var(--reader-accent) */}
          <div className="group relative flex h-6 items-center">
            <div
              className={`relative w-full overflow-hidden rounded-[2px] transition-all duration-150 ease-out ${
                scrubbingPct !== null ? 'h-[4px]' : 'h-[2px] group-hover:h-[4px]'
              }`}
              style={{ backgroundColor: 'var(--reader-border)' }}
            >
              <div
                className="h-full"
                style={{
                  width: `${shownPct}%`,
                  backgroundColor: 'var(--reader-accent)',
                }}
              />
              {chapters.slice(0, 30).map((ch, idx) =>
                typeof ch.pct === 'number' && ch.pct > 0 && ch.pct < 100 ? (
                  <span
                    key={`${ch.id || idx}`}
                    aria-hidden="true"
                    className="pointer-events-none absolute top-0 bottom-0 w-px opacity-45"
                    style={{
                      left: `${ch.pct}%`,
                      backgroundColor: 'var(--reader-ink)',
                    }}
                  />
                ) : null
              )}
            </div>

            <input
              type="range"
              min="0"
              max="100"
              step="0.1"
              value={shownPct}
              onInput={(e) => setScrubbingPct(Number(e.target.value))}
              onChange={(e) => {
                const next = Number(e.target.value);
                setScrubbingPct(null);
                onScrubPercent?.(next);
              }}
              onPointerUp={() => setScrubbingPct(null)}
              onPointerCancel={() => setScrubbingPct(null)}
              onBlur={() => setScrubbingPct(null)}
              aria-label="Navegar pelo progresso da obra"
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </div>

          {/* Linha única discreta que alterna % <-> Páginas ao toque/clique */}
          <div className="flex min-h-[36px] items-center justify-center sm:justify-start">
            <button
              type="button"
              onClick={() => {
                if (!hasKnownPages) return;
                setMetricMode((prev) => (prev === 'percent' ? 'pages' : 'percent'));
              }}
              title={
                hasKnownPages
                  ? 'Toque para alternar entre percentual e páginas'
                  : 'Percentual exato de leitura'
              }
              aria-label={`Progresso de leitura: ${shownMetricText}${
                hasKnownPages ? '. Toque para alternar visualização.' : ''
              }`}
              className={`min-h-[44px] w-full truncate text-left text-[12px] sm:text-[13px] tabular-nums transition-opacity duration-150 ease-out ${
                hasKnownPages ? 'cursor-pointer hover:opacity-80' : 'cursor-default'
              }`}
              style={{
                color: 'var(--reader-ink)',
                touchAction: 'manipulation',
              }}
            >
              {shownMetricText}
            </button>
          </div>
        </div>
      </footer>
    </>
  );
}
