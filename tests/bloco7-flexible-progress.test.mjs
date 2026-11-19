import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildProgressPatchForMode,
  calculateLocProgress,
  calculatePercentProgress,
  calculateWorkProgress,
  formatFlexibleProgressMetric,
  normalizeProgressMode,
} from '../src/utils/backlogHelpers.js';

test('normalizeProgressMode preserves pages, percent, and loc with pages fallback', () => {
  assert.equal(normalizeProgressMode('percent'), 'percent');
  assert.equal(normalizeProgressMode('loc'), 'loc');
  assert.equal(normalizeProgressMode('pages'), 'pages');
  assert.equal(normalizeProgressMode('invalid'), 'pages');
  assert.equal(normalizeProgressMode(undefined), 'pages');
});

test('calculateWorkProgress supports decimal percentage without totalPages and Kindle Loc', () => {
  assert.equal(calculatePercentProgress(34.5), 34.5);
  assert.equal(calculatePercentProgress(120), 100);
  assert.equal(calculatePercentProgress(-5), 0);

  assert.equal(
    calculateWorkProgress({
      status: 'playing',
      workType: 'book',
      progressMode: 'percent',
      progressPercent: 34.5,
      currentPage: 0,
      totalPages: null,
    }),
    34.5
  );

  assert.equal(calculateLocProgress(1200, 2400), 50);
  assert.equal(
    calculateWorkProgress({
      status: 'playing',
      workType: 'book',
      progressMode: 'loc',
      locCurrent: 600,
      locTotal: 2000,
    }),
    30
  );

  assert.equal(
    calculateWorkProgress({
      status: 'playing',
      workType: 'book',
      progressMode: 'pages',
      currentPage: 50,
      totalPages: 200,
    }),
    25
  );
});

test('buildProgressPatchForMode synchronizes currentPage proportionally when totalPages exists', () => {
  const withPages = buildProgressPatchForMode(
    { currentPage: 0, totalPages: 400, progressMode: 'pages' },
    { mode: 'percent', progressPercent: 34.5 }
  );
  assert.equal(withPages.progressMode, 'percent');
  assert.equal(withPages.progressPercent, 34.5);
  assert.equal(withPages.currentPage, 138);
  assert.equal(withPages.progress, 34.5);

  const withoutTotal = buildProgressPatchForMode(
    { currentPage: 12, totalPages: null, progressMode: 'pages' },
    { mode: 'percent', progressPercent: 62.5 }
  );
  assert.equal(withoutTotal.progressMode, 'percent');
  assert.equal(withoutTotal.progressPercent, 62.5);
  assert.equal(withoutTotal.totalPages, null);
  assert.equal(withoutTotal.currentPage, 12);

  const locPatch = buildProgressPatchForMode(
    { currentPage: 0, totalPages: 300, progressMode: 'pages' },
    { mode: 'loc', locCurrent: 1500, locTotal: 3000 }
  );
  assert.equal(locPatch.progressMode, 'loc');
  assert.equal(locPatch.locCurrent, 1500);
  assert.equal(locPatch.locTotal, 3000);
  assert.equal(locPatch.progressPercent, 50);
  assert.equal(locPatch.currentPage, 150);
});

test('formatFlexibleProgressMetric formats pages, percent without totalPages, and Loc cleanly', () => {
  assert.equal(
    formatFlexibleProgressMetric({
      status: 'playing',
      workType: 'book',
      progressMode: 'percent',
      progressPercent: 42.5,
      totalPages: null,
    }),
    '42.5%'
  );

  assert.equal(
    formatFlexibleProgressMetric({
      status: 'playing',
      workType: 'book',
      progressMode: 'loc',
      locCurrent: 840,
      locTotal: 2100,
    }),
    'Loc 840/2100'
  );

  assert.equal(
    formatFlexibleProgressMetric({
      status: 'playing',
      workType: 'book',
      progressMode: 'pages',
      currentPage: 120,
      totalPages: 240,
    }),
    '120/240p'
  );
});
