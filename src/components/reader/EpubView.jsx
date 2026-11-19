import ePub from 'epubjs';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import {
  getHighlightColorMeta,
  resolveReaderDomColors,
} from '../../utils/readerThemes';
import { FONT_PRESETS } from '../../utils/themeTokens';

function getMarginHorizontal(marginLevel) {
  if (marginLevel === 'compact') return '12px';
  if (marginLevel === 'wide') return '48px';
  return '24px';
}

export const EpubView = forwardRef(function EpubView(
  {
    fileBlob,
    settings,
    activeTheme,
    initialCfi = '',
    workTotalPages = 0,
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
  const chapterLabelRef = useRef('');
  const tocFlatRef = useRef([]);
  const locationsReadyRef = useRef(false);
  const appliedHighlightsRef = useRef(new Map());
  const highlightsRef = useRef(highlights);
  const activeThemeRef = useRef(activeTheme);
  const workTotalPagesRef = useRef(workTotalPages);

  highlightsRef.current = highlights;
  activeThemeRef.current = activeTheme;
  workTotalPagesRef.current = workTotalPages;

  useEffect(() => {
    if (initialCfi && !renditionRef.current) {
      currentCfiRef.current = initialCfi;
    }
  }, [initialCfi]);

  const applyReaderStyles = useCallback(
    (rendition) => {
      if (!rendition) return;
      const colors = resolveReaderDomColors(activeTheme);
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
          'max-width': '68ch !important',
          'margin-left': 'auto !important',
          'margin-right': 'auto !important',
          'padding-left': `${hPad} !important`,
          'padding-right': `${hPad} !important`,
          'padding-top': '56px !important',
          'padding-bottom': '84px !important',
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

  const syncAnnotations = useCallback((rendition, hlList, isLight) => {
    if (!rendition?.annotations) return;
    const validByCfi = new Map();
    (hlList || []).forEach((hl) => {
      if (hl?.cfi) {
        validByCfi.set(hl.cfi, getHighlightColorMeta(hl.color));
      }
    });

    // Remove marcações excluídas ou com cor alterada
    Array.from(appliedHighlightsRef.current.entries()).forEach(([cfi, prevMeta]) => {
      const nextMeta = validByCfi.get(cfi);
      if (!nextMeta || prevMeta.id !== nextMeta.id || prevMeta.isLight !== isLight) {
        try {
          rendition.annotations.remove(cfi, 'highlight');
        } catch {
          // Ignora se já não estiver no DOM
        }
        appliedHighlightsRef.current.delete(cfi);
      }
    });

    // Aplica novas ou atualizadas
    validByCfi.forEach((colorMeta, cfi) => {
      if (appliedHighlightsRef.current.has(cfi)) return;
      try {
        rendition.annotations.highlight(cfi, {}, undefined, 'codice-hl', {
          fill: colorMeta.epubFill,
          'fill-opacity': isLight ? '0.28' : '0.20',
          'mix-blend-mode': isLight ? 'multiply' : 'normal',
        });
        appliedHighlightsRef.current.set(cfi, { id: colorMeta.id, isLight });
      } catch {
        // Ignora CFI incompatível
      }
    });
  }, []);

  useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition) return;
    const { isLight } = resolveReaderDomColors(activeTheme);
    syncAnnotations(rendition, highlights, isLight);
  }, [highlights, activeTheme, syncAnnotations]);

  useEffect(() => {
    applyReaderStyles(renditionRef.current);
  }, [applyReaderStyles]);

  useEffect(() => {
    if (!fileBlob || !viewerRef.current) return undefined;
    let cancelled = false;
    let bookInstance = null;
    let renditionInstance = null;
    appliedHighlightsRef.current.clear();

    const computePageTelemetry = (cfi, locationObj) => {
      const displayedPage = Math.max(1, locationObj?.start?.displayed?.page || 1);
      const displayedTotal = Math.max(
        displayedPage,
        locationObj?.start?.displayed?.total || 1
      );

      let rawFraction = 0;
      if (locationsReadyRef.current && bookInstance?.locations?.length()) {
        rawFraction = bookInstance.locations.percentageFromCfi(cfi) || 0;
      } else if (typeof locationObj?.start?.percentage === 'number') {
        rawFraction = locationObj.start.percentage;
      } else if (displayedTotal > 0) {
        rawFraction = displayedPage / displayedTotal;
      }

      const clampedFraction = Math.max(0, Math.min(1, rawFraction));
      const pct = Math.round(clampedFraction * 1000) / 10;

      const knownLocs = bookInstance?.locations?.length() || 0;
      const explicitTotal = Number(workTotalPagesRef.current) || 0;
      const wholeBookTotal =
        explicitTotal > 0
          ? explicitTotal
          : knownLocs > 0
            ? knownLocs
            : displayedTotal;
      const wholeBookPage =
        wholeBookTotal > 0
          ? Math.max(
              1,
              Math.min(
                wholeBookTotal,
                clampedFraction >= 0.999
                  ? wholeBookTotal
                  : Math.round(clampedFraction * wholeBookTotal) || 1
              )
            )
          : displayedPage;

      return {
        page: wholeBookPage,
        totalPages: wholeBookTotal,
        chapterPage: displayedPage,
        chapterTotalPages: displayedTotal,
        progressPct: pct,
      };
    };

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

          const href = location?.start?.href || '';
          const matchedToc = tocFlatRef.current.find(
            (n) =>
              n.href &&
              (href.includes(n.href.split('#')[0]) || n.href.includes(href))
          );
          chapterLabelRef.current = matchedToc?.label || '';

          const metrics = computePageTelemetry(cfi, location);
          onPositionChange?.({
            cfi,
            href,
            ...metrics,
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
              location: chapterLabelRef.current || '',
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

        // Reaplica imediatamente todos os destaques salvos ao abrir o livro
        const { isLight } = resolveReaderDomColors(activeThemeRef.current);
        syncAnnotations(renditionInstance, highlightsRef.current, isLight);

        const nav = await bookInstance.loaded.navigation;
        const rawToc = Array.isArray(nav?.toc) ? nav.toc : [];
        const flatten = (nodes) =>
          nodes.flatMap((n) => [
            { id: n.id, label: String(n.label || '').trim(), href: n.href },
            ...(Array.isArray(n.subitems) ? flatten(n.subitems) : []),
          ]);
        tocFlatRef.current = flatten(rawToc);

        bookInstance.locations
          .generate(1200)
          .then(() => {
            if (cancelled) return;
            locationsReadyRef.current = true;
            if (currentCfiRef.current && bookInstance.locations?.length()) {
              const metrics = computePageTelemetry(currentCfiRef.current, null);
              onPositionChange?.({
                cfi: currentCfiRef.current,
                ...metrics,
              });
            }
            const enrichToc = (nodes) =>
              nodes.map((node) => {
                let pct = 0;
                try {
                  const spineItem = bookInstance.spine.get(node.href);
                  if (spineItem?.cfiBase) {
                    pct =
                      Math.round(
                        (bookInstance.locations.percentageFromCfi(
                          `epubcfi(${spineItem.cfiBase}!/4/1:0)`
                        ) || 0) * 1000
                      ) / 10;
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
      style={{ background: resolveReaderDomColors(activeTheme).bg }}
    >
      <div ref={viewerRef} className="h-full w-full" />
    </div>
  );
});
