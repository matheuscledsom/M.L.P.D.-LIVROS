import assert from 'node:assert/strict';
import test from 'node:test';

const {
  CODICE_SCHEMA_VERSION,
  detectSchemaVersion,
  generateBibtexString,
  generateCatalogCsv,
  hydrateAppSnapshotFromDatabase,
  migrateDatabase,
  parseAndValidateBackupText,
  validateReferentialIntegrity,
} = await import('../src/services/codiceDatabase.js');

const {
  generateCutterCode,
  suggestCdd,
  suggestLibraryClassification,
} = await import('../src/utils/catalogingClassification.js');

test('migracao em cadeia v1 -> v2 -> v3 e idempotente e preserva dados reais', () => {
  const realLegacyV1Backup = [
    {
      id: 'legacy-1',
      title: 'Código Limpo',
      creator: 'Robert C. Martin',
      releaseYear: 2009,
      totalPages: 425,
      status: 'completed',
      rating: 92,
      reviewCriteria: {
        gameplay: 90,
        story: 80,
        audiovisual: 95,
        impact: 96,
        ignoreStory: true,
      },
      genres: ['Tecnologia', 'Engenharia de Software'],
      dropReason: '😴 Leitura arrastada',
      quotes: [
        { id: 'q1', text: 'Código limpo parece ter sido escrito por alguém que se importa.', location: 'Pág. 14' },
      ],
    },
  ];

  assert.equal(detectSchemaVersion(realLegacyV1Backup), 1);

  const v3First = migrateDatabase(realLegacyV1Backup);
  assert.equal(v3First.schemaVersion, CODICE_SCHEMA_VERSION);
  assert.equal(v3First.tables.works.length, 1);
  assert.equal(v3First.tables.authors.length, 1);
  assert.equal(v3First.tables.work_authors[0].role, 'autor');
  assert.equal(v3First.tables.reviews.length, 1);
  assert.equal(v3First.tables.reviews[0].reviewCriteria.ignoreCharacters, true);
  assert.equal(v3First.tables.works[0].dropReason, 'Leitura arrastada');
  assert.equal(v3First.tables.quotes_notes.length, 1);

  // Idempotencia: migrar novamente o resultado v3 produz estrutura identica
  const v3Second = migrateDatabase(v3First);
  assert.deepEqual(v3Second, v3First);

  // Hidratação de volta para snapshot da aplicação preserva tudo
  const hydrated = hydrateAppSnapshotFromDatabase(v3First);
  assert.equal(hydrated.items[0].author, 'Robert C. Martin');
  assert.equal(hydrated.items[0].quotes.length, 1);
  assert.equal(hydrated.items[0].rating, 92);
});

test('migracao v2 -> v3 converte perfil antigo e links N:N autor/tradutor/orientador', () => {
  const legacyV2 = {
    version: 3,
    domain: 'livros',
    exportedAt: '2026-05-01T12:00:00.000Z',
    items: [
      {
        id: 'book-2',
        title: 'Metodologia Científica',
        author: 'Silva, João; Souza, Maria',
        translator: 'Carlos Mendes',
        advisor: 'Profa. Ana Paula',
        workType: 'academic',
        status: 'playing',
        currentPage: 40,
        totalPages: 160,
        genres: ['Metodologia'],
      },
    ],
    profile: {
      displayName: 'aihkaze',
      handle: '@aihkaze',
      linkLabel: 'mlpd.livros/aihkaze',
      linkUrl: 'https://mlpd.livros/aihkaze',
    },
    posts: [
      {
        id: 'post-1',
        itemId: 'book-2',
        title: 'Resumo Cap 2',
        caption: 'Ótima explicação.',
        createdAt: '2026-05-01T12:00:00.000Z',
      },
    ],
    streak: { count: 4, lastDate: '2026-05-01', history: ['2026-05-01'] },
  };

  assert.equal(detectSchemaVersion(legacyV2), 2);
  const v3 = migrateDatabase(legacyV2);
  assert.equal(v3.tables.user_profile.linkLabel, 'codice.app/@aihkaze');
  assert.equal(v3.tables.work_authors.filter((l) => l.role === 'autor').length, 2);
  assert.equal(v3.tables.work_authors.filter((l) => l.role === 'tradutor').length, 1);
  assert.equal(v3.tables.work_authors.filter((l) => l.role === 'orientador').length, 1);
  assert.equal(v3.tables.journal_entries[0].workId, 'book-2');
});

test('validacao de integridade referencial reporta orfaos sem descarta-los', () => {
  const brokenDb = {
    schemaVersion: CODICE_SCHEMA_VERSION,
    tables: {
      works: [{ id: 'w1', title: 'Obra válida' }],
      authors: [],
      work_authors: [],
      reading_sessions: [{ id: 's1', workId: 'missing-work', durationSeconds: 120 }],
      reviews: [],
      quotes_notes: [{ id: 'q1', workId: 'missing-work', text: 'Citação órfã' }],
      journal_entries: [],
      user_profile: { displayName: 'Leitor' },
    },
  };

  const integrity = validateReferentialIntegrity(brokenDb);
  assert.equal(integrity.valid, false);
  assert.equal(integrity.orphanCount, 2);

  const parsed = parseAndValidateBackupText(JSON.stringify(brokenDb));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.integrity.orphanCount, 2);
  assert.equal(parsed.readingSessions.length, 1);
  assert.equal(parsed.db.tables.quotes_notes.length, 1);
});

test('exportacao CSV possui BOM UTF-8 e BibTeX escapa caracteres especiais com chaves unicas', () => {
  const db = migrateDatabase({
    version: 3,
    items: [
      {
        id: 'w-a',
        title: 'Arte & Ciência, 100% Prático_v1',
        author: 'João Silva',
        publicationYear: 2024,
        publisher: 'Editora & Cia',
        cdu_cdd: '004',
        cutter: 'S586a',
        callNumber: '004 S586a',
      },
      {
        id: 'w-b',
        title: 'Arte Moderna',
        author: 'João Silva',
        publicationYear: 2024,
        doi: '10.1000/xyz',
        publisher: 'Revista Brasileira',
      },
    ],
  });

  const csv = generateCatalogCsv(db);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"Arte & Ciência, 100% Prático_v1"'));
  assert.ok(csv.includes('004 S586a'));

  const bib = generateBibtexString(db);
  assert.ok(bib.includes('@book{silva2024arte,'));
  assert.ok(bib.includes('@article{silva2024arte_2,'));
  assert.ok(bib.includes('Arte \\& Ciência, 100\\% Prático\\_v1'));
  assert.ok(bib.includes('Editora \\& Cia'));
});

test('sugestao CDD e notacao Cutter cobrem classes principais corretamente', () => {
  assert.equal(suggestCdd({ genres: ['Computação'] }).cdd, '004');
  assert.equal(suggestCdd({ genres: ['Filosofia'] }).cdd, '100');
  assert.equal(suggestCdd({ genres: ['Religião'] }).cdd, '200');
  assert.equal(suggestCdd({ genres: ['Sociologia'] }).cdd, '300');
  assert.equal(suggestCdd({ genres: ['Linguística'] }).cdd, '400');
  assert.equal(suggestCdd({ genres: ['Física'] }).cdd, '500');
  assert.equal(suggestCdd({ genres: ['Engenharia'] }).cdd, '600');
  assert.equal(suggestCdd({ workType: 'manga' }).cdd, '741.5');
  assert.equal(suggestCdd({ genres: ['Literatura Brasileira'] }).cdd, '869.3');
  assert.equal(suggestCdd({ genres: ['História'] }).cdd, '900');

  const cutter = generateCutterCode('João Silva', 'A Casa');
  assert.match(cutter, /^S\d{3}c$/);

  const full = suggestLibraryClassification({
    title: 'A Casa',
    author: 'João Silva',
    genres: ['Literatura Brasileira'],
  });
  assert.equal(full.cdu_cdd, '869.3');
  assert.equal(full.callNumber, `869.3 ${full.cutter}`);
});
