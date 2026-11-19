import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearMemorySnapshotsForTests,
  exportSignedBackupPayload,
  inspectBackupPayload,
  listAutoSnapshots,
  MAX_AUTO_SNAPSHOTS,
  mergeSnapshots,
  saveAutoSnapshot,
} from '../src/services/backupEngine.js';
import {
  buildCodiceDatabase,
  CODICE_SCHEMA_VERSION,
  detectSchemaVersion,
  migrateDatabase,
} from '../src/services/codiceDatabase.js';

test('migracao v3 -> v4.0-codice-sql e idempotente e inclui campos flexiveis, emprestimo e tabelas sociais', () => {
  const legacyV3 = {
    schemaVersion: '3.0-codice-sql',
    schemaNumericVersion: 3,
    exportedAt: '2026-06-01T10:00:00.000Z',
    tables: {
      works: [
        {
          id: 'w1',
          title: 'O Processo',
          status: 'playing',
          progressMode: 'loc',
          locCurrent: 450,
          locTotal: 1800,
          progressPercent: 25,
          originalTitle: 'Der Process',
          loanedTo: 'Marina',
          loanedAt: '2026-06-01',
        },
      ],
      authors: [],
      work_authors: [],
      reading_sessions: [],
      reviews: [],
      quotes_notes: [
        { id: 'q1', workId: 'w1', text: 'Alguém devia ter caluniado Josef K.', color: 'amber', note: 'Início', cfi: 'epubcfi(/6/2)' },
      ],
      journal_entries: [],
      user_profile: { displayName: 'Leitor' },
    },
  };

  assert.equal(detectSchemaVersion(legacyV3), 3);
  const v4 = migrateDatabase(legacyV3);
  assert.equal(v4.schemaVersion, CODICE_SCHEMA_VERSION);
  assert.equal(v4.schemaNumericVersion, 4);
  assert.equal(v4.tables.works[0].progressMode, 'loc');
  assert.equal(v4.tables.works[0].locCurrent, 450);
  assert.equal(v4.tables.works[0].originalTitle, 'Der Process');
  assert.equal(v4.tables.works[0].loanedTo, 'Marina');
  assert.deepEqual(v4.tables.follows, []);
  assert.deepEqual(v4.tables.wall_posts, []);
  assert.deepEqual(v4.tables.direct_messages, []);

  // Idempotencia v4 -> v4
  assert.deepEqual(migrateDatabase(v4), v4);
});

test('exportSignedBackupPayload e inspectBackupPayload validam SHA-256, contagens e detectam adulteracao', async () => {
  const db = buildCodiceDatabase({
    items: [
      {
        id: 'book-sha',
        title: 'Dom Casmurro',
        author: 'Machado de Assis',
        status: 'playing',
        progressMode: 'percent',
        progressPercent: 40,
        rating: 95,
        quotes: [
          { id: 'q-1', text: 'Olhos de ressaca.', location: 'Cap. 32', color: 'amber', note: 'Clássico' },
        ],
      },
    ],
    posts: [{ id: 'p-1', itemId: 'book-sha', title: 'Impressões', caption: 'Excelente' }],
    readingSessions: [{ id: 's-1', workId: 'book-sha', durationSeconds: 900, pagesRead: 22 }],
  });

  const signed = await exportSignedBackupPayload(db);
  assert.equal(signed.checksum.algorithm, 'SHA-256');
  assert.match(signed.checksum.digest, /^[a-f0-9]{16,}$/);

  const validInspection = await inspectBackupPayload(JSON.stringify(signed));
  assert.equal(validInspection.ok, true);
  assert.equal(validInspection.checksumStatus, 'valid');
  assert.equal(validInspection.counts.works, 1);
  assert.equal(validInspection.counts.quotes, 1);
  assert.equal(validInspection.counts.reviews, 1);
  assert.equal(validInspection.counts.journalEntries, 1);
  assert.equal(validInspection.counts.readingSessions, 1);

  // Adultera 1 título sem recalcular o checksum
  const tampered = structuredClone(signed);
  tampered.tables.works[0].title = 'Título Adulterado';
  const tamperedInspection = await inspectBackupPayload(JSON.stringify(tampered));
  assert.equal(tamperedInspection.ok, true);
  assert.equal(tamperedInspection.checksumStatus, 'tampered');
});

test('mergeSnapshots une acervos, citacoes e sessoes preservando registros mais recentes sem perda', () => {
  const current = {
    items: [
      {
        id: 'w1',
        title: 'Obra Local',
        updatedAt: '2026-06-05T10:00:00.000Z',
        quotes: [{ id: 'q1', text: 'Nota local' }],
      },
    ],
    posts: [{ id: 'p1', title: 'Diário local' }],
    readingSessions: [{ id: 's1', workId: 'w1', durationSeconds: 300 }],
    streak: { count: 3, lastDate: '2026-06-04', history: ['2026-06-04'] },
  };

  const incoming = {
    items: [
      {
        id: 'w1',
        title: 'Obra Local',
        updatedAt: '2026-06-01T10:00:00.000Z',
        quotes: [{ id: 'q2', text: 'Nota do backup' }],
      },
      {
        id: 'w2',
        title: 'Obra Nova do Backup',
        updatedAt: '2026-06-02T10:00:00.000Z',
        quotes: [],
      },
    ],
    posts: [{ id: 'p2', title: 'Diário antigo' }],
    readingSessions: [{ id: 's2', workId: 'w2', durationSeconds: 600 }],
    streak: { count: 2, lastDate: '2026-06-02', history: ['2026-06-02'] },
  };

  const merged = mergeSnapshots(current, incoming);
  assert.equal(merged.items.length, 2);
  const w1 = merged.items.find((i) => i.id === 'w1');
  assert.equal(w1.quotes.length, 2);
  assert.equal(merged.posts.length, 2);
  assert.equal(merged.readingSessions.length, 2);
  assert.equal(merged.streak.count, 3);
  assert.deepEqual(merged.streak.history, ['2026-06-02', '2026-06-04']);
});

test('saveAutoSnapshot mantem apenas os 5 auto-snapshots mais recentes e evita duplicatas', async () => {
  clearMemorySnapshotsForTests();

  const workspace = {
    items: [{ id: 'book-1', title: 'Obra Inicial', status: 'playing', currentPage: 10 }],
    posts: [],
    readingSessions: [],
  };

  const first = await saveAutoSnapshot(workspace, { label: 'Snap 1' });
  assert.equal(first.saved, true);

  // Mesmo estado sem alteracao deve deduplicar
  const duplicate = await saveAutoSnapshot(workspace, { label: 'Snap dup' });
  assert.equal(duplicate.saved, false);
  assert.equal(duplicate.deduplicated, true);

  for (let i = 2; i <= 7; i += 1) {
    await new Promise((r) => setTimeout(r, 2));
    await saveAutoSnapshot(
      {
        ...workspace,
        items: [{ id: 'book-1', title: `Obra Versão ${i}`, status: 'playing', currentPage: i * 10 }],
      },
      { label: `Snap ${i}` }
    );
  }

  const list = await listAutoSnapshots();
  assert.equal(list.length, MAX_AUTO_SNAPSHOTS);
  assert.equal(list[0].label, 'Snap 7');
  assert.equal(list[list.length - 1].label, 'Snap 3');
});
