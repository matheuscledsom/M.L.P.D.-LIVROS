import { buildPublicProfileLink, domainConfig } from '../config/domainConfig.js';
import {
  calculatePercentProgress,
  calculateSmartRating,
  calculateWorkProgress,
  getTodayLocalISO,
  getVerdictForScore,
  normalizeProgressMode,
} from '../utils/backlogHelpers.js';
import {
  normalizeFavoriteGenres,
  normalizePreferredCriteria,
} from '../utils/readerPreferences.js';

export const CODICE_SCHEMA_VERSION = '4.0-codice-sql';
export const CODICE_V3_SCHEMA_VERSION = '3.0-codice-sql';
export const CODICE_DB_STORAGE_KEY = 'codice_relational_db_v4';
export const CODICE_V3_STORAGE_KEY = 'codice_relational_db_v3';

export function createUuid() {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  const bytes = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function deterministicUuid(seedText) {
  const input = String(seedText || 'codice');
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  let h3 = 0x85ebca6b;
  let h4 = 0xc2b2ae35;

  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (code + i), 0x85ebca6b) >>> 0;
    h3 = Math.imul(h3 ^ (code * 31), 0xc2b2ae35) >>> 0;
    h4 = Math.imul(h4 ^ (code + 17), 0x27d4eb2f) >>> 0;
  }

  const hex = [h1, h2, h3, h4]
    .map((n) => n.toString(16).padStart(8, '0'))
    .join('');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function normalizePersonName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function splitPeopleNames(rawValue) {
  const clean = String(rawValue || '').trim();
  if (!clean) return [];
  if (clean.includes(';')) {
    return clean
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  const commaParts = clean
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (commaParts.length <= 1) return commaParts;
  // Se formato "Sobrenome, Nome" (primeiro bloco sem espaço e exatamente 2 partes), trata como 1 autor
  if (commaParts.length === 2 && !/\s/.test(commaParts[0])) {
    return [clean];
  }
  return commaParts;
}

function normalizeWorkType(value) {
  if (value === 'manga' || value === 'academic' || value === 'book') {
    return value;
  }
  return 'book';
}

function normalizeReviewCriteriaLegacy(criteria) {
  if (!criteria || typeof criteria !== 'object') return null;
  return {
    plot: Number(criteria.plot ?? criteria.gameplay ?? 80),
    characters: Number(criteria.characters ?? criteria.story ?? 80),
    writing: Number(criteria.writing ?? criteria.audiovisual ?? 80),
    impact: Number(criteria.impact ?? 80),
    ignoreCharacters: Boolean(criteria.ignoreCharacters ?? criteria.ignoreStory),
  };
}

function stripLeadingEmojis(value) {
  if (!value) return value;
  return String(value)
    .replace(/^[\p{Emoji}\u200d\ufe0f\s]+/u, '')
    .trim();
}

export function detectSchemaVersion(rawData) {
  if (!rawData) return 1;
  if (
    typeof rawData === 'object' &&
    !Array.isArray(rawData) &&
    rawData.tables &&
    typeof rawData.tables === 'object'
  ) {
    if (
      rawData.schemaVersion === CODICE_SCHEMA_VERSION ||
      Number(rawData.schemaNumericVersion) >= 4
    ) {
      return 4;
    }
    if (
      rawData.schemaVersion === CODICE_V3_SCHEMA_VERSION ||
      Number(rawData.schemaNumericVersion) === 3
    ) {
      return 3;
    }
  }
  if (
    typeof rawData === 'object' &&
    !Array.isArray(rawData) &&
    Array.isArray(rawData.items) &&
    (Number(rawData.version) >= 2 ||
      rawData.profile ||
      rawData.posts ||
      rawData.streak)
  ) {
    return 2;
  }
  return 1;
}

export function migrateV1ToV2(v1Raw) {
  const rawItems = Array.isArray(v1Raw)
    ? v1Raw
    : Array.isArray(v1Raw?.items)
      ? v1Raw.items
      : [];

  const nowIso = '2026-01-01T00:00:00.000Z';

  const normalizedItems = rawItems
    .filter((entry) => entry && typeof entry === 'object' && (entry.id || entry.title))
    .map((entry, idx) => {
      const id = String(entry.id || deterministicUuid(`v1-item-${idx}-${entry.title || ''}`));
      const author =
        typeof entry.author === 'string'
          ? entry.author
          : typeof entry.creator === 'string'
            ? entry.creator
            : '';
      const reviewCriteria = normalizeReviewCriteriaLegacy(entry.reviewCriteria);
      const hasExplicitRating =
        entry.rating !== undefined && entry.rating !== null && entry.rating !== '';
      const rating = hasExplicitRating
        ? Number(entry.rating)
        : reviewCriteria !== null
          ? calculateSmartRating(reviewCriteria)
          : null;

      return {
        ...entry,
        id,
        title: String(entry.title || 'Obra sem título'),
        author,
        workType: normalizeWorkType(entry.workType),
        status: entry.status || domainConfig.ui.add.defaultNewStatus,
        reviewCriteria,
        rating: Number.isNaN(rating) ? null : rating,
        verdict: entry.verdict || getVerdictForScore(rating),
        dropReason: entry.dropReason ? stripLeadingEmojis(entry.dropReason) : null,
        quotes: Array.isArray(entry.quotes) ? entry.quotes : [],
        genres: Array.isArray(entry.genres) ? entry.genres : [],
        atmosphere: Array.isArray(entry.atmosphere) ? entry.atmosphere : [],
        tropes: Array.isArray(entry.tropes) ? entry.tropes : [],
        createdAt: entry.createdAt || nowIso,
        updatedAt: entry.updatedAt || entry.createdAt || nowIso,
      };
    });

  return {
    version: 2,
    domain: domainConfig.domainKey,
    exportedAt: v1Raw?.exportedAt || nowIso,
    items: normalizedItems,
    profile: v1Raw?.profile || null,
    posts: Array.isArray(v1Raw?.posts) ? v1Raw.posts : [],
    streak: v1Raw?.streak || { count: 0, lastDate: null, history: [] },
    readingSessions: Array.isArray(v1Raw?.readingSessions) ? v1Raw.readingSessions : [],
  };
}

function normalizePrivacyLevel(value) {
  if (value === 'followers' || value === 'private' || value === 'public') {
    return value;
  }
  return 'public';
}

function buildDefaultUserProfile(profileData) {
  const { profile } = domainConfig.ui;
  const baseHandle = profileData?.handle || profile.handle;
  const publicLink = buildPublicProfileLink(baseHandle);

  const linkLabel =
    !profileData?.linkLabel || /^mlpd\.livros\//i.test(profileData.linkLabel)
      ? publicLink.label
      : profileData.linkLabel;
  const linkUrl =
    !profileData?.linkUrl || /^https?:\/\/mlpd\.livros\//i.test(profileData.linkUrl)
      ? publicLink.url
      : profileData.linkUrl;

  const nowIso = profileData?.updatedAt || profileData?.createdAt || new Date().toISOString();

  const rawPrivacy = profileData?.privacyLevel ?? profileData?.privacy_level;
  const rawAllowWall = profileData?.allowWallPosts ?? profileData?.allow_wall_posts;
  const rawAllowComments = profileData?.allowComments ?? profileData?.allow_comments;
  const rawAllowDms = profileData?.allowDms ?? profileData?.allow_dms;
  const rawGamification =
    profileData?.gamificationEnabled ?? profileData?.gamification_enabled;
  const rawTitleBadge =
    profileData?.activeTitleBadge ?? profileData?.active_title_badge;

  const preferredCriteria = normalizePreferredCriteria(
    profileData?.preferredCriteria ?? profileData?.preferred_criteria,
    profileData?.preferredCriterion ?? profileData?.preferred_criterion
  );

  return {
    id: profileData?.id || deterministicUuid('user_profile:primary'),
    displayName: profileData?.displayName ?? profileData?.display_name ?? profile.displayName,
    handle: baseHandle,
    avatarInitials:
      profileData?.avatarInitials ?? profileData?.avatar_initials ?? profile.avatarInitials,
    avatarUrl: profileData?.avatarUrl ?? profileData?.avatar_url ?? '',
    coverUrl: profileData?.coverUrl ?? profileData?.banner_url ?? '',
    bio:
      profileData?.bio !== undefined ? profileData.bio : profile.bio,
    linkLabel,
    linkUrl,
    age: profileData?.age || '',
    readerFocus: profileData?.readerFocus || 'Leitor Casual',
    annualGoal: Math.max(
      1,
      Number(profileData?.annualGoal ?? profileData?.annual_goal) || 12
    ),
    preferredFormat: profileData?.preferredFormat || 'Livro Físico',
    preferredCriteria,
    preferredCriterion: preferredCriteria.join(', '),
    preferredAtmosphere: profileData?.preferredAtmosphere || 'Tinta OLED',
    favoriteGenres: normalizeFavoriteGenres(profileData?.favoriteGenres),
    privacyLevel: normalizePrivacyLevel(rawPrivacy),
    allowWallPosts: rawAllowWall !== undefined ? Boolean(rawAllowWall) : true,
    allowComments: rawAllowComments !== undefined ? Boolean(rawAllowComments) : true,
    allowDms: rawAllowDms !== undefined ? Boolean(rawAllowDms) : true,
    gamificationEnabled: rawGamification !== undefined ? Boolean(rawGamification) : true,
    activeTitleBadge: typeof rawTitleBadge === 'string' ? rawTitleBadge : '',
    onboardingCompleted:
      profileData?.onboardingCompleted !== undefined
        ? Boolean(profileData.onboardingCompleted)
        : Boolean(profileData?.displayName && profileData.displayName !== profile.displayName),
    createdAt: profileData?.createdAt || nowIso,
    updatedAt: profileData?.updatedAt || nowIso,
  };
}

export function migrateV2ToV3(v2Data) {
  const items = Array.isArray(v2Data?.items) ? v2Data.items : [];
  const posts = Array.isArray(v2Data?.posts) ? v2Data.posts : [];
  const existingSessions = Array.isArray(v2Data?.readingSessions)
    ? v2Data.readingSessions
    : [];
  const fallbackNow = v2Data?.exportedAt || new Date().toISOString();

  const authorsByNorm = new Map();
  const authors = [];
  const work_authors = [];
  const works = [];
  const reviews = [];
  const quotes_notes = [];
  const reading_sessions = [];

  const ensureAuthor = (rawName, timestamp) => {
    const clean = String(rawName || '').trim();
    if (!clean) return null;
    const norm = normalizePersonName(clean);
    if (!norm) return null;
    if (authorsByNorm.has(norm)) {
      return authorsByNorm.get(norm);
    }
    const authorRow = {
      id: deterministicUuid(`author:${norm}`),
      name: clean,
      normalizedName: norm,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    authorsByNorm.set(norm, authorRow);
    authors.push(authorRow);
    return authorRow;
  };

  items.forEach((rawItem, idx) => {
    if (!rawItem || typeof rawItem !== 'object') return;
    const workId = String(
      rawItem.id || deterministicUuid(`work:${idx}:${rawItem.title || ''}`)
    );
    const createdAt = rawItem.createdAt || fallbackNow;
    const updatedAt = rawItem.updatedAt || createdAt;
    const workType = normalizeWorkType(rawItem.workType);
    const status = rawItem.status || domainConfig.ui.add.defaultNewStatus;

    const workRow = {
      id: workId,
      title: String(rawItem.title || 'Obra sem título'),
      workType,
      status,
      cdu_cdd: String(rawItem.cdu_cdd || '').trim(),
      cutter: String(rawItem.cutter || '').trim(),
      callNumber: String(rawItem.callNumber || '').trim(),
      isbn: String(rawItem.isbn || '').trim(),
      issn: String(rawItem.issn || '').trim(),
      doi: String(rawItem.doi || '').trim(),
      edition: String(rawItem.edition || '').trim(),
      publisher: String(rawItem.publisher || '').trim(),
      publicationPlace: String(rawItem.publicationPlace || '').trim(),
      publicationYear:
        rawItem.publicationYear ?? rawItem.releaseYear ?? null,
      language: String(rawItem.language || '').trim(),
      translator: String(rawItem.translator || '').trim(),
      advisor: String(rawItem.advisor || '').trim(),
      seriesName: String(rawItem.seriesName || '').trim(),
      seriesIndex: String(rawItem.seriesIndex || '').trim(),
      seriesVolume: String(rawItem.seriesVolume || '').trim(),
      physicalLocation: String(rawItem.physicalLocation || '').trim(),
      acquisitionType: String(rawItem.acquisitionType || '').trim(),
      conservationState: String(rawItem.conservationState || '').trim(),
      originalTitle: String(rawItem.originalTitle || '').trim(),
      loanedTo: String(rawItem.loanedTo || '').trim(),
      loanedAt: rawItem.loanedAt || null,
      format:
        rawItem.format ||
        (rawItem.access && rawItem.access !== 'Wishlist' ? rawItem.access : null) ||
        domainConfig.bookFormats[0],
      access: rawItem.access || null,
      progressMode: normalizeProgressMode(rawItem.progressMode),
      progressPercent:
        rawItem.progressPercent !== null &&
        rawItem.progressPercent !== undefined &&
        rawItem.progressPercent !== ''
          ? calculatePercentProgress(rawItem.progressPercent)
          : status === 'completed'
            ? 100
            : null,
      locCurrent: Math.max(0, Number(rawItem.locCurrent) || 0),
      locTotal: Number(rawItem.locTotal) > 0 ? Number(rawItem.locTotal) : null,
      currentPage: Math.max(0, Number(rawItem.currentPage) || 0),
      totalPages:
        Number(rawItem.totalPages) > 0 ? Number(rawItem.totalPages) : null,
      currentVolume: Math.max(0, Number(rawItem.currentVolume) || 0),
      totalVolumes:
        Number(rawItem.totalVolumes) > 0 ? Number(rawItem.totalVolumes) : null,
      currentChapter: Math.max(0, Number(rawItem.currentChapter) || 0),
      totalChapters:
        Number(rawItem.totalChapters) > 0 ? Number(rawItem.totalChapters) : null,
      demographicOrigin:
        rawItem.demographicOrigin || domainConfig.mangaOrigins[0],
      publicationStatus:
        rawItem.publicationStatus || domainConfig.mangaPubStatuses[0],
      academicProgressMode:
        rawItem.academicProgressMode === 'fichamento' ? 'fichamento' : 'pages',
      fichamentoSteps:
        rawItem.fichamentoSteps && typeof rawItem.fichamentoSteps === 'object'
          ? rawItem.fichamentoSteps
          : {},
      institution: String(rawItem.institution || '').trim(),
      keywords: String(rawItem.keywords || '').trim(),
      fichamento: String(rawItem.fichamento || '').trim(),
      abntReference: String(rawItem.abntReference || '').trim(),
      synopsis: String(rawItem.synopsis || '').trim(),
      genres: Array.isArray(rawItem.genres) ? rawItem.genres : [],
      primaryGenre: String(rawItem.primaryGenre || '').trim(),
      subgenres: Array.isArray(rawItem.subgenres) ? rawItem.subgenres : [],
      readerBookId: rawItem.readerBookId ? String(rawItem.readerBookId) : null,
      atmosphere: Array.isArray(rawItem.atmosphere) ? rawItem.atmosphere : [],
      tropes: Array.isArray(rawItem.tropes) ? rawItem.tropes : [],
      progress: calculateWorkProgress(rawItem),
      hype: rawItem.hype || null,
      checkpoint: String(rawItem.checkpoint || '').trim(),
      isPlatinum: Boolean(rawItem.isPlatinum),
      isFavorite: Boolean(rawItem.isFavorite),
      isWishlist: Boolean(rawItem.isWishlist || rawItem.access === 'Wishlist'),
      inBacklog: rawItem.inBacklog !== undefined ? Boolean(rawItem.inBacklog) : true,
      completionType: rawItem.completionType || null,
      dropReason: rawItem.dropReason ? stripLeadingEmojis(rawItem.dropReason) : null,
      startDate: rawItem.startDate || null,
      completedDate: rawItem.completedDate || null,
      completedYear:
        status === 'completed'
          ? Number(rawItem.completedDate?.slice(0, 4)) ||
            rawItem.completedYear ||
            domainConfig.currentYear
          : null,
      dropDate: rawItem.dropDate || null,
      coverUrl: rawItem.coverUrl || null,
      coverSources: Array.isArray(rawItem.coverSources)
        ? rawItem.coverSources.filter(Boolean)
        : rawItem.coverUrl
          ? [rawItem.coverUrl]
          : [],
      monogram: rawItem.monogram || '',
      readerState: rawItem.readerState || null,
      createdAt,
      updatedAt,
    };

    works.push(workRow);

    const addRoleLinks = (namesString, role) => {
      splitPeopleNames(namesString).forEach((personName, position) => {
        const authorRow = ensureAuthor(personName, createdAt);
        if (!authorRow) return;
        work_authors.push({
          id: deterministicUuid(`wa:${workId}:${authorRow.id}:${role}`),
          workId,
          authorId: authorRow.id,
          role,
          position,
          createdAt,
          updatedAt,
        });
      });
    };

    addRoleLinks(rawItem.author || rawItem.creator, 'autor');
    addRoleLinks(rawItem.translator, 'tradutor');
    addRoleLinks(rawItem.advisor, 'orientador');

    const normalizedCriteria = normalizeReviewCriteriaLegacy(rawItem.reviewCriteria);
    const hasReviewData =
      rawItem.rating !== null && rawItem.rating !== undefined ||
      normalizedCriteria !== null ||
      Boolean(rawItem.verdict) ||
      Boolean(rawItem.notes) ||
      rawItem.recommended !== undefined;

    if (hasReviewData) {
      const computedRating =
        normalizedCriteria && (rawItem.rating === null || rawItem.rating === undefined)
          ? calculateSmartRating(normalizedCriteria)
          : rawItem.rating !== null && rawItem.rating !== undefined
            ? Number(rawItem.rating)
            : null;
      const cleanRating =
        computedRating !== null && !Number.isNaN(computedRating)
          ? Math.max(0, Math.min(100, Math.round(computedRating)))
          : null;

      reviews.push({
        id: deterministicUuid(`review:${workId}`),
        workId,
        rating: cleanRating,
        verdict: rawItem.verdict || getVerdictForScore(cleanRating),
        recommended:
          rawItem.recommended !== undefined
            ? Boolean(rawItem.recommended)
            : Boolean(rawItem.isPlatinum || (cleanRating !== null && cleanRating >= 80)),
        reviewCriteria: normalizedCriteria,
        notes: String(rawItem.notes || ''),
        createdAt,
        updatedAt,
      });
    }

    if (Array.isArray(rawItem.quotes)) {
      rawItem.quotes.forEach((quote, qIdx) => {
        if (!quote || typeof quote !== 'object' || !quote.text) return;
        const qCreated = quote.createdAt || createdAt;
        quotes_notes.push({
          id: String(quote.id || deterministicUuid(`quote:${workId}:${qIdx}:${quote.text}`)),
          workId,
          text: String(quote.text),
          location: String(quote.location || ''),
          cfi: quote.cfi ? String(quote.cfi) : '',
          page: quote.page ?? null,
          sectionId: quote.sectionId ? String(quote.sectionId) : '',
          sectionIndex: typeof quote.sectionIndex === 'number' ? quote.sectionIndex : null,
          startOffset: typeof quote.startOffset === 'number' ? quote.startOffset : null,
          endOffset: typeof quote.endOffset === 'number' ? quote.endOffset : null,
          color: quote.color || 'amber',
          note: String(quote.note || ''),
          createdAt: qCreated,
          updatedAt: quote.updatedAt || qCreated,
        });
      });
    }
  });

  existingSessions.forEach((session, sIdx) => {
    if (!session || typeof session !== 'object') return;
    reading_sessions.push({
      id: String(session.id || deterministicUuid(`session:${sIdx}:${session.workId || ''}`)),
      workId: String(session.workId || ''),
      startedAt: session.startedAt || fallbackNow,
      endedAt: session.endedAt || fallbackNow,
      durationSeconds: Math.max(0, Number(session.durationSeconds) || 0),
      startPosition: session.startPosition || null,
      endPosition: session.endPosition || null,
      pagesRead: Math.max(0, Number(session.pagesRead) || 0),
      notes: String(session.notes || ''),
      createdAt: session.createdAt || session.startedAt || fallbackNow,
      updatedAt: session.updatedAt || session.endedAt || fallbackNow,
    });
  });

  const journal_entries = posts
    .filter((post) => post && typeof post === 'object')
    .map((post, pIdx) => {
      const createdAt = post.createdAt || fallbackNow;
      return {
        id: String(post.id || deterministicUuid(`post:${pIdx}:${post.title || ''}`)),
        workId: post.workId ?? post.itemId ?? null,
        itemTitle: String(post.itemTitle || ''),
        itemSnapshot: post.itemSnapshot || null,
        progressMarker: String(post.progressMarker || ''),
        title: String(post.title || ''),
        caption: String(post.caption || ''),
        media: Array.isArray(post.media) ? post.media : [],
        comments: Array.isArray(post.comments) ? post.comments : [],
        visibility: post.visibility || 'inherit',
        highlightColor: post.highlightColor || '',
        createdAt,
        updatedAt: post.updatedAt || createdAt,
      };
    });

  const user_profile = buildDefaultUserProfile(v2Data?.profile || null);

  return {
    schemaVersion: CODICE_V3_SCHEMA_VERSION,
    schemaNumericVersion: 3,
    domain: domainConfig.domainKey,
    exportedAt: v2Data?.exportedAt || fallbackNow,
    tables: {
      works,
      authors,
      work_authors,
      reading_sessions,
      reviews,
      quotes_notes,
      journal_entries,
      user_profile,
      follows: Array.isArray(v2Data?.follows) ? v2Data.follows : [],
      wall_posts: Array.isArray(v2Data?.wallPosts) ? v2Data.wallPosts : [],
      direct_messages: Array.isArray(v2Data?.directMessages)
        ? v2Data.directMessages
        : [],
    },
    metadata: {
      streak: v2Data?.streak || { count: 0, lastDate: null, history: [] },
    },
  };
}

function normalizeWorkRowV4(work = {}) {
  if (!work || typeof work !== 'object') return work;
  const status = work.status || domainConfig.ui.add.defaultNewStatus;
  const locTotal = Number(work.locTotal) > 0 ? Number(work.locTotal) : null;
  const locCurrent = Math.max(0, Number(work.locCurrent) || 0);
  const hasPct =
    work.progressPercent !== null &&
    work.progressPercent !== undefined &&
    work.progressPercent !== '';

  return {
    ...work,
    originalTitle: String(work.originalTitle || '').trim(),
    loanedTo: String(work.loanedTo || '').trim(),
    loanedAt: work.loanedAt || null,
    progressMode: normalizeProgressMode(work.progressMode),
    progressPercent: hasPct
      ? calculatePercentProgress(work.progressPercent)
      : status === 'completed'
        ? 100
        : null,
    locCurrent: status === 'completed' && locTotal ? locTotal : locCurrent,
    locTotal,
  };
}

export function migrateV3ToV4(v3Data) {
  const tables = v3Data?.tables || {};
  const fallbackNow = v3Data?.exportedAt || '2026-01-01T00:00:00.000Z';

  const rawWorks = Array.isArray(tables.works) ? tables.works : [];

  return {
    schemaVersion: CODICE_SCHEMA_VERSION,
    schemaNumericVersion: 4,
    domain: domainConfig.domainKey,
    exportedAt: v3Data?.exportedAt || fallbackNow,
    tables: {
      works: rawWorks.map(normalizeWorkRowV4),
      authors: Array.isArray(tables.authors) ? tables.authors : [],
      work_authors: Array.isArray(tables.work_authors) ? tables.work_authors : [],
      reading_sessions: Array.isArray(tables.reading_sessions)
        ? tables.reading_sessions
        : [],
      reviews: Array.isArray(tables.reviews) ? tables.reviews : [],
      quotes_notes: Array.isArray(tables.quotes_notes) ? tables.quotes_notes : [],
      journal_entries: Array.isArray(tables.journal_entries)
        ? tables.journal_entries
        : [],
      user_profile: buildDefaultUserProfile(tables.user_profile || null),
      follows: Array.isArray(tables.follows) ? tables.follows : [],
      wall_posts: Array.isArray(tables.wall_posts) ? tables.wall_posts : [],
      direct_messages: Array.isArray(tables.direct_messages)
        ? tables.direct_messages
        : [],
    },
    metadata: {
      streak: v3Data?.metadata?.streak || { count: 0, lastDate: null, history: [] },
    },
  };
}

export function migrateDatabase(rawData) {
  const detectedVersion = detectSchemaVersion(rawData);
  if (detectedVersion === 4 || detectedVersion === 3) {
    return migrateV3ToV4(rawData);
  }
  if (detectedVersion === 2) {
    return migrateV3ToV4(migrateV2ToV3(rawData));
  }
  const v2 = migrateV1ToV2(rawData);
  return migrateV3ToV4(migrateV2ToV3(v2));
}

export function validateReferentialIntegrity(db) {
  const tables = db?.tables || {};
  const workIds = new Set((tables.works || []).map((w) => w.id));
  const authorIds = new Set((tables.authors || []).map((a) => a.id));
  const orphans = [];

  (tables.work_authors || []).forEach((link) => {
    if (!workIds.has(link.workId)) {
      orphans.push({
        table: 'work_authors',
        recordId: link.id,
        foreignKey: 'workId',
        missingId: link.workId,
      });
    }
    if (!authorIds.has(link.authorId)) {
      orphans.push({
        table: 'work_authors',
        recordId: link.id,
        foreignKey: 'authorId',
        missingId: link.authorId,
      });
    }
  });

  (tables.reading_sessions || []).forEach((session) => {
    if (!workIds.has(session.workId)) {
      orphans.push({
        table: 'reading_sessions',
        recordId: session.id,
        foreignKey: 'workId',
        missingId: session.workId,
      });
    }
  });

  (tables.reviews || []).forEach((review) => {
    if (!workIds.has(review.workId)) {
      orphans.push({
        table: 'reviews',
        recordId: review.id,
        foreignKey: 'workId',
        missingId: review.workId,
      });
    }
  });

  (tables.quotes_notes || []).forEach((quote) => {
    if (!workIds.has(quote.workId)) {
      orphans.push({
        table: 'quotes_notes',
        recordId: quote.id,
        foreignKey: 'workId',
        missingId: quote.workId,
      });
    }
  });

  (tables.journal_entries || []).forEach((entry) => {
    if (entry.workId && !workIds.has(entry.workId)) {
      orphans.push({
        table: 'journal_entries',
        recordId: entry.id,
        foreignKey: 'workId',
        missingId: entry.workId,
      });
    }
  });

  return {
    valid: orphans.length === 0,
    orphanCount: orphans.length,
    orphans,
  };
}

export function buildCodiceDatabase({
  items = [],
  profile = null,
  posts = [],
  streak = null,
  readingSessions = [],
  follows = [],
  wallPosts = [],
  directMessages = [],
} = {}) {
  const v3 = migrateV2ToV3({
    version: 2,
    domain: domainConfig.domainKey,
    exportedAt: new Date().toISOString(),
    items,
    profile,
    posts,
    streak: streak || { count: 0, lastDate: null, history: [] },
    readingSessions,
    follows,
    wallPosts,
    directMessages,
  });
  return migrateV3ToV4(v3);
}

export function hydrateAppSnapshotFromDatabase(db) {
  const normalized = migrateV3ToV4(db);
  const {
    works,
    authors,
    work_authors,
    reading_sessions,
    reviews,
    quotes_notes,
    journal_entries,
    user_profile,
    follows,
    wall_posts,
    direct_messages,
  } = normalized.tables;

  const authorMap = new Map(authors.map((a) => [a.id, a]));
  const linksByWork = new Map();
  work_authors.forEach((link) => {
    if (!linksByWork.has(link.workId)) {
      linksByWork.set(link.workId, []);
    }
    linksByWork.get(link.workId).push(link);
  });

  const reviewByWork = new Map();
  reviews.forEach((review) => {
    reviewByWork.set(review.workId, review);
  });

  const quotesByWork = new Map();
  quotes_notes.forEach((quote) => {
    if (!quotesByWork.has(quote.workId)) {
      quotesByWork.set(quote.workId, []);
    }
    quotesByWork.get(quote.workId).push(quote);
  });

  const items = works.map((work) => {
    const links = (linksByWork.get(work.id) || []).slice().sort((a, b) => a.position - b.position);
    const getRoleNames = (role) =>
      links
        .filter((l) => l.role === role)
        .map((l) => authorMap.get(l.authorId)?.name)
        .filter(Boolean)
        .join(', ');

    const author = getRoleNames('autor');
    const translator = getRoleNames('tradutor') || work.translator || '';
    const advisor = getRoleNames('orientador') || work.advisor || '';
    const review = reviewByWork.get(work.id) || null;
    const workQuotes = quotesByWork.get(work.id) || [];

    return {
      ...work,
      releaseYear: work.publicationYear ?? null,
      author,
      translator,
      advisor,
      rating: review ? review.rating : null,
      verdict: review ? review.verdict : null,
      recommended: review ? Boolean(review.recommended) : false,
      reviewCriteria: review ? review.reviewCriteria : null,
      notes: review ? review.notes : '',
      quotes: workQuotes,
    };
  });

  const posts = journal_entries.map((entry) => ({
    ...entry,
    itemId: entry.workId || null,
  }));

  return {
    items,
    profile: user_profile,
    posts,
    streak: normalized.metadata?.streak || { count: 0, lastDate: null, history: [] },
    readingSessions: reading_sessions,
    follows: follows || [],
    wallPosts: wall_posts || [],
    directMessages: direct_messages || [],
  };
}

export function persistCodiceDatabase(db) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(CODICE_DB_STORAGE_KEY, JSON.stringify(db));
  } catch {
    // Ignora erro caso quota de storage esteja indisponível
  }
}

export function loadStoredCodiceDatabase() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw =
      localStorage.getItem(CODICE_DB_STORAGE_KEY) ||
      localStorage.getItem(CODICE_V3_STORAGE_KEY);
    if (!raw) return null;
    return migrateDatabase(JSON.parse(raw));
  } catch {
    return null;
  }
}

function escapeCsvCell(value) {
  const str = String(value ?? '');
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateCatalogCsv(db) {
  const { items } = hydrateAppSnapshotFromDatabase(db);
  const headers = [
    'ID',
    'Título',
    'Autores',
    'Tradutor',
    'Orientador',
    'Natureza',
    'Status',
    'CDD/CDU',
    'Cutter',
    'Chamada',
    'ISBN',
    'ISSN',
    'DOI',
    'Editora',
    'Local',
    'Ano',
    'Edição',
    'Idioma',
    'Série',
    'Volume',
    'Páginas Totais',
    'Página Atual',
    'Progresso (%)',
    'Nota',
    'Veredito',
    'Localização Física',
    'Aquisição',
    'Conservação',
    'Título Original',
    'Emprestado Para',
    'Modo de Progresso',
  ];

  const rows = items.map((item) => [
    item.id,
    item.title,
    item.author,
    item.translator,
    item.advisor,
    item.workType,
    item.status,
    item.cdu_cdd,
    item.cutter,
    item.callNumber,
    item.isbn,
    item.issn,
    item.doi,
    item.publisher || item.institution,
    item.publicationPlace,
    item.publicationYear ?? item.releaseYear ?? '',
    item.edition,
    item.language,
    item.seriesName || item.seriesVolume,
    item.seriesIndex,
    item.totalPages ?? '',
    item.currentPage ?? 0,
    item.progress ?? 0,
    item.rating ?? '',
    item.verdict ?? '',
    item.physicalLocation,
    item.acquisitionType,
    item.conservationState,
    item.originalTitle || '',
    item.loanedTo || '',
    item.progressMode || 'pages',
  ]);

  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ];

  // BOM UTF-8 (\uFEFF) para abertura correta no Excel
  return `\uFEFF${lines.join('\r\n')}`;
}

function escapeBibtexValue(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([&%$#_{}])/g, '\\$1')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}');
}

function makeUniqueBibtexKey(item, usedKeys) {
  const firstAuthor = String(item.author || 'anonimo')
    .split(/[;,]/)[0]
    .trim();
  const surnamePart = firstAuthor.includes(',')
    ? firstAuthor.split(',')[0]
    : firstAuthor.split(/\s+/).pop() || 'anonimo';
  const yearPart = String(item.publicationYear || item.releaseYear || 'sd');
  const firstWordTitle = String(item.title || 'obra')
    .trim()
    .split(/\s+/)[0] || 'obra';

  const cleanToken = (t) =>
    String(t || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');

  const baseKey =
    `${cleanToken(surnamePart) || 'autor'}${cleanToken(yearPart)}${cleanToken(firstWordTitle)}` ||
    'codice';

  let candidate = baseKey;
  let counter = 2;
  while (usedKeys.has(candidate)) {
    candidate = `${baseKey}_${counter}`;
    counter += 1;
  }
  usedKeys.add(candidate);
  return candidate;
}

export function generateBibtexString(db) {
  const { items } = hydrateAppSnapshotFromDatabase(db);
  const usedKeys = new Set();

  const entries = items.map((item) => {
    const key = makeUniqueBibtexKey(item, usedKeys);
    const hasJournalLikeMeta = Boolean(item.doi || item.issn);
    const entryType = hasJournalLikeMeta
      ? 'article'
      : item.workType === 'academic' && /tese|disserta|tcc/i.test(item.keywords || item.title || '')
        ? 'phdthesis'
        : 'book';

    const authorsFormatted = splitPeopleNames(item.author).join(' and ');
    const year = item.publicationYear || item.releaseYear || '';
    const publisherOrJournal = item.publisher || item.institution || '';

    const fields = [
      authorsFormatted ? ['author', authorsFormatted] : null,
      ['title', item.title || 'Sem título'],
      year ? ['year', String(year)] : null,
      entryType === 'article' && publisherOrJournal
        ? ['journal', publisherOrJournal]
        : null,
      entryType !== 'article' && publisherOrJournal
        ? [entryType === 'phdthesis' ? 'school' : 'publisher', publisherOrJournal]
        : null,
      item.publicationPlace ? ['address', item.publicationPlace] : null,
      item.edition ? ['edition', item.edition] : null,
      item.isbn ? ['isbn', item.isbn] : null,
      item.issn ? ['issn', item.issn] : null,
      item.doi ? ['doi', item.doi] : null,
      item.language ? ['language', item.language] : null,
      item.keywords ? ['keywords', item.keywords] : null,
      item.callNumber ? ['note', `Chamada: ${item.callNumber}`] : null,
    ].filter(Boolean);

    const formattedFields = fields
      .map(([field, val]) => `  ${field} = {${escapeBibtexValue(val)}}`)
      .join(',\n');

    return `@${entryType}{${key},\n${formattedFields}\n}`;
  });

  return entries.join('\n\n');
}

export function triggerFileDownload(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function parseAndValidateBackupText(rawText) {
  try {
    const parsed = JSON.parse(rawText);
    const detected = detectSchemaVersion(parsed);
    if (
      detected === 1 &&
      !Array.isArray(parsed) &&
      !Array.isArray(parsed?.items)
    ) {
      return { ok: false, error: domainConfig.ui.profile.backup.importError };
    }

    const db = migrateDatabase(parsed);
    const integrity = validateReferentialIntegrity(db);
    const snapshot = hydrateAppSnapshotFromDatabase(db);

    return {
      ok: true,
      detectedSchemaVersion: detected,
      db,
      integrity,
      count: snapshot.items.length,
      ...snapshot,
    };
  } catch {
    return { ok: false, error: domainConfig.ui.profile.backup.importError };
  }
}

export function exportDatabaseDownloads(db) {
  const stamp = getTodayLocalISO();
  return {
    json: () =>
      triggerFileDownload(
        JSON.stringify(db, null, 2),
        `codice-banco-relacional-${stamp}.json`,
        'application/json;charset=utf-8'
      ),
    csv: () =>
      triggerFileDownload(
        generateCatalogCsv(db),
        `codice-catalogo-${stamp}.csv`,
        'text/csv;charset=utf-8'
      ),
    bib: () =>
      triggerFileDownload(
        generateBibtexString(db),
        `codice-referencias-${stamp}.bib`,
        'application/x-bibtex;charset=utf-8'
      ),
  };
}
