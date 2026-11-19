import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { resolveReaderDomColors } from '../../utils/readerThemes';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

function PdfPageCanvas({
  pdfDoc,
  pageNumber,
  scale,
  nightMode,
  isNearActive,
  onRegisterSlot,
}) {
  const slotRef = useRef(null);
  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);
  const [pageDims, setPageDims] = useState({ width: 600, height: 848 });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    onRegisterSlot?.(pageNumber, slotRef.current);
    return () => onRegisterSlot?.(pageNumber, null);
  }, [pageNumber, onRegisterSlot]);

  useEffect(() => {
    const el = slotRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsVisible(entry.isIntersecting);
        });
      },
      { rootMargin: '450px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const shouldRender = isVisible || isNearActive;

  useEffect(() => {
    if (!pdfDoc || !shouldRender) return undefined;
    let cancelled = false;

    const draw = async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (cancelled) return;
        const vp = page.getViewport({ scale });
        setPageDims({ width: vp.width, height: vp.height });

        const canvas = canvasRef.current;
        if (!canvas) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(vp.width * dpr);
        canvas.height = Math.floor(vp.height * dpr);
        canvas.style.width = `${vp.width}px`;
        canvas.style.height = `${vp.height}px`;

        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {
            // Ignora cancelamento prévio
          }
        }

        const task = page.render({ canvasContext: ctx, viewport: vp });
        renderTaskRef.current = task;
        await task.promise;
      } catch (err) {
        if (err?.name !== 'RenderingCancelledException') {
          // Ignora falha pontual de renderização
        }
      }
    };

    draw();
    return () => {
      cancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // Ignora cancelamento
        }
      }
    };
  }, [pdfDoc, pageNumber, scale, shouldRender]);

  return (
    <div
      ref={slotRef}
      data-page-number={pageNumber}
      className="mx-auto flex justify-center overflow-hidden rounded-[4px] border bg-white"
      style={{
        borderColor: 'var(--reader-border)',
        width: `${Math.round(pageDims.width)}px`,
        minHeight: `${Math.round(pageDims.height)}px`,
        filter: nightMode ? 'invert(0.88) hue-rotate(180deg) contrast(0.95)' : 'none',
      }}
    >
      {shouldRender ? (
        <canvas ref={canvasRef} className="block max-w-full" />
      ) : (
        <div
          className="flex w-full items-center justify-center text-xs tabular-nums"
          style={{
            height: `${Math.round(pageDims.height)}px`,
            backgroundColor: 'var(--reader-surface)',
            color: 'var(--reader-muted)',
          }}
        >
          Página {pageNumber}
        </div>
      )}
    </div>
  );
}

function PdfThumbnail({ pdfDoc, pageNumber, isActive, onSelect }) {
  const thumbRef = useRef(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    const canvas = thumbRef.current;
    if (!pdfDoc || !canvas || rendered) return undefined;
    let cancelled = false;
    const observer =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            async (entries) => {
              if (!entries.some((e) => e.isIntersecting) || cancelled) return;
              observer.disconnect();
              try {
                const page = await pdfDoc.getPage(pageNumber);
                if (cancelled) return;
                const vp = page.getViewport({ scale: 0.2 });
                canvas.width = Math.floor(vp.width);
                canvas.height = Math.floor(vp.height);
                const ctx = canvas.getContext('2d');
                await page.render({ canvasContext: ctx, viewport: vp }).promise;
                if (!cancelled) setRendered(true);
              } catch {
                // Ignora erro de miniatura
              }
            },
            { rootMargin: '120px' }
          )
        : null;

    observer?.observe(canvas);
    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [pdfDoc, pageNumber, rendered]);

  return (
    <button
      type="button"
      onClick={() => onSelect(pageNumber)}
      className="flex w-full flex-col items-center gap-1 rounded-[4px] border p-1.5 transition-colors duration-150 ease-out"
      style={{
        borderColor: isActive ? 'var(--reader-accent)' : 'var(--reader-border)',
        backgroundColor: 'var(--reader-surface)',
      }}
    >
      <canvas ref={thumbRef} className="h-auto w-full rounded-[2px] bg-white" />
      <span
        className="text-[10px] font-medium tabular-nums"
        style={{ color: isActive ? 'var(--reader-accent)' : 'var(--reader-muted)' }}
      >
        {pageNumber}
      </span>
    </button>
  );
}

export const PdfView = forwardRef(function PdfView(
  {
    fileBlob,
    settings,
    activeTheme,
    initialPage = 1,
    onReady,
    onPositionChange,
    onTocReady,
    onError,
    onUpdateSettings,
    onCenterTap,
  },
  ref
) {
  const containerRef = useRef(null);
  const slotRefs = useRef(new Map());
  const pinchStartDistRef = useRef(null);
  const pinchStartScaleRef = useRef(1);

  const [pdfDoc, setPdfDoc] = useState(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(Math.max(1, initialPage || 1));
  const [basePageSize, setBasePageSize] = useState({ width: 612, height: 792 });
  const [containerSize, setContainerSize] = useState({ width: 760, height: 900 });
  const [jumpInput, setJumpInput] = useState('');

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const measure = () => {
      setContainerSize({
        width: el.clientWidth || 760,
        height: el.clientHeight || 900,
      });
    };
    measure();
    const ro =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  useEffect(() => {
    if (!fileBlob) return undefined;
    let cancelled = false;
    let loadedPdf = null;

    const load = async () => {
      try {
        const buffer = await fileBlob.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: buffer });
        loadedPdf = await loadingTask.promise;
        if (cancelled) {
          loadedPdf.destroy?.();
          return;
        }

        const numPages = loadedPdf.numPages || 1;
        const firstPage = await loadedPdf.getPage(1);
        const vp1 = firstPage.getViewport({ scale: 1 });
        setBasePageSize({ width: vp1.width, height: vp1.height });
        setTotalPages(numPages);
        setPdfDoc(loadedPdf);

        const clampedPage = Math.max(1, Math.min(numPages, Number(initialPage) || 1));
        setCurrentPage(clampedPage);
        onPositionChange?.({
          page: clampedPage,
          totalPages: numPages,
          progressPct: Math.round((clampedPage / numPages) * 1000) / 10,
        });
        if (settings.pdfMode === 'continuous' && clampedPage > 1) {
          requestAnimationFrame(() => {
            slotRefs.current
              .get(clampedPage)
              ?.scrollIntoView({ behavior: 'auto', block: 'start' });
          });
        }

        // Extrai sumário (outline)
        try {
          const outline = await loadedPdf.getOutline();
          if (Array.isArray(outline) && outline.length > 0) {
            const resolveOutlineNodes = async (nodes) => {
              const out = [];
              for (let i = 0; i < nodes.length; i += 1) {
                const node = nodes[i];
                let destPage = 1;
                try {
                  const dest =
                    typeof node.dest === 'string'
                      ? await loadedPdf.getDestination(node.dest)
                      : node.dest;
                  if (Array.isArray(dest) && dest[0]) {
                    const idx = await loadedPdf.getPageIndex(dest[0]);
                    destPage = idx + 1;
                  }
                } catch {
                  destPage = 1;
                }
                const subitems = Array.isArray(node.items)
                  ? await resolveOutlineNodes(node.items)
                  : [];
                out.push({
                  id: `pdf-toc-${destPage}-${i}`,
                  label: node.title || `Seção ${i + 1}`,
                  page: destPage,
                  pct: Math.round((destPage / numPages) * 100),
                  subitems,
                });
              }
              return out;
            };
            const mappedToc = await resolveOutlineNodes(outline);
            if (!cancelled) onTocReady?.(mappedToc);
          } else {
            onTocReady?.([]);
          }
        } catch {
          onTocReady?.([]);
        }

        onReady?.();
      } catch (err) {
        if (!cancelled) {
          const isProtected =
            err?.name === 'PasswordException' ||
            String(err?.message || '').toLowerCase().includes('password');
          onError?.(
            isProtected
              ? 'Este PDF está protegido por senha e não pode ser aberto diretamente.'
              : 'Não foi possível abrir este arquivo PDF. Ele pode estar corrompido.'
          );
        }
      }
    };

    load();
    return () => {
      cancelled = true;
      loadedPdf?.destroy?.();
    };
  }, [fileBlob]);

  const computedScale = (() => {
    const availW = Math.max(260, containerSize.width - 32);
    const availH = Math.max(320, containerSize.height - 48);
    if (settings.pdfZoomMode === 'fit-page') {
      return Math.min(availW / basePageSize.width, availH / basePageSize.height);
    }
    if (settings.pdfZoomMode === 'custom') {
      return Math.max(0.5, Math.min(3.0, Number(settings.pdfZoomScale) || 1));
    }
    return Math.min(2.5, availW / basePageSize.width);
  })();

  const registerSlot = useCallback((pageNum, el) => {
    if (el) slotRefs.current.set(pageNum, el);
    else slotRefs.current.delete(pageNum);
  }, []);

  const goToPage = useCallback(
    (targetPage) => {
      if (!totalPages) return;
      const clamped = Math.max(1, Math.min(totalPages, Math.round(targetPage)));
      setCurrentPage(clamped);
      onPositionChange?.({
        page: clamped,
        totalPages,
        progressPct: Math.round((clamped / totalPages) * 1000) / 10,
      });

      if (settings.pdfMode === 'continuous') {
        const slot = slotRefs.current.get(clamped);
        slot?.scrollIntoView({ behavior: 'auto', block: 'start' });
      } else {
        containerRef.current?.scrollTo({ top: 0 });
      }
    },
    [totalPages, settings.pdfMode, onPositionChange]
  );

  // Atualiza página visível na rolagem contínua
  const handleContinuousScroll = () => {
    if (settings.pdfMode !== 'continuous' || !containerRef.current || !totalPages) {
      return;
    }
    const containerRect = containerRef.current.getBoundingClientRect();
    const midY = containerRect.top + containerRect.height * 0.35;
    let bestPage = currentPage;
    let bestDist = Infinity;

    slotRefs.current.forEach((el, pageNum) => {
      const rect = el.getBoundingClientRect();
      const dist = Math.abs(rect.top - midY);
      if (dist < bestDist) {
        bestDist = dist;
        bestPage = pageNum;
      }
    });

    if (bestPage !== currentPage) {
      setCurrentPage(bestPage);
      onPositionChange?.({
        page: bestPage,
        totalPages,
        progressPct: Math.round((bestPage / totalPages) * 1000) / 10,
      });
    }
  };

  useImperativeHandle(
    ref,
    () => ({
      goToPercent: (pct) => {
        if (!totalPages) return;
        const target = Math.max(1, Math.round((pct / 100) * totalPages));
        goToPage(target);
      },
      goToChapter: (node) => {
        if (node?.page) goToPage(node.page);
      },
      goToPage,
      nextPage: () => goToPage(currentPage + 1),
      prevPage: () => goToPage(currentPage - 1),
      searchText: async (query) => {
        if (!pdfDoc || !query.trim()) return [];
        const needle = query.trim().toLowerCase();
        const matches = [];
        for (let p = 1; p <= pdfDoc.numPages && matches.length < 40; p += 1) {
          try {
            const page = await pdfDoc.getPage(p);
            const content = await page.getTextContent();
            const fullText = content.items.map((it) => it.str).join(' ');
            const idx = fullText.toLowerCase().indexOf(needle);
            if (idx !== -1) {
              const start = Math.max(0, idx - 45);
              const end = Math.min(fullText.length, idx + needle.length + 75);
              matches.push({
                id: `pdf-match-${p}-${idx}`,
                page: p,
                label: `Página ${p}`,
                excerpt: fullText.slice(start, end).trim(),
              });
            }
          } catch {
            // Segue busca nas demais páginas
          }
        }
        return matches;
      },
    }),
    [pdfDoc, totalPages, currentPage, goToPage]
  );

  // Pinça de zoom no toque
  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStartDistRef.current = Math.hypot(dx, dy);
      pinchStartScaleRef.current = computedScale;
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && pinchStartDistRef.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const ratio = dist / pinchStartDistRef.current;
      const nextScale = Math.max(
        0.5,
        Math.min(3.0, Number((pinchStartScaleRef.current * ratio).toFixed(2)))
      );
      onUpdateSettings?.({ pdfZoomMode: 'custom', pdfZoomScale: nextScale });
    }
  };

  const handleTouchEnd = () => {
    pinchStartDistRef.current = null;
  };

  const handleViewportClick = (e) => {
    if (settings.pdfMode !== 'single') {
      onCenterTap?.();
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    if (xRatio < 0.25) {
      goToPage(currentPage - 1);
    } else if (xRatio > 0.75) {
      goToPage(currentPage + 1);
    } else {
      onCenterTap?.();
    }
  };

  const handleJumpSubmit = (e) => {
    e.preventDefault();
    const n = Number(jumpInput);
    if (!Number.isNaN(n) && n >= 1) {
      goToPage(n);
      setJumpInput('');
    }
  };

  const domColors = resolveReaderDomColors(activeTheme);

  return (
    <div
      className="relative flex h-full w-full overflow-hidden"
      style={{ backgroundColor: domColors.bg, color: domColors.ink }}
    >
      {/* Miniaturas laterais opcionais */}
      {settings.pdfThumbnails && pdfDoc && (
        <aside
          className="hidden sm:flex w-32 shrink-0 flex-col gap-2 overflow-y-auto border-r p-2 pt-16 pb-20 no-scrollbar"
          style={{
            backgroundColor: domColors.surface,
            borderColor: domColors.border,
          }}
        >
          {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pageNum) => (
            <PdfThumbnail
              key={pageNum}
              pdfDoc={pdfDoc}
              pageNumber={pageNum}
              isActive={pageNum === currentPage}
              onSelect={goToPage}
            />
          ))}
        </aside>
      )}

      {/* Área principal de páginas */}
      <div
        ref={containerRef}
        onScroll={handleContinuousScroll}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleViewportClick}
        className="relative flex-1 overflow-auto px-4 pt-16 pb-24 no-scrollbar"
      >
        {totalPages > 0 && (
          <form
            onSubmit={handleJumpSubmit}
            onClick={(e) => e.stopPropagation()}
            className="mx-auto mb-4 flex w-fit items-center gap-2 rounded-[4px] border px-3 py-1 text-xs tabular-nums"
            style={{
              backgroundColor: domColors.surface,
              borderColor: domColors.border,
            }}
          >
            <span style={{ color: domColors.muted }}>pág.</span>
            <input
              type="number"
              min="1"
              max={totalPages}
              value={jumpInput}
              onChange={(e) => setJumpInput(e.target.value)}
              placeholder={String(currentPage)}
              aria-label="Ir para página do PDF"
              className="w-12 rounded-[4px] border px-1.5 py-0.5 text-center text-xs font-medium focus:outline-none"
              style={{
                backgroundColor: domColors.bg,
                borderColor: domColors.border,
                color: domColors.ink,
              }}
            />
            <span style={{ color: domColors.muted }}>de {totalPages}</span>
            <button
              type="submit"
              className="rounded-[4px] px-2 py-0.5 text-[11px] font-medium"
              style={{ color: 'var(--reader-accent)' }}
            >
              ir
            </button>
          </form>
        )}

        {pdfDoc &&
          (settings.pdfMode === 'continuous' ? (
            <div className="space-y-4">
              {Array.from({ length: totalPages }, (_, idx) => idx + 1).map(
                (pageNum) => (
                  <PdfPageCanvas
                    key={pageNum}
                    pdfDoc={pdfDoc}
                    pageNumber={pageNum}
                    scale={computedScale}
                    nightMode={settings.pdfNightMode}
                    isNearActive={Math.abs(pageNum - currentPage) <= 1}
                    onRegisterSlot={registerSlot}
                  />
                )
              )}
            </div>
          ) : (
            <PdfPageCanvas
              pdfDoc={pdfDoc}
              pageNumber={currentPage}
              scale={computedScale}
              nightMode={settings.pdfNightMode}
              isNearActive
            />
          ))}
      </div>
    </div>
  );
});
