import { useMemo, useState } from 'react';
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
import { AddScreen } from './screens/AddScreen';
import { HomeScreen } from './screens/HomeScreen';
import { ListScreen } from './screens/ListScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { StatsScreen } from './screens/StatsScreen';

export function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [geminiModalOpen, setGeminiModalOpen] = useState(false);
  const [onboardingReopened, setOnboardingReopened] = useState(false);
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
    addItem,
    updateItem,
    removeItem,
    exportBackup,
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
    showToast({ message: 'Backup .json exportado', type: 'success' });
  };

  const handleImportBackup = async (file) => {
    const result = await importBackup(file);
    if (result.ok) {
      restoreSocialBackup({ profile: result.profile, posts: result.posts });
      restoreStreakBackup(result.streak);
      showToast({
        message: `Backup restaurado (${result.count} obras)`,
        type: 'success',
      });
    } else {
      showToast({ message: result.error, type: 'error' });
    }
    return result;
  };

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

  return (
    <div className="relative min-h-screen bg-app text-ink transition-colors duration-200">
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
              onSelectItem={(item) => setSelectedItemId(item.id)}
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
              onImportBackup={handleImportBackup}
            />
          )}
        </main>

        <BottomNav activeTab={activeTab} onChangeTab={setActiveTab} />

        <ItemDetailSheet
          item={selectedItem}
          posts={posts}
          geminiKey={geminiKey}
          onClose={() => setSelectedItemId(null)}
          onUpdateItem={handleUpdateItem}
          onRemoveItem={handleRemoveItem}
          onOpenJournal={handleOpenJournalComposer}
          onOpenGeminiSettings={() => setGeminiModalOpen(true)}
        />

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
