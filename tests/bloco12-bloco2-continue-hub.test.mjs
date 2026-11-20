import assert from 'node:assert/strict';
import test from 'node:test';
import { buildContinueReadingHub } from '../src/utils/backlogHelpers.js';

test('buildContinueReadingHub unifica obras em leitura e EPUBs offline ordenados por atividade recente', () => {
  const items = [
    {
      id: 'w-fisico',
      inBacklog: true,
      status: 'playing',
      title: 'Grande Sertão: Veredas',
      author: 'Guimarães Rosa',
      currentPage: 120,
      totalPages: 480,
      progress: 25,
      updatedAt: '2026-11-10T10:00:00.000Z',
    },
    {
      id: 'w-epub-vinculado',
      inBacklog: true,
      status: 'reading',
      title: 'O Processo',
      originalTitle: 'Der Process',
      author: 'Franz Kafka',
      currentPage: 0,
      totalPages: null,
      progress: 0,
      updatedAt: '2026-11-12T10:00:00.000Z',
    },
    {
      id: 'w-concluido',
      inBacklog: true,
      status: 'completed',
      title: 'Dom Casmurro',
      author: 'Machado de Assis',
      progress: 100,
      updatedAt: '2026-11-18T10:00:00.000Z',
    },
  ];

  const storedBooks = [
    {
      bookId: 'w-epub-vinculado',
      workId: 'w-epub-vinculado',
      isLinked: true,
      linkedWork: items[1],
      title: 'O Processo',
      format: 'epub',
      sizeLabel: '1.2 MB',
      progressPct: 42,
      lastOpenedAt: '2026-11-15T18:00:00.000Z',
    },
    {
      bookId: 'quick:Ensaios.epub:2048',
      workId: null,
      isLinked: false,
      linkedWork: null,
      title: 'Ensaios',
      fileName: 'Ensaios.epub',
      format: 'epub',
      sizeLabel: '2.0 MB',
      progressPct: 15,
      lastOpenedAt: '2026-11-19T09:00:00.000Z',
    },
    {
      bookId: 'w-concluido',
      workId: 'w-concluido',
      isLinked: true,
      linkedWork: items[2],
      title: 'Dom Casmurro',
      format: 'epub',
      sizeLabel: '0.9 MB',
      progressPct: 100,
      lastOpenedAt: '2026-11-19T11:00:00.000Z',
    },
  ];

  const hub = buildContinueReadingHub(items, storedBooks);
  assert.equal(hub.all.length, 3);
  assert.equal(hub.featured.id, 'quick:Ensaios.epub:2048');
  assert.equal(hub.featured.hasStoredFile, true);
  assert.equal(hub.featured.kind, 'digital');

  assert.equal(hub.others[0].id, 'w-epub-vinculado');
  assert.equal(hub.others[0].hasStoredFile, true);
  assert.equal(hub.others[0].originalTitle, 'Der Process');
  assert.equal(hub.others[0].progressPct, 42);

  assert.equal(hub.others[1].id, 'w-fisico');
  assert.equal(hub.others[1].hasStoredFile, false);
});
