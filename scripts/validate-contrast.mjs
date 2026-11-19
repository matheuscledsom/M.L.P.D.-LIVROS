import {
  EDITORIAL_PRESETS,
  THEME_MODES,
  buildSurfaceVarsFromBg,
  getContrastForAccent,
  getContrastRatio,
} from '../src/utils/themeTokens.js';

const TEXT_MIN = 4.5;
const UI_MIN = 3.0;

const failures = [];

function checkThemeEntry(name, vars, accentHex) {
  const surfaces = [
    ['bg-app', vars['--bg-app']],
    ['bg-card', vars['--bg-card']],
    ['bg-elevated', vars['--bg-elevated']],
  ];

  const textVars = [
    ['--text-primary', vars['--text-primary']],
    ['--text-muted', vars['--text-muted']],
    ['--text-subtle', vars['--text-subtle']],
  ];

  surfaces.forEach(([surfName, surfHex]) => {
    textVars.forEach(([txtName, txtHex]) => {
      const ratio = getContrastRatio(txtHex, surfHex);
      if (ratio < TEXT_MIN) {
        failures.push(
          `${name}: ${txtName} (${txtHex}) sobre ${surfName} (${surfHex}) = ${ratio.toFixed(2)}:1 (< ${TEXT_MIN}:1)`
        );
      }
    });

    const accentUiRatio = getContrastRatio(accentHex, surfHex);
    if (accentUiRatio < UI_MIN) {
      failures.push(
        `${name}: --accent-color (${accentHex}) sobre ${surfName} (${surfHex}) = ${accentUiRatio.toFixed(2)}:1 (< ${UI_MIN}:1)`
      );
    }
  });

  const accentInk = getContrastForAccent(accentHex);
  const accentBtnRatio = getContrastRatio(accentInk, accentHex);
  if (accentBtnRatio < TEXT_MIN) {
    failures.push(
      `${name}: --accent-contrast (${accentInk}) sobre --accent-color (${accentHex}) = ${accentBtnRatio.toFixed(2)}:1 (< ${TEXT_MIN}:1)`
    );
  }
}

THEME_MODES.forEach((mode) => {
  checkThemeEntry(`Modo:${mode.id}`, mode.vars, '#8B5CF6');
});

EDITORIAL_PRESETS.forEach((preset) => {
  const surface = buildSurfaceVarsFromBg(preset.bg, preset.card);
  checkThemeEntry(`Preset:${preset.id}`, surface.vars, preset.accent);
});

if (failures.length > 0) {
  console.error('FALHAS DE CONTRASTE WCAG 2.2 AA:');
  failures.forEach((line) => console.error(` - ${line}`));
  process.exit(1);
}

console.log(
  `Contraste WCAG 2.2 AA aprovado em ${THEME_MODES.length} modos base e ${EDITORIAL_PRESETS.length} presets.`
);
