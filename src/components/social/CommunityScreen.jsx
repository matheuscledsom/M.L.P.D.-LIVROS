import {
  Award,
  Check,
  Clock,
  MessagesSquare,
  Search,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import {
  followReader,
  listPendingFollowRequests,
  respondFollowRequest,
  searchReaderProfiles,
  unfollowReader,
} from '../../services/codiceBackend';
import { ActivityFeed } from './ActivityFeed';

const SUB_TABS = [
  { id: 'explore', label: 'Explorar Leitores' },
  { id: 'feed', label: 'Feed de Atividades' },
  { id: 'requests', label: 'Solicitações' },
];

export function CommunityScreen({
  viewerId = null,
  unreadDmCount = 0,
  onOpenUserProfile,
  onOpenDirectChat,
}) {
  const { showToast } = useToast();
  const [subTab, setSubTab] = useState('explore');
  const [query, setQuery] = useState('');
  const [readers, setReaders] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [busyIds, setBusyIds] = useState({});

  const loadDirectoryAndRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const [foundReaders, requests] = await Promise.all([
        searchReaderProfiles(query, { viewerId }),
        listPendingFollowRequests(viewerId),
      ]);
      setReaders(foundReaders);
      setPendingRequests(requests);
    } catch {
      setReaders([]);
      setPendingRequests([]);
    } finally {
      setIsLoading(false);
    }
  }, [query, viewerId]);

  useEffect(() => {
    loadDirectoryAndRequests();
  }, [loadDirectoryAndRequests]);

  const handleToggleFollow = async (reader) => {
    if (!reader?.id || busyIds[reader.id]) return;
    setBusyIds((prev) => ({ ...prev, [reader.id]: true }));
    try {
      if (reader.followStatus === 'approved' || reader.followStatus === 'pending') {
        await unfollowReader(reader.id, { viewerId });
        showToast({ message: 'Você deixou de seguir este leitor.', type: 'info' });
      } else {
        const res = await followReader(reader.id, { viewerId });
        showToast({
          message:
            res?.status === 'pending'
              ? 'Solicitação de vínculo enviada.'
              : `Seguindo ${reader.displayName || reader.handle}.`,
          type: 'success',
        });
      }
      await loadDirectoryAndRequests();
    } catch (err) {
      showToast({
        message: err?.userMessage || 'Não foi possível atualizar vínculo.',
        type: 'error',
      });
    } finally {
      setBusyIds((prev) => ({ ...prev, [reader.id]: false }));
    }
  };

  const handleRespondRequest = async (followerId, accept) => {
    if (!followerId) return;
    try {
      await respondFollowRequest(followerId, accept, { profileId: viewerId });
      showToast({
        message: accept ? 'Solicitação aprovada.' : 'Solicitação recusada.',
        type: accept ? 'success' : 'info',
      });
      await loadDirectoryAndRequests();
    } catch (err) {
      showToast({
        message: err?.userMessage || 'Não foi possível responder à solicitação.',
        type: 'error',
      });
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Cabeçalho editorial */}
      <header className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-line">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted font-medium">
            <Users className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>Rede Literária</span>
          </div>
          <h1 className="text-2xl font-serif font-semibold text-ink">
            Comunidade &amp; Leitores
          </h1>
          <p className="text-xs text-muted">
            Acompanhe leituras, explore acervos abertos e troque recomendações por livro.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onOpenDirectChat?.(null)}
          className="min-h-[44px] px-3.5 py-2 rounded-[4px] border border-line bg-surface text-xs font-medium text-ink hover:border-accent hover:text-accent inline-flex items-center gap-2 transition-colors"
        >
          <MessagesSquare className="w-4 h-4" strokeWidth={1.5} />
          <span>Mensagens</span>
          {unreadDmCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-[2px] bg-accent text-white text-[11px] tabular-nums font-semibold">
              {unreadDmCount}
            </span>
          )}
        </button>
      </header>

      {/* Navegação interna por linha editorial */}
      <div
        role="tablist"
        aria-label="Seções da comunidade"
        className="flex items-center gap-1 border-b border-line overflow-x-auto"
      >
        {SUB_TABS.map((tab) => {
          const isActive = subTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setSubTab(tab.id)}
              className={`min-h-[44px] px-3.5 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors inline-flex items-center gap-1.5 ${
                isActive
                  ? 'border-accent text-accent'
                  : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              <span>{tab.label}</span>
              {tab.id === 'requests' && pendingRequests.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-[2px] border border-accent text-accent text-[10px] tabular-nums font-semibold">
                  {pendingRequests.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Sub-aba 1: Explorar Leitores */}
      {subTab === 'explore' && (
        <div className="space-y-4">
          <div className="relative">
            <Search
              className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              strokeWidth={1.5}
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome, @handle ou interesses..."
              aria-label="Buscar leitores na comunidade"
              className="w-full min-h-[44px] pl-9 pr-3 py-2 rounded-[4px] border border-line bg-surface text-sm text-ink placeholder:text-muted focus:outline-none focus:border-accent"
            />
          </div>

          {isLoading ? (
            <div className="py-10 text-center text-xs text-muted border border-line rounded-[4px] bg-surface">
              Consultando diretório de leitores...
            </div>
          ) : readers.length === 0 ? (
            <div className="py-10 px-4 text-center text-xs text-muted border border-line rounded-[4px] bg-surface">
              Nenhum leitor encontrado para este filtro.
            </div>
          ) : (
            <div className="divide-y divide-line border border-line rounded-[4px] bg-surface">
              {readers.map((reader) => {
                const isBusy = Boolean(busyIds[reader.id]);
                const initials =
                  reader.avatarInitials ||
                  String(reader.displayName || reader.handle || 'LC')
                    .slice(0, 2)
                    .toUpperCase();
                return (
                  <div
                    key={reader.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {reader.avatarUrl ? (
                        <img
                          src={reader.avatarUrl}
                          alt={reader.displayName || reader.handle}
                          className="w-11 h-11 rounded-[4px] object-cover border border-line shrink-0"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-[4px] border border-line bg-panel flex items-center justify-center text-xs font-serif font-semibold text-ink shrink-0">
                          {initials}
                        </div>
                      )}

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <button
                            type="button"
                            onClick={() => onOpenUserProfile?.(reader.id)}
                            className="text-sm font-serif font-semibold text-ink hover:text-accent text-left transition-colors"
                          >
                            {reader.displayName || reader.handle}
                          </button>
                          <span className="text-xs text-muted tabular-nums">
                            {reader.handle}
                          </span>
                          {reader.isSelf && (
                            <span className="text-[11px] uppercase tracking-wider text-accent font-medium">
                              Você
                            </span>
                          )}
                        </div>

                        {reader.gamificationEnabled !== false &&
                          reader.resolvedBadgeName && (
                            <div className="inline-flex items-center gap-1 text-[11px] font-medium text-accent">
                              <Award className="w-3.5 h-3.5" strokeWidth={1.5} />
                              <span>{reader.resolvedBadgeName}</span>
                            </div>
                          )}

                        {reader.bio && (
                          <p className="text-xs text-muted line-clamp-2 leading-relaxed">
                            {reader.bio}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted tabular-nums pt-0.5">
                          <span>{reader.worksCount || 0} obras no acervo</span>
                          <span>{reader.readingCount || 0} em leitura</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onOpenUserProfile?.(reader.id)}
                        className="min-h-[44px] px-3 py-2 rounded-[4px] border border-line text-xs font-medium text-ink hover:border-accent hover:text-accent transition-colors"
                      >
                        Ver Perfil
                      </button>

                      {!reader.isSelf && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleToggleFollow(reader)}
                            disabled={isBusy}
                            className={`min-h-[44px] px-3 py-2 rounded-[4px] border text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
                              reader.followStatus === 'approved'
                                ? 'border-accent text-accent bg-accent/5'
                                : reader.followStatus === 'pending'
                                ? 'border-line text-muted bg-panel'
                                : 'border-accent bg-accent text-white'
                            }`}
                          >
                            {reader.followStatus === 'approved' ? (
                              <>
                                <UserCheck className="w-3.5 h-3.5" strokeWidth={1.5} />
                                <span>Seguindo</span>
                              </>
                            ) : reader.followStatus === 'pending' ? (
                              <>
                                <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
                                <span>Solicitado</span>
                              </>
                            ) : (
                              <>
                                <UserPlus className="w-3.5 h-3.5" strokeWidth={1.5} />
                                <span>Seguir</span>
                              </>
                            )}
                          </button>

                          {reader.allowDms !== false && onOpenDirectChat && (
                            <button
                              type="button"
                              onClick={() => onOpenDirectChat(reader.id)}
                              aria-label={`Enviar mensagem para ${reader.displayName || reader.handle}`}
                              className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-[4px] border border-line text-muted hover:border-accent hover:text-accent transition-colors"
                            >
                              <MessagesSquare className="w-4 h-4" strokeWidth={1.5} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Sub-aba 2: Feed de Atividades */}
      {subTab === 'feed' && (
        <ActivityFeed
          viewerId={viewerId}
          onSelectProfile={(id) => onOpenUserProfile?.(id)}
        />
      )}

      {/* Sub-aba 3: Solicitações de Seguimento */}
      {subTab === 'requests' && (
        <div className="space-y-3">
          {pendingRequests.length === 0 ? (
            <div className="py-10 px-4 text-center text-xs text-muted border border-line rounded-[4px] bg-surface">
              Nenhuma solicitação de seguimento pendente no momento.
            </div>
          ) : (
            <div className="divide-y divide-line border border-line rounded-[4px] bg-surface">
              {pendingRequests.map((req) => {
                const follower = req.followerProfile || {};
                const displayName =
                  follower.displayName || follower.handle || 'Leitor';
                return (
                  <div
                    key={req.followerId}
                    className="p-4 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => onOpenUserProfile?.(req.followerId)}
                        className="text-sm font-medium text-ink hover:text-accent transition-colors"
                      >
                        {displayName}
                      </button>
                      {follower.handle && (
                        <p className="text-xs text-muted tabular-nums">
                          {follower.handle}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleRespondRequest(req.followerId, true)}
                        className="min-h-[44px] px-3 py-2 rounded-[4px] border border-accent bg-accent text-white text-xs font-medium inline-flex items-center gap-1.5"
                      >
                        <Check className="w-4 h-4" strokeWidth={1.5} />
                        <span>Aceitar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRespondRequest(req.followerId, false)}
                        className="min-h-[44px] px-3 py-2 rounded-[4px] border border-line text-muted hover:text-ink text-xs font-medium inline-flex items-center gap-1.5"
                      >
                        <X className="w-4 h-4" strokeWidth={1.5} />
                        <span>Recusar</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
