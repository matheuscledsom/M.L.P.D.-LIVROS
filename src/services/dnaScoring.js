export const DNA_DIMENSIONS = [
  {
    id: 'plotPace',
    label: 'Enredo & Ritmo',
    description: 'Preferência por narrativas dinâmicas, conflito contínuo e fluidez.',
    keywords: /aventura|acao|fantasia|suspense|thriller|ritmo|epico|shonen|seinen/,
  },
  {
    id: 'charactersPsychology',
    label: 'Personagens & Psicologia',
    description: 'Foco em desenvolvimento humano, drama íntimo e conflitos internos.',
    keywords: /psicolog|drama|romance|biografia|classico|personagens|slice of life|josei/,
  },
  {
    id: 'writingStyle',
    label: 'Escrita & Estilo',
    description: 'Valorização de prosa literária, voz autoral e riqueza formal.',
    keywords: /poesia|literatura|classico|cronica|ensaio|gotico|linguagem/,
  },
  {
    id: 'worldbuildingAtmosphere',
    label: 'Worldbuilding & Atmosfera',
    description: 'Ambientação imersiva, sistemas de universo e clima sensorial.',
    keywords: /fantasia|ficcao cientifica|distopia|sombrio|gotico|historico|epico|isekai/,
  },
  {
    id: 'impactKnowledge',
    label: 'Impacto & Conhecimento',
    description: 'Aprendizado, ideias transformadoras e síntese cultural.',
    keywords: /filosofia|historia|sociologia|nao ficcao|autoajuda|educacao|ciencia|economia/,
  },
  {
    id: 'tensionTwists',
    label: 'Tensão & Reviravoltas',
    description: 'Mistério, suspense investigativo e viradas estruturais.',
    keywords: /suspense|misterio|policial|crime|thriller|terror|horror/,
  },
  {
    id: 'artLayout',
    label: 'Arte & Diagramação',
    description: 'Traço visual, quadros, fotografia editorial e projeto gráfico.',
    keywords: /manga|quadrinho|hq|comic|arte|ilustrad|webtoon|graphic novel/,
  },
  {
    id: 'rigorSources',
    label: 'Rigor & Fontes',
    description: 'Base documental, bibliografia técnica e pesquisa acadêmica.',
    keywords: /academ|pesquisa|tecnolog|engenharia|direito|medicina|computacao|tcc|monografia/,
  },
];

export const DNA_PACING_OPTIONS = [
  { id: 'equilibrado', label: 'Equilibrado' },
  { id: 'fluido', label: 'Leve & Fluido' },
  { id: 'denso', label: 'Denso & Contemplativo' },
  { id: 'frenetico', label: 'Ágil & Frenético' },
];

export const DNA_DENSITY_OPTIONS = [
  { id: 'qualquer', label: 'Qualquer extensão' },
  { id: 'curta', label: 'Curtas (< 220 págs)' },
  { id: 'media', label: 'Médias (220–450 págs)' },
  { id: 'calhamaco', label: 'Longas (450+ págs)' },
];

export const DNA_EXCLUSION_PRESETS = [
  'Violência extrema',
  'Terror gráfico',
  'Gore explícito',
  'Conteúdo adulto explícito',
  'Autoextermínio',
];

function normalizeToken(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function createDefaultReaderDna() {
  const weights = {};
  for (const dim of DNA_DIMENSIONS) {
    weights[dim.id] = 50;
  }
  return {
    weights,
    pacingPreference: 'equilibrado',
    densityPreference: 'qualquer',
    exclusions: [],
  };
}

export function normalizeReaderDna(raw) {
  const defaults = createDefaultReaderDna();
  if (!raw || typeof raw !== 'object') return defaults;

  const sourceWeights = raw.weights && typeof raw.weights === 'object' ? raw.weights : raw;
  const weights = {};
  for (const dim of DNA_DIMENSIONS) {
    const val = Number(sourceWeights[dim.id]);
    weights[dim.id] = Number.isFinite(val)
      ? Math.max(0, Math.min(100, Math.round(val)))
      : defaults.weights[dim.id];
  }

  const pacingPreference = DNA_PACING_OPTIONS.some((o) => o.id === raw.pacingPreference)
    ? raw.pacingPreference
    : defaults.pacingPreference;

  const densityPreference = DNA_DENSITY_OPTIONS.some((o) => o.id === raw.densityPreference)
    ? raw.densityPreference
    : defaults.densityPreference;

  const exclusions = Array.isArray(raw.exclusions)
    ? Array.from(
        new Set(
          raw.exclusions
            .map((entry) => String(entry || '').trim().slice(0, 48))
            .filter(Boolean)
        )
      ).slice(0, 24)
    : [];

  return {
    weights,
    pacingPreference,
    densityPreference,
    exclusions,
  };
}

export function evaluateCandidateExclusion(item, dnaInput) {
  if (!item) return false;
  const dna = normalizeReaderDna(dnaInput);
  if (dna.exclusions.length === 0) return false;

  const haystack = normalizeToken(
    [
      item.title,
      item.originalTitle,
      item.synopsis,
      item.notes,
      ...(Array.isArray(item.genres) ? item.genres : []),
      ...(Array.isArray(item.tropes) ? item.tropes : []),
      ...(Array.isArray(item.atmosphere) ? item.atmosphere : []),
      ...(Array.isArray(item.contentWarnings) ? item.contentWarnings : []),
    ]
      .filter(Boolean)
      .join(' ')
  );

  if (!haystack) return false;

  return dna.exclusions.some((term) => {
    const clean = normalizeToken(term);
    if (clean.length < 3) return false;
    if (haystack.includes(clean)) return true;
    const significantWords = clean.split(' ').filter((w) => w.length >= 4);
    return (
      significantWords.length >= 2 &&
      significantWords.every((word) => haystack.includes(word))
    );
  });
}

export function computeDnaWeightedScore(item, dnaInput) {
  const dna = normalizeReaderDna(dnaInput);
  if (!item) {
    return { excluded: false, bonus: 0, matchedDimensions: [], topDimensionLabel: '' };
  }

  if (evaluateCandidateExclusion(item, dna)) {
    return { excluded: true, bonus: -999, matchedDimensions: [], topDimensionLabel: '' };
  }

  const totalWeight = DNA_DIMENSIONS.reduce(
    (sum, dim) => sum + (dna.weights[dim.id] ?? 0),
    0
  );

  if (totalWeight <= 0) {
    return { excluded: false, bonus: 0, matchedDimensions: [], topDimensionLabel: '' };
  }

  const fullText = normalizeToken(
    [
      item.title,
      item.originalTitle,
      item.workType,
      item.format,
      item.synopsis,
      ...(Array.isArray(item.genres) ? item.genres : []),
      ...(Array.isArray(item.tropes) ? item.tropes : []),
      ...(Array.isArray(item.atmosphere) ? item.atmosphere : []),
    ]
      .filter(Boolean)
      .join(' ')
  );

  let weightedMatch = 0;
  let topDimensionLabel = '';
  let topDimScore = 0;
  const matchedDimensions = [];

  for (const dim of DNA_DIMENSIONS) {
    const weight = dna.weights[dim.id] ?? 50;
    if (weight <= 0) continue;

    let match = dim.keywords.test(fullText) ? 1 : 0;
    if (!match && dim.id === 'artLayout' && (item.workType === 'manga' || item.workType === 'comic')) {
      match = 1;
    }
    if (!match && dim.id === 'rigorSources' && item.workType === 'academic') {
      match = 1;
    }

    if (match > 0) {
      weightedMatch += weight;
      matchedDimensions.push(dim.id);
      if (weight > topDimScore) {
        topDimScore = weight;
        topDimensionLabel = dim.label;
      }
    }
  }

  let bonus = Math.round((weightedMatch / totalWeight) * 26);

  const pages = Number(item.totalPages) || Number(item.currentPage) || 0;
  if (pages > 0) {
    if (dna.densityPreference === 'curta' && pages <= 220) bonus += 6;
    else if (dna.densityPreference === 'media' && pages > 220 && pages <= 450) bonus += 6;
    else if (dna.densityPreference === 'calhamaco' && pages > 450) bonus += 6;
    else if (dna.densityPreference === 'curta' && pages > 550) bonus -= 4;
  }

  if (dna.pacingPreference === 'fluido' && /leve|conto|humor|cronica|novela/.test(fullText)) {
    bonus += 5;
  } else if (dna.pacingPreference === 'frenetico' && /acao|suspense|thriller|ritmo|aventura/.test(fullText)) {
    bonus += 5;
  } else if (dna.pacingPreference === 'denso' && /filosofia|classico|historia|ensaio|academ/.test(fullText)) {
    bonus += 5;
  }

  return {
    excluded: false,
    bonus,
    matchedDimensions,
    topDimensionLabel: topDimScore >= 60 ? topDimensionLabel : '',
  };
}
