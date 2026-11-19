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
  palette = [],
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

  const [
    baseColor = '#141414',
    accentColor = '#8B5CF6',
    secondaryColor = '#38BDF8',
  ] = palette || [];

  const FallbackIcon = WORK_ICONS[workType] || BookOpen;

  const handleImageError = () => {
    setLoadedSrc(null);
    setActiveIndex((prev) => prev + 1);
  };

  return (
    <div
      className={`relative aspect-[2/3] overflow-hidden border border-line bg-card select-none ${className}`}
      style={{
        background: `radial-gradient(circle at 80% 18%, ${accentColor}38 0%, transparent 55%), radial-gradient(circle at 18% 85%, ${secondaryColor}22 0%, transparent 50%), linear-gradient(155deg, ${baseColor} 0%, #0A0A0A 100%)`,
      }}
    >
      {/* Capa vetorial minimalista exibida quando sem imagem ou durante carregamento */}
      <div
        className={`absolute inset-0 flex flex-col justify-between p-2.5 transition-opacity duration-200 ${
          isLoaded ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        <div className="flex items-center justify-between gap-1">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 bg-black/40 text-accent backdrop-blur-xs">
            <FallbackIcon className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
          </span>
          {!compact && badge && (
            <span className="truncate rounded bg-black/50 px-1.5 py-0.5 text-[9px] font-medium tracking-wider text-neutral-300 border border-white/10">
              {badge}
            </span>
          )}
        </div>

        <div className="space-y-1">
          {title && (
            <p
              className={`font-semibold leading-tight text-white/95 ${
                compact ? 'line-clamp-3 text-[10px]' : 'line-clamp-3 text-xs'
              }`}
            >
              {title}
            </p>
          )}
          {author && !compact && (
            <p className="line-clamp-1 text-[10px] text-white/65">{author}</p>
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
            onLoad={() => setLoadedSrc(currentSrc)}
            onError={handleImageError}
            className={`relative h-full w-full object-cover transition-opacity duration-200 ${
              isLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
          {showTitle && isLoaded && title && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent p-2 pt-6">
              <p className="line-clamp-2 text-[10px] font-medium leading-tight text-white/95">
                {title}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
