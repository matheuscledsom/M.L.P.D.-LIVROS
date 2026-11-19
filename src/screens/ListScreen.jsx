import { ArrowUpDown, LayoutGrid, LayoutList, Plus, Star } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CoverArt } from '../components/CoverArt';
import { StatusBadge } from '../components/StatusBadge';
import {
  domainConfig,
  getStatusConfig,
  getStatusList,
} from '../config/domainConfig';
import {
  getCompletionPace,
  getHypeMeta,
  getPagesRead,
  getVerdictMeta,
} from '../utils/backlogHelpers';

export function ListScreen({ items, onSelectItem, onNavigateAdd }) {
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [layoutMode, setLayoutMode] = useState('grid');

  const { ui, cardFields } = domainConfig;
  const { list } = ui;
  const statuses = getStatusList();

  const backlogItems = useMemo(
    () => items.filter((item) => item.inBacklog),
    [items]
  );

  const filteredAndSortedItems = useMemo(() => {
    const filtered =
      selectedStatus === 'all'
        ? backlogItems
        : backlogItems.filter((item) => item.status === selectedStatus);

    return [...filtered].sort((a, b) => {
      if (sortBy === 'rating') {
        const ratingA = typeof a[cardFields.rating] === 'number' ? a[cardFields.rating] : -1;
        const ratingB = typeof b[cardFields.rating] === 'number' ? b[cardFields.rating] : -1;
        return ratingB - ratingA;
      }

      if (sortBy === 'hype') {
        const hypeA = getHypeMeta(a.hype)?.weight ?? 0;
        const hypeB = getHypeMeta(b.hype)?.weight ?? 0;
        return hypeB - hypeA;
      }

      if (sortBy === 'pages') {
        const pagesA = getPagesRead(a) || Number(a.totalPages) || 0;
        const pagesB = getPagesRead(b) || Number(b.totalPages) || 0;
        return pagesB - pagesA;
      }

      const timeA = Date.parse(a.updatedAt || a.createdAt || '') || 0;
      const timeB = Date.parse(b.updatedAt || b.createdAt || '') || 0;
      return timeB - timeA;
    });
  }, [backlogItems, selectedStatus, sortBy, cardFields.rating]);

  const filterTabs = [
    { id: 'all', label: list.allTabLabel, count: backlogItems.length },
    ...statuses.map((status) => ({
      id: status.id,
      label: status.label,
      count: backlogItems.filter((item) => item.status === status.id).length,
    })),
  ];

  const countLabel =
    filteredAndSortedItems.length === 1 ? list.countSingular : list.countPlural;

  return (
    <div className="space-y-4 pb-24">
      <header className="flex items-baseline justify-between pt-2">
        <h1 className="text-xl font-semibold tracking-tight text-ink">
          {list.title}
        </h1>
        <span className="text-xs text-subtle">
          {filteredAndSortedItems.length} {countLabel}
        </span>
      </header>

      <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
        {filterTabs.map((tab) => {
          const isActive = selectedStatus === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedStatus(tab.id)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? 'border-accent bg-accent text-accent-ink'
                  : 'border-line bg-card text-muted hover:text-ink'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] ${
                  isActive ? 'opacity-80' : 'text-subtle'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Barra superior compacta: Ordenação + Troca de Layout */}
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-line bg-card px-2.5 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto no-scrollbar">
          <ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-subtle" />
          {list.sortOptions.map((option) => {
            const isActive = sortBy === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setSortBy(option.id)}
                className={`shrink-0 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors ${
                  isActive
                    ? 'bg-accent/15 text-accent'
                    : 'text-muted hover:text-ink'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center rounded-xl border border-line bg-app p-0.5">
          <button
            type="button"
            onClick={() => setLayoutMode('grid')}
            aria-label={list.layoutOptions.grid}
            title={list.layoutOptions.grid}
            className={`rounded-lg p-1.5 transition-colors ${
              layoutMode === 'grid'
                ? 'bg-accent text-accent-ink'
                : 'text-subtle hover:text-ink'
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setLayoutMode('detailed')}
            aria-label={list.layoutOptions.detailed}
            title={list.layoutOptions.detailed}
            className={`rounded-lg p-1.5 transition-colors ${
              layoutMode === 'detailed'
                ? 'bg-accent text-accent-ink'
                : 'text-subtle hover:text-ink'
            }`}
          >
            <LayoutList className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {backlogItems.length === 0 ? (
        <div className="rounded-3xl border border-line bg-card px-5 py-12 text-center">
          <p className="text-sm font-semibold text-ink">
            {list.emptyBacklogTitle}
          </p>
          <button
            type="button"
            onClick={onNavigateAdd}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-xs font-semibold text-accent-ink transition-opacity hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" />
            {list.emptyBacklogCta}
          </button>
        </div>
      ) : filteredAndSortedItems.length === 0 ? (
        <div className="rounded-2xl border border-line bg-card py-14 text-center text-xs text-subtle">
          {list.emptyMessage}
        </div>
      ) : layoutMode === 'grid' ? (
        <div className="grid grid-cols-3 gap-2.5">
          {filteredAndSortedItems.map((item) => {
            const status = getStatusConfig(item.status);
            const gridPages =
              item.status === 'playing' || item.status === 'dropped'
                ? item.currentPage
                : item.totalPages;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectItem(item)}
                className="group text-left focus:outline-none"
              >
                <div className="relative">
                  <CoverArt
                    item={item}
                    compact
                    className="aspect-[3/4] w-full rounded-xl transition-transform duration-150 group-hover:scale-[1.02] group-hover:border-accent/50"
                  />
                  {item.isPlatinum && (
                    <span className="absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-amber-300 ring-1 ring-amber-400/50">
                      <Star className="h-3 w-3 fill-amber-300" />
                    </span>
                  )}
                  <span
                    title={status.label}
                    className={`absolute bottom-1.5 right-1.5 h-2 w-2 rounded-full ring-2 ring-app ${status.dotClass}`}
                  />
                </div>
                <p className="mt-1.5 truncate text-[11px] font-medium text-ink">
                  {item.title}
                </p>
                <p className="truncate text-[10px] text-subtle">
                  {item[cardFields.creator] || item[cardFields.primary]}
                  {gridPages > 0 ? ` • ${gridPages}p` : ''}
                </p>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredAndSortedItems.map((item) => {
            const pace =
              item.status === 'completed'
                ? getCompletionPace(
                    item.startDate,
                    item.completedDate,
                    item.totalPages || item.currentPage
                  )
                : null;
            const hypeMeta = getHypeMeta(item.hype);
            const verdictMeta = getVerdictMeta(item.verdict);
            const progress = Math.max(
              0,
              Math.min(100, Number(item[cardFields.progress]) || 0)
            );

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectItem(item)}
                className="flex w-full gap-3 rounded-2xl border border-line bg-card p-3 text-left transition-colors hover:border-accent/50"
              >
                <CoverArt
                  item={item}
                  compact
                  className="h-24 w-18 shrink-0 rounded-xl"
                />

                <div className="flex min-w-0 flex-1 flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="truncate text-sm font-semibold text-ink">
                        {item.title}
                      </h2>
                      {item.isPlatinum && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">
                          <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                          5★
                        </span>
                      )}
                    </div>

                    {item[cardFields.creator] && (
                      <p className="mt-0.5 truncate text-[11px] text-muted">
                        {item[cardFields.creator]}
                      </p>
                    )}

                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <StatusBadge statusId={item.status} size="xs" />
                      {item[cardFields.primary] && (
                        <span className="rounded-md border border-line bg-app px-1.5 py-0.5 text-[10px] text-muted">
                          {item[cardFields.primary]}
                        </span>
                      )}
                    </div>
                  </div>

                  {item.status === 'playing' && (
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center justify-between gap-2 text-[10px] text-muted">
                        <span className="truncate">
                          {item.checkpoint || 'Em leitura'}
                        </span>
                        <span className="shrink-0 font-semibold text-accent">
                          {item.totalPages > 0
                            ? `${item.currentPage || 0}/${item.totalPages}p · ${progress}%`
                            : `${item.currentPage || 0} págs · ${progress}%`}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
                        <div
                          className="h-full rounded-full bg-accent"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {item.status === 'completed' && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {typeof item[cardFields.rating] === 'number' && (
                        <span className="rounded-md border border-accent/40 bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-ink">
                          {item[cardFields.rating]}/100
                        </span>
                      )}
                      {verdictMeta && (
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${verdictMeta.badgeClass}`}
                        >
                          {verdictMeta.id}
                        </span>
                      )}
                      {pace && (
                        <span className="text-[10px] text-muted">
                          • {pace.days} {list.daysSuffix}
                        </span>
                      )}
                    </div>
                  )}

                  {item.status === 'queued' && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
                      {hypeMeta && (
                        <span className="rounded-md border border-line bg-app px-1.5 py-0.5 text-muted">
                          {hypeMeta.label}
                        </span>
                      )}
                      {item.access && (
                        <span className="rounded-md border border-line bg-app px-1.5 py-0.5 text-muted">
                          {item.access}
                        </span>
                      )}
                      {item.totalPages > 0 && (
                        <span className="text-subtle">
                          ~{item.totalPages} págs
                        </span>
                      )}
                    </div>
                  )}

                  {item.status === 'dropped' && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {item.dropReason && (
                        <span className="rounded-md border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[10px] text-rose-400">
                          {item.dropReason}
                        </span>
                      )}
                      {item.currentPage > 0 && (
                        <span className="text-[10px] text-subtle">
                          Parou na pág. {item.currentPage}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
