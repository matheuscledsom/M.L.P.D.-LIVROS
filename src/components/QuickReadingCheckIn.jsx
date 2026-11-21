import { BookOpenCheck, Check, Plus, Send } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getTodayLocalISO } from '../utils/backlogHelpers';
import { formatShortPtBrDate } from '../utils/readingCheckIn';

export function QuickReadingCheckIn({
  items = [],
  streakCount = 0,
  loggedToday = false,
  readingSessions = [],
  dailyLogs = {},
  onQuickLog,
}) {
  const activeWorks = useMemo(
    () =>
      (Array.isArray(items) ? items : [])
        .filter(
          (item) =>
            item &&
            item.inBacklog !== false &&
            (item.status === 'playing' || item.status === 'reading')
        )
        .sort((a, b) => {
          const tA = Date.parse(a.updatedAt || a.createdAt || '') || 0;
          const tB = Date.parse(b.updatedAt || b.createdAt || '') || 0;
          return tB - tA;
        }),
    [items]
  );

  const [selectedWorkId, setSelectedWorkId] = useState(
    () => activeWorks[0]?.id || ''
  );
  const [customPages, setCustomPages] = useState('');
  const [quickNote, setQuickNote] = useState('');
  const [justLoggedLabel, setJustLoggedLabel] = useState('');

  useEffect(() => {
    if (activeWorks.length === 0) {
      setSelectedWorkId('');
      return;
    }
    if (!activeWorks.some((w) => w.id === selectedWorkId)) {
      setSelectedWorkId(activeWorks[0].id);
    }
  }, [activeWorks, selectedWorkId]);

  const today = getTodayLocalISO();
  const todayStats = useMemo(() => {
    let pages = Number(dailyLogs?.[today]?.standalonePages) || 0;
    const notes = Array.isArray(dailyLogs?.[today]?.notes)
      ? [...dailyLogs[today].notes]
      : [];

    (Array.isArray(readingSessions) ? readingSessions : []).forEach((s) => {
      const sIso = String(s?.endedAt || s?.startedAt || s?.createdAt || '').slice(
        0,
        10
      );
      if (sIso === today) {
        pages += Math.max(0, Number(s?.pagesRead) || 0);
        if (s?.notes && String(s.notes).trim() && !notes.includes(String(s.notes).trim())) {
          notes.push(String(s.notes).trim());
        }
      }
    });

    return { pages, notes };
  }, [readingSessions, dailyLogs, today]);

  const triggerFeedback = (msg) => {
    setJustLoggedLabel(msg);
    setTimeout(() => {
      setJustLoggedLabel('');
    }, 3000);
  };

  const handleSubmitPages = (pagesValue) => {
    const cleanPages = Math.max(0, Math.round(Number(pagesValue) || 0));
    if (cleanPages <= 0) return;

    const targetWork = activeWorks.find((w) => w.id === selectedWorkId) || null;
    onQuickLog?.({
      workId: targetWork?.id || null,
      pages: cleanPages,
      note: quickNote.trim(),
    });
    if (quickNote.trim()) setQuickNote('');
    setCustomPages('');
    triggerFeedback(`+${cleanPages} págs registradas`);
  };

  const handleSubmitNoteOnly = (e) => {
    e.preventDefault();
    const clean = quickNote.trim();
    const typedPages = Math.max(0, Math.round(Number(customPages) || 0));
    if (!clean && typedPages <= 0) return;

    const targetWork = activeWorks.find((w) => w.id === selectedWorkId) || null;
    onQuickLog?.({
      workId: targetWork?.id || null,
      pages: typedPages,
      note: clean,
    });
    setQuickNote('');
    if (typedPages > 0) setCustomPages('');
    triggerFeedback(
      typedPages > 0 ? `+${typedPages} págs e reflexão salvas` : 'Reflexão rápida salva'
    );
  };

  return (
    <section
      aria-label="Registro Rápido de Hoje"
      className="rounded-[6px] border border-line bg-card p-3.5 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <BookOpenCheck
            className="h-4 w-4 shrink-0"
            style={{ color: loggedToday ? 'var(--accent-color)' : 'var(--text-secondary)' }}
            strokeWidth={1.5}
          />
          <div className="min-w-0">
            <h2 className="text-xs font-semibold tracking-tight text-ink">
              Registro Rápido de Hoje
            </h2>
            <p className="text-[11px] text-muted tabular-nums">
              {formatShortPtBrDate(today)} · {todayStats.pages}{' '}
              {todayStats.pages === 1 ? 'página hoje' : 'páginas hoje'} ·{' '}
              {streakCount} {streakCount === 1 ? 'dia seguido' : 'dias seguidos'}
            </p>
          </div>
        </div>

        {justLoggedLabel && (
          <span
            role="status"
            className="inline-flex items-center gap-1 rounded-[4px] border border-accent/40 bg-accent/15 px-2 py-1 text-[10px] font-semibold text-accent"
          >
            <Check className="h-3 w-3" strokeWidth={1.5} />
            {justLoggedLabel}
          </span>
        )}
      </div>

      {activeWorks.length > 0 && (
        <div>
          <label className="sr-only" htmlFor="quick-checkin-work-select">
            Obra para registro rápido
          </label>
          <select
            id="quick-checkin-work-select"
            value={selectedWorkId}
            onChange={(e) => setSelectedWorkId(e.target.value)}
            className="min-h-[40px] w-full rounded-[4px] border border-line bg-app px-2.5 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
          >
            {activeWorks.map((work) => (
              <option key={work.id} value={work.id}>
                {work.title}
                {work.totalPages ? ` (${work.currentPage || 0}/${work.totalPages} págs)` : ''}
              </option>
            ))}
            <option value="">Leitura avulsa / sem obra vinculada</option>
          </select>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => handleSubmitPages(10)}
          className="inline-flex min-h-[44px] items-center justify-center gap-1 rounded-[4px] border border-line bg-app px-3 py-2 text-xs font-semibold tabular-nums text-ink transition-colors hover:border-accent hover:text-accent"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
          +10 págs
        </button>

        <button
          type="button"
          onClick={() => handleSubmitPages(25)}
          className="inline-flex min-h-[44px] items-center justify-center gap-1 rounded-[4px] border border-line bg-app px-3 py-2 text-xs font-semibold tabular-nums text-ink transition-colors hover:border-accent hover:text-accent"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
          +25 págs
        </button>

        <div className="flex min-w-[140px] flex-1 items-center gap-1.5">
          <input
            type="number"
            min="1"
            max="5000"
            inputMode="numeric"
            value={customPages}
            onChange={(e) => setCustomPages(e.target.value)}
            placeholder="Outro valor"
            aria-label="Quantidade personalizada de páginas lidas hoje"
            className="min-h-[44px] w-full min-w-0 rounded-[4px] border border-line bg-app px-2.5 py-2 text-xs tabular-nums text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
          />
          <button
            type="button"
            disabled={!customPages || Number(customPages) <= 0}
            onClick={() => handleSubmitPages(customPages)}
            className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-[4px] bg-accent px-3 py-2 text-xs font-semibold text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-45"
          >
            Marcar
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmitNoteOnly} className="flex items-center gap-2">
        <input
          type="text"
          maxLength={240}
          value={quickNote}
          onChange={(e) => setQuickNote(e.target.value)}
          placeholder="Reflexão rápida de hoje (1 toque)..."
          aria-label="Reflexão rápida de leitura de hoje"
          className="min-h-[44px] min-w-0 flex-1 rounded-[4px] border border-line bg-app px-3 py-2 text-xs text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={!quickNote.trim()}
          aria-label="Registrar reflexão rápida"
          className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-1.5 rounded-[4px] border border-line bg-app px-3 py-2 text-xs font-medium text-ink transition-colors hover:border-accent hover:text-accent disabled:opacity-45"
        >
          <Send className="h-3.5 w-3.5" strokeWidth={1.5} />
          <span className="hidden sm:inline">Salvar</span>
        </button>
      </form>

      {todayStats.notes.length > 0 && (
        <div className="border-t border-line pt-2 text-[11px] text-muted">
          <span className="font-medium text-ink">Última reflexão de hoje: </span>
          <span>{todayStats.notes[todayStats.notes.length - 1]}</span>
        </div>
      )}
    </section>
  );
}
