import { useState } from 'react';
import { domainConfig } from '../config/domainConfig';

export function CoverArt({ item, className = '', showTitle = false, compact = false }) {
  const [imgError, setImgError] = useState(false);
  const [baseColor = '#141414', accentColor = '#8B5CF6', secondaryColor = '#38BDF8'] =
    item.palette || [];

  const monogram = item.monogram || item.title?.slice(0, 2).toUpperCase() || 'OB';
  const primaryBadge = item[domainConfig.cardFields.primary];

  return (
    <div
      className={`relative overflow-hidden bg-card border border-line select-none ${className}`}
      style={{
        background: `radial-gradient(circle at 80% 18%, ${accentColor}44 0%, transparent 55%), radial-gradient(circle at 18% 85%, ${secondaryColor}26 0%, transparent 50%), linear-gradient(155deg, ${baseColor} 0%, #0A0A0A 100%)`,
      }}
    >
      {item.coverUrl && !imgError ? (
        <>
          <img
            src={item.coverUrl}
            alt={item.title}
            onError={() => setImgError(true)}
            className="h-full w-full object-cover"
            loading="lazy"
          />
          {showTitle && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent p-2 pt-6">
              <p className="line-clamp-2 text-[10px] font-medium leading-tight text-white/95">
                {item.title}
              </p>
            </div>
          )}
        </>
      ) : (
        <>
          <div
            className="pointer-events-none absolute -right-4 -top-4 h-20 w-20 rounded-full blur-xl opacity-45"
            style={{ backgroundColor: accentColor }}
          />
          <div className="absolute inset-0 flex flex-col justify-between p-2.5">
            <div className="flex items-center justify-between">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: accentColor }}
              />
              {!compact && primaryBadge && (
                <span className="rounded bg-black/50 px-1.5 py-0.5 text-[9px] font-medium tracking-wider text-neutral-300 backdrop-blur-xs border border-white/10">
                  {primaryBadge}
                </span>
              )}
            </div>

            <div className="my-auto flex items-center justify-center">
              <span
                className={`font-bold tracking-tight text-white/90 ${
                  compact ? 'text-sm' : 'text-xl'
                }`}
                style={{ textShadow: `0 0 18px ${accentColor}66` }}
              >
                {monogram}
              </span>
            </div>

            {showTitle ? (
              <p className="line-clamp-2 text-[10px] font-medium leading-tight text-white/90">
                {item.title}
              </p>
            ) : (
              <div className="h-0.5 w-5 rounded-full bg-white/20" />
            )}
          </div>
        </>
      )}
    </div>
  );
}
