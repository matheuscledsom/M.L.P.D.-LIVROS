import {
  ArrowRight,
  BookOpen,
  FilePlus2,
  Library,
  Play,
  Plus,
  Sparkles,
  Star,
  Target,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CoverArt } from '../components/CoverArt';
import { OracleWidget } from '../components/OracleWidget';
import { ReadingStreakWidget } from '../components/ReadingStreakWidget';
import { RecommendationsSection } from '../components/RecommendationsSection';
import { ReleaseHistoryModal } from '../components/ReleaseHistoryModal';
import { StatusBadge } from '../components/StatusBadge';
import { VectorIcon } from '../components/VectorIcon';
import {
  computeTelemetryEstimate,
  formatExactPercent,
} from '../components/reader/useReaderProgress';
import { domainConfig, getWorkTypeConfig } from '../config/domainConfig';
import { CODICE_RELEASE } from '../config/versioning';
import { useToast } from '../context/ToastContext';
import {
  buildContinueReadingHub,
  getDisplayTitles,
} from '../utils/backlogHelpers';
import { detectBookFileFormat } from '../utils/fileFormatDetector';

export function HomeScreen({
  items,
  profile,
  streakProps,
  resolvedBadgeName = '',
  viewerId = null,
  geminiKey = '',
  storedReaderBooks = [],
  onSelectItem,
  onOpenReader,
  onOpenStoredBook,
  onOpenQuickReader,
  onOpenDigitalShelf,
  onAddToWishlist,
  onNavigateList,
  onNavigateAdd,
  onOpenGeminiSettings,
}) {
  const { showToast } = useToast();
  const { ui, cardFields, currentYear } = domainConfig;
  const [releaseModalOpen, setReleaseModalOpen] = useState(false);
  const [hubMetricMode, setHubMetricMode] = useState('percent');
  const quickReadInputRef = useRef(null);

  const handleQuickFileSelected = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const detection = await detectBookFileFormat(file);
      if (!detection?.supported) {
        showToast({
          message:
            detection?.error ||
            'Formato não suportado. Envie EPUB, PDF, CBZ, TXT ou Markdown.',
          type: 'error',
        });
        return;
      }
      onOpenQuickReader?.(file);
    } catch (err) {
      showToast({
        message:
          err?.message || 'Não foi possível preparar o arquivo para leitura.',
        type: 'error',
      });
    }
  };

  const backlogItems = useMemo(
    () => items.filter((item) => item.inBacklog),
    [items]
  );

  const continueHub = useMemo(
    () => buildContinueReadingHub(items, storedReaderBooks),
    [items, storedReaderBooks]
  );

  const playingItems = useMemo(
    () =>
      backlogItems
        .filter((item) => item.status === 'playing' || item.status === 'reading')
        .sort((a, b) => {
          const tA = Date.parse(a.updatedAt || a.createdAt || '') || 0;
          const tB = Date.parse(b.updatedAt || b.createdAt || '') || 0;
          return tB - tA;
        }),
    [backlogItems]
  );

  const openHubEntry = (entry) => {
    if (!entry) return;
    if (entry.hasStoredFile) {
      if (entry.storedBook && onOpenStoredBook) {
        onOpenStoredBook(entry.storedBook);
        return;
      }
      if (entry.work && onOpenReader) {
        onOpenReader(entry.work);
        return;
      }
    }
    if (entry.work) {
      onSelectItem?.(entry.work);
    } else if (entry.storedBook && onOpenStoredBook) {
      onOpenStoredBook(entry.storedBook);
    }
  };

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

  const featuredHub = continueHub.featured;
  const otherHubEntries = continueHub.others;

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
      <input
        ref={quickReadInputRef}
        type="file"
        accept=".epub,.pdf,.cbz,.txt,.md,.markdown"
        onChange={handleQuickFileSelected}
        className="hidden"
        aria-label="Selecionar arquivo para leitura imediata"
      />

      <header className="flex items-start justify-between gap-3 pt-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-subtle">
            {ui.home.greetingPrefix}{' '}
            {profile?.displayName || profile?.handle || ui.profile.displayName}
            {profile?.gamificationEnabled !== false &&
              (() => {
                const badgeText =
                  resolvedBadgeName ||
                  (profile?.activeTitleBadge && profile.activeTitleBadge !== 'auto'
                    ? profile.activeTitleBadge
                    : '');
                return badgeText ? (
                  <span className="ml-1.5 inline-flex items-center rounded-[4px] border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
                    {badgeText}
                  </span>
                ) : null;
              })()}
          </p>
          <div className="mt-0.5 flex flex-wrap items-baseline gap-2">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-ink">
              {domainConfig.appName}
            </h1>
            <span className="text-xs font-medium text-muted">
              {domainConfig.appSubtitle}
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] font-medium tracking-wide text-subtle">
            <span>{domainConfig.signature}</span>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setReleaseModalOpen(true)}
              className="tabular-nums underline-offset-2 hover:underline"
              style={{ color: 'var(--text-secondary)' }}
            >
              Códice {CODICE_RELEASE.label}
            </button>
          </div>
        </div>
      </header>

      {profile?.gamificationEnabled !== false && streakProps && (
        <ReadingStreakWidget {...streakProps} />
      )}

      {/* Hub Unificado "Continuar Lendo" no topo da Home (Acervo + IndexedDB Offline) */}
      <section aria-label={ui.home.continueReadingTitle} className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-semibold tracking-tight text-ink">
              {ui.home.continueReadingTitle}
            </h2>
            {continueHub.all.length > 0 && (
              <span className="text-[11px] tabular-nums text-subtle">
                ({continueHub.all.length})
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => quickReadInputRef.current?.click()}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-[4px] border border-accent/45 bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent transition-colors hover:bg-accent hover:text-accent-ink"
            >
              <FilePlus2 className="h-3.5 w-3.5" strokeWidth={1.5} />
              <span>+ Adicionar Arquivo para Ler</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenDigitalShelf?.()}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-[4px] border border-line bg-card px-2.5 py-1 text-[11px] font-medium text-ink transition-colors hover:border-accent"
            >
              <Library className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
              <span>Meus EPUBs</span>
            </button>
          </div>
        </div>

        {!featuredHub ? (
          <div className="rounded-[6px] border border-dashed border-line bg-card px-5 py-7 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-[4px] border border-line bg-app text-accent">
              <BookOpen className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <p className="mt-3 text-xs font-medium text-ink">
              {ui.home.emptyActiveMessage}
            </p>
            <p className="mt-1 text-[11px] text-muted">
              Marque uma obra como Em Leitura ou importe um EPUB/PDF para ler na hora.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => quickReadInputRef.current?.click()}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[4px] bg-accent px-4 py-2 text-xs font-semibold text-accent-ink transition-opacity hover:opacity-90"
              >
                <FilePlus2 className="h-4 w-4" strokeWidth={1.5} />
                <span>+ Adicionar Arquivo para Ler</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenDigitalShelf?.()}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[4px] border border-line bg-app px-3.5 py-2 text-xs font-medium text-ink hover:border-accent"
              >
                <Library className="h-4 w-4 text-accent" strokeWidth={1.5} />
                <span>Meus EPUBs</span>
              </button>
              <button
                type="button"
                onClick={backlogItems.length > 0 ? onNavigateList : onNavigateAdd}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[4px] border border-line bg-app px-3.5 py-2 text-xs font-medium text-muted hover:border-accent hover:text-ink"
              >
                {backlogItems.length > 0 ? ui.home.emptyActiveCta : ui.home.emptyBacklogCta}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <article className="flex gap-3.5 rounded-[6px] border border-line bg-card p-3.5 transition-colors hover:border-accent/50">
              <button
                type="button"
                onClick={() =>
                  featuredHub.work
                    ? onSelectItem(featuredHub.work)
                    : openHubEntry(featuredHub)
                }
                aria-label={`Abrir detalhes de ${featuredHub.title}`}
                className="shrink-0 rounded-[4px] focus:outline-none"
              >
                <CoverArt
                  item={
                    featuredHub.work || {
                      title: featuredHub.title,
                      author: featuredHub.author,
                      format: featuredHub.format,
                      workType: featuredHub.workType,
                    }
                  }
                  compact
                  className="w-20 sm:w-24 rounded-[4px]"
                />
              </button>

              <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-accent">
                      <VectorIcon
                        name={getWorkTypeConfig(featuredHub.workType).icon}
                        className="h-3.5 w-3.5"
                      />
                      <span>
                        {featuredHub.hasStoredFile
                          ? `Leitor Offline · ${featuredHub.format || 'EPUB'}`
                          : getWorkTypeConfig(featuredHub.workType).shortLabel}
                      </span>
                    </span>
                    <span className="text-[11px] font-semibold tabular-nums text-ink">
                      {formatExactPercent(featuredHub.progressPct)}
                    </span>
                  </div>

                  {(() => {
                    const featuredTitles = getDisplayTitles(featuredHub, 'bilingual');
                    return (
                      <>
                        <h3 className="mt-1 line-clamp-2 text-sm sm:text-base font-semibold leading-snug text-ink">
                          {featuredTitles.primary}
                        </h3>
                        {featuredTitles.secondary && (
                          <p
                            className="mt-0.5 truncate text-[11px] italic"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            {featuredTitles.secondary}
                          </p>
                        )}
                      </>
                    );
                  })()}

                  {featuredHub.author && (
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {featuredHub.author}
                    </p>
                  )}
                </div>

                {(() => {
                  const featuredTelemetry = computeTelemetryEstimate({
                    position: {
                      progressPct: featuredHub.progressPct,
                      page: featuredHub.currentPage || 0,
                      totalPages: featuredHub.totalPages || 0,
                    },
                  });
                  const canShowPages = Boolean(featuredTelemetry.hasTotalPages);
                  const shownText =
                    hubMetricMode === 'pages' && canShowPages
                      ? featuredTelemetry.pagesText
                      : featuredTelemetry.percentText;

                  return (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] tabular-nums text-muted">
                        <button
                          type="button"
                          onClick={() => {
                            if (!canShowPages) return;
                            setHubMetricMode((prev) =>
                              prev === 'percent' ? 'pages' : 'percent'
                            );
                          }}
                          className={`min-h-[28px] text-left tabular-nums transition-opacity ${
                            canShowPages
                              ? 'cursor-pointer hover:text-ink'
                              : 'cursor-default'
                          }`}
                          style={{ touchAction: 'manipulation' }}
                          title={
                            canShowPages
                              ? 'Toque para alternar entre percentual e páginas'
                              : undefined
                          }
                        >
                          {shownText}
                        </button>
                        {!featuredHub.work && (
                          <span className="text-subtle">
                            Salvo localmente em IndexedDB
                          </span>
                        )}
                      </div>

                      <div className="h-[2px] w-full overflow-hidden rounded-[2px] bg-line">
                        <div
                          className="codice-goal-fill h-full"
                          style={{
                            width: `${featuredTelemetry.pct}%`,
                            backgroundColor: 'var(--accent-color)',
                          }}
                        />
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                        {featuredHub.work && (
                          <button
                            type="button"
                            onClick={() => onSelectItem(featuredHub.work)}
                            className="inline-flex min-h-[40px] items-center rounded-[4px] border border-line bg-app px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-accent hover:text-ink"
                          >
                            Ficha
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openHubEntry(featuredHub)}
                          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[4px] bg-accent px-4 py-2 text-xs font-semibold text-accent-ink transition-opacity hover:opacity-90"
                        >
                          <Play className="h-4 w-4" strokeWidth={1.5} />
                          <span>Continuar Lendo</span>
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </article>

            {otherHubEntries.length > 0 && (
              <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 no-scrollbar">
                {otherHubEntries.map((entry) => {
                  const workMeta = getWorkTypeConfig(entry.workType);
                  const cardTitles = getDisplayTitles(entry, 'bilingual');
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => openHubEntry(entry)}
                      className="group w-40 sm:w-44 shrink-0 snap-start rounded-[6px] border border-line bg-card p-2.5 text-left transition-colors hover:border-accent/50"
                    >
                      <div className="relative">
                        <CoverArt
                          item={
                            entry.work || {
                              title: entry.title,
                              author: entry.author,
                              format: entry.format,
                              workType: entry.workType,
                            }
                          }
                          compact
                          className="w-full rounded-[4px]"
                        />
                        <span
                          title={workMeta.label}
                          className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-[4px] border border-line bg-app/90 text-accent"
                        >
                          <VectorIcon name={workMeta.icon} className="h-3.5 w-3.5" />
                        </span>
                      </div>
                      <div className="mt-2.5 space-y-1.5">
                        <p className="truncate text-xs font-semibold text-ink transition-colors group-hover:text-accent">
                          {cardTitles.primary}
                        </p>
                        {cardTitles.secondary && (
                          <p
                            className="truncate text-[10px] italic"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            {cardTitles.secondary}
                          </p>
                        )}
                        <div className="flex items-center justify-between gap-2 text-[11px] tabular-nums text-muted">
                          <span className="truncate">
                            {entry.author || workMeta.shortLabel}
                          </span>
                          <span className="shrink-0">{entry.metricLabel}</span>
                        </div>
                        <div className="h-[2px] w-full overflow-hidden rounded-[2px] bg-line">
                          <div
                            className="h-full transition-all duration-150"
                            style={{
                              width: `${Math.min(100, entry.progressPct)}%`,
                              backgroundColor: 'var(--accent-color)',
                            }}
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

      {backlogItems.length === 0 ? (
        <section className="rounded-[6px] border border-line bg-card px-6 py-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[4px] border border-line bg-app text-accent">
            <BookOpen className="h-5 w-5" strokeWidth={1.5} />
          </div>
          <h2 className="mt-4 text-base font-semibold tracking-tight text-ink">
            {ui.home.emptyBacklogTitle}
          </h2>
          <p className="mx-auto mt-1.5 max-w-xs text-xs leading-relaxed text-muted">
            {ui.home.emptyBacklogDescription}
          </p>
          <button
            type="button"
            onClick={onNavigateAdd}
            className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-[4px] bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90"
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
                className={`rounded-[6px] border bg-card p-3.5 sm:p-4 transition-colors ${
                  card.highlight ? 'border-accent/40' : 'border-line'
                }`}
              >
                <span
                  className={`block text-2xl font-semibold tabular-nums tracking-tight ${
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

          {/* Meta Anual com barra fina de 4px */}
          <section
            aria-label={ui.home.annualGoalTitle}
            className="rounded-[6px] border border-line bg-card p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 shrink-0 text-accent" strokeWidth={1.5} />
                <h2 className="text-xs font-semibold tracking-tight text-ink">
                  {ui.home.annualGoalTitle}
                </h2>
              </div>
              <div className="flex items-baseline gap-2 text-xs tabular-nums">
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
              className="mt-3 h-[4px] w-full overflow-hidden rounded-[2px] bg-line"
            >
              <div
                className="codice-goal-fill h-full"
                style={{
                  width: `${animatedGoalPct}%`,
                  backgroundColor: 'var(--accent-color)',
                }}
              />
            </div>
          </section>

          <OracleWidget
            items={items}
            profile={profile}
            geminiKey={geminiKey}
            onSelectItem={onSelectItem}
            onOpenGeminiSettings={onOpenGeminiSettings}
          />

          <RecommendationsSection
            items={items}
            profile={profile}
            viewerId={viewerId}
            onAddToWishlist={onAddToWishlist}
            onSelectItem={onSelectItem}
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
                      {(() => {
                        const hiTitles = getDisplayTitles(item, 'bilingual');
                        return (
                          <>
                            <p className="truncate text-xs font-semibold text-ink transition-colors group-hover:text-accent">
                              {hiTitles.primary}
                            </p>
                            {hiTitles.secondary && (
                              <p
                                className="truncate text-[10px] italic"
                                style={{ color: 'var(--text-secondary)' }}
                              >
                                {hiTitles.secondary}
                              </p>
                            )}
                          </>
                        );
                      })()}
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

      {backlogItems.length === 0 && (
        <RecommendationsSection
          items={items}
          profile={profile}
          viewerId={viewerId}
          onAddToWishlist={onAddToWishlist}
          onSelectItem={onSelectItem}
        />
      )}

      <footer className="pt-2 text-center">
        <button
          type="button"
          onClick={() => setReleaseModalOpen(true)}
          className="min-h-[36px] px-2 text-[11px] tabular-nums underline-offset-2 hover:underline"
          style={{ color: 'var(--text-secondary)' }}
        >
          Códice {CODICE_RELEASE.label}
        </button>
      </footer>

      <ReleaseHistoryModal
        isOpen={releaseModalOpen}
        onClose={() => setReleaseModalOpen(false)}
      />
    </div>
  );
}
