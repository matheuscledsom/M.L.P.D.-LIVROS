import {
  getContrastRatio,
  getRelativeLuminance,
  mixHex,
  normalizeHex,
} from './themeTokens.js';

export const GLOBAL_READER_SETTINGS_KEY = 'codice_reader_global_settings_v1';

export const READER_THEMES = [
  {
    id: 'white',
    label: 'White',
    subtitle: 'Papel Branco Puro',
    bg: '#FFFFFF',
    surface: '#F7F7F7',
    ink: '#18181B',
    muted: '#52525B',
    border: '#E4E4E7',
    isLight: true,
    followApp: false,
  },
  {
    id: 'grey',
    label: 'Grey',
    subtitle: 'E-Ink Cinza Suave',
    bg: '#E5E5E0',
    surface: '#DCDCD6',
    ink: '#1C1917',
    muted: '#44403C',
    border: '#CFCFC8',
    isLight: true,
    followApp: false,
  },
  {
    id: 'oled',
    label: 'OLED',
    subtitle: 'Preto Absoluto',
    bg: '#000000',
    surface: '#0B0B0C',
    ink: '#E4E4E7',
    muted: '#A1A1AA',
    border: '#222226',
    isLight: false,
    followApp: false,
  },
  {
    id: 'sepia',
    label: 'Sépia',
    subtitle: 'Sépia Ajustável',
    bg: '#F4ECD8',
    surface: '#EBE1C8',
    ink: '#292117',
    muted: '#5C4C39',
    border: '#D6C7AA',
    isLight: true,
    adjustableWarmth: true,
    followApp: false,
  },
  {
    id: 'app',
    label: 'Tema do App',
    subtitle: 'Segue tema global',
    bg: 'var(--bg-app)',
    surface: 'var(--bg-card)',
    ink: 'var(--text-primary)',
    muted: 'var(--text-muted)',
    border: 'var(--border-subtle)',
    followApp: true,
  },
];

const SEPIA_STOPS = {
  cool: {
    bg: '#FAF5E8',
    surface: '#F2EBDC',
    ink: '#231E18',
    muted: '#594F43',
    border: '#DED5C3',
  },
  base: {
    bg: '#F4ECD8',
    surface: '#EBE1C8',
    ink: '#292117',
    muted: '#5C4C39',
    border: '#D6C7AA',
  },
  warm: {
    bg: '#EAD8B1',
    surface: '#DFCA9F',
    ink: '#291D10',
    muted: '#543E27',
    border: '#C9B288',
  },
};

export const HIGHLIGHT_COLORS = [
  {
    id: 'amber',
    label: 'Âmbar',
    swatch: '#C99A3B',
    epubFill: '#C99A3B',
    lightBg: 'rgba(201, 154, 59, 0.28)',
    darkBg: 'rgba(201, 154, 59, 0.22)',
  },
  {
    id: 'emerald',
    label: 'Esmeralda',
    swatch: '#3F916D',
    epubFill: '#3F916D',
    lightBg: 'rgba(63, 145, 109, 0.26)',
    darkBg: 'rgba(63, 145, 109, 0.20)',
  },
  {
    id: 'cobalt',
    label: 'Azul Cobalto',
    swatch: '#4B78B8',
    epubFill: '#4B78B8',
    lightBg: 'rgba(75, 120, 184, 0.26)',
    darkBg: 'rgba(75, 120, 184, 0.22)',
  },
  {
    id: 'lilac',
    label: 'Lilás',
    swatch: '#8A6CB8',
    epubFill: '#8A6CB8',
    lightBg: 'rgba(138, 108, 184, 0.26)',
    darkBg: 'rgba(138, 108, 184, 0.22)',
  },
  {
    id: 'coral',
    label: 'Coral',
    swatch: '#C86A5B',
    epubFill: '#C86A5B',
    lightBg: 'rgba(200, 106, 91, 0.28)',
    darkBg: 'rgba(200, 106, 91, 0.22)',
  },
  {
    id: 'graphite',
    label: 'Grafite',
    swatch: '#71717A',
    epubFill: '#71717A',
    lightBg: 'rgba(113, 113, 122, 0.25)',
    darkBg: 'rgba(161, 161, 170, 0.22)',
  },
];

export function normalizeReaderThemeId(rawThemeId) {
  if (rawThemeId === 'paper') return 'white';
  if (rawThemeId === 'gray') return 'grey';
  if (rawThemeId === 'dark') return 'oled';
  if (
    rawThemeId === 'white' ||
    rawThemeId === 'grey' ||
    rawThemeId === 'oled' ||
    rawThemeId === 'sepia' ||
    rawThemeId === 'app'
  ) {
    return rawThemeId;
  }
  return 'app';
}

export function normalizeHighlightColorId(rawColorId) {
  if (rawColorId === 'accent') return 'lilac';
  if (rawColorId === 'rose') return 'coral';
  const match = HIGHLIGHT_COLORS.find((c) => c.id === rawColorId);
  return match ? match.id : 'amber';
}

export function getHighlightColorMeta(colorId) {
  const normalized = normalizeHighlightColorId(colorId);
  return HIGHLIGHT_COLORS.find((c) => c.id === normalized) || HIGHLIGHT_COLORS[0];
}

export function computeSepiaPalette(sepiaWarmth = 50) {
  const clamped = Math.max(0, Math.min(100, Number(sepiaWarmth) || 0));
  if (clamped <= 50) {
    const t = clamped / 50;
    return {
      bg: mixHex(SEPIA_STOPS.cool.bg, SEPIA_STOPS.base.bg, t),
      surface: mixHex(SEPIA_STOPS.cool.surface, SEPIA_STOPS.base.surface, t),
      ink: mixHex(SEPIA_STOPS.cool.ink, SEPIA_STOPS.base.ink, t),
      muted: mixHex(SEPIA_STOPS.cool.muted, SEPIA_STOPS.base.muted, t),
      border: mixHex(SEPIA_STOPS.cool.border, SEPIA_STOPS.base.border, t),
      isLight: true,
    };
  }
  const t = (clamped - 50) / 50;
  return {
    bg: mixHex(SEPIA_STOPS.base.bg, SEPIA_STOPS.warm.bg, t),
    surface: mixHex(SEPIA_STOPS.base.surface, SEPIA_STOPS.warm.surface, t),
    ink: mixHex(SEPIA_STOPS.base.ink, SEPIA_STOPS.warm.ink, t),
    muted: mixHex(SEPIA_STOPS.base.muted, SEPIA_STOPS.warm.muted, t),
    border: mixHex(SEPIA_STOPS.base.border, SEPIA_STOPS.warm.border, t),
    isLight: true,
  };
}

export function resolveReaderThemePalette(themeId = 'app', sepiaWarmth = 50) {
  const normalizedId = normalizeReaderThemeId(themeId);
  const found = READER_THEMES.find((t) => t.id === normalizedId) || READER_THEMES[4];
  if (normalizedId === 'sepia') {
    const dynamicSepia = computeSepiaPalette(sepiaWarmth);
    return {
      ...found,
      ...dynamicSepia,
    };
  }
  return found;
}

export function resolveAccessibleReaderAccent(appAccentHex, readerBgHex, isLightReader) {
  const cleanAccent = normalizeHex(appAccentHex) || '#8B5CF6';
  const cleanBg = normalizeHex(readerBgHex);
  if (!cleanBg) return cleanAccent;

  if (getContrastRatio(cleanAccent, cleanBg) >= 3.5) {
    return cleanAccent;
  }

  const extreme = isLightReader ? '#18181B' : '#FFFFFF';
  for (let step = 1; step <= 20; step += 1) {
    const candidate = mixHex(cleanAccent, extreme, step / 20);
    if (getContrastRatio(candidate, cleanBg) >= 4.5) {
      return candidate;
    }
  }
  return extreme;
}

export function resolveReaderDomColors(activeTheme) {
  if (!activeTheme?.followApp) {
    return {
      bg: activeTheme?.bg || '#FFFFFF',
      surface: activeTheme?.surface || '#F7F7F7',
      ink: activeTheme?.ink || '#18181B',
      muted: activeTheme?.muted || '#52525B',
      border: activeTheme?.border || '#E4E4E7',
      isLight: Boolean(activeTheme?.isLight),
    };
  }

  if (typeof document === 'undefined') {
    return {
      bg: '#000000',
      surface: '#0A0A0A',
      ink: '#FFFFFF',
      muted: '#B5B5BD',
      border: '#1F1F1F',
      isLight: false,
    };
  }

  const style = getComputedStyle(document.documentElement);
  const bg = normalizeHex(style.getPropertyValue('--bg-app').trim()) || '#000000';
  const surface = normalizeHex(style.getPropertyValue('--bg-card').trim()) || '#0A0A0A';
  const ink = normalizeHex(style.getPropertyValue('--text-primary').trim()) || '#FFFFFF';
  const muted = normalizeHex(style.getPropertyValue('--text-muted').trim()) || '#B5B5BD';
  const border =
    normalizeHex(style.getPropertyValue('--border-subtle').trim()) || '#1F1F1F';
  const isLight = getRelativeLuminance(bg) > 0.35;

  return { bg, surface, ink, muted, border, isLight };
}
