import { AlertCircle, Barcode, Check, FileText, PenLine, Plus, RefreshCw, Search, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CoverArt } from '../components/CoverArt';
import { LibraryCatalogSection } from '../components/LibraryCatalogSection';
import { PublisherAutocomplete } from '../components/PublisherAutocomplete';
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
import { normalizePublisherName } from '../data/brazilianPublishers';
import { createUuid } from '../services/codiceDatabase';
import {
  MEDIA_API_SOURCES,
  MEDIA_SOURCE_PRESETS,
  detectDoiQuery,
  detectIsbnQuery,
  getCachedSearchMedia,
  getDefaultSourcesForFilter,
  loadActiveMediaSources,
  saveActiveMediaSources,
  searchMedia,
  searchMockMedia,
} from '../services/mediaApi';
import {
  calculateSmartRating,
  calculateWorkProgress,
  createDefaultReviewCriteria,
  getDisplayTitles,
  getTodayLocalISO,
  getVerdictForScore,
} from '../utils/backlogHelpers';
import { suggestLibraryClassification } from '../utils/catalogingClassification';
import { buildPrefilledCatalogDraft } from '../utils/genreMapper';
import { GENRE_OPTIONS } from '../utils/readerPreferences';

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

const SEARCH_FILTER_STORAGE_KEY = 'codice_add_search_filter_v1';
const MIN_SEARCH_QUERY_LENGTH = 3;
const SEARCH_DEBOUNCE_MS = 300;

function loadSavedSearchFilter() {
  try {
    if (typeof localStorage === 'undefined') return 'all';
    const raw = localStorage.getItem(SEARCH_FILTER_STORAGE_KEY);
    return raw === 'manga' || raw === 'academic' || raw === 'all' ? raw : 'all';
  } catch {
    return 'all';
  }
}

export function AddScreen({
  items,
  geminiKey = '',
  onAddItem,
  onSelectExisting,
  onOpenGeminiSettings,
}) {
  const [query, setQuery] = useState('');
  const [searchFilter, setSearchFilter] = useState(loadSavedSearchFilter);
  const [activeSources, setActiveSources] = useState(() =>
    loadActiveMediaSources(loadSavedSearchFilter())
  );
  const [sourcesPopoverOpen, setSourcesPopoverOpen] = useState(false);
  const [results, setResults] = useState(() =>
    searchMockMedia('', loadSavedSearchFilter())
  );
  const [isLoading, setIsLoading] = useState(false);
  const [pendingSourcesCount, setPendingSourcesCount] = useState(0);
  const [partialFailure, setPartialFailure] = useState(false);
  const [failedSourcesCount, setFailedSourcesCount] = useState(0);
  const [allFailed, setAllFailed] = useState(false);

  const [draftItem, setDraftItem] = useState(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualDraft, setManualDraft] = useState(null);

  const { ui, cardFields, addFlowStatuses, bookFormats, searchFilters } =
    domainConfig;
  const { add } = ui;

  const isIsbnActive = Boolean(detectIsbnQuery(query));
  const isDoiActive = !isIsbnActive && Boolean(detectDoiQuery(query));
  const isEasterEgg67 = query.trim().toLowerCase() === '#ovodepascoa67';
  const debounceTimerRef = useRef(null);
  const searchAbortRef = useRef(null);
  const sourcesPopoverRef = useRef(null);
  const sourcesButtonRef = useRef(null);

  const backlogLookup = useMemo(() => {
    const byId = new Map();
    const byTitle = new Map();
    items
      .filter((item) => item.inBacklog)
      .forEach((item) => {
        byId.set(item.id, item);
        byTitle.set(item.title.trim().toLowerCase(), item);
        if (item.originalTitle) {
          byTitle.set(item.originalTitle.trim().toLowerCase(), item);
        }
      });
    return { byId, byTitle };
  }, [items]);

  const findExisting = (candidate) =>
    backlogLookup.byId.get(candidate.id) ||
    backlogLookup.byTitle.get(candidate.title.trim().toLowerCase()) ||
    null;

  const quickSuggestions = useMemo(() => {
    const libraryAuthors = Array.from(
      new Set(
        items
          .filter((it) => it && it.inBacklog !== false && it.author)
          .map((it) => String(it.author).split(/[;,]/)[0].trim())
          .filter((name) => name.length >= 4 && name.length <= 28)
      )
    )
      .slice(0, 3)
      .map((author) => ({
        label: author,
        query: author,
        filter: 'all',
        sources: getDefaultSourcesForFilter('all'),
      }));

    const defaultGeneral = getDefaultSourcesForFilter('all');
    const curated = [
      {
        label: 'Machado de Assis',
        query: 'Machado de Assis',
        filter: 'all',
        sources: defaultGeneral,
      },
      {
        label: 'Clean Code',
        query: 'Clean Code',
        filter: 'all',
        sources: defaultGeneral,
      },
      {
        label: 'Frank Herbert',
        query: 'Frank Herbert',
        filter: 'all',
        sources: defaultGeneral,
      },
      {
        label: 'Berserk',
        query: 'Berserk',
        filter: 'manga',
        sources: ['jikan'],
      },
      {
        label: 'Metodologia Científica',
        query: 'Metodologia Científica',
        filter: 'academic',
        sources: ['academic'],
      },
    ];

    const seen = new Set();
    return [...libraryAuthors, ...curated]
      .filter((entry) => {
        const key = entry.query.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 6);
  }, [items]);

  const updateSearchFilter = useCallback((nextFilter) => {
    setSearchFilter(nextFilter);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SEARCH_FILTER_STORAGE_KEY, nextFilter);
      }
    } catch {
      // Ignora erro de storage
    }
  }, []);

  const updateSources = useCallback((nextList) => {
    setActiveSources(nextList);
    saveActiveMediaSources(nextList);
  }, []);

  useEffect(() => {
    if (!sourcesPopoverOpen) return undefined;
    const handlePointerDown = (e) => {
      if (
        sourcesPopoverRef.current &&
        !sourcesPopoverRef.current.contains(e.target)
      ) {
        setSourcesPopoverOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setSourcesPopoverOpen(false);
        sourcesButtonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [sourcesPopoverOpen]);

  const handleToggleSource = (sourceId) => {
    const exists = activeSources.includes(sourceId);
    if (exists && activeSources.length === 1) return;
    const next = exists
      ? activeSources.filter((s) => s !== sourceId)
      : [...activeSources, sourceId];
    updateSources(next);
  };

  const handleSelectPreset = (preset) => {
    updateSources(preset.sources);
    updateSearchFilter(preset.filter);
  };

  const handleSelectFilterTab = (nextFilter) => {
    updateSearchFilter(nextFilter);
    updateSources(getDefaultSourcesForFilter(nextFilter));
  };

  const handleApplyQuickSuggestion = (sug) => {
    searchAbortRef.current?.abort();
    updateSearchFilter(sug.filter || 'all');
    if (Array.isArray(sug.sources) && sug.sources.length > 0) {
      updateSources(sug.sources);
    }
    setQuery(sug.query);
  };

  const executeSearch = useCallback(
    async (cleanQuery, filter, sources, { skipCache = false } = {}) => {
      searchAbortRef.current?.abort();

      if (!cleanQuery) {
        setResults(searchMockMedia('', filter));
        setIsLoading(false);
        setPendingSourcesCount(0);
        setPartialFailure(false);
        setFailedSourcesCount(0);
        setAllFailed(false);
        return;
      }

      if (cleanQuery.length < MIN_SEARCH_QUERY_LENGTH) {
        setResults(searchMockMedia(cleanQuery, filter));
        setIsLoading(false);
        setPendingSourcesCount(0);
        setPartialFailure(false);
        setFailedSourcesCount(0);
        setAllFailed(false);
        return;
      }

      if (cleanQuery.toLowerCase() === '#ovodepascoa67') {
        setResults([]);
        setIsLoading(false);
        setPendingSourcesCount(0);
        setPartialFailure(false);
        setFailedSourcesCount(0);
        setAllFailed(false);
        return;
      }

      if (!skipCache) {
        const cached = getCachedSearchMedia(cleanQuery, filter, sources);
        if (cached) {
          setResults(cached.results);
          setPartialFailure(Boolean(cached.partialFailure));
          setFailedSourcesCount(
            Number(cached.failedCount) ||
              (Array.isArray(cached.failedSources) ? cached.failedSources.length : 0)
          );
          setAllFailed(false);
          setPendingSourcesCount(0);
          setIsLoading(false);
          return;
        }
      }

      const controller = new AbortController();
      searchAbortRef.current = controller;
      setIsLoading(true);
      setPendingSourcesCount(sources.length);
      setPartialFailure(false);
      setFailedSourcesCount(0);
      setAllFailed(false);

      try {
        const response = await searchMedia(cleanQuery, {
          signal: controller.signal,
          filter,
          sources,
          skipCache,
          onPartialResults: (partial) => {
            if (controller.signal.aborted) return;
            setPendingSourcesCount(partial.pendingCount || 0);
            if (Array.isArray(partial.results) && partial.results.length > 0) {
              setResults(partial.results);
              setIsLoading(false);
            } else if ((partial.pendingCount || 0) === 0) {
              setIsLoading(false);
            }
          },
        });
        if (!controller.signal.aborted) {
          setResults(response.results);
          setPartialFailure(Boolean(response.partialFailure));
          setFailedSourcesCount(
            Number(response.failedCount) ||
              (Array.isArray(response.failedSources) ? response.failedSources.length : 0)
          );
          setAllFailed(Boolean(response.allFailed));
          setPendingSourcesCount(0);
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          setResults([]);
          setPartialFailure(false);
          setFailedSourcesCount(0);
          setAllFailed(true);
          setPendingSourcesCount(0);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
          setPendingSourcesCount(0);
        }
      }
    },
    []
  );

  useEffect(() => {
    const cleanQuery = query.trim();
    clearTimeout(debounceTimerRef.current);
    searchAbortRef.current?.abort();

    if (
      !cleanQuery ||
      cleanQuery.length < MIN_SEARCH_QUERY_LENGTH ||
      cleanQuery.toLowerCase() === '#ovodepascoa67'
    ) {
      executeSearch(cleanQuery, searchFilter, activeSources);
      return undefined;
    }

    const cached = getCachedSearchMedia(cleanQuery, searchFilter, activeSources);
    if (cached) {
      setResults(cached.results);
      setPartialFailure(Boolean(cached.partialFailure));
      setFailedSourcesCount(
        Number(cached.failedCount) ||
          (Array.isArray(cached.failedSources) ? cached.failedSources.length : 0)
      );
      setAllFailed(false);
      setPendingSourcesCount(0);
      setIsLoading(false);
      return undefined;
    }

    setIsLoading(true);
    debounceTimerRef.current = setTimeout(() => {
      executeSearch(cleanQuery, searchFilter, activeSources);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(debounceTimerRef.current);
      searchAbortRef.current?.abort();
    };
  }, [query, searchFilter, activeSources, executeSearch]);

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(debounceTimerRef.current);
      executeSearch(query.trim(), searchFilter, activeSources);
    }
  };

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
    const classification = suggestLibraryClassification({
      ...item,
      workType: defaultWorkType,
    });
    const prefilled = buildPrefilledCatalogDraft(item, {
      defaultWorkType,
      defaultFormat,
      classification,
    });

    setDraftItem(
      buildDraftWithStatus(
        {
          ...prefilled,
          currentPage: 0,
          currentVolume: 0,
          totalVolumes: item.totalVolumes ?? null,
          currentChapter: 0,
          totalChapters: item.totalChapters ?? null,
          demographicOrigin: item.demographicOrigin || 'Mangá',
          publicationStatus: item.publicationStatus || 'Em lançamento',
          originCountry: item.originCountry || '',
          openAccessUrl: item.openAccessUrl || '',
          isOpenAccess: Boolean(item.isOpenAccess),
          citedByCount: Number(item.citedByCount) || 0,
          freeEpubUrl: item.freeEpubUrl || '',
          isPublicDomain: Boolean(item.isPublicDomain),
          coverCandidates: item.coverCandidates || item.coverSources || [],
          coverSources: item.coverSources || item.coverCandidates || [],
          doi: item.doi || '',
          issn: item.issn || '',
          edition: item.edition || '',
          publicationPlace: item.publicationPlace || '',
          advisor: item.advisor || '',
          seriesName: item.seriesName || '',
          seriesIndex: item.seriesIndex || '',
          physicalLocation: item.physicalLocation || '',
          acquisitionType: item.acquisitionType || '',
          conservationState: item.conservationState || '',
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
    const doiDetected = isbnDetected ? '' : detectDoiQuery(query) || '';

    setManualDraft(
      buildDraftWithStatus(
        {
          workType: doiDetected ? 'academic' : defaultWorkType,
          title: isbnDetected || doiDetected ? '' : query.trim(),
          originalTitle: '',
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
          doi: doiDetected,
          issn: '',
          cdu_cdd: '',
          cutter: '',
          callNumber: '',
          edition: '',
          publicationPlace: '',
          language: '',
          advisor: '',
          seriesName: '',
          seriesIndex: '',
          physicalLocation: '',
          acquisitionType: '',
          conservationState: '',
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
    const cleanTitle = String(draftItem.title || '').trim();
    if (!cleanTitle) return;

    const cleanPrimaryGenre = String(draftItem.primaryGenre || '').trim();
    const parsedSubgenres = String(draftItem.subgenresText || '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s && s.toLowerCase() !== cleanPrimaryGenre.toLowerCase());
    const combinedGenres = Array.from(
      new Set([cleanPrimaryGenre, ...parsedSubgenres].filter(Boolean))
    );
    const parsedYear =
      draftItem.releaseYear !== '' &&
      draftItem.releaseYear !== null &&
      draftItem.releaseYear !== undefined
        ? Number(draftItem.releaseYear) || null
        : null;
    const parsedPages =
      draftItem.totalPages !== '' &&
      draftItem.totalPages !== null &&
      draftItem.totalPages !== undefined &&
      Number(draftItem.totalPages) > 0
        ? Math.round(Number(draftItem.totalPages))
        : null;
    const cleanAuthor = String(draftItem.author || '').trim();
    const { subgenresText, ...restDraft } = draftItem;

    onAddItem({
      ...restDraft,
      title: cleanTitle,
      originalTitle: String(draftItem.originalTitle || '').trim(),
      author: cleanAuthor,
      authors: cleanAuthor
        ? cleanAuthor.split(/[;,]/).map((s) => s.trim()).filter(Boolean)
        : [],
      primaryGenre: cleanPrimaryGenre,
      subgenres: parsedSubgenres,
      genres: combinedGenres.length > 0 ? combinedGenres : draftItem.genres || [],
      releaseYear: parsedYear,
      year: parsedYear,
      publicationYear: parsedYear,
      publisher: normalizePublisherName(draftItem.publisher || ''),
      totalPages: parsedPages,
      isbn: String(draftItem.isbn || '').trim(),
      language: String(draftItem.language || '').trim(),
      synopsis: String(draftItem.synopsis || '').trim(),
    });
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
    const creatorName = manualDraft[cardFields.creator]?.trim() || '';
    const classification = suggestLibraryClassification({
      ...restDraft,
      title: cleanTitle,
      author: creatorName,
      genres: genresList,
    });

    const finalCdd = String(restDraft.cdu_cdd || '').trim() || classification.cdu_cdd;
    const finalCutter = String(restDraft.cutter || '').trim() || classification.cutter;
    const finalCall =
      String(restDraft.callNumber || '').trim() ||
      [finalCdd, finalCutter].filter(Boolean).join(' ');

    onAddItem({
      ...restDraft,
      id: createUuid(),
      title: cleanTitle,
      [cardFields.creator]: creatorName,
      [cardFields.year]: manualDraft[cardFields.year]
        ? Number(manualDraft[cardFields.year])
        : null,
      [cardFields.genres]:
        genresList.length > 0
          ? genresList
          : [classification.primaryGenre, ...(classification.subgenres || [])].filter(Boolean),
      primaryGenre:
        restDraft.primaryGenre || genresList[0] || classification.primaryGenre,
      subgenres:
        Array.isArray(restDraft.subgenres) && restDraft.subgenres.length > 0
          ? restDraft.subgenres
          : genresList.length > 1
            ? genresList.slice(1)
            : classification.subgenres || [],
      tropes:
        Array.isArray(restDraft.tropes) && restDraft.tropes.length > 0
          ? restDraft.tropes
          : classification.suggestedTags || [],
      cdu_cdd: finalCdd,
      cutter: finalCutter,
      callNumber: finalCall,
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

      <div className="sticky top-0 z-20 space-y-2.5 border-b border-line bg-app py-2">
        <div className="relative flex items-center">
          <Search
            className="pointer-events-none absolute left-3.5 h-4 w-4 text-subtle"
            strokeWidth={1.5}
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder={add.searchPlaceholder}
            className="w-full rounded-[6px] border border-line bg-card py-3 pl-10 pr-10 text-sm text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Limpar busca"
              className="absolute right-3 rounded-[4px] p-1 text-subtle hover:text-ink"
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          )}
        </div>

        {/* Sugestões rápidas clicáveis quando o campo está vazio */}
        {!query.trim() && quickSuggestions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted">
              Sugestões:
            </span>
            {quickSuggestions.map((sug) => (
              <button
                key={sug.label}
                type="button"
                onClick={() => handleApplyQuickSuggestion(sug)}
                className="min-h-[32px] rounded-[4px] border border-line bg-card px-2.5 py-1 text-[11px] font-medium text-ink transition-colors hover:border-accent hover:text-accent"
              >
                {sug.label}
              </button>
            ))}
          </div>
        )}

        {/* Barra horizontal compacta: Controle segmentado + Popover Fontes */}
        <div className="flex items-center justify-between gap-2">
          <div
            role="tablist"
            aria-label="Categoria da busca"
            className="grid flex-1 grid-cols-3 rounded-[4px] border border-line bg-card p-0.5"
          >
            {searchFilters.map((filterItem) => {
              const isActive = searchFilter === filterItem.id;
              const shortLabel =
                filterItem.id === 'manga'
                  ? 'Mangá / LN'
                  : filterItem.label;
              return (
                <button
                  key={filterItem.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => handleSelectFilterTab(filterItem.id)}
                  className={`min-h-[40px] truncate rounded-[2px] px-2 py-1 text-[11px] font-medium transition-colors ${
                    isActive
                      ? 'bg-accent text-accent-ink'
                      : 'hover:text-ink'
                  }`}
                  style={!isActive ? { color: 'var(--text-secondary)' } : undefined}
                >
                  {shortLabel}
                </button>
              );
            })}
          </div>

          <div className="relative" ref={sourcesPopoverRef}>
            <button
              ref={sourcesButtonRef}
              type="button"
              onClick={() => setSourcesPopoverOpen((prev) => !prev)}
              aria-expanded={sourcesPopoverOpen}
              aria-haspopup="dialog"
              className={`inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-[4px] border px-3 py-1.5 text-[11px] font-medium transition-colors ${
                sourcesPopoverOpen
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-line bg-card hover:border-accent/50 hover:text-ink'
              }`}
              style={!sourcesPopoverOpen ? { color: 'var(--text-secondary)' } : undefined}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.5} />
              <span>Fontes</span>
              <span className="tabular-nums text-[10px]">
                ({activeSources.length})
              </span>
            </button>

            {sourcesPopoverOpen && (
              <div
                role="dialog"
                aria-label="Selecionar fontes de busca"
                className="absolute right-0 top-12 z-30 w-72 rounded-[6px] border border-line bg-card p-3 space-y-2.5"
              >
                <div className="space-y-1.5">
                  <span className="block text-[10px] font-medium uppercase tracking-wider text-subtle">
                    Predefinições rápidas
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {MEDIA_SOURCE_PRESETS.map((preset) => {
                      const isPresetActive =
                        activeSources.length === preset.sources.length &&
                        preset.sources.every((s) => activeSources.includes(s)) &&
                        searchFilter === preset.filter;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handleSelectPreset(preset)}
                          className={`min-h-[34px] rounded-[4px] border px-2 py-1 text-[10px] font-medium transition-colors ${
                            isPresetActive
                              ? 'border-accent bg-accent/15 text-accent'
                              : 'border-line bg-app text-muted hover:text-ink'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-line pt-2 space-y-1">
                  <span className="block text-[10px] font-medium uppercase tracking-wider text-subtle">
                    APIs ativas
                  </span>
                  {MEDIA_API_SOURCES.map((source) => {
                    const checked = activeSources.includes(source.id);
                    return (
                      <label
                        key={source.id}
                        className="flex min-h-[44px] cursor-pointer items-center justify-between gap-2 rounded-[4px] px-2 py-1 hover:bg-app"
                      >
                        <div className="min-w-0">
                          <span className="block text-xs font-medium text-ink">
                            {source.label}
                          </span>
                          <span className="block truncate text-[10px] text-subtle">
                            {source.hint}
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggleSource(source.id)}
                          className="h-4 w-4 shrink-0 rounded-[2px] accent-[var(--accent-color)]"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {query.trim().length > 0 && query.trim().length < MIN_SEARCH_QUERY_LENGTH && (
          <p className="text-[11px] text-muted">
            Digite ao menos 3 caracteres para buscar nas fontes externas (mostrando sugestões locais).
          </p>
        )}

        {isIsbnActive && (
          <div className="inline-flex items-center gap-1.5 rounded-[4px] border border-accent/40 bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent">
            <Barcode className="h-4 w-4" strokeWidth={1.5} />
            <span>{add.isbnDetectedLabel}</span>
          </div>
        )}

        {isDoiActive && (
          <div className="inline-flex items-center gap-1.5 rounded-[4px] border border-accent/40 bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent">
            <FileText className="h-4 w-4" strokeWidth={1.5} />
            <span>Busca direta por DOI detectada (CrossRef)</span>
          </div>
        )}

        {!isLoading && (partialFailure || allFailed) && query.trim().length >= MIN_SEARCH_QUERY_LENGTH && (
          <div
            role="status"
            className="flex items-center justify-between gap-2 rounded-[4px] border border-line bg-card px-3 py-2 text-xs text-muted"
          >
            <span className="inline-flex min-w-0 items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-accent" strokeWidth={1.5} />
              <span className="truncate">
                {allFailed
                  ? 'Fontes externas indisponíveis. Exibindo sugestões locais.'
                  : `${failedSourcesCount || 1} ${(failedSourcesCount || 1) === 1 ? 'fonte indisponível' : 'fontes indisponíveis'}`}
              </span>
            </span>
            <button
              type="button"
              onClick={() =>
                executeSearch(query.trim(), searchFilter, activeSources, {
                  skipCache: true,
                })
              }
              className="inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-[4px] border border-line bg-app px-2.5 py-1 text-[11px] font-medium text-accent hover:border-accent"
            >
              <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} />
              Tentar de novo
            </button>
          </div>
        )}
      </div>

      <section className="space-y-2.5">
        <div className="flex items-center justify-between text-xs text-subtle">
          <span>
            {query.trim() ? add.resultsLabel : add.suggestionsLabel}
            {pendingSourcesCount > 0 ? ' (completando outras fontes...)' : ''}
          </span>
          {!isLoading && <span className="tabular-nums">{results.length}</span>}
        </div>

        {isEasterEgg67 ? (
          <div className="rounded-2xl border border-accent/50 bg-card p-6 text-center space-y-2.5">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-accent/40 bg-accent/15 text-accent">
              <Sparkles className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-ink">
              Easter Egg #ovodepascoa67
            </p>
            <p className="text-xs text-muted">
              Você encontrou o segredo escondido na busca do acervo.
            </p>
          </div>
        ) : isLoading ? (
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
                      className="h-18 w-12 shrink-0 rounded-xl"
                    />

                    <div className="min-w-0 flex-1">
                      {(() => {
                        const titles = getDisplayTitles(item, 'bilingual');
                        return (
                          <>
                            <h2 className="truncate text-sm font-medium text-ink">
                              {titles.primary}
                            </h2>
                            {titles.secondary && (
                              <p
                                className="truncate text-[11px] italic"
                                style={{ color: 'var(--text-secondary)' }}
                              >
                                {titles.secondary}
                              </p>
                            )}
                          </>
                        );
                      })()}
                      {metaLine && (
                        <p className="mt-0.5 truncate text-xs text-muted">
                          {metaLine}
                        </p>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {item.sourceLabel && (
                          <span className="inline-flex items-center gap-1 rounded-[4px] border border-accent/30 bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                            <VectorIcon name={workMeta.icon} className="h-2.5 w-2.5" />
                            {item.sourceLabel}
                          </span>
                        )}
                        {item.openAccessUrl && (
                          <span className="rounded-[4px] border border-accent/40 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                            PDF Open Access
                          </span>
                        )}
                        {item.citedByCount > 0 && (
                          <span className="rounded-[4px] border border-line bg-app px-1.5 py-0.5 text-[10px] tabular-nums text-muted">
                            {item.citedByCount} citações
                          </span>
                        )}
                        {(item.freeEpubUrl || item.isPublicDomain) && (
                          <span className="rounded-[4px] border border-accent/40 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                            {item.freeEpubUrl ? 'EPUB Grátis' : 'Domínio Público'}
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
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70"
          onClick={() => setDraftItem(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-[6px] border-x border-t border-line bg-card p-5 pb-8 no-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-[2px] bg-line" />

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
                {draftItem.originalTitle &&
                  draftItem.originalTitle.toLowerCase() !==
                    String(draftItem.title || '').toLowerCase() && (
                    <p
                      className="truncate text-xs italic"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {draftItem.originalTitle}
                    </p>
                  )}
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
                className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-[4px] border border-line text-muted hover:text-ink"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
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
                  setDraftItem((prev) => {
                    const next = { ...prev, ...updates };
                    if (Array.isArray(updates.genres) && updates.genres.length > 0) {
                      next.primaryGenre = prev.primaryGenre || updates.genres[0] || '';
                      const nextSubs = updates.genres.filter(
                        (g) => g.toLowerCase() !== String(next.primaryGenre || '').toLowerCase()
                      );
                      if (!prev.subgenresText && nextSubs.length > 0) {
                        next.subgenres = nextSubs;
                        next.subgenresText = nextSubs.join(', ');
                      }
                    }
                    return next;
                  })
                }
                onOpenGeminiSettings={() => {
                  setDraftItem(null);
                  onOpenGeminiSettings?.();
                }}
              />
            </div>

            <div className="mt-4 space-y-3 rounded-[6px] border border-line bg-app p-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                Dados da Edição (editáveis antes de salvar)
              </p>

              <datalist id="codice-primary-genres">
                {[
                  'Fantasia',
                  'Computação & Tecnologia',
                  'Ficção Científica',
                  'Literatura Clássica',
                  'Romance',
                  'Suspense & Thriller',
                  'Terror & Gótico',
                  'Filosofia',
                  'História',
                  'Psicologia',
                  'Acadêmico & Pesquisa',
                  'Biografias & Memórias',
                  'Poesia',
                  'Não-Ficção',
                  'Mangás & HQs',
                  ...GENRE_OPTIONS,
                ].map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>

              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-muted">
                  Título
                </span>
                <input
                  type="text"
                  value={draftItem.title || ''}
                  onChange={(e) =>
                    setDraftItem((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="Título principal da sua edição"
                  className="min-h-[44px] w-full rounded-[4px] border border-line bg-card px-3 py-2 text-xs font-medium text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-muted">
                  Título Original
                </span>
                <input
                  type="text"
                  value={draftItem.originalTitle || ''}
                  onChange={(e) =>
                    setDraftItem((prev) => ({
                      ...prev,
                      originalTitle: e.target.value,
                    }))
                  }
                  placeholder="Título no idioma original (opcional)"
                  className="min-h-[44px] w-full rounded-[4px] border border-line bg-card px-3 py-2 text-xs italic text-ink placeholder:not-italic placeholder:text-subtle focus:border-accent focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-muted">
                  Autores
                </span>
                <input
                  type="text"
                  value={draftItem.author || ''}
                  onChange={(e) =>
                    setDraftItem((prev) => ({ ...prev, author: e.target.value }))
                  }
                  placeholder="Ex: Patrick Rothfuss"
                  className="min-h-[44px] w-full rounded-[4px] border border-line bg-card px-3 py-2 text-xs text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium text-muted">
                    Gênero Principal
                  </span>
                  <input
                    type="text"
                    list="codice-primary-genres"
                    value={draftItem.primaryGenre || ''}
                    onChange={(e) =>
                      setDraftItem((prev) => ({
                        ...prev,
                        primaryGenre: e.target.value,
                      }))
                    }
                    placeholder="Ex: Fantasia"
                    className="min-h-[44px] w-full rounded-[4px] border border-line bg-card px-3 py-2 text-xs text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium text-muted">
                    Subgênero(s)
                  </span>
                  <input
                    type="text"
                    value={draftItem.subgenresText || ''}
                    onChange={(e) =>
                      setDraftItem((prev) => ({
                        ...prev,
                        subgenresText: e.target.value,
                      }))
                    }
                    placeholder="Ex: Fantasia Épica"
                    className="min-h-[44px] w-full rounded-[4px] border border-line bg-card px-3 py-2 text-xs text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium text-muted">
                    Ano
                  </span>
                  <input
                    type="number"
                    value={draftItem.releaseYear ?? ''}
                    onChange={(e) =>
                      setDraftItem((prev) => ({
                        ...prev,
                        releaseYear:
                          e.target.value === '' ? null : Number(e.target.value),
                      }))
                    }
                    placeholder="Ex: 2009"
                    className="min-h-[44px] w-full rounded-[4px] border border-line bg-card px-3 py-2 text-xs tabular-nums text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium text-muted">
                    Total de Páginas
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={draftItem.totalPages ?? ''}
                    onChange={(e) => {
                      const val =
                        e.target.value === '' ? null : Number(e.target.value);
                      setDraftItem((prev) => ({
                        ...prev,
                        totalPages: val,
                        progress: calculateWorkProgress({
                          ...prev,
                          totalPages: val,
                        }),
                      }));
                    }}
                    placeholder="Ex: 656"
                    className="min-h-[44px] w-full rounded-[4px] border border-line bg-card px-3 py-2 text-xs tabular-nums text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
                  />
                </label>

                <label className="col-span-2 sm:col-span-1 block">
                  <span className="mb-1 block text-[11px] font-medium text-muted">
                    Idioma
                  </span>
                  <input
                    type="text"
                    value={draftItem.language || ''}
                    onChange={(e) =>
                      setDraftItem((prev) => ({
                        ...prev,
                        language: e.target.value,
                      }))
                    }
                    placeholder="Ex: Português"
                    className="min-h-[44px] w-full rounded-[4px] border border-line bg-card px-3 py-2 text-xs text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <PublisherAutocomplete
                  value={draftItem.publisher || ''}
                  onChange={(nextPub) =>
                    setDraftItem((prev) => ({ ...prev, publisher: nextPub }))
                  }
                  label="Editora"
                  placeholder="Ex: Arqueiro / Sextante"
                  category={
                    draftItem.workType === 'manga'
                      ? 'hq'
                      : draftItem.workType === 'academic'
                        ? 'academico'
                        : 'all'
                  }
                  inputClassName="min-h-[44px] w-full rounded-[4px] border border-line bg-card px-3 py-2 text-xs text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
                />

                <label className="block">
                  <span className="mb-1 block text-[10px] font-medium text-subtle">
                    ISBN
                  </span>
                  <input
                    type="text"
                    value={draftItem.isbn || ''}
                    onChange={(e) =>
                      setDraftItem((prev) => ({ ...prev, isbn: e.target.value }))
                    }
                    placeholder="Ex: 9788599296493"
                    className="min-h-[44px] w-full rounded-[4px] border border-line bg-card px-3 py-2 text-xs tabular-nums text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-muted">
                  Sinopse (sem spoilers)
                </span>
                <textarea
                  rows={3}
                  value={draftItem.synopsis || ''}
                  onChange={(e) =>
                    setDraftItem((prev) => ({ ...prev, synopsis: e.target.value }))
                  }
                  placeholder="Sinopse breve ou premissa sem spoilers..."
                  className="w-full resize-y rounded-[4px] border border-line bg-card px-3 py-2 text-xs leading-relaxed text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
                />
              </label>
            </div>

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

            <div className="mt-4 space-y-3">
              <TechnicalAtmosphereSection
                item={draftItem}
                onChange={(updates) =>
                  setDraftItem((prev) => ({ ...prev, ...updates }))
                }
              />
              <LibraryCatalogSection
                item={draftItem}
                onChange={(updates) =>
                  setDraftItem((prev) => ({ ...prev, ...updates }))
                }
              />
            </div>

            <button
              type="button"
              onClick={handleConfirmAdd}
              className="mt-6 min-h-[44px] w-full rounded-[4px] bg-accent py-3 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90"
            >
              {add.drawerSaveLabel}
            </button>
          </div>
        </div>
      )}

      {manualOpen && manualDraft && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70"
          onClick={() => setManualOpen(false)}
        >
          <form
            onSubmit={handleSaveManual}
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-[6px] border-x border-t border-line bg-card p-5 pb-8 no-scrollbar"
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

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">
                  Título Original (opcional)
                </span>
                <input
                  type="text"
                  value={manualDraft.originalTitle || ''}
                  onChange={(e) =>
                    setManualDraft((prev) => ({
                      ...prev,
                      originalTitle: e.target.value,
                    }))
                  }
                  placeholder="Ex: The Name of the Rose / 1984"
                  className="w-full rounded-xl border border-line bg-app px-3 py-2 text-xs italic text-ink placeholder:not-italic placeholder:text-subtle focus:border-accent focus:outline-none"
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

              <LibraryCatalogSection
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
