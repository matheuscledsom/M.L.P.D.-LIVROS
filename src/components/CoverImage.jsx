import { BookOpen, GraduationCap, Layers } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const WORK_ICONS = {
  book: BookOpen,
  manga: Layers,
  academic: GraduationCap,
};

export function CoverImage({
  sources = [],
  title = '',
  author = '',
  workType = 'book',
  className = '',
  showTitle = false,
  compact = false,
  badge = null,
}) {
  const cleanSources = useMemo(() => {
    const list = Array.isArray(sources) ? sources : [sources];
    return Array.from(
      new Set(
        list
          .filter((url) => typeof url === 'string' && url.trim().length > 0)
          .map((url) => url.trim())
      )
    );
  }, [sources]);

  const sourcesKey = cleanSources.join('|');
  const [activeIndex, setActiveIndex] = useState(0);
  const [loadedSrc, setLoadedSrc] = useState(null);

  useEffect(() => {
    setActiveIndex(0);
    setLoadedSrc(null);
  }, [sourcesKey]);

  const currentSrc =
    activeIndex < cleanSources.length ? cleanSources[activeIndex] : null;
  const isLoaded = Boolean(currentSrc && loadedSrc === currentSrc);

  const FallbackIcon = WORK_ICONS[workType] || BookOpen;

  const handleImageError = () => {
    setLoadedSrc(null);
    setActiveIndex((prev) => prev + 1);
  };

  return (
    <div
      className={`relative aspect-[2/3] overflow-hidden border border-line bg-card select-none ${className}`}
      style={{
        backgroundImage:
          'radial-gradient(circle at 82% 16%, color-mix(in srgb, var(--accent-color) 32%, transparent) 0%, transparent 58%), radial-gradient(circle at 18% 86%, color-mix(in srgb, var(--accent-color) 16%, transparent) 0%, transparent 52%), linear-gradient(155deg, color-mix(in srgb, var(--accent-color) 14%, var(--bg-card)) 0%, var(--bg-app) 100%)',
      }}
    >
      {/* Capa tipográfica vetorial derivada de --accent-color exibida como fallback ou durante o carregamento */}
      <div
        className={`absolute inset-0 flex flex-col justify-between p-2.5 transition-opacity duration-200 ${
          isLoaded ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        <div className="flex items-center justify-between gap-1">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-line bg-app/75 text-accent backdrop-blur-xs">
            <FallbackIcon
              className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'}
              strokeWidth={1.5}
            />
          </span>
          {!compact && badge && (
            <span className="truncate rounded border border-line bg-app/80 px-1.5 py-0.5 text-[10px] font-medium tracking-wider text-muted">
              {badge}
            </span>
          )}
        </div>

        <div className="space-y-1">
          {title && (
            <p
              className={`font-semibold leading-tight text-ink ${
                compact ? 'line-clamp-3 text-[10px]' : 'line-clamp-3 text-xs'
              }`}
            >
              {title}
            </p>
          )}
          {author && !compact && (
            <p className="line-clamp-1 text-[10px] text-muted">{author}</p>
          )}
        </div>
      </div>

      {currentSrc && (
        <>
          <img
            key={currentSrc}
            src={currentSrc}
            alt={title || 'Capa da obra'}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onLoad={(e) => {
              if (
                e.currentTarget.naturalWidth <= 1 ||
                e.currentTarget.naturalHeight <= 1
              ) {
                handleImageError();
                return;
              }
              setLoadedSrc(currentSrc);
            }}
            onError={handleImageError}
            className={`relative h-full w-full object-cover transition-opacity duration-200 ${
              isLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
          {showTitle && isLoaded && title && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent p-2 pt-6">
              <p className="line-clamp-2 text-[10px] font-medium leading-tight text-white">
                {title}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
