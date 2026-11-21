import { hashString32 } from './dominantColor.js';

export function computeSpineMetrics(item = {}) {
  const hash = hashString32(`${item.id || ''}:${item.title || ''}:${item.workType || 'book'}`);
  const workType = item.workType || 'book';

  const pages =
    workType === 'manga'
      ? (Number(item.totalChapters) || Number(item.currentChapter) || 12) * 18
      : Number(item.totalPages) || Number(item.currentPage) || 260;

  const rawWidth = 32 + Math.min(26, Math.round(pages / 32)) + (hash % 3);
  const width = Math.max(32, Math.min(60, rawWidth));

  const baseHeight = workType === 'manga' ? 164 : workType === 'academic' ? 192 : 178;
  const height = Math.max(162, Math.min(214, baseHeight + (hash % 21)));

  return { width, height };
}
