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

export {
  EDITORIAL_PRESETS,
  FONT_PRESETS,
  TEXTURE_OPTIONS,
  THEME_MODES,
};

const THEME_STORAGE_KEY = 'mlpd_livros_theme';

const DEFAULT_THEME = {
  mode: 'oled',
  font: 'inter',
  texture: 'clean',
  presetId: null,
  customBgColor: null,
  customCardColor: null,
  customAccentColor: '#8B5CF6',
};

function loadSavedTheme() {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return DEFAULT_THEME;
    const parsed = JSON.parse(raw);

    const mode = THEME_MODES.some((m) => m.id === parsed?.mode)
      ? parsed.mode
      : 'oled';
    const font = FONT_PRESETS.some((f) => f.id === parsed?.font)
      ? parsed.font
      : 'inter';
    const texture = TEXTURE_OPTIONS.some((t) => t.id === parsed?.texture)
      ? parsed.texture
      : 'clean';
    const presetId = EDITORIAL_PRESETS.some((p) => p.id === parsed?.presetId)
      ? parsed.presetId
      : null;

    return {
      mode,
      font,
      texture,
      presetId,
      customBgColor: normalizeHex(parsed?.customBgColor),
      customCardColor: normalizeHex(parsed?.customCardColor),
      customAccentColor:
        normalizeHex(parsed?.customAccentColor) || '#8B5CF6',
    };
  } catch {
    return DEFAULT_THEME;
  }
}

export function useTheme() {
  const [theme, setTheme] = useState(loadSavedTheme);

  const modeConfig =
    THEME_MODES.find((m) => m.id === theme.mode) ?? THEME_MODES[2];
  const fontConfig =
    FONT_PRESETS.find((f) => f.id === theme.font) ?? FONT_PRESETS[0];

  const surface = theme.customBgColor
    ? buildSurfaceVarsFromBg(theme.customBgColor, theme.customCardColor)
    : { isLight: modeConfig.isLight, vars: modeConfig.vars };

  const activeBgColor = surface.vars['--bg-app'];
  const activeAccentColor = normalizeHex(theme.customAccentColor) || '#8B5CF6';
  const accentContrast = getContrastForAccent(activeAccentColor);

  useEffect(() => {
    const root = document.documentElement;
    Object.entries(surface.vars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

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
  }, [theme, surface, activeBgColor, activeAccentColor, accentContrast, fontConfig]);

  const setMode = (mode) =>
    setTheme((prev) => ({
      ...prev,
      mode,
      presetId: null,
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
      customBgColor: preset.bg,
      customCardColor: preset.card,
      customAccentColor: preset.accent,
    }));
  };

  const setCustomBgColor = (hex) => {
    const valid = normalizeHex(hex);
    if (!valid) return;
    setTheme((prev) => ({
      ...prev,
      presetId: null,
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
      customAccentColor: valid,
    }));
  };

  const resetCustomColors = () =>
    setTheme((prev) => ({
      ...prev,
      mode: 'oled',
      texture: 'clean',
      presetId: null,
      customBgColor: null,
      customCardColor: null,
      customAccentColor: '#8B5CF6',
    }));

  return {
    mode: theme.mode,
    font: theme.font,
    texture: theme.texture,
    presetId: theme.presetId,
    bgColor: activeBgColor,
    accentColor: activeAccentColor,
    hasCustomBg: Boolean(theme.customBgColor),
    setMode,
    setFont,
    setTexture,
    applyPreset,
    setCustomBgColor,
    setCustomAccentColor,
    resetCustomColors,
  };
}
