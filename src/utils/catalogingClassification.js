const STOP_ARTICLES = new Set([
  'o',
  'a',
  'os',
  'as',
  'um',
  'uma',
  'uns',
  'umas',
  'the',
  'an',
  'le',
  'la',
  'les',
  'el',
  'los',
  'las',
]);

const CDD_RULES = [
  {
    keywords: [
      'computacao',
      'programacao',
      'software',
      'algoritmo',
      'engenharia de software',
      'inteligencia artificial',
      'ciencia da computacao',
      'tecnologia da informacao',
      'dados',
      'web',
      'javascript',
      'python',
    ],
    cdd: '004',
    label: '004 · Ciência da Computação',
  },
  {
    keywords: [
      'metodologia',
      'biblioteconomia',
      'pesquisa',
      'tcc',
      'generalidades',
      'enciclopedia',
      'documentacao',
      'abnt',
    ],
    cdd: '001.4',
    label: '001.4 · Metodologia & Pesquisa',
  },
  {
    keywords: ['psicologia', 'psicanalise', 'mente', 'comportamento'],
    cdd: '150',
    label: '150 · Psicologia',
  },
  {
    keywords: ['filosofia', 'etica', 'logica', 'metafisica', 'epistemologia', 'estoicismo'],
    cdd: '100',
    label: '100 · Filosofia',
  },
  {
    keywords: ['religiao', 'teologia', 'biblia', 'mitologia', 'espiritualidade'],
    cdd: '200',
    label: '200 · Religião',
  },
  {
    keywords: [
      'direito',
      'sociologia',
      'ciencias sociais',
      'politica',
      'economia',
      'educacao',
      'pedagogia',
      'antropologia',
    ],
    cdd: '300',
    label: '300 · Ciências Sociais',
  },
  {
    keywords: ['linguistica', 'idioma', 'gramatica', 'letras', 'dicionario', 'filologia'],
    cdd: '400',
    label: '400 · Linguística',
  },
  {
    keywords: [
      'matematica',
      'fisica',
      'quimica',
      'biologia',
      'astronomia',
      'ciencias naturais',
      'ecologia',
    ],
    cdd: '500',
    label: '500 · Ciências',
  },
  {
    keywords: [
      'tecnologia',
      'engenharia',
      'medicina',
      'saude',
      'administracao',
      'negocios',
      'gestao',
    ],
    cdd: '600',
    label: '600 · Tecnologia & Ciências Aplicadas',
  },
  {
    keywords: [
      'manga',
      'manhwa',
      'hq',
      'graphic novel',
      'quadrinhos',
      'webtoon',
      'shonen',
      'seinen',
    ],
    cdd: '741.5',
    label: '741.5 · Mangás & Quadrinhos',
  },
  {
    keywords: ['arte', 'artes', 'musica', 'cinema', 'fotografia', 'arquitetura', 'design'],
    cdd: '700',
    label: '700 · Artes',
  },
  {
    keywords: ['poesia', 'poema', 'lirica'],
    cdd: '808.1',
    label: '808.1 · Poesia',
  },
  {
    keywords: ['literatura brasileira', 'brasil', 'brasileira'],
    cdd: '869.3',
    label: '869.3 · Literatura Brasileira',
  },
  {
    keywords: [
      'literatura',
      'ficcao',
      'romance',
      'fantasia',
      'distopia',
      'ficcao cientifica',
      'suspense',
      'thriller',
      'terror',
      'gotico',
      'light novel',
      'classico',
      'conto',
    ],
    cdd: '800',
    label: '800 · Literatura',
  },
  {
    keywords: ['biografia', 'memorias', 'autobiografia'],
    cdd: '920',
    label: '920 · Biografias',
  },
  {
    keywords: ['historia', 'geografia', 'civilizacao', 'guerra', 'arqueologia'],
    cdd: '900',
    label: '900 · História & Geografia',
  },
];

function normalizeAscii(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function suggestCdd({
  workType = 'book',
  genres = [],
  title = '',
  keywords = '',
} = {}) {
  const haystack = normalizeAscii(
    [...(Array.isArray(genres) ? genres : [genres]), keywords, title].join(' ')
  );

  for (const rule of CDD_RULES) {
    if (rule.keywords.some((kw) => haystack.includes(kw))) {
      return { cdd: rule.cdd, label: rule.label };
    }
  }

  if (workType === 'manga') {
    return { cdd: '741.5', label: '741.5 · Mangás & Quadrinhos' };
  }
  if (workType === 'academic') {
    return { cdd: '001.4', label: '001.4 · Metodologia & Pesquisa' };
  }
  return { cdd: '800', label: '800 · Literatura' };
}

function extractPrimarySurname(author) {
  const firstAuthor = String(author || '')
    .split(/[;]/)[0]
    .trim();
  if (!firstAuthor) return '';

  if (firstAuthor.includes(',')) {
    return firstAuthor.split(',')[0].trim();
  }

  const parts = firstAuthor.split(/\s+/).filter(Boolean);
  return parts[parts.length - 1] || '';
}

function extractTitleMark(title) {
  const words = normalizeAscii(title)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return '';
  const firstSignificant =
    words.find((w) => !STOP_ARTICLES.has(w)) || words[0];
  return firstSignificant[0] || '';
}

const CONSONANT_DIGITS = {
  b: 1,
  c: 2,
  d: 3,
  f: 4,
  g: 4,
  h: 5,
  j: 5,
  k: 2,
  l: 6,
  m: 6,
  n: 6,
  p: 7,
  q: 7,
  r: 7,
  s: 8,
  t: 8,
  v: 9,
  w: 9,
  x: 9,
  y: 9,
  z: 9,
};

export function generateCutterCode(author = '', title = '') {
  const surnameRaw = extractPrimarySurname(author);
  const basis = normalizeAscii(surnameRaw || title).replace(/[^a-z]/g, '');
  if (!basis) return '';

  const initial = basis[0].toUpperCase();
  const digits = [];

  for (let i = 1; i < basis.length && digits.length < 3; i += 1) {
    const ch = basis[i];
    if ('aeiou'.includes(ch)) {
      const code = { a: 1, e: 3, i: 5, o: 7, u: 8 }[ch];
      digits.push(code);
    } else if (CONSONANT_DIGITS[ch] !== undefined) {
      digits.push(CONSONANT_DIGITS[ch]);
    }
  }

  while (digits.length < 3) {
    digits.push(((basis.charCodeAt(0) + digits.length * 3) % 8) + 1);
  }

  const titleMark = extractTitleMark(title);
  return `${initial}${digits.join('')}${titleMark}`;
}

export function suggestLibraryClassification(item = {}) {
  const { cdd, label } = suggestCdd(item);
  const cutter = generateCutterCode(item.author, item.title);
  const callNumber = [cdd, cutter].filter(Boolean).join(' ');
  return {
    cdu_cdd: cdd,
    cddLabel: label,
    cutter,
    callNumber,
  };
}

export const ACQUISITION_TYPES = ['Comprado', 'Biblioteca', 'Digital', 'Presente'];
export const CONSERVATION_STATES = ['Novo', 'Ótimo', 'Bom', 'Regular', 'Danificado'];
