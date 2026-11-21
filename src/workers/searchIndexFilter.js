const HYPE_WEIGHT_MAP = {
  urgent: 4,
  'very-high': 3,
  high: 2,
  medium: 1,
  low: 0,
};

export function filterAndSortItemsSync(items = [], params = {}) {
  const {
    selectedStatus = 'all',
    selectedWorkType = 'all',
    selectedCollectionId = 'all',
    selectedGenre = 'all',
    selectedFormat = 'all',
    query = '',
    sortBy = 'recent',
    creatorField = 'author',
    ratingField = 'rating',
  } = params;

  const q = String(query || '').trim().toLowerCase();

  const filtered = (Array.isArray(items) ? items : []).filter((item) => {
    if (!item || item.inBacklog === false) return false;
    if (selectedStatus !== 'all' && item.status !== selectedStatus) return false;
    if (selectedWorkType !== 'all' && (item.workType || 'book') !== selectedWorkType) {
      return false;
    }
    if (selectedCollectionId !== 'all') {
      const cols = Array.isArray(item.collectionIds) ? item.collectionIds.map(String) : [];
      if (!cols.includes(String(selectedCollectionId))) return false;
    }
    if (selectedGenre !== 'all') {
      const genres = Array.isArray(item.genres) ? item.genres : [];
      if (!genres.some((g) => String(g || '').trim() === selectedGenre)) return false;
    }
    if (selectedFormat !== 'all' && String(item.format || '').trim() !== selectedFormat) {
      return false;
    }
    if (!q) return true;

    const inTitle = String(item.title || '').toLowerCase().includes(q);
    const inOrig = String(item.originalTitle || '').toLowerCase().includes(q);
    const inAuthor = String(item[creatorField] || '').toLowerCase().includes(q);
    const inPub = String(item.publisher || '').toLowerCase().includes(q);
    const inIsbn = String(item.isbn || '').toLowerCase().includes(q);
    const inCall = String(item.callNumber || '').toLowerCase().includes(q);
    const inGenres = Array.isArray(item.genres)
      ? item.genres.some((g) => String(g).toLowerCase().includes(q))
      : false;
    return inTitle || inOrig || inAuthor || inPub || inIsbn || inCall || inGenres;
  });

  return [...filtered].sort((a, b) => {
    if (sortBy === 'rating') {
      const rA = typeof a[ratingField] === 'number' ? a[ratingField] : -1;
      const rB = typeof b[ratingField] === 'number' ? b[ratingField] : -1;
      return rB - rA;
    }
    if (sortBy === 'hype') {
      return (HYPE_WEIGHT_MAP[b.hype] ?? 0) - (HYPE_WEIGHT_MAP[a.hype] ?? 0);
    }
    if (sortBy === 'pages') {
      const pA = Number(a.currentPage) || Number(a.totalPages) || Number(a.currentChapter) || 0;
      const pB = Number(b.currentPage) || Number(b.totalPages) || Number(b.currentChapter) || 0;
      return pB - pA;
    }
    if (sortBy === 'title') {
      return String(a.title || '').localeCompare(String(b.title || ''), 'pt-BR');
    }
    const timeA = Date.parse(a.updatedAt || a.createdAt || '') || 0;
    const timeB = Date.parse(b.updatedAt || b.createdAt || '') || 0;
    return timeB - timeA;
  });
}
