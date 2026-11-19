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

  // Se texto plano veio sem capítulos em um único bloco muito longo, divide em blocos legíveis
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
      html: renderSectionHtml(sec.raw, isMarkdown),
    }));
  }

  return sections.map((sec) => ({
    ...sec,
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

export const TextView = forwardRef(function TextView(
  {
    fileBlob,
    format = 'txt',
    settings,
    activeTheme,
    initialPage = 1,
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

  const [sections, setSections] = useState([]);
  const [activeSectionIndex, setActiveSectionIndex] = useState(
    Math.max(0, (initialPage || 1) - 1)
  );

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

        const clampedIdx = Math.max(
          0,
          Math.min(parsedSections.length - 1, (Number(initialPage) || 1) - 1)
        );
        setActiveSectionIndex(clampedIdx);

        const toc = parsedSections.map((sec, idx) => ({
          id: sec.id,
          label: sec.title,
          sectionIndex: idx,
          page: idx + 1,
          pct: Math.round(((idx + 1) / parsedSections.length) * 100),
        }));
        onTocReady?.(toc);

        onPositionChange?.({
          page: clampedIdx + 1,
          totalPages: parsedSections.length,
          chapterLabel: parsedSections[clampedIdx]?.title || '',
          progressPct: Math.round(((clampedIdx + 1) / parsedSections.length) * 100),
        });

        onReady?.();
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

  const goToSection = useCallback(
    (idx) => {
      if (!sections.length) return;
      const clamped = Math.max(0, Math.min(sections.length - 1, idx));
      setActiveSectionIndex(clamped);
      onPositionChange?.({
        page: clamped + 1,
        totalPages: sections.length,
        chapterLabel: sections[clamped]?.title || '',
        progressPct: Math.round(((clamped + 1) / sections.length) * 100),
      });

      if (settings.textFlow === 'scrolled') {
        const el = sectionRefs.current.get(sections[clamped]?.id);
        el?.scrollIntoView({ behavior: 'auto', block: 'start' });
      } else {
        scrollRef.current?.scrollTo({ top: 0 });
      }
    },
    [sections, settings.textFlow, onPositionChange]
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
        } else if (node?.page) {
          goToSection(node.page - 1);
        }
      },
      goToPage: (p) => goToSection(p - 1),
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
              page: idx + 1,
              label: sec.title,
              excerpt: sec.raw.slice(start, end).trim(),
            });
          }
        });
        return matches;
      },
    }),
    [sections, activeSectionIndex, settings.textFlow, goToSection]
  );

  const handleScroll = () => {
    if (settings.textFlow !== 'scrolled' || !scrollRef.current || !sections.length) {
      return;
    }
    const el = scrollRef.current;
    const maxScroll = Math.max(1, el.scrollHeight - el.clientHeight);
    const pct = Math.max(0, Math.min(100, Math.round((el.scrollTop / maxScroll) * 100)));
    const approxIdx = Math.min(
      sections.length - 1,
      Math.floor((pct / 100) * sections.length)
    );

    if (approxIdx !== activeSectionIndex) {
      setActiveSectionIndex(approxIdx);
    }

    onPositionChange?.({
      page: approxIdx + 1,
      totalPages: sections.length,
      chapterLabel: sections[approxIdx]?.title || '',
      progressPct: pct,
    });
  };

  const handleSelectionRelease = () => {
    const sel = window.getSelection?.();
    const text = sel ? String(sel.toString() || '').trim() : '';
    if (text) {
      onTextSelect?.({
        text,
        location: sections[activeSectionIndex]?.title || `Seção ${activeSectionIndex + 1}`,
      });
    }
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

  const marginPad =
    settings.marginLevel === 'compact'
      ? 'px-3 sm:px-6'
      : settings.marginLevel === 'wide'
        ? 'px-8 sm:px-14'
        : 'px-5 sm:px-10';

  const articleStyle = {
    fontFamily: activeTheme?.followApp ? 'var(--font-app)' : fontPreset.cssValue,
    fontSize: `${settings.fontSizePct}%`,
    lineHeight: settings.lineHeight,
    textAlign: settings.justify ? 'justify' : 'left',
    hyphens: settings.hyphenation ? 'auto' : 'none',
    color: activeTheme.ink,
    '--paragraph-gap': `${settings.paragraphSpacing}em`,
  };

  const visibleSections =
    settings.textFlow === 'paginated'
      ? sections[activeSectionIndex]
        ? [sections[activeSectionIndex]]
        : []
      : sections;

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      onMouseUp={handleSelectionRelease}
      onTouchEnd={handleSelectionRelease}
      onClick={handleTap}
      className={`h-full w-full overflow-y-auto pt-16 pb-24 no-scrollbar ${marginPad}`}
      style={{ background: activeTheme.bg, color: activeTheme.ink }}
    >
      <div
        className="codice-prose mx-auto max-w-[66ch] space-y-8"
        style={articleStyle}
      >
        {visibleSections.map((sec) => (
          <section
            key={sec.id}
            ref={(el) => {
              if (el) sectionRefs.current.set(sec.id, el);
              else sectionRefs.current.delete(sec.id);
            }}
            className="space-y-4 [&>h1]:text-2xl [&>h1]:font-bold [&>h2]:text-xl [&>h2]:font-semibold [&>h3]:text-lg [&>h3]:font-semibold [&>p]:mb-[var(--paragraph-gap)] [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 [&>blockquote]:border-l-2 [&>blockquote]:border-accent [&>blockquote]:pl-4 [&>blockquote]:italic"
            dangerouslySetInnerHTML={{ __html: sec.html }}
          />
        ))}
      </div>
    </div>
  );
});
