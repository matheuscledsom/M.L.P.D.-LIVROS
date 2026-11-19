import {
  Bookmark,
  BookOpen,
  Camera,
  Download,
  Film,
  Grid3X3,
  Layers,
  Link2,
  Palette,
  PenLine,
  Plus,
  Settings,
  Sparkles,
  Star,
  Trophy,
  Upload,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CoverArt } from '../components/CoverArt';
import { PostDetailModal } from '../components/PostDetailModal';
import { ProfileEditModal } from '../components/ProfileEditModal';
import { ThemeModal } from '../components/ThemeModal';
import { VectorIcon } from '../components/VectorIcon';
import { domainConfig } from '../config/domainConfig';
import { getHypeMeta, getPagesRead } from '../utils/backlogHelpers';
import {
  isSoundEnabled,
  playTactileSound,
  setSoundEnabled,
} from '../utils/soundEffects';

const TAB_ICONS = {
  Grid3X3,
  Trophy,
  Bookmark,
};

export function ProfileScreen({
  items,
  profile,
  posts,
  themeProps,
  hasGeminiKey = false,
  onOpenGeminiSettings,
  onReopenOnboarding,
  onUpdateProfile,
  onSelectItem,
  onOpenJournalComposer,
  onDeletePost,
  onAddPostComment,
  onDeletePostComment,
  onExportBackup,
  onImportBackup,
}) {
  const { ui, cardFields } = domainConfig;
  const { profile: profileCfg } = ui;
  const [activeTab, setActiveTab] = useState(profileCfg.tabs[0].id);
  const [menuOpen, setMenuOpen] = useState(false);
  const [themeModalOpen, setThemeModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [soundOn, setSoundOn] = useState(isSoundEnabled);

  const menuRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutsideClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [menuOpen]);

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 3000);
    return () => clearTimeout(timer);
  }, [feedback]);

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    setMenuOpen(false);
    if (!file) return;

    const result = await onImportBackup(file);
    if (result.ok) {
      setFeedback({
        type: 'success',
        text: `${profileCfg.backup.importSuccessPrefix} ${result.count}`,
      });
    } else {
      setFeedback({ type: 'error', text: result.error });
    }
  };

  const statsData = useMemo(() => {
    const backlogItems = items.filter((item) => item.inBacklog);
    const completedCount = backlogItems.filter(
      (item) => item.status === 'completed'
    ).length;
    const platinumCount = backlogItems.filter((item) => item.isPlatinum).length;
    const totalPagesRead = backlogItems.reduce(
      (sum, item) => sum + getPagesRead(item),
      0
    );

    const { perPage, perCompleted, perPlatinum, xpPerLevel } = profileCfg.xpConfig;
    const totalXp = Math.round(
      totalPagesRead * perPage +
        completedCount * perCompleted +
        platinumCount * perPlatinum
    );
    const level = Math.floor(totalXp / xpPerLevel) + 1;
    const currentLevelXp = totalXp % xpPerLevel;
    const xpPct = Math.round((currentLevelXp / xpPerLevel) * 100);

    return {
      metrics: [
        { id: 'total', label: profileCfg.metrics.total, value: backlogItems.length },
        { id: 'completed', label: profileCfg.metrics.completed, value: completedCount },
        {
          id: 'pages',
          label: profileCfg.metrics.pages,
          value: new Intl.NumberFormat('pt-BR').format(totalPagesRead),
        },
      ],
      level,
      totalXp,
      currentLevelXp,
      xpPerLevel,
      xpPct,
    };
  }, [items, profileCfg.metrics, profileCfg.xpConfig]);

  const trophyItems = useMemo(
    () =>
      items
        .filter((item) => item.status === 'completed')
        .sort((a, b) => {
          const favDiff = Number(b.isPlatinum) - Number(a.isPlatinum);
          if (favDiff !== 0) return favDiff;
          return (b[cardFields.rating] ?? -1) - (a[cardFields.rating] ?? -1);
        }),
    [items, cardFields.rating]
  );

  const radarItems = useMemo(
    () =>
      items
        .filter(
          (item) =>
            item.status === 'queued' ||
            item.isWishlist ||
            item.access === 'Wishlist'
        )
        .sort(
          (a, b) =>
            (getHypeMeta(b.hype)?.weight ?? 0) - (getHypeMeta(a.hype)?.weight ?? 0)
        ),
    [items]
  );

  const selectedPost = useMemo(
    () => posts.find((p) => p.id === selectedPostId) ?? null,
    [posts, selectedPostId]
  );

  const selectedPostLinkedItem = useMemo(
    () =>
      selectedPost?.itemId
        ? items.find((i) => i.id === selectedPost.itemId) ?? null
        : null,
    [items, selectedPost]
  );

  return (
    <div className="space-y-4 pb-24">
      <header className="relative flex items-center justify-between gap-2 pt-2">
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="truncate text-base font-semibold tracking-tight text-ink">
            {profile.handle}
          </h1>
          <span className="hidden sm:inline-flex shrink-0 rounded-full border border-line bg-card px-2 py-0.5 text-[10px] font-medium text-muted">
            {domainConfig.signature}
          </span>
        </div>

        <div className="flex items-center gap-1" ref={menuRef}>
          <button
            type="button"
            onClick={() => onOpenJournalComposer(null)}
            aria-label={profileCfg.newPostLabel}
            title={profileCfg.newPostLabel}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-accent/40 bg-accent/15 text-accent transition-colors hover:bg-accent hover:text-accent-ink"
          >
            <Plus className="h-4 w-4" strokeWidth={1.5} />
          </button>

          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setThemeModalOpen(true);
            }}
            aria-label={ui.theme.title}
            title={ui.theme.title}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-card text-accent transition-colors hover:border-accent/50"
          >
            <Palette className="h-4 w-4" strokeWidth={1.5} />
          </button>

          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              onOpenGeminiSettings?.();
            }}
            aria-label="Chave Google Gemini"
            title="Chave Google Gemini"
            className={`flex h-11 w-11 items-center justify-center rounded-full border transition-colors ${
              hasGeminiKey
                ? 'border-accent/50 bg-accent/15 text-accent'
                : 'border-line bg-card text-muted hover:border-accent/50 hover:text-ink'
            }`}
          >
            <Sparkles className="h-4 w-4" strokeWidth={1.5} />
          </button>

          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label={profileCfg.backup.menuLabel}
            aria-expanded={menuOpen}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-card text-muted transition-colors hover:border-accent/50 hover:text-ink"
          >
            <Settings className="h-4 w-4" strokeWidth={1.5} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-11 z-30 w-60 overflow-hidden rounded-2xl border border-line bg-card p-1.5 shadow-2xl">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onReopenOnboarding?.();
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-medium text-ink transition-colors hover:bg-elevated"
              >
                <BookOpen className="h-3.5 w-3.5 shrink-0 text-accent" />
                <span>Reabrir Boas-Vindas e Tutorial</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = !soundOn;
                  setSoundEnabled(next);
                  setSoundOn(next);
                  if (next) playTactileSound('tap');
                }}
                className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-medium text-ink transition-colors hover:bg-elevated"
              >
                <span className="inline-flex items-center gap-2.5">
                  {soundOn ? (
                    <Volume2 className="h-3.5 w-3.5 text-accent" />
                  ) : (
                    <VolumeX className="h-3.5 w-3.5 text-subtle" />
                  )}
                  Efeitos Sonoros Táteis
                </span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    soundOn
                      ? 'bg-accent/15 text-accent'
                      : 'bg-elevated text-subtle'
                  }`}
                >
                  {soundOn ? 'Ativo' : 'Mudo'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenGeminiSettings?.();
                }}
                className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-medium text-ink transition-colors hover:bg-elevated"
              >
                <span className="inline-flex items-center gap-2.5">
                  <Sparkles className="h-3.5 w-3.5 text-accent" />
                  Chave Google Gemini
                </span>
                <span
                  className={`h-2 w-2 rounded-full ${
                    hasGeminiKey ? 'bg-accent' : 'bg-line'
                  }`}
                />
              </button>
              <button
                type="button"
                onClick={() => {
                  onExportBackup();
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-medium text-ink transition-colors hover:bg-elevated"
              >
                <Download className="h-3.5 w-3.5 text-accent" />
                {profileCfg.backup.exportLabel}
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-medium text-ink transition-colors hover:bg-elevated"
              >
                <Upload className="h-3.5 w-3.5 text-accent" />
                {profileCfg.backup.importLabel}
              </button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </header>

      {feedback && (
        <div
          className={`rounded-xl border px-3 py-2 text-xs font-medium ${
            feedback.type === 'success'
              ? 'border-accent/40 bg-accent/10 text-accent'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-400'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Banner de Capa */}
      <section className="-mx-4 sm:-mx-6">
        <div className="relative h-28 sm:h-36 md:h-40 w-full overflow-hidden border-y border-line bg-card">
          {profile.coverUrl ? (
            <img
              src={profile.coverUrl}
              alt="Capa do perfil"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-accent/35 via-card to-elevated" />
          )}
          <button
            type="button"
            onClick={() => setEditModalOpen(true)}
            className="absolute right-3 top-2.5 inline-flex min-h-[36px] items-center gap-1 rounded-full bg-black/65 px-3 py-1.5 text-[11px] font-medium text-white backdrop-blur-xs transition-colors hover:bg-black/85"
          >
            <PenLine className="h-3.5 w-3.5" strokeWidth={1.5} />
            {profileCfg.editProfileLabel}
          </button>
        </div>

        {/* Avatar circular sobre a junção capa/contadores + 3 Métricas lado a lado */}
        <div className="px-4 sm:px-6">
          <div className="flex items-end gap-4 sm:gap-6">
            <div className="-mt-10 relative z-10 flex h-20 w-20 sm:h-24 sm:w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-accent bg-card ring-4 ring-[var(--bg-app)] shadow-lg">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.displayName || profile.handle}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-lg sm:text-xl font-bold tracking-tight text-ink">
                  {profile.avatarInitials || 'AK'}
                </span>
              )}
            </div>

            <div className="grid flex-1 grid-cols-3 pt-2 pb-1 text-center">
              {statsData.metrics.map((metric) => (
                <div key={metric.id} className="px-1">
                  <span className="block text-base sm:text-lg font-semibold tracking-tight text-ink">
                    {metric.value}
                  </span>
                  <span className="block text-[11px] text-muted">
                    {metric.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Nome, Bio & Link */}
          <div className="mt-3 space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-ink">{profile.displayName}</p>
              <span className="text-[11px] text-subtle">{profile.handle}</span>
            </div>
            {profile.bio && (
              <p className="leading-relaxed text-muted">{profile.bio}</p>
            )}
            {profile.linkLabel && (
              <a
                href={profile.linkUrl || '#'}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 pt-0.5 font-medium text-accent hover:opacity-80"
              >
                <Link2 className="h-3 w-3" />
                <span>{profile.linkLabel}</span>
              </a>
            )}
          </div>

          {/* Barra de Nível / XP do Leitor */}
          <div className="mt-3.5 rounded-2xl border border-line bg-card p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
                <span className="inline-flex items-center gap-1 rounded-lg bg-accent px-2 py-0.5 text-[11px] font-bold text-accent-ink">
                  <Zap className="h-3 w-3" />
                  {profileCfg.levelPrefix} {statsData.level}
                </span>
                <span className="text-muted font-medium">
                  {profileCfg.xpTitle}
                </span>
              </span>
              <span className="text-[11px] text-subtle">
                {statsData.currentLevelXp}/{statsData.xpPerLevel} XP
              </span>
            </div>

            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-elevated">
              <div
                className="h-full rounded-full bg-accent transition-all duration-500"
                style={{ width: `${Math.max(4, statsData.xpPct)}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* 3 Abas internas estilo feed do Instagram */}
      <section className="-mx-4 sm:-mx-6 pt-1">
        <div className="grid grid-cols-3 border-y border-line">
          {profileCfg.tabs.map((tab) => {
            const Icon = TAB_ICONS[tab.icon] || Grid3X3;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                aria-label={tab.label}
                className={`relative flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors ${
                  isActive ? 'text-ink' : 'text-subtle hover:text-muted'
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={isActive ? 2.1 : 1.75} />
                <span className="truncate">{tab.label}</span>
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent" />
                )}
              </button>
            );
          })}
        </div>

        {/* Aba 1: Feed de Postagens / Diário */}
        {activeTab === 'journal' && (
          posts.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm font-semibold text-ink">
                {profileCfg.emptyJournalTitle}
              </p>
              <p className="mx-auto mt-1 max-w-xs text-xs text-muted">
                {profileCfg.emptyJournalDescription}
              </p>
              <button
                type="button"
                onClick={() => onOpenJournalComposer(null)}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-semibold text-accent-ink transition-opacity hover:opacity-90"
              >
                <Camera className="h-3.5 w-3.5" />
                {profileCfg.emptyJournalCta}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-0.5 bg-app pt-0.5">
              {posts.map((post) => {
                const firstMedia = post.media?.[0];
                const hasMultiple = (post.media?.length || 0) > 1;
                const linked = post.itemId
                  ? items.find((i) => i.id === post.itemId)
                  : null;
                const fallbackItem = linked || post.itemSnapshot;

                return (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => setSelectedPostId(post.id)}
                    className="group relative aspect-square overflow-hidden bg-card text-left focus:outline-none"
                  >
                    {firstMedia?.type === 'image' || firstMedia?.type === 'gif' ? (
                      <img
                        src={firstMedia.url}
                        alt={post.title}
                        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                      />
                    ) : firstMedia?.type === 'video' ? (
                      <div className="flex h-full w-full flex-col items-center justify-center bg-elevated p-2 text-center">
                        <Film className="h-5 w-5 text-accent" />
                        <span className="mt-1 line-clamp-2 text-[10px] font-medium text-ink">
                          {post.title}
                        </span>
                      </div>
                    ) : fallbackItem ? (
                      <CoverArt
                        item={fallbackItem}
                        compact
                        className="h-full w-full rounded-none border-0"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-elevated p-2 text-center">
                        <span className="line-clamp-3 text-[10px] font-medium text-ink">
                          {post.title}
                        </span>
                      </div>
                    )}

                    {post.progressMarker && (
                      <span className="absolute left-1.5 top-1.5 max-w-[72%] truncate rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-medium text-accent backdrop-blur-xs">
                        {post.progressMarker}
                      </span>
                    )}

                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent p-1.5 pt-5">
                      <p className="truncate text-[10px] font-medium text-white">
                        {post.title}
                      </p>
                    </div>

                    {hasMultiple && (
                      <span className="absolute right-1.5 top-1.5 rounded bg-black/60 p-1 text-white backdrop-blur-xs">
                        <Layers className="h-3 w-3" />
                      </span>
                    )}
                    {!hasMultiple && firstMedia?.type === 'gif' && (
                      <span className="absolute right-1.5 top-1.5 rounded bg-black/70 px-1 py-0.5 text-[8px] font-bold text-accent backdrop-blur-xs">
                        GIF
                      </span>
                    )}
                    {!hasMultiple && firstMedia?.type === 'video' && (
                      <span className="absolute right-1.5 top-1.5 rounded bg-black/60 p-1 text-white backdrop-blur-xs">
                        <Film className="h-3 w-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )
        )}

        {/* Aba 2: Estante de Concluídos & Favoritos 5 Estrelas */}
        {activeTab === 'trophies' && (
          trophyItems.length === 0 ? (
            <div className="py-14 text-center text-xs text-subtle">
              {profileCfg.emptyTrophies}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-0.5 bg-app pt-0.5">
              {trophyItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectItem(item)}
                  className="group relative aspect-square overflow-hidden focus:outline-none"
                >
                  <CoverArt
                    item={item}
                    showTitle
                    compact
                    className="h-full w-full rounded-none border-0 transition-opacity group-hover:opacity-85"
                  />

                  <div className="absolute inset-x-1.5 top-1.5 flex items-center justify-between gap-1">
                    {item.isPlatinum ? (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-black/75 px-1.5 py-0.5 text-[9px] font-bold text-accent ring-1 ring-accent/50 backdrop-blur-xs">
                        <Star className="h-2.5 w-2.5 fill-current" />
                        5
                      </span>
                    ) : (
                      <span />
                    )}

                    {typeof item[cardFields.rating] === 'number' && (
                      <span className="rounded-md bg-black/75 px-1.5 py-0.5 text-[9px] font-semibold text-white backdrop-blur-xs">
                        {item[cardFields.rating]}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )
        )}

        {/* Aba 3: Radar / Na Estante */}
        {activeTab === 'radar' && (
          radarItems.length === 0 ? (
            <div className="py-14 text-center text-xs text-subtle">
              {profileCfg.emptyRadar}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-0.5 bg-app pt-0.5">
              {radarItems.map((item) => {
                const hype = getHypeMeta(item.hype);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectItem(item)}
                    className="group relative aspect-square overflow-hidden focus:outline-none"
                  >
                    <CoverArt
                      item={item}
                      showTitle
                      compact
                      className="h-full w-full rounded-none border-0 transition-opacity group-hover:opacity-85"
                    />
                    {hype && (
                      <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[9px] font-medium text-white backdrop-blur-xs">
                        <VectorIcon name={hype.icon} className="h-2.5 w-2.5 text-accent" />
                        {hype.label}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )
        )}
      </section>

      <ThemeModal
        isOpen={themeModalOpen}
        onClose={() => setThemeModalOpen(false)}
        {...themeProps}
      />

      <ProfileEditModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        profile={profile}
        onSave={onUpdateProfile}
      />

      <PostDetailModal
        post={selectedPost}
        profile={profile}
        linkedItem={selectedPostLinkedItem}
        onClose={() => setSelectedPostId(null)}
        onSelectItem={onSelectItem}
        onDeletePost={onDeletePost}
        onAddComment={onAddPostComment}
        onDeleteComment={onDeletePostComment}
      />
    </div>
  );
}
