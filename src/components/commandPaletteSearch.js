import { getDisplayTitles } from '../utils/backlogHelpers.js';

export function buildCommandPaletteEntries({
  query = '',
  items = [],
  collections = [],
  onNavigateTab,
  onSelectItem,
  onSelectCollection,
  onOpenThemeStudio,
  onOpenDigitalShelf,
  onExportBackup,
  onToggleFocusTheme,
}) {
  const q = String(query || '').trim().toLowerCase();

  const actions = [
    {
      id: 'act-home',
      kind: 'Ação',
      label: 'Ir para Início',
      hint: 'Tela inicial e diário rápido',
      iconKey: 'home',
      run: () => onNavigateTab?.('home'),
    },
    {
      id: 'act-list',
      kind: 'Ação',
      label: 'Ir para Acervo',
      hint: 'Estante, filtros e lombadas',
      iconKey: 'book',
      run: () => onNavigateTab?.('list'),
    },
    {
      id: 'act-add',
      kind: 'Ação',
      label: 'Catalogar Nova Obra',
      hint: 'Buscar por título, ISBN ou DOI',
      iconKey: 'plus',
      run: () => onNavigateTab?.('add'),
    },
    {
      id: 'act-stats',
      kind: 'Ação',
      label: 'Ir para Métricas',
      hint: 'Mapa de calor e metas anuais',
      iconKey: 'stats',
      run: () => onNavigateTab?.('stats'),
    },
    {
      id: 'act-community',
      kind: 'Ação',
      label: 'Ir para Rede & Amigos',
      hint: 'Cartões vivos e busca @handle#XXXX',
      iconKey: 'users',
      run: () => onNavigateTab?.('community'),
    },
    {
      id: 'act-profile',
      kind: 'Ação',
      label: 'Ir para Meu Perfil',
      hint: 'Configurações, DNA do leitor e diário',
      iconKey: 'user',
      run: () => onNavigateTab?.('profile'),
    },
    {
      id: 'act-themes',
      kind: 'Aparência',
      label: 'Abrir Temas & Aparência',
      hint: 'Fontes, densidade e 6 estilos',
      iconKey: 'palette',
      run: () => onOpenThemeStudio?.(),
    },
    {
      id: 'act-shelf',
      kind: 'Leitor',
      label: 'Abrir Meus EPUBs / Arquivos Offline',
      hint: 'Estante digital de EPUB, PDF e CBZ',
      iconKey: 'library',
      run: () => onOpenDigitalShelf?.(),
    },
    {
      id: 'act-focus',
      kind: 'Aparência',
      label: 'Alternar Modo Foco (Baixo Brilho)',
      hint: 'Grafite fosco sem distrações',
      iconKey: 'command',
      run: () => onToggleFocusTheme?.(),
    },
    {
      id: 'act-backup',
      kind: 'Dados',
      label: 'Exportar Cópia de Segurança (.json SHA-256)',
      hint: 'Baixar ou compartilhar backup',
      iconKey: 'download',
      run: () => onExportBackup?.(),
    },
  ];

  const bookEntries = (Array.isArray(items) ? items : [])
    .filter((i) => i && i.inBacklog !== false)
    .map((item) => {
      const titles = getDisplayTitles(item, 'bilingual');
      return {
        id: `book-${item.id}`,
        kind: 'Acervo',
        label: titles.primary || item.title,
        hint:
          [item.author, item.seriesName, item.isbn].filter(Boolean).join(' · ') ||
          'Obra catalogada',
        searchBlob:
          `${item.title || ''} ${item.originalTitle || ''} ${item.author || ''} ${item.isbn || ''} ${item.seriesName || ''}`.toLowerCase(),
        iconKey: 'book',
        run: () => onSelectItem?.(item),
      };
    });

  const collectionEntries = (Array.isArray(collections) ? collections : []).map((col) => ({
    id: `col-${col.id}`,
    kind: 'Coleção',
    label: col.name,
    hint: 'Abrir coleção no Acervo',
    searchBlob: String(col.name || '').toLowerCase(),
    iconKey: 'folder',
    run: () => {
      onSelectCollection?.(col.id);
      onNavigateTab?.('list');
    },
  }));

  if (!q) {
    return [
      ...actions.slice(0, 6),
      ...collectionEntries.slice(0, 3),
      ...bookEntries.slice(0, 4),
    ];
  }

  const matchedActions = actions.filter((a) =>
    `${a.label} ${a.hint} ${a.kind}`.toLowerCase().includes(q)
  );
  const matchedCollections = collectionEntries.filter((c) => c.searchBlob.includes(q));
  const matchedBooks = bookEntries.filter((b) => b.searchBlob.includes(q));

  return [
    ...matchedBooks.slice(0, 8),
    ...matchedCollections.slice(0, 4),
    ...matchedActions.slice(0, 6),
  ];
}
