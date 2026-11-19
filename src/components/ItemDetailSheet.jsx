import { BookOpen, Bookmark, Heart, Quote, Star, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { domainConfig, getStatusList } from '../config/domainConfig';
import { getVerdictMeta } from '../utils/backlogHelpers';
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
  geminiKey = '',
  onClose,
  onUpdateItem,
  onRemoveItem,
  onOpenJournal,
  onOpenGeminiSettings,
}) {
  const [activeSheetTab, setActiveSheetTab] = useState('catalog');

  useEffect(() => {
    setActiveSheetTab('catalog');
  }, [item?.id]);

  if (!item) return null;

  const statuses = getStatusList();
  const { ui, cardFields } = domainConfig;
  const notesKey = cardFields.notes;
  const genres = item[cardFields.genres] || [];
  const verdictMeta = item.verdict ? getVerdictMeta(item.verdict) : null;
  const quotesCount = Array.isArray(item.quotes) ? item.quotes.length : 0;
  const linkedPosts = posts.filter((post) => post.itemId === item.id);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl border-x border-t border-line bg-card p-5 pb-8 shadow-2xl no-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />

        <div className="flex gap-4">
          <CoverArt item={item} compact className="h-30 w-20 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-base font-semibold leading-snug text-ink">
                {item.title}
              </h3>
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
            </div>
          </div>
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

            <div className="mt-4 border-t border-line pt-4">
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
