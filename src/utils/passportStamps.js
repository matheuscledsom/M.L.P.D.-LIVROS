import { getPagesRead } from './backlogHelpers.js';

export function computePassportStamps({
  items = [],
  posts = [],
  streakCount = 0,
} = {}) {
  const safeItems = (Array.isArray(items) ? items : []).filter(
    (i) => i && i.inBacklog !== false
  );
  const completed = safeItems.filter((i) => i.status === 'completed');
  const totalQuotes = safeItems.reduce(
    (sum, i) => sum + (Array.isArray(i.quotes) ? i.quotes.length : 0),
    0
  );
  const distinctGenres = new Set();
  completed.forEach((i) => {
    if (Array.isArray(i.genres)) {
      i.genres.forEach((g) => {
        const clean = String(g || '').trim().toLowerCase();
        if (clean) distinctGenres.add(clean);
      });
    }
  });
  const totalPages = safeItems.reduce((sum, i) => sum + getPagesRead(i), 0);

  return [
    {
      id: 'first-codex',
      code: 'COD-01',
      title: 'Primeiro Códice',
      requirement: 'Catalogar ou iniciar 1 obra',
      unlocked: safeItems.length >= 1,
      progressLabel: `${Math.min(1, safeItems.length)}/1`,
    },
    {
      id: 'bronze-shelf',
      code: 'EST-05',
      title: 'Estante de Bronze',
      requirement: 'Concluir 5 leituras',
      unlocked: completed.length >= 5,
      progressLabel: `${Math.min(5, completed.length)}/5`,
    },
    {
      id: 'silver-archive',
      code: 'ARQ-15',
      title: 'Acervo de Prata',
      requirement: 'Concluir 15 leituras',
      unlocked: completed.length >= 15,
      progressLabel: `${Math.min(15, completed.length)}/15`,
    },
    {
      id: 'genre-traveler',
      code: 'GEN-04',
      title: 'Viajante de Gêneros',
      requirement: 'Concluir 4 gêneros diferentes',
      unlocked: distinctGenres.size >= 4,
      progressLabel: `${Math.min(4, distinctGenres.size)}/4`,
    },
    {
      id: 'scribe-ink',
      code: 'ESC-03',
      title: 'Escriba Ativo',
      requirement: 'Registrar 3 citações ou notas',
      unlocked: totalQuotes + (Array.isArray(posts) ? posts.length : 0) >= 3,
      progressLabel: `${Math.min(3, totalQuotes + (Array.isArray(posts) ? posts.length : 0))}/3`,
    },
    {
      id: 'alexandria-1000',
      code: 'PG-1K',
      title: 'Mil Páginas Lidas',
      requirement: 'Alcançar 1.000 páginas lidas ou 7 dias de constância',
      unlocked: totalPages >= 1000 || streakCount >= 7,
      progressLabel: totalPages >= 1000 ? '1.000+p' : `${streakCount}d`,
    },
  ];
}
