import { CalendarDays } from 'lucide-react';
import { useMemo, useState } from 'react';
import { buildReadingHeatmap } from '../utils/readingCheckIn';

const LEVEL_STYLES = {
  0: { backgroundColor: 'color-mix(in srgb, var(--border-subtle) 45%, var(--bg-app))' },
  1: { backgroundColor: 'color-mix(in srgb, var(--accent-color) 28%, var(--bg-app))' },
  2: { backgroundColor: 'color-mix(in srgb, var(--accent-color) 52%, var(--bg-app))' },
  3: { backgroundColor: 'color-mix(in srgb, var(--accent-color) 76%, var(--bg-app))' },
  4: { backgroundColor: 'var(--accent-color)' },
};

export function ReadingHeatmapWidget({
  readingSessions = [],
  streakHistory = [],
  dailyLogs = {},
}) {
  const [weeksSpan, setWeeksSpan] = useState(16);
  const [selectedCell, setSelectedCell] = useState(null);

  const heatmap = useMemo(
    () =>
      buildReadingHeatmap({
        readingSessions,
        streakHistory,
        dailyLogs,
        weeks: weeksSpan,
      }),
    [readingSessions, streakHistory, dailyLogs, weeksSpan]
  );

  const displayedCell = useMemo(() => {
    if (!selectedCell) {
      for (let c = heatmap.columns.length - 1; c >= 0; c -= 1) {
        for (let r = heatmap.columns[c].length - 1; r >= 0; r -= 1) {
          if (heatmap.columns[c][r].isToday) {
            return heatmap.columns[c][r];
          }
        }
      }
      return null;
    }
    for (const col of heatmap.columns) {
      const match = col.find((cell) => cell.date === selectedCell);
      if (match) return match;
    }
    return null;
  }, [heatmap, selectedCell]);

  return (
    <section
      aria-label="Mapa de Calor de Leitura"
      className="rounded-2xl border border-line bg-card p-4 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-accent" strokeWidth={1.5} />
          <div>
            <h2 className="text-sm font-semibold text-ink">
              Mapa de Calor de Leitura
            </h2>
            <p className="text-[11px] tabular-nums text-subtle">
              {heatmap.activeDays} {heatmap.activeDays === 1 ? 'dia ativo' : 'dias ativos'} ·{' '}
              {heatmap.totalPages} págs no período
            </p>
          </div>
        </div>

        <div
          role="group"
          aria-label="Período do mapa de calor"
          className="inline-flex rounded-[4px] border border-line bg-app p-0.5"
        >
          {[
            { weeks: 16, label: '16 sem.' },
            { weeks: 52, label: 'Ano' },
          ].map((option) => {
            const active = weeksSpan === option.weeks;
            return (
              <button
                key={option.weeks}
                type="button"
                aria-pressed={active}
                onClick={() => setWeeksSpan(option.weeks)}
                className={`min-h-[36px] rounded-[2px] px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  active
                    ? 'bg-accent text-accent-ink'
                    : 'text-muted hover:text-ink'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="overflow-x-auto pb-1 no-scrollbar">
        <div
          role="grid"
          aria-label={`Grade de atividade das últimas ${weeksSpan} semanas`}
          className="inline-flex min-w-full justify-between gap-1"
        >
          {heatmap.columns.map((week, wIdx) => (
            <div key={week[0]?.date || wIdx} role="row" className="flex flex-col gap-1">
              {week.map((cell) => {
                const isSelected = displayedCell?.date === cell.date;
                return (
                  <button
                    key={cell.date}
                    type="button"
                    role="gridcell"
                    disabled={cell.isFuture}
                    title={cell.ariaLabel}
                    aria-label={cell.ariaLabel}
                    aria-pressed={isSelected}
                    onClick={() => setSelectedCell(cell.date)}
                    onFocus={() => setSelectedCell(cell.date)}
                    style={{
                      ...(LEVEL_STYLES[cell.level] || LEVEL_STYLES[0]),
                      ...(cell.isFuture ? { opacity: 0.25 } : {}),
                    }}
                    className={`h-3.5 w-3.5 shrink-0 rounded-[2px] border transition-colors ${
                      isSelected
                        ? 'border-accent'
                        : cell.isToday
                          ? 'border-ink/60'
                          : 'border-transparent'
                    }`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2.5 text-[11px]">
        <div className="min-w-0 text-muted" role="status">
          {displayedCell ? (
            <span className="tabular-nums">
              <strong className="font-semibold text-ink">
                {displayedCell.prettyDate}:
              </strong>{' '}
              {displayedCell.pages > 0
                ? `${displayedCell.pages} ${displayedCell.pages === 1 ? 'página' : 'páginas'}`
                : displayedCell.sessions > 0
                  ? 'Leitura registrada'
                  : 'Sem leitura registrada'}
              {displayedCell.notes?.[0] ? ` · "${displayedCell.notes[0]}"` : ''}
            </span>
          ) : (
            <span>Toque ou navegue nos quadrados para ver os detalhes do dia.</span>
          )}
        </div>

        <div className="flex items-center gap-1 text-[10px] text-subtle" aria-hidden="true">
          <span>Menos</span>
          {[0, 1, 2, 3, 4].map((lvl) => (
            <span
              key={lvl}
              className="h-2.5 w-2.5 rounded-[2px]"
              style={LEVEL_STYLES[lvl]}
            />
          ))}
          <span>Mais</span>
        </div>
      </div>
    </section>
  );
}
