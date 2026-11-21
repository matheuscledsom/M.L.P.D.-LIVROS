import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { isLoanOverdue, normalizeTagsList } from '../src/utils/backlogHelpers.js';
import {
  detectCatalogImportFormat,
  findDuplicateMatch,
  parseCatalogImport,
  parseCsvRows,
} from '../src/utils/catalogImporters.js';
import { buildWorkMarkdown } from '../src/utils/markdownExport.js';

test('parseCsvRows e detectCatalogImportFormat reconhecem Goodreads, StoryGraph, Calibre e listas', () => {
  const goodreadsCsv = [
    'Book Id,Title,Author,ISBN13,My Rating,Number of Pages,Exclusive Shelf,Bookshelves',
    '1,"Dom Casmurro",Machado de Assis,="9788535914849",5,256,read,"classicos, brasil"',
    '2,"Duna",Frank Herbert,9788576573135,0,680,to-read,sci-fi',
  ].join('\n');

  const rows = parseCsvRows(goodreadsCsv);
  assert.equal(rows.length, 3);
  assert.equal(detectCatalogImportFormat(rows[0], goodreadsCsv), 'goodreads');

  const res = parseCatalogImport({
    text: goodreadsCsv,
    existingItems: [{ id: 'x1', title: 'Duna', isbn: '9788576573135' }],
  });

  assert.equal(res.format, 'goodreads');
  assert.equal(res.records.length, 2);
  assert.equal(res.newCount, 1);
  assert.equal(res.duplicateCount, 1);
  assert.equal(res.records[0].status, 'completed');
  assert.equal(res.records[0].rating, 100);
  assert.deepEqual(res.records[0].tags, ['classicos', 'brasil']);
  assert.equal(res.records[1].isDuplicate, true);

  const plainRes = parseCatalogImport({
    text: 'O Alienista - Machado de Assis\nGrande Sertão: Veredas',
  });
  assert.equal(plainRes.format, 'plain-list');
  assert.equal(plainRes.records[0].title, 'O Alienista');
  assert.equal(plainRes.records[0].author, 'Machado de Assis');
});

test('normalizeTagsList, findDuplicateMatch, isLoanOverdue e buildWorkMarkdown funcionam corretamente', () => {
  assert.deepEqual(normalizeTagsList(['#tcc', 'tcc', ' Pesquisa ']), ['tcc', 'Pesquisa']);

  assert.ok(
    findDuplicateMatch(
      { title: 'Vidas Secas' },
      [{ id: '1', title: 'Vidas Sêcas', author: 'Graciliano' }]
    )
  );

  assert.equal(isLoanOverdue({ loanedTo: 'Ana', loanedAt: '2020-01-01' }, 30), true);
  assert.equal(isLoanOverdue({ loanedTo: '', loanedAt: '2020-01-01' }, 30), false);

  const md = buildWorkMarkdown({
    title: 'Memórias Póstumas',
    author: 'Machado de Assis',
    status: 'completed',
    rating: 95,
    tags: ['classico'],
    wantToReread: true,
    loanedTo: 'Carlos',
    loanedAt: '2026-10-01',
    quotes: [{ text: 'Ao vencedor, as batatas.', location: 'Pág. 55' }],
  });

  assert.ok(md.includes('# Memórias Póstumas'));
  assert.ok(md.includes('#classico'));
  assert.ok(md.includes('Para reler'));
  assert.ok(md.includes('**Emprestado para:** Carlos'));
  assert.ok(md.includes('> Ao vencedor, as batatas.'));
});

test('integração Fase 15: scanner BarcodeDetector, atalhos globais, Undo, Import e Modo Noturno leitor', () => {
  const appSrc = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const addSrc = fs.readFileSync(new URL('../src/screens/AddScreen.jsx', import.meta.url), 'utf8');
  const detailSrc = fs.readFileSync(
    new URL('../src/components/ItemDetailSheet.jsx', import.meta.url),
    'utf8'
  );
  const readerSettingsSrc = fs.readFileSync(
    new URL('../src/components/reader/ReaderSettings.jsx', import.meta.url),
    'utf8'
  );

  assert.ok(appSrc.includes('KeyboardShortcutsModal'));
  assert.ok(appSrc.includes('ImportCatalogModal'));
  assert.ok(appSrc.includes('batchRemoveItems'));
  assert.ok(addSrc.includes('BarcodeDetector'));
  assert.ok(addSrc.includes('findDuplicateMatch'));
  assert.ok(detailSrc.includes('downloadWorkMarkdown'));
  assert.ok(detailSrc.includes('wantToReread'));
  assert.ok(detailSrc.includes('isLoanOverdue'));
  assert.ok(readerSettingsSrc.includes('scheduledNightTheme'));
});
