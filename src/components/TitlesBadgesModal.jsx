import { Award, Check, Search, Sparkles, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { READER_TITLE_CATEGORIES } from '../services/readerTitlesEngine';
import { VectorIcon } from './VectorIcon';

export function TitlesBadgesModal({
  isOpen,
  onClose,
  evaluation,
  onSelectAutoMode,
  onPinTitleBadge,
}) {
  const [category, setCategory] = useState('all');
  const [onlyUnlocked, setOnlyUnlocked] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const list = evaluation?.catalog || [];
    const q = query.trim().toLowerCase();
    return list
      .filter((badge) => {
        if (category !== 'all' && badge.category !== category) return false;
        if (onlyUnlocked && !badge.unlocked) return false;
        if (!q) return true;
        return (
          badge.name.toLowerCase().includes(q) ||
          badge.description.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => Number(b.unlocked) - Number(a.unlocked) || b.progressPct - a.progressPct);
  }, [evaluation, category, onlyUnlocked, query]);

  if (!isOpen || !evaluation) return null;

  const { unlockedCount, totalCount, resolvedActiveBadge, isAutoMode, livingTitle } =
    evaluation;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Títulos e Insígnias do Leitor"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-[6px] sm:rounded-[6px] border border-line bg-card text-ink"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight text-ink">
              Títulos & Insígnias ({unlockedCount}/{totalCount})
            </h2>
            <p className="mt-0.5 truncate text-xs text-muted">
              Ativa agora: <strong className="text-accent">{resolvedActiveBadge?.name}</strong>
              {isAutoMode ? ' · Automático' : ' · Fixado'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar títulos e insígnias"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[4px] border border-line text-muted hover:text-ink"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Modo Automático ("Título Vivo") + Filtros */}
        <div className="space-y-3 border-b border-line px-5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-[4px] border border-line bg-app p-2.5">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                <Sparkles className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
                <span>Modo Automático (Título Vivo)</span>
              </p>
              <p className="truncate text-[11px] text-muted">
                {livingTitle
                  ? `Detectado na leitura atual: ${livingTitle.name}`
                  : 'Muda dinamicamente conforme a obra ou CDD que você lê/estuda.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onSelectAutoMode?.()}
              aria-pressed={isAutoMode}
              className={`min-h-[38px] shrink-0 rounded-[4px] border px-3 py-1 text-xs font-semibold transition-colors ${
                isAutoMode
                  ? 'border-accent bg-accent text-accent-ink'
                  : 'border-line bg-card text-muted hover:border-accent hover:text-ink'
              }`}
            >
              {isAutoMode ? 'Automático ativo' : 'Ativar automático'}
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1">
              {READER_TITLE_CATEGORIES.map((cat) => {
                const active = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`min-h-[34px] rounded-[4px] border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      active
                        ? 'border-accent bg-accent/15 text-accent'
                        : 'border-line bg-app text-muted hover:text-ink'
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setOnlyUnlocked((p) => !p)}
              aria-pressed={onlyUnlocked}
              className={`min-h-[34px] rounded-[4px] border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                onlyUnlocked
                  ? 'border-accent text-accent'
                  : 'border-line text-muted hover:text-ink'
              }`}
            >
              Apenas desbloqueados ({unlockedCount})
            </button>
          </div>

          <label className="relative block">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle"
              strokeWidth={1.5}
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtrar títulos por tema, CDD ou critério..."
              aria-label="Filtrar títulos e insígnias"
              className="w-full rounded-[4px] border border-line bg-app py-1.5 pl-8 pr-3 text-xs text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
            />
          </label>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2 no-scrollbar">
          {filtered.length === 0 ? (
            <div className="rounded-[4px] border border-line bg-app py-10 text-center text-xs text-muted">
              Nenhum título corresponde ao filtro aplicado.
            </div>
          ) : (
            filtered.map((badge) => {
              const isPinnedActive =
                !isAutoMode &&
                (resolvedActiveBadge?.id === badge.id ||
                  resolvedActiveBadge?.name === badge.name);

              return (
                <div
                  key={badge.id}
                  className={`rounded-[4px] border p-3 ${
                    badge.unlocked
                      ? 'border-line bg-app'
                      : 'border-line/60 bg-app/50 opacity-75'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <span
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] border ${
                          badge.unlocked
                            ? 'border-accent/40 bg-card text-accent'
                            : 'border-line bg-card text-subtle'
                        }`}
                      >
                        <VectorIcon name={badge.iconName} className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className="text-xs font-semibold text-ink">
                            {badge.name}
                          </h3>
                          <span className="rounded-[4px] border border-line bg-card px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-subtle">
                            {badge.tier}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted">
                          {badge.description}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      {badge.unlocked ? (
                        <button
                          type="button"
                          onClick={() => onPinTitleBadge?.(badge)}
                          className={`inline-flex min-h-[34px] items-center gap-1 rounded-[4px] border px-2.5 text-[11px] font-medium transition-colors ${
                            isPinnedActive
                              ? 'border-accent bg-accent text-accent-ink'
                              : 'border-line bg-card text-ink hover:border-accent hover:text-accent'
                          }`}
                        >
                          {isPinnedActive ? (
                            <>
                              <Check className="h-3 w-3" strokeWidth={1.5} />
                              <span>Fixado</span>
                            </>
                          ) : (
                            <>
                              <Award className="h-3 w-3 text-accent" strokeWidth={1.5} />
                              <span>Fixar</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <span className="text-[11px] tabular-nums text-subtle">
                          {badge.current}/{badge.target}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-[2px] flex-1 overflow-hidden rounded-[2px] bg-line">
                      <div
                        className="h-full transition-all duration-150"
                        style={{
                          width: `${badge.progressPct}%`,
                          backgroundColor: badge.unlocked
                            ? 'var(--accent-color)'
                            : 'var(--text-secondary)',
                        }}
                      />
                    </div>
                    <span className="text-[10px] tabular-nums text-muted">
                      {badge.current}/{badge.target}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
