import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { BottomNav } from './components/BottomNav';
import { GeminiConfigModal } from './components/GeminiConfigModal';
import { ItemDetailSheet } from './components/ItemDetailSheet';
import { JournalComposerModal } from './components/JournalComposerModal';
import { OnboardingFlow } from './components/OnboardingFlow';
import { useToast } from './context/ToastContext';
import { useBacklog } from './hooks/useBacklog';
import { useGeminiKey } from './hooks/useGeminiKey';
import { useReadingStreak } from './hooks/useReadingStreak';
import { useSocialProfile } from './hooks/useSocialProfile';
import { useTheme } from './hooks/useTheme';
import {
  buildCodiceDatabase,
  createUuid,
  persistCodiceDatabase,
} from './services/codiceDatabase';
import { deleteBookFile, listStoredBookIds } from './services/readerStorage';
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
  const [onboardingReopened, setOnboardingReopened] = useState(false);
  const [storedReaderWorkIds, setStoredReaderWorkIds] = useState([]);
  const [readerSession, setReaderSession] = useState({
    open: false,
    workId: null,
    initialFile: null,
  });
  const [journalComposer, setJournalComposer] = useState({
    open: false,
    itemId: null,
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

  const { apiKey: geminiKey, hasGeminiKey, saveApiKey, clearApiKey } =
    useGeminiKey();

  const {
    items,
    readingSessions,
    addItem,
    updateItem,
    removeItem,
    addReadingSession,
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

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) ?? null,
    [items, selectedItemId]
  );

  const readerWork = useMemo(
    () => items.find((item) => item.id === readerSession.workId) ?? null,
    [items, readerSession.workId]
  );

  useEffect(() => {
    listStoredBookIds()
      .then((ids) => setStoredReaderWorkIds(ids))
      .catch(() => {});
  }, [readerSession.open]);

  const handleOpenReaderForWork = useCallback((work, file = null) => {
    if (!work) return;
    setSelectedItemId(null);
    setReaderSession({ open: true, workId: work.id, initialFile: file });
  }, []);

  const handleOpenQuickReader = useCallback((file = null) => {
    setSelectedItemId(null);
    setReaderSession({ open: true, workId: null, initialFile: file });
  }, []);

  const handlePersistReaderState = useCallback(
    (workId, nextReaderState) => {
      updateItem(workId, { readerState: nextReaderState });
    },
    [updateItem]
  );

  const handleSyncWorkProgress = useCallback(
    (work, endPosition) => {
      if (!work?.id || !endPosition) return;
      const prevSnapshot = {
        currentPage: work.currentPage,
        totalPages: work.totalPages,
        progress: work.progress,
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

      const updates = {
        currentPage: nextPage,
        ...(nextTotal && !work.totalPages ? { totalPages: nextTotal } : {}),
        ...(work.status === 'queued' && nextPage > 0 ? { status: 'playing' } : {}),
      };

      updateItem(work.id, updates);

      const summaryLabel =
        nextPage > 0
          ? `Pág. ${nextPage}${nextTotal ? `/${nextTotal}` : ''}`
          : `${nextPct}%`;

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
      const newQuote = {
        id: createUuid(),
        text: quotePayload.text,
        location: quotePayload.location || '',
        cfi: quotePayload.cfi || '',
        color: quotePayload.color || 'accent',
        note: '',
        createdAt: new Date().toISOString(),
      };
      updateItem(work.id, { quotes: [newQuote, ...existingQuotes] });
    },
    [updateItem]
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

  const handleExportBackup = () => {
    exportBackup({ profile, posts, streak: streakData });
    showToast({ message: 'Banco relacional (.json) exportado', type: 'success' });
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

  const handleRegisterToday = () => {
    registerToday();
    showToast({ message: 'Constância de leitura registrada hoje', type: 'success' });
  };

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
              geminiKey={geminiKey}
              storedReaderWorkIds={storedReaderWorkIds}
              onSelectItem={(item) => setSelectedItemId(item.id)}
              onOpenReader={handleOpenReaderForWork}
              onOpenQuickReader={handleOpenQuickReader}
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
              onSelectItem={(item) => setSelectedItemId(item.id)}
              onNavigateAdd={() => setActiveTab('add')}
              onOpenGeminiSettings={() => setGeminiModalOpen(true)}
            />
          )}
          {activeTab === 'profile' && (
            <ProfileScreen
              items={items}
              profile={profile}
              posts={posts}
              hasGeminiKey={hasGeminiKey}
              onOpenGeminiSettings={() => setGeminiModalOpen(true)}
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
              onUpdateProfile={(updates) => {
                updateProfile(updates);
                showToast({ message: 'Perfil atualizado', type: 'success' });
              }}
              onSelectItem={(item) => setSelectedItemId(item.id)}
              onOpenJournalComposer={handleOpenJournalComposer}
              onDeletePost={deletePost}
              onAddPostComment={addPostComment}
              onDeletePostComment={deletePostComment}
              onExportBackup={handleExportBackup}
              onExportCsv={handleExportCsv}
              onExportBibtex={handleExportBibtex}
              onImportBackup={handleImportBackup}
            />
          )}
        </main>

        <BottomNav activeTab={activeTab} onChangeTab={setActiveTab} />

        <ItemDetailSheet
          item={selectedItem}
          posts={posts}
          geminiKey={geminiKey}
          hasStoredFile={Boolean(
            selectedItem && storedReaderWorkIds.includes(selectedItem.id)
          )}
          onClose={() => setSelectedItemId(null)}
          onUpdateItem={handleUpdateItem}
          onRemoveItem={handleRemoveItem}
          onOpenJournal={handleOpenJournalComposer}
          onOpenReader={handleOpenReaderForWork}
          onOpenGeminiSettings={() => setGeminiModalOpen(true)}
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
              initialFile={readerSession.initialFile}
              onClose={() =>
                setReaderSession({ open: false, workId: null, initialFile: null })
              }
              onPersistReaderState={handlePersistReaderState}
              onRecordSession={addReadingSession}
              onSyncWorkProgress={handleSyncWorkProgress}
              onSaveQuoteFromReader={handleSaveQuoteFromReader}
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
            updateProfile(updates);
            setOnboardingReopened(false);
            showToast({ message: 'Perfil do leitor salvo', type: 'success' });
          }}
          onDismiss={() => setOnboardingReopened(false)}
        />
      </div>
    </div>
  );
}

export default App;
