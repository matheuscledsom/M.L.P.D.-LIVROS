import { Check, Layers, Palette, RotateCcw, Sparkles, Type, X } from 'lucide-react';
import {
  EDITORIAL_PRESETS,
  FONT_PRESETS,
  TEXTURE_OPTIONS,
  THEME_MODES,
} from '../hooks/useTheme';

export function ThemeModal({
  isOpen,
  onClose,
  mode,
  font,
  texture = 'clean',
  presetId,
  bgColor,
  accentColor,
  hasCustomBg,
  onSelectMode,
  onSelectFont,
  onSelectTexture,
  onApplyPreset,
  onChangeBgColor,
  onChangeAccentColor,
  onResetTheme,
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl border-x border-t border-line bg-card p-5 pb-8 shadow-2xl no-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-accent" />
            <h3 className="text-base font-semibold text-ink">
              Estúdio Editorial
            </h3>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onResetTheme}
              title="Restaurar padrão"
              className="inline-flex items-center gap-1 rounded-full border border-line bg-app px-2.5 py-1 text-[10px] font-medium text-muted hover:text-ink"
            >
              <RotateCcw className="h-3 w-3 text-accent" />
              Padrão
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="rounded-full p-1 text-muted hover:bg-elevated hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 10 Tipografias Globais */}
        <div className="mt-5">
          <p className="mb-2.5 flex items-center gap-1.5 text-xs font-medium text-muted">
            <Type className="h-4 w-4 text-accent" strokeWidth={1.5} />
            Tipografia Global (10 Fontes)
          </p>
          <div className="grid grid-cols-2 gap-2">
            {FONT_PRESETS.map((f) => {
              const isSelected = font === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onSelectFont(f.id)}
                  style={{ fontFamily: f.cssValue }}
                  className={`flex min-h-[44px] items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    isSelected
                      ? 'border-accent bg-accent/15 text-ink'
                      : 'border-line bg-app text-muted hover:text-ink'
                  }`}
                >
                  <div className="min-w-0">
                    <span className="block truncate text-xs font-semibold text-ink">
                      {f.shortLabel}
                    </span>
                    <span className="mt-0.5 block truncate text-[10px] text-subtle">
                      Abc · {f.fontName}
                    </span>
                  </div>
                  {isSelected && (
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink">
                      <Check className="h-3 w-3" strokeWidth={1.5} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3 Atmosferas Base */}
        <div className="mt-5">
          <p className="mb-2.5 text-xs font-medium text-muted">
            Atmosferas Base
          </p>
          <div className="grid grid-cols-3 gap-2">
            {THEME_MODES.map((m) => {
              const isSelected = !hasCustomBg && !presetId && mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onSelectMode(m.id)}
                  className={`flex flex-col items-center gap-2 rounded-2xl border p-2.5 transition-all ${
                    isSelected
                      ? 'border-accent bg-accent/10'
                      : 'border-line bg-app hover:border-muted/50'
                  }`}
                >
                  <div
                    className="flex h-10 w-full items-end justify-between rounded-xl border border-black/15 p-1.5"
                    style={{ backgroundColor: m.previewBg }}
                  >
                    <span
                      className="h-3 w-8 rounded"
                      style={{ backgroundColor: m.previewCard }}
                    />
                    {isSelected && (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent text-accent-ink">
                        <Check className="h-2.5 w-2.5" />
                      </span>
                    )}
                  </div>
                  <span className="line-clamp-2 text-center text-[10px] font-medium leading-tight text-ink">
                    {m.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Textura de Ambiente */}
        <div className="mt-5">
          <p className="mb-2.5 flex items-center gap-1.5 text-xs font-medium text-muted">
            <Layers className="h-3.5 w-3.5 text-accent" />
            Textura de Ambiente
          </p>
          <div className="grid grid-cols-2 gap-2">
            {TEXTURE_OPTIONS.map((tex) => {
              const isSelected = texture === tex.id;
              return (
                <button
                  key={tex.id}
                  type="button"
                  onClick={() => onSelectTexture?.(tex.id)}
                  className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left text-[11px] font-medium transition-colors ${
                    isSelected
                      ? 'border-accent bg-accent/15 text-ink'
                      : 'border-line bg-app text-muted hover:text-ink'
                  }`}
                >
                  <span>{tex.label}</span>
                  {isSelected && <Check className="h-3 w-3 text-accent" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Seletores Livres (Color Picker) */}
        <div className="mt-5">
          <p className="mb-2.5 text-xs font-medium text-muted">
            Cores Personalizadas
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <label className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-line bg-app px-3 py-2.5 transition-colors hover:border-accent/50">
              <div className="min-w-0">
                <span className="block text-[11px] font-medium text-ink">
                  Cor de Fundo
                </span>
                <span className="block text-[10px] font-mono text-subtle">
                  {bgColor}
                </span>
              </div>
              <input
                type="color"
                value={bgColor}
                onChange={(e) => onChangeBgColor(e.target.value)}
                aria-label="Selecionar cor de fundo"
                className="h-7 w-7 shrink-0 cursor-pointer overflow-hidden rounded-full border border-line bg-transparent p-0"
              />
            </label>

            <label className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-line bg-app px-3 py-2.5 transition-colors hover:border-accent/50">
              <div className="min-w-0">
                <span className="block text-[11px] font-medium text-ink">
                  Destaque / Ícones
                </span>
                <span className="block text-[10px] font-mono text-subtle">
                  {accentColor}
                </span>
              </div>
              <input
                type="color"
                value={accentColor}
                onChange={(e) => onChangeAccentColor(e.target.value)}
                aria-label="Selecionar cor de destaque e ícones"
                className="h-7 w-7 shrink-0 cursor-pointer overflow-hidden rounded-full border border-line bg-transparent p-0"
              />
            </label>
          </div>
        </div>

        {/* 22 Presets Temáticos */}
        <div className="mt-5">
          <p className="mb-2.5 flex items-center gap-1.5 text-xs font-medium text-muted">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            22 Presets Temáticos
          </p>
          <div className="grid grid-cols-2 gap-2">
            {EDITORIAL_PRESETS.map((preset) => {
              const isSelected = presetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onApplyPreset(preset.id)}
                  className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition-colors ${
                    isSelected
                      ? 'border-accent bg-accent/15 text-ink'
                      : 'border-line bg-app text-muted hover:text-ink'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="h-5 w-5 shrink-0 rounded-full border border-white/20 shadow-xs"
                    style={{
                      background: `linear-gradient(135deg, ${preset.bg} 50%, ${preset.accent} 50%)`,
                    }}
                  />
                  <span className="truncate text-[11px]">{preset.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
