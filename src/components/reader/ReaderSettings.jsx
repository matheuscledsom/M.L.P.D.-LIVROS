import { AlignJustify, Check, Moon, Sun, Type, X } from 'lucide-react';
import { FONT_PRESETS } from '../../utils/themeTokens';
import { READER_THEMES } from './useReaderProgress';

export function ReaderSettings({
  isOpen,
  onClose,
  format = 'epub',
  settings,
  onUpdateSettings,
}) {
  if (!isOpen) return null;

  const isFlowTextFormat =
    format === 'epub' || format === 'txt' || format === 'markdown';
  const isPdf = format === 'pdf';
  const isCbz = format === 'cbz';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-line bg-card p-5 pb-8 shadow-2xl no-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Type className="h-4 w-4 text-accent" strokeWidth={1.5} />
            <h2 className="text-sm font-semibold text-ink">
              Ajustes de Leitura
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar ajustes"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-muted hover:bg-elevated hover:text-ink"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Temas do Leitor (pré-visualização ao vivo) */}
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-muted">Tema do Leitor</p>
          <div className="grid grid-cols-3 gap-2">
            {READER_THEMES.map((theme) => {
              const isSelected = settings.theme === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => onUpdateSettings({ theme: theme.id })}
                  className={`flex min-h-[44px] items-center justify-between gap-1.5 rounded-xl border px-2.5 py-2 text-left text-[11px] font-medium transition-colors ${
                    isSelected
                      ? 'border-accent bg-accent/15 text-ink'
                      : 'border-line bg-app text-muted hover:text-ink'
                  }`}
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span
                      aria-hidden="true"
                      className="h-3.5 w-3.5 shrink-0 rounded-full border border-line"
                      style={{ background: theme.bg }}
                    />
                    <span className="truncate">{theme.label}</span>
                  </span>
                  {isSelected && (
                    <Check className="h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={1.5} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Controles para EPUB / TXT / Markdown */}
        {isFlowTextFormat && (
          <div className="mt-5 space-y-4">
            {format === 'epub' && (
              <div>
                <p className="mb-2 text-xs font-medium text-muted">
                  Modo de Exibição
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'paginated', label: 'Paginado (Colunas)' },
                    { id: 'scrolled', label: 'Rolagem Contínua' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onUpdateSettings({ epubFlow: opt.id })}
                      className={`min-h-[44px] rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                        settings.epubFlow === opt.id
                          ? 'border-accent bg-accent/15 text-ink'
                          : 'border-line bg-app text-muted hover:text-ink'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(format === 'txt' || format === 'markdown') && (
              <div>
                <p className="mb-2 text-xs font-medium text-muted">
                  Modo de Exibição
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'scrolled', label: 'Rolagem Contínua' },
                    { id: 'paginated', label: 'Por Capítulos / Seções' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onUpdateSettings({ textFlow: opt.id })}
                      className={`min-h-[44px] rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                        settings.textFlow === opt.id
                          ? 'border-accent bg-accent/15 text-ink'
                          : 'border-line bg-app text-muted hover:text-ink'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 10 Fontes Editoriais */}
            <div>
              <p className="mb-2 text-xs font-medium text-muted">Tipografia</p>
              <div className="grid grid-cols-2 gap-1.5">
                {FONT_PRESETS.map((f) => {
                  const isSelected = settings.fontId === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => onUpdateSettings({ fontId: f.id })}
                      style={{ fontFamily: f.cssValue }}
                      className={`flex min-h-[44px] items-center justify-between rounded-xl border px-2.5 py-2 text-left text-xs transition-colors ${
                        isSelected
                          ? 'border-accent bg-accent/15 text-ink font-semibold'
                          : 'border-line bg-app text-muted hover:text-ink'
                      }`}
                    >
                      <span className="truncate">{f.shortLabel}</span>
                      {isSelected && (
                        <Check className="h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={1.5} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tamanho da fonte 80-200% */}
            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="font-medium text-muted">Tamanho da Fonte</span>
                <span className="font-semibold text-accent tabular-nums">
                  {settings.fontSizePct}%
                </span>
              </div>
              <input
                type="range"
                min="80"
                max="200"
                step="5"
                value={settings.fontSizePct}
                onChange={(e) =>
                  onUpdateSettings({ fontSizePct: Number(e.target.value) })
                }
                aria-label="Tamanho da fonte"
                className="h-1 w-full cursor-pointer accent-accent"
              />
            </div>

            {/* Entrelinha e Espaçamento de parágrafo */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="text-muted">Entrelinha</span>
                  <span className="font-semibold text-ink tabular-nums">
                    {settings.lineHeight.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="1.35"
                  max="2.1"
                  step="0.05"
                  value={settings.lineHeight}
                  onChange={(e) =>
                    onUpdateSettings({ lineHeight: Number(e.target.value) })
                  }
                  aria-label="Entrelinha"
                  className="h-1 w-full cursor-pointer accent-accent"
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="text-muted">Parágrafos</span>
                  <span className="font-semibold text-ink tabular-nums">
                    {settings.paragraphSpacing.toFixed(1)}em
                  </span>
                </div>
                <input
                  type="range"
                  min="0.4"
                  max="1.8"
                  step="0.2"
                  value={settings.paragraphSpacing}
                  onChange={(e) =>
                    onUpdateSettings({ paragraphSpacing: Number(e.target.value) })
                  }
                  aria-label="Espaçamento de parágrafos"
                  className="h-1 w-full cursor-pointer accent-accent"
                />
              </div>
            </div>

            {/* Margens */}
            <div>
              <p className="mb-2 text-xs font-medium text-muted">Margens</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'compact', label: 'Estreita' },
                  { id: 'comfortable', label: 'Conforto' },
                  { id: 'wide', label: 'Ampla' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onUpdateSettings({ marginLevel: opt.id })}
                    className={`min-h-[44px] rounded-xl border px-2 py-2 text-xs font-medium transition-colors ${
                      settings.marginLevel === opt.id
                        ? 'border-accent bg-accent/15 text-ink'
                        : 'border-line bg-app text-muted hover:text-ink'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Alinhamento justificado + hifenização */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onUpdateSettings({ justify: !settings.justify })}
                className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                  settings.justify
                    ? 'border-accent bg-accent/15 text-ink'
                    : 'border-line bg-app text-muted hover:text-ink'
                }`}
              >
                <AlignJustify className="h-4 w-4 text-accent" strokeWidth={1.5} />
                Justificado
              </button>

              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({ hyphenation: !settings.hyphenation })
                }
                className={`min-h-[44px] rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                  settings.hyphenation
                    ? 'border-accent bg-accent/15 text-ink'
                    : 'border-line bg-app text-muted hover:text-ink'
                }`}
              >
                Hifenização
              </button>
            </div>
          </div>
        )}

        {/* Controles para PDF */}
        {isPdf && (
          <div className="mt-5 space-y-4">
            <div>
              <p className="mb-2 text-xs font-medium text-muted">Modo de Página</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'single', label: 'Página Única' },
                  { id: 'continuous', label: 'Rolagem Contínua' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onUpdateSettings({ pdfMode: opt.id })}
                    className={`min-h-[44px] rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                      settings.pdfMode === opt.id
                        ? 'border-accent bg-accent/15 text-ink'
                        : 'border-line bg-app text-muted hover:text-ink'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-muted">Zoom</p>
              <div className="grid grid-cols-3 gap-2 mb-2">
                {[
                  { id: 'fit-width', label: 'Largura' },
                  { id: 'fit-page', label: 'Página' },
                  { id: 'custom', label: `${Math.round(settings.pdfZoomScale * 100)}%` },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onUpdateSettings({ pdfZoomMode: opt.id })}
                    className={`min-h-[44px] rounded-xl border px-2 py-2 text-xs font-medium transition-colors ${
                      settings.pdfZoomMode === opt.id
                        ? 'border-accent bg-accent/15 text-ink'
                        : 'border-line bg-app text-muted hover:text-ink'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.1"
                value={settings.pdfZoomScale}
                onChange={(e) =>
                  onUpdateSettings({
                    pdfZoomMode: 'custom',
                    pdfZoomScale: Number(e.target.value),
                  })
                }
                aria-label="Escala de zoom do PDF"
                className="h-1 w-full cursor-pointer accent-accent"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({ pdfNightMode: !settings.pdfNightMode })
                }
                className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                  settings.pdfNightMode
                    ? 'border-accent bg-accent/15 text-ink'
                    : 'border-line bg-app text-muted hover:text-ink'
                }`}
              >
                {settings.pdfNightMode ? (
                  <Moon className="h-4 w-4 text-accent" strokeWidth={1.5} />
                ) : (
                  <Sun className="h-4 w-4 text-accent" strokeWidth={1.5} />
                )}
                Modo Noite PDF
              </button>

              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({ pdfThumbnails: !settings.pdfThumbnails })
                }
                className={`min-h-[44px] rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                  settings.pdfThumbnails
                    ? 'border-accent bg-accent/15 text-ink'
                    : 'border-line bg-app text-muted hover:text-ink'
                }`}
              >
                Miniaturas
              </button>
            </div>
          </div>
        )}

        {/* Controles para CBZ / Mangá / HQ */}
        {isCbz && (
          <div className="mt-5 space-y-4">
            <div>
              <p className="mb-2 text-xs font-medium text-muted">Layout de Páginas</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'single', label: 'Única' },
                  { id: 'double', label: 'Dupla' },
                  { id: 'webtoon', label: 'Webtoon' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onUpdateSettings({ cbzMode: opt.id })}
                    className={`min-h-[44px] rounded-xl border px-2 py-2 text-xs font-medium transition-colors ${
                      settings.cbzMode === opt.id
                        ? 'border-accent bg-accent/15 text-ink'
                        : 'border-line bg-app text-muted hover:text-ink'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-muted">Direção de Leitura</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'ltr', label: 'Ocidental (LTR)' },
                  { id: 'rtl', label: 'Mangá (RTL)' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onUpdateSettings({ cbzDirection: opt.id })}
                    className={`min-h-[44px] rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                      settings.cbzDirection === opt.id
                        ? 'border-accent bg-accent/15 text-ink'
                        : 'border-line bg-app text-muted hover:text-ink'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-muted">Ajuste de Imagem</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'width', label: 'Largura' },
                  { id: 'height', label: 'Altura' },
                  { id: 'original', label: 'Original' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onUpdateSettings({ cbzFit: opt.id })}
                    className={`min-h-[44px] rounded-xl border px-2 py-2 text-xs font-medium transition-colors ${
                      settings.cbzFit === opt.id
                        ? 'border-accent bg-accent/15 text-ink'
                        : 'border-line bg-app text-muted hover:text-ink'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
