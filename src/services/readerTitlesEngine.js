import { normalizePublisherName } from '../data/brazilianPublishers.js';

export const READER_TITLE_CATEGORIES = [
  { id: 'all', label: 'Todos' },
  { id: 'living', label: 'Título Vivo' },
  { id: 'genre', label: 'Gêneros & CDD' },
  { id: 'library', label: 'Bibliotecário & Social' },
];

function norm(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function itemSearchBlob(item) {
  return norm(
    [
      item?.title,
      item?.originalTitle,
      item?.workType,
      item?.demographicOrigin,
      item?.cdu_cdd,
      ...(Array.isArray(item?.genres) ? item.genres : []),
      ...(Array.isArray(item?.tropes) ? item.tropes : []),
      ...(Array.isArray(item?.atmosphere) ? item.atmosphere : []),
      item?.keywords,
    ]
      .filter(Boolean)
      .join(' ')
  );
}

function parseCddNumber(cduCdd) {
  const match = String(cduCdd || '').match(/(\d{1,3})/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isNaN(n) ? null : n;
}

function makePatternPredicate(pattern, cddMin = null, cddMax = null) {
  return (item) => {
    const cdd = parseCddNumber(item?.cdu_cdd);
    if (cdd !== null && cddMin !== null && cddMax !== null && cdd >= cddMin && cdd <= cddMax) {
      return true;
    }
    return pattern.test(itemSearchBlob(item));
  };
}

const LIVING_TITLE_SPECS = [
  // Estudo & Pesquisa (avaliados antes quando houver CDD/workType específico)
  {
    id: 'living_computacao',
    name: 'Estudante de Computação & Algoritmos',
    description: 'Detectado em leituras ativas com CDD 004–006 ou temas de computação.',
    iconName: 'Cpu',
    studyPriority: true,
    match: makePatternPredicate(
      /\b(computacao|programacao|software|algoritmo|codigo|javascript|python|inteligencia artificial|dados)\b/,
      4,
      6
    ),
  },
  {
    id: 'living_psicologia',
    name: 'Estudioso de Psicologia',
    description: 'Detectado em leituras ativas com CDD 150 ou temas de psicologia.',
    iconName: 'Brain',
    studyPriority: true,
    match: makePatternPredicate(/\b(psicologia|psicanalise|comportamento|mente)\b/, 150, 159),
  },
  {
    id: 'living_filosofia',
    name: 'Pesquisador de Filosofia',
    description: 'Detectado em leituras ativas com CDD 100–199 ou temas filosóficos.',
    iconName: 'Compass',
    studyPriority: true,
    match: (item) => {
      const cdd = parseCddNumber(item?.cdu_cdd);
      if (cdd !== null && cdd >= 100 && cdd <= 199 && (cdd < 150 || cdd > 159)) {
        return true;
      }
      return /\b(filosofia|etica|epistemologia|metafisica|logica|estoicismo)\b/.test(
        itemSearchBlob(item)
      );
    },
  },
  {
    id: 'living_direito',
    name: 'Estudioso de Direito',
    description: 'Detectado em leituras ativas com CDD 340 ou temas jurídicos.',
    iconName: 'Scale',
    studyPriority: true,
    match: makePatternPredicate(
      /\b(direito|juridico|constituicao|constitucional|penal|civil|processo)\b/,
      340,
      349
    ),
  },
  {
    id: 'living_sociologia',
    name: 'Pesquisador de Ciências Sociais',
    description: 'Detectado em leituras ativas com CDD 300–399 ou ciências sociais.',
    iconName: 'Users',
    studyPriority: true,
    match: (item) => {
      const cdd = parseCddNumber(item?.cdu_cdd);
      if (cdd !== null && cdd >= 300 && cdd <= 399 && (cdd < 340 || cdd > 349)) {
        return true;
      }
      return /\b(sociologia|antropologia|ciencias sociais|politica|economia|pedagogia)\b/.test(
        itemSearchBlob(item)
      );
    },
  },
  {
    id: 'living_historia',
    name: 'Estudioso de História',
    description: 'Detectado em leituras ativas com CDD 900 ou historiografia.',
    iconName: 'Landmark',
    studyPriority: true,
    match: makePatternPredicate(/\b(historia|historiografia|geografia|biografia)\b/, 900, 999),
  },
  {
    id: 'living_linguistica',
    name: 'Estudioso de Linguística & Idiomas',
    description: 'Detectado em leituras ativas com CDD 400 ou estudos da linguagem.',
    iconName: 'Languages',
    studyPriority: true,
    match: makePatternPredicate(/\b(linguistica|gramatica|filologia|idiomas)\b/, 400, 499),
  },
  {
    id: 'living_ciencias',
    name: 'Pesquisador de Ciências Naturais',
    description: 'Detectado em leituras ativas com CDD 500–599.',
    iconName: 'Atom',
    studyPriority: true,
    match: makePatternPredicate(
      /\b(matematica|fisica|quimica|biologia|astronomia|ciencias naturais)\b/,
      500,
      599
    ),
  },
  {
    id: 'living_pesquisa_lit',
    name: 'Pesquisador de Literatura',
    description: 'Detectado em leituras acadêmicas com CDD 800 ou teoria literária.',
    iconName: 'GraduationCap',
    studyPriority: true,
    match: (item) => {
      const cdd = parseCddNumber(item?.cdu_cdd);
      const isLitCdd = cdd !== null && cdd >= 800 && cdd <= 899;
      return (
        (item?.workType === 'academic' && isLitCdd) ||
        /\b(teoria literaria|critica literaria|literatura comparada|estudos literarios)\b/.test(
          itemSearchBlob(item)
        )
      );
    },
  },
  {
    id: 'living_tcc',
    name: 'Acadêmico em Produção de TCC',
    description: 'Ativo ao ler artigos, obras acadêmicas ou referências com DOI.',
    iconName: 'FileText',
    studyPriority: true,
    match: (item) =>
      item?.workType === 'academic' ||
      Boolean(item?.doi) ||
      /\b(tcc|metodologia|fichamento|abnt|pesquisa)\b/.test(itemSearchBlob(item)),
  },

  // Ficção & Narrativa
  {
    id: 'living_shonen',
    name: 'Leitor de Mangá Shonen',
    description: 'Ativo durante a leitura de mangás shonen.',
    iconName: 'Layers',
    match: (item) =>
      /\bshonen\b/.test(itemSearchBlob(item)) ||
      (item?.workType === 'manga' && /\b(acao|aventura|luta)\b/.test(itemSearchBlob(item))),
  },
  {
    id: 'living_seinen',
    name: 'Leitor de Seinen',
    description: 'Ativo durante a leitura de obras seinen.',
    iconName: 'Layers',
    match: (item) => /\bseinen\b/.test(itemSearchBlob(item)),
  },
  {
    id: 'living_light_novel',
    name: 'Leitor de Light Novels',
    description: 'Ativo durante a leitura de light novels.',
    iconName: 'BookOpen',
    match: (item) =>
      norm(item?.demographicOrigin) === 'light novel' ||
      /\blight novel\b/.test(itemSearchBlob(item)),
  },
  {
    id: 'living_manhwa',
    name: 'Explorador de Manhwas',
    description: 'Ativo durante a leitura de manhwas ou webtoons.',
    iconName: 'Layers',
    match: (item) =>
      norm(item?.demographicOrigin) === 'manhwa' ||
      /\b(manhwa|webtoon)\b/.test(itemSearchBlob(item)),
  },
  {
    id: 'living_fantasia',
    name: 'Explorador de Mundos Fantásticos',
    description: 'Ativo durante a leitura de obras de fantasia.',
    iconName: 'Mountain',
    match: (item) => /\b(fantasia|alta fantasia|epico|magia)\b/.test(itemSearchBlob(item)),
  },
  {
    id: 'living_terror',
    name: 'Caçador de Terror Gótico',
    description: 'Ativo durante a leitura de terror, horror ou ficção gótica.',
    iconName: 'Moon',
    match: (item) => /\b(terror|horror|gotico|macabro|sobrenatural)\b/.test(itemSearchBlob(item)),
  },
  {
    id: 'living_scifi',
    name: 'Navegador Sci-Fi',
    description: 'Ativo durante a leitura de ficção científica ou distopia.',
    iconName: 'Compass',
    match: (item) =>
      /\b(ficcao cientifica|sci-fi|scifi|distopia|cyberpunk|espacial)\b/.test(
        itemSearchBlob(item)
      ),
  },
  {
    id: 'living_misterio',
    name: 'Estrategista de Mistérios',
    description: 'Ativo durante a leitura de suspense, policial ou thriller.',
    iconName: 'Eye',
    match: (item) =>
      /\b(misterio|suspense|thriller|policial|detetive|investigacao)\b/.test(
        itemSearchBlob(item)
      ),
  },
  {
    id: 'living_romance',
    name: 'Cronista de Romances',
    description: 'Ativo durante a leitura de romances e ficção dramática.',
    iconName: 'Heart',
    match: (item) => /\b(romance|drama|ficcao contemporanea)\b/.test(itemSearchBlob(item)),
  },
  {
    id: 'living_classicos',
    name: 'Apreciador de Clássicos',
    description: 'Ativo durante a leitura de literatura clássica ou brasileira.',
    iconName: 'BookMarked',
    match: (item) => {
      const cdd = parseCddNumber(item?.cdu_cdd);
      return (
        (cdd !== null && cdd >= 800 && cdd <= 899) ||
        /\b(classico|classicos|literatura brasileira|literatura)\b/.test(
          itemSearchBlob(item)
        )
      );
    },
  },
];

const GENRE_CDD_TEMPLATES = [
  { key: 'fantasia', label: 'Fantasia', icon: 'Mountain', match: makePatternPredicate(/\b(fantasia|alta fantasia|epico)\b/) },
  { key: 'scifi', label: 'Ficção Científica', icon: 'Compass', match: makePatternPredicate(/\b(ficcao cientifica|sci-fi|distopia|cyberpunk)\b/) },
  { key: 'terror', label: 'Terror & Gótico', icon: 'Moon', match: makePatternPredicate(/\b(terror|horror|gotico|macabro)\b/) },
  { key: 'suspense', label: 'Suspense & Mistério', icon: 'Eye', match: makePatternPredicate(/\b(suspense|misterio|thriller|policial|crime)\b/) },
  { key: 'romance', label: 'Romance & Drama', icon: 'Heart', match: makePatternPredicate(/\b(romance|drama)\b/) },
  { key: 'classicos', label: 'Clássicos Universais', icon: 'BookMarked', match: makePatternPredicate(/\b(classico|classicos|realismo|modernismo)\b/, 800, 829) },
  { key: 'lit_brasileira', label: 'Literatura Brasileira', icon: 'BookOpen', match: makePatternPredicate(/\b(literatura brasileira|brasileira)\b/, 869, 869) },
  { key: 'mangas', label: 'Mangás & HQs', icon: 'Layers', match: (i) => i?.workType === 'manga' || makePatternPredicate(/\b(manga|hq|graphic novel|quadrinhos)\b/, 741, 741)(i) },
  { key: 'light_novels', label: 'Light Novels & Manhwas', icon: 'Feather', match: (i) => /\b(light novel|manhwa|webtoon)\b/.test(itemSearchBlob(i)) },
  { key: 'computacao', label: 'Computação (CDD 004)', icon: 'Cpu', match: makePatternPredicate(/\b(computacao|programacao|software|algoritmo)\b/, 4, 6) },
  { key: 'filosofia', label: 'Filosofia (CDD 100)', icon: 'Compass', match: makePatternPredicate(/\b(filosofia|etica|logica|metafisica)\b/, 100, 149) },
  { key: 'psicologia', label: 'Psicologia (CDD 150)', icon: 'Brain', match: makePatternPredicate(/\b(psicologia|psicanalise|mente)\b/, 150, 159) },
  { key: 'sociais', label: 'Ciências Sociais (CDD 300)', icon: 'Users', match: makePatternPredicate(/\b(sociologia|politica|economia|antropologia)\b/, 300, 339) },
  { key: 'direito', label: 'Direito (CDD 340)', icon: 'Scale', match: makePatternPredicate(/\b(direito|juridico|constituicao)\b/, 340, 349) },
  { key: 'linguistica', label: 'Linguística (CDD 400)', icon: 'Languages', match: makePatternPredicate(/\b(linguistica|idiomas|gramatica|letras)\b/, 400, 499) },
  { key: 'ciencias', label: 'Ciências Naturais (CDD 500)', icon: 'Atom', match: makePatternPredicate(/\b(matematica|fisica|quimica|biologia)\b/, 500, 599) },
  { key: 'aplicadas', label: 'Ciências Aplicadas (CDD 600)', icon: 'Briefcase', match: makePatternPredicate(/\b(engenharia|administracao|medicina|negocios)\b/, 600, 699) },
  { key: 'artes', label: 'Artes & Design (CDD 700)', icon: 'Palette', match: makePatternPredicate(/\b(arte|musica|cinema|arquitetura|design)\b/, 700, 799) },
  { key: 'historia', label: 'História & Geografia (CDD 900)', icon: 'Landmark', match: makePatternPredicate(/\b(historia|historiografia|geografia|biografia)\b/, 900, 999) },
];

const TIER_LEVELS = [
  { id: 'iniciante', label: 'Iniciante', target: 1 },
  { id: 'veterano', label: 'Veterano', target: 3 },
  { id: 'mestre', label: 'Mestre', target: 6 },
  { id: 'arquivista', label: 'Arquivista', target: 10 },
];

const GENRE_TITLES = GENRE_CDD_TEMPLATES.flatMap((topic) =>
  TIER_LEVELS.map((tier) => ({
    id: `genre_${topic.key}_${tier.id}`,
    name: `${tier.label} em ${topic.label}`,
    category: 'genre',
    tier: tier.id,
    iconName: topic.icon,
    description: `Catalogue ou leia ${tier.target} ${
      tier.target === 1 ? 'obra' : 'obras'
    } de ${topic.label}.`,
    evaluate: (ctx) => {
      const current = ctx.backlogItems.filter(topic.match).length;
      return {
        current,
        target: tier.target,
        unlocked: current >= tier.target,
      };
    },
  }))
);

export function toLocalDateKey(input = new Date()) {
  const dt = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(dt.getTime())) return null;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function computeConsecutiveReadingDays(
  readingSessions = [],
  nowDate = new Date()
) {
  const list = Array.isArray(readingSessions) ? readingSessions : [];
  const daySet = new Set();
  for (const s of list) {
    const rawDate = s?.endedAt || s?.startedAt || s?.createdAt;
    if (!rawDate) continue;
    const key = toLocalDateKey(rawDate);
    if (key) daySet.add(key);
  }
  if (daySet.size === 0) return 0;

  const baseNow = nowDate instanceof Date ? nowDate : new Date(nowDate);
  if (Number.isNaN(baseNow.getTime())) return 0;

  const today = new Date(baseNow.getFullYear(), baseNow.getMonth(), baseNow.getDate());
  const todayKey = toLocalDateKey(today);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = toLocalDateKey(yesterday);

  let cursor = daySet.has(todayKey)
    ? today
    : daySet.has(yesterdayKey)
      ? yesterday
      : null;

  if (!cursor) return 0;

  let streak = 0;
  while (cursor) {
    const key = toLocalDateKey(cursor);
    if (!key || !daySet.has(key)) break;
    streak += 1;
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1);
  }
  return streak;
}

export function computeSafeBadgeProgress(current, target) {
  const safeTarget = Math.max(0, Number(target) || 0);
  const safeCurrent = Math.max(0, Number(current) || 0);
  if (safeTarget <= 0) return 0;
  return Math.min(100, Math.round((safeCurrent / safeTarget) * 100));
}

export const BADGE_RULES = [
  // Catalogação & Acervo
  {
    prefix: 'bib',
    category: 'library',
    iconName: 'BookMarked',
    tiers: [
      { id: 'iniciante', name: 'Catalogador Aprendiz', target: 1, desc: 'Catalogue sua primeira obra no acervo.', useAllWorks: true },
      { id: 'veterano', name: 'Bibliotecário Rigoroso', target: 5, desc: 'Tenha 5 obras com CDD/CDU e notação Cutter preenchidos.' },
      { id: 'mestre', name: 'Curador de Acervo', target: 15, desc: 'Mantenha 15 obras com classificação CDD e Cutter completa.' },
      { id: 'arquivista', name: 'Diretor de Biblioteca', target: 35, desc: 'Catalogação rigorosa em 35 obras da coleção.' },
    ],
    measure: (stats, tier) =>
      tier?.useAllWorks ? stats.catalogedWorksCount : stats.classifiedWorksCount,
  },
  // Sessões concluídas
  {
    prefix: 'sessions',
    category: 'library',
    iconName: 'Clock',
    tiers: [
      { id: 'iniciante', name: 'Primeira Sessão', target: 1, desc: 'Conclua 1 sessão de leitura registrada.' },
      { id: 'veterano', name: 'Ritmo Constante', target: 5, desc: 'Conclua 5 sessões de leitura.' },
      { id: 'mestre', name: 'Sessões Disciplinadas', target: 20, desc: 'Conclua 20 sessões de leitura.' },
    ],
    measure: (stats) => stats.completedSessionsCount,
  },
  // Citações
  {
    prefix: 'quotes',
    category: 'library',
    iconName: 'Quote',
    tiers: [
      { id: 'iniciante', name: 'Coletor de Trechos', target: 1, desc: 'Salve sua primeira citação no cofre.' },
      { id: 'veterano', name: 'Caçador de Citações I', target: 10, desc: 'Acumule 10 citações e destaques salvos.' },
      { id: 'mestre', name: 'Caçador de Citações II', target: 50, desc: 'Acumule 50 citações no cofre de pesquisa.' },
      { id: 'arquivista', name: 'Arquivo Vivo de Citações', target: 100, desc: 'Atinja a marca de 100 citações catalogadas.' },
    ],
    measure: (stats) => stats.totalQuotesCount,
  },
  // Crítico & Resenhas
  {
    prefix: 'reviews',
    category: 'library',
    iconName: 'Star',
    tiers: [
      { id: 'iniciante', name: 'Primeira Impressão', target: 1, desc: 'Avalie ou escreva sua primeira resenha.' },
      { id: 'veterano', name: 'Crítico Consistente I', target: 5, desc: 'Conclua 5 obras com nota ou resenha registrada.' },
      { id: 'mestre', name: 'Crítico Consistente II', target: 15, desc: 'Registre 15 resenhas ou avaliações no acervo.' },
      { id: 'arquivista', name: 'Crítico Literário Titular', target: 30, desc: 'Acumule 30 obras avaliadas criticamente.' },
    ],
    measure: (stats) => stats.reviewedWorksCount,
  },
  // Constância / Dias seguidos
  {
    prefix: 'streak',
    category: 'library',
    iconName: 'Flame',
    tiers: [
      { id: 'iniciante', name: 'Fôlego de Leitor', target: 3, desc: 'Alcance 3 dias consecutivos de leitura.' },
      { id: 'veterano', name: 'Hábito Semanal', target: 7, desc: 'Alcance 7 dias consecutivos de leitura.' },
      { id: 'mestre', name: 'Disciplina de Ferro', target: 21, desc: 'Sustente 21 dias seguidos de leitura.' },
      { id: 'arquivista', name: 'Guardião da Constância', target: 60, desc: 'Mantenha 60 dias de sequência ativa.' },
    ],
    measure: (stats) => stats.streakCount,
  },
  // Páginas lidas
  {
    prefix: 'pages',
    category: 'library',
    iconName: 'BookOpen',
    tiers: [
      { id: 'iniciante', name: 'Primeiras Quinhentas', target: 500, desc: 'Leia 500 páginas acumuladas.' },
      { id: 'veterano', name: 'Devora-Capítulos', target: 2500, desc: 'Alcance 2.500 páginas lidas no acervo.' },
      { id: 'mestre', name: 'Maratonista de Páginas', target: 10000, desc: 'Ultrapasse 10.000 páginas lidas.' },
      { id: 'arquivista', name: 'Lendário das Letras', target: 25000, desc: 'Supere 25.000 páginas lidas acumuladas.' },
    ],
    measure: (stats) => stats.totalPagesRead,
  },
  // Bilíngue
  {
    prefix: 'bilingual',
    category: 'library',
    iconName: 'Languages',
    tiers: [
      { id: 'iniciante', name: 'Leitor Bilíngue', target: 1, desc: 'Tenha ao menos 1 obra com título original distinto catalogado.' },
      { id: 'veterano', name: 'Poliglota do Acervo', target: 5, desc: 'Mantenha 5 obras com catalogação bilíngue PT-BR/Original.' },
      { id: 'mestre', name: 'Tradutor de Horizontes', target: 15, desc: 'Catalogue 15 obras com edição ou título original preservado.' },
    ],
    measure: (stats) => stats.bilingualCount,
  },
  // Social: Mural, Chat, Diário
  {
    prefix: 'wall',
    category: 'library',
    iconName: 'MessageSquare',
    tiers: [
      { id: 'iniciante', name: 'Porta Aberta', target: 1, desc: 'Interaja com 1 recado no mural de leitores.' },
      { id: 'veterano', name: 'Anfitrião de Mural', target: 5, desc: 'Acumule 5 recados no mural literário.' },
      { id: 'mestre', name: 'Salão Literário', target: 15, desc: 'Acumule 15 trocas no mural.' },
    ],
    measure: (stats) => stats.wallPostsCount,
  },
  {
    prefix: 'chat',
    category: 'library',
    iconName: 'MessagesSquare',
    tiers: [
      { id: 'iniciante', name: 'Primeiro Contato', target: 1, desc: 'Envie sua primeira mensagem ou recomendação no chat 1:1.' },
      { id: 'veterano', name: 'Curador de Chat', target: 5, desc: 'Compartilhe 5 mensagens ou recomendações no chat.' },
      { id: 'mestre', name: 'Conselheiro Literário', target: 20, desc: 'Acumule 20 interações no chat entre leitores.' },
    ],
    measure: (stats) => stats.chatMessagesCount,
  },
  {
    prefix: 'journal',
    category: 'library',
    iconName: 'Camera',
    tiers: [
      { id: 'iniciante', name: 'Diário Inaugural', target: 1, desc: 'Registre sua primeira nota no Diário de Leitura.' },
      { id: 'veterano', name: 'Cronista Social', target: 5, desc: 'Publique 5 registros no Diário.' },
      { id: 'mestre', name: 'Memorialista', target: 15, desc: 'Publique 15 entradas no Diário.' },
    ],
    measure: (stats) => stats.postsCount,
  },
  // Leitura Digital & Noturna
  {
    prefix: 'owl',
    category: 'library',
    iconName: 'Moon',
    tiers: [
      { id: 'iniciante', name: 'Vigília Literária', target: 1, desc: 'Registre 1 sessão de leitura após 23h00 ou antes de 05h00.' },
      { id: 'veterano', name: 'Coruja da Madrugada', target: 5, desc: 'Registre 5 sessões noturnas após as 23h00.' },
      { id: 'mestre', name: 'Insone dos Livros', target: 15, desc: 'Complete 15 leituras pela madrugada.' },
    ],
    measure: (stats) => stats.lateNightSessionsCount,
  },
  {
    prefix: 'eink',
    category: 'library',
    iconName: 'Tablet',
    tiers: [
      { id: 'iniciante', name: 'Leitor Digital', target: 1, desc: 'Leia por %, Posição Kindle Loc ou arquivo offline.' },
      { id: 'veterano', name: 'Viajante E-Ink', target: 5, desc: 'Utilize progresso flexível ou estante offline em 5 obras.' },
      { id: 'mestre', name: 'Nômade dos EPUBs', target: 15, desc: 'Mantenha 15 leituras digitais integradas ao Códice.' },
    ],
    measure: (stats) => stats.digitalOrFlexibleCount,
  },
  // Editoras Brasileiras & Acesso Aberto
  {
    prefix: 'brpub',
    category: 'library',
    iconName: 'Building2',
    tiers: [
      { id: 'veterano', name: 'Apoiador Nacional', target: 5, desc: 'Catalogue 5 obras de editoras brasileiras.' },
      { id: 'mestre', name: 'Colecionador Nacional', target: 15, desc: 'Catalogue 15 obras com editoras brasileiras normalizadas.' },
    ],
    measure: (stats) => stats.brPublisherCount,
  },
  {
    prefix: 'openaccess',
    category: 'library',
    iconName: 'Globe',
    tiers: [
      { id: 'veterano', name: 'Explorador Open Access', target: 3, desc: 'Catalogue 3 obras em domínio público ou acesso aberto.' },
    ],
    measure: (stats) => stats.openAccessCount,
  },
].map((group) => ({
  ...group,
  tiers: group.tiers.map((tier) => ({
    ...tier,
    id: `${group.prefix}_${tier.id}`,
    evaluate: (stats) => {
      const progress = Math.max(0, Number(group.measure(stats, tier)) || 0);
      const target = Math.max(1, Number(tier.target) || 1);
      return {
        earned: progress >= target,
        progress,
        target,
      };
    },
  })),
}));

const MILESTONE_TITLES = BADGE_RULES.flatMap((group) =>
  group.tiers.map((tier) => ({
    id: tier.id,
    name: tier.name,
    category: group.category,
    tier: tier.id.split('_').pop(),
    iconName: group.iconName,
    description: tier.desc,
    evaluate: (stats) => {
      const res = tier.evaluate(stats);
      return {
        earned: Boolean(res.earned),
        progress: res.progress,
        target: res.target,
        current: res.progress,
        unlocked: Boolean(res.earned),
      };
    },
  }))
);

function buildLivingBadgeEntries() {
  return LIVING_TITLE_SPECS.map((spec) => ({
    id: spec.id,
    name: spec.name,
    category: 'living',
    tier: 'dinâmico',
    iconName: spec.iconName,
    description: spec.description,
    evaluate: (ctx) => {
      const matched = ctx.activeReadingItems.some(spec.match);
      return {
        current: matched ? 1 : 0,
        target: 1,
        unlocked: matched,
      };
    },
  }));
}

export const READER_TITLES_CATALOG = [
  ...buildLivingBadgeEntries(),
  ...GENRE_TITLES,
  ...MILESTONE_TITLES,
];

function isLateNightIso(iso) {
  if (!iso) return false;
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return false;
  const hour = dt.getHours();
  return hour >= 23 || hour < 5;
}

export function detectLivingReaderTitle(activeReadingItems = []) {
  const list = Array.isArray(activeReadingItems) ? activeReadingItems : [];
  if (list.length === 0) return null;

  // Prioriza o item em leitura atualizado mais recentemente
  const sorted = [...list].sort((a, b) => {
    const tB = Date.parse(b.updatedAt || b.createdAt || '') || 0;
    const tA = Date.parse(a.updatedAt || a.createdAt || '') || 0;
    return tB - tA;
  });

  // 1a passada: checa o item mais recente contra especificacoes de estudo/CDD primeiro, depois ficcao
  const orderedSpecs = [
    ...LIVING_TITLE_SPECS.filter((s) => s.studyPriority),
    ...LIVING_TITLE_SPECS.filter((s) => !s.studyPriority),
  ];

  for (const activeItem of sorted) {
    const matched = orderedSpecs.find((spec) => spec.match(activeItem));
    if (matched) {
      return {
        id: matched.id,
        name: matched.name,
        category: 'living',
        tier: 'dinâmico',
        iconName: matched.iconName,
        description: matched.description,
        sourceWorkTitle: activeItem.title || '',
        unlocked: true,
        current: 1,
        target: 1,
        progressPct: 100,
      };
    }
  }

  return {
    id: 'living_leitor_ativo',
    name: 'Leitor em Jornada Ativa',
    category: 'living',
    tier: 'dinâmico',
    iconName: 'BookOpen',
    description: 'Ativo enquanto há leituras em andamento no seu acervo.',
    sourceWorkTitle: sorted[0]?.title || '',
    unlocked: true,
    current: 1,
    target: 1,
    progressPct: 100,
  };
}

export function buildReaderUsageStats({
  items = [],
  readingSessions = [],
  streakCount = 0,
  posts = [],
  wallPostsCount = 0,
  chatMessagesCount = 0,
  storedReaderBooksCount = 0,
  nowDate = new Date(),
} = {}) {
  const backlogItems = (Array.isArray(items) ? items : []).filter(
    (i) => i && i.inBacklog !== false
  );
  const activeReadingItems = backlogItems.filter(
    (i) => i.status === 'playing' || i.status === 'reading'
  );
  const sessions = Array.isArray(readingSessions) ? readingSessions : [];

  const totalQuotesCount = backlogItems.reduce(
    (sum, i) => sum + (Array.isArray(i.quotes) ? i.quotes.length : 0),
    0
  );
  const reviewedWorksCount = backlogItems.filter(
    (i) =>
      typeof i.rating === 'number' ||
      (typeof i.notes === 'string' && i.notes.trim().length > 0)
  ).length;
  const itemPagesRead = backlogItems.reduce((sum, i) => {
    if (i.status === 'completed') {
      return sum + Math.max(0, Number(i.totalPages) || Number(i.currentPage) || 0);
    }
    if (i.status === 'playing' || i.status === 'reading') {
      return sum + Math.max(0, Number(i.currentPage) || 0);
    }
    return sum;
  }, 0);
  const sessionPagesRead = sessions.reduce(
    (sum, s) => sum + Math.max(0, Number(s?.pagesRead) || 0),
    0
  );
  const totalPagesRead = Math.max(itemPagesRead, sessionPagesRead);
  const completedSessionsCount = sessions.filter(
    (s) =>
      s &&
      (Boolean(s.endedAt) ||
        Number(s.durationSeconds) > 0 ||
        Number(s.pagesRead) > 0)
  ).length;

  const computedSessionDays = computeConsecutiveReadingDays(sessions, nowDate);
  const effectiveStreak = Math.max(
    Math.max(0, Number(streakCount) || 0),
    computedSessionDays
  );

  const bilingualCount = backlogItems.filter(
    (i) =>
      Boolean(i.originalTitle) &&
      norm(i.originalTitle) !== norm(i.title)
  ).length;
  const lateNightSessionsCount = sessions.filter((s) =>
    isLateNightIso(s?.startedAt || s?.endedAt || s?.createdAt)
  ).length;
  const flexibleWorksCount = backlogItems.filter(
    (i) => i.progressMode === 'percent' || i.progressMode === 'loc'
  ).length;
  const digitalOrFlexibleCount = Math.max(
    flexibleWorksCount,
    Number(storedReaderBooksCount) || 0
  );
  const brPublisherCount = backlogItems.filter((i) => {
    const raw = String(i.publisher || '').trim();
    if (!raw) return false;
    return Boolean(normalizePublisherName(raw));
  }).length;
  const openAccessCount = backlogItems.filter(
    (i) => Boolean(i.openAccessUrl || i.freeEpubUrl || i.isPublicDomain)
  ).length;
  const classifiedWorksCount = backlogItems.filter((i) =>
    Boolean(i.cdu_cdd && i.cutter)
  ).length;

  return {
    backlogItems,
    activeReadingItems,
    catalogedWorksCount: backlogItems.length,
    classifiedWorksCount,
    completedSessionsCount,
    totalQuotesCount,
    reviewedWorksCount,
    streakCount: effectiveStreak,
    totalPagesRead,
    bilingualCount,
    wallPostsCount: Math.max(0, Number(wallPostsCount) || 0),
    chatMessagesCount: Math.max(0, Number(chatMessagesCount) || 0),
    postsCount: Array.isArray(posts) ? posts.length : 0,
    lateNightSessionsCount,
    digitalOrFlexibleCount,
    brPublisherCount,
    openAccessCount,
  };
}

export function canPinTitleBadge(badgeOrId, catalog = []) {
  if (!badgeOrId || badgeOrId === 'auto') return true;
  const targetId = typeof badgeOrId === 'object' ? badgeOrId.id : badgeOrId;
  const targetName = typeof badgeOrId === 'object' ? badgeOrId.name : badgeOrId;
  if (Array.isArray(catalog) && catalog.length > 0) {
    const match = catalog.find(
      (b) => b.id === targetId || b.name === targetName
    );
    return Boolean(match && match.unlocked);
  }
  return typeof badgeOrId === 'object' ? Boolean(badgeOrId.unlocked) : false;
}

export function pinTitleBadge(profile, badgeOrId, catalog = []) {
  if (!badgeOrId || badgeOrId === 'auto') {
    return { allowed: true, activeTitleBadge: 'auto', reason: '' };
  }
  const targetId = typeof badgeOrId === 'object' ? badgeOrId.id : badgeOrId;
  const targetName = typeof badgeOrId === 'object' ? badgeOrId.name : badgeOrId;
  const match = Array.isArray(catalog)
    ? catalog.find((b) => b.id === targetId || b.name === targetName)
    : null;

  if (!match || !match.unlocked) {
    return {
      allowed: false,
      activeTitleBadge: profile?.activeTitleBadge || 'auto',
      reason: 'Conquiste esta insígnia antes de fixá-la no perfil.',
    };
  }
  return {
    allowed: true,
    activeTitleBadge: match.name,
    reason: '',
  };
}

export function evaluateReaderTitles({
  items = [],
  profile = null,
  readingSessions = [],
  streakCount = 0,
  posts = [],
  wallPostsCount = 0,
  chatMessagesCount = 0,
  storedReaderBooksCount = 0,
  nowDate = new Date(),
} = {}) {
  const stats = buildReaderUsageStats({
    items,
    readingSessions,
    streakCount,
    posts,
    wallPostsCount,
    chatMessagesCount,
    storedReaderBooksCount,
    nowDate,
  });

  const catalog = READER_TITLES_CATALOG.map((entry) => {
    const evalRes = entry.evaluate(stats);
    const target = Math.max(0, Number(evalRes.target) || 1);
    const current = Math.max(0, Number(evalRes.progress ?? evalRes.current) || 0);
    const earned = Boolean(evalRes.earned ?? evalRes.unlocked);
    const progressPct = computeSafeBadgeProgress(current, target);
    return {
      id: entry.id,
      name: entry.name,
      category: entry.category,
      tier: entry.tier,
      iconName: entry.iconName,
      description: entry.description,
      current,
      progress: current,
      target,
      earned,
      unlocked: earned,
      progressPct,
    };
  });

  const unlockedList = catalog.filter((b) => b.unlocked);
  const livingTitle = detectLivingReaderTitle(stats.activeReadingItems);

  const pinnedRaw = String(profile?.activeTitleBadge || '').trim();
  const hasSavedPin = Boolean(pinnedRaw && pinnedRaw !== 'auto');
  const matchedPin = hasSavedPin
    ? catalog.find((b) => b.id === pinnedRaw || b.name === pinnedRaw) || null
    : null;

  // Se uma insígnia ativa salva (dado antigo) estiver bloqueada ou inválida, limpa a seleção
  const isPinnedValid = Boolean(matchedPin && matchedPin.unlocked);
  const stalePinnedCleared = hasSavedPin && !isPinnedValid;
  const isAutoMode = !hasSavedPin || stalePinnedCleared;
  const pinnedMatch = isPinnedValid ? matchedPin : null;

  const fallbackBadge =
    unlockedList[unlockedList.length - 1] || {
      id: 'default_iniciado',
      name: 'Leitor do Códice',
      category: 'library',
      tier: 'iniciante',
      iconName: 'BookOpen',
      description: 'Inicie uma leitura para desbloquear títulos dinâmicos.',
      unlocked: true,
      earned: true,
      current: 1,
      progress: 1,
      target: 1,
      progressPct: 100,
    };

  const resolvedActiveBadge = pinnedMatch || livingTitle || fallbackBadge;

  return {
    stats,
    catalog,
    unlockedCount: unlockedList.length,
    totalCount: catalog.length,
    livingTitle,
    resolvedActiveBadge,
    isAutoMode,
    stalePinnedCleared,
    sanitizedActiveTitleBadge: isAutoMode ? 'auto' : pinnedMatch.name,
  };
}
