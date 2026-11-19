const REQUEST_TIMEOUT_MS = 8000;

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

async function fetchJsonWithTimeout(url, externalSignal) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const onExternalAbort = () => controller.abort();
  externalSignal?.addEventListener?.('abort', onExternalAbort, { once: true });

  try {
    const response = await fetch(url, {
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

export async function lookupReaderTerm(rawSelection, { signal } = {}) {
  const term = extractLookupTerm(rawSelection);
  if (!term) {
    return {
      ok: false,
      term: '',
      error: 'Selecione uma palavra ou expressão curta para consultar.',
    };
  }

  const singleWord = term.split(' ').length === 1;
  const wikiTitle = encodeURIComponent(term.replace(/\s+/g, '_'));
  const wikiUrl = `https://pt.wikipedia.org/api/rest_v1/page/summary/${wikiTitle}`;

  const tasks = [fetchJsonWithTimeout(wikiUrl, signal)];
  if (singleWord) {
    const dictUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(term.toLowerCase())}`;
    tasks.push(fetchJsonWithTimeout(dictUrl, signal));
  }

  const settled = await Promise.allSettled(tasks);
  if (signal?.aborted) {
    return { ok: false, term, aborted: true };
  }

  const wikiResult = settled[0];
  if (
    wikiResult.status === 'fulfilled' &&
    wikiResult.value.ok &&
    wikiResult.value.data?.extract &&
    wikiResult.value.data?.type !== 'disambiguation'
  ) {
    const data = wikiResult.value.data;
    return {
      ok: true,
      term: data.title || term,
      phonetic: '',
      definition: String(data.extract).trim(),
      sourceLabel: 'Wikipédia (PT)',
      sourceUrl: data.content_urls?.desktop?.page || '',
    };
  }

  const dictResult = settled[1];
  if (
    dictResult?.status === 'fulfilled' &&
    dictResult.value.ok &&
    Array.isArray(dictResult.value.data) &&
    dictResult.value.data[0]
  ) {
    const entry = dictResult.value.data[0];
    const firstMeaning = entry.meanings?.[0];
    const firstDef = firstMeaning?.definitions?.[0]?.definition || '';
    if (firstDef) {
      return {
        ok: true,
        term: entry.word || term,
        phonetic: entry.phonetic || '',
        definition: firstMeaning?.partOfSpeech
          ? `(${firstMeaning.partOfSpeech}) ${firstDef}`
          : firstDef,
        sourceLabel: 'Free Dictionary API',
        sourceUrl: entry.sourceUrls?.[0] || '',
      };
    }
  }

  if (
    wikiResult.status === 'fulfilled' &&
    wikiResult.value.ok &&
    wikiResult.value.data?.extract
  ) {
    const data = wikiResult.value.data;
    return {
      ok: true,
      term: data.title || term,
      phonetic: '',
      definition: String(data.extract).trim(),
      sourceLabel: 'Wikipédia (PT)',
      sourceUrl: data.content_urls?.desktop?.page || '',
    };
  }

  const allNetworkFailed = settled.every((r) => r.status === 'rejected');
  return {
    ok: false,
    term,
    error: allNetworkFailed
      ? 'Não foi possível consultar o termo offline. Verifique sua conexão.'
      : `Nenhuma definição encontrada para "${term}".`,
  };
}
