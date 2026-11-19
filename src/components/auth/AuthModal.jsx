import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cloud,
  Eye,
  EyeOff,
  HardDrive,
  Loader2,
  LogIn,
  LogOut,
  Server,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  BackendError,
  clearSupabaseConfig,
  continueInLocalMode,
  getBackendMode,
  getSupabaseConfig,
  isSupabaseConfigured,
  listLocalProfiles,
  normalizeHandle,
  saveSupabaseConfig,
  setForceLocalMode,
  signInAccount,
  signOutAccount,
  signUpAccount,
  switchLocalProfile,
} from '../../services/codiceBackend';

export function AuthModal({
  isOpen,
  onClose,
  backendSession,
  currentWorkspace,
  onAuthSuccess,
}) {
  const [authTab, setAuthTab] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [localProfiles, setLocalProfiles] = useState([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  const [serverConfigOpen, setServerConfigOpen] = useState(false);
  const [supabaseUrlInput, setSupabaseUrlInput] = useState('');
  const [supabaseKeyInput, setSupabaseKeyInput] = useState('');
  const [backendMode, setBackendMode] = useState(getBackendMode);
  const [hasRemoteConfig, setHasRemoteConfig] = useState(isSupabaseConfigured);
  const [remoteSource, setRemoteSource] = useState('none');

  const refreshModalMeta = async () => {
    setLoadingProfiles(true);
    try {
      const cfg = getSupabaseConfig();
      setHasRemoteConfig(cfg.configured);
      setRemoteSource(cfg.source);
      setSupabaseUrlInput(cfg.url || '');
      setSupabaseKeyInput(cfg.anonKey || '');
      setBackendMode(getBackendMode());

      const list = await listLocalProfiles();
      setLocalProfiles(list);
    } catch {
      setLocalProfiles([]);
    } finally {
      setLoadingProfiles(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setErrorMessage('');
    setInfoMessage('');
    setPassword('');
    setShowPassword(false);
    refreshModalMeta();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isSupabaseMode = backendMode === 'supabase';

  const handleAuthError = (err) => {
    if (err instanceof BackendError) {
      setErrorMessage(err.userMessage);
    } else {
      setErrorMessage(err?.message || 'Não foi possível concluir a operação.');
    }
  };

  const handleSubmitForm = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    setInfoMessage('');
    setSubmitting(true);

    try {
      if (authTab === 'login') {
        const res = await signInAccount({
          identifier: email,
          password,
          currentWorkspace,
        });
        await onAuthSuccess?.(res);
        onClose?.();
        return;
      }

      const res = await signUpAccount({
        email,
        password,
        handle: handle || displayName,
        displayName,
        currentWorkspace,
      });

      if (res.requiresEmailConfirmation) {
        setInfoMessage(
          'Conta criada! Verifique seu e-mail para confirmar o acesso e depois entre.'
        );
        setAuthTab('login');
        await refreshModalMeta();
        return;
      }

      await onAuthSuccess?.(res);
      onClose?.();
    } catch (err) {
      handleAuthError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleContinueLocal = async () => {
    setErrorMessage('');
    setInfoMessage('');
    setSubmitting(true);
    try {
      const res = await continueInLocalMode({ currentWorkspace });
      setBackendMode('local');
      await onAuthSuccess?.(res);
      onClose?.();
    } catch (err) {
      handleAuthError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSwitchProfile = async (targetUserId) => {
    setErrorMessage('');
    setInfoMessage('');
    setSubmitting(true);
    try {
      const res = await switchLocalProfile(targetUserId, { currentWorkspace });
      await onAuthSuccess?.(res);
      onClose?.();
    } catch (err) {
      handleAuthError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    setErrorMessage('');
    setInfoMessage('');
    setSubmitting(true);
    try {
      const res = await signOutAccount({ currentWorkspace });
      await onAuthSuccess?.(res);
      await refreshModalMeta();
      setInfoMessage('Sessão encerrada. Seus dados locais foram preservados.');
    } catch (err) {
      handleAuthError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveSupabaseServer = (event) => {
    event.preventDefault();
    setErrorMessage('');
    setInfoMessage('');
    try {
      saveSupabaseConfig({
        url: supabaseUrlInput,
        anonKey: supabaseKeyInput,
      });
      setBackendMode(getBackendMode());
      setHasRemoteConfig(true);
      setRemoteSource('localStorage');
      setServerConfigOpen(false);
      setInfoMessage('Conexão Supabase salva no dispositivo. Entre ou crie sua conta na nuvem.');
    } catch (err) {
      handleAuthError(err);
    }
  };

  const handleResetSupabaseServer = () => {
    clearSupabaseConfig();
    setForceLocalMode(false);
    setHasRemoteConfig(false);
    setRemoteSource('none');
    setSupabaseUrlInput('');
    setSupabaseKeyInput('');
    setBackendMode('local');
    setInfoMessage('Configuração remota removida. Operando em Motor Local IndexedDB.');
  };

  const activeUser = backendSession?.user || null;
  const activeProfile = backendSession?.profile || null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-xs p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="codice-auth-title"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-line bg-card p-5 pb-8 shadow-2xl no-scrollbar space-y-4"
      >
        <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-line sm:hidden" />

        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id="codice-auth-title"
                className="text-base font-semibold tracking-tight text-ink"
              >
                Conta & Perfis Códice
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/15 px-2.5 py-0.5 text-[10px] font-semibold text-accent">
                {isSupabaseMode ? (
                  <Cloud className="h-3 w-3" strokeWidth={1.5} />
                ) : (
                  <HardDrive className="h-3 w-3" strokeWidth={1.5} />
                )}
                {isSupabaseMode ? 'Supabase' : 'Motor Local Offline'}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted">
              {isSupabaseMode
                ? 'Sincronize sua biblioteca, resenhas e perfil social na nuvem.'
                : 'Crie contas locais no IndexedDB ou alterne entre leitores offline neste dispositivo.'}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela de autenticação"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-elevated hover:text-ink"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </header>

        {/* Sessão ativa */}
        {activeUser && activeProfile && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-app p-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-accent/60 bg-card text-xs font-bold text-ink">
                {activeProfile.avatarUrl ? (
                  <img
                    src={activeProfile.avatarUrl}
                    alt={activeProfile.displayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>{activeProfile.avatarInitials || 'LC'}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-ink">
                  {activeProfile.displayName}
                </p>
                <p className="truncate text-[11px] text-muted">
                  {activeProfile.handle}
                  {activeUser.email ? ` · ${activeUser.email}` : ' · Perfil offline'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              disabled={submitting}
              className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl border border-line bg-card px-3 py-2 text-xs font-medium text-muted transition-colors hover:border-rose-500/40 hover:text-rose-400"
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={1.5} />
              <span>Sair</span>
            </button>
          </div>
        )}

        {errorMessage && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-rose-500/35 bg-rose-500/10 p-3 text-xs text-rose-400"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} />
            <span>{errorMessage}</span>
          </div>
        )}

        {infoMessage && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-xl border border-accent/40 bg-accent/10 p-3 text-xs text-accent"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} />
            <span>{infoMessage}</span>
          </div>
        )}

        {/* Alternador Entrar / Criar Conta */}
        <div
          role="tablist"
          aria-label="Tipo de acesso"
          className="grid grid-cols-2 rounded-2xl border border-line bg-app p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={authTab === 'login'}
            onClick={() => {
              setAuthTab('login');
              setErrorMessage('');
            }}
            className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-colors ${
              authTab === 'login'
                ? 'bg-accent text-accent-ink'
                : 'text-muted hover:text-ink'
            }`}
          >
            <LogIn className="h-4 w-4" strokeWidth={1.5} />
            <span>Entrar</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={authTab === 'signup'}
            onClick={() => {
              setAuthTab('signup');
              setErrorMessage('');
            }}
            className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-colors ${
              authTab === 'signup'
                ? 'bg-accent text-accent-ink'
                : 'text-muted hover:text-ink'
            }`}
          >
            <UserPlus className="h-4 w-4" strokeWidth={1.5} />
            <span>Criar Conta</span>
          </button>
        </div>

        <form onSubmit={handleSubmitForm} className="space-y-3">
          {authTab === 'signup' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">
                  Nome
                </span>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Ex.: Mariana Silva"
                  className="min-h-[44px] w-full rounded-xl border border-line bg-app px-3 py-2 text-xs text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">
                  @handle
                </span>
                <input
                  type="text"
                  required
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  onBlur={() => {
                    if (handle.trim()) {
                      setHandle(normalizeHandle(handle, displayName));
                    }
                  }}
                  placeholder="@marianasilva"
                  className="min-h-[44px] w-full rounded-xl border border-line bg-app px-3 py-2 text-xs text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
                />
              </label>
            </div>
          )}

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">
              {authTab === 'login' && !isSupabaseMode ? 'E-mail ou @handle' : 'E-mail'}
            </span>
            <input
              type={authTab === 'signup' || isSupabaseMode ? 'email' : 'text'}
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={
                authTab === 'login' && !isSupabaseMode
                  ? 'voce@exemplo.com ou @handle'
                  : 'voce@exemplo.com'
              }
              className="min-h-[44px] w-full rounded-xl border border-line bg-app px-3 py-2 text-xs text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">
              Senha
            </span>
            <div className="relative flex items-center">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={authTab === 'signup' ? 6 : undefined}
                autoComplete={
                  authTab === 'signup' ? 'new-password' : 'current-password'
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="min-h-[44px] w-full rounded-xl border border-line bg-app py-2 pl-3 pr-11 text-xs text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                className="absolute right-1 flex h-10 w-10 items-center justify-center rounded-lg text-subtle hover:text-ink"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-accent" strokeWidth={1.5} />
                ) : (
                  <Eye className="h-4 w-4" strokeWidth={1.5} />
                )}
              </button>
            </div>
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
            ) : authTab === 'login' ? (
              <LogIn className="h-4 w-4" strokeWidth={1.5} />
            ) : (
              <UserPlus className="h-4 w-4" strokeWidth={1.5} />
            )}
            <span>
              {authTab === 'login'
                ? isSupabaseMode
                  ? 'Entrar no Códice (Nuvem)'
                  : 'Entrar no Perfil Local'
                : isSupabaseMode
                  ? 'Criar Conta no Supabase'
                  : 'Criar Conta Local Offline'}
            </span>
          </button>
        </form>

        {/* Botão explícito Continuar em Modo Local */}
        <button
          type="button"
          onClick={handleContinueLocal}
          disabled={submitting}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border border-line bg-app px-4 py-2.5 text-xs font-semibold text-ink transition-colors hover:border-accent/60 hover:bg-elevated"
        >
          <HardDrive className="h-4 w-4 text-accent" strokeWidth={1.5} />
          <span>Continuar em Modo Local</span>
        </button>

        {/* Perfis Locais no IndexedDB */}
        <section
          aria-label="Perfis locais neste dispositivo"
          className="rounded-2xl border border-line bg-app p-3.5 space-y-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink">
              <Users className="h-4 w-4 text-accent" strokeWidth={1.5} />
              Perfis Locais neste Dispositivo
            </span>
            <span className="text-[11px] text-subtle">
              {localProfiles.length} {localProfiles.length === 1 ? 'perfil' : 'perfis'}
            </span>
          </div>

          {loadingProfiles ? (
            <p className="py-2 text-xs text-muted">Carregando perfis locais...</p>
          ) : localProfiles.length === 0 ? (
            <p className="py-1 text-xs text-muted">
              Nenhum perfil salvo localmente ainda. Crie uma conta acima ou clique em Continuar em Modo Local.
            </p>
          ) : (
            <div className="space-y-2 max-h-44 overflow-y-auto pr-0.5">
              {localProfiles.map((prof) => (
                <div
                  key={prof.id}
                  className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 ${
                    prof.isActive
                      ? 'border-accent/50 bg-accent/10'
                      : 'border-line bg-card'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-elevated text-[11px] font-bold text-ink">
                      {prof.avatarUrl ? (
                        <img
                          src={prof.avatarUrl}
                          alt={prof.displayName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span>{prof.avatarInitials || 'LC'}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-ink">
                        {prof.displayName}
                      </p>
                      <p className="truncate text-[10px] text-muted">
                        {prof.handle} · {prof.workCount}{' '}
                        {prof.workCount === 1 ? 'obra' : 'obras'}
                      </p>
                    </div>
                  </div>

                  {prof.isActive ? (
                    <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-[10px] font-semibold text-accent-ink">
                      Ativo
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSwitchProfile(prof.id)}
                      disabled={submitting}
                      className="min-h-[36px] shrink-0 rounded-xl border border-line bg-elevated px-3 py-1 text-[11px] font-medium text-ink transition-colors hover:border-accent/60 hover:text-accent"
                    >
                      Alternar
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Configuração opcional do Supabase (quando não está em .env) */}
        <div className="rounded-2xl border border-line bg-app overflow-hidden">
          <button
            type="button"
            onClick={() => setServerConfigOpen((prev) => !prev)}
            aria-expanded={serverConfigOpen}
            className="flex min-h-[44px] w-full items-center justify-between gap-2 px-3.5 py-2 text-left text-xs font-medium text-muted transition-colors hover:text-ink"
          >
            <span className="inline-flex items-center gap-2">
              <Server className="h-4 w-4 text-accent" strokeWidth={1.5} />
              Conexão Supabase ({hasRemoteConfig ? 'Configurado' : 'Opcional'})
            </span>
            {serverConfigOpen ? (
              <ChevronUp className="h-4 w-4 text-accent" strokeWidth={1.5} />
            ) : (
              <ChevronDown className="h-4 w-4 text-accent" strokeWidth={1.5} />
            )}
          </button>

          {serverConfigOpen && (
            <form
              onSubmit={handleSaveSupabaseServer}
              className="space-y-2.5 border-t border-line p-3.5"
            >
              <p className="text-[11px] leading-relaxed text-muted">
                O Códice detecta <code className="text-ink">VITE_SUPABASE_URL</code> e{' '}
                <code className="text-ink">VITE_SUPABASE_ANON_KEY</code> do{' '}
                <code className="text-ink">.env</code> ou deste dispositivo.
                {remoteSource === 'env' ? ' Atualmente carregado via .env.' : ''}
              </p>

              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-muted">
                  Supabase URL
                </span>
                <input
                  type="url"
                  value={supabaseUrlInput}
                  onChange={(e) => setSupabaseUrlInput(e.target.value)}
                  placeholder="https://seu-projeto.supabase.co"
                  className="min-h-[44px] w-full rounded-xl border border-line bg-card px-3 py-2 font-mono text-[11px] text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-muted">
                  Supabase Anon Key
                </span>
                <input
                  type="password"
                  value={supabaseKeyInput}
                  onChange={(e) => setSupabaseKeyInput(e.target.value)}
                  placeholder="eyJhbGci..."
                  className="min-h-[44px] w-full rounded-xl border border-line bg-card px-3 py-2 font-mono text-[11px] text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
                />
              </label>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="submit"
                  className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-accent-ink hover:opacity-90"
                >
                  Salvar & Usar Supabase
                </button>

                {hasRemoteConfig && !isSupabaseMode && (
                  <button
                    type="button"
                    onClick={() => {
                      setForceLocalMode(false);
                      setBackendMode(getBackendMode());
                      setInfoMessage('Modo nuvem Supabase reativado.');
                    }}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-accent/50 bg-accent/15 px-3 py-2 text-xs font-semibold text-accent"
                  >
                    Reativar Nuvem
                  </button>
                )}

                {remoteSource === 'localStorage' && (
                  <button
                    type="button"
                    onClick={handleResetSupabaseServer}
                    aria-label="Limpar configuração Supabase"
                    className="inline-flex min-h-[44px] items-center justify-center gap-1 rounded-xl border border-line bg-card px-3 py-2 text-xs font-medium text-rose-400 hover:border-rose-500/40"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                    Limpar
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
