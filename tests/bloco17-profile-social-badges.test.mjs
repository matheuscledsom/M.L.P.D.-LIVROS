import test from 'node:test';
import assert from 'node:assert/strict';

function createMemoryStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
    removeItem(key) {
      store.delete(String(key));
    },
    clear() {
      store.clear();
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null;
    },
    get length() {
      return store.size;
    },
  };
}

if (!globalThis.localStorage) {
  globalThis.localStorage = createMemoryStorage();
}

const {
  BADGE_RULES,
  canPinTitleBadge,
  computeConsecutiveReadingDays,
  computeSafeBadgeProgress,
  evaluateReaderTitles,
  pinTitleBadge,
} = await import('../src/services/readerTitlesEngine.js');

const {
  buildInviteShareUrl,
  ensureLocalCommunitySeeded,
  isServiceRoleKey,
  listDirectMessages,
  listLocalInviteContacts,
  MAX_SOCIAL_MESSAGE_CHARS,
  parseInviteHandleParam,
  resolveInviteProfile,
  saveSupabaseConfig,
  searchReaderProfiles,
  sendDirectMessage,
  subscribeDirectMessagesRealtime,
  testSupabaseConnection,
  validateSupabaseProjectUrl,
} = await import('../src/services/codiceBackend.js');

function makeFakeJwt(payloadObj) {
  const encode = (obj) =>
    Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payloadObj)}.sig`;
}

function localIsoDaysAgo(baseDate, daysAgo, hour = 14) {
  const dt = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate() - daysAgo,
    hour,
    15,
    0,
    0
  );
  return dt.toISOString();
}

test('computeConsecutiveReadingDays calcula dias locais consecutivos e quebra em dia pulado', () => {
  const now = new Date(2026, 9, 20, 18, 0, 0);

  assert.equal(computeConsecutiveReadingDays([], now), 0);

  const oldOnly = [{ endedAt: localIsoDaysAgo(now, 4) }];
  assert.equal(computeConsecutiveReadingDays(oldOnly, now), 0);

  const streakBroken = [
    { endedAt: localIsoDaysAgo(now, 0) },
    { endedAt: localIsoDaysAgo(now, 1) },
    // dia 2 pulado
    { endedAt: localIsoDaysAgo(now, 3) },
    { endedAt: localIsoDaysAgo(now, 4) },
  ];
  assert.equal(computeConsecutiveReadingDays(streakBroken, now), 2);

  const continuousIncludingYesterday = [
    { endedAt: localIsoDaysAgo(now, 1) },
    { endedAt: localIsoDaysAgo(now, 2) },
    { endedAt: localIsoDaysAgo(now, 3) },
  ];
  assert.equal(
    computeConsecutiveReadingDays(continuousIncludingYesterday, now),
    3
  );
});

test('computeSafeBadgeProgress protege contra divisão por zero e mantém intervalo válido', () => {
  const zeroTarget = computeSafeBadgeProgress(5, 0);
  const negTarget = computeSafeBadgeProgress(10, -4);
  assert.equal(Number.isFinite(zeroTarget), true);
  assert.equal(Number.isFinite(negTarget), true);
  assert.equal(zeroTarget, 0);
  assert.equal(negTarget, 0);
});

test('evaluateReaderTitles diferencia insígnias bloqueadas, desbloqueadas no limite exato e limpa pin inválido', () => {
  assert.ok(Array.isArray(BADGE_RULES) && BADGE_RULES.length > 0);

  const emptyEval = evaluateReaderTitles({
    items: [],
    profile: { activeTitleBadge: 'auto' },
    readingSessions: [],
    streakCount: 0,
    posts: [],
  });
  assert.equal(emptyEval.unlockedCount, 0);
  assert.equal(
    emptyEval.catalog.every((b) => b.earned === false),
    true
  );

  // Tenta fixar uma insígnia bloqueada -> deve recusar
  const firstBadge = emptyEval.catalog[0];
  assert.equal(canPinTitleBadge(firstBadge.id, emptyEval.catalog), false);
  const pinAttempt = pinTitleBadge(
    { activeTitleBadge: 'auto' },
    firstBadge.id,
    emptyEval.catalog
  );
  assert.equal(pinAttempt.allowed, false);

  // Perfil legado com insígnia travada fixada -> deve limpar para 'auto'
  const staleEval = evaluateReaderTitles({
    items: [],
    profile: { activeTitleBadge: firstBadge.id },
    readingSessions: [],
    streakCount: 0,
    posts: [],
  });
  assert.equal(staleEval.stalePinnedCleared, true);
  assert.equal(staleEval.sanitizedActiveTitleBadge, 'auto');

  // Exatamente 1 sessão concluída (limite exato da regra sessions_iniciante)
  const sessionsRule = emptyEval.catalog.find((r) => r.id === 'sessions_iniciante');
  assert.ok(sessionsRule, 'Regra sessions_iniciante deve existir no catálogo');
  const exactTarget = sessionsRule.target || 1;
  const exactSessions = Array.from({ length: exactTarget }, (_, idx) => ({
    id: `s-${idx}`,
    endedAt: new Date().toISOString(),
    pagesDelta: 5,
    finished: true,
  }));

  const exactEval = evaluateReaderTitles({
    items: [],
    profile: { activeTitleBadge: 'sessions_iniciante' },
    readingSessions: exactSessions,
    streakCount: 0,
    posts: [],
  });
  const unlockedBadge = exactEval.catalog.find(
    (b) => b.id === 'sessions_iniciante'
  );
  assert.equal(unlockedBadge?.earned, true);
  assert.equal(canPinTitleBadge('sessions_iniciante', exactEval.catalog), true);
  assert.equal(exactEval.stalePinnedCleared, false);
  assert.equal(exactEval.resolvedActiveBadge?.id, 'sessions_iniciante');
});

test('Validação de URL Supabase e bloqueio estrito de chaves secretas', async () => {
  const secretRoleName = ['service', 'role'].join('_');
  const privilegedJwt = makeFakeJwt({ role: secretRoleName, iss: 'supabase' });
  const anonJwt = makeFakeJwt({ role: 'anon', iss: 'supabase' });

  assert.equal(isServiceRoleKey(privilegedJwt), true);
  assert.equal(isServiceRoleKey('sb_secret_abc123'), true);
  assert.equal(isServiceRoleKey(anonJwt), false);

  assert.equal(
    validateSupabaseProjectUrl('https://meuprojeto.supabase.co'),
    'https://meuprojeto.supabase.co'
  );
  assert.equal(
    validateSupabaseProjectUrl('http://meuprojeto.supabase.co'),
    ''
  );
  assert.equal(
    validateSupabaseProjectUrl('https://evil.example.com'),
    ''
  );

  assert.throws(() => {
    saveSupabaseConfig({
      url: 'https://meuprojeto.supabase.co',
      anonKey: privilegedJwt,
    });
  });

  const connRes = await testSupabaseConnection({
    url: 'https://meuprojeto.supabase.co',
    anonKey: privilegedJwt,
  });
  assert.equal(connRes.ok, false);
});

test('Convite ?invite=@handle valida caracteres, importa offline apenas campos públicos e nunca faz auto-follow', async () => {
  globalThis.localStorage.clear();

  assert.equal(parseInviteHandleParam('ana_silva'), '@ana_silva');
  assert.equal(parseInviteHandleParam('@Lucas.Dias'), '@lucas.dias');
  assert.equal(parseInviteHandleParam('<script>alert(1)</script>'), null);
  assert.equal(parseInviteHandleParam(''), null);

  const shareUrl = buildInviteShareUrl('@leitor_teste', 'https://codice.app');
  assert.ok(shareUrl.includes('?invite='));
  assert.ok(shareUrl.includes('%40leitor_teste'));

  await ensureLocalCommunitySeeded();
  const resolved = await resolveInviteProfile('@novo_convidado', {
    viewerId: 'local-default',
  });
  assert.ok(resolved);
  assert.equal(resolved.handle, '@novo_convidado');
  assert.equal(resolved.isLocalContact, true);

  const contacts = await listLocalInviteContacts();
  assert.ok(contacts.some((c) => c.handle === '@novo_convidado'));

  // Garantir que convidar NÃO gerou follow automático em leitores locais
  const peers = await searchReaderProfiles('', { viewerId: 'local-default' });
  const autoFollowedUnknown = peers.find(
    (p) => p.handle === '@novo_convidado' && p.followStatus === 'approved'
  );
  assert.equal(autoFollowedUnknown, undefined);
});

test('Chat direto impõe limite de 2000 caracteres, ordena por timestamp e limpa inscrição realtime offline', async () => {
  globalThis.localStorage.clear();
  await ensureLocalCommunitySeeded();
  const peers = await searchReaderProfiles('', { viewerId: 'local-default' });
  const peer = peers.find((p) => !p.isSelf);
  assert.ok(peer, 'Deve existir um leitor seed local para testar DM');

  const tooLong = 'a'.repeat(MAX_SOCIAL_MESSAGE_CHARS + 1);
  await assert.rejects(() =>
    sendDirectMessage({
      recipientId: peer.id,
      content: tooLong,
      viewerId: 'local-default',
    })
  );

  await sendDirectMessage({
    recipientId: peer.id,
    content: 'Primeira nota textual',
    viewerId: 'local-default',
  });

  const list = await listDirectMessages(peer.id, { viewerId: 'local-default' });
  assert.ok(list.length >= 1);
  for (let i = 1; i < list.length; i++) {
    const prevTs = new Date(list[i - 1].createdAt).getTime();
    const curTs = new Date(list[i].createdAt).getTime();
    assert.ok(curTs >= prevTs);
  }

  const unsub = subscribeDirectMessagesRealtime({
    viewerId: 'local-default',
    onMessage: () => {},
  });
  assert.equal(typeof unsub, 'function');
  assert.doesNotThrow(() => unsub());
});
