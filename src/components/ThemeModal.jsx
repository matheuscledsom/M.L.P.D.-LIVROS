import { Check, X } from 'lucide-react';
import { domainConfig } from '../config/domainConfig';
import { ACCENT_PRESETS, THEME_MODES } from '../hooks/useTheme';

export function ThemeModal({ isOpen, onClose, mode, accent, onSelectMode, onSelectAccent }) {
  if (!isOpen) return null;

  const { theme } = domainConfig.ui;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl border-x border-t border-line bg-card p-5 pb-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />

        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-ink">{theme.title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={theme.closeLabel}
            className="rounded-full p-1 text-muted hover:bg-elevated hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5">
          <p className="mb-2.5 text-xs font-medium text-muted">
            {theme.modeLabel}
          </p>
          <div className="grid grid-cols-3 gap-2.5">
            {THEME_MODES.map((m) => {
              const isSelected = mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onSelectMode(m.id)}
                  className={`flex flex-col items-center gap-2 rounded-2xl border p-3 transition-all ${
                    isSelected
                      ? 'border-accent bg-accent/10'
                      : 'border-line bg-app hover:border-muted/50'
                  }`}
                >
                  <div
                    className="flex h-10 w-full items-end justify-between rounded-xl border border-black/10 p-1.5"
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
                  <span className="text-[11px] font-medium text-ink">
                    {m.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5">
          <p className="mb-2.5 text-xs font-medium text-muted">
            {theme.accentLabel}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {ACCENT_PRESETS.map((preset) => {
              const isSelected = accent === preset.id;
              const swatchColor =
                mode === 'light' && preset.lightColor
                  ? preset.lightColor
                  : preset.color;

              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onSelectAccent(preset.id)}
                  className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition-colors ${
                    isSelected
                      ? 'border-accent bg-accent/10 text-ink'
                      : 'border-line bg-app text-muted hover:text-ink'
                  }`}
                >
                  <span
                    className="h-4 w-4 shrink-0 rounded-full border border-white/20 shadow-xs"
                    style={{ backgroundColor: swatchColor }}
                  />
                  <span className="truncate">{preset.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
