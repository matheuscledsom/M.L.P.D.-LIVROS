import { useEffect, useState } from 'react';
import {
  EDITORIAL_PRESETS,
  FONT_PRESETS,
  TEXTURE_OPTIONS,
  THEME_MODES,
  buildSurfaceVarsFromBg,
  getContrastForAccent,
  normalizeHex,
} from '../utils/themeTokens';
import {
  DEFAULT_THEME_STATE,
  PASTEL_SUBPALETTES,
  SPECIAL_THEMES,
  THEME_STORAGE_KEY,
  parseThemeStorage,
  resolveSpecialThemeConfig,
} from '../data/themePresets';

export {
  EDITORIAL_PRESETS,
  FONT_PRESETS,
  PASTEL_SUBPALETTES,
  SPECIAL_THEMES,
  TEXTURE_OPTIONS,
  THEME_MODES,
};

const SPECIAL_EXTRA_VARS = [
  '--pastel-base',
  '--pastel-card-1',
  '--pastel-card-2',
  '--pastel-card-3',
  '--pastel-card-4',
  '--pastel-card-5',
  '--pastel-pill-bg',
  '--pastel-pill-active',
  '--xp-header-blue',
  '--xp-header-highlight',
  '--xp-confirm-green',
  '--xp-confirm-deep',
  '--win7-glass',
  '--win7-glass-elevated',
  '--aero-cyan',
  '--aero-green',
  '--aero-green-deep',
];

function loadSavedTheme() {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    return parseThemeStorage(raw);
  } catch {
    return DEFAULT_THEME_STATE;
  }
}

export function useTheme() {
  const [theme, setTheme] = useState(loadSavedTheme);

  const modeConfig =
    THEME_MODES.find((m) => m.id === theme.mode) ?? THEME_MODES[2];
  const fontConfig =
    FONT_PRESETS.find((f) => f.id === theme.font) ?? FONT_PRESETS[0];

  const specialConfig = theme.specialThemeId
    ? resolveSpecialThemeConfig(
        theme.specialThemeId,
        theme.pastelSubpaletteId,
        theme.pastelCustomColor
      )
    : null;

  const surface = specialConfig
    ? { isLight: specialConfig.isLight, vars: specialConfig.vars }
    : theme.customBgColor
      ? buildSurfaceVarsFromBg(theme.customBgColor, theme.customCardColor)
      : { isLight: modeConfig.isLight, vars: modeConfig.vars };

  const activeBgColor = surface.vars['--bg-app'];
  const activeAccentColor = specialConfig
    ? specialConfig.accentColor
    : normalizeHex(theme.customAccentColor) || '#8B5CF6';
  const accentContrast = specialConfig
    ? specialConfig.accentContrast
    : getContrastForAccent(activeAccentColor);

  useEffect(() => {
    const root = document.documentElement;
    SPECIAL_EXTRA_VARS.forEach((prop) => {
      if (!(prop in surface.vars)) {
        root.style.removeProperty(prop);
      }
    });

    Object.entries(surface.vars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    if (specialConfig?.styleAttr) {
      root.setAttribute('data-theme-style', specialConfig.styleAttr);
    } else {
      root.removeAttribute('data-theme-style');
    }

    root.style.setProperty('--accent-color', activeAccentColor);
    root.style.setProperty('--accent-contrast', accentContrast);
    root.style.setProperty('--font-app', fontConfig.cssValue);
    root.classList.toggle('dark', !surface.isLight);

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', activeBgColor);
    }

    try {
      localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
    } catch {
      // Ignora erro de persistência
    }
  }, [
    theme,
    surface,
    specialConfig,
    activeBgColor,
    activeAccentColor,
    accentContrast,
    fontConfig,
  ]);

  const setMode = (mode) =>
    setTheme((prev) => ({
      ...prev,
      mode,
      presetId: null,
      specialThemeId: null,
      customBgColor: null,
      customCardColor: null,
    }));

  const setFont = (font) =>
    setTheme((prev) => ({
      ...prev,
      font,
    }));

  const setTexture = (texture) =>
    setTheme((prev) => ({
      ...prev,
      texture,
    }));

  const applyPreset = (presetId) => {
    const preset = EDITORIAL_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setTheme((prev) => ({
      ...prev,
      presetId: preset.id,
      specialThemeId: null,
      customBgColor: preset.bg,
      customCardColor: preset.card,
      customAccentColor: preset.accent,
    }));
  };

  const applySpecialTheme = (specialThemeId) => {
    const special = SPECIAL_THEMES.find((item) => item.id === specialThemeId);
    if (!special) return;
    setTheme((prev) => ({
      ...prev,
      specialThemeId: special.id,
      presetId: null,
    }));
  };

  const selectPastelSubpalette = (subpaletteId) => {
    const found = PASTEL_SUBPALETTES.find((item) => item.id === subpaletteId);
    if (!found) return;
    setTheme((prev) => ({
      ...prev,
      specialThemeId: 'pastel-glass',
      presetId: null,
      pastelSubpaletteId: found.id,
      pastelCustomColor: null,
    }));
  };

  const setPastelCustomColor = (hex) => {
    const valid = normalizeHex(hex);
    if (!valid) return;
    setTheme((prev) => ({
      ...prev,
      specialThemeId: 'pastel-glass',
      presetId: null,
      pastelCustomColor: valid,
    }));
  };

  const setCustomBgColor = (hex) => {
    const valid = normalizeHex(hex);
    if (!valid) return;
    setTheme((prev) => ({
      ...prev,
      presetId: null,
      specialThemeId: null,
      customBgColor: valid,
      customCardColor: null,
    }));
  };

  const setCustomAccentColor = (hex) => {
    const valid = normalizeHex(hex);
    if (!valid) return;
    setTheme((prev) => ({
      ...prev,
      presetId: null,
      specialThemeId: null,
      customAccentColor: valid,
    }));
  };

  const resetCustomColors = () =>
    setTheme((prev) => ({
      ...prev,
      mode: 'oled',
      texture: 'clean',
      presetId: null,
      specialThemeId: null,
      pastelSubpaletteId: 'lavender-rose',
      pastelCustomColor: null,
      customBgColor: null,
      customCardColor: null,
      customAccentColor: '#8B5CF6',
    }));

  return {
    mode: theme.mode,
    font: theme.font,
    texture: theme.texture,
    presetId: theme.presetId,
    specialThemeId: theme.specialThemeId,
    pastelSubpaletteId: theme.pastelSubpaletteId,
    pastelCustomColor:
      theme.pastelCustomColor ||
      PASTEL_SUBPALETTES.find((p) => p.id === theme.pastelSubpaletteId)
        ?.baseColor ||
      '#C084FC',
    bgColor: activeBgColor,
    accentColor: activeAccentColor,
    hasCustomBg: Boolean(theme.customBgColor) && !theme.specialThemeId,
    setMode,
    setFont,
    setTexture,
    applyPreset,
    applySpecialTheme,
    selectPastelSubpalette,
    setPastelCustomColor,
    setCustomBgColor,
    setCustomAccentColor,
    resetCustomColors,
  };
}
