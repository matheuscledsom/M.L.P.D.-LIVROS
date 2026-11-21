import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const {
  EDITORIAL_PRESETS,
  THEME_MODES,
  getContrastForAccent,
  getContrastRatio,
} = await import('../src/utils/themeTokens.js');

const {
  DEFAULT_THEME_STATE,
  PASTEL_SUBPALETTES,
  SPECIAL_THEMES,
  buildPastelGlassTheme,
  parseThemeStorage,
  resolveSpecialThemeConfig,
} = await import('../src/data/themePresets.js');

async function walkFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(fullPath)));
    } else if (/\.(js|jsx|css)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

test('Bloco 1: preserva modos base e os 22 presets editoriais originais', () => {
  assert.equal(THEME_MODES.length, 3);
  assert.equal(EDITORIAL_PRESETS.length, 22);
});

test('Bloco 1: define os 6 estilos especiais com atributos data-theme-style distintos', () => {
  const expected = {
    'pastel-glass': 'glass-pastel',
    'windows-xp': 'win-xp',
    'windows-7': 'win-7',
    'frutiger-aero': 'frutiger-aero',
    'manga-ink': 'manga',
    'focus-dim': 'focus',
  };

  assert.equal(SPECIAL_THEMES.length, 6);
  for (const [id, styleAttr] of Object.entries(expected)) {
    const found = SPECIAL_THEMES.find((item) => item.id === id);
    assert.ok(found, `Tema especial ${id} deve existir`);
    assert.equal(found.styleAttr, styleAttr);
    assert.ok(found.vars['--bg-app']);
    assert.ok(found.vars['--text-primary']);
  }
});

test('Bloco 1: Pastel Glass possui 4 sub-paletas e recalcula cores livres com contraste AA', () => {
  assert.equal(PASTEL_SUBPALETTES.length, 4);

  for (const sub of PASTEL_SUBPALETTES) {
    const resolved = resolveSpecialThemeConfig('pastel-glass', sub.id, null);
    assert.equal(resolved.styleAttr, 'glass-pastel');
    assert.equal(resolved.pastelCards.length, 5);
    assert.equal(resolved.vars['--text-primary'], '#1E1B2E');
  }

  for (const sampleColor of ['#FFB3C6', '#38BDF8', '#FFFF00', '#000000']) {
    const built = buildPastelGlassTheme('lavender-rose', sampleColor);
    assert.equal(built.cards.length, 5);
    assert.equal(built.vars['--text-primary'], '#1E1B2E');

    for (const cardHex of built.cards) {
      assert.ok(
        getContrastRatio(built.vars['--text-primary'], cardHex) >= 4.5,
        `Texto primario sobre cartao ${cardHex} (base ${sampleColor}) deve ter >= 4.5:1`
      );
      assert.ok(
        getContrastRatio(built.accentColor, cardHex) >= 3.0,
        `Accent ${built.accentColor} sobre cartao ${cardHex} deve ter >= 3.0:1`
      );
    }

    const ink = getContrastForAccent(built.accentColor);
    assert.ok(
      getContrastRatio(ink, built.accentColor) >= 4.5,
      `Contraste do rotulo sobre accent ${built.accentColor} deve ser >= 4.5:1`
    );
  }
});

test('Bloco 1: retrocompatibilidade do localStorage de tema ao migrar dados antigos', () => {
  const realPresetId = EDITORIAL_PRESETS[0].id;
  const legacyJson = JSON.stringify({
    mode: 'parchment',
    font: 'literata',
    texture: 'paper',
    presetId: realPresetId,
    customBgColor: '#FAF8F5',
    customAccentColor: '#6D28D9',
  });

  const migrated = parseThemeStorage(legacyJson);
  assert.equal(migrated.mode, 'parchment');
  assert.equal(migrated.presetId, realPresetId);
  assert.equal(migrated.specialThemeId, null);
  assert.equal(migrated.pastelSubpaletteId, 'lavender-rose');
  assert.equal(migrated.pastelCustomColor, null);

  const savedSpecial = parseThemeStorage(
    JSON.stringify({
      ...DEFAULT_THEME_STATE,
      specialThemeId: 'pastel-glass',
      pastelSubpaletteId: 'mint-sky',
      pastelCustomColor: '#ff9ebb',
    })
  );
  assert.equal(savedSpecial.specialThemeId, 'pastel-glass');
  assert.equal(savedSpecial.pastelSubpaletteId, 'mint-sky');
  assert.equal(savedSpecial.pastelCustomColor, '#FF9EBB');
});

test('Bloco 1: CSS e UI contemplam os 6 estilos especiais, seletor pastel e zero emojis em src/', async () => {
  const rootDir = process.cwd();
  const css = await fs.readFile(path.join(rootDir, 'src/index.css'), 'utf8');
  const hookCode = await fs.readFile(path.join(rootDir, 'src/hooks/useTheme.js'), 'utf8');
  const engineCode = await fs.readFile(path.join(rootDir, 'src/design/themeEngine.js'), 'utf8');
  const themeLayerCode = `${hookCode}\n${engineCode}`;
  const modalCode = await fs.readFile(path.join(rootDir, 'src/components/ThemeModal.jsx'), 'utf8');
  const drawerCode = await fs.readFile(path.join(rootDir, 'src/components/ProfileSettingsDrawer.jsx'), 'utf8');

  for (const attr of ['glass-pastel', 'win-xp', 'win-7', 'frutiger-aero', 'manga', 'focus']) {
    assert.ok(css.includes(`[data-theme-style="${attr}"]`), `CSS precisa conter [data-theme-style="${attr}"]`);
  }
  assert.ok(css.includes('backdrop-filter: blur(16px)'));
  assert.ok(css.includes('backdrop-filter: blur(14px)'));
  assert.ok(css.includes('radial-gradient('));
  assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'));

  assert.ok(themeLayerCode.includes("setAttribute('data-theme-style'"));
  assert.ok(themeLayerCode.includes("removeAttribute('data-theme-style')"));
  assert.ok(modalCode.includes('PastelPaletteCustomizer'));
  assert.ok(modalCode.includes('type="color"'));
  assert.ok(drawerCode.includes('PastelPaletteCustomizer'));

  const srcFiles = await walkFiles(path.join(rootDir, 'src'));
  const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  for (const file of srcFiles) {
    const content = await fs.readFile(file, 'utf8');
    assert.equal(
      emojiRegex.test(content),
      false,
      `Nenhum emoji permitido em src/: encontrado em ${path.relative(rootDir, file)}`
    );
  }
});
