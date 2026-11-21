# Changelog — Projeto Códice

## Regras de Versionamento Nominal e Semântico

Este projeto adota versionamento semântico (`MAJOR.MINOR.PATCH`) combinado a codinomes nominais para grandes marcos:

- **Pequenas atualizações / correções (`patch` / `minor`):** incrementam apenas os números (`4.1.1`, `4.1.2`, `4.2.0`), mantendo o codinome oficial atual.
- **Grandes atualizações (`major`):** recebem um novo codinome oficial (ex.: *Ymir 4.1.0*, *Odin 5.0.0*, *Alexandria 6.0.0*).

Automação via CLI (`scripts/bump-version.mjs`):

```bash
npm run version:patch
npm run version:minor
npm run version:major -- --name="Odin"
```

---

## [v4.2.0 · Ymir] — 2026-11

**Resumo:** Design System v2 com tokens em 3 camadas, ThemeEngine sem flash, fontes variáveis autohospedadas e motor gráfico nativo.

## [v4.1.1 · Ymir] — 2026-11

**Resumo:** Deploy contínuo Cloudflare Pages, novos temas, check-in rápido, roleta offline, coleções e cartões de perfil sem servidor.

## [v4.1.0 · Ymir] — 2026-11

**Resumo:** Motor híbrido local/nuvem, leitor imersivo, busca seletiva e rede literária.

- Sistema oficial de versionamento nominal e semântico (`src/config/versioning.js`, `scripts/bump-version.mjs` e painel de histórico da versão).
- Aceleração da busca na catalogação (`Google Books` por padrão no modo geral, `Jikan` em mangás e `CrossRef + OpenAlex` em acadêmicos), cache persistente em `localStorage` (`codice_search_cache_v2`), renderização progressiva imediata, timeout de `4500ms` e debounce de `220ms` com sugestões rápidas.
- Blindagem do cliente Google Gemini (`geminiApi.js`) com sanitização de chave, fallback sequencial entre até 3 modelos estáveis, extração resiliente de JSON, mensagens de erro acionáveis, botão **Testar Conexão** e preenchimento inteligente local quando offline.
- Upload direto de leitura (**+ Adicionar Arquivo para Ler**) no hub **Continuar Lendo**, seção **Indicações para Sua Próxima Leitura** na Home e botão **Indicar Livro** na ficha da obra.
- Identidade dinâmica do leitor (137 títulos e Título Vivo por CDD/gênero) e rede literária híbrida com mural, feed, seguimento e chat 1:1 com anexo de livros.

## [v4.0.0] — 2026-10

- Schema relacional `4.0-codice-sql`, títulos bilíngues PT-BR/Original, progresso por percentual/Kindle Loc, estante digital offline e backup assinado com SHA-256.

## [v3.0.0] — 2026-09

- Leitor integrado em IndexedDB (`PDF`, `EPUB`, `CBZ`, `TXT` e `Markdown`), sugestão CDD/Cutter, exportação BibTeX/CSV e temas com contraste WCAG 2.2 AA.
