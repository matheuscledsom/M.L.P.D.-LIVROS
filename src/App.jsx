import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { UserCheck, UserPlus, X } from 'lucide-react';
import { BottomNav } from './components/BottomNav';
import { ErrorBoundary } from './components/ErrorBoundary';
import { formatExactPercent } from './components/reader/useReaderProgress';
import { GraphicFilters } from './design/GraphicFilters';
import { useToast } from './context/ToastContext';
import { useAiConfig } from './hooks/useAiConfig';
import { useBacklog } from './hooks/useBacklog';
import { useReadingStreak } from './hooks/useReadingStreak';
import { useSocialProfile } from './hooks/useSocialProfile';
import { useTheme } from './hooks/useTheme';
import {
  getBackupReminderStatus,
  listAutoSnapshots,
  mergeSnapshots,
  requestPersistentStorage,
  saveAutoSnapshot,
  saveEmergencyMirror,
  shareOrDownloadSignedBackup,
} from './services/backupEngine';
import {
  decodePublicProfileCard,
  listSavedPeerCards,
  removeSavedPeerCard,
  savePeerProfileCard,
} from './services/peerProfileShare';
import {
  bootstrapBackend,
  ensureLocalCommunitySeeded,
  followReader,
  getBackendMode,
  getUnreadMessagesCount,
  listDirectConversations,
  listDirectMessages,
  listWallPosts,
  parseInviteHandleParam,
  resolveInviteProfile,
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
  listStoredBookIds,
  listStoredReaderBooks,
  removeStoredReaderBook,
} from './services/readerStorage';
import { HomeScreen } from './screens/HomeScreen';

const StatsScreen = lazy(() =>
  import('./screens/StatsScreen').then((m) => ({ default: m.StatsScreen }))
);
const AddScreen = lazy(() =>
  import('./screens/AddScreen').then((m) => ({ default: m.AddScreen }))
);
const ListScreen = lazy(() =>
  import('./screens/ListScreen').then((m) => ({ default: m.ListScreen }))
);
const CommunityScreen = lazy(() =>
  import('./components/social/CommunityScreen').then((m) => ({
    default: m.CommunityScreen,
  }))
);
const ProfileScreen = lazy(() =>
  import('./screens/ProfileScreen').then((m) => ({ default: m.ProfileScreen }))
);
const AuthModal = lazy(() =>
  import('./components/auth/AuthModal').then((m) => ({ default: m.AuthModal }))
);
const BackupRestoreModal = lazy(() =>
  import('./components/BackupRestoreModal').then((m) => ({
    default: m.BackupRestoreModal,
  }))
);
const GeminiConfigModal = lazy(() =>
  import('./components/GeminiConfigModal').then((m) => ({
    default: m.GeminiConfigModal,
  }))
);
const ItemDetailSheet = lazy(() =>
  import('./components/ItemDetailSheet').then((m) => ({
    default: m.ItemDetailSheet,
  }))
);
const JournalComposerModal = lazy(() =>
  import('./components/JournalComposerModal').then((m) => ({
    default: m.JournalComposerModal,
  }))
);
const OnboardingFlow = lazy(() =>
  import('./components/OnboardingFlow').then((m) => ({
    default: m.OnboardingFlow,
  }))
);
const DigitalShelfModal = lazy(() =>
  import('./components/reader/DigitalShelfModal').then((m) => ({
    default: m.DigitalShelfModal,
  }))
);
const ThemeModal = lazy(() =>
  import('./components/ThemeModal').then((m) => ({ default: m.ThemeModal }))
);
const DirectChatDrawer = lazy(() =>
  import('./components/social/DirectChatDrawer').then((m) => ({
    default: m.DirectChatDrawer,
  }))
);
const FriendProfileCardModal = lazy(() =>
  import('./components/social/FriendProfileCardModal').then((m) => ({
    default: m.FriendProfileCardModal,
  }))
);
const ShareProfileCardModal = lazy(() =>
  import('./components/social/ShareProfileCardModal').then((m) => ({
    default: m.ShareProfileCardModal,
  }))
);
const UserProfileModal = lazy(() =>
  import('./components/social/UserProfileModal').then((m) => ({
    default: m.UserProfileModal,
  }))
);
const PerfOverlay = lazy(() =>
  import('./components/PerfOverlay').then((m) => ({ default: m.PerfOverlay }))
);
const CommandPalette = lazy(() =>
  import('./components/CommandPalette').then((m) => ({
    default: m.CommandPalette,
  }))
);

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
  const [themeModalOpen, setThemeModalOpen] = useState(false);
  const [digitalShelfOpen, setDigitalShelfOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [requestedCollectionId, setRequestedCollectionId] = useState(null);
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
  const [pendingInviteHandle, setPendingInviteHandle] = useState(null);
  const [inviteCandidate, setInviteCandidate] = useState(null);
  const [inviteFollowBusy, setInviteFollowBusy] = useState(false);
  const [shareProfileModalOpen, setShareProfileModalOpen] = useState(false);
  const [friendCardModal, setFriendCardModal] = useState(null);
  const [savedPeerCards, setSavedPeerCards] = useState(() => listSavedPeerCards());
  const [backupReminderDismissed, setBackupReminderDismissed] = useState(false);
  const [backupReminderTick, setBackupReminderTick] = useState(0);
  const perfDebugEnabled = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search || '').get('perf') === '1';
  }, []);

  const { showToast } = useToast();

  const {
    mode,
    font,
    texture,
    density,
    motion,
    presetId,
    specialThemeId,
    pastelSubpaletteId,
    pastelCustomColor,
    bgColor,
    accentColor,
    hasCustomBg,
    setMode,
    setFont,
    setTexture,
    setDensity,
    setMotion,
    applyPreset,
    applySpecialTheme,
    selectPastelSubpalette,
    setPastelCustomColor,
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
    collections,
    addItem,
    updateItem,
    removeItem,
    batchUpdateItems,
    batchRemoveItems,
    restoreRemovedItems,
    createCollection,
    deleteCollection,
    moveCollection,
    moveCollectionWork,
    toggleWorkCollection,
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
    dailyLogs,
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

  const selectedStoredBook = useMemo(() => {
    if (!selectedItem) return null;
    return (
      storedReaderBooks.find(
        (b) =>
          b.workId === selectedItem.id ||
          b.bookId === selectedItem.id ||
          (selectedItem.readerBookId && b.bookId === selectedItem.readerBookId)
      ) ?? null
    );
  }, [selectedItem, storedReaderBooks]);

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

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleStorageChanged = () => refreshStoredBookIds();
    window.addEventListener('codice:reader-storage-changed', handleStorageChanged);
    return () =>
      window.removeEventListener(
        'codice:reader-storage-changed',
        handleStorageChanged
      );
  }, [refreshStoredBookIds]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleGlobalKeys = (e) => {
      if ((e.ctrlKey || e.metaKey) && String(e.key || '').toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, []);

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

  const handleRemoveStoredBook = useCallback(
    async (bookId) => {
      if (!bookId) return false;
      const ok = await removeStoredReaderBook(bookId, {
        works: items,
        onUpdateWork: updateItem,
      });
      refreshStoredBookIds();
      if (ok) {
        showToast({
          message: 'Arquivo removido do armazenamento local.',
          type: 'info',
        });
      }
      return ok;
    },
    [items, updateItem, refreshStoredBookIds, showToast]
  );

  const handleRemoveItem = (id) => {
    const target = items.find((entry) => entry.id === id);
    removeItem(id);
    removeStoredReaderBook(id).then(() => refreshStoredBookIds()).catch(() => {});
    if (target?.readerBookId && target.readerBookId !== id) {
      removeStoredReaderBook(target.readerBookId)
        .then(() => refreshStoredBookIds())
        .catch(() => {});
    }
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
          collections: incomingSnapshot.collections || [],
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
        { items, profile, posts, streak: streakData, readingSessions, collections },
        incomingSnapshot
      );
      replaceWorkspaceData({
        items: merged.items,
        readingSessions: merged.readingSessions,
        collections: merged.collections || [],
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
      collections,
    });
    persistCodiceDatabase(db);
    saveEmergencyMirror({
      items,
      collections,
      streak: streakData,
      readingSessions,
    });
  }, [items, profile, posts, streakData, readingSessions, collections]);

  useEffect(() => {
    requestPersistentStorage().catch(() => {});
  }, []);

  useEffect(() => {
    if (!items || items.length === 0) return undefined;
    listAutoSnapshots()
      .then((snaps) => {
        if (!Array.isArray(snaps) || snaps.length === 0) {
          return saveAutoSnapshot(
            { items, profile, posts, streak: streakData, readingSessions, collections },
            { reason: 'auto', label: 'Recuperação automática do espelho local' }
          );
        }
        return null;
      })
      .catch(() => {});
    return undefined;
    // Executa apenas na inicialização para re-semear IndexedDB se o navegador o tiver limpo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!items || items.length === 0) return undefined;
    const timer = setTimeout(() => {
      saveAutoSnapshot(
        { items, profile, posts, streak: streakData, readingSessions, collections },
        { reason: 'auto', label: 'Auto-snapshot automático' }
      ).catch(() => {});
    }, 8000);
    return () => clearTimeout(timer);
  }, [items, profile, posts, streakData, readingSessions, collections]);

  const handleRegisterToday = () => {
    registerToday();
    showToast({ message: 'Constância de leitura registrada hoje', type: 'success' });
  };

  const handleQuickReadingCheckIn = useCallback(
    ({ workId = null, pages = 0, note = '' } = {}) => {
      const cleanPages = Math.max(0, Math.round(Number(pages) || 0));
      const cleanNote = String(note || '').trim();
      if (cleanPages <= 0 && !cleanNote) return;

      const targetWork = workId
        ? items.find((entry) => entry.id === workId)
        : null;

      if (targetWork) {
        if (cleanPages > 0) {
          const prevPage = Math.max(0, Number(targetWork.currentPage) || 0);
          const total = Number(targetWork.totalPages) || 0;
          const nextPage =
            total > 0 ? Math.min(total, prevPage + cleanPages) : prevPage + cleanPages;
          const updates = {
            currentPage: nextPage,
            updatedAt: new Date().toISOString(),
            ...(targetWork.status === 'queued' ? { status: 'playing' } : {}),
          };
          if (total > 0 && nextPage >= total) {
            updates.progressPercent = 100;
          }
          updateItem(targetWork.id, updates);
        }

        addReadingSession({
          workId: targetWork.id,
          pagesRead: cleanPages,
          notes: cleanNote,
        });
        registerToday({ note: cleanNote });
      } else {
        registerToday({
          standalonePages: cleanPages,
          standaloneSessions: 1,
          note: cleanNote,
        });
      }

      showToast({
        message:
          cleanPages > 0
            ? `+${cleanPages} ${cleanPages === 1 ? 'página registrada' : 'páginas registradas'} hoje`
            : 'Reflexão de leitura salva',
        type: 'success',
      });
    },
    [items, updateItem, addReadingSession, registerToday, showToast]
  );

  const handleStartPickedWork = useCallback(
    (work) => {
      if (!work?.id) return;
      updateItem(work.id, { status: 'playing', inBacklog: true });
      setSelectedItemId(work.id);
      showToast({
        message: `"${work.title}" iniciada na sua estante`,
        type: 'success',
      });
    },
    [updateItem, showToast]
  );

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

  const titleEvaluation = useMemo(
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
      }),
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

  const resolvedTitleBadge = titleEvaluation?.resolvedActiveBadge?.name || '';

  useEffect(() => {
    if (!backendReady || !titleEvaluation?.stalePinnedCleared) return;
    updateProfile({ activeTitleBadge: 'auto' });
  }, [backendReady, titleEvaluation?.stalePinnedCleared, updateProfile]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search || '');
    const hasInvite = params.has('invite');
    const hasCard = params.has('card');
    if (!hasInvite && !hasCard) return;

    const rawInvite = hasInvite ? params.get('invite') : null;
    const rawCard = hasCard ? params.get('card') : null;
    const parsedHandle = rawInvite ? parseInviteHandleParam(rawInvite) : null;

    params.delete('invite');
    params.delete('card');
    const nextSearch = params.toString();
    const cleanUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash || ''}`;
    if (typeof window.history?.replaceState === 'function') {
      window.history.replaceState({}, '', cleanUrl);
    }

    if (rawCard) {
      const decoded = decodePublicProfileCard(rawCard);
      if (decoded.ok) {
        setFriendCardModal(decoded.card);
      } else {
        showToast({
          message: decoded.error || 'Link de cartão de perfil inválido.',
          type: 'error',
        });
      }
    }

    if (parsedHandle) {
      setPendingInviteHandle(parsedHandle);
    }
  }, [showToast]);

  const backupReminder = useMemo(() => {
    if (backupReminderDismissed) {
      return { shouldRemind: false, daysWithoutBackup: 0 };
    }
    const backlogCount = items.filter((item) => item && item.inBacklog !== false).length;
    return getBackupReminderStatus({
      itemsCount: backlogCount,
      nowMs: Date.now() + backupReminderTick * 0,
    });
  }, [items, backupReminderDismissed, backupReminderTick]);

  const handleSaveBackupCopyNow = useCallback(async () => {
    try {
      const res = await shareOrDownloadSignedBackup({
        items,
        profile,
        posts,
        streak: streakData,
        readingSessions,
        collections,
      });
      setBackupReminderTick((t) => t + 1);
      if (res.method === 'share') {
        showToast({ message: 'Cópia de segurança compartilhada.', type: 'success' });
      } else if (res.method === 'download') {
        showToast({
          message: 'Cópia de segurança (.json + SHA-256) salva no aparelho.',
          type: 'success',
        });
      }
    } catch {
      showToast({
        message: 'Não foi possível gerar a cópia agora.',
        type: 'error',
      });
    }
  }, [items, profile, posts, streakData, readingSessions, collections, showToast]);

  const handleSavePeerCard = useCallback(
    (card) => {
      if (!card) return;
      const next = savePeerProfileCard(card);
      setSavedPeerCards(next);
      showToast({
        message: `${card.displayName || card.handle} salvo na sua Rede local.`,
        type: 'success',
      });
    },
    [showToast]
  );

  const handleRemovePeerCard = useCallback(
    (cardIdOrHandle) => {
      const next = removeSavedPeerCard(cardIdOrHandle);
      setSavedPeerCards(next);
      showToast({ message: 'Contato removido da lista salva.', type: 'info' });
    },
    [showToast]
  );

  useEffect(() => {
    if (!backendReady || !pendingInviteHandle) return undefined;
    let active = true;
    resolveInviteProfile(pendingInviteHandle, { viewerId: activeViewerId })
      .then((resolved) => {
        if (!active) return;
        setPendingInviteHandle(null);
        if (resolved) {
          setInviteCandidate(resolved);
        } else {
          showToast({
            message: `Convite ${pendingInviteHandle} não encontrado.`,
            type: 'info',
          });
        }
      })
      .catch(() => {
        if (active) setPendingInviteHandle(null);
      });

    return () => {
      active = false;
    };
  }, [backendReady, pendingInviteHandle, activeViewerId, showToast]);

  useEffect(() => {
    if (!inviteCandidate) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setInviteCandidate(null);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [inviteCandidate]);

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
      <GraphicFilters />
      {textureClass && (
        <div
          aria-hidden="true"
          className={`app-texture-overlay ${textureClass}`}
        />
      )}
      <div className="relative z-10 mx-auto min-h-screen max-w-md md:max-w-2xl lg:max-w-4xl bg-transparent sm:border-x sm:border-line/60">
        <main className="px-4 sm:px-6 pt-4 pb-[env(safe-area-inset-bottom)]">
          <ErrorBoundary
            key={activeTab}
            screenName={
              {
                home: 'Início',
                stats: 'Métricas',
                add: 'Catalogar',
                list: 'Acervo',
                community: 'Rede',
                profile: 'Perfil',
              }[activeTab] || 'esta tela'
            }
            onOpenBackup={() => setBackupModalOpen(true)}
          >
          <Suspense
            fallback={
              <div className="py-12 text-center text-xs text-muted">
                Carregando...
              </div>
            }
          >
          {activeTab === 'home' && (
            <HomeScreen
              items={items}
              profile={profile}
              streakProps={streakProps}
              readingSessions={readingSessions}
              dailyLogs={dailyLogs}
              resolvedBadgeName={resolvedTitleBadge}
              viewerId={activeViewerId}
              geminiKey={geminiKey}
              backupReminder={backupReminder}
              storedReaderWorkIds={storedReaderWorkIds}
              storedReaderBooks={storedReaderBooks}
              onSaveBackupNow={handleSaveBackupCopyNow}
              onDismissBackupReminder={() => setBackupReminderDismissed(true)}
              onQuickCheckIn={handleQuickReadingCheckIn}
              onStartPickedWork={handleStartPickedWork}
              onSelectItem={handleSelectOrAddFromRecommendation}
              onOpenReader={handleOpenReaderForWork}
              onOpenStoredBook={handleOpenStoredBook}
              onRemoveStoredBook={handleRemoveStoredBook}
              onOpenQuickReader={handleOpenQuickReader}
              onOpenDigitalShelf={() => setDigitalShelfOpen(true)}
              onAddToWishlist={handleCopyWorkToWishlist}
              onCatalogFranchiseVolume={handleAddItem}
              onNavigateList={() => setActiveTab('list')}
              onNavigateAdd={() => setActiveTab('add')}
              onOpenGeminiSettings={() => setGeminiModalOpen(true)}
              onOpenThemeStudio={() => setThemeModalOpen(true)}
            />
          )}
          {activeTab === 'stats' && (
            <StatsScreen
              items={items}
              readingSessions={readingSessions}
              streakHistory={history}
              dailyLogs={dailyLogs}
            />
          )}
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
              collections={collections}
              geminiKey={geminiKey}
              storedReaderWorkIds={storedReaderWorkIds}
              onCreateCollection={createCollection}
              onDeleteCollection={deleteCollection}
              onMoveCollection={moveCollection}
              onMoveCollectionWork={moveCollectionWork}
              onBatchUpdateItems={batchUpdateItems}
              onBatchRemoveItems={batchRemoveItems}
              onRestoreRemovedItems={restoreRemovedItems}
              onStartPickedWork={handleStartPickedWork}
              onSelectItem={(item) => setSelectedItemId(item.id)}
              onOpenReader={handleOpenReaderForWork}
              onOpenDigitalShelf={() => setDigitalShelfOpen(true)}
              onOpenThemeStudio={() => setThemeModalOpen(true)}
              onOpenCommandPalette={() => setPaletteOpen(true)}
              onNavigateAdd={() => setActiveTab('add')}
              onOpenGeminiSettings={() => setGeminiModalOpen(true)}
              requestedCollectionId={requestedCollectionId}
              onConsumeRequestedCollection={() => setRequestedCollectionId(null)}
            />
          )}
          {activeTab === 'community' && (
            <CommunityScreen
              viewerId={activeViewerId}
              myProfile={profile}
              myShelfItems={items}
              savedPeerCards={savedPeerCards}
              unreadDmCount={unreadDmCount}
              backendMode={backendSession?.mode || 'local'}
              onOpenAuthModal={() => setAuthModalOpen(true)}
              onOpenShareProfileCard={() => setShareProfileModalOpen(true)}
              onOpenFriendCard={(card) => setFriendCardModal(card)}
              onRemoveFriendCard={handleRemovePeerCard}
              onOpenUserProfile={(id) => setViewingUserProfileId(id)}
              onOpenDirectChat={handleOpenDirectChat}
              onCopyBookToWishlist={handleCopyWorkToWishlist}
              onSocialChanged={refreshSocialSignals}
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
              backupReminder={backupReminder}
              onSaveBackupNow={handleSaveBackupCopyNow}
              onDismissBackupReminder={() => setBackupReminderDismissed(true)}
              onOpenShareProfileCard={() => setShareProfileModalOpen(true)}
              onOpenAuthModal={() => setAuthModalOpen(true)}
              onOpenGeminiSettings={() => setGeminiModalOpen(true)}
              onOpenThemeStudio={() => setThemeModalOpen(true)}
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
                density,
                motion,
                presetId,
                specialThemeId,
                pastelSubpaletteId,
                pastelCustomColor,
                bgColor,
                accentColor,
                hasCustomBg,
                onSelectMode: setMode,
                onSelectFont: setFont,
                onSelectTexture: setTexture,
                onSelectDensity: setDensity,
                onSelectMotion: setMotion,
                onApplyPreset: applyPreset,
                onApplySpecialTheme: applySpecialTheme,
                onSelectPastelSubpalette: selectPastelSubpalette,
                onChangePastelColor: setPastelCustomColor,
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
          </Suspense>
          </ErrorBoundary>
        </main>

        <BottomNav
          activeTab={activeTab}
          onChangeTab={setActiveTab}
          unreadDmCount={unreadDmCount}
        />

        <Suspense fallback={null}>
          {Boolean(selectedItem) && (
            <ItemDetailSheet
              item={selectedItem}
              posts={posts}
              collections={collections}
              geminiKey={geminiKey}
              viewerId={activeViewerId}
              hasStoredFile={Boolean(
                selectedItem &&
                  (selectedStoredBook ||
                    storedReaderWorkIds.includes(selectedItem.id) ||
                    (selectedItem.readerBookId &&
                      storedReaderWorkIds.includes(selectedItem.readerBookId)))
              )}
              storedFileMeta={selectedStoredBook}
              onClose={() => setSelectedItemId(null)}
              onUpdateItem={handleUpdateItem}
              onToggleCollection={toggleWorkCollection}
              onCreateCollection={createCollection}
              onRemoveItem={handleRemoveItem}
              onRemoveStoredFile={(work, meta) =>
                handleRemoveStoredBook(
                  meta?.bookId || work?.readerBookId || work?.id
                )
              }
              onOpenJournal={handleOpenJournalComposer}
              onOpenReader={handleOpenReaderForWork}
              onOpenGeminiSettings={() => setGeminiModalOpen(true)}
              onRecommendToFeed={handleRecommendWorkToFeed}
              onSocialActivityChanged={refreshSocialSignals}
            />
          )}
        </Suspense>

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

        <Suspense fallback={null}>
          {journalComposer.open && (
            <JournalComposerModal
              isOpen={journalComposer.open}
              onClose={() => setJournalComposer({ open: false, itemId: null })}
              items={items}
              initialItemId={journalComposer.itemId}
              onPublish={handlePublishPost}
            />
          )}

          {geminiModalOpen && (
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
          )}

          {(!profile.onboardingCompleted || onboardingReopened) && (
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
          )}

          {backupModalOpen && (
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
          )}

          {digitalShelfOpen && (
            <DigitalShelfModal
              isOpen={digitalShelfOpen}
              onClose={() => setDigitalShelfOpen(false)}
              works={items}
              onOpenStoredBook={handleOpenStoredBook}
              onRemoveStoredBook={handleRemoveStoredBook}
              onSyncLinkedWork={(targetWork, extractedPosition) => {
                if (extractedPosition) {
                  handleSyncWorkProgress(targetWork, extractedPosition);
                }
              }}
              onShelfMutated={refreshStoredBookIds}
            />
          )}

          {authModalOpen && (
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
          )}

          {Boolean(viewingUserProfileId) && (
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
          )}

          {chatOpen && (
            <DirectChatDrawer
              isOpen={chatOpen}
              onClose={() => setChatOpen(false)}
              viewerId={activeViewerId}
              initialPeerId={chatPeerId}
              myShelfItems={items}
              backendMode={backendSession?.mode || 'local'}
              onOpenAuthModal={() => setAuthModalOpen(true)}
              onCopyBookToWishlist={handleCopyWorkToWishlist}
              onUnreadChanged={refreshSocialSignals}
            />
          )}
        </Suspense>

        {inviteCandidate && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
            onClick={() => setInviteCandidate(null)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Confirmação de convite de leitor"
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-[6px] border border-line bg-card p-5 text-ink space-y-4"
            >
              <div className="flex items-start justify-between gap-3 border-b border-line pb-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                    Convite recebido
                  </p>
                  <h2 className="text-base font-serif font-semibold text-ink">
                    Conectar com leitor convidado?
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setInviteCandidate(null)}
                  aria-label="Fechar convite"
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[4px] border border-line text-muted hover:text-ink"
                >
                  <X className="h-4 w-4" strokeWidth={1.5} />
                </button>
              </div>

              <div className="flex items-center gap-3 rounded-[4px] border border-line bg-app p-3">
                {inviteCandidate.avatarUrl ? (
                  <img
                    src={inviteCandidate.avatarUrl}
                    alt={inviteCandidate.displayName || inviteCandidate.handle}
                    className="h-12 w-12 shrink-0 rounded-full border border-line object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-line bg-card text-sm font-serif font-semibold text-accent">
                    {inviteCandidate.avatarInitials || 'LC'}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-serif font-semibold text-ink">
                    {inviteCandidate.displayName || inviteCandidate.handle}
                  </p>
                  <p className="truncate text-xs text-muted tabular-nums">
                    {inviteCandidate.handle}
                  </p>
                </div>
              </div>

              {Boolean(
                inviteCandidate.isLocalContact ||
                  String(inviteCandidate.id || '').startsWith('contact:')
              ) && (
                <p className="rounded-[4px] border border-line bg-app px-3 py-2 text-xs text-muted leading-relaxed">
                  Convite salvo na lista local de contatos. Conecte o Supabase para seguir este leitor em tempo real.
                </p>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const targetId = inviteCandidate.id;
                    setInviteCandidate(null);
                    if (targetId) setViewingUserProfileId(targetId);
                  }}
                  className="min-h-[44px] rounded-[4px] border border-line px-3.5 py-2 text-xs font-medium text-ink hover:border-accent hover:text-accent"
                >
                  Ver perfil
                </button>

                {inviteCandidate.isLocalContact ||
                String(inviteCandidate.id || '').startsWith('contact:') ? (
                  <button
                    type="button"
                    onClick={() => {
                      setInviteCandidate(null);
                      setAuthModalOpen(true);
                    }}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[4px] border border-accent bg-accent px-3.5 py-2 text-xs font-medium text-accent-ink"
                  >
                    <UserCheck className="h-4 w-4" strokeWidth={1.5} />
                    <span>Conectar Supabase</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={inviteFollowBusy}
                    onClick={async () => {
                      if (inviteFollowBusy) return;
                      setInviteFollowBusy(true);
                      try {
                        const res = await followReader(inviteCandidate.id, {
                          viewerId: activeViewerId,
                        });
                        showToast({
                          message:
                            res?.status === 'pending'
                              ? 'Solicitação de vínculo enviada.'
                              : `Você começou a seguir ${inviteCandidate.displayName || inviteCandidate.handle}.`,
                          type: 'success',
                        });
                        refreshSocialSignals();
                        setInviteCandidate(null);
                      } catch (err) {
                        showToast({
                          message:
                            err?.userMessage ||
                            'Não foi possível seguir este leitor.',
                          type: 'error',
                        });
                      } finally {
                        setInviteFollowBusy(false);
                      }
                    }}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[4px] border border-accent bg-accent px-3.5 py-2 text-xs font-medium text-accent-ink disabled:opacity-50"
                  >
                    <UserPlus className="h-4 w-4" strokeWidth={1.5} />
                    <span>{inviteFollowBusy ? 'Seguindo...' : 'Seguir'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <Suspense fallback={null}>
          {shareProfileModalOpen && (
            <ShareProfileCardModal
              isOpen={shareProfileModalOpen}
              onClose={() => setShareProfileModalOpen(false)}
              profile={profile}
              items={items}
              activeTitleName={resolvedTitleBadge}
              streakCount={streakCount}
            />
          )}

          {Boolean(friendCardModal) && (
            <FriendProfileCardModal
              isOpen={Boolean(friendCardModal)}
              card={friendCardModal}
              isAlreadySaved={Boolean(
                friendCardModal &&
                  savedPeerCards.some(
                    (c) =>
                      String(c.handle || '').toLowerCase() ===
                      String(friendCardModal.handle || '').toLowerCase()
                  )
              )}
              onClose={() => setFriendCardModal(null)}
              onSaveFriend={handleSavePeerCard}
              onCopyBookToWishlist={handleCopyWorkToWishlist}
            />
          )}

          {themeModalOpen && (
            <ThemeModal
              isOpen={themeModalOpen}
              onClose={() => setThemeModalOpen(false)}
              mode={mode}
              font={font}
              texture={texture}
              density={density}
              motion={motion}
              presetId={presetId}
              specialThemeId={specialThemeId}
              pastelSubpaletteId={pastelSubpaletteId}
              pastelCustomColor={pastelCustomColor}
              bgColor={bgColor}
              accentColor={accentColor}
              hasCustomBg={hasCustomBg}
              onSelectMode={setMode}
              onSelectFont={setFont}
              onSelectTexture={setTexture}
              onSelectDensity={setDensity}
              onSelectMotion={setMotion}
              onApplyPreset={applyPreset}
              onApplySpecialTheme={applySpecialTheme}
              onSelectPastelSubpalette={selectPastelSubpalette}
              onChangePastelColor={setPastelCustomColor}
              onChangeBgColor={setCustomBgColor}
              onChangeAccentColor={setCustomAccentColor}
              onResetTheme={resetCustomColors}
            />
          )}

          {paletteOpen && (
            <CommandPalette
              isOpen={paletteOpen}
              onClose={() => setPaletteOpen(false)}
              items={items}
              collections={collections}
              onNavigateTab={setActiveTab}
              onSelectItem={(item) => {
                if (item?.id) setSelectedItemId(item.id);
              }}
              onSelectCollection={(colId) => {
                setRequestedCollectionId(colId);
                setActiveTab('list');
              }}
              onOpenThemeStudio={() => setThemeModalOpen(true)}
              onOpenDigitalShelf={() => setDigitalShelfOpen(true)}
              onExportBackup={handleSaveBackupCopyNow}
              onToggleFocusTheme={() => {
                if (specialThemeId === 'focus-dim') {
                  setMode(mode || 'oled');
                } else {
                  applySpecialTheme('focus-dim');
                }
              }}
            />
          )}

          {perfDebugEnabled && <PerfOverlay />}
        </Suspense>
      </div>
    </div>
  );
}

export default App;
