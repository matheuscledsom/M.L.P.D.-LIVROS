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

export function roundProgressPct(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return 0;
  const clamped = Math.max(0, Math.min(100, num));
  return Math.round(clamped * 10) / 10;
}

export function normalizeProgressMode(mode) {
  if (mode === 'percent' || mode === 'loc' || mode === 'pages') {
    return mode;
  }
  return 'pages';
}

export function calculatePageProgress(currentPage, totalPages) {
  const current = Math.max(0, Number(currentPage) || 0);
  const total = Number(totalPages) || 0;
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((current / total) * 100)));
}

export function calculatePercentProgress(progressPercent) {
  if (
    progressPercent === null ||
    progressPercent === undefined ||
    progressPercent === ''
  ) {
    return 0;
  }
  return roundProgressPct(progressPercent);
}

export function calculateLocProgress(locCurrent, locTotal) {
  const current = Math.max(0, Number(locCurrent) || 0);
  const total = Number(locTotal) || 0;
  if (total <= 0) return 0;
  return roundProgressPct((current / total) * 100);
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

  if (isSerializedWork(item)) {
    const chapCur = item.chapterCurrent ?? item.currentChapter;
    const chapTot = item.chapterTotal ?? item.totalChapters;
    const volCur = item.volumeCurrent ?? item.currentVolume;
    const volTot = item.volumeTotal ?? item.totalVolumes;
    return calculateMangaProgress(chapCur, chapTot, volCur, volTot);
  }

  if (item.workType === 'academic' && item.academicProgressMode === 'fichamento') {
    return calculateAcademicFichamentoProgress(item.fichamentoSteps);
  }

  const mode = normalizeProgressMode(item.progressMode);
  const hasExplicitPercent =
    item.progressPercent !== null &&
    item.progressPercent !== undefined &&
    item.progressPercent !== '' &&
    !Number.isNaN(Number(item.progressPercent));

  if (mode === 'percent') {
    if (hasExplicitPercent) {
      return calculatePercentProgress(item.progressPercent);
    }
    return calculatePageProgress(item.currentPage, item.totalPages);
  }

  if (mode === 'loc') {
    if (Number(item.locTotal) > 0) {
      return calculateLocProgress(item.locCurrent, item.locTotal);
    }
    if (hasExplicitPercent) {
      return calculatePercentProgress(item.progressPercent);
    }
    return calculatePageProgress(item.currentPage, item.totalPages);
  }

  if (Number(item.totalPages) > 0) {
    return calculatePageProgress(item.currentPage, item.totalPages);
  }
  if (hasExplicitPercent) {
    return calculatePercentProgress(item.progressPercent);
  }
  return 0;
}

export function buildProgressPatchForMode(item, { mode, currentPage, totalPages, progressPercent, locCurrent, locTotal }) {
  const nextMode = normalizeProgressMode(mode ?? item?.progressMode);
  const nextTotalPages =
    totalPages !== undefined ? totalPages : Number(item?.totalPages) || null;
  const totalPagesNum = Number(nextTotalPages) || 0;

  if (nextMode === 'percent') {
    const pct = calculatePercentProgress(
      progressPercent !== undefined ? progressPercent : calculateWorkProgress(item)
    );
    const nextCurrentPage =
      totalPagesNum > 0
        ? Math.round((pct / 100) * totalPagesNum)
        : Math.max(0, Number(item?.currentPage) || 0);
    return {
      progressMode: 'percent',
      progressPercent: pct,
      totalPages: nextTotalPages,
      currentPage: nextCurrentPage,
      progress: pct,
    };
  }

  if (nextMode === 'loc') {
    const curLoc = Math.max(
      0,
      Number(locCurrent !== undefined ? locCurrent : item?.locCurrent) || 0
    );
    const rawTotLoc = locTotal !== undefined ? locTotal : item?.locTotal;
    const totLoc =
      rawTotLoc !== null && rawTotLoc !== undefined && rawTotLoc !== '' && Number(rawTotLoc) > 0
        ? Math.round(Number(rawTotLoc))
        : null;
    const pct = totLoc ? calculateLocProgress(curLoc, totLoc) : calculatePercentProgress(item?.progressPercent);
    const nextCurrentPage =
      totalPagesNum > 0 && totLoc
        ? Math.round((pct / 100) * totalPagesNum)
        : Math.max(0, Number(item?.currentPage) || 0);
    return {
      progressMode: 'loc',
      locCurrent: curLoc,
      locTotal: totLoc,
      progressPercent: totLoc ? pct : item?.progressPercent ?? null,
      totalPages: nextTotalPages,
      currentPage: nextCurrentPage,
      progress: pct,
    };
  }

  const curPage = Math.max(
    0,
    Number(currentPage !== undefined ? currentPage : item?.currentPage) || 0
  );
  const pct =
    totalPagesNum > 0
      ? Math.round((Math.min(totalPagesNum, curPage) / totalPagesNum) * 1000) / 10
      : null;

  return {
    progressMode: 'pages',
    currentPage: curPage,
    totalPages: nextTotalPages,
    ...(pct !== null ? { progressPercent: pct } : {}),
    progress: totalPagesNum > 0 ? calculatePageProgress(curPage, totalPagesNum) : calculatePercentProgress(item?.progressPercent),
  };
}

export function formatFlexibleProgressMetric(item) {
  if (!item) return '0 págs';
  if (item.workType === 'manga') {
    return `Vol. ${item.currentVolume || 0} · Cap. ${item.currentChapter || 0}`;
  }
  if (item.workType === 'academic' && item.academicProgressMode === 'fichamento') {
    return `${calculateWorkProgress(item)}% fich.`;
  }

  const mode = normalizeProgressMode(item.progressMode);
  const pct = calculateWorkProgress(item);

  if (mode === 'loc') {
    const locCur = Math.max(0, Number(item.locCurrent) || 0);
    const locTot = Number(item.locTotal) || 0;
    return locTot > 0 ? `Loc ${locCur}/${locTot}` : `Loc ${locCur}`;
  }

  if (mode === 'percent' || (!(Number(item.totalPages) > 0) && item.progressPercent > 0)) {
    return Number(item.totalPages) > 0
      ? `${pct}% (${item.currentPage || 0}/${item.totalPages}p)`
      : `${pct}%`;
  }

  if (Number(item.totalPages) > 0) {
    return `${item.currentPage || 0}/${item.totalPages}p`;
  }
  return `${item.currentPage || 0} págs`;
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

export function getDisplayTitles(item, mode = 'bilingual') {
  const ptTitle = String(item?.title || '').trim();
  const origTitle = String(item?.originalTitle || '').trim();
  const hasDistinctOriginal =
    Boolean(origTitle) && origTitle.toLowerCase() !== ptTitle.toLowerCase();

  if (mode === 'original') {
    return {
      primary: origTitle || ptTitle,
      secondary: '',
    };
  }
  if (mode === 'pt') {
    return {
      primary: ptTitle || origTitle,
      secondary: '',
    };
  }
  return {
    primary: ptTitle || origTitle,
    secondary: hasDistinctOriginal ? origTitle : '',
  };
}

export function buildContinueReadingHub(items = [], storedReaderBooks = []) {
  const activeStatuses = new Set(['playing', 'reading']);
  const storedByWorkId = new Map();
  const storedByBookId = new Map();

  for (const sb of Array.isArray(storedReaderBooks) ? storedReaderBooks : []) {
    if (!sb) continue;
    if (sb.workId) storedByWorkId.set(String(sb.workId), sb);
    if (sb.bookId) storedByBookId.set(String(sb.bookId), sb);
  }

  const unified = [];
  const consumedWorkIds = new Set();
  const consumedBookIds = new Set();

  for (const item of Array.isArray(items) ? items : []) {
    if (!item || item.inBacklog === false || !activeStatuses.has(item.status)) {
      continue;
    }
    const workId = String(item.id);
    consumedWorkIds.add(workId);
    const storedBook =
      storedByWorkId.get(workId) ||
      (item.readerBookId ? storedByBookId.get(String(item.readerBookId)) : null) ||
      null;
    if (storedBook?.bookId) consumedBookIds.add(String(storedBook.bookId));
    const readerPos = item.readerState?.position || null;
    const pct =
      readerPos && typeof readerPos.progressPct === 'number'
        ? readerPos.progressPct
        : storedBook &&
            Number(storedBook.progressPct) > 0 &&
            !(Number(item.progress) > 0 || Number(item.progressPercent) > 0)
          ? storedBook.progressPct
          : calculateWorkProgress(item);
    const resolvedTotalPages =
      Number(item.totalPages || readerPos?.totalPages || storedBook?.totalPages) || 0;
    const resolvedCurrentPage =
      resolvedTotalPages > 0
        ? Math.max(
            0,
            Number(item.currentPage ?? readerPos?.page ?? storedBook?.currentPage) || 0
          )
        : 0;
    const workMs = Date.parse(item.updatedAt || item.createdAt || '') || 0;
    const storedMs = Date.parse(storedBook?.lastOpenedAt || storedBook?.savedAt || '') || 0;

    unified.push({
      id: workId,
      kind: 'work',
      work: item,
      storedBook,
      hasStoredFile: Boolean(storedBook),
      title: item.title,
      originalTitle: item.originalTitle || '',
      author: item.author || '',
      workType: item.workType || 'book',
      format: storedBook?.format ? storedBook.format.toUpperCase() : item.format || '',
      progressPct: Math.max(0, Math.min(100, Number(pct) || 0)),
      currentPage: resolvedCurrentPage,
      totalPages: resolvedTotalPages,
      metricLabel: formatFlexibleProgressMetric(item),
      lastActivityMs: Math.max(workMs, storedMs),
    });
  }

  for (const sb of Array.isArray(storedReaderBooks) ? storedReaderBooks : []) {
    if (!sb) continue;
    if (sb.workId && consumedWorkIds.has(String(sb.workId))) continue;
    if (sb.bookId && consumedBookIds.has(String(sb.bookId))) continue;
    if (sb.linkedWork && sb.linkedWork.status === 'completed') continue;

    const linkedWork = sb.linkedWork || null;
    const lastMs = Date.parse(sb.lastOpenedAt || sb.savedAt || '') || 0;
    const sbTotalPages = Number(linkedWork?.totalPages || sb.totalPages) || 0;
    const sbCurrentPage =
      sbTotalPages > 0
        ? Math.max(0, Number(linkedWork?.currentPage ?? sb.currentPage) || 0)
        : 0;
    unified.push({
      id: String(sb.bookId || sb.workId),
      kind: linkedWork ? 'work' : 'digital',
      work: linkedWork,
      storedBook: sb,
      hasStoredFile: true,
      title: linkedWork?.title || sb.title,
      originalTitle: linkedWork?.originalTitle || '',
      author: linkedWork?.author || sb.author || sb.fileName || '',
      workType: linkedWork?.workType || (sb.format === 'cbz' ? 'manga' : 'book'),
      format: String(sb.format || 'epub').toUpperCase(),
      progressPct: Math.max(0, Math.min(100, Number(sb.progressPct) || 0)),
      currentPage: sbCurrentPage,
      totalPages: sbTotalPages,
      metricLabel: `${Math.round((Number(sb.progressPct) || 0) * 10) / 10}% · ${sb.sizeLabel || 'Offline'}`,
      lastActivityMs: lastMs,
    });
  }

  unified.sort((a, b) => b.lastActivityMs - a.lastActivityMs);

  return {
    featured: unified[0] || null,
    others: unified.slice(1),
    all: unified,
  };
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

export const SERIALIZED_WORK_TYPES = new Set(['manga', 'light_novel', 'comic']);

export function isSerializedWork(item) {
  if (!item) return false;
  if (SERIALIZED_WORK_TYPES.has(item.workType)) return true;
  if (/light novel|hq|graphic novel/i.test(String(item.demographicOrigin || ''))) {
    return true;
  }
  return Boolean(Number(item.totalVolumes) > 0 || Number(item.volumeTotal) > 0);
}

export function normalizeOwnedVolumes(rawOwned) {
  if (!Array.isArray(rawOwned)) return [];
  const nums = rawOwned
    .map((v) => Number.parseInt(String(v), 10))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 9999);
  return Array.from(new Set(nums)).sort((a, b) => a - b);
}

export function syncSeriesProgressFields(raw = {}, isCompleted = false) {
  const cleanPos = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  };
  const cleanNonNeg = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
  };

  const totalVolumes = cleanPos(raw.volumeTotal ?? raw.totalVolumes);
  const rawVolCur = cleanNonNeg(raw.volumeCurrent ?? raw.currentVolume);
  const currentVolume = isCompleted && totalVolumes ? totalVolumes : rawVolCur;

  const totalChapters = cleanPos(raw.chapterTotal ?? raw.totalChapters);
  const rawChapCur = cleanNonNeg(raw.chapterCurrent ?? raw.currentChapter);
  const currentChapter = isCompleted && totalChapters ? totalChapters : rawChapCur;

  const ownedVolumes = normalizeOwnedVolumes(raw.ownedVolumes);

  return {
    currentVolume,
    volumeCurrent: currentVolume,
    totalVolumes,
    volumeTotal: totalVolumes,
    currentChapter,
    chapterCurrent: currentChapter,
    totalChapters,
    chapterTotal: totalChapters,
    ownedVolumes,
  };
}

export function normalizeTagsList(rawTags) {
  if (!Array.isArray(rawTags)) return [];
  return Array.from(
    new Set(
      rawTags
        .map((t) => String(t || '').trim().replace(/^#/, '').slice(0, 32))
        .filter(Boolean)
    )
  ).slice(0, 24);
}

export function isLoanOverdue(item, thresholdDays = 30) {
  if (!item?.loanedTo || !item?.loanedAt) return false;
  const diff = diffCalendarDays(String(item.loanedAt).slice(0, 10), getTodayLocalISO());
  return typeof diff === 'number' && diff >= thresholdDays;
}
