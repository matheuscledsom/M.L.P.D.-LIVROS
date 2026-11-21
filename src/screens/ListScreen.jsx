import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BookMarked,
  BookOpen,
  Dices,
  FolderPlus,
  FolderTree,
  LayoutGrid,
  LayoutList,
  Library,
  MapPin,
  Palette,
  Plus,
  Search,
  SlidersHorizontal,
  Star,
  Table2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { CollectionCreatorBar } from '../components/CollectionCreatorBar';
import { CoverArt } from '../components/CoverArt';
import { OfflineBookPickerModal } from '../components/OfflineBookPickerModal';
import { ResponsiveSheet } from '../components/ResponsiveSheet';
import { StatusBadge } from '../components/StatusBadge';
import { VectorIcon } from '../components/VectorIcon';
import { isFlagEnabled } from '../config/flags';
import { SpineRenderer } from '../graphics/SpineRenderer';
import {
  domainConfig,
  getStatusConfig,
  getStatusList,
  getWorkTypeConfig,
} from '../config/domainConfig';
import {
  calculateWorkProgress,
  formatFlexibleProgressMetric,
  getCompletionPace,
  getDisplayTitles,
  getDropReasonMeta,
  getHypeMeta,
  getPagesRead,
  getVerdictMeta,
  normalizeProgressMode,
} from '../utils/backlogHelpers';
import { filterWorksByCollection } from '../utils/collections';

const VIEW_MODE_STORAGE_KEY = 'codice_list_view_mode';
const GROUP_BY_STORAGE_KEY = 'codice_list_group_by';
const TITLE_MODE_STORAGE_KEY = 'codice_list_title_mode';

const TITLE_MODES = [
  { id: 'bilingual', label: 'Bilíngue' },
  { id: 'pt', label: 'PT-BR' },
  { id: 'original', label: 'Original' },
];

const PRIMARY_VIEW_MODES = [
  { id: 'grid', label: 'Grade', icon: LayoutGrid },
  { id: 'detailed', label: 'Lista', icon: LayoutList },
  { id: 'shelf', label: 'Estante', icon: BookMarked },
];

const EXTRA_VIEW_MODES = [
  { id: 'catalog', label: 'Fichário Bibliotecário', icon: Table2 },
  { id: 'grouped', label: 'Agrupado por Série/Local', icon: FolderTree },
];

const VIEW_MODES = [...PRIMARY_VIEW_MODES, ...EXTRA_VIEW_MODES];

function loadSavedTitleMode() {
  try {
    const val = localStorage.getItem(TITLE_MODE_STORAGE_KEY);
    return TITLE_MODES.some((m) => m.id === val) ? val : 'bilingual';
  } catch {
    return 'bilingual';
  }
}

function loadSavedViewMode() {
  try {
    const val = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    if (val === 'shelf' && !isFlagEnabled('spineShelf')) return 'grid';
    return VIEW_MODES.some((m) => m.id === val) ? val : 'grid';
  } catch {
    return 'grid';
  }
}

function loadSavedGroupBy() {
  try {
    const val = localStorage.getItem(GROUP_BY_STORAGE_KEY);
    return val === 'location' ? 'location' : 'series';
  } catch {
    return 'series';
  }
}

function getDisplayPagesCount(item) {
  if (item.workType === 'manga') {
    return Number(item.currentChapter) || Number(item.totalChapters) || 0;
  }
  return Number(item.totalPages) || Number(item.currentPage) || 0;
}

export function ListScreen({
  items,
  profile = null,
  streakProps,
  collections = [],
  geminiKey = '',
  storedReaderWorkIds = [],
  onCreateCollection,
  onDeleteCollection,
  onStartPickedWork,
  onSelectItem,
  onOpenReader,
  onOpenDigitalShelf,
  onOpenThemeStudio,
  onNavigateAdd,
  onOpenGeminiSettings,
}) {
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedWorkType, setSelectedWorkType] = useState('all');
  const [selectedCollectionId, setSelectedCollectionId] = useState('all');
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [selectedFormat, setSelectedFormat] = useState('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [collectionManagerOpen, setCollectionManagerOpen] = useState(false);
  const [rouletteOpen, setRouletteOpen] = useState(false);
  const [localQuery, setLocalQuery] = useState('');
  const [titleMode, setTitleMode] = useState(loadSavedTitleMode);
  const [sortBy, setSortBy] = useState('recent');
  const [layoutMode, setLayoutMode] = useState(loadSavedViewMode);
  const [groupBy, setGroupBy] = useState(loadSavedGroupBy);
  const [tableSort, setTableSort] = useState({ key: 'call', dir: 'asc' });

  useEffect(() => {
    try {
      localStorage.setItem(TITLE_MODE_STORAGE_KEY, titleMode);
    } catch {
      // Ignora erro de storage
    }
  }, [titleMode]);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, layoutMode);
    } catch {
      // Ignora erro de storage
    }
  }, [layoutMode]);

  useEffect(() => {
    try {
      localStorage.setItem(GROUP_BY_STORAGE_KEY, groupBy);
    } catch {
      // Ignora erro de storage
    }
  }, [groupBy]);

  const { ui, cardFields } = domainConfig;
  const { list } = ui;
  const statuses = getStatusList();

  const backlogItems = useMemo(
    () => items.filter((item) => item.inBacklog),
    [items]
  );

  useEffect(() => {
    if (
      selectedCollectionId !== 'all' &&
      !collections.some((c) => c.id === selectedCollectionId)
    ) {
      setSelectedCollectionId('all');
    }
  }, [collections, selectedCollectionId]);

  const availableGenres = useMemo(() => {
    const map = new Map();
    backlogItems.forEach((item) => {
      if (Array.isArray(item.genres)) {
        item.genres.forEach((g) => {
          const clean = String(g || '').trim();
          if (clean) map.set(clean, (map.get(clean) || 0) + 1);
        });
      }
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
      .slice(0, 16)
      .map(([name, count]) => ({ name, count }));
  }, [backlogItems]);

  const availableFormats = useMemo(() => {
    const map = new Map();
    backlogItems.forEach((item) => {
      const fmt = String(item.format || '').trim();
      if (fmt) map.set(fmt, (map.get(fmt) || 0) + 1);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
      .map(([name, count]) => ({ name, count }));
  }, [backlogItems]);

  const filteredAndSortedItems = useMemo(() => {
    const byStatus =
      selectedStatus === 'all'
        ? backlogItems
        : backlogItems.filter((item) => item.status === selectedStatus);

    const byType =
      selectedWorkType === 'all'
        ? byStatus
        : byStatus.filter((item) => (item.workType || 'book') === selectedWorkType);

    const byCollection = filterWorksByCollection(byType, selectedCollectionId);

    const byGenre =
      selectedGenre === 'all'
        ? byCollection
        : byCollection.filter(
            (item) =>
              Array.isArray(item.genres) &&
              item.genres.some((g) => String(g || '').trim() === selectedGenre)
          );

    const byFormat =
      selectedFormat === 'all'
        ? byGenre
        : byGenre.filter((item) => String(item.format || '').trim() === selectedFormat);

    const q = localQuery.trim().toLowerCase();
    const filtered = !q
      ? byFormat
      : byFormat.filter((item) => {
          const inTitle = String(item.title || '').toLowerCase().includes(q);
          const inOrig = String(item.originalTitle || '').toLowerCase().includes(q);
          const inAuthor = String(item[cardFields.creator] || '').toLowerCase().includes(q);
          const inPub = String(item.publisher || '').toLowerCase().includes(q);
          const inIsbn = String(item.isbn || '').toLowerCase().includes(q);
          const inCall = String(item.callNumber || '').toLowerCase().includes(q);
          const inGenres = Array.isArray(item.genres)
            ? item.genres.some((g) => String(g).toLowerCase().includes(q))
            : false;
          return inTitle || inOrig || inAuthor || inPub || inIsbn || inCall || inGenres;
        });

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
        const pagesA = getPagesRead(a) || Number(a.totalPages) || Number(a.currentChapter) || 0;
        const pagesB = getPagesRead(b) || Number(b.totalPages) || Number(b.currentChapter) || 0;
        return pagesB - pagesA;
      }

      if (sortBy === 'title') {
        return String(a.title || '').localeCompare(String(b.title || ''), 'pt-BR');
      }

      const timeA = Date.parse(a.updatedAt || a.createdAt || '') || 0;
      const timeB = Date.parse(b.updatedAt || b.createdAt || '') || 0;
      return timeB - timeA;
    });
  }, [
    backlogItems,
    selectedStatus,
    selectedWorkType,
    selectedCollectionId,
    selectedGenre,
    selectedFormat,
    localQuery,
    sortBy,
    cardFields.creator,
    cardFields.rating,
  ]);

  const tableSortedItems = useMemo(() => {
    const dirMul = tableSort.dir === 'asc' ? 1 : -1;
    return [...filteredAndSortedItems].sort((a, b) => {
      if (tableSort.key === 'title') {
        return String(a.title || '').localeCompare(String(b.title || ''), 'pt-BR') * dirMul;
      }
      if (tableSort.key === 'call') {
        const callA = a.callNumber || [a.cdu_cdd, a.cutter].filter(Boolean).join(' ') || 'zzz';
        const callB = b.callNumber || [b.cdu_cdd, b.cutter].filter(Boolean).join(' ') || 'zzz';
        return callA.localeCompare(callB, 'pt-BR') * dirMul;
      }
      if (tableSort.key === 'author') {
        return (
          String(a[cardFields.creator] || 'zzz').localeCompare(
            String(b[cardFields.creator] || 'zzz'),
            'pt-BR'
          ) * dirMul
        );
      }
      if (tableSort.key === 'format') {
        return (
          String(a.format || '').localeCompare(String(b.format || ''), 'pt-BR') * dirMul
        );
      }
      if (tableSort.key === 'pages') {
        return (getDisplayPagesCount(a) - getDisplayPagesCount(b)) * dirMul;
      }
      if (tableSort.key === 'rating') {
        const rA = typeof a[cardFields.rating] === 'number' ? a[cardFields.rating] : -1;
        const rB = typeof b[cardFields.rating] === 'number' ? b[cardFields.rating] : -1;
        return (rA - rB) * dirMul;
      }
      return 0;
    });
  }, [filteredAndSortedItems, tableSort, cardFields.creator, cardFields.rating]);

  const groupedSections = useMemo(() => {
    const groupsMap = new Map();
    filteredAndSortedItems.forEach((item) => {
      const key =
        groupBy === 'location'
          ? String(item.physicalLocation || '').trim() || 'Sem localização física'
          : String(item.seriesName || item.seriesVolume || '').trim() || 'Obras Avulsas';
      if (!groupsMap.has(key)) {
        groupsMap.set(key, []);
      }
      groupsMap.get(key).push(item);
    });

    return Array.from(groupsMap.entries())
      .map(([groupLabel, groupItems]) => ({
        groupLabel,
        items:
          groupBy === 'series'
            ? [...groupItems].sort((a, b) =>
                String(a.seriesIndex || '').localeCompare(
                  String(b.seriesIndex || ''),
                  undefined,
                  { numeric: true }
                )
              )
            : groupItems,
      }))
      .sort((a, b) => {
        const isFallbackA =
          a.groupLabel === 'Obras Avulsas' ||
          a.groupLabel === 'Sem localização física';
        const isFallbackB =
          b.groupLabel === 'Obras Avulsas' ||
          b.groupLabel === 'Sem localização física';
        if (isFallbackA !== isFallbackB) return isFallbackA ? 1 : -1;
        return a.groupLabel.localeCompare(b.groupLabel, 'pt-BR');
      });
  }, [filteredAndSortedItems, groupBy]);

  const toggleTableColumn = (key) => {
    setTableSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'rating' || key === 'pages' ? 'desc' : 'asc' }
    );
  };

  const filterTabs = [
    { id: 'all', label: list.allTabLabel, count: backlogItems.length },
    ...statuses.map((status) => ({
      id: status.id,
      label: status.label,
      count: backlogItems.filter((item) => item.status === status.id).length,
    })),
  ];

  const visiblePrimaryModes = useMemo(() => {
    const spineEnabled = isFlagEnabled('spineShelf');
    return PRIMARY_VIEW_MODES.filter((m) => m.id !== 'shelf' || spineEnabled);
  }, []);

  const activeFilters = useMemo(() => {
    const chips = [];
    if (selectedStatus !== 'all') {
      const meta = getStatusConfig(selectedStatus);
      chips.push({
        id: 'status',
        label: `Status: ${meta?.label || selectedStatus}`,
        onClear: () => setSelectedStatus('all'),
      });
    }
    if (selectedWorkType !== 'all') {
      const wt = getWorkTypeConfig(selectedWorkType);
      chips.push({
        id: 'workType',
        label: `Tipo: ${wt?.shortLabel || selectedWorkType}`,
        onClear: () => setSelectedWorkType('all'),
      });
    }
    if (selectedCollectionId !== 'all') {
      const col = collections.find((c) => c.id === selectedCollectionId);
      chips.push({
        id: 'collection',
        label: `Coleção: ${col?.name || 'Personalizada'}`,
        onClear: () => setSelectedCollectionId('all'),
      });
    }
    if (selectedGenre !== 'all') {
      chips.push({
        id: 'genre',
        label: `Gênero: ${selectedGenre}`,
        onClear: () => setSelectedGenre('all'),
      });
    }
    if (selectedFormat !== 'all') {
      chips.push({
        id: 'format',
        label: `Formato: ${selectedFormat}`,
        onClear: () => setSelectedFormat('all'),
      });
    }
    if (layoutMode === 'catalog' || layoutMode === 'grouped') {
      const extraMeta = EXTRA_VIEW_MODES.find((m) => m.id === layoutMode);
      chips.push({
        id: 'layout',
        label: extraMeta?.label || layoutMode,
        onClear: () => setLayoutMode('grid'),
      });
    }
    return chips;
  }, [
    selectedStatus,
    selectedWorkType,
    selectedCollectionId,
    selectedGenre,
    selectedFormat,
    layoutMode,
    collections,
  ]);

  const clearAllFilters = () => {
    setSelectedStatus('all');
    setSelectedWorkType('all');
    setSelectedCollectionId('all');
    setSelectedGenre('all');
    setSelectedFormat('all');
    setLocalQuery('');
    setSortBy('recent');
  };

  const countLabel =
    filteredAndSortedItems.length === 1 ? list.countSingular : list.countPlural;

  return (
    <div className="space-y-4 pb-24">
      <header className="flex items-center justify-between gap-2 pt-2">
        <div className="flex items-baseline gap-2.5">
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            {list.title}
          </h1>
          <span className="text-xs tabular-nums text-subtle">
            {filteredAndSortedItems.length} {countLabel}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setRouletteOpen(true)}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[4px] border border-line bg-card px-2.5 py-1.5 text-xs font-medium text-ink transition-colors hover:border-accent"
          >
            <Dices className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
            <span>Sortear Próxima Leitura</span>
          </button>
          {onOpenDigitalShelf && (
            <button
              type="button"
              onClick={onOpenDigitalShelf}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[4px] border border-line bg-card px-2.5 py-1.5 text-xs font-medium text-ink transition-colors hover:border-accent"
            >
              <Library className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
              <span>Meus EPUBs</span>
            </button>
          )}
          {onOpenThemeStudio && (
            <button
              type="button"
              onClick={onOpenThemeStudio}
              aria-label="Abrir Temas e Aparência"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[4px] border border-line bg-card px-2.5 py-1.5 text-xs font-medium text-ink transition-colors hover:border-accent"
            >
              <Palette className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
              <span>Temas</span>
            </button>
          )}
        </div>
      </header>

      {/* Estante Direta: barra unica compacta acima do primeiro livro */}
      {backlogItems.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle"
                strokeWidth={1.5}
              />
              <input
                type="search"
                value={localQuery}
                onChange={(e) => setLocalQuery(e.target.value)}
                placeholder="Buscar título, autor, ISBN, gênero..."
                aria-label="Buscar obras no acervo"
                className="min-h-[44px] w-full rounded-[4px] border border-line bg-card py-1.5 pl-8 pr-8 text-xs text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
              />
              {localQuery && (
                <button
                  type="button"
                  onClick={() => setLocalQuery('')}
                  aria-label="Limpar busca"
                  className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center text-subtle hover:text-ink"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              aria-expanded={filtersOpen}
              aria-label="Abrir filtros e ordenação do acervo"
              className={`relative inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-[4px] border px-3 py-1.5 text-xs font-medium transition-colors ${
                activeFilters.length > 0
                  ? 'border-accent bg-accent/15 text-ink'
                  : 'border-line bg-card text-muted hover:text-ink'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
              <span className="hidden xs:inline sm:inline">Filtros</span>
              {activeFilters.length > 0 && (
                <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold tabular-nums text-accent-ink">
                  {activeFilters.length}
                </span>
              )}
            </button>

            <div
              role="group"
              aria-label="Modo de visualização do acervo"
              className="flex shrink-0 items-center rounded-[4px] border border-line bg-card p-0.5"
            >
              {visiblePrimaryModes.map((mode) => {
                const Icon = mode.icon;
                const isActive = layoutMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setLayoutMode(mode.id)}
                    aria-label={mode.label}
                    aria-pressed={isActive}
                    title={mode.label}
                    className={`flex min-h-[40px] min-w-[40px] items-center justify-center rounded-[3px] transition-colors ${
                      isActive
                        ? 'bg-accent text-accent-ink'
                        : 'text-subtle hover:text-ink'
                    }`}
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                );
              })}
            </div>
          </div>

          {activeFilters.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5" aria-label="Filtros ativos">
              {activeFilters.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={chip.onClear}
                  className="inline-flex min-h-[30px] items-center gap-1 rounded-[4px] border border-accent/40 bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-ink transition-colors hover:bg-accent/20"
                >
                  <span>{chip.label}</span>
                  <X className="h-3 w-3 text-accent" strokeWidth={1.5} />
                </button>
              ))}
              <button
                type="button"
                onClick={clearAllFilters}
                className="px-1.5 py-0.5 text-[11px] font-medium text-subtle hover:text-ink"
              >
                Limpar tudo
              </button>
            </div>
          )}
        </div>
      )}

      {backlogItems.length === 0 ? (
        <div className="rounded-3xl border border-line bg-card px-5 py-12 text-center">
          <p className="text-sm font-semibold text-ink">
            {list.emptyBacklogTitle}
          </p>
          <button
            type="button"
            onClick={onNavigateAdd}
            className="mt-4 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-xs font-semibold text-accent-ink transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" strokeWidth={1.5} />
            {list.emptyBacklogCta}
          </button>
        </div>
      ) : filteredAndSortedItems.length === 0 ? (
        <div className="rounded-2xl border border-line bg-card py-14 text-center text-xs text-subtle">
          <p>{list.emptyMessage}</p>
          {activeFilters.length > 0 && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="mt-3 inline-flex min-h-[44px] items-center gap-1.5 rounded-[4px] border border-line bg-app px-3 py-1.5 text-xs font-medium text-ink hover:border-accent"
            >
              Limpar filtros ativos
            </button>
          )}
        </div>
      ) : layoutMode === 'shelf' && isFlagEnabled('spineShelf') ? (
        <SpineRenderer
          items={filteredAndSortedItems}
          titleMode={titleMode}
          onSelectItem={onSelectItem}
        />
      ) : layoutMode === 'grid' ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5 sm:gap-3">
          {filteredAndSortedItems.map((item) => {
            const status = getStatusConfig(item.status);
            const workMeta = getWorkTypeConfig(item.workType);
            const progressMode = normalizeProgressMode(item.progressMode);
            const itemPct = calculateWorkProgress(item);
            const gridMetric =
              item.workType === 'manga'
                ? item.currentChapter > 0
                  ? `C.${item.currentChapter}`
                  : item.totalChapters > 0
                    ? `${item.totalChapters}c`
                    : ''
                : item.status === 'playing' && progressMode === 'loc' && item.locCurrent > 0
                  ? `L.${item.locCurrent}`
                  : item.status === 'playing' &&
                      (progressMode === 'percent' || !(item.totalPages > 0)) &&
                      itemPct > 0
                    ? `${itemPct}%`
                    : (item.status === 'playing' || item.status === 'dropped'
                        ? item.currentPage
                        : item.totalPages) > 0
                      ? `${
                          item.status === 'playing' || item.status === 'dropped'
                            ? item.currentPage
                            : item.totalPages
                        }p`
                      : '';

            const canDirectRead =
              Boolean(onOpenReader) &&
              (item.status === 'playing' ||
                item.status === 'reading' ||
                storedReaderWorkIds.includes(String(item.id)) ||
                (item.readerBookId && storedReaderWorkIds.includes(String(item.readerBookId))));

            return (
              <div key={item.id} className="group flex flex-col text-left">
                <button
                  type="button"
                  onClick={() => onSelectItem(item)}
                  className="text-left focus:outline-none"
                >
                  <div className="relative">
                    <CoverArt
                      item={item}
                      compact
                      className="aspect-[2/3] w-full rounded-[4px] transition-transform duration-150 group-hover:scale-[1.02] group-hover:border-accent/50"
                    />
                    {item.isPlatinum && (
                      <span className="absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-app/85 text-accent ring-1 ring-accent/60">
                        <Star className="h-3 w-3 fill-current" strokeWidth={1.5} />
                      </span>
                    )}
                    <span
                      title={status.label}
                      className={`absolute bottom-1.5 right-1.5 h-2 w-2 rounded-full ring-2 ring-app ${status.dotClass}`}
                    />
                  </div>
                  {(() => {
                    const titles = getDisplayTitles(item, titleMode);
                    return (
                      <>
                        <p className="mt-1.5 truncate text-[11px] font-medium text-ink">
                          {titles.primary}
                        </p>
                        {titles.secondary && (
                          <p
                            className="truncate text-[10px] italic"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            {titles.secondary}
                          </p>
                        )}
                      </>
                    );
                  })()}
                  <p className="truncate text-[10px] tabular-nums text-subtle">
                    {item[cardFields.creator] || workMeta.shortLabel}
                    {gridMetric ? ` • ${gridMetric}` : ''}
                  </p>
                </button>
                {canDirectRead && (
                  <button
                    type="button"
                    onClick={() => onOpenReader(item)}
                    aria-label={`Ler ${item.title}`}
                    className="mt-1.5 inline-flex min-h-[32px] w-full items-center justify-center gap-1 rounded-[4px] border border-line bg-card px-2 py-1 text-[11px] font-medium text-ink transition-colors hover:border-accent hover:text-accent"
                  >
                    <BookOpen className="h-3 w-3 text-accent" strokeWidth={1.5} />
                    <span>Ler</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : layoutMode === 'detailed' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {filteredAndSortedItems.map((item) => {
            const workMeta = getWorkTypeConfig(item.workType);
            const pace =
              item.status === 'completed' && item.workType !== 'manga'
                ? getCompletionPace(
                    item.startDate,
                    item.completedDate,
                    item.totalPages || item.currentPage
                  )
                : null;
            const hypeMeta = getHypeMeta(item.hype);
            const verdictMeta = getVerdictMeta(item.verdict);
            const dropMeta = getDropReasonMeta(item.dropReason);
            const progress = Math.max(
              0,
              Math.min(100, Number(item[cardFields.progress]) || 0)
            );

            const progressMode = normalizeProgressMode(item.progressMode);
            const flexibleLabel = formatFlexibleProgressMetric(item);
            const playingMetric =
              item.workType === 'manga'
                ? `Vol. ${item.currentVolume || 0} · Cap. ${item.currentChapter || 0}${progress > 0 ? ` · ${progress}%` : ''}`
                : item.workType === 'academic' && item.academicProgressMode === 'fichamento'
                  ? `Fichamento · ${progress}%`
                  : progressMode === 'percent' ||
                      (!(item.totalPages > 0) && item.progressPercent > 0)
                    ? flexibleLabel
                    : `${flexibleLabel} · ${progress}%`;

            const canDirectRead =
              Boolean(onOpenReader) &&
              (item.status === 'playing' ||
                item.status === 'reading' ||
                storedReaderWorkIds.includes(String(item.id)) ||
                (item.readerBookId && storedReaderWorkIds.includes(String(item.readerBookId))));

            return (
              <div
                key={item.id}
                className="flex w-full gap-3 rounded-[6px] border border-line bg-card p-3 text-left transition-colors hover:border-accent/50"
              >
                <button
                  type="button"
                  onClick={() => onSelectItem(item)}
                  aria-label={`Abrir ficha de ${item.title}`}
                  className="shrink-0 focus:outline-none"
                >
                  <CoverArt
                    item={item}
                    compact
                    className="h-27 w-18 rounded-[4px]"
                  />
                </button>

                <div className="flex min-w-0 flex-1 flex-col justify-between">
                  <button
                    type="button"
                    onClick={() => onSelectItem(item)}
                    className="w-full text-left focus:outline-none"
                  >
                    <div className="flex items-start justify-between gap-2">
                      {(() => {
                        const titles = getDisplayTitles(item, titleMode);
                        return (
                          <div className="min-w-0">
                            <h2 className="truncate text-sm font-semibold text-ink">
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
                          </div>
                        );
                      })()}
                      {item.isPlatinum && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-accent/40 bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                          <Star className="h-3 w-3 fill-current" strokeWidth={1.5} />
                          5
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
                      <span className="inline-flex items-center gap-1 rounded-[4px] border border-line bg-app px-1.5 py-0.5 text-[10px] text-muted">
                        <VectorIcon name={workMeta.icon} className="h-3 w-3 text-accent" />
                        {workMeta.shortLabel}
                      </span>
                      {item.callNumber && (
                        <span className="rounded-[4px] border border-line bg-app px-1.5 py-0.5 font-mono text-[10px] text-subtle">
                          {item.callNumber}
                        </span>
                      )}
                    </div>
                  </button>

                  {item.status === 'playing' && (
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center justify-between gap-2 text-[10px] text-muted">
                        <span className="truncate">
                          {item.checkpoint || 'Em leitura'}
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums text-accent">
                          {playingMetric}
                        </span>
                      </div>
                      <div className="h-[2px] w-full overflow-hidden rounded-[2px] bg-line">
                        <div
                          className="h-full bg-accent"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {item.status === 'completed' && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {typeof item[cardFields.rating] === 'number' && (
                        <span className="rounded-[4px] border border-accent/40 bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-ink">
                          {item[cardFields.rating]}/100
                        </span>
                      )}
                      {verdictMeta && (
                        <span
                          className={`rounded-[4px] border px-2 py-0.5 text-[10px] font-medium ${verdictMeta.badgeClass}`}
                        >
                          {verdictMeta.id}
                        </span>
                      )}
                      {pace && (
                        <span className="text-[10px] tabular-nums text-muted">
                          • {pace.days} {list.daysSuffix}
                        </span>
                      )}
                    </div>
                  )}

                  {item.status === 'queued' && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
                      {hypeMeta && (
                        <span className="inline-flex items-center gap-1 rounded-[4px] border border-line bg-app px-1.5 py-0.5 text-muted">
                          <VectorIcon name={hypeMeta.icon} className="h-3 w-3 text-accent" />
                          {hypeMeta.label}
                        </span>
                      )}
                      {item.access && (
                        <span className="rounded-[4px] border border-line bg-app px-1.5 py-0.5 text-muted">
                          {item.access}
                        </span>
                      )}
                      {item.totalPages > 0 && item.workType !== 'manga' && (
                        <span className="tabular-nums text-subtle">
                          ~{item.totalPages} págs
                        </span>
                      )}
                    </div>
                  )}

                  {item.status === 'dropped' && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {dropMeta && (
                        <span className="inline-flex items-center gap-1 rounded-[4px] border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[10px] text-rose-400">
                          <VectorIcon name={dropMeta.icon} className="h-3 w-3" />
                          {dropMeta.label}
                        </span>
                      )}
                      {item.workType === 'manga' ? (
                        (item.currentVolume > 0 || item.currentChapter > 0) && (
                          <span className="text-[10px] text-subtle">
                            Parou em Vol. {item.currentVolume || 0} · Cap. {item.currentChapter || 0}
                          </span>
                        )
                      ) : (
                        item.currentPage > 0 && (
                          <span className="text-[10px] text-subtle">
                            Parou na pág. {item.currentPage}
                          </span>
                        )
                      )}
                    </div>
                  )}

                  {canDirectRead && (
                    <div className="mt-2 flex justify-end border-t border-line pt-1.5">
                      <button
                        type="button"
                        onClick={() => onOpenReader(item)}
                        aria-label={`Ler ${item.title}`}
                        className="inline-flex min-h-[34px] items-center gap-1.5 rounded-[4px] border border-line bg-app px-2.5 py-1 text-[11px] font-medium text-ink transition-colors hover:border-accent hover:text-accent"
                      >
                        <BookOpen className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
                        <span>Ler</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : layoutMode === 'catalog' ? (
        <>
          {/* Fichário Bibliotecário: tabela densa com cabeçalho fixo em telas md+ */}
          <div className="hidden md:block max-h-[68vh] overflow-auto rounded-2xl border border-line bg-card">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 border-b border-line bg-elevated text-[11px] font-semibold text-muted">
                <tr>
                  {[
                    { key: 'call', label: 'CDD / Cutter' },
                    { key: 'title', label: 'Título' },
                    { key: 'author', label: 'Autor' },
                    { key: 'format', label: 'Formato' },
                    { key: 'pages', label: 'Págs / Caps' },
                    { key: 'rating', label: 'Nota' },
                  ].map((col) => {
                    const isSorted = tableSort.key === col.key;
                    return (
                      <th
                        key={col.key}
                        aria-sort={
                          isSorted
                            ? tableSort.dir === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : 'none'
                        }
                        className="px-3 py-2.5 whitespace-nowrap"
                      >
                        <button
                          type="button"
                          onClick={() => toggleTableColumn(col.key)}
                          className="inline-flex items-center gap-1 hover:text-ink"
                        >
                          <span>{col.label}</span>
                          {isSorted ? (
                            tableSort.dir === 'asc' ? (
                              <ArrowUp className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
                            ) : (
                              <ArrowDown className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
                            )
                          ) : (
                            <ArrowUpDown className="h-3.5 w-3.5 text-subtle" strokeWidth={1.5} />
                          )}
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {tableSortedItems.map((item) => {
                  const call =
                    item.callNumber ||
                    [item.cdu_cdd, item.cutter].filter(Boolean).join(' ') ||
                    '—';
                  const pagesCount = getDisplayPagesCount(item);
                  const pagesLabel =
                    pagesCount > 0
                      ? `${pagesCount}${item.workType === 'manga' ? 'c' : 'p'}`
                      : item.workType !== 'manga' &&
                          (item.progressMode === 'loc' || item.progressPercent > 0)
                        ? formatFlexibleProgressMetric(item)
                        : '—';
                  return (
                    <tr
                      key={item.id}
                      onClick={() => onSelectItem(item)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelectItem(item);
                        }
                      }}
                      tabIndex={0}
                      className="cursor-pointer transition-colors hover:bg-elevated/60"
                    >
                      <td className="px-3 py-2.5 font-mono text-[11px] text-accent whitespace-nowrap">
                        {call}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-ink max-w-[220px]">
                        {(() => {
                          const titles = getDisplayTitles(item, titleMode);
                          return (
                            <>
                              <span className="block truncate">{titles.primary}</span>
                              {titles.secondary && (
                                <span
                                  className="block truncate text-[10px] italic font-normal"
                                  style={{ color: 'var(--text-secondary)' }}
                                >
                                  {titles.secondary}
                                </span>
                              )}
                            </>
                          );
                        })()}
                      </td>
                      <td className="px-3 py-2.5 text-muted max-w-[160px] truncate">
                        {item[cardFields.creator] || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-muted whitespace-nowrap">
                        {item.format || getWorkTypeConfig(item.workType).shortLabel}
                      </td>
                      <td className="px-3 py-2.5 text-muted tabular-nums whitespace-nowrap">
                        {pagesLabel}
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-ink tabular-nums whitespace-nowrap">
                        {typeof item[cardFields.rating] === 'number'
                          ? `${item[cardFields.rating]}/100`
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Em telas pequenas, o Fichário vira cartões compactos */}
          <div className="space-y-2 md:hidden">
            {tableSortedItems.map((item) => {
              const call =
                item.callNumber ||
                [item.cdu_cdd, item.cutter].filter(Boolean).join(' ') ||
                'Sem chamada';
              const pagesCount = getDisplayPagesCount(item);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectItem(item)}
                  className="flex min-h-[44px] w-full flex-col gap-1 rounded-2xl border border-line bg-card p-3 text-left transition-colors hover:border-accent/50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-semibold text-accent">
                      {call}
                    </span>
                    <StatusBadge statusId={item.status} size="xs" />
                  </div>
                  {(() => {
                    const titles = getDisplayTitles(item, titleMode);
                    return (
                      <div>
                        <p className="truncate text-xs font-semibold text-ink">
                          {titles.primary}
                        </p>
                        {titles.secondary && (
                          <p
                            className="truncate text-[10px] italic"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            {titles.secondary}
                          </p>
                        )}
                      </div>
                    );
                  })()}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
                    <span className="truncate">
                      {item[cardFields.creator] || 'Autor não informado'}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {item.format || getWorkTypeConfig(item.workType).shortLabel}
                      {pagesCount > 0 ? ` · ${pagesCount}${item.workType === 'manga' ? 'c' : 'p'}` : ''}
                      {typeof item[cardFields.rating] === 'number' ? ` · ${item[cardFields.rating]}` : ''}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        /* Modo Agrupado: por Série/Coleção ou Estante Física */
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setGroupBy('series')}
              className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
                groupBy === 'series'
                  ? 'border-accent bg-accent/15 text-ink'
                  : 'border-line bg-card text-muted hover:text-ink'
              }`}
            >
              <FolderTree className="h-4 w-4 text-accent" strokeWidth={1.5} />
              Por Série / Coleção
            </button>
            <button
              type="button"
              onClick={() => setGroupBy('location')}
              className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
                groupBy === 'location'
                  ? 'border-accent bg-accent/15 text-ink'
                  : 'border-line bg-card text-muted hover:text-ink'
              }`}
            >
              <MapPin className="h-4 w-4 text-accent" strokeWidth={1.5} />
              Por Estante Física
            </button>
          </div>

          {groupedSections.map((group) => (
            <section
              key={group.groupLabel}
              className="space-y-2.5 rounded-2xl border border-line bg-card p-3.5"
            >
              <div className="flex items-center justify-between gap-2 border-b border-line pb-2">
                <h2 className="truncate text-xs font-semibold text-ink">
                  {group.groupLabel}
                </h2>
                <span className="shrink-0 rounded-full bg-elevated px-2 py-0.5 text-[10px] font-semibold text-accent">
                  {group.items.length}
                </span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectItem(item)}
                    className="group text-left focus:outline-none"
                  >
                    <CoverArt
                      item={item}
                      compact
                      className="aspect-[2/3] w-full rounded-xl transition-transform duration-150 group-hover:scale-[1.02]"
                    />
                    {(() => {
                      const titles = getDisplayTitles(item, titleMode);
                      return (
                        <>
                          <p className="mt-1 truncate text-[11px] font-medium text-ink">
                            {item.seriesIndex ? `#${item.seriesIndex} · ` : ''}
                            {titles.primary}
                          </p>
                          {titles.secondary && (
                            <p
                              className="truncate text-[10px] italic"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              {titles.secondary}
                            </p>
                          )}
                        </>
                      );
                    })()}
                    <p className="truncate text-[10px] text-subtle">
                      {item[cardFields.creator] || getWorkTypeConfig(item.workType).shortLabel}
                    </p>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <ResponsiveSheet
        isOpen={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        icon={SlidersHorizontal}
        title="Filtros & Ordenação"
        subtitle="Refine por status, tipo, coleção, gênero, formato e modo"
        headerActions={
          activeFilters.length > 0 ? (
            <button
              type="button"
              onClick={clearAllFilters}
              className="inline-flex min-h-[38px] items-center rounded-[4px] border border-line bg-app px-2.5 py-1 text-[11px] font-medium text-accent hover:border-accent"
            >
              Limpar ({activeFilters.length})
            </button>
          ) : null
        }
      >
        <div className="space-y-5">
          {/* Status */}
          <div>
            <p className="mb-2 text-xs font-medium text-muted">Status</p>
            <div className="flex flex-wrap gap-1.5">
              {filterTabs.map((tab) => {
                const isActive = selectedStatus === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setSelectedStatus(tab.id)}
                    className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-[4px] border px-3 py-1 text-xs font-medium transition-colors ${
                      isActive
                        ? 'border-accent bg-accent text-accent-ink'
                        : 'border-line bg-app text-muted hover:text-ink'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className={`text-[10px] tabular-nums ${isActive ? 'opacity-85' : 'text-subtle'}`}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Natureza da Obra */}
          <div>
            <p className="mb-2 text-xs font-medium text-muted">Natureza da Obra</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                aria-pressed={selectedWorkType === 'all'}
                onClick={() => setSelectedWorkType('all')}
                className={`min-h-[40px] rounded-[4px] border px-3 py-1 text-xs font-medium transition-colors ${
                  selectedWorkType === 'all'
                    ? 'border-accent bg-accent/15 text-accent'
                    : 'border-line bg-app text-muted hover:text-ink'
                }`}
              >
                {list.allTypesLabel}
              </button>
              {domainConfig.workTypes.map((type) => {
                const isActive = selectedWorkType === type.id;
                return (
                  <button
                    key={type.id}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setSelectedWorkType(type.id)}
                    className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-[4px] border px-3 py-1 text-xs font-medium transition-colors ${
                      isActive
                        ? 'border-accent bg-accent/15 text-ink'
                        : 'border-line bg-app text-muted hover:text-ink'
                    }`}
                  >
                    <VectorIcon
                      name={type.icon}
                      className={`h-3.5 w-3.5 ${isActive ? 'text-accent' : 'text-subtle'}`}
                    />
                    <span>{type.shortLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Colecoes Personalizadas */}
          <div>
            <p className="mb-2 text-xs font-medium text-muted">Coleções &amp; Prateleiras</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                aria-pressed={selectedCollectionId === 'all'}
                onClick={() => setSelectedCollectionId('all')}
                className={`inline-flex min-h-[40px] items-center rounded-[4px] border px-3 py-1 text-xs font-medium transition-colors ${
                  selectedCollectionId === 'all'
                    ? 'border-accent bg-accent/15 text-accent'
                    : 'border-line bg-app text-muted hover:text-ink'
                }`}
              >
                Todas
              </button>
              {collections.map((col) => {
                const isActive = selectedCollectionId === col.id;
                const colCount = filterWorksByCollection(backlogItems, col.id).length;
                return (
                  <div key={col.id} className="inline-flex items-center">
                    <button
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => setSelectedCollectionId(col.id)}
                      className={`inline-flex min-h-[40px] items-center gap-1.5 border px-3 py-1 text-xs font-medium transition-colors ${
                        onDeleteCollection ? 'rounded-l-[4px]' : 'rounded-[4px]'
                      } ${
                        isActive
                          ? 'border-accent bg-accent/15 text-ink'
                          : 'border-line bg-app text-muted hover:text-ink'
                      }`}
                    >
                      <span>{col.name}</span>
                      <span className="text-[10px] tabular-nums text-subtle">{colCount}</span>
                    </button>
                    {onDeleteCollection && (
                      <button
                        type="button"
                        aria-label={`Excluir coleção ${col.name}`}
                        onClick={() => onDeleteCollection(col.id)}
                        className="inline-flex min-h-[40px] min-w-[36px] items-center justify-center rounded-r-[4px] border border-l-0 border-line bg-app px-1.5 text-subtle hover:text-ink"
                      >
                        <X className="h-3 w-3" strokeWidth={1.5} />
                      </button>
                    )}
                  </div>
                );
              })}
              {onCreateCollection && (
                <button
                  type="button"
                  aria-expanded={collectionManagerOpen}
                  onClick={() => setCollectionManagerOpen((v) => !v)}
                  className="inline-flex min-h-[40px] items-center gap-1 rounded-[4px] border border-dashed border-line bg-app px-3 py-1 text-xs font-medium text-accent hover:border-accent"
                >
                  <FolderPlus className="h-3.5 w-3.5" strokeWidth={1.5} />
                  <span>+ Nova Coleção</span>
                </button>
              )}
            </div>

            {collectionManagerOpen && onCreateCollection && (
              <div className="mt-2.5 rounded-[6px] border border-line bg-app p-3">
                <CollectionCreatorBar
                  collections={collections}
                  onCreateCollection={onCreateCollection}
                  onCreated={(created) => {
                    setSelectedCollectionId(created.id);
                    setCollectionManagerOpen(false);
                  }}
                />
              </div>
            )}
          </div>

          {/* Genero */}
          {availableGenres.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted">Gênero</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  aria-pressed={selectedGenre === 'all'}
                  onClick={() => setSelectedGenre('all')}
                  className={`min-h-[38px] rounded-[4px] border px-2.5 py-1 text-[11px] font-medium ${
                    selectedGenre === 'all'
                      ? 'border-accent bg-accent/15 text-accent'
                      : 'border-line bg-app text-muted hover:text-ink'
                  }`}
                >
                  Todos
                </button>
                {availableGenres.map((g) => (
                  <button
                    key={g.name}
                    type="button"
                    aria-pressed={selectedGenre === g.name}
                    onClick={() => setSelectedGenre(g.name)}
                    className={`min-h-[38px] rounded-[4px] border px-2.5 py-1 text-[11px] font-medium ${
                      selectedGenre === g.name
                        ? 'border-accent bg-accent/15 text-ink'
                        : 'border-line bg-app text-muted hover:text-ink'
                    }`}
                  >
                    {g.name} <span className="tabular-nums text-subtle">({g.count})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Formato */}
          {availableFormats.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted">Formato</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  aria-pressed={selectedFormat === 'all'}
                  onClick={() => setSelectedFormat('all')}
                  className={`min-h-[38px] rounded-[4px] border px-2.5 py-1 text-[11px] font-medium ${
                    selectedFormat === 'all'
                      ? 'border-accent bg-accent/15 text-accent'
                      : 'border-line bg-app text-muted hover:text-ink'
                  }`}
                >
                  Todos
                </button>
                {availableFormats.map((f) => (
                  <button
                    key={f.name}
                    type="button"
                    aria-pressed={selectedFormat === f.name}
                    onClick={() => setSelectedFormat(f.name)}
                    className={`min-h-[38px] rounded-[4px] border px-2.5 py-1 text-[11px] font-medium ${
                      selectedFormat === f.name
                        ? 'border-accent bg-accent/15 text-ink'
                        : 'border-line bg-app text-muted hover:text-ink'
                    }`}
                  >
                    {f.name} <span className="tabular-nums text-subtle">({f.count})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Idioma dos titulos */}
          <div>
            <p className="mb-2 text-xs font-medium text-muted">Exibição de Títulos</p>
            <div className="grid grid-cols-3 gap-1.5">
              {TITLE_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={titleMode === m.id}
                  onClick={() => setTitleMode(m.id)}
                  className={`min-h-[40px] rounded-[4px] border px-2.5 py-1 text-xs font-medium ${
                    titleMode === m.id
                      ? 'border-accent bg-accent/15 text-accent'
                      : 'border-line bg-app text-muted hover:text-ink'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Ordenacao */}
          <div>
            <p className="mb-2 text-xs font-medium text-muted">Ordenar por</p>
            <div className="flex flex-wrap gap-1.5">
              {list.sortOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={sortBy === option.id}
                  onClick={() => setSortBy(option.id)}
                  className={`min-h-[40px] rounded-[4px] border px-3 py-1 text-xs font-medium ${
                    sortBy === option.id
                      ? 'border-accent bg-accent/15 text-accent'
                      : 'border-line bg-app text-muted hover:text-ink'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Visualizacoes especiais */}
          <div>
            <p className="mb-2 text-xs font-medium text-muted">Modos de Arquivo &amp; Agrupamento</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {EXTRA_VIEW_MODES.map((mode) => {
                const Icon = mode.icon;
                const active = layoutMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setLayoutMode(mode.id);
                      setFiltersOpen(false);
                    }}
                    className={`flex min-h-[44px] items-center gap-2 rounded-[4px] border px-3 py-2 text-left text-xs font-medium ${
                      active
                        ? 'border-accent bg-accent/15 text-ink'
                        : 'border-line bg-app text-muted hover:text-ink'
                    }`}
                  >
                    <Icon className="h-4 w-4 text-accent" strokeWidth={1.5} />
                    <span>{mode.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </ResponsiveSheet>

      <OfflineBookPickerModal
        isOpen={rouletteOpen}
        onClose={() => setRouletteOpen(false)}
        items={items}
        storedReaderWorkIds={storedReaderWorkIds}
        onStartReading={onStartPickedWork}
        onSelectItem={onSelectItem}
        onOpenReader={onOpenReader}
      />
    </div>
  );
}
