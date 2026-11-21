import { X } from 'lucide-react';
import { useState } from 'react';
import { READER_THEMES } from '../../utils/readerThemes';
import {
  isReaderPageChimeEnabled,
  playTactilePageChime,
  setReaderPageChimeEnabled,
} from '../../utils/soundEffects';
import { FONT_PRESETS } from '../../utils/themeTokens';

function SettingRow({ label, hint, children }) {
  return (
    <div
      className="flex items-center justify-between gap-4 border-b py-3 last:border-b-0"
      style={{ borderColor: 'var(--reader-border)' }}
    >
      <div className="min-w-0">
        <span
          className="block text-xs font-medium"
          style={{ color: 'var(--reader-ink)' }}
        >
          {label}
        </span>
        {hint && (
          <span
            className="mt-0.5 block text-[11px]"
            style={{ color: 'var(--reader-muted)' }}
          >
            {hint}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center justify-end">{children}</div>
    </div>
  );
}

function SegmentedTextControl({ options, value, onChange }) {
  return (
    <div
      className="inline-flex overflow-hidden rounded-[4px] border"
      style={{ borderColor: 'var(--reader-border)' }}
    >
      {options.map((opt, idx) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className="min-h-[40px] px-2.5 text-xs font-medium transition-colors duration-150 ease-out"
            style={{
              backgroundColor: active ? 'var(--reader-surface)' : 'transparent',
              color: active ? 'var(--reader-accent)' : 'var(--reader-muted)',
              borderLeft: idx > 0 ? '1px solid var(--reader-border)' : 'none',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function AlignedSlider({ ariaLabel, min, max, step, value, formatValue, onChange }) {
  return (
    <div className="flex w-44 sm:w-52 items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={ariaLabel}
        className="codice-reader-slider flex-1"
        style={{ backgroundColor: 'var(--reader-border)' }}
      />
      <span
        className="w-11 shrink-0 text-right text-xs tabular-nums"
        style={{ color: 'var(--reader-muted)' }}
      >
        {formatValue(value)}
      </span>
    </div>
  );
}

export function ReaderSettings({
  isOpen,
  onClose,
  format = 'epub',
  settings,
  onUpdateSettings,
}) {
  const [pageChimeOn, setPageChimeOn] = useState(isReaderPageChimeEnabled);
  if (!isOpen) return null;

  const isFlowTextFormat =
    format === 'epub' || format === 'txt' || format === 'markdown';
  const isPdf = format === 'pdf';
  const isCbz = format === 'cbz';
  const isSepia = settings.theme === 'sepia';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-end p-0"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.22)' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ajustes de leitura ao vivo"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[65vh] sm:max-h-full sm:h-full w-full sm:w-[380px] overflow-y-auto rounded-t-[6px] sm:rounded-none border-t sm:border-t-0 sm:border-l px-5 py-4 no-scrollbar"
        style={{
          backgroundColor: 'var(--reader-bg)',
          color: 'var(--reader-ink)',
          borderColor: 'var(--reader-border)',
        }}
      >
        {/* Cabeçalho enxuto */}
        <div
          className="flex items-center justify-between border-b pb-3"
          style={{ borderColor: 'var(--reader-border)' }}
        >
          <h2 className="text-sm font-semibold tracking-tight">Ajustes de leitura</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar ajustes"
            className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-[4px] transition-colors duration-150 ease-out"
            style={{ color: 'var(--reader-muted)' }}
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* 5 Atmosferas de Leitura (amostras planas de 24px + nome abaixo) */}
        <div
          className="border-b py-4"
          style={{ borderColor: 'var(--reader-border)' }}
        >
          <p
            className="mb-3 text-xs font-medium"
            style={{ color: 'var(--reader-muted)' }}
          >
            Atmosfera de leitura
          </p>
          <div className="grid grid-cols-5 gap-2">
            {READER_THEMES.map((theme) => {
              const isSelected = settings.theme === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => onUpdateSettings({ theme: theme.id })}
                  aria-pressed={isSelected}
                  className="flex min-h-[44px] flex-col items-center justify-start gap-1.5 rounded-[4px] py-1 text-center transition-opacity duration-150 ease-out"
                >
                  <span
                    aria-hidden="true"
                    className="h-6 w-6 rounded-full border"
                    style={{
                      backgroundColor: theme.followApp ? 'var(--bg-app)' : theme.bg,
                      borderColor: 'var(--reader-border)',
                      outline: isSelected ? '2px solid var(--reader-accent)' : 'none',
                      outlineOffset: '2px',
                    }}
                  />
                  <span
                    className="text-[11px] leading-tight"
                    style={{
                      color: isSelected
                        ? 'var(--reader-accent)'
                        : 'var(--reader-muted)',
                      fontWeight: isSelected ? 600 : 400,
                    }}
                  >
                    {theme.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Lista alinhada: rótulo à esquerda, controle à direita */}
        <div>
          {isSepia && (
            <SettingRow
              label="Calor do sépia"
              hint="Ajusta a temperatura quente em tempo real"
            >
              <AlignedSlider
                ariaLabel="Intensidade do sépia"
                min={0}
                max={100}
                step={5}
                value={settings.sepiaWarmth ?? 50}
                formatValue={(v) => `${Math.round(v)}%`}
                onChange={(val) => onUpdateSettings({ sepiaWarmth: val })}
              />
            </SettingRow>
          )}

          <SettingRow label="Brilho ocular" hint="Suaviza a luminância da página">
            <AlignedSlider
              ariaLabel="Brilho e conforto ocular"
              min={50}
              max={100}
              step={5}
              value={settings.brightnessPct ?? 100}
              formatValue={(v) => `${Math.round(v)}%`}
              onChange={(val) => onUpdateSettings({ brightnessPct: val })}
            />
          </SettingRow>

          <SettingRow label="Régua de foco" hint="Destaca a faixa central de leitura">
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(settings.focusRuler)}
              onClick={() =>
                onUpdateSettings({ focusRuler: !settings.focusRuler })
              }
              className="min-h-[44px] rounded-[4px] border px-3 text-xs font-medium transition-colors duration-150 ease-out"
              style={{
                borderColor: settings.focusRuler
                  ? 'var(--reader-accent)'
                  : 'var(--reader-border)',
                color: settings.focusRuler
                  ? 'var(--reader-accent)'
                  : 'var(--reader-muted)',
                touchAction: 'manipulation',
              }}
            >
              {settings.focusRuler ? 'Ativa' : 'Desligada'}
            </button>
          </SettingRow>

          <SettingRow label="Som tátil de página" hint="Toque sutil sintetizado (opcional)">
            <button
              type="button"
              role="switch"
              aria-checked={pageChimeOn}
              onClick={() => {
                const next = !pageChimeOn;
                setPageChimeOn(next);
                setReaderPageChimeEnabled(next);
                if (next) playTactilePageChime();
              }}
              className="min-h-[44px] rounded-[4px] border px-3 text-xs font-medium transition-colors duration-150 ease-out"
              style={{
                borderColor: pageChimeOn
                  ? 'var(--reader-accent)'
                  : 'var(--reader-border)',
                color: pageChimeOn
                  ? 'var(--reader-accent)'
                  : 'var(--reader-muted)',
                touchAction: 'manipulation',
              }}
            >
              {pageChimeOn ? 'Ativo' : 'Silencioso'}
            </button>
          </SettingRow>

          <SettingRow
            label="Gestos de toque"
            hint="Toques laterais viram páginas; centro abre barras ou marca página"
          >
            <button
              type="button"
              role="switch"
              aria-checked={settings.touchGesturesEnabled !== false}
              onClick={() =>
                onUpdateSettings({
                  touchGesturesEnabled: !(settings.touchGesturesEnabled !== false),
                })
              }
              className="min-h-[44px] rounded-[4px] border px-3 text-xs font-medium transition-colors duration-150 ease-out"
              style={{
                borderColor:
                  settings.touchGesturesEnabled !== false
                    ? 'var(--reader-accent)'
                    : 'var(--reader-border)',
                color:
                  settings.touchGesturesEnabled !== false
                    ? 'var(--reader-accent)'
                    : 'var(--reader-muted)',
                touchAction: 'manipulation',
              }}
            >
              {settings.touchGesturesEnabled !== false ? 'Ativo' : 'Desligado'}
            </button>
          </SettingRow>

          {isFlowTextFormat && (
            <>
              <SettingRow label="Modo de leitura">
                <SegmentedTextControl
                  value={format === 'epub' ? settings.epubFlow : settings.textFlow}
                  options={[
                    { id: 'paginated', label: 'Paginado' },
                    { id: 'scrolled', label: 'Rolagem contínua' },
                  ]}
                  onChange={(val) =>
                    onUpdateSettings(
                      format === 'epub' ? { epubFlow: val } : { textFlow: val }
                    )
                  }
                />
              </SettingRow>

              <SettingRow label="Tamanho da fonte">
                <AlignedSlider
                  ariaLabel="Tamanho da fonte"
                  min={80}
                  max={200}
                  step={5}
                  value={settings.fontSizePct}
                  formatValue={(v) => `${v}%`}
                  onChange={(val) => onUpdateSettings({ fontSizePct: val })}
                />
              </SettingRow>

              <SettingRow label="Entrelinha">
                <AlignedSlider
                  ariaLabel="Entrelinha"
                  min={1.35}
                  max={2.1}
                  step={0.05}
                  value={settings.lineHeight}
                  formatValue={(v) => v.toFixed(2)}
                  onChange={(val) => onUpdateSettings({ lineHeight: val })}
                />
              </SettingRow>

              <SettingRow label="Espaço entre parágrafos">
                <AlignedSlider
                  ariaLabel="Espaçamento de parágrafos"
                  min={0.4}
                  max={1.8}
                  step={0.2}
                  value={settings.paragraphSpacing}
                  formatValue={(v) => `${v.toFixed(1)}em`}
                  onChange={(val) => onUpdateSettings({ paragraphSpacing: val })}
                />
              </SettingRow>

              <SettingRow label="Margens e largura">
                <SegmentedTextControl
                  value={settings.marginLevel}
                  options={[
                    { id: 'compact', label: 'Estreita' },
                    { id: 'comfortable', label: 'Conforto' },
                    { id: 'wide', label: 'Ampla' },
                  ]}
                  onChange={(val) => onUpdateSettings({ marginLevel: val })}
                />
              </SettingRow>

              <SettingRow label="Alinhamento e hifenização">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateSettings({ justify: !settings.justify })
                    }
                    className="min-h-[40px] rounded-[4px] border px-2.5 text-xs font-medium transition-colors duration-150 ease-out"
                    style={{
                      borderColor: settings.justify
                        ? 'var(--reader-accent)'
                        : 'var(--reader-border)',
                      color: settings.justify
                        ? 'var(--reader-accent)'
                        : 'var(--reader-muted)',
                    }}
                  >
                    Justificado
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateSettings({ hyphenation: !settings.hyphenation })
                    }
                    className="min-h-[40px] rounded-[4px] border px-2.5 text-xs font-medium transition-colors duration-150 ease-out"
                    style={{
                      borderColor: settings.hyphenation
                        ? 'var(--reader-accent)'
                        : 'var(--reader-border)',
                      color: settings.hyphenation
                        ? 'var(--reader-accent)'
                        : 'var(--reader-muted)',
                    }}
                  >
                    Hifenizado
                  </button>
                </div>
              </SettingRow>

              {/* Seletor das 10 Tipografias em lista compacta */}
              <div className="pt-4 pb-2">
                <p
                  className="mb-2 text-xs font-medium"
                  style={{ color: 'var(--reader-muted)' }}
                >
                  Tipografia
                </p>
                <div
                  className="divide-y border-y"
                  style={{ borderColor: 'var(--reader-border)' }}
                >
                  {FONT_PRESETS.map((f) => {
                    const isSelected = settings.fontId === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => onUpdateSettings({ fontId: f.id })}
                        style={{
                          fontFamily: f.cssValue,
                          borderColor: 'var(--reader-border)',
                          color: isSelected
                            ? 'var(--reader-accent)'
                            : 'var(--reader-ink)',
                        }}
                        className="flex min-h-[40px] w-full items-center justify-between py-2 text-left text-xs transition-colors duration-150 ease-out"
                      >
                        <span className="truncate">{f.label}</span>
                        <span
                          className="ml-3 shrink-0 text-[11px]"
                          style={{
                            fontFamily: 'var(--font-app)',
                            color: isSelected
                              ? 'var(--reader-accent)'
                              : 'var(--reader-muted)',
                          }}
                        >
                          {isSelected ? 'ativa' : 'Aa'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {isPdf && (
            <>
              <SettingRow label="Fluxo de páginas">
                <SegmentedTextControl
                  value={settings.pdfMode}
                  options={[
                    { id: 'single', label: 'Paginado' },
                    { id: 'continuous', label: 'Rolagem contínua' },
                  ]}
                  onChange={(val) => onUpdateSettings({ pdfMode: val })}
                />
              </SettingRow>

              <SettingRow label="Ajuste de zoom">
                <SegmentedTextControl
                  value={settings.pdfZoomMode}
                  options={[
                    { id: 'fit-width', label: 'Largura' },
                    { id: 'fit-page', label: 'Página' },
                    { id: 'custom', label: `${Math.round(settings.pdfZoomScale * 100)}%` },
                  ]}
                  onChange={(val) => onUpdateSettings({ pdfZoomMode: val })}
                />
              </SettingRow>

              <SettingRow label="Escala do PDF">
                <AlignedSlider
                  ariaLabel="Escala de zoom do PDF"
                  min={0.5}
                  max={3}
                  step={0.1}
                  value={settings.pdfZoomScale}
                  formatValue={(v) => `${Math.round(v * 100)}%`}
                  onChange={(val) =>
                    onUpdateSettings({ pdfZoomMode: 'custom', pdfZoomScale: val })
                  }
                />
              </SettingRow>

              <SettingRow label="Leitura noturna e miniaturas">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateSettings({ pdfNightMode: !settings.pdfNightMode })
                    }
                    className="min-h-[40px] rounded-[4px] border px-2.5 text-xs font-medium transition-colors duration-150 ease-out"
                    style={{
                      borderColor: settings.pdfNightMode
                        ? 'var(--reader-accent)'
                        : 'var(--reader-border)',
                      color: settings.pdfNightMode
                        ? 'var(--reader-accent)'
                        : 'var(--reader-muted)',
                    }}
                  >
                    Inverter PDF
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateSettings({ pdfThumbnails: !settings.pdfThumbnails })
                    }
                    className="min-h-[40px] rounded-[4px] border px-2.5 text-xs font-medium transition-colors duration-150 ease-out"
                    style={{
                      borderColor: settings.pdfThumbnails
                        ? 'var(--reader-accent)'
                        : 'var(--reader-border)',
                      color: settings.pdfThumbnails
                        ? 'var(--reader-accent)'
                        : 'var(--reader-muted)',
                    }}
                  >
                    Miniaturas
                  </button>
                </div>
              </SettingRow>
            </>
          )}

          {isCbz && (
            <>
              <SettingRow label="Layout">
                <SegmentedTextControl
                  value={settings.cbzMode}
                  options={[
                    { id: 'single', label: 'Única' },
                    { id: 'double', label: 'Dupla' },
                    { id: 'webtoon', label: 'Webtoon' },
                  ]}
                  onChange={(val) => onUpdateSettings({ cbzMode: val })}
                />
              </SettingRow>

              <SettingRow label="Direção">
                <SegmentedTextControl
                  value={settings.cbzDirection}
                  options={[
                    { id: 'ltr', label: 'Ocidental' },
                    { id: 'rtl', label: 'Mangá RTL' },
                  ]}
                  onChange={(val) => onUpdateSettings({ cbzDirection: val })}
                />
              </SettingRow>

              <SettingRow label="Ajuste de imagem">
                <SegmentedTextControl
                  value={settings.cbzFit}
                  options={[
                    { id: 'width', label: 'Largura' },
                    { id: 'height', label: 'Altura' },
                    { id: 'original', label: 'Original' },
                  ]}
                  onChange={(val) => onUpdateSettings({ cbzFit: val })}
                />
              </SettingRow>

              <SettingRow label="Contraste e filtro visual">
                <SegmentedTextControl
                  value={settings.cbzFilter || 'none'}
                  options={[
                    { id: 'none', label: 'Original' },
                    { id: 'sumi-eink', label: 'E-Ink Sumi' },
                    { id: 'night-inverted', label: 'Noturno' },
                  ]}
                  onChange={(val) => onUpdateSettings({ cbzFilter: val })}
                />
              </SettingRow>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
