import ePub from 'epubjs';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import { FONT_PRESETS } from '../../utils/themeTokens';

function resolveThemeColors(activeTheme) {
  if (!activeTheme?.followApp) {
    return {
      bg: activeTheme?.bg || '#000000',
      ink: activeTheme?.ink || '#F4F4F5',
      muted: activeTheme?.muted || '#A1A1AA',
    };
  }
  const style = getComputedStyle(document.documentElement);
  return {
    bg: style.getPropertyValue('--bg-app').trim() || '#000000',
    ink: style.getPropertyValue('--text-primary').trim() || '#FFFFFF',
    muted: style.getPropertyValue('--text-muted').trim() || '#B5B5BD',
  };
}

function getMarginHorizontal(marginLevel) {
  if (marginLevel === 'compact') return '12px';
  if (marginLevel === 'wide') return '40px';
  return '24px';
}

function resolveHighlightColor(colorKey) {
  if (colorKey === 'amber') return '#F59E0B';
  if (colorKey === 'emerald') return '#10B981';
  if (colorKey === 'rose') return '#F43F5E';
  return (
    getComputedStyle(document.documentElement)
      .getPropertyValue('--accent-color')
      .trim() || '#8B5CF6'
  );
}

export const EpubView = forwardRef(function EpubView(
  {
    fileBlob,
    settings,
    activeTheme,
    initialCfi = '',
    highlights = [],
    onReady,
    onPositionChange,
    onTocReady,
    onTextSelect,
    onError,
    onCenterTap,
  },
  ref
) {
  const viewerRef = useRef(null);
  const bookRef = useRef(null);
  const renditionRef = useRef(null);
  const currentCfiRef = useRef(initialCfi || '');
  const tocFlatRef = useRef([]);
  const locationsReadyRef = useRef(false);
  const appliedHighlightsRef = useRef(new Set());

  const applyReaderStyles = useCallback(
    (rendition) => {
      if (!rendition) return;
      const colors = resolveThemeColors(activeTheme);
      const fontPreset =
        FONT_PRESETS.find((f) => f.id === settings.fontId) || FONT_PRESETS[0];
      const fontFamily = activeTheme?.followApp
        ? getComputedStyle(document.documentElement)
            .getPropertyValue('--font-app')
            .trim() || fontPreset.cssValue
        : fontPreset.cssValue;
      const hPad = getMarginHorizontal(settings.marginLevel);

      rendition.themes.default({
        html: {
          background: `${colors.bg} !important`,
          color: `${colors.ink} !important`,
        },
        body: {
          background: `${colors.bg} !important`,
          color: `${colors.ink} !important`,
          'font-family': `${fontFamily} !important`,
          'font-size': `${settings.fontSizePct}% !important`,
          'line-height': `${settings.lineHeight} !important`,
          'max-width': '66ch !important',
          'margin-left': 'auto !important',
          'margin-right': 'auto !important',
          'padding-left': `${hPad} !important`,
          'padding-right': `${hPad} !important`,
          'padding-top': '56px !important',
          'padding-bottom': '80px !important',
          'text-align': settings.justify ? 'justify !important' : 'left !important',
          hyphens: settings.hyphenation ? 'auto !important' : 'none !important',
          '-webkit-hyphens': settings.hyphenation ? 'auto !important' : 'none !important',
        },
        'p, li, blockquote': {
          'margin-bottom': `${settings.paragraphSpacing}em !important`,
          color: `${colors.ink} !important`,
        },
        'h1, h2, h3, h4': {
          color: `${colors.ink} !important`,
          'line-height': '1.3 !important',
        },
        a: {
          color: `${colors.muted} !important`,
        },
        'img, svg, table': {
          'max-width': '100% !important',
          height: 'auto !important',
        },
      });
    },
    [activeTheme, settings]
  );

  // Sincroniza destaques no rendition
  useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition?.annotations) return;
    highlights.forEach((hl) => {
      if (!hl?.cfi || appliedHighlightsRef.current.has(hl.cfi)) return;
      try {
        rendition.annotations.highlight(hl.cfi, {}, undefined, 'codice-hl', {
          fill: resolveHighlightColor(hl.color),
          'fill-opacity': '0.32',
        });
        appliedHighlightsRef.current.add(hl.cfi);
      } catch {
        // Ignora CFI incompatível
      }
    });
  }, [highlights]);

  useEffect(() => {
    applyReaderStyles(renditionRef.current);
  }, [applyReaderStyles]);

  useEffect(() => {
    if (!fileBlob || !viewerRef.current) return undefined;
    let cancelled = false;
    let bookInstance = null;
    let renditionInstance = null;
    appliedHighlightsRef.current.clear();

    const init = async () => {
      try {
        const buffer = await fileBlob.arrayBuffer();
        if (cancelled) return;
        bookInstance = ePub(buffer);
        bookRef.current = bookInstance;

        await bookInstance.ready;
        if (cancelled) return;

        renditionInstance = bookInstance.renderTo(viewerRef.current, {
          width: '100%',
          height: '100%',
          flow: settings.epubFlow === 'scrolled' ? 'scrolled-doc' : 'paginated',
          spread: 'none',
          allowScriptedContent: false,
        });
        renditionRef.current = renditionInstance;

        applyReaderStyles(renditionInstance);

        renditionInstance.on('relocated', (location) => {
          const cfi = location?.start?.cfi || '';
          currentCfiRef.current = cfi;

          let pct = 0;
          if (locationsReadyRef.current && bookInstance.locations?.length()) {
            const rawPct = bookInstance.locations.percentageFromCfi(cfi);
            pct = Math.max(0, Math.min(100, Math.round((rawPct || 0) * 100)));
          } else if (typeof location?.start?.percentage === 'number') {
            pct = Math.max(0, Math.min(100, Math.round(location.start.percentage * 100)));
          }

          const href = location?.start?.href || '';
          const matchedToc = tocFlatRef.current.find(
            (n) => n.href && (href.includes(n.href.split('#')[0]) || n.href.includes(href))
          );

          onPositionChange?.({
            cfi,
            href,
            page: location?.start?.displayed?.page || 1,
            totalPages: location?.start?.displayed?.total || 1,
            progressPct: pct,
            chapterLabel: matchedToc?.label || '',
          });
        });

        renditionInstance.on('selected', (cfiRange, contents) => {
          const selection = contents?.window?.getSelection?.();
          const text = selection ? String(selection.toString() || '').trim() : '';
          if (text) {
            onTextSelect?.({
              text,
              cfi: cfiRange,
              location: '',
            });
          }
        });

        renditionInstance.on('click', (event) => {
          const win = event?.view;
          const selectedStr = win?.getSelection?.()?.toString()?.trim();
          if (selectedStr) return;

          if (settings.epubFlow === 'scrolled') {
            onCenterTap?.();
            return;
          }

          const width = viewerRef.current?.clientWidth || window.innerWidth;
          const x = event.clientX ?? width / 2;
          if (x < width * 0.25) {
            renditionInstance.prev();
          } else if (x > width * 0.75) {
            renditionInstance.next();
          } else {
            onCenterTap?.();
          }
        });

        try {
          await renditionInstance.display(currentCfiRef.current || undefined);
        } catch {
          await renditionInstance.display();
        }
        if (cancelled) return;

        // Carrega TOC
        const nav = await bookInstance.loaded.navigation;
        const rawToc = Array.isArray(nav?.toc) ? nav.toc : [];
        const flatten = (nodes) =>
          nodes.flatMap((n) => [
            { id: n.id, label: String(n.label || '').trim(), href: n.href },
            ...(Array.isArray(n.subitems) ? flatten(n.subitems) : []),
          ]);
        tocFlatRef.current = flatten(rawToc);

        // Gera locations em segundo plano para scrubber e %
        bookInstance.locations
          .generate(1200)
          .then(() => {
            if (cancelled) return;
            locationsReadyRef.current = true;
            if (currentCfiRef.current && bookInstance.locations?.length()) {
              const rawPct = bookInstance.locations.percentageFromCfi(
                currentCfiRef.current
              );
              const pct = Math.max(
                0,
                Math.min(100, Math.round((rawPct || 0) * 100))
              );
              onPositionChange?.({
                cfi: currentCfiRef.current,
                progressPct: pct,
              });
            }
            const enrichToc = (nodes) =>
              nodes.map((node) => {
                let pct = 0;
                try {
                  const spineItem = bookInstance.spine.get(node.href);
                  if (spineItem?.cfiBase) {
                    pct = Math.round(
                      (bookInstance.locations.percentageFromCfi(
                        `epubcfi(${spineItem.cfiBase}!/4/1:0)`
                      ) || 0) * 100
                    );
                  }
                } catch {
                  pct = 0;
                }
                return {
                  id: node.id || node.href,
                  label: String(node.label || '').trim(),
                  href: node.href,
                  pct,
                  subitems: Array.isArray(node.subitems)
                    ? enrichToc(node.subitems)
                    : [],
                };
              });
            onTocReady?.(enrichToc(rawToc));
          })
          .catch(() => {
            onTocReady?.(
              rawToc.map((n) => ({
                id: n.id || n.href,
                label: String(n.label || '').trim(),
                href: n.href,
                subitems: n.subitems || [],
              }))
            );
          });

        onReady?.();
      } catch {
        if (!cancelled) {
          onError?.(
            'Não foi possível abrir este EPUB. Verifique se o arquivo não está corrompido ou protegido por DRM.'
          );
        }
      }
    };

    init();

    return () => {
      cancelled = true;
      locationsReadyRef.current = false;
      try {
        renditionInstance?.destroy?.();
      } catch {
        // Ignora erro ao destruir rendition
      }
      try {
        bookInstance?.destroy?.();
      } catch {
        // Ignora erro ao destruir book
      }
    };
  }, [fileBlob, settings.epubFlow]);

  useImperativeHandle(
    ref,
    () => ({
      goToPercent: (pct) => {
        const book = bookRef.current;
        const rendition = renditionRef.current;
        if (!book || !rendition) return;
        if (locationsReadyRef.current && book.locations?.length()) {
          const cfi = book.locations.cfiFromPercentage(
            Math.max(0, Math.min(1, pct / 100))
          );
          if (cfi) rendition.display(cfi);
        } else if (book.spine?.length) {
          const idx = Math.min(
            book.spine.length - 1,
            Math.max(0, Math.floor((pct / 100) * book.spine.length))
          );
          rendition.display(idx);
        }
      },
      goToChapter: (node) => {
        if (node?.href) {
          renditionRef.current?.display(node.href);
        }
      },
      goToCfi: (cfi) => {
        if (cfi) {
          renditionRef.current?.display(cfi);
        }
      },
      nextPage: () => renditionRef.current?.next(),
      prevPage: () => renditionRef.current?.prev(),
      searchText: async (query) => {
        const book = bookRef.current;
        const clean = String(query || '').trim();
        if (!book || !clean) return [];
        const results = [];
        for (const item of book.spine.spineItems) {
          if (results.length >= 40) break;
          try {
            await item.load(book.load.bind(book));
            const matches = item.find(clean) || [];
            matches.forEach((m, idx) => {
              if (results.length < 40) {
                results.push({
                  id: `epub-match-${item.index}-${idx}`,
                  cfi: m.cfi,
                  label: item.idref || `Capítulo ${item.index + 1}`,
                  excerpt: String(m.excerpt || '').trim(),
                });
              }
            });
            item.unload();
          } catch {
            // Segue próximo item
          }
        }
        return results;
      },
    }),
    []
  );

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ background: resolveThemeColors(activeTheme).bg }}
    >
      <div ref={viewerRef} className="h-full w-full" />
    </div>
  );
});
