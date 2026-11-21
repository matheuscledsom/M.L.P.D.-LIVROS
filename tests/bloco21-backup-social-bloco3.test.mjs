import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

function createMemoryStorage() {
  const store = new Map();
  return {
    getItem(k) {
      return store.has(k) ? store.get(k) : null;
    },
    setItem(k, v) {
      store.set(k, String(v));
    },
    removeItem(k) {
      store.delete(k);
    },
    clear() {
      store.clear();
    },
  };
}

if (!globalThis.localStorage) {
  globalThis.localStorage = createMemoryStorage();
}

const {
  BACKUP_REMINDER_DAYS,
  EMERGENCY_MIRROR_KEY,
  compressMirrorText,
  decompressMirrorText,
  getBackupReminderStatus,
  loadEmergencyMirror,
  recordBackupExportTimestamp,
  saveEmergencyMirror,
} = await import('../src/services/backupEngine.js');

const {
  MAX_PROFILE_CARD_BYTES,
  buildProfileCardQrSvg,
  buildProfileCardShareUrl,
  decodePublicProfileCard,
  encodePublicProfileCard,
  listSavedPeerCards,
  removeSavedPeerCard,
  savePeerProfileCard,
} = await import('../src/services/peerProfileShare.js');

const { generateQrCodeMatrix } = await import('../src/utils/qrCodeSvg.js');

async function walkSrcFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkSrcFiles(fullPath)));
    } else if (/\.(js|jsx|css)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

test('Bloco 3: Espelho de Emergencia comprime, salva sem segredos e restaura acervo apos limpeza', () => {
  localStorage.clear();

  const textSample =
    'Ação e reação na literatura brasileira: citações de Machado de Assis repetidas para compressão '.repeat(
      6
    );
  const compressed = compressMirrorText(textSample);
  assert.ok(compressed.startsWith('CM1:'));
  assert.ok(compressed.length < textSample.length);
  assert.equal(decompressMirrorText(compressed), textSample);

  const ok = saveEmergencyMirror({
    items: [
      {
        id: 'w-1',
        title: 'Memórias Póstumas de Brás Cubas',
        author: 'Machado de Assis',
        status: 'playing',
        currentPage: 110,
        totalPages: 240,
        progress: 46,
        collectionIds: ['col-fav'],
        quotes: [{ id: 'q1', text: 'Ao vencedor, as batatas.', location: 'Cap. 12' }],
        apiKeyLeakAttempt: 'AIzaSyD-should-not-matter-ignored',
      },
      {
        id: 'w-2',
        title: 'Grande Sertão: Veredas',
        author: 'João Guimarães Rosa',
        status: 'completed',
        rating: 98,
        currentPage: 620,
        totalPages: 620,
      },
    ],
    collections: [{ id: 'col-fav', name: 'Favoritos da Vida' }],
    streak: {
      count: 14,
      lastDate: '2026-11-20',
      history: ['2026-11-19', '2026-11-20'],
      dailyLogs: { '2026-11-20': { standalonePages: 15, standaloneSessions: 1, notes: ['Ótima noite'] } },
    },
    readingSessions: [{ id: 's-1', workId: 'w-1', pagesRead: 25 }],
  });

  assert.equal(ok, true);
  assert.ok(localStorage.getItem(EMERGENCY_MIRROR_KEY));

  // Simula limpeza dos bancos principais mantendo apenas o espelho
  localStorage.removeItem('mlpd_livros_items');
  localStorage.removeItem('codice_relational_db_v4');

  const restored = loadEmergencyMirror();
  assert.equal(restored.ok, true);
  assert.equal(restored.items.length, 2);
  assert.equal(restored.items[0].title, 'Memórias Póstumas de Brás Cubas');
  assert.equal(restored.items[0].quotes[0].text, 'Ao vencedor, as batatas.');
  assert.equal(restored.items[0].apiKeyLeakAttempt, undefined);
  assert.equal(restored.collections[0].name, 'Favoritos da Vida');
  assert.equal(restored.streak.count, 14);
  assert.equal(restored.readingSessions[0].pagesRead, 25);
});

test('Bloco 3: Lembrete de backup dispara apos 7 dias e reseta ao exportar copia', () => {
  localStorage.clear();
  const baseMs = Date.UTC(2026, 10, 1, 12, 0, 0);
  recordBackupExportTimestamp(baseMs);

  const day3 = getBackupReminderStatus({
    itemsCount: 4,
    nowMs: baseMs + 3 * 86400000,
  });
  assert.equal(day3.shouldRemind, false);

  const day8 = getBackupReminderStatus({
    itemsCount: 4,
    nowMs: baseMs + (BACKUP_REMINDER_DAYS + 1) * 86400000,
  });
  assert.equal(day8.shouldRemind, true);
  assert.equal(day8.daysWithoutBackup, 8);

  const nowMs = baseMs + 9 * 86400000;
  recordBackupExportTimestamp(nowMs);
  const afterExport = getBackupReminderStatus({ itemsCount: 4, nowMs });
  assert.equal(afterExport.shouldRemind, false);
});

test('Bloco 3: Cartao de Perfil Vivo (?card=) valida limites de 4KB, sanitiza XSS e nunca vaza chaves', () => {
  localStorage.clear();

  const works = [
    {
      id: 'cur-1',
      title: 'Crime e Castigo <script>alert(1)</script>',
      author: 'Fiódor Dostoiévski',
      status: 'playing',
      progress: 64,
      workType: 'book',
      releaseYear: 1866,
      notes: 'Nota privada que não deve vazar no link público',
      quotes: [
        { text: 'O homem habitua-se a tudo, o canalha!', location: 'Parte I' },
        { text: 'Dor e sofrimento são sempre inevitáveis para uma grande inteligência.', location: 'Parte III' },
      ],
    },
    ...Array.from({ length: 7 }, (_, i) => ({
      id: `rated-${i}`,
      title: `Obra Avaliada ${i + 1}`,
      author: `Autor ${i + 1}`,
      status: 'completed',
      rating: 90 - i,
      totalPages: 250,
      workType: 'book',
      releaseYear: 2020 - i,
      completedDate: `2026-11-${String(10 + i).padStart(2, '0')}`,
      quotes: [{ text: `Citação pública extra ${i + 1}`, location: `p. ${i + 10}` }],
    })),
  ];

  const token = encodePublicProfileCard({
    profile: {
      handle: '@leitor_codice',
      displayName: 'Clarice <b>Leitora</b>',
      bio: 'javascript:evil() Leitora apaixonada por clássicos.',
      geminiKey: 'AIzaSy-secret-should-never-enter',
      supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secret',
    },
    items: works,
    titleName: 'Arquiteta das Estantes',
    streakCount: 21,
  });

  assert.ok(new TextEncoder().encode(token).length <= MAX_PROFILE_CARD_BYTES);

  const shareUrl = buildProfileCardShareUrl(token, 'https://codice.app/');
  assert.ok(shareUrl.startsWith('https://codice.app/?card='));

  const decoded = decodePublicProfileCard(shareUrl);
  assert.equal(decoded.ok, true);
  assert.equal(decoded.card.handle, '@leitor_codice');
  assert.equal(decoded.card.displayName.includes('<script>'), false);
  assert.equal(decoded.card.displayName.includes('<b>'), false);
  assert.equal(decoded.card.bio.toLowerCase().includes('javascript:'), false);
  assert.equal(decoded.card.activeTitle, 'Arquiteta das Estantes');
  assert.equal(decoded.card.stats.streakCount, 21);
  assert.equal(decoded.card.currentReading.progressPct, 64);
  assert.equal(decoded.card.currentReading.title.includes('<script>'), false);
  assert.equal(decoded.card.topRatedWorks.length, 5);
  assert.equal(decoded.card.publicQuotes.length, 3);

  // Nunca contém nota privada ou chaves
  assert.equal(token.includes('AIzaSy'), false);
  assert.equal(token.includes('eyJhbGci'), false);

  // Limite estrito de 4KB na decodificação
  const oversized = decodePublicProfileCard('A'.repeat(MAX_PROFILE_CARD_BYTES + 20));
  assert.equal(oversized.ok, false);

  // Rejeita token com padrão de credencial
  const badPayload = Buffer.from(
    JSON.stringify({ v: 1, h: '@evil', n: 'AIzaSyFakeSecret123456' }),
    'utf8'
  )
    .toString('base64url');
  const blocked = decodePublicProfileCard(badPayload);
  assert.equal(blocked.ok, false);

  // Persistência sem Supabase
  const saved = savePeerProfileCard(decoded.card);
  assert.equal(saved.length, 1);
  assert.equal(listSavedPeerCards().length, 1);
  removeSavedPeerCard(decoded.card.handle);
  assert.equal(listSavedPeerCards().length, 0);
});

test('Bloco 3: QR Code SVG nativo gera matriz valida com finder patterns e SVG bem formado', () => {
  const sampleUrl = 'https://codice.app/?card=eyJ2IjoxLCJoIjoiQG1hdGhldXMifQ';
  const matrix = generateQrCodeMatrix(sampleUrl);

  assert.equal(matrix.size, 17 + 4 * matrix.version);
  assert.equal(matrix.modules.length, matrix.size);
  // Verifica canto superior esquerdo do Finder Pattern 7x7 (borda externa escura + anel branco interno)
  assert.equal(matrix.modules[0][0], 1);
  assert.equal(matrix.modules[0][6], 1);
  assert.equal(matrix.modules[6][0], 1);
  assert.equal(matrix.modules[3][3], 1);
  assert.equal(matrix.modules[1][1], 0);

  const svgBundle = buildProfileCardQrSvg(sampleUrl, { size: 224, margin: 2 });
  assert.ok(svgBundle.svg.startsWith('<svg '));
  assert.ok(svgBundle.svg.includes(`viewBox="0 0 ${svgBundle.viewSize} ${svgBundle.viewSize}"`));
  assert.ok(svgBundle.svg.includes('<path d="M'));
  assert.ok(svgBundle.svg.endsWith('</svg>'));
});

test('Bloco 3: Integracao em App, Home, Perfil e Comunidade + 0 emojis em src/', async () => {
  const rootDir = process.cwd();
  const appCode = await fs.readFile(path.join(rootDir, 'src/App.jsx'), 'utf8');
  const communityCode = await fs.readFile(path.join(rootDir, 'src/components/social/CommunityScreen.jsx'), 'utf8');
  const profileCode = await fs.readFile(path.join(rootDir, 'src/screens/ProfileScreen.jsx'), 'utf8');
  const drawerCode = await fs.readFile(path.join(rootDir, 'src/components/ProfileSettingsDrawer.jsx'), 'utf8');

  assert.ok(appCode.includes('requestPersistentStorage'));
  assert.ok(appCode.includes('saveEmergencyMirror'));
  assert.ok(appCode.includes("params.get('card')"));
  assert.ok(appCode.includes('history?.replaceState'));
  assert.ok(appCode.includes('ShareProfileCardModal'));
  assert.ok(appCode.includes('FriendProfileCardModal'));

  assert.ok(communityCode.includes('Compartilhar Meu Perfil'));
  assert.ok(profileCode.includes('Compartilhar Meu Perfil'));
  assert.ok(profileCode.includes('BackupReminderBanner'));
  assert.ok(drawerCode.includes('Sincronização em Tempo Real (Avançado)'));

  const srcFiles = await walkSrcFiles(path.join(rootDir, 'src'));
  const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  for (const file of srcFiles) {
    const content = await fs.readFile(file, 'utf8');
    assert.equal(
      emojiRegex.test(content),
      false,
      `Nenhum emoji permitido em src/: encontrado em ${path.relative(rootDir, file)}`
    );
  }
});
