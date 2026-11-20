import assert from 'node:assert/strict';
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
  READER_TITLE_CATEGORIES,
  READER_TITLES_CATALOG,
  detectLivingReaderTitle,
  evaluateReaderTitles,
} = await import('../src/services/readerTitlesEngine.js');

const {
  addSocialComment,
  clearSupabaseConfig,
  createWallPost,
  deleteWallPost,
  ensureLocalCommunitySeeded,
  followReader,
  getReaderProfileBundle,
  getUnreadMessagesCount,
  listActivityFeed,
  listDirectMessages,
  listPendingFollowRequests,
  listWallPosts,
  markConversationRead,
  resetBackendMemoryForTests,
  respondFollowRequest,
  searchReaderProfiles,
  sendDirectMessage,
  signInAccount,
  signUpAccount,
  syncActiveWorkspaceToBackend,
  togglePinWallPost,
  togglePostReaction,
  updateActiveProfileInBackend,
} = await import('../src/services/codiceBackend.js');

test('Motor de Títulos Dinâmicos possui 125+ títulos, detecta Título Vivo por CDD/gênero e alterna Automático/Fixado', () => {
  assert.ok(
    READER_TITLES_CATALOG.length >= 125,
    `Esperado >= 125 títulos, encontrado ${READER_TITLES_CATALOG.length}`
  );

  const uniqueIds = new Set(READER_TITLES_CATALOG.map((t) => t.id));
  assert.equal(uniqueIds.size, READER_TITLES_CATALOG.length);
  assert.ok(READER_TITLE_CATEGORIES.some((c) => c.id === 'living'));
  assert.ok(READER_TITLE_CATEGORIES.some((c) => c.id === 'genre'));
  assert.ok(READER_TITLE_CATEGORIES.some((c) => c.id === 'library'));

  // 1) Estudante de Computação & Algoritmos (CDD 004)
  const csLiving = detectLivingReaderTitle([
    {
      id: 'w1',
      title: 'Estruturas de Dados e Algoritmos',
      status: 'playing',
      cdu_cdd: '004',
      updatedAt: '2026-10-10T12:00:00Z',
    },
  ]);
  assert.equal(csLiving?.name, 'Estudante de Computação & Algoritmos');

  // 2) Estudioso de Direito (CDD 340)
  const lawLiving = detectLivingReaderTitle([
    {
      id: 'w2',
      title: 'Curso de Direito Constitucional',
      status: 'playing',
      cdu_cdd: '342',
    },
  ]);
  assert.equal(lawLiving?.name, 'Estudioso de Direito');

  // 3) Estudioso de Psicologia (CDD 150)
  const psychLiving = detectLivingReaderTitle([
    {
      id: 'w3',
      title: 'Introdução à Psicanálise',
      status: 'playing',
      cdu_cdd: '150',
    },
  ]);
  assert.equal(psychLiving?.name, 'Estudioso de Psicologia');

  // 4) Explorador de Mundos Fantásticos
  const fantasyLiving = detectLivingReaderTitle([
    {
      id: 'w4',
      title: 'O Caminho dos Reis',
      status: 'playing',
      genres: ['Alta Fantasia'],
    },
  ]);
  assert.equal(fantasyLiving?.name, 'Explorador de Mundos Fantásticos');

  // 5) Leitor de Mangá Shonen
  const shonenLiving = detectLivingReaderTitle([
    {
      id: 'w5',
      title: 'Jujutsu Kaisen',
      status: 'playing',
      workType: 'manga',
      demographicOrigin: 'Shonen',
    },
  ]);
  assert.equal(shonenLiving?.name, 'Leitor de Mangá Shonen');

  // Avalia marcos especiais (Coruja da Madrugada + Viajante E-Ink) & Automático vs Fixado
  const nightSessions = Array.from({ length: 5 }, (_, idx) => ({
    id: `s-${idx}`,
    startedAt: '2026-10-10T23:45:00',
  }));
  const einkItems = [
    {
      id: 'e1',
      title: 'Algoritmos em JavaScript',
      status: 'playing',
      inBacklog: true,
      cdu_cdd: '005',
      progressMode: 'percent',
      progress: 40,
    },
    ...Array.from({ length: 4 }, (_, idx) => ({
      id: `e-${idx + 2}`,
      title: `EPUB Técnico ${idx + 2}`,
      status: 'completed',
      inBacklog: true,
      progressMode: idx % 2 === 0 ? 'loc' : 'percent',
      hasDigitalFile: true,
      totalPages: 250,
      currentPage: 250,
    })),
  ];

  const autoEval = evaluateReaderTitles({
    items: einkItems,
    profile: { activeTitleBadge: 'auto' },
    readingSessions: nightSessions,
    storedReaderBooksCount: 2,
  });

  assert.equal(autoEval.isAutoMode, true);
  assert.equal(
    autoEval.resolvedActiveBadge.name,
    'Estudante de Computação & Algoritmos'
  );
  assert.equal(
    autoEval.catalog.find((b) => b.name === 'Coruja da Madrugada')?.unlocked,
    true
  );
  assert.equal(
    autoEval.catalog.find((b) => b.name === 'Viajante E-Ink')?.unlocked,
    true
  );

  const pinnedEval = evaluateReaderTitles({
    items: einkItems,
    profile: { activeTitleBadge: 'Viajante E-Ink' },
    readingSessions: nightSessions,
    storedReaderBooksCount: 2,
  });
  assert.equal(pinnedEval.isAutoMode, false);
  assert.equal(pinnedEval.resolvedActiveBadge.name, 'Viajante E-Ink');
});

test('Rede Social Local: seguir, solicitações pendentes, mural, feed/likes/comentários e chat 1:1 com anexo de livro', async () => {
  globalThis.localStorage.clear();
  clearSupabaseConfig();
  resetBackendMemoryForTests();

  // Cria Usuária A (pública)
  const aliceSignUp = await signUpAccount({
    email: 'alice@codice.app',
    handle: '@alice',
    displayName: 'Alice Leituras',
    password: 'Password!1',
  });
  const aliceId = aliceSignUp.user.id;
  await syncActiveWorkspaceToBackend({
    profile: { ...aliceSignUp.profile, privacyLevel: 'public' },
    items: [
      {
        id: 'book-a1',
        title: 'Memórias Póstumas de Brás Cubas',
        originalTitle: 'Memórias Póstumas de Brás Cubas',
        creator: 'Machado de Assis',
        status: 'playing',
        inBacklog: true,
        currentPage: 100,
        totalPages: 250,
        genres: ['Clássicos', 'Literatura Brasileira'],
      },
    ],
    posts: [
      {
        id: 'journal-a1',
        title: 'Nota sobre capítulo 10',
        caption: 'Ironia machadiana impecável.',
        itemTitle: 'Memórias Póstumas de Brás Cubas',
        createdAt: '2026-10-12T10:00:00Z',
        visibility: 'public',
      },
    ],
  });

  // Cria Usuário B (followers-only inicialmente)
  const brunoSignUp = await signUpAccount({
    email: 'bruno@codice.app',
    handle: '@bruno',
    displayName: 'Bruno Pesquisador',
    password: 'Password!2',
  });
  const brunoId = brunoSignUp.user.id;
  await syncActiveWorkspaceToBackend({
    profile: { ...brunoSignUp.profile, privacyLevel: 'followers' },
    items: [
      {
        id: 'book-b1',
        title: 'Código Limpo',
        originalTitle: 'Clean Code',
        creator: 'Robert C. Martin',
        status: 'completed',
        inBacklog: true,
        cdu_cdd: '005.1',
        rating: 9.5,
      },
    ],
    posts: [],
  });

  await ensureLocalCommunitySeeded();

  // Logado como Bruno, busca Alice no diretório e segue imediatamente (público => approved)
  const directoryForBruno = await searchReaderProfiles('alice', { viewerId: brunoId });
  assert.ok(directoryForBruno.some((r) => r.id === aliceId));

  const followAlice = await followReader(aliceId, { viewerId: brunoId });
  assert.equal(followAlice.status, 'approved');

  // Alice segue Bruno (followers => pending) e verifica restrição antes da aprovação
  await signInAccount({ identifier: '@alice', password: 'Password!1' });
  const followBruno = await followReader(brunoId, { viewerId: aliceId });
  assert.equal(followBruno.status, 'pending');

  const restrictedBundle = await getReaderProfileBundle(brunoId, { viewerId: aliceId });
  assert.equal(restrictedBundle.restricted, true);
  assert.equal(restrictedBundle.publicShelf.length, 0);

  // Bruno visualiza solicitações pendentes e aprova Alice
  const pendingForBruno = await listPendingFollowRequests(brunoId);
  assert.equal(pendingForBruno.length, 1);
  assert.equal(pendingForBruno[0].followerId, aliceId);

  const approvedRes = await respondFollowRequest(aliceId, true, { profileId: brunoId });
  assert.equal(approvedRes.status, 'approved');

  const unlockedBundle = await getReaderProfileBundle(brunoId, { viewerId: aliceId });
  assert.equal(unlockedBundle.restricted, false);
  assert.equal(unlockedBundle.publicShelf.length, 1);

  // Mural de recados: criar, fixar e respeitar allowWallPosts: false
  const post1 = await createWallPost(brunoId, 'Boa curadoria em Engenharia de Software!', {
    viewerId: aliceId,
  });
  const wallBeforePin = await listWallPosts(brunoId, { viewerId: aliceId });
  assert.equal(wallBeforePin.length, 1);
  assert.equal(wallBeforePin[0].pinned, false);

  await togglePinWallPost(post1.id, { viewerId: brunoId });
  const wallAfterPin = await listWallPosts(brunoId, { viewerId: brunoId });
  assert.equal(wallAfterPin[0].pinned, true);

  await deleteWallPost(post1.id, { viewerId: aliceId });
  const wallAfterDelete = await listWallPosts(brunoId, { viewerId: aliceId });
  assert.equal(wallAfterDelete.length, 0);

  // Feed de Atividades: reações e comentários + bloqueio de allowComments: false
  const feed = await listActivityFeed({ viewerId: brunoId });
  const aliceJournal = feed.find((row) => row.id === 'journal-a1');
  assert.ok(aliceJournal, 'Post público de Alice deve aparecer no feed de Bruno');

  const likeRes = await togglePostReaction({
    targetType: 'journal',
    targetId: aliceJournal.id,
    viewerId: brunoId,
  });
  assert.equal(likeRes.liked, true);
  assert.equal(likeRes.count, 1);

  const commentRes = await addSocialComment({
    targetType: 'journal',
    targetId: aliceJournal.id,
    content: 'Concordo plenamente com essa leitura.',
    ownerProfileId: aliceId,
    viewerId: brunoId,
  });
  assert.equal(commentRes.content, 'Concordo plenamente com essa leitura.');

  // Chat 1:1 com anexo de livro + contador não lido + readAt
  const sentDm = await sendDirectMessage({
    recipientId: brunoId,
    content: 'Dá uma olhada nessa edição!',
    attachedWorkSnapshot: {
      id: 'book-a1',
      title: 'Memórias Póstumas de Brás Cubas',
      originalTitle: 'Memórias Póstumas de Brás Cubas',
      author: 'Machado de Assis',
    },
    viewerId: aliceId,
  });
  assert.equal(sentDm.attachedWorkSnapshot.title, 'Memórias Póstumas de Brás Cubas');

  assert.equal(await getUnreadMessagesCount({ viewerId: brunoId }), 1);
  const thread = await listDirectMessages(aliceId, { viewerId: brunoId });
  assert.equal(thread.length, 1);
  assert.equal(thread[0].attachedWorkSnapshot.author, 'Machado de Assis');

  await markConversationRead(aliceId, { viewerId: brunoId });
  assert.equal(await getUnreadMessagesCount({ viewerId: brunoId }), 0);

  // Verifica bloqueios explícitos de privacidade (allowWallPosts / allowComments / allowDms = false)
  await signInAccount({ identifier: '@bruno', password: 'Password!2' });
  await updateActiveProfileInBackend({
    ...brunoSignUp.profile,
    privacyLevel: 'public',
    allowWallPosts: false,
    allowComments: false,
    allowDms: false,
  });

  await assert.rejects(
    () => createWallPost(brunoId, 'Tentativa bloqueada', { viewerId: aliceId }),
    (err) => err.code === 'WALL_DISABLED'
  );

  await assert.rejects(
    () =>
      sendDirectMessage({
        recipientId: brunoId,
        content: 'Tentativa DM bloqueada',
        viewerId: aliceId,
      }),
    (err) => err.code === 'DMS_DISABLED'
  );
});
