import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const {
  MEDIA_API_SOURCES,
  clearSearchMediaCache,
  deduplicateAndSortResults,
  fetchJsonWithTimeout,
  mapAniListMedia,
  mapInternetArchiveDoc,
  searchMedia,
} = await import('../src/services/mediaApi.js');

test('Fase 7: AniList GraphQL e Internet Archive mapeiam obras e open-access corretamente', () => {
  const sourceIds = MEDIA_API_SOURCES.map((s) => s.id);
  assert.ok(sourceIds.includes('anilist'));
  assert.ok(sourceIds.includes('internetArchive'));

  const manga = mapAniListMedia({
    id: 30013,
    format: 'MANGA',
    countryOfOrigin: 'JP',
    volumes: 109,
    chapters: 1120,
    genres: ['Action', 'Adventure'],
    description: '<p>Uma jornada marítima épica.</p>',
    startDate: { year: 1997 },
    title: { romaji: 'One Piece', english: 'One Piece', native: 'ONE PIECE' },
    coverImage: { extraLarge: 'https://s4.anilist.co/file/onepiece.jpg' },
    staff: { edges: [{ role: 'Story & Art', node: { name: { full: 'Eiichiro Oda' } } }] },
  });
  assert.equal(manga.source, 'anilist');
  assert.equal(manga.workType, 'manga');
  assert.equal(manga.totalVolumes, 109);
  assert.equal(manga.totalChapters, 1120);
  assert.equal(manga.author, 'Eiichiro Oda');

  const iaBook = mapInternetArchiveDoc({
    identifier: 'domcasmurro00assigoog',
    title: 'Dom Casmurro',
    creator: 'Machado de Assis',
    year: '1899',
    subject: ['Fiction', 'Brazilian literature'],
    language: 'por',
  });
  assert.equal(iaBook.source, 'internetArchive');
  assert.equal(iaBook.isOpenAccess, true);
  assert.ok(iaBook.freeEpubUrl.startsWith('https://archive.org/download/'));
  assert.ok(iaBook.openAccessUrl.startsWith('https://archive.org/details/'));
});

test('Fase 7: deduplicateAndSortResults deduplica por ISBN e por titulo normalizado preservando melhor capa', () => {
  const duped = deduplicateAndSortResults(
    [
      {
        id: 'src-a',
        title: 'Dom Casmurro',
        author: 'Machado de Assis',
        workType: 'book',
        isbn: '978-8535902778',
        coverUrl: null,
        synopsis: 'Resumo curto.',
        source: 'openLibrary',
      },
      {
        id: 'src-b',
        title: 'Dom Casmurro',
        author: '',
        workType: 'book',
        isbn: '9788535902778',
        coverUrl: 'https://covers.openlibrary.org/b/isbn/9788535902778-L.jpg',
        source: 'googleBooks',
      },
    ],
    'Dom Casmurro'
  );
  assert.equal(duped.length, 1);
  assert.ok(duped[0].coverUrl);
  assert.equal(duped[0].author, 'Machado de Assis');

  const titleDuped = deduplicateAndSortResults(
    [
      { id: 't-1', title: 'Grande Sertão: Veredas', author: 'Guimarães Rosa', workType: 'book' },
      { id: 't-2', title: 'Grande Sertao Veredas', author: '', workType: 'book', coverUrl: 'https://example.com/gsv.jpg' },
    ],
    'Grande Sertao'
  );
  assert.equal(titleDuped.length, 1);
});

test('Fase 7: fetchJsonWithTimeout faz backoff em 503 e searchMedia isola falhas parciais sem perder resultados validos', async () => {
  clearSearchMediaCache();
  const origFetch = globalThis.fetch;

  let attemptCount = 0;
  globalThis.fetch = async (url) => {
    const strUrl = String(url);
    if (strUrl.includes('retry-endpoint')) {
      attemptCount += 1;
      if (attemptCount < 2) {
        return new Response('{}', { status: 503 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    if (strUrl.includes('graphql.anilist.co')) {
      return new Response(
        JSON.stringify({
          data: {
            Page: {
              media: [
                {
                  id: 1,
                  format: 'MANGA',
                  title: { romaji: 'Vagabond', english: 'Vagabond', native: 'バガボンド' },
                  genres: ['Action'],
                },
              ],
            },
          },
        }),
        { status: 200 }
      );
    }
    return new Response('down', { status: 500 });
  };

  try {
    const retryRes = await fetchJsonWithTimeout('https://example.com/retry-endpoint', {
      retries: 1,
      timeoutMs: 2000,
    });
    assert.equal(retryRes.ok, true);
    assert.equal(attemptCount, 2);

    const searchRes = await searchMedia('Vagabond', {
      filter: 'manga',
      sources: ['anilist', 'jikan'],
      skipCache: true,
    });
    assert.equal(searchRes.allFailed, false);
    assert.equal(searchRes.partialFailure, true);
    assert.ok(searchRes.failedSources.includes('jikan'));
    assert.ok(searchRes.results.some((r) => r.title === 'Vagabond'));
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('Fase 7: AddScreen, ItemDetailSheet e SmartCatalogButton expoem Ler Gratis Agora e catalogacao local deterministica', async () => {
  const rootDir = process.cwd();
  const addSrc = await fs.readFile(path.join(rootDir, 'src/screens/AddScreen.jsx'), 'utf8');
  const detailSrc = await fs.readFile(path.join(rootDir, 'src/components/ItemDetailSheet.jsx'), 'utf8');
  const smartSrc = await fs.readFile(path.join(rootDir, 'src/components/SmartCatalogButton.jsx'), 'utf8');

  assert.ok(addSrc.includes('Ler Grátis Agora'));
  assert.ok(detailSrc.includes('Ler Grátis Agora'));
  assert.ok(smartSrc.includes('optionalAiOpen'));
  assert.ok(smartSrc.includes('Preenchimento Inteligente Local'));
});
