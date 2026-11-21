import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  MOTION_TOKENS,
  prefersReducedMotion,
  runSafeViewTransition,
} from '../src/design/motion.js';
import { computePassportStamps } from '../src/utils/passportStamps.js';
import {
  isReaderPageChimeEnabled,
  playTactilePageChime,
} from '../src/utils/soundEffects.js';

test('motion.js respeita reduced motion e executa callback em ambiente headless', () => {
  assert.equal(prefersReducedMotion(), true);
  assert.equal(MOTION_TOKENS.fastMs, 150);

  let ran = false;
  runSafeViewTransition(() => {
    ran = true;
  }, 'reduced');
  assert.equal(ran, true);
});

test('computePassportStamps avalia conquistas reais de leitura e citações', () => {
  const stamps = computePassportStamps({
    items: [
      {
        id: '1',
        inBacklog: true,
        status: 'completed',
        totalPages: 420,
        genres: ['Romance', 'Clássico'],
        quotes: [{ id: 'q1', text: 'A' }, { id: 'q2', text: 'B' }],
      },
      {
        id: '2',
        inBacklog: true,
        status: 'completed',
        totalPages: 620,
        genres: ['Filosofia', 'História'],
        quotes: [{ id: 'q3', text: 'C' }],
      },
    ],
    posts: [],
    streakCount: 8,
  });

  const unlockedIds = stamps.filter((s) => s.unlocked).map((s) => s.id);
  assert.ok(unlockedIds.includes('first-codex'));
  assert.ok(unlockedIds.includes('genre-traveler'));
  assert.ok(unlockedIds.includes('scribe-ink'));
  assert.ok(unlockedIds.includes('alexandria-1000'));
  assert.ok(!unlockedIds.includes('bronze-shelf'));
});

test('soundEffects page chime é opt-in silencioso e seguro sem AudioContext', () => {
  assert.equal(isReaderPageChimeEnabled(), false);
  assert.doesNotThrow(() => playTactilePageChime());
});

test('integração Fase 14: Modo Calmo, Dias de Descanso, Passaporte SVG e SkeletonScreen', () => {
  const homeSrc = fs.readFileSync(new URL('../src/screens/HomeScreen.jsx', import.meta.url), 'utf8');
  const profileSrc = fs.readFileSync(
    new URL('../src/screens/ProfileScreen.jsx', import.meta.url),
    'utf8'
  );
  const drawerSrc = fs.readFileSync(
    new URL('../src/components/ProfileSettingsDrawer.jsx', import.meta.url),
    'utf8'
  );
  const streakSrc = fs.readFileSync(
    new URL('../src/hooks/useReadingStreak.js', import.meta.url),
    'utf8'
  );
  const appSrc = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const readerSettingsSrc = fs.readFileSync(
    new URL('../src/components/reader/ReaderSettings.jsx', import.meta.url),
    'utf8'
  );

  assert.ok(homeSrc.includes('calmMode'));
  assert.ok(profileSrc.includes('ReaderPassportWidget'));
  assert.ok(drawerSrc.includes('Modo Calmo'));
  assert.ok(streakSrc.includes('useRestDay'));
  assert.ok(appSrc.includes('SkeletonScreen'));
  assert.ok(readerSettingsSrc.includes('Som tátil de página'));
});
