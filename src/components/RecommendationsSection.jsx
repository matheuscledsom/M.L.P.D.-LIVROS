import { BookmarkPlus, Check, Compass, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  getReaderProfileBundle,
  searchReaderProfiles,
} from '../services/codiceBackend';
import { buildHomeBookRecommendations } from '../services/recommendationEngine';
import { getDisplayTitles } from '../utils/backlogHelpers';
import { CoverArt } from './CoverArt';

export function RecommendationsSection({
  items = [],
  profile = null,
  viewerId = null,
  peerRecommendations: externalPeerRecommendations = null,
  onAddToWishlist,
  onSelectItem,
}) {
  const [peerWorks, setPeerWorks] = useState([]);
  const [excludeIds, setExcludeIds] = useState([]);

  useEffect(() => {
    if (Array.isArray(externalPeerRecommendations)) {
      setPeerWorks(externalPeerRecommendations);
      return undefined;
    }

    let cancelled = false;
    const loadPeerWorks = async () => {
      try {
        const profiles = await searchReaderProfiles('', { viewerId });
        const peers = profiles
          .filter((p) => !p.isSelf && p.followStatus !== 'none')
          .slice(0, 4);
        const fallbackPeers =
          peers.length > 0
            ? peers
            : profiles.filter((p) => !p.isSelf).slice(0, 3);

        const bundles = await Promise.all(
          fallbackPeers.map((peer) =>
            getReaderProfileBundle(peer.id, { viewerId })
              .then((bundle) => ({ peer, bundle }))
              .catch(() => null)
          )
        );

        if (cancelled) return;
        const collected = [];
        bundles.forEach((entry) => {
          if (!entry?.bundle || entry.bundle.restricted) return;
          const peerHandle = entry.peer.handle || entry.peer.displayName;
          const isFollowing = entry.peer.followStatus === 'approved';
          const picks = [
            ...(entry.bundle.latestReviews || []),
            ...(entry.bundle.readingNow || []),
          ];
          picks.forEach((work) => {
            if (!work?.title) return;
            collected.push({
              work,
              peerHandle,
              rating: work.rating ?? null,
              isFollowing,
            });
          });
        });
        setPeerWorks(collected);
      } catch {
        if (!cancelled) setPeerWorks([]);
      }
    };

    loadPeerWorks();
    return () => {
      cancelled = true;
    };
  }, [viewerId, externalPeerRecommendations]);

  const { recommendations, totalCandidates } = useMemo(
    () =>
      buildHomeBookRecommendations({
        items,
        profile,
        peerRecommendations: peerWorks,
        limit: 4,
        excludeIds,
      }),
    [items, profile, peerWorks, excludeIds]
  );

  const handleRefresh = () => {
    const shownIds = recommendations.map((r) => r.id);
    if (shownIds.length === 0 || excludeIds.length + shownIds.length >= totalCandidates) {
      setExcludeIds(shownIds.length < totalCandidates ? shownIds : []);
    } else {
      setExcludeIds((prev) => Array.from(new Set([...prev, ...shownIds])));
    }
  };

  if (recommendations.length === 0) return null;

  return (
    <section
      aria-label="Indicações para Sua Próxima Leitura"
      className="space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Compass className="h-4 w-4 shrink-0 text-accent" strokeWidth={1.5} />
          <h2 className="text-sm font-semibold tracking-tight text-ink">
            Indicações para Sua Próxima Leitura
          </h2>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-[4px] border border-line bg-card px-2.5 py-1 text-[11px] font-medium text-ink transition-colors hover:border-accent hover:text-accent"
        >
          <RefreshCw className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
          <span>Atualizar Indicações</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {recommendations.map((rec) => {
          const { item, reason, alreadyInBacklog } = rec;
          const titles = getDisplayTitles(item, 'bilingual');

          return (
            <article
              key={rec.id}
              className="flex gap-3 rounded-[6px] border border-line bg-card p-3 transition-colors hover:border-accent/50"
            >
              <div className="aspect-[2/3] w-16 shrink-0 overflow-hidden rounded-[4px] border border-line">
                <CoverArt item={item} compact className="h-full w-full" />
              </div>

              <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
                <div className="space-y-0.5">
                  <h3 className="line-clamp-2 text-xs font-semibold leading-snug text-ink">
                    {titles.primary}
                  </h3>
                  {titles.secondary && (
                    <p
                      className="truncate text-[11px] italic"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {titles.secondary}
                    </p>
                  )}
                  {item.author && (
                    <p className="truncate text-[11px] text-muted">
                      {item.author}
                    </p>
                  )}
                  <p className="pt-1 text-[11px] leading-snug text-accent">
                    {reason}
                  </p>
                </div>

                <div className="pt-1">
                  {alreadyInBacklog ? (
                    <button
                      type="button"
                      onClick={() => onSelectItem?.(item)}
                      className="inline-flex min-h-[38px] w-full items-center justify-center gap-1.5 rounded-[4px] border border-line bg-app px-2.5 py-1.5 text-[11px] font-medium text-ink transition-colors hover:border-accent hover:text-accent"
                    >
                      <Check className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
                      <span>Na Estante · Abrir</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onAddToWishlist?.(item)}
                      className="inline-flex min-h-[38px] w-full items-center justify-center gap-1.5 rounded-[4px] border border-accent/40 bg-accent/10 px-2.5 py-1.5 text-[11px] font-medium text-accent transition-colors hover:bg-accent hover:text-accent-ink"
                    >
                      <BookmarkPlus className="h-3.5 w-3.5" strokeWidth={1.5} />
                      <span>Adicionar à Lista de Desejos</span>
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
