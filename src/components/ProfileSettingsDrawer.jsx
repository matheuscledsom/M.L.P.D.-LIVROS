import {
  BookMarked,
  BookOpen,
  Check,
  Cloud,
  Database,
  FileSpreadsheet,
  Globe,
  HardDrive,
  Lock,
  MessageSquare,
  MessagesSquare,
  Palette,
  PenLine,
  Settings,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Upload,
  Users,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { domainConfig } from '../config/domainConfig';
import { CODICE_RELEASE } from '../config/versioning';
import {
  CRITERION_OPTIONS,
  FOCUS_OPTIONS_META,
  GENRE_OPTIONS,
  normalizeFavoriteGenres,
  normalizePreferredCriteria,
  toggleCriterionInList,
} from '../utils/readerPreferences';
import { SPECIAL_THEMES } from '../data/themePresets';
import { PastelPaletteCustomizer } from './ThemeModal';

const VISIBILITY_OPTIONS = [
  {
    id: 'public',
    label: 'Público',
    description: 'Qualquer leitor no Códice pode ver seu perfil e estante.',
    icon: Globe,
  },
  {
    id: 'followers',
    label: 'Apenas Seguidores',
    description: 'Somente quem segue você acompanha suas atividades.',
    icon: Users,
  },
  {
    id: 'private',
    label: 'Privado',
    description: 'Arquivo pessoal reservado apenas para você.',
    icon: Lock,
  },
];

function PrivacySwitchRow({ icon: Icon, label, description, checked, onToggle }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onToggle}
      className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-[4px] border border-line bg-app px-3 py-2.5 text-left transition-colors hover:border-accent/50"
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={1.5} />
        <div className="min-w-0">
          <span className="block text-xs font-medium text-ink">{label}</span>
          {description && (
            <span className="mt-0.5 block text-[11px] leading-snug text-muted">
              {description}
            </span>
          )}
        </div>
      </div>

      <span
        aria-hidden="true"
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors ${
          checked ? 'border-accent bg-accent' : 'border-line bg-elevated'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full transition-transform ${
            checked ? 'translate-x-5.5 bg-accent-ink' : 'translate-x-1 bg-subtle'
          }`}
        />
      </span>
    </button>
  );
}

export function ProfileSettingsDrawer({
  isOpen,
  onClose,
  returnFocusRef = null,
  profile,
  backendSession = null,
  soundOn = false,
  onToggleSound,
  onOpenAuthModal,
  onUpdateProfile,
  onOpenThemeStudio,
  themeProps = null,
  onReopenOnboarding,
  onOpenGeminiSettings,
  onExportBackup,
  onExportCsv,
  onExportBibtex,
  onImportBackupClick,
  onOpenBackupModal,
  aiPanelSlot = null,
}) {
  const drawerRef = useRef(null);
  const closeBtnRef = useRef(null);
  const [prefsExpanded, setPrefsExpanded] = useState(true);
  const { ui } = domainConfig;
  const { profile: profileCfg } = ui;

  const isSupabaseMode = backendSession?.mode === 'supabase';
  const gamificationEnabled = profile?.gamificationEnabled !== false;
  const privacyLevel = profile?.privacyLevel || 'public';
  const activeVisibilityMeta =
    VISIBILITY_OPTIONS.find((opt) => opt.id === privacyLevel) ||
    VISIBILITY_OPTIONS[0];
  const selectedCriteria = normalizePreferredCriteria(
    profile?.preferredCriteria ?? profile?.preferred_criteria,
    profile?.preferredCriterion ?? profile?.preferred_criterion
  );
  const selectedGenres = normalizeFavoriteGenres(profile?.favoriteGenres);
  const selectedFocus = profile?.readerFocus || 'Leitor Casual';

  const handleToggleCriterion = (criterion) => {
    const next = toggleCriterionInList(selectedCriteria, criterion);
    onUpdateProfile?.({
      preferredCriteria: next,
      preferredCriterion: next.join(', '),
    });
  };

  const handleToggleGenre = (genre) => {
    const next = selectedGenres.includes(genre)
      ? selectedGenres.filter((g) => g !== genre)
      : [...selectedGenres, genre];
    onUpdateProfile?.({ favoriteGenres: next });
  };

  useEffect(() => {
    if (!isOpen) return undefined;
    const prevFocused = returnFocusRef?.current || document.activeElement;
    closeBtnRef.current?.focus();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key === 'Tab' && drawerRef.current) {
        const focusables = drawerRef.current.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (prevFocused && typeof prevFocused.focus === 'function') {
        prevFocused.focus();
      }
    };
  }, [isOpen, onClose, returnFocusRef]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60"
      onClick={onClose}
    >
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Configurações do Perfil e Sistema"
        onClick={(e) => e.stopPropagation()}
        className="flex h-[100dvh] w-full max-w-md flex-col border-l border-line bg-card text-ink pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
      >
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-accent" strokeWidth={1.5} />
            <h2 className="text-sm font-semibold tracking-tight text-ink">
              Configurações
            </h2>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Fechar configurações"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[4px] border border-line text-muted hover:text-ink"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex-1 divide-y divide-line overflow-y-auto no-scrollbar">
          {/* 1. Conta & Sincronização Nuvem */}
          <section className="space-y-2.5 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {isSupabaseMode ? (
                  <Cloud className="h-4 w-4 shrink-0 text-accent" strokeWidth={1.5} />
                ) : (
                  <HardDrive className="h-4 w-4 shrink-0 text-accent" strokeWidth={1.5} />
                )}
                <h3 className="text-xs font-semibold uppercase tracking-wider text-ink">
                  Sincronização em Tempo Real (Avançado)
                </h3>
              </div>
              <span className="rounded-[4px] border border-line bg-app px-2 py-0.5 text-[10px] font-medium text-accent">
                {isSupabaseMode ? 'Supabase Ativo' : 'Local / Sem Servidor'}
              </span>
            </div>

            <p className="text-[11px] leading-relaxed text-muted">
              {isSupabaseMode
                ? 'Sincronização automática em tempo real e rede na nuvem ativas entre dispositivos.'
                : 'Seus livros ficam protegidos no aparelho e você já pode trocar perfis por Link ou QR Code sem conta. Conecte o Supabase apenas se quiser sincronização automática em tempo real.'}
            </p>

            <button
              type="button"
              onClick={() => {
                onClose?.();
                onOpenAuthModal?.();
              }}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[4px] border border-line bg-app px-3 py-2 text-xs font-medium text-ink transition-colors hover:border-accent hover:text-accent"
            >
              {isSupabaseMode ? (
                <>
                  <Cloud className="h-4 w-4 text-accent" strokeWidth={1.5} />
                  <span>Gerenciar Sincronização Supabase</span>
                </>
              ) : (
                <>
                  <Users className="h-4 w-4 text-accent" strokeWidth={1.5} />
                  <span>Perfis Locais / Sincronização Supabase</span>
                </>
              )}
            </button>
          </section>

          {/* 2. Privacidade & Gamificação */}
          <section className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink">
                <Shield className="h-4 w-4 text-accent" strokeWidth={1.5} />
                <span>Privacidade &amp; Gamificação</span>
              </span>
              <span className="text-[11px] text-muted">
                {activeVisibilityMeta.label}
              </span>
            </div>

            <div
              role="radiogroup"
              aria-label="Visibilidade do perfil"
              className="grid grid-cols-3 gap-1.5"
            >
              {VISIBILITY_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isSelected = privacyLevel === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => onUpdateProfile?.({ privacyLevel: option.id })}
                    className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-[4px] border px-2 py-2 text-[11px] font-medium transition-colors ${
                      isSelected
                        ? 'border-accent bg-accent/15 text-ink'
                        : 'border-line bg-app text-muted hover:text-ink'
                    }`}
                  >
                    <Icon
                      className={`h-3.5 w-3.5 shrink-0 ${
                        isSelected ? 'text-accent' : 'text-subtle'
                      }`}
                      strokeWidth={1.5}
                    />
                    <span className="truncate">{option.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-subtle">
              {activeVisibilityMeta.description}
            </p>

            <div className="space-y-2">
              <PrivacySwitchRow
                icon={PenLine}
                label="Permitir recados no mural"
                description="Outros leitores podem deixar mensagens públicas no seu perfil."
                checked={profile?.allowWallPosts !== false}
                onToggle={() =>
                  onUpdateProfile?.({
                    allowWallPosts: !(profile?.allowWallPosts !== false),
                  })
                }
              />
              <PrivacySwitchRow
                icon={MessageSquare}
                label="Permitir comentários"
                description="Habilita comentários nas suas notas e mural."
                checked={profile?.allowComments !== false}
                onToggle={() =>
                  onUpdateProfile?.({
                    allowComments: !(profile?.allowComments !== false),
                  })
                }
              />
              <PrivacySwitchRow
                icon={MessagesSquare}
                label="Receber mensagens no chat"
                description="Permite iniciar conversas diretas com você."
                checked={profile?.allowDms !== false}
                onToggle={() =>
                  onUpdateProfile?.({
                    allowDms: !(profile?.allowDms !== false),
                  })
                }
              />
              <PrivacySwitchRow
                icon={Zap}
                label="Ativar Gamificação (XP, Níveis e Insígnias)"
                description="Exibe progresso de páginas, sequência e títulos de leitor."
                checked={gamificationEnabled}
                onToggle={() =>
                  onUpdateProfile?.({
                    gamificationEnabled: !gamificationEnabled,
                  })
                }
              />
            </div>
          </section>

          {/* 3. Preferências de Leitura & Gêneros */}
          <section className="space-y-3 p-4">
            <button
              type="button"
              onClick={() => setPrefsExpanded((prev) => !prev)}
              aria-expanded={prefsExpanded}
              className="flex min-h-[44px] w-full items-center justify-between gap-2 text-left"
            >
              <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink">
                <SlidersHorizontal className="h-4 w-4 text-accent" strokeWidth={1.5} />
                <span>Preferências de Leitura &amp; Gêneros</span>
              </span>
              <span
                className="text-[11px] tabular-nums"
                style={{ color: 'var(--text-secondary)' }}
              >
                {selectedGenres.length} gêneros · {selectedCriteria.length} critérios
              </span>
            </button>

            {prefsExpanded && (
              <div className="space-y-3.5 pt-1">
                <div>
                  <p className="mb-1.5 text-[11px] font-medium text-muted">
                    Foco principal
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {FOCUS_OPTIONS_META.map((opt) => {
                      const isSelected = selectedFocus === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => onUpdateProfile?.({ readerFocus: opt.id })}
                          className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-[4px] border px-2.5 py-1.5 text-left text-[11px] font-medium transition-colors ${
                            isSelected
                              ? 'border-accent bg-accent/15 text-ink'
                              : 'border-line bg-app hover:text-ink'
                          }`}
                          style={!isSelected ? { color: 'var(--text-secondary)' } : undefined}
                        >
                          {isSelected && (
                            <Check className="h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={1.5} />
                          )}
                          <span>{opt.id}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-baseline justify-between gap-2">
                    <p className="text-[11px] font-medium text-muted">
                      Critérios que você mais valoriza
                    </p>
                    <span
                      className="text-[10px]"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      1 ou mais
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {CRITERION_OPTIONS.map((criterion) => {
                      const isSelected = selectedCriteria.includes(criterion);
                      return (
                        <button
                          key={criterion}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => handleToggleCriterion(criterion)}
                          className={`flex min-h-[44px] items-center gap-1.5 rounded-[4px] border px-2.5 py-1.5 text-left text-[11px] font-medium transition-colors ${
                            isSelected
                              ? 'border-accent bg-accent/15 text-ink'
                              : 'border-line bg-app hover:text-ink'
                          }`}
                          style={!isSelected ? { color: 'var(--text-secondary)' } : undefined}
                        >
                          {isSelected && (
                            <Check className="h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={1.5} />
                          )}
                          <span className="leading-snug">{criterion}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="mb-1.5 text-[11px] font-medium text-muted">
                    Gêneros Favoritos (filtra as indicações da Home)
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {GENRE_OPTIONS.map((genre) => {
                      const isSelected = selectedGenres.includes(genre);
                      return (
                        <button
                          key={genre}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => handleToggleGenre(genre)}
                          className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-[4px] border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                            isSelected
                              ? 'border-accent bg-accent/15 text-ink'
                              : 'border-line bg-app hover:text-ink'
                          }`}
                          style={!isSelected ? { color: 'var(--text-secondary)' } : undefined}
                        >
                          {isSelected && (
                            <Check className="h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={1.5} />
                          )}
                          <span>{genre}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* 4. Provedor de IA */}
          <section className="space-y-2.5 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink">
                <Sparkles className="h-4 w-4 text-accent" strokeWidth={1.5} />
                <span>Provedor de IA</span>
              </span>
              {onOpenGeminiSettings && (
                <button
                  type="button"
                  onClick={() => {
                    onClose?.();
                    onOpenGeminiSettings();
                  }}
                  className="min-h-[36px] text-[11px] font-medium text-accent hover:underline"
                >
                  Abrir em modal
                </button>
              )}
            </div>
            {aiPanelSlot}
          </section>

          {/* 4. Backup & Snapshots */}
          <section className="space-y-2 p-4">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-accent" strokeWidth={1.5} />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink">
                Backup &amp; Snapshots
              </h3>
            </div>
            <div className="divide-y divide-line rounded-[4px] border border-line bg-app">
              <button
                type="button"
                onClick={() => {
                  onExportBackup?.();
                  onClose?.();
                }}
                className="flex min-h-[44px] w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-medium text-ink hover:bg-card"
              >
                <Database className="h-4 w-4 shrink-0 text-accent" strokeWidth={1.5} />
                <span>{profileCfg.backup.exportLabel}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onExportCsv?.();
                  onClose?.();
                }}
                className="flex min-h-[44px] w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-medium text-ink hover:bg-card"
              >
                <FileSpreadsheet className="h-4 w-4 shrink-0 text-accent" strokeWidth={1.5} />
                <span>{profileCfg.backup.exportCsvLabel}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onExportBibtex?.();
                  onClose?.();
                }}
                className="flex min-h-[44px] w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-medium text-ink hover:bg-card"
              >
                <BookMarked className="h-4 w-4 shrink-0 text-accent" strokeWidth={1.5} />
                <span>{profileCfg.backup.exportBibLabel}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose?.();
                  if (onOpenBackupModal) {
                    onOpenBackupModal();
                  } else {
                    onImportBackupClick?.();
                  }
                }}
                className="flex min-h-[44px] w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-medium text-ink hover:bg-card"
              >
                <Upload className="h-4 w-4 shrink-0 text-accent" strokeWidth={1.5} />
                <span>
                  {onOpenBackupModal
                    ? 'Restaurar Backup e Snapshots'
                    : profileCfg.backup.importLabel}
                </span>
              </button>
            </div>
          </section>

          {/* 5. Estúdio E-Ink */}
          <section className="space-y-2 p-4">
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-accent" strokeWidth={1.5} />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink">
                Estúdio E-Ink &amp; Interface
              </h3>
            </div>
            <div className="divide-y divide-line rounded-[4px] border border-line bg-app">
              <button
                type="button"
                onClick={() => {
                  onClose?.();
                  onOpenThemeStudio?.();
                }}
                className="flex min-h-[44px] w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium text-ink hover:bg-card"
              >
                <span className="inline-flex items-center gap-2.5">
                  <Palette className="h-4 w-4 text-accent" strokeWidth={1.5} />
                  <span>
                    Temas E-Ink, Fontes &amp; Atmosferas
                    {themeProps?.specialThemeId && (
                      <span className="ml-1.5 text-[10px] font-normal text-subtle">
                        (
                        {SPECIAL_THEMES.find(
                          (item) => item.id === themeProps.specialThemeId
                        )?.label || themeProps.specialThemeId}
                        )
                      </span>
                    )}
                  </span>
                </span>
                <span className="text-[11px] text-accent">Abrir</span>
              </button>
              {themeProps?.specialThemeId === 'pastel-glass' && (
                <div className="p-3">
                  <PastelPaletteCustomizer
                    pastelSubpaletteId={themeProps.pastelSubpaletteId}
                    pastelCustomColor={themeProps.pastelCustomColor}
                    onSelectPastelSubpalette={themeProps.onSelectPastelSubpalette}
                    onChangePastelColor={themeProps.onChangePastelColor}
                  />
                </div>
              )}
              <button
                type="button"
                onClick={onToggleSound}
                role="switch"
                aria-checked={soundOn}
                className="flex min-h-[44px] w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium text-ink hover:bg-card"
              >
                <span className="inline-flex items-center gap-2.5">
                  {soundOn ? (
                    <Volume2 className="h-4 w-4 text-accent" strokeWidth={1.5} />
                  ) : (
                    <VolumeX className="h-4 w-4 text-subtle" strokeWidth={1.5} />
                  )}
                  <span>Efeitos Sonoros Táteis</span>
                </span>
                <span className="text-[11px] text-muted">
                  {soundOn ? 'Ativo' : 'Mudo'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose?.();
                  onReopenOnboarding?.();
                }}
                className="flex min-h-[44px] w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-medium text-ink hover:bg-card"
              >
                <BookOpen className="h-4 w-4 shrink-0 text-accent" strokeWidth={1.5} />
                <span>Reabrir Boas-Vindas e Tutorial</span>
              </button>
            </div>
            <p className="pt-1 text-center text-[10px] tabular-nums text-subtle">
              Códice {CODICE_RELEASE.label}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
