import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const {
  WORKER_ITEM_THRESHOLD,
  filterAndSortItemsSync,
  queryLibraryIndex,
} = await import('../src/workers/searchIndexClient.js');

const {
  MAX_LRU_THUMBNAILS,
  THUMB_SIZES,
  buildThumbCacheKey,
  pruneLruEntries,
  selectThumbnailSizeForViewport,
} = await import('../src/services/imagePipeline.js');

test('Fase 5: indexWorker e queryLibraryIndex filtram >500 obras com fallback sincrono seguro', async () => {
  assert.equal(WORKER_ITEM_THRESHOLD, 500);

  const synthetic = Array.from({ length: 620 }, (_, i) => ({
    id: `work-${i}`,
    title: i === 550 ? 'A Cidade e as Estrelas' : `Livro de Estudo ${i}`,
    author: i % 2 === 0 ? 'Arthur C. Clarke' : 'Autor Diverso',
    workType: i % 3 === 0 ? 'manga' : 'book',
    status: i % 4 === 0 ? 'completed' : 'queued',
    inBacklog: true,
    genres: i === 550 ? ['Ficção Científica'] : ['História'],
    rating: i === 550 ? 95 : (i % 70) + 20,
    updatedAt: `2026-01-${String((i % 28) + 1).padStart(2, '0')}T10:00:00.000Z`,
  }));

  const syncRes = filterAndSortItemsSync(synthetic, {
    query: 'Estrelas',
    selectedGenre: 'Ficção Científica',
  });
  assert.equal(syncRes.length, 1);
  assert.equal(syncRes[0].id, 'work-550');

  const asyncRes = await queryLibraryIndex(synthetic, {
    selectedStatus: 'completed',
    sortBy: 'rating',
  });
  assert.ok(asyncRes.length > 0);
  assert.ok(asyncRes.every((item) => item.status === 'completed'));
  assert.ok((asyncRes[0].rating ?? 0) >= (asyncRes[1].rating ?? 0));
});

test('Fase 5: imagePipeline define 3 tamanhos WebP e despejo LRU deterministico', () => {
  assert.equal(THUMB_SIZES.sm, 120);
  assert.equal(THUMB_SIZES.md, 240);
  assert.equal(THUMB_SIZES.lg, 420);
  assert.equal(MAX_LRU_THUMBNAILS, 180);

  assert.equal(selectThumbnailSizeForViewport(96), 'sm');
  assert.equal(selectThumbnailSizeForViewport(180), 'md');
  assert.equal(selectThumbnailSizeForViewport(400), 'lg');
  assert.ok(buildThumbCacheKey('https://cdn.example/capa.jpg', 'sm').startsWith('120::'));

  const entries = [
    { cacheKey: 'oldest', lastUsedAt: 100 },
    { cacheKey: 'middle', lastUsedAt: 200 },
    { cacheKey: 'newest', lastUsedAt: 300 },
  ];
  const { keep, evictKeys } = pruneLruEntries(entries, 2);
  assert.equal(keep.length, 2);
  assert.deepEqual(evictKeys, ['oldest']);
});

test('Fase 5: ListScreen, CoverImage, App e useBacklog aplicam virtualizacao, memo, lazy loading e debounce', async () => {
  const rootDir = process.cwd();
  const listSrc = await fs.readFile(path.join(rootDir, 'src/screens/ListScreen.jsx'), 'utf8');
  const coverSrc = await fs.readFile(path.join(rootDir, 'src/components/CoverImage.jsx'), 'utf8');
  const appSrc = await fs.readFile(path.join(rootDir, 'src/App.jsx'), 'utf8');
  const backlogSrc = await fs.readFile(path.join(rootDir, 'src/hooks/useBacklog.js'), 'utf8');

  assert.ok(listSrc.includes('useDeferredValue'));
  assert.ok(listSrc.includes('startTransition'));
  assert.ok(listSrc.includes('MemoGridCard'));
  assert.ok(listSrc.includes('LIST_WINDOW_BATCH'));
  assert.ok(listSrc.includes('IntersectionObserver'));
  assert.ok(listSrc.includes("contain: 'layout paint'"));
  assert.ok(listSrc.includes('priority={idx < 6}'));

  assert.ok(coverSrc.includes('fetchPriority='));
  assert.ok(coverSrc.includes('decoding="async"'));
  assert.ok(coverSrc.includes('optimizeCoverThumbnail'));

  assert.ok(appSrc.includes("import('./screens/StatsScreen')"));
  assert.ok(appSrc.includes("import('./components/social/CommunityScreen')"));
  assert.ok(appSrc.includes('PerfOverlay'));

  assert.ok(backlogSrc.includes('pagehide'));
  assert.ok(backlogSrc.includes('setTimeout(flush, 180)'));
});
