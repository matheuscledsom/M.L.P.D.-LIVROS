import { domainConfig } from '../config/domainConfig.js';
import { getPagesRead } from '../utils/backlogHelpers.js';
import { generateQrCodeSvg } from '../utils/qrCodeSvg.js';

export const MAX_PROFILE_CARD_BYTES = 4096;
export const SAVED_PEER_CARDS_KEY = 'codice_saved_peer_cards_v1';

const BLOCKED_KEY_PATTERNS = [
  'aizasy',
  'sk-',
  'service_role',
  'supabasekey',
  'anonkey',
  'password',
  'apikey',
];

export function sanitizePlainText(value, maxLength = 200) {
  let clean = String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
    .replace(/\b(?:javascript|data|vbscript):/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (maxLength > 0 && clean.length > maxLength) {
    clean = clean.slice(0, maxLength).trim();
  }
  return clean;
}

function sanitizeCardHandle(rawHandle) {
  const clean = sanitizePlainText(rawHandle, 40)
    .toLowerCase()
    .replace(/[^@a-z0-9_.-]/g, '');
  if (!clean) return '@leitor';
  return clean.startsWith('@') ? clean : `@${clean}`;
}

function sanitizeWorkType(wt) {
  if (wt === 'manga' || wt === 'academic' || wt === 'book') return wt;
  return 'book';
}

function sanitizeYear(yr) {
  const num = Number(yr);
  if (!Number.isFinite(num) || num < 1000 || num > 2200) return null;
  return Math.round(num);
}

function toBase64Url(uint8Bytes) {
  let binary = '';
  for (let i = 0; i < uint8Bytes.length; i += 1) {
    binary += String.fromCharCode(uint8Bytes[i]);
  }
  const base64 =
    typeof btoa === 'function'
      ? btoa(binary)
      : Buffer.from(uint8Bytes).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(token) {
  const clean = String(token || '').trim();
  if (!/^[A-Za-z0-9_-]+$/.test(clean)) {
    throw new Error('Formato inválido de cartão de perfil.');
  }
  const padded = clean.replace(/-/g, '+').replace(/_/g, '/') +
    '==='.slice((clean.length + 3) % 4);
  if (typeof atob === 'function') {
    const bin = atob(padded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) {
      bytes[i] = bin.charCodeAt(i);
    }
    return bytes;
  }
  return new Uint8Array(Buffer.from(padded, 'base64'));
}

function buildCompactCardPayload({
  profile = {},
  items = [],
  titleName = '',
  streakCount = 0,
}) {
  const backlog = (Array.isArray(items) ? items : []).filter(
    (item) => item && item.inBacklog !== false
  );
  const completed = backlog.filter((item) => item.status === 'completed');
  const pagesRead = backlog.reduce((sum, item) => sum + getPagesRead(item), 0);

  const currentlyReading = backlog
    .filter((item) => item.status === 'playing' || item.status === 'reading')
    .sort((a, b) => {
      const tA = Date.parse(a.updatedAt || a.createdAt || '') || 0;
      const tB = Date.parse(b.updatedAt || b.createdAt || '') || 0;
      return tB - tA;
    })[0];

  const topRated = backlog
    .filter((item) => typeof item.rating === 'number')
    .sort((a, b) => {
      const tA = Date.parse(a.completedDate || a.updatedAt || a.createdAt || '') || 0;
      const tB = Date.parse(b.completedDate || b.updatedAt || b.createdAt || '') || 0;
      return tB - tA || b.rating - a.rating;
    })
    .slice(0, 5)
    .map((item) => ({
      ti: sanitizePlainText(item.title, 70),
      au: sanitizePlainText(item.author || '', 50),
      rt: Math.max(0, Math.min(100, Math.round(Number(item.rating) || 0))),
      wt: sanitizeWorkType(item.workType),
      yr: sanitizeYear(item.publicationYear ?? item.releaseYear),
      vd: sanitizePlainText(item.verdict || '', 28),
    }))
    .filter((entry) => Boolean(entry.ti));

  const publicQuotes = [];
  for (const item of backlog) {
    if (!Array.isArray(item.quotes)) continue;
    for (const quote of item.quotes) {
      const text = sanitizePlainText(quote?.text || '', 170);
      if (!text) continue;
      publicQuotes.push({
        tx: text,
        wk: sanitizePlainText(item.title, 60),
        lo: sanitizePlainText(quote?.location || '', 24),
      });
      if (publicQuotes.length >= 3) break;
    }
    if (publicQuotes.length >= 3) break;
  }

  return {
    v: 1,
    h: sanitizeCardHandle(profile?.handle || '@leitor'),
    n: sanitizePlainText(
      profile?.displayName || profile?.handle || 'Leitor do Códice',
      55
    ),
    b: sanitizePlainText(profile?.bio || '', 160),
    t: sanitizePlainText(
      titleName ||
        (profile?.activeTitleBadge && profile.activeTitleBadge !== 'auto'
          ? profile.activeTitleBadge
          : ''),
      55
    ),
    st: {
      books: Math.max(0, backlog.length),
      done: Math.max(0, completed.length),
      pages: Math.max(0, Math.round(pagesRead)),
      streak: Math.max(0, Math.round(Number(streakCount) || 0)),
    },
    cur: currentlyReading
      ? {
          ti: sanitizePlainText(currentlyReading.title, 70),
          au: sanitizePlainText(currentlyReading.author || '', 50),
          pc: Math.max(
            0,
            Math.min(100, Math.round(Number(currentlyReading.progress) || 0))
          ),
          wt: sanitizeWorkType(currentlyReading.workType),
          yr: sanitizeYear(
            currentlyReading.publicationYear ?? currentlyReading.releaseYear
          ),
        }
      : null,
    top: topRated,
    q: publicQuotes,
  };
}

export function encodePublicProfileCard(input = {}) {
  const payload = buildCompactCardPayload(input);
  const encoder = new TextEncoder();

  const tryEncode = (candidate) => {
    const json = JSON.stringify(candidate);
    const token = toBase64Url(encoder.encode(json));
    return { token, bytes: encoder.encode(token).length };
  };

  let attempt = tryEncode(payload);
  if (attempt.bytes <= MAX_PROFILE_CARD_BYTES) {
    return attempt.token;
  }

  // Redução progressiva para garantir respeito estrito ao teto de 4 KB
  const trimmed = { ...payload };
  while (trimmed.q.length > 0 && attempt.bytes > MAX_PROFILE_CARD_BYTES) {
    trimmed.q = trimmed.q.slice(0, -1);
    attempt = tryEncode(trimmed);
  }
  while (trimmed.top.length > 0 && attempt.bytes > MAX_PROFILE_CARD_BYTES) {
    trimmed.top = trimmed.top.slice(0, -1);
    attempt = tryEncode(trimmed);
  }
  if (attempt.bytes > MAX_PROFILE_CARD_BYTES) {
    trimmed.b = trimmed.b.slice(0, 60);
    attempt = tryEncode(trimmed);
  }

  return attempt.token;
}

function extractRawCardToken(rawInput) {
  const raw = String(rawInput || '').trim();
  if (!raw) return '';
  if (raw.includes('card=')) {
    try {
      const parsedUrl = new URL(
        raw.startsWith('http') ? raw : `https://codice.app/${raw.replace(/^\/+/, '')}`
      );
      return String(parsedUrl.searchParams.get('card') || '').trim();
    } catch {
      const match = raw.match(/[?&]card=([^&#]+)/);
      return match ? decodeURIComponent(match[1]) : raw;
    }
  }
  return raw;
}

export function decodePublicProfileCard(rawInput) {
  try {
    const token = extractRawCardToken(rawInput);
    if (!token) {
      return { ok: false, error: 'Nenhum cartão de perfil informado.' };
    }

    const tokenBytes = new TextEncoder().encode(token).length;
    if (tokenBytes > MAX_PROFILE_CARD_BYTES) {
      return {
        ok: false,
        error: 'Cartão de perfil excede o limite de segurança (4 KB).',
      };
    }

    const decodedBytes = fromBase64Url(token);
    if (decodedBytes.length > MAX_PROFILE_CARD_BYTES) {
      return {
        ok: false,
        error: 'Dados do cartão excedem o limite máximo de segurança.',
      };
    }

    const jsonText = new TextDecoder('utf-8', { fatal: true }).decode(decodedBytes);
    const lowerText = jsonText.toLowerCase();
    if (BLOCKED_KEY_PATTERNS.some((sig) => lowerText.includes(sig))) {
      return {
        ok: false,
        error: 'Cartão rejeitado por conter padrão proibido de credencial.',
      };
    }

    const parsed = JSON.parse(jsonText);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, error: 'Estrutura de cartão inválida.' };
    }

    if (parsed.v !== 1) {
      return { ok: false, error: 'Versão de cartão não suportada.' };
    }

    const handle = sanitizeCardHandle(parsed.h);
    const displayName = sanitizePlainText(parsed.n || handle, 60);
    if (!displayName) {
      return { ok: false, error: 'Cartão sem identificação válida do leitor.' };
    }

    const bio = sanitizePlainText(parsed.b || '', 180);
    const activeTitle = sanitizePlainText(parsed.t || '', 60);

    const rawStats = parsed.st && typeof parsed.st === 'object' ? parsed.st : {};
    const stats = {
      booksCount: Math.max(0, Math.min(99999, Math.round(Number(rawStats.books) || 0))),
      completedCount: Math.max(0, Math.min(99999, Math.round(Number(rawStats.done) || 0))),
      pagesRead: Math.max(0, Math.min(9999999, Math.round(Number(rawStats.pages) || 0))),
      streakCount: Math.max(0, Math.min(99999, Math.round(Number(rawStats.streak) || 0))),
    };

    const currentReading =
      parsed.cur && typeof parsed.cur === 'object' && parsed.cur.ti
        ? {
            title: sanitizePlainText(parsed.cur.ti, 80),
            author: sanitizePlainText(parsed.cur.au || '', 60),
            progressPct: Math.max(
              0,
              Math.min(100, Math.round(Number(parsed.cur.pc) || 0))
            ),
            workType: sanitizeWorkType(parsed.cur.wt),
            releaseYear: sanitizeYear(parsed.cur.yr),
          }
        : null;

    const topRatedWorks = (Array.isArray(parsed.top) ? parsed.top : [])
      .slice(0, 5)
      .filter((w) => w && typeof w === 'object' && w.ti)
      .map((w, idx) => ({
        id: `peer-work-${handle}-${idx}`,
        title: sanitizePlainText(w.ti, 80),
        author: sanitizePlainText(w.au || '', 60),
        rating:
          w.rt !== null && w.rt !== undefined
            ? Math.max(0, Math.min(100, Math.round(Number(w.rt) || 0)))
            : null,
        workType: sanitizeWorkType(w.wt),
        releaseYear: sanitizeYear(w.yr),
        verdict: sanitizePlainText(w.vd || '', 30),
      }));

    const publicQuotes = (Array.isArray(parsed.q) ? parsed.q : [])
      .slice(0, 3)
      .filter((q) => q && typeof q === 'object' && q.tx)
      .map((q) => ({
        text: sanitizePlainText(q.tx, 200),
        workTitle: sanitizePlainText(q.wk || '', 70),
        location: sanitizePlainText(q.lo || '', 30),
      }));

    const words = displayName.replace(/^@/, '').split(/\s+/).filter(Boolean);
    const avatarInitials = (
      words.length >= 2
        ? `${words[0][0]}${words[words.length - 1][0]}`
        : displayName.replace(/^@/, '').slice(0, 2) || 'LC'
    ).toUpperCase();

    return {
      ok: true,
      card: {
        id: `card:${handle.replace(/^@/, '')}`,
        version: 1,
        handle,
        displayName,
        avatarInitials,
        bio,
        activeTitle,
        stats,
        currentReading,
        topRatedWorks,
        publicQuotes,
        rawToken: token,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err?.message || 'Não foi possível ler o cartão de perfil.',
    };
  }
}

export function buildProfileCardShareUrl(cardInput, baseOriginUrl = null) {
  const token =
    typeof cardInput === 'string'
      ? cardInput
      : encodePublicProfileCard(cardInput);

  let base = String(baseOriginUrl || '').trim();
  if (!base && typeof window !== 'undefined' && window.location) {
    base = `${window.location.origin}${window.location.pathname}`;
  }
  if (!base) {
    base = domainConfig.shareUrlBase || 'https://codice.app/';
  }

  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}card=${encodeURIComponent(token)}`;
}

export function buildProfileCardQrSvg(shareUrl, options = {}) {
  return generateQrCodeSvg(shareUrl, {
    ariaLabel: 'QR Code do cartão de perfil vivo',
    ...options,
  });
}

export function listSavedPeerCards() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(SAVED_PEER_CARDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((c) => c && typeof c === 'object' && c.handle)
      : [];
  } catch {
    return [];
  }
}

export function savePeerProfileCard(card) {
  if (!card || !card.handle) return listSavedPeerCards();
  const list = listSavedPeerCards();
  const handleKey = sanitizeCardHandle(card.handle);
  const record = {
    ...card,
    id: card.id || `card:${handleKey.replace(/^@/, '')}`,
    handle: handleKey,
    savedAt: new Date().toISOString(),
  };

  const idx = list.findIndex(
    (entry) => sanitizeCardHandle(entry.handle) === handleKey
  );
  const next =
    idx >= 0
      ? list.map((entry, i) => (i === idx ? record : entry))
      : [record, ...list];

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SAVED_PEER_CARDS_KEY, JSON.stringify(next.slice(0, 100)));
    }
  } catch {
    // Silencioso
  }
  return next;
}

export function removeSavedPeerCard(cardIdOrHandle) {
  const target = String(cardIdOrHandle || '').trim().toLowerCase();
  const next = listSavedPeerCards().filter(
    (entry) =>
      String(entry.id || '').toLowerCase() !== target &&
      sanitizeCardHandle(entry.handle) !== sanitizeCardHandle(target)
  );
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SAVED_PEER_CARDS_KEY, JSON.stringify(next));
    }
  } catch {
    // Silencioso
  }
  return next;
}
