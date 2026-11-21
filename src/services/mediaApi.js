import { normalizePublisherName } from '../data/brazilianPublishers.js';
import { catalogItems, initialItems } from '../data/mockData.js';
import {
  mapCategoriesToGenreAndSubgenres,
  normalizeLanguageLabel,
} from '../utils/genreMapper.js';

export { mapCategoriesToGenreAndSubgenres, normalizeLanguageLabel };

const GOOGLE_BOOKS_BASE_URL = 'https://www.googleapis.com/books/v1/volumes';
const APPLE_BOOKS_BASE_URL = 'https://itunes.apple.com/search';
const OPEN_LIBRARY_BASE_URL = 'https://openlibrary.org/search.json';
const JIKAN_MANGA_BASE_URL = 'https://api.jikan.moe/v4/manga';
const CROSSREF_WORKS_URL = 'https://api.crossref.org/works';
const WIKIDATA_API_URL = 'https://www.wikidata.org/w/api.php';
const OPENALEX_WORKS_URL = 'https://api.openalex.org/works';
const GUTENDEX_BOOKS_URL = 'https://gutendex.com/books';
const CROSSREF_POLITE_MAILTO = 'codice@projeto-codice.app';

const SEARCH_CACHE_KEY = 'codice_search_cache_v2';
export const GOOGLE_BOOKS_KEY_STORAGE = 'codice_search_google_books_key';
export const MEDIA_SOURCES_STORAGE_KEY = 'codice_active_media_sources_v3';
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 60;
const API_TIMEOUT_MS = 4000;
const MAX_RESULTS_PER_SOURCE = 10;

export const MEDIA_API_SOURCES = [
  { id: 'googleBooks', label: 'Google Books', hint: 'Livros em geral e metadados' },
  { id: 'appleBooks', label: 'Apple Books', hint: 'Ebooks em português e capas HD' },
  { id: 'openLibrary', label: 'Open Library', hint: 'Edições, ISBN e capas abertas' },
  { id: 'jikan', label: 'Jikan / MAL', hint: 'Mangás, Light Novels e Manhwas' },
  { id: 'gutendex', label: 'Gutendex', hint: 'Clássicos com EPUB grátis' },
  { id: 'academic', label: 'CrossRef + OpenAlex', hint: 'Artigos, DOI e Open Access' },
  { id: 'wikidata', label: 'Wikidata', hint: 'Cruzamento bilíngue PT-BR/EN' },
];

const ALL_MEDIA_SOURCE_IDS = MEDIA_API_SOURCES.map((s) => s.id);
export const DEFAULT_MEDIA_SOURCES = ['googleBooks', 'appleBooks', 'openLibrary'];
export const DEFAULT_SOURCES_BY_FILTER = {
  all: ['googleBooks', 'appleBooks', 'openLibrary'],
  book: ['googleBooks'],
  manga: ['jikan'],
  academic: ['academic'],
};

export function getDefaultSourcesForFilter(filter = 'all') {
  return [...(DEFAULT_SOURCES_BY_FILTER[filter] || DEFAULT_MEDIA_SOURCES)];
}

export const MEDIA_SOURCE_PRESETS = [
  {
    id: 'all',
    label: 'Geral · Rápido',
    filter: 'all',
    sources: ['googleBooks', 'appleBooks', 'openLibrary'],
  },
  {
    id: 'books',
    label: 'Livros',
    filter: 'book',
    sources: ['googleBooks'],
  },
  {
    id: 'manga',
    label: 'Mangás & Light Novels',
    filter: 'manga',
    sources: ['jikan'],
  },
  {
    id: 'academic',
    label: 'Acadêmico / TCC',
    filter: 'academic',
    sources: ['academic'],
  },
  {
    id: 'multi',
    label: 'Multi-Fonte',
    filter: 'all',
    sources: [...ALL_MEDIA_SOURCE_IDS],
  },
];

export function sanitizeSearchApiKey(rawKey) {
  return String(rawKey || '')
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/[\r\n\t]+/g, '')
    .trim();
}

export function loadGoogleBooksApiKey() {
  try {
    if (typeof localStorage === 'undefined') return '';
    return sanitizeSearchApiKey(localStorage.getItem(GOOGLE_BOOKS_KEY_STORAGE));
  } catch {
    return '';
  }
}

export function saveGoogleBooksApiKey(rawKey) {
  const clean = sanitizeSearchApiKey(rawKey);
  try {
    if (typeof localStorage === 'undefined') return clean;
    if (clean) {
      localStorage.setItem(GOOGLE_BOOKS_KEY_STORAGE, clean);
    } else {
      localStorage.removeItem(GOOGLE_BOOKS_KEY_STORAGE);
    }
  } catch {
    // Ignora falha de storage
  }
  return clean;
}

const VALID_SOURCE_IDS = new Set(ALL_MEDIA_SOURCE_IDS);

export function loadActiveMediaSources(filter = 'all') {
  const fallback = getDefaultSourcesForFilter(filter);
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const raw = localStorage.getItem(MEDIA_SOURCES_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return fallback;
    const cleaned = Array.from(
      new Set(parsed.filter((id) => VALID_SOURCE_IDS.has(id)))
    );
    return cleaned.length > 0 ? cleaned : fallback;
  } catch {
    return fallback;
  }
}

export function saveActiveMediaSources(sources) {
  try {
    if (typeof localStorage === 'undefined') return;
    const cleaned = Array.from(
      new Set((Array.isArray(sources) ? sources : []).filter((id) => VALID_SOURCE_IDS.has(id)))
    );
    localStorage.setItem(MEDIA_SOURCES_STORAGE_KEY, JSON.stringify(cleaned));
  } catch {
    // Ignora falha de storage
  }
}

const WIKIDATA_COUNTRY_MAP = {
  Q30: 'Estados Unidos',
  Q145: 'Reino Unido',
  Q155: 'Brasil',
  Q17: 'Japão',
  Q183: 'Alemanha',
  Q142: 'França',
  Q159: 'Rússia',
  Q38: 'Itália',
  Q29: 'Espanha',
  Q45: 'Portugal',
  Q414: 'Argentina',
  Q16: 'Canadá',
  Q148: 'China',
  Q884: 'Coreia do Sul',
  Q36: 'Polônia',
  Q34: 'Suécia',
  Q27: 'Irlanda',
  Q668: 'Índia',
  Q96: 'México',
  Q739: 'Colômbia',
};

const LITERARY_WIKIDATA_HINTS =
  /livro|book|romance|novel|novela|ficção|fiction|mang[aá]|comic|hq|ensaio|essay|conto|short story|poema|poem|peça|play|trilogia|série|treatise|tratado|tese|obra|literár/i;

const memoryCache = new Map();
let cacheHydrated = false;

function getCacheStorage() {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    // Fallback
  }
  try {
    if (typeof sessionStorage !== 'undefined') return sessionStorage;
  } catch {
    // Sem storage
  }
  return null;
}

export function clearSearchMediaCache() {
  memoryCache.clear();
  cacheHydrated = false;
  const storage = getCacheStorage();
  if (!storage) return;
  try {
    storage.removeItem(SEARCH_CACHE_KEY);
  } catch {
    // Ignora falha de storage
  }
}

function hydrateMemoryCache() {
  if (cacheHydrated) return;
  cacheHydrated = true;
  const storage = getCacheStorage();
  if (!storage) return;
  try {
    const raw = storage.getItem(SEARCH_CACHE_KEY);
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
    // Ignora falha ao ler storage
  }
}

function persistMemoryCache() {
  const storage = getCacheStorage();
  if (!storage) return;
  try {
    const entries = Array.from(memoryCache.entries()).slice(-CACHE_MAX_ENTRIES);
    storage.setItem(SEARCH_CACHE_KEY, JSON.stringify(entries));
  } catch {
    // Ignora erro de quota ou storage indisponível
  }
}

function makeSourcesCacheToken(sources) {
  if (!Array.isArray(sources) || sources.length === 0) return 'default';
  return [...sources].sort().join(',');
}

function makeCacheKey(query, filter, sources) {
  return `${filter || 'all'}:${makeSourcesCacheToken(sources)}:${String(query || '').trim().toLowerCase()}`;
}

export function getCachedSearchMedia(query, filter = 'all', sources = null) {
  hydrateMemoryCache();
  const key = makeCacheKey(query, filter, sources);
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

function setCachedSearchMedia(query, filter, sources, payload) {
  hydrateMemoryCache();
  const key = makeCacheKey(query, filter, sources);
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

function decodeBasicEntities(value) {
  return String(value || '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ');
}

function stripXmlTags(value) {
  return decodeBasicEntities(
    String(value || '').replace(/<br\s*\/?>/gi, ' ')
  )
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toAuthorsList(rawAuthors) {
  if (Array.isArray(rawAuthors)) {
    return rawAuthors.map((a) => String(a || '').trim()).filter(Boolean);
  }
  return String(rawAuthors || '')
    .split(/,|;/)
    .map((a) => a.trim())
    .filter(Boolean);
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

export function cleanCoverUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const clean = rawUrl.trim();
  if (!clean) return null;
  return clean
    .replace(/^http:\/\//i, 'https://')
    .replace(/&edge=curl/gi, '')
    .replace(/\?edge=curl&?/gi, '?')
    .replace(/\?$/, '');
}

function buildGoogleFrontCoverUrl(volumeId) {
  const cleanId = String(volumeId || '').trim();
  if (!cleanId) return null;
  return `https://books.google.com/books/content?id=${encodeURIComponent(cleanId)}&printsec=frontcover&img=1&zoom=1`;
}

function buildOpenLibraryIsbnCover(isbn) {
  const clean = String(isbn || '').replace(/[-\s]/g, '').trim();
  if (!clean) return null;
  return `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(clean)}-L.jpg?default=false`;
}

export function buildCoverCascade({
  primaryUrl = null,
  googleVolumeId = '',
  googleUrl = null,
  isbn = '',
  openLibIdUrl = null,
  jikanUrls = [],
} = {}) {
  const googleFrontUrl = buildGoogleFrontCoverUrl(googleVolumeId);
  const isbnUrl = buildOpenLibraryIsbnCover(isbn);
  return Array.from(
    new Set(
      [
        cleanCoverUrl(primaryUrl),
        cleanCoverUrl(googleUrl),
        cleanCoverUrl(googleFrontUrl),
        isbnUrl,
        cleanCoverUrl(openLibIdUrl),
        ...(Array.isArray(jikanUrls) ? jikanUrls.map(cleanCoverUrl) : []),
      ].filter(Boolean)
    )
  );
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

function mapGoogleBook(volume, defaultWorkType = 'book', isbnFallback = '') {
  const volumeInfo = volume?.volumeInfo || {};
  const title = volumeInfo.title || 'Sem título';
  const author = Array.isArray(volumeInfo.authors)
    ? volumeInfo.authors.filter(Boolean).join(', ')
    : '';
  const rawThumbnail =
    volumeInfo.imageLinks?.large ||
    volumeInfo.imageLinks?.medium ||
    volumeInfo.imageLinks?.thumbnail ||
    volumeInfo.imageLinks?.smallThumbnail ||
    null;
  const isbn = extractGoogleIsbn(volumeInfo.industryIdentifiers) || isbnFallback;
  const googleVolumeId = String(volume?.id || '').trim();
  const coverCandidates = buildCoverCascade({
    primaryUrl: rawThumbnail,
    googleVolumeId,
    isbn,
  });

  const totalPages =
    typeof volumeInfo.pageCount === 'number' && volumeInfo.pageCount > 0
      ? volumeInfo.pageCount
      : null;
  const rawCategories = Array.isArray(volumeInfo.categories)
    ? volumeInfo.categories.filter(Boolean)
    : [];
  const publisher = normalizePublisherName(volumeInfo.publisher || '');
  const rawLang = String(volumeInfo.language || '').toLowerCase();
  const isPt = rawLang === 'pt' || rawLang === 'pt-br' || rawLang === 'por';
  const releaseYear = extractReleaseYear(volumeInfo.publishedDate);
  const authors = toAuthorsList(volumeInfo.authors);
  const synopsis = stripXmlTags(volumeInfo.description || '');
  const mappedGenres = mapCategoriesToGenreAndSubgenres(rawCategories, {
    workType: defaultWorkType,
    title,
    synopsis,
  });

  return {
    id: `gb-${googleVolumeId}`,
    googleVolumeId,
    title,
    originalTitle: !isPt && rawLang ? title : '',
    language: normalizeLanguageLabel(volumeInfo.language || ''),
    author,
    authors,
    coverUrl: coverCandidates[0] || null,
    coverCandidates,
    coverSources: coverCandidates,
    googleCoverUrl: cleanCoverUrl(rawThumbnail),
    openLibIsbnCover: buildOpenLibraryIsbnCover(isbn),
    openLibIdCover: null,
    jikanCoverUrls: [],
    releaseYear,
    year: releaseYear,
    totalPages,
    publisher,
    institution: defaultWorkType === 'academic' ? publisher : '',
    isbn,
    doi: '',
    issn: '',
    synopsis,
    rawCategories,
    primaryGenre: mappedGenres.primaryGenre,
    subgenres: mappedGenres.subgenres,
    subgenre: mappedGenres.subgenre,
    genres: mappedGenres.genres,
    workType: defaultWorkType,
    source: 'googleBooks',
    sourceLabel: 'Google Books',
    monogram: getMonogram(title),
  };
}

export function mapAppleBook(entry, defaultWorkType = 'book') {
  if (!entry || typeof entry !== 'object') return null;
  const title = String(entry.trackName || entry.trackCensoredName || 'Sem título').trim();
  const author = String(entry.artistName || '').trim();
  const authors = toAuthorsList(author);
  const originalArtwork = cleanCoverUrl(entry.artworkUrl100 || entry.artworkUrl60 || null);
  const highResArtwork = originalArtwork
    ? cleanCoverUrl(originalArtwork.replace(/100x100bb/i, '600x600bb'))
    : null;
  const isbn = String(entry.isbn || '').replace(/[-\s]/g, '').trim();
  const coverCandidates = Array.from(
    new Set(
      [
        highResArtwork,
        originalArtwork,
        ...buildCoverCascade({ isbn }),
      ].filter(Boolean)
    )
  );
  const releaseYear = extractReleaseYear(entry.releaseDate);
  const rawGenres = Array.isArray(entry.genres) ? entry.genres.filter(Boolean) : [];
  const filteredGenres = rawGenres
    .filter((g) => !/^(livros|books|ebooks?)$/i.test(String(g).trim()))
    .slice(0, 4);
  const rawCategories = filteredGenres.length ? filteredGenres : rawGenres.slice(0, 4);
  const synopsis = stripXmlTags(entry.description || '');
  const language = normalizeLanguageLabel(entry.language || '');
  const resolvedWorkType = defaultWorkType === 'academic' ? 'academic' : 'book';
  const mappedGenres = mapCategoriesToGenreAndSubgenres(rawCategories, {
    workType: resolvedWorkType,
    title,
    synopsis,
  });

  return {
    id: `ab-${entry.trackId || normalizeText(title)}`,
    title,
    originalTitle: '',
    language,
    author,
    authors,
    coverUrl: coverCandidates[0] || null,
    coverCandidates,
    coverSources: coverCandidates,
    googleCoverUrl: null,
    openLibIsbnCover: buildOpenLibraryIsbnCover(isbn),
    openLibIdCover: null,
    jikanCoverUrls: [],
    releaseYear,
    year: releaseYear,
    totalPages: null,
    publisher: normalizePublisherName(entry.publisher || ''),
    institution: '',
    isbn,
    doi: '',
    issn: '',
    synopsis,
    rawCategories,
    primaryGenre: mappedGenres.primaryGenre,
    subgenres: mappedGenres.subgenres,
    subgenre: mappedGenres.subgenre,
    genres: mappedGenres.genres,
    workType: resolvedWorkType,
    source: 'appleBooks',
    sourceLabel: 'Apple Books',
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
  const coverCandidates = buildCoverCascade({ isbn, openLibIdUrl: openLibIdCover });

  const releaseYear =
    typeof doc?.first_publish_year === 'number' ? doc.first_publish_year : null;
  const totalPages =
    typeof doc?.number_of_pages_median === 'number' &&
    doc.number_of_pages_median > 0
      ? doc.number_of_pages_median
      : null;
  const rawPublisher =
    Array.isArray(doc?.publisher) && doc.publisher.length ? doc.publisher[0] : '';
  const publisher = normalizePublisherName(rawPublisher);
  const rawCategories = Array.isArray(doc?.subject)
    ? doc.subject.filter(Boolean).slice(0, 5)
    : [];
  const langs = Array.isArray(doc?.language) ? doc.language : [];
  const hasPor = langs.some((l) => /^por$/i.test(l) || /^pt/i.test(l));
  const rawFirstSentence = Array.isArray(doc?.first_sentence)
    ? doc.first_sentence[0]
    : doc?.first_sentence;
  const synopsis = stripXmlTags(rawFirstSentence || doc?.subtitle || '');
  const mappedGenres = mapCategoriesToGenreAndSubgenres(rawCategories, {
    workType: defaultWorkType,
    title,
    synopsis,
  });

  return {
    id: `ol-${rawKey}`,
    title,
    originalTitle: !hasPor && langs.length > 0 ? title : '',
    language: normalizeLanguageLabel(langs[0] || ''),
    author,
    authors: toAuthorsList(doc?.author_name),
    coverUrl: coverCandidates[0] || null,
    coverCandidates,
    coverSources: coverCandidates,
    googleCoverUrl: null,
    openLibIsbnCover: buildOpenLibraryIsbnCover(isbn),
    openLibIdCover,
    jikanCoverUrls: [],
    releaseYear,
    year: releaseYear,
    totalPages,
    publisher,
    institution: defaultWorkType === 'academic' ? publisher : '',
    isbn,
    doi: '',
    issn: '',
    synopsis,
    rawCategories,
    primaryGenre: mappedGenres.primaryGenre,
    subgenres: mappedGenres.subgenres,
    subgenre: mappedGenres.subgenre,
    genres: mappedGenres.genres,
    workType: defaultWorkType,
    source: 'openLibrary',
    sourceLabel: 'Open Library',
    monogram: getMonogram(title),
  };
}

function mapJikanOrigin(type) {
  const normalized = String(type || '').toLowerCase();
  if (normalized.includes('light novel')) {
    return 'Light Novel';
  }
  if (normalized === 'novel') {
    return 'Light Novel';
  }
  if (normalized.includes('manhwa')) {
    return 'Manhwa';
  }
  if (normalized.includes('manhua')) {
    return 'Manhua';
  }
  if (normalized.includes('one-shot')) {
    return 'One-shot';
  }
  return 'Mangá';
}

export function mapJikanManga(entry) {
  const title = entry?.title || entry?.title_english || 'Sem título';
  const originalTitle =
    entry?.title_japanese && entry.title_japanese !== title
      ? entry.title_japanese
      : entry?.title_english && entry.title_english !== title
        ? entry.title_english
        : '';

  const author = Array.isArray(entry?.authors)
    ? entry.authors.map((a) => a?.name).filter(Boolean).join(', ')
    : '';

  const jikanCoverUrls = [
    entry?.images?.webp?.large_image_url,
    entry?.images?.jpg?.large_image_url,
    entry?.images?.jpg?.image_url,
    entry?.images?.webp?.image_url,
  ]
    .map(cleanCoverUrl)
    .filter(Boolean);

  const coverCandidates = buildCoverCascade({ jikanUrls: jikanCoverUrls });

  const rawCategories = Array.from(
    new Set(
      [
        ...(entry?.genres || []),
        ...(entry?.demographics || []),
        ...(entry?.themes || []),
      ]
        .map((g) => g?.name)
        .filter(Boolean)
    )
  ).slice(0, 5);

  const releaseYear = extractReleaseYear(entry?.published?.from);
  const demographicOrigin = mapJikanOrigin(entry?.type);
  const synopsis = stripXmlTags(entry?.synopsis || '');
  const mappedGenres = mapCategoriesToGenreAndSubgenres(rawCategories, {
    workType: 'manga',
    title,
    synopsis,
    demographicOrigin,
  });

  return {
    id: `jikan-${entry?.mal_id || normalizeText(title)}`,
    title,
    originalTitle,
    titleEnglish: entry?.title_english || '',
    titleJapanese: entry?.title_japanese || '',
    language: '',
    author,
    authors: toAuthorsList(author),
    coverUrl: coverCandidates[0] || null,
    coverCandidates,
    coverSources: coverCandidates,
    googleCoverUrl: null,
    openLibIsbnCover: null,
    openLibIdCover: null,
    jikanCoverUrls,
    releaseYear,
    year: releaseYear,
    totalVolumes:
      typeof entry?.volumes === 'number' && entry.volumes > 0
        ? entry.volumes
        : null,
    totalChapters:
      typeof entry?.chapters === 'number' && entry.chapters > 0
        ? entry.chapters
        : null,
    totalPages: null,
    mangaType: entry?.type || 'Manga',
    demographicOrigin,
    publicationStatus:
      entry?.status === 'Finished' ? 'Completo' : 'Em lançamento',
    isbn: '',
    doi: '',
    issn: '',
    synopsis,
    rawCategories,
    primaryGenre: mappedGenres.primaryGenre,
    subgenres: mappedGenres.subgenres,
    subgenre: mappedGenres.subgenre,
    genres: mappedGenres.genres,
    workType: 'manga',
    source: 'jikan',
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
  const publisher = normalizePublisherName(stripXmlTags(entry?.publisher || ''));
  const institution = containerTitle || publisher;

  const subjects = Array.isArray(entry?.subject)
    ? entry.subject.filter(Boolean).slice(0, 4)
    : [];
  const rawCategories = subjects.length ? subjects : ['Artigo / Pesquisa'];
  const coverCandidates = buildCoverCascade({ isbn });
  const synopsis = stripXmlTags(entry?.abstract || '');
  const mappedGenres = mapCategoriesToGenreAndSubgenres(rawCategories, {
    workType: 'academic',
    title,
    synopsis,
  });

  return {
    id: `cr-${doi || normalizeText(title)}`,
    title,
    originalTitle: entry?.language && entry.language !== 'pt' ? title : '',
    language: normalizeLanguageLabel(entry?.language || ''),
    author,
    authors: toAuthorsList(author),
    coverUrl: coverCandidates[0] || null,
    coverCandidates,
    coverSources: coverCandidates,
    googleCoverUrl: null,
    openLibIsbnCover: buildOpenLibraryIsbnCover(isbn),
    openLibIdCover: null,
    jikanCoverUrls: [],
    releaseYear,
    year: releaseYear,
    totalPages: parseCrossRefPageCount(entry?.page),
    publisher,
    institution,
    isbn,
    doi,
    issn,
    synopsis,
    rawCategories,
    primaryGenre: mappedGenres.primaryGenre,
    subgenres: mappedGenres.subgenres,
    subgenre: mappedGenres.subgenre,
    genres: mappedGenres.genres,
    workType: 'academic',
    source: 'academic',
    sourceLabel: 'CrossRef',
    monogram: getMonogram(title),
  };
}

export function mapOpenAlexWork(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const title = stripXmlTags(entry.title || entry.display_name || 'Sem título');
  const doi = String(entry.doi || '')
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
    .trim();
  const rawShortId = String(entry.id || title)
    .replace(/^https?:\/\/openalex\.org\//i, '')
    .trim();

  const author = Array.isArray(entry.authorships)
    ? entry.authorships
        .map((a) => a?.author?.display_name)
        .filter(Boolean)
        .slice(0, 6)
        .join(', ')
    : '';

  const citedByCount = Math.max(0, Number(entry.cited_by_count) || 0);
  const openAccessUrl =
    cleanCoverUrl(
      entry.open_access?.oa_url ||
        entry.best_oa_location?.pdf_url ||
        entry.best_oa_location?.landing_page_url ||
        entry.primary_location?.pdf_url ||
        ''
    ) || '';
  const isOpenAccess = Boolean(entry.open_access?.is_oa || openAccessUrl);

  const sourceName = stripXmlTags(
    entry.primary_location?.source?.display_name || ''
  );
  const rawPublisher =
    entry.primary_location?.source?.host_organization_name || sourceName || '';
  const publisher = normalizePublisherName(rawPublisher);
  const releaseYear =
    typeof entry.publication_year === 'number' ? entry.publication_year : null;

  const topicCandidates = [
    entry.primary_topic?.display_name,
    ...(Array.isArray(entry.concepts) ? entry.concepts.map((c) => c?.display_name) : []),
  ].filter(Boolean);
  const rawCategories = Array.from(new Set(topicCandidates)).slice(0, 4);
  if (rawCategories.length === 0) rawCategories.push('Pesquisa / Artigo');

  const rawLang = String(entry.language || '').toLowerCase();
  const mappedGenres = mapCategoriesToGenreAndSubgenres(rawCategories, {
    workType: 'academic',
    title,
  });

  return {
    id: `oa-${doi || rawShortId || normalizeText(title)}`,
    title,
    originalTitle: rawLang && rawLang !== 'pt' ? title : '',
    language: normalizeLanguageLabel(entry.language || ''),
    author,
    authors: toAuthorsList(author),
    coverUrl: null,
    coverCandidates: [],
    coverSources: [],
    googleCoverUrl: null,
    openLibIsbnCover: null,
    openLibIdCover: null,
    jikanCoverUrls: [],
    releaseYear,
    year: releaseYear,
    totalPages: null,
    publisher,
    institution: sourceName || publisher,
    isbn: '',
    doi,
    issn: Array.isArray(entry.primary_location?.source?.issn)
      ? entry.primary_location.source.issn[0] || ''
      : '',
    citedByCount,
    openAccessUrl,
    isOpenAccess,
    synopsis: '',
    rawCategories,
    primaryGenre: mappedGenres.primaryGenre,
    subgenres: mappedGenres.subgenres,
    subgenre: mappedGenres.subgenre,
    genres: mappedGenres.genres,
    workType: 'academic',
    source: 'academic',
    sourceLabel: 'OpenAlex',
    monogram: getMonogram(title),
  };
}

function formatGutendexAuthorName(rawName) {
  const clean = String(rawName || '').trim();
  if (!clean) return '';
  const parts = clean.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 2) {
    return `${parts[1]} ${parts[0]}`;
  }
  return clean;
}

export function mapGutendexBook(entry, defaultWorkType = 'book') {
  if (!entry || typeof entry !== 'object') return null;
  const title = String(entry.title || 'Sem título').trim();
  const author = Array.isArray(entry.authors)
    ? entry.authors.map((a) => formatGutendexAuthorName(a?.name)).filter(Boolean).join(', ')
    : '';
  const langs = Array.isArray(entry.languages) ? entry.languages : [];
  const hasPt = langs.includes('pt');

  const formats = entry.formats || {};
  const freeEpubUrl =
    cleanCoverUrl(
      formats['application/epub+zip'] ||
        formats['application/epub'] ||
        ''
    ) || '';
  const coverUrl = cleanCoverUrl(formats['image/jpeg'] || null);
  const coverCandidates = coverUrl ? [coverUrl] : [];

  const rawCategories = Array.from(
    new Set(
      [...(entry.subjects || []), ...(entry.bookshelves || [])]
        .map((s) => String(s).replace(/^Category:\s*/i, '').trim())
        .filter(Boolean)
    )
  ).slice(0, 4);
  const mappedGenres = mapCategoriesToGenreAndSubgenres(
    rawCategories.length ? rawCategories : ['Clássico em Domínio Público'],
    { workType: defaultWorkType, title }
  );

  return {
    id: `gut-${entry.id || normalizeText(title)}`,
    title,
    originalTitle: !hasPt && langs.length > 0 ? title : '',
    language: langs.map(normalizeLanguageLabel).filter(Boolean).join(', '),
    author,
    authors: toAuthorsList(author),
    coverUrl: coverCandidates[0] || null,
    coverCandidates,
    coverSources: coverCandidates,
    googleCoverUrl: null,
    openLibIsbnCover: null,
    openLibIdCover: null,
    jikanCoverUrls: [],
    releaseYear: null,
    year: null,
    totalPages: null,
    publisher: 'Domínio Público (Project Gutenberg)',
    institution: '',
    isbn: '',
    doi: '',
    issn: '',
    synopsis: '',
    freeEpubUrl,
    isPublicDomain: true,
    downloadCount: Number(entry.download_count) || 0,
    rawCategories,
    primaryGenre: mappedGenres.primaryGenre,
    subgenres: mappedGenres.subgenres,
    subgenre: mappedGenres.subgenre,
    genres: mappedGenres.genres,
    workType: defaultWorkType,
    source: 'gutendex',
    sourceLabel: 'Gutendex',
    monogram: getMonogram(title),
  };
}

function isLikelyLiteraryWikidataEntity(entity) {
  if (!entity || typeof entity !== 'object') return false;
  const claims = entity.claims || {};
  if (claims.P212 || claims.P957 || claims.P1476 || claims.P50) {
    return true;
  }
  const desc = [
    entity.descriptions?.['pt-br']?.value,
    entity.descriptions?.pt?.value,
    entity.descriptions?.en?.value,
  ]
    .filter(Boolean)
    .join(' ');
  return LITERARY_WIKIDATA_HINTS.test(desc);
}

export function mapWikidataEntityToWork(entity, defaultWorkType = 'book') {
  if (!isLikelyLiteraryWikidataEntity(entity)) return null;
  const ptLabel = String(
    entity.labels?.['pt-br']?.value || entity.labels?.pt?.value || ''
  ).trim();
  const enLabel = String(entity.labels?.en?.value || '').trim();
  const claims = entity.claims || {};

  const p1476Val = claims.P1476?.[0]?.mainsnak?.datavalue?.value;
  const claimTitle =
    typeof p1476Val === 'string'
      ? p1476Val.trim()
      : String(p1476Val?.text || '').trim();

  const title = ptLabel || enLabel || claimTitle;
  if (!title) return null;

  const originalCandidate =
    claimTitle && claimTitle.toLowerCase() !== title.toLowerCase()
      ? claimTitle
      : enLabel && enLabel.toLowerCase() !== title.toLowerCase()
        ? enLabel
        : '';

  const pubTime = String(
    claims.P577?.[0]?.mainsnak?.datavalue?.value?.time || ''
  );
  const yearMatch = pubTime.match(/^[+-]?(\d{4})/);
  const releaseYear = yearMatch ? Number(yearMatch[1]) : null;

  const countryQid = claims.P495?.[0]?.mainsnak?.datavalue?.value?.id || '';
  const originCountry = WIKIDATA_COUNTRY_MAP[countryQid] || '';

  const rawIsbn =
    claims.P212?.[0]?.mainsnak?.datavalue?.value ||
    claims.P957?.[0]?.mainsnak?.datavalue?.value ||
    '';
  const isbn = String(rawIsbn).replace(/[-\s]/g, '').trim();
  const coverCandidates = buildCoverCascade({ isbn });

  const description = String(
    entity.descriptions?.['pt-br']?.value ||
      entity.descriptions?.pt?.value ||
      entity.descriptions?.en?.value ||
      ''
  ).trim();

  return {
    id: `wd-${entity.id}`,
    wikidataId: entity.id,
    title,
    originalTitle: originalCandidate,
    ptTitle: ptLabel,
    enTitle: enLabel,
    language: ptLabel ? 'Português' : enLabel ? 'Inglês' : '',
    originCountry,
    author: '',
    authors: [],
    coverUrl: coverCandidates[0] || null,
    coverCandidates,
    coverSources: coverCandidates,
    googleCoverUrl: null,
    openLibIsbnCover: buildOpenLibraryIsbnCover(isbn),
    openLibIdCover: null,
    jikanCoverUrls: [],
    releaseYear,
    year: releaseYear,
    totalPages: null,
    publisher: '',
    institution: '',
    isbn,
    doi: '',
    issn: '',
    synopsis: description,
    genres: originCountry ? [originCountry] : [],
    workType: defaultWorkType,
    source: 'wikidata',
    sourceLabel: 'Wikidata',
    monogram: getMonogram(title),
  };
}

export function enrichBilingualTitles(items = [], wikidataWorks = []) {
  if (!Array.isArray(wikidataWorks) || wikidataWorks.length === 0) {
    return items;
  }

  return items.map((item) => {
    const normTitle = normalizeText(item.title);
    const normOrig = normalizeText(item.originalTitle);
    const cleanIsbn = String(item.isbn || '').replace(/[-\s]/g, '');

    const match = wikidataWorks.find((wd) => {
      if (cleanIsbn && wd.isbn && wd.isbn === cleanIsbn) return true;
      const wdTitle = normalizeText(wd.title);
      const wdPt = normalizeText(wd.ptTitle);
      const wdEn = normalizeText(wd.enTitle);
      const wdOrig = normalizeText(wd.originalTitle);

      return (
        (normTitle &&
          (normTitle === wdTitle ||
            normTitle === wdPt ||
            normTitle === wdEn ||
            normTitle === wdOrig)) ||
        (normOrig &&
          (normOrig === wdEn || normOrig === wdOrig || normOrig === wdPt))
      );
    });

    if (!match) return item;

    const ptName = match.ptTitle || match.title || item.title;
    const origName =
      match.originalTitle || match.enTitle || item.originalTitle || '';

    const hasPtTranslation =
      Boolean(match.ptTitle) &&
      Boolean(origName) &&
      normalizeText(match.ptTitle) !== normalizeText(origName);

    const nextTitle =
      hasPtTranslation &&
      normalizeText(item.title) === normalizeText(origName)
        ? ptName
        : item.title;

    const nextOriginalTitle =
      origName && normalizeText(origName) !== normalizeText(nextTitle)
        ? origName
        : item.originalTitle &&
            normalizeText(item.originalTitle) !== normalizeText(nextTitle)
          ? item.originalTitle
          : '';

    const mergedCovers = Array.from(
      new Set([
        ...(item.coverCandidates || item.coverSources || []),
        ...(match.coverCandidates || []),
      ].filter(Boolean))
    );

    return {
      ...item,
      title: nextTitle,
      originalTitle: nextOriginalTitle,
      originCountry: item.originCountry || match.originCountry || '',
      releaseYear: item.releaseYear || match.releaseYear || null,
      wikidataId: match.wikidataId,
      coverCandidates: mergedCovers,
      coverSources: mergedCovers,
      coverUrl: item.coverUrl || mergedCovers[0] || null,
    };
  });
}

function hasValidCover(item) {
  return Boolean(
    item?.coverUrl ||
      (Array.isArray(item?.coverCandidates) && item.coverCandidates.length > 0) ||
      (Array.isArray(item?.coverSources) && item.coverSources.length > 0)
  );
}

function hasSynopsis(item) {
  return Boolean(String(item?.synopsis || '').trim());
}

function scoreResultRichness(item) {
  return (
    (hasValidCover(item) ? 20 : 0) +
    (hasSynopsis(item) ? 12 : 0) +
    (item.originalTitle ? 1 : 0) +
    (item.totalPages || item.totalChapters ? 2 : 0) +
    (item.isbn ? 2 : 0) +
    (item.doi ? 2 : 0) +
    (item.openAccessUrl || item.freeEpubUrl ? 2 : 0) +
    (item.author ? 1 : 0) +
    (item.sourceLabel === 'Jikan' && item.workType === 'manga' ? 3 : 0) +
    ((item.sourceLabel === 'CrossRef' || item.sourceLabel === 'OpenAlex') &&
    item.workType === 'academic'
      ? 3
      : 0)
  );
}

function scoreQueryRelevance(item, query, filter, isbn, doi) {
  let score = scoreResultRichness(item);
  const normQuery = normalizeText(query);
  const normTitle = normalizeText(item.title);
  const normOriginal = normalizeText(item.originalTitle);
  const normAuthor = normalizeText(item.author);

  if (isbn && String(item.isbn || '').replace(/[-\s]/g, '') === isbn) {
    score += 120;
  }
  if (doi && String(item.doi || '').toLowerCase() === doi.toLowerCase()) {
    score += 120;
  }

  if (normQuery) {
    if (normTitle === normQuery || normOriginal === normQuery) score += 60;
    else if (normTitle.startsWith(normQuery) || normOriginal.startsWith(normQuery)) {
      score += 35;
    } else if (normTitle.includes(normQuery) || normOriginal.includes(normQuery)) {
      score += 20;
    }

    if (normAuthor.includes(normQuery)) score += 12;
  }

  if (filter === 'manga' && item.workType === 'manga') score += 15;
  if (filter === 'academic' && item.workType === 'academic') score += 15;

  return score;
}

export function mergeTwoResults(primary, secondary) {
  const primaryCover = hasValidCover(primary);
  const secondaryCover = hasValidCover(secondary);
  const primarySynopsis = hasSynopsis(primary);
  const secondarySynopsis = hasSynopsis(secondary);
  const primaryRank = (primaryCover ? 2 : 0) + (primarySynopsis ? 1 : 0);
  const secondaryRank = (secondaryCover ? 2 : 0) + (secondarySynopsis ? 1 : 0);

  let winner;
  if (primaryRank !== secondaryRank) {
    winner = primaryRank > secondaryRank ? primary : secondary;
  } else {
    winner =
      scoreResultRichness(primary) >= scoreResultRichness(secondary)
        ? primary
        : secondary;
  }
  const loser = winner === primary ? secondary : primary;

  const isbn = winner.isbn || loser.isbn || '';
  const doi = winner.doi || loser.doi || '';
  const googleVolumeId = winner.googleVolumeId || loser.googleVolumeId || '';
  const googleCoverUrl = winner.googleCoverUrl || loser.googleCoverUrl || null;
  const openLibIdCover = winner.openLibIdCover || loser.openLibIdCover || null;
  const jikanCoverUrls = Array.from(
    new Set([...(winner.jikanCoverUrls || []), ...(loser.jikanCoverUrls || [])])
  );

  const mergedCascade = buildCoverCascade({
    primaryUrl: winner.coverUrl || loser.coverUrl || null,
    googleVolumeId,
    googleUrl: googleCoverUrl,
    isbn,
    openLibIdUrl: openLibIdCover,
    jikanUrls: jikanCoverUrls,
  });

  const winnerHasGenuineCover = Boolean(
    winner.googleCoverUrl ||
      winner.openLibIdCover ||
      (Array.isArray(winner.jikanCoverUrls) && winner.jikanCoverUrls.length > 0) ||
      winner.source === 'appleBooks' ||
      winner.source === 'gutendex'
  );
  const loserHasGenuineCover = Boolean(
    loser.googleCoverUrl ||
      loser.openLibIdCover ||
      (Array.isArray(loser.jikanCoverUrls) && loser.jikanCoverUrls.length > 0) ||
      loser.source === 'appleBooks' ||
      loser.source === 'gutendex'
  );

  const prioritizedUrls =
    !winnerHasGenuineCover && loserHasGenuineCover
      ? [
          ...(loser.coverCandidates || []),
          ...(loser.coverSources || []),
          loser.coverUrl,
          ...(winner.coverCandidates || []),
          ...(winner.coverSources || []),
          winner.coverUrl,
          ...mergedCascade,
        ]
      : [
          ...(winner.coverCandidates || []),
          ...(winner.coverSources || []),
          winner.coverUrl,
          ...mergedCascade,
          ...(loser.coverCandidates || []),
          ...(loser.coverSources || []),
          loser.coverUrl,
        ];

  const coverCandidates = Array.from(
    new Set(prioritizedUrls.map(cleanCoverUrl).filter(Boolean))
  );

  const candidateOriginal =
    winner.originalTitle ||
    loser.originalTitle ||
    (normalizeText(winner.title) !== normalizeText(loser.title)
      ? loser.title
      : '');

  const mergedSynopsis = String(
    (hasSynopsis(winner) ? winner.synopsis : '') ||
      (hasSynopsis(loser) ? loser.synopsis : '') ||
      ''
  ).trim();
  const mergedReleaseYear = winner.releaseYear || loser.releaseYear || null;
  const combinedRawCategories = Array.from(
    new Set([
      ...(Array.isArray(winner.rawCategories) ? winner.rawCategories : []),
      ...(Array.isArray(loser.rawCategories) ? loser.rawCategories : []),
      ...(Array.isArray(winner.genres) ? winner.genres : []),
      ...(Array.isArray(loser.genres) ? loser.genres : []),
    ].filter(Boolean))
  );
  const mappedMergedGenres = mapCategoriesToGenreAndSubgenres(combinedRawCategories, {
    workType: winner.workType || loser.workType || 'book',
    title: winner.title || loser.title || '',
    synopsis: mergedSynopsis,
    demographicOrigin: winner.demographicOrigin || loser.demographicOrigin || '',
  });
  const mergedGenres = mappedMergedGenres.genres.length
    ? mappedMergedGenres.genres
    : winner.genres?.length
      ? winner.genres
      : loser.genres || [];

  return {
    ...winner,
    googleVolumeId,
    originalTitle:
      candidateOriginal &&
      normalizeText(candidateOriginal) !== normalizeText(winner.title)
        ? candidateOriginal
        : '',
    author: winner.author || loser.author || '',
    authors:
      Array.isArray(winner.authors) && winner.authors.length
        ? winner.authors
        : loser.authors || [],
    language: normalizeLanguageLabel(winner.language || loser.language || ''),
    synopsis: mergedSynopsis,
    isbn,
    doi,
    issn: winner.issn || loser.issn || '',
    releaseYear: mergedReleaseYear,
    year: mergedReleaseYear,
    totalPages: winner.totalPages || loser.totalPages || null,
    totalVolumes: winner.totalVolumes || loser.totalVolumes || null,
    totalChapters: winner.totalChapters || loser.totalChapters || null,
    publisher: normalizePublisherName(winner.publisher || loser.publisher || ''),
    institution: winner.institution || loser.institution || '',
    citedByCount: Math.max(
      Number(winner.citedByCount) || 0,
      Number(loser.citedByCount) || 0
    ),
    openAccessUrl: winner.openAccessUrl || loser.openAccessUrl || '',
    isOpenAccess: Boolean(winner.isOpenAccess || loser.isOpenAccess),
    freeEpubUrl: winner.freeEpubUrl || loser.freeEpubUrl || '',
    isPublicDomain: Boolean(winner.isPublicDomain || loser.isPublicDomain),
    originCountry: winner.originCountry || loser.originCountry || '',
    rawCategories: combinedRawCategories,
    primaryGenre:
      mappedMergedGenres.primaryGenre ||
      winner.primaryGenre ||
      loser.primaryGenre ||
      mergedGenres[0] ||
      '',
    subgenres:
      mappedMergedGenres.subgenres.length > 0
        ? mappedMergedGenres.subgenres
        : winner.subgenres?.length
          ? winner.subgenres
          : loser.subgenres || [],
    subgenre:
      mappedMergedGenres.subgenre ||
      winner.subgenre ||
      loser.subgenre ||
      '',
    genres: mergedGenres,
    googleCoverUrl,
    openLibIdCover,
    jikanCoverUrls,
    coverUrl: coverCandidates[0] || null,
    coverCandidates,
    coverSources: coverCandidates,
  };
}

function deduplicateAndSortResults(items, query, filter, isbn, doi) {
  const byDoi = new Map();
  const byIsbn = new Map();
  const byTitleAuthor = new Map();
  const orderedRecords = [];

  items.forEach((item) => {
    const cleanIsbn = String(item.isbn || '').replace(/[-\s]/g, '').trim();
    const cleanDoi = String(item.doi || '').trim().toLowerCase();
    const firstAuthor = normalizeText(String(item.author || '').split(/,|;/)[0]);
    const titleKey = normalizeText(item.title);
    const titleAuthorKey = titleKey
      ? `${item.workType || 'book'}:${titleKey}:${firstAuthor}`
      : '';

    const matchedRef =
      (cleanDoi && byDoi.get(cleanDoi)) ||
      (cleanIsbn && byIsbn.get(cleanIsbn)) ||
      (titleAuthorKey && byTitleAuthor.get(titleAuthorKey)) ||
      null;

    if (!matchedRef) {
      const box = { item };
      orderedRecords.push(box);
      if (cleanDoi) byDoi.set(cleanDoi, box);
      if (cleanIsbn) byIsbn.set(cleanIsbn, box);
      if (titleAuthorKey) byTitleAuthor.set(titleAuthorKey, box);
      return;
    }

    const merged = mergeTwoResults(matchedRef.item, item);
    matchedRef.item = merged;

    const mergedIsbn = String(merged.isbn || '').replace(/[-\s]/g, '').trim();
    const mergedDoi = String(merged.doi || '').trim().toLowerCase();
    const mergedAuthor = normalizeText(String(merged.author || '').split(/,|;/)[0]);
    const mergedTitleKey = normalizeText(merged.title);
    if (mergedDoi) byDoi.set(mergedDoi, matchedRef);
    if (mergedIsbn) byIsbn.set(mergedIsbn, matchedRef);
    if (mergedTitleKey) {
      byTitleAuthor.set(
        `${merged.workType || 'book'}:${mergedTitleKey}:${mergedAuthor}`,
        matchedRef
      );
    }
  });

  return orderedRecords
    .map((box) => box.item)
    .sort(
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
    const inOrig = item.originalTitle?.toLowerCase().includes(normalized);
    const inAuthor = item.author?.toLowerCase().includes(normalized);
    const inIsbn = item.isbn?.toLowerCase().includes(normalized);
    const inDoi = item.doi?.toLowerCase().includes(normalized);
    const inFormat = item.format?.toLowerCase().includes(normalized);
    const inGenres = item.genres?.some((g) =>
      g.toLowerCase().includes(normalized)
    );
    return inTitle || inOrig || inAuthor || inIsbn || inDoi || inFormat || inGenres;
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
      const httpErr = new Error(`HTTP ${response.status}`);
      httpErr.status = response.status;
      throw httpErr;
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

function buildGoogleBooksUrl(cleanQuery, isbn, apiKey = '') {
  const url = new URL(GOOGLE_BOOKS_BASE_URL);
  const qValue = isbn ? `isbn:${isbn}` : cleanQuery;
  const params = {
    q: qValue,
    maxResults: String(MAX_RESULTS_PER_SOURCE),
    printType: 'books',
  };
  const cleanKey = sanitizeSearchApiKey(apiKey);
  if (cleanKey) {
    params.key = cleanKey;
  }
  url.search = new URLSearchParams(params).toString();
  return url.toString();
}

function buildAppleBooksUrl(cleanQuery) {
  return `${APPLE_BOOKS_BASE_URL}?term=${encodeURIComponent(cleanQuery)}&media=ebook&country=br&limit=${MAX_RESULTS_PER_SOURCE}`;
}

function buildOpenLibraryUrl(cleanQuery, isbn) {
  const url = new URL(OPEN_LIBRARY_BASE_URL);
  const params = new URLSearchParams(
    isbn
      ? { isbn, limit: String(MAX_RESULTS_PER_SOURCE) }
      : { q: cleanQuery, limit: String(MAX_RESULTS_PER_SOURCE) }
  );
  url.search = params.toString();
  return url.toString();
}

function buildJikanUrl(cleanQuery) {
  const url = new URL(JIKAN_MANGA_BASE_URL);
  url.search = new URLSearchParams({
    q: cleanQuery,
    limit: String(MAX_RESULTS_PER_SOURCE),
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
    rows: String(MAX_RESULTS_PER_SOURCE),
    mailto: CROSSREF_POLITE_MAILTO,
  }).toString();
  return url.toString();
}

function buildOpenAlexUrl(cleanQuery, doi) {
  if (doi) {
    const url = new URL(`${OPENALEX_WORKS_URL}/https://doi.org/${encodeURIComponent(doi)}`);
    url.search = new URLSearchParams({ mailto: CROSSREF_POLITE_MAILTO }).toString();
    return url.toString();
  }
  const url = new URL(OPENALEX_WORKS_URL);
  url.search = new URLSearchParams({
    search: cleanQuery,
    'per-page': String(MAX_RESULTS_PER_SOURCE),
    mailto: CROSSREF_POLITE_MAILTO,
  }).toString();
  return url.toString();
}

function buildGutendexUrl(cleanQuery) {
  const url = new URL(GUTENDEX_BOOKS_URL);
  url.search = new URLSearchParams({
    search: cleanQuery,
  }).toString();
  return url.toString();
}

function buildWikidataSearchUrl(cleanQuery) {
  const url = new URL(WIKIDATA_API_URL);
  url.search = new URLSearchParams({
    action: 'wbsearchentities',
    search: cleanQuery,
    language: 'pt',
    uselang: 'pt',
    format: 'json',
    origin: '*',
    limit: '6',
  }).toString();
  return url.toString();
}

function buildWikidataEntitiesUrl(ids) {
  const url = new URL(WIKIDATA_API_URL);
  url.search = new URLSearchParams({
    action: 'wbgetentities',
    ids: ids.join('|'),
    props: 'labels|descriptions|claims',
    languages: 'pt|pt-br|en',
    format: 'json',
    origin: '*',
  }).toString();
  return url.toString();
}

function getWorkTypeFromFilter(filter = 'all') {
  return filter === 'manga' ? 'manga' : filter === 'academic' ? 'academic' : 'book';
}

async function fetchGoogleBooksRaw(cleanQuery, { signal, isbn = null, apiKey } = {}) {
  const resolvedKey = sanitizeSearchApiKey(
    apiKey !== undefined ? apiKey : loadGoogleBooksApiKey()
  );

  if (resolvedKey) {
    try {
      return await fetchJsonWithTimeout(
        buildGoogleBooksUrl(cleanQuery, isbn, resolvedKey),
        { signal }
      );
    } catch (err) {
      if (err?.status === 400 || err?.status === 403) {
        return fetchJsonWithTimeout(
          buildGoogleBooksUrl(cleanQuery, isbn, ''),
          { signal }
        );
      }
      throw err;
    }
  }

  return fetchJsonWithTimeout(buildGoogleBooksUrl(cleanQuery, isbn, ''), { signal });
}

export async function testGoogleBooksConnection(apiKey, { signal } = {}) {
  const cleanKey = sanitizeSearchApiKey(apiKey);
  if (!cleanKey) {
    return {
      ok: false,
      latencyMs: 0,
      errorMessage: 'Informe uma chave do Google Books para testar.',
    };
  }
  const startedAt = Date.now();
  try {
    await fetchJsonWithTimeout(buildGoogleBooksUrl('dom casmurro', null, cleanKey), {
      signal,
    });
    return {
      ok: true,
      latencyMs: Math.max(1, Date.now() - startedAt),
      errorMessage: '',
    };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Math.max(1, Date.now() - startedAt),
      errorMessage:
        err?.status === 400 || err?.status === 403
          ? 'Chave inválida ou sem permissão no Google Books.'
          : err?.message || 'Não foi possível validar a chave no Google Books.',
    };
  }
}

async function fetchWikidataSource(cleanQuery, defaultWorkType, { signal }) {
  const searchJson = await fetchJsonWithTimeout(buildWikidataSearchUrl(cleanQuery), {
    signal,
  });
  const ids = Array.isArray(searchJson?.search)
    ? searchJson.search.map((entry) => entry?.id).filter(Boolean).slice(0, 5)
    : [];
  if (ids.length === 0) return [];

  const entitiesJson = await fetchJsonWithTimeout(buildWikidataEntitiesUrl(ids), {
    signal,
  });
  const entitiesObj = entitiesJson?.entities || {};
  return Object.values(entitiesObj)
    .map((entity) => mapWikidataEntityToWork(entity, defaultWorkType))
    .filter(Boolean);
}

export const MEDIA_CONNECTORS = {
  googleBooks: {
    id: 'googleBooks',
    label: 'Google Books',
    async search(query, { signal, filter = 'all', isbn = null, apiKey } = {}) {
      const cleanQuery = String(query || '').trim();
      const targetIsbn = isbn || detectIsbnQuery(cleanQuery);
      const defaultWorkType = getWorkTypeFromFilter(filter);
      const value = await fetchGoogleBooksRaw(cleanQuery, {
        signal,
        isbn: targetIsbn,
        apiKey,
      });
      return Array.isArray(value?.items)
        ? value.items
            .slice(0, MAX_RESULTS_PER_SOURCE)
            .map((v) => mapGoogleBook(v, defaultWorkType, targetIsbn || ''))
        : [];
    },
  },
  appleBooks: {
    id: 'appleBooks',
    label: 'Apple Books',
    async search(query, { signal, filter = 'all' } = {}) {
      const cleanQuery = String(query || '').trim();
      const defaultWorkType = getWorkTypeFromFilter(filter);
      const value = await fetchJsonWithTimeout(buildAppleBooksUrl(cleanQuery), {
        signal,
      });
      return Array.isArray(value?.results)
        ? value.results
            .slice(0, MAX_RESULTS_PER_SOURCE)
            .map((entry) => mapAppleBook(entry, defaultWorkType))
            .filter(Boolean)
        : [];
    },
  },
  openLibrary: {
    id: 'openLibrary',
    label: 'Open Library',
    async search(query, { signal, filter = 'all', isbn = null } = {}) {
      const cleanQuery = String(query || '').trim();
      const targetIsbn = isbn || detectIsbnQuery(cleanQuery);
      const defaultWorkType = getWorkTypeFromFilter(filter);
      const value = await fetchJsonWithTimeout(
        buildOpenLibraryUrl(cleanQuery, targetIsbn),
        { signal }
      );
      return Array.isArray(value?.docs)
        ? value.docs
            .slice(0, MAX_RESULTS_PER_SOURCE)
            .map((d) => mapOpenLibraryDoc(d, defaultWorkType, targetIsbn || ''))
        : [];
    },
  },
  jikan: {
    id: 'jikan',
    label: 'Jikan / MAL',
    async search(query, { signal } = {}) {
      const cleanQuery = String(query || '').trim();
      const value = await fetchJsonWithTimeout(buildJikanUrl(cleanQuery), { signal });
      return Array.isArray(value?.data)
        ? value.data.slice(0, MAX_RESULTS_PER_SOURCE).map(mapJikanManga)
        : [];
    },
  },
  gutendex: {
    id: 'gutendex',
    label: 'Gutendex',
    async search(query, { signal, filter = 'all' } = {}) {
      const cleanQuery = String(query || '').trim();
      const defaultWorkType = getWorkTypeFromFilter(filter);
      const value = await fetchJsonWithTimeout(buildGutendexUrl(cleanQuery), {
        signal,
      });
      return Array.isArray(value?.results)
        ? value.results
            .slice(0, MAX_RESULTS_PER_SOURCE)
            .map((g) => mapGutendexBook(g, defaultWorkType))
            .filter(Boolean)
        : [];
    },
  },
  academic: {
    id: 'academic',
    label: 'CrossRef + OpenAlex',
    async search(query, { signal, doi = null } = {}) {
      const cleanQuery = String(query || '').trim();
      const targetDoi = doi || detectDoiQuery(cleanQuery);
      const [cr, oa] = await Promise.allSettled([
        fetchJsonWithTimeout(buildCrossRefUrl(cleanQuery, targetDoi), { signal }),
        fetchJsonWithTimeout(buildOpenAlexUrl(cleanQuery, targetDoi), { signal }),
      ]);
      const works = [];
      if (cr.status === 'fulfilled') {
        const v = cr.value;
        if (Array.isArray(v?.message?.items)) {
          works.push(...v.message.items.slice(0, MAX_RESULTS_PER_SOURCE).map(mapCrossRefWork));
        } else if (v?.message?.DOI) {
          works.push(mapCrossRefWork(v.message));
        }
      }
      if (oa.status === 'fulfilled') {
        const v = oa.value;
        if (Array.isArray(v?.results)) {
          works.push(
            ...v.results.slice(0, MAX_RESULTS_PER_SOURCE).map(mapOpenAlexWork).filter(Boolean)
          );
        } else if (v?.id && (v.title || v.display_name)) {
          const mapped = mapOpenAlexWork(v);
          if (mapped) works.push(mapped);
        }
      }
      if (cr.status !== 'fulfilled' && oa.status !== 'fulfilled') {
        throw cr.reason || oa.reason || new Error('Fontes acadêmicas indisponíveis');
      }
      return works;
    },
  },
  wikidata: {
    id: 'wikidata',
    label: 'Wikidata',
    async search(query, { signal, filter = 'all' } = {}) {
      const cleanQuery = String(query || '').trim();
      return fetchWikidataSource(cleanQuery, getWorkTypeFromFilter(filter), { signal });
    },
  },
};

function assembleMergedItems(itemsBySource, cleanQuery, filter, isbn, doi) {
  const baseCombined = [
    ...itemsBySource.google,
    ...itemsBySource.appleBooks,
    ...itemsBySource.openlib,
    ...itemsBySource.jikan,
    ...itemsBySource.crossref,
    ...itemsBySource.openalex,
    ...itemsBySource.gutendex,
  ];

  const enrichedCombined = enrichBilingualTitles(
    baseCombined,
    itemsBySource.wikidata
  );

  const existingNormTitles = new Set(
    enrichedCombined.flatMap((it) =>
      [normalizeText(it.title), normalizeText(it.originalTitle)].filter(Boolean)
    )
  );
  const uniqueWikidataExtras = itemsBySource.wikidata.filter(
    (wd) =>
      !existingNormTitles.has(normalizeText(wd.title)) &&
      (!wd.originalTitle || !existingNormTitles.has(normalizeText(wd.originalTitle)))
  );

  return deduplicateAndSortResults(
    [...enrichedCombined, ...uniqueWikidataExtras],
    cleanQuery,
    filter,
    isbn,
    doi
  );
}

export async function searchMedia(
  query,
  {
    signal,
    filter = 'all',
    sources = null,
    skipCache = false,
    onPartialResults = null,
    googleBooksKey,
  } = {}
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
      failedSources: [],
      failedCount: 0,
    };
  }

  const explicitSources =
    Array.isArray(sources) && sources.length > 0
      ? sources.filter((s) => VALID_SOURCE_IDS.has(s))
      : null;

  if (!skipCache) {
    const cached = getCachedSearchMedia(cleanQuery, filter, explicitSources);
    if (cached) {
      return {
        results: cached.results,
        source: 'cache',
        isIsbn: Boolean(cached.isIsbn),
        isDoi: Boolean(cached.isDoi),
        partialFailure: Boolean(cached.partialFailure),
        allFailed: false,
        failedSources: cached.failedSources || [],
        failedCount: Number(cached.failedCount) || 0,
      };
    }
  }

  const isbn = detectIsbnQuery(cleanQuery);
  const doi = isbn ? null : detectDoiQuery(cleanQuery);
  const defaultWorkType = getWorkTypeFromFilter(filter);

  const hasExplicit = Boolean(explicitSources && explicitSources.length > 0);
  const isSourceEnabled = (sourceId) =>
    hasExplicit ? explicitSources.includes(sourceId) : true;

  const sourcePlan = [];
  if (doi) {
    sourcePlan.push(
      {
        key: 'crossref',
        run: () => fetchJsonWithTimeout(buildCrossRefUrl(cleanQuery, doi), { signal }),
      },
      {
        key: 'openalex',
        run: () => fetchJsonWithTimeout(buildOpenAlexUrl(cleanQuery, doi), { signal }),
      }
    );
  } else if (isbn) {
    sourcePlan.push(
      {
        key: 'google',
        run: () =>
          MEDIA_CONNECTORS.googleBooks.search(cleanQuery, {
            signal,
            filter,
            isbn,
            apiKey: googleBooksKey,
          }),
      },
      {
        key: 'openlib',
        run: () =>
          MEDIA_CONNECTORS.openLibrary.search(cleanQuery, { signal, filter, isbn }),
      }
    );
    if (isSourceEnabled('appleBooks')) {
      sourcePlan.push({
        key: 'appleBooks',
        run: () => MEDIA_CONNECTORS.appleBooks.search(cleanQuery, { signal, filter }),
      });
    }
  } else {
    if (isSourceEnabled('googleBooks')) {
      sourcePlan.push({
        key: 'google',
        run: () =>
          MEDIA_CONNECTORS.googleBooks.search(cleanQuery, {
            signal,
            filter,
            apiKey: googleBooksKey,
          }),
      });
    }
    if (isSourceEnabled('appleBooks')) {
      sourcePlan.push({
        key: 'appleBooks',
        run: () => MEDIA_CONNECTORS.appleBooks.search(cleanQuery, { signal, filter }),
      });
    }
    if (isSourceEnabled('openLibrary')) {
      sourcePlan.push({
        key: 'openlib',
        run: () => MEDIA_CONNECTORS.openLibrary.search(cleanQuery, { signal, filter }),
      });
    }
    if (isSourceEnabled('wikidata')) {
      sourcePlan.push({
        key: 'wikidata',
        run: () => MEDIA_CONNECTORS.wikidata.search(cleanQuery, { signal, filter }),
      });
    }
    if (
      isSourceEnabled('jikan') &&
      (hasExplicit || filter === 'all' || filter === 'manga')
    ) {
      sourcePlan.push({
        key: 'jikan',
        run: () => MEDIA_CONNECTORS.jikan.search(cleanQuery, { signal, filter }),
      });
    }
    if (
      isSourceEnabled('gutendex') &&
      (hasExplicit || filter === 'all' || filter === 'book')
    ) {
      sourcePlan.push({
        key: 'gutendex',
        run: () => MEDIA_CONNECTORS.gutendex.search(cleanQuery, { signal, filter }),
      });
    }
    if (
      isSourceEnabled('academic') &&
      (hasExplicit || filter === 'all' || filter === 'academic')
    ) {
      sourcePlan.push(
        {
          key: 'crossref',
          run: () => fetchJsonWithTimeout(buildCrossRefUrl(cleanQuery, null), { signal }),
        },
        {
          key: 'openalex',
          run: () => fetchJsonWithTimeout(buildOpenAlexUrl(cleanQuery, null), { signal }),
        }
      );
    }
  }

  const itemsBySource = {
    google: [],
    appleBooks: [],
    openlib: [],
    jikan: [],
    crossref: [],
    openalex: [],
    gutendex: [],
    wikidata: [],
  };

  const applySourcePayload = (sourceKey, value) => {
    if (
      (sourceKey === 'google' ||
        sourceKey === 'appleBooks' ||
        sourceKey === 'openlib' ||
        sourceKey === 'jikan' ||
        sourceKey === 'gutendex' ||
        sourceKey === 'wikidata') &&
      Array.isArray(value)
    ) {
      itemsBySource[sourceKey] = value.slice(0, MAX_RESULTS_PER_SOURCE);
      return;
    }

    if (sourceKey === 'google' && Array.isArray(value?.items)) {
      itemsBySource.google = value.items
        .slice(0, MAX_RESULTS_PER_SOURCE)
        .map((v) => mapGoogleBook(v, defaultWorkType, isbn || ''));
    } else if (sourceKey === 'openlib' && Array.isArray(value?.docs)) {
      itemsBySource.openlib = value.docs
        .slice(0, MAX_RESULTS_PER_SOURCE)
        .map((d) => mapOpenLibraryDoc(d, defaultWorkType, isbn || ''));
    } else if (sourceKey === 'jikan' && Array.isArray(value?.data)) {
      itemsBySource.jikan = value.data
        .slice(0, MAX_RESULTS_PER_SOURCE)
        .map(mapJikanManga);
    } else if (sourceKey === 'crossref') {
      if (Array.isArray(value?.message?.items)) {
        itemsBySource.crossref = value.message.items
          .slice(0, MAX_RESULTS_PER_SOURCE)
          .map(mapCrossRefWork);
      } else if (value?.message && value.message.DOI) {
        itemsBySource.crossref = [mapCrossRefWork(value.message)];
      }
    } else if (sourceKey === 'openalex') {
      if (Array.isArray(value?.results)) {
        itemsBySource.openalex = value.results
          .slice(0, MAX_RESULTS_PER_SOURCE)
          .map(mapOpenAlexWork)
          .filter(Boolean);
      } else if (value?.id && (value.title || value.display_name)) {
        const mapped = mapOpenAlexWork(value);
        if (mapped) itemsBySource.openalex = [mapped];
      }
    } else if (sourceKey === 'gutendex' && Array.isArray(value?.results)) {
      itemsBySource.gutendex = value.results
        .slice(0, MAX_RESULTS_PER_SOURCE)
        .map((g) => mapGutendexBook(g, defaultWorkType))
        .filter(Boolean);
    } else if (sourceKey === 'wikidata' && Array.isArray(value)) {
      itemsBySource.wikidata = value.slice(0, MAX_RESULTS_PER_SOURCE);
    }
  };

  let remainingCount = sourcePlan.length;

  const tasks = sourcePlan.map((entry) =>
    entry
      .run()
      .then((value) => {
        remainingCount -= 1;
        applySourcePayload(entry.key, value);
        if (onPartialResults && !signal?.aborted) {
          const partialMerged = assembleMergedItems(
            itemsBySource,
            cleanQuery,
            filter,
            isbn,
            doi
          );
          onPartialResults({
            results: partialMerged,
            completedSource: entry.key,
            pendingCount: remainingCount,
          });
        }
        return value;
      })
      .catch((err) => {
        remainingCount -= 1;
        throw err;
      })
  );

  const settled = await Promise.allSettled(tasks);

  const abortErr = settled.find(
    (res) => res.status === 'rejected' && res.reason?.name === 'AbortError'
  );
  if (abortErr) {
    throw abortErr.reason;
  }

  const failedSources = [];
  settled.forEach((res, idx) => {
    if (res.status !== 'fulfilled') {
      failedSources.push(sourcePlan[idx].key);
    }
  });

  const allFailed = sourcePlan.length > 0 && failedSources.length === sourcePlan.length;
  const partialFailure = failedSources.length > 0 && !allFailed;
  const failedCount = failedSources.length;

  if (allFailed) {
    return {
      results: searchMockMedia(cleanQuery, filter),
      source: 'mock',
      isIsbn: Boolean(isbn),
      isDoi: Boolean(doi),
      partialFailure: true,
      allFailed: true,
      failedSources,
      failedCount,
    };
  }

  const merged = assembleMergedItems(
    itemsBySource,
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
    failedCount,
  };

  if (merged.length > 0 && !partialFailure) {
    setCachedSearchMedia(cleanQuery, filter, explicitSources, payload);
  }
  return payload;
}
