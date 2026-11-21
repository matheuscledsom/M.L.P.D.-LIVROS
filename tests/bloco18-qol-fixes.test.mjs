import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

function createMemoryStorage() {
  const store = new Map();
  return {
    getItem(k) {
      return store.has(k) ? store.get(k) : null;
    },
    setItem(k, v) {
      store.set(k, String(v));
    },
    removeItem(k) {
      store.delete(k);
    },
    clear() {
      store.clear();
    },
  };
}

if (!globalThis.localStorage) {
  globalThis.localStorage = createMemoryStorage();
}
if (!globalThis.sessionStorage) {
  globalThis.sessionStorage = createMemoryStorage();
}

const {
  CRITERION_OPTIONS,
  normalizePreferredCriteria,
  toggleCriterionInList,
  formatPreferredCriteriaText,
} = await import('../src/utils/readerPreferences.js');

const {
  buildPrefilledCatalogDraft,
  mapCategoriesToGenreAndSubgenres,
  normalizeLanguageLabel,
} = await import('../src/utils/genreMapper.js');

const {
  clearSearchMediaCache,
  mapGoogleBook,
  mergeTwoResults,
  searchMedia,
} = await import('../src/services/mediaApi.js');

const {
  buildHomeBookRecommendations,
  isMangaOrHqWork,
  userAllowsMangaOrHq,
} = await import('../src/services/recommendationEngine.js');

const {
  clearMemoryReaderStoreForTests,
  computeTotalStoredBytes,
  getBookEpubLocations,
  getBookFileRecord,
  getBookReaderState,
  listStoredReaderBooks,
  removeStoredReaderBook,
  saveBookEpubLocations,
  saveBookFile,
  saveBookReaderState,
  sortStoredReaderBooks,
} = await import('../src/services/readerStorage.js');

const { hydrateAppSnapshotFromDatabase, migrateDatabase } = await import(
  '../src/services/codiceDatabase.js'
);
const { normalizeFrontendProfile } = await import(
  '../src/services/codiceBackend.js'
);
const { domainConfig } = await import('../src/config/domainConfig.js');

test('Onboarding multi-seleção de critérios migra string antiga e impede lista vazia', () => {
  assert.equal(CRITERION_OPTIONS.length, 4);

  // Retrocompatibilidade: string simples em preferredCriteria ou legacy preferredCriterion
  assert.deepEqual(
    normalizePreferredCriteria('Escrita e Imersão', null),
    ['Escrita e Imersão']
  );
  assert.deepEqual(
    normalizePreferredCriteria(undefined, 'Impacto e Conhecimento'),
    ['Impacto e Conhecimento']
  );
  assert.deepEqual(
    normalizePreferredCriteria('Enredo e Ritmo, Escrita e Imersão', null),
    ['Enredo e Ritmo', 'Escrita e Imersão']
  );
  assert.deepEqual(normalizePreferredCriteria(null, null), ['Enredo e Ritmo']);

  // Seleção múltipla (1 ou mais)
  let selected = normalizePreferredCriteria(['Enredo e Ritmo']);
  selected = toggleCriterionInList(selected, 'Escrita e Imersão');
  selected = toggleCriterionInList(selected, 'Impacto e Conhecimento');
  assert.deepEqual(selected, [
    'Enredo e Ritmo',
    'Escrita e Imersão',
    'Impacto e Conhecimento',
  ]);

  // Remover quando há mais de 1 funciona
  selected = toggleCriterionInList(selected, 'Enredo e Ritmo');
  assert.deepEqual(selected, ['Escrita e Imersão', 'Impacto e Conhecimento']);
  selected = toggleCriterionInList(selected, 'Escrita e Imersão');
  assert.deepEqual(selected, ['Impacto e Conhecimento']);

  // Não permite ficar com 0 critérios selecionados
  selected = toggleCriterionInList(selected, 'Impacto e Conhecimento');
  assert.deepEqual(selected, ['Impacto e Conhecimento']);

  // Integração com migração de banco e normalização de backend
  const migrated = migrateDatabase({
    version: 2,
    items: [],
    profile: {
      displayName: 'Leitor Antigo',
      handle: '@antigo',
      preferredCriterion: 'Personagens e Profundidade',
    },
  });
  const hydrated = hydrateAppSnapshotFromDatabase(migrated);
  assert.deepEqual(hydrated.profile.preferredCriteria, [
    'Personagens e Profundidade',
  ]);
  assert.equal(
    formatPreferredCriteriaText(hydrated.profile),
    'Personagens e Profundidade'
  );

  const backendProfile = normalizeFrontendProfile({
    handle: '@multi',
    preferredCriteria: 'Escrita e Imersão',
  });
  assert.deepEqual(backendProfile.preferredCriteria, ['Escrita e Imersão']);
});

test('Recomendações bloqueiam Mangás/HQs e gêneros fora das preferências, removem perfis fictícios e suportam Dispensar', () => {
  // Perfil que só marcou Clássicos e Filosofia (sem Mangás e sem livros no acervo)
  const classicProfile = {
    readerFocus: 'Leitor Casual',
    favoriteGenres: ['Clássicos', 'Filosofia'],
    preferredCriteria: ['Escrita e Imersão', 'Impacto e Conhecimento'],
  };

  assert.equal(userAllowsMangaOrHq([], classicProfile), false);

  const res = buildHomeBookRecommendations({
    items: [],
    profile: classicProfile,
    peerRecommendations: [
      {
        work: {
          id: 'seed-m1',
          title: 'Monster',
          workType: 'manga',
          genres: ['Seinen'],
        },
        peerHandle: '@akira_mangas',
        rating: 95,
        isFollowing: true,
      },
      {
        work: {
          id: 'seed-c1',
          title: 'A Hora da Estrela',
          workType: 'book',
          genres: ['Clássicos'],
        },
        peerHandle: '@clarice_leitora',
        rating: 98,
        isFollowing: true,
      },
    ],
    limit: 50,
  });

  assert.ok(res.recommendations.length > 0);
  // Nunca sugere Mangás/HQs
  assert.equal(
    res.recommendations.some((r) => isMangaOrHqWork(r.item)),
    false
  );
  // Nunca inclui gêneros fora de Clássicos/Filosofia (ex: 1984 / Código Limpo / Duna)
  assert.equal(
    res.recommendations.some(
      (r) => r.item.id === 'book-1984' || r.item.id === 'academic-codigo-limpo'
    ),
    false
  );
  // Nunca exibe handles fictícios @clarice_leitora ou @akira_mangas
  assert.equal(
    res.recommendations.some((r) =>
      /@clarice_leitora|@akira_mangas|@helena_pesquisa|@leitor/i.test(r.reason)
    ),
    false
  );
  // Razão objetiva baseada nas preferências
  assert.ok(
    res.recommendations.every((r) =>
      /Alinhado ao seu interesse em|Baseado nas suas avaliações/i.test(r.reason)
    )
  );

  // Dispensar uma sugestão traz a próxima compatível e dispensar todas gera lista vazia
  const firstId = res.recommendations[0].id;
  const afterDismissOne = buildHomeBookRecommendations({
    items: [],
    profile: classicProfile,
    limit: 4,
    dismissedIds: [firstId],
  });
  assert.equal(
    afterDismissOne.recommendations.some((r) => r.id === firstId),
    false
  );

  const allIds = res.recommendations.map((r) => r.id);
  const afterDismissAll = buildHomeBookRecommendations({
    items: [],
    profile: classicProfile,
    limit: 4,
    dismissedIds: allIds,
  });
  assert.equal(afterDismissAll.recommendations.length, 0);

  // Gênero sem correspondência retorna estado vazio (0 recomendações, sem fallback aleatório)
  const emptyMatch = buildHomeBookRecommendations({
    items: [],
    profile: { favoriteGenres: ['Astrofísica Experimental'] },
    limit: 4,
  });
  assert.equal(emptyMatch.recommendations.length, 0);

  // Caso usuário marque Mangá ou tenha mangá no acervo, mangás voltam a ser permitidos
  const mangaProfile = {
    readerFocus: 'Mangás, Manhwas & Light Novels',
    favoriteGenres: ['Mangá (Shonen / Seinen)'],
  };
  assert.equal(userAllowsMangaOrHq([], mangaProfile), true);
  const mangaRes = buildHomeBookRecommendations({
    items: [],
    profile: mangaProfile,
    limit: 4,
  });
  assert.ok(mangaRes.recommendations.some((r) => isMangaOrHqWork(r.item)));
});

test('Catalogação pré-carrega e normaliza título, autor, gênero/subgênero, ano, editora, páginas, ISBN, idioma e sinopse editáveis', async () => {
  const fantasyMapped = mapCategoriesToGenreAndSubgenres(['Fiction / Fantasy / Epic']);
  assert.equal(fantasyMapped.primaryGenre, 'Fantasia');
  assert.deepEqual(fantasyMapped.subgenres, ['Fantasia Épica']);

  const csMapped = mapCategoriesToGenreAndSubgenres(['Computer Science']);
  assert.equal(csMapped.primaryGenre, 'Computação & Tecnologia');
  assert.deepEqual(csMapped.subgenres, ['Engenharia de Software']);

  assert.equal(normalizeLanguageLabel('pt-BR'), 'Português');
  assert.equal(normalizeLanguageLabel('en'), 'Inglês');

  clearSearchMediaCache();
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const str = String(url);
    if (str.includes('googleapis.com')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              id: 'gb-vento',
              volumeInfo: {
                title: 'O Nome do Vento',
                authors: ['Patrick Rothfuss'],
                publishedDate: '2009-07-15',
                publisher: 'Editora Arqueiro',
                pageCount: 656,
                categories: ['Fantasy'],
                language: 'pt-BR',
                description: '<p>A história de Kvothe em edição brasileira.</p>',
                industryIdentifiers: [
                  { type: 'ISBN_13', identifier: '9788599296493' },
                ],
              },
            },
          ],
        }),
      };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };

  try {
    const searchRes = await searchMedia('O Nome do Vento', {
      filter: 'book',
      sources: ['googleBooks'],
      skipCache: true,
    });
    assert.equal(searchRes.results.length, 1);
    const result = searchRes.results[0];
    assert.equal(result.title, 'O Nome do Vento');
    assert.equal(result.author, 'Patrick Rothfuss');
    assert.equal(result.primaryGenre, 'Fantasia');
    assert.deepEqual(result.subgenres, ['Fantasia Épica']);
    assert.equal(result.releaseYear, 2009);
    assert.equal(result.publisher, 'Sextante'); // normalizado via brazilianPublishers (Arqueiro -> Sextante)
    assert.equal(result.totalPages, 656);
    assert.equal(result.isbn, '9788599296493');
    assert.equal(result.language, 'Português');
    assert.equal(result.synopsis, 'A história de Kvothe em edição brasileira.');

    const draft = buildPrefilledCatalogDraft(result, {
      defaultWorkType: 'book',
      defaultFormat: 'Brochura',
    });
    assert.equal(draft.primaryGenre, 'Fantasia');
    assert.equal(draft.subgenresText, 'Fantasia Épica');
    assert.equal(draft.releaseYear, 2009);
    assert.equal(draft.totalPages, 656);
    assert.equal(draft.isbn, '9788599296493');
    assert.equal(draft.language, 'Português');

    // Merge preserva subgênero específico de outra fonte quando vencedor só tem genérico
    const merged = mergeTwoResults(
      {
        id: 'a',
        title: 'Clean Code',
        genres: ['Fiction'],
        primaryGenre: 'Ficção Literária',
        subgenres: [],
        coverUrl: 'https://example.com/cover.jpg',
        coverCandidates: ['https://example.com/cover.jpg'],
        coverSources: ['https://example.com/cover.jpg'],
        synopsis: 'Guia de boas práticas.',
      },
      {
        id: 'b',
        title: 'Clean Code',
        genres: ['Computer Science'],
        publisher: 'alta books',
        totalPages: 425,
        isbn: '9788576082675',
        language: 'en',
      }
    );
    assert.equal(merged.primaryGenre, 'Computação & Tecnologia');
    assert.ok(merged.subgenres.includes('Engenharia de Software'));
    assert.equal(merged.totalPages, 425);
    assert.equal(merged.isbn, '9788576082675');
    assert.equal(merged.language, 'Inglês');
  } finally {
    globalThis.fetch = origFetch;
    clearSearchMediaCache();
  }
});

test('readerStorage removeStoredReaderBook apaga binário, metadados, epubLocations e referência readerBookId; ordenação e MB funcionam', async () => {
  clearMemoryReaderStoreForTests();
  globalThis.localStorage.clear();

  const bookId = 'quick:CleanCode.pdf:2097152';
  await saveBookFile(bookId, {
    blob: { size: 2097152, type: 'application/pdf' },
    fileName: 'CleanCode.pdf',
    format: 'pdf',
    size: 2097152,
    lastOpenedAt: '2026-11-18T10:00:00.000Z',
  });
  await saveBookReaderState(bookId, {
    position: { page: 42, totalPages: 425, progressPct: 10 },
  });
  await saveBookEpubLocations(bookId, JSON.stringify(['cfi1', 'cfi2']));

  const epubId = 'work-duna-epub';
  await saveBookFile(epubId, {
    blob: { size: 1048576, type: 'application/epub+zip' },
    fileName: 'Duna.epub',
    format: 'epub',
    size: 1048576,
    readerState: {
      position: { progressPct: 65, page: 440, totalPages: 680 },
    },
    lastOpenedAt: '2099-01-01T12:00:00.000Z',
  });
  await saveBookEpubLocations(epubId, JSON.stringify(['locA', 'locB']));

  const initialWorks = [
    {
      id: 'work-clean',
      title: 'Código Limpo',
      readerBookId: bookId,
      hasDigitalFile: true,
    },
    {
      id: epubId,
      title: 'Duna',
      readerBookId: epubId,
      hasDigitalFile: true,
    },
  ];
  globalThis.localStorage.setItem(
    domainConfig.storageKey,
    JSON.stringify(initialWorks)
  );

  const list = await listStoredReaderBooks(initialWorks);
  assert.equal(list.length, 2);
  assert.equal(computeTotalStoredBytes(list), 2097152 + 1048576);

  // Ordenação: Maior progresso %, Nome A–Z, Última leitura
  const byProgress = sortStoredReaderBooks(list, 'progress');
  assert.equal(byProgress[0].title, 'Duna');
  const byTitle = sortStoredReaderBooks(list, 'title');
  assert.equal(byTitle[0].title, 'Código Limpo');
  const byRecent = sortStoredReaderBooks(list, 'recent');
  assert.equal(byRecent[0].title, 'Duna');

  // Exclusão completa e atômica do PDF
  const updatesCaptured = [];
  const removed = await removeStoredReaderBook(bookId, {
    works: initialWorks,
    onUpdateWork: (id, patch) => updatesCaptured.push({ id, patch }),
  });
  assert.equal(removed, true);
  assert.equal(await getBookFileRecord(bookId), null);
  assert.equal(await getBookReaderState(bookId), null);
  assert.equal(await getBookEpubLocations(bookId), null);
  assert.equal(updatesCaptured.length, 1);
  assert.equal(updatesCaptured[0].id, 'work-clean');
  assert.equal(updatesCaptured[0].patch.readerBookId, null);

  const storedAfterPdfDelete = JSON.parse(
    globalThis.localStorage.getItem(domainConfig.storageKey)
  );
  assert.equal(storedAfterPdfDelete[0].readerBookId, null);
  assert.equal(storedAfterPdfDelete[0].hasDigitalFile, false);

  // Exclusão completa do EPUB + cache de locations
  await removeStoredReaderBook(epubId, { works: initialWorks });
  assert.equal(await getBookFileRecord(epubId), null);
  assert.equal(await getBookEpubLocations(epubId), null);
  assert.equal((await listStoredReaderBooks([])).length, 0);
});

test('Auditoria de UI e design: 0 emojis em src/, alvos e controles de UX presentes nos componentes alterados', async () => {
  const srcRoot = path.resolve('src');
  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const out = [];
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...(await walk(full)));
      else if (/\.(js|jsx|css)$/.test(entry.name)) out.push(full);
    }
    return out;
  }

  const files = await walk(srcRoot);
  const emojiRe = /\p{Extended_Pictographic}/gu;
  for (const f of files) {
    const txt = await fs.readFile(f, 'utf8');
    assert.equal(
      emojiRe.test(txt),
      false,
      `Emoji encontrado em ${path.relative(process.cwd(), f)}`
    );
  }

  const [
    onboardingSrc,
    drawerSrc,
    recSrc,
    addSrc,
    shelfSrc,
    homeSrc,
    detailSrc,
  ] = await Promise.all([
    fs.readFile(path.resolve('src/components/OnboardingFlow.jsx'), 'utf8'),
    fs.readFile(path.resolve('src/components/ProfileSettingsDrawer.jsx'), 'utf8'),
    fs.readFile(path.resolve('src/components/RecommendationsSection.jsx'), 'utf8'),
    fs.readFile(path.resolve('src/screens/AddScreen.jsx'), 'utf8'),
    fs.readFile(path.resolve('src/components/reader/DigitalShelfModal.jsx'), 'utf8'),
    fs.readFile(path.resolve('src/screens/HomeScreen.jsx'), 'utf8'),
    fs.readFile(path.resolve('src/components/ItemDetailSheet.jsx'), 'utf8'),
  ]);

  assert.ok(onboardingSrc.includes('Selecione um ou mais critérios'));
  assert.ok(onboardingSrc.includes('aria-pressed={isSelected}'));
  assert.ok(drawerSrc.includes('Preferências de Leitura &amp; Gêneros'));
  assert.ok(recSrc.includes('aria-label="Dispensar indicação"'));
  assert.ok(recSrc.includes('Nenhuma indicação compatível'));
  assert.ok(addSrc.includes('Gênero Principal'));
  assert.ok(addSrc.includes('Subgênero(s)'));
  assert.ok(shelfSrc.includes('Excluir arquivo'));
  assert.ok(shelfSrc.includes('Confirmar exclusão'));
  assert.ok(shelfSrc.includes('Maior progresso %'));
  assert.ok(shelfSrc.includes('Nome A–Z'));
  assert.ok(homeSrc.includes('Excluir arquivo'));
  assert.ok(homeSrc.includes('Confirmar exclusão'));
  assert.ok(detailSrc.includes('Remover só o arquivo PDF/EPUB'));
  assert.ok(detailSrc.includes('Excluir obra inteira'));

  for (const [name, src] of [
    ['OnboardingFlow.jsx', onboardingSrc],
    ['ProfileSettingsDrawer.jsx', drawerSrc],
    ['RecommendationsSection.jsx', recSrc],
    ['AddScreen.jsx', addSrc],
    ['DigitalShelfModal.jsx', shelfSrc],
    ['HomeScreen.jsx', homeSrc],
    ['ItemDetailSheet.jsx', detailSrc],
  ]) {
    assert.equal(
      /shadow-(lg|xl|2xl)|bg-gradient-|linear-gradient/.test(src),
      false,
      `Sombra grande ou gradiente encontrado em ${name}`
    );
  }
});
