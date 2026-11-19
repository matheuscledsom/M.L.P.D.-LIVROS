import JSZip from 'jszip';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

const IMAGE_EXT_REGEX = /\.(jpe?g|png|webp|gif|bmp|avif)$/i;

export function sortComicEntriesNaturally(names = []) {
  return [...names].sort((a, b) =>
    String(a).localeCompare(String(b), undefined, {
      numeric: true,
      sensitivity: 'base',
    })
  );
}

function ComicWebtoonImage({ entryName, getImageUrl, fitClass, onRegisterRef }) {
  const containerRef = useRef(null);
  const [src, setSrc] = useState(null);

  useEffect(() => {
    onRegisterRef?.(entryName, containerRef.current);
    return () => onRegisterRef?.(entryName, null);
  }, [entryName, onRegisterRef]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    let active = true;

    const loadImg = async () => {
      const url = await getImageUrl(entryName);
      if (active && url) setSrc(url);
    };

    if (typeof IntersectionObserver === 'undefined') {
      loadImg();
      return () => {
        active = false;
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          loadImg();
        }
      },
      { rootMargin: '600px 0px' }
    );
    observer.observe(el);
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [entryName, getImageUrl]);

  return (
    <div
      ref={containerRef}
      className="flex min-h-[260px] w-full items-center justify-center"
    >
      {src ? (
        <img
          src={src}
          alt={entryName}
          className={`mx-auto block select-none ${fitClass}`}
          draggable={false}
        />
      ) : (
        <div className="h-[420px] w-full max-w-2xl animate-pulse rounded-xl bg-elevated/40" />
      )}
    </div>
  );
}

export const ComicView = forwardRef(function ComicView(
  {
    fileBlob,
    settings,
    activeTheme,
    initialPage = 1,
    onReady,
    onPositionChange,
    onTocReady,
    onError,
    onCenterTap,
  },
  ref
) {
  const scrollContainerRef = useRef(null);
  const zipRef = useRef(null);
  const urlCacheRef = useRef(new Map());
  const webtoonRefs = useRef(new Map());
  const lastTapRef = useRef(0);

  const [pages, setPages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(Math.max(0, (initialPage || 1) - 1));
  const [activeUrls, setActiveUrls] = useState({});
  const [isZoomed, setIsZoomed] = useState(false);

  const revokeAllUrls = useCallback(() => {
    urlCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
    urlCacheRef.current.clear();
  }, []);

  const getImageUrl = useCallback(async (entryName) => {
    if (!entryName || !zipRef.current) return null;
    if (urlCacheRef.current.has(entryName)) {
      const existing = urlCacheRef.current.get(entryName);
      urlCacheRef.current.delete(entryName);
      urlCacheRef.current.set(entryName, existing);
      return existing;
    }

    const zipEntry = zipRef.current.file(entryName);
    if (!zipEntry) return null;
    const blob = await zipEntry.async('blob');
    const url = URL.createObjectURL(blob);
    urlCacheRef.current.set(entryName, url);

    // Mantém janela enxuta em memória e revoga URLs antigas
    while (urlCacheRef.current.size > 10) {
      const oldestKey = urlCacheRef.current.keys().next().value;
      const oldestUrl = urlCacheRef.current.get(oldestKey);
      urlCacheRef.current.delete(oldestKey);
      if (oldestUrl) URL.revokeObjectURL(oldestUrl);
    }

    return url;
  }, []);

  useEffect(() => {
    if (!fileBlob) return undefined;
    let cancelled = false;
    revokeAllUrls();

    const loadArchive = async () => {
      try {
        const zip = await JSZip.loadAsync(fileBlob);
        if (cancelled) return;
        zipRef.current = zip;

        const imageEntries = Object.keys(zip.files).filter((name) => {
          const entry = zip.files[name];
          if (entry.dir) return false;
          if (name.startsWith('__MACOSX/') || name.split('/').pop()?.startsWith('._')) {
            return false;
          }
          return IMAGE_EXT_REGEX.test(name);
        });

        const sorted = sortComicEntriesNaturally(imageEntries);
        if (sorted.length === 0) {
          onError?.('Nenhuma imagem válida encontrada dentro deste arquivo CBZ.');
          return;
        }

        setPages(sorted);
        const startIdx = Math.max(
          0,
          Math.min(sorted.length - 1, (Number(initialPage) || 1) - 1)
        );
        setCurrentIndex(startIdx);

        onTocReady?.(
          sorted
            .filter((_, idx) => idx === 0 || idx % 20 === 0)
            .map((name, i) => {
              const pageIdx = i === 0 ? 0 : i * 20;
              return {
                id: `cbz-sec-${pageIdx}`,
                label: `Página ${pageIdx + 1}`,
                page: pageIdx + 1,
                pct: Math.round(((pageIdx + 1) / sorted.length) * 100),
              };
            })
        );

        onPositionChange?.({
          page: startIdx + 1,
          totalPages: sorted.length,
          progressPct: Math.round(((startIdx + 1) / sorted.length) * 100),
        });

        onReady?.();
      } catch {
        if (!cancelled) {
          onError?.(
            'Não foi possível abrir este arquivo CBZ. Ele pode estar corrompido ou em formato RAR.'
          );
        }
      }
    };

    loadArchive();
    return () => {
      cancelled = true;
      revokeAllUrls();
    };
  }, [fileBlob, revokeAllUrls]);

  // Pré-carrega página(s) atual(is) + próximas 2 imagens
  useEffect(() => {
    if (pages.length === 0 || settings.cbzMode === 'webtoon') return undefined;
    let cancelled = false;

    const preload = async () => {
      const indicesToLoad = [
        currentIndex,
        ...(settings.cbzMode === 'double' ? [currentIndex + 1] : []),
        currentIndex + 1,
        currentIndex + 2,
      ].filter((idx) => idx >= 0 && idx < pages.length);

      const loadedMap = {};
      for (const idx of indicesToLoad) {
        const name = pages[idx];
        const url = await getImageUrl(name);
        if (!cancelled && url) {
          loadedMap[name] = url;
        }
      }
      if (!cancelled) {
        setActiveUrls((prev) => ({ ...prev, ...loadedMap }));
      }
    };

    preload();
    return () => {
      cancelled = true;
    };
  }, [pages, currentIndex, settings.cbzMode, getImageUrl]);

  const goToIndex = useCallback(
    (nextIdx) => {
      if (pages.length === 0) return;
      const clamped = Math.max(0, Math.min(pages.length - 1, nextIdx));
      setCurrentIndex(clamped);
      setIsZoomed(false);
      onPositionChange?.({
        page: clamped + 1,
        totalPages: pages.length,
        progressPct: Math.round(((clamped + 1) / pages.length) * 100),
      });

      if (settings.cbzMode === 'webtoon') {
        const targetEl = webtoonRefs.current.get(pages[clamped]);
        targetEl?.scrollIntoView({ behavior: 'auto', block: 'start' });
      }
    },
    [pages, settings.cbzMode, onPositionChange]
  );

  const stepSize = settings.cbzMode === 'double' ? 2 : 1;
  const isRtl = settings.cbzDirection === 'rtl';

  useImperativeHandle(
    ref,
    () => ({
      goToPercent: (pct) => {
        if (!pages.length) return;
        const idx = Math.round(((pct / 100) * (pages.length - 1)));
        goToIndex(idx);
      },
      goToChapter: (node) => {
        if (node?.page) goToIndex(node.page - 1);
      },
      goToPage: (pageNum) => goToIndex(pageNum - 1),
      nextPage: () =>
        goToIndex(isRtl ? currentIndex - stepSize : currentIndex + stepSize),
      prevPage: () =>
        goToIndex(isRtl ? currentIndex + stepSize : currentIndex - stepSize),
      searchText: async () => [],
    }),
    [pages.length, currentIndex, stepSize, isRtl, goToIndex]
  );

  const registerWebtoonRef = useCallback((name, el) => {
    if (el) webtoonRefs.current.set(name, el);
    else webtoonRefs.current.delete(name);
  }, []);

  const handleWebtoonScroll = () => {
    if (settings.cbzMode !== 'webtoon' || !scrollContainerRef.current || !pages.length) {
      return;
    }
    const rect = scrollContainerRef.current.getBoundingClientRect();
    const midY = rect.top + rect.height * 0.4;
    let closestIdx = currentIndex;
    let minDist = Infinity;

    pages.forEach((name, idx) => {
      const el = webtoonRefs.current.get(name);
      if (!el) return;
      const r = el.getBoundingClientRect();
      const dist = Math.abs(r.top - midY);
      if (dist < minDist) {
        minDist = dist;
        closestIdx = idx;
      }
    });

    if (closestIdx !== currentIndex) {
      setCurrentIndex(closestIdx);
      onPositionChange?.({
        page: closestIdx + 1,
        totalPages: pages.length,
        progressPct: Math.round(((closestIdx + 1) / pages.length) * 100),
      });
    }
  };

  const handleTap = (e) => {
    const now = Date.now();
    if (now - lastTapRef.current < 260) {
      setIsZoomed((prev) => !prev);
      lastTapRef.current = 0;
      return;
    }
    lastTapRef.current = now;

    if (settings.cbzMode === 'webtoon') {
      onCenterTap?.();
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;

    if (xRatio < 0.25) {
      goToIndex(isRtl ? currentIndex + stepSize : currentIndex - stepSize);
    } else if (xRatio > 0.75) {
      goToIndex(isRtl ? currentIndex - stepSize : currentIndex + stepSize);
    } else {
      onCenterTap?.();
    }
  };

  const fitClass =
    settings.cbzFit === 'height'
      ? 'max-h-[calc(100vh-110px)] w-auto object-contain'
      : settings.cbzFit === 'original'
        ? 'max-w-none w-auto h-auto'
        : 'w-full max-w-4xl h-auto object-contain';

  const firstPageName = pages[currentIndex];
  const secondPageName =
    settings.cbzMode === 'double' && currentIndex + 1 < pages.length
      ? pages[currentIndex + 1]
      : null;

  const spreadPages = secondPageName
    ? isRtl
      ? [secondPageName, firstPageName]
      : [firstPageName, secondPageName]
    : firstPageName
      ? [firstPageName]
      : [];

  return (
    <div
      ref={scrollContainerRef}
      onScroll={handleWebtoonScroll}
      onClick={handleTap}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setIsZoomed((prev) => !prev);
      }}
      className="h-full w-full overflow-auto px-2 pt-14 pb-20 no-scrollbar"
      style={{ background: activeTheme.bg }}
    >
      {settings.cbzMode === 'webtoon' ? (
        <div className="mx-auto flex max-w-3xl flex-col gap-1">
          {pages.map((entryName) => (
            <ComicWebtoonImage
              key={entryName}
              entryName={entryName}
              getImageUrl={getImageUrl}
              fitClass={fitClass}
              onRegisterRef={registerWebtoonRef}
            />
          ))}
        </div>
      ) : (
        <div
          className={`mx-auto flex min-h-full items-center justify-center gap-1 transition-transform duration-200 ${
            isZoomed ? 'scale-175 origin-center cursor-zoom-out' : 'cursor-pointer'
          }`}
        >
          {spreadPages.map((name) =>
            activeUrls[name] ? (
              <img
                key={name}
                src={activeUrls[name]}
                alt={name}
                className={`${fitClass} ${
                  spreadPages.length === 2 ? 'max-w-[49%]' : ''
                } select-none rounded-md`}
                draggable={false}
              />
            ) : (
              <div
                key={name}
                className="h-[70vh] w-full max-w-xl animate-pulse rounded-xl bg-elevated/40"
              />
            )
          )}
        </div>
      )}
    </div>
  );
});
