# Projeto Códice — v5.0.0 · Alexandria

Arquivo literário pessoal, gerenciador de acervo multi-formato e leitor offline-first construído em React + Vite + Tailwind CSS v4.

## Principais Recursos

- **Catálogo Multi-Domínio:** Livros, mangás/light novels, quadrinhos/HQs e pesquisas acadêmicas com classificação automática CDU/CDD e Cutter.
- **Leitor Offline Integrado (`ReaderShell`):** Suporte local para `.epub`, `.pdf`, `.cbz` (com dupla página RTL, zoom no toque e filtro E-Ink Sumi), `.txt` e `.md`, dicionário offline-cached e timer silencioso de foco.
- **PWA File Handlers:** Abra arquivos `.epub`, `.pdf` e `.cbz` diretamente pelo sistema operacional usando o Códice instalado (`launchQueue`).
- **Blindagem Tripla Anti-Perda:**
  1. `navigator.storage.persist()` solicitado na inicialização.
  2. Espelho comprimido `codice_emergency_mirror_v1` sem imagens Base64 no `localStorage`.
  3. Lembrete automático de backup a cada 7 dias com exportação JSON assinada com SHA-256.
- **Leitura Conjunta com Escudo Anti-Spoiler:** Comentários marcados por percentual (`%`) são filtrados antes de qualquer renderização no DOM para evitar spoilers acima do seu marco atual.
- **Códice Wrapped & Cards Editoriais:** Exportação de retrospectiva e citações em cartões PNG `1080×1350`.
- **Acessibilidade e Ergonomia:** 3 escalas globais de fonte, espaçamento para dislexia, badges com formas geométricas para daltonismo, Modo Calmo sem contadores, Command Palette (`Ctrl+K`) e atalhos de teclado (`?`).
- **Importação e Portabilidade:** Importação CSV (Goodreads, StoryGraph, Calibre) ou listas de texto com detector de duplicadas, além de exportação por obra em Markdown (`.md`), CSV e BibTeX.

## Comandos Locais

```bash
npm ci
npm run dev
npm test
npm run validate:contrast
npm run build
```

## Licença

Distribuído sob a licença MIT — veja [LICENSE](LICENSE).
