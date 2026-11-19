import { ArrowRight, BookOpen, Clock, FileUp, Library, Play, Plus, Sparkles, Star, Target } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { CoverArt } from '../components/CoverArt';
import { OracleWidget } from '../components/OracleWidget';
import { ReadingStreakWidget } from '../components/ReadingStreakWidget';
import { StatusBadge } from '../components/StatusBadge';
import { VectorIcon } from '../components/VectorIcon';
import { domainConfig, getWorkTypeConfig } from '../config/domainConfig';
import {
  calculateWorkProgress,
  formatFlexibleProgressMetric,
  normalizeProgressMode,
} from '../utils/backlogHelpers';

function getProgressMetricLabel(item) {
  return formatFlexibleProgressMetric(item);
}

function formatDurationMinutes(minutes) {
  if (!minutes || minutes <= 0) return 'Menos de 5 min restantes';
  if (minutes < 60) return `~${Math.max(1, Math.round(minutes))} min restantes`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `~${hours}h ${mins}min restantes` : `~${hours}h restantes`;
}

function estimateRemainingTime(item) {
  if (!item) return 'Em andamento';
  if (item.workType === 'manga') {
    const totalChap = Number(item.totalChapters) || 0;
    const currentChap = Math.max(0, Number(item.currentChapter) || 0);
    if (totalChap > 0) {
      const remainingChap = Math.max(0, totalChap - currentChap);
      if (remainingChap === 0) return 'Quase concluído';
      return formatDurationMinutes(remainingChap * 8);
    }
    return 'Progresso contínuo';
  }

  const totalPages = Number(item.totalPages) || 0;
  const currentPage = Math.max(0, Number(item.currentPage) || 0);
  if (totalPages > 0) {
    const remainingPages = Math.max(0, totalPages - currentPage);
    if (remainingPages === 0) return 'Quase concluído';
    return formatDurationMinutes(remainingPages * 1.6);
  }

  const pct = calculateWorkProgress(item);
  if (pct > 0 || normalizeProgressMode(item.progressMode) !== 'pages') {
    if (pct >= 100) return 'Quase concluído';
    return `${pct}% lido`;
  }

  return 'Informe o total de págs para estimar';
}

export function HomeScreen({
  items,
  profile,
  streakProps,
  geminiKey = '',
  storedReaderWorkIds = [],
  onSelectItem,
  onOpenReader,
  onOpenQuickReader,
  onOpenDigitalShelf,
  onNavigateList,
  onNavigateAdd,
  onOpenGeminiSettings,
}) {
  const { ui, cardFields, currentYear } = domainConfig;
  const progressKey = cardFields.progress;

  const backlogItems = useMemo(
    () => items.filter((item) => item.inBacklog),
    [items]
  );

  const playingItems = useMemo(
    () =>
      backlogItems
        .filter((item) => item.status === 'playing')
        .sort((a, b) => {
          const tA = Date.parse(a.updatedAt || a.createdAt || '') || 0;
          const tB = Date.parse(b.updatedAt || b.createdAt || '') || 0;
          return tB - tA;
        }),
    [backlogItems]
  );

  const completedYearCount = useMemo(
    () =>
      backlogItems.filter(
        (item) => item.status === 'completed' && item.completedYear === currentYear
      ).length,
    [backlogItems, currentYear]
  );

  const annualGoal = Math.max(1, Number(profile?.annualGoal) || 12);
  const annualGoalPct = Math.min(100, Math.round((completedYearCount / annualGoal) * 100));

  const [animatedGoalPct, setAnimatedGoalPct] = useState(0);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setAnimatedGoalPct(annualGoalPct);
      return undefined;
    }
    const raf = window.requestAnimationFrame(() => {
      setAnimatedGoalPct(annualGoalPct);
    });
    return () => window.cancelAnimationFrame(raf);
  }, [annualGoalPct]);

  const featuredPlaying = playingItems[0] || null;
  const otherPlaying = playingItems.slice(1);

  const highlightsItems = useMemo(() => {
    return backlogItems
      .filter(
        (item) =>
          item.isPlatinum ||
          item.status === 'completed' ||
          item.status === 'playing'
      )
      .sort((a, b) => {
        const starDiff = Number(Boolean(b.isPlatinum)) - Number(Boolean(a.isPlatinum));
        if (starDiff !== 0) return starDiff;
        const dateA = Date.parse(a.completedDate || a.updatedAt || a.createdAt || '') || 0;
        const dateB = Date.parse(b.completedDate || b.updatedAt || b.createdAt || '') || 0;
        return dateB - dateA;
      })
      .slice(0, 10);
  }, [backlogItems]);

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
      <header className="flex items-start justify-between gap-3 pt-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-subtle">
            {ui.home.greetingPrefix}{' '}
            {profile?.displayName || profile?.handle || ui.profile.displayName}
            {profile?.gamificationEnabled !== false && profile?.activeTitleBadge && (
              <span className="ml-1.5 inline-flex items-center rounded-full border border-accent/40 bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">
                {profile.activeTitleBadge}
              </span>
            )}
          </p>
          <div className="mt-0.5 flex flex-wrap items-baseline gap-2">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-ink">
              {domainConfig.appName}
            </h1>
            <span className="text-xs font-medium text-muted">
              {domainConfig.appSubtitle}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] font-medium tracking-wide text-subtle">
            {domainConfig.signature}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => onOpenDigitalShelf?.()}
            className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-[6px] border border-line bg-card px-2.5 py-2 text-xs font-medium text-ink transition-colors hover:border-accent"
          >
            <Library className="h-4 w-4 text-accent" strokeWidth={1.5} />
            <span className="hidden sm:inline">Meus EPUBs</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenQuickReader?.(null)}
            className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-[6px] border border-accent/40 bg-accent/15 px-3 py-2 text-xs font-semibold text-accent transition-colors hover:bg-accent hover:text-accent-ink"
          >
            <FileUp className="h-4 w-4" strokeWidth={1.5} />
            <span>Leitor Rápido</span>
          </button>
        </div>
      </header>

      {profile?.gamificationEnabled !== false && streakProps && (
        <ReadingStreakWidget {...streakProps} />
      )}

      {backlogItems.length === 0 ? (
        <section className="rounded-3xl border border-line bg-card px-6 py-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-accent/30 bg-accent/10 text-accent">
            <BookOpen className="h-6 w-6" strokeWidth={1.5} />
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
            className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-2xl bg-accent px-5 py-3 text-sm font-semibold text-accent-ink shadow-md transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" strokeWidth={1.5} />
            {ui.home.emptyBacklogCta}
          </button>
        </section>
      ) : (
        <>
          {/* 3 Cards de Resumo */}
          <section aria-label="Resumo rápido" className="grid grid-cols-3 gap-2.5 sm:gap-3">
            {summaryCards.map((card) => (
              <div
                key={card.id}
                className={`rounded-2xl border bg-card p-3.5 sm:p-4 transition-colors ${
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

          {/* Meta Anual com barra fina de 6px e animação de 600ms */}
          <section
            aria-label={ui.home.annualGoalTitle}
            className="rounded-2xl border border-line bg-card p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 shrink-0 text-accent" strokeWidth={1.5} />
                <h2 className="text-xs font-semibold tracking-tight text-ink">
                  {ui.home.annualGoalTitle}
                </h2>
              </div>
              <div className="flex items-baseline gap-2 text-xs">
                <span className="font-medium text-muted">
                  <strong className="font-semibold text-ink">{completedYearCount}</strong> / {annualGoal}
                </span>
                <span className="font-semibold text-accent">{annualGoalPct}%</span>
              </div>
            </div>

            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={annualGoalPct}
              aria-label={`Progresso da Meta Anual: ${annualGoalPct}%`}
              className="mt-3 h-[6px] w-full overflow-hidden rounded-full bg-line"
            >
              <div
                className="codice-goal-fill h-full rounded-full"
                style={{
                  width: `${animatedGoalPct}%`,
                  backgroundColor: 'var(--accent-color)',
                }}
              />
            </div>
          </section>

          {/* Card "Continuar lendo" + outras leituras ativas */}
          <section aria-label={ui.home.continueReadingTitle} className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-tight text-ink">
                {ui.home.continueReadingTitle}
              </h2>
              <button
                type="button"
                onClick={onNavigateList}
                className="inline-flex min-h-[44px] items-center gap-1 px-1 text-xs font-medium text-accent hover:opacity-80"
              >
                {ui.home.seeAllLabel}
                <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>

            {!featuredPlaying ? (
              <div className="rounded-2xl border border-dashed border-line bg-card px-5 py-7 text-center">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-accent/30 bg-accent/10 text-accent">
                  <BookOpen className="h-5 w-5" strokeWidth={1.5} />
                </div>
                <p className="mt-3 text-xs font-medium text-ink">
                  {ui.home.emptyActiveMessage}
                </p>
                <p className="mt-1 text-[11px] text-muted">
                  Marque uma obra da estante como Em Leitura para acompanhar aqui.
                </p>
                <button
                  type="button"
                  onClick={onNavigateList}
                  className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-accent/40 bg-accent/15 px-4 py-2 text-xs font-semibold text-accent transition-colors hover:bg-accent hover:text-accent-ink"
                >
                  {ui.home.emptyActiveCta}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <article className="flex gap-3.5 rounded-2xl border border-line bg-card p-3.5 transition-colors hover:border-accent/45">
                  <button
                    type="button"
                    onClick={() => onSelectItem(featuredPlaying)}
                    aria-label={`Abrir detalhes de ${featuredPlaying.title}`}
                    className="shrink-0 rounded-xl focus:outline-none"
                  >
                    <CoverArt
                      item={featuredPlaying}
                      compact
                      className="w-20 sm:w-24 rounded-xl"
                    />
                  </button>

                  <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-accent">
                          <VectorIcon
                            name={getWorkTypeConfig(featuredPlaying.workType).icon}
                            className="h-3.5 w-3.5"
                          />
                          {getWorkTypeConfig(featuredPlaying.workType).shortLabel}
                        </span>
                        <span className="text-[11px] font-semibold text-ink">
                          {Math.min(100, featuredPlaying[progressKey] || 0)}%
                        </span>
                      </div>

                      <h3 className="mt-1 line-clamp-2 text-sm sm:text-base font-semibold leading-snug text-ink">
                        {featuredPlaying.title}
                      </h3>

                      {featuredPlaying[cardFields.creator] && (
                        <p className="mt-0.5 truncate text-xs text-muted">
                          {featuredPlaying[cardFields.creator]}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
                        <span>{getProgressMetricLabel(featuredPlaying)}</span>
                        <span className="inline-flex items-center gap-1 text-subtle">
                          <Clock className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
                          {estimateRemainingTime(featuredPlaying)}
                        </span>
                      </div>

                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
                        <div
                          className="codice-goal-fill h-full rounded-full"
                          style={{
                            width: `${Math.min(100, featuredPlaying[progressKey] || 0)}%`,
                            backgroundColor: 'var(--accent-color)',
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        {storedReaderWorkIds.includes(featuredPlaying.id) ? (
                          <button
                            type="button"
                            onClick={() => onOpenReader?.(featuredPlaying)}
                            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-ink transition-opacity hover:opacity-90"
                          >
                            <Play className="h-4 w-4 fill-current" strokeWidth={1.5} />
                            {ui.home.resumeLabel}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onSelectItem(featuredPlaying)}
                            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-ink transition-opacity hover:opacity-90"
                          >
                            <Play className="h-4 w-4 fill-current" strokeWidth={1.5} />
                            {ui.home.resumeLabel}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </article>

                {otherPlaying.length > 0 && (
                  <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 no-scrollbar">
                    {otherPlaying.map((item) => {
                      const metricLabel = getProgressMetricLabel(item);
                      const workMeta = getWorkTypeConfig(item.workType);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => onSelectItem(item)}
                          className="group w-40 sm:w-44 shrink-0 snap-start rounded-2xl border border-line bg-card p-2.5 text-left transition-colors hover:border-accent/50"
                        >
                          <div className="relative">
                            <CoverArt
                              item={item}
                              className="w-full rounded-xl"
                            />
                            <span
                              title={workMeta.label}
                              className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border border-line bg-app/85 text-accent backdrop-blur-xs"
                            >
                              <VectorIcon name={workMeta.icon} className="h-3.5 w-3.5" />
                            </span>
                          </div>
                          <div className="mt-2.5 space-y-1.5">
                            <p className="truncate text-xs font-semibold text-ink transition-colors group-hover:text-accent">
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
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </section>

          <OracleWidget
            items={items}
            profile={profile}
            geminiKey={geminiKey}
            onSelectItem={onSelectItem}
            onOpenGeminiSettings={onOpenGeminiSettings}
          />

          {/* Vitrine "Destaques & Últimas Leituras" */}
          <section aria-label={ui.home.highlightsTitle} className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent" strokeWidth={1.5} />
                <h2 className="text-sm font-semibold tracking-tight text-ink">
                  {ui.home.highlightsTitle}
                </h2>
              </div>
              <button
                type="button"
                onClick={onNavigateList}
                className="inline-flex min-h-[44px] items-center gap-1 px-1 text-xs font-medium text-accent hover:opacity-80"
              >
                {ui.home.seeAllLabel}
                <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>

            {highlightsItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line bg-card px-5 py-7 text-center">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-accent/30 bg-accent/10 text-accent">
                  <Sparkles className="h-5 w-5" strokeWidth={1.5} />
                </div>
                <p className="mt-3 text-xs font-semibold text-ink">
                  {ui.home.highlightsEmptyTitle}
                </p>
                <p className="mx-auto mt-1 max-w-xs text-[11px] text-muted">
                  {ui.home.highlightsEmptyDescription}
                </p>
                <button
                  type="button"
                  onClick={onNavigateAdd}
                  className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-ink transition-opacity hover:opacity-90"
                >
                  <Plus className="h-4 w-4" strokeWidth={1.5} />
                  {ui.home.emptyBacklogCta}
                </button>
              </div>
            ) : (
              <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 no-scrollbar">
                {highlightsItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectItem(item)}
                    className="group w-36 sm:w-40 shrink-0 snap-start rounded-2xl border border-line bg-card p-2.5 text-left transition-colors hover:border-accent/50"
                  >
                    <div className="relative">
                      <CoverArt
                        item={item}
                        compact
                        className="w-full rounded-xl"
                      />
                      {item.isPlatinum && (
                        <span
                          aria-label="Favorito 5 Estrelas"
                          className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border border-accent/50 bg-app/85 text-accent backdrop-blur-xs"
                        >
                          <Star className="h-3.5 w-3.5 fill-current" strokeWidth={1.5} />
                        </span>
                      )}
                      {typeof item[cardFields.rating] === 'number' && (
                        <span className="absolute right-2 top-2 rounded-md border border-line bg-app/85 px-1.5 py-0.5 text-[10px] font-semibold text-ink backdrop-blur-xs">
                          {item[cardFields.rating]}
                        </span>
                      )}
                    </div>

                    <div className="mt-2.5 space-y-1">
                      <p className="truncate text-xs font-semibold text-ink transition-colors group-hover:text-accent">
                        {item.title}
                      </p>
                      <p className="truncate text-[11px] text-muted">
                        {item[cardFields.creator] || getWorkTypeConfig(item.workType).shortLabel}
                      </p>
                      <div className="pt-0.5">
                        <StatusBadge statusId={item.status} size="xs" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
