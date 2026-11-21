import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

function createMemoryStorage() {
  const store = new Map();
  return {
    getItem(k) {
      return store.has(k) ? store.get(k) : null;
    },
    setItem(k, v) {
      store.set(k, String(v));
    },
    removeItem(k) {
      store.delete(k);
    },
    clear() {
      store.clear();
    },
  };
}

globalThis.localStorage = createMemoryStorage();
globalThis.sessionStorage = createMemoryStorage();

const { CODICE_RELEASE, RELEASE_HISTORY, formatReleaseBadge } = await import(
  '../src/config/versioning.js'
);
const { computeNextVersion, parseBumpCliArgs, runVersionBump } = await import(
  '../scripts/bump-version.mjs'
);
const {
  DEFAULT_MEDIA_SOURCES,
  clearSearchMediaCache,
  getDefaultSourcesForFilter,
  loadActiveMediaSources,
  searchMedia,
} = await import('../src/services/mediaApi.js');
const {
  GeminiError,
  callGemini,
  invalidateGeminiModelCache,
  parseJsonResponse,
  sanitizeGeminiKey,
  testGeminiConnection,
} = await import('../src/services/geminiApi.js');
const {
  buildLocalReviewOrAbstractSynthesis,
  buildLocalSpoilerFreeRecap,
  runLocalSmartCataloging,
} = await import('../src/services/localCatalogFallback.js');
const { buildHomeBookRecommendations } = await import(
  '../src/services/recommendationEngine.js'
);

test('versioning.js, package.json, CHANGELOG.md e scripts/bump-version.mjs configuram Ymir corretamente', async () => {
  const pkg = JSON.parse(await fs.readFile(path.resolve('package.json'), 'utf8'));
  assert.equal(CODICE_RELEASE.version, pkg.version);
  assert.ok(CODICE_RELEASE.codename);
  assert.equal(CODICE_RELEASE.label, `v${pkg.version} · ${CODICE_RELEASE.codename}`);
  assert.equal(formatReleaseBadge(), `Códice ${CODICE_RELEASE.label}`);
  assert.ok(Array.isArray(RELEASE_HISTORY) && RELEASE_HISTORY.length >= 2);
  assert.ok(RELEASE_HISTORY.some((entry) => entry.version === '4.1.0'));
  assert.ok(pkg.scripts['version:patch']);
  assert.ok(pkg.scripts['version:minor']);
  assert.ok(pkg.scripts['version:major']);

  const changelog = await fs.readFile(path.resolve('CHANGELOG.md'), 'utf8');
  assert.ok(changelog.includes(`v${pkg.version} · ${CODICE_RELEASE.codename}`));
  assert.ok(changelog.includes('v4.1.0 · Ymir'));
  assert.ok(changelog.includes('codinome'));

  assert.equal(computeNextVersion('4.1.0', 'patch'), '4.1.1');
  assert.equal(computeNextVersion('4.1.0', 'minor'), '4.2.0');
  assert.equal(computeNextVersion('4.1.0', 'major'), '5.0.0');

  const parsed = parseBumpCliArgs(['major', '--name="Odin"', '--no-git']);
  assert.equal(parsed.bumpType, 'major');
  assert.equal(parsed.codename, 'Odin');
  assert.equal(parsed.noGit, true);

  // Testa bump-version.mjs em diretório temporário isolado
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codice-bump-'));
  try {
    await fs.mkdir(path.join(tmpDir, 'src/config'), { recursive: true });
    await fs.copyFile(path.resolve('package.json'), path.join(tmpDir, 'package.json'));
    await fs.copyFile(
      path.resolve('src/config/versioning.js'),
      path.join(tmpDir, 'src/config/versioning.js')
    );
    await fs.copyFile(path.resolve('CHANGELOG.md'), path.join(tmpDir, 'CHANGELOG.md'));

    const patchRes = await runVersionBump(['patch', '--no-git'], { rootDir: tmpDir });
    assert.equal(patchRes.nextRelease.version, computeNextVersion(pkg.version, 'patch'));
    assert.equal(patchRes.nextRelease.codename, CODICE_RELEASE.codename);

    const majorRes = await runVersionBump(
      ['major', '--name=Odin', '--no-git'],
      { rootDir: tmpDir }
    );
    assert.equal(
      majorRes.nextRelease.version,
      computeNextVersion(patchRes.nextRelease.version, 'major')
    );
    assert.equal(majorRes.nextRelease.codename, 'Odin');
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('mediaApi.js usa defaults rápidos por categoria, limita 10 resultados e persiste cache em localStorage', async () => {
  globalThis.localStorage.clear();
  clearSearchMediaCache();

  assert.deepEqual(DEFAULT_MEDIA_SOURCES, ['googleBooks', 'appleBooks', 'openLibrary']);
  assert.deepEqual(getDefaultSourcesForFilter('all'), ['googleBooks', 'appleBooks', 'openLibrary']);
  assert.deepEqual(getDefaultSourcesForFilter('book'), ['googleBooks']);
  assert.deepEqual(getDefaultSourcesForFilter('manga'), ['jikan']);
  assert.deepEqual(getDefaultSourcesForFilter('academic'), ['academic']);
  assert.deepEqual(loadActiveMediaSources(), ['googleBooks', 'appleBooks', 'openLibrary']);

  const originalFetch = globalThis.fetch;
  let fetchCount = 0;
  let seenMaxResults = null;

  globalThis.fetch = async (url) => {
    fetchCount += 1;
    const u = new URL(String(url));
    seenMaxResults = u.searchParams.get('maxResults');
    const items = Array.from({ length: 12 }, (_, idx) => ({
      id: `vol-${idx}`,
      volumeInfo: {
        title: `Livro Rápido ${idx + 1}`,
        authors: ['Autor Teste'],
        publishedDate: '2025',
      },
    }));
    return {
      ok: true,
      status: 200,
      json: async () => ({ items }),
    };
  };

  try {
    const first = await searchMedia('Livro Rápido', {
      filter: 'book',
      sources: ['googleBooks'],
    });
    assert.equal(fetchCount, 1);
    assert.equal(seenMaxResults, '10');
    assert.equal(first.results.length, 10);
    assert.equal(first.source, 'multi');

    const cachedRaw = globalThis.localStorage.getItem('codice_search_cache_v2');
    assert.ok(cachedRaw, 'Cache deve ser gravado em localStorage (codice_search_cache_v2)');

    // Segunda consulta idêntica retorna do cache em 0ms sem disparar fetch
    const second = await searchMedia('Livro Rápido', {
      filter: 'book',
      sources: ['googleBooks'],
    });
    assert.equal(fetchCount, 1);
    assert.equal(second.source, 'cache');
    assert.equal(second.results.length, 10);
  } finally {
    globalThis.fetch = originalFetch;
    clearSearchMediaCache();
  }
});

test('geminiApi.js sanitiza chave, omite responseMimeType, faz fallback entre 3 modelos e testa conexão', async () => {
  assert.equal(sanitizeGeminiKey('  "AIzaCleanKey"\n '), 'AIzaCleanKey');
  assert.deepEqual(
    parseJsonResponse('Claro! Aqui está o JSON:\n{"synopsis":"Sem spoilers","genres":["Ficção"]}\nFim.'),
    { synopsis: 'Sem spoilers', genres: ['Ficção'] }
  );

  invalidateGeminiModelCache();
  globalThis.sessionStorage.clear();

  const originalFetch = globalThis.fetch;
  const hitUrls = [];
  const requestBodies = [];

  globalThis.fetch = async (url, init = {}) => {
    const urlStr = String(url);
    hitUrls.push(urlStr);
    if (init.body) {
      requestBodies.push(JSON.parse(init.body));
    }

    if (urlStr.includes('/v1beta/models?')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          models: [
            { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
            { name: 'models/gemini-2.0-flash', supportedGenerationMethods: ['generateContent'] },
            { name: 'models/gemini-2.0-flash-lite', supportedGenerationMethods: ['generateContent'] },
          ],
        }),
      };
    }

    if (urlStr.includes('gemini-2.5-flash:generateContent')) {
      return { ok: false, status: 404, json: async () => ({}) };
    }
    if (urlStr.includes('gemini-2.0-flash:generateContent')) {
      return {
        ok: false,
        status: 400,
        json: async () => ({ error: { message: 'Model parameter rejected' } }),
      };
    }
    if (urlStr.includes('gemini-2.0-flash-lite:generateContent')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'OK' }] } }],
        }),
      };
    }
    return { ok: false, status: 500, json: async () => ({}) };
  };

  try {
    const diag = await testGeminiConnection(' "AIzaKeyWithQuotes" ');
    assert.equal(diag.ok, true);
    assert.equal(diag.model, 'gemini-2.0-flash-lite');
    assert.ok(diag.latencyMs >= 1);
    assert.ok(requestBodies.every((b) => b.generationConfig?.responseMimeType === undefined));

    // Testa tradução de erro 400 API_KEY_INVALID e 403
    invalidateGeminiModelCache();
    globalThis.fetch = async () => ({
      ok: false,
      status: 400,
      json: async () => ({
        error: {
          status: 'INVALID_ARGUMENT',
          message: 'API key not valid',
          details: [{ reason: 'API_KEY_INVALID' }],
        },
      }),
    });
    const invalidKeyDiag = await testGeminiConnection('AIzaBad');
    assert.equal(invalidKeyDiag.ok, false);
    assert.match(invalidKeyDiag.errorMessage, /Chave da API inválida/i);

    globalThis.fetch = async () => ({
      ok: false,
      status: 403,
      json: async () => ({}),
    });
    await assert.rejects(
      () => callGemini({ apiKey: 'AIzaBlocked', prompt: 'Oi' }),
      (err) =>
        err instanceof GeminiError &&
        /restrições de domínio|HTTP Referrer/i.test(err.userMessage)
    );
  } finally {
    globalThis.fetch = originalFetch;
    invalidateGeminiModelCache();
  }
});

test('localCatalogFallback.js e recommendationEngine.js funcionam offline e RecommendationsSection/UI mantêm os fluxos', async () => {
  const localRes = await runLocalSmartCataloging(
    {
      title: 'Código Limpo',
      author: 'Robert C. Martin',
      publisher: 'alta books',
      workType: 'academic',
    },
    { queryRemote: false }
  );
  assert.equal(localRes.updates.cdu_cdd, '004');
  assert.ok(localRes.updates.abntReference);
  assert.ok(localRes.updates.genres.length > 0);

  const recap = buildLocalSpoilerFreeRecap({
    item: { title: 'Duna', currentPage: 120, totalPages: 680, quotes: [{ text: 'O medo mata a mente.' }] },
  });
  assert.match(recap, /Página 120 de 680/);

  const synth = buildLocalReviewOrAbstractSynthesis({
    item: { title: 'Duna', author: 'Frank Herbert', rating: 95 },
  });
  assert.match(synth, /RESENHA EDITORIAL LOCAL/i);

  const recsFirst = buildHomeBookRecommendations({
    items: [
      {
        id: 'fav-1',
        title: 'O Nome do Vento',
        author: 'Patrick Rothfuss',
        status: 'completed',
        inBacklog: true,
        rating: 95,
        genres: ['Fantasia'],
      },
    ],
    profile: { favoriteGenres: ['Fantasia'] },
    peerRecommendations: [
      {
        work: {
          id: 'peer-w1',
          title: 'A Via dos Reis',
          author: 'Brandon Sanderson',
          genres: ['Fantasia'],
        },
        peerHandle: '@colega',
        rating: 96,
        isFollowing: true,
      },
    ],
    limit: 3,
  });

  assert.ok(recsFirst.recommendations.length > 0);
  assert.equal(recsFirst.recommendations[0].peerHandle, '@colega');
  assert.match(recsFirst.recommendations[0].reason, /Indicado por @colega/);

  const recsRefreshed = buildHomeBookRecommendations({
    items: [
      {
        id: 'fav-1',
        title: 'O Nome do Vento',
        status: 'completed',
        inBacklog: true,
        rating: 95,
        genres: ['Fantasia'],
      },
    ],
    limit: 2,
    excludeIds: recsFirst.recommendations.map((r) => r.id),
  });
  assert.ok(recsRefreshed.recommendations.length > 0);
  assert.notEqual(
    recsRefreshed.recommendations[0].id,
    recsFirst.recommendations[0].id
  );

  // Confere integridade estrutural dos componentes de indicações e upload rápido
  const [recCompSrc, homeSrc, profileSrc, aiPanelSrc, detailSrc] = await Promise.all([
    fs.readFile(path.resolve('src/components/RecommendationsSection.jsx'), 'utf8'),
    fs.readFile(path.resolve('src/screens/HomeScreen.jsx'), 'utf8'),
    fs.readFile(path.resolve('src/screens/ProfileScreen.jsx'), 'utf8'),
    fs.readFile(path.resolve('src/components/AiProvidersPanel.jsx'), 'utf8'),
    fs.readFile(path.resolve('src/components/ItemDetailSheet.jsx'), 'utf8'),
  ]);

  assert.ok(recCompSrc.includes('Indicações para Sua Próxima Leitura'));
  assert.ok(recCompSrc.includes('Adicionar à Lista de Desejos'));
  assert.ok(recCompSrc.includes('Atualizar Indicações'));
  assert.ok(homeSrc.includes('+ Adicionar Arquivo para Ler'));
  assert.ok(homeSrc.includes('CODICE_RELEASE.label'));
  assert.ok(profileSrc.includes('AiProvidersPanel'));
  assert.ok(aiPanelSrc.includes('Testar'));
  assert.ok(profileSrc.includes('CODICE_RELEASE.label'));
  assert.ok(detailSrc.includes('Indicar Livro'));
});
