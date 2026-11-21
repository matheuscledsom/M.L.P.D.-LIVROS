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
    id: 'computing',
    genre: 'Computação & Tecnologia',
    cdd: '004',
    label: '004 · Ciência da Computação',
    subSubjects: [
      {
        name: 'Inteligência Artificial & Dados',
        tags: ['Inteligência Artificial', 'Ciência de Dados', 'Aprendizado de Máquina'],
        keywords: [
          'inteligencia artificial',
          'artificial intelligence',
          'machine learning',
          'deep learning',
          'redes neurais',
          'neural networks',
          'ciencia de dados',
          'data science',
          'big data',
          'llm',
          'pln',
          'visao computacional',
        ],
      },
      {
        name: 'Engenharia de Software & Programação',
        tags: ['Engenharia de Software', 'Programação', 'Arquitetura de Software'],
        keywords: [
          'computacao',
          'computer science',
          'ciencia da computacao',
          'programacao',
          'programming',
          'algoritmo',
          'algoritmos',
          'algorithms',
          'estrutura de dados',
          'data structures',
          'engenharia de software',
          'software engineering',
          'clean code',
          'codigo limpo',
          'arquitetura de software',
          'design patterns',
          'padroes de projeto',
          'javascript',
          'typescript',
          'python',
          'rust',
          'golang',
          'nodejs',
          'react',
          'frontend',
          'backend',
          'fullstack',
          'desenvolvimento web',
          'web development',
          'compiladores',
          'compilers',
          'refatoracao',
          'refactoring',
        ],
      },
      {
        name: 'Sistemas, Cloud & Segurança',
        tags: ['Cloud & DevOps', 'Banco de Dados', 'Cibersegurança'],
        keywords: [
          'tecnologia da informacao',
          'banco de dados',
          'databases',
          'sql',
          'nosql',
          'linux',
          'sistema operacional',
          'operating systems',
          'redes de computadores',
          'devops',
          'docker',
          'kubernetes',
          'cloud computing',
          'computacao em nuvem',
          'ciberseguranca',
          'cybersecurity',
          'seguranca da informacao',
          'criptografia',
          'cryptography',
          'sistemas distribuidos',
        ],
      },
    ],
  },
  {
    id: 'methodology',
    genre: 'Metodologia & Pesquisa',
    cdd: '001.4',
    label: '001.4 · Metodologia & Pesquisa',
    subSubjects: [
      {
        name: 'Pesquisa Acadêmica & ABNT',
        tags: ['Metodologia Científica', 'Pesquisa Acadêmica', 'Normas ABNT'],
        keywords: [
          'metodologia',
          'methodology',
          'biblioteconomia',
          'pesquisa cientifica',
          'pesquisa academica',
          'academic research',
          'tcc',
          'dissertacao',
          'tese',
          'monografia',
          'generalidades',
          'enciclopedia',
          'documentacao',
          'abnt',
          'fichamento',
        ],
      },
    ],
  },
  {
    id: 'psychology',
    genre: 'Psicologia',
    cdd: '150',
    label: '150 · Psicologia',
    subSubjects: [
      {
        name: 'Psicanálise & Psicologia Profunda',
        tags: ['Psicanálise', 'Inconsciente', 'Saúde Emocional'],
        keywords: [
          'psicanalise',
          'psychoanalysis',
          'inconsciente',
          'unconscious',
          'freud',
          'jung',
          'lacan',
          'arquetipos',
          'interpretacao dos sonhos',
          'complexos',
        ],
      },
      {
        name: 'Psicologia Cognitiva & Comportamento',
        tags: ['Psicologia Cognitiva', 'Comportamento Humano', 'Saúde Mental'],
        keywords: [
          'psicologia',
          'psychology',
          'comportamento',
          'behavior',
          'cognitive behavioral',
          'terapia cognitiva',
          'neuropsicologia',
          'neuropsychology',
          'saude mental',
          'mental health',
          'inteligencia emocional',
          'emotional intelligence',
          'habitos',
          'habits',
          'ansiedade',
          'anxiety',
          'trauma',
          'psicoterapia',
          'mindfulness',
          'viés cognitivo',
          'vies cognitivo',
          'mente humana',
        ],
      },
    ],
  },
  {
    id: 'philosophy',
    genre: 'Filosofia',
    cdd: '100',
    label: '100 · Filosofia',
    subSubjects: [
      {
        name: 'Estoicismo & Ética Prática',
        tags: ['Estoicismo', 'Ética', 'Filosofia Prática'],
        keywords: [
          'estoicismo',
          'stoicism',
          'seneca',
          'marco aurelio',
          'epicteto',
          'etica',
          'ethics',
          'virtude',
          'moral philosophy',
          'filosofia moral',
        ],
      },
      {
        name: 'Filosofia Geral, Lógica & Existencialismo',
        tags: ['Filosofia', 'Epistemologia', 'Pensamento Crítico'],
        keywords: [
          'filosofia',
          'philosophy',
          'logica',
          'logic',
          'metafisica',
          'metaphysics',
          'epistemologia',
          'epistemology',
          'existencialismo',
          'existentialism',
          'fenomenologia',
          'phenomenology',
          'ontologia',
          'hermeneutica',
          'dialetica',
          'platao',
          'aristoteles',
          'kant',
          'nietzsche',
          'spinoza',
          'schopenhauer',
          'sartre',
          'camus',
          'kierkegaard',
          'estetica filosofica',
        ],
      },
    ],
  },
  {
    id: 'religion',
    genre: 'Religião & Espiritualidade',
    cdd: '200',
    label: '200 · Religião',
    subSubjects: [
      {
        name: 'Teologia, Mitologia & Espiritualidade',
        tags: ['Teologia', 'Mitologia', 'Espiritualidade'],
        keywords: [
          'religiao',
          'religion',
          'teologia',
          'theology',
          'biblia',
          'bible',
          'mitologia',
          'mythology',
          'espiritualidade',
          'spirituality',
          'budismo',
          'buddhism',
          'historia das religioes',
          'sagrado',
          'cristianismo',
          'judaismo',
          'islamismo',
          'zen',
        ],
      },
    ],
  },
  {
    id: 'law',
    genre: 'Direito',
    cdd: '340',
    label: '340 · Direito',
    subSubjects: [
      {
        name: 'Direito Público, Privado & Teoria Jurídica',
        tags: ['Direito', 'Legislação', 'Teoria Jurídica'],
        keywords: [
          'direito',
          'jurisprudencia',
          'constituicao',
          'direito constitucional',
          'constitutional law',
          'direito civil',
          'civil law',
          'codigo civil',
          'direito penal',
          'criminal law',
          'processo civil',
          'processo penal',
          'direito administrativo',
          'direito tributario',
          'direito do trabalho',
          'direitos humanos',
          'human rights',
          'doutrina juridica',
          'hermeneutica juridica',
          'contratos',
          'oab',
          'stf',
          'legislacao',
          'statute',
          'legal theory',
        ],
      },
    ],
  },
  {
    id: 'social',
    genre: 'Ciências Sociais',
    cdd: '300',
    label: '300 · Ciências Sociais',
    subSubjects: [
      {
        name: 'Sociologia, Política & Educação',
        tags: ['Sociologia', 'Ciência Política', 'Educação'],
        keywords: [
          'sociologia',
          'sociology',
          'ciencias sociais',
          'social sciences',
          'ciencia politica',
          'political science',
          'politica',
          'geopolitica',
          'geopolitics',
          'democracia',
          'democracy',
          'desigualdade social',
          'educacao',
          'education',
          'pedagogia',
          'pedagogy',
          'antropologia',
          'anthropology',
          'didatica',
          'movimentos sociais',
          'cultura e sociedade',
        ],
      },
    ],
  },
  {
    id: 'business',
    genre: 'Negócios & Economia',
    cdd: '650',
    label: '650 · Negócios, Gestão & Economia',
    subSubjects: [
      {
        name: 'Economia & Finanças',
        tags: ['Economia', 'Finanças', 'Mercado'],
        keywords: [
          'economia',
          'economics',
          'macroeconomia',
          'macroeconomics',
          'microeconomia',
          'microeconomics',
          'financas',
          'finance',
          'investimentos',
          'investing',
          'mercado financeiro',
          'educacao financeira',
          'capitalismo',
          'politica monetaria',
        ],
      },
      {
        name: 'Gestão, Empreendedorismo & Estratégia',
        tags: ['Negócios', 'Gestão', 'Estratégia'],
        keywords: [
          'negocios',
          'business',
          'administracao',
          'management',
          'empreendedorismo',
          'entrepreneurship',
          'lideranca',
          'leadership',
          'marketing',
          'estrategia empresarial',
          'startup',
          'startups',
          'produtividade',
          'productivity',
          'gestao de projetos',
          'gestao de produtos',
          'product management',
          'scrum',
          'kanban',
          'inovacao',
          'innovation',
        ],
      },
    ],
  },
  {
    id: 'linguistics',
    genre: 'Linguística',
    cdd: '400',
    label: '400 · Linguística & Idiomas',
    subSubjects: [
      {
        name: 'Gramática, Filologia & Tradução',
        tags: ['Linguística', 'Idiomas', 'Gramática'],
        keywords: [
          'linguistica',
          'linguistics',
          'idioma',
          'idiomas',
          'gramatica',
          'grammar',
          'letras',
          'dicionario',
          'dictionary',
          'filologia',
          'semantica',
          'semantics',
          'sintaxe',
          'fonetica',
          'etimologia',
          'estudos de traducao',
        ],
      },
    ],
  },
  {
    id: 'science',
    genre: 'Ciências',
    cdd: '500',
    label: '500 · Ciências Naturais & Exatas',
    subSubjects: [
      {
        name: 'Física, Matemática & Astronomia',
        tags: ['Física', 'Matemática', 'Astronomia'],
        keywords: [
          'matematica',
          'mathematics',
          'calculo',
          'algebra',
          'geometria',
          'estatistica',
          'statistics',
          'probabilidade',
          'fisica',
          'physics',
          'fisica quantica',
          'mecanica quantica',
          'quantum mechanics',
          'astrofisica',
          'astrophysics',
          'astronomia',
          'astronomy',
          'cosmologia',
          'relatividade',
          'termodinamica',
        ],
      },
      {
        name: 'Biologia, Química & Natureza',
        tags: ['Biologia', 'Química', 'Ciências Naturais'],
        keywords: [
          'quimica',
          'chemistry',
          'biologia',
          'biology',
          'genetica',
          'genetics',
          'evolucao',
          'evolution',
          'neurociencia',
          'neuroscience',
          'ciencias naturais',
          'natural sciences',
          'ecologia',
          'ecology',
          'zoologia',
          'botanica',
          'microbiologia',
          'divulgacao cientifica',
        ],
      },
    ],
  },
  {
    id: 'applied-tech',
    genre: 'Engenharia & Saúde',
    cdd: '600',
    label: '600 · Tecnologia & Ciências Aplicadas',
    subSubjects: [
      {
        name: 'Engenharia, Medicina & Saúde',
        tags: ['Engenharia', 'Medicina', 'Ciências Aplicadas'],
        keywords: [
          'tecnologia aplicada',
          'engenharia',
          'engineering',
          'engenharia civil',
          'engenharia mecanica',
          'engenharia eletrica',
          'medicina',
          'medicine',
          'anatomia',
          'anatomy',
          'fisiologia',
          'farmacologia',
          'enfermagem',
          'nutricao',
          'nutrition',
          'saude publica',
          'epidemiologia',
          'robotica',
          'eletronica',
        ],
      },
    ],
  },
  {
    id: 'manga',
    genre: 'Mangás & HQs',
    cdd: '741.5',
    label: '741.5 · Mangás & Quadrinhos',
    subSubjects: [
      {
        name: 'Mangás, Manhwas & Graphic Novels',
        tags: ['Mangá', 'Quadrinhos', 'Graphic Novel'],
        keywords: [
          'manga',
          'mangas',
          'manhwa',
          'manhua',
          'hq',
          'hqs',
          'graphic novel',
          'quadrinhos',
          'historias em quadrinhos',
          'comics',
          'comic book',
          'webtoon',
          'shonen',
          'shoujo',
          'seinen',
          'josei',
          'isekai',
          'mecha',
          'tankobon',
          'slice of life',
          'bande dessinee',
        ],
      },
    ],
  },
  {
    id: 'arts',
    genre: 'Artes & Cultura',
    cdd: '700',
    label: '700 · Artes, Cinema & Música',
    subSubjects: [
      {
        name: 'Artes Visuais, Música & Cinema',
        tags: ['Artes', 'Cinema', 'Design'],
        keywords: [
          'arte',
          'artes',
          'fine arts',
          'historia da arte',
          'musica',
          'music theory',
          'cinema',
          'film studies',
          'fotografia',
          'photography',
          'arquitetura',
          'architecture',
          'design grafico',
          'ilustracao',
          'teatro',
        ],
      },
    ],
  },
  {
    id: 'brazilian-lit',
    genre: 'Literatura Brasileira',
    cdd: '869.3',
    label: '869.3 · Literatura Brasileira',
    subSubjects: [
      {
        name: 'Prosa, Crônica & Clássicos Brasileiros',
        tags: ['Literatura Brasileira', 'Ficção Nacional', 'Clássico Brasileiro'],
        keywords: [
          'literatura brasileira',
          'brazilian literature',
          'brasil colonial',
          'sertao',
          'nordeste',
          'machado de assis',
          'clarice lispector',
          'guimaraes rosa',
          'graciliano ramos',
          'jorge amado',
          'drummond',
          'modernismo brasileiro',
          'cronica brasileira',
          'cordel',
          'cangaco',
          'romance brasileiro',
        ],
      },
    ],
  },
  {
    id: 'fantasy',
    genre: 'Fantasia',
    cdd: '808.38',
    label: '808.38 · Fantasia',
    subSubjects: [
      {
        name: 'Fantasia Épica, Urbana & Sombria',
        tags: ['Fantasia', 'Construção de Mundo', 'Magia'],
        keywords: [
          'fantasia',
          'fantasy',
          'fantasia epica',
          'epic fantasy',
          'high fantasy',
          'dark fantasy',
          'urban fantasy',
          'grimdark',
          'magia',
          'magic',
          'feiticaria',
          'feiticeiro',
          'mago',
          'wizard',
          'dragao',
          'dragoes',
          'dragon',
          'dragons',
          'reino',
          'kingdom',
          'espada',
          'elfos',
          'elves',
          'profecia',
          'prophecy',
          'worldbuilding',
          'light novel',
        ],
      },
    ],
  },
  {
    id: 'scifi',
    genre: 'Ficção Científica',
    cdd: '808.387',
    label: '808.387 · Ficção Científica',
    subSubjects: [
      {
        name: 'Sci-Fi, Cyberpunk & Distopia',
        tags: ['Ficção Científica', 'Distopia', 'Espaço & Tecnologia'],
        keywords: [
          'ficcao cientifica',
          'science fiction',
          'sci fi',
          'scifi',
          'cyberpunk',
          'steampunk',
          'space opera',
          'distopia',
          'distopias',
          'dystopia',
          'dystopian',
          'utopia',
          'viagem no tempo',
          'time travel',
          'estacao espacial',
          'nave espacial',
          'starship',
          'extraterrestre',
          'alienigena',
          'aliens',
          'pos-apocaliptico',
          'post apocalyptic',
          'androide',
          'android',
          'futurismo',
          'colonia espacial',
          'terraforming',
        ],
      },
    ],
  },
  {
    id: 'horror',
    genre: 'Terror & Suspense',
    cdd: '808.39',
    label: '808.39 · Terror, Gótico & Suspense',
    subSubjects: [
      {
        name: 'Horror Cósmico, Gótico & Thriller',
        tags: ['Terror', 'Suspense', 'Gótico'],
        keywords: [
          'terror',
          'horror',
          'horror cosmico',
          'cosmic horror',
          'lovecraft',
          'gotico',
          'gothic',
          'sobrenatural',
          'supernatural',
          'assombracao',
          'casa assombrada',
          'haunted',
          'vampiro',
          'vampire',
          'fantasma',
          'ghost',
          'macabro',
          'ocultismo',
          'thriller',
          'thriller psicologico',
          'psychological thriller',
          'suspense',
          'misterio',
          'mystery',
          'detetive',
          'crime',
          'noir',
          'pesadelo',
          'nightmare',
        ],
      },
    ],
  },
  {
    id: 'poetry',
    genre: 'Poesia',
    cdd: '808.1',
    label: '808.1 · Poesia',
    subSubjects: [
      {
        name: 'Poesia Lírica & Versos',
        tags: ['Poesia', 'Lírica', 'Antologia Poética'],
        keywords: ['poesia', 'poetry', 'poema', 'poemas', 'poem', 'lirica', 'soneto', 'haicai', 'versos'],
      },
    ],
  },
  {
    id: 'literature',
    genre: 'Literatura Estrangeira',
    cdd: '800',
    label: '800 · Literatura Geral & Estrangeira',
    subSubjects: [
      {
        name: 'Romance, Clássicos & Contos',
        tags: ['Literatura Estrangeira', 'Ficção Clássica', 'Romance'],
        keywords: [
          'literatura',
          'literature',
          'literatura estrangeira',
          'world literature',
          'literatura russa',
          'russian literature',
          'literatura inglesa',
          'english literature',
          'literatura francesa',
          'french literature',
          'realismo magico',
          'magical realism',
          'ficcao',
          'fiction',
          'romance',
          'novel',
          'classico',
          'classics',
          'classic literature',
          'contos',
          'short stories',
          'tragedia',
          'epopeia',
          'drama literario',
        ],
      },
    ],
  },
  {
    id: 'biography',
    genre: 'Biografias & Memórias',
    cdd: '920',
    label: '920 · Biografias',
    subSubjects: [
      {
        name: 'Biografias, Diários & Memórias',
        tags: ['Biografia', 'Memórias', 'Não Ficção'],
        keywords: [
          'biografia',
          'biography',
          'memorias',
          'memoir',
          'memoirs',
          'autobiografia',
          'autobiography',
          'diarios',
          'correspondencia',
          'cartas',
          'perfil biografico',
        ],
      },
    ],
  },
  {
    id: 'history',
    genre: 'História',
    cdd: '900',
    label: '900 · História & Geografia',
    subSubjects: [
      {
        name: 'História Geral, Antiga & Contemporânea',
        tags: ['História', 'Civilizações', 'Historiografia'],
        keywords: [
          'historia',
          'history',
          'historiografia',
          'historia antiga',
          'ancient history',
          'idade media',
          'medieval history',
          'renascimento',
          'revolucao industrial',
          'revolucao francesa',
          'primeira guerra',
          'segunda guerra',
          'world war',
          'guerra fria',
          'cold war',
          'imperio romano',
          'civilizacao',
          'civilizations',
          'arqueologia',
          'archaeology',
          'geografia',
          'geography',
        ],
      },
    ],
  },
];

export const SUBJECT_TAXONOMY = CDD_RULES;

export function getTaxonomyKeywordCount() {
  const unique = new Set();
  CDD_RULES.forEach((rule) => {
    (rule.subSubjects || []).forEach((sub) => {
      (sub.keywords || []).forEach((kw) => unique.add(kw));
    });
  });
  return unique.size;
}

const REGEX_CACHE = new Map();

function normalizeAscii(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function matchesKeyword(haystack, rawKeyword) {
  if (!haystack || !rawKeyword) return false;
  const kw = normalizeAscii(rawKeyword);
  if (!kw) return false;
  let pattern = REGEX_CACHE.get(kw);
  if (!pattern) {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    pattern = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`);
    REGEX_CACHE.set(kw, pattern);
  }
  return pattern.test(haystack);
}

export function classifyWorkLocally({
  workType = 'book',
  genres = [],
  subgenres = [],
  title = '',
  synopsis = '',
  keywords = '',
  author = '',
} = {}) {
  const explicitText = normalizeAscii(
    [
      ...(Array.isArray(genres) ? genres : [genres]),
      ...(Array.isArray(subgenres) ? subgenres : [subgenres]),
    ].join(' ')
  );
  const titleText = normalizeAscii(title);
  const authorText = normalizeAscii(author);
  const bodyText = normalizeAscii([synopsis, keywords].join(' '));

  let bestMatch = null;

  for (const rule of CDD_RULES) {
    let totalScore = 0;
    let bestSub = null;
    const matchedKeywords = [];

    for (const sub of rule.subSubjects || []) {
      let subScore = 0;
      for (const kw of sub.keywords || []) {
        let kwScore = 0;
        if (matchesKeyword(explicitText, kw)) kwScore += 4.5;
        if (matchesKeyword(titleText, kw)) kwScore += 3.0;
        if (matchesKeyword(authorText, kw)) kwScore += 2.6;
        if (matchesKeyword(bodyText, kw)) kwScore += 1.5;
        if (kwScore > 0) {
          const specificityMultiplier = kw.includes(' ') ? 1.85 : 1;
          subScore += kwScore * specificityMultiplier;
          matchedKeywords.push(kw);
        }
      }
      if (subScore > 0 && (!bestSub || subScore > bestSub.score)) {
        bestSub = { sub, score: subScore };
      }
      totalScore += subScore;
    }

    if (totalScore > 0) {
      if (workType === 'manga' && rule.id === 'manga') {
        totalScore += 4;
      }
      if (workType === 'academic' && (rule.id === 'methodology' || rule.id === 'computing' || rule.id === 'science' || rule.id === 'law' || rule.id === 'philosophy' || rule.id === 'psychology' || rule.id === 'social')) {
        totalScore += 1.2;
      }

      if (!bestMatch || totalScore > bestMatch.score) {
        bestMatch = {
          rule,
          subSubject: bestSub?.sub || rule.subSubjects?.[0] || null,
          score: totalScore,
          matchedKeywords,
        };
      }
    }
  }

  let resolvedRule = bestMatch?.rule || null;
  let resolvedSub = bestMatch?.subSubject || null;

  if (!resolvedRule) {
    if (workType === 'manga') {
      resolvedRule = CDD_RULES.find((r) => r.id === 'manga');
    } else if (workType === 'academic') {
      resolvedRule = CDD_RULES.find((r) => r.id === 'methodology');
    } else {
      resolvedRule = CDD_RULES.find((r) => r.id === 'literature');
    }
    resolvedSub = resolvedRule?.subSubjects?.[0] || null;
  }

  const suggestedTags = Array.from(
    new Set([
      ...(resolvedSub?.tags || []),
      ...(bestMatch?.matchedKeywords || []).slice(0, 3).map((kw) =>
        kw
          .split(' ')
          .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ''))
          .join(' ')
      ),
    ])
  ).slice(0, 5);

  const cutter = generateCutterCode(author, title);
  const cdd = resolvedRule?.cdd || '800';
  const cddLabel = resolvedRule?.label || '800 · Literatura';
  const callNumber = [cdd, cutter].filter(Boolean).join(' ');

  return {
    primaryGenre: resolvedRule?.genre || 'Literatura Estrangeira',
    subgenre: resolvedSub?.name || resolvedRule?.genre || 'Ficção Geral',
    subgenres: [resolvedSub?.name].filter(Boolean),
    cdd,
    cdu_cdd: cdd,
    cddLabel,
    cutter,
    callNumber,
    suggestedTags,
    matchedKeywordsCount: bestMatch?.matchedKeywords?.length || 0,
  };
}

export function suggestCdd(item = {}) {
  const result = classifyWorkLocally(item);
  return {
    cdd: result.cdd,
    label: result.cddLabel,
    primaryGenre: result.primaryGenre,
    subgenre: result.subgenre,
    suggestedTags: result.suggestedTags,
  };
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
  const classified = classifyWorkLocally(item);
  return {
    cdu_cdd: classified.cdu_cdd,
    cddLabel: classified.cddLabel,
    cutter: classified.cutter,
    callNumber: classified.callNumber,
    primaryGenre: classified.primaryGenre,
    subgenre: classified.subgenre,
    subgenres: classified.subgenres,
    suggestedTags: classified.suggestedTags,
  };
}

export const ACQUISITION_TYPES = ['Comprado', 'Biblioteca', 'Digital', 'Presente'];
export const CONSERVATION_STATES = ['Novo', 'Ótimo', 'Bom', 'Regular', 'Danificado'];
