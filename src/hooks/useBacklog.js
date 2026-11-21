import { useCallback, useEffect, useState } from 'react';
import { domainConfig } from '../config/domainConfig';
import { initialItems } from '../data/mockData';
import {
  exportSignedBackupPayload,
  loadEmergencyMirror,
  recordBackupExportTimestamp,
} from '../services/backupEngine';
import {
  buildCodiceDatabase,
  createUuid,
  exportDatabaseDownloads,
  hydrateAppSnapshotFromDatabase,
  loadStoredCodiceDatabase,
  parseAndValidateBackupText,
  triggerFileDownload,
} from '../services/codiceDatabase';
import {
  calculatePercentProgress,
  calculateSmartRating,
  calculateWorkProgress,
  createDefaultReviewCriteria,
  getTodayLocalISO,
  getVerdictForScore,
  normalizeOwnedVolumes,
  normalizeProgressMode,
  syncSeriesProgressFields,
} from '../utils/backlogHelpers';
import {
  COLLECTIONS_STORAGE_KEY,
  createCustomCollection,
  normalizeCollectionList,
  reorderCollections,
  reorderWorkInCollection,
  saveCollections,
  toggleWorkInCollection,
} from '../utils/collections';

const STORAGE_KEY = domainConfig.storageKey;
const SESSIONS_STORAGE_KEY = 'codice_reading_sessions';

function normalizeRating(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return null;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function normalizeNonNegativeInt(value) {
  if (value === '' || value === null || value === undefined) return 0;
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 0) return 0;
  return Math.round(parsed);
}

function normalizeNullablePositiveInt(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed <= 0) return null;
  return Math.round(parsed);
}

function normalizeWorkType(value) {
  if (
    value === 'manga' ||
    value === 'academic' ||
    value === 'book' ||
    value === 'light_novel' ||
    value === 'comic'
  ) {
    return value;
  }
  return 'book';
}

function normalizeItem(rawItem) {
  const status = rawItem.status || domainConfig.ui.add.defaultNewStatus;
  const isCompleted = status === 'completed';
  const workType = normalizeWorkType(rawItem.workType);
  const nowIso = new Date().toISOString();
  const today = getTodayLocalISO();

  const completedDate = isCompleted ? rawItem.completedDate || today : null;
  const startDate =
    status === 'playing'
      ? rawItem.startDate || today
      : isCompleted
        ? rawItem.startDate || completedDate
        : rawItem.startDate || null;

  const reviewCriteria = rawItem.reviewCriteria || null;
  const computedRating = reviewCriteria
    ? calculateSmartRating(reviewCriteria)
    : normalizeRating(rawItem.rating);

  const rating = isCompleted
    ? computedRating ?? normalizeRating(rawItem.rating)
    : normalizeRating(rawItem.rating);

  const totalPages = normalizeNullablePositiveInt(rawItem.totalPages);
  const rawCurrentPage = normalizeNonNegativeInt(rawItem.currentPage);
  const currentPage = isCompleted && totalPages ? totalPages : rawCurrentPage;

  const progressMode = normalizeProgressMode(rawItem.progressMode);
  const locTotal = normalizeNullablePositiveInt(rawItem.locTotal);
  const rawLocCurrent = normalizeNonNegativeInt(rawItem.locCurrent);
  const locCurrent = isCompleted && locTotal ? locTotal : rawLocCurrent;
  const hasExplicitPercent =
    rawItem.progressPercent !== null &&
    rawItem.progressPercent !== undefined &&
    rawItem.progressPercent !== '' &&
    !Number.isNaN(Number(rawItem.progressPercent));
  const progressPercent = isCompleted
    ? 100
    : hasExplicitPercent
      ? calculatePercentProgress(rawItem.progressPercent)
      : null;

  const seriesFields = syncSeriesProgressFields(rawItem, isCompleted);
  const {
    totalVolumes,
    currentVolume,
    totalChapters,
    currentChapter,
    ownedVolumes,
  } = seriesFields;

  const format =
    rawItem.format ||
    (rawItem.access && rawItem.access !== 'Wishlist' ? rawItem.access : null) ||
    domainConfig.bookFormats[0];

  const author =
    typeof rawItem.author === 'string'
      ? rawItem.author
      : typeof rawItem.creator === 'string'
        ? rawItem.creator
        : '';

  const normalized = {
    ...rawItem,
    id: String(rawItem.id),
    workType,
    title: String(rawItem.title || ''),
    author,
    format,
    coverSources: Array.isArray(rawItem.coverSources)
      ? rawItem.coverSources.filter(Boolean)
      : rawItem.coverUrl
        ? [rawItem.coverUrl]
        : [],
    genres: Array.isArray(rawItem.genres) ? rawItem.genres : [],
    primaryGenre:
      typeof rawItem.primaryGenre === 'string' && rawItem.primaryGenre.trim()
        ? rawItem.primaryGenre.trim()
        : Array.isArray(rawItem.genres) && rawItem.genres[0]
          ? String(rawItem.genres[0])
          : '',
    subgenres: Array.isArray(rawItem.subgenres)
      ? rawItem.subgenres.filter(Boolean)
      : Array.isArray(rawItem.genres) && rawItem.genres.length > 1
        ? rawItem.genres.slice(1).filter(Boolean)
        : [],
    readerBookId: rawItem.readerBookId ? String(rawItem.readerBookId) : null,
    currentPage,
    totalPages,
    progressMode,
    progressPercent,
    locCurrent,
    locTotal,
    currentVolume,
    volumeCurrent: currentVolume,
    totalVolumes,
    volumeTotal: totalVolumes,
    currentChapter,
    chapterCurrent: currentChapter,
    totalChapters,
    chapterTotal: totalChapters,
    ownedVolumes,
    demographicOrigin:
      rawItem.demographicOrigin || domainConfig.mangaOrigins[0],
    publicationStatus:
      rawItem.publicationStatus || domainConfig.mangaPubStatuses[0],
    publisher: typeof rawItem.publisher === 'string' ? rawItem.publisher : '',
    isbn: typeof rawItem.isbn === 'string' ? rawItem.isbn : '',
    issn: typeof rawItem.issn === 'string' ? rawItem.issn : '',
    doi: typeof rawItem.doi === 'string' ? rawItem.doi : '',
    cdu_cdd: typeof rawItem.cdu_cdd === 'string' ? rawItem.cdu_cdd : '',
    cutter: typeof rawItem.cutter === 'string' ? rawItem.cutter : '',
    callNumber: typeof rawItem.callNumber === 'string' ? rawItem.callNumber : '',
    edition: typeof rawItem.edition === 'string' ? rawItem.edition : '',
    publicationPlace:
      typeof rawItem.publicationPlace === 'string' ? rawItem.publicationPlace : '',
    publicationYear:
      rawItem.publicationYear ?? rawItem.releaseYear ?? null,
    language: typeof rawItem.language === 'string' ? rawItem.language : '',
    translator: typeof rawItem.translator === 'string' ? rawItem.translator : '',
    advisor: typeof rawItem.advisor === 'string' ? rawItem.advisor : '',
    seriesName: typeof rawItem.seriesName === 'string' ? rawItem.seriesName : '',
    seriesIndex: typeof rawItem.seriesIndex === 'string' ? rawItem.seriesIndex : '',
    seriesVolume:
      typeof rawItem.seriesVolume === 'string' ? rawItem.seriesVolume : '',
    physicalLocation:
      typeof rawItem.physicalLocation === 'string' ? rawItem.physicalLocation : '',
    acquisitionType:
      typeof rawItem.acquisitionType === 'string' ? rawItem.acquisitionType : '',
    conservationState:
      typeof rawItem.conservationState === 'string' ? rawItem.conservationState : '',
    originalTitle:
      typeof rawItem.originalTitle === 'string' ? rawItem.originalTitle : '',
    loanedTo: typeof rawItem.loanedTo === 'string' ? rawItem.loanedTo : '',
    loanedAt: rawItem.loanedAt || null,
    recommended:
      rawItem.recommended !== undefined ? Boolean(rawItem.recommended) : false,
    readerState: rawItem.readerState || null,
    synopsis: typeof rawItem.synopsis === 'string' ? rawItem.synopsis : '',
    academicProgressMode:
      rawItem.academicProgressMode === 'fichamento' ? 'fichamento' : 'pages',
    fichamentoSteps:
      rawItem.fichamentoSteps && typeof rawItem.fichamentoSteps === 'object'
        ? rawItem.fichamentoSteps
        : {},
    institution:
      typeof rawItem.institution === 'string' ? rawItem.institution : '',
    keywords: typeof rawItem.keywords === 'string' ? rawItem.keywords : '',
    fichamento:
      typeof rawItem.fichamento === 'string' ? rawItem.fichamento : '',
    abntReference:
      typeof rawItem.abntReference === 'string' ? rawItem.abntReference : '',
    atmosphere: Array.isArray(rawItem.atmosphere) ? rawItem.atmosphere : [],
    tropes: Array.isArray(rawItem.tropes) ? rawItem.tropes : [],
    collectionIds: Array.isArray(rawItem.collectionIds)
      ? Array.from(new Set(rawItem.collectionIds.map(String).filter(Boolean)))
      : [],
    quotes: Array.isArray(rawItem.quotes)
      ? rawItem.quotes.filter((q) => q && typeof q === 'object' && q.text)
      : [],
    rating,
    reviewCriteria,
    verdict: rawItem.verdict || getVerdictForScore(rating),
    checkpoint: typeof rawItem.checkpoint === 'string' ? rawItem.checkpoint : '',
    hype: rawItem.hype || null,
    access: rawItem.access || null,
    isPlatinum: Boolean(rawItem.isPlatinum),
    completionType: rawItem.completionType || null,
    dropReason: rawItem.dropReason || null,
    startDate,
    completedDate,
    dropDate:
      status === 'dropped' ? rawItem.dropDate || today : rawItem.dropDate || null,
    notes: typeof rawItem.notes === 'string' ? rawItem.notes : '',
    status,
    completedYear: isCompleted
      ? Number(completedDate?.slice(0, 4)) ||
        rawItem.completedYear ||
        domainConfig.currentYear
      : null,
    isFavorite: Boolean(rawItem.isFavorite),
    isWishlist: Boolean(rawItem.isWishlist || rawItem.access === 'Wishlist'),
    inBacklog: rawItem.inBacklog !== undefined ? Boolean(rawItem.inBacklog) : true,
    createdAt: rawItem.createdAt || nowIso,
    updatedAt: rawItem.updatedAt || nowIso,
  };

  normalized.progress = calculateWorkProgress(normalized);
  return normalized;
}

function applyStatusTransitionDefaults(merged, nextStatus, prevItem) {
  const today = getTodayLocalISO();

  if (nextStatus === 'playing') {
    merged.startDate = merged.startDate || today;
    merged.completedYear = null;
    merged.progress = calculateWorkProgress(merged);
  }

  if (nextStatus === 'completed') {
    merged.completedDate = merged.completedDate || today;
    merged.startDate = merged.startDate || prevItem?.startDate || merged.completedDate;
    merged.completedYear =
      Number(merged.completedDate.slice(0, 4)) || domainConfig.currentYear;
    merged.progress = 100;
    merged.progressPercent = 100;
    if (merged.totalPages > 0) {
      merged.currentPage = merged.totalPages;
    }
    if (merged.locTotal > 0) {
      merged.locCurrent = merged.locTotal;
    }
    if (merged.workType === 'manga') {
      if (merged.totalChapters > 0) merged.currentChapter = merged.totalChapters;
      if (merged.totalVolumes > 0) merged.currentVolume = merged.totalVolumes;
    }
    merged.completionType =
      merged.completionType || domainConfig.tactileOptions.completionTypes[0];

    if (!merged.reviewCriteria) {
      merged.reviewCriteria = createDefaultReviewCriteria(merged.rating ?? 80);
    }
    merged.rating = calculateSmartRating(merged.reviewCriteria);
    merged.verdict = merged.verdict || getVerdictForScore(merged.rating);
  }

  if (nextStatus === 'dropped') {
    merged.dropDate = merged.dropDate || today;
    merged.completedYear = null;
    merged.progress = calculateWorkProgress(merged);
  }

  if (nextStatus === 'queued') {
    merged.completedYear = null;
    merged.progress = calculateWorkProgress(merged);
  }

  return merged;
}

function loadInitialBacklog() {
  try {
    const rawLegacy = localStorage.getItem(STORAGE_KEY);
    if (rawLegacy !== null) {
      const parsed = JSON.parse(rawLegacy);
      if (Array.isArray(parsed)) return parsed.map(normalizeItem);
    }
    const storedDb = loadStoredCodiceDatabase();
    if (storedDb) {
      const { items } = hydrateAppSnapshotFromDatabase(storedDb);
      return items.map(normalizeItem);
    }
    const mirror = loadEmergencyMirror();
    if (mirror.ok && mirror.items.length > 0) {
      return mirror.items.map(normalizeItem);
    }
    return initialItems.map(normalizeItem);
  } catch {
    return initialItems.map(normalizeItem);
  }
}

function loadInitialSessions() {
  try {
    const raw = localStorage.getItem(SESSIONS_STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
    const storedDb = loadStoredCodiceDatabase();
    if (storedDb) {
      return hydrateAppSnapshotFromDatabase(storedDb).readingSessions || [];
    }
    const mirror = loadEmergencyMirror();
    if (mirror.ok && mirror.readingSessions.length > 0) {
      return mirror.readingSessions;
    }
    return [];
  } catch {
    return [];
  }
}

function loadInitialCollections() {
  try {
    const raw = localStorage.getItem(COLLECTIONS_STORAGE_KEY);
    if (raw !== null) {
      return normalizeCollectionList(JSON.parse(raw));
    }
    const storedDb = loadStoredCodiceDatabase();
    if (storedDb) {
      return normalizeCollectionList(hydrateAppSnapshotFromDatabase(storedDb).collections);
    }
    const mirror = loadEmergencyMirror();
    if (mirror.ok && mirror.collections.length > 0) {
      return mirror.collections;
    }
    return [];
  } catch {
    return [];
  }
}

export function useBacklog() {
  const [items, setItems] = useState(loadInitialBacklog);
  const [readingSessions, setReadingSessions] = useState(loadInitialSessions);
  const [collections, setCollections] = useState(loadInitialCollections);

  useEffect(() => {
    const flush = () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      } catch {
        // Ignora erro caso quota de storage esteja indisponível
      }
    };
    const timer = setTimeout(flush, 180);
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', flush);
    }
    return () => {
      clearTimeout(timer);
      if (typeof window !== 'undefined') {
        window.removeEventListener('pagehide', flush);
      }
    };
  }, [items]);

  useEffect(() => {
    const flushSessions = () => {
      try {
        localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(readingSessions));
      } catch {
        // Ignora erro caso quota de storage esteja indisponível
      }
    };
    const timer = setTimeout(flushSessions, 180);
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', flushSessions);
    }
    return () => {
      clearTimeout(timer);
      if (typeof window !== 'undefined') {
        window.removeEventListener('pagehide', flushSessions);
      }
    };
  }, [readingSessions]);

  useEffect(() => {
    saveCollections(collections);
  }, [collections]);

  const addItem = useCallback((newItem) => {
    const nowIso = new Date().toISOString();
    const status = newItem.status || domainConfig.ui.add.defaultNewStatus;

    const prepared = applyStatusTransitionDefaults(
      normalizeItem({
        ...newItem,
        rating: status === 'completed' ? newItem.rating ?? 80 : null,
        inBacklog: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      }),
      status,
      null
    );

    const normalizedTitle = prepared.title.trim().toLowerCase();

    setItems((prev) => {
      const existingIndex = prev.findIndex(
        (item) =>
          item.id === prepared.id ||
          (item.title.trim().toLowerCase() === normalizedTitle &&
            item.workType === prepared.workType)
      );

      if (existingIndex !== -1) {
        return prev.map((item, idx) =>
          idx === existingIndex
            ? {
                ...item,
                ...prepared,
                id: item.id,
                createdAt: item.createdAt,
                updatedAt: nowIso,
                inBacklog: true,
              }
            : item
        );
      }

      return [prepared, ...prev];
    });
  }, []);

  const updateItem = useCallback((id, updates) => {
    const nowIso = new Date().toISOString();

    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        const nextStatus = updates.status ?? item.status;
        const statusChanged = Boolean(updates.status && updates.status !== item.status);

        let merged = {
          ...item,
          ...updates,
          status: nextStatus,
          updatedAt: nowIso,
        };

        if (Object.prototype.hasOwnProperty.call(updates, 'workType')) {
          merged.workType = normalizeWorkType(updates.workType);
        }

        if (Object.prototype.hasOwnProperty.call(updates, 'currentPage')) {
          merged.currentPage = normalizeNonNegativeInt(updates.currentPage);
        }
        if (Object.prototype.hasOwnProperty.call(updates, 'totalPages')) {
          merged.totalPages = normalizeNullablePositiveInt(updates.totalPages);
        }
        if (Object.prototype.hasOwnProperty.call(updates, 'progressMode')) {
          merged.progressMode = normalizeProgressMode(updates.progressMode);
        }
        if (Object.prototype.hasOwnProperty.call(updates, 'progressPercent')) {
          merged.progressPercent =
            updates.progressPercent === null || updates.progressPercent === ''
              ? null
              : calculatePercentProgress(updates.progressPercent);
        }
        if (Object.prototype.hasOwnProperty.call(updates, 'locCurrent')) {
          merged.locCurrent = normalizeNonNegativeInt(updates.locCurrent);
        }
        if (Object.prototype.hasOwnProperty.call(updates, 'locTotal')) {
          merged.locTotal = normalizeNullablePositiveInt(updates.locTotal);
        }
        if (
          !Object.prototype.hasOwnProperty.call(updates, 'currentPage') &&
          merged.totalPages > 0 &&
          (Object.prototype.hasOwnProperty.call(updates, 'progressPercent') ||
            Object.prototype.hasOwnProperty.call(updates, 'locCurrent') ||
            Object.prototype.hasOwnProperty.call(updates, 'locTotal'))
        ) {
          const derivedPct = calculateWorkProgress(merged);
          merged.currentPage = Math.round((derivedPct / 100) * merged.totalPages);
        } else if (
          Object.prototype.hasOwnProperty.call(updates, 'currentPage') &&
          !Object.prototype.hasOwnProperty.call(updates, 'progressPercent') &&
          merged.totalPages > 0
        ) {
          merged.progressPercent =
            Math.round(
              (Math.min(merged.totalPages, merged.currentPage) / merged.totalPages) * 1000
            ) / 10;
        }
        if (
          Object.prototype.hasOwnProperty.call(updates, 'currentVolume') ||
          Object.prototype.hasOwnProperty.call(updates, 'volumeCurrent')
        ) {
          const v = normalizeNonNegativeInt(updates.volumeCurrent ?? updates.currentVolume);
          merged.currentVolume = v;
          merged.volumeCurrent = v;
        }
        if (
          Object.prototype.hasOwnProperty.call(updates, 'totalVolumes') ||
          Object.prototype.hasOwnProperty.call(updates, 'volumeTotal')
        ) {
          const tv = normalizeNullablePositiveInt(updates.volumeTotal ?? updates.totalVolumes);
          merged.totalVolumes = tv;
          merged.volumeTotal = tv;
        }
        if (
          Object.prototype.hasOwnProperty.call(updates, 'currentChapter') ||
          Object.prototype.hasOwnProperty.call(updates, 'chapterCurrent')
        ) {
          const ch = normalizeNonNegativeInt(updates.chapterCurrent ?? updates.currentChapter);
          merged.currentChapter = ch;
          merged.chapterCurrent = ch;
        }
        if (
          Object.prototype.hasOwnProperty.call(updates, 'totalChapters') ||
          Object.prototype.hasOwnProperty.call(updates, 'chapterTotal')
        ) {
          const tch = normalizeNullablePositiveInt(updates.chapterTotal ?? updates.totalChapters);
          merged.totalChapters = tch;
          merged.chapterTotal = tch;
        }
        if (Object.prototype.hasOwnProperty.call(updates, 'ownedVolumes')) {
          merged.ownedVolumes = normalizeOwnedVolumes(updates.ownedVolumes);
        }

        if (Object.prototype.hasOwnProperty.call(updates, 'access')) {
          if (updates.access === 'Wishlist') {
            merged.isWishlist = true;
          } else {
            if (item.access === 'Wishlist') {
              merged.isWishlist = false;
            }
            if (updates.access) {
              merged.format = updates.access;
            }
          }
        }

        if (Object.prototype.hasOwnProperty.call(updates, 'rating')) {
          merged.rating = normalizeRating(updates.rating);
          if (!Object.prototype.hasOwnProperty.call(updates, 'verdict')) {
            merged.verdict = getVerdictForScore(merged.rating);
          }
        } else if (
          Object.prototype.hasOwnProperty.call(updates, 'reviewCriteria') &&
          (merged.rating === null || merged.rating === undefined)
        ) {
          const score = calculateSmartRating(updates.reviewCriteria);
          merged.rating = score;
          merged.verdict = getVerdictForScore(score);
        }

        if (statusChanged) {
          merged = applyStatusTransitionDefaults(merged, nextStatus, item);
        } else {
          if (nextStatus === 'completed') {
            merged.progress = 100;
            merged.progressPercent = 100;
            if (
              Object.prototype.hasOwnProperty.call(updates, 'totalPages') &&
              merged.totalPages > 0
            ) {
              merged.currentPage = merged.totalPages;
            }
            if (
              Object.prototype.hasOwnProperty.call(updates, 'locTotal') &&
              merged.locTotal > 0
            ) {
              merged.locCurrent = merged.locTotal;
            }
            if (merged.completedDate) {
              merged.completedYear =
                Number(merged.completedDate.slice(0, 4)) || domainConfig.currentYear;
            }
          } else {
            merged.progress = calculateWorkProgress(merged);
          }
        }

        return merged;
      })
    );
  }, []);

  const removeItem = useCallback((id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    setReadingSessions((prev) => prev.filter((session) => session.workId !== id));
  }, []);

  const batchUpdateItems = useCallback((ids = [], updates = {}) => {
    const idSet = new Set((Array.isArray(ids) ? ids : []).map(String));
    if (idSet.size === 0) return;
    const nowIso = new Date().toISOString();
    setItems((prev) =>
      prev.map((item) => {
        if (!idSet.has(String(item.id))) return item;
        let merged = { ...item, updatedAt: nowIso };
        if (updates.status) {
          merged.status = updates.status;
          merged = applyStatusTransitionDefaults(merged, updates.status, item);
        }
        if (updates.addCollectionId) {
          const cols = Array.isArray(merged.collectionIds) ? merged.collectionIds.map(String) : [];
          if (!cols.includes(String(updates.addCollectionId))) {
            merged.collectionIds = [...cols, String(updates.addCollectionId)];
          }
        }
        if (updates.removeCollectionId) {
          const cols = Array.isArray(merged.collectionIds) ? merged.collectionIds.map(String) : [];
          merged.collectionIds = cols.filter((c) => c !== String(updates.removeCollectionId));
        }
        return normalizeItem(merged);
      })
    );
  }, []);

  const batchRemoveItems = useCallback(
    (ids = []) => {
      const idSet = new Set((Array.isArray(ids) ? ids : []).map(String));
      if (idSet.size === 0) return { removedItems: [], removedSessions: [] };
      const removedItems = items.filter((item) => idSet.has(String(item.id)));
      const removedSessions = readingSessions.filter((s) => idSet.has(String(s.workId)));
      setItems((prev) => prev.filter((item) => !idSet.has(String(item.id))));
      setReadingSessions((prev) => prev.filter((s) => !idSet.has(String(s.workId))));
      return { removedItems, removedSessions };
    },
    [items, readingSessions]
  );

  const restoreRemovedItems = useCallback(({ removedItems = [], removedSessions = [] } = {}) => {
    if (Array.isArray(removedItems) && removedItems.length > 0) {
      setItems((prev) => {
        const existingIds = new Set(prev.map((i) => String(i.id)));
        const restored = removedItems
          .filter((i) => !existingIds.has(String(i.id)))
          .map(normalizeItem);
        return [...restored, ...prev];
      });
    }
    if (Array.isArray(removedSessions) && removedSessions.length > 0) {
      setReadingSessions((prev) => {
        const existingIds = new Set(prev.map((s) => String(s.id)));
        const restored = removedSessions.filter((s) => !existingIds.has(String(s.id)));
        return [...restored, ...prev];
      });
    }
  }, []);

  const moveCollection = useCallback((collectionId, direction = -1) => {
    setCollections((prev) => reorderCollections(prev, collectionId, direction));
  }, []);

  const moveCollectionWork = useCallback(
    (collectionId, workId, direction = -1) => {
      setCollections((prev) =>
        prev.map((col) => {
          if (col.id !== String(collectionId)) return col;
          const memberWorks = items.filter(
            (i) => Array.isArray(i.collectionIds) && i.collectionIds.includes(col.id)
          );
          return reorderWorkInCollection(col, workId, direction, memberWorks);
        })
      );
    },
    [items]
  );

  const createCollection = useCallback(
    (name) => {
      const res = createCustomCollection(name, collections);
      if (res.created && !res.duplicate) {
        setCollections((prev) => createCustomCollection(name, prev).collections);
      }
      return { created: res.created, duplicate: res.duplicate };
    },
    [collections]
  );

  const deleteCollection = useCallback((collectionId) => {
    if (!collectionId) return;
    const targetId = String(collectionId);
    setCollections((prev) => prev.filter((col) => col.id !== targetId));
    setItems((prev) =>
      prev.map((item) =>
        Array.isArray(item.collectionIds) && item.collectionIds.includes(targetId)
          ? {
              ...item,
              collectionIds: item.collectionIds.filter((id) => id !== targetId),
              updatedAt: new Date().toISOString(),
            }
          : item
      )
    );
  }, []);

  const toggleWorkCollection = useCallback((workId, collectionId) => {
    if (!workId || !collectionId) return;
    setItems((prev) =>
      prev.map((item) =>
        item.id === workId
          ? {
              ...item,
              collectionIds: toggleWorkInCollection(item.collectionIds, collectionId),
              updatedAt: new Date().toISOString(),
            }
          : item
      )
    );
  }, []);

  const addReadingSession = useCallback((session) => {
    if (!session || !session.workId) return null;
    const nowIso = new Date().toISOString();
    const record = {
      id: session.id || createUuid(),
      workId: String(session.workId),
      startedAt: session.startedAt || nowIso,
      endedAt: session.endedAt || nowIso,
      durationSeconds: Math.max(0, Number(session.durationSeconds) || 0),
      startPosition: session.startPosition ?? null,
      endPosition: session.endPosition ?? null,
      pagesRead: Math.max(0, Number(session.pagesRead) || 0),
      notes: String(session.notes || ''),
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    setReadingSessions((prev) => [record, ...prev].slice(0, 500));
    return record;
  }, []);

  const exportBackup = useCallback(
    async (extra = {}) => {
      const db = buildCodiceDatabase({
        items,
        profile: extra.profile || null,
        posts: extra.posts || [],
        streak: extra.streak || null,
        readingSessions,
        collections,
        follows: extra.follows || [],
        wallPosts: extra.wallPosts || [],
        directMessages: extra.directMessages || [],
      });
      const signed = await exportSignedBackupPayload(db);
      const stamp = getTodayLocalISO();
      triggerFileDownload(
        JSON.stringify(signed, null, 2),
        `codice-banco-relacional-${stamp}.json`,
        'application/json;charset=utf-8'
      );
      recordBackupExportTimestamp();
      return signed;
    },
    [items, readingSessions, collections]
  );

  const exportCatalogCsv = useCallback(
    (extra = {}) => {
      const db = buildCodiceDatabase({
        items,
        profile: extra.profile || null,
        posts: extra.posts || [],
        streak: extra.streak || null,
        readingSessions,
        collections,
      });
      exportDatabaseDownloads(db).csv();
    },
    [items, readingSessions, collections]
  );

  const exportReferencesBibtex = useCallback(
    (extra = {}) => {
      const db = buildCodiceDatabase({
        items,
        profile: extra.profile || null,
        posts: extra.posts || [],
        streak: extra.streak || null,
        readingSessions,
        collections,
      });
      exportDatabaseDownloads(db).bib();
    },
    [items, readingSessions, collections]
  );

  const importBackup = useCallback(async (file) => {
    if (!file) return { ok: false, error: domainConfig.ui.profile.backup.importError };

    try {
      const text = await file.text();
      const result = parseAndValidateBackupText(text);
      if (!result.ok) {
        return { ok: false, error: result.error };
      }

      const validItems = result.items.map(normalizeItem);
      setItems(validItems);
      setReadingSessions(result.readingSessions || []);
      if (Array.isArray(result.collections)) {
        setCollections(normalizeCollectionList(result.collections));
      }

      return {
        ok: true,
        count: validItems.length,
        profile: result.profile || null,
        posts: Array.isArray(result.posts) ? result.posts : null,
        streak: result.streak || null,
        collections: result.collections || null,
        integrity: result.integrity,
        detectedSchemaVersion: result.detectedSchemaVersion,
      };
    } catch {
      return { ok: false, error: domainConfig.ui.profile.backup.importError };
    }
  }, []);

  const replaceWorkspaceData = useCallback(
    ({ items: nextItems, readingSessions: nextSessions, collections: nextCollections } = {}) => {
      if (Array.isArray(nextItems)) {
        setItems(nextItems.map(normalizeItem));
      }
      if (Array.isArray(nextSessions)) {
        setReadingSessions(nextSessions);
      }
      if (Array.isArray(nextCollections)) {
        setCollections(normalizeCollectionList(nextCollections));
      }
    },
    []
  );

  return {
    items,
    readingSessions,
    collections,
    addItem,
    updateItem,
    removeItem,
    batchUpdateItems,
    batchRemoveItems,
    restoreRemovedItems,
    createCollection,
    deleteCollection,
    moveCollection,
    moveCollectionWork,
    toggleWorkCollection,
    addReadingSession,
    replaceWorkspaceData,
    exportBackup,
    exportCatalogCsv,
    exportReferencesBibtex,
    importBackup,
  };
}
