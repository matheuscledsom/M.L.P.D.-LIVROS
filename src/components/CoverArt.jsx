import { domainConfig } from '../config/domainConfig';
import { CoverImage } from './CoverImage';

export function CoverArt({ item, className = '', showTitle = false, compact = false }) {
  if (!item) return null;

  const primaryBadge = item[domainConfig.cardFields.primary];
  const isbnFallback = item.isbn
    ? `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(item.isbn)}-L.jpg?default=false`
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
