import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  buildReadingHeatmap,
  computeHeatmapLevel,
  pickWeightedQueuedWork,
} from '../src/utils/readingCheckIn.js';

test('pickWeightedQueuedWork respeita exclusões do DNA e prioriza gêneros afinados', () => {
  const dna = {
    weights: {
      plotPace: 20,
      charactersPsychology: 20,
      writingStyle: 90,
      worldbuildingAtmosphere: 20,
      impactKnowledge: 95,
      tensionTwists: 10,
      artLayout: 10,
      rigorSources: 85,
    },
    pacingPreference: 'denso',
    densityPreference: 'curta',
    exclusions: ['Gore explícito'],
  };

  const items = [
    {
      id: 'excluded',
      title: 'Manual Gore',
      inBacklog: true,
      status: 'queued',
      contentWarnings: ['Gore explícito'],
      genres: ['Filosofia'],
      totalPages: 180,
    },
    {
      id: 'aligned',
      title: 'Ensaios de Filosofia & História',
      inBacklog: true,
      status: 'queued',
      genres: ['Filosofia', 'História', 'Ensaio'],
      totalPages: 180,
    },
    {
      id: 'neutral',
      title: 'Guia Aleatório',
      inBacklog: true,
      status: 'queued',
      genres: ['Culinária'],
      totalPages: 600,
    },
  ];

  // Verifica que obra excluída nunca entra quando há alternativas compatíveis
  for (const r of [0.01, 0.25, 0.5, 0.75, 0.99]) {
    const res = pickWeightedQueuedWork({
      items,
      readerDna: dna,
      rng: () => r,
    });
    assert.ok(res.picked);
    assert.notEqual(res.picked.id, 'excluded');
    assert.equal(res.poolCount, 2);
  }

  // Com peso maior em 'aligned', rng baixo sempre escolhe 'aligned' e informa motivo DNA
  const lowRng = pickWeightedQueuedWork({
    items,
    readerDna: dna,
    rng: () => 0.1,
  });
  assert.equal(lowRng.picked.id, 'aligned');
  assert.ok(lowRng.matchedReason.length > 0);
});

test('buildReadingHeatmap gera grade anual de 52 semanas e 5 níveis', () => {
  assert.equal(computeHeatmapLevel(0, 0), 0);
  assert.equal(computeHeatmapLevel(5, 1), 1);
  assert.equal(computeHeatmapLevel(18, 1), 2);
  assert.equal(computeHeatmapLevel(40, 1), 3);
  assert.equal(computeHeatmapLevel(80, 2), 4);

  const map = buildReadingHeatmap({
    weeks: 52,
    endDate: '2026-11-20',
    readingSessions: [
      { startedAt: '2026-11-20T10:00:00Z', pagesRead: 42 },
      { startedAt: '2026-11-18T10:00:00Z', pagesRead: 85 },
    ],
  });

  assert.equal(map.columns.length, 52);
  assert.equal(map.activeDays, 2);
  assert.equal(map.totalPages, 127);
  assert.equal(map.bestDay?.pages, 85);
});

test('integração Fase 12: SVG heatmap com padrões, +1 Cap e timer silencioso no leitor', () => {
  const hmSrc = fs.readFileSync(
    new URL('../src/components/ReadingHeatmapWidget.jsx', import.meta.url),
    'utf8'
  );
  const checkInSrc = fs.readFileSync(
    new URL('../src/components/QuickReadingCheckIn.jsx', import.meta.url),
    'utf8'
  );
  const toolbarSrc = fs.readFileSync(
    new URL('../src/components/reader/ReaderToolbar.jsx', import.meta.url),
    'utf8'
  );
  const appSrc = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

  assert.ok(hmSrc.includes('<pattern'));
  assert.ok(hmSrc.includes('role="gridcell"'));
  assert.ok(checkInSrc.includes('+1 Cap'));
  assert.ok(appSrc.includes('cleanChapters'));
  assert.ok(toolbarSrc.includes('formatFocusClock'));
  assert.ok(!toolbarSrc.includes('new Audio'));
});
