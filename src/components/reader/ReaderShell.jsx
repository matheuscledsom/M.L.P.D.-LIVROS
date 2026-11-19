import {
  AlertCircle,
  BookOpen,
  FileUp,
  FolderOpen,
  Keyboard,
  RefreshCw,
  Upload,
  X,
} from 'lucide-react';
import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useToast } from '../../context/ToastContext';
import {
  getBookFileRecord,
  pickFileViaSystemAccess,
  resolveStoredFileBlob,
  saveBookFile,
  supportsFileSystemAccessApi,
} from '../../services/readerStorage';
import { detectBookFileFormat } from '../../utils/fileFormatDetector';
import { AnnotationPopover } from './AnnotationPopover';
import { ReaderSettings } from './ReaderSettings';
import { ReaderToolbar } from './ReaderToolbar';
import { TocDrawer } from './TocDrawer';
import { useReaderProgress } from './useReaderProgress';

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
  { keys: '← / → ou PageUp / PageDown', desc: 'Página anterior / próxima' },
  { keys: 'Espaço', desc: 'Avançar página' },
  { keys: 'F', desc: 'Alternar tela cheia' },
  { keys: 'T', desc: 'Abrir índice e anotações' },
  { keys: '/', desc: 'Buscar no texto' },
  { keys: '+ / -', desc: 'Aumentar / diminuir fonte ou zoom' },
  { keys: '?', desc: 'Exibir atalhos de teclado' },
  { keys: 'Esc', desc: 'Fechar painéis ou leitor' },
];

function ReaderSkeleton({ label = 'Carregando leitura...' }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-6">
      <div className="w-full max-w-xl space-y-3" aria-hidden="true">
        <div className="h-5 w-2/3 animate-pulse rounded-lg bg-elevated" />
        <div className="h-4 w-full animate-pulse rounded-lg bg-elevated/80" />
        <div className="h-4 w-11/12 animate-pulse rounded-lg bg-elevated/70" />
        <div className="h-4 w-4/5 animate-pulse rounded-lg bg-elevated/60" />
        <div className="h-40 w-full animate-pulse rounded-2xl bg-elevated/50 mt-4" />
      </div>
      <p className="text-xs font-medium text-muted">{label}</p>
    </div>
  );
}

export function ReaderShell({
  isOpen,
  work = null,
  initialFile = null,
  onClose,
  onPersistReaderState,
  onRecordSession,
  onSyncWorkProgress,
  onSaveQuoteFromReader,
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

  const {
    settings,
    activeTheme,
    bookmarks,
    highlights,
    position,
    estimatedMinutesRemaining,
    updateSettings,
    updatePosition,
    toggleBookmark,
    removeBookmark,
    addHighlight,
    removeHighlight,
    buildSessionSummary,
  } = useReaderProgress({
    work,
    isOpen,
    onPersistReaderState,
  });

  const scheduleAutoHide = useCallback(() => {
    clearTimeout(hideTimerRef.current);
    if (tocOpen || settingsOpen || helpOpen || !fileBlob || errorMsg) {
      return;
    }
    hideTimerRef.current = setTimeout(() => {
      setBarsVisible(false);
    }, 3000);
  }, [tocOpen, settingsOpen, helpOpen, fileBlob, errorMsg]);

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

        if (work?.id) {
          await saveBookFile(work.id, {
            blob: persistCopy ? file : null,
            fileHandle: persistCopy ? null : fileHandle,
            fileName: file.name,
            format: detection.format,
            size: file.size,
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
    [work?.id]
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
        await loadSelectedFile(initialFile, { persistCopy: Boolean(work?.id) });
        return;
      }

      if (!work?.id) return;
      setIsLoadingFile(true);
      setErrorMsg('');
      try {
        const record = await getBookFileRecord(work.id);
        if (cancelled) return;
        if (record) {
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
            setFileName(record.fileName || work.title);
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
  }, [isOpen, work?.id, initialFile, loadSelectedFile]);

  const handleCloseReader = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
    const summary = buildSessionSummary();
    if (work?.id) {
      onPersistReaderState?.(work.id, summary.latestState);
      if (summary.durationSeconds >= 5 || summary.pagesRead > 0) {
        onRecordSession?.(summary);
      }
      if (fileBlob) {
        onSyncWorkProgress?.(work, summary.endPosition);
      }
    }
    onClose?.();
  }, [
    buildSessionSummary,
    work,
    fileBlob,
    onPersistReaderState,
    onRecordSession,
    onSyncWorkProgress,
    onClose,
  ]);

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
    handleToggleFullscreen,
    handleCloseReader,
  ]);

  if (!isOpen) return null;

  const isBookmarkedHere = bookmarks.some(
    (b) =>
      (position.cfi && b.cfi === position.cfi) ||
      (!position.cfi && position.page && b.page === position.page)
  );

  const positionLabel =
    position.totalPages > 0
      ? `Pág. ${position.page || 1} de ${position.totalPages}`
      : position.chapterLabel || `${position.progressPct || 0}%`;

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
      await loadSelectedFile(dropped, { persistCopy: Boolean(work?.id) });
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

  const handleHighlightSelection = (payload) => {
    addHighlight({
      text: payload.text,
      note: payload.note || '',
      color: payload.color || 'accent',
      cfi: payload.cfi || '',
      page: position.page || null,
      location:
        payload.location ||
        position.chapterLabel ||
        (position.page ? `Pág. ${position.page}` : ''),
    });
    showToast({ message: 'Destaque salvo na obra', type: 'success' });
  };

  const handleQuoteSelection = (payload) => {
    const loc =
      payload.location ||
      position.chapterLabel ||
      (position.page ? `Pág. ${position.page}` : '');
    addHighlight({
      text: payload.text,
      note: '',
      color: payload.color || 'accent',
      cfi: payload.cfi || '',
      page: position.page || null,
      location: loc,
    });
    onSaveQuoteFromReader?.(work, {
      text: payload.text,
      location: loc,
      cfi: payload.cfi || '',
      color: payload.color || 'accent',
    });
    showToast({ message: 'Citação salva no cofre da obra', type: 'success' });
  };

  return (
    <div
      ref={rootRef}
      onMouseMove={revealBars}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingOver(true);
      }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={handleDropFile}
      className="fixed inset-0 z-50 flex flex-col bg-app text-ink overflow-hidden"
    >
      <ReaderToolbar
        title={work?.title || fileName || 'Leitor Códice'}
        formatLabel={fileFormat}
        visible={barsVisible || !fileBlob || Boolean(errorMsg)}
        progressPct={position.progressPct}
        positionLabel={positionLabel}
        chapterLabel={position.chapterLabel}
        estimatedMinutesRemaining={estimatedMinutesRemaining}
        chapters={tocItems}
        isBookmarked={isBookmarkedHere}
        isFullscreen={isFullscreen}
        onBack={handleCloseReader}
        onToggleToc={() => {
          setTocInitialTab('toc');
          setTocOpen(true);
        }}
        onOpenSearch={() => {
          setTocInitialTab('search');
          setTocOpen(true);
        }}
        onToggleSettings={() => setSettingsOpen(true)}
        onToggleBookmark={() =>
          toggleBookmark({
            label:
              position.chapterLabel ||
              (position.page ? `Página ${position.page}` : 'Marcador'),
            page: position.page || 1,
            cfi: position.cfi || '',
            progressPct: position.progressPct || 0,
          })
        }
        onToggleFullscreen={handleToggleFullscreen}
        onToggleHelp={() => setHelpOpen(true)}
        onScrubPercent={(pct) => engineRef.current?.goToPercent?.(pct)}
      />

      {/* Área central de leitura / seleção / erro */}
      <main className="relative flex-1 overflow-hidden">
        {isDraggingOver && (
          <div className="pointer-events-none absolute inset-4 z-50 flex flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-accent bg-app/90 backdrop-blur-xs">
            <FileUp className="h-10 w-10 text-accent" strokeWidth={1.5} />
            <p className="text-sm font-semibold text-ink">
              Solte o arquivo para abrir no Leitor Códice
            </p>
            <p className="text-xs text-muted">PDF, EPUB, CBZ, TXT ou Markdown</p>
          </div>
        )}

        {isLoadingFile ? (
          <ReaderSkeleton label="Detectando formato e preparando leitura..." />
        ) : errorMsg ? (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center">
            <div className="max-w-sm space-y-4 rounded-3xl border border-rose-500/30 bg-card p-6">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-400">
                <AlertCircle className="h-6 w-6" strokeWidth={1.5} />
              </div>
              <h2 className="text-sm font-semibold text-ink">
                Não foi possível abrir o arquivo
              </h2>
              <p className="text-xs leading-relaxed text-muted">{errorMsg}</p>
              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-ink"
                >
                  <RefreshCw className="h-4 w-4" strokeWidth={1.5} />
                  Escolher outro arquivo
                </button>
                <button
                  type="button"
                  onClick={handleCloseReader}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-line bg-app px-4 py-2 text-xs font-medium text-muted hover:text-ink"
                >
                  Voltar
                </button>
              </div>
            </div>
          </div>
        ) : !fileBlob ? (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center">
            <div className="w-full max-w-md space-y-4 rounded-3xl border border-dashed border-line bg-card p-7">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-accent/30 bg-accent/10 text-accent">
                <BookOpen className="h-6 w-6" strokeWidth={1.5} />
              </div>
              <div>
                <h2 className="text-base font-semibold text-ink">
                  Abrir Arquivo no Leitor Códice
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  Arraste e solte um arquivo aqui ou selecione do dispositivo.
                  Suporta <strong>PDF, EPUB, CBZ, TXT e Markdown</strong>, salvos
                  localmente em IndexedDB para reabertura offline.
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3 text-xs font-semibold text-accent-ink hover:opacity-90"
                >
                  <Upload className="h-4 w-4" strokeWidth={1.5} />
                  Abrir e Salvar Offline (IndexedDB)
                </button>

                {supportsFileSystemAccessApi() && work?.id && (
                  <button
                    type="button"
                    onClick={handleLinkSystemFile}
                    className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border border-line bg-app px-4 py-2.5 text-xs font-medium text-ink hover:border-accent"
                  >
                    <FolderOpen className="h-4 w-4 text-accent" strokeWidth={1.5} />
                    Vincular sem copiar (File System)
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            {!isEngineReady && (
              <div className="absolute inset-0 z-30 bg-app">
                <ReaderSkeleton label="Renderizando páginas..." />
              </div>
            )}
            <Suspense fallback={<ReaderSkeleton label="Carregando motor de leitura..." />}>
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
                  onCenterTap={() => {
                    setBarsVisible((prev) => {
                      const next = !prev;
                      if (next) scheduleAutoHide();
                      return next;
                    });
                  }}
                />
              )}
              {fileFormat === 'epub' && (
                <EpubView
                  ref={engineRef}
                  fileBlob={fileBlob}
                  settings={settings}
                  activeTheme={activeTheme}
                  initialCfi={position.cfi || ''}
                  highlights={highlights}
                  onReady={() => setIsEngineReady(true)}
                  onPositionChange={updatePosition}
                  onTocReady={setTocItems}
                  onTextSelect={setSelectionState}
                  onError={setErrorMsg}
                  onCenterTap={() => {
                    setBarsVisible((prev) => {
                      const next = !prev;
                      if (next) scheduleAutoHide();
                      return next;
                    });
                  }}
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
                  onCenterTap={() => {
                    setBarsVisible((prev) => {
                      const next = !prev;
                      if (next) scheduleAutoHide();
                      return next;
                    });
                  }}
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
                  onReady={() => setIsEngineReady(true)}
                  onPositionChange={updatePosition}
                  onTocReady={setTocItems}
                  onTextSelect={setSelectionState}
                  onError={setErrorMsg}
                  onCenterTap={() => {
                    setBarsVisible((prev) => {
                      const next = !prev;
                      if (next) scheduleAutoHide();
                      return next;
                    });
                  }}
                />
              )}
            </Suspense>
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
            loadSelectedFile(file, { persistCopy: Boolean(work?.id) });
          }
        }}
        className="hidden"
      />

      <AnnotationPopover
        selection={selectionState}
        onHighlight={handleHighlightSelection}
        onQuote={handleQuoteSelection}
        onCopy={handleCopySelection}
        onClose={() => setSelectionState(null)}
      />

      <TocDrawer
        isOpen={tocOpen}
        initialTab={tocInitialTab}
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
        onSelectHighlight={(hl) => {
          if (hl.cfi) engineRef.current?.goToCfi?.(hl.cfi);
          else if (hl.page) engineRef.current?.goToPage?.(hl.page);
        }}
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
          onClick={() => setHelpOpen(false)}
        >
          <div
            role="dialog"
            aria-label="Atalhos de teclado do leitor"
            className="w-full max-w-sm rounded-3xl border border-line bg-card p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div className="flex items-center gap-2">
                <Keyboard className="h-4 w-4 text-accent" strokeWidth={1.5} />
                <h2 className="text-sm font-semibold text-ink">
                  Atalhos de Teclado
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                aria-label="Fechar ajuda"
                className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-full text-muted hover:text-ink"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {KEYBOARD_SHORTCUTS.map((sc) => (
                <div
                  key={sc.keys}
                  className="flex items-center justify-between gap-3 text-xs"
                >
                  <span className="text-muted">{sc.desc}</span>
                  <kbd className="shrink-0 rounded-lg border border-line bg-app px-2 py-1 font-mono text-[10px] font-semibold text-accent">
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
