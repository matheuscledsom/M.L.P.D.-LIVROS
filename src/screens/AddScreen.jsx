import { Barcode, Check, PenLine, Plus, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { CoverArt } from '../components/CoverArt';
import { SmartCatalogButton } from '../components/SmartCatalogButton';
import { TactileStatusFields } from '../components/TactileStatusFields';
import { TechnicalAtmosphereSection } from '../components/TechnicalAtmosphereSection';
import { VectorIcon } from '../components/VectorIcon';
import { WorkTypeSelector } from '../components/WorkTypeSelector';
import {
  domainConfig,
  getStatusConfig,
  getWorkTypeConfig,
} from '../config/domainConfig';
import { detectIsbnQuery, searchMedia, searchMockMedia } from '../services/mediaApi';
import {
  calculateSmartRating,
  calculateWorkProgress,
  createDefaultReviewCriteria,
  getTodayLocalISO,
  getVerdictForScore,
} from '../utils/backlogHelpers';

const MANUAL_PALETTES = [
  ['#1E1B4B', '#8B5CF6', '#38BDF8'],
  ['#18181B', '#C084FC', '#F43F5E'],
  ['#0F172A', '#38BDF8', '#10B981'],
];

function createMonogram(title) {
  const words = String(title || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }
  return String(title || 'OB').slice(0, 2).toUpperCase();
}

function buildDraftWithStatus(baseDraft, nextStatus) {
  const today = getTodayLocalISO();
  const updated = { ...baseDraft, status: nextStatus };

  if (nextStatus === 'playing') {
    updated.startDate = updated.startDate || today;
    updated.progress = calculateWorkProgress(updated);
  }

  if (nextStatus === 'completed') {
    updated.completedDate = updated.completedDate || today;
    updated.startDate = updated.startDate || updated.completedDate;
    updated.progress = 100;
    if (Number(updated.totalPages) > 0) {
      updated.currentPage = Number(updated.totalPages);
    }
    if (updated.workType === 'manga') {
      if (Number(updated.totalChapters) > 0) {
        updated.currentChapter = Number(updated.totalChapters);
      }
      if (Number(updated.totalVolumes) > 0) {
        updated.currentVolume = Number(updated.totalVolumes);
      }
    }
    updated.completionType =
      updated.completionType || domainConfig.tactileOptions.completionTypes[0];
    if (!updated.reviewCriteria) {
      updated.reviewCriteria = createDefaultReviewCriteria(80);
    }
    updated.rating = calculateSmartRating(updated.reviewCriteria);
    updated.verdict = getVerdictForScore(updated.rating);
  }

  if (nextStatus === 'queued') {
    updated.progress = calculateWorkProgress(updated);
  }

  return updated;
}

function ResultSkeleton() {
  return (
    <div className="space-y-2.5" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="flex animate-pulse items-center gap-3 rounded-2xl border border-line bg-card p-2.5"
        >
          <div className="h-16 w-12 shrink-0 rounded-xl bg-elevated" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-2/3 rounded bg-elevated" />
            <div className="h-3 w-1/2 rounded bg-elevated/70" />
          </div>
          <div className="h-7 w-16 shrink-0 rounded-lg bg-elevated/80" />
        </div>
      ))}
    </div>
  );
}

export function AddScreen({
  items,
  geminiKey = '',
  onAddItem,
  onSelectExisting,
  onOpenGeminiSettings,
}) {
  const [query, setQuery] = useState('');
  const [searchFilter, setSearchFilter] = useState('all');
  const [results, setResults] = useState(() => searchMockMedia('', 'all'));
  const [isLoading, setIsLoading] = useState(false);

  const [draftItem, setDraftItem] = useState(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualDraft, setManualDraft] = useState(null);

  const { ui, cardFields, addFlowStatuses, bookFormats, searchFilters } =
    domainConfig;
  const { add } = ui;

  const isIsbnActive = Boolean(detectIsbnQuery(query));

  const backlogLookup = useMemo(() => {
    const byId = new Map();
    const byTitle = new Map();
    items
      .filter((item) => item.inBacklog)
      .forEach((item) => {
        byId.set(item.id, item);
        byTitle.set(item.title.trim().toLowerCase(), item);
      });
    return { byId, byTitle };
  }, [items]);

  const findExisting = (candidate) =>
    backlogLookup.byId.get(candidate.id) ||
    backlogLookup.byTitle.get(candidate.title.trim().toLowerCase()) ||
    null;

  useEffect(() => {
    const cleanQuery = query.trim();
    if (!cleanQuery) {
      setResults(searchMockMedia('', searchFilter));
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);

    const timer = setTimeout(async () => {
      try {
        const { results: fetched } = await searchMedia(cleanQuery, {
          signal: controller.signal,
          filter: searchFilter,
        });
        setResults(fetched);
      } catch (error) {
        if (error.name !== 'AbortError') {
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, 450);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, searchFilter]);

  const openQuickAdd = (item) => {
    const existing = findExisting(item);
    if (existing) {
      onSelectExisting(existing);
      return;
    }

    const defaultWorkType =
      item.workType ||
      (searchFilter === 'manga'
        ? 'manga'
        : searchFilter === 'academic'
          ? 'academic'
          : 'book');
    const defaultFormat = item.format || bookFormats[0];

    setDraftItem(
      buildDraftWithStatus(
        {
          ...item,
          workType: defaultWorkType,
          format: defaultFormat,
          currentPage: 0,
          totalPages: item.totalPages ?? null,
          currentVolume: 0,
          totalVolumes: item.totalVolumes ?? null,
          currentChapter: 0,
          totalChapters: item.totalChapters ?? null,
          demographicOrigin: item.demographicOrigin || 'Mangá',
          publicationStatus: item.publicationStatus || 'Em lançamento',
          publisher: item.publisher || '',
          isbn: item.isbn || '',
          translator: item.translator || '',
          seriesVolume: item.seriesVolume || '',
          academicProgressMode: 'pages',
          fichamentoSteps: {},
          institution: item.institution || '',
          keywords: item.keywords || '',
          fichamento: '',
          abntReference: '',
          atmosphere: item.atmosphere || [],
          tropes: item.tropes || [],
          progress: 0,
          hype: 'high',
          access: defaultFormat,
          checkpoint: '',
          isPlatinum: false,
          notes: '',
        },
        add.defaultNewStatus
      )
    );
  };

  const openManualModal = () => {
    const defaultWorkType =
      searchFilter === 'manga'
        ? 'manga'
        : searchFilter === 'academic'
          ? 'academic'
          : 'book';

    const isbnDetected = detectIsbnQuery(query) || '';

    setManualDraft(
      buildDraftWithStatus(
        {
          workType: defaultWorkType,
          title: isbnDetected ? '' : query.trim(),
          [cardFields.creator]: '',
          [cardFields.year]: domainConfig.currentYear,
          genresText: '',
          format: bookFormats[0],
          currentPage: 0,
          totalPages: null,
          currentVolume: 0,
          totalVolumes: null,
          currentChapter: 0,
          totalChapters: null,
          demographicOrigin: 'Mangá',
          publicationStatus: 'Em lançamento',
          publisher: '',
          isbn: isbnDetected,
          translator: '',
          seriesVolume: '',
          academicProgressMode: 'pages',
          fichamentoSteps: {},
          institution: '',
          keywords: '',
          fichamento: '',
          abntReference: '',
          atmosphere: [],
          tropes: [],
          progress: 0,
          hype: 'high',
          access: bookFormats[0],
          checkpoint: '',
          isPlatinum: false,
          notes: '',
        },
        add.defaultNewStatus
      )
    );
    setManualOpen(true);
  };

  const handleConfirmAdd = () => {
    if (!draftItem) return;
    onAddItem(draftItem);
    setDraftItem(null);
  };

  const handleSaveManual = (e) => {
    e.preventDefault();
    if (!manualDraft) return;
    const cleanTitle = manualDraft.title.trim();
    if (!cleanTitle) return;

    const genresList = (manualDraft.genresText || '')
      .split(',')
      .map((g) => g.trim())
      .filter(Boolean);

    const palette = MANUAL_PALETTES[cleanTitle.length % MANUAL_PALETTES.length];
    const { genresText, ...restDraft } = manualDraft;

    onAddItem({
      ...restDraft,
      id: `manual-${Date.now()}`,
      title: cleanTitle,
      [cardFields.creator]: manualDraft[cardFields.creator]?.trim() || '',
      [cardFields.year]: manualDraft[cardFields.year]
        ? Number(manualDraft[cardFields.year])
        : null,
      [cardFields.genres]: genresList,
      monogram: createMonogram(cleanTitle),
      palette,
    });

    setManualOpen(false);
    setManualDraft(null);
    setQuery('');
  };

  return (
    <div className="space-y-4 pb-24">
      <header className="flex items-start justify-between gap-3 pt-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            {add.title}
          </h1>
          <p className="mt-0.5 text-xs text-subtle">{add.subtitle}</p>
        </div>

        <button
          type="button"
          onClick={openManualModal}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-[11px] font-medium text-accent transition-colors hover:bg-accent/20"
        >
          <PenLine className="h-3 w-3" />
          {add.manualButtonLabel}
        </button>
      </header>

      <div className="sticky top-0 z-20 space-y-2.5 bg-app/95 py-2 backdrop-blur-xs">
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-subtle" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={add.searchPlaceholder}
            className="w-full rounded-2xl border border-line bg-card py-3 pl-10 pr-10 text-sm text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Limpar busca"
              className="absolute right-3 rounded-full p-1 text-subtle hover:text-ink"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {searchFilters.map((filterItem) => {
            const isActive = searchFilter === filterItem.id;
            return (
              <button
                key={filterItem.id}
                type="button"
                onClick={() => setSearchFilter(filterItem.id)}
                className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${
                  isActive
                    ? 'border-accent bg-accent text-accent-ink'
                    : 'border-line bg-card text-muted hover:text-ink'
                }`}
              >
                {filterItem.label}
              </button>
            );
          })}
        </div>

        {isIsbnActive && (
          <div className="inline-flex items-center gap-1.5 rounded-xl border border-accent/40 bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent">
            <Barcode className="h-3.5 w-3.5" />
            <span>{add.isbnDetectedLabel}</span>
          </div>
        )}
      </div>

      <section className="space-y-2.5">
        <div className="flex items-center justify-between text-xs text-subtle">
          <span>{query.trim() ? add.resultsLabel : add.suggestionsLabel}</span>
          {!isLoading && <span>{results.length}</span>}
        </div>

        {isLoading ? (
          <ResultSkeleton />
        ) : results.length === 0 ? (
          <div className="rounded-2xl border border-line bg-card px-5 py-10 text-center">
            <p className="text-sm font-medium text-ink">{add.emptySearchTitle}</p>
            <p className="mt-1 text-xs text-subtle">
              {add.emptySearchDescription}
            </p>
            <button
              type="button"
              onClick={openManualModal}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-ink transition-opacity hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" />
              {add.manualButtonLabel}
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-2.5">
              {results.map((item) => {
                const inList = Boolean(findExisting(item));
                const genres = item[cardFields.genres] || [];
                const metaLine = [
                  item[cardFields.creator],
                  item[cardFields.year],
                ]
                  .filter(Boolean)
                  .join(' • ');
                const workMeta = getWorkTypeConfig(item.workType);

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openQuickAdd(item)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-line bg-card p-2.5 text-left transition-colors hover:border-accent/50"
                  >
                    <CoverArt
                      item={item}
                      compact
                      className="h-16 w-12 shrink-0 rounded-xl"
                    />

                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-sm font-medium text-ink">
                        {item.title}
                      </h2>
                      {metaLine && (
                        <p className="mt-0.5 truncate text-xs text-muted">
                          {metaLine}
                        </p>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {item.sourceLabel && (
                          <span className="inline-flex items-center gap-1 rounded-md border border-accent/30 bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                            <VectorIcon name={workMeta.icon} className="h-2.5 w-2.5" />
                            {item.sourceLabel}
                          </span>
                        )}
                        {genres.slice(0, 1).map((genre) => (
                          <span
                            key={genre}
                            className="max-w-[130px] truncate rounded-md border border-line bg-app px-1.5 py-0.5 text-[10px] text-muted"
                          >
                            {genre}
                          </span>
                        ))}
                        {item.workType === 'manga' && (item.totalVolumes || item.totalChapters) ? (
                          <span className="rounded-md border border-line bg-app px-1.5 py-0.5 text-[10px] text-ink">
                            {[
                              item.totalVolumes ? `${item.totalVolumes} vols` : null,
                              item.totalChapters ? `${item.totalChapters} caps` : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        ) : (
                          item.totalPages > 0 && (
                            <span className="rounded-md border border-line bg-app px-1.5 py-0.5 text-[10px] text-ink">
                              {item.totalPages} págs
                            </span>
                          )
                        )}
                      </div>
                    </div>

                    {inList ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent">
                        <Check className="h-3 w-3" />
                        {add.inListBadge}
                      </span>
                    ) : (
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
                        <Plus className="h-4 w-4" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={openManualModal}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line bg-card/60 py-3.5 text-xs font-medium text-muted transition-colors hover:border-accent/50 hover:text-ink"
            >
              <Plus className="h-3.5 w-3.5 text-accent" />
              {add.manualButtonLabel}
            </button>
          </>
        )}
      </section>

      {draftItem && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-xs"
          onClick={() => setDraftItem(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl border-x border-t border-line bg-card p-5 pb-8 shadow-2xl no-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />

            <div className="flex items-center gap-3">
              <CoverArt
                item={draftItem}
                compact
                className="h-16 w-12 shrink-0 rounded-xl"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-accent">
                  {add.drawerTitle}
                </p>
                <h3 className="truncate text-base font-semibold text-ink">
                  {draftItem.title}
                </h3>
                {(draftItem[cardFields.creator] || draftItem[cardFields.year]) && (
                  <p className="truncate text-xs text-muted">
                    {[draftItem[cardFields.creator], draftItem[cardFields.year]]
                      .filter(Boolean)
                      .join(' • ')}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setDraftItem(null)}
                aria-label={add.drawerCancelLabel}
                className="rounded-full p-1 text-muted hover:bg-elevated hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5">
              <WorkTypeSelector
                label={add.drawerWorkTypeLabel}
                value={draftItem.workType}
                onChange={(nextType) =>
                  setDraftItem((prev) => ({
                    ...prev,
                    workType: nextType,
                    progress: calculateWorkProgress({
                      ...prev,
                      workType: nextType,
                    }),
                  }))
                }
              />
            </div>

            <div className="mt-4">
              <SmartCatalogButton
                item={draftItem}
                geminiKey={geminiKey}
                onApplyFields={(updates) =>
                  setDraftItem((prev) => ({ ...prev, ...updates }))
                }
                onOpenGeminiSettings={() => {
                  setDraftItem(null);
                  onOpenGeminiSettings?.();
                }}
              />
            </div>

            <label className="mt-3 block">
              <span className="mb-1 block text-[11px] font-medium text-muted">
                Sinopse (sem spoilers)
              </span>
              <textarea
                rows={2}
                value={draftItem.synopsis || ''}
                onChange={(e) =>
                  setDraftItem((prev) => ({ ...prev, synopsis: e.target.value }))
                }
                placeholder="Sinopse breve ou premissa sem spoilers..."
                className="w-full resize-none rounded-xl border border-line bg-app px-3 py-2 text-xs leading-relaxed text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
              />
            </label>

            <div className="mt-4">
              <p className="mb-2 text-xs font-medium text-muted">
                {add.drawerStatusLabel}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {addFlowStatuses.map((statusId) => {
                  const status = getStatusConfig(statusId);
                  const isSelected = draftItem.status === status.id;
                  return (
                    <button
                      key={status.id}
                      type="button"
                      onClick={() =>
                        setDraftItem((prev) => buildDraftWithStatus(prev, status.id))
                      }
                      className={`flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-[11px] font-medium transition-colors ${
                        isSelected
                          ? 'border-accent bg-accent/15 text-ink'
                          : 'border-line bg-app text-muted hover:text-ink'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${status.dotClass}`} />
                      <span className="truncate">{status.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 border-t border-line pt-4">
              <TactileStatusFields
                item={draftItem}
                showJournalAction={false}
                onChange={(updates) =>
                  setDraftItem((prev) => ({ ...prev, ...updates }))
                }
              />
            </div>

            <div className="mt-4">
              <TechnicalAtmosphereSection
                item={draftItem}
                onChange={(updates) =>
                  setDraftItem((prev) => ({ ...prev, ...updates }))
                }
              />
            </div>

            <button
              type="button"
              onClick={handleConfirmAdd}
              className="mt-6 w-full rounded-2xl bg-accent py-3 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90"
            >
              {add.drawerSaveLabel}
            </button>
          </div>
        </div>
      )}

      {manualOpen && manualDraft && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-xs"
          onClick={() => setManualOpen(false)}
        >
          <form
            onSubmit={handleSaveManual}
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl border-x border-t border-line bg-card p-5 pb-8 shadow-2xl no-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />

            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-ink">
                {add.manualModalTitle}
              </h3>
              <button
                type="button"
                onClick={() => setManualOpen(false)}
                aria-label={add.drawerCancelLabel}
                className="rounded-full p-1 text-muted hover:bg-elevated hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5">
              <WorkTypeSelector
                label={add.drawerWorkTypeLabel}
                value={manualDraft.workType}
                onChange={(nextType) =>
                  setManualDraft((prev) => ({
                    ...prev,
                    workType: nextType,
                    progress: calculateWorkProgress({
                      ...prev,
                      workType: nextType,
                    }),
                  }))
                }
              />

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">
                  {add.manualTitleLabel}
                </span>
                <input
                  type="text"
                  required
                  autoFocus
                  value={manualDraft.title}
                  onChange={(e) =>
                    setManualDraft((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder={add.manualTitlePlaceholder}
                  className="w-full rounded-xl border border-line bg-app px-3 py-2.5 text-sm text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
                />
              </label>

              <div className="grid grid-cols-3 gap-2.5">
                <label className="col-span-2 block">
                  <span className="mb-1 block text-xs font-medium text-muted">
                    {add.manualCreatorLabel}
                  </span>
                  <input
                    type="text"
                    value={manualDraft[cardFields.creator]}
                    onChange={(e) =>
                      setManualDraft((prev) => ({
                        ...prev,
                        [cardFields.creator]: e.target.value,
                      }))
                    }
                    placeholder={add.manualCreatorPlaceholder}
                    className="w-full rounded-xl border border-line bg-app px-3 py-2.5 text-sm text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted">
                    {add.manualYearLabel}
                  </span>
                  <input
                    type="number"
                    value={manualDraft[cardFields.year] ?? ''}
                    onChange={(e) =>
                      setManualDraft((prev) => ({
                        ...prev,
                        [cardFields.year]: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-line bg-app px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">
                  {add.manualGenresLabel}
                </span>
                <input
                  type="text"
                  value={manualDraft.genresText}
                  onChange={(e) =>
                    setManualDraft((prev) => ({
                      ...prev,
                      genresText: e.target.value,
                    }))
                  }
                  placeholder={add.manualGenresPlaceholder}
                  className="w-full rounded-xl border border-line bg-app px-3 py-2.5 text-sm text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
                />
              </label>

              <SmartCatalogButton
                item={manualDraft}
                geminiKey={geminiKey}
                onApplyFields={(updates) =>
                  setManualDraft((prev) => ({
                    ...prev,
                    ...updates,
                    ...(updates.genres
                      ? { genresText: updates.genres.join(', ') }
                      : {}),
                  }))
                }
                onOpenGeminiSettings={() => {
                  setManualOpen(false);
                  onOpenGeminiSettings?.();
                }}
              />

              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-muted">
                  Sinopse (sem spoilers)
                </span>
                <textarea
                  rows={2}
                  value={manualDraft.synopsis || ''}
                  onChange={(e) =>
                    setManualDraft((prev) => ({
                      ...prev,
                      synopsis: e.target.value,
                    }))
                  }
                  placeholder="Sinopse breve ou premissa sem spoilers..."
                  className="w-full resize-none rounded-xl border border-line bg-app px-3 py-2 text-xs leading-relaxed text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
                />
              </label>

              <div>
                <p className="mb-2 text-xs font-medium text-muted">
                  {add.drawerStatusLabel}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {addFlowStatuses.map((statusId) => {
                    const status = getStatusConfig(statusId);
                    const isSelected = manualDraft.status === status.id;
                    return (
                      <button
                        key={status.id}
                        type="button"
                        onClick={() =>
                          setManualDraft((prev) =>
                            buildDraftWithStatus(prev, status.id)
                          )
                        }
                        className={`flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-[11px] font-medium transition-colors ${
                          isSelected
                            ? 'border-accent bg-accent/15 text-ink'
                            : 'border-line bg-app text-muted hover:text-ink'
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${status.dotClass}`} />
                        <span className="truncate">{status.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-line pt-4">
                <TactileStatusFields
                  item={manualDraft}
                  showJournalAction={false}
                  onChange={(updates) =>
                    setManualDraft((prev) => ({ ...prev, ...updates }))
                  }
                />
              </div>

              <TechnicalAtmosphereSection
                item={manualDraft}
                onChange={(updates) =>
                  setManualDraft((prev) => ({ ...prev, ...updates }))
                }
              />
            </div>

            <button
              type="submit"
              className="mt-6 w-full rounded-2xl bg-accent py-3 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90"
            >
              {add.drawerSaveLabel}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
