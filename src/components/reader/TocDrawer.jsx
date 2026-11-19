import {
  Bookmark,
  ChevronRight,
  Highlighter,
  ListTree,
  Pencil,
  Search,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  HIGHLIGHT_COLORS,
  getHighlightColorMeta,
  normalizeHighlightColorId,
} from '../../utils/readerThemes';
import { FONT_PRESETS } from '../../utils/themeTokens';

const TABS = [
  { id: 'toc', label: 'Sumário', icon: ListTree },
  { id: 'bookmarks', label: 'Marcadores', icon: Bookmark },
  { id: 'highlights', label: 'Destaques', icon: Highlighter },
  { id: 'search', label: 'Busca', icon: Search },
];

function formatShortDate(iso) {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
    }).format(new Date(iso));
  } catch {
    return '';
  }
}

export function TocDrawer({
  isOpen,
  initialTab = 'toc',
  fontId = 'lora',
  onClose,
  toc = [],
  activeChapterHref = '',
  bookmarks = [],
  highlights = [],
  onSelectChapter,
  onSelectBookmark,
  onRemoveBookmark,
  onSelectHighlight,
  onUpdateHighlight,
  onPublishHighlight,
  onRemoveHighlight,
  onSearchText,
  onSelectSearchMatch,
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [colorFilter, setColorFilter] = useState('all');
  const [editingId, setEditingId] = useState(null);
  const [editingNote, setEditingNote] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
    if (!isOpen) {
      setEditingId(null);
      setEditingNote('');
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const readerFontPreset =
    FONT_PRESETS.find((f) => f.id === fontId) || FONT_PRESETS[0];

  const handleRunSearch = async (e) => {
    e.preventDefault();
    const clean = searchQuery.trim();
    if (!clean || !onSearchText) return;
    setIsSearching(true);
    try {
      const found = await onSearchText(clean);
      setSearchResults(Array.isArray(found) ? found : []);
    } finally {
      setIsSearching(false);
    }
  };

  const filteredHighlights =
    colorFilter === 'all'
      ? highlights
      : highlights.filter(
          (hl) => normalizeHighlightColorId(hl.color) === colorFilter
        );

  const renderTocNodes = (nodes, depth = 0) =>
    nodes.map((node, idx) => {
      const isActive =
        activeChapterHref &&
        node.href &&
        (activeChapterHref === node.href ||
          activeChapterHref.includes(node.href) ||
          node.href.includes(activeChapterHref));
      return (
        <div key={`${node.id || node.href || idx}-${depth}`}>
          <button
            type="button"
            onClick={() => {
              onSelectChapter?.(node);
              onClose();
            }}
            style={{
              paddingLeft: `${8 + depth * 16}px`,
              borderColor: 'var(--reader-border)',
              color: isActive ? 'var(--reader-accent)' : 'var(--reader-ink)',
            }}
            className="flex min-h-[42px] w-full items-center justify-between gap-2 border-b pr-2 py-2 text-left text-xs transition-colors duration-150 ease-out"
          >
            <span className={`truncate ${isActive ? 'font-semibold' : ''}`}>
              {node.label}
            </span>
            <ChevronRight
              className="h-3.5 w-3.5 shrink-0"
              style={{ color: 'var(--reader-muted)' }}
              strokeWidth={1.5}
            />
          </button>
          {Array.isArray(node.subitems) &&
            node.subitems.length > 0 &&
            renderTocNodes(node.subitems, depth + 1)}
        </div>
      );
    });

  return (
    <div
      className="fixed inset-0 z-50 flex justify-start"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)' }}
      onClick={onClose}
    >
      <aside
        aria-label="Painel de índice, marcadores, destaques e busca"
        className="flex h-full w-full max-w-sm flex-col border-r"
        style={{
          backgroundColor: 'var(--reader-bg)',
          borderColor: 'var(--reader-border)',
          color: 'var(--reader-ink)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div
          className="flex items-center justify-between border-b px-4 py-2.5"
          style={{ borderColor: 'var(--reader-border)' }}
        >
          <h2 className="text-sm font-semibold tracking-tight">
            Índice &amp; Notas
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar painel"
            className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-[4px]"
            style={{ color: 'var(--reader-muted)' }}
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* 4 Abas separadas por hairline */}
        <div
          className="grid grid-cols-4 border-b"
          style={{ borderColor: 'var(--reader-border)' }}
        >
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className="relative flex min-h-[44px] flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[11px] font-medium transition-colors duration-150 ease-out"
                style={{
                  color: isSelected
                    ? 'var(--reader-accent)'
                    : 'var(--reader-muted)',
                }}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
                <span className="truncate">{tab.label}</span>
                {isSelected && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-2 bottom-0 h-[2px]"
                    style={{ backgroundColor: 'var(--reader-accent)' }}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 no-scrollbar">
          {/* Aba 1: Sumário */}
          {activeTab === 'toc' &&
            (toc.length === 0 ? (
              <p
                className="py-10 text-center text-xs"
                style={{ color: 'var(--reader-muted)' }}
              >
                nenhum capítulo identificado neste documento.
              </p>
            ) : (
              <div>{renderTocNodes(toc)}</div>
            ))}

          {/* Aba 2: Marcadores (texto simples: capítulo, página, data) */}
          {activeTab === 'bookmarks' &&
            (bookmarks.length === 0 ? (
              <p
                className="py-10 text-center text-xs"
                style={{ color: 'var(--reader-muted)' }}
              >
                nenhum marcador salvo ainda.
              </p>
            ) : (
              <div>
                {bookmarks.map((bm) => (
                  <div
                    key={bm.id}
                    className="flex items-center justify-between gap-2 border-b py-3"
                    style={{ borderColor: 'var(--reader-border)' }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onSelectBookmark?.(bm);
                        onClose();
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-xs font-medium">{bm.label}</p>
                      <p
                        className="mt-0.5 text-[11px] tabular-nums"
                        style={{ color: 'var(--reader-muted)' }}
                      >
                        Pág. {bm.page || 1}
                        {typeof bm.progressPct === 'number'
                          ? ` (${bm.progressPct.toFixed(1)}%)`
                          : ''}
                        {bm.createdAt ? ` · ${formatShortDate(bm.createdAt)}` : ''}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveBookmark?.(bm.id)}
                      aria-label="Remover marcador"
                      title="Remover marcador"
                      className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-[4px]"
                      style={{ color: 'var(--reader-muted)' }}
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </button>
                  </div>
                ))}
              </div>
            ))}

          {/* Aba 3: Destaques & Notas */}
          {activeTab === 'highlights' && (
            <div className="space-y-3">
              {/* Filtro por cor da marcação */}
              {highlights.length > 0 && (
                <div
                  className="flex items-center justify-between gap-2 border-b pb-2.5"
                  style={{ borderColor: 'var(--reader-border)' }}
                >
                  <button
                    type="button"
                    onClick={() => setColorFilter('all')}
                    className="min-h-[32px] px-1.5 text-[11px] font-medium"
                    style={{
                      color:
                        colorFilter === 'all'
                          ? 'var(--reader-accent)'
                          : 'var(--reader-muted)',
                    }}
                  >
                    todas ({highlights.length})
                  </button>

                  <div className="flex items-center gap-1.5">
                    {HIGHLIGHT_COLORS.map((c) => {
                      const active = colorFilter === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() =>
                            setColorFilter((prev) => (prev === c.id ? 'all' : c.id))
                          }
                          aria-label={`Filtrar por ${c.label}`}
                          title={c.label}
                          className="flex h-7 w-7 items-center justify-center rounded-[4px]"
                        >
                          <span
                            className="h-4 w-4 rounded-full"
                            style={{
                              backgroundColor: c.swatch,
                              outline: active
                                ? '1.5px solid var(--reader-accent)'
                                : 'none',
                              outlineOffset: '2px',
                            }}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {filteredHighlights.length === 0 ? (
                <p
                  className="py-10 text-center text-xs"
                  style={{ color: 'var(--reader-muted)' }}
                >
                  {highlights.length === 0
                    ? 'selecione um trecho no texto para grifar, comentar ou publicar.'
                    : 'nenhum destaque encontrado com esta cor.'}
                </p>
              ) : (
                <div>
                  {filteredHighlights.map((hl) => {
                    const colorMeta = getHighlightColorMeta(hl.color);
                    const isEditing = editingId === hl.id;
                    return (
                      <article
                        key={hl.id}
                        className="border-b py-3 space-y-2"
                        style={{ borderColor: 'var(--reader-border)' }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            onSelectHighlight?.(hl);
                            onClose();
                          }}
                          className="block w-full text-left"
                        >
                          <p
                            className="line-clamp-4 border-l-2 pl-2.5 text-sm leading-relaxed"
                            style={{
                              borderColor: colorMeta.swatch,
                              fontFamily: readerFontPreset.cssValue,
                            }}
                          >
                            {hl.text}
                          </p>
                        </button>

                        {!isEditing && hl.note && (
                          <p
                            className="pl-3 text-xs leading-relaxed"
                            style={{ color: 'var(--reader-muted)' }}
                          >
                            {hl.note}
                          </p>
                        )}

                        {isEditing && (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              onUpdateHighlight?.(hl.id, {
                                note: editingNote.trim(),
                              });
                              setEditingId(null);
                              setEditingNote('');
                            }}
                            className="space-y-2 pt-1"
                          >
                            <textarea
                              rows={2}
                              autoFocus
                              value={editingNote}
                              onChange={(e) => setEditingNote(e.target.value)}
                              placeholder="editar comentário marginal..."
                              className="w-full resize-none rounded-[4px] border px-2.5 py-1.5 text-xs focus:outline-none"
                              style={{
                                backgroundColor: 'var(--reader-surface)',
                                borderColor: 'var(--reader-border)',
                                color: 'var(--reader-ink)',
                              }}
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="px-2 py-1 text-[11px]"
                                style={{ color: 'var(--reader-muted)' }}
                              >
                                cancelar
                              </button>
                              <button
                                type="submit"
                                className="rounded-[4px] border px-2.5 py-1 text-[11px] font-medium"
                                style={{
                                  borderColor: 'var(--reader-accent)',
                                  color: 'var(--reader-accent)',
                                }}
                              >
                                salvar
                              </button>
                            </div>
                          </form>
                        )}

                        <div className="flex items-center justify-between gap-2 pt-0.5">
                          <span
                            className="truncate text-[11px] tabular-nums"
                            style={{ color: 'var(--reader-muted)' }}
                          >
                            {hl.location || (hl.page ? `Pág. ${hl.page}` : 'Trecho')}
                            {hl.page && hl.location && !hl.location.includes(String(hl.page))
                              ? ` · Pág. ${hl.page}`
                              : ''}
                          </span>

                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(hl.id);
                                setEditingNote(hl.note || '');
                              }}
                              aria-label="Editar comentário"
                              title="Editar comentário"
                              className="flex h-8 w-8 items-center justify-center rounded-[4px]"
                              style={{ color: 'var(--reader-muted)' }}
                            >
                              <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
                            </button>

                            <button
                              type="button"
                              onClick={() => onPublishHighlight?.(hl)}
                              aria-label="Publicar trecho no Diário"
                              title="Publicar trecho no Diário"
                              className="flex h-8 w-8 items-center justify-center rounded-[4px]"
                              style={{ color: 'var(--reader-muted)' }}
                            >
                              <Send className="h-3.5 w-3.5" strokeWidth={1.5} />
                            </button>

                            <button
                              type="button"
                              onClick={() => onRemoveHighlight?.(hl.id)}
                              aria-label="Remover destaque"
                              title="Remover destaque"
                              className="flex h-8 w-8 items-center justify-center rounded-[4px]"
                              style={{ color: 'var(--reader-muted)' }}
                            >
                              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Aba 4: Busca */}
          {activeTab === 'search' && (
            <div className="space-y-3">
              <form onSubmit={handleRunSearch} className="flex gap-2">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="buscar termo no texto..."
                  className="min-h-[40px] flex-1 rounded-[4px] border px-3 py-1.5 text-xs focus:outline-none"
                  style={{
                    backgroundColor: 'var(--reader-surface)',
                    borderColor: 'var(--reader-border)',
                    color: 'var(--reader-ink)',
                  }}
                />
                <button
                  type="submit"
                  disabled={isSearching || !searchQuery.trim()}
                  className="min-h-[40px] rounded-[4px] border px-3 text-xs font-medium disabled:opacity-45"
                  style={{
                    borderColor: 'var(--reader-accent)',
                    color: 'var(--reader-accent)',
                  }}
                >
                  {isSearching ? '...' : 'buscar'}
                </button>
              </form>

              {isSearching ? (
                <p
                  className="py-8 text-center text-xs"
                  style={{ color: 'var(--reader-muted)' }}
                >
                  buscando ocorrências...
                </p>
              ) : searchResults.length === 0 ? (
                <p
                  className="py-8 text-center text-xs"
                  style={{ color: 'var(--reader-muted)' }}
                >
                  {searchQuery.trim()
                    ? 'nenhuma ocorrência encontrada.'
                    : 'digite um termo para buscar no livro.'}
                </p>
              ) : (
                <div>
                  {searchResults.map((match, idx) => (
                    <button
                      key={`${match.id || idx}`}
                      type="button"
                      onClick={() => {
                        onSelectSearchMatch?.(match);
                        onClose();
                      }}
                      className="block w-full border-b py-2.5 text-left transition-opacity duration-150 ease-out hover:opacity-80"
                      style={{ borderColor: 'var(--reader-border)' }}
                    >
                      {match.label && (
                        <span
                          className="block text-[11px] font-medium"
                          style={{ color: 'var(--reader-accent)' }}
                        >
                          {match.label}
                        </span>
                      )}
                      <p className="mt-0.5 line-clamp-3 text-xs leading-relaxed">
                        {match.excerpt}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
