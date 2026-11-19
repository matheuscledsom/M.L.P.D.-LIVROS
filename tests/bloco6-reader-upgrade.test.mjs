import assert from 'node:assert/strict';
import test from 'node:test';

const {
  HIGHLIGHT_COLORS,
  READER_THEMES,
  computeSepiaPalette,
  getHighlightColorMeta,
  normalizeHighlightColorId,
  normalizeReaderThemeId,
  resolveAccessibleReaderAccent,
  resolveReaderThemePalette,
} = await import('../src/utils/readerThemes.js');

const { getContrastRatio } = await import('../src/utils/themeTokens.js');

const {
  computeTelemetryEstimate,
  formatExactPercent,
  normalizeReaderSettings,
  shouldShowRecapBanner,
} = await import('../src/components/reader/useReaderProgress.js');

const {
  extractLookupTerm,
  lookupReaderTerm,
} = await import('../src/services/dictionaryApi.js');

test('5 temas do leitor, sepia ajustavel 0..100 e acessibilidade WCAG AA', () => {
  assert.equal(READER_THEMES.length, 5);
  assert.deepEqual(
    READER_THEMES.map((t) => t.id),
    ['white', 'grey', 'oled', 'sepia', 'app']
  );

  assert.equal(normalizeReaderThemeId('paper'), 'white');
  assert.equal(normalizeReaderThemeId('gray'), 'grey');
  assert.equal(normalizeReaderThemeId('dark'), 'oled');

  const white = resolveReaderThemePalette('white');
  assert.equal(white.bg, '#FFFFFF');
  assert.equal(white.ink, '#18181B');

  const grey = resolveReaderThemePalette('grey');
  assert.equal(grey.bg, '#E5E5E0');
  assert.equal(grey.ink, '#1C1917');

  const oled = resolveReaderThemePalette('oled');
  assert.equal(oled.bg, '#000000');
  assert.equal(oled.ink, '#E4E4E7');

  const sepia50 = computeSepiaPalette(50);
  assert.equal(sepia50.bg, '#F4ECD8');

  const sepia0 = computeSepiaPalette(0);
  const sepia100 = computeSepiaPalette(100);
  assert.notEqual(sepia0.bg, sepia100.bg);
  assert.ok(getContrastRatio(sepia0.ink, sepia0.bg) >= 7);
  assert.ok(getContrastRatio(sepia100.ink, sepia100.bg) >= 7);
  assert.ok(getContrastRatio(sepia100.muted, sepia100.surface) >= 4.5);

  // Proteção caso accent do app seja branco (#FFFFFF) no leitor White (#FFFFFF)
  const safeAccent = resolveAccessibleReaderAccent('#FFFFFF', '#FFFFFF', true);
  assert.ok(getContrastRatio(safeAccent, '#FFFFFF') >= 4.5);

  const normSettings = normalizeReaderSettings({
    theme: 'paper',
    sepiaWarmth: 120,
    brightnessPct: 40,
    focusRuler: 1,
  });
  assert.equal(normSettings.theme, 'white');
  assert.equal(normSettings.sepiaWarmth, 100);
  assert.equal(normSettings.brightnessPct, 50);
  assert.equal(normSettings.focusRuler, true);
});

test('6 cores de marcacao dessaturadas e normalizacao de legados', () => {
  assert.equal(HIGHLIGHT_COLORS.length, 6);
  assert.deepEqual(
    HIGHLIGHT_COLORS.map((c) => c.id),
    ['amber', 'emerald', 'cobalt', 'lilac', 'coral', 'graphite']
  );

  assert.equal(normalizeHighlightColorId('accent'), 'lilac');
  assert.equal(normalizeHighlightColorId('rose'), 'coral');
  assert.equal(getHighlightColorMeta('cobalt').label, 'Azul Cobalto');
});

test('telemetria dual (% <-> paginas) e banner Onde Parei (>24h)', () => {
  assert.equal(formatExactPercent(42.54), '42.5%');

  const telemetry = computeTelemetryEstimate({
    position: {
      page: 148,
      totalPages: 347,
      chapterPage: 4,
      chapterTotalPages: 12,
      progressPct: 42.65,
    },
    activeSeconds: 300,
    startPosition: {
      page: 143,
      progressPct: 41.2,
    },
  });

  assert.equal(telemetry.percentText, '42.7%');
  assert.equal(telemetry.pagesText, '148 lidas · faltam 199 págs (de 347)');
  assert.ok(telemetry.chapterMinutesRemaining > 0);
  assert.ok(telemetry.bookMinutesRemaining > 0);
  assert.ok(telemetry.timeText.includes('para fim do capítulo'));
  assert.ok(telemetry.timeText.includes('restantes no livro'));

  const nowMinus25h = new Date(Date.now() - 25 * 3600 * 1000).toISOString();
  const nowMinus2h = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
  assert.equal(shouldShowRecapBanner(nowMinus25h, { page: 12, progressPct: 8 }), true);
  assert.equal(shouldShowRecapBanner(nowMinus2h, { page: 12, progressPct: 8 }), false);
  assert.equal(shouldShowRecapBanner(nowMinus25h, { page: 1, progressPct: 0 }), false);
});

test('lookupReaderTerm consulta Wikipedia/Dictionary API e trata modo offline', async () => {
  assert.equal(extractLookupTerm('  “epistemologia”,  '), 'epistemologia');

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const str = String(url);
    if (str.includes('wikipedia.org')) {
      return new Response(
        JSON.stringify({
          type: 'standard',
          title: 'Epistemologia',
          extract: 'Ramo da filosofia que estuda a natureza e os limites do conhecimento.',
          content_urls: { desktop: { page: 'https://pt.wikipedia.org/wiki/Epistemologia' } },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response('{}', { status: 404 });
  };

  try {
    const okRes = await lookupReaderTerm('epistemologia');
    assert.equal(okRes.ok, true);
    assert.equal(okRes.term, 'Epistemologia');
    assert.equal(okRes.sourceLabel, 'Wikipédia (PT)');
    assert.ok(okRes.definition.includes('conhecimento'));

    globalThis.fetch = async () => {
      throw new Error('offline');
    };
    const errRes = await lookupReaderTerm('epistemologia');
    assert.equal(errRes.ok, false);
    assert.ok(errRes.error.includes('offline'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
