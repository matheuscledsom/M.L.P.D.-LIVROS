import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export const READER_THEMES = [
  {
    id: 'paper',
    label: 'Papel',
    bg: '#FAF7F0',
    surface: '#F0EBE1',
    ink: '#1E1B18',
    muted: '#575049',
    border: '#DDD5C7',
  },
  {
    id: 'sepia',
    label: 'Sépia',
    bg: '#F4ECD8',
    surface: '#E8DEC6',
    ink: '#3B2F23',
    muted: '#695745',
    border: '#D3C5A8',
  },
  {
    id: 'gray',
    label: 'Cinza',
    bg: '#2B2D31',
    surface: '#35383E',
    ink: '#E6E8EC',
    muted: '#B0B5BF',
    border: '#464A52',
  },
  {
    id: 'dark',
    label: 'Escuro',
    bg: '#141519',
    surface: '#1D1F25',
    ink: '#EAEAEE',
    muted: '#A8ABB6',
    border: '#2D303A',
  },
  {
    id: 'oled',
    label: 'Preto OLED',
    bg: '#000000',
    surface: '#0C0C0C',
    ink: '#F4F4F5',
    muted: '#A8A8B2',
    border: '#1F1F23',
  },
  {
    id: 'app',
    label: 'Seguir tema do app',
    bg: 'var(--bg-app)',
    surface: 'var(--bg-card)',
    ink: 'var(--text-primary)',
    muted: 'var(--text-muted)',
    border: 'var(--border-subtle)',
    followApp: true,
  },
];

export const DEFAULT_READER_SETTINGS = {
  theme: 'app',
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

export function useReaderProgress({
  work,
  isOpen,
  onPersistReaderState,
}) {
  const initialReaderState = work?.readerState || {};

  const [settings, setSettings] = useState(() => ({
    ...DEFAULT_READER_SETTINGS,
    ...(initialReaderState.settings || {}),
  }));
  const [bookmarks, setBookmarks] = useState(() =>
    Array.isArray(initialReaderState.bookmarks) ? initialReaderState.bookmarks : []
  );
  const [highlights, setHighlights] = useState(() =>
    Array.isArray(initialReaderState.highlights) ? initialReaderState.highlights : []
  );
  const [position, setPosition] = useState(() => ({
    page: Number(initialReaderState.position?.page) || Number(work?.currentPage) || 1,
    totalPages: Number(initialReaderState.position?.totalPages) || Number(work?.totalPages) || 0,
    cfi: initialReaderState.position?.cfi || '',
    chapterLabel: initialReaderState.position?.chapterLabel || '',
    progressPct:
      typeof initialReaderState.position?.progressPct === 'number'
        ? initialReaderState.position.progressPct
        : Number(work?.progress) || 0,
  }));

  const [activeSeconds, setActiveSeconds] = useState(0);
  const startedAtRef = useRef(new Date().toISOString());
  const startPositionRef = useRef(position);
  const debounceRef = useRef(null);
  const latestWorkIdRef = useRef(work?.id);

  useEffect(() => {
    if (!isOpen || !work) return;
    if (latestWorkIdRef.current !== work.id || !startedAtRef.current) {
      latestWorkIdRef.current = work.id;
    }
    const saved = work.readerState || {};
    const nextPos = {
      page: Number(saved.position?.page) || Math.max(1, Number(work.currentPage) || 1),
      totalPages: Number(saved.position?.totalPages) || Number(work.totalPages) || 0,
      cfi: saved.position?.cfi || '',
      chapterLabel: saved.position?.chapterLabel || '',
      progressPct:
        typeof saved.position?.progressPct === 'number'
          ? saved.position.progressPct
          : Number(work.progress) || 0,
    };
    setSettings({ ...DEFAULT_READER_SETTINGS, ...(saved.settings || {}) });
    setBookmarks(Array.isArray(saved.bookmarks) ? saved.bookmarks : []);
    setHighlights(Array.isArray(saved.highlights) ? saved.highlights : []);
    setPosition(nextPos);
    setActiveSeconds(0);
    startedAtRef.current = new Date().toISOString();
    startPositionRef.current = nextPos;
  }, [isOpen, work?.id]);

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

  // Persistência com debounce (400ms) no estado da obra
  useEffect(() => {
    if (!isOpen || !work?.id || !onPersistReaderState) return undefined;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onPersistReaderState(work.id, {
        settings,
        bookmarks,
        highlights,
        position,
        lastReadAt: new Date().toISOString(),
      });
    }, 400);

    return () => clearTimeout(debounceRef.current);
  }, [isOpen, work?.id, settings, bookmarks, highlights, position, onPersistReaderState]);

  const updateSettings = useCallback((updates) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  }, []);

  const updatePosition = useCallback((nextPos) => {
    setPosition((prev) => ({ ...prev, ...nextPos }));
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
      color: highlight.color || 'accent',
      cfi: highlight.cfi || '',
      page: highlight.page || null,
      location: highlight.location || '',
      createdAt: new Date().toISOString(),
    };
    setHighlights((prev) => [entry, ...prev]);
    return entry;
  }, []);

  const removeHighlight = useCallback((highlightId) => {
    setHighlights((prev) => prev.filter((h) => h.id !== highlightId));
  }, []);

  const activeTheme = useMemo(
    () => READER_THEMES.find((t) => t.id === settings.theme) || READER_THEMES[5],
    [settings.theme]
  );

  // Velocidade real da sessão + estimativa de minutos restantes
  const estimatedMinutesRemaining = useMemo(() => {
    const pct = Math.max(0, Math.min(100, Number(position.progressPct) || 0));
    const remainingPct = Math.max(0, 100 - pct);
    if (remainingPct === 0) return 0;

    const startPct = Math.max(
      0,
      Math.min(100, Number(startPositionRef.current?.progressPct) || 0)
    );
    const pctGained = pct - startPct;

    if (activeSeconds >= 45 && pctGained >= 0.5) {
      const secondsPerPct = activeSeconds / pctGained;
      return Math.max(1, Math.round((remainingPct * secondsPerPct) / 60));
    }

    if (position.totalPages > 0 && position.page > 0) {
      const remainingPages = Math.max(0, position.totalPages - position.page);
      return Math.max(1, Math.round(remainingPages * 1.5));
    }

    return Math.max(1, Math.round(remainingPct * 1.2));
  }, [position, activeSeconds]);

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
    estimatedMinutesRemaining,
    updateSettings,
    updatePosition,
    toggleBookmark,
    removeBookmark,
    addHighlight,
    removeHighlight,
    buildSessionSummary,
  };
}
