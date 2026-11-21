export const DICTIONARY_DB_NAME = 'codice_dictionary_v1';
const DICTIONARY_STORE = 'entries';
const REQUEST_TIMEOUT_MS = 5000;
const MEMORY_CACHE = new Map();

export function extractLookupTerm(rawText) {
  const cleaned = String(rawText || '')
    .trim()
    .replace(/^["'«»“”‘’()[\].,;:!?¿¡—–\-\s]+/, '')
    .replace(/["'«»“”‘’()[\].,;:!?¿¡—–\-\s]+$/, '')
    .replace(/\s+/g, ' ');
  if (!cleaned) return '';
  const words = cleaned.split(' ').filter(Boolean);
  if (words.length > 5) {
    return words.slice(0, 4).join(' ');
  }
  return cleaned;
}

function stripTagsPlainText(htmlLike) {
  return String(htmlLike || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseWiktionaryDefinitions(payload, term = '') {
  if (!payload || typeof payload !== 'object') return null;
  const buckets = Array.isArray(payload.pt)
    ? payload.pt
    : Array.isArray(payload.en)
      ? payload.en
      : Object.values(payload).find((v) => Array.isArray(v));
  if (!Array.isArray(buckets) || buckets.length === 0) return null;

  for (const entry of buckets) {
    const pos = String(entry?.partOfSpeech || '').trim();
    const defs = Array.isArray(entry?.definitions) ? entry.definitions : [];
    for (const def of defs) {
      const text = stripTagsPlainText(def?.definition || '');
      if (text) {
        return {
          term,
          phonetic: '',
          definition: pos ? `(${pos}) ${text}` : text,
          sourceLabel: payload.pt ? 'Wikcionário (PT)' : 'Wiktionary (EN)',
          sourceUrl: `https://pt.wiktionary.org/wiki/${encodeURIComponent(term.toLowerCase())}`,
        };
      }
    }
  }
  return null;
}

function openDictionaryDb() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DICTIONARY_DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(DICTIONARY_STORE)) {
          db.createObjectStore(DICTIONARY_STORE, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function getCachedDictionaryEntry(termKey) {
  const cleanKey = String(termKey || '').trim().toLowerCase();
  if (!cleanKey) return null;
  if (MEMORY_CACHE.has(cleanKey)) {
    return MEMORY_CACHE.get(cleanKey);
  }
  const db = await openDictionaryDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(DICTIONARY_STORE, 'readonly');
      const req = tx.objectStore(DICTIONARY_STORE).get(cleanKey);
      req.onsuccess = () => {
        const val = req.result?.entry || null;
        if (val) MEMORY_CACHE.set(cleanKey, val);
        resolve(val);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function setCachedDictionaryEntry(termKey, entry) {
  const cleanKey = String(termKey || '').trim().toLowerCase();
  if (!cleanKey || !entry?.ok) return;
  MEMORY_CACHE.set(cleanKey, entry);
  const db = await openDictionaryDb();
  if (!db) return;
  try {
    const tx = db.transaction(DICTIONARY_STORE, 'readwrite');
    tx.objectStore(DICTIONARY_STORE).put({
      key: cleanKey,
      entry,
      cachedAt: new Date().toISOString(),
    });
  } catch {
    // Falha silenciosa de cache
  }
}

async function fetchJsonWithTimeout(url, externalSignal, fetchFn = globalThis.fetch) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const onExternalAbort = () => controller.abort();
  externalSignal?.addEventListener?.('abort', onExternalAbort, { once: true });

  try {
    const response = await fetchFn(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      return { ok: false, status: response.status, data: null };
    }
    const data = await response.json();
    return { ok: true, status: response.status, data };
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener?.('abort', onExternalAbort);
  }
}

export async function lookupDictionaryTerm(
  rawSelection,
  { signal, fetchFn = globalThis.fetch, forceCache = false } = {}
) {
  const term = extractLookupTerm(rawSelection);
  if (!term) {
    return {
      ok: false,
      term: '',
      error: 'Selecione uma palavra ou expressão curta para consultar.',
    };
  }

  const cacheAllowed = forceCache || typeof indexedDB !== 'undefined';
  if (cacheAllowed) {
    const cached = await getCachedDictionaryEntry(term);
    if (cached?.ok) {
      return { ...cached, fromCache: true };
    }
  }

  const singleWord = term.split(' ').length === 1;
  const lowerTerm = term.toLowerCase();
  const wikiTitle = encodeURIComponent(term.replace(/\s+/g, '_'));
  const wiktUrl = `https://pt.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(lowerTerm)}`;
  const dictUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(lowerTerm)}`;
  const wikiSummaryUrl = `https://pt.wikipedia.org/api/rest_v1/page/summary/${wikiTitle}`;

  const wiktTask = singleWord ? fetchJsonWithTimeout(wiktUrl, signal, fetchFn) : null;
  const dictTask = singleWord ? fetchJsonWithTimeout(dictUrl, signal, fetchFn) : null;
  const wikiTask = fetchJsonWithTimeout(wikiSummaryUrl, signal, fetchFn);

  const activeTasks = [wiktTask, dictTask, wikiTask].filter(Boolean);
  const settledAll = await Promise.allSettled(activeTasks);
  if (signal?.aborted) {
    return { ok: false, term, aborted: true };
  }

  const [wiktRes, dictRes, wikiRes] = await Promise.allSettled([
    wiktTask ?? Promise.resolve(null),
    dictTask ?? Promise.resolve(null),
    wikiTask,
  ]);

  if (wiktRes.status === 'fulfilled' && wiktRes.value?.ok && wiktRes.value.data) {
    const parsed = parseWiktionaryDefinitions(wiktRes.value.data, term);
    if (parsed) {
      const okPayload = { ok: true, ...parsed };
      if (cacheAllowed) await setCachedDictionaryEntry(term, okPayload);
      return okPayload;
    }
  }

  if (
    dictRes.status === 'fulfilled' &&
    dictRes.value?.ok &&
    Array.isArray(dictRes.value.data) &&
    dictRes.value.data[0]
  ) {
    const entry = dictRes.value.data[0];
    const firstMeaning = entry.meanings?.[0];
    const firstDef = firstMeaning?.definitions?.[0]?.definition || '';
    if (firstDef) {
      const okPayload = {
        ok: true,
        term: entry.word || term,
        phonetic: entry.phonetic || '',
        definition: firstMeaning?.partOfSpeech
          ? `(${firstMeaning.partOfSpeech}) ${firstDef}`
          : firstDef,
        sourceLabel: 'Free Dictionary API',
        sourceUrl: entry.sourceUrls?.[0] || '',
      };
      if (cacheAllowed) await setCachedDictionaryEntry(term, okPayload);
      return okPayload;
    }
  }

  if (wikiRes.status === 'fulfilled' && wikiRes.value?.ok && wikiRes.value.data?.extract) {
    const data = wikiRes.value.data;
    const okPayload = {
      ok: true,
      term: data.title || term,
      phonetic: '',
      definition: String(data.extract).trim(),
      sourceLabel: 'Wikipédia (PT)',
      sourceUrl: data.content_urls?.desktop?.page || '',
    };
    if (cacheAllowed) await setCachedDictionaryEntry(term, okPayload);
    return okPayload;
  }

  const allNetworkFailed = settledAll.every((r) => r.status === 'rejected');
  return {
    ok: false,
    term,
    error: allNetworkFailed
      ? 'Não foi possível consultar o termo offline. Verifique sua conexão.'
      : `Nenhuma definição encontrada para "${term}".`,
  };
}
