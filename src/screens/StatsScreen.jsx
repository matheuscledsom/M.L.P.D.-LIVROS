import { BarChart2, Clock, Star } from 'lucide-react';
import { useMemo, useState } from 'react';
import { VectorIcon } from '../components/VectorIcon';
import { domainConfig, getStatusList } from '../config/domainConfig';
import { getCompletionPace, getPagesRead } from '../utils/backlogHelpers';

export function StatsScreen({ items = [] }) {
  const { ui, cardFields, workTypes } = domainConfig;
  const { stats } = ui;
  const statuses = getStatusList();
  const [rankingMode, setRankingMode] = useState('authors');

  const analytics = useMemo(() => {
    const backlogItems = items.filter((item) => item.inBacklog);
    const totalCount = backlogItems.length;
    const completedItems = backlogItems.filter(
      (item) => item.status === 'completed'
    );
    const completedCount = completedItems.length;
    const completionRate =
      totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    const readPages = backlogItems.reduce(
      (sum, item) => sum + getPagesRead(item),
      0
    );

    const queuedEstimatedPages = backlogItems
      .filter((item) => item.status === 'queued' && item.workType !== 'manga')
      .reduce((sum, item) => sum + (Number(item.totalPages) || 0), 0);

    const maxPagesBar = Math.max(readPages, queuedEstimatedPages, 1);

    const rated = backlogItems.filter(
      (item) => typeof item[cardFields.rating] === 'number'
    );
    const avgRating = rated.length
      ? Math.round(
          rated.reduce((sum, item) => sum + item[cardFields.rating], 0) /
            rated.length
        )
      : null;

    const lifeFavoritesTotal = backlogItems.filter((item) => item.isPlatinum).length;

    const paces = completedItems
      .filter((item) => item.workType !== 'manga')
      .map((item) =>
        getCompletionPace(
          item.startDate,
          item.completedDate,
          item.totalPages || item.currentPage
        )
      )
      .filter(Boolean);

    const avgDays = paces.length
      ? Math.round(
          (paces.reduce((sum, pace) => sum + pace.days, 0) / paces.length) * 10
        ) / 10
      : null;

    const statusCounts = statuses.map((status) => {
      const count = backlogItems.filter((item) => item.status === status.id).length;
      const pct = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
      return { ...status, count, pct };
    });

    const workTypeCounts = workTypes.map((type) => {
      const count = backlogItems.filter(
        (item) => (item.workType || 'book') === type.id
      ).length;
      const pct = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
      return { ...type, count, pct };
    });

    const buildRanking = (extractKeys) => {
      const map = new Map();
      backlogItems.forEach((item) => {
        const keys = extractKeys(item);
        const pages = getPagesRead(item);
        keys.forEach((key) => {
          const current = map.get(key) || { label: key, count: 0, pages: 0 };
          map.set(key, {
            label: key,
            count: current.count + 1,
            pages: current.pages + pages,
          });
        });
      });

      const sorted = Array.from(map.values())
        .sort((a, b) => b.count - a.count || b.pages - a.pages)
        .slice(0, 4);

      const maxCount = sorted[0]?.count || 1;
      return sorted.map((entry) => ({
        ...entry,
        pct: Math.round((entry.count / maxCount) * 100),
      }));
    };

    const topAuthors = buildRanking((item) =>
      item[cardFields.creator]
        ? String(item[cardFields.creator])
            .split(/[;,]/)
            .map((author) => author.trim())
            .filter(Boolean)
        : []
    );

    const topGenres = buildRanking((item) =>
      Array.isArray(item[cardFields.genres]) ? item[cardFields.genres] : []
    );

    return {
      totalCount,
      completedCount,
      completionRate,
      readPages,
      queuedEstimatedPages,
      readBarPct:
        readPages > 0
          ? Math.max(4, Math.round((readPages / maxPagesBar) * 100))
          : 0,
      queuedBarPct:
        queuedEstimatedPages > 0
          ? Math.max(4, Math.round((queuedEstimatedPages / maxPagesBar) * 100))
          : 0,
      avgRating: avgRating !== null ? `${avgRating}/100` : '—',
      lifeFavoritesTotal,
      avgDays: avgDays !== null ? `${avgDays} ${stats.daysUnit}` : '—',
      statusCounts,
      workTypeCounts,
      topAuthors,
      topGenres,
    };
  }, [
    items,
    statuses,
    workTypes,
    stats.daysUnit,
    cardFields.creator,
    cardFields.rating,
    cardFields.genres,
  ]);

  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference - (analytics.completionRate / 100) * circumference;

  const activeRanking =
    rankingMode === 'authors' ? analytics.topAuthors : analytics.topGenres;

  return (
    <div className="space-y-4 pb-24">
      <header className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            {stats.title}
          </h1>
          <p className="mt-0.5 text-xs text-subtle">{stats.subtitle}</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-card text-accent">
          <BarChart2 className="h-4 w-4" />
        </div>
      </header>

      {analytics.totalCount === 0 && (
        <div className="rounded-2xl border border-dashed border-line bg-card p-4 text-center">
          <p className="text-xs font-medium text-ink">{stats.emptyStatsTitle}</p>
          <p className="mt-0.5 text-[11px] text-subtle">
            {stats.emptyStatsDescription}
          </p>
        </div>
      )}

      {/* Hall da Fama */}
      <section className="rounded-2xl border border-line bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink">
          {stats.hallOfFameTitle}
        </h2>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-line bg-app p-3">
            <Star className="h-3.5 w-3.5 text-accent" />
            <span className="mt-2 block text-base font-semibold tracking-tight text-ink">
              {analytics.avgRating}
            </span>
            <span className="mt-0.5 block text-[10px] text-subtle">
              {stats.avgRatingLabel}
            </span>
          </div>

          <div className="rounded-xl border border-line bg-app p-3">
            <Star className="h-3.5 w-3.5 fill-current text-accent" />
            <span className="mt-2 block text-base font-semibold tracking-tight text-ink">
              {analytics.lifeFavoritesTotal}
            </span>
            <span className="mt-0.5 block text-[10px] text-subtle">
              {stats.lifeFavoritesLabel}
            </span>
          </div>

          <div className="rounded-xl border border-line bg-app p-3">
            <Clock className="h-3.5 w-3.5 text-accent" />
            <span className="mt-2 block text-base font-semibold tracking-tight text-ink">
              {analytics.avgDays}
            </span>
            <span className="mt-0.5 block text-[10px] text-subtle">
              {stats.avgDaysLabel}
            </span>
          </div>
        </div>
      </section>

      {/* Balanço de Páginas Lidas (SVG puro) */}
      <section className="rounded-2xl border border-line bg-card p-4">
        <div className="mb-3.5">
          <h2 className="text-sm font-semibold text-ink">
            {stats.pagesBalanceTitle}
          </h2>
          <p className="text-[11px] text-subtle">{stats.pagesBalanceSubtitle}</p>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted">{stats.readPagesLabel}</span>
              <span className="font-semibold text-accent">
                {analytics.readPages} {stats.pagesUnit}
              </span>
            </div>
            <svg viewBox="0 0 100 6" className="h-2.5 w-full overflow-hidden rounded-full">
              <rect
                x="0"
                y="0"
                width="100"
                height="6"
                rx="3"
                fill="var(--border-subtle)"
              />
              <rect
                x="0"
                y="0"
                width={analytics.readBarPct}
                height="6"
                rx="3"
                fill="var(--accent-color)"
                className="transition-all duration-500 ease-out"
              />
            </svg>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted">{stats.queuedPagesLabel}</span>
              <span className="font-semibold text-ink">
                {analytics.queuedEstimatedPages} {stats.pagesUnit}
              </span>
            </div>
            <svg viewBox="0 0 100 6" className="h-2.5 w-full overflow-hidden rounded-full">
              <rect
                x="0"
                y="0"
                width="100"
                height="6"
                rx="3"
                fill="var(--border-subtle)"
              />
              <rect
                x="0"
                y="0"
                width={analytics.queuedBarPct}
                height="6"
                rx="3"
                fill="var(--text-subtle)"
                className="transition-all duration-500 ease-out"
              />
            </svg>
          </div>
        </div>
      </section>

      {/* Taxa de Conclusão (Donut Chart SVG) */}
      <section className="rounded-2xl border border-line bg-card p-4">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-ink">
            {stats.completionRateTitle}
          </h2>
          <p className="text-[11px] text-subtle">
            {stats.completionRateSubtitle}
          </p>
        </div>

        <div className="flex items-center gap-5">
          <div className="relative h-28 w-28 shrink-0">
            <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
              <circle
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke="var(--border-subtle)"
                strokeWidth="12"
              />
              <circle
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke="var(--accent-color)"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-700 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-semibold tracking-tight text-ink">
                {analytics.completionRate}%
              </span>
            </div>
          </div>

          <div className="flex-1 space-y-2.5">
            <div className="flex items-center justify-between rounded-xl border border-line bg-app px-3 py-2">
              <span className="text-xs text-muted">{stats.completedLabel}</span>
              <span className="text-sm font-semibold text-accent">
                {analytics.completedCount}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-line bg-app px-3 py-2">
              <span className="text-xs text-muted">{stats.totalLabel}</span>
              <span className="text-sm font-semibold text-ink">
                {analytics.totalCount}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Distribuição por Natureza da Obra */}
      <section className="rounded-2xl border border-line bg-card p-4">
        <h2 className="mb-3.5 text-sm font-semibold text-ink">
          {stats.workTypeDistributionTitle}
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {analytics.workTypeCounts.map((type) => (
            <div
              key={type.id}
              className="rounded-xl border border-line bg-app p-3"
            >
              <VectorIcon name={type.icon} className="h-3.5 w-3.5 text-accent" />
              <span className="mt-2 block text-base font-semibold tracking-tight text-ink">
                {type.count}
              </span>
              <span className="mt-0.5 block truncate text-[10px] text-subtle">
                {type.shortLabel}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Distribuição por Status */}
      <section className="rounded-2xl border border-line bg-card p-4">
        <h2 className="mb-3.5 text-sm font-semibold text-ink">
          {stats.statusDistributionTitle}
        </h2>

        <div className="space-y-3">
          {analytics.statusCounts.map((status) => (
            <div key={status.id} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-2 text-muted">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: status.color }}
                  />
                  {status.label}
                </span>
                <span className="font-medium text-muted">
                  <strong className="font-semibold text-ink">
                    {status.count}
                  </strong>{' '}
                  ({status.pct}%)
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${status.pct}%`,
                    backgroundColor: status.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Top Autores / Gêneros */}
      <section className="rounded-2xl border border-line bg-card p-4">
        <div className="mb-3.5 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">
            {stats.topRankingTitle}
          </h2>

          <div className="flex rounded-xl border border-line bg-app p-0.5">
            <button
              type="button"
              onClick={() => setRankingMode('authors')}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                rankingMode === 'authors'
                  ? 'bg-accent text-accent-ink'
                  : 'text-muted hover:text-ink'
              }`}
            >
              {stats.authorsTabLabel}
            </button>
            <button
              type="button"
              onClick={() => setRankingMode('genres')}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                rankingMode === 'genres'
                  ? 'bg-accent text-accent-ink'
                  : 'text-muted hover:text-ink'
              }`}
            >
              {stats.genresTabLabel}
            </button>
          </div>
        </div>

        {activeRanking.length === 0 ? (
          <p className="py-6 text-center text-xs text-subtle">
            {stats.topEmptyMessage}
          </p>
        ) : (
          <div className="space-y-3">
            {activeRanking.map((entry, index) => (
              <div key={entry.label} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex min-w-0 items-center gap-2 font-medium text-ink">
                    <span className="w-4 shrink-0 text-[11px] text-subtle">
                      #{index + 1}
                    </span>
                    <span className="truncate">{entry.label}</span>
                  </span>
                  <span className="shrink-0 text-muted">
                    <strong className="font-semibold text-ink">
                      {entry.count}
                    </strong>{' '}
                    {entry.count === 1 ? stats.countSingular : stats.countPlural}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-500 ease-out"
                    style={{ width: `${entry.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
