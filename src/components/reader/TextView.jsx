import DOMPurify from 'dompurify';
import { marked } from 'marked';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  getHighlightColorMeta,
  resolveReaderDomColors,
} from '../../utils/readerThemes';
import { FONT_PRESETS } from '../../utils/themeTokens';

const CHAPTER_HEADING_REGEX =
  /^(?:#{1,3}\s+(.+)|((?:cap[íi]tulo|chapter|parte|part|se[çc][ãa]o|livro)\s+[0-9ivxlcdm]+[^\n]*))$/i;

export function splitTextIntoSections(rawText = '', isMarkdown = false) {
  const lines = String(rawText || '').replace(/\r\n/g, '\n').split('\n');
  const sections = [];
  let currentTitle = 'Início';
  let currentLines = [];

  lines.forEach((line) => {
    const trimmed = line.trim();
    const match = trimmed.match(CHAPTER_HEADING_REGEX);
    if (match && currentLines.some((l) => l.trim().length > 0)) {
      sections.push({
        id: `sec-${sections.length + 1}`,
        title: currentTitle,
        raw: currentLines.join('\n').trim(),
      });
      currentTitle = (match[1] || match[2] || trimmed).replace(/^#+\s*/, '').trim();
      currentLines = [line];
      return;
    }
    if (match && currentLines.every((l) => l.trim().length === 0)) {
      currentTitle = (match[1] || match[2] || trimmed).replace(/^#+\s*/, '').trim();
    }
    currentLines.push(line);
  });

  if (currentLines.some((l) => l.trim().length > 0) || sections.length === 0) {
    sections.push({
      id: `sec-${sections.length + 1}`,
      title: currentTitle,
      raw: currentLines.join('\n').trim(),
    });
  }

  // Se texto plano veio sem capítulos em um único bloco longo, divide em blocos legíveis
  if (sections.length === 1 && lines.length > 140) {
    const chunked = [];
    const CHUNK_SIZE = 90;
    for (let i = 0; i < lines.length; i += CHUNK_SIZE) {
      const partIdx = chunked.length + 1;
      chunked.push({
        id: `sec-${partIdx}`,
        title: `Parte ${partIdx}`,
        raw: lines.slice(i, i + CHUNK_SIZE).join('\n').trim(),
      });
    }
    return chunked.map((sec) => ({
      ...sec,
      charLength: sec.raw.length,
      html: renderSectionHtml(sec.raw, isMarkdown),
    }));
  }

  return sections.map((sec) => ({
    ...sec,
    charLength: sec.raw.length,
    html: renderSectionHtml(sec.raw, isMarkdown),
  }));
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderSectionHtml(raw, isMarkdown) {
  if (isMarkdown) {
    const dirty = marked.parse(raw || '', { async: false, breaks: true });
    return DOMPurify.sanitize(String(dirty || ''));
  }
  const paragraphs = String(raw || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const html = paragraphs
    .map((p) => {
      if (CHAPTER_HEADING_REGEX.test(p)) {
        return `<h2>${escapeHtml(p)}</h2>`;
      }
      return `<p>${escapeHtml(p).replace(/\n/g, '<br />')}</p>`;
    })
    .join('');
  return DOMPurify.sanitize(html);
}

function injectHighlightsIntoHtml(sanitizedHtml, sectionHighlights, isLight) {
  if (
    !sectionHighlights ||
    sectionHighlights.length === 0 ||
    typeof DOMParser === 'undefined'
  ) {
    return sanitizedHtml;
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${sanitizedHtml}</div>`, 'text/html');
    const root = doc.body.firstElementChild;
    if (!root) return sanitizedHtml;

    const fullText = root.textContent || '';
    const ranges = [];

    sectionHighlights.forEach((hl) => {
      let start = typeof hl.startOffset === 'number' ? hl.startOffset : -1;
      let end = typeof hl.endOffset === 'number' ? hl.endOffset : -1;
      const needle = String(hl.text || '').trim();
      if (!needle) return;

      if (
        start < 0 ||
        end <= start ||
        end > fullText.length ||
        fullText.slice(start, end).trim() !== needle
      ) {
        const fallbackIdx = fullText.indexOf(needle);
        if (fallbackIdx === -1) return;
        start = fallbackIdx;
        end = fallbackIdx + needle.length;
      }

      ranges.push({
        id: hl.id,
        start,
        end,
        meta: getHighlightColorMeta(hl.color),
      });
    });

    if (ranges.length === 0) return sanitizedHtml;

    // Aplica do último para o primeiro ou nó por nó
    ranges.sort((a, b) => b.start - a.start);

    const wrapRangeInDom = (rangeSpec) => {
      const walker = doc.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
      const textNodes = [];
      let cursor = 0;
      let current = walker.nextNode();
      while (current) {
        const len = current.nodeValue?.length || 0;
        if (len > 0) {
          textNodes.push({ node: current, start: cursor, end: cursor + len });
          cursor += len;
        }
        current = walker.nextNode();
      }

      textNodes.forEach(({ node, start, end }) => {
        const overlapStart = Math.max(start, rangeSpec.start);
        const overlapEnd = Math.min(end, rangeSpec.end);
        if (overlapStart >= overlapEnd) return;

        const relStart = overlapStart - start;
        const relEnd = overlapEnd - start;
        const original = node.nodeValue || '';

        const before = original.slice(0, relStart);
        const middle = original.slice(relStart, relEnd);
        const after = original.slice(relEnd);

        const frag = doc.createDocumentFragment();
        if (before) frag.appendChild(doc.createTextNode(before));

        const mark = doc.createElement('mark');
        mark.setAttribute('data-codice-hl-id', String(rangeSpec.id || ''));
        mark.style.backgroundColor = isLight
          ? rangeSpec.meta.lightBg
          : rangeSpec.meta.darkBg;
        mark.style.color = 'inherit';
        mark.style.borderRadius = '2px';
        mark.style.padding = '0 1px';
        if (isLight) {
          mark.style.mixBlendMode = 'multiply';
        }
        mark.textContent = middle;
        frag.appendChild(mark);

        if (after) frag.appendChild(doc.createTextNode(after));
        node.parentNode?.replaceChild(frag, node);
      });
    };

    ranges.forEach(wrapRangeInDom);
    return root.innerHTML;
  } catch {
    return sanitizedHtml;
  }
}

export const TextView = forwardRef(function TextView(
  {
    fileBlob,
    format = 'txt',
    settings,
    activeTheme,
    initialPage = 1,
    initialScrollRatio = 0,
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
  const scrollRef = useRef(null);
  const sectionRefs = useRef(new Map());
  const hasUserScrolledRef = useRef(false);
  const pendingScrollRatioRef = useRef(
    Number(initialScrollRatio) > 0 ? Number(initialScrollRatio) : null
  );

  const [sections, setSections] = useState([]);
  const [activeSectionIndex, setActiveSectionIndex] = useState(
    Math.max(0, (initialPage || 1) - 1)
  );

  const totalBookChars = useMemo(
    () => sections.reduce((sum, s) => sum + (s.charLength || 0), 0),
    [sections]
  );

  const estimatedTotalPages = useMemo(() => {
    if (workTotalPages > 0) return Number(workTotalPages);
    if (sections.length === 0) return 1;
    if (settings.textFlow === 'paginated' && totalBookChars < 3000) {
      return sections.length;
    }
    return Math.max(sections.length, Math.round(totalBookChars / 1500));
  }, [workTotalPages, sections.length, totalBookChars, settings.textFlow]);

  useEffect(() => {
    if (!fileBlob) return undefined;
    let cancelled = false;

    const load = async () => {
      try {
        const text = await fileBlob.text();
        if (cancelled) return;
        const parsedSections = splitTextIntoSections(
          text,
          format === 'markdown'
        );
        setSections(parsedSections);

        const totalChars = parsedSections.reduce((s, sec) => s + sec.charLength, 0);
        const totalVirtualPages =
          workTotalPages > 0
            ? Number(workTotalPages)
            : totalChars >= 3000
              ? Math.max(parsedSections.length, Math.round(totalChars / 1500))
              : parsedSections.length;

        let clampedSecIdx = Math.max(
          0,
          Math.min(parsedSections.length - 1, (Number(initialPage) || 1) - 1)
        );
        if (totalVirtualPages > parsedSections.length && initialPage > 1) {
          const ratio = Math.min(1, Math.max(0, (initialPage - 1) / totalVirtualPages));
          clampedSecIdx = Math.min(
            parsedSections.length - 1,
            Math.floor(ratio * parsedSections.length)
          );
        }
        setActiveSectionIndex(clampedSecIdx);

        const toc = parsedSections.map((sec, idx) => ({
          id: sec.id,
          label: sec.title,
          sectionIndex: idx,
          page: Math.max(
            1,
            Math.round(((idx + 1) / parsedSections.length) * totalVirtualPages)
          ),
          pct: Math.round(((idx + 1) / parsedSections.length) * 1000) / 10,
        }));
        onTocReady?.(toc);

        const initialFrac =
          settings.textFlow === 'scrolled' && pendingScrollRatioRef.current > 0
            ? Math.min(1, pendingScrollRatioRef.current)
            : (clampedSecIdx + 1) / parsedSections.length;
        const initPct = Math.round(initialFrac * 1000) / 10;
        const initPage = Math.max(
          1,
          Math.min(totalVirtualPages, Math.round(initialFrac * totalVirtualPages) || 1)
        );

        onPositionChange?.({
          page: initPage,
          totalPages: totalVirtualPages,
          chapterLabel: parsedSections[clampedSecIdx]?.title || '',
          scrollRatio: pendingScrollRatioRef.current || 0,
          progressPct: initPct,
        });

        onReady?.();

        if (settings.textFlow === 'scrolled' && pendingScrollRatioRef.current > 0) {
          requestAnimationFrame(() => {
            const el = scrollRef.current;
            if (el) {
              const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
              el.scrollTo({ top: pendingScrollRatioRef.current * maxScroll });
            }
            pendingScrollRatioRef.current = null;
          });
        }
      } catch {
        if (!cancelled) {
          onError?.('Não foi possível ler este arquivo de texto.');
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [fileBlob, format]);

  useEffect(() => {
    if (
      settings.textFlow !== 'scrolled' ||
      hasUserScrolledRef.current ||
      !sections.length ||
      !(Number(initialScrollRatio) > 0) ||
      !scrollRef.current
    ) {
      return;
    }
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (!el || hasUserScrolledRef.current) return;
      const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
      if (maxScroll > 0) {
        el.scrollTo({ top: Number(initialScrollRatio) * maxScroll });
      }
    });
  }, [sections.length, initialScrollRatio, settings.textFlow]);

  const goToSection = useCallback(
    (idx, targetHighlightId = null) => {
      if (!sections.length) return;
      const clamped = Math.max(0, Math.min(sections.length - 1, idx));
      setActiveSectionIndex(clamped);
      const frac = (clamped + 1) / sections.length;
      const pageNum = Math.max(
        1,
        Math.min(estimatedTotalPages, Math.round(frac * estimatedTotalPages) || 1)
      );

      onPositionChange?.({
        page: pageNum,
        totalPages: estimatedTotalPages,
        chapterLabel: sections[clamped]?.title || '',
        progressPct: Math.round(frac * 1000) / 10,
      });

      requestAnimationFrame(() => {
        if (targetHighlightId) {
          const markEl = scrollRef.current?.querySelector(
            `[data-codice-hl-id="${targetHighlightId}"]`
          );
          if (markEl) {
            markEl.scrollIntoView({ behavior: 'auto', block: 'center' });
            return;
          }
        }
        if (settings.textFlow === 'scrolled') {
          const el = sectionRefs.current.get(sections[clamped]?.id);
          el?.scrollIntoView({ behavior: 'auto', block: 'start' });
        } else {
          scrollRef.current?.scrollTo({ top: 0 });
        }
      });
    },
    [sections, estimatedTotalPages, settings.textFlow, onPositionChange]
  );

  useImperativeHandle(
    ref,
    () => ({
      goToPercent: (pct) => {
        if (settings.textFlow === 'scrolled' && scrollRef.current) {
          const el = scrollRef.current;
          const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
          el.scrollTo({ top: (pct / 100) * maxScroll });
        } else if (sections.length) {
          const idx = Math.round((pct / 100) * (sections.length - 1));
          goToSection(idx);
        }
      },
      goToChapter: (node) => {
        if (typeof node?.sectionIndex === 'number') {
          goToSection(node.sectionIndex);
        } else if (node?.page && estimatedTotalPages > 0) {
          const ratio = (node.page - 1) / estimatedTotalPages;
          goToSection(Math.round(ratio * (sections.length - 1)));
        }
      },
      goToHighlight: (hl) => {
        if (!sections.length) return;
        let targetIdx =
          typeof hl?.sectionIndex === 'number'
            ? hl.sectionIndex
            : sections.findIndex((s) => s.id === hl?.sectionId);
        if (targetIdx < 0 && hl?.page) {
          targetIdx = Math.max(
            0,
            Math.min(
              sections.length - 1,
              Math.floor(((hl.page - 1) / Math.max(1, estimatedTotalPages)) * sections.length)
            )
          );
        }
        goToSection(Math.max(0, targetIdx), hl?.id || null);
      },
      goToPage: (p) => {
        if (!sections.length) return;
        if (estimatedTotalPages <= sections.length) {
          goToSection(p - 1);
          return;
        }
        const ratio = Math.max(0, Math.min(1, (p - 1) / Math.max(1, estimatedTotalPages - 1)));
        goToSection(Math.round(ratio * (sections.length - 1)));
      },
      nextPage: () => goToSection(activeSectionIndex + 1),
      prevPage: () => goToSection(activeSectionIndex - 1),
      searchText: async (query) => {
        const needle = String(query || '').trim().toLowerCase();
        if (!needle) return [];
        const matches = [];
        sections.forEach((sec, idx) => {
          if (matches.length >= 40) return;
          const pos = sec.raw.toLowerCase().indexOf(needle);
          if (pos !== -1) {
            const start = Math.max(0, pos - 40);
            const end = Math.min(sec.raw.length, pos + needle.length + 70);
            matches.push({
              id: `txt-match-${idx}-${pos}`,
              sectionIndex: idx,
              page: Math.max(
                1,
                Math.round(((idx + 1) / sections.length) * estimatedTotalPages)
              ),
              label: sec.title,
              excerpt: sec.raw.slice(start, end).trim(),
            });
          }
        });
        return matches;
      },
    }),
    [
      sections,
      activeSectionIndex,
      estimatedTotalPages,
      settings.textFlow,
      goToSection,
    ]
  );

  const handleScroll = () => {
    if (settings.textFlow !== 'scrolled' || !scrollRef.current || !sections.length) {
      return;
    }
    hasUserScrolledRef.current = true;
    const el = scrollRef.current;
    const maxScroll = Math.max(1, el.scrollHeight - el.clientHeight);
    const ratio = Math.max(0, Math.min(1, el.scrollTop / maxScroll));
    const pct = Math.round(ratio * 1000) / 10;
    const approxIdx = Math.min(
      sections.length - 1,
      Math.floor(ratio * sections.length)
    );

    if (approxIdx !== activeSectionIndex) {
      setActiveSectionIndex(approxIdx);
    }

    const virtualPage = Math.max(
      1,
      Math.min(estimatedTotalPages, Math.round(ratio * estimatedTotalPages) || 1)
    );

    onPositionChange?.({
      page: virtualPage,
      totalPages: estimatedTotalPages,
      scrollRatio: ratio,
      chapterLabel: sections[approxIdx]?.title || '',
      progressPct: pct,
    });
  };

  const handleSelectionRelease = () => {
    const sel = window.getSelection?.();
    const text = sel ? String(sel.toString() || '').trim() : '';
    if (!text || !sel.rangeCount) return;

    const range = sel.getRangeAt(0);
    const startEl =
      range.startContainer.nodeType === 1
        ? range.startContainer
        : range.startContainer.parentElement;
    const sectionEl = startEl?.closest?.('[data-section-id]');
    const sectionId = sectionEl?.getAttribute('data-section-id') || '';
    const rawIdx = sectionEl?.getAttribute('data-section-index');
    const secIdx = rawIdx !== null ? Number(rawIdx) : activeSectionIndex;

    let startOffset = null;
    let endOffset = null;
    if (sectionEl && typeof document !== 'undefined') {
      try {
        const preRange = document.createRange();
        preRange.selectNodeContents(sectionEl);
        preRange.setEnd(range.startContainer, range.startOffset);
        startOffset = preRange.toString().length;
        endOffset = startOffset + text.length;
      } catch {
        startOffset = null;
        endOffset = null;
      }
    }

    onTextSelect?.({
      text,
      sectionId,
      sectionIndex: Number.isNaN(secIdx) ? activeSectionIndex : secIdx,
      startOffset,
      endOffset,
      location:
        sections[secIdx]?.title ||
        sections[activeSectionIndex]?.title ||
        `Seção ${activeSectionIndex + 1}`,
    });
  };

  const handleTap = (e) => {
    const sel = window.getSelection?.()?.toString()?.trim();
    if (sel) return;

    if (settings.textFlow === 'scrolled') {
      onCenterTap?.();
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    if (xRatio < 0.25) {
      goToSection(activeSectionIndex - 1);
    } else if (xRatio > 0.75) {
      goToSection(activeSectionIndex + 1);
    } else {
      onCenterTap?.();
    }
  };

  const fontPreset = useMemo(
    () => FONT_PRESETS.find((f) => f.id === settings.fontId) || FONT_PRESETS[0],
    [settings.fontId]
  );

  const domColors = resolveReaderDomColors(activeTheme);

  const marginPad =
    settings.marginLevel === 'compact'
      ? 'px-3 sm:px-6'
      : settings.marginLevel === 'wide'
        ? 'px-8 sm:px-16'
        : 'px-5 sm:px-10';

  const articleStyle = {
    fontFamily: activeTheme?.followApp ? 'var(--font-app)' : fontPreset.cssValue,
    fontSize: `${settings.fontSizePct}%`,
    lineHeight: settings.lineHeight,
    textAlign: settings.justify ? 'justify' : 'left',
    hyphens: settings.hyphenation ? 'auto' : 'none',
    color: domColors.ink,
    '--paragraph-gap': `${settings.paragraphSpacing}em`,
  };

  const visibleSections = useMemo(() => {
    const baseList =
      settings.textFlow === 'paginated'
        ? sections[activeSectionIndex]
          ? [{ sec: sections[activeSectionIndex], index: activeSectionIndex }]
          : []
        : sections.map((sec, index) => ({ sec, index }));

    return baseList.map(({ sec, index }) => {
      const secHighlights = highlights.filter(
        (hl) =>
          hl &&
          ((hl.sectionId && hl.sectionId === sec.id) ||
            (typeof hl.sectionIndex === 'number' && hl.sectionIndex === index) ||
            (!hl.sectionId && hl.sectionIndex === null && hl.text))
      );
      return {
        ...sec,
        index,
        renderedHtml: injectHighlightsIntoHtml(
          sec.html,
          secHighlights,
          domColors.isLight
        ),
      };
    });
  }, [sections, activeSectionIndex, settings.textFlow, highlights, domColors.isLight]);

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      onMouseUp={handleSelectionRelease}
      onTouchEnd={handleSelectionRelease}
      onClick={handleTap}
      className={`h-full w-full overflow-y-auto pt-16 pb-24 no-scrollbar ${marginPad}`}
      style={{ backgroundColor: domColors.bg, color: domColors.ink }}
    >
      <div
        className="codice-prose mx-auto max-w-[68ch] space-y-8"
        style={articleStyle}
      >
        {visibleSections.map((sec) => (
          <section
            key={sec.id}
            data-section-id={sec.id}
            data-section-index={sec.index}
            ref={(el) => {
              if (el) sectionRefs.current.set(sec.id, el);
              else sectionRefs.current.delete(sec.id);
            }}
            className="space-y-4 [&>h1]:text-2xl [&>h1]:font-bold [&>h2]:text-xl [&>h2]:font-semibold [&>h3]:text-lg [&>h3]:font-semibold [&>p]:mb-[var(--paragraph-gap)] [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 [&>blockquote]:border-l [&>blockquote]:pl-4 [&>blockquote]:italic"
            style={{ borderColor: domColors.border }}
            dangerouslySetInnerHTML={{ __html: sec.renderedHtml }}
          />
        ))}
      </div>
    </div>
  );
});
