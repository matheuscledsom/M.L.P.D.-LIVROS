import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const {
  computeVisibleWebtoonWindow,
  computeZoomOriginAtPoint,
  resolveComicVisualFilter,
  sortComicEntriesNaturally,
} = await import('../src/components/reader/comicReaderHelpers.js');

test('Fase 10: helpers do leitor CBZ ordenam naturalmente, virtualizam webtoon, calculam zoom e filtros', () => {
  assert.deepEqual(sortComicEntriesNaturally(['p10.jpg', 'p2.jpg', 'p1.jpg']), [
    'p1.jpg',
    'p2.jpg',
    'p10.jpg',
  ]);

  assert.deepEqual(computeVisibleWebtoonWindow(10, 50, 5), { start: 5, end: 15 });
  assert.deepEqual(computeVisibleWebtoonWindow(1, 50, 5), { start: 0, end: 6 });
  assert.deepEqual(computeVisibleWebtoonWindow(48, 50, 5), { start: 43, end: 49 });

  assert.ok(resolveComicVisualFilter('sumi-eink').includes('grayscale(100%)'));
  assert.ok(resolveComicVisualFilter('night-inverted').includes('invert(0.92)'));
  assert.equal(resolveComicVisualFilter('none'), 'none');

  const origin = computeZoomOriginAtPoint({
    clientX: 300,
    clientY: 160,
    rect: { left: 100, top: 100, width: 400, height: 600 },
  });
  assert.equal(origin.originX, '50%');
  assert.equal(origin.originY, '10%');
  assert.equal(origin.originCss, '50% 10%');

  const clamped = computeZoomOriginAtPoint({
    clientX: 0,
    clientY: 9999,
    rect: { left: 0, top: 0, width: 100, height: 100 },
  });
  assert.equal(clamped.originCss, '8% 92%');
});

test('Fase 10: ComicView, ReaderSettings, useReaderGestures e useReaderProgress integram RTL, spread, webtoon virtualizado e 2x zoom', async () => {
  const rootDir = process.cwd();
  const comicSrc = await fs.readFile(path.join(rootDir, 'src/components/reader/ComicView.jsx'), 'utf8');
  const settingsSrc = await fs.readFile(path.join(rootDir, 'src/components/reader/ReaderSettings.jsx'), 'utf8');
  const gesturesSrc = await fs.readFile(path.join(rootDir, 'src/components/reader/useReaderGestures.js'), 'utf8');
  const progressSrc = await fs.readFile(path.join(rootDir, 'src/components/reader/useReaderProgress.js'), 'utf8');

  assert.ok(comicSrc.includes("scale(2)"));
  assert.ok(comicSrc.includes('transformOrigin'));
  assert.ok(comicSrc.includes('requestIdleCallback'));
  assert.ok(comicSrc.includes('computeVisibleWebtoonWindow'));
  assert.ok(comicSrc.includes('[secondPageName, firstPageName]'));

  assert.ok(settingsSrc.includes('sumi-eink'));
  assert.ok(settingsSrc.includes('night-inverted'));
  assert.ok(settingsSrc.includes('Mangá RTL'));
  assert.ok(settingsSrc.includes('Dupla'));
  assert.ok(settingsSrc.includes('Webtoon'));

  assert.ok(gesturesSrc.includes('viewportHeight'));
  assert.ok(progressSrc.includes("cbzFilter: 'none'"));
});
