import { ArrowRight, BookOpen, Plus } from 'lucide-react';
import { CoverArt } from '../components/CoverArt';
import { OracleWidget } from '../components/OracleWidget';
import { ReadingStreakWidget } from '../components/ReadingStreakWidget';
import { VectorIcon } from '../components/VectorIcon';
import { domainConfig, getWorkTypeConfig } from '../config/domainConfig';

function getProgressMetricLabel(item) {
  if (item.workType === 'manga') {
    return `Vol. ${item.currentVolume || 0} · Cap. ${item.currentChapter || 0}`;
  }
  if (item.workType === 'academic' && item.academicProgressMode === 'fichamento') {
    return `${item.progress || 0}% fich.`;
  }
  if (item.totalPages > 0) {
    return `${item.currentPage || 0}/${item.totalPages}p`;
  }
  return `${item.currentPage || 0} págs`;
}

export function HomeScreen({
  items,
  profile,
  streakProps,
  geminiKey = '',
  onSelectItem,
  onNavigateList,
  onNavigateAdd,
  onOpenGeminiSettings,
}) {
  const { ui, cardFields, currentYear } = domainConfig;
  const progressKey = cardFields.progress;

  const backlogItems = items.filter((item) => item.inBacklog);
  const playingItems = backlogItems.filter((item) => item.status === 'playing');
  const completedYearCount = backlogItems.filter(
    (item) => item.status === 'completed' && item.completedYear === currentYear
  ).length;

  const summaryCards = [
    {
      id: 'total',
      label: ui.home.summaryCards.total,
      value: backlogItems.length,
      highlight: false,
    },
    {
      id: 'completedYear',
      label: ui.home.summaryCards.completedYear,
      value: completedYearCount,
      highlight: false,
    },
    {
      id: 'playingNow',
      label: ui.home.summaryCards.playingNow,
      value: playingItems.length,
      highlight: true,
    },
  ];

  return (
    <div className="space-y-6 pb-24">
      <header className="flex items-center justify-between pt-2">
        <div>
          <p className="text-xs font-medium text-subtle">
            {ui.home.greetingPrefix} {profile?.handle || ui.profile.handle}
          </p>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-ink">
            {ui.home.subtitle}
          </h1>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-card text-accent">
          <BookOpen className="h-4 w-4" />
        </div>
      </header>

      {streakProps && <ReadingStreakWidget {...streakProps} />}

      {backlogItems.length === 0 ? (
        <section className="rounded-3xl border border-line bg-card px-6 py-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-accent/30 bg-accent/10 text-accent">
            <BookOpen className="h-7 w-7" />
          </div>
          <h2 className="mt-5 text-base font-semibold tracking-tight text-ink">
            {ui.home.emptyBacklogTitle}
          </h2>
          <p className="mx-auto mt-1.5 max-w-xs text-xs leading-relaxed text-muted">
            {ui.home.emptyBacklogDescription}
          </p>
          <button
            type="button"
            onClick={onNavigateAdd}
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-accent px-5 py-3 text-sm font-semibold text-accent-ink shadow-md transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            {ui.home.emptyBacklogCta}
          </button>
        </section>
      ) : (
        <>
          <section aria-label="Resumo rápido" className="grid grid-cols-3 gap-2.5">
            {summaryCards.map((card) => (
              <div
                key={card.id}
                className={`rounded-2xl border bg-card p-3.5 transition-colors ${
                  card.highlight ? 'border-accent/40' : 'border-line'
                }`}
              >
                <span
                  className={`block text-2xl font-semibold tracking-tight ${
                    card.highlight ? 'text-accent' : 'text-ink'
                  }`}
                >
                  {card.value}
                </span>
                <span className="mt-1 block text-[11px] leading-tight text-muted">
                  {card.label}
                </span>
              </div>
            ))}
          </section>

          <section aria-label={ui.home.activeSectionTitle} className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-tight text-ink">
                {ui.home.activeSectionTitle}
              </h2>
              <button
                type="button"
                onClick={onNavigateList}
                className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:opacity-80"
              >
                {ui.home.seeAllLabel}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {playingItems.length === 0 ? (
              <div className="rounded-2xl border border-line bg-card p-6 text-center text-xs text-subtle">
                {ui.home.emptyActiveMessage}
              </div>
            ) : (
              <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 no-scrollbar">
                {playingItems.map((item) => {
                  const metricLabel = getProgressMetricLabel(item);
                  const workMeta = getWorkTypeConfig(item.workType);

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectItem(item)}
                      className="group w-44 shrink-0 snap-start rounded-2xl border border-line bg-card p-2.5 text-left transition-colors hover:border-accent/50"
                    >
                      <div className="relative">
                        <CoverArt
                          item={item}
                          className="aspect-[4/5] w-full rounded-xl"
                        />
                        <span
                          title={workMeta.label}
                          className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-black/70 text-accent backdrop-blur-xs"
                        >
                          <VectorIcon name={workMeta.icon} className="h-3 w-3" />
                        </span>
                      </div>
                      <div className="mt-2.5 space-y-1.5">
                        <p className="truncate text-sm font-medium text-ink transition-colors group-hover:text-accent">
                          {item.title}
                        </p>
                        <div className="flex items-center justify-between gap-2 text-[11px] text-muted">
                          <span className="truncate">
                            {item[cardFields.creator] || workMeta.shortLabel}
                          </span>
                          <span className="shrink-0">{metricLabel}</span>
                        </div>
                        <div className="h-1 w-full overflow-hidden rounded-full bg-line">
                          <div
                            className="h-full rounded-full bg-accent transition-all duration-300"
                            style={{ width: `${Math.min(100, item[progressKey] || 0)}%` }}
                          />
                        </div>
                        {item.checkpoint && (
                          <p className="truncate text-[10px] text-subtle">
                            {item.checkpoint}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <OracleWidget
            items={items}
            geminiKey={geminiKey}
            onSelectItem={onSelectItem}
            onOpenGeminiSettings={onOpenGeminiSettings}
          />
        </>
      )}
    </div>
  );
}
