import { domainConfig } from '../config/domainConfig.js';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/';
const MODEL_CACHE_KEY = 'codice_gemini_resolved_model_v1';
const MODEL_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8000;
const RATE_LIMIT_DELAYS_MS = [1000, 2000];

const EXCLUDED_MODEL_PATTERNS = [
  /embedding/i,
  /\baqa\b/i,
  /imagen/i,
  /\bveo\b/i,
  /\btts\b/i,
  /audio/i,
  /image/i,
  /robotics/i,
  /computer-use/i,
  /\blive\b/i,
  /gemma/i,
];

export class GeminiError extends Error {
  constructor(code, userMessage, cause) {
    super(userMessage);
    this.name = 'GeminiError';
    this.code = code;
    this.userMessage = userMessage;
    if (cause) {
      this.cause = cause;
    }
  }
}

function getCacheStorage() {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null;
  } catch {
    return null;
  }
}

function readCachedModels() {
  const storage = getCacheStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(MODEL_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed.model !== 'string' ||
      !Array.isArray(parsed.candidates) ||
      Date.now() - Number(parsed.timestamp || 0) >= MODEL_CACHE_TTL_MS
    ) {
      storage.removeItem(MODEL_CACHE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeCachedModels(model, candidates) {
  const storage = getCacheStorage();
  if (!storage) return;
  try {
    storage.setItem(
      MODEL_CACHE_KEY,
      JSON.stringify({
        model,
        candidates,
        timestamp: Date.now(),
      })
    );
  } catch {
    // Ignora falha de quota
  }
}

export function invalidateGeminiModelCache() {
  const storage = getCacheStorage();
  if (!storage) return;
  try {
    storage.removeItem(MODEL_CACHE_KEY);
  } catch {
    // Ignora erro de storage
  }
}

function extractModelId(rawName) {
  return String(rawName || '').replace(/^models\//i, '').trim();
}

function scoreModelCandidate(modelEntry) {
  const id = extractModelId(modelEntry?.name);
  if (!id || !/^gemini/i.test(id)) return -1;
  if (EXCLUDED_MODEL_PATTERNS.some((pattern) => pattern.test(id))) {
    return -1;
  }

  let familyScore = 0;
  if (/flash-lite/i.test(id) || /flash-8b/i.test(id)) {
    familyScore = 2000;
  } else if (/flash/i.test(id)) {
    familyScore = 3000;
  } else if (/pro/i.test(id)) {
    familyScore = 1000;
  }

  const versionMatch = id.match(/gemini-(\d+)(?:\.(\d+))?/i);
  const major = versionMatch ? Number(versionMatch[1] || 0) : 0;
  const minor = versionMatch ? Number(versionMatch[2] || 0) : 0;
  const versionScore = major * 100 + minor * 10;

  const isPreviewOrExp = /-(preview|exp|experimental)/i.test(id);
  const stabilityScore = isPreviewOrExp ? 0 : 50;
  const isLatestAlias = /-latest$/i.test(id) ? 5 : 0;
  const compactBonus = Math.max(0, 30 - id.length) * 0.1;

  return familyScore + versionScore + stabilityScore + isLatestAlias + compactBonus;
}

export function selectBestGeminiModels(modelsList = []) {
  return modelsList
    .filter(
      (entry) =>
        Array.isArray(entry?.supportedGenerationMethods) &&
        entry.supportedGenerationMethods.includes('generateContent')
    )
    .map((entry) => ({
      id: extractModelId(entry.name),
      score: scoreModelCandidate(entry),
    }))
    .filter((candidate) => candidate.score >= 0)
    .sort((a, b) => b.score - a.score)
    .map((candidate) => candidate.id);
}

function buildModelsListUrl(apiKey) {
  const url = new URL('models', GEMINI_API_BASE);
  const params = new URLSearchParams({ key: apiKey });
  url.search = params.toString();
  return url.toString();
}

function buildGenerateContentUrl(modelId) {
  const cleanId = extractModelId(modelId);
  const url = new URL(
    `models/${encodeURIComponent(cleanId)}:generateContent`,
    GEMINI_API_BASE
  );
  return url.toString();
}

async function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const { signal: parentSignal, ...fetchOptions } = options;
  const controller = new AbortController();
  let timedOut = false;

  const onParentAbort = () => controller.abort();
  if (parentSignal) {
    if (parentSignal.aborted) {
      const abortErr = new Error('Aborted');
      abortErr.name = 'AbortError';
      throw abortErr;
    }
    parentSignal.addEventListener('abort', onParentAbort, { once: true });
  }

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, { ...fetchOptions, signal: controller.signal });
  } catch (err) {
    if (err?.name === 'AbortError' && !timedOut && parentSignal?.aborted) {
      throw err;
    }
    throw new GeminiError(
      timedOut ? 'TIMEOUT' : 'NETWORK_ERROR',
      'Verifique sua conexão com a internet e tente novamente.',
      err
    );
  } finally {
    clearTimeout(timer);
    if (parentSignal) {
      parentSignal.removeEventListener('abort', onParentAbort);
    }
  }
}

function waitWithSignal(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      const err = new Error('Aborted');
      err.name = 'AbortError';
      reject(err);
      return;
    }

    const timer = setTimeout(() => {
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      const err = new Error('Aborted');
      err.name = 'AbortError';
      reject(err);
    };

    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

function mapHttpStatusToGeminiError(status, detail = '') {
  if (status === 400 || status === 401 || status === 403) {
    return new GeminiError(
      'AUTH_INVALID',
      'Chave do Google Gemini inválida ou sem permissão. Verifique nas configurações do Perfil.',
      detail
    );
  }
  if (status === 404) {
    return new GeminiError(
      'MODEL_NOT_FOUND',
      'Modelo Gemini indisponível no momento; já tentamos outro modelo automaticamente.',
      detail
    );
  }
  if (status === 429) {
    return new GeminiError(
      'RATE_LIMIT',
      'Limite gratuito atingido. Tente novamente em alguns minutos.',
      detail
    );
  }
  return new GeminiError(
    `HTTP_${status}`,
    `Não foi possível concluir a chamada ao Gemini (código ${status}).`,
    detail
  );
}

export async function resolveModel(
  apiKey,
  { signal, forceRefresh = false, excludeModels = [] } = {}
) {
  const cleanKey = String(apiKey || '').trim();
  if (!cleanKey) {
    throw new GeminiError(
      'MISSING_KEY',
      'Chave do Google Gemini não configurada. Adicione sua chave gratuita nas configurações do Perfil.'
    );
  }

  const excludedSet = new Set(excludeModels.map(extractModelId));

  if (!forceRefresh) {
    const cached = readCachedModels();
    if (cached) {
      const candidate = [cached.model, ...cached.candidates].find(
        (m) => m && !excludedSet.has(m)
      );
      if (candidate) return candidate;
    }
  }

  const modelsUrl = buildModelsListUrl(cleanKey);
  const response = await fetchWithTimeout(modelsUrl, {
    method: 'GET',
    signal,
  });

  if (!response.ok) {
    throw mapHttpStatusToGeminiError(response.status);
  }

  let data;
  try {
    data = await response.json();
  } catch (err) {
    throw new GeminiError(
      'INVALID_RESPONSE',
      'Resposta inesperada ao listar modelos do Google Gemini.',
      err
    );
  }

  const rankedModels = selectBestGeminiModels(data?.models || []);
  const chosen = rankedModels.find((m) => !excludedSet.has(m)) || rankedModels[0];

  if (!chosen) {
    throw new GeminiError(
      'NO_MODEL_AVAILABLE',
      'Nenhum modelo compatível com geração de texto está disponível para esta chave.'
    );
  }

  writeCachedModels(chosen, rankedModels);
  return chosen;
}

function parseJsonResponse(rawText) {
  const clean = String(rawText || '')
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(clean);
  } catch (err) {
    throw new GeminiError(
      'PARSE_ERROR',
      'A resposta da IA veio em formato inesperado. Tente novamente.',
      err
    );
  }
}

export async function callGemini({
  apiKey,
  systemInstruction = '',
  prompt,
  jsonMode = false,
  temperature = 0.4,
  signal,
}) {
  const cleanKey = String(apiKey || '').trim();
  if (!cleanKey) {
    throw new GeminiError(
      'MISSING_KEY',
      'Chave do Google Gemini não configurada. Adicione sua chave gratuita nas configurações do Perfil.'
    );
  }

  const body = {
    ...(systemInstruction
      ? {
          systemInstruction: {
            parts: [{ text: systemInstruction }],
          },
        }
      : {}),
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature,
      ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
    },
  };

  let didRetry404 = false;
  const excludedModels = [];
  let modelId = await resolveModel(cleanKey, { signal });

  while (true) {
    let response;
    let rateLimitAttempt = 0;

    while (true) {
      response = await fetchWithTimeout(buildGenerateContentUrl(modelId), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': cleanKey,
        },
        body: JSON.stringify(body),
        signal,
      });

      if (response.status === 429 && rateLimitAttempt < RATE_LIMIT_DELAYS_MS.length) {
        await waitWithSignal(RATE_LIMIT_DELAYS_MS[rateLimitAttempt], signal);
        rateLimitAttempt += 1;
        continue;
      }
      break;
    }

    if (response.status === 404 && !didRetry404) {
      didRetry404 = true;
      excludedModels.push(modelId);
      invalidateGeminiModelCache();
      modelId = await resolveModel(cleanKey, {
        signal,
        forceRefresh: true,
        excludeModels: excludedModels,
      });
      continue;
    }

    if (!response.ok) {
      throw mapHttpStatusToGeminiError(response.status);
    }

    let data;
    try {
      data = await response.json();
    } catch (err) {
      throw new GeminiError(
        'INVALID_RESPONSE',
        'Não foi possível ler a resposta do Google Gemini.',
        err
      );
    }

    const text = (data?.candidates?.[0]?.content?.parts || [])
      .map((part) => part?.text || '')
      .join('')
      .trim();

    if (!text) {
      throw new GeminiError(
        'EMPTY_RESPONSE',
        'A API Gemini retornou uma resposta vazia. Tente reformular ou tentar novamente.'
      );
    }

    return text;
  }
}

export async function runSmartCataloging(apiKey, item, { signal } = {}) {
  const allowedAtmospheres = domainConfig.atmosphereOptions.map((a) => a.id);
  const workType = item?.workType || 'book';

  const systemInstruction =
    'Você é um catalogador editorial especialista em literatura, mangás/light novels e normas bibliográficas ABNT NBR 6023. Responda sempre em português do Brasil, em JSON estrito, sem inventar dados que contradigam o usuário e sem spoilers.';

  const prompt = `Analise a obra abaixo e complete a catalogação em JSON estrito com estas chaves:
{
  "synopsis": "Sinopse envolvente em 2 a 3 frases, estritamente SEM SPOILERS",
  "genres": ["até 3 gêneros ou áreas temáticas em português"],
  "atmosphere": ["selecione 1 a 3 dentre exatamente: ${allowedAtmospheres.join(', ')}"],
  "seriesVolume": "nome da série e volume se aplicável, ou string vazia",
  "publisher": "editora provável se ausente e conhecida, ou string vazia",
  "translator": "tradutor famoso no Brasil se aplicável, ou string vazia",
  "demographicOrigin": "apenas para manga: Mangá | Manhwa | Light Novel | HQ, senão string vazia",
  "abntReference": "apenas para workType=academic: referência bibliográfica completa formatada nas normas ABNT NBR 6023, senão string vazia",
  "keywords": "apenas para workType=academic: 3 a 5 palavras-chave separadas por vírgula, senão string vazia"
}

Dados atuais da obra:
- Título: ${item?.title || ''}
- Autor(es): ${item?.author || 'Não informado'}
- Natureza da Obra (workType): ${workType}
- Ano: ${item?.releaseYear || 'Não informado'}
- Editora / Instituição: ${item?.institution || item?.publisher || 'Não informada'}
- ISBN: ${item?.isbn || 'Não informado'}
- Gêneros atuais: ${(item?.genres || []).join(', ') || 'Nenhum'}`;

  const raw = await callGemini({
    apiKey,
    systemInstruction,
    prompt,
    jsonMode: true,
    temperature: 0.3,
    signal,
  });

  const parsed = parseJsonResponse(raw);
  const validAtmospheres = Array.isArray(parsed.atmosphere)
    ? parsed.atmosphere.filter((a) => allowedAtmospheres.includes(a))
    : [];

  return {
    synopsis: typeof parsed.synopsis === 'string' ? parsed.synopsis.trim() : '',
    genres: Array.isArray(parsed.genres)
      ? parsed.genres.map((g) => String(g).trim()).filter(Boolean).slice(0, 4)
      : [],
    atmosphere: validAtmospheres,
    seriesVolume:
      typeof parsed.seriesVolume === 'string' ? parsed.seriesVolume.trim() : '',
    publisher:
      typeof parsed.publisher === 'string' ? parsed.publisher.trim() : '',
    translator:
      typeof parsed.translator === 'string' ? parsed.translator.trim() : '',
    demographicOrigin:
      typeof parsed.demographicOrigin === 'string'
        ? parsed.demographicOrigin.trim()
        : '',
    abntReference:
      typeof parsed.abntReference === 'string' ? parsed.abntReference.trim() : '',
    keywords:
      typeof parsed.keywords === 'string' ? parsed.keywords.trim() : '',
  };
}

export async function runCollectionOracle(
  apiKey,
  {
    mood,
    queuedItems = [],
    completedItems = [],
    favoriteGenres = [],
    readerFocus = '',
    preferredCriterion = '',
  },
  { signal } = {}
) {
  const shelfSummary = queuedItems.slice(0, 40).map((item) => ({
    id: item.id,
    title: item.title,
    author: item.author || 'Desconhecido',
    workType: item.workType || 'book',
    pages: item.totalPages || null,
    chapters: item.totalChapters || null,
    hype: item.hype || null,
    genres: item.genres || [],
    atmosphere: item.atmosphere || [],
    tropes: item.tropes || [],
  }));

  const tasteHistory = completedItems
    .slice()
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 15)
    .map((item) => ({
      title: item.title,
      author: item.author || '',
      rating: item.rating,
      verdict: item.verdict || '',
      fiveStars: Boolean(item.isPlatinum),
      genres: item.genres || [],
      atmosphere: item.atmosphere || [],
    }));

  const systemInstruction =
    'Você é o Oráculo do Acervo de um aplicativo literário. Recomende exclusivamente obras presentes na lista "Na Estante" fornecida pelo usuário. Não invente títulos fora do acervo. Responda em JSON estrito e em português do Brasil.';

  const prompt = `Cruze o humor/objetivo atual do leitor com as obras em "Na Estante", suas preferências do perfil e o histórico de notas das obras "Concluídas" para indicar a próxima leitura ideal.

Humor / Objetivo atual do leitor: ${mood || 'Surpreenda-me com a melhor escolha do meu acervo'}
Perfil do leitor: ${readerFocus || 'Geral'} | Critério valorizado: ${preferredCriterion || 'Equilibrado'}
Gêneros favoritos do perfil: ${favoriteGenres.length ? favoriteGenres.join(', ') : 'Diversos'}

Obras em Na Estante (escolha SOMENTE dentre estes IDs):
${JSON.stringify(shelfSummary)}

Histórico de gosto (Obras Concluídas e notas):
${JSON.stringify(tasteHistory)}

Retorne JSON estrito neste formato:
{
  "primaryId": "id exato da obra principal recomendada da lista Na Estante",
  "headline": "Frase curta de chamada editorial (máx 10 palavras)",
  "reason": "Explicação concisa (2-3 frases) conectando o humor/objetivo e o histórico de gostos do leitor sem spoilers",
  "alternatives": [
    { "id": "id exato de outra obra da estante", "why": "motivo curto em 1 frase" }
  ]
}`;

  const raw = await callGemini({
    apiKey,
    systemInstruction,
    prompt,
    jsonMode: true,
    temperature: 0.5,
    signal,
  });

  const parsed = parseJsonResponse(raw);
  const validIds = new Set(queuedItems.map((i) => i.id));
  const primaryId = validIds.has(parsed.primaryId)
    ? parsed.primaryId
    : queuedItems[0]?.id || null;

  const alternatives = Array.isArray(parsed.alternatives)
    ? parsed.alternatives
        .filter((alt) => alt && validIds.has(alt.id) && alt.id !== primaryId)
        .slice(0, 2)
    : [];

  return {
    primaryId,
    headline: String(parsed.headline || 'Leitura recomendada para este momento').trim(),
    reason: String(parsed.reason || '').trim(),
    alternatives,
  };
}

export async function runSpoilerFreeRecap(
  apiKey,
  { item, linkedPosts = [] },
  { signal } = {}
) {
  const positionLabel =
    item.workType === 'manga'
      ? `Volume ${item.currentVolume || 0}, Capítulo ${item.currentChapter || 0}`
      : `Página ${item.currentPage || 0}${item.totalPages ? ` de ${item.totalPages}` : ''}`;

  const records = linkedPosts.map((post) => ({
    date: post.createdAt,
    marker: post.progressMarker || '',
    title: post.title,
    caption: post.caption,
    updates: (post.comments || []).map((c) => c.text),
  }));

  const quotes = (item.quotes || []).map((q) => ({
    location: q.location,
    text: q.text,
    note: q.note,
  }));

  const systemInstruction =
    'Você é um assistente editorial de memória de leitura. Sua regra ABSOLUTA é ZERO SPOILERS: nunca revele, antecipe ou insinue eventos posteriores ao ponto atual informado pelo leitor. Baseie-se prioritariamente nos registros, citações e anotações fornecidas pelo próprio usuário.';

  const prompt = `Gere uma recapitulação estruturada e concisa de onde o leitor parou, estritamente SEM SPOILERS além do marcador atual.

Obra: ${item.title} (${item.author || 'Autor não informado'})
Natureza: ${item.workType || 'book'}
Posição atual exata: ${positionLabel}
Checkpoint / Seção: ${item.checkpoint || 'Não informado'}
Sinopse base (sem spoilers): ${item.synopsis || 'Não informada'}
Anotações pessoais: ${item.notes || 'Nenhuma'}

Registros no Diário & Storyline:
${JSON.stringify(records)}

Citações salvas no Cofre:
${JSON.stringify(quotes)}

Estruture em texto limpo (sem markdown excessivo e SEM EMOJIS) com:
1. Ponto de Parada (onde você está)
2. Síntese até aqui (baseada nos registros e contexto seguro até a posição atual)
3. Ganchos / Pontos para retomar a leitura`;

  return callGemini({
    apiKey,
    systemInstruction,
    prompt,
    jsonMode: false,
    temperature: 0.35,
    signal,
  });
}

export async function runReviewOrAbstractSynthesis(
  apiKey,
  { item, linkedPosts = [], mode = 'auto' },
  { signal } = {}
) {
  const targetMode =
    mode === 'academic' || (mode === 'auto' && item.workType === 'academic')
      ? 'academic'
      : 'literary';

  const quotes = (item.quotes || []).map((q) => ({
    location: q.location,
    text: q.text,
    note: q.note,
  }));

  const records = linkedPosts.map((post) => ({
    marker: post.progressMarker || '',
    title: post.title,
    caption: post.caption,
    updates: (post.comments || []).map((c) => c.text),
  }));

  const systemInstruction =
    targetMode === 'academic'
      ? 'Você é um orientador de pesquisa acadêmica e redator científico (padrão TCC/ABNT). Escreva em português formal, objetivo, crítico e rigoroso, sem emojis.'
      : 'Você é um crítico literário editorial. Escreva uma resenha literária estruturada, elegante e sem emojis em português do Brasil, integrando as citações e impressões do leitor.';

  const taskInstruction =
    targetMode === 'academic'
      ? `Transforme as citações, fichamento e anotações abaixo em um RESUMO ACADÊMICO CRÍTICO (pronto para uso em TCC/Artigo), contendo:
- Tema e Tese Central
- Desenvolvimento Metodológico / Argumentos-Chave
- Síntese das Citações e Notas Analíticas
- Contribuição Crítica e Aplicabilidade`
      : `Transforme as citações, nota e anotações abaixo em uma RESENHA LITERÁRIA ESTRUTURADA, contendo:
- Apresentação da Obra (sem spoilers pesados)
- Análise de Estilo, Ritmo e Profundidade
- Destaques das Citações Salvas
- Impressão Final & Veredito (${item.rating !== null ? `${item.rating}/100` : 'sem nota'}${item.verdict ? ` — ${item.verdict}` : ''})`;

  const prompt = `${taskInstruction}

Obra: ${item.title}
Autor(es): ${item.author || 'Não informado'}
Ano: ${item.releaseYear || 'Não informado'}
Instituição / Editora: ${item.institution || item.publisher || 'Não informada'}
Nota: ${item.rating ?? 'N/A'}/100 | Veredito: ${item.verdict || 'N/A'} | Favorito 5 Estrelas: ${item.isPlatinum ? 'Sim' : 'Não'}
Anotações pessoais: ${item.notes || 'Nenhuma'}
Fichamento prévio: ${item.fichamento || 'Nenhum'}

Citações salvas no Cofre:
${JSON.stringify(quotes)}

Registros no Diário / Storyline:
${JSON.stringify(records)}`;

  return callGemini({
    apiKey,
    systemInstruction,
    prompt,
    jsonMode: false,
    temperature: 0.45,
    signal,
  });
}
