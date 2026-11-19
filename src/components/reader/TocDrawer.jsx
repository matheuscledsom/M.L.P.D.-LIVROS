import {
  Bookmark,
  ChevronRight,
  Highlighter,
  ListTree,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';

const TABS = [
  { id: 'toc', label: 'Sumário', icon: ListTree },
  { id: 'bookmarks', label: 'Marcadores', icon: Bookmark },
  { id: 'highlights', label: 'Destaques', icon: Highlighter },
  { id: 'search', label: 'Busca', icon: Search },
];

export function TocDrawer({
  isOpen,
  initialTab = 'toc',
  onClose,
  toc = [],
  activeChapterHref = '',
  bookmarks = [],
  highlights = [],
  onSelectChapter,
  onSelectBookmark,
  onRemoveBookmark,
  onSelectHighlight,
  onRemoveHighlight,
  onSearchText,
  onSelectSearchMatch,
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

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
            style={{ paddingLeft: `${12 + depth * 14}px` }}
            className={`flex min-h-[44px] w-full items-center justify-between gap-2 rounded-xl pr-3 py-2 text-left text-xs transition-colors ${
              isActive
                ? 'bg-accent/15 font-semibold text-accent'
                : 'text-ink hover:bg-elevated'
            }`}
          >
            <span className="truncate">{node.label}</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-subtle" strokeWidth={1.5} />
          </button>
          {Array.isArray(node.subitems) &&
            node.subitems.length > 0 &&
            renderTocNodes(node.subitems, depth + 1)}
        </div>
      );
    });

  return (
    <div
      className="fixed inset-0 z-50 flex justify-start bg-black/65 backdrop-blur-xs"
      onClick={onClose}
    >
      <aside
        aria-label="Painel de índice, marcadores, destaques e busca"
        className="flex h-full w-full max-w-sm flex-col border-r border-line bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Índice &amp; Notas</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar painel"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-muted hover:bg-elevated hover:text-ink"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* 4 Abas */}
        <div className="grid grid-cols-4 border-b border-line bg-app p-1 gap-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-[10px] font-medium transition-colors ${
                  isSelected
                    ? 'bg-accent text-accent-ink'
                    : 'text-muted hover:text-ink'
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={1.5} />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-3 no-scrollbar">
          {activeTab === 'toc' && (
            toc.length === 0 ? (
              <p className="py-10 text-center text-xs text-subtle">
                Nenhum capítulo identificado neste documento.
              </p>
            ) : (
              <div className="space-y-1">{renderTocNodes(toc)}</div>
            )
          )}

          {activeTab === 'bookmarks' && (
            bookmarks.length === 0 ? (
              <p className="py-10 text-center text-xs text-subtle">
                Nenhum marcador salvo ainda. Use o ícone de marcador na barra superior.
              </p>
            ) : (
              <div className="space-y-2">
                {bookmarks.map((bm) => (
                  <div
                    key={bm.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-line bg-app p-2.5"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onSelectBookmark?.(bm);
                        onClose();
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-xs font-semibold text-ink">
                        {bm.label}
                      </p>
                      <p className="text-[10px] text-subtle">
                        {Math.round(bm.progressPct || 0)}%
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveBookmark?.(bm.id)}
                      aria-label="Remover marcador"
                      className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-subtle hover:text-rose-400"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                    </button>
                  </div>
                ))}
              </div>
            )
          )}

          {activeTab === 'highlights' && (
            highlights.length === 0 ? (
              <p className="py-10 text-center text-xs text-subtle">
                Selecione um trecho de texto para destacar, anotar ou salvar no cofre de citações.
              </p>
            ) : (
              <div className="space-y-2.5">
                {highlights.map((hl) => (
                  <article
                    key={hl.id}
                    className="space-y-1.5 rounded-xl border border-line bg-app p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">
                        {hl.location || (hl.page ? `Pág. ${hl.page}` : 'Trecho')}
                      </span>
                      <button
                        type="button"
                        onClick={() => onRemoveHighlight?.(hl.id)}
                        aria-label="Remover destaque"
                        className="rounded-lg p-1 text-subtle hover:text-rose-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectHighlight?.(hl);
                        onClose();
                      }}
                      className="block w-full text-left"
                    >
                      <p className="line-clamp-3 border-l-2 border-accent pl-2.5 text-xs leading-relaxed text-ink">
                        {hl.text}
                      </p>
                      {hl.note && (
                        <p className="mt-1.5 text-[11px] text-muted">{hl.note}</p>
                      )}
                    </button>
                  </article>
                ))}
              </div>
            )
          )}

          {activeTab === 'search' && (
            <div className="space-y-3">
              <form onSubmit={handleRunSearch} className="flex gap-2">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar palavra ou trecho..."
                  className="flex-1 rounded-xl border border-line bg-app px-3 py-2 text-xs text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isSearching || !searchQuery.trim()}
                  className="min-h-[44px] rounded-xl bg-accent px-3.5 py-2 text-xs font-semibold text-accent-ink disabled:opacity-45"
                >
                  {isSearching ? '...' : 'Buscar'}
                </button>
              </form>

              {isSearching ? (
                <div className="space-y-2" aria-hidden="true">
                  {[1, 2, 3].map((k) => (
                    <div
                      key={k}
                      className="h-14 animate-pulse rounded-xl bg-elevated"
                    />
                  ))}
                </div>
              ) : searchResults.length === 0 ? (
                <p className="py-8 text-center text-xs text-subtle">
                  {searchQuery.trim()
                    ? 'Nenhuma ocorrência encontrada.'
                    : 'Digite um termo e pressione Buscar.'}
                </p>
              ) : (
                <div className="space-y-2">
                  {searchResults.map((match, idx) => (
                    <button
                      key={`${match.id || idx}`}
                      type="button"
                      onClick={() => {
                        onSelectSearchMatch?.(match);
                        onClose();
                      }}
                      className="block w-full rounded-xl border border-line bg-app p-2.5 text-left transition-colors hover:border-accent/50"
                    >
                      {match.label && (
                        <span className="block text-[10px] font-semibold text-accent">
                          {match.label}
                        </span>
                      )}
                      <p className="mt-0.5 line-clamp-3 text-xs leading-relaxed text-ink">
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
