import { getTodayLocalISO } from './backlogHelpers.js';

function cleanNormalized(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function detectDelimiter(headerLine) {
  const commas = (headerLine.match(/,/g) || []).length;
  const semis = (headerLine.match(/;/g) || []).length;
  const tabs = (headerLine.match(/\t/g) || []).length;
  if (tabs > commas && tabs > semis) return '\t';
  if (semis > commas) return ';';
  return ',';
}

export function parseCsvRows(text) {
  const raw = String(text || '').replace(/^\uFEFF/, '').trim();
  if (!raw) return [];
  const firstBreak = raw.indexOf('\n');
  const firstLine = firstBreak === -1 ? raw : raw.slice(0, firstBreak);
  const delim = detectDelimiter(firstLine);

  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    const next = raw[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\r') {
      // Ignora CR antes de LF
    } else if (ch === '\n') {
      row.push(cell.trim());
      if (row.some((v) => v !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }

  row.push(cell.trim());
  if (row.some((v) => v !== '')) rows.push(row);
  return rows;
}

export function detectCatalogImportFormat(headers = [], rawText = '') {
  const low = headers.map((h) => String(h || '').trim().toLowerCase());
  if (low.includes('exclusive shelf') || (low.includes('book id') && low.includes('my rating'))) {
    return 'goodreads';
  }
  if (low.includes('read status') || low.includes('star rating') || low.includes('isbn/uid')) {
    return 'storygraph';
  }
  if (low.includes('authors') && low.includes('title') && (low.includes('uuid') || low.includes('library_name') || low.includes('tags'))) {
    return 'calibre';
  }
  if (headers.length >= 2 && (low.includes('title') || low.includes('titulo') || low.includes('título'))) {
    return 'generic-csv';
  }
  if (String(rawText || '').trim().length > 0) {
    return 'plain-list';
  }
  return 'unknown';
}

function mapImportedStatus(rawStatus = '') {
  const low = String(rawStatus || '').trim().toLowerCase();
  if (/currently|reading|lendo|active|playing/.test(low)) return 'playing';
  if (/read$|completed|conclu|lido|finished/.test(low)) return 'completed';
  if (/dnf|did-not-finish|drop|abandon/.test(low)) return 'dropped';
  return 'queued';
}

function mapImportedRating(rawRating) {
  const num = Number(String(rawRating || '').replace(',', '.'));
  if (!Number.isFinite(num) || num <= 0) return null;
  if (num <= 5) return Math.round(num * 20);
  if (num <= 10) return Math.round(num * 10);
  return Math.min(100, Math.round(num));
}

function cleanIsbn(rawIsbn) {
  return String(rawIsbn || '')
    .replace(/^="?/, '')
    .replace(/"?$/, '')
    .replace(/[^0-9xX]/g, '')
    .toUpperCase();
}

export function findDuplicateMatch(candidate, existingItems = []) {
  const candIsbn = cleanIsbn(candidate?.isbn);
  const candTitle = cleanNormalized(candidate?.title);
  if (!candTitle && !candIsbn) return null;

  return (
    (Array.isArray(existingItems) ? existingItems : []).find((item) => {
      if (!item) return false;
      const itemIsbn = cleanIsbn(item.isbn);
      if (candIsbn && candIsbn.length >= 10 && itemIsbn === candIsbn) return true;
      const itemTitle = cleanNormalized(item.title);
      return Boolean(candTitle && itemTitle && candTitle === itemTitle);
    }) || null
  );
}

export function parseCatalogImport({ text = '', existingItems = [] } = {}) {
  const raw = String(text || '').trim();
  if (!raw) {
    return { format: 'unknown', records: [], duplicateCount: 0, newCount: 0 };
  }

  const rows = parseCsvRows(raw);
  const headerRow = rows[0] || [];
  const format = detectCatalogImportFormat(headerRow, raw);
  const today = getTodayLocalISO();

  let records = [];

  if (format === 'plain-list') {
    const lines = raw
      .split(/\r?\n/)
      .map((l) => l.trim().replace(/^[-*•\d.)\s]+/, '').trim())
      .filter(Boolean);

    records = lines.map((line, idx) => {
      const sepMatch = line.match(/^(.+?)\s+[—–-]\s+(.+)$/);
      const title = sepMatch ? sepMatch[1].trim() : line;
      const author = sepMatch ? sepMatch[2].trim() : '';
      return {
        tempId: `imp-${idx}`,
        title,
        author,
        status: 'queued',
        workType: 'book',
        totalPages: null,
        rating: null,
        isbn: '',
        tags: [],
        genres: [],
        createdAt: new Date().toISOString(),
      };
    });
  } else {
    const colIndex = new Map(
      headerRow.map((h, i) => [String(h || '').trim().toLowerCase(), i])
    );
    const get = (r, keys) => {
      for (const k of keys) {
        const idx = colIndex.get(k);
        if (idx !== undefined && r[idx] !== undefined && r[idx] !== '') {
          return String(r[idx]).trim();
        }
      }
      return '';
    };

    records = rows
      .slice(1)
      .map((r, idx) => {
        const title = get(r, ['title', 'título', 'titulo', 'nome']);
        if (!title) return null;
        const author = get(r, ['author', 'authors', 'autor', 'autores']);
        const isbn = cleanIsbn(get(r, ['isbn13', 'isbn/uid', 'isbn']));
        const status = mapImportedStatus(
          get(r, ['exclusive shelf', 'read status', 'status'])
        );
        const pagesRaw = Number(
          get(r, ['number of pages', 'pages', 'paginas', 'páginas'])
        );
        const totalPages = Number.isFinite(pagesRaw) && pagesRaw > 0 ? Math.round(pagesRaw) : null;
        const rating = mapImportedRating(
          get(r, ['my rating', 'star rating', 'rating', 'nota'])
        );
        const rawTags = get(r, ['tags', 'bookshelves', 'shelves', 'moods']);
        const tags = rawTags
          ? Array.from(
              new Set(
                rawTags
                  .split(/[,;|]/)
                  .map((t) => t.trim())
                  .filter(Boolean)
              )
            ).slice(0, 12)
          : [];
        const seriesName = get(r, ['series']);
        const rawCompleted = get(r, ['date read', 'last date read']);
        const completedDate =
          status === 'completed'
            ? rawCompleted && /^\d{4}[-/]\d{2}[-/]\d{2}/.test(rawCompleted)
              ? rawCompleted.slice(0, 10).replace(/\//g, '-')
              : today
            : null;

        return {
          tempId: `imp-${idx}`,
          title,
          author,
          isbn,
          status,
          totalPages,
          rating,
          tags,
          genres: [],
          seriesName,
          completedDate,
          workType: 'book',
          inBacklog: true,
        };
      })
      .filter(Boolean);
  }

  const annotated = records.map((rec) => {
    const duplicateOf = findDuplicateMatch(rec, existingItems);
    return {
      ...rec,
      isDuplicate: Boolean(duplicateOf),
      duplicateTitle: duplicateOf?.title || '',
    };
  });

  const duplicateCount = annotated.filter((r) => r.isDuplicate).length;
  return {
    format,
    records: annotated,
    duplicateCount,
    newCount: annotated.length - duplicateCount,
  };
}
