import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const {
  analyzeFranchises,
  buildMissingVolumeDraft,
  extractSeriesBaseInfo,
  fetchSeriesHintsFromApis,
} = await import('../src/services/franchiseEngine.js');

test('Fase 9: franchiseEngine detecta series por seriesName e titulo, calcula completude e missingVolumes', () => {
  const infoA = extractSeriesBaseInfo({ title: 'O Nome do Vento', seriesName: 'Crônica do Matador do Rei', seriesIndex: '1' });
  assert.equal(infoA.seriesName, 'Crônica do Matador do Rei');
  assert.equal(infoA.indexNumber, 1);

  const infoB = extractSeriesBaseInfo({ title: 'Berserk Vol. 3' });
  assert.equal(infoB.seriesName, 'Berserk');
  assert.equal(infoB.indexNumber, 3);

  const items = [
    { id: 'v1', title: 'Akira Vol. 1', workType: 'manga', status: 'completed', totalVolumes: 6, inBacklog: true, author: 'Katsuhiro Otomo' },
    { id: 'v3', title: 'Akira Vol. 3', workType: 'manga', status: 'queued', totalVolumes: 6, inBacklog: true, author: 'Katsuhiro Otomo' },
    { id: 'ln1', title: 'Monogatari — Tomo 1', seriesName: 'Monogatari', workType: 'light_novel', volumeTotal: 4, ownedVolumes: [1, 4], inBacklog: true },
  ];

  const franchises = analyzeFranchises(items);
  const akira = franchises.find((f) => f.name === 'Akira');
  assert.ok(akira);
  assert.equal(akira.totalVolumes, 6);
  assert.equal(akira.ownedCount, 2);
  assert.deepEqual(akira.missingVolumes, [2, 4, 5, 6]);
  assert.equal(akira.nextVolumeNumber, 2);
  assert.equal(akira.completionPct, 33);

  const mono = franchises.find((f) => f.name === 'Monogatari');
  assert.ok(mono);
  assert.deepEqual(mono.missingVolumes, [2, 3]);

  const draft = buildMissingVolumeDraft(akira, akira.nextVolumeNumber);
  assert.equal(draft.seriesName, 'Akira');
  assert.equal(draft.seriesIndex, '2');
  assert.equal(draft.author, 'Katsuhiro Otomo');
  assert.equal(draft.inBacklog, true);
});

test('Fase 9: fetchSeriesHintsFromApis degrada com seguranca se offline e HomeScreen exibe carrossel de Franquias', async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('Offline');
  };
  try {
    const hints = await fetchSeriesHintsFromApis('Duna');
    assert.equal(hints, null);
  } finally {
    globalThis.fetch = origFetch;
  }

  const rootDir = process.cwd();
  const homeSrc = await fs.readFile(path.join(rootDir, 'src/screens/HomeScreen.jsx'), 'utf8');
  const appSrc = await fs.readFile(path.join(rootDir, 'src/App.jsx'), 'utf8');
  assert.ok(homeSrc.includes('Franquias em Andamento'));
  assert.ok(homeSrc.includes('+ Catalogar Vol.'));
  assert.ok(appSrc.includes('onCatalogFranchiseVolume={handleAddItem}'));
});
