import assert from 'node:assert/strict';
import test from 'node:test';

// Simula sessionStorage mínimo para testes em Node
const store = new Map();
globalThis.sessionStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const {
  GeminiError,
  callGemini,
  invalidateGeminiModelCache,
  resolveModel,
  selectBestGeminiModels,
} = await import('../src/services/geminiApi.js');

const { detectDoiQuery, detectIsbnQuery, searchMedia } = await import(
  '../src/services/mediaApi.js'
);

test('selectBestGeminiModels prioriza flash > flash-lite > pro e versao mais recente', () => {
  const ranked = selectBestGeminiModels([
    { name: 'models/gemini-2.0-pro', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-2.5-flash-lite', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-2.0-flash', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-2.5-flash-tts', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/embedding-001', supportedGenerationMethods: ['embedContent'] },
  ]);

  assert.equal(ranked[0], 'gemini-2.5-flash');
  assert.equal(ranked[1], 'gemini-2.0-flash');
  assert.equal(ranked[2], 'gemini-2.5-flash-lite');
  assert.equal(ranked[3], 'gemini-2.0-pro');
  assert.ok(!ranked.includes('gemini-2.5-flash-tts'));
  assert.ok(!ranked.includes('embedding-001'));
});

test('resolveModel descobre via API, usa cache e faz retry em 404 invalidando cache', async () => {
  invalidateGeminiModelCache();
  const originalFetch = globalThis.fetch;
  const calls = [];

  globalThis.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).includes('/v1beta/models?')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          models: [
            { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
            { name: 'models/gemini-2.5-flash-lite', supportedGenerationMethods: ['generateContent'] },
          ],
        }),
      };
    }
    if (String(url).includes('gemini-2.5-flash:generateContent')) {
      return { ok: false, status: 404, json: async () => ({}) };
    }
    if (String(url).includes('gemini-2.5-flash-lite:generateContent')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'Resposta ok' }] } }],
        }),
      };
    }
    return { ok: false, status: 500, json: async () => ({}) };
  };

  try {
    const first = await resolveModel('AIzaTestKey');
    assert.equal(first, 'gemini-2.5-flash');
    assert.equal(calls.length, 1);

    // Segunda chamada vem do cache sem novo GET /models
    const cached = await resolveModel('AIzaTestKey');
    assert.equal(cached, 'gemini-2.5-flash');
    assert.equal(calls.length, 1);

    // callGemini recebe 404 no primeiro modelo, invalida cache, redescobre e tenta outro
    const answer = await callGemini({ apiKey: 'AIzaTestKey', prompt: 'Oi' });
    assert.equal(answer, 'Resposta ok');
    assert.ok(calls.some((u) => u.includes('gemini-2.5-flash-lite:generateContent')));

    // Erro 403 retorna GeminiError amigável
    globalThis.fetch = async () => ({ ok: false, status: 403, json: async () => ({}) });
    invalidateGeminiModelCache();
    await assert.rejects(
      () => callGemini({ apiKey: 'AIzaBadKey', prompt: 'Oi' }),
      (err) => err instanceof GeminiError && err.code === 'AUTH_INVALID' && Boolean(err.userMessage)
    );
  } finally {
    globalThis.fetch = originalFetch;
    invalidateGeminiModelCache();
  }
});

test('mediaApi detecta ISBN/DOI e tolera falha parcial com Promise.allSettled', async () => {
  assert.equal(detectIsbnQuery('978-85-7657-313-5'), '9788576573135');
  assert.equal(detectDoiQuery('https://doi.org/10.1590/0102-311X00123456'), '10.1590/0102-311X00123456');

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const str = String(url);
    // Simula CrossRef bloqueado (404) e OpenLibrary ok
    if (str.includes('api.crossref.org') || str.includes('api.jikan.moe')) {
      return { ok: false, status: 404, json: async () => ({}) };
    }
    if (str.includes('googleapis.com')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              id: '123',
              volumeInfo: {
                title: 'Duna',
                authors: ['Frank Herbert'],
                publishedDate: '1965',
                industryIdentifiers: [{ type: 'ISBN_13', identifier: '9788576573135' }],
                imageLinks: { thumbnail: 'http://books.google.com/cover.jpg&edge=curl' },
              },
            },
          ],
        }),
      };
    }
    if (str.includes('openlibrary.org')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          docs: [
            {
              key: '/works/OL1W',
              title: 'Duna',
              author_name: ['Frank Herbert'],
              first_publish_year: 1965,
              isbn: ['9788576573135'],
              cover_i: 99999,
            },
          ],
        }),
      };
    }
    return { ok: false, status: 500, json: async () => ({}) };
  };

  try {
    const res = await searchMedia('Duna', { filter: 'all', skipCache: true });
    assert.equal(res.partialFailure, true);
    assert.equal(res.allFailed, false);
    assert.equal(res.results.length, 1);
    assert.ok(res.results[0].coverSources.some((u) => u.startsWith('https://books.google.com/')));
    assert.ok(res.results[0].coverSources.some((u) => u.includes('/b/isbn/9788576573135-L.jpg')));
    assert.ok(res.results[0].coverSources.some((u) => u.includes('/b/id/99999-L.jpg')));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
