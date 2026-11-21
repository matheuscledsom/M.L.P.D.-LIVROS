import {
  ArrowUpDown,
  BookOpen,
  CheckSquare,
  FilePlus2,
  Link2,
  Search,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import {
  computeTotalStoredBytes,
  importBatchReaderFiles,
  linkStoredReaderBookToWork,
  listStoredReaderBooks,
  removeStoredReaderBook,
  sortStoredReaderBooks,
} from '../../services/readerStorage';
import { CoverArt } from '../CoverArt';

const FORMAT_FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'epub', label: 'EPUB' },
  { id: 'pdf', label: 'PDF' },
  { id: 'cbz', label: 'CBZ' },
  { id: 'text', label: 'TXT/MD' },
];

const SORT_OPTIONS = [
  { id: 'recent', label: 'Última leitura' },
  { id: 'progress', label: 'Maior progresso %' },
  { id: 'title', label: 'Nome A–Z' },
];

function formatLastOpened(iso) {
  if (!iso) return 'Recente';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Recente';
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  });
}

function formatTotalMb(totalBytes = 0) {
  const mb = Math.max(0, Number(totalBytes) || 0) / (1024 * 1024);
  return `${mb.toFixed(mb > 0 && mb < 0.1 ? 2 : 1)} MB`;
}

function matchesFormatFilter(entryFormat, filterId) {
  if (filterId === 'all') return true;
  if (filterId === 'text') {
    return entryFormat === 'txt' || entryFormat === 'markdown';
  }
  return entryFormat === filterId;
}

export function DigitalShelfModal({
  isOpen,
  onClose,
  works = [],
  onOpenStoredBook,
  onSyncLinkedWork,
  onRemoveStoredBook,
  onShelfMutated,
}) {
  const { showToast } = useToast();
  const fileInputRef = useRef(null);

  const [entries, setEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [linkingBookId, setLinkingBookId] = useState(null);
  const [linkWorkQuery, setLinkWorkQuery] = useState('');
  const [confirmRemoveId, setConfirmRemoveId] = useState(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedBookIds, setSelectedBookIds] = useState([]);
  const pendingBatchTimersRef = useRef([]);

  const refreshShelf = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await listStoredReaderBooks(works);
      setEntries(list);
    } catch {
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  }, [works]);

  useEffect(() => {
    if (!isOpen) {
      setLinkingBookId(null);
      setConfirmRemoveId(null);
      setSelectionMode(false);
      setSelectedBookIds([]);
      setSearchQuery('');
      setLinkWorkQuery('');
      return;
    }
    refreshShelf();
  }, [isOpen, refreshShelf]);

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return undefined;
    const handleStorageEvent = () => {
      refreshShelf();
    };
    window.addEventListener('codice:reader-storage-changed', handleStorageEvent);
    return () =>
      window.removeEventListener(
        'codice:reader-storage-changed',
        handleStorageEvent
      );
  }, [isOpen, refreshShelf]);

  const countsByFilter = useMemo(() => {
    const counts = { epub: 0, pdf: 0, cbz: 0, text: 0, all: entries.length };
    for (const item of entries) {
      if (item.format === 'epub') counts.epub += 1;
      else if (item.format === 'pdf') counts.pdf += 1;
      else if (item.format === 'cbz') counts.cbz += 1;
      else if (item.format === 'txt' || item.format === 'markdown') counts.text += 1;
    }
    return counts;
  }, [entries]);

  const totalStorageBytes = useMemo(
    () => computeTotalStoredBytes(entries),
    [entries]
  );

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = entries.filter((entry) => {
      if (!matchesFormatFilter(entry.format, activeFilter)) return false;
      if (!q) return true;
      return (
        entry.title.toLowerCase().includes(q) ||
        entry.fileName.toLowerCase().includes(q) ||
        entry.author.toLowerCase().includes(q) ||
        entry.format.toLowerCase().includes(q)
      );
    });
    return sortStoredReaderBooks(filtered, sortBy);
  }, [entries, activeFilter, searchQuery, sortBy]);

  const linkableWorks = useMemo(() => {
    const q = linkWorkQuery.trim().toLowerCase();
    return works
      .filter((w) => {
        if (!q) return true;
        return (
          String(w.title || '').toLowerCase().includes(q) ||
          String(w.author || '').toLowerCase().includes(q)
        );
      })
      .slice(0, 12);
  }, [works, linkWorkQuery]);

  if (!isOpen) return null;

  const handleBatchUpload = async (e) => {
    const files = e.target.files;
    e.target.value = '';
    if (!files || files.length === 0) return;

    setIsImporting(true);
    try {
      const { imported, skipped } = await importBatchReaderFiles(files);
      await refreshShelf();
      onShelfMutated?.();

      if (imported.length > 0) {
        showToast({
          message:
            imported.length === 1
              ? `1 arquivo salvo na estante offline.`
              : `${imported.length} arquivos salvos na estante offline.`,
          type: 'success',
        });
      }
      if (skipped.length > 0) {
        showToast({
          message: `${skipped.length} arquivo(s) ignorado(s): ${skipped[0].reason}`,
          type: 'info',
        });
      }
    } catch {
      showToast({
        message: 'Não foi possível importar os arquivos selecionados.',
        type: 'error',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleRemoveEntry = async (bookId) => {
    if (onRemoveStoredBook) {
      await onRemoveStoredBook(bookId);
    } else {
      await removeStoredReaderBook(bookId, { works });
      showToast({ message: 'Arquivo removido do armazenamento local.', type: 'info' });
    }
    setConfirmRemoveId(null);
    await refreshShelf();
    onShelfMutated?.();
  };

  const toggleSelectBook = (bookId) => {
    setSelectedBookIds((prev) =>
      prev.includes(bookId) ? prev.filter((id) => id !== bookId) : [...prev, bookId]
    );
  };

  const handleBatchDeleteBooks = () => {
    if (selectedBookIds.length === 0) return;
    const idsToDelete = [...selectedBookIds];
    const idSet = new Set(idsToDelete);
    const prevSnapshot = [...entries];

    setEntries((prev) => prev.filter((e) => !idSet.has(e.bookId)));
    setSelectedBookIds([]);
    setSelectionMode(false);

    const timer = setTimeout(async () => {
      for (const id of idsToDelete) {
        if (onRemoveStoredBook) {
          await onRemoveStoredBook(id);
        } else {
          await removeStoredReaderBook(id, { works });
        }
      }
      onShelfMutated?.();
    }, 8000);
    pendingBatchTimersRef.current.push(timer);

    showToast({
      message: `${idsToDelete.length} ${idsToDelete.length === 1 ? 'arquivo removido' : 'arquivos removidos'}`,
      type: 'info',
      duration: 8000,
      action: {
        label: 'Desfazer',
        onClick: () => {
          clearTimeout(timer);
          setEntries(prevSnapshot);
        },
      },
    });
  };

  const handleConfirmLinkWork = async (entry, targetWork) => {
    try {
      const res = await linkStoredReaderBookToWork(entry.bookId, targetWork.id);
      setLinkingBookId(null);
      setLinkWorkQuery('');
      await refreshShelf();
      onShelfMutated?.();
      onSyncLinkedWork?.(targetWork, res.extractedPosition);
      showToast({
        message: `Arquivo vinculado a "${targetWork.title}".`,
        type: 'success',
      });
    } catch (err) {
      showToast({
        message: err?.message || 'Erro ao vincular arquivo à obra.',
        type: 'error',
      });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Estante Digital Offline"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-t-[6px] sm:rounded-[6px] border border-line bg-card text-ink"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 sm:px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight text-ink">
              Biblioteca Digital Offline
            </h2>
            <p
              className="mt-0.5 text-xs tabular-nums"
              style={{ color: 'var(--text-secondary)' }}
            >
              {entries.length}{' '}
              {entries.length === 1 ? 'arquivo' : 'arquivos'} ·{' '}
              {formatTotalMb(totalStorageBytes)} ocupados no navegador
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {entries.length > 0 && (
              <button
                type="button"
                aria-pressed={selectionMode}
                onClick={() => {
                  setSelectionMode((prev) => !prev);
                  setSelectedBookIds([]);
                }}
                className={`inline-flex min-h-[44px] items-center gap-1 rounded-[4px] border px-2.5 py-2 text-xs font-medium transition-colors ${
                  selectionMode
                    ? 'border-accent bg-accent/15 text-accent'
                    : 'border-line bg-app text-muted hover:text-ink'
                }`}
              >
                <CheckSquare className="h-3.5 w-3.5" strokeWidth={1.5} />
                <span className="hidden sm:inline">Selecionar</span>
              </button>
            )}

            <button
              type="button"
              disabled={isImporting}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[4px] border border-accent bg-accent/15 px-3 py-2 text-xs font-semibold text-accent transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <FilePlus2 className="h-4 w-4" strokeWidth={1.5} />
              <span>{isImporting ? 'Importando...' : 'Adicionar arquivos'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar estante offline"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[4px] border border-line text-muted hover:text-ink"
            >
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        <div className="space-y-2.5 border-b border-line px-4 sm:px-5 py-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {FORMAT_FILTERS.map((tab) => {
              const active = activeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveFilter(tab.id)}
                  className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-[4px] border px-2.5 py-1 text-xs font-medium transition-colors ${
                    active
                      ? 'border-accent bg-accent/15 text-accent'
                      : 'border-line bg-app hover:text-ink'
                  }`}
                  style={!active ? { color: 'var(--text-secondary)' } : undefined}
                >
                  <span>{tab.label}</span>
                  <span className="text-[11px] tabular-nums opacity-80">
                    {countsByFilter[tab.id] || 0}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <label className="relative flex-1 block">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                strokeWidth={1.5}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nome do arquivo ou título..."
                aria-label="Buscar na biblioteca digital"
                className="min-h-[44px] w-full rounded-[4px] border border-line bg-app py-2 pl-9 pr-9 text-xs text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Limpar busca da biblioteca digital"
                  className="absolute right-1 top-1/2 flex min-h-[36px] min-w-[36px] -translate-y-1/2 items-center justify-center rounded-[4px] text-subtle hover:text-ink"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              )}
            </label>

            <label className="relative flex shrink-0 items-center">
              <ArrowUpDown
                className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted"
                strokeWidth={1.5}
              />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                aria-label="Ordenar biblioteca digital"
                className="min-h-[44px] w-full sm:w-auto rounded-[4px] border border-line bg-app pl-8 pr-3 py-2 text-xs font-medium text-ink focus:border-accent focus:outline-none"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-2.5 no-scrollbar">
          {isLoading ? (
            <div className="space-y-2.5" aria-busy="true">
              {[1, 2, 3].map((k) => (
                <div
                  key={k}
                  className="h-20 rounded-[4px] border border-line bg-app opacity-50"
                />
              ))}
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="rounded-[6px] border border-line bg-app px-5 py-10 text-center space-y-3">
              <BookOpen
                className="mx-auto h-6 w-6 text-muted"
                strokeWidth={1.5}
              />
              <div>
                <p className="text-sm font-medium text-ink">
                  {entries.length === 0
                    ? 'Nenhum arquivo salvo localmente ainda'
                    : 'Nenhum arquivo encontrado neste filtro'}
                </p>
                <p className="mt-1 text-xs text-muted">
                  Adicione PDFs, EPUBs, CBZs ou TXT/Markdown para lê-los offline e acompanhar o espaço usado no navegador.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[4px] border border-accent px-3.5 py-2 text-xs font-medium text-accent"
                >
                  <FilePlus2 className="h-4 w-4" strokeWidth={1.5} />
                  <span>Adicionar arquivos</span>
                </button>
                {activeFilter !== 'all' && entries.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveFilter('all')}
                    className="inline-flex min-h-[44px] items-center rounded-[4px] border border-line px-3.5 py-2 text-xs text-muted hover:text-ink"
                  >
                    Ver todos ({entries.length})
                  </button>
                )}
              </div>
            </div>
          ) : (
            filteredEntries.map((entry) => {
              const isLinking = linkingBookId === entry.bookId;
              const isConfirmingRemove = confirmRemoveId === entry.bookId;
              const isSelected = selectedBookIds.includes(entry.bookId);
              return (
                <div
                  key={entry.bookId}
                  className={`rounded-[6px] border bg-app p-3 transition-colors ${
                    isSelected ? 'border-accent bg-accent/10' : 'border-line'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {selectionMode && (
                      <button
                        type="button"
                        aria-pressed={isSelected}
                        aria-label={`Selecionar ${entry.title}`}
                        onClick={() => toggleSelectBook(entry.bookId)}
                        className="flex min-h-[44px] min-w-[36px] shrink-0 items-center justify-center text-accent"
                      >
                        {isSelected ? (
                          <CheckSquare className="h-4 w-4" strokeWidth={1.5} />
                        ) : (
                          <Square className="h-4 w-4 text-muted" strokeWidth={1.5} />
                        )}
                      </button>
                    )}
                    {entry.linkedWork ? (
                      <CoverArt
                        item={entry.linkedWork}
                        compact
                        className="h-16 w-11 shrink-0 rounded-[4px]"
                      />
                    ) : (
                      <div className="flex h-16 w-11 shrink-0 flex-col items-center justify-center rounded-[4px] border border-line bg-card text-[10px] font-semibold uppercase tracking-wider text-muted">
                        {entry.format}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="truncate text-xs sm:text-sm font-semibold text-ink">
                            {entry.title}
                          </h3>
                          <p className="truncate text-[11px] text-muted">
                            {entry.author || entry.fileName}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-[4px] border px-2 py-0.5 text-[10px] font-medium ${
                            entry.isLinked
                              ? 'border-accent/40 text-accent'
                              : 'border-line text-muted'
                          }`}
                        >
                          {entry.isLinked ? 'Catalogado' : 'Local'}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] tabular-nums text-muted">
                        <span className="uppercase">{entry.format}</span>
                        <span>{entry.sizeLabel}</span>
                        <span>Última leitura: {formatLastOpened(entry.lastOpenedAt)}</span>
                        <span className="font-semibold text-accent">
                          {entry.progressPct}%
                        </span>
                      </div>

                      <div className="mt-2 h-[2px] w-full overflow-hidden rounded-[2px] bg-line">
                        <div
                          className="h-full bg-accent transition-all duration-150"
                          style={{ width: `${Math.min(100, entry.progressPct)}%` }}
                        />
                      </div>

                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onClose?.();
                            onOpenStoredBook?.(entry);
                          }}
                          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[4px] border border-accent bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink transition-opacity hover:opacity-90"
                        >
                          <BookOpen className="h-3.5 w-3.5" strokeWidth={1.5} />
                          <span>Abrir</span>
                        </button>

                        {!entry.isLinked && (
                          <button
                            type="button"
                            onClick={() => {
                              setLinkingBookId(isLinking ? null : entry.bookId);
                              setLinkWorkQuery('');
                            }}
                            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[4px] border border-line bg-card px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:border-accent hover:text-ink"
                          >
                            <Link2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                            <span>Vincular a obra</span>
                          </button>
                        )}

                        {isConfirmingRemove ? (
                          <div className="ml-auto flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleRemoveEntry(entry.bookId)}
                              className="min-h-[44px] rounded-[4px] border border-rose-500/50 bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-400"
                            >
                              Confirmar exclusão
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmRemoveId(null)}
                              className="min-h-[44px] rounded-[4px] border border-line px-2.5 py-1.5 text-xs text-muted hover:text-ink"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmRemoveId(entry.bookId)}
                            aria-label={`Excluir arquivo ${entry.title}`}
                            className="ml-auto inline-flex min-h-[44px] items-center gap-1.5 rounded-[4px] border border-line bg-card px-2.5 py-1.5 text-xs font-medium transition-colors hover:border-rose-500/40 hover:text-rose-400"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                            <span>Excluir arquivo</span>
                          </button>
                        )}
                      </div>

                      {isLinking && (
                        <div className="mt-2.5 space-y-2 rounded-[4px] border border-line bg-card p-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-medium text-ink">
                              Selecione a obra para vincular este arquivo:
                            </span>
                            <button
                              type="button"
                              onClick={() => setLinkingBookId(null)}
                              className="min-h-[36px] px-2 text-[11px] text-muted hover:text-ink"
                            >
                              Fechar
                            </button>
                          </div>
                          <input
                            type="text"
                            value={linkWorkQuery}
                            onChange={(e) => setLinkWorkQuery(e.target.value)}
                            placeholder="Filtrar obras da biblioteca..."
                            className="min-h-[44px] w-full rounded-[4px] border border-line bg-app px-2.5 py-1.5 text-xs text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
                          />
                          {linkableWorks.length === 0 ? (
                            <p className="text-[11px] text-muted">
                              Nenhuma obra correspondente no catálogo.
                            </p>
                          ) : (
                            <div className="max-h-36 space-y-1 overflow-y-auto no-scrollbar">
                              {linkableWorks.map((w) => (
                                <button
                                  key={w.id}
                                  type="button"
                                  onClick={() => handleConfirmLinkWork(entry, w)}
                                  className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-[4px] border border-line bg-app px-2.5 py-1.5 text-left text-xs transition-colors hover:border-accent"
                                >
                                  <span className="truncate font-medium text-ink">
                                    {w.title}
                                  </span>
                                  <span className="shrink-0 text-[11px] text-muted">
                                    {w.author || 'Vincular'}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {selectedBookIds.length > 0 && (
          <div className="flex items-center justify-between gap-2 border-t border-line bg-app px-4 py-2.5">
            <span className="text-xs font-medium tabular-nums text-ink">
              {selectedBookIds.length}{' '}
              {selectedBookIds.length === 1 ? 'selecionado' : 'selecionados'}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedBookIds([])}
                className="min-h-[40px] rounded-[4px] border border-line px-2.5 text-xs text-muted hover:text-ink"
              >
                Limpar
              </button>
              <button
                type="button"
                onClick={handleBatchDeleteBooks}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[4px] border border-rose-500/40 bg-rose-500/15 px-3 text-xs font-semibold text-rose-400"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                <span>Remover lote</span>
              </button>
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".epub,.pdf,.cbz,.txt,.md,.markdown"
          onChange={handleBatchUpload}
          className="hidden"
        />
      </div>
    </div>
  );
}
