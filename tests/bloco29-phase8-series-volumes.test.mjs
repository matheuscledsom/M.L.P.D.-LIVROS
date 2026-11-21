import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const {
  SERIALIZED_WORK_TYPES,
  calculateWorkProgress,
  isSerializedWork,
  normalizeOwnedVolumes,
  syncSeriesProgressFields,
} = await import('../src/utils/backlogHelpers.js');

const { migrateDatabase } = await import('../src/services/codiceDatabase.js');

test('Fase 8: helpers de series suportam manga, light_novel, comic e sincronizam aliases e ownedVolumes', () => {
  assert.ok(SERIALIZED_WORK_TYPES.has('manga'));
  assert.ok(SERIALIZED_WORK_TYPES.has('light_novel'));
  assert.ok(SERIALIZED_WORK_TYPES.has('comic'));

  assert.equal(isSerializedWork({ workType: 'light_novel' }), true);
  assert.equal(isSerializedWork({ workType: 'comic' }), true);
  assert.equal(isSerializedWork({ workType: 'book', totalVolumes: 5 }), true);

  assert.deepEqual(normalizeOwnedVolumes([3, '1', 3, 0, -2, 'abc', 12, 2]), [1, 2, 3, 12]);

  const syncedFromV2 = syncSeriesProgressFields({
    volumeCurrent: 4,
    volumeTotal: 12,
    chapterCurrent: 28,
    chapterTotal: 100,
    ownedVolumes: [1, 2, 4, 3],
  });
  assert.equal(syncedFromV2.currentVolume, 4);
  assert.equal(syncedFromV2.totalVolumes, 12);
  assert.equal(syncedFromV2.currentChapter, 28);
  assert.equal(syncedFromV2.totalChapters, 100);
  assert.deepEqual(syncedFromV2.ownedVolumes, [1, 2, 3, 4]);

  const syncedFromLegacy = syncSeriesProgressFields({
    currentVolume: 6,
    totalVolumes: 10,
  });
  assert.equal(syncedFromLegacy.volumeCurrent, 6);
  assert.equal(syncedFromLegacy.volumeTotal, 10);

  const lnProgress = calculateWorkProgress({
    workType: 'light_novel',
    status: 'playing',
    volumeCurrent: 5,
    volumeTotal: 10,
  });
  assert.equal(lnProgress, 50);
});

test('Fase 8: migracao preserva e sincroniza volumes/capitulos e ownedVolumes em v4', () => {
  const migrated = migrateDatabase({
    version: 2,
    items: [
      {
        id: 'comic-1',
        title: 'Sandman',
        workType: 'comic',
        status: 'playing',
        volumeCurrent: 3,
        volumeTotal: 10,
        ownedVolumes: [1, 2, 3, 7],
        inBacklog: true,
      },
    ],
  });

  const work = migrated.tables.works[0];
  assert.equal(work.currentVolume, 3);
  assert.equal(work.volumeCurrent, 3);
  assert.equal(work.totalVolumes, 10);
  assert.equal(work.volumeTotal, 10);
  assert.deepEqual(work.ownedVolumes, [1, 2, 3, 7]);
});

test('Fase 8: TactileStatusFields e useBacklog implementam +1/+5 Cap, +1 Vol e grade clicavel acessivel', async () => {
  const rootDir = process.cwd();
  const fieldsSrc = await fs.readFile(path.join(rootDir, 'src/components/TactileStatusFields.jsx'), 'utf8');
  const backlogSrc = await fs.readFile(path.join(rootDir, 'src/hooks/useBacklog.js'), 'utf8');

  assert.ok(fieldsSrc.includes('VolumeOwnershipGrid'));
  assert.ok(fieldsSrc.includes('Grade de Volumes'));
  assert.ok(fieldsSrc.includes('aria-pressed={isOwned}'));
  assert.ok(fieldsSrc.includes('[1, 5]'));
  assert.ok(fieldsSrc.includes('+1 Vol'));
  assert.ok(fieldsSrc.includes('isSerializedWork(item)'));

  assert.ok(backlogSrc.includes("value === 'light_novel'"));
  assert.ok(backlogSrc.includes("value === 'comic'"));
  assert.ok(backlogSrc.includes('syncSeriesProgressFields'));
});
