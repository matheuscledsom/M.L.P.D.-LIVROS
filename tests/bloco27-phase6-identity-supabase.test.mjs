import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const {
  buildUserTag,
  deriveUserDiscriminator,
  getSupabaseConfig,
  normalizeDiscriminator,
  normalizeFrontendProfile,
  resetBackendMemoryForTests,
  searchReaderProfiles,
  signUpAccount,
  toSqlProfileRow,
} = await import('../src/services/codiceBackend.js');

const {
  decodePublicProfileCard,
  encodePublicProfileCard,
} = await import('../src/services/peerProfileShare.js');

function ensureMockStorage() {
  if (!globalThis.localStorage) {
    const store = new Map();
    globalThis.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear(),
    };
  }
}

test('Fase 6: discriminador de 4 digitos (#0001-#9999), userTag e SQL mapping sao deterministicos', () => {
  const disc = deriveUserDiscriminator('seed-leitor');
  assert.match(disc, /^[0-9]{4}$/);
  assert.ok(Number(disc) >= 1 && Number(disc) <= 9999);

  assert.equal(normalizeDiscriminator('0000', 'fallback'), deriveUserDiscriminator('fallback'));
  assert.equal(normalizeDiscriminator('4821'), '4821');
  assert.equal(buildUserTag('@Ana_Clara', '4821'), '@ana_clara#4821');

  const norm = normalizeFrontendProfile({
    handle: '@machado#1839',
    displayName: 'Machado de Assis',
  });
  assert.equal(norm.handle, '@machado');
  assert.equal(norm.discriminator, '1839');
  assert.equal(norm.userTag, '@machado#1839');

  const sql = toSqlProfileRow(norm);
  assert.equal(sql.user_tag, '@machado#1839');
  assert.equal(sql.discriminator, '1839');
});

test('Fase 6: codiceBackend le VITE_SUPABASE_URL/ANON_KEY estaticamente e busca por #codigo ou @handle', async () => {
  ensureMockStorage();
  localStorage.clear();
  resetBackendMemoryForTests();

  const backendSrc = await fs.readFile(path.join(process.cwd(), 'src/services/codiceBackend.js'), 'utf8');
  assert.ok(backendSrc.includes('import.meta.env.VITE_SUPABASE_URL'));
  assert.ok(backendSrc.includes('import.meta.env.VITE_SUPABASE_ANON_KEY'));

  const prevUrl = process.env.VITE_SUPABASE_URL;
  const prevKey = process.env.VITE_SUPABASE_ANON_KEY;
  process.env.VITE_SUPABASE_URL = 'https://projeto-codice.supabase.co';
  process.env.VITE_SUPABASE_ANON_KEY = 'anon_public_key_ok';
  try {
    const cfg = getSupabaseConfig();
    assert.equal(cfg.configured, true);
    assert.equal(cfg.source, 'env');
  } finally {
    if (prevUrl === undefined) delete process.env.VITE_SUPABASE_URL;
    else process.env.VITE_SUPABASE_URL = prevUrl;
    if (prevKey === undefined) delete process.env.VITE_SUPABASE_ANON_KEY;
    else process.env.VITE_SUPABASE_ANON_KEY = prevKey;
  }

  const created = await signUpAccount({
    email: 'clarice@codice.local',
    password: 'Password123!',
    handle: '@clarice_tag',
    displayName: 'Clarice Lispector',
  });
  const tagCode = `#${created.profile.discriminator}`;
  const foundByCode = await searchReaderProfiles(tagCode);
  assert.ok(foundByCode.some((r) => r.userTag === created.profile.userTag));
});

test('Fase 6: supabase/schema.sql mantem RLS ativa em todas as tabelas e inclui user_tag + indices', async () => {
  const schema = await fs.readFile(path.join(process.cwd(), 'supabase/schema.sql'), 'utf8');
  const tables = Array.from(schema.matchAll(/CREATE TABLE IF NOT EXISTS public\.([a-z_]+)/g)).map((m) => m[1]);
  assert.equal(tables.length, 13);
  for (const tbl of tables) {
    assert.ok(
      schema.includes(`ALTER TABLE public.${tbl} ENABLE ROW LEVEL SECURITY;`),
      `RLS obrigatorio ausente para tabela ${tbl}`
    );
  }
  assert.ok(schema.includes('ADD COLUMN IF NOT EXISTS user_tag'));
  assert.ok(schema.includes('idx_profiles_user_tag_lower'));
});

test('Fase 6: Cartao Vivo preserva userTag e CommunityScreen confirma importacao antes de salvar', async () => {
  const token = encodePublicProfileCard({
    profile: { handle: '@dom_casmurro', userTag: '@dom_casmurro#7742', displayName: 'Bentinho' },
    items: [],
  });
  const decoded = decodePublicProfileCard(token);
  assert.equal(decoded.ok, true);
  assert.equal(decoded.card.userTag, '@dom_casmurro#7742');

  const commSrc = await fs.readFile(path.join(process.cwd(), 'src/components/social/CommunityScreen.jsx'), 'utf8');
  assert.ok(commSrc.includes('handleImportLiveCard'));
  assert.ok(commSrc.includes('decodePublicProfileCard'));
  assert.ok(commSrc.includes('onOpenFriendCard?.(decoded.card)'));
});
