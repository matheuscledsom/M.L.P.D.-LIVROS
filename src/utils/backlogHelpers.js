import { domainConfig } from '../config/domainConfig';

export function getTodayLocalISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function calculatePageProgress(currentPage, totalPages) {
  const current = Math.max(0, Number(currentPage) || 0);
  const total = Number(totalPages) || 0;
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((current / total) * 100)));
}

export function getPagesRead(item) {
  if (!item) return 0;
  if (item.status === 'completed') {
    return Math.max(0, Number(item.totalPages) || Number(item.currentPage) || 0);
  }
  if (item.status === 'queued') {
    return 0;
  }
  return Math.max(0, Number(item.currentPage) || 0);
}

export function getCompletionPace(startDate, completedDate, totalPages) {
  if (!startDate || !completedDate) return null;

  const startMs = Date.parse(`${startDate}T00:00:00`);
  const endMs = Date.parse(`${completedDate}T00:00:00`);
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) {
    return null;
  }

  const diffDays = Math.round((endMs - startMs) / 86400000);
  const days = Math.max(1, diffDays);
  const pages = Math.max(0, Number(totalPages) || 0);
  const avgPerDay = Math.round((pages / days) * 10) / 10;

  return {
    days,
    avgPerDay,
    label: `Lido em ${days} ${days === 1 ? 'dia' : 'dias'} — média de ${avgPerDay} págs/dia`,
  };
}

export function createDefaultReviewCriteria(baseScore = 80) {
  const score =
    typeof baseScore === 'number' && !Number.isNaN(baseScore)
      ? Math.max(0, Math.min(100, Math.round(baseScore)))
      : 80;

  return {
    plot: score,
    characters: score,
    writing: score,
    impact: score,
    ignoreCharacters: false,
  };
}

export function calculateSmartRating(reviewCriteria) {
  if (!reviewCriteria) return null;

  const ignoreCharacters = Boolean(
    reviewCriteria.ignoreCharacters ?? reviewCriteria.ignoreStory
  );
  const plot = Number(reviewCriteria.plot ?? reviewCriteria.gameplay ?? 0);
  const characters = Number(reviewCriteria.characters ?? reviewCriteria.story ?? 0);
  const writing = Number(reviewCriteria.writing ?? reviewCriteria.audiovisual ?? 0);
  const impact = Number(reviewCriteria.impact ?? 0);

  const values = [
    plot,
    ...(ignoreCharacters ? [] : [characters]),
    writing,
    impact,
  ];

  const sum = values.reduce((acc, v) => acc + v, 0);
  return Math.max(0, Math.min(100, Math.round(sum / values.length)));
}

export function getVerdictForScore(score) {
  if (score === null || score === undefined || Number.isNaN(Number(score))) {
    return null;
  }
  const numeric = Number(score);
  const matched = domainConfig.tactileOptions.verdicts.find(
    (verdict) => numeric >= verdict.minScore
  );
  return matched ? matched.id : null;
}

export function getVerdictMeta(verdictId) {
  if (!verdictId) return null;
  return (
    domainConfig.tactileOptions.verdicts.find((v) => v.id === verdictId) ?? null
  );
}

export function getHypeMeta(hypeId) {
  if (!hypeId) return null;
  return (
    domainConfig.tactileOptions.hypeLevels.find((h) => h.id === hypeId) ?? null
  );
}
