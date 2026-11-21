import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  extractLookupTerm,
  lookupDictionaryTerm,
  parseWiktionaryDefinitions,
} from '../src/services/dictionaryService.js';
import { EDITORIAL_CARD_TEMPLATES } from '../src/utils/editorialCardGenerator.js';
import { buildTimeCapsuleEntries } from '../src/utils/timeCapsule.js';

test('dictionaryService extrai termo, sanitiza HTML do Wikcionário e usa cache em memória', async () => {
  assert.equal(extractLookupTerm(' «Efêmero», '), 'Efêmero');

  const parsed = parseWiktionaryDefinitions(
    {
      pt: [
        {
          partOfSpeech: 'Adjetivo',
          definitions: [{ definition: '<b>Passageiro</b>; que dura apenas um <a href="#">dia</a>.' }],
        },
      ],
    },
    'efêmero'
  );
  assert.equal(parsed.term, 'efêmero');
  assert.equal(parsed.definition, '(Adjetivo) Passageiro ; que dura apenas um dia .');
  assert.equal(parsed.sourceLabel, 'Wikcionário (PT)');

  let fetchCalls = 0;
  const fakeFetch = async (url) => {
    fetchCalls += 1;
    if (url.includes('pt.wiktionary.org')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          pt: [{ partOfSpeech: 'Substantivo', definitions: [{ definition: 'Conjunto de códices.' }] }],
        }),
      };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };

  const first = await lookupDictionaryTerm('códiceúnico99', {
    fetchFn: fakeFetch,
    forceCache: true,
  });
  assert.equal(first.ok, true);
  assert.equal(first.sourceLabel, 'Wikcionário (PT)');
  const callsAfterFirst = fetchCalls;

  const second = await lookupDictionaryTerm('códiceúnico99', {
    fetchFn: fakeFetch,
    forceCache: true,
  });
  assert.equal(second.ok, true);
  assert.equal(second.fromCache, true);
  assert.equal(fetchCalls, callsAfterFirst);
});

test('buildTimeCapsuleEntries encontra aniversários anuais e marcos de 30/90/180 dias', () => {
  const ref = '2026-11-20';
  const items = [
    {
      id: 'w1',
      title: 'Grande Sertão: Veredas',
      author: 'Guimarães Rosa',
      inBacklog: true,
      completedDate: '2024-11-20',
      quotes: [{ id: 'q1', text: 'Viver é muito perigoso.', location: 'Pág. 12', createdAt: '2025-11-20T12:00:00Z' }],
    },
    {
      id: 'w2',
      title: 'O Alienista',
      author: 'Machado de Assis',
      inBacklog: true,
      completedDate: '2026-10-21', // 30 dias antes de 2026-11-20
    },
    {
      id: 'w3',
      title: 'Futuro',
      inBacklog: true,
      completedDate: '2026-11-20', // hoje não entra
    },
  ];

  const entries = buildTimeCapsuleEntries({ items, referenceDate: ref });
  assert.equal(entries.length, 3);
  assert.deepEqual(
    entries.map((e) => e.badgeLabel),
    ['Há 1 ano neste dia', 'Há 2 anos neste dia', 'Há 30 dias']
  );
  assert.ok(!entries.some((e) => e.workId === 'w3'));
});

test('editorialCardGenerator exporta 3 templates e integra com Home e QuotesVaultTab sem gradientes', () => {
  assert.deepEqual(
    EDITORIAL_CARD_TEMPLATES.map((t) => t.id),
    ['ficha', 'pagina', 'carimbo']
  );

  const cardSrc = fs.readFileSync(
    new URL('../src/utils/editorialCardGenerator.js', import.meta.url),
    'utf8'
  );
  const quotesSrc = fs.readFileSync(
    new URL('../src/components/QuotesVaultTab.jsx', import.meta.url),
    'utf8'
  );
  const homeSrc = fs.readFileSync(
    new URL('../src/screens/HomeScreen.jsx', import.meta.url),
    'utf8'
  );
  const popoverSrc = fs.readFileSync(
    new URL('../src/components/reader/AnnotationPopover.jsx', import.meta.url),
    'utf8'
  );

  assert.ok(!cardSrc.includes('createRadialGradient'));
  assert.ok(!cardSrc.includes('createLinearGradient'));
  assert.ok(quotesSrc.includes('EDITORIAL_CARD_TEMPLATES'));
  assert.ok(homeSrc.includes('Neste Dia'));
  assert.ok(popoverSrc.includes('Definir'));
});
