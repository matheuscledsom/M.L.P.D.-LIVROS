import { catalogItems, initialItems } from '../data/mockData';

const GOOGLE_BOOKS_BASE_URL = 'https://www.googleapis.com/books/v1/volumes';

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
  return String(title || 'LV').slice(0, 2).toUpperCase();
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

function mapGoogleBook(volume) {
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

  return {
    id: String(volume.id),
    title,
    author,
    coverUrl: cleanCoverUrl(rawThumbnail),
    releaseYear: extractReleaseYear(volumeInfo.publishedDate),
    totalPages,
    genres,
    monogram: getMonogram(title),
    palette: getPalette(title || String(volume.id)),
  };
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

export function searchMockMedia(query = '') {
  const pool = getMockPool();
  const normalized = query.trim().toLowerCase();
  if (!normalized) return catalogItems;

  return pool.filter((item) => {
    const inTitle = item.title?.toLowerCase().includes(normalized);
    const inAuthor = item.author?.toLowerCase().includes(normalized);
    const inFormat = item.format?.toLowerCase().includes(normalized);
    const inGenres = item.genres?.some((g) =>
      g.toLowerCase().includes(normalized)
    );
    return inTitle || inAuthor || inFormat || inGenres;
  });
}

export async function searchMedia(query, { signal } = {}) {
  const cleanQuery = query.trim();
  if (!cleanQuery) {
    return { results: catalogItems, source: 'mock' };
  }

  const url = `${GOOGLE_BOOKS_BASE_URL}?q=${encodeURIComponent(cleanQuery)}&maxResults=12&printType=books`;

  try {
    const response = await fetch(url, { signal });
    if (!response.ok) {
      return { results: searchMockMedia(cleanQuery), source: 'mock' };
    }

    const data = await response.json();
    const results = Array.isArray(data.items)
      ? data.items.map(mapGoogleBook)
      : [];

    return { results, source: 'google-books' };
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    return { results: searchMockMedia(cleanQuery), source: 'mock' };
  }
}
