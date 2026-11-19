import { useMemo, useState } from 'react';
import { BottomNav } from './components/BottomNav';
import { GeminiConfigModal } from './components/GeminiConfigModal';
import { ItemDetailSheet } from './components/ItemDetailSheet';
import { JournalComposerModal } from './components/JournalComposerModal';
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
  const [journalComposer, setJournalComposer] = useState({
    open: false,
    itemId: null,
  });

  const {
    mode,
    font,
    presetId,
    bgColor,
    accentColor,
    hasCustomBg,
    setMode,
    setFont,
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

  const handleOpenJournalComposer = (itemId = null) => {
    setJournalComposer({ open: true, itemId });
  };

  const handlePublishPost = (postData) => {
    addPost(postData);
    setActiveTab('profile');
  };

  const handleExportBackup = () => {
    exportBackup({ profile, posts, streak: streakData });
  };

  const handleImportBackup = async (file) => {
    const result = await importBackup(file);
    if (result.ok) {
      restoreSocialBackup({ profile: result.profile, posts: result.posts });
      restoreStreakBackup(result.streak);
    }
    return result;
  };

  const streakProps = {
    streakCount,
    loggedToday,
    isPaused,
    history,
    onRegisterToday: registerToday,
  };

  return (
    <div className="min-h-screen bg-app text-ink transition-colors duration-200">
      <div className="mx-auto min-h-screen max-w-md bg-app sm:border-x sm:border-line/60">
        <main className="px-4 pt-4 pb-[env(safe-area-inset-bottom)]">
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
              onAddItem={addItem}
              onSelectExisting={(item) => setSelectedItemId(item.id)}
              onOpenGeminiSettings={() => setGeminiModalOpen(true)}
            />
          )}
          {activeTab === 'list' && (
            <ListScreen
              items={items}
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
              themeProps={{
                mode,
                font,
                presetId,
                bgColor,
                accentColor,
                hasCustomBg,
                onSelectMode: setMode,
                onSelectFont: setFont,
                onApplyPreset: applyPreset,
                onChangeBgColor: setCustomBgColor,
                onChangeAccentColor: setCustomAccentColor,
                onResetTheme: resetCustomColors,
              }}
              onUpdateProfile={updateProfile}
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
          onUpdateItem={updateItem}
          onRemoveItem={removeItem}
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
          onSaveKey={saveApiKey}
          onClearKey={clearApiKey}
        />
      </div>
    </div>
  );
}

export default App;
