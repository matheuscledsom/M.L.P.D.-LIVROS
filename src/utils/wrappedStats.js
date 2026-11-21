import { domainConfig } from '../config/domainConfig.js';
import { getPagesRead } from './backlogHelpers.js';

export function buildWrappedSummary({
  items = [],
  streakCount = 0,
  period = 'year',
  targetYear = domainConfig.currentYear,
} = {}) {
  const safeItems = (Array.isArray(items) ? items : []).filter(
    (i) => i && i.inBacklog !== false
  );

  const scopedItems =
    period === 'all'
      ? safeItems
      : safeItems.filter((item) => {
          const compYear = Number(
            item.completedYear ||
              (item.completedDate ? String(item.completedDate).slice(0, 4) : 0)
          );
          if (compYear === targetYear) return true;
          return (
            item.status === 'playing' &&
            String(item.updatedAt || '').startsWith(String(targetYear))
          );
        });

  const completed = scopedItems.filter((i) => i.status === 'completed');
  const pagesRead = scopedItems.reduce((sum, i) => sum + getPagesRead(i), 0);

  const genreCounts = new Map();
  const authorCounts = new Map();

  scopedItems.forEach((item) => {
    if (Array.isArray(item.genres)) {
      item.genres.forEach((g) => {
        const clean = String(g || '').trim();
        if (clean) genreCounts.set(clean, (genreCounts.get(clean) || 0) + 1);
      });
    }
    const creator = String(item.author || '').trim();
    if (creator) {
      creator
        .split(/[;,]/)
        .map((a) => a.trim())
        .filter(Boolean)
        .forEach((a) => authorCounts.set(a, (authorCounts.get(a) || 0) + 1));
    }
  });

  const topGenre =
    Array.from(genreCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ||
    'Leitura Livre';
  const topAuthor =
    Array.from(authorCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ||
    'Autorias diversas';

  const rated = completed
    .filter((i) => typeof i.rating === 'number')
    .sort((a, b) => (b.rating || 0) - (a.rating || 0));

  const topWork = rated[0] || completed[0] || scopedItems[0] || null;

  const avgRating = rated.length
    ? Math.round(rated.reduce((s, i) => s + (i.rating || 0), 0) / rated.length)
    : null;

  return {
    periodLabel: period === 'all' ? 'Acervo Completo' : `Retrospectiva ${targetYear}`,
    totalScopedCount: scopedItems.length,
    completedCount: completed.length,
    pagesRead,
    topGenre,
    topAuthor,
    topWorkTitle: topWork?.title || 'Sua Próxima História',
    avgRating,
    streakCount: Math.max(0, Number(streakCount) || 0),
  };
}
