import { hashFallbackPalette, hashString32 } from './dominantColor.js';

const PATTERN_KINDS = [
  'orbital',
  'lattice',
  'bauhaus',
  'halftone',
  'diamond',
];

export function escapeSvgText(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function wrapTitleLines(title = '', maxChars = 16, maxLines = 3) {
  const words = String(title || 'Obra Sem Título').trim().split(/\s+/);
  const lines = [];
  let current = '';

  for (const word of words) {
    if (!current) {
      current = word.slice(0, maxChars);
      continue;
    }
    if ((current + ' ' + word).length <= maxChars) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word.slice(0, maxChars);
      if (lines.length >= maxLines) break;
    }
  }
  if (current && lines.length < maxLines) {
    lines.push(current);
  }
  return lines.slice(0, maxLines);
}

function buildPatternElements(kind, accentColor, strokeColor) {
  if (kind === 'orbital') {
    return `
      <circle cx="132" cy="186" r="56" fill="none" stroke="${accentColor}" stroke-width="1.4" opacity="0.55" />
      <circle cx="132" cy="186" r="36" fill="none" stroke="${strokeColor}" stroke-width="1" opacity="0.28" />
      <circle cx="132" cy="186" r="14" fill="${accentColor}" opacity="0.32" />
    `;
  }
  if (kind === 'lattice') {
    const lines = [];
    for (let x = 28; x <= 172; x += 24) {
      lines.push(
        `<line x1="${x}" y1="128" x2="${x}" y2="254" stroke="${strokeColor}" stroke-width="0.9" opacity="0.16" />`
      );
    }
    for (let y = 136; y <= 248; y += 22) {
      lines.push(
        `<line x1="22" y1="${y}" x2="178" y2="${y}" stroke="${accentColor}" stroke-width="1" opacity="0.25" />`
      );
    }
    return lines.join('\n');
  }
  if (kind === 'bauhaus') {
    return `
      <rect x="22" y="136" width="68" height="106" fill="${accentColor}" opacity="0.24" />
      <rect x="98" y="136" width="80" height="48" fill="${strokeColor}" opacity="0.12" />
      <rect x="98" y="192" width="80" height="50" fill="none" stroke="${accentColor}" stroke-width="1.5" opacity="0.45" />
    `;
  }
  if (kind === 'halftone') {
    const dots = [];
    for (let row = 0; row < 5; row += 1) {
      for (let col = 0; col < 7; col += 1) {
        const cx = 32 + col * 22;
        const cy = 144 + row * 22;
        const r = 1.6 + ((row + col) % 3) * 1.1;
        dots.push(
          `<circle cx="${cx}" cy="${cy}" r="${r.toFixed(1)}" fill="${accentColor}" opacity="0.38" />`
        );
      }
    }
    return dots.join('\n');
  }
  return `
    <polygon points="100,132 162,190 100,248 38,190" fill="none" stroke="${accentColor}" stroke-width="1.5" opacity="0.52" />
    <polygon points="100,148 144,190 100,232 56,190" fill="${strokeColor}" opacity="0.1" />
  `;
}

export function generateEditorialCoverSvg({
  title = 'Sem Título',
  author = '',
  workType = 'book',
  genre = '',
  palette = null,
} = {}) {
  const key = `${title}::${author}::${workType}::${genre}`;
  const hash = hashString32(key);
  const patternKind = PATTERN_KINDS[hash % PATTERN_KINDS.length];
  const resolved = palette || hashFallbackPalette(key);
  const bg = resolved.bg || '#2C3E50';
  const fg = resolved.fg || '#FAF8F4';
  const accent = resolved.accent || '#E2E8F0';

  const lines = wrapTitleLines(title);
  const titleSvg = lines
    .map((line, i) => {
      const y = 48 + i * 20;
      return `<text x="22" y="${y}" font-family="'Newsreader Variable', Georgia, serif" font-size="16" font-weight="600" fill="${fg}">${escapeSvgText(line)}</text>`;
    })
    .join('\n  ');

  const safeAuthor = escapeSvgText(String(author || '').slice(0, 26));
  const typeTag = escapeSvgText(
    workType === 'manga' ? 'MANGÁ' : workType === 'academic' ? 'ESTUDO' : 'CÓDICE'
  );
  const patternMarkup = buildPatternElements(patternKind, accent, fg);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300" width="200" height="300" role="img" aria-label="${escapeSvgText(title)}">
  <rect width="200" height="300" rx="4" fill="${bg}" />
  <rect x="8" y="8" width="184" height="284" rx="2" fill="none" stroke="${fg}" stroke-opacity="0.22" stroke-width="1" />
  <line x1="22" y1="24" x2="178" y2="24" stroke="${accent}" stroke-opacity="0.45" stroke-width="1" />
  <text x="22" y="114" font-family="'Source Sans 3 Variable', system-ui, sans-serif" font-size="8.5" letter-spacing="1.6" fill="${accent}" fill-opacity="0.9">${typeTag}</text>
  ${titleSvg}
  ${patternMarkup}
  <line x1="22" y1="262" x2="178" y2="262" stroke="${fg}" stroke-opacity="0.22" stroke-width="1" />
  <text x="22" y="278" font-family="'Source Sans 3 Variable', system-ui, sans-serif" font-size="10.5" fill="${fg}" fill-opacity="0.86">${safeAuthor || 'Edição Códice'}</text>
</svg>`;
}

export function buildGeneratedCoverDataUri(options = {}) {
  const svg = generateEditorialCoverSvg(options);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
