import { domainConfig } from '../config/domainConfig';
import { CoverImage } from './CoverImage';

export function CoverArt({ item, className = '', showTitle = false, compact = false }) {
  if (!item) return null;

  const primaryBadge = item[domainConfig.cardFields.primary];
  const cleanIsbn = String(item.isbn || '').replace(/[-\s]/g, '').trim();
  const isbnFallback = cleanIsbn
    ? `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(cleanIsbn)}-L.jpg?default=false`
    : null;

  const googleId =
    item.googleVolumeId ||
    (String(item.id || '').startsWith('gb-') ? String(item.id).slice(3) : '');
  const googleFallback = googleId
    ? `https://books.google.com/books/content?id=${encodeURIComponent(googleId)}&printsec=frontcover&img=1&zoom=1`
    : null;

  const sources = [
    ...(Array.isArray(item.coverCandidates) ? item.coverCandidates : []),
    ...(Array.isArray(item.coverSources) ? item.coverSources : []),
    item.coverUrl,
    item.googleCoverUrl,
    googleFallback,
    isbnFallback,
    item.openLibIdCover,
    ...(Array.isArray(item.jikanCoverUrls) ? item.jikanCoverUrls : []),
  ].filter(Boolean);

  return (
    <CoverImage
      sources={sources}
      title={item.title}
      author={item[domainConfig.cardFields.creator]}
      workType={item.workType || 'book'}
      genre={Array.isArray(item.genres) ? item.genres[0] || '' : ''}
      badge={primaryBadge}
      className={className}
      showTitle={showTitle}
      compact={compact}
    />
  );
}
