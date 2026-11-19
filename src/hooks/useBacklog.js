import { useCallback, useEffect, useState } from 'react';
import { domainConfig } from '../config/domainConfig';
import { initialItems } from '../data/mockData';
import {
  buildCodiceDatabase,
  createUuid,
  exportDatabaseDownloads,
  hydrateAppSnapshotFromDatabase,
  loadStoredCodiceDatabase,
  parseAndValidateBackupText,
} from '../services/codiceDatabase';
import {
  calculateSmartRating,
  calculateWorkProgress,
  createDefaultReviewCriteria,
  getTodayLocalISO,
  getVerdictForScore,
} from '../utils/backlogHelpers';

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
  if (value === 'manga' || value === 'academic' || value === 'book') {
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

  const totalVolumes = normalizeNullablePositiveInt(rawItem.totalVolumes);
  const rawCurrentVolume = normalizeNonNegativeInt(rawItem.currentVolume);
  const currentVolume =
    isCompleted && totalVolumes ? totalVolumes : rawCurrentVolume;

  const totalChapters = normalizeNullablePositiveInt(rawItem.totalChapters);
  const rawCurrentChapter = normalizeNonNegativeInt(rawItem.currentChapter);
  const currentChapter =
    isCompleted && totalChapters ? totalChapters : rawCurrentChapter;

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
    currentPage,
    totalPages,
    currentVolume,
    totalVolumes,
    currentChapter,
    totalChapters,
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
    if (merged.totalPages > 0) {
      merged.currentPage = merged.totalPages;
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
    return [];
  } catch {
    return [];
  }
}

export function useBacklog() {
  const [items, setItems] = useState(loadInitialBacklog);
  const [readingSessions, setReadingSessions] = useState(loadInitialSessions);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Ignora erro caso quota de storage esteja indisponível
    }
  }, [items]);

  useEffect(() => {
    try {
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(readingSessions));
    } catch {
      // Ignora erro caso quota de storage esteja indisponível
    }
  }, [readingSessions]);

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
        if (Object.prototype.hasOwnProperty.call(updates, 'currentVolume')) {
          merged.currentVolume = normalizeNonNegativeInt(updates.currentVolume);
        }
        if (Object.prototype.hasOwnProperty.call(updates, 'totalVolumes')) {
          merged.totalVolumes = normalizeNullablePositiveInt(updates.totalVolumes);
        }
        if (Object.prototype.hasOwnProperty.call(updates, 'currentChapter')) {
          merged.currentChapter = normalizeNonNegativeInt(updates.currentChapter);
        }
        if (Object.prototype.hasOwnProperty.call(updates, 'totalChapters')) {
          merged.totalChapters = normalizeNullablePositiveInt(updates.totalChapters);
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

        if (Object.prototype.hasOwnProperty.call(updates, 'reviewCriteria')) {
          const score = calculateSmartRating(updates.reviewCriteria);
          merged.rating = score;
          merged.verdict = getVerdictForScore(score);
        } else if (Object.prototype.hasOwnProperty.call(updates, 'rating')) {
          merged.rating = normalizeRating(updates.rating);
          if (!Object.prototype.hasOwnProperty.call(updates, 'verdict')) {
            merged.verdict = getVerdictForScore(merged.rating);
          }
        }

        if (statusChanged) {
          merged = applyStatusTransitionDefaults(merged, nextStatus, item);
        } else {
          if (nextStatus === 'completed') {
            merged.progress = 100;
            if (
              Object.prototype.hasOwnProperty.call(updates, 'totalPages') &&
              merged.totalPages > 0
            ) {
              merged.currentPage = merged.totalPages;
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
    (extra = {}) => {
      const db = buildCodiceDatabase({
        items,
        profile: extra.profile || null,
        posts: extra.posts || [],
        streak: extra.streak || null,
        readingSessions,
      });
      exportDatabaseDownloads(db).json();
    },
    [items, readingSessions]
  );

  const exportCatalogCsv = useCallback(
    (extra = {}) => {
      const db = buildCodiceDatabase({
        items,
        profile: extra.profile || null,
        posts: extra.posts || [],
        streak: extra.streak || null,
        readingSessions,
      });
      exportDatabaseDownloads(db).csv();
    },
    [items, readingSessions]
  );

  const exportReferencesBibtex = useCallback(
    (extra = {}) => {
      const db = buildCodiceDatabase({
        items,
        profile: extra.profile || null,
        posts: extra.posts || [],
        streak: extra.streak || null,
        readingSessions,
      });
      exportDatabaseDownloads(db).bib();
    },
    [items, readingSessions]
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

      return {
        ok: true,
        count: validItems.length,
        profile: result.profile || null,
        posts: Array.isArray(result.posts) ? result.posts : null,
        streak: result.streak || null,
        integrity: result.integrity,
        detectedSchemaVersion: result.detectedSchemaVersion,
      };
    } catch {
      return { ok: false, error: domainConfig.ui.profile.backup.importError };
    }
  }, []);

  return {
    items,
    readingSessions,
    addItem,
    updateItem,
    removeItem,
    addReadingSession,
    exportBackup,
    exportCatalogCsv,
    exportReferencesBibtex,
    importBackup,
  };
}
