import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BRAZILIAN_PUBLISHERS,
  normalizePublisherName,
  searchBrazilianPublishers,
} from '../src/data/brazilianPublishers.js';
import {
  enrichBilingualTitles,
  mapGutendexBook,
  mapOpenAlexWork,
  mapWikidataEntityToWork,
  searchMedia,
} from '../src/services/mediaApi.js';
import {
  buildReaderTasteProfile,
  generateOfflineRecommendations,
} from '../src/services/recommendationEngine.js';
import { getDisplayTitles } from '../src/utils/backlogHelpers.js';

test('brazilianPublishers possui 65+ editoras e normalizePublisherName padroniza variacoes', () => {
  assert.ok(
    BRAZILIAN_PUBLISHERS.length >= 65,
    `Esperado >= 65 editoras, encontrado ${BRAZILIAN_PUBLISHERS.length}`
  );

  assert.equal(normalizePublisherName('Companhia Das Letras'), 'Companhia das Letras');
  assert.equal(normalizePublisherName('Cia. das Letras'), 'Companhia das Letras');
  assert.equal(normalizePublisherName('Grupo Editorial Record Ltda.'), 'Record');
  assert.equal(normalizePublisherName('Pipoca e Nanquim'), 'Pipoca & Nanquim');
  assert.equal(normalizePublisherName('Editora JBC'), 'JBC');
  assert.equal(normalizePublisherName('edgard blucher'), 'Blucher');
  assert.equal(normalizePublisherName('Editora Personalizada XYZ'), 'Editora Personalizada XYZ');

  const mangaHits = searchBrazilianPublishers('pipoca', { category: 'hq' });
  assert.equal(mangaHits[0]?.name, 'Pipoca & Nanquim');
});

test('parsers OpenAlex, Gutendex e Wikidata extraem open access, epub gratis e titulos bilingues', async () => {
  const oaItem = mapOpenAlexWork({
    id: 'https://openalex.org/W12345',
    title: 'Software Craftsmanship Metrics',
    doi: 'https://doi.org/10.1000/oa-sample',
    publication_year: 2024,
    cited_by_count: 142,
    language: 'en',
    open_access: { is_oa: true, oa_url: 'https://arxiv.org/pdf/2401.0001.pdf' },
    primary_location: {
      source: {
        display_name: 'Journal of Software',
        host_organization_name: 'Blucher',
      },
    },
    authorships: [{ author: { display_name: 'Ana Costa' } }],
    primary_topic: { display_name: 'Engenharia de Software' },
  });

  assert.equal(oaItem.citedByCount, 142);
  assert.equal(oaItem.openAccessUrl, 'https://arxiv.org/pdf/2401.0001.pdf');
  assert.equal(oaItem.doi, '10.1000/oa-sample');
  assert.equal(oaItem.publisher, 'Blucher');

  const gutItem = mapGutendexBook({
    id: 2701,
    title: 'Moby Dick; Or, The Whale',
    authors: [{ name: 'Melville, Herman' }],
    languages: ['en'],
    formats: {
      'application/epub+zip': 'https://www.gutenberg.org/ebooks/2701.epub.images',
      'image/jpeg': 'https://www.gutenberg.org/cache/epub/2701/pg2701.cover.medium.jpg',
    },
    subjects: ['Whaling -- Fiction'],
    download_count: 50000,
  });

  assert.equal(gutItem.author, 'Herman Melville');
  assert.equal(gutItem.freeEpubUrl, 'https://www.gutenberg.org/ebooks/2701.epub.images');
  assert.equal(gutItem.isPublicDomain, true);

  const wdWork = mapWikidataEntityToWork({
    id: 'Q208460',
    labels: {
      pt: { value: '1984' },
      en: { value: 'Nineteen Eighty-Four' },
    },
    descriptions: { pt: { value: 'romance distópico de George Orwell' } },
    claims: {
      P1476: [{ mainsnak: { datavalue: { value: { text: 'Nineteen Eighty-Four' } } } }],
      P495: [{ mainsnak: { datavalue: { value: { id: 'Q145' } } } }],
      P577: [{ mainsnak: { datavalue: { value: { time: '+1949-06-08T00:00:00Z' } } } }],
    },
  });

  assert.equal(wdWork.title, '1984');
  assert.equal(wdWork.originalTitle, 'Nineteen Eighty-Four');
  assert.equal(wdWork.originCountry, 'Reino Unido');
  assert.equal(wdWork.releaseYear, 1949);

  // Enriquecimento cruzado com Google Books em ingles -> preenche titulo PT-BR + originalTitle EN
  const enriched = enrichBilingualTitles(
    [
      {
        id: 'gb-1984',
        title: 'Nineteen Eighty-Four',
        originalTitle: 'Nineteen Eighty-Four',
        language: 'en',
        genres: ['Fiction'],
      },
    ],
    [wdWork]
  );
  assert.equal(enriched[0].title, '1984');
  assert.equal(enriched[0].originalTitle, 'Nineteen Eighty-Four');
  assert.equal(enriched[0].originCountry, 'Reino Unido');

  // Busca integrada mockada cruzando Wikidata + Google Books
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const str = String(url);
    if (str.includes('googleapis.com')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              id: 'k1',
              volumeInfo: {
                title: 'O Processo',
                authors: ['Franz Kafka'],
                publisher: 'Cia. das Letras',
                language: 'pt-BR',
              },
            },
          ],
        }),
      };
    }
    if (str.includes('action=wbsearchentities')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ search: [{ id: 'Q36319' }] }),
      };
    }
    if (str.includes('action=wbgetentities')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          entities: {
            Q36319: {
              id: 'Q36319',
              labels: { pt: { value: 'O Processo' }, en: { value: 'The Trial' } },
              descriptions: { pt: { value: 'romance de Franz Kafka' } },
              claims: {
                P1476: [{ mainsnak: { datavalue: { value: { text: 'Der Process' } } } }],
              },
            },
          },
        }),
      };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };

  try {
    const searchRes = await searchMedia('O Processo', { filter: 'book', skipCache: true });
    const kafka = searchRes.results.find((r) => r.title === 'O Processo');
    assert.ok(kafka);
    assert.equal(kafka.originalTitle, 'Der Process');
    assert.equal(kafka.publisher, 'Companhia das Letras');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('getDisplayTitles suporta modos bilingue, pt e original', () => {
  const work = { title: 'A Metamorfose', originalTitle: 'Die Verwandlung' };
  assert.deepEqual(getDisplayTitles(work, 'bilingual'), {
    primary: 'A Metamorfose',
    secondary: 'Die Verwandlung',
  });
  assert.deepEqual(getDisplayTitles(work, 'pt'), {
    primary: 'A Metamorfose',
    secondary: '',
  });
  assert.deepEqual(getDisplayTitles(work, 'original'), {
    primary: 'Die Verwandlung',
    secondary: '',
  });
});

test('recommendationEngine pontua candidatos na estante cruzando notas >= 80, editora, CDD e humor', () => {
  const profile = {
    favoriteGenres: ['Ficção Científica'],
    readerFocus: 'Leitura Literária',
  };

  const items = [
    {
      id: 'loved-1',
      inBacklog: true,
      status: 'completed',
      title: 'Duna',
      author: 'Frank Herbert',
      publisher: 'Cia. das Letras',
      cdu_cdd: '823',
      rating: 95,
      genres: ['Ficção Científica'],
      completedDate: '2026-08-10',
    },
    {
      id: 'queue-match',
      inBacklog: true,
      status: 'queued',
      title: 'Messias de Duna',
      author: 'Frank Herbert',
      publisher: 'Aleph',
      cdu_cdd: '823',
      totalPages: 280,
      genres: ['Ficção Científica', 'Fantasia'],
      hype: 'high',
    },
    {
      id: 'queue-unrelated',
      inBacklog: true,
      status: 'queued',
      title: 'Manual Contábil',
      author: 'Autor Genérico',
      publisher: 'Atlas',
      cdu_cdd: '657',
      totalPages: 120,
      genres: ['Contabilidade'],
      hype: 'low',
    },
  ];

  const taste = buildReaderTasteProfile(items, profile);
  assert.ok(taste.preferredPublishers.has('companhia das letras'));
  assert.ok(taste.preferredAuthors.has('frank herbert'));

  const rec = generateOfflineRecommendations({
    items,
    profile,
    mood: 'Imersão Épica',
  });
  assert.equal(rec.ok, true);
  assert.equal(rec.primaryId, 'queue-match');
  assert.ok(rec.reason.includes('Frank Herbert'));
  assert.equal(rec.alternatives[0].id, 'queue-unrelated');
});
