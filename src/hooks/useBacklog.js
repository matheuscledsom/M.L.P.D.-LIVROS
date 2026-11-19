import { useCallback, useEffect, useState } from 'react';
import { domainConfig } from '../config/domainConfig';
import { initialItems } from '../data/mockData';
import {
  calculatePageProgress,
  calculateSmartRating,
  createDefaultReviewCriteria,
  getTodayLocalISO,
  getVerdictForScore,
} from '../utils/backlogHelpers';

const STORAGE_KEY = domainConfig.storageKey;

function normalizeRating(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return null;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function normalizePages(value) {
  if (value === '' || value === null || value === undefined) return 0;
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 0) return 0;
  return Math.round(parsed);
}

function normalizeNullablePages(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed <= 0) return null;
  return Math.round(parsed);
}

function normalizeItem(rawItem) {
  const status = rawItem.status || domainConfig.ui.add.defaultNewStatus;
  const isCompleted = status === 'completed';
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

  const totalPages = normalizeNullablePages(rawItem.totalPages);
  const rawCurrentPage = normalizePages(rawItem.currentPage);
  const currentPage =
    isCompleted && totalPages ? totalPages : rawCurrentPage;

  const format =
    rawItem.format ||
    (rawItem.access && rawItem.access !== 'Wishlist' ? rawItem.access : null) ||
    domainConfig.formatOptions[0];

  const author =
    typeof rawItem.author === 'string'
      ? rawItem.author
      : typeof rawItem.creator === 'string'
        ? rawItem.creator
        : '';

  return {
    ...rawItem,
    id: String(rawItem.id),
    title: String(rawItem.title || ''),
    author,
    format,
    genres: Array.isArray(rawItem.genres) ? rawItem.genres : [],
    currentPage,
    totalPages,
    rating,
    reviewCriteria,
    verdict: rawItem.verdict || getVerdictForScore(rating),
    progress: isCompleted ? 100 : calculatePageProgress(currentPage, totalPages),
    checkpoint: typeof rawItem.checkpoint === 'string' ? rawItem.checkpoint : '',
    hype: rawItem.hype || null,
    access: rawItem.access || null,
    isPlatinum: Boolean(rawItem.isPlatinum),
    completionType: rawItem.completionType || null,
    dropReason: rawItem.dropReason || null,
    startDate,
    completedDate,
    dropDate: status === 'dropped' ? rawItem.dropDate || today : rawItem.dropDate || null,
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
}

function applyStatusTransitionDefaults(merged, nextStatus, prevItem) {
  const today = getTodayLocalISO();

  if (nextStatus === 'playing') {
    merged.startDate = merged.startDate || today;
    merged.completedYear = null;
    merged.progress = calculatePageProgress(merged.currentPage, merged.totalPages);
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
    merged.progress = calculatePageProgress(merged.currentPage, merged.totalPages);
  }

  if (nextStatus === 'queued') {
    merged.completedYear = null;
    merged.progress = calculatePageProgress(merged.currentPage, merged.totalPages);
  }

  return merged;
}

function loadInitialBacklog() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return initialItems.map(normalizeItem);
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return initialItems.map(normalizeItem);
    return parsed.map(normalizeItem);
  } catch {
    return initialItems.map(normalizeItem);
  }
}

export function useBacklog() {
  const [items, setItems] = useState(loadInitialBacklog);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Ignora erro caso quota de storage esteja indisponível
    }
  }, [items]);

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
          item.title.trim().toLowerCase() === normalizedTitle
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

        const hasCurrentPageUpdate = Object.prototype.hasOwnProperty.call(
          updates,
          'currentPage'
        );
        const hasTotalPagesUpdate = Object.prototype.hasOwnProperty.call(
          updates,
          'totalPages'
        );

        if (hasCurrentPageUpdate) {
          merged.currentPage = normalizePages(updates.currentPage);
        }

        if (hasTotalPagesUpdate) {
          merged.totalPages = normalizeNullablePages(updates.totalPages);
        }

        if (hasCurrentPageUpdate || hasTotalPagesUpdate) {
          if (nextStatus === 'completed') {
            merged.progress = 100;
            if (hasTotalPagesUpdate && merged.totalPages > 0) {
              merged.currentPage = merged.totalPages;
            }
          } else {
            merged.progress = calculatePageProgress(
              merged.currentPage,
              merged.totalPages
            );
          }
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
        } else if (nextStatus === 'completed' && merged.completedDate) {
          merged.completedYear =
            Number(merged.completedDate.slice(0, 4)) || domainConfig.currentYear;
        }

        return merged;
      })
    );
  }, []);

  const removeItem = useCallback((id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const exportBackup = useCallback(
    (extra = {}) => {
      const payload = {
        version: 2,
        domain: domainConfig.domainKey,
        exportedAt: new Date().toISOString(),
        items,
        ...extra,
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const dateStamp = getTodayLocalISO();
      const link = document.createElement('a');
      link.href = url;
      link.download = `mlpd-livros-${dateStamp}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    },
    [items]
  );

  const importBackup = useCallback(async (file) => {
    if (!file) return { ok: false, error: domainConfig.ui.profile.backup.importError };

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const rawList = Array.isArray(parsed) ? parsed : parsed?.items;

      if (!Array.isArray(rawList)) {
        return { ok: false, error: domainConfig.ui.profile.backup.importError };
      }

      const validItems = rawList
        .filter((entry) => entry && typeof entry === 'object' && entry.id && entry.title)
        .map(normalizeItem);

      setItems(validItems);
      return {
        ok: true,
        count: validItems.length,
        profile: parsed?.profile || null,
        posts: Array.isArray(parsed?.posts) ? parsed.posts : null,
      };
    } catch {
      return { ok: false, error: domainConfig.ui.profile.backup.importError };
    }
  }, []);

  return {
    items,
    addItem,
    updateItem,
    removeItem,
    exportBackup,
    importBackup,
  };
}
