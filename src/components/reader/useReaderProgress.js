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
    fontSizePct: Math.max(80, Math.min(200, Number(merged.fontSizePct) || 110)),
    lineHeight: Math.max(1.35, Math.min(2.1, Number(merged.lineHeight) || 1.65)),
    paragraphSpacing: Math.max(
      0.4,
      Math.min(1.8, Number(merged.paragraphSpacing) || 1.0)
    ),
  };
}

export function formatExactPercent(rawPct) {
  const num = Math.max(0, Math.min(100, Number(rawPct) || 0));
  const rounded = Math.round(num * 10) / 10;
  return `${rounded.toFixed(1)}%`;
}

export function formatBookRemainingLabel(minutes) {
  const mins = Math.max(0, Math.round(Number(minutes) || 0));
  if (mins <= 0) return 'leitura concluída';
  if (mins < 60) return `${mins} min restantes no livro`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0
    ? `${hours}h ${remMins}min restantes no livro`
    : `${hours}h restantes no livro`;
}

export function computeTelemetryEstimate({
  position = {},
  activeSeconds = 0,
  startPosition = {},
  chapters = [],
}) {
  const pct = Math.max(0, Math.min(100, Number(position.progressPct) || 0));
  const remainingPct = Math.max(0, 100 - pct);
  const totalPages = Math.max(0, Number(position.totalPages) || 0);
  const readPages =
    totalPages > 0
      ? Math.max(1, Math.min(totalPages, Number(position.page) || 1))
      : Math.max(0, Number(position.page) || 0);
  const remainingPages = Math.max(0, totalPages - readPages);

  // Calcula velocidade real (segundos por % e por página) após amostra mínima
  const startPct = Math.max(
    0,
    Math.min(100, Number(startPosition?.progressPct) || 0)
  );
  const pctGained = pct - startPct;
  const startPage = Math.max(0, Number(startPosition?.page) || 0);
  const pagesGained = readPages - startPage;

  let secondsPerPage = 90; // ritmo editorial padrão (~1,5 min/pág)
  if (activeSeconds >= 25 && pagesGained >= 1) {
    const measured = activeSeconds / pagesGained;
    secondsPerPage = Math.max(20, Math.min(360, measured));
  } else if (activeSeconds >= 30 && pctGained >= 0.3 && totalPages > 0) {
    const equivPagesGained = (pctGained / 100) * totalPages;
    if (equivPagesGained >= 0.25) {
      secondsPerPage = Math.max(
        20,
        Math.min(360, activeSeconds / equivPagesGained)
      );
    }
  }

  let bookMinutesRemaining = 0;
  if (remainingPct > 0) {
    if (activeSeconds >= 30 && pctGained >= 0.3) {
      const secondsPerPct = Math.max(
        6,
        Math.min(1800, activeSeconds / pctGained)
      );
      bookMinutesRemaining = Math.max(
        1,
        Math.round((remainingPct * secondsPerPct) / 60)
      );
    } else if (totalPages > 0) {
      bookMinutesRemaining = Math.max(
        1,
        Math.round((remainingPages * secondsPerPage) / 60)
      );
    } else {
      bookMinutesRemaining = Math.max(1, Math.round(remainingPct * 1.2));
    }
  }

  // Tempo restante no capítulo atual
  let chapterMinutesRemaining = 0;
  const chPage = Number(position.chapterPage) || 0;
  const chTotal = Number(position.chapterTotalPages) || 0;
  if (chTotal > 0 && chPage > 0 && chTotal >= chPage) {
    const chRemainingPages = Math.max(0, chTotal - chPage);
    if (chRemainingPages > 0) {
      chapterMinutesRemaining = Math.max(
        1,
        Math.round((chRemainingPages * secondsPerPage) / 60)
      );
    }
  } else if (Array.isArray(chapters) && chapters.length > 0 && remainingPct > 0) {
    const nextChapter = chapters.find((ch) => {
      const chPct = Number(ch?.pct);
      return Number.isFinite(chPct) && chPct > pct + 0.5;
    });
    if (nextChapter) {
      const deltaPct = Math.max(0, Number(nextChapter.pct) - pct);
      if (deltaPct > 0 && bookMinutesRemaining > 0) {
        chapterMinutesRemaining = Math.max(
          1,
          Math.round((deltaPct / remainingPct) * bookMinutesRemaining)
        );
      }
    }
  }

  const percentText = formatExactPercent(pct);
  const pagesText =
    totalPages > 0
      ? `${readPages} lidas · faltam ${remainingPages} págs (de ${totalPages})`
      : `${readPages} págs lidas`;

  const bookLabel = formatBookRemainingLabel(bookMinutesRemaining);
  const timeText =
    bookMinutesRemaining > 0 && chapterMinutesRemaining > 0
      ? `${chapterMinutesRemaining} min para fim do capítulo · ${bookLabel}`
      : bookLabel;

  return {
    pct,
    percentText,
    readPages,
    totalPages,
    remainingPages,
    pagesText,
    bookMinutesRemaining,
    chapterMinutesRemaining,
    timeText,
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
    progressPct:
      typeof work?.readerState?.position?.progressPct === 'number'
        ? work.readerState.position.progressPct
        : Number(work?.progress) || 0,
  }));

  const [recapInfo, setRecapInfo] = useState(null);
  const [activeSeconds, setActiveSeconds] = useState(0);
  const startedAtRef = useRef(new Date().toISOString());
  const startPositionRef = useRef(position);
  const debounceRef = useRef(null);
  const latestWorkIdRef = useRef(effectiveStorageKey);

  // Hidrata estado unindo dados da obra + IndexedDB (prevalece o mais recente) + ajustes globais
  useEffect(() => {
    if (!isOpen) return undefined;
    let cancelled = false;
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
        idbSaved && idbTs > workTs ? { ...workSaved, ...idbSaved } : workSaved;

      const globalSettings = loadGlobalReaderSettings();
      const nextSettings = normalizeReaderSettings({
        ...globalSettings,
        ...(saved.settings || {}),
      });

      const nextPos = {
        page:
          Number(saved.position?.page) ||
          Math.max(1, Number(work?.currentPage) || 1),
        totalPages:
          Number(saved.position?.totalPages) || Number(work?.totalPages) || 0,
        cfi: saved.position?.cfi || '',
        scrollRatio: Number(saved.position?.scrollRatio) || 0,
        chapterLabel: saved.position?.chapterLabel || '',
        chapterPage: Number(saved.position?.chapterPage) || 0,
        chapterTotalPages: Number(saved.position?.chapterTotalPages) || 0,
        progressPct:
          typeof saved.position?.progressPct === 'number'
            ? saved.position.progressPct
            : Number(work?.progress) || 0,
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
      startedAtRef.current = new Date().toISOString();
      startPositionRef.current = nextPos;

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

  // Persistência com debounce (400ms) na obra e no IndexedDB
  useEffect(() => {
    if (!isOpen) return undefined;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const payload = {
        settings,
        bookmarks,
        highlights,
        position,
        lastReadAt: new Date().toISOString(),
      };
      if (work?.id && onPersistReaderState) {
        onPersistReaderState(work.id, payload);
      }
      if (effectiveStorageKey) {
        saveBookReaderState(effectiveStorageKey, payload);
      }
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
    onPersistReaderState,
  ]);

  const updateSettings = useCallback((updates) => {
    setSettings((prev) => {
      const next = normalizeReaderSettings({ ...prev, ...updates });
      saveGlobalReaderSettings(next);
      return next;
    });
  }, []);

  const updatePosition = useCallback((nextPos) => {
    setPosition((prev) => ({ ...prev, ...nextPos }));
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
        activeSeconds,
        startPosition: startPositionRef.current,
        chapters,
      }),
    [position, activeSeconds, chapters]
  );

  const buildSessionSummary = useCallback(() => {
    const startPage = Number(startPositionRef.current?.page) || 0;
    const endPage = Number(position.page) || 0;
    const pagesDelta = Math.max(0, endPage - startPage);
    return {
      workId: work?.id || '',
      startedAt: startedAtRef.current,
      endedAt: new Date().toISOString(),
      durationSeconds: activeSeconds,
      startPosition: startPositionRef.current,
      endPosition: position,
      pagesRead: pagesDelta,
      latestState: {
        settings,
        bookmarks,
        highlights,
        position,
        lastReadAt: new Date().toISOString(),
      },
    };
  }, [work?.id, activeSeconds, position, settings, bookmarks, highlights]);

  return {
    settings,
    activeTheme,
    bookmarks,
    highlights,
    position,
    activeSeconds,
    telemetry,
    estimatedMinutesRemaining: telemetry.bookMinutesRemaining,
    recapInfo,
    dismissRecap,
    updateSettings,
    updatePosition,
    toggleBookmark,
    removeBookmark,
    addHighlight,
    updateHighlight,
    removeHighlight,
    buildSessionSummary,
  };
}
