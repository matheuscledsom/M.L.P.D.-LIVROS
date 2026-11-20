import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCoverCascade,
  cleanCoverUrl,
  mapJikanManga,
  mergeTwoResults,
  searchMedia,
} from '../src/services/mediaApi.js';

test('buildCoverCascade e cleanCoverUrl normalizam para HTTPS, removem edge=curl e preservam fallbacks', () => {
  assert.equal(
    cleanCoverUrl('http://books.google.com/books/content?id=abc&printsec=frontcover&edge=curl'),
    'https://books.google.com/books/content?id=abc&printsec=frontcover'
  );

  const cascade = buildCoverCascade({
    primaryUrl: 'http://books.google.com/books/content?id=abc&img=1&edge=curl',
    googleVolumeId: 'abc',
    isbn: '9788535914849',
    openLibIdUrl: 'http://covers.openlibrary.org/b/id/10101-L.jpg?default=false',
  });

  assert.ok(cascade.every((u) => u.startsWith('https://')));
  assert.ok(cascade.some((u) => u.includes('printsec=frontcover&img=1&zoom=1')));
  assert.ok(cascade.some((u) => u.includes('/b/isbn/9788535914849-L.jpg')));
  assert.ok(cascade.some((u) => u.includes('/b/id/10101-L.jpg')));
});

test('mapJikanManga mapeia tipo (Light Novel/Manga/Manhwa), capitulos/volumes e capas HTTPS', () => {
  const ln = mapJikanManga({
    mal_id: 91234,
    type: 'Light Novel',
    title: 'Overlord',
    title_english: 'Overlord',
    title_japanese: 'オーバーロード',
    volumes: 16,
    chapters: 140,
    status: 'Publishing',
    authors: [{ name: 'Maruyama, Kugane' }],
    genres: [{ name: 'Fantasy' }],
    images: {
      webp: { large_image_url: 'http://cdn.myanimelist.net/images/manga/1/123l.webp' },
      jpg: { large_image_url: 'https://cdn.myanimelist.net/images/manga/1/123l.jpg' },
    },
  });

  assert.equal(ln.workType, 'manga');
  assert.equal(ln.demographicOrigin, 'Light Novel');
  assert.equal(ln.mangaType, 'Light Novel');
  assert.equal(ln.volumes ?? ln.totalVolumes, 16);
  assert.equal(ln.totalChapters, 140);
  assert.equal(ln.originalTitle, 'オーバーロード');
  assert.equal(ln.coverCandidates[0], 'https://cdn.myanimelist.net/images/manga/1/123l.webp');
  assert.equal(ln.coverCandidates[1], 'https://cdn.myanimelist.net/images/manga/1/123l.jpg');
});

test('mergeTwoResults nunca descarta uma capa valida em favor de outra fonte sem capa', () => {
  const withoutCover = {
    id: 'wd-99',
    title: 'Duna',
    originalTitle: 'Dune',
    author: 'Frank Herbert',
    coverUrl: null,
    coverCandidates: [],
    coverSources: [],
    sourceLabel: 'Wikidata',
  };
  const withCover = {
    id: 'gb-99',
    title: 'Duna',
    isbn: '9788576573135',
    coverUrl: 'https://books.google.com/duna.jpg',
    coverCandidates: ['https://books.google.com/duna.jpg'],
    coverSources: ['https://books.google.com/duna.jpg'],
    sourceLabel: 'Google Books',
  };

  const mergedA = mergeTwoResults(withoutCover, withCover);
  const mergedB = mergeTwoResults(withCover, withoutCover);
  assert.equal(mergedA.coverUrl, 'https://books.google.com/duna.jpg');
  assert.equal(mergedB.coverUrl, 'https://books.google.com/duna.jpg');
  assert.equal(mergedA.originalTitle, 'Dune');
});

test('searchMedia filtra apenas APIs selecionadas e entrega resultados progressivos via onPartialResults', async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls = [];
  const partialEvents = [];

  globalThis.fetch = async (url) => {
    const str = String(url);
    requestedUrls.push(str);

    if (str.includes('api.jikan.moe')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            {
              mal_id: 11,
              type: 'Manga',
              title: 'Berserk',
              title_japanese: 'ベルセルク',
              volumes: 42,
              authors: [{ name: 'Kentaro Miura' }],
              images: {
                jpg: { large_image_url: 'https://cdn.myanimelist.net/berserk.jpg' },
              },
            },
          ],
        }),
      };
    }

    if (str.includes('googleapis.com')) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      return {
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              id: 'gb-berserk',
              volumeInfo: {
                title: 'Berserk Vol. 1',
                authors: ['Kentaro Miura'],
                publisher: 'Panini',
                imageLinks: { thumbnail: 'https://books.google.com/berserk1.jpg' },
              },
            },
          ],
        }),
      };
    }

    return { ok: false, status: 500, json: async () => ({}) };
  };

  try {
    const res = await searchMedia('Berserk', {
      filter: 'manga',
      sources: ['jikan', 'googleBooks'],
      skipCache: true,
      onPartialResults: (ev) => partialEvents.push(ev),
    });

    assert.ok(requestedUrls.some((u) => u.includes('api.jikan.moe')));
    assert.ok(requestedUrls.some((u) => u.includes('googleapis.com')));
    assert.equal(requestedUrls.some((u) => u.includes('openlibrary.org')), false);
    assert.equal(requestedUrls.some((u) => u.includes('wikidata.org')), false);
    assert.equal(partialEvents.length, 2);
    assert.equal(partialEvents[0].completedSource, 'jikan');
    assert.equal(partialEvents[0].results[0].title, 'Berserk');
    assert.equal(res.results.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
