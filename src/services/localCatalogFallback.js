import { domainConfig } from '../config/domainConfig.js';
import { normalizePublisherName } from '../data/brazilianPublishers.js';
import { suggestLibraryClassification } from '../utils/catalogingClassification.js';
import { searchMedia, searchMockMedia } from './mediaApi.js';

function normAscii(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function inferLocalAtmospheres(item, genres = []) {
  const allowed = domainConfig.atmosphereOptions.map((a) => a.id);
  const blob = normAscii(
    [item?.title, item?.synopsis, item?.notes, ...genres, ...(item?.tropes || [])].join(' ')
  );
  const picked = [];

  if (
    item?.workType === 'academic' ||
    /\b(computacao|algoritmo|codigo|direito|metodologia|ciencia|tecnica|engenharia)\b/.test(blob)
  ) {
    picked.push('Técnico');
  }
  if (/\b(terror|horror|sombrio|gotico|distopia|crime|thriller|seinen)\b/.test(blob)) {
    picked.push('Sombrio');
  }
  if (/\b(fantasia|epico|aventura|shonen|odisseia|saga)\b/.test(blob)) {
    picked.push('Épico');
  }
  if (/\b(filosofia|psicologia|classico|ensaio|literatura|poesia|biografia)\b/.test(blob)) {
    picked.push('Reflexivo');
  }
  if (/\b(romance|drama|familia|emocao)\b/.test(blob)) {
    picked.push('Emocionante');
  }
  if (/\b(humor|cotidiano|crônica|cronica|contos|leve)\b/.test(blob)) {
    picked.push('Leve');
  }

  if (picked.length === 0) {
    picked.push(item?.workType === 'academic' ? 'Técnico' : 'Reflexivo');
  }

  return Array.from(new Set(picked))
    .filter((id) => allowed.includes(id))
    .slice(0, 3);
}

function formatAbntAuthor(rawAuthor) {
  const first = String(rawAuthor || '')
    .split(/[;,]/)[0]
    .trim();
  if (!first) return 'AUTOR DESCONHECIDO';
  const parts = first.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return first.toUpperCase();
  const last = parts.pop().toUpperCase();
  return `${last}, ${parts.join(' ')}`;
}

function buildAbntReference(item) {
  const author = formatAbntAuthor(item?.author);
  const title = String(item?.title || 'Obra sem título').trim();
  const place = String(item?.publicationPlace || '').trim();
  const publisher = normalizePublisherName(
    item?.publisher || item?.institution || ''
  );
  const year = item?.releaseYear || 's.d.';
  const pubPart = [place, publisher].filter(Boolean).join(': ') || 's.n.';
  const doiPart = item?.doi ? ` DOI: ${item.doi}.` : '';
  return `${author}. **${title}**. ${pubPart}, ${year}.${doiPart}`;
}

export async function runLocalSmartCataloging(
  item,
  { signal, queryRemote = true } = {}
) {
  const baseTitle = String(item?.title || '').trim();
  if (!baseTitle && !item?.isbn && !item?.doi) {
    throw new Error('Informe ao menos o título da obra para catalogar.');
  }

  let catalogMatch = null;
  const searchKey = item?.doi || item?.isbn || baseTitle;
  const mockMatches = searchMockMedia(searchKey, item?.workType || 'all');
  if (mockMatches.length > 0) {
    const targetNorm = normAscii(baseTitle);
    catalogMatch =
      mockMatches.find((m) => normAscii(m.title) === targetNorm) || mockMatches[0];
  }

  if (!catalogMatch && queryRemote && searchKey) {
    try {
      const quickSource =
        item?.workType === 'manga'
          ? ['jikan']
          : item?.workType === 'academic'
            ? ['academic']
            : ['googleBooks'];
      const searchRes = await searchMedia(searchKey, {
        signal,
        filter: item?.workType || 'all',
        sources: quickSource,
      });
      if (Array.isArray(searchRes?.results) && searchRes.results.length > 0) {
        const targetNorm = normAscii(baseTitle);
        catalogMatch =
          searchRes.results.find((m) => normAscii(m.title) === targetNorm) ||
          searchRes.results[0];
      }
    } catch {
      // Sigue apenas com metadados locais + CDD/Cutter
    }
  }

  const mergedAuthor = item?.author || catalogMatch?.author || '';
  const mergedPublisher = normalizePublisherName(
    item?.publisher || catalogMatch?.publisher || ''
  );
  const existingGenres = Array.isArray(item?.genres) ? item.genres : [];
  const candidateGenres =
    existingGenres.length > 0
      ? existingGenres
      : Array.isArray(catalogMatch?.genres)
        ? catalogMatch.genres
        : [];

  const classification = suggestLibraryClassification({
    ...item,
    title: baseTitle || catalogMatch?.title || '',
    author: mergedAuthor,
    synopsis: item?.synopsis || catalogMatch?.synopsis || '',
    keywords: item?.keywords || catalogMatch?.keywords || '',
    genres: candidateGenres,
    subgenres: Array.isArray(item?.subgenres) ? item.subgenres : [],
  });

  const resolvedGenres = Array.from(
    new Set([
      ...existingGenres,
      ...candidateGenres,
      ...(classification.primaryGenre ? [classification.primaryGenre] : []),
      ...(classification.subgenre ? [classification.subgenre] : []),
    ])
  )
    .filter(Boolean)
    .slice(0, 4);

  const existingSubgenres = Array.isArray(item?.subgenres)
    ? item.subgenres.filter(Boolean)
    : [];
  const resolvedSubgenres = Array.from(
    new Set([...existingSubgenres, ...(classification.subgenres || [])])
  ).slice(0, 4);

  const existingTags = Array.isArray(item?.tropes)
    ? item.tropes.filter(Boolean)
    : [];
  const resolvedTags = Array.from(
    new Set([...existingTags, ...(classification.suggestedTags || [])])
  ).slice(0, 6);

  const updates = {
    cdu_cdd: item?.cdu_cdd || classification.cdu_cdd,
    cutter: item?.cutter || classification.cutter,
    callNumber: item?.callNumber || classification.callNumber,
    primaryGenre:
      item?.primaryGenre || resolvedGenres[0] || classification.primaryGenre,
    subgenres: resolvedSubgenres,
    genres: resolvedGenres,
    tropes: resolvedTags,
    atmosphere:
      Array.isArray(item?.atmosphere) && item.atmosphere.length > 0
        ? item.atmosphere
        : inferLocalAtmospheres(item, resolvedGenres),
  };

  if (mergedAuthor && !item?.author) updates.author = mergedAuthor;
  if (mergedPublisher && mergedPublisher !== item?.publisher) {
    updates.publisher = mergedPublisher;
  }
  if (catalogMatch?.isbn && !item?.isbn) updates.isbn = catalogMatch.isbn;
  if (catalogMatch?.doi && !item?.doi) updates.doi = catalogMatch.doi;
  if (catalogMatch?.totalPages && !item?.totalPages) {
    updates.totalPages = catalogMatch.totalPages;
  }
  if (catalogMatch?.releaseYear && !item?.releaseYear) {
    updates.releaseYear = catalogMatch.releaseYear;
  }
  if (catalogMatch?.originalTitle && !item?.originalTitle) {
    updates.originalTitle = catalogMatch.originalTitle;
  }

  if (!String(item?.synopsis || '').trim()) {
    const contextDesc = [
      mergedAuthor ? `Obra de ${mergedAuthor}` : 'Obra catalogada no acervo',
      mergedPublisher ? `publicada por ${mergedPublisher}` : '',
      classification.cddLabel ? `classificada em ${classification.cddLabel}` : '',
    ]
      .filter(Boolean)
      .join(', ');
    updates.synopsis = `${contextDesc}.`;
  }

  if (item?.workType === 'academic') {
    if (!item?.abntReference) {
      updates.abntReference = buildAbntReference({
        ...item,
        author: mergedAuthor || item?.author,
        publisher: mergedPublisher || item?.publisher,
      });
    }
    if (!item?.keywords) {
      updates.keywords = (
        resolvedTags.length > 0 ? resolvedTags : resolvedGenres
      )
        .slice(0, 5)
        .join(', ');
    }
  }

  return {
    updates,
    matchedExternal: Boolean(catalogMatch),
    classification,
  };
}

export function buildLocalSpoilerFreeRecap({ item, linkedPosts = [] } = {}) {
  const positionLabel =
    item?.workType === 'manga'
      ? `Volume ${item.currentVolume || 0}, Capítulo ${item.currentChapter || 0}`
      : `Página ${item?.currentPage || 0}${item?.totalPages ? ` de ${item.totalPages}` : ''}`;

  const quotesList = Array.isArray(item?.quotes) ? item.quotes.slice(0, 3) : [];
  const postsList = Array.isArray(linkedPosts) ? linkedPosts.slice(0, 3) : [];

  const lines = [
    `1. Ponto de Parada`,
    `${item?.title || 'Obra'}: ${positionLabel}${item?.checkpoint ? ` (Checkpoint: ${item.checkpoint})` : ''}.`,
    '',
    `2. Síntese Segura até Aqui`,
    item?.synopsis
      ? item.synopsis
      : `Leitura acompanhada sem antecipar acontecimentos posteriores a ${positionLabel}.`,
  ];

  if (item?.notes) {
    lines.push(`Anotações pessoais: ${item.notes}`);
  }
  if (postsList.length > 0) {
    lines.push(
      `Registros do Diário: ${postsList
        .map((p) => `${p.title}${p.progressMarker ? ` (${p.progressMarker})` : ''}`)
        .join('; ')}.`
    );
  }
  if (quotesList.length > 0) {
    lines.push('', `3. Citações para Retomada`);
    quotesList.forEach((q) => {
      lines.push(`- "${q.text}"${q.location ? ` (${q.location})` : ''}`);
    });
  } else {
    lines.push(
      '',
      `3. Próximo Passo`,
      `Retome exatamente a partir de ${positionLabel} e salve novos trechos no Cofre de Citações.`
    );
  }

  return lines.join('\n');
}

export function buildLocalReviewOrAbstractSynthesis({
  item,
  linkedPosts = [],
  mode = 'auto',
} = {}) {
  const isAcademic =
    mode === 'academic' || (mode === 'auto' && item?.workType === 'academic');
  const quotesList = Array.isArray(item?.quotes) ? item.quotes : [];
  const postsList = Array.isArray(linkedPosts) ? linkedPosts : [];
  const classification = suggestLibraryClassification(item);

  if (isAcademic) {
    return [
      `RESUMO ANALÍTICO & FICHAMENTO LOCAL (${item?.title || 'Obra'})`,
      `Referência / Classificação: ${item?.author || 'Autor não informado'} · ${classification.callNumber}`,
      item?.keywords ? `Palavras-chave: ${item.keywords}` : null,
      '',
      `- Tema e Enquadramento: ${item?.synopsis || item?.fichamento || 'Obra catalogada no eixo acadêmico.'}`,
      quotesList.length > 0
        ? `- Citações Extraídas (${quotesList.length}): ${quotesList
            .slice(0, 3)
            .map((q) => `"${q.text}" (${q.location || 's.l.'})`)
            .join(' | ')}`
        : '- Citações: Nenhuma citação cadastrada até o momento.',
      item?.notes ? `- Notas Analíticas: ${item.notes}` : null,
    ]
      .filter(Boolean)
      .join('\n');
  }

  return [
    `RESENHA EDITORIAL LOCAL (${item?.title || 'Obra'})`,
    `Autoria: ${item?.author || 'Não informado'} | Nota: ${item?.rating ?? 'N/A'}/100${item?.verdict ? ` (${item.verdict})` : ''}`,
    '',
    `Premissa: ${item?.synopsis || 'Sem sinopse registrada.'}`,
    quotesList.length > 0
      ? `Trechos em destaque: ${quotesList
          .slice(0, 2)
          .map((q) => `"${q.text}"`)
          .join(' / ')}`
      : null,
    postsList.length > 0
      ? `Diário de leitura: ${postsList.map((p) => p.title).join('; ')}.`
      : null,
    item?.notes ? `Impressão do leitor: ${item.notes}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}
