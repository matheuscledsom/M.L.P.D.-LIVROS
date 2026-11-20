import assert from 'node:assert/strict';
import test from 'node:test';

function createMemStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    clear: () => m.clear(),
  };
}

if (!globalThis.localStorage) {
  globalThis.localStorage = createMemStorage();
}
if (!globalThis.sessionStorage) {
  globalThis.sessionStorage = createMemStorage();
}

const {
  MEDIA_CONNECTORS,
  MEDIA_SOURCE_PRESETS,
  clearSearchMediaCache,
  mapAppleBook,
  mergeTwoResults,
  saveGoogleBooksApiKey,
  searchMedia,
} = await import('../src/services/mediaApi.js');

const {
  AI_MODELS,
  AI_MODEL_AUDIT,
  AiProviderError,
  generate,
  getProviderCooldownRemainingMs,
  hasSeenAiPrivacyNotice,
  isProviderInCooldown,
  markAiPrivacyNoticeSeen,
  maskApiKey,
  resetProviderCooldowns,
  runMultiSmartCataloging,
  truncateAiText,
} = await import('../src/services/aiProvider.js');

const { invalidateGeminiModelCache } = await import(
  '../src/services/geminiApi.js'
);

const { clearMemoryReaderStoreForTests } = await import(
  '../src/services/readerStorage.js'
);

test('Apple Books connector: URL exata, capa 600x600bb com fallback e sinopse sem HTML', async () => {
  const mapped = mapAppleBook({
    trackId: 1040127121,
    trackName: 'Duna',
    artistName: 'Frank Herbert',
    releaseDate: '2015-09-16T07:00:00Z',
    genres: ['Ficção científica', 'Livros'],
    description: 'Arrakis, o Planeta Deserto.<br/><br/>Clássico &amp; obra-prima.',
    artworkUrl100: 'http://is1-ssl.mzstatic.com/image/thumb/x/100x100bb.jpg',
  });

  assert.equal(mapped.title, 'Duna');
  assert.deepEqual(mapped.authors, ['Frank Herbert']);
  assert.equal(mapped.year, 2015);
  assert.equal(mapped.source, 'appleBooks');
  assert.equal(
    mapped.coverUrl,
    'https://is1-ssl.mzstatic.com/image/thumb/x/600x600bb.jpg'
  );
  assert.ok(
    mapped.coverCandidates.includes(
      'https://is1-ssl.mzstatic.com/image/thumb/x/100x100bb.jpg'
    )
  );
  assert.equal(mapped.synopsis.includes('<br'), false);
  assert.ok(mapped.synopsis.includes('Clássico & obra-prima.'));

  const geralPreset = MEDIA_SOURCE_PRESETS.find((p) => p.id === 'all');
  assert.ok(geralPreset.sources.includes('appleBooks'));
  assert.ok(geralPreset.sources.includes('openLibrary'));
  assert.ok(geralPreset.sources.includes('googleBooks'));

  const origFetch = globalThis.fetch;
  const seenUrls = [];
  globalThis.fetch = async (url) => {
    seenUrls.push(String(url));
    return {
      ok: true,
      status: 200,
      json: async () => ({
        resultCount: 1,
        results: [
          {
            trackId: 55,
            trackName: 'Dom Casmurro',
            artistName: 'Machado de Assis',
            releaseDate: '1899-01-01T00:00:00Z',
            description: 'Capitu e Bentinho.',
            artworkUrl100: 'https://is1-ssl.mzstatic.com/100x100bb.jpg',
          },
        ],
      }),
    };
  };

  try {
    const items = await MEDIA_CONNECTORS.appleBooks.search('Dom Casmurro');
    assert.equal(
      seenUrls[0],
      'https://itunes.apple.com/search?term=Dom%20Casmurro&media=ebook&country=br&limit=10'
    );
    assert.equal(items.length, 1);
    assert.equal(items[0].source, 'appleBooks');
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('Google Books tenta sem chave em 400/403, dedupe prioriza capa+sinopse e partialFailure reporta failedCount', async () => {
  clearSearchMediaCache();
  saveGoogleBooksApiKey('');
  const origFetch = globalThis.fetch;
  const gbUrls = [];

  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('googleapis.com')) {
      gbUrls.push(u);
      if (u.includes('key=')) {
        return { ok: false, status: 403, json: async () => ({}) };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              id: 'gb-dom',
              volumeInfo: {
                title: 'Dom Casmurro',
                authors: ['Machado de Assis'],
                publishedDate: '1899',
                description: 'História narrada por Bentinho.',
                industryIdentifiers: [{ type: 'ISBN_13', identifier: '9788535910663' }],
              },
            },
          ],
        }),
      };
    }
    if (u.includes('itunes.apple.com')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          results: [
            {
              trackId: 777,
              trackName: 'Dôm Cásmurro',
              artistName: 'Machado de Assis',
              releaseDate: '2019-01-01T00:00:00Z',
              artworkUrl100: 'https://is1-ssl.mzstatic.com/dom/100x100bb.jpg',
            },
          ],
        }),
      };
    }
    // OpenLibrary falha para testar "1 fonte indisponível"
    return { ok: false, status: 503, json: async () => ({}) };
  };

  try {
    const res = await searchMedia('Dom Casmurro', {
      filter: 'all',
      sources: ['googleBooks', 'appleBooks', 'openLibrary'],
      googleBooksKey: 'AIzaTestOptionalKey1234',
      skipCache: true,
    });

    assert.equal(gbUrls.length, 2);
    assert.ok(gbUrls[0].includes('key=AIzaTestOptionalKey1234'));
    assert.equal(gbUrls[1].includes('key='), false);

    assert.equal(res.partialFailure, true);
    assert.equal(res.allFailed, false);
    assert.equal(res.failedCount, 1);
    assert.deepEqual(res.failedSources, ['openlib']);

    // Google Books (com ISBN + sinopse, sem capa) e Apple Books (com capa, sem sinopse/ISBN) fazem dedupe
    assert.equal(res.results.length, 1);
    assert.ok(res.results[0].coverUrl.includes('600x600bb'));
    assert.ok(res.results[0].synopsis.includes('Bentinho'));

    const merged = mergeTwoResults(
      { id: '1', title: 'X', coverUrl: null, coverCandidates: [], coverSources: [], synopsis: '' },
      {
        id: '2',
        title: 'X',
        coverUrl: 'https://example.com/c.jpg',
        coverCandidates: ['https://example.com/c.jpg'],
        coverSources: ['https://example.com/c.jpg'],
        synopsis: 'Com sinopse',
      }
    );
    assert.equal(merged.coverUrl, 'https://example.com/c.jpg');
    assert.equal(merged.synopsis, 'Com sinopse');
  } finally {
    globalThis.fetch = origFetch;
    clearSearchMediaCache();
    saveGoogleBooksApiKey('');
  }
});

test('multi-IA: fallback apenas em 429/503/5xx com retry único e pausa 60s; 401/403 não troca provedor', async () => {
  resetProviderCooldowns();
  invalidateGeminiModelCache();
  globalThis.sessionStorage.clear();
  globalThis.localStorage.clear();

  assert.equal(maskApiKey('AIza1234567890abcd'), '••••abcd');
  assert.equal(AI_MODELS.groq.primary, 'llama-3.3-70b-versatile');
  assert.equal(AI_MODEL_AUDIT['gemini-2.0-flash-lite'].status, 'discontinued');

  const origFetch = globalThis.fetch;
  const hitHosts = [];
  let groqCalls = 0;

  // 1) Gemini retorna 401 -> NÃO pode acionar Groq nem OpenRouter
  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(String(url));
    hitHosts.push({ host: u.host, headers: init.headers || {} });
    if (u.host === 'generativelanguage.googleapis.com') {
      if (u.pathname.endsWith('/models')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            models: [{ name: 'models/gemini-2.5-flash-lite', supportedGenerationMethods: ['generateContent'] }],
          }),
        };
      }
      return {
        ok: false,
        status: 401,
        json: async () => ({ error: { message: 'Invalid key' } }),
      };
    }
    groqCalls += 1;
    return { ok: true, status: 200, json: async () => ({}) };
  };

  try {
    await assert.rejects(
      () =>
        generate({
          task: 'catalog',
          input: 'Teste',
          keys: { gemini: 'AIzaBad1', groq: 'gsk_Secret2' },
          preferences: {
            preferredProvider: 'gemini',
            fallbackOrder: ['gemini', 'groq', 'openrouter'],
          },
          retryDelayMs: 0,
          jitterMaxMs: 0,
        }),
      (err) => err instanceof AiProviderError && err.code === 'AUTH_ERROR' && /Chave inválida ou sem permissão/i.test(err.userMessage)
    );
    assert.equal(groqCalls, 0);
  } finally {
    globalThis.fetch = origFetch;
  }

  // 2) Gemini alterna modelo em 503; depois quando Groq retorna 429 duas vezes, entra em pausa 60s e cai para OpenRouter
  resetProviderCooldowns();
  invalidateGeminiModelCache();
  let groqAttempts = 0;
  let openRouterAttempts = 0;
  const keyHosts = [];

  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(String(url));
    keyHosts.push({ host: u.host, auth: init.headers?.Authorization || init.headers?.['x-goog-api-key'] || '' });
    if (u.host === 'api.groq.com') {
      groqAttempts += 1;
      return { ok: false, status: 429, json: async () => ({}) };
    }
    if (u.host === 'openrouter.ai') {
      openRouterAttempts += 1;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          model: AI_MODELS.openrouter.primary,
          choices: [{ message: { content: 'Resposta OpenRouter' } }],
        }),
      };
    }
    return { ok: false, status: 500, json: async () => ({}) };
  };

  try {
    const res = await generate({
      task: 'catalog',
      input: 'Catalogar',
      keys: { gemini: '', groq: 'gsk_OnlyGroq', openrouter: 'sk-or-OnlyOR' },
      preferences: {
        preferredProvider: 'groq',
        fallbackOrder: ['groq', 'openrouter', 'gemini'],
      },
      retryDelayMs: 5,
      jitterMaxMs: 0,
    });

    assert.equal(groqAttempts, 2); // tentativa inicial + máximo 1 retry
    assert.equal(openRouterAttempts, 1);
    assert.equal(res.provider, 'openrouter');
    assert.equal(res.text, 'Resposta OpenRouter');
    assert.equal(isProviderInCooldown('groq'), true);
    assert.ok(getProviderCooldownRemainingMs('groq') > 50000);

    // Isolamento de chaves por host: nenhuma chave foi enviada a outro host
    assert.ok(keyHosts.filter((x) => x.host === 'api.groq.com').every((x) => x.auth.includes('gsk_OnlyGroq')));
    assert.ok(keyHosts.filter((x) => x.host === 'openrouter.ai').every((x) => x.auth.includes('sk-or-OnlyOR')));

    // Groq em pausa de 60s é pulado imediatamente na próxima chamada
    groqAttempts = 0;
    const secondRes = await generate({
      task: 'catalog',
      input: 'Catalogar 2',
      keys: { gemini: '', groq: 'gsk_OnlyGroq', openrouter: 'sk-or-OnlyOR' },
      preferences: {
        preferredProvider: 'groq',
        fallbackOrder: ['groq', 'openrouter', 'gemini'],
      },
      retryDelayMs: 0,
      jitterMaxMs: 0,
    });
    assert.equal(groqAttempts, 0);
    assert.equal(secondRes.provider, 'openrouter');
  } finally {
    globalThis.fetch = origFetch;
    resetProviderCooldowns();
  }
});

test('Gemini alterna modelos em 503, trunca sinopse (2000 chars), cacheia em IndexedDB e controla aviso de privacidade', async () => {
  resetProviderCooldowns();
  invalidateGeminiModelCache();
  clearMemoryReaderStoreForTests();
  globalThis.sessionStorage.clear();
  globalThis.localStorage.clear();

  assert.equal(truncateAiText('a'.repeat(2500), 2000).length, 2000);
  assert.equal(hasSeenAiPrivacyNotice('groq'), false);
  markAiPrivacyNoticeSeen('groq');
  assert.equal(hasSeenAiPrivacyNotice('groq'), true);

  const origFetch = globalThis.fetch;
  let groqFetchCount = 0;
  let seenPromptContent = '';
  let seenPromptLength = 0;
  let seenTemp = null;

  globalThis.fetch = async (url, init = {}) => {
    groqFetchCount += 1;
    const body = JSON.parse(init.body || '{}');
    seenTemp = body.temperature;
    seenPromptContent = String(body.messages?.[1]?.content || '');
    seenPromptLength = seenPromptContent.length;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        model: AI_MODELS.groq.primary,
        choices: [
          {
            message: {
              content: JSON.stringify({
                synopsis: 'Resumo enxuto',
                cdu_cdd: '823',
                cutter: 'H536d',
                genres: ['Ficção Científica'],
                atmosphere: ['Épico'],
              }),
            },
          },
        ],
      }),
    };
  };

  try {
    const work = {
      id: 'work-cache-1',
      title: 'Duna',
      author: 'Frank Herbert',
      workType: 'book',
      synopsis: 'x'.repeat(4000),
    };

    const first = await runMultiSmartCataloging({
      item: work,
      overrideKeys: { groq: 'gsk_CacheTest' },
    });
    assert.equal(groqFetchCount, 1);
    assert.equal(seenTemp, 0.2);
    assert.equal(seenPromptContent.includes('x'.repeat(2005)), false);
    assert.ok(seenPromptLength < 2900); // sinopse foi truncada para <= 2000 chars + prompt compacto
    assert.equal(first.fromCache, false);
    assert.equal(first.cdu_cdd, '823');

    // Segunda chamada idêntica usa o cache IndexedDB (em memória fallback no Node) sem chamar fetch
    const second = await runMultiSmartCataloging({
      item: work,
      overrideKeys: { groq: 'gsk_CacheTest' },
    });
    assert.equal(groqFetchCount, 1);
    assert.equal(second.fromCache, true);
    assert.equal(second.cdu_cdd, '823');
  } finally {
    globalThis.fetch = origFetch;
    clearMemoryReaderStoreForTests();
    resetProviderCooldowns();
  }
});

test('Gemini alterna automaticamente entre modelos quando o primeiro responde 503', async () => {
  resetProviderCooldowns();
  invalidateGeminiModelCache();
  globalThis.sessionStorage.clear();

  const origFetch = globalThis.fetch;
  const geminiUrls = [];

  globalThis.fetch = async (url) => {
    const str = String(url);
    geminiUrls.push(str);
    if (str.includes('/v1beta/models?')) {
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
    if (str.includes('gemini-2.5-flash:generateContent')) {
      return { ok: false, status: 503, json: async () => ({}) };
    }
    if (str.includes('gemini-2.5-flash-lite:generateContent')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'OK fallback 503' }] } }],
        }),
      };
    }
    return { ok: false, status: 500, json: async () => ({}) };
  };

  try {
    const res = await generate({
      task: 'test',
      input: 'Responda apenas: OK',
      keys: { gemini: 'AIzaTest503Alternation' },
      preferences: { preferredProvider: 'gemini', fallbackOrder: ['gemini'] },
      retryDelayMs: 0,
      jitterMaxMs: 0,
    });
    assert.equal(res.provider, 'gemini');
    assert.equal(res.model, 'gemini-2.5-flash-lite');
    assert.equal(res.text, 'OK fallback 503');
    assert.ok(geminiUrls.some((u) => u.includes('gemini-2.5-flash:generateContent')));
    assert.ok(geminiUrls.some((u) => u.includes('gemini-2.5-flash-lite:generateContent')));
  } finally {
    globalThis.fetch = origFetch;
    invalidateGeminiModelCache();
    resetProviderCooldowns();
  }
});
