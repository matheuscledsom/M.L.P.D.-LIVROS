import { domainConfig } from '../config/domainConfig';

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

function parseJsonResponse(rawText) {
  const clean = String(rawText || '')
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  return JSON.parse(clean);
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
    throw new Error(
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

  let response;
  try {
    response = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': cleanKey,
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new Error('Não foi possível conectar à API do Google Gemini.');
  }

  if (!response.ok) {
    if (response.status === 400 || response.status === 401 || response.status === 403) {
      throw new Error(
        'Chave do Google Gemini inválida ou sem permissão. Verifique nas configurações do Perfil.'
      );
    }
    if (response.status === 429) {
      throw new Error(
        'Limite de requisições da cota gratuita atingido. Aguarde alguns instantes e tente novamente.'
      );
    }
    throw new Error(`Erro na API Gemini (HTTP ${response.status}).`);
  }

  const data = await response.json();
  const text = (data?.candidates?.[0]?.content?.parts || [])
    .map((part) => part?.text || '')
    .join('')
    .trim();

  if (!text) {
    throw new Error('A API Gemini retornou uma resposta vazia.');
  }

  return text;
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
  { mood, queuedItems = [], completedItems = [] },
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

  const prompt = `Cruze o humor/objetivo atual do leitor com as obras em "Na Estante" e o histórico de notas das obras "Concluídas" para indicar a próxima leitura ideal.

Humor / Objetivo atual do leitor: ${mood || 'Surpreenda-me com a melhor escolha do meu acervo'}

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
