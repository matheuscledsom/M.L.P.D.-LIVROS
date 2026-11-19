import { domainConfig } from '../config/domainConfig.js';

export function getTodayLocalISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function diffCalendarDays(fromIso, toIso) {
  if (!fromIso || !toIso) return null;
  const fromMs = Date.parse(`${fromIso}T00:00:00`);
  const toMs = Date.parse(`${toIso}T00:00:00`);
  if (Number.isNaN(fromMs) || Number.isNaN(toMs)) return null;
  return Math.round((toMs - fromMs) / 86400000);
}

export function getStreakState(streakData, todayIso = getTodayLocalISO()) {
  const count = Math.max(0, Number(streakData?.count) || 0);
  const lastDate = streakData?.lastDate || null;

  if (!lastDate || count === 0) {
    return {
      effectiveCount: 0,
      status: 'idle',
      loggedToday: false,
      isPaused: false,
      diffDays: null,
    };
  }

  const diffDays = diffCalendarDays(lastDate, todayIso);
  if (diffDays === null || diffDays < 0) {
    return {
      effectiveCount: count,
      status: 'active',
      loggedToday: false,
      isPaused: false,
      diffDays: 0,
    };
  }

  if (diffDays === 0) {
    return {
      effectiveCount: count,
      status: 'logged_today',
      loggedToday: true,
      isPaused: false,
      diffDays: 0,
    };
  }

  if (diffDays === 1) {
    return {
      effectiveCount: count,
      status: 'active',
      loggedToday: false,
      isPaused: false,
      diffDays: 1,
    };
  }

  if (diffDays === 2) {
    return {
      effectiveCount: count,
      status: 'paused',
      loggedToday: false,
      isPaused: true,
      diffDays: 2,
    };
  }

  return {
    effectiveCount: 0,
    status: 'broken',
    loggedToday: false,
    isPaused: false,
    diffDays,
  };
}

export function calculatePageProgress(currentPage, totalPages) {
  const current = Math.max(0, Number(currentPage) || 0);
  const total = Number(totalPages) || 0;
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((current / total) * 100)));
}

export function calculateMangaProgress(
  currentChapter,
  totalChapters,
  currentVolume,
  totalVolumes
) {
  const chap = Math.max(0, Number(currentChapter) || 0);
  const totalChap = Number(totalChapters) || 0;
  if (totalChap > 0) {
    return Math.max(0, Math.min(100, Math.round((chap / totalChap) * 100)));
  }

  const vol = Math.max(0, Number(currentVolume) || 0);
  const totalVol = Number(totalVolumes) || 0;
  if (totalVol > 0) {
    return Math.max(0, Math.min(100, Math.round((vol / totalVol) * 100)));
  }

  return 0;
}

export function calculateAcademicFichamentoProgress(fichamentoSteps = {}) {
  const stages = domainConfig.fichamentoStages;
  if (!stages.length) return 0;
  const completedCount = stages.filter((stage) =>
    Boolean(fichamentoSteps?.[stage.id])
  ).length;
  return Math.round((completedCount / stages.length) * 100);
}

export function calculateWorkProgress(item) {
  if (!item) return 0;
  if (item.status === 'completed') return 100;

  if (item.workType === 'manga') {
    return calculateMangaProgress(
      item.currentChapter,
      item.totalChapters,
      item.currentVolume,
      item.totalVolumes
    );
  }

  if (item.workType === 'academic' && item.academicProgressMode === 'fichamento') {
    return calculateAcademicFichamentoProgress(item.fichamentoSteps);
  }

  return calculatePageProgress(item.currentPage, item.totalPages);
}

export function getPagesRead(item) {
  if (!item || item.workType === 'manga') return 0;
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
    label: `Concluído em ${days} ${days === 1 ? 'dia' : 'dias'} — média de ${avgPerDay} págs/dia`,
  };
}

function formatSingleAuthorAbnt(rawName) {
  const clean = String(rawName || '').trim();
  if (!clean) return '';
  if (clean.includes(',')) {
    const [surname, ...rest] = clean.split(',');
    return `${surname.trim().toUpperCase()}, ${rest.join(',').trim()}`;
  }
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].toUpperCase();
  const surname = parts[parts.length - 1].toUpperCase();
  const givenNames = parts.slice(0, -1).join(' ');
  return `${surname}, ${givenNames}`;
}

export function formatAbntReference(item) {
  if (!item) return '';

  const rawAuthors = String(item.author || '').trim();
  let authorBlock = '';

  if (rawAuthors) {
    const separator = rawAuthors.includes(';') ? ';' : ',';
    const list =
      separator === ',' && rawAuthors.split(',').length === 2 && !rawAuthors.includes(';')
        ? rawAuthors.split(',').map((s) => s.trim()).filter(Boolean)
        : rawAuthors.split(separator).map((s) => s.trim()).filter(Boolean);

    if (list.length > 3) {
      authorBlock = `${formatSingleAuthorAbnt(list[0])} et al.`;
    } else if (list.length > 0) {
      authorBlock = `${list.map(formatSingleAuthorAbnt).join('; ')}.`;
    }
  }

  const title = String(item.title || 'Obra sem título').trim();
  const venue = String(item.institution || item.publisher || '').trim();
  const year = item.releaseYear ? String(item.releaseYear) : 's.d.';
  const pages = Number(item.totalPages) > 0 ? `${item.totalPages} p.` : '';
  const isbn = item.isbn ? `ISBN ${item.isbn}.` : '';

  const segments = [
    authorBlock,
    `${title}.`,
    venue ? `${venue},` : '',
    `${year}.`,
    pages,
    isbn,
  ].filter(Boolean);

  return segments.join(' ').replace(/\s+/g, ' ').trim();
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

const LEGACY_VERDICT_MAP = {
  Bom: 'Muito Bom',
  Mediano: 'Regular',
  Decepção: 'Abaixo do Esperado',
};

export function getVerdictMeta(verdictId) {
  if (!verdictId) return null;
  const normalized = LEGACY_VERDICT_MAP[verdictId] || verdictId;
  return (
    domainConfig.tactileOptions.verdicts.find((v) => v.id === normalized) ?? null
  );
}

export function getHypeMeta(hypeId) {
  if (!hypeId) return null;
  return (
    domainConfig.tactileOptions.hypeLevels.find((h) => h.id === hypeId) ?? null
  );
}

export function getDropReasonMeta(reasonIdOrLabel) {
  if (!reasonIdOrLabel) return null;
  const clean = String(reasonIdOrLabel)
    .replace(/^[\p{Emoji}\u200d\ufe0f\s]+/u, '')
    .trim()
    .toLowerCase();
  return (
    domainConfig.tactileOptions.dropReasons.find(
      (r) =>
        r.id === reasonIdOrLabel ||
        r.label === reasonIdOrLabel ||
        r.id.toLowerCase() === clean
    ) ?? { id: reasonIdOrLabel, label: clean || String(reasonIdOrLabel), icon: 'Hourglass' }
  );
}
