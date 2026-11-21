import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const {
  DENSITY_OPTIONS,
  MOTION_OPTIONS,
  loadThemeEnginePrefs,
  resolveEffectiveMotion,
  saveThemeEnginePrefs,
} = await import('../src/design/themeEngine.js');

const {
  DEFAULT_FLAGS,
  isFlagEnabled,
  loadFeatureFlags,
  resetFeatureFlags,
  setFeatureFlag,
} = await import('../src/config/flags.js');

const { parseThemeStorage } = await import('../src/data/themePresets.js');

test('Fase 1: Design System v2 define tokens em 3 camadas, materiais, filtros SVG e script zero-flash', async () => {
  const rootDir = process.cwd();
  const tokensCss = await fs.readFile(path.join(rootDir, 'src/design/tokens.css'), 'utf8');
  const indexHtml = await fs.readFile(path.join(rootDir, 'index.html'), 'utf8');
  const mainJsx = await fs.readFile(path.join(rootDir, 'src/main.jsx'), 'utf8');
  const filtersJsx = await fs.readFile(path.join(rootDir, 'src/design/GraphicFilters.jsx'), 'utf8');

  assert.ok(tokensCss.includes('@layer tokens'));
  assert.ok(tokensCss.includes('--surface-base'));
  assert.ok(tokensCss.includes('--surface-elevated'));
  assert.ok(tokensCss.includes('--surface-glass'));
  assert.ok(tokensCss.includes('--surface-scrim'));
  assert.ok(tokensCss.includes('--border-hairline'));
  assert.ok(tokensCss.includes('--elev-1'));
  assert.ok(tokensCss.includes('--elev-5'));
  assert.ok(tokensCss.includes('--ease-spring'));
  assert.ok(tokensCss.includes('forced-colors: active'));

  for (const mat of ['.mat-glass', '.mat-paper', '.mat-luna', '.mat-aero', '.mat-ink', '.mat-dim']) {
    assert.ok(tokensCss.includes(mat), `Material ${mat} deve existir em tokens.css`);
  }

  assert.ok(filtersJsx.includes('id="paper-grain"'));
  assert.ok(filtersJsx.includes('id="ink-bleed"'));
  assert.ok(filtersJsx.includes('id="screentone"'));

  assert.ok(indexHtml.includes('mlpd_livros_theme'));
  assert.ok(indexHtml.includes('data-theme-style'));
  assert.ok(mainJsx.includes('@fontsource-variable/newsreader/wght.css'));
  assert.ok(mainJsx.includes('@fontsource-variable/source-sans-3/wght.css'));
});

test('Fase 1: ThemeEngine, Feature Flags e migracao retrocompativel de fonte Inter funcionam', () => {
  if (!globalThis.localStorage) {
    const store = new Map();
    globalThis.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear(),
    };
  }
  localStorage.clear();

  assert.equal(DENSITY_OPTIONS.length, 2);
  assert.equal(MOTION_OPTIONS.length, 3);
  saveThemeEnginePrefs({ density: 'compact', motion: 'reduced' });
  const loaded = loadThemeEnginePrefs();
  assert.equal(loaded.density, 'compact');
  assert.equal(loaded.motion, 'reduced');
  assert.equal(resolveEffectiveMotion('reduced'), 'reduced');

  const migratedFont = parseThemeStorage(JSON.stringify({ font: 'inter', mode: 'oled' }));
  assert.equal(migratedFont.font, 'source-sans');

  assert.equal(loadFeatureFlags().spineShelf, DEFAULT_FLAGS.spineShelf);
  setFeatureFlag('spineShelf', false);
  assert.equal(isFlagEnabled('spineShelf'), false);
  resetFeatureFlags();
  assert.equal(isFlagEnabled('spineShelf'), true);
});
