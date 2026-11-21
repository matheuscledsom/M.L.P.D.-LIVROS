import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const {
  buildOfflinePickerPool,
  buildReadingHeatmap,
  pickRandomQueuedWork,
} = await import('../src/utils/readingCheckIn.js');

const {
  createCustomCollection,
  filterWorksByCollection,
  normalizeCollectionList,
  toggleWorkInCollection,
} = await import('../src/utils/collections.js');

const {
  classifyWorkLocally,
  getTaxonomyKeywordCount,
  suggestLibraryClassification,
} = await import('../src/utils/catalogingClassification.js');

const { runLocalSmartCataloging } = await import('../src/services/localCatalogFallback.js');
const {
  buildCodiceDatabase,
  hydrateAppSnapshotFromDatabase,
} = await import('../src/services/codiceDatabase.js');

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

test('Bloco 2: Mapa de Calor agrega sessoes, check-ins avulsos e historico legado', () => {
  const heatmap = buildReadingHeatmap({
    endDate: '2026-11-20',
    weeks: 16,
    readingSessions: [
      { id: 's1', workId: 'w1', endedAt: '2026-11-20T14:00:00Z', pagesRead: 25, notes: 'Bom capitulo' },
      { id: 's2', workId: 'w1', endedAt: '2026-11-19T18:00:00Z', pagesRead: 75, notes: '' },
    ],
    dailyLogs: {
      '2026-11-18': {
        standalonePages: 12,
        standaloneSessions: 1,
        notes: ['Leitura no onibus'],
      },
    },
    streakHistory: ['2026-11-10'],
  });

  assert.equal(heatmap.columns.length, 16);
  assert.equal(heatmap.totalPages, 112);
  assert.equal(heatmap.activeDays, 4);
  assert.equal(heatmap.bestDay.date, '2026-11-19');
  assert.equal(heatmap.bestDay.pages, 75);

  const allCells = heatmap.columns.flat();
  const nov10 = allCells.find((c) => c.date === '2026-11-10');
  const nov18 = allCells.find((c) => c.date === '2026-11-18');
  const nov19 = allCells.find((c) => c.date === '2026-11-19');
  const nov20 = allCells.find((c) => c.date === '2026-11-20');

  assert.equal(nov10.level, 1);
  assert.equal(nov18.level, 1);
  assert.ok(nov18.ariaLabel.includes('12 páginas lidas'));
  assert.equal(nov19.level, 4);
  assert.equal(nov20.level, 2);
});

test('Bloco 2: Roleta offline filtra Quero Ler (<220 pags e EPUB/PDF) e evita repeticao imediata', () => {
  const items = [
    { id: 'b-long', title: 'Os Irmãos Karamazov', status: 'queued', inBacklog: true, totalPages: 960 },
    { id: 'b-quick-1', title: 'A Metamorfose', status: 'queued', inBacklog: true, totalPages: 112 },
    { id: 'b-quick-2', title: 'O Velho e o Mar', status: 'queued', inBacklog: true, totalPages: 128, readerBookId: 'rb-2' },
    { id: 'b-playing', title: 'Dom Casmurro', status: 'playing', inBacklog: true, totalPages: 180 },
    { id: 'b-done', title: 'Duna', status: 'completed', inBacklog: true, totalPages: 680 },
  ];

  assert.equal(buildOfflinePickerPool({ items, filter: 'all' }).length, 3);
  const quickPool = buildOfflinePickerPool({ items, filter: 'quick' });
  assert.deepEqual(quickPool.map((i) => i.id), ['b-quick-1', 'b-quick-2']);

  const offlinePool = buildOfflinePickerPool({
    items,
    filter: 'offline',
    storedReaderWorkIds: ['b-long'],
  });
  assert.deepEqual(offlinePool.map((i) => i.id), ['b-long', 'b-quick-2']);

  const pickRes = pickRandomQueuedWork({
    items,
    filter: 'quick',
    lastPickedId: 'b-quick-1',
    rng: () => 0,
  });
  assert.equal(pickRes.picked.id, 'b-quick-2');
  assert.equal(pickRes.poolCount, 2);

  const emptyPick = pickRandomQueuedWork({
    items: [items[3], items[4]],
    filter: 'all',
  });
  assert.equal(emptyPick.picked, null);
  assert.equal(emptyPick.poolCount, 0);
});

test('Bloco 2: Colecoes personalizadas criam, alternam, filtram e sobrevivem ao DB v4', () => {
  const c1 = createCustomCollection('Favoritos da Vida', []);
  assert.ok(c1.created);
  assert.equal(c1.duplicate, false);

  const dup = createCustomCollection('favoritos da vida', c1.collections);
  assert.equal(dup.duplicate, true);
  assert.equal(dup.collections.length, 1);

  const c2 = createCustomCollection('Faculdade / TCC', c1.collections);
  assert.equal(c2.collections.length, 2);

  let collectionIds = toggleWorkInCollection([], c1.created.id);
  collectionIds = toggleWorkInCollection(collectionIds, c2.created.id);
  assert.equal(collectionIds.length, 2);
  collectionIds = toggleWorkInCollection(collectionIds, c1.created.id);
  assert.deepEqual(collectionIds, [c2.created.id]);

  const works = [
    { id: 'w1', title: 'Livro 1', status: 'queued', collectionIds: [c1.created.id, c2.created.id] },
    { id: 'w2', title: 'Livro 2', status: 'queued', collectionIds: [c2.created.id] },
    { id: 'w3', title: 'Livro 3', status: 'queued', collectionIds: [] },
  ];

  assert.equal(filterWorksByCollection(works, 'all').length, 3);
  assert.deepEqual(
    filterWorksByCollection(works, c1.created.id).map((w) => w.id),
    ['w1']
  );

  const db = buildCodiceDatabase({
    items: works,
    collections: c2.collections,
  });
  const hydrated = hydrateAppSnapshotFromDatabase(db);
  assert.equal(normalizeCollectionList(hydrated.collections).length, 2);
  assert.deepEqual(
    hydrated.items.find((w) => w.id === 'w1')?.collectionIds,
    [c1.created.id, c2.created.id]
  );
});

test('Bloco 2: Motor de classificacao local possui 180+ keywords PT/EN e extrai genero, subgenero, CDD, Cutter e tags sem IA', async () => {
  const keywordCount = getTaxonomyKeywordCount();
  assert.ok(keywordCount >= 180, `Esperado >= 180 palavras-chave na taxonomia, obtido ${keywordCount}`);

  const scenarios = [
    {
      input: {
        title: 'Clean Code & Software Architecture',
        author: 'Robert Martin',
        synopsis: 'Guia pratico de engenharia de software, refactoring e algoritmos.',
      },
      expectedGenre: 'Computação & Tecnologia',
      expectedCdd: '004',
    },
    {
      input: {
        title: 'Meditações',
        author: 'Marco Aurélio',
        synopsis: 'Clássico do estoicismo e ética prática na filosofia antiga.',
      },
      expectedGenre: 'Filosofia',
      expectedCdd: '100',
    },
    {
      input: {
        title: 'A Interpretação dos Sonhos',
        author: 'Sigmund Freud',
        synopsis: 'Obra fundadora da psicanálise sobre o inconsciente.',
      },
      expectedGenre: 'Psicologia',
      expectedCdd: '150',
    },
    {
      input: {
        title: 'Curso de Direito Constitucional',
        author: 'Paulo Bonavides',
        synopsis: 'Estudo sobre constituição, direitos humanos e jurisprudência.',
      },
      expectedGenre: 'Direito',
      expectedCdd: '340',
    },
    {
      input: {
        title: 'Dom Casmurro',
        author: 'Machado de Assis',
        synopsis: 'Clássico da literatura brasileira no Rio do século XIX.',
      },
      expectedGenre: 'Literatura Brasileira',
      expectedCdd: '869.3',
    },
    {
      input: {
        title: 'Neuromancer',
        author: 'William Gibson',
        synopsis: 'Cyberpunk distopia espacial e hackers em estação orbital.',
      },
      expectedGenre: 'Ficção Científica',
      expectedCdd: '808.387',
    },
    {
      input: {
        title: 'O Nome do Vento',
        author: 'Patrick Rothfuss',
        synopsis: 'Alta fantasia épica de magia, escola arcana e dragões.',
      },
      expectedGenre: 'Fantasia',
      expectedCdd: '808.38',
    },
    {
      input: {
        title: 'Nas Montanhas da Loucura',
        author: 'H. P. Lovecraft',
        synopsis: 'Conto de horror cósmico, terror gótico e pesadelos ancestrais.',
      },
      expectedGenre: 'Terror & Suspense',
      expectedCdd: '808.39',
    },
    {
      input: {
        title: 'Vagabond Vol. 1',
        author: 'Takehiko Inoue',
        synopsis: 'Mangá seinen em formato tankobon sobre Miyamoto Musashi.',
      },
      expectedGenre: 'Mangás & HQs',
      expectedCdd: '741.5',
    },
    {
      input: {
        title: 'Zero to One',
        author: 'Peter Thiel',
        synopsis: 'Startup entrepreneurship, strategy and business innovation.',
      },
      expectedGenre: 'Negócios & Economia',
      expectedCdd: '650',
    },
    {
      input: {
        title: 'Breves Respostas para Grandes Questões',
        author: 'Stephen Hawking',
        synopsis: 'Divulgação científica sobre física quântica, astronomia e cosmologia.',
      },
      expectedGenre: 'Ciências',
      expectedCdd: '500',
    },
    {
      input: {
        title: 'História da Idade Média',
        author: 'Jacques Le Goff',
        synopsis: 'Análise das civilizações medievais e historiografia europeia.',
      },
      expectedGenre: 'História',
      expectedCdd: '900',
    },
  ];

  for (const s of scenarios) {
    const res = classifyWorkLocally(s.input);
    assert.equal(res.primaryGenre, s.expectedGenre, `Falhou genero para ${s.input.title}`);
    assert.equal(res.cdu_cdd, s.expectedCdd, `Falhou CDD para ${s.input.title}`);
    assert.ok(res.subgenre);
    assert.ok(res.cutter);
    assert.ok(res.callNumber.includes(s.expectedCdd));
    assert.ok(res.suggestedTags.length >= 2);
  }

  const localSmart = await runLocalSmartCataloging(
    {
      title: 'Sistemas Distribuídos e Machine Learning',
      author: 'Ana Souza',
      synopsis: 'Arquitetura cloud, redes neurais e engenharia de software em Python.',
      workType: 'book',
    },
    { queryRemote: false }
  );

  assert.equal(localSmart.updates.cdu_cdd, '004');
  assert.equal(localSmart.updates.primaryGenre, 'Computação & Tecnologia');
  assert.ok(localSmart.updates.subgenres.length >= 1);
  assert.ok(localSmart.updates.tropes.length >= 2);
  assert.ok(localSmart.updates.cutter.startsWith('S'));
  assert.ok(suggestLibraryClassification(localSmart.updates).callNumber.startsWith('004'));
});

test('Bloco 2: auditoria de UI (alvos >= 44px, tabular-nums, reduced-motion, zero emojis em src/)', async () => {
  const rootDir = process.cwd();
  const checkInCode = await fs.readFile(path.join(rootDir, 'src/components/QuickReadingCheckIn.jsx'), 'utf8');
  const heatmapCode = await fs.readFile(path.join(rootDir, 'src/components/ReadingHeatmapWidget.jsx'), 'utf8');
  const rouletteCode = await fs.readFile(path.join(rootDir, 'src/components/OfflineBookPickerModal.jsx'), 'utf8');

  assert.ok(checkInCode.includes('+10 págs'));
  assert.ok(checkInCode.includes('+25 págs'));
  assert.ok(checkInCode.includes('min-h-[44px]'));
  assert.ok(checkInCode.includes('tabular-nums'));
  assert.ok(heatmapCode.includes('Mapa de Calor de Leitura'));
  assert.ok(heatmapCode.includes('aria-label'));
  assert.ok(rouletteCode.includes('prefers-reduced-motion: reduce'));
  assert.ok(rouletteCode.includes('min-h-[44px]'));

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
