import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Camera,
  Check,
  CheckCircle2,
  Compass,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Flame,
  GraduationCap,
  Headphones,
  KeyRound,
  Layers,
  Library,
  Moon,
  Palette,
  Quote,
  Smartphone,
  Sparkles,
  Sun,
  Tablet,
  Target,
  Upload,
  User,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { domainConfig } from '../config/domainConfig';

const FOCUS_OPTIONS = [
  { id: 'Leitor Casual', icon: BookOpen },
  { id: 'Leitor Voraz', icon: Flame },
  { id: 'Bibliotecário / Colecionador', icon: Library },
  { id: 'Mangás, Manhwas & Light Novels', icon: Layers },
  { id: 'Pesquisador / Acadêmico TCC', icon: GraduationCap },
];

const GOAL_PRESETS = [6, 12, 24, 50];

const FORMAT_OPTIONS = [
  { id: 'Livro Físico', icon: BookOpen },
  { id: 'Kindle / E-reader', icon: Tablet },
  { id: 'Digital / Webtoon / PDF', icon: Smartphone },
  { id: 'Audiobook', icon: Headphones },
];

const CRITERION_OPTIONS = [
  'Enredo e Ritmo',
  'Personagens e Profundidade',
  'Escrita e Imersão',
  'Impacto e Conhecimento',
];

const ATMOSPHERE_OPTIONS = [
  { id: 'Papel Pergaminho', mode: 'parchment', bg: '#FAF8F5', accent: '#8B5CF6', icon: Sun },
  { id: 'Biblioteca Noturna', mode: 'night_library', bg: '#121316', accent: '#8B5CF6', icon: Moon },
  { id: 'Tinta OLED', mode: 'oled', bg: '#000000', accent: '#8B5CF6', icon: Sparkles },
  { id: 'Dark Academia', preset: 'dark-academia', bg: '#161310', accent: '#C89B54', icon: Palette },
];

const GENRE_OPTIONS = [
  'Fantasia Épica',
  'Ficção Científica',
  'Suspense e Thriller',
  'Terror e Gótico',
  'Romance',
  'Clássicos',
  'Filosofia',
  'História',
  'Psicologia',
  'Tecnologia e Computação',
  'Acadêmico e TCC',
  'Mangá (Shonen / Seinen)',
  'Manhwa / Webtoon',
  'Light Novel',
  'HQ / Graphic Novel',
  'Biografias',
  'Poesia',
  'Não-Ficção',
];

const TUTORIAL_AREAS = [
  {
    title: 'Catalogar & TCC/ABNT',
    desc: 'Busque em Google Books, Open Library e Jikan, organize livros, mangás ou gere citações ABNT.',
    icon: GraduationCap,
  },
  {
    title: 'Diário & GIFs',
    desc: 'Registre momentos da leitura com fotos, GIFs via Openverse e marcador exato de página ou capítulo.',
    icon: Camera,
  },
  {
    title: 'Cofre de Citações 1080x1350',
    desc: 'Salve trechos marcantes com notas analíticas e baixe cards editoriais com suas cores e fonte.',
    icon: Quote,
  },
  {
    title: 'Estúdio de Ambiente',
    desc: 'Personalize atmosferas, presets literários, cores livres e tipografia global em tempo real.',
    icon: Palette,
  },
  {
    title: 'Oráculo IA',
    desc: 'Cruze seu humor do momento com Na Estante e seus gêneros favoritos para escolher a próxima leitura.',
    icon: Compass,
  },
  {
    title: 'Backup .json',
    desc: 'Seus dados ficam 100% locais com exportação e restauração instantânea em arquivo .json.',
    icon: Download,
  },
];

export function OnboardingFlow({
  isOpen,
  canDismiss = false,
  profile,
  geminiKey = '',
  onSelectThemeMode,
  onApplyThemePreset,
  onChangeAccentColor,
  onSaveGeminiKey,
  onImportBackup,
  onComplete,
  onDismiss,
}) {
  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState('');
  const [age, setAge] = useState('');
  const [readerFocus, setReaderFocus] = useState('Leitor Casual');
  const [annualGoal, setAnnualGoal] = useState(12);
  const [preferredFormat, setPreferredFormat] = useState('Livro Físico');
  const [preferredCriterion, setPreferredCriterion] = useState('Enredo e Ritmo');
  const [preferredAtmosphere, setPreferredAtmosphere] = useState('Tinta OLED');
  const [favoriteGenres, setFavoriteGenres] = useState([]);
  const [draftGeminiKey, setDraftGeminiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [backupError, setBackupError] = useState('');

  const fileInputRef = useRef(null);
  const latestInitRef = useRef({ profile, geminiKey });
  latestInitRef.current = { profile, geminiKey };

  useEffect(() => {
    if (!isOpen) return;
    const { profile: currentProfile, geminiKey: currentKey } =
      latestInitRef.current;

    setStep(1);
    setDisplayName(
      currentProfile?.displayName && currentProfile.displayName !== 'aihkaze'
        ? currentProfile.displayName
        : ''
    );
    setAge(currentProfile?.age ? String(currentProfile.age) : '');
    setReaderFocus(currentProfile?.readerFocus || 'Leitor Casual');
    setAnnualGoal(Number(currentProfile?.annualGoal) || 12);
    setPreferredFormat(currentProfile?.preferredFormat || 'Livro Físico');
    setPreferredCriterion(
      currentProfile?.preferredCriterion || 'Enredo e Ritmo'
    );
    setPreferredAtmosphere(
      currentProfile?.preferredAtmosphere || 'Tinta OLED'
    );
    setFavoriteGenres(
      Array.isArray(currentProfile?.favoriteGenres)
        ? currentProfile.favoriteGenres
        : []
    );
    setDraftGeminiKey(currentKey || '');
    setShowKey(false);
    setBackupError('');
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !canDismiss) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onDismiss?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, canDismiss, onDismiss]);

  if (!isOpen) return null;

  const progressPct = (step / 5) * 100;

  const handleSelectAtmosphere = (opt) => {
    setPreferredAtmosphere(opt.id);
    if (opt.preset) {
      onApplyThemePreset?.(opt.preset);
    } else if (opt.mode) {
      onSelectThemeMode?.(opt.mode);
      if (opt.accent) {
        onChangeAccentColor?.(opt.accent);
      }
    }
  };

  const toggleGenre = (genre) => {
    setFavoriteGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  const handleRestoreFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBackupError('');

    const result = await onImportBackup?.(file);
    if (result?.ok) {
      onDismiss?.();
    } else {
      setBackupError(result?.error || 'Não foi possível importar o arquivo JSON.');
    }
  };

  const handleSaveKeyAndContinue = () => {
    if (draftGeminiKey.trim()) {
      onSaveGeminiKey?.(draftGeminiKey.trim());
    }
    setStep(5);
  };

  const handleFinish = () => {
    const cleanName = displayName.trim();
    if (draftGeminiKey.trim() && draftGeminiKey.trim() !== geminiKey) {
      onSaveGeminiKey?.(draftGeminiKey.trim());
    }

    onComplete({
      ...(cleanName ? { displayName: cleanName } : {}),
      age: age.trim(),
      readerFocus,
      annualGoal: Math.max(1, Number(annualGoal) || 12),
      preferredFormat,
      preferredCriterion,
      preferredAtmosphere,
      favoriteGenres,
      onboardingCompleted: true,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-app text-ink">
      <div className="mx-auto flex h-full w-full max-w-md flex-col sm:border-x sm:border-line/60">
        {/* Barra superior de progresso */}
        <header className="px-4 pt-4 pb-3 border-b border-line">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <BookOpen className="h-4 w-4 shrink-0 text-accent" strokeWidth={1.5} />
              <span className="text-xs font-semibold tracking-tight text-ink">
                {domainConfig.appName}
              </span>
              <span className="hidden sm:inline text-[11px] text-subtle truncate">
                {domainConfig.signature}
              </span>
              <span className="rounded-full border border-line bg-card px-2 py-0.5 text-[10px] font-medium text-muted">
                Etapa {step}/5
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {step < 5 && (
                <button
                  type="button"
                  onClick={() => setStep((prev) => Math.min(5, prev + 1))}
                  className="rounded-lg px-2 py-1 text-[11px] font-medium text-muted hover:text-ink"
                >
                  Pular etapa
                </button>
              )}
              {canDismiss && (
                <button
                  type="button"
                  onClick={onDismiss}
                  aria-label="Fechar tutorial"
                  className="rounded-full p-1 text-muted hover:bg-card hover:text-ink"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-accent transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </header>

        {/* Conteúdo da etapa */}
        <div className="flex-1 overflow-y-auto px-4 py-5 no-scrollbar">
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-accent/30 bg-accent/15 text-accent">
                  <User className="h-5 w-5" />
                </div>
                <h1 className="mt-3 text-lg font-semibold tracking-tight text-ink">
                  Bem-vindo à sua Estante Editorial
                </h1>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  Configure seu perfil local-first em segundos. Tudo fica salvo no
                  seu navegador com backup portátil em JSON.
                </p>
              </div>

              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-muted">
                    Como prefere ser chamado?
                  </span>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Seu nome ou apelido literário"
                    className="w-full rounded-2xl border border-line bg-card px-3.5 py-3 text-sm text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-muted">
                    Idade (opcional)
                  </span>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="Ex: 24"
                    className="w-full rounded-2xl border border-line bg-card px-3.5 py-3 text-sm text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
                  />
                </label>
              </div>

              <div className="rounded-2xl border border-dashed border-line bg-card p-3.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 text-xs font-medium text-muted transition-colors hover:text-accent"
                >
                  <Upload className="h-3.5 w-3.5 text-accent" />
                  <span>Já tenho um backup (.json) — Restaurar acervo</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleRestoreFile}
                  className="hidden"
                />
                {backupError && (
                  <p className="mt-2 text-center text-[11px] text-rose-400">
                    {backupError}
                  </p>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-ink">
                  Perfil do Leitor
                </h2>
                <p className="mt-1 text-xs text-muted">
                  Personalize metas, formato e atmosfera inicial da estante.
                </p>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-muted">
                  1. Qual é o seu foco principal?
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {FOCUS_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const isSelected = readerFocus === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setReaderFocus(opt.id)}
                        className={`flex items-center gap-3 rounded-2xl border px-3.5 py-2.5 text-left text-xs font-medium transition-colors ${
                          isSelected
                            ? 'border-accent bg-accent/15 text-ink'
                            : 'border-line bg-card text-muted hover:text-ink'
                        }`}
                      >
                        <Icon
                          className={`h-4 w-4 shrink-0 ${
                            isSelected ? 'text-accent' : 'text-subtle'
                          }`}
                        />
                        <span>{opt.id}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
                    <Target className="h-3.5 w-3.5 text-accent" />
                    2. Meta anual de obras
                  </p>
                  <input
                    type="number"
                    min="1"
                    max="999"
                    value={annualGoal}
                    onChange={(e) => setAnnualGoal(e.target.value)}
                    aria-label="Meta anual personalizada"
                    className="w-16 rounded-lg border border-line bg-card px-2 py-1 text-right text-xs font-semibold text-ink focus:border-accent focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {GOAL_PRESETS.map((goal) => {
                    const isSelected = Number(annualGoal) === goal;
                    return (
                      <button
                        key={goal}
                        type="button"
                        onClick={() => setAnnualGoal(goal)}
                        className={`rounded-xl border py-2.5 text-xs font-semibold transition-colors ${
                          isSelected
                            ? 'border-accent bg-accent/15 text-ink'
                            : 'border-line bg-card text-muted hover:text-ink'
                        }`}
                      >
                        {goal}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-muted">
                  3. Formato predominante
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {FORMAT_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const isSelected = preferredFormat === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setPreferredFormat(opt.id)}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-[11px] font-medium transition-colors ${
                          isSelected
                            ? 'border-accent bg-accent/15 text-ink'
                            : 'border-line bg-card text-muted hover:text-ink'
                        }`}
                      >
                        <Icon
                          className={`h-3.5 w-3.5 shrink-0 ${
                            isSelected ? 'text-accent' : 'text-subtle'
                          }`}
                        />
                        <span className="truncate">{opt.id}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-muted">
                  4. Critério que você mais valoriza
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {CRITERION_OPTIONS.map((criterion) => {
                    const isSelected = preferredCriterion === criterion;
                    return (
                      <button
                        key={criterion}
                        type="button"
                        onClick={() => setPreferredCriterion(criterion)}
                        className={`rounded-xl border px-3 py-2 text-left text-[11px] font-medium transition-colors ${
                          isSelected
                            ? 'border-accent bg-accent/15 text-ink'
                            : 'border-line bg-card text-muted hover:text-ink'
                        }`}
                      >
                        {criterion}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-muted">
                  5. Atmosfera visual inicial (aplica ao vivo)
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {ATMOSPHERE_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const isSelected = preferredAtmosphere === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleSelectAtmosphere(opt)}
                        className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-[11px] font-medium transition-colors ${
                          isSelected
                            ? 'border-accent bg-accent/15 text-ink'
                            : 'border-line bg-card text-muted hover:text-ink'
                        }`}
                      >
                        <span
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/20"
                          style={{
                            background: `linear-gradient(135deg, ${opt.bg} 55%, ${opt.accent} 55%)`,
                          }}
                        />
                        <span className="flex-1 truncate">{opt.id}</span>
                        <Icon
                          className={`h-3 w-3 shrink-0 ${
                            isSelected ? 'text-accent' : 'text-subtle'
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-ink">
                  Gêneros Favoritos
                </h2>
                <p className="mt-1 text-xs text-muted">
                  Selecione quantos quiser. O Oráculo do Acervo usará essas
                  preferências para recomendações personalizadas.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {GENRE_OPTIONS.map((genre) => {
                  const isSelected = favoriteGenres.includes(genre);
                  return (
                    <button
                      key={genre}
                      type="button"
                      onClick={() => toggleGenre(genre)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium transition-colors ${
                        isSelected
                          ? 'border-accent bg-accent/15 text-ink'
                          : 'border-line bg-card text-muted hover:text-ink'
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3 text-accent" />}
                      {genre}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-accent/30 bg-accent/15 text-accent">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-ink">
                  Inteligência Google Gemini Gratuita
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  Ative catalogação automática com ABNT, Oráculo do Acervo,
                  Recapitulação sem spoilers e Sínteses críticas usando sua chave
                  pessoal gratuita.
                </p>
              </div>

              <div className="space-y-2 rounded-2xl border border-line bg-card p-3.5 text-xs text-muted">
                <p className="font-semibold text-ink">
                  Como gerar sua chave gratuita:
                </p>
                <ol className="list-decimal space-y-1.5 pl-4 leading-relaxed">
                  <li>Acesse o Google AI Studio pelo botão abaixo.</li>
                  <li>Clique em &quot;Create API Key&quot; usando sua conta Google.</li>
                  <li>Cole a chave aqui — ela fica salva só neste dispositivo.</li>
                </ol>
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 font-semibold text-accent hover:underline"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  Abrir Google AI Studio
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-muted">
                  Chave da API (opcional agora)
                </span>
                <div className="relative flex items-center">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={draftGeminiKey}
                    onChange={(e) => setDraftGeminiKey(e.target.value)}
                    placeholder="AIza..."
                    className="w-full rounded-xl border border-line bg-card py-2.5 pl-3 pr-10 font-mono text-xs text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((prev) => !prev)}
                    aria-label={showKey ? 'Ocultar chave' : 'Mostrar chave'}
                    className="absolute right-2.5 rounded p-1 text-subtle hover:text-ink"
                  >
                    {showKey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </label>

              <button
                type="button"
                onClick={() => setStep(5)}
                className="w-full rounded-xl border border-line bg-card py-2.5 text-xs font-medium text-muted hover:text-ink"
              >
                Configurar depois
              </button>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-ink">
                  Guia Rápido do {domainConfig.appName}
                </h2>
                <p className="mt-1 text-xs text-muted">
                  Tudo o que você pode explorar no seu {domainConfig.appSubtitle.toLowerCase()}:
                </p>
              </div>

              <div className="space-y-2.5">
                {TUTORIAL_AREAS.map((area) => {
                  const Icon = area.icon;
                  return (
                    <div
                      key={area.title}
                      className="flex items-start gap-3 rounded-2xl border border-line bg-card p-3"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-accent/30 bg-accent/15 text-accent">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-xs font-semibold text-ink">
                          {area.title}
                        </h3>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
                          {area.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Rodapé de navegação entre etapas */}
        <footer className="border-t border-line bg-app px-4 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-2.5">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((prev) => Math.max(1, prev - 1))}
                className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-line bg-card px-4 py-3 text-xs font-semibold text-ink hover:border-accent/50"
              >
                <ArrowLeft className="h-3.5 w-3.5 text-accent" />
                Voltar
              </button>
            )}

            {step < 5 ? (
              <button
                type="button"
                onClick={() =>
                  step === 4
                    ? handleSaveKeyAndContinue()
                    : setStep((prev) => Math.min(5, prev + 1))
                }
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-accent py-3 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90"
              >
                <span>{step === 4 && draftGeminiKey.trim() ? 'Salvar e Continuar' : 'Continuar'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-accent py-3 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Entrar na Minha Estante</span>
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
