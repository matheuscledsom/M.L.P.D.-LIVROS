import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildQuickReaderBookId,
  clearMemoryReaderStoreForTests,
  formatStorageSizeLabel,
  getBookFileRecord,
  importBatchReaderFiles,
  linkStoredReaderBookToWork,
  listStoredReaderBooks,
  markStoredBookOpened,
  normalizeStoredFormat,
  removeStoredReaderBook,
  saveBookFile,
  saveBookReaderState,
} from '../src/services/readerStorage.js';

function createFakeFile(name, bytes) {
  const buffer = new Uint8Array(bytes);
  return {
    name,
    size: buffer.byteLength,
    type: name.endsWith('.epub')
      ? 'application/epub+zip'
      : name.endsWith('.pdf')
        ? 'application/pdf'
        : 'application/octet-stream',
    slice(start = 0, end = buffer.byteLength) {
      return {
        arrayBuffer: async () => buffer.slice(start, end).buffer,
      };
    },
  };
}

test('readerStorage formats size, normalizes extensions and builds quick keys', () => {
  assert.equal(normalizeStoredFormat('', 'Dom-Casmurro.EPUB'), 'epub');
  assert.equal(normalizeStoredFormat('md', 'notas.md'), 'markdown');
  assert.equal(formatStorageSizeLabel(2 * 1024 * 1024 + 512 * 1024), '2.5 MB');
  assert.equal(
    buildQuickReaderBookId('Ensaio.epub', 1024),
    'quick:Ensaio.epub:1024'
  );
});

test('importBatchReaderFiles imports EPUB/PDF and skips unsupported CBR cleanly', async () => {
  clearMemoryReaderStoreForTests();

  const validEpub = createFakeFile('Grande-Sertao.epub', [0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
  const validPdf = createFakeFile('Artigo.pdf', [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
  const blockedCbr = createFakeFile('HQ-Rar.cbr', [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00]);

  const { imported, skipped } = await importBatchReaderFiles([
    validEpub,
    validPdf,
    blockedCbr,
  ]);

  assert.equal(imported.length, 2);
  assert.equal(skipped.length, 1);
  assert.equal(skipped[0].fileName, 'HQ-Rar.cbr');

  const shelf = await listStoredReaderBooks([]);
  assert.equal(shelf.length, 2);
  assert.equal(shelf.some((e) => e.format === 'epub' && e.isLinked === false), true);
  assert.equal(shelf.some((e) => e.format === 'pdf' && e.isLinked === false), true);
});

test('linkStoredReaderBookToWork transfers blob and reading state, updates order and removes binary cleanly', async () => {
  clearMemoryReaderStoreForTests();

  const quickId = buildQuickReaderBookId('O-Processo.epub', 4096);
  await saveBookFile(quickId, {
    blob: { size: 4096, type: 'application/epub+zip' },
    fileName: 'O-Processo.epub',
    format: 'epub',
    size: 4096,
    lastOpenedAt: '2026-01-01T10:00:00.000Z',
  });

  await saveBookReaderState(quickId, {
    position: { progressPct: 48.5, page: 120, totalPages: 250, cfi: 'epubcfi(/6/4)' },
  });

  const works = [
    {
      id: 'work-kafka',
      title: 'O Processo',
      author: 'Franz Kafka',
      progress: 0,
      coverSources: ['https://example.com/cover.jpg'],
    },
  ];

  let shelf = await listStoredReaderBooks(works);
  assert.equal(shelf[0].isLinked, false);
  assert.equal(shelf[0].progressPct, 48.5);

  const linkRes = await linkStoredReaderBookToWork(quickId, 'work-kafka');
  assert.equal(linkRes.linkedWorkId, 'work-kafka');
  assert.equal(linkRes.extractedPosition.progressPct, 48.5);
  assert.equal(await getBookFileRecord(quickId), null);

  await markStoredBookOpened('work-kafka');
  shelf = await listStoredReaderBooks(works);
  assert.equal(shelf.length, 1);
  assert.equal(shelf[0].isLinked, true);
  assert.equal(shelf[0].title, 'O Processo');
  assert.equal(shelf[0].author, 'Franz Kafka');
  assert.equal(shelf[0].progressPct, 48.5);

  await removeStoredReaderBook('work-kafka');
  const afterDelete = await listStoredReaderBooks(works);
  assert.equal(afterDelete.length, 0);
});
