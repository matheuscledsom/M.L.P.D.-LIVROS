import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  buildCollectionMosaicCoverDataUri,
  buildCollectionMosaicSvg,
  reorderCollections,
  reorderWorkInCollection,
  sortWorksInCollection,
} from '../src/utils/collections.js';
import { buildCommandPaletteEntries } from '../src/components/commandPaletteSearch.js';

test('reorderCollections move coleções para cima e para baixo preservando limites', () => {
  const cols = [
    { id: 'c1', name: 'Clássicos' },
    { id: 'c2', name: 'Mangás' },
    { id: 'c3', name: 'Pesquisa' },
  ];

  const movedUp = reorderCollections(cols, 'c2', -1);
  assert.deepEqual(
    movedUp.map((c) => c.id),
    ['c2', 'c1', 'c3']
  );

  const atTop = reorderCollections(movedUp, 'c2', -1);
  assert.deepEqual(
    atTop.map((c) => c.id),
    ['c2', 'c1', 'c3']
  );

  const movedDown = reorderCollections(cols, 'c2', 1);
  assert.deepEqual(
    movedDown.map((c) => c.id),
    ['c1', 'c3', 'c2']
  );
});

test('reorderWorkInCollection e sortWorksInCollection ordenam obras dentro de uma coleção', () => {
  const works = [
    { id: 'w1', title: 'Obra Um', collectionIds: ['c1'] },
    { id: 'w2', title: 'Obra Dois', collectionIds: ['c1'] },
    { id: 'w3', title: 'Obra Três', collectionIds: ['c1'] },
  ];
  let col = { id: 'c1', name: 'Seleção', workOrder: [] };

  col = reorderWorkInCollection(col, 'w3', -1, works);
  assert.deepEqual(col.workOrder, ['w1', 'w3', 'w2']);

  const sorted = sortWorksInCollection(works, col);
  assert.deepEqual(
    sorted.map((w) => w.id),
    ['w1', 'w3', 'w2']
  );
});

test('buildCollectionMosaicSvg e data URI geram mosaico SVG válido com iniciais e escape', () => {
  const works = [
    { id: '1', title: 'Dom Casmurro' },
    { id: '2', title: 'Duna <Vol. 1>' },
  ];
  const svg = buildCollectionMosaicSvg(works, 'Favoritos & "Clássicos"');
  assert.ok(svg.startsWith('<svg'));
  assert.ok(svg.includes('DO'));
  assert.ok(svg.includes('DU'));
  assert.ok(!svg.includes('"<'));

  const uri = buildCollectionMosaicCoverDataUri(works, 'Favoritos');
  assert.ok(uri.startsWith('data:image/svg+xml;charset=utf-8,'));
});

test('buildCommandPaletteEntries filtra obras, coleções e ações e aciona callbacks', () => {
  let selectedId = null;
  let tab = null;
  const entries = buildCommandPaletteEntries({
    query: 'casmurro',
    items: [
      { id: 'b1', title: 'Dom Casmurro', author: 'Machado de Assis', inBacklog: true },
      { id: 'b2', title: 'Vidas Secas', author: 'Graciliano Ramos', inBacklog: true },
    ],
    collections: [{ id: 'c1', name: 'Brasileiros' }],
    onSelectItem: (item) => {
      selectedId = item.id;
    },
    onNavigateTab: (nextTab) => {
      tab = nextTab;
    },
  });

  assert.ok(entries.some((e) => e.id === 'book-b1' && e.kind === 'Acervo'));
  assert.ok(!entries.some((e) => e.id === 'book-b2'));
  entries.find((e) => e.id === 'book-b1').run();
  assert.equal(selectedId, 'b1');

  const actionEntries = buildCommandPaletteEntries({
    query: 'foco',
    items: [],
    onNavigateTab: (t) => {
      tab = t;
    },
  });
  assert.ok(actionEntries.some((e) => e.id === 'act-focus'));
  assert.equal(tab, null);
});

test('integração estática de Fase 11 em App, ListScreen e DigitalShelfModal está conectada', () => {
  const appSrc = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const listSrc = fs.readFileSync(new URL('../src/screens/ListScreen.jsx', import.meta.url), 'utf8');
  const shelfSrc = fs.readFileSync(
    new URL('../src/components/reader/DigitalShelfModal.jsx', import.meta.url),
    'utf8'
  );

  assert.ok(appSrc.includes('CommandPalette'));
  assert.ok(appSrc.includes('batchUpdateItems'));
  assert.ok(appSrc.includes('restoreRemovedItems'));
  assert.ok(listSrc.includes('onMoveCollection'));
  assert.ok(listSrc.includes('onBatchRemoveItems'));
  assert.ok(listSrc.includes('buildCollectionMosaicCoverDataUri'));
  assert.ok(shelfSrc.includes('Desfazer'));
});
