import { normalizePublisherName } from '../data/brazilianPublishers.js';

function normAscii(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const LANGUAGE_MAP = {
  pt: 'Português',
  'pt-br': 'Português',
  'pt_br': 'Português',
  'pt-pt': 'Português',
  por: 'Português',
  portuguese: 'Português',
  portugues: 'Português',
  en: 'Inglês',
  'en-us': 'Inglês',
  'en-gb': 'Inglês',
  eng: 'Inglês',
  english: 'Inglês',
  ingles: 'Inglês',
  ja: 'Japonês',
  jp: 'Japonês',
  jpn: 'Japonês',
  japanese: 'Japonês',
  japones: 'Japonês',
  es: 'Espanhol',
  spa: 'Espanhol',
  spanish: 'Espanhol',
  espanhol: 'Espanhol',
  fr: 'Francês',
  fre: 'Francês',
  fra: 'Francês',
  french: 'Francês',
  frances: 'Francês',
  de: 'Alemão',
  ger: 'Alemão',
  deu: 'Alemão',
  german: 'Alemão',
  alemao: 'Alemão',
  it: 'Italiano',
  ita: 'Italiano',
  italian: 'Italiano',
  italiano: 'Italiano',
  ru: 'Russo',
  rus: 'Russo',
  russian: 'Russo',
  russo: 'Russo',
  ko: 'Coreano',
  kor: 'Coreano',
  korean: 'Coreano',
  coreano: 'Coreano',
  zh: 'Chinês',
  chi: 'Chinês',
  zho: 'Chinês',
  chinese: 'Chinês',
  chines: 'Chinês',
  la: 'Latim',
  lat: 'Latim',
  latin: 'Latim',
  latim: 'Latim',
};

export function normalizeLanguageLabel(rawLanguage) {
  const clean = String(rawLanguage || '').trim();
  if (!clean) return '';
  if (clean.includes(',')) {
    return Array.from(
      new Set(
        clean
          .split(',')
          .map((part) => normalizeLanguageLabel(part))
          .filter(Boolean)
      )
    ).join(', ');
  }
  const key = normAscii(clean);
  if (LANGUAGE_MAP[key]) return LANGUAGE_MAP[key];
  return clean;
}

const CATEGORY_RULES = [
  {
    patterns: [
      'software engineering',
      'software development',
      'engenharia de software',
      'clean code',
      'computer science',
      'ciencia da computacao',
      'tecnologia da informacao',
      'computacao & tecnologia',
      'computacao e tecnologia',
      'programming',
      'programacao',
      'algorithms',
      'algoritmos',
      'artificial intelligence',
      'inteligencia artificial',
      'machine learning',
      'data science',
      'ciencia de dados',
      'cybersecurity',
      'seguranca da informacao',
      'web development',
      'computers',
      'computacao',
      'informatica',
      'tecnologia',
    ],
    primaryGenre: 'Computação & Tecnologia',
    subgenreResolver: (blob) => {
      if (/artificial intelligence|inteligencia artificial|machine learning|deep learning/.test(blob)) {
        return 'Inteligência Artificial';
      }
      if (/algorithm|algoritmo|data structure|estrutura de dados/.test(blob)) {
        return 'Algoritmos & Estruturas de Dados';
      }
      if (/data science|ciencia de dados|database|banco de dados|big data/.test(blob)) {
        return 'Ciência de Dados';
      }
      if (/cyber|security|seguranca/.test(blob)) {
        return 'Segurança da Informação';
      }
      if (/web|javascript|react|frontend|backend/.test(blob)) {
        return 'Desenvolvimento Web';
      }
      return 'Engenharia de Software';
    },
  },
  {
    patterns: [
      'manga',
      'manhwa',
      'manhua',
      'webtoon',
      'light novel',
      'graphic novel',
      'comics',
      'quadrinhos',
      'shonen',
      'shounen',
      'seinen',
      'shojo',
      'shoujo',
      'josei',
      'isekai',
    ],
    primaryGenre: 'Mangás & HQs',
    subgenreResolver: (blob) => {
      if (/light novel/.test(blob)) return 'Light Novel';
      if (/manhwa|webtoon/.test(blob)) return 'Manhwa / Webtoon';
      if (/seinen/.test(blob)) return 'Seinen';
      if (/shonen|shounen/.test(blob)) return 'Shonen';
      if (/shojo|shoujo|josei/.test(blob)) return 'Shojo / Josei';
      if (/graphic novel|comics|quadrinhos|\bhq\b/.test(blob)) return 'Graphic Novel & HQ';
      return 'Mangá';
    },
  },
  {
    patterns: [
      'fantasy',
      'fantasia',
      'epic fantasy',
      'high fantasy',
      'dark fantasy',
      'urban fantasy',
      'fantasia epica',
      'alta fantasia',
      'sword and sorcery',
    ],
    primaryGenre: 'Fantasia',
    subgenreResolver: (blob) => {
      if (/dark fantasy|fantasia sombria|grimdark/.test(blob)) return 'Fantasia Sombria';
      if (/urban fantasy|fantasia urbana/.test(blob)) return 'Fantasia Urbana';
      if (/historical fantasy|fantasia historica/.test(blob)) return 'Fantasia Histórica';
      return 'Fantasia Épica';
    },
  },
  {
    patterns: [
      'science fiction',
      'sci-fi',
      'ficcao cientifica',
      'dystopia',
      'distopia',
      'cyberpunk',
      'space opera',
      'steampunk',
    ],
    primaryGenre: 'Ficção Científica',
    subgenreResolver: (blob) => {
      if (/dystop|distop/.test(blob)) return 'Distopia';
      if (/cyberpunk/.test(blob)) return 'Cyberpunk';
      if (/space opera/.test(blob)) return 'Space Opera';
      return 'Ficção Científica Clássica';
    },
  },
  {
    patterns: [
      'horror',
      'gothic',
      'terror',
      'gotico',
      'ghost stories',
      'supernatural horror',
      'occult',
    ],
    primaryGenre: 'Terror & Gótico',
    subgenreResolver: (blob) => {
      if (/gothic|gotico/.test(blob)) return 'Literatura Gótica';
      if (/cosmic|lovecraft/.test(blob)) return 'Horror Cósmico';
      if (/psychological|psicologic/.test(blob)) return 'Terror Psicológico';
      return 'Terror & Suspense Sombrio';
    },
  },
  {
    patterns: [
      'thriller',
      'suspense',
      'mystery',
      'detective',
      'crime',
      'policial',
      'misterio',
      'noir',
    ],
    primaryGenre: 'Suspense & Thriller',
    subgenreResolver: (blob) => {
      if (/detective|policial|crime/.test(blob)) return 'Romance Policial';
      if (/psychological|psicologic/.test(blob)) return 'Thriller Psicológico';
      if (/noir/.test(blob)) return 'Noir & Investigação';
      return 'Mistério & Suspense';
    },
  },
  {
    patterns: [
      'philosophy',
      'filosofia',
      'ethics',
      'etica',
      'metaphysics',
      'epistemology',
      'stoicism',
      'estoicismo',
      'logic',
    ],
    primaryGenre: 'Filosofia',
    subgenreResolver: (blob) => {
      if (/ethic|etica|politic/.test(blob)) return 'Ética & Filosofia Política';
      if (/stoic|estoic/.test(blob)) return 'Estoicismo';
      if (/metaphys|epistemol|logic/.test(blob)) return 'Metafísica & Epistemologia';
      return 'Filosofia Clássica';
    },
  },
  {
    patterns: [
      'psychology',
      'psicologia',
      'psychoanalysis',
      'psicanalise',
      'cognitive',
      'behavioral',
      'mental health',
    ],
    primaryGenre: 'Psicologia',
    subgenreResolver: (blob) => {
      if (/psychoanal|psicanal/.test(blob)) return 'Psicanálise';
      if (/cognitive|cognitiv/.test(blob)) return 'Psicologia Cognitiva';
      return 'Psicologia & Comportamento';
    },
  },
  {
    patterns: [
      'brazilian literature',
      'literatura brasileira',
      'classics',
      'classic literature',
      'literatura classica',
      'classico',
      'classicos',
      'literary criticism',
    ],
    primaryGenre: 'Literatura Clássica',
    subgenreResolver: (blob) => {
      if (/brazil|brasileir/.test(blob)) return 'Literatura Brasileira';
      return 'Clássicos Universais';
    },
  },
  {
    patterns: [
      'romance',
      'love stories',
      'contemporary romance',
      'historical romance',
    ],
    primaryGenre: 'Romance',
    subgenreResolver: (blob) => {
      if (/historic|historico/.test(blob)) return 'Romance Histórico';
      if (/drama/.test(blob)) return 'Drama Romântico';
      return 'Romance Contemporâneo';
    },
  },
  {
    patterns: [
      'historical fiction',
      'ficcao historica',
      'history',
      'historia',
      'world history',
      'ancient history',
      'civilization',
    ],
    primaryGenre: 'História',
    subgenreResolver: (blob) => {
      if (/fiction|ficcao/.test(blob)) return 'Ficção Histórica';
      if (/brazil|brasil/.test(blob)) return 'História do Brasil';
      return 'História Geral';
    },
  },
  {
    patterns: [
      'biography',
      'biographies',
      'autobiography',
      'memoir',
      'memoirs',
      'biografia',
      'memorias',
    ],
    primaryGenre: 'Biografias & Memórias',
    subgenreResolver: (blob) => {
      if (/memoir|memorias|diary|diario/.test(blob)) return 'Memórias & Diários';
      return 'Biografias';
    },
  },
  {
    patterns: ['poetry', 'poesia', 'poems', 'poetics'],
    primaryGenre: 'Poesia',
    subgenreResolver: () => 'Poesia Lírica & Contemporânea',
  },
  {
    patterns: [
      'methodology',
      'metodologia',
      'research',
      'pesquisa',
      'academic',
      'academico',
      'education',
      'educacao',
      'law',
      'direito',
      'sociology',
      'sociologia',
      'social science',
      'ciencias sociais',
      'economics',
      'economia',
      'business',
      'negocios',
      'medicine',
      'medicina',
      'engineering',
      'engenharia',
      'mathematics',
      'matematica',
      'physics',
      'fisica',
      'biology',
      'biologia',
      'artigo',
    ],
    primaryGenre: 'Acadêmico & Pesquisa',
    subgenreResolver: (blob) => {
      if (/methodology|metodologia|research|pesquisa|tcc/.test(blob)) {
        return 'Metodologia Científica';
      }
      if (/law|direito|juris/.test(blob)) return 'Direito';
      if (/sociolog|social science|ciencias sociais/.test(blob)) return 'Ciências Sociais';
      if (/econom|business|negocio|financ/.test(blob)) return 'Economia & Negócios';
      if (/medicin|health|saude/.test(blob)) return 'Medicina & Saúde';
      if (/mathemat|physic|fisica|biolog|chem/.test(blob)) return 'Ciências Exatas & Naturais';
      return 'Estudos Acadêmicos';
    },
  },
  {
    patterns: ['nonfiction', 'non-fiction', 'nao-ficcao', 'nao ficcao', 'essays', 'ensaios'],
    primaryGenre: 'Não-Ficção',
    subgenreResolver: (blob) => {
      if (/essay|ensaio/.test(blob)) return 'Ensaios';
      return 'Não-Ficção Geral';
    },
  },
  {
    patterns: ['fiction', 'ficcao', 'literary fiction', 'general fiction', 'juvenile fiction', 'young adult'],
    primaryGenre: 'Ficção Literária',
    subgenreResolver: (blob) => {
      if (/young adult|juvenile/.test(blob)) return 'Ficção Jovem Adulto';
      return 'Ficção Contemporânea';
    },
  },
];

const IGNORED_GENERIC_TOKENS = new Set([
  'general',
  'livros',
  'books',
  'ebooks',
  'ebook',
  'other',
  'outros',
  'fiction',
  'nonfiction',
]);

function splitRawCategoryTokens(rawCategories) {
  const list = Array.isArray(rawCategories)
    ? rawCategories
    : rawCategories
      ? [rawCategories]
      : [];

  const expanded = [];
  for (const entry of list) {
    const label =
      typeof entry === 'string'
        ? entry
        : entry && typeof entry === 'object'
          ? entry.name || entry.label || ''
          : '';
    const clean = String(label || '').trim();
    if (!clean) continue;
    expanded.push(clean);
    clean
      .split(/[\/|]|--/)
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((part) => {
        if (part !== clean) expanded.push(part);
      });
  }
  return Array.from(new Set(expanded));
}

/**
 * Mapeia categorias/subjects/tags vindos das APIs externas para
 * Gênero Principal (primaryGenre), Subgênero(s) (subgenres) e lista combinada genres.
 */
export function mapCategoriesToGenreAndSubgenres(
  rawCategories = [],
  { workType = 'book', title = '', synopsis = '', demographicOrigin = '' } = {}
) {
  const tokens = splitRawCategoryTokens(rawCategories);
  const blob = normAscii(
    [...tokens, demographicOrigin, title, synopsis].filter(Boolean).join(' ')
  );
  const tokensBlob = normAscii(tokens.join(' | '));

  const matchedRules = [];
  for (const rule of CATEGORY_RULES) {
    const hitInTokens = rule.patterns.some((pat) => tokensBlob.includes(pat));
    const hitInBlob =
      !hitInTokens &&
      tokens.length === 0 &&
      rule.patterns.some((pat) => blob.includes(pat));

    if (hitInTokens || hitInBlob) {
      matchedRules.push(rule);
    }
  }

  // Remove regra genérica "Ficção Literária" se já houve match específico (ex: Fantasia, Sci-Fi, Clássico)
  const nonGenericMatches = matchedRules.filter(
    (r) => r.primaryGenre !== 'Ficção Literária' && r.primaryGenre !== 'Não-Ficção'
  );
  const prioritized = nonGenericMatches.length > 0 ? nonGenericMatches : matchedRules;

  let primaryGenre = '';
  const subgenres = [];

  if (prioritized.length > 0) {
    const topRule = prioritized[0];
    primaryGenre = topRule.primaryGenre;
    for (const rule of prioritized.slice(0, 3)) {
      const resolvedSub = rule.subgenreResolver(tokensBlob || blob);
      if (resolvedSub && resolvedSub !== primaryGenre) {
        subgenres.push(resolvedSub);
      }
      if (rule.primaryGenre !== primaryGenre && rule.primaryGenre !== 'Ficção Literária') {
        subgenres.push(rule.primaryGenre);
      }
    }
  } else if (tokens.length > 0) {
    const meaningful = tokens.filter(
      (t) => !IGNORED_GENERIC_TOKENS.has(normAscii(t))
    );
    const chosen = meaningful[0] || tokens[0];
    primaryGenre = chosen;
    meaningful.slice(1, 3).forEach((s) => {
      if (normAscii(s) !== normAscii(primaryGenre)) subgenres.push(s);
    });
  } else {
    if (workType === 'manga') {
      primaryGenre = 'Mangás & HQs';
      subgenres.push(demographicOrigin || 'Mangá');
    } else if (workType === 'academic') {
      primaryGenre = 'Acadêmico & Pesquisa';
      subgenres.push('Estudos Acadêmicos');
    } else {
      primaryGenre = '';
    }
  }

  const uniqueSubgenres = Array.from(
    new Set(
      subgenres
        .map((s) => String(s || '').trim())
        .filter((s) => s && normAscii(s) !== normAscii(primaryGenre))
    )
  ).slice(0, 3);

  const combinedGenres = Array.from(
    new Set([primaryGenre, ...uniqueSubgenres].filter(Boolean))
  );

  return {
    primaryGenre,
    subgenres: uniqueSubgenres,
    subgenre: uniqueSubgenres.join(', '),
    genres: combinedGenres,
  };
}

export function buildPrefilledCatalogDraft(
  item = {},
  {
    defaultWorkType = 'book',
    defaultFormat = 'Capa Dura',
    classification = null,
  } = {}
) {
  const resolvedWorkType = item.workType || defaultWorkType;
  const rawCats = Array.isArray(item.rawCategories) && item.rawCategories.length > 0
    ? item.rawCategories
    : Array.isArray(item.genres)
      ? item.genres
      : [];

  const mapped = mapCategoriesToGenreAndSubgenres(rawCats, {
    workType: resolvedWorkType,
    title: item.title,
    synopsis: item.synopsis,
    demographicOrigin: item.demographicOrigin,
  });

  const primaryGenre = String(item.primaryGenre || mapped.primaryGenre || '').trim();
  const subgenresList = Array.isArray(item.subgenres) && item.subgenres.length > 0
    ? item.subgenres
    : mapped.subgenres;
  const cleanSubgenres = Array.from(
    new Set(
      subgenresList
        .map((s) => String(s || '').trim())
        .filter((s) => s && normAscii(s) !== normAscii(primaryGenre))
    )
  );
  const genres = Array.from(
    new Set([primaryGenre, ...cleanSubgenres, ...(Array.isArray(item.genres) ? item.genres : [])].filter(Boolean))
  );

  const authorText =
    String(item.author || '').trim() ||
    (Array.isArray(item.authors) ? item.authors.filter(Boolean).join(', ') : '');
  const releaseYear =
    item.releaseYear ?? item.year ?? item.publicationYear ?? null;
  const totalPages =
    typeof item.totalPages === 'number' && item.totalPages > 0
      ? item.totalPages
      : Number(item.totalPages) > 0
        ? Number(item.totalPages)
        : null;

  return {
    ...item,
    workType: resolvedWorkType,
    format: item.format || defaultFormat,
    title: String(item.title || '').trim(),
    originalTitle: String(item.originalTitle || '').trim(),
    author: authorText,
    authors: authorText
      ? authorText.split(/[;,]/).map((s) => s.trim()).filter(Boolean)
      : [],
    primaryGenre,
    subgenres: cleanSubgenres,
    subgenresText: cleanSubgenres.join(', '),
    genres: primaryGenre || cleanSubgenres.length > 0 ? Array.from(new Set([primaryGenre, ...cleanSubgenres].filter(Boolean))) : genres,
    releaseYear: releaseYear ? Number(releaseYear) : null,
    year: releaseYear ? Number(releaseYear) : null,
    publicationYear: releaseYear ? Number(releaseYear) : null,
    publisher: normalizePublisherName(item.publisher || ''),
    totalPages,
    isbn: String(item.isbn || '').trim(),
    language: normalizeLanguageLabel(item.language || ''),
    synopsis: String(item.synopsis || '').trim(),
    ...(classification
      ? {
          cdu_cdd: item.cdu_cdd || classification.cdu_cdd,
          cutter: item.cutter || classification.cutter,
          callNumber: item.callNumber || classification.callNumber,
        }
      : {}),
  };
}
