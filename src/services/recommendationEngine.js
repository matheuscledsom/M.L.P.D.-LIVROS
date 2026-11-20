import { normalizePublisherName } from '../data/brazilianPublishers.js';
import { catalogItems } from '../data/mockData.js';

function normalizeToken(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function splitPeople(rawValue) {
  return String(rawValue || '')
    .split(/[;,]/)
    .map((s) => normalizeToken(s))
    .filter((s) => s.length >= 3);
}

function extractCddMajorClass(cduCdd) {
  const digits = String(cduCdd || '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  return digits.slice(0, 2);
}

export function buildReaderTasteProfile(items = [], profile = null) {
  const backlog = Array.isArray(items) ? items.filter((i) => i && i.inBacklog !== false) : [];
  const highRated = backlog
    .filter((item) => Number(item.rating) >= 80 || Boolean(item.isPlatinum))
    .sort((a, b) => {
      const timeB = Date.parse(b.completedDate || b.updatedAt || '') || 0;
      const timeA = Date.parse(a.completedDate || a.updatedAt || '') || 0;
      return timeB - timeA || (Number(b.rating) || 0) - (Number(a.rating) || 0);
    });

  const onboardingGenres = new Set(
    (Array.isArray(profile?.favoriteGenres) ? profile.favoriteGenres : [])
      .map(normalizeToken)
      .filter(Boolean)
  );
  const readerFocus = normalizeToken(profile?.readerFocus || '');

  const preferredAuthors = new Map();
  const preferredPublishers = new Map();
  const preferredCdd = new Map();
  const preferredGenres = new Map();

  for (const genre of onboardingGenres) {
    preferredGenres.set(genre, (preferredGenres.get(genre) || 0) + 2);
  }

  for (const item of highRated) {
    const ratingWeight = item.isPlatinum || Number(item.rating) >= 90 ? 2 : 1;

    for (const author of splitPeople(item.author || item.creator)) {
      preferredAuthors.set(author, (preferredAuthors.get(author) || 0) + ratingWeight);
    }

    const pub = normalizeToken(normalizePublisherName(item.publisher || ''));
    if (pub) {
      preferredPublishers.set(pub, (preferredPublishers.get(pub) || 0) + ratingWeight);
    }

    const cdd = extractCddMajorClass(item.cdu_cdd);
    if (cdd) {
      preferredCdd.set(cdd, (preferredCdd.get(cdd) || 0) + ratingWeight);
    }

    for (const g of Array.isArray(item.genres) ? item.genres : []) {
      const ng = normalizeToken(g);
      if (ng) {
        preferredGenres.set(ng, (preferredGenres.get(ng) || 0) + ratingWeight);
      }
    }
  }

  return {
    onboardingGenres,
    readerFocus,
    preferredAuthors,
    preferredPublishers,
    preferredCdd,
    preferredGenres,
    recentLovedWorks: highRated.slice(0, 3),
  };
}

export function scoreCandidateForMood(item, tasteProfile, mood = '') {
  if (!item) return { item, score: 0, reasons: [] };
  let score = 0;
  const reasons = [];

  const normMood = normalizeToken(mood);
  const titleText = normalizeToken(`${item.title || ''} ${item.originalTitle || ''}`);
  const genres = Array.isArray(item.genres) ? item.genres : [];
  const normGenres = genres.map(normalizeToken).filter(Boolean);
  const tropesText = normalizeToken(
    [...(item.tropes || []), ...(item.atmosphere || []), item.synopsis || ''].join(' ')
  );
  const fullText = `${titleText} ${normGenres.join(' ')} ${tropesText}`;
  const pages = Number(item.totalPages) || 0;

  // 1. Afinidade com foco/gêneros do onboarding
  for (const genre of genres) {
    const ng = normalizeToken(genre);
    if (tasteProfile.onboardingGenres.has(ng)) {
      score += 14;
      reasons.push(`gênero favorito (${genre})`);
      break;
    }
  }
  if (
    (tasteProfile.readerFocus.includes('academ') || tasteProfile.readerFocus.includes('pesquis')) &&
    item.workType === 'academic'
  ) {
    score += 12;
    reasons.push('foco acadêmico do seu perfil');
  } else if (
    tasteProfile.readerFocus.includes('manga') &&
    item.workType === 'manga'
  ) {
    score += 10;
  }

  // 2. Autores bem avaliados (>= 80)
  for (const author of splitPeople(item.author || item.creator)) {
    if (tasteProfile.preferredAuthors.has(author)) {
      score += 28;
      reasons.push(`autor bem avaliado no seu acervo (${item.author || item.creator})`);
      break;
    }
  }

  // 3. Editora padronizada favorita
  const rawPub = normalizePublisherName(item.publisher || '');
  const normPub = normalizeToken(rawPub);
  if (normPub && tasteProfile.preferredPublishers.has(normPub)) {
    score += 16;
    reasons.push(`editora recorrente nas suas notas altas (${rawPub})`);
  }

  // 4. Assunto CDD/CDU compatível com obras >= 80
  const itemCdd = extractCddMajorClass(item.cdu_cdd);
  if (itemCdd && tasteProfile.preferredCdd.has(itemCdd)) {
    score += 14;
    reasons.push(`assunto CDD ${item.cdu_cdd} alinhado ao seu histórico`);
  }

  // 5. Gêneros das leituras recentes bem avaliadas
  let genreMatches = 0;
  for (const ng of normGenres) {
    if (tasteProfile.preferredGenres.has(ng) && !tasteProfile.onboardingGenres.has(ng)) {
      genreMatches += 1;
    }
  }
  if (genreMatches > 0) {
    score += Math.min(20, genreMatches * 10);
    if (reasons.length === 0) {
      reasons.push('afinidade temática com suas leituras recentes >= 80');
    }
  }

  // 6. Humor selecionado no Oráculo
  if (normMood.includes('imersao') || normMood.includes('epica')) {
    if (pages >= 350 || /fantasia|epico|ficcao cientifica|alta fantasia|romance/.test(fullText)) {
      score += 18;
      reasons.push('escala e imersão para maratona');
    }
  } else if (normMood.includes('leve') || normMood.includes('curt')) {
    if ((pages > 0 && pages <= 260) || /contos|humor|slice of life|cronica|novela/.test(fullText)) {
      score += 18;
      reasons.push('ritmo fluido e leitura leve');
    }
  } else if (normMood.includes('suspense') || normMood.includes('sombrio')) {
    if (/suspense|terror|horror|misterio|policial|thriller|sombrio|gotico|crime/.test(fullText)) {
      score += 20;
      reasons.push('clima sombrio ou de suspense');
    }
  } else if (normMood.includes('reflex') || normMood.includes('profund')) {
    if (/filosofia|classico|ensaio|literatura|psicologia|sociologia|drama/.test(fullText)) {
      score += 18;
      reasons.push('profundidade reflexiva');
    }
  } else if (normMood.includes('academ') || normMood.includes('tecnic') || normMood.includes('tcc')) {
    if (item.workType === 'academic' || /ciencia|tecnologia|engenharia|direito|pesquisa|artigo/.test(fullText)) {
      score += 22;
      reasons.push('aderência a pesquisa e estudo técnico');
    }
  } else if (normMood.length >= 3) {
    const moodWords = normMood.split(/\s+/).filter((w) => w.length >= 3);
    const hits = moodWords.filter((w) => fullText.includes(w));
    if (hits.length > 0) {
      score += hits.length * 14;
      reasons.push(`combina com "${mood}"`);
    }
  }

  // 7. Prioridade (hype) e disponibilidade real
  if (item.hype === 'very-high') score += 8;
  else if (item.hype === 'high') score += 4;
  if (!item.isWishlist && item.access !== 'Wishlist') score += 3;

  return {
    item,
    score,
    reasons: Array.from(new Set(reasons)).slice(0, 3),
  };
}

export function generateOfflineRecommendations({
  items = [],
  profile = null,
  mood = '',
  limit = 3,
} = {}) {
  const queuedItems = (Array.isArray(items) ? items : []).filter(
    (item) => item && item.inBacklog !== false && item.status === 'queued'
  );

  if (queuedItems.length === 0) {
    return {
      ok: false,
      mode: 'offline',
      primaryId: null,
      headline: 'Nenhuma obra na estante para recomendar',
      reason: 'Adicione obras em "Na Estante" para receber sugestões personalizadas.',
      alternatives: [],
      scoredCandidates: [],
    };
  }

  const tasteProfile = buildReaderTasteProfile(items, profile);
  const ranked = queuedItems
    .map((candidate) => scoreCandidateForMood(candidate, tasteProfile, mood))
    .sort((a, b) => b.score - a.score || String(a.item.title).localeCompare(String(b.item.title), 'pt-BR'));

  const top = ranked[0];
  const refBook = tasteProfile.recentLovedWorks[0]?.title;
  const reasonParts =
    top.reasons.length > 0
      ? `Selecionado por ${top.reasons.join(', ')}`
      : 'Melhor equilíbrio de prioridade e disponibilidade na sua estante atual';
  const refClause =
    refBook && top.reasons.length > 0
      ? ` — em sintonia com avaliações como "${refBook}".`
      : '.';

  const alternatives = ranked.slice(1, Math.max(1, limit)).map((entry) => ({
    id: entry.item.id,
    why:
      entry.reasons[0] ||
      (entry.item.author
        ? `Por ${entry.item.author}`
        : 'Boa alternativa na sua estante'),
  }));

  return {
    ok: true,
    mode: 'offline',
    primaryId: top.item.id,
    headline: mood ? `Sugestão para ${mood}` : 'Próxima leitura recomendada',
    reason: `${reasonParts}${refClause}`,
    alternatives,
    scoredCandidates: ranked.slice(0, limit),
  };
}

function buildDetailedReasonLabel(item, tasteProfile, peerInfo = null) {
  if (peerInfo?.handle) {
    const ratingSuffix =
      typeof peerInfo.rating === 'number' ? ` (${peerInfo.rating}/100)` : '';
    return `Indicado por ${peerInfo.handle}${ratingSuffix}`;
  }

  const lovedWorks = Array.isArray(tasteProfile?.recentLovedWorks)
    ? tasteProfile.recentLovedWorks
    : [];

  const itemGenres = Array.isArray(item?.genres) ? item.genres : [];
  for (const loved of lovedWorks) {
    const lovedGenres = new Set(
      (Array.isArray(loved?.genres) ? loved.genres : []).map(normalizeToken)
    );
    const matchingGenre = itemGenres.find((g) => lovedGenres.has(normalizeToken(g)));
    if (matchingGenre && typeof loved?.rating === 'number') {
      return `Porque você avaliou ${matchingGenre} com ${loved.rating}`;
    }
    const lovedAuthor = normalizeToken(loved?.author || loved?.creator);
    const candAuthor = normalizeToken(item?.author || item?.creator);
    if (lovedAuthor && candAuthor && lovedAuthor === candAuthor) {
      return typeof loved?.rating === 'number'
        ? `Porque você avaliou "${loved.title}" com ${loved.rating}`
        : `Autor recorrente no seu acervo (${item.author || item.creator})`;
    }
    const lovedCdd = extractCddMajorClass(loved?.cdu_cdd);
    const candCdd = extractCddMajorClass(item?.cdu_cdd);
    if (lovedCdd && candCdd && lovedCdd === candCdd) {
      return `Assunto CDD ${item.cdu_cdd} alinhado a "${loved.title}"`;
    }
  }

  const scored = scoreCandidateForMood(item, tasteProfile, '');
  if (scored.reasons.length > 0) {
    const firstReason = scored.reasons[0];
    return `Alinhado ao seu perfil: ${firstReason}`;
  }

  if (item?.genres?.length > 0) {
    return `Descoberta editorial em ${item.genres[0]}`;
  }
  return 'Sugestão curada para sua próxima leitura';
}

export function buildHomeBookRecommendations({
  items = [],
  profile = null,
  peerRecommendations = [],
  limit = 4,
  excludeIds = [],
} = {}) {
  const safeItems = Array.isArray(items) ? items : [];
  const tasteProfile = buildReaderTasteProfile(safeItems, profile);
  const backlogTitles = new Set(
    safeItems
      .filter((i) => i && i.inBacklog !== false)
      .flatMap((i) => [normalizeToken(i.title), normalizeToken(i.originalTitle)])
      .filter(Boolean)
  );
  const completedTitles = new Set(
    safeItems
      .filter((i) => i?.status === 'completed' || i?.status === 'playing')
      .flatMap((i) => [normalizeToken(i.title), normalizeToken(i.originalTitle)])
      .filter(Boolean)
  );

  const candidateMap = new Map();

  // 1) Obras bem avaliadas / lidas por colegas seguidos
  (Array.isArray(peerRecommendations) ? peerRecommendations : []).forEach((entry) => {
    const work = entry?.work || entry;
    if (!work?.title) return;
    const normTitle = normalizeToken(work.title);
    if (!normTitle || completedTitles.has(normTitle)) return;

    const scored = scoreCandidateForMood(work, tasteProfile, '');
    const peerBoost =
      (Number(entry?.rating ?? work.rating) >= 80 ? 22 : 12) +
      (entry?.isFollowing ? 14 : 6);
    const peerInfo = {
      handle: entry?.peerHandle || entry?.handle || '@leitor',
      rating: entry?.rating ?? work.rating ?? null,
    };

    const key = normTitle;
    const existing = candidateMap.get(key);
    const score = scored.score + peerBoost;
    if (!existing || score > existing.score) {
      candidateMap.set(key, {
        id: work.id || `peer-${normTitle}`,
        item: work,
        score,
        reason: buildDetailedReasonLabel(work, tasteProfile, peerInfo),
        peerHandle: peerInfo.handle,
        alreadyInBacklog: backlogTitles.has(normTitle),
        sourceKind: 'peer',
      });
    }
  });

  // 2) Obras na estante (queued)
  safeItems
    .filter((i) => i && i.inBacklog !== false && i.status === 'queued')
    .forEach((work) => {
      const normTitle = normalizeToken(work.title);
      if (!normTitle || candidateMap.has(normTitle)) return;
      const scored = scoreCandidateForMood(work, tasteProfile, '');
      candidateMap.set(normTitle, {
        id: work.id,
        item: work,
        score: scored.score + 10,
        reason: buildDetailedReasonLabel(work, tasteProfile, null),
        peerHandle: null,
        alreadyInBacklog: true,
        sourceKind: 'shelf',
      });
    });

  // 3) Descobertas curadas fora do acervo (catalogItems)
  catalogItems.forEach((work) => {
    const normTitle = normalizeToken(work.title);
    if (!normTitle || completedTitles.has(normTitle) || candidateMap.has(normTitle)) {
      return;
    }
    const scored = scoreCandidateForMood(work, tasteProfile, '');
    candidateMap.set(normTitle, {
      id: work.id,
      item: work,
      score: scored.score,
      reason: buildDetailedReasonLabel(work, tasteProfile, null),
      peerHandle: null,
      alreadyInBacklog: backlogTitles.has(normTitle),
      sourceKind: 'discovery',
    });
  });

  const sortedPool = Array.from(candidateMap.values()).sort(
    (a, b) =>
      b.score - a.score ||
      String(a.item?.title || '').localeCompare(String(b.item?.title || ''), 'pt-BR')
  );

  const excludeSet = new Set(Array.isArray(excludeIds) ? excludeIds : []);
  const fresh = sortedPool.filter((entry) => !excludeSet.has(entry.id));
  const finalPool = fresh.length > 0 ? fresh : sortedPool;

  return {
    recommendations: finalPool.slice(0, Math.max(1, limit)),
    totalCandidates: sortedPool.length,
  };
}
