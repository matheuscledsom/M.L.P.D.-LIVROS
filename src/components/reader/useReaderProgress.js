import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getBookReaderState, saveBookReaderState } from '../../services/readerStorage.js';
import {
  GLOBAL_READER_SETTINGS_KEY,
  READER_THEMES,
  normalizeHighlightColorId,
  normalizeReaderThemeId,
  resolveReaderThemePalette,
} from '../../utils/readerThemes.js';

export { READER_THEMES };

export const DEFAULT_READER_SETTINGS = {
  theme: 'app',
  sepiaWarmth: 50,
  brightnessPct: 100,
  focusRuler: false,
  touchGesturesEnabled: true,
  fontId: 'lora',
  fontSizePct: 110,
  lineHeight: 1.65,
  marginLevel: 'comfortable',
  justify: true,
  hyphenation: true,
  paragraphSpacing: 1.0,
  epubFlow: 'paginated',
  pdfMode: 'single',
  pdfZoomMode: 'fit-width',
  pdfZoomScale: 1.0,
  pdfNightMode: false,
  pdfThumbnails: false,
  cbzMode: 'single',
  cbzDirection: 'ltr',
  cbzFit: 'width',
  cbzFilter: 'none',
  textFlow: 'scrolled',
};

export function loadGlobalReaderSettings() {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(GLOBAL_READER_SETTINGS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveGlobalReaderSettings(settings) {
  try {
    if (typeof localStorage === 'undefined' || !settings) return;
    localStorage.setItem(GLOBAL_READER_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignora caso storage esteja indisponível
  }
}

export function normalizeReaderSettings(rawSettings = {}) {
  const merged = {
    ...DEFAULT_READER_SETTINGS,
    ...(rawSettings || {}),
  };
  return {
    ...merged,
    theme: normalizeReaderThemeId(merged.theme),
    sepiaWarmth: Math.max(0, Math.min(100, Number(merged.sepiaWarmth ?? 50) || 0)),
    brightnessPct: Math.max(
      50,
      Math.min(100, Number(merged.brightnessPct ?? 100) || 100)
    ),
    focusRuler: Boolean(merged.focusRuler),
    touchGesturesEnabled: merged.touchGesturesEnabled !== false,
    fontSizePct: Math.max(80, Math.min(200, Number(merged.fontSizePct) || 110)),
    lineHeight: Math.max(1.35, Math.min(2.1, Number(merged.lineHeight) || 1.65)),
    paragraphSpacing: Math.max(
      0.4,
      Math.min(1.8, Number(merged.paragraphSpacing) || 1.0)
    ),
  };
}

export function clampProgressPct(rawPct) {
  const num = Number(rawPct);
  if (!Number.isFinite(num) || num <= 0) return 0;
  if (num >= 99.95) return 100;
  return Math.round(num * 10) / 10;
}

export function formatExactPercent(rawPct) {
  const clamped = clampProgressPct(rawPct);
  if (clamped >= 100) return '100%';
  return `${clamped.toFixed(1)}%`;
}

export function computeTelemetryEstimate({ position = {} } = {}) {
  const pct = clampProgressPct(position.progressPct);
  const remainingPct = clampProgressPct(Math.max(0, 100 - pct));
  const rawTotal = Number(position.totalPages);
  const totalPages =
    Number.isFinite(rawTotal) && rawTotal > 0 ? Math.round(rawTotal) : 0;

  let readPages = 0;
  let remainingPages = 0;
  if (totalPages > 0) {
    const rawPage = Number(position.page);
    const derivedPage =
      Number.isFinite(rawPage) && rawPage > 0
        ? Math.round(rawPage)
        : Math.max(1, Math.round((pct / 100) * totalPages));
    readPages = Math.max(1, Math.min(totalPages, derivedPage));
    remainingPages = Math.max(0, totalPages - readPages);
  }

  const percentText = `${formatExactPercent(pct)} lido · falta ${formatExactPercent(remainingPct)}`;
  const pagesText =
    totalPages > 0
      ? `${readPages} págs lidas · faltam ${remainingPages} págs`
      : '';

  return {
    pct,
    remainingPct,
    percentText,
    readPages,
    totalPages,
    remainingPages,
    hasTotalPages: totalPages > 0,
    pagesText,
  };
}

export function shouldShowRecapBanner(previousLastReadAt, savedPosition) {
  if (!previousLastReadAt) return false;
  const ts = Date.parse(previousLastReadAt);
  if (Number.isNaN(ts)) return false;
  const hoursSince = (Date.now() - ts) / (1000 * 60 * 60);
  if (hoursSince < 24) return false;
  const hasProgress =
    Number(savedPosition?.progressPct) > 0 || Number(savedPosition?.page) > 1;
  return hasProgress;
}

export function useReaderProgress({
  work,
  storageKey = '',
  isOpen,
  chapters = [],
  onPersistReaderState,
}) {
  const effectiveStorageKey = work?.id || storageKey || '';

  const [settings, setSettings] = useState(() =>
    normalizeReaderSettings({
      ...loadGlobalReaderSettings(),
      ...(work?.readerState?.settings || {}),
    })
  );
  const [bookmarks, setBookmarks] = useState(() =>
    Array.isArray(work?.readerState?.bookmarks) ? work.readerState.bookmarks : []
  );
  const [highlights, setHighlights] = useState(() =>
    Array.isArray(work?.readerState?.highlights)
      ? work.readerState.highlights.map((hl) => ({
          ...hl,
          color: normalizeHighlightColorId(hl.color),
        }))
      : []
  );
  const [position, setPosition] = useState(() => ({
    page:
      Number(work?.readerState?.position?.page) || Number(work?.currentPage) || 1,
    totalPages:
      Number(work?.readerState?.position?.totalPages) ||
      Number(work?.totalPages) ||
      0,
    cfi: work?.readerState?.position?.cfi || '',
    scrollRatio: Number(work?.readerState?.position?.scrollRatio) || 0,
    chapterLabel: work?.readerState?.position?.chapterLabel || '',
    chapterPage: Number(work?.readerState?.position?.chapterPage) || 0,
    chapterTotalPages:
      Number(work?.readerState?.position?.chapterTotalPages) || 0,
    progressPct: clampProgressPct(
      typeof work?.readerState?.position?.progressPct === 'number'
        ? work.readerState.position.progressPct
        : Number(work?.progressPercent ?? work?.progress) || 0
    ),
  }));

  const [recapInfo, setRecapInfo] = useState(null);
  const [activeSeconds, setActiveSeconds] = useState(0);
  const [persistWarning, setPersistWarning] = useState('');
  const startedAtRef = useRef(new Date().toISOString());
  const startPositionRef = useRef(position);
  const debounceRef = useRef(null);
  const latestWorkIdRef = useRef(effectiveStorageKey);
  const hasHydratedRef = useRef(false);

  // Hidrata estado unindo dados da obra + IndexedDB (prevalece o mais recente) + ajustes globais
  useEffect(() => {
    if (!isOpen) {
      hasHydratedRef.current = false;
      return undefined;
    }
    let cancelled = false;
    hasHydratedRef.current = false;
    latestWorkIdRef.current = effectiveStorageKey;

    const hydrateState = async () => {
      const workSaved = work?.readerState || {};
      const idbSaved = effectiveStorageKey
        ? await getBookReaderState(effectiveStorageKey)
        : null;
      if (cancelled) return;

      const workTs = Date.parse(workSaved.lastReadAt || '') || 0;
      const idbTs = Date.parse(idbSaved?.lastReadAt || '') || 0;
      const saved =
        idbSaved && idbTs >= workTs ? { ...workSaved, ...idbSaved } : workSaved;

      const globalSettings = loadGlobalReaderSettings();
      const nextSettings = normalizeReaderSettings({
        ...globalSettings,
        ...(saved.settings || {}),
      });

      const rawTotalPages =
        Number(saved.position?.totalPages) || Number(work?.totalPages) || 0;
      const rawPct =
        typeof saved.position?.progressPct === 'number'
          ? saved.position.progressPct
          : Number(work?.progressPercent ?? work?.progress) || 0;

      const nextPos = {
        page:
          rawTotalPages > 0
            ? Math.max(
                1,
                Math.min(
                  rawTotalPages,
                  Number(saved.position?.page) || Number(work?.currentPage) || 1
                )
              )
            : Number(saved.position?.page) || Number(work?.currentPage) || 0,
        totalPages: rawTotalPages,
        cfi: saved.position?.cfi || '',
        scrollRatio: Number(saved.position?.scrollRatio) || 0,
        chapterLabel: saved.position?.chapterLabel || '',
        chapterPage: Number(saved.position?.chapterPage) || 0,
        chapterTotalPages: Number(saved.position?.chapterTotalPages) || 0,
        progressPct: clampProgressPct(rawPct),
      };

      const savedHighlights = Array.isArray(saved.highlights)
        ? saved.highlights.map((hl) => ({
            ...hl,
            color: normalizeHighlightColorId(hl.color),
          }))
        : [];
      const savedBookmarks = Array.isArray(saved.bookmarks) ? saved.bookmarks : [];

      setSettings(nextSettings);
      setBookmarks(savedBookmarks);
      setHighlights(savedHighlights);
      setPosition(nextPos);
      setActiveSeconds(0);
      setPersistWarning('');
      startedAtRef.current = new Date().toISOString();
      startPositionRef.current = nextPos;
      hasHydratedRef.current = true;

      const prevReadIso = saved.lastReadAt || work?.updatedAt || '';
      if (shouldShowRecapBanner(prevReadIso, nextPos)) {
        const latestHighlight = savedHighlights[0] || work?.quotes?.[0] || null;
        setRecapInfo({
          page: nextPos.page,
          progressPct: nextPos.progressPct,
          chapterLabel: nextPos.chapterLabel || '',
          lastQuoteText: latestHighlight?.text || '',
          lastReadAt: prevReadIso,
        });
      } else {
        setRecapInfo(null);
      }
    };

    hydrateState();
    return () => {
      cancelled = true;
    };
  }, [isOpen, effectiveStorageKey]);

  // Auto-fecha cartão "Onde Parei" no primeiro avanço de leitura
  useEffect(() => {
    if (!recapInfo) return;
    const start = startPositionRef.current || {};
    const movedForward =
      (position.page && start.page && position.page > start.page) ||
      (position.progressPct &&
        start.progressPct !== undefined &&
        position.progressPct > start.progressPct + 0.4) ||
      (position.cfi && start.cfi && position.cfi !== start.cfi);
    if (movedForward) {
      setRecapInfo(null);
    }
  }, [recapInfo, position.page, position.progressPct, position.cfi]);

  // Cronômetro de sessão ativa (pausa ao perder foco ou ocultar aba)
  useEffect(() => {
    if (!isOpen) return undefined;
    let focused = typeof document !== 'undefined' ? !document.hidden : true;

    const handleVisibility = () => {
      focused = !document.hidden;
    };
    const handleBlur = () => {
      focused = false;
    };
    const handleFocus = () => {
      focused = !document.hidden;
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    const interval = window.setInterval(() => {
      if (focused) {
        setActiveSeconds((prev) => prev + 1);
      }
    }, 1000);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isOpen]);

  const latestSnapshotRef = useRef({
    isOpen,
    workId: work?.id || '',
    storageKey: effectiveStorageKey,
    settings,
    bookmarks,
    highlights,
    position,
    onPersistReaderState,
  });

  latestSnapshotRef.current = {
    isOpen,
    workId: work?.id || '',
    storageKey: effectiveStorageKey,
    settings,
    bookmarks,
    highlights,
    position,
    onPersistReaderState,
  };

  const buildNormalizedPayload = useCallback((snap) => {
    const pos = snap.position || {};
    const clampedPct = clampProgressPct(pos.progressPct);
    const rawTotal = Number(pos.totalPages);
    const safeTotal =
      Number.isFinite(rawTotal) && rawTotal > 0 ? Math.round(rawTotal) : 0;
    const rawPage = Number(pos.page);
    const safePage =
      safeTotal > 0
        ? Math.max(
            1,
            Math.min(
              safeTotal,
              Number.isFinite(rawPage) && rawPage > 0
                ? Math.round(rawPage)
                : Math.max(1, Math.round((clampedPct / 100) * safeTotal))
            )
          )
        : 0;

    return {
      settings: snap.settings,
      bookmarks: snap.bookmarks,
      highlights: snap.highlights,
      position: {
        ...pos,
        progressPct: clampedPct,
        totalPages: safeTotal,
        page: safePage,
      },
      lastReadAt: new Date().toISOString(),
    };
  }, []);

  const flushPersistence = useCallback(async () => {
    clearTimeout(debounceRef.current);
    const snap = latestSnapshotRef.current;
    if (!hasHydratedRef.current) return true;
    const payload = buildNormalizedPayload(snap);
    let idbOk = true;
    if (snap.storageKey) {
      try {
        idbOk = await saveBookReaderState(snap.storageKey, payload);
      } catch {
        idbOk = false;
      }
    }
    if (!idbOk) {
      setPersistWarning(
        'Não foi possível gravar o progresso no dispositivo neste momento.'
      );
    } else {
      setPersistWarning('');
    }
    if (snap.workId && snap.onPersistReaderState) {
      try {
        snap.onPersistReaderState(snap.workId, payload);
      } catch {
        // Última escrita tolerante sem travar interface
      }
    }
    return idbOk;
  }, [buildNormalizedPayload]);

  // Persistência com debounce (400ms) no IndexedDB e na obra (última escrita vence)
  useEffect(() => {
    if (!isOpen || !hasHydratedRef.current) return undefined;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      flushPersistence();
    }, 400);

    return () => clearTimeout(debounceRef.current);
  }, [
    isOpen,
    work?.id,
    effectiveStorageKey,
    settings,
    bookmarks,
    highlights,
    position,
    flushPersistence,
  ]);

  // Flush garantido em visibilitychange (hidden), pagehide e desmontagem
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushPersistence();
      }
    };
    const handlePageHide = () => {
      flushPersistence();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      flushPersistence();
    };
  }, [isOpen, flushPersistence]);

  const updateSettings = useCallback((updates) => {
    setSettings((prev) => {
      const next = normalizeReaderSettings({ ...prev, ...updates });
      saveGlobalReaderSettings(next);
      return next;
    });
  }, []);

  const updatePosition = useCallback((nextPos) => {
    setPosition((prev) => {
      const mergedPct =
        nextPos?.progressPct !== undefined
          ? clampProgressPct(nextPos.progressPct)
          : prev.progressPct;
      const mergedTotal =
        nextPos?.totalPages !== undefined
          ? Math.max(0, Math.round(Number(nextPos.totalPages) || 0))
          : prev.totalPages;
      const mergedPage =
        mergedTotal > 0
          ? Math.max(
              1,
              Math.min(
                mergedTotal,
                Math.round(
                  Number(
                    nextPos?.page !== undefined ? nextPos.page : prev.page
                  ) || 1
                )
              )
            )
          : 0;
      const next = {
        ...prev,
        ...nextPos,
        progressPct: mergedPct,
        totalPages: mergedTotal,
        page: mergedPage,
      };
      latestSnapshotRef.current = {
        ...latestSnapshotRef.current,
        position: next,
      };
      return next;
    });
  }, []);

  const dismissRecap = useCallback(() => {
    setRecapInfo(null);
  }, []);

  const toggleBookmark = useCallback((bookmark) => {
    setBookmarks((prev) => {
      const exists = prev.some(
        (b) =>
          (bookmark.cfi && b.cfi === bookmark.cfi) ||
          (!bookmark.cfi && bookmark.page && b.page === bookmark.page)
      );
      if (exists) {
        return prev.filter(
          (b) =>
            !(
              (bookmark.cfi && b.cfi === bookmark.cfi) ||
              (!bookmark.cfi && bookmark.page && b.page === bookmark.page)
            )
        );
      }
      return [
        {
          id: `bm-${Date.now()}`,
          label: bookmark.label || `Página ${bookmark.page || 1}`,
          page: bookmark.page || 1,
          cfi: bookmark.cfi || '',
          progressPct: bookmark.progressPct ?? 0,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ];
    });
  }, []);

  const removeBookmark = useCallback((bookmarkId) => {
    setBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId));
  }, []);

  const addHighlight = useCallback((highlight) => {
    const entry = {
      id: highlight.id || `hl-${Date.now()}`,
      text: String(highlight.text || ''),
      note: String(highlight.note || ''),
      color: normalizeHighlightColorId(highlight.color),
      cfi: highlight.cfi || '',
      page: highlight.page || null,
      sectionId: highlight.sectionId || '',
      sectionIndex:
        typeof highlight.sectionIndex === 'number' ? highlight.sectionIndex : null,
      startOffset:
        typeof highlight.startOffset === 'number' ? highlight.startOffset : null,
      endOffset:
        typeof highlight.endOffset === 'number' ? highlight.endOffset : null,
      location: highlight.location || '',
      createdAt: highlight.createdAt || new Date().toISOString(),
    };
    setHighlights((prev) => {
      const idx = prev.findIndex((h) => h.id === entry.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...entry };
        return next;
      }
      return [entry, ...prev];
    });
    return entry;
  }, []);

  const updateHighlight = useCallback((highlightId, updates) => {
    setHighlights((prev) =>
      prev.map((hl) =>
        hl.id === highlightId
          ? {
              ...hl,
              ...updates,
              ...(updates.color !== undefined
                ? { color: normalizeHighlightColorId(updates.color) }
                : {}),
              updatedAt: new Date().toISOString(),
            }
          : hl
      )
    );
  }, []);

  const removeHighlight = useCallback((highlightId) => {
    setHighlights((prev) => prev.filter((h) => h.id !== highlightId));
  }, []);

  const activeTheme = useMemo(
    () => resolveReaderThemePalette(settings.theme, settings.sepiaWarmth),
    [settings.theme, settings.sepiaWarmth]
  );

  const telemetry = useMemo(
    () =>
      computeTelemetryEstimate({
        position,
      }),
    [position]
  );

  const buildSessionSummary = useCallback(() => {
    const startPage = Number(startPositionRef.current?.page) || 0;
    const endPage = Number(position.page) || 0;
    const pagesDelta = Math.max(0, endPage - startPage);
    const latestState = buildNormalizedPayload({
      settings,
      bookmarks,
      highlights,
      position,
    });
    return {
      workId: work?.id || '',
      startedAt: startedAtRef.current,
      endedAt: new Date().toISOString(),
      durationSeconds: activeSeconds,
      startPosition: startPositionRef.current,
      endPosition: latestState.position,
      pagesRead: pagesDelta,
      latestState,
    };
  }, [
    work?.id,
    activeSeconds,
    position,
    settings,
    bookmarks,
    highlights,
    buildNormalizedPayload,
  ]);

  return {
    settings,
    activeTheme,
    bookmarks,
    highlights,
    position,
    progressPercent: telemetry.pct,
    currentPage: telemetry.readPages,
    totalPages: telemetry.totalPages,
    activeSeconds,
    telemetry,
    persistWarning,
    recapInfo,
    dismissRecap,
    updateSettings,
    updatePosition,
    flushPersistence,
    toggleBookmark,
    removeBookmark,
    addHighlight,
    updateHighlight,
    removeHighlight,
    buildSessionSummary,
  };
}
