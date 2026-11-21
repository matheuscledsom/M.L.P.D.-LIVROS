import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const {
  extractDominantColor,
  hashFallbackPalette,
  pickReadableTextColor,
  relativeLuminance,
} = await import('../src/graphics/dominantColor.js');

const {
  buildGeneratedCoverDataUri,
  generateEditorialCoverSvg,
} = await import('../src/graphics/coverGenerator.js');

const { computeSpineMetrics } = await import('../src/graphics/spineMetrics.js');

test('Fase 3: dominantColor calcula luminosidade, garante contraste legivel e cai em fallback seguro sem CORS/DOM', async () => {
  const pal1 = hashFallbackPalette('dom-casmurro');
  const pal2 = hashFallbackPalette('dom-casmurro');
  assert.deepEqual(pal1, pal2);
  assert.equal(pal1.source, 'fallback');

  assert.ok(relativeLuminance('#FFFFFF') > relativeLuminance('#111111'));
  assert.equal(pickReadableTextColor('#FFFFFF'), '#181615');
  assert.equal(pickReadableTextColor('#101010'), '#FAF8F4');

  const safeColor = await extractDominantColor('https://example.com/capa.jpg', 'mem-test');
  assert.equal(safeColor.source, 'fallback');
  assert.ok(safeColor.bg.startsWith('#'));
});

test('Fase 3: coverGenerator gera SVG editorial deterministico, escapa XML e integra em CoverImage', async () => {
  const svgA = generateEditorialCoverSvg({
    title: 'Memórias <Póstumas> & Outros',
    author: 'Machado de Assis',
    workType: 'book',
  });
  const svgB = generateEditorialCoverSvg({
    title: 'Memórias <Póstumas> & Outros',
    author: 'Machado de Assis',
    workType: 'book',
  });

  assert.equal(svgA, svgB);
  assert.ok(svgA.includes('<svg'));
  assert.ok(!svgA.includes('<Póstumas>'));
  assert.ok(svgA.includes('&lt;Póstumas&gt; &amp; Outros'));

  const uri = buildGeneratedCoverDataUri({ title: 'Vagabond', workType: 'manga' });
  assert.ok(uri.startsWith('data:image/svg+xml;charset=utf-8,'));

  const coverImageSrc = await fs.readFile(path.join(process.cwd(), 'src/components/CoverImage.jsx'), 'utf8');
  assert.ok(coverImageSrc.includes("isFlagEnabled('generatedCovers')"));
  assert.ok(coverImageSrc.includes('buildGeneratedCoverDataUri'));
});

test('Fase 3: computeSpineMetrics escala largura e altura proporcionalmente ao volume da obra', () => {
  const thin = computeSpineMetrics({ id: 'thin', title: 'Conto', totalPages: 60 });
  const thick = computeSpineMetrics({ id: 'thick', title: 'Guerra e Paz', totalPages: 1400 });

  assert.ok(thin.width >= 32 && thin.width <= 60);
  assert.ok(thick.width >= thin.width);
  assert.ok(thick.width <= 60);
  assert.ok(thin.height >= 162 && thin.height <= 214);
});

test('Fase 3: ListScreen usa Estante Direta limpa sem widgets duplicados e oferece ResponsiveSheet + SpineRenderer', async () => {
  const rootDir = process.cwd();
  const listSrc = await fs.readFile(path.join(rootDir, 'src/screens/ListScreen.jsx'), 'utf8');
  const spineSrc = await fs.readFile(path.join(rootDir, 'src/graphics/SpineRenderer.jsx'), 'utf8');

  assert.ok(!listSrc.includes('<OracleWidget'));
  assert.ok(!listSrc.includes('<ReadingStreakWidget'));
  assert.ok(listSrc.includes('<ResponsiveSheet'));
  assert.ok(listSrc.includes('<SpineRenderer'));
  assert.ok(listSrc.includes("isFlagEnabled('spineShelf')"));
  assert.ok(spineSrc.includes("writingMode: 'vertical-rl'"));
  assert.ok(spineSrc.includes('onPointerDown'));
});
