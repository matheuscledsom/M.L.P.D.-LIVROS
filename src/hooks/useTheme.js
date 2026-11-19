import { useEffect, useState } from 'react';

const THEME_STORAGE_KEY = 'mlpd_livros_theme';

function normalizeHex(hex) {
  if (typeof hex !== 'string') return null;
  const clean = hex.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(clean)) return clean.toUpperCase();
  if (/^#[0-9A-Fa-f]{3}$/.test(clean)) {
    const [, r, g, b] = clean;
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return null;
}

function hexToRgb(hex) {
  const valid = normalizeHex(hex) || '#000000';
  return {
    r: parseInt(valid.slice(1, 3), 16),
    g: parseInt(valid.slice(3, 5), 16),
    b: parseInt(valid.slice(5, 7), 16),
  };
}

function rgbToHex(r, g, b) {
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')}`.toUpperCase();
}

function mixHex(hexA, hexB, weightB = 0.5) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const w = Math.max(0, Math.min(1, weightB));
  return rgbToHex(
    a.r + (b.r - a.r) * w,
    a.g + (b.g - a.g) * w,
    a.b + (b.b - a.b) * w
  );
}

function getRelativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const linear = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function buildSurfaceVarsFromBg(bgHex, cardHexOverride = null) {
  const bg = normalizeHex(bgHex) || '#000000';
  const isLight = getRelativeLuminance(bg) > 0.42;

  const card =
    normalizeHex(cardHexOverride) ||
    (isLight ? mixHex(bg, '#000000', 0.05) : mixHex(bg, '#FFFFFF', 0.055));
  const elevated = isLight
    ? mixHex(bg, '#000000', 0.1)
    : mixHex(bg, '#FFFFFF', 0.11);
  const border = isLight
    ? mixHex(bg, '#000000', 0.13)
    : mixHex(bg, '#FFFFFF', 0.14);

  return {
    isLight,
    vars: {
      '--bg-app': bg,
      '--bg-card': card,
      '--bg-elevated': elevated,
      '--border-subtle': border,
      '--text-primary': isLight ? '#18181B' : '#F4F4F5',
      '--text-muted': isLight ? '#52525B' : '#A1A1AA',
      '--text-subtle': isLight ? '#71717A' : '#737373',
    },
  };
}

function getContrastForAccent(accentHex) {
  const hex = normalizeHex(accentHex) || '#8B5CF6';
  return getRelativeLuminance(hex) > 0.45 ? '#09090B' : '#FFFFFF';
}

export const THEME_MODES = [
  {
    id: 'parchment',
    label: 'Papel Pergaminho',
    previewBg: '#FAF8F5',
    previewCard: '#F0EDE6',
    vars: {
      '--bg-app': '#FAF8F5',
      '--bg-card': '#F0EDE6',
      '--bg-elevated': '#E5E0D5',
      '--border-subtle': '#DDD7C8',
      '--text-primary': '#1C1917',
      '--text-muted': '#57534E',
      '--text-subtle': '#78716C',
    },
    isLight: true,
  },
  {
    id: 'night_library',
    label: 'Biblioteca Noturna',
    previewBg: '#121316',
    previewCard: '#1B1D22',
    vars: {
      '--bg-app': '#121316',
      '--bg-card': '#1B1D22',
      '--bg-elevated': '#24272E',
      '--border-subtle': '#2E313A',
      '--text-primary': '#F4F4F5',
      '--text-muted': '#A1A1AA',
      '--text-subtle': '#71717A',
    },
    isLight: false,
  },
  {
    id: 'oled',
    label: 'Tinta OLED',
    previewBg: '#000000',
    previewCard: '#0A0A0A',
    vars: {
      '--bg-app': '#000000',
      '--bg-card': '#0A0A0A',
      '--bg-elevated': '#141414',
      '--border-subtle': '#1F1F1F',
      '--text-primary': '#FFFFFF',
      '--text-muted': '#A3A3A3',
      '--text-subtle': '#737373',
    },
    isLight: false,
  },
];

export const FONT_PRESETS = [
  {
    id: 'inter',
    label: 'Sans Moderna (Inter)',
    shortLabel: 'Inter',
    fontName: 'Inter',
    cssValue: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  {
    id: 'lora',
    label: 'Editorial / Livro (Lora)',
    shortLabel: 'Lora',
    fontName: 'Lora',
    cssValue: '"Lora", Georgia, serif',
  },
  {
    id: 'merriweather',
    label: 'Clássico Literário (Merriweather)',
    shortLabel: 'Merriweather',
    fontName: 'Merriweather',
    cssValue: '"Merriweather", Georgia, serif',
  },
  {
    id: 'crimson',
    label: 'Tipografia Acadêmica (Crimson Pro)',
    shortLabel: 'Crimson Pro',
    fontName: 'Crimson Pro',
    cssValue: '"Crimson Pro", Georgia, serif',
  },
  {
    id: 'space',
    label: 'Geométrica Moderna (Space Grotesk)',
    shortLabel: 'Space Grotesk',
    fontName: 'Space Grotesk',
    cssValue: '"Space Grotesk", -apple-system, sans-serif',
  },
  {
    id: 'jetbrains',
    label: 'Monospace / Fichamento (JetBrains Mono)',
    shortLabel: 'JetBrains Mono',
    fontName: 'JetBrains Mono',
    cssValue: '"JetBrains Mono", ui-monospace, monospace',
  },
];

export const TEXTURE_OPTIONS = [
  { id: 'clean', label: 'Limpo' },
  { id: 'paper', label: 'Grão de Papel' },
  { id: 'grid', label: 'Grade de Fichamento' },
  { id: 'glow', label: 'Brilho Sutil' },
];

export const EDITORIAL_PRESETS = [
  { id: 'kindle-paperwhite', label: 'Kindle Paperwhite', bg: '#FAF8F5', card: '#F0EDE6', accent: '#2B5B84' },
  { id: 'dark-academia', label: 'Dark Academia', bg: '#161310', card: '#211D18', accent: '#C89B54' },
  { id: 'fantasia-epica', label: 'Fantasia Épica', bg: '#12111A', card: '#1B1926', accent: '#A855F7' },
  { id: 'cyberpunk-scifi', label: 'Cyberpunk / Sci-Fi', bg: '#090B14', card: '#111524', accent: '#00E5FF' },
  { id: 'terror-gotico', label: 'Terror Gótico', bg: '#0D090B', card: '#181114', accent: '#DC2626' },
  { id: 'romance-classico', label: 'Romance Clássico', bg: '#FAF4F4', card: '#F1E6E8', accent: '#BE4B66' },
  { id: 'biblioteca-alexandria', label: 'Biblioteca de Alexandria', bg: '#1C1712', card: '#272019', accent: '#D97706' },
  { id: 'floresta-elfica', label: 'Floresta Élfica', bg: '#0E1612', card: '#15221B', accent: '#10B981' },
  { id: 'manga-ink', label: 'Mangá Ink', bg: '#000000', card: '#0A0A0A', accent: '#FFFFFF' },
  { id: 'minimalismo-nordico', label: 'Minimalismo Nórdico', bg: '#F4F6F8', card: '#E8ECEF', accent: '#334155' },
  { id: 'misterio-noir', label: 'Mistério Noir', bg: '#121316', card: '#1B1D22', accent: '#EAB308' },
  { id: 'poesia-crepusculo', label: 'Poesia Crepúsculo', bg: '#17121F', card: '#211A2C', accent: '#F472B6' },
  { id: 'cafe-chuva', label: 'Café & Chuva', bg: '#1B1614', card: '#261F1C', accent: '#D98254' },
  { id: 'arquivo-academico', label: 'Arquivo Acadêmico', bg: '#F6F7F4', card: '#EAECE6', accent: '#1D4ED8' },
  { id: 'solarized-pergaminho', label: 'Solarized Pergaminho', bg: '#FDF6E3', card: '#EEE8D5', accent: '#268BD2' },
  { id: 'veludo-real', label: 'Veludo Real', bg: '#140F1C', card: '#1E1729', accent: '#C084FC' },
  { id: 'shonen-jump', label: 'Shonen Jump', bg: '#111216', card: '#1A1C22', accent: '#F97316' },
  { id: 'tokyo-neon', label: 'Tokyo Neon', bg: '#0B0C14', card: '#141624', accent: '#EC4899' },
  { id: 'codice-medieval', label: 'Códice Medieval', bg: '#191410', card: '#241D17', accent: '#B45309' },
  { id: 'nordic-frost', label: 'Nordic Frost', bg: '#F1F5F9', card: '#E2E8F0', accent: '#0284C7' },
  { id: 'ouro-imperial', label: 'Ouro Imperial', bg: '#0C0B09', card: '#171511', accent: '#F59E0B' },
  { id: 'cafe-kyoto', label: 'Café Kyoto', bg: '#171412', card: '#211C19', accent: '#10B981' },
];

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
