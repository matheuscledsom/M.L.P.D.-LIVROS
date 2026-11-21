import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  FONT_SCALE_OPTIONS,
  applyThemeEngineAttributes,
} from '../src/design/themeEngine.js';
import {
  buildCodiceDatabase,
  hydrateAppSnapshotFromDatabase,
  parseAndValidateBackupText,
} from '../src/services/codiceDatabase.js';

test('Round-trip JSON backup preserva tags, wantToReread, empréstimos, calmMode e coleções', () => {
  const inputItems = [
    {
      id: 'w-rt-1',
      title: 'Memórias do Subsolo',
      author: 'Fiódor Dostoiévski',
      status: 'completed',
      rating: 94,
      tags: ['russia', 'classico'],
      wantToReread: true,
      loanedTo: 'Beatriz',
      loanedAt: '2026-10-05',
      collectionIds: ['col-1'],
      quotes: [{ id: 'q1', text: 'Sofro de lucidez.', location: 'Parte I' }],
    },
  ];
  const inputProfile = {
    displayName: 'Leitor Teste',
    handle: '@leitor_teste',
    calmMode: true,
    gamificationEnabled: false,
  };
  const inputCollections = [{ id: 'col-1', name: 'Rússia', workOrder: ['w-rt-1'] }];
  const inputSessions = [
    { id: 's1', workId: 'w-rt-1', pagesRead: 40, startedAt: '2026-10-01T10:00:00Z' },
  ];

  const db = buildCodiceDatabase({
    items: inputItems,
    profile: inputProfile,
    collections: inputCollections,
    readingSessions: inputSessions,
  });
  const jsonText = JSON.stringify(db);
  const parsed = parseAndValidateBackupText(jsonText);

  assert.equal(parsed.ok, true);
  assert.equal(parsed.items.length, 1);
  assert.deepEqual(parsed.items[0].tags, ['russia', 'classico']);
  assert.equal(parsed.items[0].wantToReread, true);
  assert.equal(parsed.items[0].loanedTo, 'Beatriz');
  assert.equal(parsed.items[0].loanedAt, '2026-10-05');
  assert.deepEqual(parsed.items[0].collectionIds, ['col-1']);
  assert.equal(parsed.collections[0].name, 'Rússia');

  const hydrated = hydrateAppSnapshotFromDatabase(db);
  assert.equal(hydrated.profile.calmMode, true);
  assert.equal(hydrated.items[0].wantToReread, true);
  assert.deepEqual(hydrated.items[0].tags, ['russia', 'classico']);
});

test('FONT_SCALE_OPTIONS e applyThemeEngineAttributes aplicam font-scale e dislexia no root', () => {
  assert.deepEqual(
    FONT_SCALE_OPTIONS.map((o) => o.id),
    ['normal', 'large', 'xlarge']
  );

  const attrs = new Map();
  const fakeRoot = {
    setAttribute: (k, v) => attrs.set(k, v),
    removeAttribute: (k) => attrs.delete(k),
  };

  applyThemeEngineAttributes({
    root: fakeRoot,
    density: 'compact',
    motion: 'reduced',
    fontScale: 'xlarge',
    dyslexiaSpacing: true,
  });

  assert.equal(attrs.get('data-font-scale'), 'xlarge');
  assert.equal(attrs.get('data-dyslexia'), 'true');
  assert.equal(attrs.get('data-density'), 'compact');
  assert.equal(attrs.get('data-motion'), 'reduced');
});

test('PWA registerType prompt, StatusBadge e acessibilidade no App estão integrados', () => {
  const viteSrc = fs.readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');
  const mainSrc = fs.readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
  const appSrc = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const badgeSrc = fs.readFileSync(
    new URL('../src/components/StatusBadge.jsx', import.meta.url),
    'utf8'
  );

  assert.ok(viteSrc.includes("registerType: 'prompt'"));
  assert.ok(mainSrc.includes('codice:pwa-update-available'));
  assert.ok(appSrc.includes('#main-content'));
  assert.ok(appSrc.includes('aria-live="polite"'));
  assert.ok(appSrc.includes('privateStorageMode'));
  assert.ok(appSrc.includes('Nova versão disponível'));
  assert.ok(badgeSrc.includes('STATUS_SHAPES'));
});
