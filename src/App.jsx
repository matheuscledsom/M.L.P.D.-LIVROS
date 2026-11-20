import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AuthModal } from './components/auth/AuthModal';
import { BackupRestoreModal } from './components/BackupRestoreModal';
import { BottomNav } from './components/BottomNav';
import { GeminiConfigModal } from './components/GeminiConfigModal';
import { ItemDetailSheet } from './components/ItemDetailSheet';
import { JournalComposerModal } from './components/JournalComposerModal';
import { OnboardingFlow } from './components/OnboardingFlow';
import { DigitalShelfModal } from './components/reader/DigitalShelfModal';
import { CommunityScreen } from './components/social/CommunityScreen';
import { DirectChatDrawer } from './components/social/DirectChatDrawer';
import { UserProfileModal } from './components/social/UserProfileModal';
import { formatExactPercent } from './components/reader/useReaderProgress';
import { useToast } from './context/ToastContext';
import { useAiConfig } from './hooks/useAiConfig';
import { useBacklog } from './hooks/useBacklog';
import { useReadingStreak } from './hooks/useReadingStreak';
import { useSocialProfile } from './hooks/useSocialProfile';
import { useTheme } from './hooks/useTheme';
import {
  mergeSnapshots,
  saveAutoSnapshot,
} from './services/backupEngine';
import {
  bootstrapBackend,
  ensureLocalCommunitySeeded,
  getBackendMode,
  getUnreadMessagesCount,
  listDirectConversations,
  listDirectMessages,
  listWallPosts,
  syncActiveWorkspaceToBackend,
  updateActiveProfileInBackend,
} from './services/codiceBackend';
import {
  buildCodiceDatabase,
  createUuid,
  persistCodiceDatabase,
} from './services/codiceDatabase';
import { evaluateReaderTitles } from './services/readerTitlesEngine';
import {
  deleteBookFile,
  listStoredBookIds,
  listStoredReaderBooks,
} from './services/readerStorage';
import { AddScreen } from './screens/AddScreen';
import { HomeScreen } from './screens/HomeScreen';
import { ListScreen } from './screens/ListScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { StatsScreen } from './screens/StatsScreen';

const ReaderShell = lazy(() =>
  import('./components/reader/ReaderShell').then((m) => ({
    default: m.ReaderShell,
  }))
);

export function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [geminiModalOpen, setGeminiModalOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [backupModalOpen, setBackupModalOpen] = useState(false);
  const [digitalShelfOpen, setDigitalShelfOpen] = useState(false);
  const [onboardingReopened, setOnboardingReopened] = useState(false);
  const [storedReaderWorkIds, setStoredReaderWorkIds] = useState([]);
  const [storedReaderBooks, setStoredReaderBooks] = useState([]);
  const [backendReady, setBackendReady] = useState(false);
  const [backendSession, setBackendSession] = useState(() => ({
    mode: getBackendMode(),
    authenticated: false,
    user: null,
    profile: null,
  }));
  const [readerSession, setReaderSession] = useState({
    open: false,
    workId: null,
    initialBookId: null,
    initialFile: null,
  });
  const [journalComposer, setJournalComposer] = useState({
    open: false,
    itemId: null,
  });
  const [viewingUserProfileId, setViewingUserProfileId] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatPeerId, setChatPeerId] = useState(null);
  const [unreadDmCount, setUnreadDmCount] = useState(0);
  const [socialCounts, setSocialCounts] = useState({
    wallPostsCount: 0,
    chatMessagesCount: 0,
  });

  const { showToast } = useToast();

  const {
    mode,
    font,
    texture,
    presetId,
    bgColor,
    accentColor,
    hasCustomBg,
    setMode,
    setFont,
    setTexture,
    applyPreset,
    setCustomBgColor,
    setCustomAccentColor,
    resetCustomColors,
  } = useTheme();

  const aiConfig = useAiConfig();
  const geminiKey = aiConfig.geminiKey;
  const hasGeminiKey = aiConfig.hasGeminiKey;
  const saveApiKey = useCallback(
    (key) => aiConfig.saveProviderKey('gemini', key),
    [aiConfig]
  );
  const clearApiKey = useCallback(
    () => aiConfig.clearProviderKey('gemini'),
    [aiConfig]
  );

  const {
    items,
    readingSessions,
    addItem,
    updateItem,
    removeItem,
    addReadingSession,
    replaceWorkspaceData,
    exportBackup,
    exportCatalogCsv,
    exportReferencesBibtex,
    importBackup,
  } = useBacklog();
  const {
    profile,
    posts,
    updateProfile,
    addPost,
    deletePost,
    addPostComment,
    deletePostComment,
    restoreSocialBackup,
  } = useSocialProfile();
  const {
    streakData,
    streakCount,
    loggedToday,
    isPaused,
    history,
    registerToday,
    restoreStreakBackup,
  } = useReadingStreak();

  const bootSnapshotRef = useRef({
    profile,
    items,
    posts,
    streak: streakData,
    readingSessions,
  });

  useEffect(() => {
    let active = true;
    bootstrapBackend(bootSnapshotRef.current)
      .then((res) => {
        if (!active) return;
        setBackendSession({
          mode: res.mode,
          authenticated: Boolean(res.authenticated),
          user: res.user || null,
          profile: res.profile || null,
        });
        if (res.mode === 'supabase' && res.profile) {
          restoreSocialBackup({ profile: res.profile });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setBackendReady(true);
      });
    return () => {
      active = false;
    };
  }, [restoreSocialBackup]);

  useEffect(() => {
    if (!backendReady) return undefined;
    const timer = setTimeout(() => {
      syncActiveWorkspaceToBackend({
        profile,
        items,
        posts,
        streak: streakData,
        readingSessions,
      }).catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [backendReady, profile, items, posts, streakData, readingSessions]);

  const handleUpdateProfileWithSync = useCallback(
    (updates, toastMessage = 'Perfil atualizado') => {
      updateProfile(updates);
      const mergedProfile = { ...profile, ...updates };
      updateActiveProfileInBackend(mergedProfile)
        .then((synced) => {
          if (synced) {
            setBackendSession((prev) => ({ ...prev, profile: synced }));
          }
        })
        .catch(() => {});
      if (toastMessage) {
        showToast({ message: toastMessage, type: 'success' });
      }
    },
    [profile, updateProfile, showToast]
  );

  const handleAuthSuccess = useCallback(
    (result) => {
      if (!result) return;
      setBackendSession({
        mode: result.mode || getBackendMode(),
        authenticated: Boolean(result.user),
        user: result.user || null,
        profile: result.profile || null,
      });

      if (result.profile && result.workspace) {
        replaceWorkspaceData({
          items: result.workspace.items || [],
          readingSessions: result.workspace.readingSessions || [],
        });
        restoreSocialBackup({
          profile: result.profile,
          posts: result.workspace.posts || [],
        });
        restoreStreakBackup(
          result.workspace.streak || { count: 0, lastDate: null, history: [] }
        );
        showToast({
          message:
            result.mode === 'supabase'
              ? `Conectado como ${result.profile.handle}`
              : `Perfil ativo: ${result.profile.handle}`,
          type: 'success',
        });
      } else if (result.authenticated === false) {
        showToast({ message: 'Sessão encerrada', type: 'info' });
      }
    },
    [replaceWorkspaceData, restoreSocialBackup, restoreStreakBackup, showToast]
  );

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) ?? null,
    [items, selectedItemId]
  );

  const readerWork = useMemo(
    () => items.find((item) => item.id === readerSession.workId) ?? null,
    [items, readerSession.workId]
  );

  const refreshStoredBookIds = useCallback(() => {
    listStoredBookIds()
      .then((ids) => setStoredReaderWorkIds(ids))
      .catch(() => {});
    listStoredReaderBooks(items)
      .then((books) => setStoredReaderBooks(books))
      .catch(() => {});
  }, [items]);

  useEffect(() => {
    refreshStoredBookIds();
  }, [readerSession.open, refreshStoredBookIds]);

  const handleOpenReaderForWork = useCallback((work, file = null) => {
    if (!work) return;
    setSelectedItemId(null);
    setReaderSession({
      open: true,
      workId: work.id,
      initialBookId: null,
      initialFile: file,
    });
  }, []);

  const handleOpenQuickReader = useCallback((file = null) => {
    setSelectedItemId(null);
    setReaderSession({
      open: true,
      workId: null,
      initialBookId: null,
      initialFile: file,
    });
  }, []);

  const handleOpenStoredBook = useCallback((entry) => {
    if (!entry) return;
    setSelectedItemId(null);
    setDigitalShelfOpen(false);
    setReaderSession({
      open: true,
      workId: entry.workId || null,
      initialBookId: entry.workId ? null : entry.bookId,
      initialFile: null,
    });
  }, []);

  const handlePersistReaderState = useCallback(
    (workId, nextReaderState) => {
      if (!workId || !nextReaderState) return;
      const existing = items.find((entry) => entry.id === workId);
      const pos = nextReaderState.position || {};
      const nextTotal =
        Number(pos.totalPages) > 0
          ? Number(pos.totalPages)
          : Number(existing?.totalPages) || 0;
      const nextPct = Math.max(0, Math.min(100, Number(pos.progressPct) || 0));
      const nextPage = Math.max(0, Number(pos.page) || 0);

      updateItem(workId, {
        readerState: nextReaderState,
        progressPercent: nextPct,
        updatedAt: nextReaderState.lastReadAt || new Date().toISOString(),
        ...(nextTotal > 0
          ? {
              totalPages: nextTotal,
              currentPage:
                nextPage > 0
                  ? Math.min(nextTotal, nextPage)
                  : Math.max(1, Math.round((nextPct / 100) * nextTotal)),
            }
          : { progressMode: 'percent' }),
        ...(existing?.status === 'queued' && (nextPct > 0 || nextPage > 0)
          ? { status: 'playing' }
          : {}),
      });
    },
    [items, updateItem]
  );

  const handleSyncWorkProgress = useCallback(
    (work, endPosition) => {
      if (!work?.id || !endPosition) return;
      const prevSnapshot = {
        currentPage: work.currentPage,
        totalPages: work.totalPages,
        progress: work.progress,
        progressMode: work.progressMode,
        progressPercent: work.progressPercent,
        status: work.status,
        completedDate: work.completedDate,
      };

      const nextPage = Math.max(0, Number(endPosition.page) || 0);
      const nextTotal =
        Number(endPosition.totalPages) > 0
          ? Number(endPosition.totalPages)
          : work.totalPages;
      const nextPct = Math.max(
        0,
        Math.min(100, Number(endPosition.progressPct) || 0)
      );
      const resolvedTotal = Number(nextTotal) || 0;

      const updates = {
        currentPage:
          resolvedTotal > 0 && nextPage > 0
            ? Math.min(resolvedTotal, nextPage)
            : resolvedTotal > 0 && nextPct > 0
              ? Math.round((nextPct / 100) * resolvedTotal)
              : work.currentPage || 0,
        progressPercent: nextPct,
        ...(resolvedTotal > 0 ? { totalPages: resolvedTotal } : { progressMode: 'percent' }),
        ...(work.status === 'queued' && (nextPage > 0 || nextPct > 0)
          ? { status: 'playing' }
          : {}),
      };

      updateItem(work.id, updates);

      const summaryLabel =
        nextPage > 0 && resolvedTotal > 0
          ? `Pág. ${nextPage}/${resolvedTotal} · ${formatExactPercent(nextPct)}`
          : formatExactPercent(nextPct);

      showToast({
        message: `Atualizar progresso da obra (${summaryLabel})`,
        type: 'info',
        duration: 5000,
        action: {
          label: 'Desfazer',
          onClick: () => {
            updateItem(work.id, prevSnapshot);
          },
        },
      });
    },
    [updateItem, showToast]
  );

  const handleSaveQuoteFromReader = useCallback(
    (work, quotePayload) => {
      if (!work?.id || !quotePayload?.text) return;
      const existingQuotes = Array.isArray(work.quotes) ? work.quotes : [];
      const quoteId = quotePayload.id || createUuid();
      const idx = existingQuotes.findIndex(
        (q) =>
          q.id === quoteId ||
          (quotePayload.cfi && q.cfi && q.cfi === quotePayload.cfi) ||
          (q.text === quotePayload.text &&
            q.location === (quotePayload.location || ''))
      );

      const nextEntry = {
        id: quoteId,
        text: quotePayload.text,
        location: quotePayload.location || '',
        cfi: quotePayload.cfi || '',
        page: quotePayload.page ?? null,
        sectionId: quotePayload.sectionId || '',
        sectionIndex:
          typeof quotePayload.sectionIndex === 'number'
            ? quotePayload.sectionIndex
            : null,
        startOffset:
          typeof quotePayload.startOffset === 'number'
            ? quotePayload.startOffset
            : null,
        endOffset:
          typeof quotePayload.endOffset === 'number'
            ? quotePayload.endOffset
            : null,
        color: quotePayload.color || 'amber',
        note: typeof quotePayload.note === 'string' ? quotePayload.note : '',
        createdAt:
          idx >= 0 ? existingQuotes[idx].createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (idx >= 0) {
        const updatedQuotes = [...existingQuotes];
        updatedQuotes[idx] = { ...updatedQuotes[idx], ...nextEntry };
        updateItem(work.id, { quotes: updatedQuotes });
      } else {
        updateItem(work.id, { quotes: [nextEntry, ...existingQuotes] });
      }
    },
    [updateItem]
  );

  const handlePublishQuoteFromReader = useCallback(
    (work, quotePayload) => {
      if (!quotePayload?.text) return;
      const cleanQuote = String(quotePayload.text).trim();
      const cleanNote = String(quotePayload.note || '').trim();
      const workTitle = work?.title || quotePayload.bookTitle || 'Leitura no Códice';
      const caption = cleanNote
        ? `"${cleanQuote}"\n\nNota: ${cleanNote}`
        : `"${cleanQuote}"`;

      addPost({
        itemId: work?.id || null,
        itemTitle: workTitle,
        itemSnapshot: work
          ? {
              id: work.id,
              title: work.title,
              author: work.author,
              coverUrl: work.coverUrl,
              workType: work.workType,
            }
          : null,
        progressMarker: quotePayload.location || '',
        title: `Trecho de ${workTitle}`,
        caption,
        highlightColor: quotePayload.color || 'amber',
        visibility: profile?.privacyLevel || 'public',
      });

      const isPrivate = profile?.privacyLevel === 'private';
      showToast({
        message: isPrivate
          ? 'Trecho salvo no seu Diário privado'
          : 'Trecho publicado no Diário',
        type: 'success',
      });
    },
    [addPost, profile?.privacyLevel, showToast]
  );

  const handleAddItem = (newItem) => {
    addItem(newItem);
    showToast({
      message:
        newItem?.status === 'completed'
          ? 'Obra catalogada como Concluída'
          : 'Obra salva no acervo',
      type: 'success',
    });
  };

  const handleUpdateItem = (id, updates) => {
    const prev = items.find((entry) => entry.id === id);
    updateItem(id, updates);
    if (updates?.status === 'completed' && prev?.status !== 'completed') {
      showToast({
        message: 'Leitura concluída com sucesso',
        type: 'success',
      });
    }
  };

  const handleRemoveItem = (id) => {
    removeItem(id);
    deleteBookFile(id);
    showToast({ message: 'Obra removida do acervo', type: 'info' });
  };

  const handleOpenJournalComposer = (itemId = null) => {
    setJournalComposer({ open: true, itemId });
  };

  const handlePublishPost = (postData) => {
    addPost(postData);
    setActiveTab('profile');
    showToast({ message: 'Momento publicado no Diário', type: 'success' });
  };

  const handleExportBackup = async () => {
    await exportBackup({ profile, posts, streak: streakData });
    showToast({
      message: 'Backup v4.0 (.json + SHA-256) exportado',
      type: 'success',
    });
  };

  const handleExportCsv = () => {
    exportCatalogCsv({ profile, posts, streak: streakData });
    showToast({ message: 'Catálogo (.csv) exportado', type: 'success' });
  };

  const handleExportBibtex = () => {
    exportReferencesBibtex({ profile, posts, streak: streakData });
    showToast({ message: 'Referências (.bib) exportadas', type: 'success' });
  };

  const handleImportBackup = async (file) => {
    const result = await importBackup(file);
    if (result.ok) {
      restoreSocialBackup({ profile: result.profile, posts: result.posts });
      restoreStreakBackup(result.streak);
      const orphanCount = result.integrity?.orphanCount || 0;
      showToast({
        message:
          orphanCount > 0
            ? `Backup restaurado (${result.count} obras, ${orphanCount} órfão(s) sinalizado(s))`
            : `Backup restaurado (${result.count} obras)`,
        type: 'success',
      });
    } else {
      showToast({ message: result.error, type: 'error' });
    }
    return result;
  };

  const handleApplyRestoreSnapshot = useCallback(
    async (incomingSnapshot, mode = 'merge') => {
      if (!incomingSnapshot) return;
      if (mode === 'replace') {
        await saveAutoSnapshot(
          { items, profile, posts, streak: streakData, readingSessions },
          { reason: 'pre-restore', label: 'Pré-restauração automática', force: true }
        ).catch(() => {});

        replaceWorkspaceData({
          items: incomingSnapshot.items || [],
          readingSessions: incomingSnapshot.readingSessions || [],
        });
        restoreSocialBackup({
          profile: incomingSnapshot.profile,
          posts: incomingSnapshot.posts || [],
        });
        restoreStreakBackup(
          incomingSnapshot.streak || { count: 0, lastDate: null, history: [] }
        );
        showToast({
          message: `Acervo restaurado (${incomingSnapshot.items?.length || 0} obras)`,
          type: 'success',
        });
        return;
      }

      const merged = mergeSnapshots(
        { items, profile, posts, streak: streakData, readingSessions },
        incomingSnapshot
      );
      replaceWorkspaceData({
        items: merged.items,
        readingSessions: merged.readingSessions,
      });
      restoreSocialBackup({
        profile: merged.profile,
        posts: merged.posts,
      });
      restoreStreakBackup(merged.streak);
      showToast({
        message: `Backup mesclado com sucesso (${merged.items.length} obras no acervo)`,
        type: 'success',
      });
    },
    [
      items,
      profile,
      posts,
      streakData,
      readingSessions,
      replaceWorkspaceData,
      restoreSocialBackup,
      restoreStreakBackup,
      showToast,
    ]
  );

  useEffect(() => {
    const db = buildCodiceDatabase({
      items,
      profile,
      posts,
      streak: streakData,
      readingSessions,
    });
    persistCodiceDatabase(db);
  }, [items, profile, posts, streakData, readingSessions]);

  useEffect(() => {
    if (!items || items.length === 0) return undefined;
    const timer = setTimeout(() => {
      saveAutoSnapshot(
        { items, profile, posts, streak: streakData, readingSessions },
        { reason: 'auto', label: 'Auto-snapshot automático' }
      ).catch(() => {});
    }, 8000);
    return () => clearTimeout(timer);
  }, [items, profile, posts, streakData, readingSessions]);

  const handleRegisterToday = () => {
    registerToday();
    showToast({ message: 'Constância de leitura registrada hoje', type: 'success' });
  };

  const activeViewerId =
    backendSession?.user?.id || backendSession?.profile?.id || profile?.id || null;

  const refreshSocialSignals = useCallback(() => {
    if (!backendReady) return;
    ensureLocalCommunitySeeded()
      .then(() =>
        Promise.all([
          getUnreadMessagesCount({ viewerId: activeViewerId }),
          listWallPosts(activeViewerId || 'local-default', {
            viewerId: activeViewerId,
          }),
          listDirectConversations({ viewerId: activeViewerId }),
        ])
      )
      .then(async ([unread, wallList, convs]) => {
        setUnreadDmCount(Number(unread) || 0);
        let msgCount = 0;
        if (Array.isArray(convs) && convs.length > 0) {
          const threads = await Promise.all(
            convs.map((c) =>
              listDirectMessages(c.peerId, { viewerId: activeViewerId }).catch(() => [])
            )
          );
          msgCount = threads.reduce(
            (sum, list) =>
              sum +
              (Array.isArray(list)
                ? list.filter((m) => m.senderId === (activeViewerId || 'local-default')).length
                : 0),
            0
          );
        }
        setSocialCounts({
          wallPostsCount: Array.isArray(wallList) ? wallList.length : 0,
          chatMessagesCount: msgCount,
        });
      })
      .catch(() => {});
  }, [backendReady, activeViewerId]);

  useEffect(() => {
    refreshSocialSignals();
  }, [refreshSocialSignals]);

  const resolvedTitleBadge = useMemo(
    () =>
      evaluateReaderTitles({
        items,
        profile,
        readingSessions,
        streakCount,
        posts,
        wallPostsCount: socialCounts.wallPostsCount,
        chatMessagesCount: socialCounts.chatMessagesCount,
        storedReaderBooksCount: storedReaderWorkIds.length,
      })?.resolvedActiveBadge?.name || '',
    [
      items,
      profile,
      readingSessions,
      streakCount,
      posts,
      socialCounts,
      storedReaderWorkIds.length,
    ]
  );

  const handleOpenDirectChat = useCallback((peerId = null) => {
    setChatPeerId(peerId || null);
    setChatOpen(true);
  }, []);

  const handleCopyWorkToWishlist = useCallback(
    (work) => {
      if (!work?.title) return;
      const alreadyExists = items.some(
        (i) =>
          String(i.title || '').trim().toLowerCase() ===
          String(work.title || '').trim().toLowerCase()
      );
      if (alreadyExists) {
        showToast({
          message: `"${work.title}" já faz parte do seu acervo.`,
          type: 'info',
        });
        return;
      }
      addItem({
        ...work,
        id: createUuid(),
        status: 'queued',
        isWishlist: true,
        access: 'Wishlist',
        inBacklog: true,
        currentPage: 0,
        currentChapter: 0,
        progress: 0,
        rating: null,
        verdict: null,
        notes: work.notes ? `Referência externa: ${work.notes}` : '',
        addedAt: new Date().toISOString(),
      });
      showToast({
        message: `"${work.title}" copiada para sua Lista de Desejos.`,
        type: 'success',
      });
    },
    [items, addItem, showToast]
  );

  const handleRecommendWorkToFeed = useCallback(
    (work, noteText = '') => {
      if (!work?.title) return;
      addPost({
        itemId: work.id || null,
        itemTitle: work.title,
        itemSnapshot: {
          title: work.title,
          author: work.author || work.creator || '',
          publisher: work.publisher || '',
          coverUrl: work.coverUrl || null,
        },
        title: `Indicação de leitura: ${work.title}`,
        caption:
          noteText ||
          `Recomendo a leitura de "${work.title}"${work.author ? ` (${work.author})` : ''}.`,
        visibility: profile?.privacyLevel === 'private' ? 'private' : 'public',
      });
      refreshSocialSignals();
      showToast({
        message: `"${work.title}" indicada no Diário e Feed`,
        type: 'success',
      });
    },
    [addPost, profile?.privacyLevel, refreshSocialSignals, showToast]
  );

  const handleSelectOrAddFromRecommendation = useCallback(
    (recItem) => {
      if (!recItem) return;
      const existing = items.find(
        (i) =>
          i.id === recItem.id ||
          String(i.title || '').trim().toLowerCase() ===
            String(recItem.title || '').trim().toLowerCase()
      );
      if (existing) {
        setSelectedItemId(existing.id);
      } else {
        handleCopyWorkToWishlist(recItem);
      }
    },
    [items, handleCopyWorkToWishlist]
  );

  const streakProps = {
    streakCount,
    loggedToday,
    isPaused,
    history,
    onRegisterToday: handleRegisterToday,
  };

  const textureClass =
    texture === 'paper'
      ? 'app-texture-paper'
      : texture === 'grid'
        ? 'app-texture-grid'
        : texture === 'glow'
          ? 'app-texture-glow'
          : '';

  const handleGlobalDrop = (e) => {
    if (readerSession.open) return;
    const dropped = e.dataTransfer?.files?.[0];
    if (!dropped) return;
    const isBookCandidate =
      /\.(pdf|epub|cbz|cbr|txt|md|markdown)$/i.test(dropped.name || '') ||
      dropped.type === 'application/pdf' ||
      dropped.type === 'application/epub+zip' ||
      dropped.type === 'text/plain' ||
      dropped.type === 'text/markdown';
    if (!isBookCandidate) return;
    e.preventDefault();
    if (selectedItem) {
      handleOpenReaderForWork(selectedItem, dropped);
    } else {
      handleOpenQuickReader(dropped);
    }
  };

  return (
    <div
      onDragOver={(e) => {
        if (!readerSession.open && e.dataTransfer?.types?.includes('Files')) {
          e.preventDefault();
        }
      }}
      onDrop={handleGlobalDrop}
      className="relative min-h-screen bg-app text-ink transition-colors duration-200"
    >
      {textureClass && (
        <div
          aria-hidden="true"
          className={`app-texture-overlay ${textureClass}`}
        />
      )}
      <div className="relative z-10 mx-auto min-h-screen max-w-md md:max-w-2xl lg:max-w-4xl bg-transparent sm:border-x sm:border-line/60">
        <main className="px-4 sm:px-6 pt-4 pb-[env(safe-area-inset-bottom)]">
          {activeTab === 'home' && (
            <HomeScreen
              items={items}
              profile={profile}
              streakProps={streakProps}
              resolvedBadgeName={resolvedTitleBadge}
              viewerId={activeViewerId}
              geminiKey={geminiKey}
              storedReaderWorkIds={storedReaderWorkIds}
              storedReaderBooks={storedReaderBooks}
              onSelectItem={handleSelectOrAddFromRecommendation}
              onOpenReader={handleOpenReaderForWork}
              onOpenStoredBook={handleOpenStoredBook}
              onOpenQuickReader={handleOpenQuickReader}
              onOpenDigitalShelf={() => setDigitalShelfOpen(true)}
              onAddToWishlist={handleCopyWorkToWishlist}
              onNavigateList={() => setActiveTab('list')}
              onNavigateAdd={() => setActiveTab('add')}
              onOpenGeminiSettings={() => setGeminiModalOpen(true)}
            />
          )}
          {activeTab === 'stats' && <StatsScreen items={items} />}
          {activeTab === 'add' && (
            <AddScreen
              items={items}
              geminiKey={geminiKey}
              onAddItem={handleAddItem}
              onSelectExisting={(item) => setSelectedItemId(item.id)}
              onOpenGeminiSettings={() => setGeminiModalOpen(true)}
            />
          )}
          {activeTab === 'list' && (
            <ListScreen
              items={items}
              profile={profile}
              streakProps={streakProps}
              geminiKey={geminiKey}
              storedReaderWorkIds={storedReaderWorkIds}
              onSelectItem={(item) => setSelectedItemId(item.id)}
              onOpenReader={handleOpenReaderForWork}
              onOpenDigitalShelf={() => setDigitalShelfOpen(true)}
              onNavigateAdd={() => setActiveTab('add')}
              onOpenGeminiSettings={() => setGeminiModalOpen(true)}
            />
          )}
          {activeTab === 'community' && (
            <CommunityScreen
              viewerId={activeViewerId}
              unreadDmCount={unreadDmCount}
              onOpenUserProfile={(id) => setViewingUserProfileId(id)}
              onOpenDirectChat={handleOpenDirectChat}
            />
          )}
          {activeTab === 'profile' && (
            <ProfileScreen
              items={items}
              profile={profile}
              posts={posts}
              readingSessions={readingSessions}
              streakCount={streakCount}
              viewerId={activeViewerId}
              storedReaderBooksCount={storedReaderWorkIds.length}
              wallPostsCount={socialCounts.wallPostsCount}
              chatMessagesCount={socialCounts.chatMessagesCount}
              geminiKey={geminiKey}
              hasGeminiKey={aiConfig.hasAnyAiKey || hasGeminiKey}
              aiConfig={aiConfig}
              backendSession={backendSession}
              onOpenAuthModal={() => setAuthModalOpen(true)}
              onOpenGeminiSettings={() => setGeminiModalOpen(true)}
              onSaveGeminiKey={(key) => {
                saveApiKey(key);
                showToast({
                  message: key ? 'Chave Google Gemini salva' : 'Chave Gemini removida',
                  type: 'success',
                });
              }}
              onReopenOnboarding={() => setOnboardingReopened(true)}
              themeProps={{
                mode,
                font,
                texture,
                presetId,
                bgColor,
                accentColor,
                hasCustomBg,
                onSelectMode: setMode,
                onSelectFont: setFont,
                onSelectTexture: setTexture,
                onApplyPreset: applyPreset,
                onChangeBgColor: setCustomBgColor,
                onChangeAccentColor: setCustomAccentColor,
                onResetTheme: resetCustomColors,
              }}
              onUpdateProfile={(updates) =>
                handleUpdateProfileWithSync(updates, 'Perfil atualizado')
              }
              onSelectItem={(item) => setSelectedItemId(item.id)}
              onOpenJournalComposer={handleOpenJournalComposer}
              onDeletePost={deletePost}
              onAddPostComment={addPostComment}
              onDeletePostComment={deletePostComment}
              onExportBackup={handleExportBackup}
              onExportCsv={handleExportCsv}
              onExportBibtex={handleExportBibtex}
              onImportBackup={handleImportBackup}
              onOpenBackupModal={() => setBackupModalOpen(true)}
              onWallMutated={refreshSocialSignals}
              onSelectPeerProfile={(id) => setViewingUserProfileId(id)}
            />
          )}
        </main>

        <BottomNav
          activeTab={activeTab}
          onChangeTab={setActiveTab}
          unreadDmCount={unreadDmCount}
        />

        <ItemDetailSheet
          item={selectedItem}
          posts={posts}
          geminiKey={geminiKey}
          viewerId={activeViewerId}
          hasStoredFile={Boolean(
            selectedItem && storedReaderWorkIds.includes(selectedItem.id)
          )}
          onClose={() => setSelectedItemId(null)}
          onUpdateItem={handleUpdateItem}
          onRemoveItem={handleRemoveItem}
          onOpenJournal={handleOpenJournalComposer}
          onOpenReader={handleOpenReaderForWork}
          onOpenGeminiSettings={() => setGeminiModalOpen(true)}
          onRecommendToFeed={handleRecommendWorkToFeed}
          onSocialActivityChanged={refreshSocialSignals}
        />

        {readerSession.open && (
          <Suspense
            fallback={
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-app text-xs text-muted">
                Carregando Leitor Códice...
              </div>
            }
          >
            <ReaderShell
              isOpen={readerSession.open}
              work={readerWork}
              initialBookId={readerSession.initialBookId}
              initialFile={readerSession.initialFile}
              onClose={() =>
                setReaderSession({
                  open: false,
                  workId: null,
                  initialBookId: null,
                  initialFile: null,
                })
              }
              onPersistReaderState={handlePersistReaderState}
              onRecordSession={addReadingSession}
              onSyncWorkProgress={handleSyncWorkProgress}
              onSaveQuoteFromReader={handleSaveQuoteFromReader}
              onPublishQuoteFromReader={handlePublishQuoteFromReader}
            />
          </Suspense>
        )}

        <JournalComposerModal
          isOpen={journalComposer.open}
          onClose={() => setJournalComposer({ open: false, itemId: null })}
          items={items}
          initialItemId={journalComposer.itemId}
          onPublish={handlePublishPost}
        />

        <GeminiConfigModal
          isOpen={geminiModalOpen}
          onClose={() => setGeminiModalOpen(false)}
          apiKey={geminiKey}
          aiConfig={aiConfig}
          onSaveKey={(key) => {
            saveApiKey(key);
            showToast({
              message: key ? 'Chave Google Gemini salva' : 'Chave Gemini removida',
              type: 'success',
            });
          }}
          onClearKey={() => {
            clearApiKey();
            showToast({ message: 'Chave Gemini removida', type: 'info' });
          }}
        />

        <OnboardingFlow
          isOpen={!profile.onboardingCompleted || onboardingReopened}
          canDismiss={Boolean(profile.onboardingCompleted)}
          profile={profile}
          geminiKey={geminiKey}
          onSelectThemeMode={setMode}
          onApplyThemePreset={applyPreset}
          onChangeAccentColor={setCustomAccentColor}
          onSaveGeminiKey={saveApiKey}
          onImportBackup={handleImportBackup}
          onComplete={(updates) => {
            handleUpdateProfileWithSync(updates, 'Perfil do leitor salvo');
            setOnboardingReopened(false);
          }}
          onDismiss={() => setOnboardingReopened(false)}
        />

        <BackupRestoreModal
          isOpen={backupModalOpen}
          onClose={() => setBackupModalOpen(false)}
          currentWorkspace={{
            items,
            profile,
            posts,
            streak: streakData,
            readingSessions,
          }}
          onExportBackup={handleExportBackup}
          onExportCsv={handleExportCsv}
          onExportBibtex={handleExportBibtex}
          onApplyRestore={handleApplyRestoreSnapshot}
        />

        <DigitalShelfModal
          isOpen={digitalShelfOpen}
          onClose={() => setDigitalShelfOpen(false)}
          works={items}
          onOpenStoredBook={handleOpenStoredBook}
          onSyncLinkedWork={(targetWork, extractedPosition) => {
            if (extractedPosition) {
              handleSyncWorkProgress(targetWork, extractedPosition);
            }
          }}
          onShelfMutated={refreshStoredBookIds}
        />

        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          backendSession={backendSession}
          currentWorkspace={{
            profile,
            items,
            posts,
            streak: streakData,
            readingSessions,
          }}
          onAuthSuccess={handleAuthSuccess}
        />

        <UserProfileModal
          isOpen={Boolean(viewingUserProfileId)}
          profileId={viewingUserProfileId}
          viewerId={activeViewerId}
          onClose={() => setViewingUserProfileId(null)}
          onOpenDirectChat={(peerId) => {
            setViewingUserProfileId(null);
            handleOpenDirectChat(peerId);
          }}
          onCopyBookToWishlist={handleCopyWorkToWishlist}
          onSelectPeerProfile={(id) => setViewingUserProfileId(id)}
          onFollowChanged={refreshSocialSignals}
        />

        <DirectChatDrawer
          isOpen={chatOpen}
          onClose={() => setChatOpen(false)}
          viewerId={activeViewerId}
          initialPeerId={chatPeerId}
          myShelfItems={items}
          onCopyBookToWishlist={handleCopyWorkToWishlist}
          onUnreadChanged={refreshSocialSignals}
        />
      </div>
    </div>
  );
}

export default App;
