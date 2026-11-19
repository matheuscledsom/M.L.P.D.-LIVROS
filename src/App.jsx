import { useMemo, useState } from 'react';
import { BottomNav } from './components/BottomNav';
import { ItemDetailSheet } from './components/ItemDetailSheet';
import { JournalComposerModal } from './components/JournalComposerModal';
import { useBacklog } from './hooks/useBacklog';
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
  const [journalComposer, setJournalComposer] = useState({
    open: false,
    itemId: null,
  });

  const { mode, accent, setMode, setAccent } = useTheme();
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
    exportBackup({ profile, posts });
  };

  const handleImportBackup = async (file) => {
    const result = await importBackup(file);
    if (result.ok) {
      restoreSocialBackup({ profile: result.profile, posts: result.posts });
    }
    return result;
  };

  return (
    <div className="min-h-screen bg-app text-ink transition-colors duration-200">
      <div className="mx-auto min-h-screen max-w-md bg-app sm:border-x sm:border-line/60">
        <main className="px-4 pt-4 pb-[env(safe-area-inset-bottom)]">
          {activeTab === 'home' && (
            <HomeScreen
              items={items}
              profile={profile}
              onSelectItem={(item) => setSelectedItemId(item.id)}
              onNavigateList={() => setActiveTab('list')}
              onNavigateAdd={() => setActiveTab('add')}
            />
          )}
          {activeTab === 'stats' && <StatsScreen items={items} />}
          {activeTab === 'add' && (
            <AddScreen
              items={items}
              onAddItem={addItem}
              onSelectExisting={(item) => setSelectedItemId(item.id)}
            />
          )}
          {activeTab === 'list' && (
            <ListScreen
              items={items}
              onSelectItem={(item) => setSelectedItemId(item.id)}
              onNavigateAdd={() => setActiveTab('add')}
            />
          )}
          {activeTab === 'profile' && (
            <ProfileScreen
              items={items}
              profile={profile}
              posts={posts}
              themeMode={mode}
              themeAccent={accent}
              onSelectThemeMode={setMode}
              onSelectThemeAccent={setAccent}
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
          onClose={() => setSelectedItemId(null)}
          onUpdateItem={updateItem}
          onRemoveItem={removeItem}
          onOpenJournal={handleOpenJournalComposer}
        />

        <JournalComposerModal
          isOpen={journalComposer.open}
          onClose={() => setJournalComposer({ open: false, itemId: null })}
          items={items}
          initialItemId={journalComposer.itemId}
          onPublish={handlePublishPost}
        />
      </div>
    </div>
  );
}

export default App;
