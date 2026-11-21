import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  BACKUP_REMINDER_DAYS,
  EMERGENCY_MIRROR_KEY,
  getBackupReminderStatus,
  loadEmergencyMirror,
  saveEmergencyMirror,
} from '../src/services/backupEngine.js';
import {
  buildWorkMatchKey,
  encodeBuddyClubBundle,
  filterBuddyComments,
  importBuddyClubBundle,
} from '../src/services/buddyReadService.js';
import { buildWrappedSummary } from '../src/utils/wrappedStats.js';

function withMockStorage(fn) {
  const prevStorage = globalThis.localStorage;
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
  try {
    return fn(store);
  } finally {
    globalThis.localStorage = prevStorage;
  }
}

test('Buddy Read Anti-Spoiler nunca expõe comentários acima do % atual do leitor', () => {
  const comments = [
    { id: '1', authorName: 'Ana', progressPct: 15, text: 'Início ótimo!', createdAt: '2026-01-01' },
    { id: '2', authorName: 'Bruno', progressPct: 40, text: 'Virada no cap 5!', createdAt: '2026-01-02' },
    {
      id: '3',
      authorName: 'Carla',
      progressPct: 85,
      text: 'SPOILER FINAL: O mordomo morre no capítulo 19!',
      createdAt: '2026-01-03',
    },
  ];

  const at40 = filterBuddyComments(comments, 40);
  assert.equal(at40.visible.length, 2);
  assert.equal(at40.hiddenCount, 1);
  assert.ok(!JSON.stringify(at40.visible).includes('SPOILER FINAL'));

  const at90 = filterBuddyComments(comments, 90);
  assert.equal(at90.visible.length, 3);
  assert.equal(at90.hiddenCount, 0);

  withMockStorage(() => {
    const workKey = buildWorkMatchKey({ title: 'Dom Casmurro', isbn: '978-8535914849' });
    assert.equal(workKey, 'isbn:9788535914849');
    const bundle = encodeBuddyClubBundle(workKey, [
      { id: 'x1', authorName: 'Lúcia', progressPct: 72, text: '<b>Capitu</b> voltou.' },
    ]);
    const imp = importBuddyClubBundle(bundle, workKey);
    assert.equal(imp.ok, true);
    assert.equal(imp.importedCount, 1);
    assert.equal(imp.comments[0].text, 'Capitu voltou.');
  });
});

test('Wrapped stats e Blindagem Tripla sem imagens Base64 funcionam perfeitamente', () => {
  const summary = buildWrappedSummary({
    targetYear: 2026,
    period: 'year',
    streakCount: 19,
    items: [
      {
        id: 'b1',
        title: 'Dom Casmurro',
        author: 'Machado de Assis',
        status: 'completed',
        completedYear: 2026,
        totalPages: 256,
        currentPage: 256,
        rating: 96,
        genres: ['Clássico', 'Romance'],
        inBacklog: true,
      },
      {
        id: 'b2',
        title: 'Memórias Póstumas',
        author: 'Machado de Assis',
        status: 'completed',
        completedYear: 2026,
        totalPages: 300,
        currentPage: 300,
        rating: 90,
        genres: ['Clássico'],
        inBacklog: true,
      },
    ],
  });

  assert.equal(summary.completedCount, 2);
  assert.equal(summary.pagesRead, 556);
  assert.equal(summary.topGenre, 'Clássico');
  assert.equal(summary.topAuthor, 'Machado de Assis');
  assert.equal(summary.avgRating, 93);
  assert.equal(summary.streakCount, 19);

  withMockStorage((store) => {
    const ok = saveEmergencyMirror({
      items: [
        {
          id: 'm1',
          title: 'Livro Sem Base64',
          coverUrl: 'data:image/png;base64,AAAABBBBCCCCDDDD1234567890',
          coverSources: ['data:image/jpeg;base64,XYZ', 'https://covers.openlibrary.org/b/id/1-L.jpg'],
          tags: ['tcc'],
          wantToReread: true,
        },
      ],
    });
    assert.equal(ok, true);
    const rawCompressed = store.get(EMERGENCY_MIRROR_KEY) || '';
    assert.ok(rawCompressed.length > 0);
    const restored = loadEmergencyMirror();
    assert.equal(restored.ok, true);
    assert.equal(restored.items[0].coverUrl, undefined);
    assert.deepEqual(restored.items[0].coverSources, ['https://covers.openlibrary.org/b/id/1-L.jpg']);
    assert.deepEqual(restored.items[0].tags, ['tcc']);
    assert.equal(restored.items[0].wantToReread, true);

    assert.equal(BACKUP_REMINDER_DAYS, 7);
    const nowBase = Date.now();
    const early = getBackupReminderStatus({ itemsCount: 1, nowMs: nowBase });
    assert.equal(early.shouldRemind, false);
    const late = getBackupReminderStatus({
      itemsCount: 1,
      nowMs: nowBase + 8 * 86400000,
    });
    assert.equal(late.shouldRemind, true);
  });
});

test('Manifest PWA, file_handlers, MIT LICENSE, README e Alexandria 5.0.0 completos', () => {
  const manifest = JSON.parse(
    fs.readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8')
  );
  assert.ok(Array.isArray(manifest.file_handlers) && manifest.file_handlers.length > 0);
  const acceptStr = JSON.stringify(manifest.file_handlers);
  assert.ok(acceptStr.includes('.epub'));
  assert.ok(acceptStr.includes('.pdf'));
  assert.ok(acceptStr.includes('.cbz'));

  const appSrc = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const detailSrc = fs.readFileSync(
    new URL('../src/components/ItemDetailSheet.jsx', import.meta.url),
    'utf8'
  );
  const license = fs.readFileSync(new URL('../LICENSE', import.meta.url), 'utf8');
  const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');

  assert.ok(appSrc.includes('launchQueue'));
  assert.ok(appSrc.includes('WrappedModal'));
  assert.ok(detailSrc.includes('BuddyReadPanel'));
  assert.ok(license.includes('MIT License'));
  assert.ok(readme.includes('5.0.0') && readme.includes('Alexandria'));
});
