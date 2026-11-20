/**
 * Sistema de Versionamento Nominal e Semântico do Projeto Códice.
 *
 * Regras oficiais:
 * - Pequenas atualizações / correções (patch / minor): incrementam apenas os números
 *   (ex.: 4.1.1, 4.1.2, 4.2.0), mantendo o codinome atual.
 * - Grandes atualizações (major): recebem um novo codinome oficial
 *   (ex.: Ymir 4.1.0, Odin 5.0.0, Alexandria 6.0.0).
 */

export const VERSIONING_RULES = {
  patchMinor:
    'Pequenas atualizações e correções (patch/minor) incrementam apenas o número (4.1.1, 4.1.2, 4.2.0), mantendo o codinome atual.',
  major:
    'Grandes atualizações (major) recebem um novo codinome oficial (ex.: Ymir 4.1.0, Odin 5.0.0, Alexandria 6.0.0).',
};

export const CODICE_RELEASE = {
  version: '4.1.0',
  codename: 'Ymir',
  label: 'v4.1.0 · Ymir',
  releaseType: 'major',
  date: '2026-11',
  summary:
    'Motor híbrido local/nuvem, leitor imersivo, busca seletiva e rede literária.',
};

export const RELEASE_HISTORY = [
  {
    version: '4.1.0',
    codename: 'Ymir',
    label: 'v4.1.0 · Ymir',
    releaseType: 'major',
    date: '2026-11',
    summary:
      'Motor híbrido local/nuvem, leitor imersivo, busca seletiva ultra-rápida, fallback multi-modelo Gemini e rede literária.',
    highlights: [
      'Busca seletiva com default instantâneo em Google Books, Jikan e CrossRef + cache persistente de 24h',
      'Fallback sequencial multi-modelo para Google Gemini com diagnóstico de conexão e preenchimento local',
      'Leitura direta via upload rápido de EPUB, PDF, CBZ, TXT e Markdown sem formulário prévio',
      'Seção dedicada de indicações personalizadas e compartilhamento direto entre leitores',
    ],
  },
  {
    version: '4.0.0',
    codename: 'Códice SQL',
    label: 'v4.0.0',
    releaseType: 'major',
    date: '2026-10',
    summary:
      'Schema relacional 4.0, títulos bilíngues PT-BR/Original, progresso flexível (% e Posição Kindle) e editoras brasileiras.',
    highlights: [
      'Progresso dual em páginas, percentual decimal e Kindle Loc',
      'Autocompletar normalizado de 65+ editoras e selos brasileiros',
      'OpenAlex, Wikidata e Gutendex integrados com backup assinado por SHA-256',
    ],
  },
  {
    version: '3.0.0',
    codename: 'Acervo',
    label: 'v3.0.0',
    releaseType: 'major',
    date: '2026-09',
    summary:
      'Leitor embutido em IndexedDB (PDF/EPUB/CBZ/MD), classificação CDD/Cutter e temas editoriais WCAG 2.2 AA.',
    highlights: [
      '5 atmosferas do leitor e 22 presets de tema validados em contraste',
      'Exportação bibliográfica CSV e BibTeX com cofre de citações',
    ],
  },
];

export function formatReleaseBadge(release = CODICE_RELEASE) {
  return `Códice ${release.label || `v${release.version} · ${release.codename}`}`;
}
