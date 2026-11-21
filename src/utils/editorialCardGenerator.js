import { domainConfig } from '../config/domainConfig.js';

export const EDITORIAL_CARD_TEMPLATES = [
  { id: 'ficha', label: 'Ficha de Biblioteca' },
  { id: 'pagina', label: 'Página de Livro' },
  { id: 'carimbo', label: 'Carimbo Tipográfico' },
];

function parseHexToRgba(hex, alpha = 1) {
  const clean = String(hex || '').trim();
  const match = clean.match(/^#([0-9a-f]{6})$/i);
  if (!match) return `rgba(139, 92, 246, ${alpha})`;
  const intVal = parseInt(match[1], 16);
  const r = (intVal >> 16) & 255;
  const g = (intVal >> 8) & 255;
  const b = intVal & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function wrapTextLines(ctx, text, maxWidth) {
  const paragraphs = String(text || '').split(/\n+/);
  const lines = [];

  paragraphs.forEach((paragraph, pIndex) => {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return;

    let currentLine = words[0];
    for (let i = 1; i < words.length; i += 1) {
      const candidate = `${currentLine} ${words[i]}`;
      if (ctx.measureText(candidate).width <= maxWidth) {
        currentLine = candidate;
      } else {
        lines.push(currentLine);
        currentLine = words[i];
      }
    }
    lines.push(currentLine);

    if (pIndex < paragraphs.length - 1) {
      lines.push('');
    }
  });

  return lines;
}

function slugifyFilename(text) {
  return String(text || 'obra')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'obra';
}

function drawVectorQuoteMark(ctx, x, y, color) {
  ctx.save();
  ctx.fillStyle = color;
  for (let offset = 0; offset < 2; offset += 1) {
    const qx = x + offset * 28;
    ctx.beginPath();
    ctx.arc(qx + 10, y + 18, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(qx + 18, y + 18);
    ctx.quadraticCurveTo(qx + 18, y + 4, qx + 4, y);
    ctx.lineTo(qx + 10, y - 4);
    ctx.quadraticCurveTo(qx + 24, y + 4, qx + 19, y + 20);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawLibraryIndexMotifs(ctx, { width, height, pad, innerX, innerW, borderSubtle, accentColor, bgApp }) {
  // Linhas pautadas finas estilo ficha catalográfica física
  ctx.save();
  ctx.strokeStyle = parseHexToRgba(borderSubtle, 0.42);
  ctx.lineWidth = 1;
  const startY = pad + 132;
  const endY = height - pad - 240;
  for (let y = startY; y <= endY; y += 56) {
    ctx.beginPath();
    ctx.moveTo(innerX, y);
    ctx.lineTo(innerX + innerW, y);
    ctx.stroke();
  }
  // Furo de fichário inferior centralizado
  ctx.beginPath();
  ctx.arc(width / 2, height - pad - 44, 18, 0, Math.PI * 2);
  ctx.fillStyle = bgApp;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = accentColor;
  ctx.stroke();
  ctx.restore();
}

function drawTypographicStamp(ctx, { cx, cy, accentColor, fontFamily }) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.14);
  ctx.strokeStyle = parseHexToRgba(accentColor, 0.72);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, 56, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, 0, 47, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = accentColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 13px ${fontFamily}`;
  ctx.fillText('EX LIBRIS', 0, -9);
  ctx.font = `600 11px ${fontFamily}`;
  ctx.fillText('CÓDICE', 0, 9);
  ctx.restore();
}

export async function generateEditorialQuoteCard({
  quoteText,
  location = '',
  note = '',
  title = '',
  author = '',
  templateId = 'pagina',
}) {
  if (document?.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Segue mesmo se carregamento de fonte falhar
    }
  }

  const rootStyle = getComputedStyle(document.documentElement);
  const bgApp = rootStyle.getPropertyValue('--bg-app').trim() || '#000000';
  const bgCard = rootStyle.getPropertyValue('--bg-card').trim() || '#0A0A0A';
  const borderSubtle =
    rootStyle.getPropertyValue('--border-subtle').trim() || '#1F1F1F';
  const textPrimary =
    rootStyle.getPropertyValue('--text-primary').trim() || '#FFFFFF';
  const textMuted =
    rootStyle.getPropertyValue('--text-muted').trim() || '#A3A3A3';
  const textSubtle =
    rootStyle.getPropertyValue('--text-subtle').trim() || '#737373';
  const accentColor =
    rootStyle.getPropertyValue('--accent-color').trim() || '#8B5CF6';
  const fontFamily =
    rootStyle.getPropertyValue('--font-app').trim() ||
    '"Newsreader Variable", Georgia, serif';

  const WIDTH = 1080;
  const HEIGHT = 1350;
  const activeTemplate = EDITORIAL_CARD_TEMPLATES.some((t) => t.id === templateId)
    ? templateId
    : 'pagina';

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');

  // 1. Fundo sólido editorial (zero gradientes)
  ctx.fillStyle = bgApp;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // 2. Moldura Editorial interna conforme o modelo
  const PAD = 68;
  const FRAME_W = WIDTH - PAD * 2;
  const FRAME_H = HEIGHT - PAD * 2;
  const frameRadius = activeTemplate === 'ficha' ? 12 : activeTemplate === 'carimbo' ? 6 : 24;

  drawRoundedRect(ctx, PAD, PAD, FRAME_W, FRAME_H, frameRadius);
  ctx.fillStyle = bgCard;
  ctx.fill();
  ctx.lineWidth = activeTemplate === 'carimbo' ? 3 : 2;
  ctx.strokeStyle = activeTemplate === 'carimbo' ? accentColor : borderSubtle;
  ctx.stroke();

  if (activeTemplate === 'pagina') {
    drawRoundedRect(ctx, PAD + 16, PAD + 16, FRAME_W - 32, FRAME_H - 32, 16);
    ctx.lineWidth = 1;
    ctx.strokeStyle = parseHexToRgba(accentColor, 0.35);
    ctx.stroke();
  }

  const INNER_X = PAD + 68;
  const INNER_W = FRAME_W - 136;

  if (activeTemplate === 'ficha') {
    drawLibraryIndexMotifs(ctx, {
      width: WIDTH,
      height: HEIGHT,
      pad: PAD,
      innerX: INNER_X,
      innerW: INNER_W,
      borderSubtle,
      accentColor,
      bgApp,
    });
  } else if (activeTemplate === 'carimbo') {
    drawTypographicStamp(ctx, {
      cx: WIDTH - PAD - 104,
      cy: PAD + 114,
      accentColor,
      fontFamily,
    });
  }

  // 3. Cabeçalho superior
  const HEADER_Y = PAD + 74;
  ctx.fillStyle = accentColor;
  ctx.beginPath();
  ctx.arc(INNER_X + 7, HEADER_Y - 7, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = textMuted;
  ctx.font = `600 18px ${fontFamily}`;
  ctx.textBaseline = 'middle';
  const headerSubtitle =
    activeTemplate === 'ficha'
      ? `${domainConfig.appName.toUpperCase()} · FICHA CATALOGRÁFICA`
      : activeTemplate === 'carimbo'
        ? `${domainConfig.appName.toUpperCase()} · ACERVO PESSOAL`
        : `${domainConfig.appName.toUpperCase()} · ${domainConfig.signature.toUpperCase()}`;
  ctx.fillText(headerSubtitle, INNER_X + 28, HEADER_Y - 6);

  if (location.trim() && activeTemplate !== 'carimbo') {
    const locLabel = location.trim();
    ctx.font = `600 21px ${fontFamily}`;
    const textW = ctx.measureText(locLabel).width;
    const pillW = textW + 34;
    const pillH = 40;
    const pillX = INNER_X + INNER_W - pillW;
    const pillY = HEADER_Y - pillH / 2 - 6;

    drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 6);
    ctx.fillStyle = parseHexToRgba(accentColor, 0.14);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = parseHexToRgba(accentColor, 0.45);
    ctx.stroke();

    ctx.fillStyle = accentColor;
    ctx.textAlign = 'center';
    ctx.fillText(locLabel, pillX + pillW / 2, HEADER_Y - 5);
    ctx.textAlign = 'left';
  }

  // 4. Aspas vetoriais minimalistas
  const QUOTE_ICON_Y = HEADER_Y + 76;
  drawVectorQuoteMark(ctx, INNER_X, QUOTE_ICON_Y, accentColor);

  // 5. Texto principal da citação
  const QUOTE_TOP = QUOTE_ICON_Y + 62;
  const FOOTER_TOP = HEIGHT - PAD - 220;
  const NOTE_SPACE = note.trim() ? 130 : 20;
  const AVAILABLE_HEIGHT = FOOTER_TOP - QUOTE_TOP - NOTE_SPACE;

  const fontCandidates = [52, 44, 38, 33, 28];
  let chosenSize = 28;
  let chosenLines = [];
  let chosenLineHeight = 42;

  for (const size of fontCandidates) {
    ctx.font = `500 ${size}px ${fontFamily}`;
    const lines = wrapTextLines(ctx, quoteText, INNER_W);
    const lineHeight = Math.round(size * 1.45);
    const totalHeight = lines.length * lineHeight;
    if (totalHeight <= AVAILABLE_HEIGHT) {
      chosenSize = size;
      chosenLines = lines;
      chosenLineHeight = lineHeight;
      break;
    }
    chosenSize = size;
    chosenLines = lines;
    chosenLineHeight = lineHeight;
  }

  const maxLines = Math.max(1, Math.floor(AVAILABLE_HEIGHT / chosenLineHeight));
  const renderLines = chosenLines.slice(0, maxLines);
  if (chosenLines.length > maxLines && renderLines.length > 0) {
    const last = renderLines[renderLines.length - 1];
    renderLines[renderLines.length - 1] = `${last.slice(0, Math.max(0, last.length - 3))}...`;
  }

  const blockHeight = renderLines.length * chosenLineHeight;
  let cursorY =
    QUOTE_TOP + Math.max(0, (AVAILABLE_HEIGHT - blockHeight) / 2) + chosenSize * 0.45;

  ctx.fillStyle = textPrimary;
  ctx.font = `500 ${chosenSize}px ${fontFamily}`;
  ctx.textBaseline = 'middle';

  renderLines.forEach((line) => {
    if (line) {
      ctx.fillText(line, INNER_X, cursorY);
    }
    cursorY += chosenLineHeight;
  });

  // 6. Nota analítica
  if (note.trim()) {
    const noteY = FOOTER_TOP - 95;
    ctx.fillStyle = borderSubtle;
    ctx.fillRect(INNER_X, noteY - 22, INNER_W, 1.5);

    ctx.fillStyle = textSubtle;
    ctx.font = `400 22px ${fontFamily}`;
    const noteLines = wrapTextLines(ctx, note.trim(), INNER_W).slice(0, 2);
    noteLines.forEach((nLine, idx) => {
      ctx.fillText(nLine, INNER_X, noteY + idx * 32);
    });
  }

  // 7. Rodapé com título e autor
  drawRoundedRect(ctx, INNER_X, FOOTER_TOP, 76, 5, 2.5);
  ctx.fillStyle = accentColor;
  ctx.fill();

  ctx.fillStyle = textPrimary;
  ctx.font = `700 32px ${fontFamily}`;
  const titleLines = wrapTextLines(ctx, title || 'Obra catalogada', INNER_W).slice(0, 2);
  let footerY = FOOTER_TOP + 46;
  titleLines.forEach((tLine) => {
    ctx.fillText(tLine, INNER_X, footerY);
    footerY += 42;
  });

  if (author.trim()) {
    ctx.fillStyle = textMuted;
    ctx.font = `400 25px ${fontFamily}`;
    const authorLine = wrapTextLines(ctx, author.trim(), INNER_W)[0] || author.trim();
    ctx.fillText(authorLine, INNER_X, footerY + 6);
  }

  // 8. Download direto PNG
  const filename = `card-${activeTemplate}-${slugifyFilename(title)}.png`;

  await new Promise((resolve) => {
    if (canvas.toBlob) {
      canvas.toBlob((blob) => {
        if (!blob) {
          resolve();
          return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        resolve();
      }, 'image/png');
    } else {
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      resolve();
    }
  });
}
