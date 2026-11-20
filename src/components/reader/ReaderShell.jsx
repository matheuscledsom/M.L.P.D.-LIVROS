import {
  AlertCircle,
  Bookmark,
  BookOpen,
  FileUp,
  FolderOpen,
  RefreshCw,
  Upload,
  X,
} from 'lucide-react';
import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useToast } from '../../context/ToastContext';
import {
  buildQuickReaderBookId,
  getBookFileRecord,
  markStoredBookOpened,
  pickFileViaSystemAccess,
  resolveStoredFileBlob,
  saveBookFile,
  saveBookReaderState,
  supportsFileSystemAccessApi,
} from '../../services/readerStorage';
import { detectBookFileFormat } from '../../utils/fileFormatDetector';
import {
  resolveAccessibleReaderAccent,
  resolveReaderDomColors,
} from '../../utils/readerThemes';
import { AnnotationPopover } from './AnnotationPopover';
import { ReaderSettings } from './ReaderSettings';
import { ReaderToolbar } from './ReaderToolbar';
import { TocDrawer } from './TocDrawer';
import { formatExactPercent, useReaderProgress } from './useReaderProgress';

const PdfView = lazy(() =>
  import('./PdfView').then((m) => ({ default: m.PdfView }))
);
const EpubView = lazy(() =>
  import('./EpubView').then((m) => ({ default: m.EpubView }))
);
const ComicView = lazy(() =>
  import('./ComicView').then((m) => ({ default: m.ComicView }))
);
const TextView = lazy(() =>
  import('./TextView').then((m) => ({ default: m.TextView }))
);

const KEYBOARD_SHORTCUTS = [
  { keys: '← / → ou PageUp / PageDown', desc: 'página anterior / próxima' },
  { keys: 'Espaço', desc: 'avançar página' },
  { keys: 'B', desc: 'alternar marcador' },
  { keys: 'A', desc: 'tipografia e tema (Aa)' },
  { keys: 'F', desc: 'alternar tela cheia' },
  { keys: 'T', desc: 'abrir índice e notas' },
  { keys: '/', desc: 'buscar no texto' },
  { keys: '+ / -', desc: 'aumentar / diminuir fonte ou zoom' },
  { keys: '?', desc: 'atalhos de teclado' },
  { keys: 'Esc', desc: 'fechar painéis ou leitor' },
];

function ReaderSkeleton({ label = 'carregando leitura...' }) {
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-4 p-6"
      style={{ backgroundColor: 'var(--reader-bg)', color: 'var(--reader-ink)' }}
    >
      <div className="w-full max-w-xl space-y-3" aria-hidden="true">
        <div
          className="h-4 w-2/3 rounded-[2px] opacity-35"
          style={{ backgroundColor: 'var(--reader-border)' }}
        />
        <div
          className="h-3 w-full rounded-[2px] opacity-25"
          style={{ backgroundColor: 'var(--reader-border)' }}
        />
        <div
          className="h-3 w-11/12 rounded-[2px] opacity-20"
          style={{ backgroundColor: 'var(--reader-border)' }}
        />
        <div
          className="h-3 w-4/5 rounded-[2px] opacity-15"
          style={{ backgroundColor: 'var(--reader-border)' }}
        />
      </div>
      <p className="text-xs" style={{ color: 'var(--reader-muted)' }}>
        {label}
      </p>
    </div>
  );
}

export function ReaderShell({
  isOpen,
  work = null,
  initialBookId = null,
  initialFile = null,
  onClose,
  onPersistReaderState,
  onRecordSession,
  onSyncWorkProgress,
  onSaveQuoteFromReader,
  onPublishQuoteFromReader,
}) {
  const { showToast } = useToast();
  const rootRef = useRef(null);
  const engineRef = useRef(null);
  const fileInputRef = useRef(null);
  const hideTimerRef = useRef(null);

  const [fileBlob, setFileBlob] = useState(null);
  const [fileFormat, setFileFormat] = useState(null);
  const [fileName, setFileName] = useState('');
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isEngineReady, setIsEngineReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const [barsVisible, setBarsVisible] = useState(true);
  const [tocOpen, setTocOpen] = useState(false);
  const [tocInitialTab, setTocInitialTab] = useState('toc');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tocItems, setTocItems] = useState([]);
  const [selectionState, setSelectionState] = useState(null);
  const [rulerY, setRulerY] = useState(48);
  const [bookmarkFeedback, setBookmarkFeedback] = useState(null);
  const bookmarkTimerRef = useRef(null);

  const quickStorageKey = useMemo(() => {
    if (work?.id) return '';
    if (initialBookId) return String(initialBookId);
    if (!fileBlob) return '';
    return buildQuickReaderBookId(
      fileName || fileBlob.name || 'arquivo',
      fileBlob.size
    );
  }, [work?.id, initialBookId, fileBlob, fileName]);

  const {
    settings,
    activeTheme,
    bookmarks,
    highlights,
    position,
    progressPercent,
    currentPage,
    totalPages,
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
  } = useReaderProgress({
    work,
    storageKey: quickStorageKey,
    isOpen,
    chapters: tocItems,
    onPersistReaderState,
  });

  const domColors = resolveReaderDomColors(activeTheme);
  const appAccent =
    typeof document !== 'undefined'
      ? getComputedStyle(document.documentElement)
          .getPropertyValue('--accent-color')
          .trim() || '#8B5CF6'
      : '#8B5CF6';
  const readerAccent = resolveAccessibleReaderAccent(
    appAccent,
    domColors.bg,
    domColors.isLight
  );

  const readerCssVars = {
    '--reader-bg': domColors.bg,
    '--reader-surface': domColors.surface,
    '--reader-ink': domColors.ink,
    '--reader-muted': domColors.muted,
    '--reader-border': domColors.border,
    '--reader-accent': readerAccent,
    backgroundColor: domColors.bg,
    color: domColors.ink,
  };

  const scheduleAutoHide = useCallback(() => {
    clearTimeout(hideTimerRef.current);
    if (
      tocOpen ||
      settingsOpen ||
      helpOpen ||
      selectionState ||
      !fileBlob ||
      errorMsg
    ) {
      return;
    }
    hideTimerRef.current = setTimeout(() => {
      setBarsVisible(false);
    }, 3000);
  }, [tocOpen, settingsOpen, helpOpen, selectionState, fileBlob, errorMsg]);

  const revealBars = useCallback(() => {
    setBarsVisible(true);
    scheduleAutoHide();
  }, [scheduleAutoHide]);

  useEffect(() => {
    if (!isOpen) return undefined;
    scheduleAutoHide();
    return () => clearTimeout(hideTimerRef.current);
  }, [isOpen, scheduleAutoHide]);

  const loadSelectedFile = useCallback(
    async (file, { fileHandle = null, persistCopy = true } = {}) => {
      if (!file) return;
      setIsLoadingFile(true);
      setIsEngineReady(false);
      setErrorMsg('');
      setTocItems([]);
      setSelectionState(null);

      try {
        const detection = await detectBookFileFormat(file);
        if (!detection.supported) {
          setFileBlob(null);
          setFileFormat(null);
          setErrorMsg(detection.error || 'Formato não suportado.');
          return;
        }

        const targetStorageId =
          work?.id ||
          initialBookId ||
          buildQuickReaderBookId(file.name, file.size);
        if (targetStorageId) {
          await saveBookFile(targetStorageId, {
            blob: persistCopy ? file : null,
            fileHandle: persistCopy ? null : fileHandle,
            fileName: file.name,
            format: detection.format,
            size: file.size,
            lastOpenedAt: new Date().toISOString(),
          });
        }

        setFileBlob(file);
        setFileFormat(detection.format);
        setFileName(file.name);
        setBarsVisible(true);
      } catch (err) {
        setErrorMsg(
          err?.message || 'Não foi possível preparar o arquivo para leitura.'
        );
      } finally {
        setIsLoadingFile(false);
      }
    },
    [work?.id, initialBookId]
  );

  // Hidrata arquivo inicial (arrastado) ou salvo em IndexedDB para a obra
  useEffect(() => {
    if (!isOpen) {
      setFileBlob(null);
      setFileFormat(null);
      setErrorMsg('');
      setIsEngineReady(false);
      setTocOpen(false);
      setSettingsOpen(false);
      setHelpOpen(false);
      setSelectionState(null);
      return undefined;
    }

    let cancelled = false;

    const hydrate = async () => {
      if (initialFile) {
        await loadSelectedFile(initialFile, { persistCopy: true });
        return;
      }

      const targetBookId = work?.id || initialBookId;
      if (!targetBookId) return;
      setIsLoadingFile(true);
      setErrorMsg('');
      try {
        const record = await getBookFileRecord(targetBookId);
        if (cancelled) return;
        if (record) {
          await markStoredBookOpened(targetBookId);
          const blob = await resolveStoredFileBlob(record);
          if (cancelled) return;
          if (blob) {
            const detection = await detectBookFileFormat(blob);
            if (cancelled) return;
            if (!detection.supported) {
              setErrorMsg(detection.error || 'Formato não suportado.');
              return;
            }
            setFileBlob(blob);
            setFileFormat(record.format || detection.format);
            setFileName(record.fileName || work?.title || 'Leitura Códice');
          }
        }
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(
            err?.message || 'Não foi possível reabrir o arquivo salvo localmente.'
          );
        }
      } finally {
        if (!cancelled) setIsLoadingFile(false);
      }
    };

    hydrate();
    return () => {
      cancelled = true;
    };
  }, [isOpen, work?.id, work?.title, initialBookId, initialFile, loadSelectedFile]);

  const isBookmarkedHere = bookmarks.some(
    (b) =>
      (position.cfi && b.cfi === position.cfi) ||
      (!position.cfi && currentPage > 0 && b.page === currentPage)
  );

  const handleToggleBars = useCallback(() => {
    setBarsVisible((prev) => {
      const next = !prev;
      if (next) scheduleAutoHide();
      return next;
    });
  }, [scheduleAutoHide]);

  const handleToggleBookmark = useCallback(() => {
    const wasBookmarked = bookmarks.some(
      (b) =>
        (position.cfi && b.cfi === position.cfi) ||
        (!position.cfi && currentPage > 0 && b.page === currentPage)
    );
    toggleBookmark({
      label:
        position.chapterLabel ||
        (currentPage > 0
          ? `Página ${currentPage}`
          : `Posição ${formatExactPercent(progressPercent)}`),
      page: currentPage || 1,
      cfi: position.cfi || '',
      progressPct: progressPercent || 0,
    });
    clearTimeout(bookmarkTimerRef.current);
    setBookmarkFeedback({
      added: !wasBookmarked,
      label: !wasBookmarked ? 'Marcador adicionado' : 'Marcador removido',
      key: Date.now(),
    });
    bookmarkTimerRef.current = setTimeout(() => {
      setBookmarkFeedback(null);
    }, 1800);
  }, [
    bookmarks,
    position.cfi,
    position.chapterLabel,
    currentPage,
    progressPercent,
    toggleBookmark,
  ]);

  useEffect(() => () => clearTimeout(bookmarkTimerRef.current), []);

  const handleCloseReader = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
    flushPersistence?.();
    const summary = buildSessionSummary();
    if (work?.id) {
      if (summary.durationSeconds >= 5 || summary.pagesRead > 0) {
        onRecordSession?.(summary);
      }
      if (fileBlob) {
        onSyncWorkProgress?.(work, summary.endPosition);
      }
    }
    onClose?.();
  }, [
    flushPersistence,
    buildSessionSummary,
    work,
    fileBlob,
    onRecordSession,
    onSyncWorkProgress,
    onClose,
  ]);

  const handleCycleQuickTheme = useCallback(() => {
    const order = ['white', 'sepia', 'oled'];
    const idx = order.indexOf(settings.theme);
    const nextTheme = order[(idx + 1) % order.length];
    updateSettings({ theme: nextTheme });
    revealBars();
  }, [settings.theme, updateSettings, revealBars]);

  const handleToggleFullscreen = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.()
        .then(() => setIsFullscreen(true))
        .catch(() => {});
    } else {
      document
        .exitFullscreen?.()
        .then(() => setIsFullscreen(false))
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Atalhos de teclado
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (e) => {
      const targetTag = e.target?.tagName?.toLowerCase();
      const isTyping =
        targetTag === 'input' ||
        targetTag === 'textarea' ||
        e.target?.isContentEditable;

      if (e.key === 'Escape') {
        if (helpOpen) {
          setHelpOpen(false);
          return;
        }
        if (settingsOpen) {
          setSettingsOpen(false);
          return;
        }
        if (tocOpen) {
          setTocOpen(false);
          return;
        }
        if (selectionState) {
          setSelectionState(null);
          return;
        }
        handleCloseReader();
        return;
      }

      if (isTyping) return;

      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        engineRef.current?.nextPage?.();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        engineRef.current?.prevPage?.();
      } else if (e.key === ' ') {
        e.preventDefault();
        engineRef.current?.nextPage?.();
      } else if (e.key.toLowerCase() === 'b') {
        e.preventDefault();
        handleToggleBookmark();
      } else if (e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setSettingsOpen((prev) => !prev);
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        handleToggleFullscreen();
      } else if (e.key.toLowerCase() === 't') {
        e.preventDefault();
        setTocInitialTab('toc');
        setTocOpen((prev) => !prev);
      } else if (e.key === '/') {
        e.preventDefault();
        setTocInitialTab('search');
        setTocOpen(true);
      } else if (e.key === '?') {
        e.preventDefault();
        setHelpOpen((prev) => !prev);
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        if (fileFormat === 'pdf') {
          updateSettings({
            pdfZoomMode: 'custom',
            pdfZoomScale: Math.min(3.0, Number((settings.pdfZoomScale + 0.15).toFixed(2))),
          });
        } else {
          updateSettings({
            fontSizePct: Math.min(200, settings.fontSizePct + 10),
          });
        }
      } else if (e.key === '-') {
        e.preventDefault();
        if (fileFormat === 'pdf') {
          updateSettings({
            pdfZoomMode: 'custom',
            pdfZoomScale: Math.max(0.5, Number((settings.pdfZoomScale - 0.15).toFixed(2))),
          });
        } else {
          updateSettings({
            fontSizePct: Math.max(80, settings.fontSizePct - 10),
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isOpen,
    helpOpen,
    settingsOpen,
    tocOpen,
    selectionState,
    fileFormat,
    settings.pdfZoomScale,
    settings.fontSizePct,
    updateSettings,
    handleToggleBookmark,
    handleToggleFullscreen,
    handleCloseReader,
  ]);

  if (!isOpen) return null;

  const handleLinkSystemFile = async () => {
    try {
      const picked = await pickFileViaSystemAccess();
      if (picked?.file) {
        await loadSelectedFile(picked.file, {
          fileHandle: picked.handle,
          persistCopy: false,
        });
      }
    } catch (err) {
      if (err?.name !== 'AbortError') {
        setErrorMsg('Não foi possível vincular o arquivo pelo seletor do sistema.');
      }
    }
  };

  const handleDropFile = async (e) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const dropped = e.dataTransfer?.files?.[0];
    if (dropped) {
      await loadSelectedFile(dropped, { persistCopy: true });
    }
  };

  const handleCopySelection = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast({ message: 'Trecho copiado', type: 'success' });
    } catch {
      // Fallback silencioso
    }
  };

  const resolveLoc = (payload) =>
    payload.location ||
    position.chapterLabel ||
    (position.page ? `Pág. ${position.page}` : '');

  const handleApplyHighlight = (payload) => {
    const loc = resolveLoc(payload);
    const saved = addHighlight({
      id: payload.id,
      text: payload.text,
      note: payload.note || '',
      color: payload.color || 'amber',
      cfi: payload.cfi || '',
      page: position.page || null,
      sectionId: payload.sectionId || '',
      sectionIndex: payload.sectionIndex ?? null,
      startOffset: payload.startOffset ?? null,
      endOffset: payload.endOffset ?? null,
      location: loc,
    });

    if (work?.id) {
      onSaveQuoteFromReader?.(work, {
        ...saved,
        location: loc,
      });
    }
    return saved;
  };

  const handleSaveToVault = (payload) => {
    const saved = handleApplyHighlight(payload);
    if (!work?.id && saved) {
      showToast({ message: 'Destaque salvo no navegador (IndexedDB)', type: 'success' });
      return;
    }
    showToast({ message: 'Citação salva no cofre da obra', type: 'success' });
  };

  const handleUpdateHighlightNote = (hlId, updates) => {
    updateHighlight(hlId, updates);
    const existing = highlights.find((h) => h.id === hlId);
    if (work?.id && existing) {
      onSaveQuoteFromReader?.(work, {
        ...existing,
        ...updates,
      });
    }
  };

  const handlePublishHighlight = (payload) => {
    const loc = resolveLoc(payload);
    onPublishQuoteFromReader?.(work, {
      ...payload,
      bookTitle: work?.title || fileName || 'Leitura Códice',
      location: loc,
    });
  };

  const handleJumpToHighlight = (hl) => {
    if (!hl) return;
    if (hl.cfi && engineRef.current?.goToCfi) {
      engineRef.current.goToCfi(hl.cfi);
      return;
    }
    if (engineRef.current?.goToHighlight) {
      engineRef.current.goToHighlight(hl);
      return;
    }
    if (hl.page && engineRef.current?.goToPage) {
      engineRef.current.goToPage(hl.page);
    }
  };

  const brightnessScrimOpacity = Math.max(
    0,
    ((100 - (settings.brightnessPct ?? 100)) / 100) * 0.72
  );

  const handleRulerPointerMove = (e) => {
    if (!settings.focusRuler) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clientY = e.touches?.[0]?.clientY ?? e.clientY;
    if (typeof clientY !== 'number' || !rect.height) return;
    const pctY = Math.max(15, Math.min(85, ((clientY - rect.top) / rect.height) * 100));
    setRulerY(pctY);
  };

  return (
    <div
      ref={rootRef}
      style={readerCssVars}
      onMouseMove={revealBars}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingOver(true);
      }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={handleDropFile}
      className="fixed inset-0 z-50 flex h-[100dvh] flex-col overflow-hidden"
    >
      <ReaderToolbar
        title={work?.title || fileName || 'Leitor Códice'}
        formatLabel={fileFormat}
        visible={barsVisible || !fileBlob || Boolean(errorMsg)}
        telemetry={telemetry}
        progressPct={progressPercent}
        totalPages={totalPages}
        chapterLabel={position.chapterLabel}
        chapters={tocItems}
        isBookmarked={isBookmarkedHere}
        isFullscreen={isFullscreen}
        activeThemeId={settings.theme}
        onBack={handleCloseReader}
        onToggleToc={() => {
          setTocInitialTab('toc');
          setTocOpen(true);
        }}
        onOpenSearch={() => {
          setTocInitialTab('search');
          setTocOpen(true);
        }}
        onCycleQuickTheme={handleCycleQuickTheme}
        onToggleSettings={() => setSettingsOpen((prev) => !prev)}
        onToggleBookmark={handleToggleBookmark}
        onToggleFullscreen={handleToggleFullscreen}
        onToggleHelp={() => setHelpOpen(true)}
        onScrubPercent={(pct) => engineRef.current?.goToPercent?.(pct)}
      />

      {/* Feedback acessível discreto para marcador (duplo toque ou tecla B) */}
      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-none fixed left-1/2 top-16 z-50 -translate-x-1/2 transition-opacity duration-150 ease-out ${
          bookmarkFeedback ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {bookmarkFeedback && (
          <div
            className="inline-flex items-center gap-1.5 rounded-[4px] border px-3 py-1.5 text-xs font-medium"
            style={{
              backgroundColor: 'var(--reader-surface)',
              borderColor: 'var(--reader-border)',
              color: 'var(--reader-ink)',
            }}
          >
            <Bookmark
              className={`h-3.5 w-3.5 ${bookmarkFeedback.added ? 'fill-current' : ''}`}
              style={{ color: 'var(--reader-accent)' }}
              strokeWidth={1.5}
            />
            <span>{bookmarkFeedback.label}</span>
          </div>
        )}
      </div>

      {/* Aviso não-bloqueante se persistência local falhar */}
      {persistWarning && (
        <div
          role="status"
          className="fixed bottom-16 left-1/2 z-50 -translate-x-1/2 rounded-[4px] border px-3 py-1 text-[11px]"
          style={{
            backgroundColor: 'var(--reader-surface)',
            borderColor: 'var(--reader-border)',
            color: 'var(--reader-muted)',
          }}
        >
          {persistWarning}
        </div>
      )}

      {/* Cartão discreto "Onde Parei" (>24h sem leitura na obra) */}
      {fileBlob && recapInfo && !errorMsg && (
        <div
          role="status"
          className="fixed inset-x-0 z-30 border-b transition-all duration-150 ease-out"
          style={{
            top: barsVisible ? '54px' : '2px',
            backgroundColor: 'var(--reader-bg)',
            borderColor: 'var(--reader-border)',
            color: 'var(--reader-ink)',
          }}
        >
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-1.5 text-xs tabular-nums">
            <p className="min-w-0 flex-1 truncate">
              <span>
                {recapInfo.page > 0
                  ? `Retomando da Pág. ${recapInfo.page} (${formatExactPercent(recapInfo.progressPct)})`
                  : `Retomando leitura (${formatExactPercent(recapInfo.progressPct)})`}
                {recapInfo.chapterLabel
                  ? ` · Último capítulo: ${recapInfo.chapterLabel}`
                  : ''}
              </span>
              {recapInfo.lastQuoteText && (
                <span
                  className="ml-2 italic"
                  style={{ color: 'var(--reader-muted)' }}
                >
                  “{recapInfo.lastQuoteText}”
                </span>
              )}
            </p>
            <button
              type="button"
              onClick={dismissRecap}
              aria-label="Dispensar resumo de retomada"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px]"
              style={{ color: 'var(--reader-muted)' }}
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      )}

      {/* Área central de leitura / seleção / erro */}
      <main
        onMouseMove={handleRulerPointerMove}
        onTouchMove={handleRulerPointerMove}
        className="relative flex-1 overflow-hidden"
      >
        {isDraggingOver && (
          <div
            className="pointer-events-none absolute inset-4 z-50 flex flex-col items-center justify-center gap-2 rounded-[6px] border border-dashed"
            style={{
              backgroundColor: 'var(--reader-bg)',
              borderColor: 'var(--reader-accent)',
            }}
          >
            <FileUp
              className="h-7 w-7"
              style={{ color: 'var(--reader-accent)' }}
              strokeWidth={1.5}
            />
            <p className="text-sm font-medium">
              solte o arquivo para abrir no leitor
            </p>
            <p className="text-xs" style={{ color: 'var(--reader-muted)' }}>
              pdf, epub, cbz, txt ou markdown
            </p>
          </div>
        )}

        {isLoadingFile ? (
          <ReaderSkeleton label="detectando formato e preparando leitura..." />
        ) : errorMsg ? (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center">
            <div
              className="w-full max-w-sm space-y-4 rounded-[6px] border p-6"
              style={{
                backgroundColor: 'var(--reader-surface)',
                borderColor: 'var(--reader-border)',
              }}
            >
              <AlertCircle
                className="mx-auto h-6 w-6"
                style={{ color: 'var(--reader-muted)' }}
                strokeWidth={1.5}
              />
              <h2 className="text-sm font-semibold">
                Não foi possível abrir o arquivo
              </h2>
              <p
                className="text-xs leading-relaxed"
                style={{ color: 'var(--reader-muted)' }}
              >
                {errorMsg}
              </p>
              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[4px] border px-4 py-2 text-xs font-medium"
                  style={{
                    borderColor: 'var(--reader-accent)',
                    color: 'var(--reader-accent)',
                  }}
                >
                  <RefreshCw className="h-4 w-4" strokeWidth={1.5} />
                  escolher outro arquivo
                </button>
                <button
                  type="button"
                  onClick={handleCloseReader}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-[4px] border px-4 py-2 text-xs"
                  style={{
                    borderColor: 'var(--reader-border)',
                    color: 'var(--reader-muted)',
                  }}
                >
                  voltar
                </button>
              </div>
            </div>
          </div>
        ) : !fileBlob ? (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center">
            <div
              className="w-full max-w-md space-y-5 rounded-[6px] border p-7"
              style={{
                backgroundColor: 'var(--reader-surface)',
                borderColor: 'var(--reader-border)',
              }}
            >
              <BookOpen
                className="mx-auto h-6 w-6"
                style={{ color: 'var(--reader-muted)' }}
                strokeWidth={1.5}
              />
              <div>
                <h2 className="text-base font-semibold tracking-tight">
                  abrir arquivo no leitor
                </h2>
                <p
                  className="mt-1.5 text-xs leading-relaxed"
                  style={{ color: 'var(--reader-muted)' }}
                >
                  arraste e solte um arquivo aqui ou selecione do dispositivo.
                  suporta pdf, epub, cbz, txt e markdown offline em indexeddb.
                </p>
              </div>

              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[4px] border px-4 py-2.5 text-xs font-medium"
                  style={{
                    borderColor: 'var(--reader-accent)',
                    color: 'var(--reader-accent)',
                  }}
                >
                  <Upload className="h-4 w-4" strokeWidth={1.5} />
                  abrir e salvar offline
                </button>

                {supportsFileSystemAccessApi() && work?.id && (
                  <button
                    type="button"
                    onClick={handleLinkSystemFile}
                    className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[4px] border px-4 py-2.5 text-xs"
                    style={{
                      borderColor: 'var(--reader-border)',
                      color: 'var(--reader-muted)',
                    }}
                  >
                    <FolderOpen className="h-4 w-4" strokeWidth={1.5} />
                    vincular arquivo sem copiar
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            {!isEngineReady && (
              <div
                className="absolute inset-0 z-30"
                style={{ backgroundColor: 'var(--reader-bg)' }}
              >
                <ReaderSkeleton label="preparando páginas..." />
              </div>
            )}
            <Suspense fallback={<ReaderSkeleton label="carregando motor de leitura..." />}>
              {fileFormat === 'pdf' && (
                <PdfView
                  ref={engineRef}
                  fileBlob={fileBlob}
                  settings={settings}
                  activeTheme={activeTheme}
                  initialPage={position.page || 1}
                  onReady={() => setIsEngineReady(true)}
                  onPositionChange={updatePosition}
                  onTocReady={setTocItems}
                  onError={setErrorMsg}
                  onUpdateSettings={updateSettings}
                  onCenterTap={handleToggleBars}
                  onCenterDoubleTap={handleToggleBookmark}
                  onLongPressSettings={() => setSettingsOpen(true)}
                />
              )}
              {fileFormat === 'epub' && (
                <EpubView
                  ref={engineRef}
                  fileBlob={fileBlob}
                  storageKey={work?.id || quickStorageKey}
                  settings={settings}
                  activeTheme={activeTheme}
                  initialCfi={position.cfi || ''}
                  workTotalPages={Number(work?.totalPages) || 0}
                  highlights={highlights}
                  onReady={() => setIsEngineReady(true)}
                  onPositionChange={updatePosition}
                  onTocReady={setTocItems}
                  onTextSelect={setSelectionState}
                  onError={setErrorMsg}
                  onCenterTap={handleToggleBars}
                  onCenterDoubleTap={handleToggleBookmark}
                  onLongPressSettings={() => setSettingsOpen(true)}
                />
              )}
              {fileFormat === 'cbz' && (
                <ComicView
                  ref={engineRef}
                  fileBlob={fileBlob}
                  settings={settings}
                  activeTheme={activeTheme}
                  initialPage={position.page || 1}
                  onReady={() => setIsEngineReady(true)}
                  onPositionChange={updatePosition}
                  onTocReady={setTocItems}
                  onError={setErrorMsg}
                  onCenterTap={handleToggleBars}
                  onCenterDoubleTap={handleToggleBookmark}
                  onLongPressSettings={() => setSettingsOpen(true)}
                />
              )}
              {(fileFormat === 'txt' || fileFormat === 'markdown') && (
                <TextView
                  ref={engineRef}
                  fileBlob={fileBlob}
                  format={fileFormat}
                  settings={settings}
                  activeTheme={activeTheme}
                  initialPage={position.page || 1}
                  initialScrollRatio={position.scrollRatio || 0}
                  workTotalPages={Number(work?.totalPages) || 0}
                  highlights={highlights}
                  onReady={() => setIsEngineReady(true)}
                  onPositionChange={updatePosition}
                  onTocReady={setTocItems}
                  onTextSelect={setSelectionState}
                  onError={setErrorMsg}
                  onCenterTap={handleToggleBars}
                  onCenterDoubleTap={handleToggleBookmark}
                  onLongPressSettings={() => setSettingsOpen(true)}
                />
              )}
            </Suspense>

            {/* Régua de Foco opcional (escurece suavemente o resto sem bordas) */}
            {settings.focusRuler && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-20 flex flex-col"
              >
                <div
                  className="transition-[height] duration-150 ease-out"
                  style={{
                    height: `calc(${rulerY}% - 44px)`,
                    backgroundColor: domColors.isLight
                      ? 'rgba(0, 0, 0, 0.12)'
                      : 'rgba(0, 0, 0, 0.44)',
                  }}
                />
                <div
                  className="h-[88px] shrink-0"
                  style={{
                    backgroundColor:
                      'color-mix(in srgb, var(--reader-ink) 6%, transparent)',
                  }}
                />
                <div
                  className="flex-1 transition-[height] duration-150 ease-out"
                  style={{
                    backgroundColor: domColors.isLight
                      ? 'rgba(0, 0, 0, 0.12)'
                      : 'rgba(0, 0, 0, 0.44)',
                  }}
                />
              </div>
            )}

            {/* Brilho / Conforto Ocular (50% a 100%) */}
            {brightnessScrimOpacity > 0 && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-20 transition-opacity duration-150 ease-out"
                style={{
                  backgroundColor: '#000000',
                  opacity: brightnessScrimOpacity,
                }}
              />
            )}
          </>
        )}
      </main>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.epub,.cbz,.txt,.md,.markdown"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) {
            loadSelectedFile(file, { persistCopy: true });
          }
        }}
        className="hidden"
      />

      <AnnotationPopover
        selection={selectionState}
        onApplyHighlight={handleApplyHighlight}
        onSaveToVault={handleSaveToVault}
        onPublishQuote={handlePublishHighlight}
        onCopy={handleCopySelection}
        onClose={() => setSelectionState(null)}
      />

      <TocDrawer
        isOpen={tocOpen}
        initialTab={tocInitialTab}
        fontId={settings.fontId}
        onClose={() => setTocOpen(false)}
        toc={tocItems}
        activeChapterHref={position.href || ''}
        bookmarks={bookmarks}
        highlights={highlights}
        onSelectChapter={(node) => engineRef.current?.goToChapter?.(node)}
        onSelectBookmark={(bm) => {
          if (bm.cfi) engineRef.current?.goToCfi?.(bm.cfi);
          else if (bm.page) engineRef.current?.goToPage?.(bm.page);
        }}
        onRemoveBookmark={removeBookmark}
        onSelectHighlight={handleJumpToHighlight}
        onUpdateHighlight={handleUpdateHighlightNote}
        onPublishHighlight={handlePublishHighlight}
        onRemoveHighlight={removeHighlight}
        onSearchText={(q) => engineRef.current?.searchText?.(q)}
        onSelectSearchMatch={(match) => {
          if (match.cfi) engineRef.current?.goToCfi?.(match.cfi);
          else if (match.page) engineRef.current?.goToPage?.(match.page);
        }}
      />

      <ReaderSettings
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        format={fileFormat || 'epub'}
        settings={settings}
        onUpdateSettings={updateSettings}
      />

      {/* Painel de Ajuda de Atalhos "?" */}
      {helpOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)' }}
          onClick={() => setHelpOpen(false)}
        >
          <div
            role="dialog"
            aria-label="Atalhos de teclado do leitor"
            className="w-full max-w-sm rounded-[6px] border p-5"
            style={{
              backgroundColor: 'var(--reader-bg)',
              borderColor: 'var(--reader-border)',
              color: 'var(--reader-ink)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between border-b pb-3"
              style={{ borderColor: 'var(--reader-border)' }}
            >
              <h2 className="text-sm font-semibold">atalhos de teclado</h2>
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                aria-label="Fechar ajuda"
                className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-[4px]"
                style={{ color: 'var(--reader-muted)' }}
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
            <div
              className="mt-2 divide-y"
              style={{ borderColor: 'var(--reader-border)' }}
            >
              {KEYBOARD_SHORTCUTS.map((sc) => (
                <div
                  key={sc.keys}
                  className="flex items-center justify-between gap-3 py-2 text-xs"
                  style={{ borderColor: 'var(--reader-border)' }}
                >
                  <span style={{ color: 'var(--reader-muted)' }}>{sc.desc}</span>
                  <kbd
                    className="shrink-0 rounded-[4px] border px-2 py-0.5 font-mono text-[10px]"
                    style={{
                      backgroundColor: 'var(--reader-surface)',
                      borderColor: 'var(--reader-border)',
                      color: 'var(--reader-ink)',
                    }}
                  >
                    {sc.keys}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
