import {
  BookOpen,
  Bookmark,
  ExternalLink,
  FileText,
  FolderOpen,
  Heart,
  MessageSquarePlus,
  Quote,
  Send,
  Share2,
  SlidersHorizontal,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { domainConfig, getStatusList } from '../config/domainConfig';
import { useToast } from '../context/ToastContext';
import {
  searchReaderProfiles,
  sendDirectMessage,
} from '../services/codiceBackend';
import { getDisplayTitles, getVerdictMeta } from '../utils/backlogHelpers';
import { CollectionCreatorBar } from './CollectionCreatorBar';
import { CoverArt } from './CoverArt';
import { LibraryCatalogSection } from './LibraryCatalogSection';
import { QuotesVaultTab } from './QuotesVaultTab';
import { SmartCatalogButton } from './SmartCatalogButton';
import { StatusBadge } from './StatusBadge';
import { TactileStatusFields } from './TactileStatusFields';
import { TechnicalAtmosphereSection } from './TechnicalAtmosphereSection';
import { WorkTypeSelector } from './WorkTypeSelector';

export function ItemDetailSheet({
  item,
  posts = [],
  collections = [],
  geminiKey = '',
  viewerId = null,
  hasStoredFile = false,
  storedFileMeta = null,
  onClose,
  onUpdateItem,
  onToggleCollection,
  onCreateCollection,
  onRemoveItem,
  onRemoveStoredFile,
  onOpenJournal,
  onOpenReader,
  onOpenGeminiSettings,
  onRecommendToFeed,
  onSocialActivityChanged,
}) {
  const { showToast } = useToast();
  const [activeSheetTab, setActiveSheetTab] = useState('catalog');
  const [shareOpen, setShareOpen] = useState(false);
  const [shareNote, setShareNote] = useState('');
  const [sharePeers, setSharePeers] = useState([]);
  const [sendingPeerId, setSendingPeerId] = useState(null);
  const [confirmRemoveFile, setConfirmRemoveFile] = useState(false);
  const progressSectionRef = useRef(null);

  useEffect(() => {
    setActiveSheetTab('catalog');
    setShareOpen(false);
    setShareNote('');
    setConfirmRemoveFile(false);
  }, [item?.id]);

  useEffect(() => {
    if (!shareOpen) return undefined;
    let cancelled = false;
    searchReaderProfiles('', { viewerId })
      .then((list) => {
        if (!cancelled) {
          setSharePeers(
            (Array.isArray(list) ? list : []).filter(
              (p) => !p.isSelf && p.allowDms !== false
            )
          );
        }
      })
      .catch(() => {
        if (!cancelled) setSharePeers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [shareOpen, viewerId]);

  if (!item) return null;

  const handleSendToPeer = async (peer) => {
    if (!peer?.id || sendingPeerId) return;
    setSendingPeerId(peer.id);
    try {
      await sendDirectMessage({
        recipientId: peer.id,
        content:
          shareNote.trim() ||
          `Indico a leitura de "${item.title}" para a sua estante.`,
        attachedWorkSnapshot: item,
        viewerId,
      });
      onSocialActivityChanged?.();
      showToast({
        message: `Indicação enviada para ${peer.displayName || peer.handle}`,
        type: 'success',
      });
      setShareOpen(false);
      setShareNote('');
    } catch (err) {
      showToast({
        message:
          err?.userMessage ||
          err?.message ||
          'Não foi possível enviar a indicação no chat.',
        type: 'error',
      });
    } finally {
      setSendingPeerId(null);
    }
  };

  const handlePublishToFeed = () => {
    onRecommendToFeed?.(item, shareNote.trim());
    setShareOpen(false);
    setShareNote('');
  };

  const statuses = getStatusList();
  const { ui, cardFields } = domainConfig;
  const notesKey = cardFields.notes;
  const genres = item[cardFields.genres] || [];
  const verdictMeta = item.verdict ? getVerdictMeta(item.verdict) : null;
  const quotesCount = Array.isArray(item.quotes) ? item.quotes.length : 0;
  const linkedPosts = posts.filter((post) => post.itemId === item.id);
  const displayTitles = getDisplayTitles(item, 'bilingual');

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-[6px] border-x border-t border-line bg-card p-5 pb-8 no-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-[2px] bg-line" />

        <div className="flex gap-4">
          <CoverArt item={item} compact className="h-30 w-20 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-base font-semibold leading-snug text-ink">
                  {displayTitles.primary}
                </h3>
                {displayTitles.secondary && (
                  <p
                    className="mt-0.5 truncate text-xs italic"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {displayTitles.secondary}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={ui.detail.closeLabel}
                className="rounded-full p-1 text-muted hover:bg-elevated hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-0.5 text-xs text-muted">
              {[item[cardFields.creator], item[cardFields.year]]
                .filter(Boolean)
                .join(' • ')}
            </p>
            {genres.length > 0 && (
              <p className="mt-1 truncate text-[11px] text-subtle">
                {genres.slice(0, 3).join(' · ')}
              </p>
            )}
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <StatusBadge statusId={item.status} />
              {item.isPlatinum && (
                <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">
                  <Star className="h-3 w-3 fill-current" />
                  5 Estrelas
                </span>
              )}
              {item.status === 'completed' && verdictMeta && (
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${verdictMeta.badgeClass}`}
                >
                  {verdictMeta.id}
                </span>
              )}
              {item.citedByCount > 0 && (
                <span className="rounded-[4px] border border-line bg-app px-2 py-0.5 text-[10px] tabular-nums text-muted">
                  {item.citedByCount} citações
                </span>
              )}
            </div>
            {(item.openAccessUrl || item.freeEpubUrl) && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {item.openAccessUrl && (
                  <a
                    href={item.openAccessUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-[32px] items-center gap-1 rounded-[4px] border border-accent/40 px-2 py-1 text-[11px] font-medium text-accent transition-opacity hover:opacity-80"
                  >
                    <ExternalLink className="h-3 w-3" strokeWidth={1.5} />
                    <span>PDF Open Access</span>
                  </a>
                )}
                {item.freeEpubUrl && (
                  <a
                    href={item.freeEpubUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-[32px] items-center gap-1 rounded-[4px] border border-accent/40 px-2 py-1 text-[11px] font-medium text-accent transition-opacity hover:opacity-80"
                  >
                    <ExternalLink className="h-3 w-3" strokeWidth={1.5} />
                    <span>EPUB Domínio Público</span>
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Acoes principais no topo: Leitor / Vincular Arquivo + Atualizar Progresso */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {onOpenReader && (
            <button
              type="button"
              onClick={() => onOpenReader(item)}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[4px] bg-accent px-3.5 py-2.5 text-xs font-semibold text-accent-ink transition-opacity hover:opacity-90"
            >
              {hasStoredFile ? (
                <BookOpen className="h-4 w-4 shrink-0" strokeWidth={1.5} />
              ) : (
                <FileText className="h-4 w-4 shrink-0" strokeWidth={1.5} />
              )}
              <span className="truncate">
                {hasStoredFile
                  ? 'Ler Agora'
                  : 'Abrir / Vincular Arquivo (EPUB, PDF, CBZ)'}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setActiveSheetTab('catalog');
              requestAnimationFrame(() => {
                progressSectionRef.current?.scrollIntoView?.({
                  behavior: 'smooth',
                  block: 'center',
                });
              });
            }}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[4px] border border-line bg-app px-3.5 py-2.5 text-xs font-medium text-ink transition-colors hover:border-accent"
          >
            <SlidersHorizontal className="h-4 w-4 shrink-0 text-accent" strokeWidth={1.5} />
            <span>Atualizar Progresso</span>
          </button>
        </div>

        {hasStoredFile && (
          <div className="mt-2.5 rounded-[6px] border border-line bg-app p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-accent" strokeWidth={1.5} />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-ink">
                    Arquivo Digital Offline
                  </p>
                  <p
                    className="truncate text-[11px] tabular-nums"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {[
                      storedFileMeta?.format ? storedFileMeta.format.toUpperCase() : 'Offline',
                      storedFileMeta?.fileName,
                      storedFileMeta?.sizeLabel,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
              </div>

              {!confirmRemoveFile && (
                <button
                  type="button"
                  onClick={() => setConfirmRemoveFile(true)}
                  aria-expanded={confirmRemoveFile}
                  className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-[4px] border border-line bg-card px-2.5 py-1.5 text-xs font-medium transition-colors hover:border-rose-500/40 hover:text-rose-400"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                  <span>Excluir arquivo</span>
                </button>
              )}
            </div>

            {confirmRemoveFile && (
              <div className="space-y-2 border-t border-line pt-2.5">
                <p className="text-[11px] font-medium text-ink">
                  Confirmar exclusão: escolha o que deseja remover
                </p>
                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={async () => {
                      await onRemoveStoredFile?.(item, storedFileMeta);
                      setConfirmRemoveFile(false);
                    }}
                    className="flex min-h-[44px] w-full items-center justify-center rounded-[4px] border border-rose-500/50 bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-400"
                  >
                    Confirmar exclusão · Remover só o arquivo PDF/EPUB
                  </button>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        onRemoveItem(item.id);
                        onClose();
                      }}
                      className="flex min-h-[44px] items-center justify-center rounded-[4px] border border-line bg-card px-2.5 py-2 text-xs font-medium text-rose-400 hover:border-rose-500/40"
                    >
                      Excluir obra inteira
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmRemoveFile(false)}
                      className="flex min-h-[44px] items-center justify-center rounded-[4px] border border-line bg-card px-2.5 py-2 text-xs text-muted hover:text-ink"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Ação Social: Indicar Livro para colega ou mural/feed */}
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShareOpen((prev) => !prev)}
            aria-expanded={shareOpen}
            className={`flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[4px] border px-3.5 py-2 text-xs font-medium transition-colors ${
              shareOpen
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-line bg-app text-ink hover:border-accent hover:text-accent'
            }`}
          >
            <Share2 className="h-4 w-4 text-accent" strokeWidth={1.5} />
            <span>Indicar Livro</span>
          </button>

          {shareOpen && (
            <div className="mt-2 space-y-3 rounded-[4px] border border-line bg-app p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-ink">
                  Enviar indicação com comentário
                </span>
                <button
                  type="button"
                  onClick={() => setShareOpen(false)}
                  aria-label="Fechar painel de indicação"
                  className="rounded-[4px] p-1 text-subtle hover:text-ink"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              </div>

              <textarea
                rows={2}
                value={shareNote}
                onChange={(e) => setShareNote(e.target.value)}
                placeholder={`Por que você indica "${item.title}"?`}
                className="w-full resize-none rounded-[4px] border border-line bg-card px-2.5 py-2 text-xs text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
              />

              {onRecommendToFeed && (
                <button
                  type="button"
                  onClick={handlePublishToFeed}
                  className="flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-[4px] border border-accent bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent hover:text-accent-ink"
                >
                  <MessageSquarePlus className="h-4 w-4" strokeWidth={1.5} />
                  <span>Publicar no Feed &amp; Mural</span>
                </button>
              )}

              <div className="space-y-1.5 border-t border-line pt-2">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted">
                  Ou enviar no Chat 1:1 para:
                </p>
                {sharePeers.length === 0 ? (
                  <p className="text-[11px] text-muted">
                    Nenhum colega disponível para mensagens no momento.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {sharePeers.slice(0, 6).map((peer) => (
                      <button
                        key={peer.id}
                        type="button"
                        disabled={sendingPeerId === peer.id}
                        onClick={() => handleSendToPeer(peer)}
                        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-[4px] border border-line bg-card px-2.5 py-1 text-[11px] font-medium text-ink transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
                      >
                        <Send className="h-3 w-3 text-accent" strokeWidth={1.5} />
                        <span>{peer.displayName || peer.handle}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Seletor de Abas da Obra: Catalogação vs Citações & Fichamento */}
        <div className="mt-4 grid grid-cols-2 gap-1.5 rounded-2xl border border-line bg-app p-1">
          <button
            type="button"
            onClick={() => setActiveSheetTab('catalog')}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-colors ${
              activeSheetTab === 'catalog'
                ? 'bg-accent text-accent-ink'
                : 'text-muted hover:text-ink'
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            Catalogação
          </button>
          <button
            type="button"
            onClick={() => setActiveSheetTab('quotes')}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-colors ${
              activeSheetTab === 'quotes'
                ? 'bg-accent text-accent-ink'
                : 'text-muted hover:text-ink'
            }`}
          >
            <Quote className="h-3.5 w-3.5" />
            <span className="truncate">Citações & Fichamento</span>
            {quotesCount > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                  activeSheetTab === 'quotes'
                    ? 'bg-black/20 text-accent-ink'
                    : 'bg-accent/15 text-accent'
                }`}
              >
                {quotesCount}
              </span>
            )}
          </button>
        </div>

        {activeSheetTab === 'quotes' ? (
          <div className="mt-4">
            <QuotesVaultTab
              item={item}
              onUpdate={(updates) => onUpdateItem(item.id, updates)}
            />
          </div>
        ) : (
          <>
            <div className="mt-4">
              <WorkTypeSelector
                label={ui.detail.workTypeTitle}
                value={item.workType}
                onChange={(nextType) =>
                  onUpdateItem(item.id, { workType: nextType })
                }
              />
            </div>

            <div className="mt-4">
              <SmartCatalogButton
                item={item}
                geminiKey={geminiKey}
                onApplyFields={(updates) => onUpdateItem(item.id, updates)}
                onOpenGeminiSettings={() => {
                  onClose();
                  onOpenGeminiSettings?.();
                }}
              />
            </div>

            <label className="mt-3 block">
              <span className="mb-1 block text-[11px] font-medium text-muted">
                Sinopse (sem spoilers)
              </span>
              <textarea
                rows={2}
                value={item.synopsis || ''}
                onChange={(e) =>
                  onUpdateItem(item.id, { synopsis: e.target.value })
                }
                placeholder="Sinopse breve ou premissa sem spoilers..."
                className="w-full resize-none rounded-xl border border-line bg-app px-3 py-2 text-xs leading-relaxed text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
              />
            </label>

            <div className="mt-4">
              <p className="mb-2 text-xs font-medium text-muted">
                {ui.detail.statusTitle}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {statuses.map((status) => {
                  const isSelected = item.inBacklog && item.status === status.id;
                  return (
                    <button
                      key={status.id}
                      type="button"
                      onClick={() =>
                        onUpdateItem(item.id, { status: status.id, inBacklog: true })
                      }
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                        isSelected
                          ? 'border-accent bg-accent/15 text-ink'
                          : 'border-line bg-app text-muted hover:text-ink'
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${status.dotClass}`} />
                      {status.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div ref={progressSectionRef} className="mt-4 border-t border-line pt-4">
              <TactileStatusFields
                item={item}
                showAiActions
                geminiKey={geminiKey}
                linkedPosts={linkedPosts}
                onOpenGeminiSettings={() => {
                  onClose();
                  onOpenGeminiSettings?.();
                }}
                onChange={(updates) => onUpdateItem(item.id, updates)}
                onOpenJournal={() => {
                  onClose();
                  onOpenJournal?.(item.id);
                }}
              />
            </div>

            <div className="mt-4 space-y-3">
              <TechnicalAtmosphereSection
                item={item}
                onChange={(updates) => onUpdateItem(item.id, updates)}
              />
              <LibraryCatalogSection
                item={item}
                onChange={(updates) => onUpdateItem(item.id, updates)}
              />
            </div>

            <section
              aria-label="Prateleiras e Coleções"
              className="mt-4 rounded-xl border border-line bg-card p-3 space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink">
                  <FolderOpen className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
                  <span>Prateleiras / Coleções</span>
                </span>
                <span className="text-[10px] tabular-nums text-subtle">
                  {Array.isArray(item.collectionIds) ? item.collectionIds.length : 0} selecionada(s)
                </span>
              </div>

              {collections.length > 0 ? (
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {collections.map((col) => {
                    const checked =
                      Array.isArray(item.collectionIds) &&
                      item.collectionIds.map(String).includes(String(col.id));
                    return (
                      <label
                        key={col.id}
                        className={`flex min-h-[44px] cursor-pointer items-center gap-2 rounded-[4px] border px-3 py-2 text-xs font-medium transition-colors ${
                          checked
                            ? 'border-accent bg-accent/10 text-ink'
                            : 'border-line bg-app text-muted hover:text-ink'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => onToggleCollection?.(item.id, col.id)}
                          className="h-4 w-4 accent-[var(--accent-color)]"
                        />
                        <span className="truncate">{col.name}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[11px] text-subtle">
                  Crie coleções como Favoritos da Vida, Faculdade / TCC ou Para Ler nas Férias para organizar esta obra.
                </p>
              )}

              {onCreateCollection && (
                <CollectionCreatorBar
                  collections={collections}
                  onCreateCollection={onCreateCollection}
                  onCreated={(created) => {
                    if (
                      created?.id &&
                      !(item.collectionIds || []).map(String).includes(String(created.id))
                    ) {
                      onToggleCollection?.(item.id, created.id);
                    }
                  }}
                />
              )}
            </section>

            <label className="mt-4 block">
              <span className="mb-1.5 block text-xs font-medium text-muted">
                {ui.detail.notesLabel}
              </span>
              <textarea
                rows={3}
                value={item[notesKey] || ''}
                onChange={(e) =>
                  onUpdateItem(item.id, { [notesKey]: e.target.value })
                }
                placeholder={ui.detail.notesPlaceholder}
                className="w-full resize-none rounded-xl border border-line bg-app px-3 py-2.5 text-xs leading-relaxed text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
              />
            </label>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  onUpdateItem(item.id, { isFavorite: !item.isFavorite })
                }
                className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-medium transition-colors ${
                  item.isFavorite
                    ? 'border-accent/60 bg-accent/15 text-accent'
                    : 'border-line bg-app text-muted hover:text-ink'
                }`}
              >
                <Heart
                  className="h-3.5 w-3.5"
                  fill={item.isFavorite ? 'currentColor' : 'none'}
                />
                {ui.detail.favoriteLabel}
              </button>

              <button
                type="button"
                onClick={() =>
                  onUpdateItem(item.id, { isWishlist: !item.isWishlist })
                }
                className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-medium transition-colors ${
                  item.isWishlist
                    ? 'border-accent/60 bg-accent/15 text-accent'
                    : 'border-line bg-app text-muted hover:text-ink'
                }`}
              >
                <Bookmark
                  className="h-3.5 w-3.5"
                  fill={item.isWishlist ? 'currentColor' : 'none'}
                />
                {ui.detail.wishlistLabel}
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                onRemoveItem(item.id);
                onClose();
              }}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 py-2.5 text-xs font-medium text-rose-400 transition-colors hover:bg-rose-500/20"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {ui.detail.removeLabel}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
