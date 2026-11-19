import { domainConfig } from '../config/domainConfig';
import { CoverImage } from './CoverImage';

export function CoverArt({ item, className = '', showTitle = false, compact = false }) {
  if (!item) return null;

  const primaryBadge = item[domainConfig.cardFields.primary];
  const cleanIsbn = String(item.isbn || '').replace(/[-\s]/g, '').trim();
  const isbnFallback = cleanIsbn
    ? `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(cleanIsbn)}-L.jpg?default=false`
    : null;

  const sources = [
    ...(Array.isArray(item.coverSources) ? item.coverSources : []),
    item.coverUrl,
    isbnFallback,
  ].filter(Boolean);

  return (
    <CoverImage
      sources={sources}
      title={item.title}
      author={item[domainConfig.cardFields.creator]}
      workType={item.workType || 'book'}
      palette={item.palette}
      badge={primaryBadge}
      className={className}
      showTitle={showTitle}
      compact={compact}
    />
  );
}
