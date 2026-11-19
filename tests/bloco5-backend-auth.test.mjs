import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

function createMemoryLocalStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, val) {
      store.set(key, String(val));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

globalThis.localStorage = createMemoryLocalStorage();

const {
  BackendError,
  bootstrapBackend,
  canInteractWithProfile,
  clearSupabaseConfig,
  continueInLocalMode,
  getBackendMode,
  getCurrentBackendSession,
  listLocalProfiles,
  resetBackendMemoryForTests,
  signInAccount,
  signOutAccount,
  signUpAccount,
  switchLocalProfile,
  toSqlProfileRow,
  updateActiveProfileInBackend,
} = await import('../src/services/codiceBackend.js');

const {
  hydrateAppSnapshotFromDatabase,
  migrateDatabase,
} = await import('../src/services/codiceDatabase.js');

test('Motor Local Multiusuário isola perfis, senhas e acervos offline', async () => {
  globalThis.localStorage.clear();
  clearSupabaseConfig();
  resetBackendMemoryForTests();

  assert.equal(getBackendMode(), 'local');

  const boot = await bootstrapBackend({
    profile: { displayName: 'Leitor Um', handle: '@leitor1', onboardingCompleted: true },
    items: [{ id: 'w1', title: 'Grande Sertão: Veredas' }],
    posts: [],
    streak: { count: 3, lastDate: '2026-11-18', history: ['2026-11-18'] },
  });

  assert.equal(boot.mode, 'local');
  assert.equal(boot.authenticated, true);
  assert.equal(boot.profile.handle, '@leitor1');

  const reg2 = await signUpAccount({
    displayName: 'Mariana Costa',
    handle: 'Mariana_C',
    email: 'mariana@exemplo.com',
    password: 'segredo123',
    currentWorkspace: {
      profile: boot.profile,
      items: [{ id: 'w1', title: 'Grande Sertão: Veredas' }],
      posts: [],
      streak: { count: 3, lastDate: '2026-11-18', history: ['2026-11-18'] },
      readingSessions: [],
    },
  });

  assert.equal(reg2.profile.handle, '@mariana_c');
  assert.equal(reg2.workspace.items.length, 0);

  await assert.rejects(
    () =>
      signUpAccount({
        displayName: 'Outra Pessoa',
        handle: '@mariana_c',
        email: 'outra@exemplo.com',
        password: 'segredo123',
      }),
    (err) => err instanceof BackendError && err.code === 'HANDLE_TAKEN'
  );

  await assert.rejects(
    () =>
      signInAccount({
        identifier: 'mariana@exemplo.com',
        password: 'senha_errada',
      }),
    (err) => err instanceof BackendError && err.code === 'INVALID_CREDENTIALS'
  );

  // Alterna para perfil 1 mantendo dados da Mariana
  const sw1 = await switchLocalProfile(boot.user.id, {
    currentWorkspace: {
      profile: reg2.profile,
      items: [{ id: 'm1', title: 'A Paixão Segundo G.H.' }],
      posts: [],
      streak: { count: 0, lastDate: null, history: [] },
      readingSessions: [],
    },
  });
  assert.equal(sw1.profile.handle, '@leitor1');
  assert.equal(sw1.workspace.items[0].title, 'Grande Sertão: Veredas');

  // Login por @handle na conta 2 restaura livro salvo dela
  const login2 = await signInAccount({
    identifier: '@mariana_c',
    password: 'segredo123',
  });
  assert.equal(login2.profile.handle, '@mariana_c');
  assert.equal(login2.workspace.items[0].title, 'A Paixão Segundo G.H.');

  const profiles = await listLocalProfiles();
  assert.equal(profiles.length, 2);

  await signOutAccount({
    currentWorkspace: {
      profile: login2.profile,
      items: login2.workspace.items,
      posts: [],
      streak: { count: 0, lastDate: null, history: [] },
      readingSessions: [],
    },
  });
  const afterSignOut = await getCurrentBackendSession();
  assert.equal(afterSignOut.authenticated, false);

  const resumed = await continueInLocalMode();
  assert.equal(resumed.authenticated, true);
  assert.equal(resumed.mode, 'local');
});

test('Adaptador híbrido detecta Supabase no localStorage, mapeia privacidade e permite fallback local', async () => {
  globalThis.localStorage.clear();
  resetBackendMemoryForTests();

  globalThis.localStorage.setItem('VITE_SUPABASE_URL', 'https://codice-test.supabase.co');
  globalThis.localStorage.setItem(
    'VITE_SUPABASE_ANON_KEY',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test_anon_key_payload'
  );

  assert.equal(getBackendMode(), 'supabase');

  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || 'GET', body: init.body });
    const urlStr = String(url);
    if (urlStr.includes('/auth/v1/token')) {
      return new Response(
        JSON.stringify({
          access_token: 'tok_supa_123',
          refresh_token: 'ref_supa_456',
          expires_in: 3600,
          user: { id: '11111111-1111-4111-a111-111111111111', email: 'ana@codice.app' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (urlStr.includes('/rest/v1/profiles') && init.method === 'GET') {
      return new Response(
        JSON.stringify([
          {
            id: '11111111-1111-4111-a111-111111111111',
            handle: '@anacodice',
            display_name: 'Ana Beatriz',
            privacy_level: 'followers',
            allow_wall_posts: false,
            allow_comments: true,
            allow_dms: false,
            gamification_enabled: false,
            active_title_badge: 'Curadora',
            annual_goal: 24,
          },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (urlStr.includes('/rest/v1/profiles') && init.method === 'POST') {
      const parsed = JSON.parse(init.body || '{}');
      return new Response(JSON.stringify([parsed]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('{}', { status: 200 });
  };

  try {
    const logged = await signInAccount({
      identifier: 'ana@codice.app',
      password: 'password123',
    });

    assert.equal(logged.mode, 'supabase');
    assert.equal(logged.profile.handle, '@anacodice');
    assert.equal(logged.profile.privacyLevel, 'followers');
    assert.equal(logged.profile.allowWallPosts, false);
    assert.equal(logged.profile.allowDms, false);
    assert.equal(logged.profile.gamificationEnabled, false);
    assert.equal(logged.profile.annualGoal, 24);

    await updateActiveProfileInBackend({
      ...logged.profile,
      privacyLevel: 'private',
      gamificationEnabled: true,
    });

    const upsertCall = calls.find(
      (c) => c.url.includes('/rest/v1/profiles') && c.method === 'POST'
    );
    assert.ok(upsertCall);
    const sentSql = JSON.parse(upsertCall.body);
    assert.equal(sentSql.privacy_level, 'private');
    assert.equal(sentSql.gamification_enabled, true);

    const forcedLocal = await continueInLocalMode();
    assert.equal(forcedLocal.mode, 'local');
    assert.equal(getBackendMode(), 'local');
  } finally {
    globalThis.fetch = originalFetch;
    clearSupabaseConfig();
  }
});

test('Regras de privacidade e migração v3 preservam controles sociais e gamificação', () => {
  const targetFollowers = {
    id: 'u-target',
    privacyLevel: 'followers',
    allowWallPosts: true,
    allowComments: false,
    allowDms: true,
  };

  const stranger = canInteractWithProfile(targetFollowers, {
    viewerId: 'u-other',
    isFollower: false,
  });
  assert.equal(stranger.canView, false);
  assert.equal(stranger.canFollow, true);
  assert.equal(stranger.canSendDm, false);

  const follower = canInteractWithProfile(targetFollowers, {
    viewerId: 'u-other',
    isFollower: true,
  });
  assert.equal(follower.canView, true);
  assert.equal(follower.canPostWall, true);
  assert.equal(follower.canComment, false);
  assert.equal(follower.canSendDm, true);

  const selfOwner = canInteractWithProfile(
    { id: 'u-target', privacyLevel: 'private', allowComments: false },
    { viewerId: 'u-target', isFollower: false }
  );
  assert.equal(selfOwner.canView, true);
  assert.equal(selfOwner.canComment, true);

  const sqlRow = toSqlProfileRow({
    id: '11111111-1111-4111-a111-111111111111',
    handle: '@teste',
    displayName: 'Leitor Teste',
    privacyLevel: 'followers',
    allowWallPosts: false,
    allowComments: true,
    allowDms: false,
    gamificationEnabled: false,
    activeTitleBadge: 'Arquivista',
    annualGoal: 30,
  });
  assert.equal(sqlRow.privacy_level, 'followers');
  assert.equal(sqlRow.allow_wall_posts, false);
  assert.equal(sqlRow.gamification_enabled, false);

  const dbV3 = migrateDatabase({
    version: 2,
    items: [],
    profile: {
      displayName: 'Leitor',
      handle: '@leitor',
      privacyLevel: 'followers',
      allowWallPosts: false,
      allowComments: true,
      allowDms: false,
      gamificationEnabled: false,
      activeTitleBadge: 'Arquivista',
    },
  });
  const snap = hydrateAppSnapshotFromDatabase(dbV3);
  assert.equal(snap.profile.privacyLevel, 'followers');
  assert.equal(snap.profile.allowWallPosts, false);
  assert.equal(snap.profile.gamificationEnabled, false);
  assert.equal(snap.profile.activeTitleBadge, 'Arquivista');
  assert.deepEqual(migrateDatabase(dbV3), dbV3);
});

test('supabase/schema.sql define todas as tabelas, colunas, RLS e Realtime esperados', async () => {
  const schemaPath = path.resolve(process.cwd(), 'supabase/schema.sql');
  const sql = await fs.readFile(schemaPath, 'utf8');

  const expectedTables = [
    'profiles',
    'works',
    'authors',
    'work_authors',
    'reading_sessions',
    'reviews',
    'quotes_notes',
    'journal_entries',
    'follows',
    'wall_posts',
    'post_reactions',
    'post_comments',
    'direct_messages',
  ];

  expectedTables.forEach((tbl) => {
    assert.ok(
      sql.includes(`CREATE TABLE IF NOT EXISTS public.${tbl}`),
      `Tabela ausente: ${tbl}`
    );
    assert.ok(
      sql.includes(`ALTER TABLE public.${tbl} ENABLE ROW LEVEL SECURITY`),
      `RLS ausente: ${tbl}`
    );
  });

  const expectedProfileColumns = [
    'handle',
    'display_name',
    'bio',
    'avatar_url',
    'banner_url',
    'privacy_level',
    'allow_wall_posts',
    'allow_comments',
    'allow_dms',
    'gamification_enabled',
    'active_title_badge',
    'annual_goal',
  ];

  expectedProfileColumns.forEach((col) => {
    assert.ok(sql.includes(col), `Coluna de profiles ausente: ${col}`);
  });

  assert.ok(sql.includes('supabase_realtime'));
});
