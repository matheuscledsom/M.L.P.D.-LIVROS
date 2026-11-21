import { normalizePublisherName } from '../data/brazilianPublishers.js';
import { catalogItems } from '../data/mockData.js';
import { normalizePreferredCriteria } from '../utils/readerPreferences.js';

const FICTITIOUS_PEER_HANDLES = new Set([
  '@clarice_leitora',
  '@akira_mangas',
  '@helena_pesquisa',
  '@leitor',
]);

const CURATED_DISCOVERY_EXTRA = [
  {
    id: 'book-crime-e-castigo',
    title: 'Crime e Castigo',
    originalTitle: 'Prestupleniye i nakazaniye',
    author: 'Fiódor Dostoiévski',
    releaseYear: 1866,
    totalPages: 592,
    publisher: 'Editora 34',
    format: 'Brochura',
    workType: 'book',
    genres: ['Clássicos', 'Filosofia', 'Suspense e Thriller'],
    atmosphere: ['Sombrio', 'Reflexivo'],
    monogram: 'CC',
  },
  {
    id: 'book-meditacoes',
    title: 'Meditações',
    originalTitle: 'Ta eis heauton',
    author: 'Marco Aurélio',
    releaseYear: 180,
    totalPages: 160,
    publisher: 'Edipro',
    format: 'Brochura',
    workType: 'book',
    genres: ['Filosofia', 'Clássicos', 'Não-Ficção'],
    atmosphere: ['Reflexivo'],
    monogram: 'MD',
  },
  {
    id: 'book-o-hobbit',
    title: 'O Hobbit',
    originalTitle: 'The Hobbit',
    author: 'J.R.R. Tolkien',
    releaseYear: 1937,
    totalPages: 336,
    publisher: 'HarperCollins Brasil',
    format: 'Capa Dura',
    workType: 'book',
    genres: ['Fantasia Épica', 'Fantasia'],
    atmosphere: ['Épico', 'Leve'],
    monogram: 'HB',
  },
  {
    id: 'book-sociedade-do-anel',
    title: 'A Sociedade do Anel',
    originalTitle: 'The Fellowship of the Ring',
    author: 'J.R.R. Tolkien',
    releaseYear: 1954,
    totalPages: 576,
    publisher: 'HarperCollins Brasil',
    format: 'Capa Dura',
    workType: 'book',
    genres: ['Fantasia Épica', 'Fantasia'],
    atmosphere: ['Épico'],
    monogram: 'SA',
  },
  {
    id: 'book-frankenstein',
    title: 'Frankenstein',
    originalTitle: 'Frankenstein; or, The Modern Prometheus',
    author: 'Mary Shelley',
    releaseYear: 1818,
    totalPages: 280,
    publisher: 'DarkSide Books',
    format: 'Capa Dura',
    workType: 'book',
    genres: ['Terror e Gótico', 'Clássicos', 'Ficção Científica'],
    atmosphere: ['Sombrio', 'Reflexivo'],
    monogram: 'FK',
  },
  {
    id: 'book-o-iluminado',
    title: 'O Iluminado',
    originalTitle: 'The Shining',
    author: 'Stephen King',
    releaseYear: 1977,
    totalPages: 520,
    publisher: 'Suma',
    format: 'Brochura',
    workType: 'book',
    genres: ['Terror e Gótico', 'Suspense e Thriller'],
    atmosphere: ['Sombrio'],
    monogram: 'IL',
  },
  {
    id: 'book-silencio-inocentes',
    title: 'O Silêncio dos Inocentes',
    originalTitle: 'The Silence of the Lambs',
    author: 'Thomas Harris',
    releaseYear: 1988,
    totalPages: 368,
    publisher: 'BestSeller',
    format: 'Brochura',
    workType: 'book',
    genres: ['Suspense e Thriller'],
    atmosphere: ['Sombrio'],
    monogram: 'SI',
  },
  {
    id: 'book-rapido-e-devagar',
    title: 'Rápido e Devagar: Duas Formas de Pensar',
    originalTitle: 'Thinking, Fast and Slow',
    author: 'Daniel Kahneman',
    releaseYear: 2011,
    totalPages: 608,
    publisher: 'Objetiva',
    format: 'Brochura',
    workType: 'book',
    genres: ['Psicologia', 'Não-Ficção'],
    atmosphere: ['Reflexivo', 'Técnico'],
    monogram: 'RD',
  },
  {
    id: 'book-sapiens',
    title: 'Sapiens: Uma Breve História da Humanidade',
    originalTitle: 'Sapiens: A Brief History of Humankind',
    author: 'Yuval Noah Harari',
    releaseYear: 2011,
    totalPages: 464,
    publisher: 'Companhia das Letras',
    format: 'Brochura',
    workType: 'book',
    genres: ['História', 'Não-Ficção'],
    atmosphere: ['Reflexivo'],
    monogram: 'SP',
  },
  {
    id: 'book-alguma-poesia',
    title: 'Alguma Poesia',
    author: 'Carlos Drummond de Andrade',
    releaseYear: 1930,
    totalPages: 144,
    publisher: 'Companhia das Letras',
    format: 'Brochura',
    workType: 'book',
    genres: ['Poesia', 'Clássicos', 'Literatura Brasileira'],
    atmosphere: ['Reflexivo'],
    monogram: 'AP',
  },
  {
    id: 'book-orgulho-e-preconceito',
    title: 'Orgulho e Preconceito',
    originalTitle: 'Pride and Prejudice',
    author: 'Jane Austen',
    releaseYear: 1813,
    totalPages: 424,
    publisher: 'Penguin-Companhia',
    format: 'Brochura',
    workType: 'book',
    genres: ['Romance', 'Clássicos'],
    atmosphere: ['Leve', 'Emocionante'],
    monogram: 'OP',
  },
  {
    id: 'book-diario-anne-frank',
    title: 'O Diário de Anne Frank',
    originalTitle: 'Het Achterhuis',
    author: 'Anne Frank',
    releaseYear: 1947,
    totalPages: 352,
    publisher: 'Record',
    format: 'Brochura',
    workType: 'book',
    genres: ['Biografias', 'História', 'Clássicos'],
    atmosphere: ['Emocionante', 'Reflexivo'],
    monogram: 'AF',
  },
  {
    id: 'academic-programador-pragmatico',
    title: 'O Programador Pragmático',
    originalTitle: 'The Pragmatic Programmer',
    author: 'Andrew Hunt, David Thomas',
    releaseYear: 1999,
    totalPages: 352,
    publisher: 'Bookman',
    format: 'Brochura',
    workType: 'academic',
    genres: ['Tecnologia e Computação', 'Engenharia de Software'],
    atmosphere: ['Técnico'],
    monogram: 'PP',
  },
];

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

const MANGA_TEXT_RE =
  /\b(manga|manhwa|manhua|webtoon|light novel|hq|graphic novel|quadrinhos|shonen|shounen|seinen|shojo|shoujo|josei)\b/;

const CANONICAL_GENRE_GROUPS = [
  {
    tag: 'fantasia',
    patterns: ['fantasia', 'fantasy', 'alta fantasia', 'fantasia epica', 'fantasia sombria', 'fantasia urbana'],
  },
  {
    tag: 'ficcao cientifica',
    patterns: ['ficcao cientifica', 'science fiction', 'sci-fi', 'distopia', 'cyberpunk', 'space opera'],
  },
  {
    tag: 'suspense',
    patterns: ['suspense', 'thriller', 'misterio', 'policial', 'crime', 'noir'],
  },
  {
    tag: 'terror',
    patterns: ['terror', 'horror', 'gotico', 'literatura gotica', 'horror cosmico'],
  },
  {
    tag: 'romance',
    patterns: ['romance', 'romance contemporaneo', 'romance historico', 'drama romantico'],
  },
  {
    tag: 'classicos',
    patterns: ['classico', 'classicos', 'literatura classica', 'classicos universais', 'literatura brasileira'],
  },
  {
    tag: 'filosofia',
    patterns: ['filosofia', 'etica', 'estoicismo', 'metafisica'],
  },
  {
    tag: 'historia',
    patterns: ['historia', 'ficcao historica', 'historia geral', 'historia do brasil'],
  },
  {
    tag: 'psicologia',
    patterns: ['psicologia', 'psicanalise', 'psicologia cognitiva'],
  },
  {
    tag: 'tecnologia',
    patterns: [
      'tecnologia',
      'computacao',
      'tecnologia e computacao',
      'computacao & tecnologia',
      'engenharia de software',
      'ciencia da computacao',
      'programacao',
      'algoritmos',
      'inteligencia artificial',
      'ciencia de dados',
      'desenvolvimento web',
    ],
  },
  {
    tag: 'academico',
    patterns: [
      'academico',
      'academico e tcc',
      'academico & pesquisa',
      'metodologia',
      'metodologia cientifica',
      'pesquisa',
      'tcc',
      'estudos academicos',
    ],
  },
  {
    tag: 'biografias',
    patterns: ['biografia', 'biografias', 'biografias & memorias', 'memorias', 'autobiografia'],
  },
  {
    tag: 'poesia',
    patterns: ['poesia', 'poemas', 'poesia lirica'],
  },
  {
    tag: 'nao ficcao',
    patterns: ['nao-ficcao', 'nao ficcao', 'ensaios'],
  },
  {
    tag: 'manga',
    patterns: ['manga', 'shonen', 'seinen', 'shojo', 'josei', 'mangas & hqs'],
  },
  {
    tag: 'manhwa',
    patterns: ['manhwa', 'webtoon', 'manhua'],
  },
  {
    tag: 'light novel',
    patterns: ['light novel'],
  },
  {
    tag: 'hq',
    patterns: ['hq', 'graphic novel', 'quadrinhos', 'mangas & hqs'],
  },
];

export function expandGenreTags(rawGenre) {
  const norm = normalizeToken(rawGenre);
  if (!norm) return [];
  const tags = new Set([norm]);
  for (const group of CANONICAL_GENRE_GROUPS) {
    if (group.patterns.some((pat) => norm === pat || norm.includes(pat))) {
      tags.add(group.tag);
    }
  }
  return Array.from(tags);
}

export function isMangaOrHqWork(work) {
  if (!work || typeof work !== 'object') return false;
  if (work.workType === 'manga') return true;
  const origin = normalizeToken(work.demographicOrigin || work.mangaType || '');
  if (origin && MANGA_TEXT_RE.test(origin)) return true;
  const genreFields = [
    work.primaryGenre,
    ...(Array.isArray(work.subgenres) ? work.subgenres : []),
    ...(Array.isArray(work.genres) ? work.genres : []),
  ]
    .map(normalizeToken)
    .filter(Boolean);
  return genreFields.some((g) => MANGA_TEXT_RE.test(g));
}

export function userAllowsMangaOrHq(items = [], profile = null) {
  const focus = normalizeToken(profile?.readerFocus || '');
  if (focus && MANGA_TEXT_RE.test(focus)) return true;

  const favGenres = Array.isArray(profile?.favoriteGenres) ? profile.favoriteGenres : [];
  if (favGenres.some((g) => MANGA_TEXT_RE.test(normalizeToken(g)))) {
    return true;
  }

  const backlog = Array.isArray(items) ? items : [];
  return backlog.some((item) => item && item.inBacklog !== false && isMangaOrHqWork(item));
}

function getWorkCanonicalGenreTags(work) {
  const rawList = [
    work?.primaryGenre,
    ...(Array.isArray(work?.subgenres) ? work.subgenres : []),
    ...(Array.isArray(work?.genres) ? work.genres : []),
  ].filter(Boolean);

  const tags = new Set();
  for (const g of rawList) {
    for (const tag of expandGenreTags(g)) {
      tags.add(tag);
    }
  }
  if (work?.workType === 'academic') {
    tags.add('academico');
  }
  if (work?.workType === 'manga') {
    tags.add('manga');
  }
  return tags;
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

  const onboardingGenreLabels = Array.isArray(profile?.favoriteGenres)
    ? profile.favoriteGenres.map((g) => String(g || '').trim()).filter(Boolean)
    : [];

  const onboardingGenres = new Set(
    onboardingGenreLabels.map(normalizeToken).filter(Boolean)
  );
  const onboardingCanonicalTags = new Set();
  const onboardingTagToLabel = new Map();
  for (const label of onboardingGenreLabels) {
    for (const tag of expandGenreTags(label)) {
      onboardingCanonicalTags.add(tag);
      if (!onboardingTagToLabel.has(tag)) {
        onboardingTagToLabel.set(tag, label);
      }
    }
  }

  const libraryCanonicalTags = new Set();
  const libraryTagToLabel = new Map();
  for (const item of backlog) {
    const itemGenres = [
      item.primaryGenre,
      ...(Array.isArray(item.subgenres) ? item.subgenres : []),
      ...(Array.isArray(item.genres) ? item.genres : []),
    ]
      .map((g) => String(g || '').trim())
      .filter(Boolean);
    for (const label of itemGenres) {
      for (const tag of expandGenreTags(label)) {
        libraryCanonicalTags.add(tag);
        if (!libraryTagToLabel.has(tag)) {
          libraryTagToLabel.set(tag, label);
        }
      }
    }
  }

  const readerFocus = normalizeToken(profile?.readerFocus || '');
  const preferredCriteria = normalizePreferredCriteria(
    profile?.preferredCriteria ?? profile?.preferred_criteria,
    profile?.preferredCriterion ?? profile?.preferred_criterion
  );

  const preferredAuthors = new Map();
  const preferredPublishers = new Map();
  const preferredCdd = new Map();
  const preferredGenres = new Map();

  for (const genre of onboardingGenres) {
    preferredGenres.set(genre, (preferredGenres.get(genre) || 0) + 2);
  }
  for (const tag of onboardingCanonicalTags) {
    preferredGenres.set(tag, (preferredGenres.get(tag) || 0) + 2);
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
      for (const tag of expandGenreTags(g)) {
        preferredGenres.set(tag, (preferredGenres.get(tag) || 0) + ratingWeight);
      }
    }
  }

  const allowedCanonicalTags = new Set([
    ...onboardingCanonicalTags,
    ...libraryCanonicalTags,
  ]);
  if (readerFocus.includes('academ') || readerFocus.includes('pesquis')) {
    allowedCanonicalTags.add('academico');
  }

  return {
    onboardingGenres,
    onboardingCanonicalTags,
    onboardingTagToLabel,
    libraryCanonicalTags,
    libraryTagToLabel,
    allowedCanonicalTags,
    allowsManga: userAllowsMangaOrHq(backlog, profile),
    readerFocus,
    preferredCriteria,
    preferredAuthors,
    preferredPublishers,
    preferredCdd,
    preferredGenres,
    recentLovedWorks: highRated.slice(0, 3),
  };
}

function isCandidateCompatibleWithPreferences(work, tasteProfile, sourceKind = 'discovery') {
  if (!work) return false;

  if (!tasteProfile.allowsManga && isMangaOrHqWork(work)) {
    return false;
  }

  const allowedTags = tasteProfile.allowedCanonicalTags;
  if (!allowedTags || allowedTags.size === 0) {
    return true;
  }

  const workTags = getWorkCanonicalGenreTags(work);
  if (workTags.size === 0) {
    return sourceKind === 'shelf';
  }

  for (const tag of workTags) {
    if (allowedTags.has(tag)) return true;
  }
  return false;
}

export function scoreCandidateForMood(item, tasteProfile, mood = '') {
  if (!item) return { item, score: 0, reasons: [] };
  let score = 0;
  const reasons = [];

  const normMood = normalizeToken(mood);
  const titleText = normalizeToken(`${item.title || ''} ${item.originalTitle || ''}`);
  const genres = Array.isArray(item.genres) ? item.genres : [];
  const normGenres = genres.map(normalizeToken).filter(Boolean);
  const workTags = getWorkCanonicalGenreTags(item);
  const tropesText = normalizeToken(
    [...(item.tropes || []), ...(item.atmosphere || []), item.synopsis || ''].join(' ')
  );
  const fullText = `${titleText} ${normGenres.join(' ')} ${tropesText}`;
  const pages = Number(item.totalPages) || 0;

  // 1. Afinidade com foco/gêneros do onboarding
  let matchedOnboardingLabel = '';
  for (const tag of workTags) {
    if (tasteProfile.onboardingCanonicalTags?.has(tag)) {
      matchedOnboardingLabel = tasteProfile.onboardingTagToLabel?.get(tag) || '';
      break;
    }
  }
  if (!matchedOnboardingLabel) {
    for (const genre of genres) {
      const ng = normalizeToken(genre);
      if (tasteProfile.onboardingGenres.has(ng)) {
        matchedOnboardingLabel = genre;
        break;
      }
    }
  }
  if (matchedOnboardingLabel) {
    score += 14;
    reasons.push(`seu interesse em ${matchedOnboardingLabel}`);
  }

  if (
    (tasteProfile.readerFocus.includes('academ') || tasteProfile.readerFocus.includes('pesquis')) &&
    item.workType === 'academic'
  ) {
    score += 12;
    reasons.push('foco acadêmico do seu perfil');
  } else if (
    tasteProfile.allowsManga &&
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
  for (const tag of workTags) {
    if (tasteProfile.preferredGenres.has(tag) && !tasteProfile.onboardingCanonicalTags?.has(tag)) {
      genreMatches += 1;
    }
  }
  if (genreMatches > 0) {
    score += Math.min(20, genreMatches * 10);
    if (reasons.length === 0) {
      reasons.push('afinidade temática com suas leituras recentes >= 80');
    }
  }

  // 6. Critérios valorizados pelo leitor (seleção múltipla)
  const criteriaList = Array.isArray(tasteProfile.preferredCriteria)
    ? tasteProfile.preferredCriteria
    : [];
  for (const crit of criteriaList) {
    const nc = normalizeToken(crit);
    if (nc.includes('enredo') && /fantasia|ficcao|suspense|thriller|aventura/.test(fullText)) {
      score += 4;
    } else if (nc.includes('personagens') && /romance|classico|drama|psicologia|biografia/.test(fullText)) {
      score += 4;
    } else if (nc.includes('escrita') && /classico|poesia|literatura|gotico|imersao/.test(fullText)) {
      score += 4;
    } else if (nc.includes('impacto') && /filosofia|historia|academ|nao ficcao|tecnologia|pesquisa/.test(fullText)) {
      score += 4;
    }
  }

  // 7. Humor selecionado no Oráculo
  if (normMood.includes('imersao') || normMood.includes('epica')) {
    if (pages >= 350 || /fantasia|epico|ficcao cientifica|alta fantasia|romance/.test(fullText)) {
      score += 18;
      reasons.push('escala e imersão para maratona');
    }
  } else if (normMood.includes('leve') || normMood.includes('curt')) {
    if ((pages > 0 && pages <= 260) || /contos|humor|slice of life|cronica|novela|leve/.test(fullText)) {
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

  // 8. Prioridade (hype) e disponibilidade real
  if (item.hype === 'very-high' || item.hype === 'urgent') score += 8;
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
  const peerHandleLower = String(peerInfo?.handle || '').toLowerCase();
  if (
    peerInfo?.handle &&
    !peerInfo?.isDirectorySeed &&
    !FICTITIOUS_PEER_HANDLES.has(peerHandleLower)
  ) {
    const ratingSuffix =
      typeof peerInfo.rating === 'number' ? ` (${peerInfo.rating}/100)` : '';
    return `Indicado por ${peerInfo.handle}${ratingSuffix}`;
  }

  const itemTags = getWorkCanonicalGenreTags(item);

  // 1. Afinidade explícita com gênero favorito do Onboarding
  for (const tag of itemTags) {
    if (tasteProfile?.onboardingCanonicalTags?.has(tag)) {
      const label = tasteProfile.onboardingTagToLabel?.get(tag);
      if (label) {
        return `Alinhado ao seu interesse em ${label}`;
      }
    }
  }

  // 2. Avaliações reais no acervo do leitor
  const lovedWorks = Array.isArray(tasteProfile?.recentLovedWorks)
    ? tasteProfile.recentLovedWorks
    : [];

  for (const loved of lovedWorks) {
    const lovedTags = getWorkCanonicalGenreTags(loved);
    const matchingTag = Array.from(itemTags).find((t) => lovedTags.has(t));
    const itemGenres = Array.isArray(item?.genres) ? item.genres : [];
    const matchingLabel =
      itemGenres.find((g) => expandGenreTags(g).includes(matchingTag)) ||
      (Array.isArray(loved?.genres) ? loved.genres[0] : '');

    if (matchingTag && typeof loved?.rating === 'number') {
      return matchingLabel
        ? `Baseado nas suas avaliações em ${matchingLabel}`
        : `Baseado na sua avaliação de "${loved.title}" (${loved.rating})`;
    }
    const lovedAuthor = normalizeToken(loved?.author || loved?.creator);
    const candAuthor = normalizeToken(item?.author || item?.creator);
    if (lovedAuthor && candAuthor && lovedAuthor === candAuthor) {
      return typeof loved?.rating === 'number'
        ? `Baseado na sua avaliação de "${loved.title}" (${loved.rating})`
        : `Autor recorrente no seu acervo (${item.author || item.creator})`;
    }
    const lovedCdd = extractCddMajorClass(loved?.cdu_cdd);
    const candCdd = extractCddMajorClass(item?.cdu_cdd);
    if (lovedCdd && candCdd && lovedCdd === candCdd) {
      return `Assunto CDD ${item.cdu_cdd} alinhado a "${loved.title}"`;
    }
  }

  // 3. Afinidade com gênero presente no acervo
  for (const tag of itemTags) {
    if (tasteProfile?.libraryCanonicalTags?.has(tag)) {
      const label = tasteProfile.libraryTagToLabel?.get(tag);
      if (label) {
        return `Alinhado ao seu acervo em ${label}`;
      }
    }
  }

  if (
    tasteProfile?.readerFocus &&
    (tasteProfile.readerFocus.includes('academ') || tasteProfile.readerFocus.includes('pesquis')) &&
    item?.workType === 'academic'
  ) {
    return 'Alinhado ao seu interesse em Pesquisa Acadêmica';
  }

  if (lovedWorks.length > 0) {
    return 'Baseado nas suas avaliações';
  }

  if (item?.genres?.length > 0) {
    return `Descoberta editorial em ${item.genres[0]}`;
  }
  return 'Compatível com suas preferências de leitura';
}

function getCombinedDiscoveryPool() {
  const byTitle = new Map();
  [...catalogItems, ...CURATED_DISCOVERY_EXTRA].forEach((work) => {
    const key = normalizeToken(work?.title);
    if (key && !byTitle.has(key)) {
      byTitle.set(key, work);
    }
  });
  return Array.from(byTitle.values());
}

export function buildHomeBookRecommendations({
  items = [],
  profile = null,
  peerRecommendations = [],
  limit = 4,
  excludeIds = [],
  dismissedIds = [],
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

  // 1) Obras bem avaliadas / lidas por colegas seguidos reais (sem perfis fictícios seeded)
  (Array.isArray(peerRecommendations) ? peerRecommendations : []).forEach((entry) => {
    const work = entry?.work || entry;
    if (!work?.title) return;
    if (entry?.isDirectorySeed) return;
    const rawHandle = String(entry?.peerHandle || entry?.handle || '').trim();
    if (rawHandle && FICTITIOUS_PEER_HANDLES.has(rawHandle.toLowerCase())) {
      return;
    }
    if (!isCandidateCompatibleWithPreferences(work, tasteProfile, 'peer')) {
      return;
    }

    const normTitle = normalizeToken(work.title);
    if (!normTitle || completedTitles.has(normTitle)) return;

    const scored = scoreCandidateForMood(work, tasteProfile, '');
    const peerBoost =
      (Number(entry?.rating ?? work.rating) >= 80 ? 22 : 12) +
      (entry?.isFollowing ? 14 : 6);
    const peerInfo =
      rawHandle && entry?.isFollowing !== false
        ? {
            handle: rawHandle,
            rating: entry?.rating ?? work.rating ?? null,
            isDirectorySeed: Boolean(entry?.isDirectorySeed),
          }
        : null;

    const key = normTitle;
    const existing = candidateMap.get(key);
    const score = scored.score + peerBoost;
    if (!existing || score > existing.score) {
      candidateMap.set(key, {
        id: work.id || `peer-${normTitle}`,
        item: work,
        score,
        reason: buildDetailedReasonLabel(work, tasteProfile, peerInfo),
        peerHandle: peerInfo?.handle || null,
        alreadyInBacklog: backlogTitles.has(normTitle),
        sourceKind: 'peer',
      });
    }
  });

  // 2) Obras na estante (queued) compatíveis com as preferências
  safeItems
    .filter((i) => i && i.inBacklog !== false && i.status === 'queued')
    .forEach((work) => {
      if (!isCandidateCompatibleWithPreferences(work, tasteProfile, 'shelf')) {
        return;
      }
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

  // 3) Descobertas curadas fora do acervo respeitando estritamente preferências e tipo
  getCombinedDiscoveryPool().forEach((work) => {
    if (!isCandidateCompatibleWithPreferences(work, tasteProfile, 'discovery')) {
      return;
    }
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

  const dismissedSet = new Set(Array.isArray(dismissedIds) ? dismissedIds : []);
  const sortedPool = Array.from(candidateMap.values())
    .filter((entry) => !dismissedSet.has(entry.id))
    .sort(
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
