# Auditoria de UX e Acessibilidade — Projeto Códice (`v4.17.0`)

Auditoria automatizada e revisão estrutural executada após as melhorias da Fase 16 em navegador headless Chromium (`scripts/audit-a11y.mjs`, `scripts/validate-contrast.mjs` e `scripts/smoke-visual.mjs`).

## 1. Estrutura Semântica, Navegação e Teclado
- **Idioma e Landmarks:** `<html lang="pt-BR">`, skip-link funcional (`a[href="#main-content"]`) focável via `Tab`, marco principal `<main id="main-content" tabindex="-1">` e barra `<nav>` identificados corretamente.
- **Região Viva:** Mudanças de aba anunciadas em `aria-live="polite"` no componente raiz (`src/App.jsx`).
- **Diálogos e Atalhos:** Teste automatizado de abertura do guia de atalhos (`?`) e fechamento via `Escape` aprovado (`shortcutDialogPassed: true`), sem erros de página (`pageErrors: []`).

## 2. Varredura DOM em Todas as 6 Rotas Principais (`1280x800`)
| Tela | Botões visíveis inspecionados | Botões sem rótulo acessível | Imagens sem `alt` | Cabeçalhos (`h1-h3`) |
| --- | ---: | ---: | ---: | ---: |
| Início (`home`) | 30 | 0 | 0 | 9 |
| Acervo (`list`) | 11 | 0 | 0 | 1 |
| Catalogar (`add`) | 27 | 0 | 0 | 9 |
| Métricas (`stats`) | 10 | 0 | 0 | 8 |
| Rede (`community`) | 17 | 0 | 0 | 3 |
| Perfil (`profile`) | 19 | 0 | 0 | 1 |
| **Total** | **114** | **0** | **0** | **31** |

## 3. Legibilidade, Daltonismo e Resiliência Offline
- **3 Escalas de Fonte Globais:** `Padrão`, `Grande` (`112%`) e `Extra` (`124%`) via atributo `data-font-scale` no elemento raiz.
- **Modo Dislexia:** Espaçamento ampliado entre letras (`0.03em`), palavras (`0.08em`) e entrelinhas (`1.68`) via `data-dyslexia="true"`.
- **Daltonismo:** Badges de status (`StatusBadge.jsx`) combinam cor, rótulo textual e ícone de forma geométrica distinta (`BookOpen`, `CheckCircle2`, `Clock`, `PauseCircle`); mapa de calor usa SVG com padrões geométricos (`<pattern>`) nos níveis de intensidade.
- **PWA e Armazenamento:** Service Worker configurado em `registerType: 'prompt'` com aviso discreto *"Nova versão disponível — Atualizar"* e detecção preventiva de modo privado / IndexedDB indisponível.
