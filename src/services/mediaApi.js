import { catalogItems, initialItems } from '../data/mockData';

const GOOGLE_BOOKS_BASE_URL = 'https://www.googleapis.com/books/v1/volumes';
const OPEN_LIBRARY_BASE_URL = 'https://openlibrary.org/search.json';
const JIKAN_MANGA_BASE_URL = 'https://api.jikan.moe/v4/manga';

const PALETTES = [
  ['#1E1B4B', '#8B5CF6', '#38BDF8'],
  ['#18181B', '#C084FC', '#F43F5E'],
  ['#0F172A', '#38BDF8', '#10B981'],
  ['#2E1065', '#A855F7', '#FBBF24'],
  ['#1F2937', '#F97316', '#FDE047'],
];

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

function getPalette(seedText) {
  let hash = 0;
  for (let i = 0; i < seedText.length; i += 1) {
    hash = (hash * 31 + seedText.charCodeAt(i)) % PALETTES.length;
  }
  return PALETTES[Math.abs(hash) % PALETTES.length];
}

function cleanCoverUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  return rawUrl
    .replace(/^http:\/\//i, 'https://')
    .replace(/&edge=curl/gi, '')
    .replace(/\?edge=curl&?/gi, '?')
    .replace(/\?$/, '');
}

function extractReleaseYear(publishedDate) {
  const match = String(publishedDate || '').trim().match(/^\d{4}/);
  return match ? Number(match[0]) : null;
}

export function detectIsbnQuery(query = '') {
  const clean = String(query).trim();
  if (/^\d{10}$|^\d{13}$/.test(clean)) {
    return clean;
  }
  const digitsOnly = clean.replace(/[-\s]/g, '');
  if (/^[\d-\s]+$/.test(clean) && (digitsOnly.length === 10 || digitsOnly.length === 13)) {
    return digitsOnly;
  }
  return null;
}

function extractGoogleIsbn(industryIdentifiers) {
  if (!Array.isArray(industryIdentifiers)) return '';
  const isbn13 = industryIdentifiers.find((item) => item?.type === 'ISBN_13')?.identifier;
  if (isbn13) return isbn13;
  const isbn10 = industryIdentifiers.find((item) => item?.type === 'ISBN_10')?.identifier;
  return isbn10 || '';
}

function mapGoogleBook(volume, defaultWorkType = 'book', isbnFallback = '') {
  const volumeInfo = volume?.volumeInfo || {};
  const title = volumeInfo.title || 'Sem título';
  const author = Array.isArray(volumeInfo.authors)
    ? volumeInfo.authors.filter(Boolean).join(', ')
    : '';
  const rawThumbnail =
    volumeInfo.imageLinks?.thumbnail || volumeInfo.imageLinks?.smallThumbnail || null;
  const totalPages =
    typeof volumeInfo.pageCount === 'number' && volumeInfo.pageCount > 0
      ? volumeInfo.pageCount
      : null;
  const genres = Array.isArray(volumeInfo.categories)
    ? volumeInfo.categories.filter(Boolean)
    : [];
  const isbn = extractGoogleIsbn(volumeInfo.industryIdentifiers) || isbnFallback;

  return {
    id: `gb-${String(volume.id)}`,
    title,
    author,
    coverUrl: cleanCoverUrl(rawThumbnail),
    releaseYear: extractReleaseYear(volumeInfo.publishedDate),
    totalPages,
    publisher: volumeInfo.publisher || '',
    institution: defaultWorkType === 'academic' ? volumeInfo.publisher || '' : '',
    isbn,
    genres,
    workType: defaultWorkType,
    sourceLabel: 'Google Books',
    monogram: getMonogram(title),
    palette: getPalette(title || String(volume.id)),
  };
}

function mapOpenLibraryDoc(doc, defaultWorkType = 'book', isbnFallback = '') {
  const title = doc?.title || 'Sem título';
  const rawKey = String(doc?.key || title).replace(/^\/works\//, '');
  const author = Array.isArray(doc?.author_name)
    ? doc.author_name.filter(Boolean).join(', ')
    : '';
  const coverUrl = doc?.cover_i
    ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
    : null;
  const releaseYear =
    typeof doc?.first_publish_year === 'number' ? doc.first_publish_year : null;
  const totalPages =
    typeof doc?.number_of_pages_median === 'number' && doc.number_of_pages_median > 0
      ? doc.number_of_pages_median
      : null;
  const publisher =
    Array.isArray(doc?.publisher) && doc.publisher.length ? doc.publisher[0] : '';
  const isbn =
    Array.isArray(doc?.isbn) && doc.isbn.length
      ? doc.isbn.find((code) => /^\d{13}$/.test(code)) || doc.isbn[0]
      : isbnFallback;
  const genres = Array.isArray(doc?.subject)
    ? doc.subject.filter(Boolean).slice(0, 3)
    : [];

  return {
    id: `ol-${rawKey}`,
    title,
    author,
    coverUrl,
    releaseYear,
    totalPages,
    publisher,
    institution: defaultWorkType === 'academic' ? publisher : '',
    isbn,
    genres,
    workType: defaultWorkType,
    sourceLabel: 'Open Library',
    monogram: getMonogram(title),
    palette: getPalette(title || rawKey),
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
  const coverUrl =
    entry?.images?.jpg?.large_image_url ||
    entry?.images?.jpg?.image_url ||
    entry?.images?.webp?.image_url ||
    null;
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
    coverUrl,
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
    genres,
    workType: 'manga',
    sourceLabel: 'Jikan',
    monogram: getMonogram(title),
    palette: getPalette(title || String(entry.mal_id)),
  };
}

function scoreResultRichness(item) {
  return (
    (item.coverUrl ? 4 : 0) +
    (item.totalPages || item.totalChapters ? 2 : 0) +
    (item.isbn ? 2 : 0) +
    (item.author ? 1 : 0) +
    (item.sourceLabel === 'Jikan' && item.workType === 'manga' ? 3 : 0)
  );
}

function deduplicateResults(items) {
  const byKey = new Map();

  items.forEach((item) => {
    const firstAuthor = String(item.author || '')
      .split(',')[0]
      .trim()
      .toLowerCase();
    const titleKey = String(item.title || '')
      .trim()
      .toLowerCase();
    const dedupKey = item.isbn
      ? `isbn:${item.isbn}`
      : `${item.workType || 'book'}:${titleKey}:${firstAuthor}`;

    const existing = byKey.get(dedupKey);
    if (!existing || scoreResultRichness(item) > scoreResultRichness(existing)) {
      byKey.set(dedupKey, item);
    }
  });

  return Array.from(byKey.values());
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
    const inFormat = item.format?.toLowerCase().includes(normalized);
    const inGenres = item.genres?.some((g) =>
      g.toLowerCase().includes(normalized)
    );
    return inTitle || inAuthor || inIsbn || inFormat || inGenres;
  });
}

async function fetchJsonSafe(url, { signal }) {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

export async function searchMedia(query, { signal, filter = 'all' } = {}) {
  const cleanQuery = query.trim();
  if (!cleanQuery) {
    return { results: searchMockMedia('', filter), source: 'mock', isIsbn: false };
  }

  const isbn = detectIsbnQuery(cleanQuery);
  const defaultWorkType =
    filter === 'manga' ? 'manga' : filter === 'academic' ? 'academic' : 'book';

  const googleUrl = isbn
    ? `${GOOGLE_BOOKS_BASE_URL}?q=isbn:${encodeURIComponent(isbn)}&maxResults=12&printType=books`
    : `${GOOGLE_BOOKS_BASE_URL}?q=${encodeURIComponent(cleanQuery)}&maxResults=10&printType=books`;

  const openLibraryUrl = isbn
    ? `${OPEN_LIBRARY_BASE_URL}?isbn=${encodeURIComponent(isbn)}&limit=8`
    : `${OPEN_LIBRARY_BASE_URL}?q=${encodeURIComponent(cleanQuery)}&limit=8`;

  const shouldQueryJikan = filter === 'manga' && !isbn;
  const jikanUrl = `${JIKAN_MANGA_BASE_URL}?q=${encodeURIComponent(cleanQuery)}&limit=8`;

  const tasks = [
    fetchJsonSafe(googleUrl, { signal }),
    fetchJsonSafe(openLibraryUrl, { signal }),
    ...(shouldQueryJikan ? [fetchJsonSafe(jikanUrl, { signal })] : []),
  ];

  const settled = await Promise.allSettled(tasks);

  const abortErr = settled.find(
    (res) => res.status === 'rejected' && res.reason?.name === 'AbortError'
  );
  if (abortErr) {
    throw abortErr.reason;
  }

  const allFailed = settled.every((res) => res.status === 'rejected');
  if (allFailed) {
    return {
      results: searchMockMedia(cleanQuery, filter),
      source: 'mock',
      isIsbn: Boolean(isbn),
    };
  }

  const googleRes = settled[0];
  const openLibRes = settled[1];
  const jikanRes = shouldQueryJikan ? settled[2] : null;

  const googleItems =
    googleRes?.status === 'fulfilled' && Array.isArray(googleRes.value?.items)
      ? googleRes.value.items.map((v) =>
          mapGoogleBook(v, defaultWorkType, isbn || '')
        )
      : [];

  const openLibItems =
    openLibRes?.status === 'fulfilled' && Array.isArray(openLibRes.value?.docs)
      ? openLibRes.value.docs.map((d) =>
          mapOpenLibraryDoc(d, defaultWorkType, isbn || '')
        )
      : [];

  const jikanItems =
    jikanRes?.status === 'fulfilled' && Array.isArray(jikanRes.value?.data)
      ? jikanRes.value.data.map(mapJikanManga)
      : [];

  // Interleave Google Books and Open Library while keeping Jikan first in manga mode
  const interleavedBooks = [];
  const maxBookLen = Math.max(googleItems.length, openLibItems.length);
  for (let i = 0; i < maxBookLen; i += 1) {
    if (googleItems[i]) interleavedBooks.push(googleItems[i]);
    if (openLibItems[i]) interleavedBooks.push(openLibItems[i]);
  }

  const merged = deduplicateResults(
    shouldQueryJikan
      ? [...jikanItems, ...interleavedBooks]
      : interleavedBooks
  );

  return {
    results: merged,
    source: 'multi',
    isIsbn: Boolean(isbn),
  };
}
