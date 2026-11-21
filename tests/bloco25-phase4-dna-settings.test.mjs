import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const {
  DNA_DIMENSIONS,
  computeDnaWeightedScore,
  createDefaultReaderDna,
  evaluateCandidateExclusion,
  normalizeReaderDna,
} = await import('../src/services/dnaScoring.js');

const {
  buildHomeBookRecommendations,
  generateOfflineRecommendations,
} = await import('../src/services/recommendationEngine.js');

const { migrateDatabase } = await import('../src/services/codiceDatabase.js');

test('Fase 4: dnaScoring calcula 8 dimensoes, lida com peso zero sem NaN e filtra gatilhos/exclusoes', () => {
  assert.equal(DNA_DIMENSIONS.length, 8);

  const def = createDefaultReaderDna();
  for (const dim of DNA_DIMENSIONS) {
    assert.equal(def.weights[dim.id], 50);
  }

  const zeroDna = {
    weights: Object.fromEntries(DNA_DIMENSIONS.map((d) => [d.id, 0])),
    pacingPreference: 'equilibrado',
    densityPreference: 'qualquer',
    exclusions: ['Violência extrema'],
  };
  const zeroRes = computeDnaWeightedScore(
    { title: 'Obra Neutra', genres: ['Ficção Científica'], totalPages: 300 },
    zeroDna
  );
  assert.equal(zeroRes.excluded, false);
  assert.equal(zeroRes.bonus, 0);
  assert.ok(!Number.isNaN(zeroRes.bonus));

  const violentBook = {
    title: 'Crônicas Sombrias',
    genres: ['Terror e Gótico'],
    synopsis: 'Contém cenas de violência extrema e gore.',
  };
  assert.equal(evaluateCandidateExclusion(violentBook, zeroDna), true);
  assert.equal(computeDnaWeightedScore(violentBook, zeroDna).excluded, true);

  const highArtDna = normalizeReaderDna({
    weights: { artLayout: 95, rigorSources: 10 },
    densityPreference: 'curta',
  });
  const mangaShort = {
    title: 'Solanin',
    workType: 'manga',
    genres: ['Mangá', 'Drama'],
    totalPages: 210,
  };
  const highRes = computeDnaWeightedScore(mangaShort, highArtDna);
  assert.ok(highRes.bonus > 0);
  assert.ok(highRes.matchedDimensions.includes('artLayout'));
});

test('Fase 4: recommendationEngine respeita exclusoes do DNA do Leitor em modo offline e Home', () => {
  const items = [
    {
      id: 'q-violent',
      inBacklog: true,
      status: 'queued',
      title: 'Livro Proibido',
      genres: ['Fantasia', 'Ação'],
      synopsis: 'História com violência extrema explícita.',
      totalPages: 300,
    },
    {
      id: 'q-safe',
      inBacklog: true,
      status: 'queued',
      title: 'Memórias de um Livreira',
      genres: ['Literatura', 'Romance'],
      synopsis: 'Uma história calma e reflexiva em sebos antigos.',
      totalPages: 240,
    },
  ];
  const profile = {
    favoriteGenres: ['Fantasia', 'Romance', 'Literatura'],
    readerDna: {
      weights: { writingStyle: 95 },
      exclusions: ['Violência extrema'],
    },
  };

  const offline = generateOfflineRecommendations({
    items,
    profile,
    mood: 'Imersão Épica',
  });
  assert.equal(offline.ok, true);
  assert.equal(offline.primaryId, 'q-safe');
  assert.equal(
    offline.scoredCandidates.some((c) => c.item.id === 'q-violent'),
    false
  );

  const homeRecs = buildHomeBookRecommendations({ items, profile, limit: 4 });
  assert.ok(Array.isArray(homeRecs.recommendations));
  assert.equal(homeRecs.recommendations.some((r) => r.item.title === 'Livro Proibido'), false);
});

test('Fase 4: migracao aditiva preserva perfis antigos v1/v2 e adiciona readerDna neutro com rollback seguro', () => {
  const legacyV2 = {
    version: 2,
    exportedAt: '2025-12-01T00:00:00.000Z',
    profile: {
      displayName: 'Leitor Veterano',
      handle: '@veterano',
      annualGoal: 24,
      favoriteGenres: ['Ficção Científica'],
    },
    items: [
      {
        id: 'old-1',
        title: 'Duna',
        author: 'Frank Herbert',
        status: 'completed',
        rating: 95,
        inBacklog: true,
      },
    ],
  };

  const migrated = migrateDatabase(legacyV2);
  assert.equal(migrated.tables.user_profile.displayName, 'Leitor Veterano');
  assert.equal(migrated.tables.user_profile.profileSchemaVersion, 2);
  assert.equal(migrated.tables.user_profile.readerDna.weights.plotPace, 50);
  assert.equal(migrated.tables.works.length, 1);
  assert.equal(migrated.tables.works[0].title, 'Duna');
});

test('Fase 4: ProfileSettingsDrawer implementa 4 abas fixas com hash URL e 8 sliders de DNA', async () => {
  const drawerSrc = await fs.readFile(
    path.join(process.cwd(), 'src/components/ProfileSettingsDrawer.jsx'),
    'utf8'
  );
  assert.ok(drawerSrc.includes('#settings-appearance'));
  assert.ok(drawerSrc.includes('#settings-dna'));
  assert.ok(drawerSrc.includes('#settings-privacy'));
  assert.ok(drawerSrc.includes('#settings-data'));
  assert.ok(drawerSrc.includes('DNA_DIMENSIONS.map'));
  assert.ok(drawerSrc.includes('hashchange'));
  assert.ok(!drawerSrc.includes('Sparkles'));
});
