import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const { runWithViewTransition } = await import('../src/design/themeEngine.js');
const { resetFeatureFlags, setFeatureFlag } = await import('../src/config/flags.js');

test('Fase 2: 6 estilos especiais em index.css possuem arquitetura propria distinta e segura', async () => {
  const indexCss = await fs.readFile(path.join(process.cwd(), 'src/index.css'), 'utf8');

  assert.ok(indexCss.includes('glass-pastel') && indexCss.includes('blur(22px)'));
  assert.ok(indexCss.includes('win-xp') && indexCss.includes('repeating-linear-gradient'));
  assert.ok(indexCss.includes('win-7') && indexCss.includes('130deg'));
  assert.ok(indexCss.includes('frutiger-aero'));
  assert.ok(indexCss.includes('manga') && indexCss.includes('url(#ink-bleed)'));
  assert.ok(indexCss.includes('focus') && indexCss.includes('backdrop-filter: none'));
});

test('Fase 2: ThemeModal e ResponsiveSheet oferecem miniaturas reais, densidade/movimento e gestos', async () => {
  const rootDir = process.cwd();
  const sheetSrc = await fs.readFile(path.join(rootDir, 'src/components/ResponsiveSheet.jsx'), 'utf8');
  const modalSrc = await fs.readFile(path.join(rootDir, 'src/components/ThemeModal.jsx'), 'utf8');
  const homeSrc = await fs.readFile(path.join(rootDir, 'src/screens/HomeScreen.jsx'), 'utf8');
  const listSrc = await fs.readFile(path.join(rootDir, 'src/screens/ListScreen.jsx'), 'utf8');
  const drawerSrc = await fs.readFile(path.join(rootDir, 'src/components/ProfileSettingsDrawer.jsx'), 'utf8');

  assert.ok(sheetSrc.includes('92dvh'));
  assert.ok(sheetSrc.includes('onTouchStart') && sheetSrc.includes('onTouchEnd'));
  assert.ok(sheetSrc.includes("e.key === 'Escape'"));
  assert.ok(sheetSrc.includes('previousFocusRef'));

  assert.ok(modalSrc.includes('ResponsiveSheet'));
  assert.ok(modalSrc.includes('SpecialThemeMiniature'));
  assert.ok(modalSrc.includes('DENSITY_OPTIONS'));
  assert.ok(modalSrc.includes('MOTION_OPTIONS'));
  assert.ok(!modalSrc.includes('Sparkles'));

  assert.ok(homeSrc.includes('onOpenThemeStudio'));
  assert.ok(listSrc.includes('onOpenThemeStudio'));
  assert.ok(drawerSrc.includes('Temas & Aparência'));
  assert.ok(drawerSrc.indexOf('Temas & Aparência') < drawerSrc.indexOf('Sincronização em Tempo Real'));
});

test('Fase 2: runWithViewTransition respeita flag, movimento reduzido e fallback seguro', () => {
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
  resetFeatureFlags();

  const origDoc = globalThis.document;
  let calledVt = 0;
  let updated = 0;

  globalThis.document = {
    startViewTransition: (cb) => {
      calledVt += 1;
      cb();
    },
  };

  try {
    runWithViewTransition(() => {
      updated += 1;
    }, 'full');
    assert.equal(calledVt, 1);
    assert.equal(updated, 1);

    runWithViewTransition(() => {
      updated += 1;
    }, 'reduced');
    assert.equal(calledVt, 1, 'Movimento reduzido deve pular startViewTransition');
    assert.equal(updated, 2);

    setFeatureFlag('viewTransitions', false);
    runWithViewTransition(() => {
      updated += 1;
    }, 'full');
    assert.equal(calledVt, 1, 'Flag desativada deve usar fallback direto');
    assert.equal(updated, 3);
  } finally {
    resetFeatureFlags();
    globalThis.document = origDoc;
  }
});
