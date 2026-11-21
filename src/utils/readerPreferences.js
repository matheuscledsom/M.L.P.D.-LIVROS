export const FOCUS_OPTIONS_META = [
  { id: 'Leitor Casual', iconName: 'BookOpen' },
  { id: 'Leitor Voraz', iconName: 'Flame' },
  { id: 'Bibliotecário / Colecionador', iconName: 'Library' },
  { id: 'Mangás, Manhwas & Light Novels', iconName: 'Layers' },
  { id: 'Pesquisador / Acadêmico TCC', iconName: 'GraduationCap' },
];

export const CRITERION_OPTIONS = [
  'Enredo e Ritmo',
  'Personagens e Profundidade',
  'Escrita e Imersão',
  'Impacto e Conhecimento',
];

export const GENRE_OPTIONS = [
  'Fantasia Épica',
  'Ficção Científica',
  'Suspense e Thriller',
  'Terror e Gótico',
  'Romance',
  'Clássicos',
  'Filosofia',
  'História',
  'Psicologia',
  'Tecnologia e Computação',
  'Acadêmico e TCC',
  'Mangá (Shonen / Seinen)',
  'Manhwa / Webtoon',
  'Light Novel',
  'HQ / Graphic Novel',
  'Biografias',
  'Poesia',
  'Não-Ficção',
];

export const DEFAULT_PREFERRED_CRITERIA = ['Enredo e Ritmo'];

function parseCriteriaRaw(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // Segue como string simples
      }
    }
    if (trimmed.includes(',') || trimmed.includes(';')) {
      return trimmed
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [trimmed];
  }
  return [];
}

/**
 * Normaliza preferredCriteria (array) mantendo retrocompatibilidade
 * com perfis antigos que salvavam string simples em preferredCriteria ou preferredCriterion.
 */
export function normalizePreferredCriteria(
  rawCriteria,
  legacyCriterion,
  fallback = DEFAULT_PREFERRED_CRITERIA
) {
  const source =
    rawCriteria !== undefined && rawCriteria !== null && rawCriteria !== ''
      ? rawCriteria
      : legacyCriterion;

  const list = parseCriteriaRaw(source)
    .map((item) => String(item || '').trim())
    .filter(Boolean);

  const unique = Array.from(new Set(list));
  if (unique.length > 0) return unique;
  return Array.isArray(fallback) ? [...fallback] : [...DEFAULT_PREFERRED_CRITERIA];
}

export function normalizeFavoriteGenres(rawGenres) {
  if (!Array.isArray(rawGenres)) {
    if (typeof rawGenres === 'string' && rawGenres.trim()) {
      return Array.from(
        new Set(
          rawGenres
            .split(/[,;]/)
            .map((g) => g.trim())
            .filter(Boolean)
        )
      );
    }
    return [];
  }
  return Array.from(
    new Set(rawGenres.map((g) => String(g || '').trim()).filter(Boolean))
  );
}

export function toggleCriterionInList(currentList, criterion) {
  const list = normalizePreferredCriteria(currentList, null, DEFAULT_PREFERRED_CRITERIA);
  const clean = String(criterion || '').trim();
  if (!clean) return list;
  if (list.includes(clean)) {
    return list.length > 1 ? list.filter((c) => c !== clean) : list;
  }
  return [...list, clean];
}

export function formatPreferredCriteriaText(profile) {
  const criteria = normalizePreferredCriteria(
    profile?.preferredCriteria ?? profile?.preferred_criteria,
    profile?.preferredCriterion ?? profile?.preferred_criterion
  );
  return criteria.join(', ');
}
