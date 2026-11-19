import { useEffect, useState } from 'react';

const THEME_STORAGE_KEY = 'mlpd_livros_theme';

export const THEME_MODES = [
  {
    id: 'light',
    label: 'Claro',
    previewBg: '#FFFFFF',
    previewCard: '#F4F4F5',
    vars: {
      '--bg-app': '#FFFFFF',
      '--bg-card': '#F4F4F5',
      '--bg-elevated': '#E4E4E7',
      '--border-subtle': '#E4E4E7',
      '--text-primary': '#09090B',
      '--text-muted': '#52525B',
      '--text-subtle': '#71717A',
    },
    isLight: true,
  },
  {
    id: 'dark',
    label: 'Escuro Padrão',
    previewBg: '#121212',
    previewCard: '#1E1E1E',
    vars: {
      '--bg-app': '#121212',
      '--bg-card': '#1E1E1E',
      '--bg-elevated': '#27272A',
      '--border-subtle': '#2E2E32',
      '--text-primary': '#FFFFFF',
      '--text-muted': '#A1A1AA',
      '--text-subtle': '#71717A',
    },
    isLight: false,
  },
  {
    id: 'oled',
    label: 'Preto OLED',
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

export const ACCENT_PRESETS = [
  { id: 'purple', label: 'Roxo Neon', color: '#8B5CF6', contrast: '#FFFFFF' },
  { id: 'playstation', label: 'Azul PlayStation', color: '#0070D1', contrast: '#FFFFFF' },
  { id: 'xbox', label: 'Verde Xbox/Steam', color: '#10B981', contrast: '#FFFFFF' },
  { id: 'nintendo', label: 'Vermelho Nintendo', color: '#E60012', contrast: '#FFFFFF' },
  { id: 'platinum', label: 'Dourado Platina', color: '#F59E0B', contrast: '#09090B' },
  { id: 'mono', label: 'Monocromático', color: '#FFFFFF', lightColor: '#18181B', contrast: '#09090B', lightContrast: '#FFFFFF' },
];

function loadSavedTheme() {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return { mode: 'oled', accent: 'purple' };
    const parsed = JSON.parse(raw);
    return {
      mode: THEME_MODES.some((m) => m.id === parsed?.mode) ? parsed.mode : 'oled',
      accent: ACCENT_PRESETS.some((a) => a.id === parsed?.accent) ? parsed.accent : 'purple',
    };
  } catch {
    return { mode: 'oled', accent: 'purple' };
  }
}

export function useTheme() {
  const [theme, setTheme] = useState(loadSavedTheme);

  useEffect(() => {
    const modeConfig =
      THEME_MODES.find((m) => m.id === theme.mode) ?? THEME_MODES[2];
    const accentConfig =
      ACCENT_PRESETS.find((a) => a.id === theme.accent) ?? ACCENT_PRESETS[0];

    const root = document.documentElement;
    Object.entries(modeConfig.vars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    const accentColor =
      modeConfig.isLight && accentConfig.lightColor
        ? accentConfig.lightColor
        : accentConfig.color;
    const accentContrast =
      modeConfig.isLight && accentConfig.lightContrast
        ? accentConfig.lightContrast
        : accentConfig.contrast;

    root.style.setProperty('--accent-color', accentColor);
    root.style.setProperty('--accent-contrast', accentContrast);
    root.classList.toggle('dark', !modeConfig.isLight);

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', modeConfig.vars['--bg-app']);
    }

    try {
      localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
    } catch {
      // Ignora erro de persistência
    }
  }, [theme]);

  const setMode = (mode) => setTheme((prev) => ({ ...prev, mode }));
  const setAccent = (accent) => setTheme((prev) => ({ ...prev, accent }));

  return {
    mode: theme.mode,
    accent: theme.accent,
    setMode,
    setAccent,
  };
}
