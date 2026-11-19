import { catalogItems, initialItems } from '../data/mockData.js';

const GOOGLE_BOOKS_BASE_URL = 'https://www.googleapis.com/books/v1/volumes';
const OPEN_LIBRARY_BASE_URL = 'https://openlibrary.org/search.json';
const JIKAN_MANGA_BASE_URL = 'https://api.jikan.moe/v4/manga';
const CROSSREF_WORKS_URL = 'https://api.crossref.org/works';
const CROSSREF_POLITE_MAILTO = 'codice@projeto-codice.app';

const SEARCH_CACHE_KEY = 'codice_search_cache_v2';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 40;
const API_TIMEOUT_MS = 8000;

const memoryCache = new Map();
let cacheHydrated = false;

function hydrateMemoryCache() {
  if (cacheHydrated) return;
  cacheHydrated = true;
  try {
    if (typeof sessionStorage === 'undefined') return;
    const raw = sessionStorage.getItem(SEARCH_CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;

    const now = Date.now();
    parsed.forEach(([key, entry]) => {
      if (
        key &&
        entry &&
        Array.isArray(entry.results) &&
        now - Number(entry.timestamp || 0) < CACHE_TTL_MS
      ) {
        memoryCache.set(key, entry);
      }
    });
  } catch {
    // Ignora falha ao ler sessionStorage
  }
}

function persistMemoryCache() {
  try {
    if (typeof sessionStorage === 'undefined') return;
    const entries = Array.from(memoryCache.entries()).slice(-CACHE_MAX_ENTRIES);
    sessionStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify(entries));
  } catch {
    // Ignora erro de quota ou storage indisponível
  }
}

function makeCacheKey(query, filter) {
  return `${filter || 'all'}:${String(query || '').trim().toLowerCase()}`;
}

export function getCachedSearchMedia(query, filter = 'all') {
  hydrateMemoryCache();
  const key = makeCacheKey(query, filter);
  const entry = memoryCache.get(key);
  if (!entry) return null;

  if (Date.now() - Number(entry.timestamp || 0) >= CACHE_TTL_MS) {
    memoryCache.delete(key);
    persistMemoryCache();
    return null;
  }

  memoryCache.delete(key);
  memoryCache.set(key, entry);
  return entry;
}

function setCachedSearchMedia(query, filter, payload) {
  hydrateMemoryCache();
  const key = makeCacheKey(query, filter);
  if (memoryCache.has(key)) {
    memoryCache.delete(key);
  }
  while (memoryCache.size >= CACHE_MAX_ENTRIES) {
    const oldestKey = memoryCache.keys().next().value;
    if (!oldestKey) break;
    memoryCache.delete(oldestKey);
  }
  memoryCache.set(key, {
    ...payload,
    timestamp: Date.now(),
  });
  persistMemoryCache();
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripXmlTags(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getMonogram(title) {
  const words = String(title || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }
  return String(title || 'OB').slice(0, 2).toUpperCase();
}

function cleanCoverUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  return rawUrl
    .trim()
    .replace(/^http:\/\//i, 'https://')
    .replace(/&edge=curl/gi, '')
    .replace(/\?edge=curl&?/gi, '?')
    .replace(/\?$/, '');
}

function buildOpenLibraryIsbnCover(isbn) {
  const clean = String(isbn || '').replace(/[-\s]/g, '').trim();
  if (!clean) return null;
  return `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(clean)}-L.jpg?default=false`;
}

function extractReleaseYear(publishedDate) {
  const match = String(publishedDate || '').trim().match(/^\d{4}/);
  return match ? Number(match[0]) : null;
}

export function detectIsbnQuery(query = '') {
  const clean = String(query).trim();
  if (!clean) return null;
  if (/^\d{10}$|^\d{13}$/.test(clean)) {
    return clean;
  }
  const digitsOnly = clean.replace(/[-\s]/g, '');
  if (
    /^[\d-\s]+$/.test(clean) &&
    (digitsOnly.length === 10 || digitsOnly.length === 13)
  ) {
    return digitsOnly;
  }
  return null;
}

export function detectDoiQuery(query = '') {
  const clean = String(query || '')
    .trim()
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '')
    .trim();
  if (!clean) return null;
  return /^10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+$/i.test(clean) ? clean : null;
}

function extractGoogleIsbn(industryIdentifiers) {
  if (!Array.isArray(industryIdentifiers)) return '';
  const isbn13 = industryIdentifiers.find(
    (item) => item?.type === 'ISBN_13'
  )?.identifier;
  if (isbn13) return isbn13;
  const isbn10 = industryIdentifiers.find(
    (item) => item?.type === 'ISBN_10'
  )?.identifier;
  return isbn10 || '';
}

function buildCoverCascade({ googleUrl = null, isbn = '', openLibIdUrl = null, jikanUrls = [] }) {
  const isbnUrl = buildOpenLibraryIsbnCover(isbn);
  return Array.from(
    new Set(
      [cleanCoverUrl(googleUrl), isbnUrl, cleanCoverUrl(openLibIdUrl), ...jikanUrls.map(cleanCoverUrl)]
        .filter(Boolean)
    )
  );
}

function mapGoogleBook(volume, defaultWorkType = 'book', isbnFallback = '') {
  const volumeInfo = volume?.volumeInfo || {};
  const title = volumeInfo.title || 'Sem título';
  const author = Array.isArray(volumeInfo.authors)
    ? volumeInfo.authors.filter(Boolean).join(', ')
    : '';
  const rawThumbnail =
    volumeInfo.imageLinks?.thumbnail ||
    volumeInfo.imageLinks?.smallThumbnail ||
    null;
  const isbn = extractGoogleIsbn(volumeInfo.industryIdentifiers) || isbnFallback;
  const coverSources = buildCoverCascade({ googleUrl: rawThumbnail, isbn });

  const totalPages =
    typeof volumeInfo.pageCount === 'number' && volumeInfo.pageCount > 0
      ? volumeInfo.pageCount
      : null;
  const genres = Array.isArray(volumeInfo.categories)
    ? volumeInfo.categories.filter(Boolean)
    : [];

  return {
    id: `gb-${String(volume.id)}`,
    title,
    author,
    coverUrl: coverSources[0] || null,
    coverSources,
    googleCoverUrl: cleanCoverUrl(rawThumbnail),
    openLibIsbnCover: buildOpenLibraryIsbnCover(isbn),
    openLibIdCover: null,
    jikanCoverUrls: [],
    releaseYear: extractReleaseYear(volumeInfo.publishedDate),
    totalPages,
    publisher: volumeInfo.publisher || '',
    institution: defaultWorkType === 'academic' ? volumeInfo.publisher || '' : '',
    isbn,
    doi: '',
    issn: '',
    genres,
    workType: defaultWorkType,
    sourceLabel: 'Google Books',
    monogram: getMonogram(title),
  };
}

function mapOpenLibraryDoc(doc, defaultWorkType = 'book', isbnFallback = '') {
  const title = doc?.title || 'Sem título';
  const rawKey = String(doc?.key || title).replace(/^\/works\//, '');
  const author = Array.isArray(doc?.author_name)
    ? doc.author_name.filter(Boolean).join(', ')
    : '';
  const isbn =
    Array.isArray(doc?.isbn) && doc.isbn.length
      ? doc.isbn.find((code) => /^\d{13}$/.test(code)) || doc.isbn[0]
      : isbnFallback;

  const openLibIdCover = doc?.cover_i
    ? `https://covers.openlibrary.org/b/id/${encodeURIComponent(String(doc.cover_i))}-L.jpg?default=false`
    : null;
  const coverSources = buildCoverCascade({ isbn, openLibIdUrl: openLibIdCover });

  const releaseYear =
    typeof doc?.first_publish_year === 'number' ? doc.first_publish_year : null;
  const totalPages =
    typeof doc?.number_of_pages_median === 'number' &&
    doc.number_of_pages_median > 0
      ? doc.number_of_pages_median
      : null;
  const publisher =
    Array.isArray(doc?.publisher) && doc.publisher.length ? doc.publisher[0] : '';
  const genres = Array.isArray(doc?.subject)
    ? doc.subject.filter(Boolean).slice(0, 3)
    : [];

  return {
    id: `ol-${rawKey}`,
    title,
    author,
    coverUrl: coverSources[0] || null,
    coverSources,
    googleCoverUrl: null,
    openLibIsbnCover: buildOpenLibraryIsbnCover(isbn),
    openLibIdCover,
    jikanCoverUrls: [],
    releaseYear,
    totalPages,
    publisher,
    institution: defaultWorkType === 'academic' ? publisher : '',
    isbn,
    doi: '',
    issn: '',
    genres,
    workType: defaultWorkType,
    sourceLabel: 'Open Library',
    monogram: getMonogram(title),
  };
}

function mapJikanOrigin(type) {
  const normalized = String(type || '').toLowerCase();
  if (normalized.includes('light novel') || normalized === 'novel') {
    return 'Light Novel';
  }
  if (normalized.includes('manhwa')) {
    return 'Manhwa';
  }
  return 'Mangá';
}

function mapJikanManga(entry) {
  const title = entry?.title || entry?.title_english || 'Sem título';
  const author = Array.isArray(entry?.authors)
    ? entry.authors.map((a) => a?.name).filter(Boolean).join(', ')
    : '';

  const jikanCoverUrls = [
    entry?.images?.webp?.large_image_url,
    entry?.images?.jpg?.large_image_url,
    entry?.images?.webp?.image_url,
    entry?.images?.jpg?.image_url,
  ]
    .map(cleanCoverUrl)
    .filter(Boolean);

  const coverSources = buildCoverCascade({ jikanUrls: jikanCoverUrls });

  const genres = Array.from(
    new Set(
      [
        ...(entry?.genres || []),
        ...(entry?.demographics || []),
        ...(entry?.themes || []),
      ]
        .map((g) => g?.name)
        .filter(Boolean)
    )
  ).slice(0, 4);

  return {
    id: `jikan-${entry.mal_id}`,
    title,
    author,
    coverUrl: coverSources[0] || null,
    coverSources,
    googleCoverUrl: null,
    openLibIsbnCover: null,
    openLibIdCover: null,
    jikanCoverUrls,
    releaseYear: extractReleaseYear(entry?.published?.from),
    totalVolumes:
      typeof entry?.volumes === 'number' && entry.volumes > 0
        ? entry.volumes
        : null,
    totalChapters:
      typeof entry?.chapters === 'number' && entry.chapters > 0
        ? entry.chapters
        : null,
    totalPages: null,
    demographicOrigin: mapJikanOrigin(entry?.type),
    publicationStatus:
      entry?.status === 'Finished' ? 'Completo' : 'Em lançamento',
    isbn: '',
    doi: '',
    issn: '',
    genres,
    workType: 'manga',
    sourceLabel: 'Jikan',
    monogram: getMonogram(title),
  };
}

function parseCrossRefPageCount(pageSpec) {
  const match = String(pageSpec || '').match(/^(\d+)\s*[-–]\s*(\d+)$/);
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  const diff = end - start + 1;
  return diff > 0 && diff < 5000 ? diff : null;
}

function mapCrossRefWork(entry) {
  const rawTitle = Array.isArray(entry?.title)
    ? entry.title[0]
    : entry?.title || 'Sem título';
  const title = stripXmlTags(rawTitle) || 'Sem título';
  const author = Array.isArray(entry?.author)
    ? entry.author
        .map((a) => [a?.given, a?.family].filter(Boolean).join(' ').trim() || a?.name)
        .filter(Boolean)
        .join(', ')
    : '';

  const doi = String(entry?.DOI || '').trim();
  const isbn = Array.isArray(entry?.ISBN) && entry.ISBN.length ? String(entry.ISBN[0]).trim() : '';
  const issn = Array.isArray(entry?.ISSN) && entry.ISSN.length ? String(entry.ISSN[0]).trim() : '';

  const dateParts =
    entry?.published?.['date-parts']?.[0] ||
    entry?.['published-print']?.['date-parts']?.[0] ||
    entry?.['published-online']?.['date-parts']?.[0] ||
    entry?.issued?.['date-parts']?.[0] ||
    [];
  const releaseYear = typeof dateParts[0] === 'number' ? dateParts[0] : null;

  const containerTitle = Array.isArray(entry?.['container-title'])
    ? stripXmlTags(entry['container-title'][0] || '')
    : '';
  const publisher = stripXmlTags(entry?.publisher || '');
  const institution = containerTitle || publisher;

  const subjects = Array.isArray(entry?.subject)
    ? entry.subject.filter(Boolean).slice(0, 3)
    : [];
  const genres = subjects.length ? subjects : ['Artigo / Pesquisa'];
  const coverSources = buildCoverCascade({ isbn });

  return {
    id: `cr-${doi || normalizeText(title)}`,
    title,
    author,
    coverUrl: coverSources[0] || null,
    coverSources,
    googleCoverUrl: null,
    openLibIsbnCover: buildOpenLibraryIsbnCover(isbn),
    openLibIdCover: null,
    jikanCoverUrls: [],
    releaseYear,
    totalPages: parseCrossRefPageCount(entry?.page),
    publisher,
    institution,
    isbn,
    doi,
    issn,
    genres,
    workType: 'academic',
    sourceLabel: 'CrossRef',
    monogram: getMonogram(title),
  };
}

function scoreResultRichness(item) {
  return (
    (item.coverUrl ? 4 : 0) +
    (item.totalPages || item.totalChapters ? 2 : 0) +
    (item.isbn ? 2 : 0) +
    (item.doi ? 2 : 0) +
    (item.author ? 1 : 0) +
    (item.sourceLabel === 'Jikan' && item.workType === 'manga' ? 3 : 0) +
    (item.sourceLabel === 'CrossRef' && item.workType === 'academic' ? 3 : 0)
  );
}

function scoreQueryRelevance(item, query, filter, isbn, doi) {
  let score = scoreResultRichness(item);
  const normQuery = normalizeText(query);
  const normTitle = normalizeText(item.title);
  const normAuthor = normalizeText(item.author);

  if (isbn && String(item.isbn || '').replace(/[-\s]/g, '') === isbn) {
    score += 120;
  }
  if (doi && String(item.doi || '').toLowerCase() === doi.toLowerCase()) {
    score += 120;
  }

  if (normQuery) {
    if (normTitle === normQuery) score += 60;
    else if (normTitle.startsWith(normQuery)) score += 35;
    else if (normTitle.includes(normQuery)) score += 20;

    if (normAuthor.includes(normQuery)) score += 12;
  }

  if (filter === 'manga' && item.workType === 'manga') score += 15;
  if (filter === 'academic' && item.workType === 'academic') score += 15;

  return score;
}

function mergeTwoResults(primary, secondary) {
  const winner =
    scoreResultRichness(primary) >= scoreResultRichness(secondary)
      ? primary
      : secondary;
  const loser = winner === primary ? secondary : primary;

  const isbn = winner.isbn || loser.isbn || '';
  const doi = winner.doi || loser.doi || '';
  const googleCoverUrl = winner.googleCoverUrl || loser.googleCoverUrl || null;
  const openLibIdCover = winner.openLibIdCover || loser.openLibIdCover || null;
  const jikanCoverUrls = Array.from(
    new Set([...(winner.jikanCoverUrls || []), ...(loser.jikanCoverUrls || [])])
  );

  const mergedCascade = buildCoverCascade({
    googleUrl: googleCoverUrl,
    isbn,
    openLibIdUrl: openLibIdCover,
    jikanUrls: jikanCoverUrls,
  });

  const extraSources = Array.from(
    new Set([
      ...mergedCascade,
      ...(winner.coverSources || []),
      winner.coverUrl,
      ...(loser.coverSources || []),
      loser.coverUrl,
    ].filter(Boolean))
  );

  return {
    ...winner,
    author: winner.author || loser.author || '',
    isbn,
    doi,
    issn: winner.issn || loser.issn || '',
    releaseYear: winner.releaseYear || loser.releaseYear || null,
    totalPages: winner.totalPages || loser.totalPages || null,
    publisher: winner.publisher || loser.publisher || '',
    institution: winner.institution || loser.institution || '',
    genres: winner.genres?.length ? winner.genres : loser.genres || [],
    googleCoverUrl,
    openLibIdCover,
    jikanCoverUrls,
    coverUrl: extraSources[0] || null,
    coverSources: extraSources,
  };
}

function deduplicateAndSortResults(items, query, filter, isbn, doi) {
  const byKey = new Map();

  items.forEach((item) => {
    const cleanIsbn = String(item.isbn || '').replace(/[-\s]/g, '').trim();
    const cleanDoi = String(item.doi || '').trim().toLowerCase();
    const firstAuthor = normalizeText(String(item.author || '').split(',')[0]);
    const titleKey = normalizeText(item.title);

    const dedupKey = cleanDoi
      ? `doi:${cleanDoi}`
      : cleanIsbn
        ? `isbn:${cleanIsbn}`
        : `${item.workType || 'book'}:${titleKey}:${firstAuthor}`;

    const existing = byKey.get(dedupKey);
    if (!existing) {
      byKey.set(dedupKey, item);
      return;
    }

    byKey.set(dedupKey, mergeTwoResults(existing, item));
  });

  return Array.from(byKey.values()).sort(
    (a, b) =>
      scoreQueryRelevance(b, query, filter, isbn, doi) -
      scoreQueryRelevance(a, query, filter, isbn, doi)
  );
}

function getMockPool() {
  const byId = new Map();
  [...catalogItems, ...initialItems].forEach((item) => {
    if (!byId.has(item.id)) {
      byId.set(item.id, item);
    }
  });
  return Array.from(byId.values());
}

export function searchMockMedia(query = '', filter = 'all') {
  const pool = getMockPool();
  const normalized = query.trim().toLowerCase();

  const filteredByType =
    filter === 'all'
      ? pool
      : pool.filter((item) => item.workType === filter);

  if (!normalized) return filteredByType;

  return filteredByType.filter((item) => {
    const inTitle = item.title?.toLowerCase().includes(normalized);
    const inAuthor = item.author?.toLowerCase().includes(normalized);
    const inIsbn = item.isbn?.toLowerCase().includes(normalized);
    const inDoi = item.doi?.toLowerCase().includes(normalized);
    const inFormat = item.format?.toLowerCase().includes(normalized);
    const inGenres = item.genres?.some((g) =>
      g.toLowerCase().includes(normalized)
    );
    return inTitle || inAuthor || inIsbn || inDoi || inFormat || inGenres;
  });
}

async function fetchJsonWithTimeout(url, { signal, timeoutMs = API_TIMEOUT_MS } = {}) {
  const localController = new AbortController();
  let timedOut = false;

  const onParentAbort = () => localController.abort();
  if (signal) {
    if (signal.aborted) {
      const err = new Error('Aborted');
      err.name = 'AbortError';
      throw err;
    }
    signal.addEventListener('abort', onParentAbort, { once: true });
  }

  const timer = setTimeout(() => {
    timedOut = true;
    localController.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, { signal: localController.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (err) {
    if (timedOut && !signal?.aborted) {
      const timeoutErr = new Error('Timeout');
      timeoutErr.name = 'TimeoutError';
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timer);
    if (signal) {
      signal.removeEventListener('abort', onParentAbort);
    }
  }
}

function buildGoogleBooksUrl(cleanQuery, isbn) {
  const url = new URL(GOOGLE_BOOKS_BASE_URL);
  const qValue = isbn ? `isbn:${isbn}` : cleanQuery;
  url.search = new URLSearchParams({
    q: qValue,
    maxResults: isbn ? '12' : '10',
    printType: 'books',
  }).toString();
  return url.toString();
}

function buildOpenLibraryUrl(cleanQuery, isbn) {
  const url = new URL(OPEN_LIBRARY_BASE_URL);
  const params = new URLSearchParams(
    isbn ? { isbn, limit: '8' } : { q: cleanQuery, limit: '8' }
  );
  url.search = params.toString();
  return url.toString();
}

function buildJikanUrl(cleanQuery) {
  const url = new URL(JIKAN_MANGA_BASE_URL);
  url.search = new URLSearchParams({
    q: cleanQuery,
    limit: '8',
  }).toString();
  return url.toString();
}

function buildCrossRefUrl(cleanQuery, doi) {
  if (doi) {
    const url = new URL(`${CROSSREF_WORKS_URL}/${encodeURIComponent(doi)}`);
    url.search = new URLSearchParams({ mailto: CROSSREF_POLITE_MAILTO }).toString();
    return url.toString();
  }
  const url = new URL(CROSSREF_WORKS_URL);
  url.search = new URLSearchParams({
    query: cleanQuery,
    rows: '8',
    mailto: CROSSREF_POLITE_MAILTO,
  }).toString();
  return url.toString();
}

export async function searchMedia(
  query,
  { signal, filter = 'all', skipCache = false } = {}
) {
  const cleanQuery = String(query || '').trim();
  if (!cleanQuery) {
    return {
      results: searchMockMedia('', filter),
      source: 'mock',
      isIsbn: false,
      isDoi: false,
      partialFailure: false,
      allFailed: false,
    };
  }

  if (!skipCache) {
    const cached = getCachedSearchMedia(cleanQuery, filter);
    if (cached) {
      return {
        results: cached.results,
        source: 'cache',
        isIsbn: Boolean(cached.isIsbn),
        isDoi: Boolean(cached.isDoi),
        partialFailure: Boolean(cached.partialFailure),
        allFailed: false,
      };
    }
  }

  const isbn = detectIsbnQuery(cleanQuery);
  const doi = isbn ? null : detectDoiQuery(cleanQuery);
  const defaultWorkType =
    filter === 'manga' ? 'manga' : filter === 'academic' ? 'academic' : 'book';

  const sourcePlan = [];
  if (doi) {
    sourcePlan.push({
      key: 'crossref',
      url: buildCrossRefUrl(cleanQuery, doi),
    });
  } else if (isbn) {
    sourcePlan.push(
      { key: 'google', url: buildGoogleBooksUrl(cleanQuery, isbn) },
      { key: 'openlib', url: buildOpenLibraryUrl(cleanQuery, isbn) }
    );
  } else {
    sourcePlan.push(
      { key: 'google', url: buildGoogleBooksUrl(cleanQuery, null) },
      { key: 'openlib', url: buildOpenLibraryUrl(cleanQuery, null) }
    );
    if (filter === 'all' || filter === 'manga') {
      sourcePlan.push({ key: 'jikan', url: buildJikanUrl(cleanQuery) });
    }
    if (filter === 'all' || filter === 'academic') {
      sourcePlan.push({
        key: 'crossref',
        url: buildCrossRefUrl(cleanQuery, null),
      });
    }
  }

  const settled = await Promise.allSettled(
    sourcePlan.map((entry) => fetchJsonWithTimeout(entry.url, { signal }))
  );

  const abortErr = settled.find(
    (res) => res.status === 'rejected' && res.reason?.name === 'AbortError'
  );
  if (abortErr) {
    throw abortErr.reason;
  }

  const failedSources = [];
  const itemsBySource = {
    google: [],
    openlib: [],
    jikan: [],
    crossref: [],
  };

  settled.forEach((res, idx) => {
    const sourceKey = sourcePlan[idx].key;
    if (res.status !== 'fulfilled') {
      failedSources.push(sourceKey);
      return;
    }

    const value = res.value;
    if (sourceKey === 'google' && Array.isArray(value?.items)) {
      itemsBySource.google = value.items.map((v) =>
        mapGoogleBook(v, defaultWorkType, isbn || '')
      );
    } else if (sourceKey === 'openlib' && Array.isArray(value?.docs)) {
      itemsBySource.openlib = value.docs.map((d) =>
        mapOpenLibraryDoc(d, defaultWorkType, isbn || '')
      );
    } else if (sourceKey === 'jikan' && Array.isArray(value?.data)) {
      itemsBySource.jikan = value.data.map(mapJikanManga);
    } else if (sourceKey === 'crossref') {
      if (Array.isArray(value?.message?.items)) {
        itemsBySource.crossref = value.message.items.map(mapCrossRefWork);
      } else if (value?.message && value.message.DOI) {
        itemsBySource.crossref = [mapCrossRefWork(value.message)];
      }
    }
  });

  const allFailed = failedSources.length === sourcePlan.length;
  const partialFailure = failedSources.length > 0 && !allFailed;

  if (allFailed) {
    return {
      results: searchMockMedia(cleanQuery, filter),
      source: 'mock',
      isIsbn: Boolean(isbn),
      isDoi: Boolean(doi),
      partialFailure: true,
      allFailed: true,
      failedSources,
    };
  }

  const combined = [
    ...itemsBySource.google,
    ...itemsBySource.openlib,
    ...itemsBySource.jikan,
    ...itemsBySource.crossref,
  ];

  const merged = deduplicateAndSortResults(
    combined,
    cleanQuery,
    filter,
    isbn,
    doi
  );

  const payload = {
    results: merged,
    source: 'multi',
    isIsbn: Boolean(isbn),
    isDoi: Boolean(doi),
    partialFailure,
    allFailed: false,
    failedSources,
  };

  if (merged.length > 0 && !partialFailure) {
    setCachedSearchMedia(cleanQuery, filter, payload);
  }
  return payload;
}
